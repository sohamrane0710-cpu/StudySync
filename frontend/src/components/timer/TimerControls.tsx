import React, { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Play, Pause, CheckCircle2, Square, RotateCcw, SkipForward, Check } from 'lucide-react';
import type { TimerPhase, TimerStepInfo } from '@/types/timer';

interface TimerControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  isIdle: boolean;
  isExpired?: boolean;
  isMutating: boolean;
  phase: TimerPhase;
  stepName?: string;
  nextStepPreview?: TimerStepInfo | null;
  isSequenceFinished?: boolean;
  onStart: () => void;
  onStartNext?: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onSkip?: () => void;
  onFinishSequence?: () => void;
  onCancel: () => void;
  onReset?: () => void;
}

export const TimerControls: React.FC<TimerControlsProps> = ({
  isRunning,
  isPaused,
  isIdle,
  isExpired = false,
  isMutating,
  phase,
  stepName,
  nextStepPreview,
  isSequenceFinished = false,
  onStart,
  onStartNext,
  onPause,
  onResume,
  onComplete,
  onSkip,
  onFinishSequence,
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
        if (isIdle) {
          if (nextStepPreview && onStartNext) onStartNext();
          else onStart();
        } else if (isRunning && !isExpired) onPause();
        else if (isPaused) onResume();
      } else if (e.key.toLowerCase() === 'c' && !isIdle) {
        e.preventDefault();
        onComplete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isIdle, isRunning, isPaused, isExpired, nextStepPreview, onStart, onStartNext, onPause, onResume, onComplete]);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {/* Next Step Choices when Idle and a Next Step is Pending */}
        {isIdle && nextStepPreview && !isSequenceFinished && (
          <div className="flex items-center gap-2.5 flex-wrap justify-center animate-fade-in">
            <Button
              size="lg"
              variant={nextStepPreview.stepType === 'REST' ? 'accent' : 'primary'}
              onClick={onStartNext || onStart}
              isLoading={isMutating}
              className="px-6 h-12 shadow-xl text-base tracking-wide font-semibold"
            >
              <Play className="w-5 h-5 fill-current mr-1.5" />
              <span>Start {nextStepPreview.stepName}</span>
            </Button>

            {onSkip && (
              <Button
                size="lg"
                variant="secondary"
                onClick={onSkip}
                disabled={isMutating}
                className="px-5 h-12 font-medium bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700/90"
                title="Skip this step"
              >
                <SkipForward className="w-4 h-4 mr-1.5 text-zinc-400" />
                <span>Skip</span>
              </Button>
            )}

            {onFinishSequence && (
              <Button
                size="lg"
                variant="ghost"
                onClick={onFinishSequence}
                disabled={isMutating}
                className="px-4 h-12 text-zinc-400 hover:text-zinc-200"
                title="Finish sequence"
              >
                <Check className="w-4 h-4 mr-1" />
                <span>Finish</span>
              </Button>
            )}

            {onReset && (
              <Button
                size="md"
                variant="ghost"
                onClick={onReset}
                disabled={isMutating}
                className="p-3 text-zinc-500 hover:text-zinc-300 rounded-xl"
                title="Reset timer"
                aria-label="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {/* Standard Idle Start Button (Initial Run or after Sequence Finished) */}
        {isIdle && (!nextStepPreview || isSequenceFinished) && (
          <>
            <Button
              size="lg"
              variant={isBreak ? 'accent' : 'primary'}
              onClick={onStart}
              isLoading={isMutating}
              className="w-48 sm:w-56 h-12 shadow-xl text-base tracking-wide font-semibold"
            >
              <Play className="w-5 h-5 fill-current mr-1" />
              <span>Start {stepName || (phase === 'FOCUS' ? 'Focus' : 'Break')}</span>
            </Button>

            {onReset && (
              <Button
                size="md"
                variant="ghost"
                onClick={onReset}
                disabled={isMutating}
                className="p-3 text-zinc-500 hover:text-zinc-300 rounded-xl"
                title="Reset timer"
                aria-label="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </>
        )}

        {/* Running State Controls */}
        {isRunning && (
          <>
            {!isExpired && (
              <Button
                size="lg"
                variant="secondary"
                onClick={onPause}
                isLoading={isMutating}
                className="px-6 h-12 font-medium bg-zinc-800/90 text-zinc-100"
              >
                <Pause className="w-5 h-5 mr-1" />
                <span>Pause</span>
              </Button>
            )}

            <Button
              size="lg"
              variant={isBreak ? 'accent' : 'primary'}
              onClick={onComplete}
              isLoading={isMutating}
              className="px-6 h-12 font-semibold"
            >
              <CheckCircle2 className="w-5 h-5 mr-1" />
              <span>{isExpired ? 'Record Completion' : 'Complete'}</span>
            </Button>

            <Button
              size="lg"
              variant="danger"
              onClick={onCancel}
              isLoading={isMutating}
              className="px-4 h-12"
              title="Cancel session"
              aria-label="Cancel session"
            >
              <Square className="w-4 h-4" />
            </Button>

            {onReset && (
              <Button
                size="md"
                variant="ghost"
                onClick={onReset}
                disabled={isMutating}
                className="p-3 text-zinc-500 hover:text-zinc-300 rounded-xl"
                title="Reset timer"
                aria-label="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </>
        )}

        {/* Paused State Controls */}
        {isPaused && (
          <>
            <Button
              size="lg"
              variant={isBreak ? 'accent' : 'primary'}
              onClick={onResume}
              isLoading={isMutating}
              className="w-36 sm:w-40 h-12 font-semibold"
            >
              <Play className="w-5 h-5 fill-current mr-1" />
              <span>Resume</span>
            </Button>

            <Button
              size="lg"
              variant="secondary"
              onClick={onComplete}
              isLoading={isMutating}
              className="px-5 h-12 font-medium text-zinc-200"
            >
              <CheckCircle2 className="w-5 h-5 mr-1" />
              <span>Complete</span>
            </Button>

            <Button
              size="lg"
              variant="danger"
              onClick={onCancel}
              isLoading={isMutating}
              className="px-4 h-12"
              title="Cancel session"
              aria-label="Cancel session"
            >
              <Square className="w-4 h-4" />
            </Button>

            {onReset && (
              <Button
                size="md"
                variant="ghost"
                onClick={onReset}
                disabled={isMutating}
                className="p-3 text-zinc-500 hover:text-zinc-300 rounded-xl"
                title="Reset timer"
                aria-label="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </>
        )}
      </div>

      {/* Keyboard Shortcut Hints */}
      <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">Space</kbd>{' '}
          {isIdle ? 'start' : isRunning && !isExpired ? 'pause' : isPaused ? 'resume' : 'action'}
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
