import React, { useEffect } from 'react';
import { useTimer } from '../../context/TimerContext';

export const ControlIsland: React.FC = () => {
  const {
    snapshot,
    start,
    pause,
    resume,
    skipStep,
    resetInterval,
    restartSequence,
    stopAndSave,
  } = useTimer();

  const isRunning = snapshot.state === 'running';
  const isPaused = snapshot.state === 'paused';
  const isIdle = snapshot.state === 'idle';
  const isCompleted = snapshot.state === 'completed' || snapshot.state === 'stopped';

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Exclude typing inside input, textarea, select, or contenteditable elements
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Ignore if modifier keys are held
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault(); // Prevent page scroll
        if (isRunning) {
          pause();
        } else if (isPaused) {
          resume();
        } else {
          start();
        }
      } else if (e.code === 'KeyN') {
        if (isRunning || isPaused) {
          e.preventDefault();
          skipStep();
        }
      } else if (e.code === 'KeyR') {
        if (isRunning || isPaused) {
          e.preventDefault();
          resetInterval();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, isPaused, isIdle, isCompleted, start, pause, resume, skipStep, resetInterval]);

  const handlePrimaryClick = () => {
    if (isRunning) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      start();
    }
  };

  const primaryLabel = isRunning ? 'Pause timer' : isPaused ? 'Resume timer' : 'Start timer';

  return (
    <div
      role="region"
      aria-label="Timer controls"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        margin: '0 auto',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        {/* Restart entire sequence button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            aria-label="Restart entire sequence"
            onClick={restartSequence}
            disabled={isIdle}
            title="Restart entire sequence"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              color: isIdle ? 'var(--color-text-faint)' : 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isIdle ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Restart</span>
        </div>

        {/* Reset current interval button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            aria-label="Reset current interval"
            onClick={resetInterval}
            disabled={isIdle || isCompleted}
            title="Reset current interval (R)"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              color: isIdle || isCompleted ? 'var(--color-text-faint)' : 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isIdle || isCompleted ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
            Reset [R]
          </span>
        </div>

        {/* Primary Play/Pause Button (Elevated L3 button, 52px diameter) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            aria-label={primaryLabel}
            onClick={handlePrimaryClick}
            className="glass-l3"
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff',
              boxShadow: isRunning
                ? '0 0 24px var(--color-focus-glow), inset 0 0 12px rgba(255,255,255,0.15)'
                : '0 8px 24px rgba(0,0,0,0.4)',
              border: isRunning ? '1px solid var(--color-focus)' : '1px solid rgba(255,255,255,0.15)',
              background: isRunning
                ? 'linear-gradient(135deg, rgba(0, 210, 255, 0.15) 0%, rgba(255,255,255,0.05) 100%)'
                : 'rgba(255, 255, 255, 0.08)',
              transition: 'all var(--transition-normal)',
            }}
          >
            {isRunning ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
            Space
          </span>
        </div>

        {/* Skip to Next Step button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            aria-label="Skip to next step"
            onClick={skipStep}
            disabled={isIdle || isCompleted}
            title="Skip step (N)"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              color: isIdle || isCompleted ? 'var(--color-text-faint)' : 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isIdle || isCompleted ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
            Skip [N]
          </span>
        </div>

        {/* Stop and Save current session button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            aria-label="Stop and save session"
            onClick={stopAndSave}
            disabled={isIdle || isCompleted}
            title="Stop and save session"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              color: isIdle || isCompleted ? 'var(--color-text-faint)' : 'var(--color-alert)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isIdle || isCompleted ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Stop</span>
        </div>
      </div>
    </div>
  );
};
