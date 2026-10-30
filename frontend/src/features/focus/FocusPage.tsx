import React, { useState } from 'react';
import { useActiveTimer } from '@/hooks/use-active-timer';
import { usePreferences } from '@/hooks/use-preferences';
import { RingFace } from '@/components/timer/RingFace';
import { DigitalFace } from '@/components/timer/DigitalFace';
import { MinimalFace } from '@/components/timer/MinimalFace';
import { FlipFace } from '@/components/timer/FlipFace';
import { PhaseSelector } from '@/components/timer/PhaseSelector';
import { ModeSelector } from '@/components/timer/ModeSelector';
import { TimerControls } from '@/components/timer/TimerControls';
import { CompletionModal } from '@/components/timer/CompletionModal';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { soundEngine } from '@/lib/audio/sound';
import type { TimerFace } from '@/types/preferences';
import { Volume2, VolumeX, Sparkles, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export const FocusPage: React.FC = () => {
  const {
    activeTimer,
    displaySeconds,
    targetDuration,
    currentPhase,
    currentMode,
    modes,
    isRunning,
    isPaused,
    isIdle,
    isMutating,
    setSelectedModeId,
    setIdlePhase,
    start,
    pause,
    resume,
    complete,
    cancel,
  } = useActiveTimer();

  const { preferences, updatePreferences } = usePreferences();

  // Face preference with local override
  const [activeFace, setActiveFace] = useState<TimerFace>(
    preferences?.timerFace || 'ring'
  );

  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  // Sync preference if it loads later
  React.useEffect(() => {
    if (preferences?.timerFace) {
      setActiveFace(preferences.timerFace);
    }
  }, [preferences?.timerFace]);

  const handleFaceChange = (face: TimerFace) => {
    setActiveFace(face);
    updatePreferences({ timerFace: face }).catch(() => {});
  };

  const handleSoundToggle = () => {
    const newEnabled = !(preferences?.soundEnabled ?? true);
    updatePreferences({ soundEnabled: newEnabled }).catch(() => {});
    if (newEnabled) {
      soundEngine.playTick(preferences?.soundVolume ?? 0.5, true);
    }
  };

  const handleConfirmCancel = async () => {
    await cancel({ savePartialRecord: true });
    setIsCancelConfirmOpen(false);
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-10rem)] max-w-4xl mx-auto py-2 sm:py-6 relative">
      {/* Top Controls: Mode, Phase, Face Switcher */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 px-2 z-10">
        <div className="flex items-center gap-2.5">
          <ModeSelector
            modes={modes}
            currentMode={currentMode}
            isIdle={isIdle}
            onSelectMode={(id) => setSelectedModeId(id)}
          />

          <PhaseSelector
            currentPhase={currentPhase}
            isIdle={isIdle}
            onSelectPhase={(phase) => setIdlePhase(phase)}
          />
        </div>

        {/* Timer Face selector and sound toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/10 rounded-xl backdrop-blur-md">
          {(['ring', 'digital', 'flip', 'minimal'] as TimerFace[]).map((face) => (
            <button
              key={face}
              onClick={() => handleFaceChange(face)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs capitalize transition-all select-none',
                activeFace === face
                  ? 'bg-white/10 text-white font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
              )}
            >
              {face}
            </button>
          ))}

          <div className="w-px h-3.5 bg-white/10 mx-1" />

          <button
            onClick={handleSoundToggle}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors"
            title={preferences?.soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
          >
            {preferences?.soundEnabled ?? true ? (
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
            )}
          </button>
        </div>
      </div>

      {/* Dominant Central Timer Face */}
      <div className="my-auto py-8 sm:py-12 flex flex-col items-center justify-center w-full">
        {activeFace === 'ring' && (
          <RingFace
            displaySeconds={displaySeconds}
            targetDuration={targetDuration}
            phase={currentPhase}
            isRunning={isRunning}
            cycleCount={activeTimer?.cycleCount}
          />
        )}

        {activeFace === 'digital' && (
          <DigitalFace
            displaySeconds={displaySeconds}
            targetDuration={targetDuration}
            phase={currentPhase}
            isRunning={isRunning}
          />
        )}

        {activeFace === 'flip' && (
          <FlipFace
            displaySeconds={displaySeconds}
            phase={currentPhase}
            isRunning={isRunning}
          />
        )}

        {activeFace === 'minimal' && (
          <MinimalFace
            displaySeconds={displaySeconds}
            phase={currentPhase}
            isRunning={isRunning}
          />
        )}
      </div>

      {/* Action Controls */}
      <div className="w-full flex flex-col items-center gap-6 z-10">
        <TimerControls
          isRunning={isRunning}
          isPaused={isPaused}
          isIdle={isIdle}
          isMutating={isMutating}
          phase={currentPhase}
          onStart={() => start()}
          onPause={() => pause()}
          onResume={() => resume()}
          onComplete={() => setIsCompletionModalOpen(true)}
          onCancel={() => setIsCancelConfirmOpen(true)}
        />

        {/* Ambient Mode & Session Context Footer */}
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400/80" />
            <span>
              {currentPhase === 'FOCUS'
                ? 'Deep focus session in progress'
                : 'Take a breath and step away'}
            </span>
          </div>
          {activeTimer && (
            <span className="font-mono text-zinc-600">
              · Cycle #{activeTimer.cycleCount + 1}
            </span>
          )}
        </div>
      </div>

      {/* Completion Modal */}
      <CompletionModal
        isOpen={isCompletionModalOpen}
        onClose={() => setIsCompletionModalOpen(false)}
        onConfirm={async (payload) => {
          await complete(payload);
        }}
        targetDuration={targetDuration}
        phase={currentPhase}
        isMutating={isMutating}
      />

      {/* Cancel Confirmation Dialog */}
      <Modal
        isOpen={isCancelConfirmOpen}
        onClose={() => setIsCancelConfirmOpen(false)}
        title="Cancel Active Session?"
        description="Are you sure you want to stop? If you have studied for at least 60 seconds, your partial focus time will be saved as an interrupted session."
        maxWidth="sm"
      >
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>This will cancel the active timer and stop the countdown.</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
            <Button
              variant="ghost"
              onClick={() => setIsCancelConfirmOpen(false)}
              disabled={isMutating}
            >
              Keep Focusing
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmCancel}
              isLoading={isMutating}
            >
              Cancel Session
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
