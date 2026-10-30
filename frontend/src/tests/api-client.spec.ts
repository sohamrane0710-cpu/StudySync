import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClientError, setAuthToken, setTokenProvider, apiClient } from '@/lib/api/client';

describe('API Client & Error Handling', () => {
  beforeEach(() => {
    localStorage.clear();
    setTokenProvider(() => localStorage.getItem('studysync_auth_token'));
    vi.restoreAllMocks();
  });

  describe('ApiClientError', () => {
    it('correctly constructs error with single string message', () => {
      const error = new ApiClientError({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing Authorization header',
        timestamp: '2026-10-29T10:00:00.000Z',
        path: '/api/v1/timer-modes',
      });

      expect(error.name).toBe('ApiClientError');
      expect(error.statusCode).toBe(401);
      expect(error.error).toBe('Unauthorized');
      expect(error.message).toBe('Missing Authorization header');
      expect(error.path).toBe('/api/v1/timer-modes');
    });

    it('joins array validation error messages cleanly', () => {
      const error = new ApiClientError({
        statusCode: 400,
        error: 'Bad Request',
        message: ['name should not be empty', 'focusDuration must not be less than 60'],
        timestamp: '2026-10-29T10:00:00.000Z',
        path: '/api/v1/timer-modes',
      });

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('name should not be empty, focusDuration must not be less than 60');
      expect(Array.isArray(error.rawMessage)).toBe(true);
    });
  });

  describe('apiClient request execution', () => {
    it('attaches Authorization Bearer token when present', async () => {
      setAuthToken('test-jwt-token-123');

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ status: 'ok' }),
      } as Response);

      await apiClient.get('/health');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const callHeaders = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(callHeaders['Authorization']).toBe('Bearer test-jwt-token-123');
    });

    it('throws ApiClientError when response is not ok', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Cannot modify protected system mode',
        }),
      } as Response);

      await expect(apiClient.delete('/timer-modes/some-id')).rejects.toThrow(ApiClientError);
    });
  });
});
