import type { MessageAttachmentDTO } from '@chatsphere/shared';

import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  allowedAttachmentTypes,
  createAttachmentKey,
  deleteObject,
  getAttachmentUrl,
  uploadObject,
} from '../../lib/storage.js';

export async function createAttachment(input: {
  userId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
}): Promise<MessageAttachmentDTO> {
  if (!allowedAttachmentTypes.has(input.mimeType)) {
    throw new AppError(400, 'UNSUPPORTED_FILE_TYPE', 'Choose an image, PDF, or plain text file.');
  }

  if (input.fileSize <= 0) {
    throw new AppError(400, 'EMPTY_FILE', 'That file is empty.');
  }

  const fileName = input.fileName
    .replace(/[^\w.\- ()]/g, '')
    .trim()
    .slice(0, 255);
  const storageKey = createAttachmentKey(input.userId, fileName || 'attachment');

  await uploadObject({
    storageKey,
    body: input.buffer,
    contentType: input.mimeType,
  });

  try {
    const attachment = await prisma.messageAttachment.create({
      data: {
        uploadedById: input.userId,
        storageKey,
        fileName: fileName || 'attachment',
        mimeType: input.mimeType,
        fileSize: input.fileSize,
      },
    });

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      url: await getAttachmentUrl(attachment.storageKey),
    };
  } catch (error) {
    await deleteObject(storageKey).catch(() => undefined);
    throw error;
  }
}
