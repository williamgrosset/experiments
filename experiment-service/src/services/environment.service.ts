import { prisma } from "../lib/prisma.js";

export class EnvironmentService {
  async create(data: { name: string }) {
    return prisma.environment.create({
      data: { name: data.name },
    });
  }

  async list(pagination: { page: number; pageSize: number }) {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.environment.findMany({
        orderBy: { name: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.environment.count(),
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
    return prisma.environment.findUnique({
      where: { id },
    });
  }
}

export const environmentService = new EnvironmentService();
