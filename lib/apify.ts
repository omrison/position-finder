import { ApifyClient } from "apify-client";
import { z } from "zod";
import type { JobResult, SearchStats } from "@/types";
import { TIMEFRAME_MS } from "@/lib/constants";

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

const IndeedRawJobSchema = z.object({
  positionName: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  postingDateParsed: z.string().optional(),
  postedAt: z.string().optional(),
  externalApplyLink: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
});

type IndeedRawJob = z.infer<typeof IndeedRawJobSchema>;

export type RawJobResult = JobResult & { description: string };

function normalizeIndeedJob(raw: IndeedRawJob): RawJobResult {
  return {
    role: raw.positionName ?? "Unknown Role",
    company: raw.company ?? "Unknown Company",
    // postingDateParsed is the real ISO date; postedAt is human text like "Just posted"
    postedAt: raw.postingDateParsed ?? new Date().toISOString(),
    source: "Indeed IL",
    url: raw.externalApplyLink ?? raw.url ?? "#",
    score: 0,
    description: raw.description ?? "",
  };
}

export interface ApifySearchResult {
  jobs: RawJobResult[];
  stats: Pick<SearchStats, "scraped" | "duplicatesRemoved" | "outsideRegions">;
}

export async function searchJobs(
  regions: string[],
  timeframe: string
): Promise<ApifySearchResult> {
  const cutoff =
    Date.now() - (TIMEFRAME_MS[timeframe] ?? TIMEFRAME_MS["24h"]);

  const locationList = regions.filter((r) => r !== "Remote");
  // If only Remote selected, search all of Israel
  const searchLocations = locationList.length > 0 ? locationList : ["Israel"];

  // Run one Indeed search per location in parallel (capped at 50 results each)
  const scrapePromises = searchLocations.map((location) =>
    client
      .actor("misceres/indeed-scraper")
      .call({
        position: "software developer OR engineer OR programmer",
        country: "IL",
        location,
        maxItems: 50,
      })
      .then(async (run) => {
        const { items } = await client
          .dataset(run.defaultDatasetId)
          .listItems();
        console.log(`[apify] Indeed "${location}": ${items.length} items, status: ${run.status}`);
        return items
          .map((item) => IndeedRawJobSchema.safeParse(item))
          .filter((r) => r.success)
          .map((r) => normalizeIndeedJob((r as z.ZodSafeParseSuccess<IndeedRawJob>).data));
      })
      .catch((err) => {
        console.error(`[apify] Indeed "${location}" failed:`, err?.message ?? err);
        return [] as RawJobResult[];
      })
  );

  const allResults = (await Promise.all(scrapePromises)).flat();
  const scraped = allResults.length;

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = allResults.filter((job) => {
    if (job.url === "#" || seen.has(job.url)) return false;
    seen.add(job.url);
    return true;
  });
  const duplicatesRemoved = scraped - deduped.length;

  // Filter to selected timeframe
  const withinTimeframe = deduped.filter(
    (job) => new Date(job.postedAt).getTime() >= cutoff
  );
  const outsideRegions = deduped.length - withinTimeframe.length;

  return {
    jobs: withinTimeframe,
    stats: { scraped, duplicatesRemoved, outsideRegions },
  };
}
