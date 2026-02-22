import { type ExperimentStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const VALID_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  DRAFT: ["RUNNING", "ARCHIVED"],
  RUNNING: ["PAUSED", "ARCHIVED"],
  PAUSED: ["RUNNING", "ARCHIVED"],
  ARCHIVED: [],
};

export class ExperimentService {
  private async assertAudienceInEnvironment(
    audienceId: string,
    environmentId: string
  ): Promise<void> {
    const audience = await prisma.audience.findUnique({
      where: { id: audienceId },
      select: { id: true, environmentId: true },
    });

    if (!audience) {
      throw new Error("Audience not found");
    }

    if (audience.environmentId !== environmentId) {
      throw new Error("Audience must belong to the same environment");
    }
  }

  async create(data: {
    key: string;
    name: string;
    description?: string;
    environmentId: string;
    audienceId?: string;
    targetingRules?: Prisma.InputJsonValue;
  }) {
    if (data.audienceId) {
      await this.assertAudienceInEnvironment(data.audienceId, data.environmentId);
    }

    return prisma.experiment.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        environmentId: data.environmentId,
        audienceId: data.audienceId,
        ...(data.targetingRules !== undefined && {
          targetingRules: data.targetingRules,
        }),
      },
      include: {
        variants: true,
        allocations: true,
        environment: true,
        audience: true,
      },
    });
  }

  async list(filters: {
    environmentId?: string;
    status?: ExperimentStatus;
    page: number;
    pageSize: number;
  }) {
    const where = {
      ...(filters.environmentId && {
        environmentId: filters.environmentId,
      }),
      ...(filters.status && { status: filters.status }),
    };

    const { page, pageSize } = filters;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.experiment.findMany({
        where,
        include: {
          variants: true,
          allocations: true,
          environment: true,
          audience: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.experiment.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getById(id: string) {
    return prisma.experiment.findUnique({
      where: { id },
      include: {
        variants: true,
        allocations: true,
        environment: true,
        audience: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      audienceId?: string | null;
      targetingRules?: Prisma.InputJsonValue;
    }
  ) {
    if (data.audienceId !== undefined && data.audienceId !== null) {
      const experiment = await prisma.experiment.findUnique({
        where: { id },
        select: { environmentId: true },
      });

      if (!experiment) {
        throw new Error("Experiment not found");
      }

      await this.assertAudienceInEnvironment(data.audienceId, experiment.environmentId);
    }

    return prisma.experiment.update({
      where: { id },
      data,
      include: {
        variants: true,
        allocations: true,
        environment: true,
        audience: true,
      },
    });
  }

  async updateStatus(id: string, newStatus: ExperimentStatus) {
    const experiment = await prisma.experiment.findUnique({ where: { id } });
    if (!experiment) {
      throw new Error("Experiment not found");
    }

    const allowed = VALID_TRANSITIONS[experiment.status];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Cannot transition from ${experiment.status} to ${newStatus}`
      );
    }

    return prisma.experiment.update({
      where: { id },
      data: { status: newStatus },
      include: {
        variants: true,
        allocations: true,
        environment: true,
        audience: true,
      },
    });
  }

  async addVariant(
    experimentId: string,
    data: {
      key: string;
      name: string;
      payload?: Prisma.InputJsonValue;
    }
  ) {
    return prisma.variant.create({
      data: { ...data, experimentId },
    });
  }

  async updateVariant(
    variantId: string,
    data: {
      name?: string;
      payload?: Prisma.InputJsonValue | null;
    }
  ) {
    return prisma.variant.update({
      where: { id: variantId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.payload !== undefined && {
          payload: data.payload === null ? Prisma.JsonNull : data.payload,
        }),
      },
    });
  }

  async updateVariants(
    experimentId: string,
    operations: {
      create: Array<{
        key: string;
        name: string;
        payload?: Prisma.InputJsonValue;
      }>;
      update: Array<{
        id: string;
        name?: string;
        payload?: Prisma.InputJsonValue | null;
      }>;
      delete: Array<{ id: string }>;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const touchedIds = Array.from(new Set([
        ...operations.update.map((item) => item.id),
        ...operations.delete.map((item) => item.id),
      ]));

      if (touchedIds.length > 0) {
        const existing = await tx.variant.findMany({
          where: {
            experimentId,
            id: { in: touchedIds },
          },
          select: { id: true },
        });

        if (existing.length !== touchedIds.length) {
          throw new Error("One or more variants not found");
        }
      }

      if (operations.delete.length > 0) {
        await tx.variant.deleteMany({
          where: {
            experimentId,
            id: { in: operations.delete.map((item) => item.id) },
          },
        });
      }

      for (const item of operations.update) {
        await tx.variant.update({
          where: { id: item.id },
          data: {
            ...(item.name !== undefined && { name: item.name }),
            ...(item.payload !== undefined && {
              payload: item.payload === null ? Prisma.JsonNull : item.payload,
            }),
          },
        });
      }

      for (const item of operations.create) {
        await tx.variant.create({
          data: {
            experimentId,
            key: item.key,
            name: item.name,
            ...(item.payload !== undefined && { payload: item.payload }),
          },
        });
      }

      return tx.variant.findMany({ where: { experimentId } });
    });
  }

  async deleteVariant(variantId: string) {
    return prisma.variant.delete({
      where: { id: variantId },
    });
  }

  async delete(id: string) {
    const experiment = await prisma.experiment.findUnique({
      where: { id },
      include: { environment: true },
    });

    if (!experiment) {
      throw new Error("Experiment not found");
    }

    await prisma.experiment.delete({ where: { id } });

    return experiment;
  }

  async setAllocations(
    experimentId: string,
    allocations: Array<{
      variantId: string;
      rangeStart: number;
      rangeEnd: number;
    }>
  ) {
    // Validate: ranges must be within [0, 9999] and not overlap
    for (const alloc of allocations) {
      if (
        alloc.rangeStart < 0 ||
        alloc.rangeEnd > 9999 ||
        alloc.rangeStart > alloc.rangeEnd
      ) {
        throw new Error(
          `Invalid range [${alloc.rangeStart}, ${alloc.rangeEnd}]`
        );
      }
    }

    // Check for overlaps
    const sorted = [...allocations].sort(
      (a, b) => a.rangeStart - b.rangeStart
    );
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].rangeStart <= sorted[i - 1].rangeEnd) {
        throw new Error("Allocation ranges must not overlap");
      }
    }

    // Replace all allocations in a transaction
    return prisma.$transaction(async (tx) => {
      await tx.allocation.deleteMany({ where: { experimentId } });
      await tx.allocation.createMany({
        data: allocations.map((a) => ({ ...a, experimentId })),
      });
      return tx.allocation.findMany({ where: { experimentId } });
    });
  }
}

export const experimentService = new ExperimentService();
