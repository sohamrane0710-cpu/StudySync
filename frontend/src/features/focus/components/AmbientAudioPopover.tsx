import React, { useState, useRef, useEffect } from 'react';
import { usePreferences } from '@/hooks/use-preferences';
import { soundEngine } from '@/lib/audio/sound';
import type { AmbientPreset } from '@/types/preferences';
import { Volume2, VolumeX, CloudRain, Waves, Coffee, Wind, Bell, Sliders, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface AmbientAudioPopoverProps {
  className?: string;
}

const PRESETS: { id: AmbientPreset; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'none', label: 'None', icon: VolumeX },
  { id: 'rain', label: 'Rain', icon: CloudRain },
  { id: 'waves', label: 'Waves', icon: Waves },
  { id: 'cafe', label: 'Cafe', icon: Coffee },
  { id: 'white-noise', label: 'White Noise', icon: Wind },
];

export const AmbientAudioPopover: React.FC<AmbientAudioPopoverProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const { preferences, updatePreferences } = usePreferences();

  const soundEnabled = preferences?.soundEnabled ?? true;
  const soundVolume = preferences?.soundVolume ?? 0.5;
  const currentPreset = (preferences?.ambientPreset as AmbientPreset) || 'none';

  // Keyboard Escape and click outside listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
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

  const handlePresetSelect = (preset: AmbientPreset) => {
    updatePreferences({ ambientPreset: preset }).catch(() => {});
    soundEngine.setAmbient(preset, soundVolume, soundEnabled);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    soundEngine.setAmbientVolume(newVol);
    updatePreferences({ soundVolume: newVol }).catch(() => {});
  };

  const handleMuteToggle = () => {
    const newEnabled = !soundEnabled;
    updatePreferences({ soundEnabled: newEnabled }).catch(() => {});
    soundEngine.setAmbient(currentPreset, soundVolume, newEnabled);
  };

  const handleTestChime = () => {
    soundEngine.playChime(soundVolume, true);
  };

  const isAmbientActive = soundEnabled && currentPreset !== 'none';

  return (
    <div className={cn('relative inline-block text-left', className)} ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Ambient Audio Settings"
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-xs select-none backdrop-blur-md',
          isAmbientActive
            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-sm'
            : 'bg-white/[0.04] border-white/10 hover:border-white/20 text-zinc-400 hover:text-zinc-200'
        )}
      >
        {soundEnabled ? (
          <Volume2 className={cn('w-4 h-4', isAmbientActive ? 'text-amber-400' : 'text-zinc-400')} />
        ) : (
          <VolumeX className="w-4 h-4 text-zinc-500" />
        )}
        <span className="hidden sm:inline font-medium text-xs">
          {currentPreset === 'none' ? 'Audio' : PRESETS.find((p) => p.id === currentPreset)?.label || 'Audio'}
        </span>
      </button>

      {/* Ambient Audio Popover Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Ambient Audio Controls"
          className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-[#12151A] border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl z-50 animate-scale-up"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                Ambient Soundscape
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-zinc-500 hover:text-zinc-300 rounded-lg transition-colors"
              aria-label="Close audio popover"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 mt-3">
            {/* Presets Grid */}
            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-2">
                Sound Presets
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {PRESETS.map((p) => {
                  const Icon = p.icon;
                  const isSelected = currentPreset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handlePresetSelect(p.id)}
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-all border text-left',
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                          : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Volume Slider & Mute Toggle */}
            <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
                <span>Master Volume</span>
                <span className="font-mono text-zinc-300">{Math.round(soundVolume * 100)}%</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleMuteToggle}
                  aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
                  className={cn(
                    'p-2 rounded-xl border transition-colors',
                    soundEnabled
                      ? 'bg-white/[0.04] border-white/10 text-zinc-300 hover:text-white'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  )}
                  title={soundEnabled ? 'Mute sound' : 'Unmute sound'}
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVolume}
                  onChange={handleVolumeChange}
                  aria-label="Volume slider"
                  className="w-full accent-amber-400 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Test Chime Button */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">Test transition chime:</span>
              <button
                type="button"
                onClick={handleTestChime}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-300 hover:text-white transition-colors"
              >
                <Bell className="w-3 h-3 text-amber-400" />
                <span>Play Chime</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
