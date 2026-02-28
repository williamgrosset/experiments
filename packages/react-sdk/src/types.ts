import type { ConfigSnapshot, Assignment } from "@experiments/shared";

/**
 * Configuration options for the ExperimentsProvider.
 */
export interface ExperimentsConfig {
  /** Base URL where config snapshots are served (e.g., CloudFront distribution URL). */
  configUrl: string;
  /** Environment name (e.g., "production", "staging"). */
  environment: string;
  /** Stable user identifier for deterministic bucketing. */
  userKey: string;
  /** User context for targeting rule evaluation. */
  context?: Record<string, unknown>;
  /**
   * Polling interval in milliseconds (default: 60000).
   * Set to 0 to disable polling entirely.
   */
  pollingInterval?: number;
  /**
   * Pre-fetched config snapshot for SSR.
   * When provided, the provider skips the initial client-side fetch.
   */
  initialSnapshot?: ConfigSnapshot;
}

/**
 * The value exposed by ExperimentsContext to all consumers.
 */
export interface ExperimentsContextValue {
  /** Whether the initial config has been loaded and assignments are available. */
  isReady: boolean;
  /** Whether a config fetch is currently in progress. */
  isLoading: boolean;
  /** Error from the most recent fetch attempt, if any. */
  error: Error | null;
  /** All current assignments keyed by experiment key. */
  assignments: Map<string, Assignment>;
  /** Current config version number, or null if not yet loaded. */
  configVersion: number | null;
}

/**
 * Return type for the useExperiment hook.
 */
export interface UseExperimentResult {
  /** The assigned variant key, or null if not assigned to this experiment. */
  variant: string | null;
  /** The variant payload, if any. */
  payload: Record<string, unknown> | undefined;
  /** Whether the initial config has been loaded. */
  isReady: boolean;
  /** Whether a config fetch is currently in progress. */
  isLoading: boolean;
  /** Error from the most recent fetch attempt, if any. */
  error: Error | null;
}

/**
 * Return type for the useExperiments hook.
 */
export interface UseExperimentsResult {
  /** All assignments as a flat record keyed by experiment key. */
  assignments: Record<
    string,
    { variant: string; payload?: Record<string, unknown> }
  >;
  /** Whether the initial config has been loaded. */
  isReady: boolean;
  /** Whether a config fetch is currently in progress. */
  isLoading: boolean;
  /** Error from the most recent fetch attempt, if any. */
  error: Error | null;
}
