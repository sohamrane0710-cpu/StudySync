import React, { useState } from 'react';
import { useAuth } from './auth-context';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Zap, AlertCircle } from 'lucide-react';

export const SignUpPage: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signUp(email, password, username);
      navigate('/app/focus', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D11] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-teal-500/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#101319]/90 border border-white/10 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl relative z-10 flex flex-col gap-6">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-black font-bold shadow-lg shadow-amber-500/25 mb-1">
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Create your account</h1>
          <p className="text-xs text-zinc-400">Join StudySync to master deep focus</p>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="soham_focus"
            required
            autoComplete="username"
          />

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
            minLength={6}
            autoComplete="new-password"
          />

          <Button variant="primary" type="submit" isLoading={isLoading} className="mt-2 w-full h-11">
            Sign Up
          </Button>
        </form>

        <div className="text-center text-xs text-zinc-400 pt-2 border-t border-white/5">
          Already have an account?{' '}
          <Link to="/login" className="text-amber-400 hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
