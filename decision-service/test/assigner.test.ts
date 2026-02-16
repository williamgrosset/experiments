import { describe, it, expect } from "vitest";
import { getBucket } from "@experiments/shared";
import type { ConfigExperiment, TargetingRule } from "@experiments/shared";
import { assignVariants } from "../src/services/assigner.js";

function createExperiment(
  overrides: Partial<ConfigExperiment> = {}
): ConfigExperiment {
  return {
    id: "exp-1",
    key: "checkout-flow",
    salt: "salt-1",
    targetingRules: [],
    variants: [
      { id: "var-control", key: "control", payload: { color: "blue" } },
      {
        id: "var-treatment",
        key: "treatment",
        payload: { color: "green" },
      },
    ],
    allocations: [{ variantId: "var-control", rangeStart: 0, rangeEnd: 9999 }],
    ...overrides,
  };
}

function rule(
  conditions: TargetingRule["conditions"]
): ConfigExperiment["targetingRules"] {
  return [{ conditions }];
}

describe("assignVariants", () => {
  it("returns an empty array when there are no experiments", () => {
    expect(assignVariants([], "user-1", {})).toEqual([]);
  });

  it("assigns a matching experiment and includes expected assignment fields", () => {
    const experiment = createExperiment();

    const result = assignVariants([experiment], "user-1", { plan: "pro" });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      experiment_key: "checkout-flow",
      experiment_id: "exp-1",
      variant_key: "control",
      variant_id: "var-control",
      payload: { color: "blue" },
    });
  });

  it("skips experiments where targeting rules do not match the context", () => {
    const experiment = createExperiment({
      targetingRules: rule([
        { attribute: "country", operator: "eq", value: "US" },
      ]),
    });

    const result = assignVariants([experiment], "user-1", { country: "CA" });

    expect(result).toEqual([]);
  });

  it("skips experiments when bucket falls outside all allocation ranges", () => {
    const userKey = "holdout-user";
    const salt = "holdout-salt";
    const bucket = getBucket(userKey, salt);

    const holdoutRange =
      bucket > 0
        ? ({ variantId: "var-control", rangeStart: 0, rangeEnd: bucket - 1 } as const)
        : ({ variantId: "var-control", rangeStart: 1, rangeEnd: 9999 } as const);

    const experiment = createExperiment({
      salt,
      allocations: [holdoutRange],
    });

    const result = assignVariants([experiment], userKey, {});

    expect(result).toEqual([]);
  });

  it("skips experiments when allocation references a missing variant", () => {
    const experiment = createExperiment({
      variants: [{ id: "var-control", key: "control", payload: undefined }],
      allocations: [
        {
          variantId: "var-missing",
          rangeStart: 0,
          rangeEnd: 9999,
        },
      ],
    });

    const result = assignVariants([experiment], "user-1", {});

    expect(result).toEqual([]);
  });

  it("handles variants with undefined payload", () => {
    const experiment = createExperiment({
      variants: [{ id: "var-control", key: "control", payload: undefined }],
      allocations: [{ variantId: "var-control", rangeStart: 0, rangeEnd: 9999 }],
    });

    const result = assignVariants([experiment], "user-1", {});

    expect(result).toEqual([
      {
        experiment_key: "checkout-flow",
        experiment_id: "exp-1",
        variant_key: "control",
        variant_id: "var-control",
        payload: undefined,
      },
    ]);
  });

  it("returns assignments for multiple experiments and skips non-matching ones", () => {
    const alwaysEligible = createExperiment({
      id: "exp-always",
      key: "always-on",
      salt: "salt-always",
      variants: [{ id: "var-a", key: "A", payload: { feature: true } }],
      allocations: [{ variantId: "var-a", rangeStart: 0, rangeEnd: 9999 }],
    });

    const targeted = createExperiment({
      id: "exp-targeted",
      key: "us-only",
      salt: "salt-targeted",
      targetingRules: rule([
        { attribute: "country", operator: "eq", value: "US" },
      ]),
      variants: [{ id: "var-us", key: "us", payload: { locale: "en-US" } }],
      allocations: [{ variantId: "var-us", rangeStart: 0, rangeEnd: 9999 }],
    });

    const nonMatchingTargeted = createExperiment({
      id: "exp-ca-only",
      key: "ca-only",
      salt: "salt-ca",
      targetingRules: rule([
        { attribute: "country", operator: "eq", value: "CA" },
      ]),
      variants: [{ id: "var-ca", key: "ca", payload: { locale: "en-CA" } }],
      allocations: [{ variantId: "var-ca", rangeStart: 0, rangeEnd: 9999 }],
    });

    const result = assignVariants(
      [alwaysEligible, targeted, nonMatchingTargeted],
      "user-123",
      { country: "US" }
    );

    expect(result).toHaveLength(2);
    expect(result.map((assignment) => assignment.experiment_key)).toEqual([
      "always-on",
      "us-only",
    ]);
  });

  it("maps bucket to the correct allocation range boundaries", () => {
    const userKey = "boundary-user";
    const salt = "boundary-salt";
    const bucket = getBucket(userKey, salt);

    const experiment = createExperiment({
      id: "exp-boundary",
      key: "boundary",
      salt,
      variants: [
        { id: "var-low", key: "low", payload: { bucket: "low" } },
        { id: "var-high", key: "high", payload: { bucket: "high" } },
      ],
      allocations: [
        { variantId: "var-low", rangeStart: 0, rangeEnd: bucket },
        { variantId: "var-high", rangeStart: bucket + 1, rangeEnd: 9999 },
      ],
    });

    const result = assignVariants([experiment], userKey, {});

    expect(result).toHaveLength(1);
    expect(result[0]?.variant_key).toBe("low");
  });
});
