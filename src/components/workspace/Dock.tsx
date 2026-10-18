import React from 'react';
import { useTimer } from '../../context/TimerContext';
import { formatHumanDuration } from '../../utils/timeFormat';

export interface DockProps {
  onOpenHistory: () => void;
  onOpenAudioSettings: () => void;
}

export const Dock: React.FC<DockProps> = ({ onOpenHistory, onOpenAudioSettings }) => {
  const { preferences, updatePreferences, streak } = useTimer();

  const isAudioActive = preferences.ambientEnabled && preferences.ambientSound !== 'none';

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (preferences.ambientSound === 'none') {
      updatePreferences({ ambientSound: 'rain', ambientEnabled: true });
    } else {
      updatePreferences({ ambientEnabled: !preferences.ambientEnabled });
    }
  };

  const getAudioLabel = () => {
    switch (preferences.ambientSound) {
      case 'rain':
        return 'Rainscape';
      case 'whitenoise':
        return 'White Noise';
      case 'drone':
        return 'Theta Drone';
      case 'custom':
        return preferences.customAudioName || 'Local Audio';
      default:
        return 'Ambient Off';
    }
  };

  return (
    <footer
      role="contentinfo"
      aria-label="StudySync utility dock"
      className="glass-l2"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        borderRadius: '9999px',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        zIndex: 40,
        maxWidth: '92vw',
        userSelect: 'none',
      }}
    >
      {/* Module A: Ambient Soundscape */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <button
          type="button"
          aria-label={isAudioActive ? 'Pause ambient audio' : 'Play ambient audio'}
          onClick={toggleAudio}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: isAudioActive ? 'var(--color-focus-bg)' : 'rgba(255, 255, 255, 0.05)',
            border: isAudioActive ? '1px solid var(--color-focus)' : '1px solid rgba(255, 255, 255, 0.1)',
            color: isAudioActive ? 'var(--color-focus)' : 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          {isAudioActive ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '1px' }}>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        <button
          type="button"
          aria-label="Configure ambient soundscapes"
          onClick={onOpenAudioSettings}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: isAudioActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            }}
          >
            {getAudioLabel()}
          </span>

          {/* Micro Audio Equalizer Visualization */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '8px', marginTop: '2px' }}>
            {[1, 2, 3, 4].map((bar) => (
              <span
                key={bar}
                style={{
                  width: '2px',
                  height: isAudioActive ? `${(bar % 2 === 0 ? 8 : 4)}px` : '3px',
                  background: isAudioActive ? 'var(--color-focus)' : 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '1px',
                  transition: 'height 250ms ease',
                }}
              />
            ))}
          </div>
        </button>
      </div>

      {/* Subtle Divider */}
      <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.08)' }} />

      {/* Module B: Streak & Metric Module */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: streak.streakDays > 0 ? 'var(--color-alert-bg)' : 'rgba(255, 255, 255, 0.04)',
            border: streak.streakDays > 0 ? '1px solid var(--color-alert)' : '1px solid rgba(255, 255, 255, 0.08)',
            color: streak.streakDays > 0 ? 'var(--color-alert)' : 'var(--color-text-muted)',
          }}
        >
          {/* Flame Icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill={streak.streakDays > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
          </svg>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 600,
                color: streak.streakDays > 0 ? '#ffffff' : 'var(--color-text-muted)',
              }}
            >
              {streak.streakDays}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
              {streak.streakDays === 1 ? 'day streak' : 'days streak'}
            </span>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
            Today: {formatHumanDuration(streak.todayFocusSeconds)}
          </span>
        </div>
      </div>

      {/* Subtle Divider */}
      <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.08)' }} />

      {/* Module C: Drawer Trigger Button */}
      <button
        type="button"
        aria-label="Open session history drawer"
        onClick={onOpenHistory}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 12px',
          borderRadius: '9999px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          color: 'var(--color-text-primary)',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20v-6M6 20V10M18 20V4" />
        </svg>
        <span>History</span>
      </button>
    </footer>
  );
};
