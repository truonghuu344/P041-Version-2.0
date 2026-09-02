/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Briefcase,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  MapPin,
  School,
  Grid,
  Filter,
  ArrowRight,
} from 'lucide-react';
import { CounselorTab } from './CounselorNavbar';
import AppPagination from '@/components/shared/AppPagination';
import { CounselorApi, PartnerItem } from '@/lib/api/counselorApi';

interface CounselorPartnersListProps {
  onNavigate: (tab: CounselorTab, params?: any) => void;
}

export default function CounselorPartnersList({
  onNavigate,
}: CounselorPartnersListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchPartners = async () => {
      try {
        setIsLoading(true);
        const data = await CounselorApi.getPartners();
        if (isMounted) {
          setPartners(data);
        }
      } catch (err) {
        console.error('Failed to load partners:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchPartners();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;
      if (selectedIndustry !== 'all' && p.industry !== selectedIndustry) {
        return false;
      }
      return true;
    });
  }, [partners, searchQuery, selectedIndustry]);

  const totalPages = Math.ceil(filteredPartners.length / pageSize) || 1;
  const paginatedPartners = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPartners.slice(start, start + pageSize);
  }, [filteredPartners, currentPage, pageSize]);

  return (
    <div className="space-y-6 pb-6 antialiased">
      {/* ── HEADER SECTION ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl md:text-3xl font-bold text-[#171d19]">
            Mạng lưới đối tác
          </h1>
          <p className="font-['Inter'] text-sm md:text-base text-[#475569] mt-1">
            Danh sách doanh nghiệp liên kết và theo dõi số lượng sinh viên đang thực tập.
          </p>
        </div>
        <div className="counselor-toolbar flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm kiếm doanh nghiệp..."
              className="w-full h-10 pl-9 pr-4 bg-white border border-[#CBD5E1] rounded-lg font-['Inter'] text-xs text-[#171d19] focus:outline-none focus:border-[#006948] transition-colors placeholder:text-[#64748B]"
            />
          </div>
          <button
            type="button"
            className="h-10 px-4 flex items-center gap-2 bg-white border border-[#CBD5E1] rounded-lg text-[#475569] hover:bg-[#F8FAFC] transition-colors font-['Inter'] text-xs font-semibold"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Lọc</span>
          </button>
        </div>
      </header>

      {/* ── STATS OVERVIEW (3 BENTO TOP ROW CARDS) ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs flex items-start justify-between">
          <div>
            <p className="font-['Inter'] text-xs text-[#64748B] uppercase tracking-wider mb-1 font-semibold">
              Tổng doanh nghiệp
            </p>
            <p className="font-['Plus_Jakarta_Sans'] text-4xl font-bold text-[#171d19]">142</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-[#ECFDF5] flex items-center justify-center text-[#006948]">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs flex items-start justify-between">
          <div>
            <p className="font-['Inter'] text-xs text-[#64748B] uppercase tracking-wider mb-1 font-semibold">
              SV đang thực tập
            </p>
            <p className="font-['Plus_Jakarta_Sans'] text-4xl font-bold text-[#006948]">856</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-[#ECFDF5] flex items-center justify-center text-[#006948]">
            <School className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs flex items-start justify-between">
          <div>
            <p className="font-['Inter'] text-xs text-[#64748B] uppercase tracking-wider mb-1 font-semibold">
              Lĩnh vực hoạt động
            </p>
            <p className="font-['Plus_Jakarta_Sans'] text-4xl font-bold text-[#171d19]">24</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-[#ECFDF5] flex items-center justify-center text-[#006948]">
            <Grid className="w-5 h-5" />
          </div>
        </div>
      </section>


      {/* ── PARTNER GRID (3 COLUMNS) ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-['Plus_Jakarta_Sans'] text-lg font-semibold text-[#171d19]">
            Doanh nghiệp nổi bật
          </h2>
        </div>

        {filteredPartners.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#006948] flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#171d19]">
              Chưa có doanh nghiệp đối tác nào phù hợp
            </h3>
            <p className="text-xs text-[#64748B] max-w-md mx-auto">
              Hãy thử tìm kiếm với từ khóa hoặc tên doanh nghiệp khác.
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="mt-2 px-4 py-2 bg-[#006948] text-white text-xs font-semibold rounded-xl hover:bg-[#047857] transition-colors"
              >
                Xóa tìm kiếm
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
            {paginatedPartners.map((partner) => (
              <div
                key={partner.id}
                onClick={() => onNavigate('partner-detail', { partnerId: partner.id })}
                className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden hover:border-[#006948]/40 hover:bg-[#F8FAFC]/50 transition-colors flex flex-col group cursor-pointer"
              >
                {/* Cover Banner */}
                <div className="h-32 w-full bg-[#eff5ef] relative overflow-hidden">
                  <img
                    src={partner.banner}
                    alt={partner.name}
                    className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity"
                  />
                  {/* Overlay Logo */}
                  <div className="absolute -bottom-5 left-5 w-14 h-14 bg-white rounded-lg border border-[#E2E8F0] flex items-center justify-center shadow-xs overflow-hidden p-1.5">
                    <img src={partner.logo} alt={partner.name} className="w-full h-full object-contain" />
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 pt-7 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h3 className="font-['Plus_Jakarta_Sans'] text-base font-semibold text-[#171d19] group-hover:text-[#006948] transition-colors">
                      {partner.name}
                    </h3>
                    <span className="px-2.5 py-0.5 bg-[#F1F5F9] text-[#475569] font-['Inter'] text-[11px] font-medium rounded-md shrink-0">
                      {partner.industry}
                    </span>
                  </div>

                  <p className="font-['Inter'] text-xs text-[#64748B] mb-4 line-clamp-2 leading-relaxed">
                    {partner.description}
                  </p>

                  {/* Card Footer */}
                  <div className="mt-auto pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
                    <span className="font-['Inter'] text-xs font-semibold text-[#006948]">
                      {partner.internsCount} SV đang thực tập
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate('partner-detail', { partnerId: partner.id });
                      }}
                      className="h-9 px-3.5 bg-[#006948] text-white font-['Inter'] text-xs font-semibold rounded-lg hover:bg-[#047857] transition-colors flex items-center"
                    >
                      Chi tiết
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* App Pagination */}
        <AppPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredPartners.length}
          pageSize={pageSize}
          pageSizeOptions={[6, 12, 24]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          itemLabel="doanh nghiệp"
        />
      </section>
    </div>
  );
}
