/**
 * Integration Test: End-to-end config publish and decision flow
 *
 * This is the #1 critical path test for the experimentation platform.
 * It verifies the complete lifecycle:
 *
 *   1. Create an environment in experiment-service (Postgres)
 *   2. Create an experiment with two variants and a 50/50 allocation
 *   3. Set the experiment status to RUNNING
 *   4. Publish the config (experiment-service -> S3/MinIO)
 *   5. Decision-service picks up the config via S3 polling
 *   6. GET /decide returns the correct variant assignment for a user
 *   7. The same user always gets the same variant (deterministic)
 *   8. Different users can get different variants (distribution)
 *
 * Prerequisites:
 *   - PostgreSQL and MinIO running (docker compose up)
 *   - experiment-service running on :3001
 *   - decision-service running on :3002
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getBucket } from "@experiments/shared";
import {
  waitForServices,
  waitForConfigPropagation,
  createEnvironment,
  createExperiment,
  addVariant,
  setAllocations,
  updateExperimentStatus,
  publishConfig,
  deleteExperiment,
  decide,
} from "./helpers/api.js";

/**
 * We use a stable environment name in integration tests to keep the
 * setup deterministic and easy to inspect across runs.
 */
const ENV_NAME = "test";

/** Unique suffix to avoid collisions with previous test runs */
const RUN_ID = Date.now().toString(36);
const EXPERIMENT_KEY = `test-exp-${RUN_ID}`;

/** IDs populated during setup, used for teardown */
let environmentId: string;
let experimentId: string;
let controlVariantId: string;
let treatmentVariantId: string;
let experimentSalt: string;

