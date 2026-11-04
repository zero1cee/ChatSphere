import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@chatsphere/shared';
import type { RequestHandler } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from '../../lib/cookies.js';
import { AppError } from '../../lib/errors.js';
import { requestContext } from '../../middleware/auth.js';
import * as authService from './auth.service.js';

function refreshTokenFrom(req: { cookies?: Record<string, unknown> }): string | undefined {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

export const registerController: RequestHandler = async (req, res) => {
  const input = registerSchema.parse(req.body);
  const result = await authService.register(input, requestContext(req));

  setRefreshCookie(res, result.refreshToken);
  sendSuccess(
    res,
    {
      user: result.user,
      accessToken: result.accessToken,
    },
    201,
  );
};

export const loginController: RequestHandler = async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input, requestContext(req));

  setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, {
    user: result.user,
    accessToken: result.accessToken,
  });
};

export const refreshController: RequestHandler = async (req, res) => {
  const token = refreshTokenFrom(req);

  if (!token) {
    throw new AppError(401, 'INVALID_SESSION', 'Your session has expired. Sign in again.');
  }

  try {
    const result = await authService.refresh(token, requestContext(req));

    setRefreshCookie(res, result.refreshToken);
    sendSuccess(res, {
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
};

export const logoutController: RequestHandler = async (req, res) => {
  await authService.logout(refreshTokenFrom(req));
  clearRefreshCookie(res);
  res.status(204).end();
};

export const verifyEmailController: RequestHandler = async (req, res) => {
  const input = verifyEmailSchema.parse(req.body);
  await authService.verifyEmail(input);

  sendSuccess(res, { verified: true });
};

export const resendVerificationController: RequestHandler = async (req, res) => {
  const input = resendVerificationSchema.parse(req.body);
  await authService.resendVerification(input);

  sendSuccess(
    res,
    { message: 'If that account needs verification, a new email is on its way.' },
    202,
  );
};

export const forgotPasswordController: RequestHandler = async (req, res) => {
  const input = forgotPasswordSchema.parse(req.body);
  await authService.forgotPassword(input);

  sendSuccess(
    res,
    { message: 'If an account exists for that email, a reset link is on its way.' },
    202,
  );
};

export const resetPasswordController: RequestHandler = async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(input);

  clearRefreshCookie(res);
  res.status(204).end();
};
