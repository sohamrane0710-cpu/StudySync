import { describe, it, expect } from 'vitest';
import { calculateFocusStreak } from './streak';
import type { SessionRecord } from '../types/session';

describe('Streak Calculation Unit Tests', () => {
  const dummyMode = {
    id: 'pomodoro',
    name: 'Pomodoro',
    description: '',
    loopCount: 1,
    isBuiltIn: true,
    steps: [],
  };

  function createSession(date: Date, focusMinutes: number): SessionRecord {
    return {
      id: `s_${date.getTime()}`,
      sessionLabel: '#Study',
      modeId: 'pomodoro',
      modeName: 'Pomodoro',
      modeSnapshot: dummyMode,
      startedAt: date.getTime(),
      endedAt: date.getTime() + focusMinutes * 60 * 1000,
      totalFocusSeconds: focusMinutes * 60,
      totalRestSeconds: 0,
      completedIntervals: 1,
      totalPlannedIntervals: 1,
      outcome: 'completed',
      segments: [],
    };
  }

  it('returns 0 streak when there are no sessions', () => {
    const res = calculateFocusStreak([]);
    expect(res.streakDays).toBe(0);
    expect(res.todayFocusSeconds).toBe(0);
    expect(res.todayQualifies).toBe(false);
  });

  it('returns 0 streak if today does not qualify and yesterday has no sessions', () => {
    const now = new Date(2026, 9, 18, 14, 0); // Oct 18, 2026
    // Session 5 days ago
    const oldDate = new Date(2026, 9, 13, 10, 0);
    const sessions = [createSession(oldDate, 30)];

    const res = calculateFocusStreak(sessions, { now });
    expect(res.streakDays).toBe(0);
    expect(res.todayFocusSeconds).toBe(0);
  });

  it('returns 1 day streak when user meets qualifying threshold today', () => {
    const now = new Date(2026, 9, 18, 14, 0);
    const todaySession = createSession(new Date(2026, 9, 18, 9, 0), 25);

    const res = calculateFocusStreak([todaySession], { now });
    expect(res.streakDays).toBe(1);
    expect(res.todayQualifies).toBe(true);
    expect(res.todayFocusSeconds).toBe(25 * 60);
  });

  it('preserves streak when yesterday qualified but today has not yet met threshold', () => {
    const now = new Date(2026, 9, 18, 10, 0); // Morning of Oct 18
    const yesterday = new Date(2026, 9, 17, 15, 0); // Oct 17
    const dayBefore = new Date(2026, 9, 16, 15, 0); // Oct 16

    const sessions = [
      createSession(dayBefore, 30),
      createSession(yesterday, 45),
      createSession(now, 5), // only 5 min today so far (threshold is 10 min)
    ];

    const res = calculateFocusStreak(sessions, { now });
    // Streak from past 2 days is preserved (2 days)
    expect(res.streakDays).toBe(2);
    expect(res.todayQualifies).toBe(false);
    expect(res.todayFocusSeconds).toBe(5 * 60);
  });

  it('calculates multi-day consecutive streak when today also qualifies', () => {
    const now = new Date(2026, 9, 18, 15, 0);
    const d1 = new Date(2026, 9, 15, 12, 0); // Oct 15
    const d2 = new Date(2026, 9, 16, 12, 0); // Oct 16
    const d3 = new Date(2026, 9, 17, 12, 0); // Oct 17
    const today = new Date(2026, 9, 18, 10, 0); // Oct 18

    const sessions = [
      createSession(d1, 25),
      createSession(d2, 25),
      createSession(d3, 50),
      createSession(today, 25),
    ];

    const res = calculateFocusStreak(sessions, { now });
    expect(res.streakDays).toBe(4);
    expect(res.todayQualifies).toBe(true);
  });

  it('breaks streak when a day is missed in between', () => {
    const now = new Date(2026, 9, 18, 15, 0);
    const d1 = new Date(2026, 9, 15, 12, 0); // Oct 15 (qualifies)
    // Oct 16 missed!
    const d3 = new Date(2026, 9, 17, 12, 0); // Oct 17 (qualifies)
    const today = new Date(2026, 9, 18, 10, 0); // Oct 18 (qualifies)

    const sessions = [createSession(d1, 30), createSession(d3, 30), createSession(today, 30)];

    const res = calculateFocusStreak(sessions, { now });
    // Streak is only Oct 17 + Oct 18 = 2 days
    expect(res.streakDays).toBe(2);
  });
});
