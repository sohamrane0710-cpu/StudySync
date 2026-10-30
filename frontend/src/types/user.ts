import type { UserPreference } from './preferences';

export interface AuthUser {
  id: string;
  email?: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
}

export interface UserProfile extends AuthUser {
  createdAt: string;
  updatedAt: string;
  preferences?: UserPreference;
}

export interface UpdateProfilePayload {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
}
