import { describe, expect, it } from 'vitest';

import { createOpaqueToken, hashIp, hashToken } from '../../src/lib/tokens.js';

describe('opaque tokens', () => {
  it('generates unpredictable, URL-safe tokens', () => {
    const first = createOpaqueToken();
    const second = createOpaqueToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(40);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashes deterministically without storing the raw value', () => {
    const token = createOpaqueToken();
    const hash = hashToken(token);

    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toBe(token);
  });

  it('peppers hashed IP addresses', () => {
    const first = hashIp('127.0.0.1');
    const second = hashIp('127.0.0.2');

    expect(first).toHaveLength(64);
    expect(first).not.toBe(second);
    expect(hashIp(undefined)).toBeNull();
  });
});
