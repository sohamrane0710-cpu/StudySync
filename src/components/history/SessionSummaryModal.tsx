import React from 'react';
import { useTimer } from '../../context/TimerContext';
import { formatHumanDuration } from '../../utils/timeFormat';

export const SessionSummaryModal: React.FC = () => {
  const { summarySession, closeSummaryModal } = useTimer();

  if (!summarySession) return null;

  const isCompleted = summarySession.outcome === 'completed';
  const badgeColor = isCompleted ? 'var(--color-rest)' : 'var(--color-alert)';
  const badgeBg = isCompleted ? 'var(--color-rest-bg)' : 'var(--color-alert-bg)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-modal-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={closeSummaryModal}
    >
      <div
        className="glass-l3"
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'rgba(18, 21, 26, 0.95)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '16px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Outcome Icon */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: badgeBg,
            border: `1px solid ${badgeColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: badgeColor,
          }}
        >
          {isCompleted ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          )}
        </div>

        <div>
          <div
            style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600,
              background: badgeBg,
              color: badgeColor,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '6px',
            }}
          >
            {isCompleted ? 'Sequence Completed' : 'Session Stopped'}
          </div>
          <h2 id="summary-modal-title" style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>
            Session Summary
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            {summarySession.sessionLabel} • {summarySession.modeName}
          </p>
        </div>

        {/* Hero Focus Time Card */}
        <div
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '12px',
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Focus Time
            </div>
            <div className="font-readout" style={{ fontSize: '18px', fontWeight: 500, color: 'var(--color-focus)', marginTop: '4px' }}>
              {formatHumanDuration(summarySession.totalFocusSeconds)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Rest Time
            </div>
            <div className="font-readout" style={{ fontSize: '18px', fontWeight: 500, color: 'var(--color-rest)', marginTop: '4px' }}>
              {formatHumanDuration(summarySession.totalRestSeconds)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Intervals
            </div>
            <div className="font-readout" style={{ fontSize: '18px', fontWeight: 500, color: '#ffffff', marginTop: '4px' }}>
              {summarySession.completedIntervals}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={closeSummaryModal}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            background: 'var(--color-focus)',
            color: '#000000',
            fontWeight: 600,
            fontSize: '13px',
            border: 'none',
            cursor: 'pointer',
            transition: 'opacity var(--transition-fast)',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
};
