import React, { useState, useEffect } from 'react';
import { useTimer } from '../../context/TimerContext';

export interface UtilityBarProps {
  onOpenModeSelector: () => void;
  onOpenAudioSettings: () => void;
}

export const UtilityBar: React.FC<UtilityBarProps> = ({
  onOpenModeSelector,
  onOpenAudioSettings,
}) => {
  const { snapshot, preferences, updatePreferences } = useTimer();
  const [isHoveredOrFocused, setIsHoveredOrFocused] = useState(false);

  // During active deep focus, bar fades slightly unless pointer is near top or focused
  const isDeepFocus = snapshot.state === 'running' && snapshot.currentStep.type === 'focus';
  const opacity = !isDeepFocus || isHoveredOrFocused ? 1 : 0.35;

  // Listen to mouse movement in top 72px boundary
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 72) {
        setIsHoveredOrFocused(true);
      } else {
        setIsHoveredOrFocused(false);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const toggleAmbient = () => {
    if (preferences.ambientSound === 'none') {
      updatePreferences({ ambientSound: 'rain', ambientEnabled: true });
    } else {
      updatePreferences({ ambientEnabled: !preferences.ambientEnabled });
    }
  };

  return (
    <header
      role="banner"
      onMouseEnter={() => setIsHoveredOrFocused(true)}
      onMouseLeave={() => setIsHoveredOrFocused(false)}
      onFocus={() => setIsHoveredOrFocused(true)}
      onBlur={() => setIsHoveredOrFocused(false)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 50,
        transition: 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1), background-color 300ms ease',
        opacity,
        background: isHoveredOrFocused || !isDeepFocus ? 'rgba(11, 13, 17, 0.75)' : 'transparent',
        backdropFilter: isHoveredOrFocused || !isDeepFocus ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: isHoveredOrFocused || !isDeepFocus ? 'blur(12px)' : 'none',
        borderBottom:
          isHoveredOrFocused || !isDeepFocus ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
      }}
    >
      {/* Left: StudySync Logo & Emblem */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--color-focus) 0%, rgba(255,255,255,0.05) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0, 210, 255, 0.2)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <span
          style={{
            fontWeight: 600,
            fontSize: '15px',
            letterSpacing: '-0.02em',
            color: '#f9fafb',
          }}
        >
          Study<span style={{ color: 'var(--color-focus)' }}>Sync</span>
        </span>
      </div>

      {/* Center: Solo workspace presence pill (extensible for multiplayer in future) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '4px 14px',
          borderRadius: '9999px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--color-focus)',
            boxShadow: '0 0 6px var(--color-focus)',
          }}
        />
        <span>Solo workspace</span>
      </div>

      {/* Right: Mode Selector and Ambient Audio quick-toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          aria-label="Change study mode"
          onClick={onOpenModeSelector}
          disabled={snapshot.state === 'running' || snapshot.state === 'paused'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: snapshot.state === 'running' || snapshot.state === 'paused' ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: snapshot.state === 'running' || snapshot.state === 'paused' ? 'not-allowed' : 'pointer',
            transition: 'background var(--transition-fast)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <span>{snapshot.mode.name}</span>
        </button>

        <button
          type="button"
          aria-label="Toggle ambient audio"
          onClick={toggleAmbient}
          title={preferences.ambientEnabled ? 'Pause ambient audio' : 'Play ambient audio'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: preferences.ambientEnabled ? 'var(--color-focus-bg)' : 'rgba(255, 255, 255, 0.04)',
            border: preferences.ambientEnabled ? '1px solid var(--color-focus)' : '1px solid rgba(255, 255, 255, 0.08)',
            color: preferences.ambientEnabled ? 'var(--color-focus)' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {preferences.ambientEnabled ? (
              <>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </>
            ) : (
              <line x1="23" y1="9" x2="17" y2="15" />
            )}
          </svg>
        </button>

        <button
          type="button"
          aria-label="Open audio settings"
          onClick={onOpenAudioSettings}
          title="Audio settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
};
