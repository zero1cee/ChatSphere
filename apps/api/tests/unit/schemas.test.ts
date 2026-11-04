import { registerSchema } from '@chatsphere/shared';
import { describe, expect, it } from 'vitest';

describe('auth schemas', () => {
  it('normalizes email and username casing', () => {
    const parsed = registerSchema.parse({
      name: '  Ada Lovelace  ',
      username: '  Ada_1  ',
      email: '  ADA@Example.COM  ',
      password: 'CorrectHorse123',
    });

    expect(parsed.name).toBe('Ada Lovelace');
    expect(parsed.username).toBe('ada_1');
    expect(parsed.email).toBe('ada@example.com');
  });

  it('rejects a weak password', () => {
    expect(() =>
      registerSchema.parse({
        name: 'Ada',
        username: 'ada',
        email: 'ada@example.com',
        password: 'short',
      }),
    ).toThrow();
  });

  it('rejects an invalid email and unknown fields', () => {
    expect(() =>
      registerSchema.parse({
        name: 'Ada',
        username: 'ada',
        email: 'not-an-email',
        password: 'CorrectHorse123',
      }),
    ).toThrow();

    expect(() =>
      registerSchema.parse({
        name: 'Ada',
        username: 'ada',
        email: 'ada@example.com',
        password: 'CorrectHorse123',
        isAdmin: true,
      }),
    ).toThrow();
  });
});
