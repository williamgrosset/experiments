import type { ExperimentStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const VALID_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  DRAFT: ["RUNNING", "ARCHIVED"],
  RUNNING: ["PAUSED", "ARCHIVED"],
  PAUSED: ["RUNNING", "ARCHIVED"],
  ARCHIVED: [],
};

export class ExperimentService {
  async create(data: {
    key: string;
    name: string;
    description?: string;
    environmentId: string;
    targetingRules?: Prisma.InputJsonValue;
  }) {
    return prisma.experiment.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        environmentId: data.environmentId,
        ...(data.targetingRules !== undefined && {
          targetingRules: data.targetingRules,
        }),
      },
      include: { variants: true, allocations: true, environment: true },
    });
  }

  async list(filters?: { environmentId?: string; status?: ExperimentStatus }) {
    return prisma.experiment.findMany({
      where: {
        ...(filters?.environmentId && {
          environmentId: filters.environmentId,
        }),
        ...(filters?.status && { status: filters.status }),
      },
      include: { variants: true, allocations: true, environment: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(id: string) {
    return prisma.experiment.findUnique({
      where: { id },
      include: { variants: true, allocations: true, environment: true },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      targetingRules?: Prisma.InputJsonValue;
    }
  ) {
    return prisma.experiment.update({
      where: { id },
      data,
      include: { variants: true, allocations: true, environment: true },
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
      include: { variants: true, allocations: true, environment: true },
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
