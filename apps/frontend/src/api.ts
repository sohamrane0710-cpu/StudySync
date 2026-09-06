export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let message = 'Network response was not ok';
    try {
      const errorData = await response.json();
      message = errorData.message || errorData.error || message;
    } catch (e) {
      // Ignore
    }
    throw new Error(message);
  }

  // Not all responses have JSON body, e.g., 204 No Content
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  try {
    return await response.json();
  } catch (e) {
    return null;
  }
}
