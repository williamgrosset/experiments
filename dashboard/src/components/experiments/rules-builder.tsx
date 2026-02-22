import type { TargetingCondition, TargetingRule, RuleOperator } from "@experiments/shared";
import { Button } from "@/components/button";
import { Input, Select } from "@/components/form";
import {
  OPERATORS,
  emptyCondition,
  emptyRule,
  serializeConditionValue,
} from "@/lib/targeting-rules";

interface RulesBuilderProps {
  rules: TargetingRule[];
  setRules: (rules: TargetingRule[]) => void;
  className?: string;
  cardClassName?: string;
}

export function RulesBuilder({
  rules,
  setRules,
  className,
  cardClassName = "rounded-lg border border-zinc-200 bg-zinc-50/50 p-4",
}: RulesBuilderProps) {
  function addRule() {
    setRules([...rules, emptyRule()]);
  }

  function removeRule(ruleIndex: number) {
    setRules(rules.filter((_, i) => i !== ruleIndex));
  }

  function addCondition(ruleIndex: number) {
    setRules(
      rules.map((rule, i) =>
        i === ruleIndex
          ? { ...rule, conditions: [...rule.conditions, emptyCondition()] }
          : rule,
      ),
    );
  }

  function removeCondition(ruleIndex: number, condIndex: number) {
    setRules(
      rules.map((rule, i) =>
        i === ruleIndex
          ? {
              ...rule,
              conditions: rule.conditions.filter((_, j) => j !== condIndex),
            }
          : rule,
      ),
    );
  }

  function updateCondition(
    ruleIndex: number,
    condIndex: number,
    field: keyof TargetingCondition,
    value: string,
  ) {
    setRules(
      rules.map((rule, ri) =>
        ri === ruleIndex
          ? {
              ...rule,
              conditions: rule.conditions.map((cond, ci) => {
                if (ci !== condIndex) return cond;
                if (field === "operator") {
                  return { ...cond, operator: value as RuleOperator };
                }
                if (field === "attribute") {
                  return { ...cond, attribute: value };
                }
                return { ...cond, value };
              }),
            }
          : rule,
      ),
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-zinc-700">
          Targeting rules
          <span className="ml-1 font-normal text-zinc-400">(optional)</span>
        </label>
        <Button
          variant="ghost"
          size="xs"
          type="button"
          onClick={addRule}
          className="text-zinc-600"
        >
          + Add rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="mt-1.5 text-sm text-zinc-400">
          No targeting rules. All users will be eligible.
        </p>
      ) : (
        <div className="mt-2 space-y-3">
          {rules.map((rule, ruleIndex) => (
            <div key={ruleIndex} className={cardClassName}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Rule {ruleIndex + 1}
                  {rules.length > 1 && ruleIndex < rules.length - 1 && (
                    <span className="ml-1.5 font-normal normal-case text-zinc-400">
                      (OR)
                    </span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  type="button"
                  onClick={() => removeRule(ruleIndex)}
                  className="text-zinc-400 hover:text-red-600"
                >
                  Remove
                </Button>
              </div>

              <div className="space-y-2">
                {rule.conditions.map((condition, condIndex) => (
                  <div key={condIndex}>
                    {condIndex > 0 && (
                      <div className="my-1.5 flex items-center gap-2">
                        <div className="h-px flex-1 bg-zinc-200" />
                        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                          AND
                        </span>
                        <div className="h-px flex-1 bg-zinc-200" />
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <Input
                        type="text"
                        placeholder="attribute"
                        value={condition.attribute}
                        onChange={(e) =>
                          updateCondition(
                            ruleIndex,
                            condIndex,
                            "attribute",
                            e.target.value,
                          )
                        }
                        size="sm"
                        mono
                        className="w-1/3"
                      />
                      <Select
                        value={condition.operator}
                        onChange={(e) =>
                          updateCondition(
                            ruleIndex,
                            condIndex,
                            "operator",
                            e.target.value,
                          )
                        }
                        size="sm"
                        className="w-1/4"
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="text"
                        placeholder={
                          condition.operator === "in" ||
                          condition.operator === "notIn"
                            ? "val1, val2, ..."
                            : "value"
                        }
                        value={serializeConditionValue(condition.value)}
                        onChange={(e) =>
                          updateCondition(ruleIndex, condIndex, "value", e.target.value)
                        }
                        size="sm"
                        className="w-1/2"
                      />
                      <Button
                        variant="ghost"
                        size="xs"
                        type="button"
                        onClick={() => removeCondition(ruleIndex, condIndex)}
                        disabled={rule.conditions.length === 1}
                        className="rounded-md px-1.5 py-1.5 text-zinc-400 hover:text-red-600 disabled:hover:text-zinc-400"
                        title="Remove condition"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="ghost"
                size="xs"
                type="button"
                onClick={() => addCondition(ruleIndex)}
                className="mt-2.5 hover:text-zinc-700"
              >
                + Add condition
              </Button>
            </div>
          ))}
        </div>
      )}

      {rules.length > 0 && (
        <p className="mt-2 text-xs text-zinc-400">
          Users matching <span className="font-medium">any</span> rule are
          eligible. Within a rule, <span className="font-medium">all</span>{" "}
          conditions must match.
        </p>
      )}
    </div>
  );
}
