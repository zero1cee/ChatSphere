import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../../src/lib/password.js';

describe('password hashing', () => {
  it('hashes with Argon2id and verifies the original password', async () => {
    const hash = await hashPassword('CorrectHorse123');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('CorrectHorse123');
    expect(await verifyPassword(hash, 'CorrectHorse123')).toBe(true);
  });

  it('rejects a wrong password and a malformed hash', async () => {
    const hash = await hashPassword('CorrectHorse123');

    expect(await verifyPassword(hash, 'WrongHorse123')).toBe(false);
    expect(await verifyPassword('not-a-hash', 'CorrectHorse123')).toBe(false);
  });
});
