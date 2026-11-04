import { hash, verify } from '@node-rs/argon2';

// @node-rs/argon2 defaults to Argon2id. The cost parameters follow the OWASP
// recommendation for an interactive login (19 MiB, 2 passes, 1 lane).
const HASH_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
