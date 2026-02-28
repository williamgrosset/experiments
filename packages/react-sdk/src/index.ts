// --- Provider ---
export { ExperimentsProvider } from "./provider.js";
export type { ExperimentsProviderProps } from "./provider.js";

// --- Hooks ---
export { useExperiment } from "./use-experiment.js";
export { useExperiments } from "./use-experiments.js";

// --- Components ---
export { FeatureGate } from "./feature-gate.js";
export type { FeatureGateProps } from "./feature-gate.js";

// --- SSR helper ---
export { fetchExperimentsConfig } from "./fetch-config.js";

// --- Types ---
export type {
  ExperimentsConfig,
  ExperimentsContextValue,
  UseExperimentResult,
  UseExperimentsResult,
} from "./types.js";

// Re-export shared types that SDK consumers commonly need
export type { ConfigSnapshot, Assignment } from "@experiments/shared";
