import { apiClient } from './client';
import type { UserPreference, UpdatePreferencesPayload } from '@/types/preferences';

export const preferencesApi = {
  getPreferences: () => apiClient.get<UserPreference>('/preferences'),
  updatePreferences: (data: UpdatePreferencesPayload) =>
    apiClient.patch<UserPreference>('/preferences', data),
};
