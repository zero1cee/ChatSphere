export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://chatsphere:chatsphere_dev_password@localhost:5432/chatsphere_test?schema=public';

export const TEST_JWT_SECRET = 'test-only-access-secret-that-is-long-enough';
