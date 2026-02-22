import { spawn } from "node:child_process";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

const LOCAL_MINIO_ENDPOINT = "http://localhost:9000";
const LOCAL_MINIO_REGION = "us-east-1";
const LOCAL_MINIO_ACCESS_KEY = "minioadmin";
const LOCAL_MINIO_SECRET_KEY = "minioadmin";
const LOCAL_MINIO_BUCKET = "experiment-configs";
const LOCAL_DATABASE_URL =
  "postgresql://experiments:experiments@localhost:5432/experiments";

const s3 = new S3Client({
  endpoint: LOCAL_MINIO_ENDPOINT,
  region: LOCAL_MINIO_REGION,
  credentials: {
    accessKeyId: LOCAL_MINIO_ACCESS_KEY,
    secretAccessKey: LOCAL_MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

const bucket = LOCAL_MINIO_BUCKET;

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "postgres" ||
    hostname === "minio"
  );
}

function getEffectiveDatabaseUrl(): string {
  return process.env["DATABASE_URL"] || LOCAL_DATABASE_URL;
}

function assertLocalDatabaseTarget(databaseUrl: string): void {

  let databaseHostname: string;

  try {
    databaseHostname = new URL(databaseUrl).hostname;
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }

  if (!isLocalHostname(databaseHostname)) {
    throw new Error(
      `Refusing to reset non-local database host '${databaseHostname}'`
    );
  }
}

function runPrismaReset(): Promise<void> {
  const databaseUrl = getEffectiveDatabaseUrl();

  return new Promise((resolve, reject) => {
    const child = spawn("prisma", ["migrate", "reset", "--force"], {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      stdio: "inherit",
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`prisma migrate reset failed with exit code ${code}`));
    });
  });
}

function isNoSuchBucketError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === "NoSuchBucket";
}

async function clearBucket(): Promise<number> {
  let deletedCount = 0;

  while (true) {
    const listResponse = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        MaxKeys: 1000,
      })
    );

    const keys = (listResponse.Contents || [])
      .map((obj) => obj.Key)
      .filter((key): key is string => Boolean(key));

    if (keys.length === 0) {
      return deletedCount;
    }

    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
        },
      })
    );

    deletedCount += keys.length;
  }
}

async function main(): Promise<void> {
  const databaseUrl = getEffectiveDatabaseUrl();
  assertLocalDatabaseTarget(databaseUrl);

  console.log("Resetting PostgreSQL database...");
  await runPrismaReset();

  console.log(`Clearing MinIO bucket '${bucket}'...`);

  try {
    const deletedCount = await clearBucket();
    console.log(`Deleted ${deletedCount} object(s) from '${bucket}'.`);
  } catch (error) {
    if (isNoSuchBucketError(error)) {
      console.log(`Bucket '${bucket}' does not exist, nothing to clear.`);
      return;
    }

    throw error;
  }
}

main().catch((error) => {
  console.error("db:reset failed", error);
  process.exit(1);
});
