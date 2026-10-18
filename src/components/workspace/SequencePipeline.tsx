import React, { useState, useRef, useEffect } from 'react';
import { useTimer } from '../../context/TimerContext';
import { formatHumanDuration } from '../../utils/timeFormat';

export const SequencePipeline: React.FC = () => {
  const { snapshot, setSessionLabel } = useTimer();
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(snapshot.sessionLabel);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLabelDraft(snapshot.sessionLabel);
  }, [snapshot.sessionLabel]);

  useEffect(() => {
    if (isEditingLabel && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingLabel]);

  const handleSaveLabel = () => {
    const clean = labelDraft.trim().slice(0, 40);
    const finalLabel = clean.length > 0 ? (clean.startsWith('#') ? clean : `#${clean}`) : '#Study_Session';
    setSessionLabel(finalLabel);
    setIsEditingLabel(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveLabel();
    } else if (e.key === 'Escape') {
      setLabelDraft(snapshot.sessionLabel);
      setIsEditingLabel(false);
    }
  };

  const steps = snapshot.mode.steps;
  const loopCount = snapshot.mode.loopCount;
  const loopDisplay = loopCount === 0 ? `Loop ${snapshot.currentLoop}` : `Loop ${snapshot.currentLoop} of ${loopCount}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '14px',
        width: '100%',
        maxWidth: '680px',
        margin: '0 auto',
        padding: '0 16px',
        userSelect: 'none',
      }}
    >
      {/* Top Row: Editable Context Pill and Loop Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {isEditingLabel ? (
          <input
            ref={inputRef}
            type="text"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={handleSaveLabel}
            onKeyDown={handleKeyDown}
            maxLength={40}
            style={{
              padding: '4px 12px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--color-focus)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              outline: 'none',
              width: '160px',
              textAlign: 'center',
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingLabel(true)}
            aria-label="Edit session label"
            title="Click to rename session label"
            className="glass-l1"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 14px',
              borderRadius: '9999px',
              color: 'var(--color-text-primary)',
              fontSize: '12px',
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              transition: 'border-color var(--transition-fast), background var(--transition-fast)',
            }}
          >
            <span>{snapshot.sessionLabel}</span>
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-text-secondary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}

        <span
          style={{
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        >
          {loopDisplay}
        </span>
      </div>

      {/* Sequence Breadcrumbs Pipeline */}
      <div
        role="region"
        aria-label="Sequence pipeline"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          width: '100%',
          overflowX: 'auto',
          padding: '6px 8px',
        }}
      >
        {steps.map((step, idx) => {
          const isCompleted = idx < snapshot.currentStepIndex;
          const isActive = idx === snapshot.currentStepIndex;

          const accentColor =
            step.type === 'focus' ? 'var(--color-focus)' : 'var(--color-rest)';
          const accentBg =
            step.type === 'focus' ? 'var(--color-focus-bg)' : 'var(--color-rest-bg)';

          return (
            <React.Fragment key={step.id}>
              {/* Connector track before node */}
              {idx > 0 && (
                <div
                  style={{
                    width: '16px',
                    height: '0px',
                    borderTop: '1px dashed rgba(255, 255, 255, 0.15)',
                    flexShrink: 0,
                  }}
                />
              )}

              {/* Step Node */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: 500,
                  transition: 'all 200ms ease',
                  flexShrink: 0,
                  background: isActive
                    ? accentBg
                    : isCompleted
                      ? 'rgba(255, 255, 255, 0.02)'
                      : 'rgba(255, 255, 255, 0.01)',
                  border: isActive
                    ? `1px solid ${accentColor}`
                    : isCompleted
                      ? '1px solid rgba(255, 255, 255, 0.12)'
                      : '1px solid rgba(255, 255, 255, 0.05)',
                  boxShadow: isActive ? `0 0 12px ${step.type === 'focus' ? 'var(--color-focus-glow)' : 'var(--color-rest-glow)'}` : 'none',
                  color: isActive ? '#ffffff' : isCompleted ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
                }}
              >
                {/* Status Dot / Checkmark */}
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: isActive ? accentColor : 'rgba(255, 255, 255, 0.2)',
                    }}
                  />
                )}

                <span>{step.label}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: isActive ? accentColor : 'var(--color-text-muted)',
                  }}
                >
                  {formatHumanDuration(step.durationSeconds)}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
