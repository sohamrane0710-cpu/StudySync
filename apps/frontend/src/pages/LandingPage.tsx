
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Welcome to StudySync</h1>
      <p>Your ultimate study companion.</p>
      
      {!user ? (
        <div>
          <Link to="/login" style={{ marginRight: '1rem' }}>Login</Link>
          <Link to="/register">Register</Link>
        </div>
      ) : (
        <div>
          <Link to="/dashboard">Go to Dashboard</Link>
        </div>
      )}
    </div>
  );
}
