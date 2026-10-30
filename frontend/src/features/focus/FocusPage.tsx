import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { SessionIntentionBar, type SessionIntention } from './components/SessionIntentionBar';
import { AmbientAudioPopover } from './components/AmbientAudioPopover';
import { TimerFaceSelector } from './components/TimerFaceSelector';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { soundEngine } from '@/lib/audio/sound';
import type { TimerFace } from '@/types/preferences';
import { Sparkles, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export const FocusPage: React.FC = () => {
  const navigate = useNavigate();

  const {
    activeTimer,
    displaySeconds,
    targetDuration,
    currentPhase,
    currentMode,
    modes,
    direction,
    currentStepName,
    nextStepPreview,
    isSequenceFinished,
    isRunning,
    isPaused,
    isIdle,
    isExpired,
    isMutating,
    error: timerError,
    clearError: clearTimerError,
    setSelectedModeId,
    setIdlePhase,
    start,
    startNext,
    pause,
    resume,
    complete,
    skip,
    finishSequence,
    cancel,
    reset,
  } = useActiveTimer();

  const { preferences, updatePreferences } = usePreferences();

  // Face preference with local override
  const [activeFace, setActiveFace] = useState<TimerFace>(
    preferences?.timerFace || 'ring'
  );

  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  // Session intention draft state (with sessionStorage resilience)
  const [intention, setIntention] = useState<SessionIntention>(() => {
    try {
      const saved = sessionStorage.getItem('studysync_focus_intention');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { goalTitle: '', categoryId: null, labelIds: [] };
  });

  const handleIntentionChange = (newIntention: SessionIntention) => {
    setIntention(newIntention);
    try {
      sessionStorage.setItem('studysync_focus_intention', JSON.stringify(newIntention));
    } catch {}
  };

  // Sync preference if it loads later
  useEffect(() => {
    if (preferences?.timerFace) {
      setActiveFace(preferences.timerFace);
    }
  }, [preferences?.timerFace]);

  // Clean up ambient audio on unmount
  useEffect(() => {
    return () => {
      soundEngine.stopAmbient();
    };
  }, []);

  const handleFaceChange = (face: TimerFace) => {
    setActiveFace(face);
    updatePreferences({ timerFace: face }).catch(() => {});
  };

  const handleConfirmCancel = async () => {
    await cancel({ savePartialRecord: true });
    setIsCancelConfirmOpen(false);
  };

  const isBreak = currentPhase.includes('BREAK');

  return (
    <div className="relative flex flex-col items-center justify-between min-h-[calc(100vh-10rem)] max-w-4xl mx-auto py-2 sm:py-6 px-3">
      {/* Dynamic Ambient Background Illumination */}
      <div
        className={cn(
          'fixed inset-0 pointer-events-none transition-all duration-1000 -z-10',
          isRunning
            ? isBreak
              ? 'bg-[radial-gradient(circle_at_50%_40%,rgba(20,184,166,0.06),transparent_60%)]'
              : 'bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.06),transparent_60%)]'
            : isPaused
            ? 'bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.02),transparent_60%)]'
            : 'bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.015),transparent_60%)]'
        )}
      />

      {/* Top Utility Bar: Mode, Phase, Face Switcher, Ambient Audio */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 px-1 z-20">
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <ModeSelector
            modes={modes}
            currentMode={currentMode}
            isIdle={isIdle}
            onSelectMode={(id) => setSelectedModeId(id)}
            onManageModes={() => navigate('/app/settings')}
          />

          <PhaseSelector
            currentPhase={currentPhase}
            isIdle={isIdle}
            onSelectPhase={(phase) => setIdlePhase(phase)}
          />
        </div>

        {/* Compact Appearance & Ambient Audio Popover */}
        <div className="flex items-center gap-2">
          <TimerFaceSelector
            activeFace={activeFace}
            onSelectFace={handleFaceChange}
          />

          <AmbientAudioPopover />
        </div>
      </div>

      {/* Central Area: Session Intention Bar + Dominant Timer Face */}
      <div className="my-auto py-6 sm:py-10 flex flex-col items-center justify-center w-full gap-6">
        {/* Session Intention Bar: always visible, compact during session */}
        <SessionIntentionBar
          intention={intention}
          onChangeIntention={handleIntentionChange}
          isActive={isRunning || isPaused}
          phase={currentPhase}
        />

        {/* Dominant Central Optical Chronometer or Selected Face */}
        <div className="flex flex-col items-center justify-center w-full">
          {activeFace === 'ring' && (
            <RingFace
              displaySeconds={displaySeconds}
              targetDuration={targetDuration}
              phase={currentPhase}
              isRunning={isRunning}
              isPaused={isPaused}
              cycleCount={activeTimer?.cycleCount}
              direction={direction}
              stepName={currentStepName}
            />
          )}

          {activeFace === 'digital' && (
            <DigitalFace
              displaySeconds={displaySeconds}
              targetDuration={targetDuration}
              phase={currentPhase}
              isRunning={isRunning}
              direction={direction}
              stepName={currentStepName}
            />
          )}

          {activeFace === 'flip' && (
            <FlipFace
              displaySeconds={displaySeconds}
              phase={currentPhase}
              isRunning={isRunning}
              direction={direction}
              stepName={currentStepName}
            />
          )}

          {activeFace === 'minimal' && (
            <MinimalFace
              displaySeconds={displaySeconds}
              phase={currentPhase}
              isRunning={isRunning}
              direction={direction}
              stepName={currentStepName}
            />
          )}
        </div>
      </div>

      {/* Action Controls & Atmosphere Footer */}
      <div className="w-full flex flex-col items-center gap-5 z-20">
        {timerError && (
          <div className="flex items-center gap-2 p-2.5 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs w-full max-w-md animate-fade-in">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="flex-1">{timerError}</span>
            <button
              onClick={clearTimerError}
              className="text-zinc-400 hover:text-white p-0.5 rounded transition-colors"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <TimerControls
          isRunning={isRunning}
          isPaused={isPaused}
          isIdle={isIdle}
          isExpired={isExpired}
          isMutating={isMutating}
          phase={currentPhase}
          stepName={currentStepName}
          nextStepPreview={nextStepPreview}
          isSequenceFinished={isSequenceFinished}
          onStart={() => start()}
          onStartNext={() => startNext()}
          onPause={() => pause()}
          onResume={() => resume()}
          onComplete={() => setIsCompletionModalOpen(true)}
          onSkip={() => skip()}
          onFinishSequence={() => finishSequence()}
          onCancel={() => setIsCancelConfirmOpen(true)}
          onReset={() => reset()}
        />

        {/* Ambient Session Context Footer */}
        <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
          <div className="flex items-center gap-1.5">
            <Sparkles
              className={cn(
                'w-3.5 h-3.5',
                isBreak ? 'text-teal-400/80' : 'text-amber-400/80'
              )}
            />
            <span>
              {isPaused
                ? 'Timer paused — resume when ready'
                : isRunning
                ? currentPhase === 'FOCUS'
                  ? `Deep focus: ${currentStepName}`
                  : `Break: ${currentStepName}`
                : nextStepPreview
                ? `Next: ${nextStepPreview.stepName}`
                : 'Select mode and session intention to begin'}
            </span>
          </div>
          {activeTimer && (
            <span className="font-mono text-zinc-600">
              · Step #{(activeTimer.stepIndex ?? 0) + 1}/{activeTimer.totalSteps ?? 1} · Cycle #{activeTimer.cycleCount + 1}
            </span>
          )}
        </div>
      </div>

      {/* Completion Modal: pre-filled with active session intention */}
      <CompletionModal
        isOpen={isCompletionModalOpen}
        onClose={() => setIsCompletionModalOpen(false)}
        onConfirm={async (payload) => {
          await complete(payload);
          // Explicit cleanup policy: once a session is completed and recorded,
          // clear the one-time goal and draft intention so stale data is not attached to subsequent sessions.
          const cleanIntention = { goalTitle: '', categoryId: null, labelIds: [] };
          setIntention(cleanIntention);
          try {
            sessionStorage.removeItem('studysync_focus_intention');
          } catch {}
        }}
        targetDuration={targetDuration}
        phase={currentPhase}
        isMutating={isMutating}
        initialTitle={intention.goalTitle}
        initialCategoryId={intention.categoryId}
        initialLabelIds={intention.labelIds}
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
