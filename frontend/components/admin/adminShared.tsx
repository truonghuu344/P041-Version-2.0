/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import { Inbox, Loader2 } from 'lucide-react';

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN');
}

export const ROLE_LABELS: Record<string, string> = {
  student: 'Sinh viên',
  counselor: 'Cố vấn',
  enterprise: 'Doanh nghiệp',
  admin: 'Quản trị viên',
};

export const VERIFICATION_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

/**
 * Các hàm nhãn dưới đây luôn trả về tiếng Việt.
 * Không dùng `MAP[value] || value` ở màn hình admin: khi gặp giá trị lạ,
 * cách đó sẽ in mã kỹ thuật thô ra cho người quản trị không chuyên đọc.
 */
export function roleLabel(value?: string | null): string {
  return (value ? ROLE_LABELS[value] : undefined) || 'Vai trò khác';
}

export function verificationLabel(value?: string | null): string {
  return (value ? VERIFICATION_LABELS[value] : undefined) || 'Chưa xác định';
}

export interface AdminKpiItem {
  label: string;
  value: number | string | undefined | null;
  hint?: string;
  icon?: React.ElementType;
  trend?: string;
  color?: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose';
}

export function AdminKpiGrid({ items }: { items: AdminKpiItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        const colorClasses = {
          emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          blue: 'bg-sky-50 text-sky-700 border-sky-200/80',
          amber: 'bg-amber-50 text-amber-700 border-amber-200/80',
          purple: 'bg-purple-50 text-purple-700 border-purple-200/80',
          rose: 'bg-rose-50 text-rose-700 border-rose-200/80',
        }[item.color || 'emerald'];

        return (
          <div
            className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3 group"
            key={item.label}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                {item.label}
              </span>
              {Icon && (
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${colorClasses} transition-transform group-hover:scale-110`}>
                  <Icon size={16} />
                </div>
              )}
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans']">
                {item.value ?? 0}
              </div>
              {item.hint && (
                <p className="text-xs text-slate-500 mt-1 font-['Inter']">
                  {item.hint}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Visual Donut Chart for proportions (e.g. User Breakdown, Status Breakdown)
 */
export interface ChartSegment {
  label: string;
  value: number;
  color: string;
}

export function AdminDonutChart({
  title,
  segments,
  centerLabel = 'Tổng',
  className = '',
}: {
  title: string;
  segments: ChartSegment[];
  centerLabel?: string;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <div className={`bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between gap-4 ${className}`}>
      <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-slate-900">{title}</h3>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        {/* SVG Donut */}
        <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
            {total === 0 ? (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#E2E8F0"
                strokeWidth={strokeWidth}
              />
            ) : (
              segments.map((segment, index) => {
                const percentage = total > 0 ? segment.value / total : 0;
                const strokeDasharray = `${percentage * circumference} ${circumference}`;
                const strokeDashoffset = -currentOffset;
                currentOffset += percentage * circumference;

                return (
                  <circle
                    key={index}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-500 hover:opacity-80"
                  />
                );
              })
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-base font-extrabold text-slate-900 leading-tight font-['Plus_Jakarta_Sans']">
              {total} {centerLabel}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2.5 w-full">
          {segments.map((segment, idx) => {
            const pct = total > 0 ? ((segment.value / total) * 100).toFixed(1) : '0.0';
            return (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: segment.color }} />
                  <span className="text-slate-700 font-medium">{segment.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{segment.value}</span>
                  <span className="text-slate-600 w-10 text-right">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Visual Progress Bar Breakdown (e.g. Funnel, Applications by status)
 */
export function AdminProgressBarChart({
  title,
  items,
  className = '',
}: {
  title: string;
  items: Array<{ label: string; value: number; max?: number; color?: string }>;
  className?: string;
}) {
  const totalMax = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className={`bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between gap-4 ${className}`}>
      <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-slate-900">{title}</h3>
      <div className="space-y-3.5">
        {items.map((item, idx) => {
          const maxVal = item.max || totalMax;
          const percentage = Math.min(100, Math.round((item.value / maxVal) * 100));
          const barColor = item.color || '#006948';

          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">{item.label}</span>
                <span className="font-bold text-slate-900">
                  {item.value} <span className="text-slate-600 font-normal">({percentage}%)</span>
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Visual Pipeline Funnel Flow
 */
export function AdminPipelineFunnel({
  steps,
}: {
  steps: Array<{ label: string; count: number; subText?: string; color: string }>;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
      <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-slate-900">
        Phễu Hoạt động & Chuyển đổi Nền tảng
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-white transition-all space-y-2 relative overflow-hidden"
          >
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ backgroundColor: step.color }}
            />
            <div className="text-xs text-slate-500 font-semibold font-['Plus_Jakarta_Sans']">
              {idx + 1}. {step.label}
            </div>
            <div className="text-2xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans']">
              {step.count} <span className="text-xs font-normal text-slate-400">chỉ mục</span>
            </div>
            {step.subText && (
              <p className="text-[11px] text-slate-500 font-['Inter']">
                {step.subText}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminPanel({
  title,
  actions,
  children,
  className = '',
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-panel ${className}`}>
      <div className="admin-panel-title">
        <h2>{title}</h2>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function AdminToolbar({ children }: { children: React.ReactNode }) {
  return <div className="ui-toolbar mb-4">{children}</div>;
}

export function AdminLoading({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return (
    <div className="admin-state" role="status">
      <Loader2 size={18} className="animate-spin inline-block mr-2" />
      {label}
    </div>
  );
}

export function AdminErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="admin-state is-error" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="ui-btn ui-btn-sm ml-3" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

export function AdminEmptyRow({ colSpan, message = 'Chưa có dữ liệu.' }: { colSpan: number; message?: string }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-[#64748B]">
          <Inbox size={22} />
          <span>{message}</span>
        </div>
      </td>
    </tr>
  );
}
