import type { TimerMode } from './timer';

export type TimerFace = 'ring' | 'digital' | 'minimal' | 'flip';
export type ThemePreset = 'dark-glass' | 'light-minimal' | 'nord';
export type AmbientPreset = 'none' | 'rain' | 'waves' | 'cafe' | 'white-noise';

export interface UserPreference {
  id: string;
  userId: string;
  theme: string;
  timerFace: TimerFace;
  ambientPreset?: AmbientPreset | string;
  soundVolume: number; // 0.0 to 1.0
  soundEnabled: boolean;
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  defaultTimerModeId?: string | null;
  defaultTimerMode?: TimerMode | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePreferencesPayload {
  theme?: string;
  timerFace?: TimerFace;
  ambientPreset?: string;
  soundVolume?: number;
  soundEnabled?: boolean;
  autoStartBreaks?: boolean;
  autoStartPomodoros?: boolean;
  defaultTimerModeId?: string | null;
}
