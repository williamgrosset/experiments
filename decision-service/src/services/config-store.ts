import type { ConfigSnapshot } from "@experiments/shared";

const POLL_INTERVAL_MS = 5_000; // Poll every 5 seconds

const CONFIG_BASE_URL =
  process.env["CONFIG_BASE_URL"] || "http://localhost:9000/experiment-configs";

/**
 * In-memory config store for the decision service.
 *
 * Maintains one ConfigSnapshot per environment, loaded from S3/MinIO.
 * Polls for updates on a regular interval using a lightweight version check.
 */
export class ConfigStore {
  private configs: Map<string, ConfigSnapshot> = new Map();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private environments: Set<string>;

  constructor(environments: string[] = []) {
    this.environments = new Set(environments);
  }

  listTrackedEnvironments(): string[] {
    return [...this.environments];
  }

  async ensureEnvironment(environment: string): Promise<void> {
    if (!this.environments.has(environment)) {
      this.environments.add(environment);
    }

    const hasConfig = this.configs.has(environment);
    if (!hasConfig) {
      await this.loadConfig(environment);
    }
  }

  async start(): Promise<void> {
    // Load initial configs for all environments
    await Promise.all(
      [...this.environments].map((env) => this.loadConfig(env))
    );

    // Start polling for updates
    this.pollTimer = setInterval(async () => {
      for (const env of this.environments) {
        await this.checkForUpdate(env);
      }
    }, POLL_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getConfig(environment: string): ConfigSnapshot | undefined {
    return this.configs.get(environment);
  }

  /**
   * Lightweight version check — only fetches the full snapshot if version changed.
   */
  private async checkForUpdate(environment: string): Promise<void> {
    try {
      const versionUrl = `${CONFIG_BASE_URL}/configs/${environment}/version.json`;
      const res = await fetch(versionUrl);
      if (!res.ok) return;

      const { version } = (await res.json()) as { version: number };
      const current = this.configs.get(environment);

      if (!current || version > current.version) {
        await this.loadConfig(environment);
      }
    } catch {
      // S3/MinIO unreachable — keep serving last known config
    }
  }

  private async loadConfig(environment: string): Promise<void> {
    try {
      const snapshotUrl = `${CONFIG_BASE_URL}/configs/${environment}/snapshots/latest.json`;
      const res = await fetch(snapshotUrl);
      if (!res.ok) return;

      const snapshot = (await res.json()) as ConfigSnapshot;
      const current = this.configs.get(environment);

      // Only update if version is newer (or first load)
      if (!current || snapshot.version > current.version) {
        this.configs.set(environment, snapshot);
      }
    } catch {
      // S3/MinIO unreachable — keep serving last known config
    }
  }
}
