import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConfigExperiment } from "@experiments/shared";

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    environment: { findUnique: vi.fn() },
    experiment: { findMany: vi.fn() },
    configVersion: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("../src/lib/s3.js", () => ({
  putConfigObject: vi.fn(),
}));

import { ConfigPublisher } from "../src/services/config-publisher.js";
import { prisma } from "../src/lib/prisma.js";
import { putConfigObject } from "../src/lib/s3.js";

const mockedPrisma = vi.mocked(prisma, true);
const mockedPutConfigObject = vi.mocked(putConfigObject);

function createDbExperiment(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: "exp-1",
    key: "checkout-flow",
    salt: "salt-1",
    status: "RUNNING",
    environmentId: "env-1",
    audience: null,
    targetingRules: [],
    variants: [
      { id: "var-control", key: "control", payload: { color: "blue" } },
      { id: "var-treatment", key: "treatment", payload: { color: "green" } },
    ],
    allocations: [
      { variantId: "var-control", rangeStart: 0, rangeEnd: 4999 },
      { variantId: "var-treatment", rangeStart: 5000, rangeEnd: 9999 },
    ],
    ...overrides,
  };
}

function setupMocks(overrides: {
  environment?: Record<string, unknown> | null;
  experiments?: Record<string, unknown>[];
  latestVersion?: Record<string, unknown> | null;
} = {}) {
  mockedPrisma.environment.findUnique.mockResolvedValue(
    ("environment" in overrides
      ? overrides.environment
      : {
          id: "env-1",
          name: "production",
          createdAt: new Date(),
          updatedAt: new Date(),
        }) as never
  );
  mockedPrisma.experiment.findMany.mockResolvedValue(
    (overrides.experiments ?? []) as never
  );
  mockedPrisma.configVersion.findFirst.mockResolvedValue(
    (overrides.latestVersion ?? null) as never
  );
  mockedPrisma.configVersion.create.mockResolvedValue({} as never);
}

describe("ConfigPublisher", () => {
  let publisher: ConfigPublisher;

  beforeEach(() => {
    vi.clearAllMocks();
    publisher = new ConfigPublisher();
  });

  it("throws when the environment does not exist", async () => {
    setupMocks({ environment: null });

    await expect(publisher.publish("env-missing")).rejects.toThrow(
      "Environment not found"
    );
  });

  it("publishes a snapshot with version 1 when no prior versions exist", async () => {
    setupMocks();

    const snapshot = await publisher.publish("env-1");

    expect(snapshot.version).toBe(1);
    expect(snapshot.environment).toBe("production");
    expect(snapshot.experiments).toEqual([]);
    expect(new Date(snapshot.publishedAt).toISOString()).toBe(
      snapshot.publishedAt
    );
  });

  it("increments the version number from the latest existing version", async () => {
    setupMocks({
      latestVersion: {
        id: "cv-5",
        environmentId: "env-1",
        version: 5,
        snapshot: {},
        createdAt: new Date(),
      },
    });

    const snapshot = await publisher.publish("env-1");

    expect(snapshot.version).toBe(6);
  });

  it("maps experiments into the config snapshot shape", async () => {
    const targetingRules = [
      {
        conditions: [
          { attribute: "country", operator: "eq", value: "US" },
          { attribute: "plan", operator: "in", value: ["pro", "enterprise"] },
        ],
      },
    ];

    setupMocks({
      experiments: [
        createDbExperiment({ targetingRules }),
        createDbExperiment({ id: "exp-2", key: "onboarding", salt: "salt-2" }),
      ],
    });

    const snapshot = await publisher.publish("env-1");

    expect(snapshot.experiments).toHaveLength(2);

    const first: ConfigExperiment = snapshot.experiments[0]!;
    expect(first).toEqual({
      id: "exp-1",
      key: "checkout-flow",
      salt: "salt-1",
      audienceRules: [],
      targetingRules,
      variants: [
        { id: "var-control", key: "control", payload: { color: "blue" } },
        { id: "var-treatment", key: "treatment", payload: { color: "green" } },
      ],
      allocations: [
        { variantId: "var-control", rangeStart: 0, rangeEnd: 4999 },
        { variantId: "var-treatment", rangeStart: 5000, rangeEnd: 9999 },
      ],
    });

    expect(snapshot.experiments[1]!.key).toBe("onboarding");
  });

  it("defaults targeting rules to an empty array when null in the database", async () => {
    setupMocks({ experiments: [createDbExperiment({ targetingRules: null })] });

    const snapshot = await publisher.publish("env-1");

    expect(snapshot.experiments[0]!.targetingRules).toEqual([]);
  });

  it("defaults audience rules to an empty array when audience is null", async () => {
    setupMocks({ experiments: [createDbExperiment({ audience: null })] });

    const snapshot = await publisher.publish("env-1");

    expect(snapshot.experiments[0]!.audienceRules).toEqual([]);
  });

  it("includes audience rules when an audience is linked", async () => {
    const audienceRules = [
      {
        conditions: [{ attribute: "country", operator: "eq", value: "US" }],
      },
    ];

    setupMocks({
      experiments: [
        createDbExperiment({
          audience: {
            id: "aud-1",
            name: "US Audience",
            environmentId: "env-1",
            rules: audienceRules,
          },
        }),
      ],
    });

    const snapshot = await publisher.publish("env-1");

    expect(snapshot.experiments[0]!.audienceRules).toEqual(audienceRules);
  });

  it("writes versioned, latest, and version index objects to S3", async () => {
    setupMocks();

    const snapshot = await publisher.publish("env-1");
    const snapshotJson = JSON.stringify(snapshot);

    expect(mockedPutConfigObject).toHaveBeenCalledTimes(3);
    expect(mockedPutConfigObject).toHaveBeenCalledWith(
      "configs/production/snapshots/1.json",
      snapshotJson
    );
    expect(mockedPutConfigObject).toHaveBeenCalledWith(
      "configs/production/snapshots/latest.json",
      snapshotJson
    );
    expect(mockedPutConfigObject).toHaveBeenCalledWith(
      "configs/production/version.json",
      JSON.stringify({ version: 1 })
    );
  });

  it("stores the config version in the database for audit", async () => {
    setupMocks();

    const snapshot = await publisher.publish("env-1");

    expect(mockedPrisma.configVersion.create).toHaveBeenCalledWith({
      data: {
        environmentId: "env-1",
        version: 1,
        snapshot,
      },
    });
  });

  it("queries only RUNNING experiments for the given environment", async () => {
    setupMocks();

    await publisher.publish("env-1");

    expect(mockedPrisma.experiment.findMany).toHaveBeenCalledWith({
      where: {
        environmentId: "env-1",
        status: "RUNNING",
      },
      include: {
        audience: true,
        variants: true,
        allocations: true,
      },
    });
  });
});
