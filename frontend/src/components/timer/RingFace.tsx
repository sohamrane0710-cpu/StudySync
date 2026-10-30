import React, { useMemo } from 'react';
import { formatSecondsToMMSS } from '@/lib/utils/format';
import type { TimerDirection, TimerPhase } from '@/types/timer';
import { cn } from '@/lib/utils/cn';

interface RingFaceProps {
  displaySeconds: number;
  targetDuration: number;
  phase: TimerPhase;
  isRunning: boolean;
  isPaused?: boolean;
  cycleCount?: number;
  direction?: TimerDirection;
  stepName?: string;
}

export const RingFace: React.FC<RingFaceProps> = ({
  displaySeconds,
  targetDuration,
  phase,
  isRunning,
  isPaused = false,
  cycleCount = 0,
  direction = 'COUNTDOWN',
  stepName,
}) => {
  const isBreak = phase.includes('BREAK');
  const isCountUp = direction === 'COUNT_UP';

  // Dial geometry constants
  const size = 360;
  const center = size / 2; // 180
  const radius = 142;
  const strokeWidth = 7;
  const circumference = 2 * Math.PI * radius;

  // Safe progress ratio 0.0 to 1.0 (clamped)
  const progress = targetDuration > 0
    ? Math.min(
        1,
        Math.max(
          0,
          isCountUp
            ? displaySeconds / targetDuration
            : (targetDuration - displaySeconds) / targetDuration,
        ),
      )
    : 0;

  const strokeDashoffset = circumference - progress * circumference;

  // Leading edge coordinates on the progress arc (-90deg is top / 12 o'clock)
  const angleRad = -Math.PI / 2 + progress * 2 * Math.PI;
  const leadingX = center + radius * Math.cos(angleRad);
  const leadingY = center + radius * Math.sin(angleRad);

  // Optical chronometer 60 radial tick marks
  const tickMarks = useMemo(() => {
    const ticks = [];
    const tickCount = 60;
    const outerR = 160;

    for (let i = 0; i < tickCount; i++) {
      const isMajor = i % 5 === 0;
      const length = isMajor ? 8 : 4;
      const innerR = outerR - length;
      const angle = (i * 360) / tickCount - 90;
      const rad = (angle * Math.PI) / 180;

      const x1 = center + innerR * Math.cos(rad);
      const y1 = center + innerR * Math.sin(rad);
      const x2 = center + outerR * Math.cos(rad);
      const y2 = center + outerR * Math.sin(rad);

      ticks.push(
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={isMajor ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)'}
          strokeWidth={isMajor ? 1.5 : 1}
          strokeLinecap="round"
        />
      );
    }
    return ticks;
  }, [center]);

  // Color tokens
  const accentGradientId = isBreak ? 'break-dial-grad' : 'focus-dial-grad';
  const glowColor = isBreak ? 'rgba(20, 184, 166, 0.35)' : 'rgba(245, 158, 11, 0.35)';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center select-none transition-transform duration-700 w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96',
        isRunning && 'scale-[1.02] sm:scale-105',
        isPaused && 'scale-100 opacity-90'
      )}
    >
      {/* SVG Canvas for Chronometer Geometry */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 pointer-events-none drop-shadow-2xl"
      >
        <defs>
          {/* Focus Warm Amber Gradient */}
          <linearGradient id="focus-dial-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="70%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>

          {/* Break Cool Teal Gradient */}
          <linearGradient id="break-dial-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="60%" stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#0F766E" />
          </linearGradient>

          {/* Glow Filters */}
          <filter id="dial-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="leading-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Dial Ambient Background Disk */}
        <circle
          cx={center}
          cy={center}
          r={radius + 18}
          fill="rgba(18, 21, 26, 0.45)"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="1"
        />

        {/* 60 Chronometer Radial Ticks */}
        <g opacity="0.85">{tickMarks}</g>

        {/* Track Ring (Background circle) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress Arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={`url(#${accentGradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${center} ${center})`}
          className="transition-all duration-300 ease-linear motion-reduce:transition-none"
          style={{
            filter: isRunning
              ? `drop-shadow(0 0 10px ${glowColor})`
              : 'none',
          }}
        />

        {/* Small Glowing Leading Edge Bead */}
        {progress > 0 && progress < 1 && (
          <g filter="url(#leading-glow)" className="transition-all duration-300 ease-linear motion-reduce:transition-none">
            <circle
              cx={leadingX}
              cy={leadingY}
              r="7"
              fill={isBreak ? '#14B8A6' : '#F59E0B'}
              opacity={isRunning ? '0.6' : '0.3'}
            />
            <circle
              cx={leadingX}
              cy={leadingY}
              r="3.5"
              fill="#FFFFFF"
              className="drop-shadow-sm"
            />
          </g>
        )}
      </svg>

      {/* Center Optical Display & Typography */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 pointer-events-none z-20">
        <span
          className={cn(
            'text-5xl sm:text-6xl md:text-7xl font-mono font-light tracking-tight text-white tabular-nums drop-shadow-md transition-colors',
            !isCountUp && displaySeconds <= 0 && 'animate-pulse text-red-400',
            isPaused && 'text-zinc-300'
          )}
        >
          {formatSecondsToMMSS(displaySeconds)}
        </span>

        {/* Phase Pill, Step Name & Cycle Information */}
        <div className="flex items-center gap-2 mt-3.5 flex-wrap justify-center">
          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider uppercase border backdrop-blur-md transition-all',
              isBreak
                ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30',
              isPaused && 'border-zinc-500/30 text-zinc-400 bg-zinc-800/40'
            )}
          >
            {isPaused ? 'PAUSED' : stepName || phase.replace('_', ' ')}
          </span>

          {isCountUp && (
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
              Count Up
            </span>
          )}

          {cycleCount > 0 && (
            <span className="text-xs text-zinc-500 font-mono font-medium tracking-tight">
              Cycle #{cycleCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
