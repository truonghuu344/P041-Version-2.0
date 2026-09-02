/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Building2,
  Briefcase,
  Users,
  MapPin,
  Mail,
  Phone,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Globe,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { CounselorTab } from './CounselorNavbar';

import { CounselorApi } from '@/lib/api/counselorApi';

interface CounselorPartnerDetailProps {
  partnerId?: string;
  onNavigate: (tab: CounselorTab, params?: any) => void;
}

export default function CounselorPartnerDetail({
  partnerId = 'partner-1',
  onNavigate,
}: CounselorPartnerDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'students' | 'contacts'>('overview');
  const [isLoading, setIsLoading] = useState(true);

  const [partner, setPartner] = useState({
    id: partnerId,
    name: 'TechNova Solutions (FPT Software)',
    logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA_eoGZO88yKZWZFXfVYr78KQstygUZRd8LhpPEES-JTL_Sz2GwhiYbwmLarr8cCzWBw3hhNHnx4tIMlRVQODktdnxACdg_veFgyOxsb5iaQl4qlRy-MfLlpOeqcBGRs0LAJ48tC4jfJMcidJhFy8yjspbbBqL_orxPE1RH1lnFaBj-3R4W8kUoNmEvYnQjAbOfzQ0XRbl3CslE1z_uSovw2CQjAbz-x2qMWw1wWAvytXt6shrjriU',
    banner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBltZzmK6lRicrb6at7APJAcTGxlMyt4Cu5AHpHIk5y0YLZUTU_Ny0YY_0mMbc2hPt8F51A_Y94DzN6AJ9NlptImyfDmw30pflYdU-KR_dnOU9rLRWU_2HTytuM7iDFHaJYJBXFlB0UK6_qF7ym8aRPn3Vko4IXhlCUGJqY_y0CfzEEONR1EIQbYaL2Qs9yB2VxN7d8OXyYY8tTDeyL7Mm3H9nxJH8YPUzHqLAy51BWWpRvKofrTx4',
    industry: 'Công nghệ / Phần mềm',
    tier: 'Đối tác chiến lược',
    founded: '2015',
    scale: '500+ nhân viên',
    location: 'Tòa nhà FPT, Khu Công nghệ cao Hòa Lạc / TP. HCM',
    website: 'https://fptsoftware.com',
    description:
      'FPT Software là công ty công nghệ hàng đầu Đông Nam Á với hơn 30,000 kỹ sư trên toàn cầu, hợp tác tiếp nhận từ 50-100 sinh viên thực tập mỗi năm từ nhà trường.',
    activeJobs: [] as Array<{ id: string; title: string; slots: number; deadline: string }>,
    connectedStudents: [] as Array<{ id: string; name: string; role: string; status: string }>,
    hrContacts: [
      {
        name: 'Hoàng Mai Lan',
        role: 'University Relations & Talent Acquisition Lead',
        email: 'lan.hm@fptsoftware.com',
        phone: '024 7300 8888 (Ext: 104)',
      },
      {
        name: 'Trần Quốc Bảo',
        role: 'Technical Recruiter',
        email: 'bao.tq@fptsoftware.com',
        phone: '0988 123 456',
      },
    ],
  });

  useEffect(() => {
    let isMounted = true;
    const fetchPartner = async () => {
      try {
        setIsLoading(true);
        const data = await CounselorApi.getPartnerDetail(partnerId);
        if (data && isMounted) {
          setPartner((prev) => ({
            ...prev,
            id: data.id,
            name: data.name,
            industry: data.industry,
            location: data.location,
            description: data.description,
          }));
          const jobs = await CounselorApi.getOpportunities({ tab: 'jobs' });
          if (isMounted) {
            setPartner((prev) => ({
              ...prev,
              activeJobs: jobs
                .filter((job) => job.company === data.name)
                .map((job) => ({ id: job.id, title: job.position, slots: job.slots, deadline: job.deadline || '' })),
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load partner detail:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchPartner();
    return () => {
      isMounted = false;
    };
  }, [partnerId]);

  return (
    <div className="space-y-6 pb-6 antialiased">
      {/* ── BREADCRUMB ── */}
      <div>
        <nav aria-label="Breadcrumb" className="flex items-center text-xs text-[#64748B] mb-2 font-['Inter']">
          <button
            type="button"
            onClick={() => onNavigate('partners')}
            className="hover:text-[#006948] transition-colors"
          >
            Mạng lưới đối tác
          </button>
          <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-[#CBD5E1]" />
          <span className="text-[#171d19] font-semibold">{partner.name}</span>
        </nav>
        <button
          type="button"
          onClick={() => onNavigate('partners')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] hover:text-[#006948] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Mạng lưới Đối tác</span>
        </button>
      </div>

      {/* ── PAGE HEADER ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl md:text-3xl font-bold text-[#171d19]">
            Hồ sơ Doanh nghiệp Đối tác
          </h1>
          <p className="font-['Inter'] text-sm md:text-base text-[#475569] mt-1">
            Thông tin chi tiết, vị trí tuyển dụng và sinh viên đang kết nối với đối tác.
          </p>
        </div>
        <div className="counselor-toolbar flex items-center gap-3">
          <a
            href={partner.website}
            target="_blank"
            rel="noreferrer"
            className="h-10 px-4 bg-white border border-[#CBD5E1] text-[#171d19] rounded-lg font-['Inter'] text-xs font-semibold hover:bg-[#F8FAFC] transition-colors inline-flex items-center gap-1.5"
          >
            <span>Trang chủ Doanh nghiệp</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#64748B]" />
          </a>
        </div>
      </header>

      {/* ── BENTO GRID LAYOUT (4:8 SPLIT) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Company Identity & Basic Info (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Identity Card */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full overflow-hidden border border-[#E2E8F0] shadow-xs mb-4 p-2 bg-[#F8FAFC]">
              <img src={partner.logo} alt={partner.name} className="w-full h-full object-contain" />
            </div>
            <h2 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#171d19]">
              {partner.name}
            </h2>
            <p className="font-['Inter'] text-xs text-[#64748B] mb-4">{partner.industry}</p>

            <div className="w-full flex justify-between items-center px-4 py-2 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
              <span className="font-['Inter'] text-xs text-[#475569]">Trạng thái liên kết</span>
              <span className="px-2.5 py-0.5 bg-[#ECFDF5] text-[#006948] rounded-full font-['Inter'] text-xs font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 fill-[#006948] text-white" /> Đã xác minh
              </span>
            </div>
          </div>

          {/* Basic Info Card */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5 font-['Inter'] text-xs space-y-4">
            <h3 className="font-['Plus_Jakarta_Sans'] text-base font-semibold text-[#171d19]">
              Thông tin cơ bản
            </h3>
            <div className="space-y-3">
              <div>
                <span className="block text-[#64748B] mb-0.5">Năm thành lập</span>
                <span className="font-semibold text-[#171d19]">{partner.founded}</span>
              </div>
              <div>
                <span className="block text-[#64748B] mb-0.5">Quy mô nhân sự</span>
                <span className="font-semibold text-[#171d19]">{partner.scale}</span>
              </div>
              <div>
                <span className="block text-[#64748B] mb-0.5">Địa chỉ</span>
                <span className="font-semibold text-[#171d19] flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#006948]" /> {partner.location}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Cover, Tabs & Detail Sections (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Cover Photo */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden h-48 relative shadow-xs">
            <img src={partner.banner} alt={partner.name} className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
              <span className="text-white font-['Plus_Jakarta_Sans'] text-lg font-bold">
                {partner.name} — Đối tác chiến lược
              </span>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] px-4 shadow-xs">
            <nav className="flex gap-6 overflow-x-auto">
              {[
                { id: 'overview', label: 'Tổng quan' },
                { id: 'jobs', label: `Vị trí tuyển dụng (${partner.activeJobs.length})` },
                { id: 'students', label: `Sinh viên đang kết nối (${partner.connectedStudents.length})` },
                { id: 'contacts', label: 'Đầu mối HR' },
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

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
              <h3 className="font-['Plus_Jakarta_Sans'] text-base font-semibold text-[#171d19]">
                Giới thiệu Doanh nghiệp &amp; Quan hệ Hợp tác
              </h3>
              <p className="font-['Inter'] text-xs text-[#475569] leading-relaxed">
                {partner.description}
              </p>
            </div>
          )}

          {/* Tab 2: Jobs */}
          {activeTab === 'jobs' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partner.activeJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div>
                    <h4 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#171d19]">{job.title}</h4>
                    <p className="font-['Inter'] text-xs text-[#006948] font-semibold mt-1">Chỉ tiêu: {job.slots} sinh viên</p>
                    <p className="font-['Inter'] text-[11px] text-[#64748B] mt-0.5">Hạn nộp: {job.deadline}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate('suitable-candidates', {
                        jobId: job.id,
                        position: job.title,
                        company: partner.name,
                      })
                    }
                    className="w-full h-10 bg-[#ECFDF5] text-[#006948] hover:bg-[#006948] hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center"
                  >
                    Xem sinh viên phù hợp
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Connected Students */}
          {activeTab === 'students' && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
              <table className="w-full text-left font-['Inter'] text-xs">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold uppercase">
                  <tr>
                    <th className="px-5 py-3.5">Sinh viên</th>
                    <th className="px-5 py-3.5">Vị trí kết nối</th>
                    <th className="px-5 py-3.5">Trạng thái</th>
                    <th className="px-5 py-3.5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {partner.connectedStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3.5 font-bold text-[#171d19]">{s.name}</td>
                      <td className="px-5 py-3.5">{s.role}</td>
                      <td className="px-5 py-3.5 text-[#006948] font-semibold">{s.status}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => onNavigate('student-detail', { studentId: s.id })}
                          className="text-[#006948] hover:underline font-semibold"
                        >
                          Chi tiết hồ sơ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 4: Contacts */}
          {activeTab === 'contacts' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partner.hrContacts.map((contact, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-3 font-['Inter']"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#ECFDF5] text-[#006948] font-bold flex items-center justify-center text-xs">
                      HR
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#171d19]">{contact.name}</h4>
                      <p className="text-xs text-[#64748B]">{contact.role}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E2E8F0] space-y-1.5 text-xs text-[#475569]">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#006948]" />
                      <span>{contact.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#006948]" />
                      <span>{contact.phone}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
