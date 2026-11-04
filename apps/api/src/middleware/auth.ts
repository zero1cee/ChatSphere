import type { RequestHandler } from 'express';

import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { toSelfUser } from '../modules/users/users.mapper.js';

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.header('authorization');

  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }

  const token = header.slice('Bearer '.length).trim();

  if (!token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }

  try {
    req.auth = await verifyAccessToken(token);
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED', 'Your session has expired. Sign in again.');
  }

  next();
};

export const requireVerifiedEmail: RequestHandler = async (req, _res, next) => {
  if (!req.auth) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'This account no longer exists.');
  }

  if (!user.emailVerifiedAt) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address before continuing.');
  }

  req.currentUser = toSelfUser(user);
  next();
};

export const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.header('origin');

  if (origin && origin !== env.WEB_ORIGIN) {
    throw new AppError(403, 'FORBIDDEN', 'This request came from an untrusted origin.');
  }

  next();
};

export interface RequestContext {
  ip: string | undefined;
  userAgent: string | undefined;
}

export function requestContext(req: {
  ip?: string;
  header(name: string): string | undefined;
}): RequestContext {
  return {
    ip: req.ip,
    userAgent: req.header('user-agent'),
  };
}
