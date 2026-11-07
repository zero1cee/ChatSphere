import { Router } from 'express';

import { createRateLimiter } from '../../lib/rate-limit.js';
import { requireTrustedOrigin } from '../../middleware/auth.js';
import {
  forgotPasswordController,
  loginController,
  logoutController,
  refreshController,
  registerController,
  resendVerificationController,
  resetPasswordController,
  verifyEmailController,
} from './auth.controller.js';

export const authRouter = Router();

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  prefix: 'auth:register',
});
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  prefix: 'auth:login',
});
const refreshLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  prefix: 'auth:refresh',
});
const logoutLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  prefix: 'auth:logout',
});
const verifyLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  prefix: 'auth:verify',
});
const resendLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  prefix: 'auth:resend',
});
const forgotLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  prefix: 'auth:forgot',
});
const resetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  prefix: 'auth:reset',
});

authRouter.post('/register', registerLimiter, registerController);
authRouter.post('/login', loginLimiter, loginController);
authRouter.post('/refresh', requireTrustedOrigin, refreshLimiter, refreshController);
authRouter.post('/logout', requireTrustedOrigin, logoutLimiter, logoutController);
authRouter.post('/verify-email', verifyLimiter, verifyEmailController);
authRouter.post('/resend-verification', resendLimiter, resendVerificationController);
authRouter.post('/forgot-password', forgotLimiter, forgotPasswordController);
authRouter.post('/reset-password', resetLimiter, resetPasswordController);
