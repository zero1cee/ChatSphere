import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../config/env.js';

const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

function safeExtension(fileName: string): string {
  return extname(fileName)
    .slice(0, 16)
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '');
}

export function createAttachmentKey(userId: string, fileName: string): string {
  return `${userId}/${randomUUID()}${safeExtension(fileName)}`;
}

export async function uploadObject(input: {
  storageKey: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: input.storageKey,
      Body: input.body,
      ContentType: input.contentType,
      ContentLength: input.body.length,
    }),
  );
}

export function getAttachmentUrl(storageKey: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: storageKey,
    }),
    { expiresIn: env.S3_URL_TTL_SECONDS },
  );
}

export const allowedAttachmentTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
]);

export const attachmentFileSizeLimit = env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024;

export async function deleteObject(storageKey: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: storageKey,
    }),
  );
}
