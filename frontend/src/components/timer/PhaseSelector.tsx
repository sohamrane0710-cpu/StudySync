import React from 'react';
import type { TimerPhase } from '@/types/timer';
import { cn } from '@/lib/utils/cn';

interface PhaseSelectorProps {
  currentPhase: TimerPhase;
  isIdle: boolean;
  onSelectPhase: (phase: TimerPhase) => void;
}

export const PhaseSelector: React.FC<PhaseSelectorProps> = ({
  currentPhase,
  isIdle,
  onSelectPhase,
}) => {
  const phases: { id: TimerPhase; label: string }[] = [
    { id: 'FOCUS', label: 'Focus' },
    { id: 'SHORT_BREAK', label: 'Short Break' },
    { id: 'LONG_BREAK', label: 'Long Break' },
  ];

  return (
    <div className="flex items-center p-1 bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-md">
      {phases.map((p) => {
        const isActive = currentPhase === p.id;
        return (
          <button
            key={p.id}
            disabled={!isIdle}
            onClick={() => onSelectPhase(p.id)}
            className={cn(
              'px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 select-none',
              isActive
                ? p.id === 'FOCUS'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]',
              !isIdle && 'cursor-default opacity-80'
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
};
