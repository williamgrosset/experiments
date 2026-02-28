import type { ConfigSnapshot } from "@experiments/shared";

interface VersionResponse {
  version: number;
}

export type ConfigUpdateCallback = (snapshot: ConfigSnapshot) => void;

/**
 * Fetches and polls experiment config snapshots from a CDN / S3-backed URL.
 *
 * Polling behaviour:
 * - Polls version.json at the configured interval (lightweight check, ~50 bytes)
 * - Only fetches the full snapshot when the version number changes
 * - Pauses polling when the page is hidden (Page Visibility API)
 * - Resumes polling when the page becomes visible again
 */
export class ConfigFetcher {
  private readonly baseUrl: string;
  private readonly environment: string;
  private readonly intervalMs: number;
  private readonly onUpdate: ConfigUpdateCallback;

  private currentVersion: number | null = null;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private destroyed = false;

  constructor(
    baseUrl: string,
    environment: string,
    intervalMs: number,
    onUpdate: ConfigUpdateCallback
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.environment = environment;
    this.intervalMs = intervalMs;
    this.onUpdate = onUpdate;
  }

  /**
   * Fetch the current config version number (lightweight).
   */
  async fetchVersion(): Promise<number> {
    const url = `${this.baseUrl}/configs/${this.environment}/version.json`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(
        `Failed to fetch version: ${res.status} ${res.statusText}`
      );
    }

    const data = (await res.json()) as VersionResponse;
    return data.version;
  }

  /**
   * Fetch the latest config snapshot.
   */
  async fetchSnapshot(): Promise<ConfigSnapshot> {
    const url = `${this.baseUrl}/configs/${this.environment}/snapshots/latest.json`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(
        `Failed to fetch config snapshot: ${res.status} ${res.statusText}`
      );
    }

    return (await res.json()) as ConfigSnapshot;
  }

  /**
   * Perform a single poll cycle: check version, fetch snapshot if changed.
   * Returns the snapshot if it was updated, null otherwise.
   *
   * Uses a strict greater-than check (matching the server-side ConfigStore)
   * so that stale CDN edges or version rollbacks don't trigger spurious
   * re-fetches. The snapshot is only applied if its version is actually
   * newer than what we already have, guarding against race conditions
   * where a slower fetch for an older version could arrive after a newer one.
   */
  async poll(): Promise<ConfigSnapshot | null> {
    const version = await this.fetchVersion();

    if (this.currentVersion !== null && version <= this.currentVersion) {
      return null;
    }

    const snapshot = await this.fetchSnapshot();

    // Stale-write guard: only apply if the fetched snapshot is actually newer
    if (this.currentVersion !== null && snapshot.version <= this.currentVersion) {
      return null;
    }

    this.currentVersion = snapshot.version;
    return snapshot;
  }

  /**
   * Start the polling loop. Attaches a visibility listener to pause/resume.
   */
  start(): void {
    if (this.destroyed || this.intervalMs <= 0) {
      return;
    }

    this.startTimer();

    if (typeof document !== "undefined") {
      this.visibilityHandler = () => {
        if (document.hidden) {
          this.stopTimer();
        } else {
          // Poll immediately on becoming visible, then restart interval
          this.tick();
          this.startTimer();
        }
      };
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }
  }

  /**
   * Stop polling and clean up all listeners.
   */
  destroy(): void {
    this.destroyed = true;
    this.stopTimer();

    if (this.visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  /**
   * Set the known version (e.g., from an initial snapshot) to avoid
   * a redundant full fetch on the first poll cycle.
   */
  setCurrentVersion(version: number): void {
    this.currentVersion = version;
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerId = setInterval(() => this.tick(), this.intervalMs);
  }

  private stopTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.destroyed) return;

    try {
      const snapshot = await this.poll();
      if (snapshot && !this.destroyed) {
        this.onUpdate(snapshot);
      }
    } catch {
      // Swallow polling errors — the provider keeps serving the last known config.
      // A production SDK would emit these to an optional onError callback or logger.
    }
  }
}
