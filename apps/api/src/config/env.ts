import 'dotenv/config';
import { z } from 'zod';

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z
    .url()
    .default('http://localhost:3000')
    .transform((value) => value.replace(/\/$/, '')),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters.'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(10).max(1440).default(60),

  SMTP_HOST: z.string().trim().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM: z.string().trim().min(1).default('ChatSphere <no-reply@chatsphere.local>'),

  COOKIE_DOMAIN: optionalString,
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  RATE_LIMIT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid API environment:\n${details}`);
}

export const env = result.data;
