import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { auth } from "@/auth";
import { searchJobs } from "@/lib/apify";
import { scoreJobs } from "@/lib/scoreJobs";
import { checkRateLimit } from "@/lib/ratelimit";
import { recordOperation } from "@/lib/dal";
import { REGIONS, TIMEFRAME_MS } from "@/lib/constants";
import type { CandidateProfile } from "@/types";

const VALID_REGIONS = new Set<string>(REGIONS);

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const session = await auth();
  if (!session?.user?.email) {
    console.warn("[auth] Unauthenticated request to search-jobs", { ip });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await checkRateLimit(`search-jobs:${session.user.email}`, 5, 60_000))) {
    console.warn("[ratelimit] search-jobs limit exceeded", { user: session.user.email });
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = (await req.json()) as {
    profile?: CandidateProfile;
    regions?: string[];
    timeframe?: string;
  };

  const { profile, regions, timeframe } = body;

  if (!profile || !regions?.length || !timeframe) {
    return NextResponse.json(
      { error: "Missing required fields: profile, regions, timeframe" },
      { status: 400 }
    );
  }

  const validRegions = regions.filter((r) => VALID_REGIONS.has(r));
  if (!validRegions.length) {
    return NextResponse.json({ error: "No valid regions provided" }, { status: 400 });
  }

  if (!(timeframe in TIMEFRAME_MS)) {
    return NextResponse.json({ error: "Invalid timeframe" }, { status: 400 });
  }

  const apifyResult = await searchJobs(validRegions, timeframe);
  const { jobs, stats } = await scoreJobs(profile, apifyResult);

  await recordOperation(session.user.id, validRegions, timeframe, stats);

  return NextResponse.json({ jobs, stats });
}
