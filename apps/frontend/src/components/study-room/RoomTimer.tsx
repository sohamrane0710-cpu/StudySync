import { Play, Pause, RotateCcw } from 'lucide-react';

export function RoomTimer() {
  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center min-h-[400px]">
      <div className="text-center mb-12">
        <span className="inline-block px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-sm font-medium tracking-wide mb-6">
          FOCUS SESSION
        </span>
        <div className="text-8xl font-black text-slate-900 tracking-tighter tabular-nums">
          45:00
        </div>
        <p className="text-slate-500 mt-4 text-lg">Next break in 45 minutes</p>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-4 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shadow-sm" title="Reset Timer">
          <RotateCcw className="w-6 h-6" />
        </button>
        <button className="flex items-center gap-3 px-10 py-5 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20">
          <Play className="w-6 h-6 fill-current" />
          <span className="text-xl font-bold tracking-wide">Start Session</span>
        </button>
        <button className="p-4 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shadow-sm" title="Pause Timer">
          <Pause className="w-6 h-6 fill-current" />
        </button>
      </div>
    </div>
  );
}
