/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  AlertCircle,
  Send,
  Users,
  ShieldCheck,
  Search,
  ChevronRight,
  Filter,
  MapPin,
  Check,
  Clock,
} from 'lucide-react';
import { CounselorTab } from './CounselorNavbar';
import CounselorConfirmDialog from './modals/CounselorConfirmDialog';
import CounselorToast, { ToastMessage } from './CounselorToast';
import AppPagination from '@/components/shared/AppPagination';

import { CounselorApi, CandidateMatchItem } from '@/lib/api/counselorApi';

interface CounselorJobCandidatesProps {
  jobId?: string;
  position?: string;
  company?: string;
  slots?: number;
  onNavigate: (tab: CounselorTab, params?: any) => void;
}

export default function CounselorJobCandidates({
  jobId = 'req-01',
  position = 'Senior Frontend Developer (React/TypeScript)',
  company = 'TechViet Solutions',
  slots = 5,
  onNavigate,
}: CounselorJobCandidatesProps) {
  const [candidates, setCandidates] = useState<CandidateMatchItem[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [isLoading, setIsLoading] = useState(true);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    let isMounted = true;
    const fetchCandidates = async () => {
      try {
        setIsLoading(true);
        const data = await CounselorApi.getJobCandidates(jobId);
        if (isMounted) {
          setCandidates(data);
          if (data.length > 0) {
            setSelectedStudentIds([data[0].id]);
          }
        }
      } catch (err) {
        console.error('Failed to load candidate match items:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchCandidates();
    return () => {
      isMounted = false;
    };
  }, [jobId]);

  const filteredCandidates = candidates.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.university.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.matchedSkills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredCandidates.length / pageSize) || 1;
  const paginatedCandidates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCandidates.slice(start, start + pageSize);
  }, [filteredCandidates, currentPage, pageSize]);

  const toggleSelect = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === filteredCandidates.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredCandidates.map((c) => c.id));
    }
  };

  const handleOpenNominateDialog = () => {
    if (selectedStudentIds.length === 0) {
      showToast('Vui lòng chọn ít nhất một sinh viên để tiến cử.', 'warning');
      return;
    }
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmNominate = async () => {
    setIsConfirmDialogOpen(false);
    try {
      for (const stId of selectedStudentIds) {
        await CounselorApi.createReferral({
          student_id: stId,
          jd_id: jobId,
          notes: `Cố vấn tiến cử cho vị trí ${position} tại ${company}`,
        });
      }
      const selectedNames = candidates
        .filter((c) => selectedStudentIds.includes(c.id))
        .map((c) => c.name)
        .join(', ');

      showToast(
        `Đã gửi đề xuất tiến cử ${selectedStudentIds.length} sinh viên (${selectedNames}) cho vị trí ${position} tại ${company}!`,
        'success'
      );
      setTimeout(() => {
        onNavigate('referrals');
      }, 800);
    } catch (err) {
      showToast('Có lỗi xảy ra khi tạo tiến cử.', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-6 antialiased">
      <CounselorToast toast={toast} onClose={() => setToast(null)} />

      {/* ── BREADCRUMB & HEADER ── */}
      <div>
        <nav aria-label="Breadcrumb" className="flex items-center text-xs text-[#64748B] mb-2 font-['Inter']">
          <button
            type="button"
            onClick={() => onNavigate('opportunities')}
            className="hover:text-[#006948] transition-colors"
          >
            Cơ hội việc làm
          </button>
          <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-[#CBD5E1]" />
          <span className="truncate max-w-[200px] text-[#475569]">{position}</span>
          <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-[#CBD5E1]" />
          <span className="text-[#171d19] font-semibold">Đề xuất ứng viên</span>
        </nav>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl md:text-3xl font-bold text-[#171d19]">
            So khớp ứng viên
          </h1>
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm ứng viên..."
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] font-['Inter'] text-xs text-[#171d19] focus:outline-none focus:border-[#006948] transition-colors placeholder:text-[#64748B]"
            />
          </div>
        </div>
      </div>

      {/* ── JOB CONTEXT CARD ── */}
      <section className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#3d4a42] font-['Inter'] text-xs font-medium">
              IT / Phần mềm
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#006948] font-['Inter'] text-xs font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 fill-[#006948] text-white" /> Đối tác xác thực
            </span>
          </div>
          <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#171d19] mb-1">
            {position}
          </h2>
          <p className="font-['Inter'] text-xs text-[#475569] flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-[#64748B]" />
            <span>{company}</span>
            <span className="text-[#CBD5E1]">|</span>
            <MapPin className="w-3.5 h-3.5 text-[#64748B]" />
            <span>TP. Hồ Chí Minh</span>
          </p>
        </div>

        {/* Scan stats */}
        <div className="flex flex-col gap-1.5 min-w-[200px] text-xs font-['Inter'] bg-[#F8FAFC] p-3.5 rounded-lg border border-[#E2E8F0]">
          <div className="flex justify-between items-center">
            <span className="text-[#64748B]">Đã quét:</span>
            <span className="font-semibold text-[#171d19]">124 Sinh viên</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#64748B]">Phù hợp (&gt;75%):</span>
            <span className="font-bold text-[#006948]">12 Ứng viên</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#64748B]">Chỉ tiêu cần tuyển:</span>
            <span className="font-semibold text-[#171d19]">{slots} sinh viên</span>
          </div>
        </div>
      </section>

      {/* ── MAIN DATA TABLE SECTION ── */}
      <section className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col">
        {/* Table Header Actions */}
        <div className="counselor-toolbar p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row justify-between items-center gap-3 bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <h3 className="font-['Plus_Jakarta_Sans'] text-base font-semibold text-[#171d19]">
              Danh sách đề xuất
            </h3>
            <span className="bg-[#e9efe9] border border-[#bccac0] px-2.5 py-0.5 rounded text-[11px] font-['Inter'] font-medium text-[#3d4a42]">
              Sắp xếp theo độ phù hợp
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              className="h-10 px-4 flex items-center gap-2 border border-[#CBD5E1] rounded-lg bg-white text-[#475569] hover:bg-[#F8FAFC] transition-colors font-['Inter'] text-xs font-semibold flex-1 sm:flex-none justify-center"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Lọc</span>
            </button>
            <button
              type="button"
              onClick={handleOpenNominateDialog}
              disabled={selectedStudentIds.length === 0}
              className="h-10 px-5 flex items-center gap-2 rounded-lg bg-[#006948] text-white hover:bg-[#047857] transition-colors font-['Inter'] text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none justify-center shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Đề nghị tiến cử ({selectedStudentIds.length})</span>
            </button>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">

            <thead>
              <tr className="bg-white border-b border-[#E2E8F0] text-[#64748B] font-['Inter'] text-xs uppercase tracking-wider">
                <th className="p-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={
                      selectedStudentIds.length === filteredCandidates.length &&
                      filteredCandidates.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-[#CBD5E1] text-[#006948] focus:ring-[#006948] w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="p-4 font-medium">Sinh viên</th>
                <th className="p-4 font-medium">Độ khớp JD</th>
                <th className="p-4 font-medium">Kỹ năng khớp</th>
                <th className="p-4 font-medium">Kỹ năng thiếu</th>
                <th className="p-4 font-medium">Trạng thái CV</th>
                <th className="p-4 font-medium">Sẵn sàng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-['Inter'] text-xs">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#64748B]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-[#006948]/70" />
                      <strong className="text-[#171d19] text-sm">Chưa có ứng viên nào phù hợp với bộ lọc tìm kiếm.</strong>
                      <span className="text-xs">Hãy thử thay đổi từ khóa tìm kiếm kỹ năng hoặc tên trường.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCandidates.map((c: any) => {
                  const isSelected = selectedStudentIds.includes(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-[#F8FAFC] transition-colors group ${isSelected ? 'bg-[#ECFDF5]/30' : ''
                        }`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(c.id)}
                          className="rounded border-[#CBD5E1] text-[#006948] focus:ring-[#006948] w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#dae2fd] text-[#131b2e] flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-[#E2E8F0]">
                            {c.avatar ? (
                              <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                            ) : (
                              c.initials
                            )}
                          </div>
                          <div>
                            <p
                              onClick={() => onNavigate('student-detail', { studentId: c.id })}
                              className="font-semibold text-sm text-[#171d19] group-hover:text-[#006948] transition-colors cursor-pointer"
                            >
                              {c.name}
                            </p>
                            <p className="text-xs text-[#64748B]">{c.university}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {/* Radial SVG gauge */}
                          <div className="relative w-10 h-10 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                              <path
                                className="text-[#e4eae4]"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                              ></path>
                              <path
                                className={c.matchScore >= 90 ? 'text-[#006948]' : 'text-[#D97706]'}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeDasharray={`${c.matchScore}, 100`}
                                strokeLinecap="round"
                                strokeWidth="3"
                              ></path>
                            </svg>
                            <span
                              className={`absolute text-[11px] font-bold ${c.matchScore >= 90 ? 'text-[#006948]' : 'text-[#D97706]'
                                }`}
                            >
                              {c.matchScore}%
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full tracking-wide ${c.matchScore >= 90
                                ? 'bg-[#ECFDF5] text-[#006948]'
                                : 'bg-[#F1F5F9] text-[#475569]'
                              }`}
                          >
                            {c.ratingLabel}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {c.matchedSkills.map((s: any, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-[#eff5ef] text-[#3d4a42] text-xs"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {c.missingSkills.map((s: any, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded border border-[#D97706]/30 text-[#D97706] text-xs bg-[#FFFBEB]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        {c.cvStatus === 'verified' ? (
                          <div className="flex items-center gap-1.5 text-[#006948] font-medium">
                            <CheckCircle2 className="w-4 h-4 fill-[#006948] text-white" />
                            <span>Đã duyệt</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[#D97706] font-medium">
                            <Clock className="w-4 h-4" />
                            <span>Chờ duyệt</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ECFDF5] text-[#006948] text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#006948]"></span>
                          {c.availability}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* App Pagination */}
        <AppPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredCandidates.length}
          pageSize={pageSize}
          pageSizeOptions={[6, 12, 24]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          itemLabel="ứng viên"
        />
      </section>

      {/* Confirmation Dialog */}
      <CounselorConfirmDialog
        isOpen={isConfirmDialogOpen}
        title="Xác nhận gửi đề xuất tiến cử"
        description={`Bạn có chắc chắn muốn gửi đề xuất tiến cử ${selectedStudentIds.length} sinh viên cho vị trí "${position}" tại ${company}? Sinh viên sẽ nhận được thông báo để xác nhận sự đồng ý (Consent) trước khi CV được chuyển tiếp tới Doanh nghiệp.`}
        confirmLabel="Gửi đề xuất tiến cử"
        cancelLabel="Hủy bỏ"
        onConfirm={handleConfirmNominate}
        onClose={() => setIsConfirmDialogOpen(false)}
      />
    </div>
  );
}
