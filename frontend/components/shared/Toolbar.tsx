'use client';

import React from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';

export interface ToolbarProps {
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  activeFilterCount?: number;
  onResetFilters?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export default function Toolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm...',
  filters,
  actions,
  activeFilterCount = 0,
  onResetFilters,
  className = '',
  children,
}: ToolbarProps) {
  return (
    <div
      className={`w-full bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-6 ${className}`}
    >
      {/* Left / Main filters & search */}
      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
        {onSearchChange !== undefined && (
          <div className="relative w-full sm:w-[320px] md:w-[360px] shrink-0">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-11 pl-10 pr-9 rounded-lg bg-[#F8FAFC] dark:bg-slate-800/80 border border-[#CBD5E1] dark:border-slate-700 text-sm text-[#0F172A] dark:text-slate-100 placeholder-[#64748B] dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-[#059669] transition-all"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                aria-label="Xóa tìm kiếm"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {filters && <div className="flex flex-wrap items-center gap-2.5 flex-1">{filters}</div>}

        {children}

        {activeFilterCount > 0 && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-3 h-9 text-xs font-medium text-[#D97706] hover:text-[#B45309] bg-[#FFFBEB] hover:bg-[#FEF3C7] dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40 border border-[#FDE68A] dark:border-amber-800 rounded-lg transition-colors cursor-pointer"
          >
            <SlidersHorizontal size={13} />
            <span>Đặt lại bộ lọc ({activeFilterCount})</span>
          </button>
        )}
      </div>

      {/* Right / Actions slot */}
      {actions && (
        <div className="flex items-center flex-wrap gap-2.5 shrink-0 self-end lg:self-center">
          {actions}
        </div>
      )}
    </div>
  );
}
