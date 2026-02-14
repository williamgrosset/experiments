import { prisma } from "../lib/prisma.js";

export class EnvironmentService {
  async create(data: { name: string }) {
    return prisma.environment.create({
      data: { name: data.name },
    });
  }

  async list() {
    return prisma.environment.findMany({
      orderBy: { name: "asc" },
    });
  }

  async getById(id: string) {
    return prisma.environment.findUnique({
      where: { id },
    });
  }
}

export const environmentService = new EnvironmentService();
