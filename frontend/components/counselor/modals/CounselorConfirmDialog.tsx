/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import { AlertCircle, HelpCircle, X, Check, Loader2 } from 'lucide-react';

interface CounselorConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger' | 'warning';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export default function CounselorConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  variant = 'primary',
  isLoading = false,
  icon,
}: CounselorConfirmDialogProps) {
  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    await onConfirm();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          btn: 'bg-rose-600 hover:bg-rose-700 text-white',
          iconBg: 'bg-rose-50 text-rose-600',
        };
      case 'warning':
        return {
          btn: 'bg-amber-600 hover:bg-amber-700 text-white',
          iconBg: 'bg-amber-50 text-amber-600',
        };
      default:
        return {
          btn: 'bg-[#059669] hover:bg-[#047857] text-white shadow-sm',
          iconBg: 'bg-[#ECFDF5] text-[#059669]',
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl max-w-md w-full p-5 border border-[#E2E8F0] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${variantStyles.iconBg}`}>
              {icon || (variant === 'danger' ? <AlertCircle size={20} /> : <HelpCircle size={20} />)}
            </div>
            <h3 id="dialog-title" className="text-base font-bold text-[#0F172A] font-headline">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors disabled:opacity-50"
            aria-label="Đóng hộp thoại"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-[#475569] leading-relaxed whitespace-pre-line">
          {description}
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="h-10 px-4 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#006948] focus-visible:outline-none"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isLoading}
            className={`h-10 px-5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#006948] focus-visible:outline-none ${variantStyles.btn}`}
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
