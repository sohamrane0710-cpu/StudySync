import React from 'react';
import { formatSecondsToMMSS } from '@/lib/utils/format';
import type { TimerPhase } from '@/types/timer';
import { cn } from '@/lib/utils/cn';

interface RingFaceProps {
  displaySeconds: number;
  targetDuration: number;
  phase: TimerPhase;
  isRunning: boolean;
  cycleCount?: number;
}

export const RingFace: React.FC<RingFaceProps> = ({
  displaySeconds,
  targetDuration,
  phase,
  isRunning,
  cycleCount = 0,
}) => {
  const radius = 135;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;

  // Safe progress ratio 0.0 to 1.0 (clamped)
  const progress = targetDuration > 0
    ? Math.min(1, Math.max(0, (targetDuration - displaySeconds) / targetDuration))
    : 0;

  const strokeDashoffset = circumference - progress * circumference;

  const isBreak = phase.includes('BREAK');
  const accentColor = isBreak ? '#14B8A6' : '#F59E0B'; // teal or amber

  return (
    <div className="relative flex items-center justify-center w-72 h-72 sm:w-84 sm:h-84 md:w-96 md:h-96 select-none">
      <svg
        className="w-full h-full -rotate-90 transform drop-shadow-2xl"
        viewBox="0 0 320 320"
        aria-hidden="true"
      >
        {/* Background track circle */}
        <circle
          cx="160"
          cy="160"
          r={radius}
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={stroke}
          fill="none"
        />

        {/* Dynamic animated progress circle */}
        <circle
          cx="160"
          cy="160"
          r={radius}
          stroke={accentColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300 ease-linear"
          style={{
            filter: isRunning
              ? `drop-shadow(0 0 12px ${accentColor}60)`
              : 'none',
          }}
        />
      </svg>

      {/* Center Typography & Info */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
        <span
          className={cn(
            'text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white tabular-nums font-mono drop-shadow-md',
            displaySeconds <= 0 && 'animate-pulse text-red-400'
          )}
        >
          {formatSecondsToMMSS(displaySeconds)}
        </span>

        <div className="flex items-center gap-2 mt-3">
          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider uppercase border',
              isBreak
                ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            )}
          >
            {phase.replace('_', ' ')}
          </span>

          {cycleCount > 0 && (
            <span className="text-xs text-zinc-500 font-medium">
              Cycle #{cycleCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
