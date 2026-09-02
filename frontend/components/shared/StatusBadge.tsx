/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Send,
  Eye,
  Calendar,
  FileCheck,
  Ban,
  FileText,
} from 'lucide-react';

export type SemanticFamily = 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export type StandardRecruitmentStatus =
  | 'PENDING_CONSENT'
  | 'waiting_consent'
  | 'SUBMITTED'
  | 'submitted'
  | 'shared_enterprise'
  | 'VIEWED'
  | 'viewed'
  | 'SHORTLISTED'
  | 'shortlisted'
  | 'INTERVIEW'
  | 'interview'
  | 'interviewing'
  | 'interview_scheduled'
  | 'OFFERED'
  | 'offered'
  | 'hired'
  | 'ACCEPTED'
  | 'accepted'
  | 'REJECTED'
  | 'rejected'
  | 'WITHDRAWN'
  | 'withdrawn';

export type StandardInternshipStatus =
  | 'PLANNED'
  | 'planned'
  | 'ACTIVE'
  | 'active'
  | 'in_progress'
  | 'COMPLETED'
  | 'completed'
  | 'TERMINATED'
  | 'terminated';

export type StandardReportStatus =
  | 'DRAFT'
  | 'draft'
  | 'REPORT_SUBMITTED'
  | 'submitted'
  | 'REVIEWED'
  | 'reviewed'
  | 'evaluated'
  | 'APPROVED'
  | 'approved'
  | 'DUE_SOON'
  | 'due_soon'
  | 'OVERDUE'
  | 'overdue'
  | 'delayed';

export type KnownStatus =
  | StandardRecruitmentStatus
  | StandardInternshipStatus
  | StandardReportStatus
  | string;

export interface StatusConfig {
  family: SemanticFamily;
  label: string;
  icon?: React.ComponentType<any>;
  classes: string;
  dotClass: string;
}

