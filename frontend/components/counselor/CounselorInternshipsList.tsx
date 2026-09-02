/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  Building2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  User,
  GraduationCap,
  Calendar,
  Users,
  AlertTriangle,
  FileCheck,
  Check,
} from 'lucide-react';
import { CounselorTab } from './CounselorNavbar';
import AppPagination from '@/components/shared/AppPagination';
import StatusBadge from '@/components/shared/StatusBadge';
import { CounselorApi, InternshipItem } from '@/lib/api/counselorApi';

interface CounselorInternshipsListProps {
  onNavigate: (tab: CounselorTab, params?: any) => void;
}

export default function CounselorInternshipsList({
  onNavigate,
}: CounselorInternshipsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchInternships = async () => {
      try {
        setIsLoading(true);
        const data = await CounselorApi.getInternships({
          search: searchQuery,
        });
        if (isMounted) {
          setInternships(data);
        }
      } catch (err) {
        console.error('Failed to load internships:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchInternships();
    return () => {
      isMounted = false;
    };
  }, [searchQuery]);

  const filteredInternships = useMemo(() => {
    return internships.filter((item) => {
      const matchSearch =
        item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.position.toLowerCase().includes(searchQuery.toLowerCase());

      return matchSearch;
    });
  }, [internships, searchQuery]);

  const totalPages = Math.ceil(filteredInternships.length / pageSize) || 1;
  const paginatedInternships = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInternships.slice(start, start + pageSize);
  }, [filteredInternships, currentPage, pageSize]);

  return (
    <div className="space-y-6 pb-6 antialiased">
      {/* ── PAGE HEADER ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl md:text-3xl font-bold text-[#171d19]">
            Giám sát Thực tập
          </h1>
          <p className="font-['Inter'] text-sm md:text-base text-[#475569] mt-1">
            Quản lý tiến độ và báo cáo của sinh viên thực tập.
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
              placeholder="Tìm kiếm sinh viên..."
              className="w-full h-10 pl-9 pr-4 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg font-['Inter'] text-xs text-[#171d19] focus:outline-none focus:border-[#006948] transition-colors placeholder:text-[#64748B]"
            />
          </div>
          <button
            type="button"
            className="h-10 px-4 bg-white border border-[#CBD5E1] rounded-lg text-[#475569] font-['Inter'] text-xs font-semibold hover:bg-[#F8FAFC] transition-colors flex items-center gap-2"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Lọc</span>
          </button>
        </div>
      </header>

      {/* ── METRIC STATS OVERVIEW (4 COLS) ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-[#e7f4ed] rounded-lg text-[#006948]">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <p className="font-['Inter'] text-xs text-[#64748B] mb-1">Đang thực tập</p>
          <p className="font-['Plus_Jakarta_Sans'] text-4xl font-bold text-[#171d19]">248</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg text-[#047857]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
          <p className="font-['Inter'] text-xs text-[#64748B] mb-1">Hoàn thành đợt</p>
          <p className="font-['Plus_Jakarta_Sans'] text-4xl font-bold text-[#047857]">89</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-[#D97706]">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <p className="font-['Inter'] text-xs text-[#64748B] mb-1">Báo cáo chờ duyệt</p>
          <p className="font-['Plus_Jakarta_Sans'] text-4xl font-bold text-[#D97706]">34</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#DC2626]">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <p className="font-['Inter'] text-xs text-[#64748B] mb-1">Cảnh báo trễ hạn</p>
          <p className="font-['Plus_Jakarta_Sans'] text-4xl font-bold text-[#DC2626]">12</p>
        </div>
      </section>

      {/* ── MAIN DATA TABLE ── */}
      <section className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-6 py-4 font-['Inter'] text-xs font-semibold uppercase tracking-wider text-[#475569]">
                  Sinh Viên
                </th>
                <th className="px-6 py-4 font-['Inter'] text-xs font-semibold uppercase tracking-wider text-[#475569]">
                  Công Ty
                </th>
                <th className="px-6 py-4 font-['Inter'] text-xs font-semibold uppercase tracking-wider text-[#475569]">
                  Mentor
                </th>
                <th className="px-6 py-4 font-['Inter'] text-xs font-semibold uppercase tracking-wider text-[#475569]">
                  Tiến Độ Tuần
                </th>
                <th className="px-6 py-4 font-['Inter'] text-xs font-semibold uppercase tracking-wider text-[#475569]">
                  Trạng Thái Báo Cáo
                </th>
                <th className="px-6 py-4 font-['Inter'] text-xs font-semibold uppercase tracking-wider text-[#475569] text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-['Inter'] text-xs">
              {filteredInternships.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#64748B]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <GraduationCap className="w-8 h-8 text-[#006948]/70" />
                      <strong className="text-[#171d19] text-sm">Chưa có sinh viên nào trong danh sách thực tập.</strong>
                      <span className="text-xs">Không tìm thấy sinh viên thực tập nào phù hợp với bộ lọc hiện tại.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedInternships.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onNavigate('internship-detail', { internshipId: item.id })}
                    className="hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-[#E2E8F0] bg-[#dae2fd] text-[#131b2e] flex items-center justify-center font-bold text-xs shrink-0">
                          {item.studentAvatar ? (
                            <img src={item.studentAvatar} alt={item.studentName} className="w-full h-full object-cover" />
                          ) : (
                            item.initials
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-[#171d19] group-hover:text-[#006948] transition-colors">
                            {item.studentName}
                          </p>
                          <p className="text-xs text-[#64748B]">{item.position}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <p className="font-semibold text-[#171d19]">{item.company}</p>
                      <p className="text-xs text-[#64748B]">{item.location}</p>
                    </td>

                    <td className="px-6 py-4">
                      <p className="font-semibold text-[#171d19]">{item.mentorName}</p>
                      <p className="text-xs text-[#64748B]">{item.mentorTitle}</p>
                    </td>

                    <td className="px-6 py-4 min-w-[150px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-[#475569]">
                          <span>Tuần {item.currentWeek}/{item.totalWeeks}</span>
                          <span className="font-semibold">{item.progressPercent}%</span>
                        </div>
                        <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#006948] h-full transition-all"
                            style={{ width: `${item.progressPercent}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge
                        status={
                          item.lastReportStatus === 'delayed'
                            ? 'OVERDUE'
                            : item.lastReportStatus === 'reviewed'
                              ? 'APPROVED'
                              : 'REPORT_SUBMITTED'
                        }
                        label={item.statusLabel}
                        size="sm"
                      />
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('internship-detail', { internshipId: item.id });
                        }}
                        className="px-3 py-1.5 bg-white border border-[#CBD5E1] rounded-lg text-[#171d19] font-semibold text-xs hover:bg-[#F8FAFC] hover:border-[#006948] hover:text-[#006948] transition-colors"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* App Pagination */}
        <AppPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredInternships.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 50]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          itemLabel="sinh viên thực tập"
        />
      </section>
    </div>
  );
}
