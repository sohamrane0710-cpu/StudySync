
import { useAuth } from '../context/AuthContext.js';
import { fetchApi } from '../api.js';
import { useNavigate } from 'react-router-dom';

export function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
      await refreshUser();
      navigate('/login');
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Dashboard</h2>
      <p>Welcome, {user?.username}!</p>
      
      <button onClick={handleLogout} style={{ marginTop: '2rem' }}>
        Logout
      </button>
    </div>
  );
}
