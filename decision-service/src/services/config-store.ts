import type { ConfigSnapshot } from "@experiments/shared";
import { redis, redisSub } from "../lib/redis.js";

const POLL_INTERVAL_MS = 30_000; // Safety-net poll every 30s

/**
 * In-memory config store for the decision service.
 *
 * Maintains one ConfigSnapshot per environment, loaded from Redis.
 * Updates via Redis Pub/Sub with polling as a fallback.
 */
export class ConfigStore {
  private configs: Map<string, ConfigSnapshot> = new Map();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private environments: Set<string>;

  constructor(environments: string[]) {
    this.environments = new Set(environments);
  }

  async start(): Promise<void> {
    // Load initial configs for all environments
    await Promise.all(
      [...this.environments].map((env) => this.loadConfig(env))
    );

    // Subscribe to config update notifications
    await redisSub.subscribe("config:updates");
    redisSub.on("message", async (_channel: string, message: string) => {
      try {
        const update = JSON.parse(message) as {
          environment: string;
          version: number;
        };
        if (this.environments.has(update.environment)) {
          await this.loadConfig(update.environment);
        }
      } catch {
        // Ignore malformed messages
      }
    });

    // Start polling as a safety net
    this.pollTimer = setInterval(async () => {
      for (const env of this.environments) {
        await this.loadConfig(env);
      }
    }, POLL_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    await redisSub.unsubscribe("config:updates");
  }

  getConfig(environment: string): ConfigSnapshot | undefined {
    return this.configs.get(environment);
  }

  private async loadConfig(environment: string): Promise<void> {
    try {
      const configKey = `env:${environment}:config`;
      const data = await redis.get(configKey);

      if (!data) {
        return;
      }

      const snapshot = JSON.parse(data) as ConfigSnapshot;
      const current = this.configs.get(environment);

      // Only update if version is newer (or first load)
      if (!current || snapshot.version > current.version) {
        this.configs.set(environment, snapshot);
      }
    } catch {
      // If Redis is down, serve from last known config — do nothing
    }
  }
}
