import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { setAuthToken, getAuthToken, setTokenProvider, ApiNetworkError } from '@/lib/api/client';
import { usersApi } from '@/lib/api/users';
import type { UserProfile } from '@/types/user';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  profile: UserProfile | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username?: string) => Promise<void>;
  devLogin: (token?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isSupabaseMode: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => getAuthToken());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const updateToken = useCallback((newToken: string | null) => {
    setAuthToken(newToken);
    setTokenState(newToken);
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setProfile(null);
      return;
    }

    try {
      const userProfile = await usersApi.getMe();
      setProfile(userProfile);
    } catch (err) {
      console.warn('[Auth] Failed to fetch user profile:', err);
      if (!(err instanceof ApiNetworkError)) {
        updateToken(null);
        setProfile(null);
      }
    }
  }, [updateToken]);

  // Wire API client token provider
  useEffect(() => {
    setTokenProvider(() => getAuthToken());
  }, []);

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      setIsLoading(true);

      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.access_token) {
            updateToken(data.session.access_token);
            try {
              const userProfile = await usersApi.getMe();
              if (isMounted) setProfile(userProfile);
            } catch {
              if (isMounted) updateToken(null);
            }
          }
        } catch {
          // Supabase session read error
        }
      } else {
        // Fallback or dev token mode
        const existingToken = getAuthToken();
        if (existingToken) {
          try {
            const userProfile = await usersApi.getMe();
            if (isMounted) setProfile(userProfile);
          } catch (err: unknown) {
            if (err instanceof ApiNetworkError) {
              // Network failure or temporary backend outage: preserve token
              console.warn('[Auth] Backend unreachable during initAuth; preserving auth token');
            } else {
              // Token was rejected or corrupted: clear it
              if (isMounted) {
                updateToken(null);
                setProfile(null);
              }
            }
          }
        }
      }

      if (isMounted) setIsLoading(false);
    }

    initAuth();

    // Listen to Supabase auth state changes if configured
    let subscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured && supabase) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.access_token) {
          updateToken(session.access_token);
          await refreshProfile();
        } else if (event === 'SIGNED_OUT') {
          updateToken(null);
          setProfile(null);
        }
      });
      subscription = data.subscription;
    }

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [updateToken, refreshProfile]);

  const login = async (email: string, password: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session?.access_token) {
        updateToken(data.session.access_token);
        await refreshProfile();
      }
    } else {
      // In dev mode without Supabase credentials, sign in using dev token
      await devLogin();
    }
  };

  const signUp = async (email: string, password: string, username?: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || email.split('@')[0],
          },
        },
      });
      if (error) throw error;
      if (data.session?.access_token) {
        updateToken(data.session.access_token);
        await refreshProfile();
      }
    } else {
      await devLogin();
    }
  };

  const devLogin = async (customToken?: string) => {
    let selectedToken =
      customToken?.trim() ||
      (import.meta.env.VITE_DEV_TOKEN as string | undefined)?.trim();

    if (!selectedToken) {
      if (typeof window !== 'undefined' && window.prompt) {
        const inputToken = window.prompt(
          'Enter StudySync Development Token (generate in backend/ using: npm run dev:token):'
        );
        if (inputToken?.trim()) {
          selectedToken = inputToken.trim();
        }
      }
    }

    if (!selectedToken) {
      throw new Error(
        'No development token found. Configure VITE_DEV_TOKEN in frontend/.env or generate one via "npm run dev:token" in backend/.'
      );
    }

    updateToken(selectedToken);
    try {
      const userProfile = await usersApi.getMe();
      setProfile(userProfile);
    } catch (err: unknown) {
      if (err instanceof ApiNetworkError) {
        // Network failure: preserve token, provide actionable feedback
        throw new Error(
          `Network Error: Unable to connect to StudySync backend at ${err.url}. Please verify that the backend server is running on http://localhost:3000.`
        );
      } else {
        // Token was rejected or another error occurred: clear state
        updateToken(null);
        setProfile(null);
        throw new Error(
          err instanceof Error ? err.message : 'Developer login failed due to an unexpected error.'
        );
      }
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    updateToken(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: Boolean(token && profile),
        isLoading,
        profile,
        token,
        login,
        signUp,
        devLogin,
        logout,
        refreshProfile,
        isSupabaseMode: isSupabaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
