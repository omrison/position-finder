export interface CandidateProfile {
  skills: string[];
  experience: string;
  seniority: "junior" | "mid" | "senior" | "lead";
  roleTypes: string[];
}

export interface JobResult {
  role: string;
  company: string;
  postedAt: string;
  source: string;
  url: string;
  score: number;
}

export type Timeframe = "24h" | "48h" | "week";

export interface SearchStats {
  scraped: number;
  duplicatesRemoved: number;
  outsideRegions: number;
  scored: number;
  belowThreshold: number;
  capped: number;
  shown: number;
}
