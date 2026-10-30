import { format, isToday, isYesterday, parseISO } from 'date-fns';

/**
 * Formats seconds into MM:SS or HH:MM:SS
 */
export function formatTimerDigits(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export const formatSecondsToMMSS = formatTimerDigits;

/**
 * Formats duration in seconds into a friendly string like "25 mins" or "1h 30m"
 */
export function formatDurationHuman(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);

  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

export const formatSecondsToHuman = formatDurationHuman;

/**
 * Formats an ISO date into a localized human string
 */
export function formatSessionDate(isoString: string): string {
  try {
    const date = parseISO(isoString);
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    }
    if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    }
    return format(date, 'MMM d, yyyy · h:mm a');
  } catch {
    return isoString;
  }
}

export const formatDate = formatSessionDate;

export function formatTime(isoString: string): string {
  try {
    return format(parseISO(isoString), 'h:mm a');
  } catch {
    return '';
  }
}

/**
 * Validates whether a string is a valid hex color code
 */
export function isValidHexColor(color: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);
}
