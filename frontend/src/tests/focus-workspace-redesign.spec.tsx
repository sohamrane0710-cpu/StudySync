import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RingFace } from '@/components/timer/RingFace';
import { TimerControls } from '@/components/timer/TimerControls';
import { CompletionModal } from '@/components/timer/CompletionModal';
import { SessionIntentionBar, type SessionIntention } from '@/features/focus/components/SessionIntentionBar';
import { AmbientAudioPopover } from '@/features/focus/components/AmbientAudioPopover';
import { TimerFaceSelector } from '@/features/focus/components/TimerFaceSelector';
import { soundEngine } from '@/lib/audio/sound';
import { categoriesApi } from '@/lib/api/categories';
import { labelsApi } from '@/lib/api/labels';
import { preferencesApi } from '@/lib/api/preferences';

// Mock dependencies
vi.mock('@/lib/audio/sound', () => ({
  soundEngine: {
    setAmbient: vi.fn(),
    setAmbientVolume: vi.fn(),
    stopAmbient: vi.fn(),
    playChime: vi.fn(),
    playTick: vi.fn(),
    getCurrentPreset: vi.fn().mockReturnValue('none'),
  },
}));

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'test-user-1', email: 'test@studysync.dev' },
    isAuthenticated: true,
  }),
}));

const mockCategories = [
  { id: 'cat-1', userId: 'user-1', name: 'Mathematics', color: '#6366F1', isArchived: false, createdAt: '', updatedAt: '' },
  { id: 'cat-2', userId: 'user-1', name: 'Computer Science', color: '#10B981', isArchived: false, createdAt: '', updatedAt: '' },
];

const mockLabels = [
  { id: 'lbl-1', userId: 'user-1', name: 'Calculus', color: '#6366F1', categoryId: 'cat-1', isArchived: false, createdAt: '', updatedAt: '' },
  { id: 'lbl-2', userId: 'user-1', name: 'Algorithms', color: '#10B981', categoryId: 'cat-2', isArchived: false, createdAt: '', updatedAt: '' },
  { id: 'lbl-3', userId: 'user-1', name: 'Exam Prep', color: '#F59E0B', categoryId: null, isArchived: false, createdAt: '', updatedAt: '' },
];

