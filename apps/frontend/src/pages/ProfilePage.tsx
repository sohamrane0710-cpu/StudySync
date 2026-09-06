import { useState } from 'react';
import type { FormEvent } from 'react';
import { fetchApi } from '../api.js';
import { useAuth } from '../context/AuthContext.js';
import { useNavigate } from 'react-router-dom';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);
    
    try {
      await fetchApi('/users/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName,
          username,
          bio,
          avatarUrl,
        }),
      });
      await refreshUser();
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
      await refreshUser();
      navigate('/');
    } catch (err: any) {
      console.error('Logout failed', err);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>User Profile</h2>
        <div>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} style={{ marginRight: '1rem' }}>
              Edit Profile
            </button>
          )}
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>
      
      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <img 
          src={user.avatarUrl || 'https://via.placeholder.com/100?text=Avatar'} 
          alt="Avatar" 
          style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }}
        />
        <div>
          <h3 style={{ margin: 0 }}>{user.displayName || user.username}</h3>
          <p style={{ margin: '0.5rem 0', color: '#666' }}>@{user.username}</p>
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Avatar URL</label>
            <input 
              type="url" 
              placeholder="https://example.com/avatar.png" 
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Display Name</label>
            <input 
              type="text" 
              placeholder="Display Name" 
              value={displayName}
              maxLength={50}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Username</label>
            <input 
              type="text" 
              placeholder="Username" 
              value={username}
              minLength={3}
              maxLength={20}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Bio</label>
            <textarea 
              placeholder="Tell us about yourself..." 
              value={bio}
              maxLength={500}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
            <button 
              type="button" 
              onClick={() => {
                setIsEditing(false);
                setError('');
                // reset form fields
                setDisplayName(user.displayName || '');
                setUsername(user.username || '');
                setBio(user.bio || '');
                setAvatarUrl(user.avatarUrl || '');
              }} 
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <strong>Email:</strong> 
            <div style={{ marginTop: '0.5rem' }}>{user.email}</div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <strong>Bio:</strong>
            <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
              {user.bio || 'No bio provided.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
