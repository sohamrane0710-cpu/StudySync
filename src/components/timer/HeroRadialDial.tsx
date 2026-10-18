import React from 'react';
import { useTimer } from '../../context/TimerContext';
import { formatCountdown } from '../../utils/timeFormat';

export const HeroRadialDial: React.FC = () => {
  const { snapshot } = useTimer();

  const step = snapshot.currentStep;
  const isFocus = step.type === 'focus';
  const accentColor = isFocus ? 'var(--color-focus)' : 'var(--color-rest)';
  const accentGlow = isFocus ? 'var(--color-focus-glow)' : 'var(--color-rest-glow)';

  // Calculate SVG dimensions
  const size = 320;
  const strokeWidth = 4;
  const radius = (size - strokeWidth * 2 - 16) / 2;
  const circumference = 2 * Math.PI * radius;

  // Progress ring offset (progress is from 0.0 to 1.0)
  // At start: progress = 0 -> remaining = total -> ring full or depleting?
  // Standard study timer: ring depletes as countdown proceeds (or fills up)
  // Let's have it show remaining fraction: remainingSeconds / totalStepSeconds
  const remainingFraction =
    snapshot.totalStepSeconds > 0
      ? Math.max(0, Math.min(1, snapshot.remainingSeconds / snapshot.totalStepSeconds))
      : 0;
  const strokeDashoffset = circumference * (1 - remainingFraction);

  // Status text & pill styling
  let statusText = 'Ready';
  let statusBg = 'rgba(255, 255, 255, 0.04)';
  let statusColor = 'var(--color-text-secondary)';

  if (snapshot.state === 'running') {
    statusText = isFocus ? 'Focusing' : 'Resting';
    statusBg = isFocus ? 'var(--color-focus-bg)' : 'var(--color-rest-bg)';
    statusColor = accentColor;
  } else if (snapshot.state === 'paused') {
    statusText = 'Paused';
    statusBg = 'var(--color-alert-bg)';
    statusColor = 'var(--color-alert)';
  } else if (snapshot.state === 'completed') {
    statusText = 'Completed';
    statusBg = 'var(--color-rest-bg)';
    statusColor = 'var(--color-rest)';
  }

  // Interval display: e.g. "Interval 1 of 4"
  const focusSteps = snapshot.mode.steps.filter((s) => s.type === 'focus');
  const totalPlannedFocus = snapshot.totalPlannedIntervals || focusSteps.length;
  const intervalDisplay =
    snapshot.mode.loopCount === 0
      ? `Interval ${snapshot.completedIntervals + 1} (Infinite)`
      : `Interval ${Math.min(totalPlannedFocus, snapshot.completedIntervals + (isFocus ? 1 : 0))} of ${totalPlannedFocus}`;

  return (
    <div
      role="region"
      aria-label="Study timer dial"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: `${size}px`,
        aspectRatio: '1 / 1',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size} ${size}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: 'rotate(-90deg)',
          overflow: 'visible',
        }}
      >
        <defs>
          <filter id="halo-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Layer 1: Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={strokeWidth}
        />

        {/* Layer 3: Ambient Halo (subtle glow layer, reduced in prefers-reduced-motion) */}
        <circle
          className="halo-glow"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth={strokeWidth + 2}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          filter="url(#halo-filter)"
          opacity={snapshot.state === 'running' ? 0.35 : 0.15}
          style={{ transition: 'stroke-dashoffset 200ms linear, stroke 300ms ease' }}
        />

        {/* Layer 2: Progress Ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 200ms linear, stroke 300ms ease' }}
        />
      </svg>

      {/* Internal Content (Center Layout) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          zIndex: 10,
          gap: '6px',
        }}
      >
        {/* State Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 10px',
            borderRadius: '9999px',
            background: statusBg,
            border: `1px solid ${statusColor}33`,
            color: statusColor,
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            transition: 'all 200ms ease',
          }}
        >
          {snapshot.state === 'running' && (
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: statusColor,
                boxShadow: `0 0 6px ${statusColor}`,
              }}
            />
          )}
          <span>{statusText}</span>
        </div>

        {/* Dominant Large Countdown Readout */}
        <div
          className="font-readout"
          aria-live="polite"
          style={{
            fontSize: 'clamp(3rem, 7vw, 4.5rem)',
            fontWeight: 300,
            color: '#f9fafb',
            lineHeight: 1,
            margin: '4px 0',
            textShadow: snapshot.state === 'running' ? `0 0 32px ${accentGlow}` : 'none',
          }}
        >
          {formatCountdown(snapshot.remainingSeconds)}
        </div>

        {/* Current Step Label */}
        <div
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          {step.label}
        </div>

        {/* Interval Indicator */}
        <div
          style={{
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            fontWeight: 400,
          }}
        >
          {intervalDisplay}
        </div>
      </div>
    </div>
  );
};
