import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Lock, Unlock, X, Loader2 } from 'lucide-react';
import { getStudyRooms, createStudyRoom, type StudyRoom } from '../api.js';

export function RoomsPage() {
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createVisibility, setCreateVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const navigate = useNavigate();

  const loadRooms = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStudyRooms();
      setRooms(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;

    try {
      setCreateLoading(true);
      setCreateError(null);
      const newRoom = await createStudyRoom({
        name: createName,
        description: createDescription,
        visibility: createVisibility,
      });
      setIsCreateModalOpen(false);
      setCreateName('');
      setCreateDescription('');
      setCreateVisibility('PUBLIC');
      navigate(`/rooms/${newRoom.id}`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create room');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Study Rooms</h1>
          <p className="text-slate-600 mt-1">Join an active session or create your own focus environment.</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap"
        >
          Create Room
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-600">No public study rooms available right now.</p>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-4 text-indigo-600 font-medium hover:underline"
          >
            Create the first one
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map(room => (
            <Link 
              key={room.id} 
              to={`/rooms/${room.id}`}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col cursor-pointer"
            >
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-slate-900 text-lg leading-tight line-clamp-2">
                    {room.name}
                  </h3>
                  <div className="flex-shrink-0 ml-2">
                    {room.visibility === 'PUBLIC' ? (
                      <Unlock className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>
                <p className="text-slate-600 text-sm line-clamp-2 mb-4">
                  {room.description || <span className="italic text-slate-400">No description provided.</span>}
                </p>
                {room.createdBy && (
                  <p className="text-xs text-slate-500">
                    Created by {room.createdBy.displayName || room.createdBy.username}
                  </p>
                )}
              </div>
              
              <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>{room._count?.roomMembers || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span>Active</span>
                  </div>
                </div>
                <span className="text-sm font-medium text-slate-900">
                  Join Room
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Room Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">Create Study Room</h2>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateRoom} className="p-6">
              {createError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                  {createError}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Room Name
                  </label>
                  <input
                    type="text"
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    required
                    maxLength={50}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    placeholder="e.g. Computer Science Grind"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={createDescription}
                    onChange={e => setCreateDescription(e.target.value)}
                    maxLength={200}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                    placeholder="What are we studying?"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Visibility
                  </label>
                  <select
                    value={createVisibility}
                    onChange={e => setCreateVisibility(e.target.value as 'PUBLIC' | 'PRIVATE')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  >
                    <option value="PUBLIC">Public - Anyone can join</option>
                    <option value="PRIVATE">Private - Invite only</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading || !createName.trim()}
                  className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
