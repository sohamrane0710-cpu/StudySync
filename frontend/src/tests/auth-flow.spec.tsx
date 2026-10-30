import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';
import { getAuthToken, setAuthToken } from '../lib/api/client';
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
});
