'use client';

import React from 'react';
import { Calendar, Clock, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface DeadlineIndicatorProps {
  deadline?: string | Date | number | null;
  isCompleted?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  prefix?: string;
}

export function parseDaysRemaining(deadline: string | Date | number): {
  days: number;
  formattedDate: string;
  isPassed: boolean;
} {
  let targetDate: Date;
  if (typeof deadline === 'string') {
    // Check if format is DD/MM/YYYY
    const ddmmyyyy = deadline.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      targetDate = new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]), 23, 59, 59);
    } else {
      targetDate = new Date(deadline);
    }
  } else if (typeof deadline === 'number') {
    targetDate = new Date(deadline);
  } else {
    targetDate = deadline;
  }

  if (isNaN(targetDate.getTime())) {
    return { days: 999, formattedDate: String(deadline), isPassed: false };
  }

  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isPassed = diffMs < 0;

  const formattedDate = targetDate.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return { days, formattedDate, isPassed };
}

export default function DeadlineIndicator({
  deadline,
  isCompleted = false,
  className = '',
  prefix,
}: DeadlineIndicatorProps) {
  if (!deadline) {
    return (
      <span className="text-xs text-[#64748B] dark:text-slate-400 font-['Inter']">
        Không có thời hạn
      </span>
    );
  }

  if (isCompleted) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 font-['Inter'] ${className}`}
        aria-label="Đã hoàn thành đúng hạn"
      >
        <CheckCircle2 size={13} className="shrink-0" />
        <span>Đã hoàn thành</span>
      </span>
    );
  }

  const { days, formattedDate, isPassed } = parseDaysRemaining(deadline);

  // 1. Quá hạn
  if (isPassed) {
    const overdueDays = Math.abs(days) || 1;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 font-['Inter'] ${className}`}
        aria-label={`Quá hạn ${overdueDays} ngày`}
      >
        <AlertTriangle size={13} className="shrink-0" />
        <span>Quá hạn {overdueDays} ngày</span>
      </span>
    );
  }

  // 2. Còn <= 1 ngày
  if (days <= 1) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 font-['Inter'] ${className}`}
        aria-label="Hạn chót: Hôm nay"
      >
        <AlertCircle size={13} className="shrink-0" />
        <span>Hạn chót: Hôm nay ({formattedDate})</span>
      </span>
    );
  }

  // 3. Còn <= 3 ngày
  if (days <= 3) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 font-['Inter'] ${className}`}
        aria-label={`Còn ${days} ngày`}
      >
        <Clock size={13} className="shrink-0" />
        <span>Còn {days} ngày ({formattedDate})</span>
      </span>
    );
  }

  // 4. Bình thường (> 3 ngày)
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700 font-['Inter'] ${className}`}
      aria-label={`Hạn: ${formattedDate}`}
    >
      <Calendar size={13} className="shrink-0" />
      <span>{prefix ? `${prefix} ` : 'Hạn: '}{formattedDate}</span>
    </span>
  );
}
