'use client';

import React from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  onBack?: () => void;
  backLabel?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  description,
  breadcrumbs,
  onBack,
  backLabel = 'Quay lại',
  badge,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`flex flex-col gap-3 py-6 md:py-8 border-b border-[#E2E8F0] dark:border-slate-800 mb-6 sm:mb-8 ${className}`}>
      {/* Breadcrumbs or Back button */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs sm:text-sm text-[#64748B] dark:text-slate-400 mb-1">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight size={14} className="text-slate-400 dark:text-slate-600 shrink-0" />}
              {crumb.onClick ? (
                <button
                  type="button"
                  onClick={crumb.onClick}
                  className="hover:text-[#059669] dark:hover:text-emerald-400 transition-colors font-medium bg-transparent border-0 p-0 cursor-pointer text-left"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className={crumb.active ? 'text-[#0F172A] dark:text-slate-200 font-semibold' : 'text-[#64748B]'}>
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {onBack && !breadcrumbs && (
        <div className="mb-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#475569] hover:text-[#059669] dark:text-slate-400 dark:hover:text-emerald-400 transition-colors bg-transparent border-0 p-0 cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>{backLabel}</span>
          </button>
        </div>
      )}

      {/* Title & Action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center flex-wrap gap-2.5">
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-bold text-[#0F172A] dark:text-white tracking-tight leading-tight">
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {description && (
            <p className="text-sm sm:text-base text-[#475569] dark:text-slate-400 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center flex-wrap gap-2.5 sm:gap-3 shrink-0 mt-2 sm:mt-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
