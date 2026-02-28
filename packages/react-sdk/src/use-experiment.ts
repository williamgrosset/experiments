import { useContext } from "react";
import { ExperimentsContext } from "./context.js";
import type { UseExperimentResult } from "./types.js";

/**
 * Returns the assignment for a single experiment by key.
 *
 * Must be used within an <ExperimentsProvider>.
 *
 * @example
 * ```tsx
 * const { variant, payload, isReady } = useExperiment("checkout-flow");
 *
 * if (!isReady) return <Spinner />;
 * if (variant === "treatment") return <NewCheckout config={payload} />;
 * return <DefaultCheckout />;
 * ```
 */
export function useExperiment(experimentKey: string): UseExperimentResult {
  const { assignments, isReady, isLoading, error } =
    useContext(ExperimentsContext);

  const assignment = assignments.get(experimentKey);

  return {
    variant: assignment?.variant_key ?? null,
    payload: assignment?.payload,
    isReady,
    isLoading,
    error,
  };
}
