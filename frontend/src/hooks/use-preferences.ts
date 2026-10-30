import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { preferencesApi } from '@/lib/api/preferences';
import type { UpdatePreferencesPayload } from '@/types/preferences';
import { useAuth } from '@/features/auth/auth-context';

export const PREFERENCES_QUERY_KEY = ['preferences'];

export function usePreferences() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: PREFERENCES_QUERY_KEY,
    queryFn: preferencesApi.getPreferences,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const mutation = useMutation({
    mutationFn: (payload: UpdatePreferencesPayload) => preferencesApi.updatePreferences(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(PREFERENCES_QUERY_KEY, updated);
      queryClient.invalidateQueries({ queryKey: PREFERENCES_QUERY_KEY });
    },
  });

  return {
    preferences: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    updatePreferences: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