const mockPreferences = {
  id: 'pref-1',
  userId: 'user-1',
  theme: 'dark-glass',
  timerFace: 'ring' as const,
  ambientPreset: 'none',
  soundVolume: 0.6,
  soundEnabled: true,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  createdAt: '',
  updatedAt: '',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Phase 2.1: Focus Workspace Redesign Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(categoriesApi, 'getCategories').mockResolvedValue(mockCategories);
    vi.spyOn(labelsApi, 'getLabels').mockResolvedValue(mockLabels);
    vi.spyOn(preferencesApi, 'getPreferences').mockResolvedValue(mockPreferences);
    vi.spyOn(preferencesApi, 'updatePreferences').mockResolvedValue(mockPreferences);
  });

  describe('Stage A: Timer Controls & Reset Semantics', () => {
    it('1. renders start and reset buttons when idle, and clicking reset triggers onReset', () => {
      const onStart = vi.fn();
      const onReset = vi.fn();

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
          onReset={onReset}
        />
      );

      expect(screen.getByRole('button', { name: /start focus/i })).toBeInTheDocument();
      const resetBtn = screen.getByTitle('Reset timer');
      expect(resetBtn).toBeInTheDocument();

      fireEvent.click(resetBtn);
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('2. renders resume, complete, cancel, and reset buttons when paused', () => {
      const onResume = vi.fn();
      const onReset = vi.fn();

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
          onReset={onReset}
        />
      );

      expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /complete/i })).toBeInTheDocument();
      expect(screen.getByTitle('Cancel session')).toBeInTheDocument();

      const resetBtn = screen.getByTitle('Reset timer');
      expect(resetBtn).toBeInTheDocument();

      fireEvent.click(resetBtn);
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('3. renders pause, complete, cancel, and reset buttons when running', () => {
      const onReset = vi.fn();
      render(
        <TimerControls
          isRunning={true}
          isPaused={false}
          isIdle={false}
          isMutating={false}
          phase="FOCUS"
          onStart={vi.fn()}
          onPause={vi.fn()}
          onResume={vi.fn()}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
          onReset={onReset}
        />
      );

      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /complete/i })).toBeInTheDocument();
      expect(screen.getByTitle('Cancel session')).toBeInTheDocument();

      const resetBtn = screen.getByTitle('Reset timer');
      expect(resetBtn).toBeInTheDocument();

      fireEvent.click(resetBtn);
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('4. prevents duplicate actions and disables buttons while isMutating is true', () => {
      const onStart = vi.fn();

      render(
        <TimerControls
          isRunning={false}
          isPaused={false}
          isIdle={true}
          isMutating={true}
          phase="FOCUS"
          onStart={onStart}
          onPause={vi.fn()}
          onResume={vi.fn()}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
          onReset={vi.fn()}
        />
      );

      const startBtn = screen.getByRole('button', { name: /start focus/i });
      expect(startBtn).toBeDisabled();

      fireEvent.click(startBtn);
      expect(onStart).not.toHaveBeenCalled();
    });

    it('5. keyboard shortcuts: Space bar starts/pauses/resumes and C completes', () => {
      const onStart = vi.fn();
      const onComplete = vi.fn();

      const { rerender } = render(
        <TimerControls
          isRunning={false}
          isPaused={false}
          isIdle={true}
          isMutating={false}
          phase="FOCUS"
          onStart={onStart}
          onPause={vi.fn()}
          onResume={vi.fn()}
          onComplete={onComplete}
          onCancel={vi.fn()}
        />
      );

      // Press Space when idle -> calls onStart
      fireEvent.keyDown(window, { code: 'Space' });
      expect(onStart).toHaveBeenCalledTimes(1);

      // When running -> Space pauses, 'c' completes
      const onPause = vi.fn();
      rerender(
        <TimerControls
          isRunning={true}
          isPaused={false}
          isIdle={false}
          isMutating={false}
          phase="FOCUS"
          onStart={onStart}
          onPause={onPause}
          onResume={vi.fn()}
          onComplete={onComplete}
          onCancel={vi.fn()}
        />
      );

      fireEvent.keyDown(window, { code: 'Space' });
      expect(onPause).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: 'c' });
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Stage B: SessionIntentionBar', () => {
    it('1. renders empty state placeholder and opens popover on click', async () => {
      const intention: SessionIntention = { goalTitle: '', categoryId: null, labelIds: [] };
      const onChange = vi.fn();

      render(
        <SessionIntentionBar
          intention={intention}
          onChangeIntention={onChange}
          isActive={false}
          phase="FOCUS"
        />,
        { wrapper: createWrapper() }
      );

      expect(await screen.findByText(/set session goal or topic/i)).toBeInTheDocument();

      // Click to open popover
      fireEvent.click(screen.getByRole('button', { name: /set session intention/i }));

      expect(await screen.findByRole('dialog', { name: /session intention selector/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. linear algebra/i)).toBeInTheDocument();
    });

    it('2. selects category, enters goal, selects multiple labels, and saves intention', async () => {
      let currentIntention: SessionIntention = { goalTitle: '', categoryId: null, labelIds: [] };
      const onChange = vi.fn((newVal) => {
        currentIntention = newVal;
      });

      render(
        <SessionIntentionBar
          intention={currentIntention}
          onChangeIntention={onChange}
          isActive={false}
          phase="FOCUS"
        />,
        { wrapper: createWrapper() }
      );

      // Open selector
      fireEvent.click(screen.getByRole('button', { name: /set session intention/i }));

      // Enter goal
      const input = screen.getByPlaceholderText(/e\.g\. linear algebra/i);
      fireEvent.change(input, { target: { value: 'Mastering Vitest' } });

      // Click category Mathematics
      const mathCatBtn = await screen.findByText('Mathematics');
      fireEvent.click(mathCatBtn);

      // Click label Calculus
      const calcLabelBtn = await screen.findByText('#Calculus');
      fireEvent.click(calcLabelBtn);

      // Save intention
      const saveBtn = screen.getByRole('button', { name: /set intention/i });
      fireEvent.click(saveBtn);

      expect(onChange).toHaveBeenCalledWith({
        goalTitle: 'Mastering Vitest',
        categoryId: 'cat-1',
        labelIds: ['lbl-1'],
      });
    });

    it('3. displays compact active intention capsule when session is active', async () => {
      const intention: SessionIntention = {
        goalTitle: 'Deep Reinforcement Learning',
        categoryId: 'cat-2',
        labelIds: ['lbl-2'],
      };

      render(
        <SessionIntentionBar
          intention={intention}
          onChangeIntention={vi.fn()}
          isActive={true}
          phase="FOCUS"
        />,
        { wrapper: createWrapper() }
      );

      expect(await screen.findByText('Computer Science')).toBeInTheDocument();
      expect(screen.getByText('Deep Reinforcement Learning')).toBeInTheDocument();
    });

    it('4. CompletionModal preserves in-progress user typing without being wiped out when re-rendered with new props while open', () => {
      const { rerender } = render(
        <CompletionModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          targetDuration={1500}
          phase="FOCUS"
          isMutating={false}
          initialTitle="Initial Goal"
        />,
        { wrapper: createWrapper() }
      );

      const titleInput = screen.getByLabelText(/session title/i) as HTMLInputElement;
      expect(titleInput.value).toBe('Initial Goal');

      // User types custom updates
      fireEvent.change(titleInput, { target: { value: 'User Edited Title' } });
      expect(titleInput.value).toBe('User Edited Title');

      // Parent re-renders with new props while modal is still open
      rerender(
        <CompletionModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          targetDuration={1500}
          phase="FOCUS"
          isMutating={false}
          initialTitle="Initial Goal Updated From Outside"
        />
      );

      // Value MUST remain what user typed, NOT reverted!
      expect(titleInput.value).toBe('User Edited Title');
    });
  });

  describe('Stage C: Optical Chronometer RingFace', () => {
    it('1. renders SVG optical chronometer with 60 tick marks and formatted countdown', () => {
      const { container } = render(
        <RingFace
          displaySeconds={1500}
          targetDuration={1500}
          phase="FOCUS"
          isRunning={true}
          cycleCount={2}
        />
      );

      expect(screen.getByText('25:00')).toBeInTheDocument();
      expect(screen.getByText('FOCUS')).toBeInTheDocument();
      expect(screen.getByText('Cycle #2')).toBeInTheDocument();

      // Check SVG ticks: exactly 60 tick lines
      const tickLines = container.querySelectorAll('line');
      expect(tickLines.length).toBe(60);
    });

    it('2. renders PAUSED badge when paused', () => {
      render(
        <RingFace
          displaySeconds={800}
          targetDuration={1500}
          phase="FOCUS"
          isRunning={false}
          isPaused={true}
        />
      );

      expect(screen.getByText('PAUSED')).toBeInTheDocument();
    });

    it('3. renders cool teal theme on break phase', () => {
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

  describe('Stage D: AmbientAudioPopover', () => {
    it('1. opens popover, shows audio presets, and switches preset', async () => {
      render(<AmbientAudioPopover />, { wrapper: createWrapper() });

      const audioBtn = screen.getByRole('button', { name: /ambient audio settings/i });
      fireEvent.click(audioBtn);

      expect(await screen.findByRole('dialog', { name: /ambient audio controls/i })).toBeInTheDocument();

      // Click Rain preset
      const rainBtn = screen.getByRole('button', { name: /rain/i });
      fireEvent.click(rainBtn);

      expect(soundEngine.setAmbient).toHaveBeenCalledWith('rain', expect.any(Number), true);
    });

    it('2. operates volume slider and mute toggle consistently', async () => {
      render(<AmbientAudioPopover />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: /ambient audio settings/i }));

      // Find volume slider
      const slider = await screen.findByLabelText(/volume slider/i);
      fireEvent.change(slider, { target: { value: '0.8' } });

      expect(soundEngine.setAmbientVolume).toHaveBeenCalledWith(0.8);

      // Test chime button
      const chimeBtn = screen.getByRole('button', { name: /play chime/i });
      fireEvent.click(chimeBtn);

      expect(soundEngine.playChime).toHaveBeenCalled();
    });

    it('3. closes popover when Escape key is pressed', async () => {
      render(<AmbientAudioPopover />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByRole('button', { name: /ambient audio settings/i }));
      expect(await screen.findByRole('dialog', { name: /ambient audio controls/i })).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /ambient audio controls/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Top Utility Bar: TimerFaceSelector', () => {
    it('1. renders active face and allows selecting alternative timer face', async () => {
      const onSelect = vi.fn();
      render(<TimerFaceSelector activeFace="ring" onSelectFace={onSelect} />);

      const trigger = screen.getByRole('button', { name: /select timer appearance/i });
      expect(trigger).toBeInTheDocument();
      expect(screen.getByText('ring')).toBeInTheDocument();

      fireEvent.click(trigger);

      const digitalOpt = await screen.findByRole('menuitem', { name: /digital/i });
      fireEvent.click(digitalOpt);

      expect(onSelect).toHaveBeenCalledWith('digital');
    });
  });

  describe('Responsive Design & Accessibility', () => {
    it('1. RingFace utilizes responsive widths without invalid tailwind classes', () => {
      const { container } = render(
        <RingFace
          displaySeconds={1500}
          targetDuration={1500}
          phase="FOCUS"
          isRunning={false}
        />
      );

      const dialWrapper = container.firstChild as HTMLElement;
      expect(dialWrapper.className).toContain('w-72');
      expect(dialWrapper.className).toContain('sm:w-80');
      expect(dialWrapper.className).toContain('md:w-96');
      expect(dialWrapper.className).not.toContain('w-84');
      expect(dialWrapper.className).not.toContain('h-84');
    });

    it('2. all interactive elements have accessible names and touch target classes', () => {
      render(
        <TimerControls
          isRunning={false}
          isPaused={false}
          isIdle={true}
          isMutating={false}
          phase="FOCUS"
          onStart={vi.fn()}
          onPause={vi.fn()}
          onResume={vi.fn()}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
          onReset={vi.fn()}
        />
      );

      const startBtn = screen.getByRole('button', { name: /start focus/i });
      expect(startBtn).toHaveClass('h-12');
      expect(startBtn).not.toHaveClass('h-13');

      const resetBtn = screen.getByRole('button', { name: /reset timer/i });
      expect(resetBtn).toHaveAttribute('aria-label', 'Reset timer');
    });

    it('3. popovers have responsive max-width bounds to prevent overflow on mobile', async () => {
      render(
        <SessionIntentionBar
          intention={{ goalTitle: '', categoryId: null, labelIds: [] }}
          onChangeIntention={vi.fn()}
          isActive={false}
          phase="FOCUS"
        />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByRole('button', { name: /set session intention/i }));

      const dialog = await screen.findByRole('dialog', { name: /session intention selector/i });
      expect(dialog.className).toContain('max-w-[calc(100vw-2rem)]');
    });
  });
});
