import { Link } from 'react-router-dom';
import { ArrowLeft, Users, LogOut, LogIn, Loader2, Shield } from 'lucide-react';

interface RoomHeaderProps {
  roomName: string;
  description: string;
  memberCount: number;
  onJoin?: () => void;
  onLeave?: () => void;
  isJoining?: boolean;
  isLeaving?: boolean;
  currentUserMembership?: { role: 'OWNER' | 'MEMBER' } | null;
}

export function RoomHeader({ 
  roomName, 
  description, 
  memberCount, 
  onJoin, 
  onLeave,
  isJoining,
  isLeaving,
  currentUserMembership
}: RoomHeaderProps) {
  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-4">
        <Link 
          to="/rooms" 
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
          title="Back to Rooms"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            {roomName}
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              Live
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">
            {description || <span className="italic text-slate-400">No description provided.</span>}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 self-end md:self-auto">
        <div className="flex items-center gap-2 justify-end">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-sm font-medium text-slate-700">
            <Users className="w-4 h-4 text-slate-400" />
            {memberCount}
          </div>
          
          {currentUserMembership?.role === 'OWNER' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-sm font-medium">
              <Shield className="w-4 h-4" />
              Owner
            </div>
          )}

          {currentUserMembership?.role === 'MEMBER' && (
            <button 
              onClick={onLeave}
              disabled={isLeaving}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm disabled:opacity-50"
            >
              {isLeaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              Leave
            </button>
          )}

          {currentUserMembership === null && (
            <button 
              onClick={onJoin}
              disabled={isJoining}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
            >
              {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              Join
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
