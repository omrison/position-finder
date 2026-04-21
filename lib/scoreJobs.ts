import { z } from "zod";
import { getOpenAI } from "@/lib/openai";
import type { CandidateProfile, JobResult, SearchStats } from "@/types";
import type { RawJobResult, ApifySearchResult } from "@/lib/apify";

const ScoreResponseSchema = z.object({
  scores: z
    .array(z.object({ index: z.number().int(), score: z.number().min(1).max(10) }))
    .default([]),
});

type ScoreEntry = { index: number; score: number };

async function scoreBatch(
  profile: CandidateProfile,
  batch: RawJobResult[]
): Promise<ScoreEntry[]> {
  const jobsPayload = batch.map((job, i) => ({
    index: i,
    role: job.role,
    company: job.company,
    description: job.description.slice(0, 500),
  }));

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a strict job-matching scorer. Score each job for the likelihood of the candidate being accepted — not just fit. Be strict: 9-10 = near-perfect match, 7-8 = strong match, below 7 = not a good match. Return only valid JSON.",
      },
      {
        role: "user",
        content: `Candidate profile:
Skills: ${profile.skills.join(", ")}
Experience: ${profile.experience}
Seniority: ${profile.seniority}
Suitable roles: ${profile.roleTypes.join(", ")}

Score each job 1-10 for likelihood of candidate acceptance.
Jobs: ${JSON.stringify(jobsPayload)}

Return JSON: { "scores": [{ "index": number, "score": number }] }`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
  const { scores } = ScoreResponseSchema.parse(raw);
  return scores;
}

export interface ScoredSearchResult {
  jobs: JobResult[];
  stats: SearchStats;
}

export async function scoreJobs(
  profile: CandidateProfile,
  apifyResult: ApifySearchResult
): Promise<ScoredSearchResult> {
  const { jobs, stats: apifyStats } = apifyResult;
  const BATCH_SIZE = 10;
  const scored: RawJobResult[] = jobs.map((j) => ({ ...j }));

  const batches: RawJobResult[][] = [];
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    batches.push(jobs.slice(i, i + BATCH_SIZE));
  }

  await Promise.all(
    batches.map(async (batch, batchIdx) => {
      const scores = await scoreBatch(profile, batch).catch(() => []);
      for (const { index, score } of scores) {
        const globalIdx = batchIdx * BATCH_SIZE + index;
        if (globalIdx < scored.length) {
          scored[globalIdx].score = score;
        }
      }
    })
  );

  const passing = scored.filter((job) => job.score >= 7);
  const belowThreshold = scored.length - passing.length;

  const sorted = passing.sort((a, b) => {
    const dateDiff =
      new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    return dateDiff !== 0 ? dateDiff : b.score - a.score;
  });

  const capped = Math.max(0, sorted.length - 100);
  const finalJobs = sorted.slice(0, 100).map(
    (job): JobResult => ({
      role: job.role,
      company: job.company,
      postedAt: job.postedAt,
      source: job.source,
      url: job.url,
      score: job.score,
    })
  );

  return {
    jobs: finalJobs,
    stats: {
      scraped: apifyStats.scraped,
        duplicatesRemoved: apifyStats.duplicatesRemoved,
        outsideRegions: apifyStats.outsideRegions,
      scored: scored.length,
      belowThreshold,
      capped,
      shown: finalJobs.length,
    },
  };
}
