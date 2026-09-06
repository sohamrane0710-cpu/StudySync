import { Link } from 'react-router-dom';
import { ArrowLeft, Users, LogOut } from 'lucide-react';

interface RoomHeaderProps {
  roomName: string;
  description: string;
  memberCount: number;
}

export function RoomHeader({ roomName, description, memberCount }: RoomHeaderProps) {
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
          <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 self-end md:self-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-sm font-medium text-slate-700">
          <Users className="w-4 h-4 text-slate-400" />
          {memberCount}
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
          <LogOut className="w-4 h-4" />
          Leave
        </button>
      </div>
    </div>
  );
}
