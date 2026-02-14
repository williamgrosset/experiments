import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: process.env["S3_ENDPOINT"] || "http://localhost:9000",
  region: process.env["S3_REGION"] || "us-east-1",
  credentials: {
    accessKeyId: process.env["S3_ACCESS_KEY"] || "minioadmin",
    secretAccessKey: process.env["S3_SECRET_KEY"] || "minioadmin",
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET = process.env["S3_BUCKET"] || "experiment-configs";

export async function putConfigObject(
  key: string,
  body: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/json",
    })
  );
}
