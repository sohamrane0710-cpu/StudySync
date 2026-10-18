import React, { useRef } from 'react';
import { useTimer } from '../../context/TimerContext';
import { AudioService } from '../../services/audioService';

export interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({ isOpen, onClose }) => {
  const { preferences, updatePreferences } = useTimer();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleSoundscapeChange = (type: 'none' | 'rain' | 'whitenoise' | 'drone' | 'custom') => {
    updatePreferences({
      ambientSound: type,
      ambientEnabled: type !== 'none',
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      AudioService.playCustomAudioFile(file, preferences.ambientVolume);
      updatePreferences({
        ambientSound: 'custom',
        ambientEnabled: true,
        customAudioName: file.name,
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-settings-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-l3"
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'rgba(18, 21, 26, 0.98)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-focus)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <h2 id="audio-settings-title" style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
              Audio & Alerts
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section 1: Timer Alert Chimes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                  Timer Chimes
                </span>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '1px' }}>
                  Gentle synthesized bells at step transitions
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.chimesEnabled}
                onChange={(e) => updatePreferences({ chimesEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: 'var(--color-focus)', cursor: 'pointer' }}
              />
            </div>

            {preferences.chimesEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', width: '60px' }}>
                    Volume
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={preferences.chimeVolume}
                    onChange={(e) => updatePreferences({ chimeVolume: parseFloat(e.target.value) })}
                    style={{ flex: 1, accentColor: 'var(--color-focus)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#ffffff', width: '32px', textAlign: 'right' }}>
                    {Math.round(preferences.chimeVolume * 100)}%
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => AudioService.playFocusCompleteChime(preferences.chimeVolume)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: 'var(--color-focus)',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Test Focus Bell
                  </button>
                  <button
                    type="button"
                    onClick={() => AudioService.playRestCompleteChime(preferences.chimeVolume)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: 'var(--color-rest)',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Test Rest Bell
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)' }} />

          {/* Section 2: Generative Offline Soundscapes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                  Ambient Soundscape
                </span>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '1px' }}>
                  Synthesized offline background soundscapes
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.ambientEnabled}
                onChange={(e) => updatePreferences({ ambientEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: 'var(--color-focus)', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {[
                { id: 'none', label: 'Off', desc: 'Silence' },
                { id: 'rain', label: 'Rainscape', desc: 'Filtered brown noise' },
                { id: 'whitenoise', label: 'White Noise', desc: 'Gentle static' },
                { id: 'drone', label: 'Theta Drone', desc: '4Hz binaural pulse' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSoundscapeChange(item.id as any)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    textAlign: 'left',
                    background: preferences.ambientSound === item.id ? 'rgba(0, 210, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                    border: preferences.ambientSound === item.id ? '1px solid var(--color-focus)' : '1px solid rgba(255, 255, 255, 0.07)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: preferences.ambientSound === item.id ? '#ffffff' : 'var(--color-text-primary)' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    {item.desc}
                  </div>
                </button>
              ))}
            </div>

            {/* Custom Local Audio File Selector */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: preferences.ambientSound === 'custom' ? 'rgba(0, 210, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: preferences.ambientSound === 'custom' ? '1px solid var(--color-focus)' : '1px solid rgba(255, 255, 255, 0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                  Custom Local Audio File
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  {preferences.customAudioName || 'Select an audio file from your computer'}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                Browse...
              </button>
            </div>

            {preferences.ambientEnabled && preferences.ambientSound !== 'none' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', width: '60px' }}>
                  Volume
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={preferences.ambientVolume}
                  onChange={(e) => updatePreferences({ ambientVolume: parseFloat(e.target.value) })}
                  style={{ flex: 1, accentColor: 'var(--color-focus)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#ffffff', width: '32px', textAlign: 'right' }}>
                  {Math.round(preferences.ambientVolume * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              background: 'var(--color-focus)',
              color: '#000000',
              fontWeight: 600,
              fontSize: '12px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
