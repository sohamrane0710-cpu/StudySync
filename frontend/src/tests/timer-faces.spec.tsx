import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RingFace } from '@/components/timer/RingFace';
import { DigitalFace } from '@/components/timer/DigitalFace';
import { MinimalFace } from '@/components/timer/MinimalFace';
import { FlipFace } from '@/components/timer/FlipFace';
import { TimerControls } from '@/components/timer/TimerControls';

describe('Timer Faces and Controls', () => {
  describe('RingFace', () => {
    it('renders formatted digits and focus phase badge', () => {
      render(
        <RingFace
          displaySeconds={1500}
          targetDuration={1500}
          phase="FOCUS"
          isRunning={false}
          cycleCount={1}
        />
      );

      expect(screen.getByText('25:00')).toBeInTheDocument();
      expect(screen.getByText('FOCUS')).toBeInTheDocument();
      expect(screen.getByText('Cycle #1')).toBeInTheDocument();
    });

    it('renders break phase indicator with teal theme', () => {
      render(
        <RingFace
          displaySeconds={300}
          targetDuration={300}
          phase="SHORT_BREAK"
          isRunning={true}
        />
      );

      expect(screen.getByText('05:00')).toBeInTheDocument();
      expect(screen.getByText('SHORT BREAK')).toBeInTheDocument();
    });
  });

  describe('DigitalFace', () => {
    it('renders split minute and second digit boxes and progress indicator', () => {
      render(
        <DigitalFace
          displaySeconds={1200}
          targetDuration={1500}
          phase="FOCUS"
          isRunning={true}
        />
      );

      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('00')).toBeInTheDocument();
      expect(screen.getByText('20% complete')).toBeInTheDocument();
    });
  });

  describe('MinimalFace', () => {
    it('renders clean minimal digits and phase label', () => {
      render(
        <MinimalFace
          displaySeconds={900}
          phase="FOCUS"
          isRunning={false}
        />
      );

      expect(screen.getByText('15:00')).toBeInTheDocument();
      expect(screen.getByText('FOCUS')).toBeInTheDocument();
    });
  });

  describe('FlipFace', () => {
    it('renders individual split digit cards for hours/minutes', () => {
      render(
        <FlipFace
          displaySeconds={1500} // "25:00" -> 2, 5, 0, 0
          phase="FOCUS"
          isRunning={false}
        />
      );

      // Verify digits render in card halves
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
      expect(screen.getAllByText('5').length).toBeGreaterThan(0);
      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    });
  });

  describe('TimerControls', () => {
    it('renders Start button when timer is idle', () => {
      const onStart = vi.fn();
      render(
        <TimerControls
          isRunning={false}
          isPaused={false}
          isIdle={true}
          isMutating={false}
          phase="FOCUS"
          onStart={onStart}
          onPause={vi.fn()}
          onResume={vi.fn()}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const startButton = screen.getByRole('button', { name: /start focus/i });
      expect(startButton).toBeInTheDocument();

      fireEvent.click(startButton);
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('renders Pause, Complete, and Cancel buttons when running', () => {
      const onPause = vi.fn();
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      render(
        <TimerControls
          isRunning={true}
          isPaused={false}
          isIdle={false}
          isMutating={false}
          phase="FOCUS"
          onStart={vi.fn()}
          onPause={onPause}
          onResume={vi.fn()}
          onComplete={onComplete}
          onCancel={onCancel}
        />
      );

      const pauseBtn = screen.getByRole('button', { name: /pause/i });
      const completeBtn = screen.getByRole('button', { name: /complete/i });
      const cancelBtn = screen.getByTitle('Cancel session');

      expect(pauseBtn).toBeInTheDocument();
      expect(completeBtn).toBeInTheDocument();
      expect(cancelBtn).toBeInTheDocument();

      fireEvent.click(pauseBtn);
      expect(onPause).toHaveBeenCalledTimes(1);

      fireEvent.click(completeBtn);
      expect(onComplete).toHaveBeenCalledTimes(1);

      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('renders Resume button when paused', () => {
      const onResume = vi.fn();

      render(
        <TimerControls
          isRunning={false}
          isPaused={true}
          isIdle={false}
          isMutating={false}
          phase="FOCUS"
          onStart={vi.fn()}
          onPause={vi.fn()}
          onResume={onResume}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const resumeBtn = screen.getByRole('button', { name: /resume/i });
      expect(resumeBtn).toBeInTheDocument();

      fireEvent.click(resumeBtn);
      expect(onResume).toHaveBeenCalledTimes(1);
    });
  });
});
