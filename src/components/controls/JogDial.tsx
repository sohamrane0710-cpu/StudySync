import React, { useRef, useState, useCallback } from 'react';

export interface JogDialProps {
  id?: string;
  label?: string;
  value: number; // Value in minutes (or seconds if specified)
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  unit?: string;
  size?: number;
}

export const JogDial: React.FC<JogDialProps> = ({
  id = 'jog-dial',
  label = 'Duration Dial',
  value,
  onChange,
  min = 1,
  max = 120,
  step = 1,
  largeStep = 5,
  unit = 'min',
  size = 180,
}) => {
  const dialRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastAngle, setLastAngle] = useState<number | null>(null);

  // Clamp value between min and max
  const clamp = useCallback(
    (val: number) => {
      const clamped = Math.min(max, Math.max(min, val));
      return Math.round(clamped / step) * step;
    },
    [min, max, step],
  );

  // Calculate angle on 360 ring (0 to 360)
  // Let 0 min = 0 deg (top), 120 min = 360 deg
  const fraction = Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
  const currentAngle = fraction * 360;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!dialRef.current) return;
    dialRef.current.setPointerCapture(e.pointerId);
    setIsDragging(true);

    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    setLastAngle(angle);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || lastAngle === null || !dialRef.current) return;

    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

    let deltaAngle = angle - lastAngle;
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;

    const angleFraction = deltaAngle / 360;
    const deltaValue = angleFraction * (max - min);

    const newValue = clamp(value + deltaValue);
    if (newValue !== value) {
      onChange(newValue);
    }
    setLastAngle(angle);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dialRef.current && isDragging) {
      try {
        dialRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
    setIsDragging(false);
    setLastAngle(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        e.preventDefault();
        onChange(clamp(value + step));
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        e.preventDefault();
        onChange(clamp(value - step));
        break;
      case 'PageUp':
        e.preventDefault();
        onChange(clamp(value + largeStep));
        break;
      case 'PageDown':
        e.preventDefault();
        onChange(clamp(value - largeStep));
        break;
      case 'Home':
        e.preventDefault();
        onChange(min);
        break;
      case 'End':
        e.preventDefault();
        onChange(max);
        break;
    }
  };

  const strokeWidth = 8;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - fraction * circumference;

  // Knob indicator coordinates
  const knobAngleRad = ((currentAngle - 90) * Math.PI) / 180;
  const knobX = size / 2 + radius * Math.cos(knobAngleRad);
  const knobY = size / 2 + radius * Math.sin(knobAngleRad);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          ref={dialRef}
          id={id}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          width={size}
          height={size}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            outline: 'none',
          }}
        >
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
          />

          {/* Active Value Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-focus)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: isDragging ? 'none' : 'stroke-dashoffset 150ms ease-out' }}
          />

          {/* Rotary Knob Dot */}
          <circle
            cx={knobX}
            cy={knobY}
            r={strokeWidth}
            fill="#ffffff"
            stroke="var(--color-focus)"
            strokeWidth={2}
            filter="drop-shadow(0 2px 6px rgba(0,0,0,0.5))"
          />
        </svg>

        {/* Center Display with Direct Numeric Input & Increment/Decrement */}
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              aria-label="Decrease duration"
              onClick={() => onChange(clamp(value - step))}
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--color-text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              -
            </button>

            <input
              type="number"
              aria-label={`${label} numeric input`}
              min={min}
              max={max}
              value={value}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                if (!isNaN(parsed)) {
                  onChange(clamp(parsed));
                }
              }}
              style={{
                width: '54px',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: '#ffffff',
                fontFamily: 'var(--font-mono)',
                fontSize: '18px',
                fontWeight: 500,
                padding: '2px 4px',
              }}
            />

            <button
              type="button"
              aria-label="Increase duration"
              onClick={() => onChange(clamp(value + step))}
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--color-text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              +
            </button>
          </div>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--color-text-secondary)',
              marginTop: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {unit}
          </span>
        </div>
      </div>
    </div>
  );
};
