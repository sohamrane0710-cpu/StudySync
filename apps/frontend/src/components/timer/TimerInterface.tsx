import { useState, useEffect } from 'react';
import { startTimerSession, pauseTimerSession, completeTimerSession, nextStageTimerSession, getActiveTimerSession } from '../../api.js';
import type { TimerSession, TimerCategory } from '../../api.js';

interface TimerInterfaceProps {
  session: TimerSession;
  categories: TimerCategory[];
  onSessionUpdated: (session: TimerSession | null) => void;
}

export function TimerInterface({ session, categories, onSessionUpdated }: TimerInterfaceProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stage = session.timerMode?.stagesConfig[session.currentStageIndex % session.timerMode.stagesConfig.length];
  const currentCategory = categories.find(c => c.id === stage?.categoryId);
  
  // Calculate remaining seconds authoritatively from the backend state
  const calculateRemaining = () => {
    if (!stage) return 0;
    
    if (session.status === 'PENDING') {
      return stage.durationSeconds;
    }
    
    if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
      return 0;
    }
    
    if (session.status === 'PAUSED' && session.pausedAt && session.targetEndTime) {
      const remainingMs = new Date(session.targetEndTime).getTime() - new Date(session.pausedAt).getTime();
      return Math.max(0, Math.round(remainingMs / 1000));
    }
    
    if (session.status === 'RUNNING' && session.targetEndTime) {
      const remainingMs = new Date(session.targetEndTime).getTime() - Date.now();
      return Math.max(0, Math.round(remainingMs / 1000));
    }
    
    return 0;
  };

  const isWaiting = session.status === 'RUNNING' && session.targetEndTime && new Date(session.targetEndTime).getTime() <= Date.now() && stage?.autoAdvance === false;
  
  const handleSyncState = async () => {
    if (isCompleting) return;
    try {
      setIsCompleting(true);
      setError(null);
      const updated = await getActiveTimerSession();
      if (updated) {
        onSessionUpdated({ ...updated, timerMode: session.timerMode });
      } else {
        onSessionUpdated(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sync timer state');
    } finally {
      setIsCompleting(false);
    }
  };

  useEffect(() => {
    // Initial calculation on mount/update
    setRemainingSeconds(calculateRemaining());

    let intervalId: number;

    if (session.status === 'RUNNING') {
      intervalId = window.setInterval(() => {
        const remaining = calculateRemaining();
        setRemainingSeconds(remaining);
        
        // Automatically sync state when we hit 0, unless we are already known to be in a waiting state
        if (remaining <= 0 && !isCompleting && !isWaiting) {
          handleSyncState();
        }
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [session, isCompleting]);

  const handleStartResume = async () => {
    try {
      setError(null);
      const updated = await startTimerSession(session.id);
      onSessionUpdated({ ...updated, timerMode: session.timerMode });
    } catch (err: any) {
      setError(err.message || 'Failed to start timer');
    }
  };

  const handlePause = async () => {
    try {
      setError(null);
      const updated = await pauseTimerSession(session.id);
      onSessionUpdated({ ...updated, timerMode: session.timerMode });
    } catch (err: any) {
      setError(err.message || 'Failed to pause timer');
    }
  };

  const handleComplete = async () => {
    if (isCompleting) return;
    try {
      setIsCompleting(true);
      setError(null);
      const updated = await completeTimerSession(session.id);
      onSessionUpdated({ ...updated, timerMode: session.timerMode });
    } catch (err: any) {
      setError(err.message || 'Failed to complete timer');
      setIsCompleting(false);
    }
  };

  const handleNextStage = async () => {
    if (isCompleting) return;
    try {
      setIsCompleting(true);
      setError(null);
      const updated = await nextStageTimerSession(session.id);
      onSessionUpdated({ ...updated, timerMode: session.timerMode });
    } catch (err: any) {
      setError(err.message || 'Failed to advance to next stage');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleClear = () => {
    onSessionUpdated(null);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!stage) return <div>Invalid Timer Configuration</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center max-w-md mx-auto mt-8">
      <div className="text-sm font-semibold text-slate-500 tracking-widest uppercase mb-2">
        {session.timerMode?.name || 'Timer'}
      </div>
      
      <div className="text-xl font-medium text-slate-800 mb-8">
        Stage: {currentCategory ? currentCategory.name : 'Unknown Category'}
      </div>

      <div className={`text-7xl font-light tabular-nums mb-8 ${session.status === 'PAUSED' ? 'text-slate-400' : 'text-slate-900'}`}>
        {formatTime(remainingSeconds)}
      </div>

      {isWaiting && (
        <div className="text-amber-600 font-medium bg-amber-50 px-4 py-2 rounded-lg mb-8 border border-amber-200">
          Waiting to start next stage...
        </div>
      )}

      {error && <div className="text-red-500 text-sm mb-4 bg-red-50 px-4 py-2 rounded">{error}</div>}

      <div className="flex gap-4">
        {session.status === 'PENDING' && (
          <button 
            onClick={handleStartResume}
            className="px-8 py-3 bg-slate-900 text-white rounded-full font-medium hover:bg-slate-800 transition-colors"
          >
            Start
          </button>
        )}
        
        {session.status === 'RUNNING' && !isWaiting && (
          <>
            <button 
              onClick={handlePause}
              className="px-8 py-3 bg-slate-200 text-slate-800 rounded-full font-medium hover:bg-slate-300 transition-colors"
            >
              Pause
            </button>
            <button 
              onClick={handleComplete}
              disabled={isCompleting}
              className="px-8 py-3 bg-emerald-500 text-white rounded-full font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              Complete
            </button>
          </>
        )}

        {session.status === 'RUNNING' && isWaiting && (
          <button 
            onClick={handleNextStage}
            disabled={isCompleting}
            className="px-8 py-3 bg-slate-900 text-white rounded-full font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Start Next Stage
          </button>
        )}

        {session.status === 'PAUSED' && (
          <>
            <button 
              onClick={handleStartResume}
              className="px-8 py-3 bg-slate-900 text-white rounded-full font-medium hover:bg-slate-800 transition-colors"
            >
              Resume
            </button>
            <button 
              onClick={handleComplete}
              disabled={isCompleting}
              className="px-8 py-3 bg-emerald-500 text-white rounded-full font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              Complete
            </button>
          </>
        )}

        {session.status === 'COMPLETED' && (
          <button 
            onClick={handleClear}
            className="px-8 py-3 bg-slate-900 text-white rounded-full font-medium hover:bg-slate-800 transition-colors"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
