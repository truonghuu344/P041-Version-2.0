/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Briefcase,
  Building2,
  Calendar,
  Users,
  CheckCircle2,
  ChevronRight,
  Send,
  Search,
  ArrowRight,
  Filter,
  Layers,
  Clock,
  MapPin,
  Banknote,
  TrendingUp,
  Tag,
  Sparkles,
} from 'lucide-react';
import { CounselorTab } from './CounselorNavbar';
import AppPagination from '@/components/shared/AppPagination';
import CompanyLogoBadge from './CompanyLogoBadge';
import { CounselorApi, OpportunityItem } from '@/lib/api/counselorApi';

interface CounselorOpportunitiesProps {
  onNavigate: (tab: CounselorTab, params?: any) => void;
  initialTab?: 'jobs' | 'requests';
}

function cleanTitle(raw: string): string {
  if (!raw) return 'Vị trí tuyển dụng';
  const t = raw
    .replace(/^#+\s*/g, '')
    .replace(/^CV\s*[-_:]*\s*/i, '')
    .replace(/^JD\s*[-_:]*\s*/i, '')
    .trim();

  // If title looks like a person's name or CV title, normalize to a clean professional job role
  if (/^(NGUYEN|TRAN|LE|PHAM|HOANG|VU|VO|DANG|BUI|DO|HO|NGO|DUONG|LY)/i.test(t) || /^[A-Z][a-z]+[A-Z][a-z]+/.test(t)) {
    if (/DEVOPS/i.test(t)) return 'Kỹ sư DevOps (Intern / Fresher)';
    if (/FRONTEND/i.test(t)) return 'Lập trình viên Frontend (ReactJS)';
    if (/BACKEND/i.test(t)) return 'Lập trình viên Backend';
    if (/AI|MACHINE/i.test(t)) return 'Kỹ sư Trí tuệ nhân tạo (AI / ML)';
    if (/FULL\s*STACK/i.test(t)) return 'Full Stack Developer';
    return 'Thực tập sinh Công nghệ thông tin';
  }

  return t || 'Vị trí tuyển dụng';
}

function cleanLocation(loc?: string): string {
  if (!loc || loc === 'Chưa' || loc === 'Khác' || loc === 'Chưa xác định' || loc === 'TP. H' || loc === 'TP. Hồ Chí M') {
    return 'TP. Hồ Chí Minh';
  }
  if (loc.startsWith('TP. H')) {
    return 'TP. Hồ Chí Minh';
  }
  return loc;
}

function cleanCompany(comp?: string): string {
  if (!comp || comp.includes('Cá nhân / Công ty ngoài') || comp.trim() === 'Khác' || comp.trim() === 'Chưa') {
    return 'Doanh nghiệp đối tác';
  }
  return comp;
}

export default function CounselorOpportunities({
  onNavigate,
  initialTab = 'requests',
}: CounselorOpportunitiesProps) {
  const [activeTab, setActiveTab] = useState<'jobs' | 'requests'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedField, setSelectedField] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchOpportunities = async () => {
      try {
        setIsLoading(true);
        const data = await CounselorApi.getOpportunities({
          tab: activeTab,
          search: searchQuery,
          field: selectedField,
        });
        if (isMounted) {
          setOpportunities(data);
        }
      } catch (err) {
        console.error('Failed to load opportunities:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchOpportunities();
    return () => {
      isMounted = false;
    };
  }, [activeTab, searchQuery, selectedField]);

  const currentList = opportunities;

  const filteredItems = useMemo(() => {
    return currentList.filter((item) => {
      const matchSearch =
        item.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.mustHave.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;
      if (selectedField !== 'all' && item.field !== selectedField) return false;
      return true;
    });
  }, [currentList, searchQuery, selectedField]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const handleProposeCandidates = (item: any) => {
    onNavigate('suitable-candidates', {
      jobId: item.id,
      position: cleanTitle(item.position),
      company: cleanCompany(item.company),
      slots: item.slots,
    });
  };

  // Quick stats calculation
  const totalSlots = useMemo(() => {
    return opportunities.reduce((acc, curr) => acc + (curr.slots || 1), 0);
  }, [opportunities]);

  const uniqueCompanies = useMemo(() => {
    return new Set(opportunities.map((o) => o.company)).size;
  }, [opportunities]);

  return (
    <div className="space-y-5 pb-6 antialiased">
      {/* ── PAGE HEADER & STATS STRIP ── */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl md:text-3xl font-bold tracking-tight text-[#171d19]">
            Cơ hội việc làm
          </h1>
          <p className="font-['Inter'] text-sm text-[#475569] mt-0.5">
            Danh sách vị trí đang tuyển dụng từ đối tác — lựa chọn và tiến cử ứng viên phù hợp
          </p>
        </div>

        {/* Quick summary chips */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <Briefcase className="w-4 h-4 text-[#006948]" />
            <span className="text-xs text-slate-600">
              <strong className="text-slate-900 font-bold">{opportunities.length}</strong> cơ hội mở
            </span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <Users className="w-4 h-4 text-amber-600" />
            <span className="text-xs text-slate-600">
              Chỉ tiêu: <strong className="text-amber-800 font-bold">{totalSlots}</strong> ứng viên
            </span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-slate-600">
              <strong className="text-slate-900 font-bold">{uniqueCompanies}</strong> doanh nghiệp
            </span>
          </div>
        </div>
      </header>

      {/* ── TABS (SEGMENTED PILL SYSTEM) ── */}
      <div className="bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 shadow-2xs inline-flex gap-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('requests');
            setCurrentPage(1);
          }}
          className={`px-4 py-2 font-['Inter'] text-xs font-bold rounded-xl transition-all ${
            activeTab === 'requests'
              ? 'bg-[#006948] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          Yêu cầu từ doanh nghiệp đối tác
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('jobs');
            setCurrentPage(1);
          }}
          className={`px-4 py-2 font-['Inter'] text-xs font-bold rounded-xl transition-all ${
            activeTab === 'jobs'
              ? 'bg-[#006948] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          Tin tuyển dụng mở rộng (Public JDs)
        </button>
      </div>

      {/* ── FILTERS & SEARCH TOOLBAR ── */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto">
          <span className="font-['Inter'] text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-0.5">
            Lọc:
          </span>
          <select
            value={selectedField}
            onChange={(e) => {
              setSelectedField(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 px-3 bg-white border border-slate-300 rounded-xl font-['Inter'] text-xs md:text-sm text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all cursor-pointer shadow-2xs w-full sm:w-auto"
          >
            <option value="all">Tất cả lĩnh vực</option>
            <option value="it">Công nghệ thông tin</option>
            <option value="biz">Kinh doanh / Dữ liệu</option>
            <option value="design">Thiết kế UI/UX</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-10 px-3 bg-white border border-slate-300 rounded-xl font-['Inter'] text-xs md:text-sm text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all cursor-pointer shadow-2xs w-full sm:w-auto"
          >
            <option value="newest">Mới cập nhật</option>
            <option value="slots">Số lượng tuyển</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Tìm theo vị trí, công ty, kỹ năng..."
            className="w-full h-10 pl-9 pr-3.5 bg-white border border-slate-300 rounded-xl font-['Inter'] text-xs md:text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all placeholder:text-slate-400 shadow-2xs"
          />
        </div>
      </div>

      {/* ── BENTO GRID - JOB OPPORTUNITY CARDS ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs animate-pulse flex flex-col gap-4 h-[240px]"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-slate-200" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
              <div className="h-10 bg-slate-100 rounded-xl mt-auto" />
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#006948] flex items-center justify-center mx-auto">
            <Briefcase className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Không tìm thấy cơ hội việc làm nào phù hợp với bộ lọc
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Hãy thử tìm kiếm với từ khóa khác hoặc điều chỉnh lại lựa chọn ngành nghề.
          </p>
          {(searchQuery || selectedField !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedField('all');
                setCurrentPage(1);
              }}
              className="mt-2 h-9 px-4 bg-[#006948] text-white text-xs font-semibold rounded-lg hover:bg-[#047857] transition-colors shadow-2xs"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedItems.map((item) => {
            const title = cleanTitle(item.position);
            const comp = cleanCompany(item.company);
            const loc = cleanLocation(item.location);
            const validSkills = (item.mustHave || []).filter(
              (s) => s && s.trim() !== '' && !s.toLowerCase().includes('speech-to-text') && s.length < 25
            );

            return (
              <div
                key={item.id}
                onClick={() => handleProposeCandidates(item)}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 hover:border-emerald-500/70 hover:shadow-md transition-all duration-200 flex flex-col justify-between group cursor-pointer relative"
              >
                {/* 1. Header: Logo, Company info and Status */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <CompanyLogoBadge company={comp} logoUrl={item.logo} size="md" />
                      <div className="min-w-0">
                        <span className="font-['Inter'] text-xs font-bold text-slate-800 block truncate">
                          {comp}
                        </span>
                        <span className="font-['Inter'] text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{loc}</span>
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-[#006948] border border-emerald-200/70 shadow-2xs inline-flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Đang tuyển
                    </span>
                  </div>

                  {/* 2. Position Title (Primary Focus) */}
                  <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-slate-900 group-hover:text-[#006948] transition-colors leading-snug line-clamp-2 mb-3 min-h-[44px]">
                    {title}
                  </h3>

                  {/* 3. Key Badges: Employment Type & Quantity */}
                  <div className="flex items-center gap-2 flex-wrap mb-3.5">
                    <span className="px-2.5 py-1 bg-slate-100 rounded-lg font-['Inter'] text-xs text-slate-700 font-semibold">
                      {item.type || 'Thực tập'}
                    </span>
                    <span className="px-2.5 py-1 bg-amber-50 border border-amber-200/80 rounded-lg font-['Inter'] text-xs text-amber-900 font-bold">
                      Số lượng: {String(item.slots || 1).padStart(2, '0')}
                    </span>
                  </div>

                  {/* 4. Skills Pills */}
                  {validSkills.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-4">
                      {validSkills.slice(0, 3).map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-emerald-50/80 border border-emerald-200/50 rounded-md font-['Inter'] text-[11px] text-[#006948] font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                      {validSkills.length > 3 && (
                        <span className="text-[11px] text-slate-400 font-medium self-center">
                          +{validSkills.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. Bottom Bar: Focal Salary & Action Button */}
                <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-3 mt-auto">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                      Trợ cấp / Lương
                    </span>
                    <span className="font-['Inter'] text-xs md:text-sm font-extrabold text-slate-900">
                      {item.allowance || 'Thỏa thuận'}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#006948] text-white font-['Inter'] text-xs font-bold hover:bg-[#047857] transition-all shadow-xs group-hover:translate-x-0.5 shrink-0"
                  >
                    <span>Tiến cử ứng viên</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── PAGINATION CONTROLS ── */}
      <AppPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredItems.length}
        pageSize={pageSize}
        pageSizeOptions={[6, 12, 24]}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
        itemLabel="cơ hội"
      />
    </div>
  );
}
