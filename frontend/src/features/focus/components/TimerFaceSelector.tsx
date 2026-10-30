import React, { useState, useRef, useEffect } from 'react';
import type { TimerFace } from '@/types/preferences';
import { Eye, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TimerFaceSelectorProps {
  activeFace: TimerFace;
  onSelectFace: (face: TimerFace) => void;
  className?: string;
}

const FACES: { id: TimerFace; label: string; desc: string }[] = [
  { id: 'ring', label: 'Ring (Chronometer)', desc: 'Radial optical chronometer with tick marks' },
  { id: 'digital', label: 'Digital', desc: 'Split cards with linear progress bar' },
  { id: 'flip', label: 'Flip Clock', desc: 'Split mechanical digit cards' },
  { id: 'minimal', label: 'Minimal', desc: 'Pure typography and focus beacon' },
];

export const TimerFaceSelector: React.FC<TimerFaceSelectorProps> = ({
  activeFace,
  onSelectFace,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);


  return (
    <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Select timer appearance"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 text-xs text-zinc-300 font-medium transition-all select-none backdrop-blur-md"
      >
        <Eye className="w-3.5 h-3.5 text-zinc-400" />
        <span className="capitalize">{activeFace}</span>
        <ChevronDown className="w-3 h-3 text-zinc-500" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Timer Face Choices"
          className="absolute right-0 mt-2 w-56 bg-[#12151A] border border-white/10 rounded-2xl p-2 shadow-2xl backdrop-blur-2xl z-50 animate-scale-up"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Chronometer Style
          </div>

          <div className="flex flex-col gap-1">
            {FACES.map((f) => {
              const isSelected = f.id === activeFace;
              return (
                <button
                  key={f.id}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    onSelectFace(f.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all',
                    isSelected
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium'
                      : 'text-zinc-300 hover:bg-white/[0.05]'
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-xs">{f.label}</span>
                    <span className="text-[10px] text-zinc-500">{f.desc}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
