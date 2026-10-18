import type { IStudySyncStorage, UserPreferences } from '../types/storage';
import { DEFAULT_PREFERENCES } from '../types/storage';
import type { SessionRecord, ActiveRunRecovery } from '../types/session';
import type { ModeDefinition } from '../types/timer';

const DB_NAME = 'studysync_db';
const DB_VERSION = 1;

export class IndexedDBStorage implements IStudySyncStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryFallback = {
    sessions: new Map<string, SessionRecord>(),
    customModes: new Map<string, ModeDefinition>(),
    preferences: { ...DEFAULT_PREFERENCES },
    recovery: null as ActiveRunRecovery | null,
  };
  private useFallback: boolean = false;

  private async getDB(): Promise<IDBDatabase> {
    if (this.useFallback) {
      throw new Error('Using in-memory fallback');
    }
    if (typeof indexedDB === 'undefined') {
      this.useFallback = true;
      throw new Error('IndexedDB unavailable');
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains('sessions')) {
              const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
              sessionStore.createIndex('startedAt', 'startedAt', { unique: false });
              sessionStore.createIndex('outcome', 'outcome', { unique: false });
            }

            if (!db.objectStoreNames.contains('custom_modes')) {
              db.createObjectStore('custom_modes', { keyPath: 'id' });
            }

            if (!db.objectStoreNames.contains('preferences')) {
              db.createObjectStore('preferences', { keyPath: 'key' });
            }

            if (!db.objectStoreNames.contains('recovery')) {
              db.createObjectStore('recovery', { keyPath: 'key' });
            }
          };

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => {
            this.useFallback = true;
            reject(request.error);
          };
        } catch (err) {
          this.useFallback = true;
          reject(err);
        }
      });
    }

    return this.dbPromise;
  }

  public async getSessions(filter?: 'all' | 'completed' | 'interrupted'): Promise<SessionRecord[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sessions', 'readonly');
        const store = tx.objectStore('sessions');
        const request = store.getAll();

        request.onsuccess = () => {
          let results = (request.result as SessionRecord[]) || [];
          results.sort((a, b) => b.startedAt - a.startedAt);

          if (filter === 'completed') {
            results = results.filter((s) => s.outcome === 'completed');
          } else if (filter === 'interrupted') {
            results = results.filter((s) => s.outcome === 'stopped' || s.outcome === 'interrupted');
          }
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    } catch {
      let results = Array.from(this.memoryFallback.sessions.values());
      results.sort((a, b) => b.startedAt - a.startedAt);
      if (filter === 'completed') {
        results = results.filter((s) => s.outcome === 'completed');
      } else if (filter === 'interrupted') {
        results = results.filter((s) => s.outcome === 'stopped' || s.outcome === 'interrupted');
      }
      return results;
    }
  }

  public async saveSession(session: SessionRecord): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sessions', 'readwrite');
        const store = tx.objectStore('sessions');
        const req = store.put(session);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      this.memoryFallback.sessions.set(session.id, session);
    }
  }

  public async clearSessions(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['sessions', 'recovery'], 'readwrite');
        tx.objectStore('sessions').clear();
        tx.objectStore('recovery').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      this.memoryFallback.sessions.clear();
      this.memoryFallback.recovery = null;
    }
  }

  public async getCustomModes(): Promise<ModeDefinition[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('custom_modes', 'readonly');
        const store = tx.objectStore('custom_modes');
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as ModeDefinition[]) || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return Array.from(this.memoryFallback.customModes.values());
    }
  }

  public async saveCustomMode(mode: ModeDefinition): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('custom_modes', 'readwrite');
        const store = tx.objectStore('custom_modes');
        const req = store.put(mode);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      this.memoryFallback.customModes.set(mode.id, mode);
    }
  }

  public async deleteCustomMode(modeId: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('custom_modes', 'readwrite');
        const store = tx.objectStore('custom_modes');
        const req = store.delete(modeId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      this.memoryFallback.customModes.delete(modeId);
    }
  }

  public async getPreferences(): Promise<UserPreferences> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('preferences', 'readonly');
        const store = tx.objectStore('preferences');
        const req = store.get('user_prefs');
        req.onsuccess = () => {
          if (req.result && req.result.data) {
            resolve({ ...DEFAULT_PREFERENCES, ...req.result.data });
          } else {
            resolve({ ...DEFAULT_PREFERENCES });
          }
        };
        req.onerror = () => resolve({ ...DEFAULT_PREFERENCES });
      });
    } catch {
      return { ...this.memoryFallback.preferences };
    }
  }

  public async savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
    try {
      const current = await this.getPreferences();
      const updated = { ...current, ...prefs };
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('preferences', 'readwrite');
        const store = tx.objectStore('preferences');
        const req = store.put({ key: 'user_prefs', data: updated });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      this.memoryFallback.preferences = { ...this.memoryFallback.preferences, ...prefs };
    }
  }

  public async getRecoveryState(): Promise<ActiveRunRecovery | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('recovery', 'readonly');
        const store = tx.objectStore('recovery');
        const req = store.get('active_run');
        req.onsuccess = () => {
          resolve(req.result ? req.result.data : null);
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return this.memoryFallback.recovery;
    }
  }

  public async saveRecoveryState(recovery: ActiveRunRecovery | null): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('recovery', 'readwrite');
        const store = tx.objectStore('recovery');
        if (recovery === null) {
          const req = store.delete('active_run');
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        } else {
          const req = store.put({ key: 'active_run', data: recovery });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        }
      });
    } catch {
      this.memoryFallback.recovery = recovery;
    }
  }
}
