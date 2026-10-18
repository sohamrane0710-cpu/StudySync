import type { SessionRecord, ActiveRunRecovery } from './session';
import type { ModeDefinition } from './timer';

export interface UserPreferences {
  sessionLabel: string;
  activeModeId: string;
  chimesEnabled: boolean;
  chimeVolume: number; // 0..1
  ambientEnabled: boolean;
  ambientSound: 'none' | 'rain' | 'whitenoise' | 'drone' | 'custom';
  ambientVolume: number; // 0..1
  customAudioName?: string;
  reducedMotion: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  sessionLabel: '#Study_Session',
  activeModeId: 'classic_pomodoro',
  chimesEnabled: true,
  chimeVolume: 0.7,
  ambientEnabled: false,
  ambientSound: 'none',
  ambientVolume: 0.5,
  reducedMotion: false,
};

export interface IStudySyncStorage {
  getSessions(filter?: 'all' | 'completed' | 'interrupted'): Promise<SessionRecord[]>;
  saveSession(session: SessionRecord): Promise<void>;
  clearSessions(): Promise<void>;

  getCustomModes(): Promise<ModeDefinition[]>;
  saveCustomMode(mode: ModeDefinition): Promise<void>;
  deleteCustomMode(modeId: string): Promise<void>;

  getPreferences(): Promise<UserPreferences>;
  savePreferences(prefs: Partial<UserPreferences>): Promise<void>;

  getRecoveryState(): Promise<ActiveRunRecovery | null>;
  saveRecoveryState(recovery: ActiveRunRecovery | null): Promise<void>;
}
