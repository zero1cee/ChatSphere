import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/storage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/storage.js')>();

  return {
    ...actual,
    uploadObject: vi.fn(async () => undefined),
    getAttachmentUrl: vi.fn(async () => 'https://files.test/attachment'),
    deleteObject: vi.fn(async () => undefined),
  };
});

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { createMessage } from '../../src/modules/messages/messages.service.js';
import { resetDatabase } from '../helpers/db.js';
import { createVerifiedUser } from '../helpers/users.js';

const app = createApp();

async function directConversation(firstUserId: string, secondUserId: string) {
  return prisma.conversation.create({
    data: {
      type: 'DIRECT',
      directKey: [firstUserId, secondUserId].sort().join(':'),
      members: {
        create: [{ userId: firstUserId }, { userId: secondUserId }],
      },
    },
  });
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('attachments', () => {
  it('uploads allowed files and attaches them to a message', async () => {
    const ada = await createVerifiedUser({
      name: 'Ada',
      username: 'ada',
      email: 'ada@example.com',
    });
    const ben = await createVerifiedUser({
      name: 'Ben',
      username: 'ben',
      email: 'ben@example.com',
    });
    const conversation = await directConversation(ada.user.id, ben.user.id);

    const upload = await request(app)
      .post('/api/attachments')
      .set('Authorization', ada.auth)
      .attach('file', Buffer.from('hello from a file'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      });

    expect(upload.status).toBe(201);
    expect(upload.body.data.attachment).toMatchObject({
      fileName: 'note.txt',
      mimeType: 'text/plain',
      url: 'https://files.test/attachment',
    });

    const attachmentId = upload.body.data.attachment.id as string;
    const stored = await prisma.messageAttachment.findUniqueOrThrow({
      where: { id: attachmentId },
    });
    expect(stored.uploadedById).toBe(ada.user.id);
    expect(stored.messageId).toBeNull();

    const result = await createMessage({
      conversationId: conversation.id,
      senderId: ada.user.id,
      clientMessageId: randomUUID(),
      attachmentIds: [attachmentId],
    });

    expect(result.message.attachments).toHaveLength(1);
    expect(result.message.attachments[0]?.fileName).toBe('note.txt');
    expect(result.message.content).toBeNull();

    const attached = await prisma.messageAttachment.findUniqueOrThrow({
      where: { id: attachmentId },
    });
    expect(attached.messageId).toBe(result.message.id);
  });

  it('rejects unsupported file types and unauthenticated uploads', async () => {
    const ada = await createVerifiedUser({
      name: 'Ada',
      username: 'ada',
      email: 'ada@example.com',
    });

    const unsupported = await request(app)
      .post('/api/attachments')
      .set('Authorization', ada.auth)
      .attach('file', Buffer.from('zip data'), {
        filename: 'archive.zip',
        contentType: 'application/zip',
      });

    expect(unsupported.status).toBe(400);
    expect(unsupported.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');

    await request(app)
      .post('/api/attachments')
      .attach('file', Buffer.from('hello'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(401);
  });

  it('rejects files larger than the configured limit', async () => {
    const ada = await createVerifiedUser({
      name: 'Ada',
      username: 'ada',
      email: 'ada@example.com',
    });

    const response = await request(app)
      .post('/api/attachments')
      .set('Authorization', ada.auth)
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1, 'a'), {
        filename: 'too-large.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('UPLOAD_INVALID');
  });
});
