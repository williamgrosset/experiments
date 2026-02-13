import type {
  ConfigSnapshot,
  ConfigExperiment,
  TargetingRule,
} from "@experiments/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

export class ConfigPublisher {
  /**
   * Compile all RUNNING experiments for an environment into a config snapshot,
   * write it to Redis, and notify subscribers.
   */
  async publish(environmentId: string): Promise<ConfigSnapshot> {
    const environment = await prisma.environment.findUnique({
      where: { id: environmentId },
    });

    if (!environment) {
      throw new Error("Environment not found");
    }

    // Load all running experiments with their variants and allocations
    const experiments = await prisma.experiment.findMany({
      where: {
        environmentId,
        status: "RUNNING",
      },
      include: {
        variants: true,
        allocations: true,
      },
    });

    // Get next version number
    const latestVersion = await prisma.configVersion.findFirst({
      where: { environmentId },
      orderBy: { version: "desc" },
    });
    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Compile config
    const configExperiments: ConfigExperiment[] = experiments.map((exp) => ({
      id: exp.id,
      key: exp.key,
      salt: exp.salt,
      targetingRules: (exp.targetingRules as unknown as TargetingRule[]) ?? [],
      variants: exp.variants.map((v) => ({
        id: v.id,
        key: v.key,
        payload: v.payload as Record<string, unknown> | undefined,
      })),
      allocations: exp.allocations.map((a) => ({
        variantId: a.variantId,
        rangeStart: a.rangeStart,
        rangeEnd: a.rangeEnd,
      })),
    }));

    const snapshot: ConfigSnapshot = {
      version: nextVersion,
      environment: environment.name,
      publishedAt: new Date().toISOString(),
      experiments: configExperiments,
    };

    // Write to Redis
    const configKey = `env:${environment.name}:config`;
    const versionKey = `env:${environment.name}:config:version`;

    await redis.set(configKey, JSON.stringify(snapshot));
    await redis.set(versionKey, nextVersion.toString());

    // Store version in DB for audit trail
    await prisma.configVersion.create({
      data: {
        environmentId,
        version: nextVersion,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });

    // Notify decision services via pub/sub
    await redis.publish(
      "config:updates",
      JSON.stringify({
        environment: environment.name,
        version: nextVersion,
      })
    );

    return snapshot;
  }
}

export const configPublisher = new ConfigPublisher();
