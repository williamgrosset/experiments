"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchEnvironments, createExperiment } from "@/lib/api";
import type {
  Environment,
  TargetingRule,
  TargetingCondition,
  RuleOperator,
} from "@/lib/types";

const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "in", label: "in list" },
  { value: "notIn", label: "not in list" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
];

function emptyCondition(): TargetingCondition {
  return { attribute: "", operator: "eq", value: "" };
}

function emptyRule(): TargetingRule {
  return { conditions: [emptyCondition()] };
}

/**
 * Parse a condition value based on operator type.
 * - "in" / "notIn" expect comma-separated values -> string[]
 * - "gt" / "lt" expect a number
 * - everything else is a plain string
 */
function parseConditionValue(
  operator: RuleOperator,
  raw: string,
): unknown {
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

/**
 * Serialize a condition value back to a string for the input field.
 */
function serializeConditionValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

export default function NewExperimentPage() {
  const router = useRouter();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [environmentId, setEnvironmentId] = useState("");
  const [targetingRules, setTargetingRules] = useState<TargetingRule[]>([]);

  useEffect(() => {
    fetchEnvironments()
      .then((envs) => {
        setEnvironments(envs);
        if (envs.length > 0) setEnvironmentId(envs[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Auto-generate key from name
  function handleNameChange(val: string) {
    setName(val);
    setKey(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  }

  // --- Targeting rules helpers ---

  function addRule() {
    setTargetingRules([...targetingRules, emptyRule()]);
  }

  function removeRule(ruleIndex: number) {
    setTargetingRules(targetingRules.filter((_, i) => i !== ruleIndex));
  }

  function addCondition(ruleIndex: number) {
    setTargetingRules(
      targetingRules.map((rule, i) =>
        i === ruleIndex
          ? { ...rule, conditions: [...rule.conditions, emptyCondition()] }
          : rule,
      ),
    );
  }

  function removeCondition(ruleIndex: number, condIndex: number) {
    setTargetingRules(
      targetingRules.map((rule, i) =>
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
    setTargetingRules(
      targetingRules.map((rule, ri) =>
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
                // field === "value"
                return {
                  ...cond,
                  value: parseConditionValue(cond.operator, value),
                };
              }),
            }
          : rule,
      ),
    );
  }

  /** Build the rules payload, filtering out incomplete conditions. */
  function buildTargetingRules(): TargetingRule[] | undefined {
    if (targetingRules.length === 0) return undefined;

    const cleaned = targetingRules
      .map((rule) => ({
        conditions: rule.conditions.filter(
          (c) => c.attribute.trim() !== "" && serializeConditionValue(c.value).trim() !== "",
        ),
      }))
      .filter((rule) => rule.conditions.length > 0);

    return cleaned.length > 0 ? cleaned : undefined;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const exp = await createExperiment({
        key: key.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        environmentId,
        targetingRules: buildTargetingRules(),
      });
      router.push(`/experiments/${exp.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create experiment");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">
          Create experiment
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Set up a new experiment. You can add variants and allocations after
          creation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Homepage hero test"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Key
          </label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g. homepage-hero-test"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            required
          />
          <p className="mt-1 text-xs text-zinc-400">
            Used as the experiment identifier in code. Must be unique per
            environment.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Description
            <span className="ml-1 font-normal text-zinc-400">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Briefly describe what this experiment tests..."
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Environment
          </label>
          {environments.length > 0 ? (
            <select
              value={environmentId}
              onChange={(e) => setEnvironmentId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            >
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1.5 text-sm text-zinc-500">
              No environments found.{" "}
              <a href="/environments" className="underline">
                Create one first
              </a>
              .
            </p>
          )}
        </div>

        {/* --- Targeting rules --- */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-zinc-700">
              Targeting rules
              <span className="ml-1 font-normal text-zinc-400">(optional)</span>
            </label>
            <button
              type="button"
              onClick={addRule}
              className="text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900"
            >
              + Add rule
            </button>
          </div>

          {targetingRules.length === 0 ? (
            <p className="mt-1.5 text-sm text-zinc-400">
              No targeting rules. All users will be eligible.
            </p>
          ) : (
            <div className="mt-2 space-y-3">
              {targetingRules.map((rule, ruleIndex) => (
                <div
                  key={ruleIndex}
                  className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Rule {ruleIndex + 1}
                      {targetingRules.length > 1 && ruleIndex < targetingRules.length - 1 && (
                        <span className="ml-1.5 font-normal normal-case text-zinc-400">
                          (OR)
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRule(ruleIndex)}
                      className="text-xs text-zinc-400 transition-colors hover:text-red-600"
                    >
                      Remove
                    </button>
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
                          <input
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
                            className="w-1/3 rounded-md border border-zinc-300 px-2.5 py-1.5 font-mono text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                          />
                          <select
                            value={condition.operator}
                            onChange={(e) =>
                              updateCondition(
                                ruleIndex,
                                condIndex,
                                "operator",
                                e.target.value,
                              )
                            }
                            className="w-1/4 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                          >
                            {OPERATORS.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder={
                              condition.operator === "in" ||
                              condition.operator === "notIn"
                                ? "val1, val2, ..."
                                : "value"
                            }
                            value={serializeConditionValue(condition.value)}
                            onChange={(e) =>
                              updateCondition(
                                ruleIndex,
                                condIndex,
                                "value",
                                e.target.value,
                              )
                            }
                            className="flex-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              removeCondition(ruleIndex, condIndex)
                            }
                            disabled={rule.conditions.length === 1}
                            className="rounded-md px-1.5 py-1.5 text-zinc-400 transition-colors hover:text-red-600 disabled:opacity-30 disabled:hover:text-zinc-400"
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
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => addCondition(ruleIndex)}
                    className="mt-2.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-700"
                  >
                    + Add condition
                  </button>
                </div>
              ))}
            </div>
          )}

          {targetingRules.length > 0 && (
            <p className="mt-2 text-xs text-zinc-400">
              Users matching <span className="font-medium">any</span> rule are
              eligible. Within a rule, <span className="font-medium">all</span>{" "}
              conditions must match.
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !environmentId}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create experiment"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
