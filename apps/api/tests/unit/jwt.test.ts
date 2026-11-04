import { describe, expect, it } from 'vitest';

import { signAccessToken, verifyAccessToken } from '../../src/lib/jwt.js';

describe('access tokens', () => {
  it('signs and verifies the user and session claims', async () => {
    const token = await signAccessToken({
      userId: '3d9f3f2a-56f7-4d3b-8e0d-9a7d1f4f6a10',
      sessionId: 'f2f5b3a1-8b1f-4b4f-9a1a-2d3e4f5a6b7c',
    });

    await expect(verifyAccessToken(token)).resolves.toEqual({
      userId: '3d9f3f2a-56f7-4d3b-8e0d-9a7d1f4f6a10',
      sessionId: 'f2f5b3a1-8b1f-4b4f-9a1a-2d3e4f5a6b7c',
    });
  });

  it('rejects a tampered token', async () => {
    const token = await signAccessToken({
      userId: '3d9f3f2a-56f7-4d3b-8e0d-9a7d1f4f6a10',
      sessionId: 'f2f5b3a1-8b1f-4b4f-9a1a-2d3e4f5a6b7c',
    });

    await expect(verifyAccessToken(`${token.slice(0, -2)}xx`)).rejects.toBeTruthy();
  });
});
