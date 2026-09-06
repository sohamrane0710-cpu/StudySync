import { useState } from 'react';
import type { FormEvent } from 'react';
import { fetchApi } from '../api.js';
import { useAuth } from '../context/AuthContext.js';
import { Link, useNavigate } from 'react-router-dom';

export function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      await refreshUser();
      // Routing logic handled by app-level guards, but we can navigate to trigger it
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Login</h2>
      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px', gap: '1rem' }}>
        <input 
          type="text" 
          placeholder="Username or Email" 
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        Don't have an account? <Link to="/register">Register here</Link>.
      </p>
    </div>
  );
}
