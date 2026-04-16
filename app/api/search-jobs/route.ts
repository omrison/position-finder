import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { searchJobs } from "@/lib/apify";
import { scoreJobs } from "@/lib/scoreJobs";
import type { CandidateProfile } from "@/types";

export async function POST(req: NextRequest) {
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

  const apifyResult = await searchJobs(regions, timeframe);
  const { jobs, stats } = await scoreJobs(profile, apifyResult);

  return NextResponse.json({ jobs, stats });
}
