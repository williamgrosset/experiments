import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import type { ConfigSnapshot, Assignment } from "@experiments/shared";
import { assignVariants } from "@experiments/shared";
import { ExperimentsContext } from "./context.js";
import { ConfigFetcher } from "./config-fetcher.js";
import type { ExperimentsConfig, ExperimentsContextValue } from "./types.js";

const DEFAULT_POLLING_INTERVAL = 60_000;

export interface ExperimentsProviderProps extends ExperimentsConfig {
  children: ReactNode;
}

/**
 * Provides experiment assignments to all descendants via React context.
 *
 * On mount:
 * 1. If `initialSnapshot` is provided, uses it immediately (SSR hydration path).
 * 2. Otherwise, fetches the latest snapshot from the configured CDN URL.
 * 3. Starts version-based polling (if enabled) to pick up config changes.
 *
 * Assignments are re-evaluated synchronously whenever `userKey`, `context`,
 * or the underlying snapshot changes — no additional network call is needed.
 */
export function ExperimentsProvider({
  configUrl,
  environment,
  userKey,
  context,
  pollingInterval = DEFAULT_POLLING_INTERVAL,
  initialSnapshot,
  children,
}: ExperimentsProviderProps) {
  const [snapshot, setSnapshot] = useState<ConfigSnapshot | null>(
    initialSnapshot ?? null
  );
  const [isLoading, setIsLoading] = useState(!initialSnapshot);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef<ConfigFetcher | null>(null);

  // Stable reference to the user context for dependency tracking.
  // We JSON-serialize to avoid re-renders on object identity changes
  // when the context contents haven't actually changed.
  const contextJson = useMemo(
    () => (context ? JSON.stringify(context) : "{}"),
    [context]
  );

  const handleUpdate = useCallback((newSnapshot: ConfigSnapshot) => {
    setSnapshot(newSnapshot);
  }, []);

  // --- Initial fetch + polling setup ---
  useEffect(() => {
    const fetcher = new ConfigFetcher(
      configUrl,
      environment,
      pollingInterval,
      handleUpdate
    );
    fetcherRef.current = fetcher;

    if (initialSnapshot) {
      // Seed the fetcher with the known version so the first poll
      // doesn't redundantly re-fetch the same snapshot.
      fetcher.setCurrentVersion(initialSnapshot.version);
      fetcher.start();
    } else {
      // Fetch the initial snapshot, then start polling.
      setIsLoading(true);
      fetcher
        .fetchSnapshot()
        .then((snap) => {
          setSnapshot(snap);
          setError(null);
          fetcher.setCurrentVersion(snap.version);
          fetcher.start();
        })
        .catch((err: unknown) => {
          setError(
            err instanceof Error ? err : new Error("Failed to fetch config")
          );
        })
        .finally(() => {
          setIsLoading(false);
        });
    }

    return () => {
      fetcher.destroy();
      fetcherRef.current = null;
    };
  }, [configUrl, environment, pollingInterval, initialSnapshot, handleUpdate]);

  // --- Compute assignments from snapshot + user params ---
  const assignments = useMemo(() => {
    if (!snapshot) {
      return new Map<string, Assignment>();
    }

    const parsedContext: Record<string, unknown> = JSON.parse(contextJson);

    const result = assignVariants(
      snapshot.experiments,
      userKey,
      parsedContext
    );

    const map = new Map<string, Assignment>();
    for (const assignment of result) {
      map.set(assignment.experiment_key, assignment);
    }
    return map;
  }, [snapshot, userKey, contextJson]);

  const value: ExperimentsContextValue = useMemo(
    () => ({
      isReady: snapshot !== null,
      isLoading,
      error,
      assignments,
      configVersion: snapshot?.version ?? null,
    }),
    [snapshot, isLoading, error, assignments]
  );

  return (
    <ExperimentsContext.Provider value={value}>
      {children}
    </ExperimentsContext.Provider>
  );
}
