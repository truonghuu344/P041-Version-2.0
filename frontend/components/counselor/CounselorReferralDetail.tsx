/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Calendar,
  FileText,
  Send,
  PlusCircle,
  User,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Check,
  ChevronRight,
} from 'lucide-react';
import { CounselorTab } from './CounselorNavbar';
import CounselorTaskModal from './modals/CounselorTaskModal';
import CounselorToast, { ToastMessage } from './CounselorToast';

import { CounselorApi } from '@/lib/api/counselorApi';

interface CounselorReferralDetailProps {
  referralId?: string;
  onNavigate: (tab: CounselorTab, params?: any) => void;
}

export default function CounselorReferralDetail({
  referralId = 'ref-01',
  onNavigate,
}: CounselorReferralDetailProps) {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Referral Detail Data
  const [referral, setReferral] = useState({
    id: referralId,
    studentId: 'sv01',
    studentName: 'Sinh viên',
    studentMajor: 'Kỹ thuật Phần mềm (K18)',
    studentEmail: '',
    studentAvatar: '',
    position: 'Frontend ReactJS Intern',
    company: 'FPT Software',
    cvSentName: 'CV_SoftwareEngineer.pdf',
    status: 'interviewing' as 'waiting_consent' | 'shared' | 'interviewing' | 'offered' | 'rejected',
    counselorNote: 'Sinh viên có năng lực vững chắc, CV chuẩn STAR và điểm phỏng vấn đạt kết quả cao.',
    enterpriseFeedback: 'Hồ sơ đạt yêu cầu chuyên môn ban đầu.',
    rejectionReason: '',
    timeline: [
      { step: 1, title: 'Sinh viên đồng ý tiến cử (Consent)', date: '19/08/2026 09:15', status: 'completed' },
      { step: 2, title: 'Cố vấn gửi hồ sơ sang Doanh nghiệp', date: '19/08/2026 10:00', status: 'completed' },
      { step: 3, title: 'Doanh nghiệp đã xem hồ sơ', date: '20/08/2026 14:30', status: 'completed' },
      { step: 4, title: 'Phỏng vấn chuyên môn (Vòng 1)', date: '24/08/2026 09:00', status: 'current' },
      { step: 5, title: 'Kết quả tuyển dụng & Tiếp nhận', date: 'Dự kiến 28/08/2026', status: 'upcoming' },
    ],
  });

  useEffect(() => {
    let isMounted = true;
    const fetchDetail = async () => {
      try {
        setIsLoading(true);
        const data = await CounselorApi.getReferralDetail(referralId);
        if (data && isMounted) {
          setReferral((prev) => ({
            ...prev,
            id: data.id,
            studentId: data.studentId,
            studentName: data.studentName,
            studentMajor: data.studentMajor,
            studentAvatar: data.studentAvatar || '',
            position: data.position,
            company: data.company,
            counselorNote: data.notes || prev.counselorNote,
          }));
        }
      } catch (err) {
        console.error('Failed to load referral detail:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [referralId]);

  return (
    <div className="space-y-6 pb-6 antialiased">
      <CounselorToast toast={toast} onClose={() => setToast(null)} />

      {/* ── BREADCRUMB & BACK BUTTON ── */}
      <div>
        <nav aria-label="Breadcrumb" className="flex items-center text-xs text-[#64748B] mb-2 font-['Inter']">
          <button
            type="button"
            onClick={() => onNavigate('referrals')}
            className="hover:text-[#006948] transition-colors"
          >
            Quản lý tiến cử
          </button>
          <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-[#CBD5E1]" />
          <span className="text-[#171d19] font-semibold">{referral.studentName}</span>
        </nav>
        <button
          type="button"
          onClick={() => onNavigate('referrals')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] hover:text-[#006948] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Danh sách Tiến cử</span>
        </button>
      </div>

      {/* ── HEADER CONTEXT BANNER ── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full overflow-hidden border border-[#E2E8F0] bg-[#dae2fd] text-[#131b2e] flex items-center justify-center font-bold text-lg shrink-0">
            {referral.studentAvatar ? (
              <img src={referral.studentAvatar} alt={referral.studentName} className="w-full h-full object-cover" />
            ) : (
              referral.studentName.slice(0, 2)
            )}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#171d19]">
                {referral.studentName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#006948] text-xs font-semibold border border-[#006948]/20">
                {referral.company}
              </span>
            </div>
            <p className="font-['Inter'] text-xs text-[#475569] mt-1">
              Vị trí: <strong>{referral.position}</strong> • {referral.studentMajor}
            </p>
          </div>
        </div>

        <div className="counselor-toolbar flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('student-detail', { studentId: referral.studentId })}
            className="h-10 px-4 bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#171d19] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <User className="w-4 h-4 text-[#006948]" />
            <span>Hồ sơ sinh viên</span>
          </button>
        </div>
      </div>

      {/* ── TIMELINE TRACKING PROGRESS ── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-6">
        <div>
          <h2 className="font-['Plus_Jakarta_Sans'] text-base font-semibold text-[#171d19]">
            Tiến trình Tiến cử Trực quan
          </h2>
          <p className="font-['Inter'] text-xs text-[#475569] mt-0.5">
            Lộ trình xử lý từ lúc Sinh viên cấp Consent đến khi nhận kết quả từ Doanh nghiệp
          </p>
        </div>

        {/* Visual Steps Timeline */}
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E2E8F0]">
          {referral.timeline.map((step) => (
            <div key={step.step} className="relative flex items-start gap-4 font-['Inter']">
              <div
                className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step.status === 'completed'
                    ? 'bg-[#006948] text-white'
                    : step.status === 'current'
                      ? 'bg-[#006948] text-white ring-4 ring-[#ECFDF5]'
                      : 'bg-[#E2E8F0] text-[#64748B]'
                  }`}
              >
                {step.status === 'completed' ? <Check className="w-3 h-3" /> : step.step}
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-xl flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-[#171d19]">{step.title}</h4>
                  <p className="text-[11px] text-[#64748B] mt-0.5">{step.date}</p>
                </div>
                {step.status === 'completed' && (
                  <span className="px-2.5 py-0.5 bg-[#ECFDF5] text-[#006948] text-[11px] font-semibold rounded-full border border-[#006948]/20 self-start sm:self-center">
                    Đã hoàn thành
                  </span>
                )}
                {step.status === 'current' && (
                  <span className="px-2.5 py-0.5 bg-[#ECFDF5] text-[#006948] text-[11px] font-semibold rounded-full border border-[#006948]/20 self-start sm:self-center">
                    Đang diễn ra
                  </span>
                )}
                {step.status === 'upcoming' && (
                  <span className="px-2.5 py-0.5 bg-[#F1F5F9] text-[#64748B] text-[11px] font-medium rounded-full self-start sm:self-center">
                    Dự kiến
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DETAILS: CV SENT, COUNSELOR NOTE & ENTERPRISE FEEDBACK ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: CV Sent & Counselor Recommendation */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
          <h3 className="font-['Plus_Jakarta_Sans'] text-base font-semibold text-[#171d19] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#006948]" />
            <span>Hồ sơ &amp; Bảo chứng của Cố vấn</span>
          </h3>

          <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#ECFDF5] text-[#006948] flex items-center justify-center border border-[#006948]/20">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#171d19] font-['Inter']">{referral.cvSentName}</h4>
                <p className="text-[11px] text-[#64748B] font-['Inter']">Bản PDF đã được SV đồng ý chia sẻ</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => showToast(`Xem trước hồ sơ: ${referral.cvSentName}`, 'info')}
              className="p-2 text-[#006948] hover:bg-[#ECFDF5] rounded-lg transition-colors"
              title="Xem trước CV"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5 font-['Inter']">
            <span className="text-xs font-semibold text-[#475569]">Ghi chú của Cố vấn:</span>
            <p className="text-xs text-[#3d4a42] bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] italic">
              &ldquo;{referral.counselorNote}&rdquo;
            </p>
          </div>
        </div>

        {/* Right: Enterprise Response & Actions */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
          <h3 className="font-['Plus_Jakarta_Sans'] text-base font-semibold text-[#171d19] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#006948]" />
            <span>Phản hồi từ Doanh nghiệp ({referral.company})</span>
          </h3>

          <div className="p-4 bg-[#ECFDF5] border border-[#006948]/20 rounded-xl space-y-2 font-['Inter']">
            <div className="flex items-center gap-2 text-xs font-bold text-[#006948]">
              <CheckCircle2 className="w-4 h-4 fill-[#006948] text-white" />
              <span>Trạng thái: Đã xếp lịch phỏng vấn</span>
            </div>
            <p className="text-xs text-[#3d4a42] leading-relaxed">
              {referral.enterpriseFeedback}
            </p>
          </div>
        </div>
      </div>

      <CounselorTaskModal
        isOpen={isTaskModalOpen}
        studentName={referral.studentName}
        onClose={() => setIsTaskModalOpen(false)}
        onAssignTask={(task) => {
          setIsTaskModalOpen(false);
          showToast(`Đã tạo nhiệm vụ cho ${referral.studentName}!`, 'success');
        }}
      />
    </div>
  );
}
