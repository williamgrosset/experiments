import type { ReactNode } from "react";
import { useExperiment } from "./use-experiment.js";

export interface FeatureGateProps {
  /** Experiment key to check. */
  experiment: string;
  /** Variant key(s) to match — renders children if the user is in one of these variants. */
  variant: string | string[];
  /** Fallback to render if the user is not in the specified variant(s). Defaults to null. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Declarative render guard based on experiment assignment.
 *
 * Renders `children` if the user is assigned to one of the specified variants.
 * Otherwise renders `fallback` (defaults to null).
 *
 * @example
 * ```tsx
 * <FeatureGate experiment="new-header" variant="treatment">
 *   <NewHeader />
 * </FeatureGate>
 *
 * <FeatureGate
 *   experiment="pricing-test"
 *   variant={["variant-a", "variant-b"]}
 *   fallback={<DefaultPricing />}
 * >
 *   <ExperimentalPricing />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  experiment,
  variant,
  fallback = null,
  children,
}: FeatureGateProps) {
  const { variant: assignedVariant } = useExperiment(experiment);

  if (assignedVariant === null) {
    return <>{fallback}</>;
  }

  const variants = Array.isArray(variant) ? variant : [variant];

  if (variants.includes(assignedVariant)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
