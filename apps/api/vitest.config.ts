import { defineConfig } from 'vitest/config';

import { TEST_DATABASE_URL, TEST_JWT_SECRET } from './tests/test-env.js';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    globalSetup: ['./tests/global-setup.ts'],
    hookTimeout: 60_000,
    testTimeout: 20_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_ACCESS_SECRET: TEST_JWT_SECRET,
      WEB_ORIGIN: 'http://localhost:3000',
      LOG_LEVEL: 'silent',
      RATE_LIMIT_ENABLED: 'false',
      ACCESS_TOKEN_TTL_SECONDS: '900',
      REFRESH_TOKEN_TTL_DAYS: '30',
      EMAIL_VERIFICATION_TTL_HOURS: '24',
      PASSWORD_RESET_TTL_MINUTES: '60',
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      SMTP_SECURE: 'false',
      SMTP_FROM: 'ChatSphere <test@chatsphere.local>',
      COOKIE_DOMAIN: '',
      TRUST_PROXY: 'false',
    },
  },
});
