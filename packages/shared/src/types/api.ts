import { z } from "zod";

// --- Shared sub-schemas ---

const targetingConditionSchema = z.object({
  attribute: z.string(),
  operator: z.enum(["eq", "neq", "in", "notIn", "contains", "gt", "lt"]),
  value: z.unknown(),
});

const targetingRuleSchema = z.object({
  conditions: z.array(targetingConditionSchema),
});

const experimentStatusSchema = z.enum([
  "DRAFT",
  "RUNNING",
  "PAUSED",
  "ARCHIVED",
]);

// --- Experiment Service API ---

export const createExperimentSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  environmentId: z.string().min(1),
  targetingRules: z.array(targetingRuleSchema).optional(),
});

export type CreateExperimentRequest = z.infer<typeof createExperimentSchema>;

export const updateExperimentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  targetingRules: z.array(targetingRuleSchema).optional(),
});

export type UpdateExperimentRequest = z.infer<typeof updateExperimentSchema>;

export const updateExperimentStatusSchema = z.object({
  status: experimentStatusSchema,
});

export type UpdateExperimentStatusRequest = z.infer<
  typeof updateExperimentStatusSchema
>;

export const createVariantSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type CreateVariantRequest = z.infer<typeof createVariantSchema>;

export const setAllocationsSchema = z.object({
  allocations: z.array(
    z.object({
      variantId: z.string().min(1),
      rangeStart: z.number().int().min(0).max(9999),
      rangeEnd: z.number().int().min(0).max(9999),
    })
  ),
});

export type SetAllocationsRequest = z.infer<typeof setAllocationsSchema>;

export const createEnvironmentSchema = z.object({
  name: z.string().min(1),
});

export type CreateEnvironmentRequest = z.infer<
  typeof createEnvironmentSchema
>;

export const publishConfigSchema = z.object({
  environmentId: z.string().min(1),
});

export type PublishConfigRequest = z.infer<typeof publishConfigSchema>;

// --- Decision Service API ---

export const decideRequestSchema = z.object({
  user_key: z.string().min(1),
  env: z.string().min(1),
  context: z.string().optional(), // JSON-encoded string from query param
});

export type DecideRequest = z.infer<typeof decideRequestSchema>;

export interface Assignment {
  experiment_key: string;
  experiment_id: string;
  variant_key: string;
  variant_id: string;
  payload?: Record<string, unknown>;
}

export interface DecideResponse {
  user_key: string;
  environment: string;
  config_version: number;
  assignments: Assignment[];
}
