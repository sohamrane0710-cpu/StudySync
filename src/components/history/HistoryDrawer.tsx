import React, { useState, useEffect } from 'react';
import { useTimer } from '../../context/TimerContext';
import { formatHumanDuration, formatSessionDateTime } from '../../utils/timeFormat';
import type { SessionOutcome } from '../../types/session';

export interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ isOpen, onClose }) => {
  const { sessions, streak, clearAllSessions } = useTimer();
  const [filter, setFilter] = useState<'all' | 'completed' | 'interrupted'>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredSessions = sessions.filter((s) => {
    if (filter === 'completed') return s.outcome === 'completed';
    if (filter === 'interrupted') return s.outcome === 'stopped' || s.outcome === 'interrupted';
    return true;
  });

  const getOutcomeBadge = (outcome: SessionOutcome) => {
    switch (outcome) {
      case 'completed':
        return { label: 'Completed', bg: 'var(--color-rest-bg)', color: 'var(--color-rest)' };
      case 'stopped':
      case 'interrupted':
        return { label: 'Stopped', bg: 'rgba(255, 255, 255, 0.05)', color: 'var(--color-text-secondary)' };
      default:
        return { label: outcome, bg: 'rgba(255, 255, 255, 0.05)', color: 'var(--color-text-secondary)' };
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-drawer-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        className="glass-l3"
        style={{
          width: '100%',
          maxWidth: '440px',
          height: '100%',
          background: 'rgba(18, 21, 26, 0.95)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-focus)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20v-6M6 20V10M18 20V4" />
            </svg>
            <h2 id="history-drawer-title" style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
              Focus History
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close history drawer"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Hero Today Summary Card */}
        <div style={{ padding: '20px 24px 12px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
              border: '1px solid rgba(0, 210, 255, 0.15)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Today's Focus
              </div>
              <div className="font-readout" style={{ fontSize: '26px', fontWeight: 400, color: '#ffffff', marginTop: '2px' }}>
                {formatHumanDuration(streak.todayFocusSeconds)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Active Streak
              </div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-alert)', marginTop: '2px' }}>
                {streak.streakDays} {streak.streakDays === 1 ? 'day' : 'days'}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', padding: '0 24px 12px' }}>
          {(['all', 'completed', 'interrupted'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              style={{
                padding: '4px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'capitalize',
                background: filter === tab ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                border: filter === tab ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.04)',
                color: filter === tab ? '#ffffff' : 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              {tab === 'all' ? `All (${sessions.length})` : tab}
            </button>
          ))}
        </div>

        {/* Session Records List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredSessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--color-text-muted)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', opacity: 0.4 }}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <p style={{ fontSize: '13px' }}>No session records found.</p>
              <p style={{ fontSize: '11px', marginTop: '4px' }}>Complete or stop a focus session to record history.</p>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const badge = getOutcomeBadge(session.outcome);
              return (
                <div
                  key={session.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f3f4f6', fontFamily: 'var(--font-mono)' }}>
                      {session.sessionLabel}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 600,
                        background: badge.bg,
                        color: badge.color,
                        textTransform: 'uppercase',
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    <span>{session.modeName}</span>
                    <span>{formatSessionDateTime(session.startedAt)}</span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      paddingTop: '6px',
                      marginTop: '2px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                      fontSize: '11px',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Focus: </span>
                      <span style={{ color: 'var(--color-focus)', fontWeight: 500 }}>
                        {formatHumanDuration(session.totalFocusSeconds)}
                      </span>
                    </div>
                    {session.totalRestSeconds > 0 && (
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Rest: </span>
                        <span style={{ color: 'var(--color-rest)', fontWeight: 500 }}>
                          {formatHumanDuration(session.totalRestSeconds)}
                        </span>
                      </div>
                    )}
                    <div style={{ marginLeft: 'auto' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Intervals: </span>
                      <span style={{ color: '#ffffff', fontWeight: 500 }}>
                        {session.completedIntervals}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Clear History */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.07)' }}>
          {showClearConfirm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-alert)' }}>
                Are you sure? This permanently clears all session history.
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    await clearAllSessions();
                    setShowClearConfirm(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '6px',
                    background: 'var(--color-alert)',
                    color: '#000000',
                    fontWeight: 600,
                    fontSize: '12px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Yes, Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#ffffff',
                    fontSize: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={sessions.length === 0}
              onClick={() => setShowClearConfirm(true)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                color: sessions.length === 0 ? 'var(--color-text-faint)' : 'var(--color-text-muted)',
                fontSize: '12px',
                cursor: sessions.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Clear Session History
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
