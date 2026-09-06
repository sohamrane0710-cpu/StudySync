import { useState } from 'react';
import type { FormEvent } from 'react';
import { fetchApi } from '../api.js';
import { useAuth } from '../context/AuthContext.js';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();

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

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-slate-800">User Profile</h1>
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="flex items-center gap-2 px-3 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 sm:p-8 flex items-center gap-6 border-b border-slate-200">
          {user.avatarUrl ? (
            <img 
              src={user.avatarUrl} 
              alt="Avatar" 
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-sm flex-shrink-0"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-3xl font-bold border-4 border-white shadow-sm flex-shrink-0 uppercase">
              {(user.displayName || user.username || 'U').charAt(0)}
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {user.displayName || user.username}
            </h2>
            <p className="text-slate-500 mt-1">@{user.username}</p>
          </div>
        </div>

        <div className="p-6 sm:p-8 bg-slate-50">
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Avatar URL
                </label>
                <input 
                  type="url" 
                  placeholder="https://example.com/avatar.png" 
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name
                </label>
                <input 
                  type="text" 
                  placeholder="Display Name" 
                  value={displayName}
                  maxLength={50}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Username
                </label>
                <input 
                  type="text" 
                  placeholder="Username" 
                  value={username}
                  minLength={3}
                  maxLength={20}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Bio
                </label>
                <textarea 
                  placeholder="Tell us about yourself..." 
                  value={bio}
                  maxLength={500}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-shadow resize-y"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsEditing(false);
                    setError('');
                    setDisplayName(user.displayName || '');
                    setUsername(user.username || '');
                    setBio(user.bio || '');
                    setAvatarUrl(user.avatarUrl || '');
                  }} 
                  disabled={isSaving}
                  className="px-4 py-2 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">
                  Contact Information
                </h3>
                <div className="bg-white px-4 py-3 rounded-lg border border-slate-200 text-sm text-slate-800">
                  {user.email}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">
                  Bio
                </h3>
                <div className="bg-white px-4 py-3 rounded-lg border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap min-h-[4rem]">
                  {user.bio || 'No bio provided.'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