export function resolveStatusConfig(status: KnownStatus, customLabel?: string): StatusConfig {
  const normalized = String(status || '').trim().toUpperCase();

  // 1. RECRUITMENT STATUSES
  if (normalized === 'PENDING_CONSENT' || normalized === 'WAITING_CONSENT') {
    return {
      family: 'warning',
      label: customLabel || 'Chờ sinh viên đồng ý',
      icon: Clock,
      classes: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
      dotClass: 'bg-[#D97706]',
    };
  }

  if (normalized === 'SUBMITTED' || normalized === 'SHARED_ENTERPRISE' || normalized === 'DA_NOP' || normalized === 'DA_GUI') {
    return {
      family: 'info',
      label: customLabel || 'Đã gửi hồ sơ',
      icon: Send,
      classes: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
      dotClass: 'bg-[#2563EB]',
    };
  }

  if (normalized === 'VIEWED' || normalized === 'DA_XEM') {
    return {
      family: 'info',
      label: customLabel || 'Doanh nghiệp đã xem',
      icon: Eye,
      classes: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
      dotClass: 'bg-[#2563EB]',
    };
  }

  if (normalized === 'SHORTLISTED' || normalized === 'QUA_SO_LOAI') {
    return {
      family: 'success',
      label: customLabel || 'Qua vòng sơ loại',
      icon: CheckCircle2,
      classes: 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
      dotClass: 'bg-[#059669]',
    };
  }

  if (
    normalized === 'INTERVIEW' ||
    normalized === 'INTERVIEWING' ||
    normalized === 'INTERVIEW_SCHEDULED' ||
    normalized === 'DANG_PHONG_VAN' ||
    normalized === 'LICH_PHONG_VAN'
  ) {
    return {
      family: 'info',
      label: customLabel || 'Đang phỏng vấn',
      icon: Calendar,
      classes: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
      dotClass: 'bg-[#2563EB]',
    };
  }

  if (normalized === 'OFFERED' || normalized === 'HIRED' || normalized === 'DA_NHAN_OFFER' || normalized === 'TRUNG_TUYEN') {
    return {
      family: 'success',
      label: customLabel || 'Đã nhận Offer',
      icon: CheckCircle2,
      classes: 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
      dotClass: 'bg-[#059669]',
    };
  }

  if (normalized === 'ACCEPTED' || normalized === 'DA_DONG_Y' || normalized === 'DA_NHAN_VIEC') {
    return {
      family: 'success',
      label: customLabel || 'Đã đồng ý nhận việc',
      icon: CheckCircle2,
      classes: 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
      dotClass: 'bg-[#059669]',
    };
  }

  if (normalized === 'REJECTED' || normalized === 'CHUA_PHU_HOP' || normalized === 'DA_TU_CHOI') {
    return {
      family: 'danger',
      label: customLabel || 'Chưa phù hợp',
      icon: XCircle,
      classes: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA] dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
      dotClass: 'bg-[#DC2626]',
    };
  }

  if (normalized === 'WITHDRAWN' || normalized === 'DA_RUT' || normalized === 'DA_HUY') {
    return {
      family: 'neutral',
      label: customLabel || 'Đã rút hồ sơ',
      icon: Ban,
      classes: 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0] dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700',
      dotClass: 'bg-[#64748B]',
    };
  }

  // 2. INTERNSHIP & REPORT STATUSES
  if (normalized === 'PLANNED' || normalized === 'DU_KIEN') {
    return {
      family: 'info',
      label: customLabel || 'Dự kiến',
      icon: Calendar,
      classes: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
      dotClass: 'bg-[#2563EB]',
    };
  }

  if (normalized === 'IN_PROGRESS' || normalized === 'ONGOING') {
    return {
      family: 'info',
      label: customLabel || 'Đang diễn ra',
      icon: Clock,
      classes: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
      dotClass: 'bg-[#2563EB]',
    };
  }

  if (normalized === 'ACTIVE') {
    return {
      family: 'success',
      label: customLabel || 'Đang hoạt động',
      icon: CheckCircle2,
      classes: 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
      dotClass: 'bg-[#059669]',
    };
  }

  if (normalized === 'COMPLETED' || normalized === 'HOAN_THANH' || normalized === 'APPROVED' || normalized === 'REVIEWED' || normalized === 'EVALUATED') {
    return {
      family: 'success',
      label: customLabel || 'Hoàn thành',
      icon: CheckCircle2,
      classes: 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
      dotClass: 'bg-[#059669]',
    };
  }

  if (normalized === 'TERMINATED' || normalized === 'DA_DUNG') {
    return {
      family: 'danger',
      label: customLabel || 'Đã chấm dứt',
      icon: AlertTriangle,
      classes: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA] dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
      dotClass: 'bg-[#DC2626]',
    };
  }

  if (normalized === 'DUE_SOON' || normalized === 'SAP_DEN_HAN' || normalized === 'PENDING_EVALUATION' || normalized === 'PENDING' || normalized === 'CHO_DUYET') {
    return {
      family: 'warning',
      label: customLabel || 'Chờ duyệt',
      icon: AlertCircle,
      classes: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
      dotClass: 'bg-[#D97706]',
    };
  }

  if (normalized === 'OVERDUE' || normalized === 'DELAYED' || normalized === 'QUA_HAN' || normalized === 'TRE_HAN') {
    return {
      family: 'danger',
      label: customLabel || 'Quá hạn',
      icon: AlertTriangle,
      classes: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA] dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
      dotClass: 'bg-[#DC2626]',
    };
  }

  if (normalized === 'DRAFT' || normalized === 'BAN_NHAP') {
    return {
      family: 'neutral',
      label: customLabel || 'Bản nháp',
      icon: FileText,
      classes: 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0] dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700',
      dotClass: 'bg-[#64748B]',
    };
  }

  // 3. TRẠNG THÁI TỔNG QUÁT (chuẩn hoá toàn hệ thống)
  if (normalized === 'PROCESSING' || normalized === 'RUNNING') {
    return {
      family: 'warning',
      label: customLabel || 'Đang xử lý',
      icon: Clock,
      classes: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
      dotClass: 'bg-[#D97706]',
    };
  }

  if (normalized === 'NEEDS_ACTION' || normalized === 'WAITING' || normalized === 'PENDING_REVIEW') {
    return {
      family: 'warning',
      label: customLabel || 'Chờ xử lý',
      icon: AlertCircle,
      classes: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
      dotClass: 'bg-[#D97706]',
    };
  }

  if (normalized === 'VERIFIED') {
    return {
      family: 'success',
      label: customLabel || 'Đã xác minh',
      icon: CheckCircle2,
      classes: 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
      dotClass: 'bg-[#059669]',
    };
  }

  if (normalized === 'SCHEDULED') {
    return {
      family: 'info',
      label: customLabel || 'Đã lên lịch',
      icon: Calendar,
      classes: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
      dotClass: 'bg-[#2563EB]',
    };
  }

  if (normalized === 'FAILED' || normalized === 'BLOCKED' || normalized === 'EXPIRED') {
    return {
      family: 'danger',
      label:
        customLabel ||
        (normalized === 'FAILED' ? 'Thất bại' : normalized === 'BLOCKED' ? 'Bị chặn' : 'Hết hạn'),
      icon: AlertTriangle,
      classes: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA] dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
      dotClass: 'bg-[#DC2626]',
    };
  }

  if (normalized === 'CANCELLED' || normalized === 'CANCELED') {
    return {
      family: 'danger',
      label: customLabel || 'Đã huỷ',
      icon: XCircle,
      classes: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA] dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
      dotClass: 'bg-[#DC2626]',
    };
  }

  if (normalized === 'INACTIVE' || normalized === 'CLOSED' || normalized === 'ARCHIVED' || normalized === 'REVOKED') {
    return {
      family: 'neutral',
      label:
        customLabel ||
        (normalized === 'CLOSED'
          ? 'Đã đóng'
          : normalized === 'ARCHIVED'
            ? 'Đã lưu trữ'
            : normalized === 'REVOKED'
              ? 'Đã thu hồi'
              : 'Không hoạt động'),
      icon: Ban,
      classes: 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0] dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700',
      dotClass: 'bg-[#64748B]',
    };
  }

  // Default fallback (Neutral) — không bao giờ lộ mã trạng thái thô.
  return {
    family: 'neutral',
    label: customLabel || 'Trạng thái khác',
    icon: FileCheck,
    classes: 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0] dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700',
    dotClass: 'bg-[#64748B]',
  };
}

export interface StatusBadgeProps {
  status: KnownStatus;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showDot?: boolean;
  className?: string;
}

export default function StatusBadge({
  status,
  label,
  size = 'md',
  showIcon = true,
  showDot = false,
  className = '',
}: StatusBadgeProps) {
  const config = resolveStatusConfig(status, label);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px] font-medium gap-1 rounded-md',
    md: 'px-2.5 py-1 text-xs font-semibold gap-1.5 rounded-full',
    lg: 'px-3.5 py-1.5 text-sm font-semibold gap-2 rounded-full',
  }[size];

  const iconSize = size === 'sm' ? 12 : size === 'md' ? 13 : 16;
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : size === 'md' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  return (
    <span
      className={`inline-flex items-center border font-['Inter'] transition-colors ${sizeClasses} ${config.classes} ${className}`}
      data-semantic-family={config.family}
      aria-label={`Trạng thái: ${config.label}`}
    >
      {showDot && <span className={`${dotSize} rounded-full shrink-0 ${config.dotClass}`} />}
      {showIcon && Icon && <Icon size={iconSize} className="shrink-0" />}
      <span className="truncate">{config.label}</span>
    </span>
  );
}
