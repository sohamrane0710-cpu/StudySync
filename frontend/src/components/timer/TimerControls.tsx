import React, { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Play, Pause, CheckCircle2, Square, RotateCcw } from 'lucide-react';
import type { TimerPhase } from '@/types/timer';

interface TimerControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  isIdle: boolean;
  isMutating: boolean;
  phase: TimerPhase;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onReset?: () => void;
}

export const TimerControls: React.FC<TimerControlsProps> = ({
  isRunning,
  isPaused,
  isIdle,
  isMutating,
  phase,
  onStart,
  onPause,
  onResume,
  onComplete,
  onCancel,
  onReset,
}) => {
  const isBreak = phase.includes('BREAK');

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (isIdle) onStart();
        else if (isRunning) onPause();
        else if (isPaused) onResume();
      } else if (e.key.toLowerCase() === 'c' && !isIdle) {
        e.preventDefault();
        onComplete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isIdle, isRunning, isPaused, onStart, onPause, onResume, onComplete]);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div className="flex items-center gap-3">
        {/* Main Action Button */}
        {isIdle && (
          <Button
            size="lg"
            variant={isBreak ? 'accent' : 'primary'}
            onClick={onStart}
            isLoading={isMutating}
            className="w-48 sm:w-56 h-13 shadow-xl text-base tracking-wide font-semibold"
          >
            <Play className="w-5 h-5 fill-current mr-1" />
            <span>Start {phase === 'FOCUS' ? 'Focus' : 'Break'}</span>
          </Button>
        )}

        {isRunning && (
          <>
            <Button
              size="lg"
              variant="secondary"
              onClick={onPause}
              isLoading={isMutating}
              className="px-6 h-13 font-medium bg-zinc-800/90 text-zinc-100"
            >
              <Pause className="w-5 h-5 mr-1" />
              <span>Pause</span>
            </Button>

            <Button
              size="lg"
              variant={isBreak ? 'accent' : 'primary'}
              onClick={onComplete}
              isLoading={isMutating}
              className="px-6 h-13 font-semibold"
            >
              <CheckCircle2 className="w-5 h-5 mr-1" />
              <span>Complete</span>
            </Button>

            <Button
              size="lg"
              variant="danger"
              onClick={onCancel}
              isLoading={isMutating}
              className="px-4 h-13"
              title="Cancel session"
            >
              <Square className="w-4 h-4" />
            </Button>
          </>
        )}

        {isPaused && (
          <>
            <Button
              size="lg"
              variant={isBreak ? 'accent' : 'primary'}
              onClick={onResume}
              isLoading={isMutating}
              className="w-40 h-13 font-semibold"
            >
              <Play className="w-5 h-5 fill-current mr-1" />
              <span>Resume</span>
            </Button>

            <Button
              size="lg"
              variant="secondary"
              onClick={onComplete}
              isLoading={isMutating}
              className="px-5 h-13 font-medium text-zinc-200"
            >
              <CheckCircle2 className="w-5 h-5 mr-1" />
              <span>Complete</span>
            </Button>

            <Button
              size="lg"
              variant="danger"
              onClick={onCancel}
              isLoading={isMutating}
              className="px-4 h-13"
              title="Cancel session"
            >
              <Square className="w-4 h-4" />
            </Button>
          </>
        )}

        {isIdle && onReset && (
          <Button
            size="md"
            variant="ghost"
            onClick={onReset}
            className="p-3 text-zinc-500 hover:text-zinc-300 rounded-xl"
            title="Reset timer"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Keyboard Shortcut Hints */}
      <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">Space</kbd>{' '}
          {isIdle ? 'start' : isRunning ? 'pause' : 'resume'}
        </span>
        {!isIdle && (
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">C</kbd>{' '}
            complete
          </span>
        )}
      </div>
    </div>
  );
};
