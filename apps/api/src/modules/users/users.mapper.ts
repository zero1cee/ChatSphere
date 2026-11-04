import type { SelfUser } from '@chatsphere/shared';

interface UserRecord {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toSelfUser(user: UserRecord): SelfUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
