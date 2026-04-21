import Redis from "ioredis";

// In-memory fallback for local dev without Redis
interface Bucket {
  count: number;
  reset: number;
}
const memoryStore = new Map<string, Bucket>();

function checkMemory(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = memoryStore.get(key);
  if (!bucket || now > bucket.reset) {
    memoryStore.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}

let redis: Redis | null = null;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
  redis.on("error", (err) => {
    console.error("[ratelimit] Redis error, falling back to memory:", err.message);
    redis = null;
  });
}

export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  if (!redis) return checkMemory(key, max, windowMs);

  try {
    const windowKey = `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
    const count = await redis.incr(windowKey);
    if (count === 1) await redis.pexpire(windowKey, windowMs);
    return count <= max;
  } catch {
    return checkMemory(key, max, windowMs);
  }
}
