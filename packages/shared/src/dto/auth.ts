export interface SelfUser {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionData {
  user: SelfUser;
  accessToken: string;
}

export interface MeData {
  user: SelfUser;
}

export interface VerificationResult {
  verified: true;
}
