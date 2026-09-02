/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState } from 'react';
import { CheckCircle2, FileText, AlertCircle, X, ShieldCheck } from 'lucide-react';

interface CounselorConfirmProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  cvName?: string;
  onConfirm: (data: { feedback: string; referralNote: string; agreed: boolean }) => void;
}

export default function CounselorConfirmProfileModal({
  isOpen,
  onClose,
  studentName,
  cvName = 'CV_UngVien_ChuanSTAR.pdf',
  onConfirm,
}: CounselorConfirmProfileModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [feedback, setFeedback] = useState('Hồ sơ đã đạt tiêu chuẩn cấu trúc STAR và đáp ứng tốt các yêu cầu kỹ thuật nền tảng.');
  const [referralNote, setReferralNote] = useState('Đề xuất ưu tiên cho các vị trí liên quan đến Frontend / Software Engineer.');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    onConfirm({ feedback, referralNote, agreed });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl max-w-lg w-full p-5 border border-[#E2E8F0] shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-profile-title"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2 text-[#006948]">
            <ShieldCheck size={22} />
            <h3 id="confirm-profile-title" className="text-lg font-bold text-[#0F172A] font-headline">
              Xác nhận hồ sơ sinh viên
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors focus-visible:ring-2 focus-visible:ring-[#006948] focus-visible:outline-none"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Student & CV Info */}
          <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#ECFDF5] text-[#006948] flex items-center justify-center border border-[#006948]/20 shadow-xs">
                <FileText size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0F172A]">{studentName}</h4>
                <p className="text-xs text-[#64748B]">{cvName}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-[#ECFDF5] text-[#006948] text-xs font-semibold rounded-full border border-[#006948]/20">
              Định dạng STAR
            </span>
          </div>

          {/* Feedback Input */}
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5">
              Nhận xét thẩm định của Cố vấn <span className="text-[#EF4444]">*</span>
            </label>
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              required
              placeholder="Nhập nhận xét chất lượng hồ sơ..."
              className="w-full p-3 rounded-lg border border-[#CBD5E1] text-xs focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948] bg-white text-[#0F172A]"
            />
          </div>

          {/* Optional Referral Note */}
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5">
              Ghi chú tiến cử (Tùy chọn)
            </label>
            <input
              type="text"
              value={referralNote}
              onChange={(e) => setReferralNote(e.target.value)}
              placeholder="VD: Phù hợp với các dự án outsource hoặc product..."
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-xs focus:outline-none focus:ring-2 focus:ring-[#006948]/20 focus:border-[#006948] bg-white text-[#0F172A]"
            />
          </div>

          {/* Mandatory Checkbox & Disclaimer */}
          <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-[#006948] focus:ring-[#006948] border-[#CBD5E1]"
                required
              />
              <span className="text-xs text-[#92400E] font-medium leading-relaxed">
                Tôi xác nhận đã kiểm duyệt hồ sơ CV này đạt chuẩn học thuật và kỹ năng đầu ra của trường.
              </span>
            </label>
            <div className="flex items-center gap-1.5 text-[11px] text-[#B45309]">
              <AlertCircle size={13} className="shrink-0" />
              <span>Dấu xác nhận của Cố vấn không ngụ ý đảm bảo tuyển dụng tuyệt đối từ Doanh nghiệp.</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] transition-colors focus-visible:ring-2 focus-visible:ring-[#006948] focus-visible:outline-none"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!agreed}
              className="h-10 px-5 rounded-lg bg-[#006948] text-white text-xs font-semibold hover:bg-[#047857] disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-[#006948] focus-visible:outline-none"
            >
              <CheckCircle2 size={16} />
              Xác nhận hồ sơ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
