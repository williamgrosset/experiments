import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL. Run `cp experiment-service/.env.example experiment-service/.env` from the repo root before starting experiment-service."
  );
}

export const prisma = new PrismaClient();
