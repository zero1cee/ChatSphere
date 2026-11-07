import { Router } from 'express';
import multer from 'multer';

import { sendSuccess } from '../../lib/api-response.js';
import { AppError } from '../../lib/errors.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { attachmentFileSizeLimit } from '../../lib/storage.js';
import { requireAuth, requireVerifiedEmail } from '../../middleware/auth.js';
import { createAttachment } from './attachments.service.js';

export const attachmentsRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: attachmentFileSizeLimit, files: 1 },
});
const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  prefix: 'attachments:upload',
});

attachmentsRouter.use(requireAuth, requireVerifiedEmail);

attachmentsRouter.post('/', uploadLimiter, upload.single('file'), async (req, res) => {
  if (!req.auth) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }

  if (!req.file) {
    throw new AppError(400, 'NO_FILE', 'Choose a file to upload.');
  }

  const attachment = await createAttachment({
    userId: req.auth.userId,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    buffer: req.file.buffer,
  });

  sendSuccess(res, { attachment }, 201);
});
