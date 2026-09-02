'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'elevated' | 'subtle' | 'outline';
}

export default function Card({
  children,
  className = '',
  interactive = false,
  padding = 'md',
  variant = 'default',
  ...rest
}: CardProps) {
  const paddingClass =
    padding === 'none'
      ? 'p-0'
      : padding === 'sm'
        ? 'p-3 sm:p-4'
        : padding === 'lg'
          ? 'p-6 sm:p-8'
          : 'p-5 sm:p-6';

  const variantClass =
    variant === 'subtle'
      ? 'bg-[#F8FAFC] dark:bg-slate-800/60 border border-[#E2E8F0] dark:border-slate-800'
      : variant === 'outline'
        ? 'bg-transparent border border-[#E2E8F0] dark:border-slate-800 shadow-none'
        : variant === 'elevated'
          ? 'bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 shadow-[0_8px_28px_rgba(15,23,42,0.06)] dark:shadow-none'
          : 'bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 shadow-[0_4px_20px_rgba(15,23,42,0.04)] dark:shadow-none';

  const interactiveClass = interactive
    ? 'hover:border-[#CBD5E1] dark:hover:border-slate-700 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer'
    : 'transition-colors';

  return (
    <div
      className={`rounded-2xl ${variantClass} ${paddingClass} ${interactiveClass} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