describe("End-to-end: config publish and decide", () => {
  beforeAll(async () => {
    await waitForServices();
  });

  afterAll(async () => {
    // Clean up: delete the experiment, which triggers a re-publish
    // that removes it from the decision-service config
    if (experimentId) {
      await deleteExperiment(experimentId);
    }
  });

  // --------------------------------------------------------------------------
  // Step 1: Create an environment
  // --------------------------------------------------------------------------
  it("should create an environment", async () => {
    const res = await createEnvironment(ENV_NAME);

    // Environment may already exist from a previous run — both 201 and 500
    // (unique constraint from Prisma) are acceptable. If it already exists,
    // fetch the existing one.
    if (res.status === 201) {
      environmentId = res.data.id;
      expect(res.data.name).toBe(ENV_NAME);
    } else {
      // Environment already exists — look it up via the list endpoint
      const listRes = await fetch("http://localhost:3001/environments");
      const body = (await listRes.json()) as {
        data: Array<{ id: string; name: string }>;
      };
      const existing = body.data.find((e) => e.name === ENV_NAME);
      expect(existing).toBeDefined();
      environmentId = existing!.id;
    }

    expect(environmentId).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // Step 2: Create an experiment
  // --------------------------------------------------------------------------
  it("should create an experiment in the environment", async () => {
    const res = await createExperiment({
      key: EXPERIMENT_KEY,
      name: `Integration Test Experiment ${RUN_ID}`,
      description: "Created by integration test suite",
      environmentId,
    });

    expect(res.status).toBe(201);
    expect(res.data.key).toBe(EXPERIMENT_KEY);
    expect(res.data.status).toBe("DRAFT");
    expect(res.data.environmentId).toBe(environmentId);

    experimentId = res.data.id;
    experimentSalt = res.data.salt;
  });

  // --------------------------------------------------------------------------
  // Step 3: Add variants (control + treatment)
  // --------------------------------------------------------------------------
  it("should add a control variant", async () => {
    const res = await addVariant(experimentId, {
      key: "control",
      name: "Control",
      payload: { color: "blue" },
    });

    expect(res.status).toBe(201);
    expect(res.data.key).toBe("control");
    controlVariantId = res.data.id;
  });

  it("should add a treatment variant", async () => {
    const res = await addVariant(experimentId, {
      key: "treatment",
      name: "Treatment",
      payload: { color: "green" },
    });

    expect(res.status).toBe(201);
    expect(res.data.key).toBe("treatment");
    treatmentVariantId = res.data.id;
  });

  // --------------------------------------------------------------------------
  // Step 4: Set allocations (50/50 split across all 10,000 buckets)
  // --------------------------------------------------------------------------
  it("should set 50/50 allocations", async () => {
    const res = await setAllocations(experimentId, [
      { variantId: controlVariantId, rangeStart: 0, rangeEnd: 4999 },
      { variantId: treatmentVariantId, rangeStart: 5000, rangeEnd: 9999 },
    ]);

    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(2);
  });

  // --------------------------------------------------------------------------
  // Step 5: Transition experiment to RUNNING
  // --------------------------------------------------------------------------
  it("should transition experiment status to RUNNING", async () => {
    const res = await updateExperimentStatus(experimentId, "RUNNING");

    expect(res.status).toBe(200);
    expect(res.data.status).toBe("RUNNING");
  });

  // --------------------------------------------------------------------------
  // Step 6: Publish the config
  // --------------------------------------------------------------------------
  it("should publish config snapshot to S3", async () => {
    const res = await publishConfig(experimentId);

    expect(res.status).toBe(200);
    expect(res.data.environment).toBe(ENV_NAME);
    expect(res.data.version).toBeGreaterThanOrEqual(1);
    expect(res.data.experiments).toBeInstanceOf(Array);

    // The snapshot should include our experiment
    const exp = res.data.experiments.find((e) => e.key === EXPERIMENT_KEY);
    expect(exp).toBeDefined();
    expect(exp!.variants).toHaveLength(2);
    expect(exp!.allocations).toHaveLength(2);
    expect(exp!.salt).toBe(experimentSalt);
  });

  // --------------------------------------------------------------------------
  // Step 7: Decision-service returns a variant for a user
  //
  // After publishing, the decision-service picks up the config via S3
  // polling and loads it into memory. We give it a short moment to propagate,
  // then verify the /decide endpoint returns a valid assignment.
  // --------------------------------------------------------------------------
  it("should return a variant assignment from the decision service", async () => {
    // Poll until S3 polling propagation delivers the config to decision-service
    // instead of sleeping a fixed duration
    const userKey = `user-integration-${RUN_ID}`;
    await waitForConfigPropagation({
      userKey,
      env: ENV_NAME,
      experimentKey: EXPERIMENT_KEY,
    });

    const res = await decide({ userKey, env: ENV_NAME });

    expect(res.status).toBe(200);
    expect(res.data.user_key).toBe(userKey);
    expect(res.data.environment).toBe(ENV_NAME);
    expect(res.data.config_version).toBeGreaterThanOrEqual(1);

    // Find our experiment's assignment
    const assignment = res.data.assignments.find(
      (a) => a.experiment_key === EXPERIMENT_KEY
    );
    expect(assignment).toBeDefined();
    expect(assignment!.experiment_id).toBe(experimentId);

    // Variant must be one of the two we created
    expect(["control", "treatment"]).toContain(assignment!.variant_key);
    expect([controlVariantId, treatmentVariantId]).toContain(
      assignment!.variant_id
    );

    // Payload should be present
    expect(assignment!.payload).toBeDefined();
    expect(["blue", "green"]).toContain(
      (assignment!.payload as Record<string, unknown>).color
    );
  });

  // --------------------------------------------------------------------------
  // Step 8: Determinism — same user always gets the same variant
  // --------------------------------------------------------------------------
  it("should return the same variant for the same user (deterministic)", async () => {
    const userKey = `user-determinism-${RUN_ID}`;

    const results = await Promise.all([
      decide({ userKey, env: ENV_NAME }),
      decide({ userKey, env: ENV_NAME }),
      decide({ userKey, env: ENV_NAME }),
    ]);

    const variants = results.map((r) => {
      const a = r.data.assignments.find(
        (a) => a.experiment_key === EXPERIMENT_KEY
      );
      return a?.variant_key;
    });

    // All three calls should return the same variant
    expect(variants[0]).toBeDefined();
    expect(variants[0]).toBe(variants[1]);
    expect(variants[0]).toBe(variants[2]);
  });

  // --------------------------------------------------------------------------
  // Step 9: Verify bucketing matches the shared hashing utility
  //
  // This confirms the decision-service uses the exact same hashing algorithm
  // as the shared package — the assignment is predictable given userKey + salt.
  // --------------------------------------------------------------------------
  it("should match the expected variant based on shared getBucket utility", async () => {
    const userKey = `user-bucket-verify-${RUN_ID}`;

    // Compute the expected bucket client-side
    const expectedBucket = getBucket(userKey, experimentSalt);
    const expectedVariantKey =
      expectedBucket <= 4999 ? "control" : "treatment";
    const expectedVariantId =
      expectedBucket <= 4999 ? controlVariantId : treatmentVariantId;

    // Ask the decision service
    const res = await decide({ userKey, env: ENV_NAME });
    expect(res.status).toBe(200);

    const assignment = res.data.assignments.find(
      (a) => a.experiment_key === EXPERIMENT_KEY
    );
    expect(assignment).toBeDefined();
    expect(assignment!.variant_key).toBe(expectedVariantKey);
    expect(assignment!.variant_id).toBe(expectedVariantId);
  });

  // Step 10: Distribution sanity check across many users
  //
  // For a 50/50 allocation, sampled assignments should be approximately balanced.
  // We use N=200 users and accept a wide 40-60% range per variant to reduce
  // flakiness while still catching obvious skew/regressions in bucketing.
  // --------------------------------------------------------------------------
  it("should produce a roughly 50/50 split across many users", async () => {
    const SAMPLE_SIZE = 200;
    const MIN_RATIO = 0.4;
    const MAX_RATIO = 0.6;

    let controlCount = 0;
    let treatmentCount = 0;

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const userKey = `user-dist-${RUN_ID}-${i}`;
      const res = await decide({ userKey, env: ENV_NAME });
      expect(res.status).toBe(200);

      const assignment = res.data.assignments.find(
        (a) => a.experiment_key === EXPERIMENT_KEY
      );
      expect(assignment).toBeDefined();

      if (assignment!.variant_key === "control") {
        controlCount++;
      } else if (assignment!.variant_key === "treatment") {
        treatmentCount++;
      }
    }

    const total = controlCount + treatmentCount;
    expect(total).toBe(SAMPLE_SIZE);

    const controlRatio = controlCount / total;
    const treatmentRatio = treatmentCount / total;

    expect(controlRatio).toBeGreaterThanOrEqual(MIN_RATIO);
    expect(controlRatio).toBeLessThanOrEqual(MAX_RATIO);
    expect(treatmentRatio).toBeGreaterThanOrEqual(MIN_RATIO);
    expect(treatmentRatio).toBeLessThanOrEqual(MAX_RATIO);
  });
});
