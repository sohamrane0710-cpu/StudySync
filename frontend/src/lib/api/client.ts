import type { ApiErrorResponse } from '@/types/api';

const RAW_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000/api/v1';
export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '');

export class ApiNetworkError extends Error {
  public url: string;
  public originalError: unknown;

  constructor(url: string, originalError: unknown) {
    const rawMsg =
      originalError instanceof Error ? originalError.message : String(originalError);
    super(
      `Network Error while connecting to ${url}: ${rawMsg}. Please ensure the backend server is running on http://localhost:3000.`
    );
    this.name = 'ApiNetworkError';
    this.url = url;
    this.originalError = originalError;
  }
}

export class ApiClientError extends Error {
  public statusCode: number;
  public error: string;
  public path?: string;
  public timestamp?: string;
  public rawMessage: string | string[];

  constructor(errorResponse: ApiErrorResponse) {
    const formattedMessage = Array.isArray(errorResponse.message)
      ? errorResponse.message.join(', ')
      : errorResponse.message || 'An unexpected error occurred';

    super(formattedMessage);
    this.name = 'ApiClientError';
    this.statusCode = errorResponse.statusCode;
    this.error = errorResponse.error;
    this.path = errorResponse.path;
    this.timestamp = errorResponse.timestamp;
    this.rawMessage = errorResponse.message;
  }
}

type TokenProvider = () => Promise<string | null> | string | null;

let tokenProvider: TokenProvider = () => {
  // Check local storage for dev token or Supabase session token fallback
  return localStorage.getItem('studysync_auth_token') || null;
};

export function setTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('studysync_auth_token', token);
  } else {
    localStorage.removeItem('studysync_auth_token');
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem('studysync_auth_token');
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers = {}, ...customConfig } = options;

  let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const token = await tokenProvider();
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token.trim()}`;
  }

  const config: RequestInit = {
    ...customConfig,
    headers: requestHeaders,
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (fetchErr: unknown) {
    throw new ApiNetworkError(url, fetchErr);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return null as unknown as T;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    let errorData: ApiErrorResponse;
    if (isJson) {
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          statusCode: response.status,
          error: response.statusText,
          message: 'Failed to parse JSON error response from server',
          timestamp: new Date().toISOString(),
        };
      }
    } else {
      const text = await response.text();
      errorData = {
        statusCode: response.status,
        error: response.statusText,
        message: text || response.statusText,
        timestamp: new Date().toISOString(),
      };
    }

    throw new ApiClientError(errorData);
  }

  if (isJson) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
