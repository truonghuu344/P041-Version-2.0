'use client';

import React from 'react';

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'standard' | 'wide' | 'narrow' | 'full';
}

export default function PageContainer({
  children,
  className = '',
  maxWidth = 'standard',
  ...rest
}: PageContainerProps) {
  const maxWidthClass =
    maxWidth === 'wide'
      ? 'max-w-[1520px]'
      : maxWidth === 'narrow'
        ? 'max-w-5xl'
        : maxWidth === 'full'
          ? 'max-w-none'
          : 'max-w-[1440px] 2xl:max-w-[1520px]';

  return (
    <div
      className={`w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 transition-all ${maxWidthClass} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
