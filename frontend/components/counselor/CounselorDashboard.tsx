/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  FileCheck,
  AlertCircle,
  Briefcase,
  Send,
  Clock,
  Calendar,
  ChevronRight,
  TrendingUp,
  Building2,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  MapPin,
  Banknote,
  GraduationCap,
} from 'lucide-react';
import { CounselorTab } from './CounselorNavbar';
import StatusBadge from '@/components/shared/StatusBadge';
import DeadlineIndicator from '@/components/shared/DeadlineIndicator';
import CompanyLogoBadge from './CompanyLogoBadge';

interface CounselorDashboardProps {
  onNavigate: (tab: CounselorTab, params?: any) => void;
  onOpenConfirmModal?: (student: any) => void;
  onOpenReferralModal?: (jobInfo?: any) => void;
}

export default function CounselorDashboard({
  onNavigate,
  onOpenConfirmModal,
  onOpenReferralModal,
}: CounselorDashboardProps) {
  const [stats, setStats] = useState({
    totalStudents: 0,
    pendingCVReview: 0,
    partnerCompanies: 0,
    openTalentRequests: 0,
    upcomingInterviews: 0,
  });

  const [interviewingStudents, setInterviewingStudents] = useState<any[]>([]);
  const [urgentActions, setUrgentActions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchDashboard = async () => {
      try {
        setIsLoading(true);
        if (typeof window !== 'undefined' && (window as any).ApiClient?.getCounselorDashboard) {
          const res = await (window as any).ApiClient.getCounselorDashboard();
          if (res && isMounted) {
            setStats({
              totalStudents: res.total_students ?? 0,
              pendingCVReview: res.pending_cv_review ?? 0,
              partnerCompanies: res.partner_companies ?? 0,
              openTalentRequests: res.open_talent_requests ?? 0,
              upcomingInterviews: res.upcoming_interviews ?? 0,
            });
            if (res.interviewing_students) {
              setInterviewingStudents(res.interviewing_students);
            }
            if (res.urgent_actions) {
              const iconMap: Record<string, any> = {
                warning: Clock,
                danger: AlertTriangle,
                info: Calendar,
                success: CheckCircle2,
              };
              setUrgentActions(
                res.urgent_actions.map((act: any) => ({
                  ...act,
                  icon: iconMap[act.severity] || Clock,
                  targetTab: (act.targetTab || 'students') as CounselorTab,
                }))
              );
            }
          }
        }
      } catch (e) {
        console.error('Failed to load counselor dashboard data:', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const todayFormatted = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6 pb-6 antialiased">
      {/* ── HEADER ── */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl md:text-3xl font-bold tracking-tight text-[#171d19]">
            Tổng quan Cố vấn
          </h1>
          <p className="font-['Inter'] text-sm text-[#475569] mt-0.5">
            Theo dõi tiến độ sinh viên, kết nối cơ hội thực tập & tuyển dụng doanh nghiệp
          </p>
        </div>
        <div className="flex items-center gap-2.5 h-10 bg-white border border-[#E2E8F0] rounded-xl px-3.5 shadow-xs shrink-0">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span className="font-['Inter'] text-xs md:text-sm font-medium text-slate-700">
            {todayFormatted}
          </span>
        </div>
      </header>

      {/* ── KPI OVERVIEW (4 TILES) ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" id="counselor-kpi-overview">
        {/* Card 1: Sinh viên */}
        <div
          onClick={() => onNavigate('students')}
          className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs hover:border-emerald-500/40 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group min-h-[145px] relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#006948] flex items-center justify-center border border-emerald-100/60">
              <Users className="w-5 h-5" />
            </div>
            <span className="bg-emerald-50 text-[#006948] font-['Inter'] text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200/50">
              <TrendingUp className="w-3 h-3" /> +4 tuần này
            </span>
          </div>
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#171d19] group-hover:text-[#006948] transition-colors">
              {stats.totalStudents}
            </h3>
            <p className="font-['Inter'] text-xs font-medium text-slate-500 mt-1">Sinh viên đang hỗ trợ</p>
          </div>
        </div>

        {/* Card 2: CV chờ duyệt */}
        <div
          onClick={() => onNavigate('students', { filter: 'pending' })}
          className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs hover:border-amber-500/40 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group min-h-[145px] relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <FileCheck className="w-5 h-5" />
            </div>
            <span className="bg-amber-50 text-amber-700 border border-amber-200/60 font-['Inter'] text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Cần duyệt
            </span>
          </div>
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#171d19] group-hover:text-amber-600 transition-colors">
              {stats.pendingCVReview}
            </h3>
            <p className="font-['Inter'] text-xs font-medium text-slate-500 mt-1">CV chờ duyệt</p>
          </div>
        </div>

        {/* Card 3: Yêu cầu nhân lực */}
        <div
          onClick={() => onNavigate('opportunities', { tab: 'requests' })}
          className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs hover:border-blue-500/40 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group min-h-[145px] relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="bg-blue-50 text-blue-700 border border-blue-200/60 font-['Inter'] text-[11px] font-bold px-2.5 py-1 rounded-full">
              Mới nhất
            </span>
          </div>
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#171d19] group-hover:text-blue-600 transition-colors">
              {stats.openTalentRequests}
            </h3>
            <p className="font-['Inter'] text-xs font-medium text-slate-500 mt-1">Yêu cầu nhân lực đối tác</p>
          </div>
        </div>

        {/* Card 4: Doanh nghiệp */}
        <div
          onClick={() => onNavigate('partners')}
          className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs hover:border-emerald-500/40 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group min-h-[145px] relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="bg-slate-100 text-slate-600 font-['Inter'] text-[11px] font-semibold px-2.5 py-1 rounded-full">
              Đối tác
            </span>
          </div>
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#171d19] group-hover:text-[#006948] transition-colors">
              {stats.partnerCompanies}
            </h3>
            <p className="font-['Inter'] text-xs font-medium text-slate-500 mt-1">Doanh nghiệp liên kết</p>
          </div>
        </div>
      </section>

      {/* ── INTERVIEWING PROGRESS TABLE ── */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 md:p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="font-['Plus_Jakarta_Sans'] text-base md:text-lg font-bold text-[#171d19] flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              Tiến độ phỏng vấn sinh viên
            </h2>
            <p className="font-['Inter'] text-xs text-slate-500 mt-0.5">
              Sinh viên đang trong các vòng đánh giá tuyển dụng từ doanh nghiệp
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('referrals', { tab: 'interviewing' })}
            className="text-[#006948] font-['Inter'] text-xs font-bold hover:text-[#047857] transition-colors inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/50"
          >
            Xem tất cả ({interviewingStudents.length}) <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-slate-500 font-['Inter'] text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-3 px-5">Ứng viên</th>
                <th className="py-3 px-5">Vị trí &amp; Doanh nghiệp</th>
                <th className="py-3 px-5 text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {interviewingStudents.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onNavigate('student-detail', { studentId: item.id })}
                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                >
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100/70 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden">
                        {item.avatar ? (
                          <img src={item.avatar} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          item.initials || item.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="font-['Inter'] text-sm font-bold text-[#171d19] group-hover:text-[#006948] transition-colors">
                          {item.name}
                        </p>
                        <p className="font-['Inter'] text-xs text-slate-500">{item.major}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <CompanyLogoBadge company={item.company} size="sm" />
                      <div>
                        <p className="font-['Inter'] text-sm font-semibold text-slate-800">{item.position}</p>
                        <p className="font-['Inter'] text-xs text-slate-500">{item.company}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <StatusBadge status={item.status} label={item.statusLabel} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FEATURED JOB OPPORTUNITIES (BENTO CARDS WITH COMPANY LOGOS) ── */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-[#E2E8F0]">
          <div>
            <h2 className="font-['Plus_Jakarta_Sans'] text-base md:text-lg font-bold text-[#171d19] flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-600" />
              Cơ hội việc làm &amp; Yêu cầu tuyển dụng nổi bật
            </h2>
            <p className="font-['Inter'] text-xs text-slate-500 mt-0.5">
              Các vị trí đang mở từ doanh nghiệp đối tác hàng đầu
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('opportunities')}
            className="text-[#006948] font-['Inter'] text-xs font-bold hover:text-[#047857] transition-colors inline-flex items-center gap-1"
          >
            Khám phá thêm <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: FPT */}
          <div
            onClick={() =>
              onNavigate('suitable-candidates', {
                jobId: 'req-01',
                position: 'Fresher Frontend ReactJS',
                company: 'FPT Software',
                slots: 5,
              })
            }
            className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <CompanyLogoBadge company="FPT Software" size="md" />
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  Tuyển 5 SV
                </span>
              </div>
              <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors mb-1">
                Fresher Frontend ReactJS
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                <Building2 className="w-3 h-3 text-slate-400" /> FPT Software • TP.HCM
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                12 SV phù hợp
              </span>
              <span className="text-xs font-bold text-[#006948] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Tiến cử ngay →
              </span>
            </div>
          </div>

          {/* Card 2: VNG */}
          <div
            onClick={() =>
              onNavigate('suitable-candidates', {
                jobId: 'req-02',
                position: 'Java Backend Intern',
                company: 'VNG Corporation',
                slots: 3,
              })
            }
            className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <CompanyLogoBadge company="VNG Corporation" size="md" />
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                  Tuyển 3 SV
                </span>
              </div>
              <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors mb-1">
                Java Backend Intern
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                <Building2 className="w-3 h-3 text-slate-400" /> VNG Corporation • TP.HCM
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                8 SV phù hợp
              </span>
              <span className="text-xs font-bold text-[#006948] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Tiến cử ngay →
              </span>
            </div>
          </div>

          {/* Card 3: Viettel */}
          <div
            onClick={() =>
              onNavigate('suitable-candidates', {
                jobId: 'req-03',
                position: 'AI / Data Science Trainee',
                company: 'Viettel Telecom',
                slots: 2,
              })
            }
            className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <CompanyLogoBadge company="Viettel Telecom" size="md" />
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                  Tuyển 2 SV
                </span>
              </div>
              <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors mb-1">
                AI / Data Science Trainee
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                <Building2 className="w-3 h-3 text-slate-400" /> Viettel Telecom • Hà Nội
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                6 SV phù hợp
              </span>
              <span className="text-xs font-bold text-[#006948] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Tiến cử ngay →
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
