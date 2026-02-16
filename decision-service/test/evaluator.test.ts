import { describe, it, expect } from "vitest";
import type { TargetingRule } from "@experiments/shared";
import { evaluateTargetingRules } from "../src/services/evaluator.js";

function rules(conditions: TargetingRule["conditions"]): TargetingRule[] {
  return [{ conditions }];
}

describe("evaluateTargetingRules", () => {
  it("returns true when there are no targeting rules", () => {
    expect(evaluateTargetingRules([], {})).toBe(true);
  });

  it("uses OR semantics across rules", () => {
    const targetingRules: TargetingRule[] = [
      {
        conditions: [
          { attribute: "country", operator: "eq", value: "US" },
        ],
      },
      {
        conditions: [
          { attribute: "plan", operator: "eq", value: "pro" },
        ],
      },
    ];

    expect(evaluateTargetingRules(targetingRules, { country: "CA", plan: "pro" })).toBe(true);
  });

  it("uses AND semantics within a single rule", () => {
    const targetingRules = rules([
      { attribute: "country", operator: "eq", value: "US" },
      { attribute: "plan", operator: "eq", value: "pro" },
    ]);

    expect(evaluateTargetingRules(targetingRules, { country: "US", plan: "free" })).toBe(false);
    expect(evaluateTargetingRules(targetingRules, { country: "US", plan: "pro" })).toBe(true);
  });

  it("treats an empty condition list as a matching rule", () => {
    expect(evaluateTargetingRules([{ conditions: [] }], { any: "value" })).toBe(true);
  });

  it("supports eq and neq with strict equality", () => {
    const eqRules = rules([{ attribute: "age", operator: "eq", value: 21 }]);
    const neqRules = rules([{ attribute: "age", operator: "neq", value: 21 }]);

    expect(evaluateTargetingRules(eqRules, { age: 21 })).toBe(true);
    expect(evaluateTargetingRules(eqRules, { age: "21" })).toBe(false);
    expect(evaluateTargetingRules(neqRules, { age: 22 })).toBe(true);
  });

  it("supports in and notIn", () => {
    const inRules = rules([
      { attribute: "country", operator: "in", value: ["US", "CA"] },
    ]);
    const notInRules = rules([
      { attribute: "country", operator: "notIn", value: ["US", "CA"] },
    ]);

    expect(evaluateTargetingRules(inRules, { country: "US" })).toBe(true);
    expect(evaluateTargetingRules(inRules, { country: "DE" })).toBe(false);
    expect(evaluateTargetingRules(notInRules, { country: "DE" })).toBe(true);
    expect(evaluateTargetingRules(notInRules, { country: "CA" })).toBe(false);
  });

  it("returns false for in/notIn when condition value is not an array", () => {
    const inRules = rules([{ attribute: "country", operator: "in", value: "US" }]);
    const notInRules = rules([{ attribute: "country", operator: "notIn", value: "US" }]);

    expect(evaluateTargetingRules(inRules, { country: "US" })).toBe(false);
    expect(evaluateTargetingRules(notInRules, { country: "US" })).toBe(false);
  });

  it("supports contains only for strings", () => {
    const containsRules = rules([
      { attribute: "email", operator: "contains", value: "@company.com" },
    ]);

    expect(evaluateTargetingRules(containsRules, { email: "dev@company.com" })).toBe(true);
    expect(evaluateTargetingRules(containsRules, { email: "dev@example.com" })).toBe(false);
    expect(evaluateTargetingRules(containsRules, { email: 123 })).toBe(false);
  });

  it("supports gt and lt only for numbers", () => {
    const gtRules = rules([{ attribute: "score", operator: "gt", value: 80 }]);
    const ltRules = rules([{ attribute: "score", operator: "lt", value: 80 }]);

    expect(evaluateTargetingRules(gtRules, { score: 81 })).toBe(true);
    expect(evaluateTargetingRules(gtRules, { score: 80 })).toBe(false);
    expect(evaluateTargetingRules(ltRules, { score: 79 })).toBe(true);
    expect(evaluateTargetingRules(ltRules, { score: "79" })).toBe(false);
  });

  it("resolves nested attributes using dot notation", () => {
    const targetingRules = rules([
      { attribute: "user.geo.country", operator: "eq", value: "US" },
    ]);

    expect(
      evaluateTargetingRules(targetingRules, {
        user: { geo: { country: "US" } },
      })
    ).toBe(true);
    expect(evaluateTargetingRules(targetingRules, { user: { geo: {} } })).toBe(false);
  });

  it("prefers an exact key over dot-path resolution", () => {
    const targetingRules = rules([
      { attribute: "user.geo.country", operator: "eq", value: "CA" },
    ]);

    expect(
      evaluateTargetingRules(targetingRules, {
        "user.geo.country": "CA",
        user: { geo: { country: "US" } },
      })
    ).toBe(true);
  });

  it("returns false when an intermediate dot-path segment is not an object", () => {
    const targetingRules = rules([
      { attribute: "user.geo.country", operator: "eq", value: "US" },
    ]);

    expect(evaluateTargetingRules(targetingRules, { user: "not-an-object" })).toBe(false);
  });

  it("returns false for unknown operators", () => {
    const targetingRules = [
      {
        conditions: [
          {
            attribute: "country",
            operator: "eqx" as never,
            value: "US",
          },
        ],
      },
    ];

    expect(evaluateTargetingRules(targetingRules, { country: "US" })).toBe(false);
  });
});
