import React, { useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Zap, Sparkles, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { isAuthenticated, login, devLogin, isSupabaseMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/app/focus';

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevLogin = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setError(null);
    setIsLoading(true);
    try {
      await devLogin();
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Developer login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D11] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-amber-500/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#101319]/90 border border-white/10 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl relative z-10 flex flex-col gap-6">
        {/* Brand */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-black font-bold shadow-lg shadow-amber-500/25 mb-1">
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Welcome back</h1>
          <p className="text-xs text-zinc-400">Sign in to your StudySync focus workspace</p>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />

          <Button variant="primary" type="submit" isLoading={isLoading} className="mt-2 w-full h-11">
            Sign In
          </Button>
        </form>

        {/* Local Developer Quick Sign-In */}
        <div className="flex flex-col gap-3 pt-3 border-t border-white/5">
          <Button
            type="button"
            variant="glass"
            onClick={handleDevLogin}
            disabled={isLoading}
            isLoading={isLoading}
            className="w-full text-xs text-amber-300/90 hover:text-amber-300"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
            Quick Local Developer Sign-In
          </Button>
          {!isSupabaseMode && (
            <p className="text-[10px] text-zinc-500 text-center">
              Running with local backend dev authentication mode
            </p>
          )}
        </div>

        {isSupabaseMode && (
          <div className="text-center text-xs text-zinc-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-amber-400 hover:underline font-medium">
              Sign up
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
