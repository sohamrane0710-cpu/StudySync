import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { fetchApi } from '../api.js';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export function OnboardingPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const checkUsername = async () => {
      if (username.length < 3) {
        setIsAvailable(null);
        setError('');
        return;
      }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        setIsAvailable(null);
        setError('Username can only contain letters, numbers, and underscores (3-20 chars).');
        return;
      }

      setError('');
      setIsChecking(true);
      try {
        const data = await fetchApi(`/users/check-username?username=${encodeURIComponent(username)}`);
        setIsAvailable(data.available);
      } catch (err: any) {
        setError(err.message || 'Error checking username');
      } finally {
        setIsChecking(false);
      }
    };

    const timer = setTimeout(checkUsername, 500);
    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAvailable) return;
    
    try {
      await fetchApi('/users/onboarding', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      await refreshUser();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Onboarding failed');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Complete Your Profile</h2>
      <p>Choose a unique username to get started.</p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px', gap: '1rem' }}>
        <div>
          <input 
            type="text" 
            placeholder="Username" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            maxLength={20}
          />
          {isChecking && <span> Checking...</span>}
          {!isChecking && isAvailable === true && <span style={{ color: 'green' }}> Available!</span>}
          {!isChecking && isAvailable === false && <span style={{ color: 'red' }}> Taken</span>}
        </div>
        {error && <div style={{ color: 'red' }}>{error}</div>}
        <button type="submit" disabled={!isAvailable || isChecking}>
          Complete Onboarding
        </button>
      </form>
    </div>
  );
}
