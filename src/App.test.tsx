import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { IndexedDBStorage } from './storage/indexedDBStorage';

describe('App Integration Tests', () => {
  beforeEach(async () => {
    const storage = new IndexedDBStorage();
    await storage.clearSessions();
    await storage.saveRecoveryState(null);
  });

  it('renders five-zone workspace with initial timer countdown and controls', async () => {
    render(<App />);

    // Zone 1: Logo & Presence
    expect(screen.getAllByText(/Study/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Solo workspace')).toBeDefined();

    // Zone 2: Pipeline & Session Label
    expect(screen.getByText('#Study_Session')).toBeDefined();

    // Zone 3: Hero Dial Countdown (Pomodoro defaults to 25:00)
    expect(screen.getByText('25:00')).toBeDefined();

    // Zone 4: Controls
    expect(screen.getByRole('button', { name: 'Start timer' })).toBeDefined();

    // Zone 5: Dock
    expect(screen.getByText(/streak/i)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open session history drawer' })).toBeDefined();
  });

  it('starts and pauses the timer on primary control click', async () => {
    render(<App />);

    const startBtn = screen.getByRole('button', { name: 'Start timer' });
    fireEvent.click(startBtn);

    // Button should now be Pause timer
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pause timer' })).toBeDefined();
    });

    const pauseBtn = screen.getByRole('button', { name: 'Pause timer' });
    fireEvent.click(pauseBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resume timer' })).toBeDefined();
    });
  });

  it('skips to next step on skip button click', async () => {
    render(<App />);

    const startBtn = screen.getByRole('button', { name: 'Start timer' });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pause timer' })).toBeDefined();
    });

    const skipBtn = screen.getByRole('button', { name: 'Skip to next step' });
    fireEvent.click(skipBtn);

    await waitFor(() => {
      expect(screen.getByText('05:00')).toBeDefined();
    });
  });

  it('opens and closes the history drawer', async () => {
    render(<App />);

    const historyBtn = screen.getByRole('button', { name: 'Open session history drawer' });
    fireEvent.click(historyBtn);

    expect(screen.getByText('Focus History')).toBeDefined();
    expect(screen.getByText("Today's Focus")).toBeDefined();

    const closeBtn = screen.getByRole('button', { name: 'Close history drawer' });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Focus History')).toBeNull();
    });
  });

  it('opens and closes the mode selector modal', async () => {
    render(<App />);

    const modeBtn = screen.getByRole('button', { name: 'Change study mode' });
    fireEvent.click(modeBtn);

    expect(screen.getByText('Study Modes & Sequences')).toBeDefined();
    expect(screen.getByText('Deep Work')).toBeDefined();
    expect(screen.getByText('Ultradian Rhythm')).toBeDefined();
    expect(screen.getByText('Quick Sprint')).toBeDefined();

    const closeBtn = screen.getByRole('button', { name: 'Close modal' });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Study Modes & Sequences')).toBeNull();
    });
  });

  it('handles keyboard shortcut spacebar to start and pause without triggering in text inputs', async () => {
    render(<App />);

    // Spacebar triggers start
    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pause timer' })).toBeDefined();
    });

    // Spacebar triggers pause
    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resume timer' })).toBeDefined();
    });

    // When an input element is focused and receives spacebar, timer should NOT toggle
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { code: 'Space' });
    // Timer remains paused
    expect(screen.getByRole('button', { name: 'Resume timer' })).toBeDefined();
    document.body.removeChild(input);
  });
});
