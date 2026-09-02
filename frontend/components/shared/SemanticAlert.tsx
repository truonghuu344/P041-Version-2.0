'use client';

import React from 'react';
import { CheckCircle2, Info, AlertCircle, AlertTriangle, X } from 'lucide-react';

export type AlertType = 'success' | 'info' | 'warning' | 'danger';

export interface SemanticAlertProps {
  type?: AlertType;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export default function SemanticAlert({
  type = 'info',
  title,
  children,
  onClose,
  className = '',
}: SemanticAlertProps) {
  const config = {
    success: {
      icon: CheckCircle2,
      classes: 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46] dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300',
      iconColor: 'text-[#047857] dark:text-emerald-400',
    },
    info: {
      icon: Info,
      classes: 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF] dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-300',
      iconColor: 'text-[#2563EB] dark:text-blue-400',
    },
    warning: {
      icon: AlertCircle,
      classes: 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E] dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-300',
      iconColor: 'text-[#D97706] dark:text-amber-400',
    },
    danger: {
      icon: AlertTriangle,
      classes: 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B] dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300',
      iconColor: 'text-[#DC2626] dark:text-rose-400',
    },
  }[type];

  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-xl border font-['Inter'] text-sm transition-all ${config.classes} ${className}`}
    >
      <Icon size={18} className={`shrink-0 mt-0.5 ${config.iconColor}`} />
      <div className="flex-1 min-w-0">
        {title && <h4 className="font-semibold mb-0.5">{title}</h4>}
        <div className="text-xs md:text-sm leading-relaxed">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo"
          className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
