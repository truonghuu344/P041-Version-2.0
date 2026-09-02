'use client';

import React from 'react';
import { SearchX, Inbox, RefreshCw } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  action?: React.ReactNode;
  onResetFilters?: () => void;
  isFiltered?: boolean;
  className?: string;
}

export default function EmptyState({
  title,
  description,
  icon,
  action,
  onResetFilters,
  isFiltered = false,
  className = '',
}: EmptyStateProps) {
  const Icon = icon || (isFiltered ? SearchX : Inbox);
  const defaultTitle = isFiltered ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có dữ liệu';
  const defaultDesc = isFiltered
    ? 'Hãy thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh lại các tiêu chí bộ lọc.'
    : 'Dữ liệu sẽ xuất hiện tại đây khi có hoạt động mới trong hệ thống.';

  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-[#F8FAFC]/60 dark:bg-slate-800/30 border border-dashed border-[#CBD5E1] dark:border-slate-700/80 rounded-2xl ${className}`}
    >
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#F1F5F9] dark:bg-slate-800 flex items-center justify-center text-[#64748B] dark:text-slate-400 mb-4 shadow-sm">
        <Icon size={26} className="text-[#64748B] dark:text-slate-400" />
      </div>

      <h3 className="text-base sm:text-lg font-semibold text-[#0F172A] dark:text-white mb-1.5">
        {title || defaultTitle}
      </h3>

      <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-400 max-w-md mb-6 leading-relaxed">
        {description || defaultDesc}
      </p>

      {isFiltered && onResetFilters && (
        <button
          type="button"
          onClick={onResetFilters}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-xs sm:text-sm font-medium text-[#0F172A] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-[#059669] transition-all shadow-sm cursor-pointer"
        >
          <RefreshCw size={14} className="text-[#059669]" />
          <span>Đặt lại bộ lọc</span>
        </button>
      )}

      {!isFiltered && action && <div className="flex items-center gap-3">{action}</div>}
    </div>
  );
}
