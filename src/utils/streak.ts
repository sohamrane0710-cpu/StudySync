import type { SessionRecord } from '../types/session';

export const MIN_QUALIFYING_FOCUS_SECONDS = 10 * 60; // 10 minutes minimum qualifying focus per day

/**
 * Returns YYYY-MM-DD formatted string in user's local timezone.
 */
export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface StreakResult {
  streakDays: number;
  todayFocusSeconds: number;
  todayQualifies: boolean;
  qualifyingThresholdSeconds: number;
}

/**
 * Calculates consecutive-day focus streak from real persisted session records.
 *
 * Rules:
 * 1. A day qualifies if sum(session.totalFocusSeconds) >= qualifyingThresholdSeconds.
 * 2. If today qualifies, count today + consecutive preceding days.
 * 3. If today does not qualify yet, but yesterday qualified, count consecutive days ending yesterday (streak is preserved).
 * 4. If neither today nor yesterday qualified, streak is 0 (broken/empty).
 * 5. If no records exist, streak is 0.
 */
export function calculateFocusStreak(
  sessions: SessionRecord[],
  options?: {
    now?: Date;
    qualifyingThresholdSeconds?: number;
  },
): StreakResult {
  const threshold = options?.qualifyingThresholdSeconds ?? MIN_QUALIFYING_FOCUS_SECONDS;
  const now = options?.now ?? new Date();

  const dailyTotals = new Map<string, number>();

  for (const session of sessions) {
    if (session.totalFocusSeconds <= 0) continue;
    const sessionDate = new Date(session.startedAt);
    const dateKey = getLocalDateKey(sessionDate);
    const current = dailyTotals.get(dateKey) || 0;
    dailyTotals.set(dateKey, current + session.totalFocusSeconds);
  }

  const todayKey = getLocalDateKey(now);
  const todayFocus = dailyTotals.get(todayKey) || 0;
  const todayQualifies = todayFocus >= threshold;

  // Compute yesterday
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterdayDate);
  const yesterdayQualifies = (dailyTotals.get(yesterdayKey) || 0) >= threshold;

  if (!todayQualifies && !yesterdayQualifies) {
    return {
      streakDays: 0,
      todayFocusSeconds: todayFocus,
      todayQualifies: false,
      qualifyingThresholdSeconds: threshold,
    };
  }

  // Determine starting point for walk
  let count = 0;
  const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (todayQualifies) {
    count = 1;
    // Walk backwards starting from yesterday
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    // Today not yet qualified, start checking from yesterday
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const key = getLocalDateKey(checkDate);
    const dayTotal = dailyTotals.get(key) || 0;
    if (dayTotal >= threshold) {
      count++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    streakDays: count,
    todayFocusSeconds: todayFocus,
    todayQualifies,
    qualifyingThresholdSeconds: threshold,
  };
}
