import { useState, useEffect } from 'react';
import { getActiveTimerSession, getTimerModes, createTimerSession } from '../api.js';
import type { TimerSession, TimerMode } from '../api.js';
import { TimerInterface } from '../components/timer/TimerInterface.js';
import { Play } from 'lucide-react';

export function TimerPage() {
  const [activeSession, setActiveSession] = useState<TimerSession | null>(null);
  const [modes, setModes] = useState<TimerMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInitialState();
  }, []);

  const loadInitialState = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const session = await getActiveTimerSession();
      if (session) {
        setActiveSession(session);
      } else {
        const availableModes = await getTimerModes();
        setModes(availableModes);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load timer state');
    } finally {
      setLoading(false);
    }
  };

  const handleModeSelect = async (modeId: string) => {
    try {
      setLoading(true);
      setError(null);
      const newSession = await createTimerSession(modeId);
      
      // The API doesn't include timerMode in create response, so we find it from loaded modes
      const mode = modes.find(m => m.id === modeId);
      setActiveSession({ ...newSession, timerMode: mode });
    } catch (err: any) {
      setError(err.message || 'Failed to create timer session');
      setLoading(false);
    }
  };

  const handleSessionUpdated = (session: TimerSession | null) => {
    if (!session || session.status === 'COMPLETED' || session.status === 'CANCELLED') {
      // Completed or cleared, go back to mode selection
      setActiveSession(null);
      loadInitialState();
    } else {
      setActiveSession(session);
    }
  };

  if (loading && !activeSession) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <div className="text-slate-500 font-medium">Loading timer...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Personal Timer</h1>
        <p className="text-slate-500 mt-1">Focus on your studies with customizable timer modes.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-8 border border-red-100">
          {error}
        </div>
      )}

      {activeSession ? (
        <TimerInterface 
          session={activeSession} 
          onSessionUpdated={handleSessionUpdated} 
        />
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Select a Timer Mode</h2>
          
          {modes.length === 0 ? (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              No timer modes available. (Create one via API to get started!)
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modes.map(mode => (
                <div 
                  key={mode.id} 
                  className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-slate-800">{mode.name}</h3>
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-md font-medium">
                      {mode.stagesConfig.length} Stages
                    </span>
                  </div>
                  {mode.description && (
                    <p className="text-sm text-slate-500 mb-6">{mode.description}</p>
                  )}
                  
                  <div className="mt-auto pt-4 flex justify-end">
                    <button
                      onClick={() => handleModeSelect(mode.id)}
                      className="flex items-center gap-2 text-sm font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors"
                    >
                      <Play className="w-4 h-4" /> Start Timer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
