import { Link } from 'react-router-dom';
import { Users, Lock, Unlock } from 'lucide-react';

const MOCK_ROOMS = [
  {
    id: 'room-1',
    name: 'Deep Work: Computer Science',
    description: 'Silent focus room for CS students. Pomodoro 50/10.',
    memberCount: 12,
    isPublic: true,
    active: true,
  },
  {
    id: 'room-2',
    name: 'Medical Boards Prep',
    description: 'Studying for USMLE Step 1. Ambient lofi.',
    memberCount: 8,
    isPublic: true,
    active: true,
  },
  {
    id: 'room-3',
    name: 'StudySync Dev Team',
    description: 'Private team room for shipping features.',
    memberCount: 3,
    isPublic: false,
    active: false,
  },
  {
    id: 'room-4',
    name: 'Midnight Grind',
    description: 'Late night study session. Everyone welcome.',
    memberCount: 25,
    isPublic: true,
    active: true,
  }
];

export function RoomsPage() {
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Study Rooms</h1>
          <p className="text-slate-600 mt-1">Join an active session or create your own focus environment.</p>
        </div>
        <button className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap">
          Create Room
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_ROOMS.map(room => (
          <div key={room.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-slate-900 text-lg leading-tight line-clamp-2">
                  {room.name}
                </h3>
                <div className="flex-shrink-0 ml-2">
                  {room.isPublic ? (
                    <Unlock className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>
              <p className="text-slate-600 text-sm line-clamp-2 mb-4">
                {room.description}
              </p>
            </div>
            
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>{room.memberCount}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${room.active ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                  <span>{room.active ? 'Active' : 'Offline'}</span>
                </div>
              </div>
              <Link
                to={`/rooms/${room.id}`}
                className="text-sm font-medium text-slate-900 hover:text-slate-700 hover:underline"
              >
                Join Room
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
