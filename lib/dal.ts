import { prisma } from "@/lib/db";
import type { SearchStats } from "@/types";

export async function recordOperation(
  userId: string,
  regions: string[],
  timeframe: string,
  stats: SearchStats
): Promise<void> {
  await prisma.operation.create({
    data: {
      userId,
      regions,
      timeframe,
      scraped: stats.scraped,
      duplicatesRemoved: stats.duplicatesRemoved,
      outsideRegions: stats.outsideRegions,
      scored: stats.scored,
      belowThreshold: stats.belowThreshold,
      capped: stats.capped,
      shown: stats.shown,
    },
  });
}

export async function getUserOperationCount(userId: string): Promise<number> {
  return prisma.operation.count({ where: { userId } });
}
