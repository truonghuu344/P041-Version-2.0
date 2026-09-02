/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Users,
  MessageSquare,
  Mail,
  Award,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { CounselorTab } from './CounselorNavbar';
import AppPagination from '@/components/shared/AppPagination';
import StatusBadge from '@/components/shared/StatusBadge';
import { CounselorApi, StudentListItem } from '@/lib/api/counselorApi';

export interface StudentItem {
  id: string;
  name: string;
  email: string;
  major: string;
  cohort: string;
  targetRole: string;
  avatar?: string;
  initials?: string;
  cvStatus: 'pending' | 'verified' | 'needs_task';
  gpa: string;
  skills: string[];
  matchRate: number;
  lastActive: string;
}

interface CounselorStudentsListProps {
  onNavigate: (tab: CounselorTab, params?: any) => void;
  onSelectStudent?: (studentId: string) => void;
}

function StudentAvatar({ name, avatar }: { name: string; avatar?: string }) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    ? name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(-2)
        .join('')
        .toUpperCase()
    : 'SV';

  if (avatar && !imgError && !avatar.includes('placeholder')) {
    return (
      <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
        <img
          src={avatar}
          alt={name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-full bg-emerald-100/90 border border-emerald-200 text-[#006948] text-xs font-extrabold flex items-center justify-center shrink-0 tracking-wider shadow-2xs">
      {initials}
    </div>
  );
}

export default function CounselorStudentsList({
  onNavigate,
  onSelectStudent,
}: CounselorStudentsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMajor, setSelectedMajor] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchStudents = async () => {
      try {
        setIsLoading(true);
        const res = await CounselorApi.getStudents({
          search: searchQuery,
          major: selectedMajor,
          cv_status: selectedStatus,
          page: currentPage,
          page_size: pageSize,
        });
        if (isMounted) {
          setStudents(res.items);
          setTotalCount(res.total);
          setTotalPages(res.total_pages);
        }
      } catch (err) {
        console.error('Failed to load students:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchStudents();
    return () => {
      isMounted = false;
    };
  }, [searchQuery, selectedMajor, selectedStatus, currentPage, pageSize]);

  const handleViewProfile = (studentId: string) => {
    if (onSelectStudent) onSelectStudent(studentId);
    onNavigate('student-detail', { studentId });
  };

  return (
    <div className="space-y-5 pb-6 antialiased">
      {/* ── HEADER & TOOLBAR ── */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl md:text-3xl font-bold tracking-tight text-[#171d19]">
            Danh sách sinh viên
          </h1>
          <p className="font-['Inter'] text-sm text-[#475569] mt-0.5">
            Quản lý, đánh giá hồ sơ năng lực và theo dõi tiến độ ứng tuyển của sinh viên
          </p>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm tên, email sinh viên..."
              className="w-full h-10 pl-9 pr-3.5 bg-white border border-slate-300 rounded-xl font-['Inter'] text-xs md:text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all placeholder:text-slate-400 shadow-2xs"
            />
          </div>

          {/* Major Select */}
          <select
            value={selectedMajor}
            onChange={(e) => {
              setSelectedMajor(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 px-3 bg-white border border-slate-300 rounded-xl font-['Inter'] text-xs md:text-sm text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all cursor-pointer shadow-2xs"
          >
            <option value="">Tất cả chuyên ngành</option>
            <option value="Công nghệ thông tin">Công nghệ thông tin</option>
            <option value="Quản trị kinh doanh">Quản trị kinh doanh</option>
            <option value="Thiết kế đồ họa">Thiết kế đồ họa</option>
          </select>

          {/* Status Select */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 px-3 bg-white border border-slate-300 rounded-xl font-['Inter'] text-xs md:text-sm text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all cursor-pointer shadow-2xs"
          >
            <option value="">Tất cả trạng thái CV</option>
            <option value="pending">Chờ xem</option>
            <option value="confirmed">Đã xác nhận</option>
          </select>
        </div>
      </header>

      {/* ── TABLE VIEW FOR STUDENTS ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-slate-100/70 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#006948] flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#171d19]">
              Không tìm thấy sinh viên nào phù hợp với bộ lọc
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Hãy thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh lại chuyên ngành và trạng thái CV.
            </p>
            {(searchQuery || selectedMajor || selectedStatus) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedMajor('');
                  setSelectedStatus('');
                  setCurrentPage(1);
                }}
                className="mt-2 h-9 px-4 bg-[#006948] text-white text-xs font-semibold rounded-lg hover:bg-[#047857] transition-colors"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-500 font-['Inter'] text-[11px] uppercase tracking-wider font-bold">
                  <th className="py-3.5 px-5 min-w-[220px]">Sinh viên</th>
                  <th className="py-3.5 px-4 min-w-[180px]">Mục tiêu &amp; Chuyên ngành</th>
                  <th className="py-3.5 px-4 min-w-[160px]">GPA &amp; Kỹ năng</th>
                  <th className="py-3.5 px-4 text-center min-w-[90px]">Match</th>
                  <th className="py-3.5 px-4 text-center min-w-[120px]">Trạng thái CV</th>
                  <th className="py-3.5 px-5 text-right min-w-[150px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => {
                  const hasRole = student.targetRole && student.targetRole !== 'Chưa cập nhật';
                  const hasMajor = student.major && student.major !== 'Chưa cập nhật';
                  const hasCohort = student.cohort && student.cohort !== 'Chưa cập nhật';
                  const hasGPA = student.gpa && student.gpa !== 'Chưa cập nhật' && student.gpa !== '0.0';
                  const validSkills = (student.skills || []).filter(
                    (s) => s && s.trim() !== '' && s !== 'fff' && s !== 'Chưa cập nhật'
                  );

                  const matchColor =
                    student.matchRate >= 75
                      ? 'bg-emerald-50 text-[#006948] border-emerald-200/80'
                      : student.matchRate >= 40
                      ? 'bg-blue-50 text-blue-700 border-blue-200/80'
                      : student.matchRate > 0
                      ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                      : 'bg-slate-100 text-slate-400 border-slate-200';

                  return (
                    <tr
                      key={student.id}
                      onClick={() => handleViewProfile(student.id)}
                      className="hover:bg-slate-50/90 transition-colors group cursor-pointer"
                    >
                      {/* 1. Sinh viên */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <StudentAvatar name={student.name} avatar={student.avatar} />
                          <div className="min-w-0 flex-1">
                            <p className="font-['Inter'] text-sm font-bold text-[#171d19] group-hover:text-[#006948] transition-colors truncate">
                              {student.name}
                            </p>
                            <div className="flex items-center gap-1.5 font-['Inter'] text-xs text-slate-400 mt-0.5">
                              <span className="truncate max-w-[160px] inline-block" title={student.email}>
                                {student.email || `${student.id}@sv.edu.vn`}
                              </span>
                              {hasCohort && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="shrink-0 text-slate-500 font-medium">{student.cohort}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Mục tiêu & Chuyên ngành */}
                      <td className="py-3.5 px-4">
                        <p className={`font-['Inter'] text-xs font-semibold ${hasRole ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                          {hasRole ? student.targetRole : 'Chưa đặt mục tiêu'}
                        </p>
                        <p className="font-['Inter'] text-[11px] text-slate-500 mt-0.5">
                          {hasMajor ? student.major : '—'}
                        </p>
                      </td>

                      {/* 3. GPA & Kỹ năng */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          {hasGPA ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200/70 rounded-md text-[11px] font-bold text-amber-900">
                              <Award className="w-3 h-3 text-amber-600" /> GPA {student.gpa}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">GPA: —</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {validSkills.length > 0 ? (
                            validSkills.slice(0, 3).map((s, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium"
                              >
                                {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-300 text-[10px] italic">Chưa cập nhật kỹ năng</span>
                          )}
                        </div>
                      </td>

                      {/* 4. Match Rate */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full border font-['Inter'] text-xs font-bold ${matchColor}`}
                        >
                          {student.matchRate}%
                        </span>
                      </td>

                      {/* 5. Trạng thái CV */}
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge
                          status={
                            student.cvStatus === 'pending'
                              ? 'DUE_SOON'
                              : student.cvStatus === 'verified'
                              ? 'APPROVED'
                              : 'WARNING'
                          }
                          label={
                            student.cvStatus === 'pending'
                              ? 'Chờ xem'
                              : student.cvStatus === 'verified'
                              ? 'Đã xác nhận'
                              : 'Cần cải thiện'
                          }
                          size="sm"
                        />
                      </td>

                      {/* 6. Thao tác */}
                      <td className="py-3.5 px-5 text-right">
                        <div
                          className="inline-flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleViewProfile(student.id)}
                            className="whitespace-nowrap px-3 py-1.5 bg-[#006948] text-white rounded-lg font-['Inter'] text-xs font-semibold hover:bg-[#047857] transition-colors shadow-2xs"
                          >
                            Xem hồ sơ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewProfile(student.id)}
                            className="h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-emerald-700 transition-colors flex items-center justify-center shrink-0"
                            aria-label={`Chi tiết sinh viên ${student.name}`}
                            title="Xem chi tiết & gửi nhận xét"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── PAGINATION CONTROLS ── */}
      <AppPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={pageSize}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
        itemLabel="sinh viên"
      />
    </div>
  );
}
