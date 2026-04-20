export const REGIONS = [
  "Tel Aviv",
  "Jerusalem",
  "Haifa",
  "Beer Sheva",
  "Ramat Gan",
  "Petah Tikva",
  "Rishon LeZion",
  "Herzliya",
  "Netanya",
  "Eilat",
  "Remote",
] as const;

export const TIMEFRAMES = [
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 48 hours", value: "48h" },
  { label: "Last week", value: "week" },
] as const;

export const TIMEFRAME_MS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "48h": 48 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
};
