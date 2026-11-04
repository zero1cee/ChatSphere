import { execFileSync } from 'node:child_process';

import { Client } from 'pg';

import { TEST_DATABASE_URL } from './test-env.js';

function databaseName(url: string): string {
  const name = new URL(url).pathname.replace(/^\//, '');

  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Refusing to create a test database with an unsafe name: ${name}`);
  }

  return name;
}

export default async function globalSetup(): Promise<void> {
  const name = databaseName(TEST_DATABASE_URL);
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();

  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);

    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await client.end();
  }

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
}
