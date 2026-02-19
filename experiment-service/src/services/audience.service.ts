import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export class AudienceService {
  async create(data: {
    name: string;
    environmentId: string;
    rules: Prisma.InputJsonValue;
  }) {
    return prisma.audience.create({
      data,
      include: { environment: true },
    });
  }

  async list(filters: {
    environmentId?: string;
    page: number;
    pageSize: number;
  }) {
    const where = {
      ...(filters.environmentId && { environmentId: filters.environmentId }),
    };

    const { page, pageSize } = filters;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.audience.findMany({
        where,
        include: { environment: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.audience.count({ where }),
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
    return prisma.audience.findUnique({
      where: { id },
      include: { environment: true },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      rules?: Prisma.InputJsonValue;
    }
  ) {
    return prisma.audience.update({
      where: { id },
      data,
      include: { environment: true },
    });
  }

  async delete(id: string) {
    return prisma.audience.delete({
      where: { id },
      include: { environment: true },
    });
  }

  async hasRunningExperiments(id: string): Promise<boolean> {
    const count = await prisma.experiment.count({
      where: {
        audienceId: id,
        status: "RUNNING",
      },
    });

    return count > 0;
  }
}

export const audienceService = new AudienceService();
