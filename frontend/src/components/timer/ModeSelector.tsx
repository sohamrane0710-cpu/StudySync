import React, { useState, useRef, useEffect } from 'react';
import type { TimerMode } from '@/types/timer';
import { formatSecondsToHuman } from '@/lib/utils/format';
import { ChevronDown, Sliders, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ModeSelectorProps {
  modes: TimerMode[];
  currentMode: TimerMode | null;
  isIdle: boolean;
  onSelectMode: (modeId: string) => void;
  onManageModes?: () => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  modes,
  currentMode,
  isIdle,
  onSelectMode,
  onManageModes,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        disabled={!isIdle}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 text-xs text-zinc-300 font-medium transition-all select-none',
          !isIdle && 'opacity-70 cursor-default'
        )}
        aria-expanded={isOpen}
      >
        <span>{currentMode?.name || 'Select Mode'}</span>
        <span className="text-zinc-500 font-mono text-[11px]">
          ({currentMode ? formatSecondsToHuman(currentMode.focusDuration) : '25m'})
        </span>
        {isIdle && <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
      </button>

      {isOpen && isIdle && (
        <div className="absolute left-0 mt-2 w-72 bg-[#12151A] border border-white/10 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-50 animate-scale-up">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Timer Modes
          </div>

          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {modes.map((mode) => {
              const isSelected = mode.id === currentMode?.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    onSelectMode(mode.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all',
                    isSelected
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                      : 'text-zinc-300 hover:bg-white/[0.05]'
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold">{mode.name}</span>
                    <span className="text-[11px] text-zinc-500">
                      {formatSecondsToHuman(mode.focusDuration)} focus · {formatSecondsToHuman(mode.shortBreakDuration)} break
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                </button>
              );
            })}
          </div>

          {onManageModes && (
            <div className="pt-1 mt-1 border-t border-white/5">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onManageModes();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Customize Modes</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
