import { getBucket } from "@experiments/shared";
import type { ConfigExperiment, Assignment } from "@experiments/shared";
import { evaluateTargetingRules } from "./evaluator.js";

/**
 * Assign a user to variants across all experiments in a config.
 *
 * For each experiment:
 * 1. Evaluate targeting rules — skip if user doesn't match
 * 2. Compute deterministic bucket from userKey + experiment salt
 * 3. Map bucket to a variant via allocation ranges
 */
export function assignVariants(
  experiments: ConfigExperiment[],
  userKey: string,
  context: Record<string, unknown>
): Assignment[] {
  const assignments: Assignment[] = [];

  for (const experiment of experiments) {
    // Check audience and targeting rules (AND semantics)
    const audienceEligible = evaluateTargetingRules(
      experiment.audienceRules,
      context
    );
    if (!audienceEligible) {
      continue;
    }

    const experimentEligible = evaluateTargetingRules(
      experiment.targetingRules,
      context
    );
    if (!experimentEligible) {
      continue;
    }

    // Deterministic bucketing
    const bucket = getBucket(userKey, experiment.salt);

    // Find which variant this bucket maps to
    const matchedAllocation = experiment.allocations.find(
      (a) => bucket >= a.rangeStart && bucket <= a.rangeEnd
    );

    if (!matchedAllocation) {
      // Bucket falls outside all allocation ranges (e.g., holdout)
      continue;
    }

    const variant = experiment.variants.find(
      (v) => v.id === matchedAllocation.variantId
    );

    if (!variant) {
      // Variant not found — data integrity issue, skip
      continue;
    }

    assignments.push({
      experiment_key: experiment.key,
      experiment_id: experiment.id,
      variant_key: variant.key,
      variant_id: variant.id,
      payload: variant.payload as Record<string, unknown> | undefined,
    });
  }

  return assignments;
}
