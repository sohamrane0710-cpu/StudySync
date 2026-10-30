import React from 'react';
import { formatSecondsToMMSS } from '@/lib/utils/format';
import type { TimerDirection, TimerPhase } from '@/types/timer';
import { cn } from '@/lib/utils/cn';

interface MinimalFaceProps {
  displaySeconds: number;
  phase: TimerPhase;
  isRunning: boolean;
  direction?: TimerDirection;
  stepName?: string;
}

export const MinimalFace: React.FC<MinimalFaceProps> = ({
  displaySeconds,
  phase,
  isRunning,
  direction = 'COUNTDOWN',
  stepName,
}) => {
  const isBreak = phase.includes('BREAK');
  const isCountUp = direction === 'COUNT_UP';

  return (
    <div className="flex flex-col items-center justify-center p-8 select-none">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'w-2 h-2 rounded-full transition-all duration-700',
            isRunning ? (isBreak ? 'bg-teal-400 animate-ping' : 'bg-amber-400 animate-ping') : 'bg-zinc-600'
          )}
        />
        <span className="text-xs uppercase tracking-widest text-zinc-400 font-medium">
          {stepName || phase.replace('_', ' ')}
        </span>
        {isCountUp && (
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-500">
            Count Up
          </span>
        )}
      </div>

      <div className="my-6">
        <span className="text-7xl sm:text-8xl md:text-9xl font-light tracking-tighter text-white font-mono tabular-nums">
          {formatSecondsToMMSS(displaySeconds)}
        </span>
      </div>
    </div>
  );
};
