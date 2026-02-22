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

// --- Pagination ---

const coercedInt = z.coerce.number().int();

export const paginationSchema = z
  .object({
    page: coercedInt.min(1).optional(),
    pageSize: coercedInt.min(1).max(100).optional(),
  })
  .refine(
    (val) =>
      (val.page === undefined && val.pageSize === undefined) ||
      (val.page !== undefined && val.pageSize !== undefined),
    { message: "page and pageSize must be provided together" },
  )
  .transform((val) => ({
    page: val.page ?? 1,
    pageSize: val.pageSize ?? 20,
  }));

export type PaginationParams = z.infer<typeof paginationSchema>;

// --- Experiment Service API ---

export const listExperimentsSchema = z
  .object({
    environmentId: z.string().min(1).optional(),
    status: experimentStatusSchema.optional(),
    page: coercedInt.min(1).optional(),
    pageSize: coercedInt.min(1).max(100).optional(),
  })
  .refine(
    (val) =>
      (val.page === undefined && val.pageSize === undefined) ||
      (val.page !== undefined && val.pageSize !== undefined),
    { message: "page and pageSize must be provided together" },
  )
  .transform((val) => ({
    ...val,
    page: val.page ?? 1,
    pageSize: val.pageSize ?? 20,
  }));

export type ListExperimentsQuery = z.infer<typeof listExperimentsSchema>;

export const createExperimentSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  environmentId: z.string().min(1),
  audienceId: z.string().min(1).optional(),
  targetingRules: z.array(targetingRuleSchema).optional(),
});

export type CreateExperimentRequest = z.infer<typeof createExperimentSchema>;

export const updateExperimentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  audienceId: z.string().min(1).nullable().optional(),
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

export const updateVariantSchema = z.object({
  name: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type UpdateVariantRequest = z.infer<typeof updateVariantSchema>;

export const updateVariantsSchema = z.object({
  create: z
    .array(
      z.object({
        key: z.string().min(1),
        name: z.string().min(1),
        payload: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .default([]),
  update: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        payload: z.record(z.string(), z.unknown()).nullable().optional(),
      }),
    )
    .default([]),
  delete: z
    .array(
      z.object({
        id: z.string().min(1),
      }),
    )
    .default([]),
});

export type UpdateVariantsRequest = z.infer<typeof updateVariantsSchema>;

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

export const listAudiencesSchema = z
  .object({
    environmentId: z.string().min(1).optional(),
    page: coercedInt.min(1).optional(),
    pageSize: coercedInt.min(1).max(100).optional(),
  })
  .refine(
    (val) =>
      (val.page === undefined && val.pageSize === undefined) ||
      (val.page !== undefined && val.pageSize !== undefined),
    { message: "page and pageSize must be provided together" },
  )
  .transform((val) => ({
    ...val,
    page: val.page ?? 1,
    pageSize: val.pageSize ?? 20,
  }));

export type ListAudiencesQuery = z.infer<typeof listAudiencesSchema>;

export const createAudienceSchema = z.object({
  name: z.string().min(1),
  environmentId: z.string().min(1),
  rules: z.array(targetingRuleSchema),
});

export type CreateAudienceRequest = z.infer<typeof createAudienceSchema>;

export const updateAudienceSchema = z.object({
  name: z.string().min(1).optional(),
  rules: z.array(targetingRuleSchema).optional(),
});

export type UpdateAudienceRequest = z.infer<typeof updateAudienceSchema>;

export const listEnvironmentsSchema = paginationSchema;

export type ListEnvironmentsQuery = z.infer<typeof listEnvironmentsSchema>;

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
