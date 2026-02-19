import type { FastifyReply } from "fastify";

export interface PublishMetadata {
  attempted: boolean;
  succeeded: boolean;
  error?: string;
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 512);
}

export function setPublishMetadataHeaders(
  reply: FastifyReply,
  metadata: PublishMetadata
) {
  reply.header("x-publish-attempted", String(metadata.attempted));
  reply.header("x-publish-succeeded", String(metadata.succeeded));

  if (metadata.error) {
    reply.header("x-publish-error", sanitizeHeaderValue(metadata.error));
  }
}
