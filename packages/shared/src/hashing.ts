import murmurhash from "murmurhash";

const BUCKET_COUNT = 10_000;

/**
 * Deterministic bucketing: hash(userKey + experimentSalt) % 10,000.
 * Returns a bucket in [0, 9999].
 *
 * Uses MurmurHash v3 for fast, uniform distribution.
 */
export function getBucket(userKey: string, salt: string): number {
  const hash = murmurhash.v3(`${userKey}:${salt}`);
  return ((hash % BUCKET_COUNT) + BUCKET_COUNT) % BUCKET_COUNT;
}

export { BUCKET_COUNT };
