import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'focus' | 'break' | 'success' | 'danger' | 'outline';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  dot = false,
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
    focus: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    break: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    danger: 'bg-red-500/10 text-red-300 border-red-500/30',
    outline: 'bg-transparent text-zinc-400 border-white/10',
  };

  const dotColors = {
    default: 'bg-zinc-400',
    focus: 'bg-amber-400',
    break: 'bg-teal-400',
    success: 'bg-emerald-400',
    danger: 'bg-red-400',
    outline: 'bg-zinc-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border backdrop-blur-sm',
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', dotColors[variant])} />}
      {children}
    </span>
  );
};
