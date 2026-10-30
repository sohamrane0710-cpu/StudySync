import { describe, it, expect } from 'vitest';
import type { TimerSession } from '@/types/timer';

// Test the core timer countdown calculation logic
function calculateAuthoritativeRemaining(session: TimerSession | null, now = Date.now()): number {
  if (!session) return 0;

  if (session.status === 'PAUSED') {
    return Math.max(0, session.remainingSeconds);
  }

  if (session.status === 'RUNNING' && session.expectedEndTime) {
    const target = new Date(session.expectedEndTime).getTime();
    return Math.max(0, Math.round((target - now) / 1000));
  }

  return Math.max(0, session.remainingSeconds);
}

describe('Authoritative Timer Math & Recovery', () => {
  it('correctly calculates remaining countdown from future expectedEndTime', () => {
    const now = 1700000000000;
    const futureEndTime = new Date(now + 1200 * 1000).toISOString(); // 20 mins from now

    const mockSession: TimerSession = {
      id: 'test-session',
      userId: 'user-1',
      phase: 'FOCUS',
      status: 'RUNNING',
      targetDuration: 1500,
      remainingSeconds: 1200,
      startedAt: new Date(now - 300 * 1000).toISOString(),
      expectedEndTime: futureEndTime,
      totalFocusSeconds: 0,
      cycleCount: 0,
      authoritativeRemainingSeconds: 1200,
      isExpired: false,
    };

    const remaining = calculateAuthoritativeRemaining(mockSession, now);
    expect(remaining).toBe(1200);
  });

  it('preserves exact remainingSeconds when timer is PAUSED', () => {
    const mockPausedSession: TimerSession = {
      id: 'paused-session',
      userId: 'user-1',
      phase: 'FOCUS',
      status: 'PAUSED',
      targetDuration: 1500,
      remainingSeconds: 845,
      startedAt: '2026-10-29T10:00:00.000Z',
      pausedAt: '2026-10-29T10:10:55.000Z',
      expectedEndTime: null,
      totalFocusSeconds: 0,
      cycleCount: 0,
      authoritativeRemainingSeconds: 845,
      isExpired: false,
    };

    // Even if current time is far in the future, paused timer remains at 845
    const remaining = calculateAuthoritativeRemaining(mockPausedSession, Date.now() + 10000000);
    expect(remaining).toBe(845);
  });

  it('clamps countdown at 0 when expectedEndTime is in the past (expired timer)', () => {
    const now = 1700000000000;
    const pastEndTime = new Date(now - 60 * 1000).toISOString(); // 1 minute ago

    const mockExpiredSession: TimerSession = {
      id: 'expired-session',
      userId: 'user-1',
      phase: 'FOCUS',
      status: 'RUNNING',
      targetDuration: 1500,
      remainingSeconds: 0,
      startedAt: new Date(now - 1560 * 1000).toISOString(),
      expectedEndTime: pastEndTime,
      totalFocusSeconds: 0,
      cycleCount: 0,
      authoritativeRemainingSeconds: 0,
      isExpired: true,
    };

    const remaining = calculateAuthoritativeRemaining(mockExpiredSession, now);
    expect(remaining).toBe(0);
  });
});
