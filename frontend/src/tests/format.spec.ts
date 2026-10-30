import { describe, it, expect } from 'vitest';
import {
  formatTimerDigits,
  formatDurationHuman,
  isValidHexColor,
} from '@/lib/utils/format';

describe('format utilities', () => {
  describe('formatTimerDigits', () => {
    it('formats standard 25-minute Pomodoro duration', () => {
      expect(formatTimerDigits(1500)).toBe('25:00');
    });

    it('formats 5-minute break duration with zero-padding', () => {
      expect(formatTimerDigits(300)).toBe('05:00');
    });

    it('formats single-digit seconds accurately', () => {
      expect(formatTimerDigits(65)).toBe('01:05');
      expect(formatTimerDigits(9)).toBe('00:09');
    });

    it('formats hours for long sessions (> 3600 seconds)', () => {
      expect(formatTimerDigits(3665)).toBe('1:01:05');
      expect(formatTimerDigits(7200)).toBe('2:00:00');
    });

    it('clamps negative or zero seconds to 00:00', () => {
      expect(formatTimerDigits(0)).toBe('00:00');
      expect(formatTimerDigits(-15)).toBe('00:00');
    });
  });

  describe('formatDurationHuman', () => {
    it('formats minutes', () => {
      expect(formatDurationHuman(1500)).toBe('25m');
      expect(formatDurationHuman(300)).toBe('5m');
    });

    it('formats exact hours and mixed hours/minutes', () => {
      expect(formatDurationHuman(3600)).toBe('1h');
      expect(formatDurationHuman(5400)).toBe('1h 30m');
    });

    it('handles zero or negative duration', () => {
      expect(formatDurationHuman(0)).toBe('0m');
      expect(formatDurationHuman(-50)).toBe('0m');
    });
  });

  describe('isValidHexColor', () => {
    it('accepts valid 6-character hex colors', () => {
      expect(isValidHexColor('#6366F1')).toBe(true);
      expect(isValidHexColor('#F59E0B')).toBe(true);
      expect(isValidHexColor('#000000')).toBe(true);
      expect(isValidHexColor('#ffffff')).toBe(true);
    });

    it('accepts valid 3-character shorthand hex colors', () => {
      expect(isValidHexColor('#FFF')).toBe(true);
      expect(isValidHexColor('#123')).toBe(true);
    });

    it('rejects invalid hex formats', () => {
      expect(isValidHexColor('6366F1')).toBe(false); // missing hash
      expect(isValidHexColor('#6366F12')).toBe(false); // 7 chars
      expect(isValidHexColor('#ZZZZZZ')).toBe(false); // invalid hex chars
      expect(isValidHexColor('red')).toBe(false);
    });
  });
});
