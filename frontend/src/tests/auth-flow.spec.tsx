import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';
import { getAuthToken, setAuthToken, ApiNetworkError, API_BASE_URL } from '../lib/api/client';
import { usersApi } from '../lib/api/users';

describe('Quick Local Developer Sign-In & Auth Lifecycle Regression', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, 'Login', '/login');
  });

  it('1. performs Quick Local Developer Sign-In, stores token, and navigates to focus workspace', async () => {
    render(<App />);

    const devButton = await screen.findByRole('button', { name: /Quick Local Developer Sign-In/i });
    expect(devButton).toBeInTheDocument();
    expect(devButton).not.toBeDisabled();

    fireEvent.click(devButton);

    // Should navigate into /app/focus
    await waitFor(
      () => {
        expect(window.location.pathname).toBe('/app/focus');
      },
      { timeout: 4000 }
    );

    // Token must be stored in client storage
    const token = getAuthToken();
    expect(token).toBeTruthy();

    // Authenticated API request must succeed
    const profile = await usersApi.getMe();
    expect(profile).toBeDefined();
    expect(profile.username).toBeDefined();
  });

  it('2. restores authenticated session on page refresh without redirecting to login', async () => {
    // Simulate existing valid token stored prior to page load
    const validToken = import.meta.env.VITE_DEV_TOKEN;
    if (validToken) {
      setAuthToken(validToken);
    }
    window.history.pushState({}, 'Focus', '/app/focus');

    render(<App />);

    await waitFor(
      () => {
        expect(window.location.pathname).toBe('/app/focus');
      },
      { timeout: 4000 }
    );

    expect(getAuthToken()).toBe(validToken);
  });

  it('3. displays a useful error message and resets loading state when dev token is rejected', async () => {
    // Mock getMe to reject with 401
    const originalGetMe = usersApi.getMe;
    vi.spyOn(usersApi, 'getMe').mockRejectedValueOnce(
      new Error('Invalid or expired authentication token')
    );

    render(<App />);

    const devButton = await screen.findByRole('button', { name: /Quick Local Developer Sign-In/i });
    expect(devButton).toBeInTheDocument();

    fireEvent.click(devButton);

    // Error alert must be rendered on the page
    await waitFor(() => {
      expect(screen.getByText(/Invalid or expired authentication token/i)).toBeInTheDocument();
    });

    // Button loading state must be cleared and button re-enabled
    await waitFor(() => {
      expect(devButton).not.toBeDisabled();
    });

    // Token must not linger in storage after failure
    expect(getAuthToken()).toBeNull();

    usersApi.getMe = originalGetMe;
  });

  it('4. displays helpful error when no dev token is configured and prompt is dismissed', async () => {
    // Mock import.meta.env.VITE_DEV_TOKEN being unset and window.prompt returning null
    const originalPrompt = window.prompt;
    window.prompt = vi.fn().mockReturnValue(null);

    // Temporarily clear env
    const envObj = import.meta.env as Record<string, any>;
    const savedToken = envObj.VITE_DEV_TOKEN;
    envObj.VITE_DEV_TOKEN = '';

    try {
      render(<App />);

      const devButton = await screen.findByRole('button', { name: /Quick Local Developer Sign-In/i });
      fireEvent.click(devButton);

      await waitFor(() => {
        expect(
          screen.getByText(/No development token found.*npm run dev:token/i)
        ).toBeInTheDocument();
      });

      expect(devButton).not.toBeDisabled();
    } finally {
      window.prompt = originalPrompt;
      envObj.VITE_DEV_TOKEN = savedToken;
    }
  });

  it('5. signs out and signs in again successfully leaving no stale state', async () => {
    render(<App />);

    const devButton = await screen.findByRole('button', { name: /Quick Local Developer Sign-In/i });
    fireEvent.click(devButton);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/app/focus');
    });

    expect(getAuthToken()).toBeTruthy();

    // Now sign out
    const userMenuButtons = await screen.findAllByRole('button', { expanded: false });
    fireEvent.click(userMenuButtons[0]);

    const signOutButton = await screen.findByRole('button', { name: /Sign Out/i });
    fireEvent.click(signOutButton);

    // Must be redirected to /login
    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });

    expect(getAuthToken()).toBeNull();

    // Now attempt developer sign-in again
    const devButtonAgain = await screen.findByRole('button', { name: /Quick Local Developer Sign-In/i });
    expect(devButtonAgain).toBeInTheDocument();
    expect(devButtonAgain).not.toBeDisabled();

    fireEvent.click(devButtonAgain);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/app/focus');
    });

    expect(getAuthToken()).toBeTruthy();
  });

  it('6. preserves token and displays actionable error on network failure during developer sign-in', async () => {
    // Spy on usersApi.getMe to simulate a network connection failure (ApiNetworkError / TypeError)
    const getMeSpy = vi.spyOn(usersApi, 'getMe').mockRejectedValueOnce(
      new ApiNetworkError('http://localhost:3000/api/v1/users/me', new TypeError('Failed to fetch resource'))
    );

    try {
      render(<App />);

      const devButton = await screen.findByRole('button', { name: /Quick Local Developer Sign-In/i });
      fireEvent.click(devButton);

      await waitFor(() => {
        expect(screen.getByText(/Network Error: Unable to connect to StudySync backend/i)).toBeInTheDocument();
      });

      // The token should NOT be wiped from storage on a network failure
      expect(getAuthToken()).toBeTruthy();
    } finally {
      getMeSpy.mockRestore();
    }
  });

  it('7. preserves stored token during recoverable backend outage on initAuth', async () => {
    const validToken = import.meta.env.VITE_DEV_TOKEN;
    if (validToken) {
      setAuthToken(validToken);
    }

    // Simulate backend network timeout/outage during initial mount
    const getMeSpy = vi.spyOn(usersApi, 'getMe').mockRejectedValueOnce(
      new ApiNetworkError('http://localhost:3000/api/v1/users/me', new TypeError('Connection refused'))
    );

    try {
      render(<App />);

      // Wait for initialization to complete
      await waitFor(() => {
        // Token must still be preserved in storage despite the transient network error
        expect(getAuthToken()).toBeTruthy();
      });
    } finally {
      getMeSpy.mockRestore();
    }
  });

  it('8. normalizes API_BASE_URL without trailing slashes and defaults to port 3000', () => {
    expect(API_BASE_URL).toMatch(/^http:\/\/localhost:3000\/api\/v1$/);
    expect(API_BASE_URL.endsWith('/')).toBe(false);
  });
});
