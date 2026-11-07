import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { sendError } from '../lib/api-response.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, 'NOT_FOUND', `No route matches ${req.method} ${req.originalUrl}.`);
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    sendError(res, error.statusCode, error.code, error.message, error.details);
    return;
  }

  if (error instanceof Error && error.name === 'MulterError') {
    const uploadError = error as Error & { code?: string };
    const message =
      uploadError.code === 'LIMIT_FILE_SIZE'
        ? 'That file is too large. Choose a file up to 10 MB.'
        : 'That file could not be uploaded.';

    sendError(res, 400, 'UPLOAD_INVALID', message);
    return;
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    sendError(res, 400, 'VALIDATION_ERROR', 'The request contains invalid data.', details);
    return;
  }

  logger.error(
    {
      err: error,
      method: req.method,
      path: req.originalUrl,
    },
    'Unhandled request error',
  );

  sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
};
