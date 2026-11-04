import type { SelfUser } from './auth.js';

export interface PublicUser {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
}

export interface UserSearchData {
  users: PublicUser[];
}

export interface UpdateProfileData {
  user: SelfUser;
}
