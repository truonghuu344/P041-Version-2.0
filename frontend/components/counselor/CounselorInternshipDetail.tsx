/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  MessageSquare,
  Star,
  Award,
  Download,
  Send,
  User,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { CounselorTab } from './CounselorNavbar';
import CounselorToast, { ToastMessage } from './CounselorToast';

import { CounselorApi } from '@/lib/api/counselorApi';

interface CounselorInternshipDetailProps {
  internshipId?: string;
  onNavigate: (tab: CounselorTab, params?: any) => void;
}

export default function CounselorInternshipDetail({
  internshipId = 'intern-01',
  onNavigate,
}: CounselorInternshipDetailProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'reports' | 'mentor_eval' | 'academic_eval'
  >('reports');

  const [counselorFeedback, setCounselorFeedback] = useState('');
  const [academicScore, setAcademicScore] = useState('8.5');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Internship Data
  const [internship, setInternship] = useState({
    id: internshipId,
    studentId: '',
    studentName: '',
    studentMajor: '',
    company: '',
    position: '',
    mentorName: '',
    mentorTitle: '',
    currentWeek: 0,
    totalWeeks: 0,
    period: '',
    weeklyReports: [] as Array<any>, /*
      {
        week: 4,
        period: '15/10/2026 - 21/10/2026',
        workDone:
          '- Hoàn thiện UI cho trang Dashboard theo thiết kế mới.\n- Tích hợp API lấy danh sách thông báo và xử lý socket.\n- Tối ưu hóa hiệu suất render danh sách (giảm 20% thời gian tải).',
        challenges:
          'Chưa xử lý triệt để được lỗi re-render không mong muốn ở component Chart khi filter dữ liệu lớn.',
        nextPlan:
          '- Tìm hiểu và áp dụng Redux Toolkit cho module Quản lý User.\n- Bắt đầu làm tài liệu báo cáo thực tập (phần kiến trúc hệ thống).',
        status: 'submitted',
        mentorFeedback: 'Nắm bắt nhanh quy trình CI/CD và hoàn thành tốt module Authentication.',
        mentorScore: 'A (9.0/10)',
        attachments: ['BaoCaoTuan4_NguyenVanAn.pdf', 'Lighthouse_Audit_Report.png'],
      },
      {
        week: 3,
        period: '08/10/2026 - 14/10/2026',
        workDone: '- Setup môi trường phát triển và làm quen với hệ thống Gitlab CI.',
        challenges: 'Còn bỡ ngỡ với luồng review code chuẩn của dự án.',
        nextPlan: '- Bắt đầu code module Dashboard.',
        status: 'reviewed',
        mentorFeedback: 'Thái độ học hỏi rất tốt, tiếp thu nhanh.',
        mentorScore: 'B+ (8.5/10)',
      },
    ], */
  });

  useEffect(() => {
    let isMounted = true;
    const fetchDetail = async () => {
      try {
        setIsLoading(true);
        const data = await CounselorApi.getInternshipDetail(internshipId);
        if (data && isMounted) {
          setInternship((prev) => ({
            ...prev,
            id: data.id,
            studentId: data.studentId,
            studentName: data.studentName,
            studentMajor: data.studentMajor,
            company: data.company,
            position: data.position,
            mentorName: data.mentorName,
            mentorTitle: data.mentorTitle,
            currentWeek: data.currentWeek,
            totalWeeks: data.totalWeeks,
            weeklyReports: data.weeklyReports || [],
          }));
        }
      } catch (err) {
        console.error('Failed to load internship detail:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [internshipId]);

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counselorFeedback.trim()) return;
    try {
      await CounselorApi.createCounselorFeedback(internship.studentId, {
        kind: 'comment',
        content: `Internship feedback for week ${internship.currentWeek}: ${counselorFeedback.trim()}`,
      });
    showToast(`Đã gửi nhận xét của Cố vấn cho báo cáo Tuần ${internship.currentWeek} của ${internship.studentName}!`, 'success');
    setCounselorFeedback('');
    } catch {
      showToast('KhÃ´ng thá»ƒ gá»­i nháº­n xÃ©t. Vui lÃ²ng thá»­ láº¡i.', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-6 antialiased">
      <CounselorToast toast={toast} onClose={() => setToast(null)} />

      {/* ── BREADCRUMB & BACK ── */}
      <div>
        <nav aria-label="Breadcrumb" className="flex items-center text-xs text-[#64748B] mb-2 font-['Inter']">
          <button
            type="button"
            onClick={() => onNavigate('internships')}
            className="hover:text-[#006948] transition-colors"
          >
            Giám sát thực tập
          </button>
          <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-[#CBD5E1]" />
          <span className="text-[#171d19] font-semibold">{internship.studentName} — {internship.company}</span>
        </nav>
        <button
          type="button"
          onClick={() => onNavigate('internships')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] hover:text-[#006948] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Danh sách Thực tập</span>
        </button>
      </div>

      {/* ── HEADER CONTEXT BANNER ── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#ECFDF5] text-[#006948] flex items-center justify-center font-bold text-xl border border-[#006948]/20 shrink-0">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#171d19]">
                {internship.studentName} — {internship.company}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#006948] text-xs font-semibold border border-[#006948]/20">
                Tuần {internship.currentWeek}/{internship.totalWeeks}
              </span>
            </div>
            <p className="font-['Inter'] text-xs text-[#475569] mt-1">
              Vị trí: <strong>{internship.position}</strong> • Mentor: <strong>{internship.mentorName}</strong> ({internship.mentorTitle})
            </p>
          </div>
        </div>

        <div className="counselor-toolbar flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('student-detail', { studentId: internship.studentId })}
            className="h-10 px-4 bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#171d19] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <User className="w-4 h-4 text-[#006948]" />
            <span>Hồ sơ sinh viên</span>
          </button>
        </div>
      </div>

      {/* ── 4 TABS ── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] px-4 shadow-xs">
        <nav className="flex gap-6 overflow-x-auto">
          {[
            { id: 'reports', label: `Báo cáo tuần (${internship.weeklyReports.length})` },
            { id: 'overview', label: 'Tổng quan thực tập' },
            { id: 'mentor_eval', label: 'Đánh giá doanh nghiệp (Mentor)' },
            { id: 'academic_eval', label: 'Đánh giá cuối kỳ của Cố vấn' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 font-['Inter'] text-xs font-bold whitespace-nowrap transition-colors border-b-2 ${isActive
                    ? 'border-[#006948] text-[#006948]'
                    : 'border-transparent text-[#64748B] hover:text-[#171d19]'
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── TAB 1: WEEKLY REPORTS ── */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Weekly Reports List (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {internship.weeklyReports.map((report) => (
              <div
                key={report.week}
                className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4"
              >
                <div className="flex justify-between items-start border-b border-[#E2E8F0] pb-3">
                  <div>
                    <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#171d19]">
                      Báo cáo Tuần {report.week}
                    </h3>
                    <p className="font-['Inter'] text-xs text-[#64748B]">{report.period}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#ECFDF5] text-[#006948] font-['Inter'] text-xs font-bold border border-[#006948]/20">
                    {report.mentorScore}
                  </span>
                </div>

                <div className="space-y-3 font-['Inter'] text-xs text-[#334155]">
                  <div>
                    <h4 className="font-bold text-[#171d19] mb-1">Công việc đã thực hiện:</h4>
                    <pre className="whitespace-pre-line font-['Inter'] bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                      {report.workDone}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-bold text-[#171d19] mb-1">Khó khăn gặp phải:</h4>
                    <p className="bg-[#FFFBEB] p-2.5 rounded-lg border border-[#FDE68A] text-[#92400E]">
                      {report.challenges}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-[#171d19] mb-1">Kế hoạch tuần tiếp theo:</h4>
                    <p className="bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                      {report.nextPlan}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-[#006948] mb-1">Nhận xét của Mentor Doanh nghiệp:</h4>
                    <p className="bg-[#ECFDF5] p-3 rounded-lg border border-[#A7F3D0] text-[#065F46] font-medium">
                      &quot;{report.mentorFeedback}&quot;
                    </p>
                  </div>

                  {report.attachments && report.attachments.length > 0 && (
                    <div className="pt-2">
                      <h4 className="font-bold text-[#171d19] mb-1.5">Tệp đính kèm:</h4>
                      <div className="flex flex-wrap gap-2">
                          {report.attachments.map((file: string, i: number) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#006948]"
                          >
                            <FileText className="w-3.5 h-3.5" /> {file}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Counselor Review Form & Mentor Evaluation (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
              <h3 className="font-['Plus_Jakarta_Sans'] text-base font-semibold text-[#171d19] flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#006948]" />
                <span>Nhận xét của Cố vấn Khoa</span>
              </h3>

              <form onSubmit={handleSendFeedback} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1 font-['Inter']">
                    Nội dung đánh giá tuần {internship.currentWeek}
                  </label>
                  <textarea
                    rows={4}
                    value={counselorFeedback}
                    onChange={(e) => setCounselorFeedback(e.target.value)}
                    placeholder="Góp ý định hướng chuyên môn, nhắc nhở tiến độ..."
                    className="w-full p-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-['Inter'] focus:outline-none focus:border-[#006948]"
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="w-full h-10 bg-[#006948] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Lưu &amp; Gửi nhận xét cho SV</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
