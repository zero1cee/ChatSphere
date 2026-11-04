import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  SelfUser,
  VerifyEmailInput,
} from '@chatsphere/shared';

import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { signAccessToken } from '../../lib/jwt.js';
import { logger } from '../../lib/logger.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../lib/mailer.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { isPrismaUniqueConstraintError } from '../../lib/prisma-errors.js';
import { createFamilyId, createOpaqueToken, hashIp, hashToken } from '../../lib/tokens.js';
import { toSelfUser } from '../users/users.mapper.js';

export interface AuthContext {
  ip?: string;
  userAgent?: string;
}

export interface AuthResult {
  user: SelfUser;
  accessToken: string;
  refreshToken: string;
}

function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function userAgent(context: AuthContext): string | null {
  return context.userAgent ? context.userAgent.slice(0, 255) : null;
}

let dummyPasswordHash: string | null = null;

/**
 * Perform an Argon2 verification even when the email does not exist so an
 * attacker cannot distinguish "unknown email" from "wrong password" by timing.
 */
async function verifyDummyPassword(password: string): Promise<void> {
  dummyPasswordHash ??= await hashPassword('chatsphere-timing-placeholder');
  await verifyPassword(dummyPasswordHash, password);
}

async function revokeFamily(familyId: string): Promise<void> {
  await prisma.refreshSession.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function register(input: RegisterInput, context: AuthContext): Promise<AuthResult> {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.email }, { username: input.username }],
    },
    select: { email: true, username: true },
  });

  if (existing) {
    if (existing.email === input.email) {
      throw new AppError(
        409,
        'EMAIL_ALREADY_EXISTS',
        'An account with this email already exists.',
        {
          field: 'email',
        },
      );
    }

    throw new AppError(409, 'USERNAME_TAKEN', 'That username is already taken.', {
      field: 'username',
    });
  }

  const passwordHash = await hashPassword(input.password);
  const verificationToken = createOpaqueToken();
  const verificationTokenHash = hashToken(verificationToken);
  const refreshToken = createOpaqueToken();
  const refreshTokenHash = hashToken(refreshToken);
  const familyId = createFamilyId();
  const sessionExpiresAt = refreshTokenExpiry();

  const created = await (async () => {
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: input.name,
            username: input.username,
            email: input.email,
            passwordHash,
          },
        });

        await tx.verificationToken.create({
          data: {
            userId: user.id,
            type: 'EMAIL_VERIFICATION',
            tokenHash: verificationTokenHash,
            expiresAt: new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000),
          },
        });

        const session = await tx.refreshSession.create({
          data: {
            userId: user.id,
            tokenHash: refreshTokenHash,
            familyId,
            expiresAt: sessionExpiresAt,
            userAgent: userAgent(context),
            ipHash: hashIp(context.ip),
          },
          select: { id: true },
        });

        return { user, sessionId: session.id };
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new AppError(
          409,
          'ACCOUNT_ALREADY_EXISTS',
          'That email or username is already in use.',
        );
      }

      throw error;
    }
  })();

  const accessToken = await signAccessToken({
    userId: created.user.id,
    sessionId: created.sessionId,
  });

  await sendVerificationEmail({
    to: created.user.email,
    name: created.user.name,
    token: verificationToken,
  }).catch((error: unknown) => {
    logger.error({ err: error, userId: created.user.id }, 'Failed to send verification email');
  });

  return {
    user: toSelfUser(created.user),
    accessToken,
    refreshToken,
  };
}

export async function login(input: LoginInput, context: AuthContext): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    await verifyDummyPassword(input.password);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  const refreshToken = createOpaqueToken();
  const refreshTokenHash = hashToken(refreshToken);
  const familyId = createFamilyId();

  const session = await prisma.refreshSession.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      familyId,
      expiresAt: refreshTokenExpiry(),
      userAgent: userAgent(context),
      ipHash: hashIp(context.ip),
    },
    select: { id: true },
  });

  const accessToken = await signAccessToken({
    userId: user.id,
    sessionId: session.id,
  });

  return {
    user: toSelfUser(user),
    accessToken,
    refreshToken,
  };
}

export async function refresh(rawRefreshToken: string, context: AuthContext): Promise<AuthResult> {
  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash: hashToken(rawRefreshToken) },
    include: { user: true },
  });

  if (!session?.user) {
    throw new AppError(401, 'INVALID_SESSION', 'Your session has expired. Sign in again.');
  }

  const now = new Date();

  if (session.revokedAt) {
    await revokeFamily(session.familyId);
    throw new AppError(401, 'SESSION_REUSED', 'Your session is no longer valid. Sign in again.');
  }

  if (session.expiresAt <= now) {
    await prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: now },
    });
    throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.');
  }

  const nextToken = createOpaqueToken();
  const nextTokenHash = hashToken(nextToken);
  const nextExpiresAt = refreshTokenExpiry();

  const rotated = await prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: now, lastUsedAt: now },
    });

    if (revoked.count !== 1) {
      return null;
    }

    return tx.refreshSession.create({
      data: {
        userId: session.userId,
        tokenHash: nextTokenHash,
        familyId: session.familyId,
        expiresAt: nextExpiresAt,
        userAgent: userAgent(context),
        ipHash: hashIp(context.ip),
      },
      select: { id: true },
    });
  });

  if (!rotated) {
    await revokeFamily(session.familyId);
    throw new AppError(401, 'SESSION_REUSED', 'Your session is no longer valid. Sign in again.');
  }

  const accessToken = await signAccessToken({
    userId: session.userId,
    sessionId: rotated.id,
  });

  return {
    user: toSelfUser(session.user),
    accessToken,
    refreshToken: nextToken,
  };
}

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) {
    return;
  }

  await prisma.refreshSession.updateMany({
    where: { tokenHash: hashToken(rawRefreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function verifyEmail(input: VerifyEmailInput): Promise<void> {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
    include: { user: true },
  });

  const now = new Date();

  if (!record) {
    throw new AppError(400, 'INVALID_TOKEN', 'This verification link is invalid or has expired.');
  }

  if (record.type !== 'EMAIL_VERIFICATION' || record.usedAt || record.expiresAt <= now) {
    throw new AppError(400, 'INVALID_TOKEN', 'This verification link is invalid or has expired.');
  }

  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: record.user.emailVerifiedAt ?? now },
    }),
  ]);
}

export async function resendVerification(input: ResendVerificationInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user || user.emailVerifiedAt) {
    return;
  }

  const token = createOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({
      where: { userId: user.id, type: 'EMAIL_VERIFICATION', usedAt: null },
    }),
    prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  await sendVerificationEmail({
    to: user.email,
    name: user.name,
    token,
  }).catch((error: unknown) => {
    logger.error({ err: error, userId: user.id }, 'Failed to resend verification email');
  });
}

export async function forgotPassword(input: ForgotPasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    return;
  }

  const token = createOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({
      where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null },
    }),
    prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    token,
  }).catch((error: unknown) => {
    logger.error({ err: error, userId: user.id }, 'Failed to send password reset email');
  });
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
  });

  const now = new Date();

  if (!record) {
    throw new AppError(400, 'INVALID_TOKEN', 'This reset link is invalid or has expired.');
  }

  if (record.type !== 'PASSWORD_RESET' || record.usedAt || record.expiresAt <= now) {
    throw new AppError(400, 'INVALID_TOKEN', 'This reset link is invalid or has expired.');
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    }),
    prisma.verificationToken.updateMany({
      where: {
        userId: record.userId,
        type: 'PASSWORD_RESET',
        usedAt: null,
      },
      data: { usedAt: now },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.refreshSession.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);
}
