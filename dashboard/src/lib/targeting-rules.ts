import type {
  TargetingCondition,
  TargetingRule,
  RuleOperator,
} from "@experiments/shared";

export const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "in", label: "in list" },
  { value: "notIn", label: "not in list" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
];

export function emptyCondition(): TargetingCondition {
  return { attribute: "", operator: "eq", value: "" };
}

export function emptyRule(): TargetingRule {
  return { conditions: [emptyCondition()] };
}

export function parseConditionValue(operator: RuleOperator, raw: string): unknown {
  if (operator === "in" || operator === "notIn") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (operator === "gt" || operator === "lt") {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  return raw;
}

export function serializeConditionValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

export function buildTargetingRulesPayload(
  rules: TargetingRule[],
): TargetingRule[] | undefined {
  if (rules.length === 0) return undefined;

  const cleaned = rules
    .map((rule) => ({
      conditions: rule.conditions
        .filter(
          (c) =>
            c.attribute.trim() !== "" &&
            serializeConditionValue(c.value).trim() !== "",
        )
        .map((c) => ({
          ...c,
          value: parseConditionValue(c.operator, serializeConditionValue(c.value)),
        })),
    }))
    .filter((rule) => rule.conditions.length > 0);

  return cleaned.length > 0 ? cleaned : undefined;
}
