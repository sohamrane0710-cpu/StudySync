import { apiClient } from './client';
import type { UserProfile, UpdateProfilePayload } from '@/types/user';

export const usersApi = {
  getMe: () => apiClient.get<UserProfile>('/users/me'),
  updateMe: (data: UpdateProfilePayload) => apiClient.patch<UserProfile>('/users/me', data),
};
