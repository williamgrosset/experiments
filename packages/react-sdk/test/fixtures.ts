import type { ConfigSnapshot } from "@experiments/shared";

/**
 * A minimal config snapshot with two experiments for use in tests.
 *
 * - "checkout-flow": no targeting, 100% allocation to "control"
 * - "us-only-feature": targeted to country=US, 100% allocation to "treatment"
 */
export function createTestSnapshot(
  overrides: Partial<ConfigSnapshot> = {}
): ConfigSnapshot {
  return {
    version: 1,
    environment: "test",
    publishedAt: "2026-01-01T00:00:00.000Z",
    experiments: [
      {
        id: "exp-1",
        key: "checkout-flow",
        salt: "salt-1",
        audienceRules: [],
        targetingRules: [],
        variants: [
          { id: "var-control", key: "control", payload: { color: "blue" } },
          { id: "var-treatment", key: "treatment", payload: { color: "green" } },
        ],
        allocations: [
          { variantId: "var-control", rangeStart: 0, rangeEnd: 9999 },
        ],
      },
      {
        id: "exp-2",
        key: "us-only-feature",
        salt: "salt-2",
        audienceRules: [],
        targetingRules: [
          {
            conditions: [
              { attribute: "country", operator: "eq", value: "US" },
            ],
          },
        ],
        variants: [
          { id: "var-us", key: "treatment", payload: { locale: "en-US" } },
        ],
        allocations: [
          { variantId: "var-us", rangeStart: 0, rangeEnd: 9999 },
        ],
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a version response for mocking version.json fetches.
 */
export function createVersionResponse(version: number) {
  return { version };
}
