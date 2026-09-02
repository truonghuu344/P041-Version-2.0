/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Send,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Eye,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  Mail,
} from 'lucide-react';
import { CounselorTab } from './CounselorNavbar';
import CounselorReferralModal from './modals/CounselorReferralModal';
import CounselorToast, { ToastMessage } from './CounselorToast';
import AppPagination from '@/components/shared/AppPagination';
import StatusBadge from '@/components/shared/StatusBadge';

import { CounselorApi, ReferralItem } from '@/lib/api/counselorApi';

interface CounselorReferralsListProps {
  onNavigate: (tab: CounselorTab, params?: any) => void;
  initialTab?: string;
}

export default function CounselorReferralsList({
  onNavigate,
  initialTab = 'all',
}: CounselorReferralsListProps) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNominationModalOpen, setIsNominationModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    let isMounted = true;
    const fetchReferrals = async () => {
      try {
        setIsLoading(true);
        const data = await CounselorApi.getReferrals({
          stage: activeTab === 'all' ? undefined : activeTab,
          search: searchQuery,
        });
        if (isMounted) {
          setReferrals(data);
        }
      } catch (err) {
        console.error('Failed to load referrals:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchReferrals();
    return () => {
      isMounted = false;
    };
  }, [activeTab, searchQuery]);

  const filteredReferrals = useMemo(() => {
    return referrals.filter((ref) => {
      const matchSearch =
        ref.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ref.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ref.company.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;
      if (activeTab === 'all') return true;
      return ref.stage === activeTab;
    });
  }, [referrals, searchQuery, activeTab]);

  const totalPages = Math.ceil(filteredReferrals.length / pageSize) || 1;
  const paginatedReferrals = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReferrals.slice(start, start + pageSize);
  }, [filteredReferrals, currentPage, pageSize]);

  const handleCreateReferral = async (data: { studentId: string; jdId: string; note: string }) => {
    try {
      await CounselorApi.createReferral({
        student_id: data.studentId,
        jd_id: data.jdId,
        notes: data.note,
      });
      const refreshed = await CounselorApi.getReferrals({
        stage: activeTab === 'all' ? undefined : activeTab,
        search: searchQuery,
      });
      setReferrals(refreshed);
      showToast('Đã tạo đề xuất tiến cử và gửi yêu cầu đồng ý đến sinh viên!', 'success');
    } catch {
      showToast('Không thể tạo đề xuất tiến cử. Vui lòng thử lại.', 'error');
      throw new Error('Referral creation failed');
    }
  };

  return (
    <div className="space-y-6 pb-6 antialiased">
      <CounselorToast toast={toast} onClose={() => setToast(null)} />

      {/* ── HEADER SECTION ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl md:text-3xl font-bold text-[#171d19]">
            Quản lý Tiến cử
          </h1>
          <p className="font-['Inter'] text-sm md:text-base text-[#475569] mt-1">
            Theo dõi tiến trình các sinh viên bạn đã giới thiệu cho doanh nghiệp.
          </p>
        </div>
        <div className="counselor-toolbar flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            className="h-10 px-4 flex items-center gap-2 bg-white border border-[#CBD5E1] rounded-lg text-[#171d19] font-['Inter'] text-xs font-semibold hover:bg-[#F8FAFC] transition-colors shadow-xs"
          >
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Lọc</span>
          </button>
          <button
            type="button"
            onClick={() => setIsNominationModalOpen(true)}
            className="h-10 px-4 flex items-center gap-2 bg-[#006948] text-white rounded-lg font-['Inter'] text-xs font-semibold hover:bg-[#047857] transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo tiến cử mới</span>
          </button>
        </div>
      </header>

      {/* ── TABS NAVIGATION (HEIGHT: 44px) ── */}
      <div className="counselor-tabs-container">
        <nav className="counselor-tabs-nav" role="tablist" aria-label="Tabs">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'waiting_consent', label: `Chờ SV đồng ý (${referrals.filter(r => r.stage === 'waiting_consent').length})` },
            { id: 'shared_enterprise', label: `Đã gửi sang DN (${referrals.filter(r => r.stage === 'shared_enterprise').length})` },
            { id: 'interviewing', label: `Đang phỏng vấn (${referrals.filter(r => r.stage === 'interviewing').length})` },
            { id: 'offered', label: `Đã nhận Offer (${referrals.filter(r => r.stage === 'offered').length})` },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                onClick={() => setActiveTab(tab.id)}
                className={`counselor-tab-item ${isActive ? 'active' : ''}`}
                aria-selected={isActive}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── BENTO GRID LAYOUT (4:8 SPLIT) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Summary Stats Card (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] text-base font-semibold text-[#171d19] mb-5">
              Tổng quan trạng thái
            </h3>
            <div className="space-y-3 font-['Inter'] text-xs">
              <div className="flex justify-between items-center p-3 rounded-lg hover:bg-[#F8FAFC] transition-colors border border-transparent hover:border-[#E2E8F0]">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#2563EB]"></div>
                  <span className="text-[#171d19] font-medium">Chờ duyệt từ DN / Đã gửi</span>
                </div>
                <span className="font-bold text-[#171d19] bg-[#F1F5F9] px-2.5 py-1 rounded">
                  {referrals.filter(r => r.stage === 'shared_enterprise').length}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg hover:bg-[#F8FAFC] transition-colors border border-transparent hover:border-[#E2E8F0]">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#D97706]"></div>
                  <span className="text-[#171d19] font-medium">Đang phỏng vấn</span>
                </div>
                <span className="font-bold text-[#171d19] bg-[#F1F5F9] px-2.5 py-1 rounded">
                  {referrals.filter(r => r.stage === 'interviewing').length}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg hover:bg-[#F8FAFC] transition-colors border border-transparent hover:border-[#E2E8F0]">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#006948]"></div>
                  <span className="text-[#171d19] font-medium">Đã nhận Offer / Trúng tuyển</span>
                </div>
                <span className="font-bold text-[#006948] bg-[#ECFDF5] px-2.5 py-1 rounded">
                  {referrals.filter(r => r.stage === 'offered').length}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg hover:bg-[#F8FAFC] transition-colors border border-transparent hover:border-[#E2E8F0]">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#64748B]"></div>
                  <span className="text-[#171d19] font-medium">Chờ SV đồng ý</span>
                </div>
                <span className="font-bold text-[#171d19] bg-[#F1F5F9] px-2.5 py-1 rounded">
                  {referrals.filter(r => r.stage === 'waiting_consent').length}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-[#E2E8F0]">
            <p className="font-['Inter'] text-xs text-[#64748B] mb-2 font-medium">
              Tỷ lệ chuyển đổi phỏng vấn
            </p>
            <div className="flex items-end gap-2">
              <span className="font-['Plus_Jakarta_Sans'] text-4xl font-bold text-[#006948]">
                40%
              </span>
              <span className="font-['Inter'] text-xs text-[#006948] font-semibold mb-1">
                +5% tháng này
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Candidate Referral Cards (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {filteredReferrals.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#006948] flex items-center justify-center mx-auto">
                <Send className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#171d19]">
                Chưa có hồ sơ tiến cử nào phù hợp với bộ lọc
              </h3>
              <p className="text-xs text-[#64748B] max-w-md mx-auto">
                Hãy thử chọn bộ lọc trạng thái khác hoặc tạo một đề xuất tiến cử sinh viên mới.
              </p>
              {(searchQuery || activeTab !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveTab('all');
                    setCurrentPage(1);
                  }}
                  className="mt-2 h-10 px-4 bg-[#006948] text-white text-xs font-semibold rounded-lg hover:bg-[#047857] transition-colors"
                >
                  Bỏ lọc
                </button>
              )}
            </div>
          ) : (
            paginatedReferrals.map((item) => (
              <div
                key={item.id}
                onClick={() => onNavigate('referral-detail', { referralId: item.id })}
                className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5 hover:border-[#006948]/40 hover:bg-[#F8FAFC] transition-colors flex flex-col sm:flex-row gap-5 items-start sm:items-center cursor-pointer group"
              >
                {/* Avatar with verify icon */}
                <div className="shrink-0 relative">
                  <div className="w-14 h-14 rounded-full overflow-hidden border border-[#E2E8F0] bg-[#dae2fd] text-[#131b2e] flex items-center justify-center font-bold text-base">
                    {item.studentAvatar ? (
                      <img src={item.studentAvatar} alt={item.studentName} className="w-full h-full object-cover" />
                    ) : (
                      item.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-xs">
                    <div className="w-4 h-4 rounded-full bg-[#006948] flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-['Plus_Jakarta_Sans'] text-base font-semibold text-[#171d19] group-hover:text-[#006948] transition-colors">
                      {item.studentName}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] font-['Inter'] text-xs">
                      {item.lastUpdated}
                    </span>
                  </div>
                  <p className="font-['Inter'] text-xs text-[#475569] mb-3">
                    Ứng tuyển: <strong>{item.position}</strong> — {item.company}
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="px-2.5 py-0.5 bg-[#ECFDF5] text-[#006948] rounded-md font-['Inter'] text-xs font-semibold border border-[#006948]/20">
                      Match: {item.matchScore}%
                    </span>
                    {item.skills.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 bg-[#F1F5F9] text-[#475569] rounded-md font-['Inter'] text-xs border border-[#E2E8F0]"
                      >
                        {s}
                      </span>
                    ))}
                    <StatusBadge status={item.stage} label={item.stageLabel} size="sm" />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-row sm:flex-col gap-2 mt-4 sm:mt-0 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate('referral-detail', { referralId: item.id });
                    }}
                    className="flex-1 sm:flex-none h-10 px-4 bg-white border border-[#CBD5E1] rounded-lg text-[#171d19] font-['Inter'] text-xs font-semibold hover:bg-[#F8FAFC] transition-colors text-center flex items-center justify-center"
                  >
                    Xem hồ sơ
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      showToast(`Đã mở kênh liên lạc với ${item.studentName}!`, 'info');
                    }}
                    className="h-10 w-10 bg-white border border-[#CBD5E1] rounded-lg text-[#64748B] hover:text-[#006948] hover:border-[#006948] transition-colors flex items-center justify-center shrink-0"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}

          {/* App Pagination */}
          <AppPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredReferrals.length}
            pageSize={pageSize}
            pageSizeOptions={[6, 12, 24]}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            itemLabel="hồ sơ tiến cử"
          />
        </div>
      </div>

      {/* Nomination Modal */}
      <CounselorReferralModal
        isOpen={isNominationModalOpen}
        onClose={() => setIsNominationModalOpen(false)}
        onSubmitReferral={handleCreateReferral}
      />
    </div>
  );
}
