import { Redis } from "ioredis";

const REDIS_URL = process.env["REDIS_URL"] || "redis://localhost:6379";

/**
 * Main Redis client for reading config snapshots.
 */
export const redis = new Redis(REDIS_URL);

/**
 * Separate Redis client for pub/sub subscriptions.
 * ioredis requires a dedicated connection for subscriber mode.
 */
export const redisSub = new Redis(REDIS_URL);
