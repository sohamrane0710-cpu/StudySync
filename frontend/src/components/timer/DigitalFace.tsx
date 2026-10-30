import React from 'react';
import { formatSecondsToMMSS } from '@/lib/utils/format';
import type { TimerDirection, TimerPhase } from '@/types/timer';
import { cn } from '@/lib/utils/cn';

interface DigitalFaceProps {
  displaySeconds: number;
  targetDuration: number;
  phase: TimerPhase;
  isRunning: boolean;
  direction?: TimerDirection;
  stepName?: string;
}

export const DigitalFace: React.FC<DigitalFaceProps> = ({
  displaySeconds,
  targetDuration,
  phase,
  isRunning,
  direction = 'COUNTDOWN',
  stepName,
}) => {
  const timeFormatted = formatSecondsToMMSS(displaySeconds);
  const [mins, secs] = timeFormatted.split(':');
  const isBreak = phase.includes('BREAK');
  const isCountUp = direction === 'COUNT_UP';

  const progressPercent = targetDuration > 0
    ? Math.round(
        Math.min(
          100,
          Math.max(
            0,
            isCountUp
              ? (displaySeconds / targetDuration) * 100
              : ((targetDuration - displaySeconds) / targetDuration) * 100,
          ),
        ),
      )
    : 0;

  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 select-none w-full max-w-lg">
      {/* Digit Display Card */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 bg-white/[0.03] border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden w-full">
        {/* Subtle accent border glow */}
        <div
          className={cn(
            'absolute inset-x-0 top-0 h-1 transition-all duration-500',
            isBreak ? 'bg-teal-500' : 'bg-amber-500'
          )}
          style={{ width: `${progressPercent}%` }}
        />

        {/* Minutes box */}
        <div className="flex-1 flex justify-center py-4 bg-black/40 rounded-2xl border border-white/5">
          <span className="text-6xl sm:text-7xl md:text-8xl font-bold font-mono text-zinc-100 tabular-nums">
            {mins}
          </span>
        </div>

        {/* Pulsing colon */}
        <span
          className={cn(
            'text-5xl sm:text-6xl font-bold text-zinc-500 font-mono transition-opacity duration-300',
            isRunning ? (isBreak ? 'animate-pulse text-teal-400' : 'animate-pulse text-amber-400') : 'opacity-60'
          )}
        >
          :
        </span>

        {/* Seconds box */}
        <div className="flex-1 flex justify-center py-4 bg-black/40 rounded-2xl border border-white/5">
          <span className="text-6xl sm:text-7xl md:text-8xl font-bold font-mono text-zinc-100 tabular-nums">
            {secs}
          </span>
        </div>
      </div>

      {/* Progress & phase indicator bar */}
      <div className="w-full flex items-center justify-between mt-4 px-2 text-xs text-zinc-400 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium tracking-wide uppercase">
            {stepName || phase.replace('_', ' ')}
          </span>
          {isCountUp && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
              COUNT UP
            </span>
          )}
        </div>
        <span className="font-mono">
          {isCountUp ? `${progressPercent}% of target` : `${progressPercent}% complete`}
        </span>
      </div>
    </div>
  );
};
