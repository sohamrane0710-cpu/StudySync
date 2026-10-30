import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimerControls } from '@/components/timer/TimerControls';
import { RingFace } from '@/components/timer/RingFace';
import { DigitalFace } from '@/components/timer/DigitalFace';

describe('Stage C: Frontend Timer Controls & Lifecycle Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TimerControls Stage C Progression & Expiry', () => {
    it('1. displays next step action buttons (Start Next, Skip, Finish) when idle with nextStepPreview', () => {
      const onStart = vi.fn();
      const onStartNext = vi.fn();
      const onSkip = vi.fn();
      const onFinishSequence = vi.fn();

      render(
        <TimerControls
          isRunning={false}
          isPaused={false}
          isIdle={true}
          isMutating={false}
          phase="FOCUS"
          nextStepPreview={{
            stepIndex: 1,
            stepName: 'Rest 1',
            stepType: 'REST',
            duration: 300,
            totalSteps: 2,
          }}
          isSequenceFinished={false}
          onStart={onStart}
          onStartNext={onStartNext}
          onPause={vi.fn()}
          onResume={vi.fn()}
          onComplete={vi.fn()}
          onSkip={onSkip}
          onFinishSequence={onFinishSequence}
          onCancel={vi.fn()}
        />
      );

      // Verify "Start Rest 1" primary action is present
      const startNextBtn = screen.getByRole('button', { name: /Start Rest 1/i });
      expect(startNextBtn).toBeInTheDocument();

      // Verify "Skip" button is present
      const skipBtn = screen.getByRole('button', { name: /Skip/i });
      expect(skipBtn).toBeInTheDocument();

      // Verify "Finish" button is present
      const finishBtn = screen.getByRole('button', { name: /Finish/i });
      expect(finishBtn).toBeInTheDocument();

      // Clicking Start Next calls onStartNext
      fireEvent.click(startNextBtn);
      expect(onStartNext).toHaveBeenCalledTimes(1);

      // Clicking Skip calls onSkip
      fireEvent.click(skipBtn);
      expect(onSkip).toHaveBeenCalledTimes(1);

      // Clicking Finish calls onFinishSequence
      fireEvent.click(finishBtn);
      expect(onFinishSequence).toHaveBeenCalledTimes(1);
    });

    it('2. removes stale Pause control and displays Record Completion when countdown is expired', () => {
      const onPause = vi.fn();
      const onComplete = vi.fn();

      render(
        <TimerControls
          isRunning={true}
          isPaused={false}
          isIdle={false}
          isExpired={true}
          isMutating={false}
          phase="FOCUS"
          onStart={vi.fn()}
          onPause={onPause}
          onResume={vi.fn()}
          onComplete={onComplete}
          onCancel={vi.fn()}
        />
      );

      // Pause button MUST NOT be rendered when expired
      expect(screen.queryByRole('button', { name: /Pause/i })).toBeNull();

      // Prominent completion action is rendered
      const completeBtn = screen.getByRole('button', { name: /Record Completion/i });
      expect(completeBtn).toBeInTheDocument();

      fireEvent.click(completeBtn);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('3. renders standard start button when isSequenceFinished is true', () => {
      render(
        <TimerControls
          isRunning={false}
          isPaused={false}
          isIdle={true}
          isMutating={false}
          phase="FOCUS"
          stepName="Deep Focus"
          isSequenceFinished={true}
          onStart={vi.fn()}
          onPause={vi.fn()}
          onResume={vi.fn()}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const startBtn = screen.getByRole('button', { name: /Start Deep Focus/i });
      expect(startBtn).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Skip/i })).toBeNull();
    });
  });

  describe('Timer Faces Count-Up & Sequence Rendering', () => {
    it('1. RingFace renders Count Up badge and displays elapsed time', () => {
      render(
        <RingFace
          displaySeconds={142} // 2 mins 22 secs elapsed
          targetDuration={1500}
          phase="FOCUS"
          isRunning={true}
          direction="COUNT_UP"
          stepName="Sprint 1"
        />
      );

      // Verify formatted MM:SS elapsed time
      expect(screen.getByText('02:22')).toBeInTheDocument();
      // Verify Count Up pill
      expect(screen.getByText(/COUNT UP/i)).toBeInTheDocument();
      // Verify custom step name rendered
      expect(screen.getByText(/Sprint 1/i)).toBeInTheDocument();
    });

    it('2. DigitalFace renders COUNT UP indicator and computes positive progress towards target', () => {
      render(
        <DigitalFace
          displaySeconds={300}
          targetDuration={1500} // 20% of target
          phase="FOCUS"
          isRunning={true}
          direction="COUNT_UP"
          stepName="Coding Block"
        />
      );

      expect(screen.getByText('05')).toBeInTheDocument();
      expect(screen.getByText('00')).toBeInTheDocument();
      expect(screen.getByText('Coding Block')).toBeInTheDocument();
      expect(screen.getByText('COUNT UP')).toBeInTheDocument();
      expect(screen.getByText('20% of target')).toBeInTheDocument();
    });
  });
});
