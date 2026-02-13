import type { TargetingRule, TargetingCondition } from "@experiments/shared";

/**
 * Resolve a dot-notation path against a nested object.
 * Falls back gracefully to undefined for missing intermediate keys.
 */
function resolveValue(obj: Record<string, unknown>, path: string): unknown {
  // Exact key match takes precedence (backward compatibility)
  if (path in obj) {
    return obj[path];
  }

  const segments = path.split(".");
  let current: unknown = obj;

  for (const segment of segments) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return undefined;
    }
    if (!Object.hasOwn(current as Record<string, unknown>, segment)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

/**
 * Evaluate targeting rules against user context.
 *
 * Rules use first-match semantics:
 * - If ANY rule matches, the user is eligible.
 * - Within a rule, ALL conditions must match (AND logic).
 * - If there are no rules, the user is eligible (no targeting = everyone).
 */
export function evaluateTargetingRules(
  rules: TargetingRule[],
  context: Record<string, unknown>
): boolean {
  // No rules means everyone is eligible
  if (rules.length === 0) {
    return true;
  }

  // First-match: if any rule matches, user is eligible
  return rules.some((rule) => evaluateRule(rule, context));
}

function evaluateRule(
  rule: TargetingRule,
  context: Record<string, unknown>
): boolean {
  // All conditions in a rule must match (AND)
  return rule.conditions.every((condition) =>
    evaluateCondition(condition, context)
  );
}

function evaluateCondition(
  condition: TargetingCondition,
  context: Record<string, unknown>
): boolean {
  const value = resolveValue(context, condition.attribute);

  switch (condition.operator) {
    case "eq":
      return value === condition.value;

    case "neq":
      return value !== condition.value;

    case "in":
      if (!Array.isArray(condition.value)) return false;
      return condition.value.includes(value);

    case "notIn":
      if (!Array.isArray(condition.value)) return false;
      return !condition.value.includes(value);

    case "contains":
      if (typeof value !== "string" || typeof condition.value !== "string")
        return false;
      return value.includes(condition.value);

    case "gt":
      if (typeof value !== "number" || typeof condition.value !== "number")
        return false;
      return value > condition.value;

    case "lt":
      if (typeof value !== "number" || typeof condition.value !== "number")
        return false;
      return value < condition.value;

    default:
      return false;
  }
}
