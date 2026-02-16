import { describe, expect, it } from "vitest";
import { BUCKET_COUNT, getBucket } from "../src/hashing.js";

describe("getBucket", () => {
  it("returns a stable bucket for known vectors", () => {
    expect(getBucket("user-1", "salt-1")).toBe(2865);
    expect(getBucket("alice", "exp-abc")).toBe(663);
    expect(getBucket("", "")).toBe(7430);
    expect(getBucket("user:with:colon", "salt:with:colon")).toBe(6663);
    expect(getBucket("A", "B")).toBe(3590);
  });

  it("always returns an integer in the configured range", () => {
    for (let i = 0; i < 5000; i++) {
      const bucket = getBucket(`user-${i}`, `salt-${i % 17}`);
      expect(Number.isInteger(bucket)).toBe(true);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(BUCKET_COUNT);
    }
  });
});
