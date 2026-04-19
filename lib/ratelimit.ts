interface Bucket {
  count: number;
  reset: number;
}

const store = new Map<string, Bucket>();

export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = store.get(key);
  if (!bucket || now > bucket.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}
