import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { env } from '../config/env.js';

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createFamilyId(): string {
  return randomUUID();
}

/**
 * Hash an IP before storing it. The JWT secret acts as a server-side pepper so
 * the stored value cannot be reversed with a trivial rainbow table.
 */
export function hashIp(ip: string | undefined): string | null {
  if (!ip) {
    return null;
  }

  return createHash('sha256').update(`${ip}:${env.JWT_ACCESS_SECRET}`).digest('hex');
}
