import React from 'react';
import { formatSecondsToMMSS } from '@/lib/utils/format';
import type { TimerPhase } from '@/types/timer';
import { cn } from '@/lib/utils/cn';

interface FlipFaceProps {
  displaySeconds: number;
  phase: TimerPhase;
  isRunning: boolean;
}

const FlipDigitCard: React.FC<{ digit: string }> = React.memo(({ digit }) => {
  return (
    <div className="relative flex flex-col items-center justify-center w-14 sm:w-18 md:w-22 h-20 sm:h-26 md:h-32 bg-[#12151A] rounded-xl sm:rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
      {/* Top Half */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-white/[0.02] border-b border-black/40 flex items-end justify-center overflow-hidden">
        <span className="text-4xl sm:text-6xl md:text-7xl font-bold font-mono text-zinc-100 translate-y-1/2">
          {digit}
        </span>
      </div>

      {/* Split Divider line */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-px h-0.5 bg-black/80 z-10 shadow-sm" />

      {/* Bottom Half */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-black/30 flex items-start justify-center overflow-hidden">
        <span className="text-4xl sm:text-6xl md:text-7xl font-bold font-mono text-zinc-300 -translate-y-1/2">
          {digit}
        </span>
      </div>
    </div>
  );
});

FlipDigitCard.displayName = 'FlipDigitCard';

export const FlipFace: React.FC<FlipFaceProps> = ({ displaySeconds, phase, isRunning }) => {
  const timeFormatted = formatSecondsToMMSS(displaySeconds);
  const [minStr, secStr] = timeFormatted.split(':');
  const m1 = minStr[0] || '0';
  const m2 = minStr[1] || '0';
  const s1 = secStr[0] || '0';
  const s2 = secStr[1] || '0';

  const isBreak = phase.includes('BREAK');

  return (
    <div className="flex flex-col items-center justify-center p-6 select-none">
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
        {/* Minutes */}
        <FlipDigitCard digit={m1} />
        <FlipDigitCard digit={m2} />

        {/* Separator dots */}
        <div className="flex flex-col gap-2.5 px-1 sm:px-2">
          <div
            className={cn(
              'w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-colors',
              isRunning ? (isBreak ? 'bg-teal-400' : 'bg-amber-400') : 'bg-zinc-600'
            )}
          />
          <div
            className={cn(
              'w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-colors',
              isRunning ? (isBreak ? 'bg-teal-400' : 'bg-amber-400') : 'bg-zinc-600'
            )}
          />
        </div>

        {/* Seconds */}
        <FlipDigitCard digit={s1} />
        <FlipDigitCard digit={s2} />
      </div>

      <div className="mt-5">
        <span
          className={cn(
            'text-xs uppercase tracking-widest font-semibold px-3 py-1 rounded-full border',
            isBreak
              ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
          )}
        >
          {phase.replace('_', ' ')}
        </span>
      </div>
    </div>
  );
};
