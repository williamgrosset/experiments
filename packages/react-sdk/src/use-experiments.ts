import { useContext, useMemo } from "react";
import { ExperimentsContext } from "./context.js";
import type { UseExperimentsResult } from "./types.js";

/**
 * Returns all experiment assignments as a flat record.
 *
 * Must be used within an <ExperimentsProvider>.
 *
 * @example
 * ```tsx
 * const { assignments, isReady } = useExperiments();
 *
 * if (!isReady) return <Spinner />;
 * console.log(assignments);
 * // { "checkout-flow": { variant: "treatment", payload: { color: "green" } } }
 * ```
 */
export function useExperiments(): UseExperimentsResult {
  const { assignments, isReady, isLoading, error } =
    useContext(ExperimentsContext);

  const flat = useMemo(() => {
    const record: Record<
      string,
      { variant: string; payload?: Record<string, unknown> }
    > = {};

    for (const [key, assignment] of assignments) {
      record[key] = {
        variant: assignment.variant_key,
        payload: assignment.payload,
      };
    }

    return record;
  }, [assignments]);

  return {
    assignments: flat,
    isReady,
    isLoading,
    error,
  };
}
