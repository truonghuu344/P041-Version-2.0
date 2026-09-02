/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Briefcase,
  Building2,
  MapPin,
  Upload,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  FileText,
  X,
  AlertCircle,
} from 'lucide-react';
import { ApiClient } from '@/api-client.js';
import { CounselorTab } from './CounselorNavbar';
import CounselorCreateJob from './CounselorCreateJob';
import CompanyLogoBadge from './CompanyLogoBadge';

export interface JDItem {
  id: string;
  title: string;
  company?: string;
  location?: string;
  is_system?: boolean;
  is_published?: boolean;
  created_at?: string;
  requirements_text?: string;
}

interface CounselorJDManagerProps {
  onNavigate?: (tab: CounselorTab, params?: any) => void;
}

export default function CounselorJDManager({ onNavigate }: CounselorJDManagerProps) {
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [items, setItems] = useState<JDItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const load = async () => {
    try {
      const data = await ApiClient.listMyJDs();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      try {
        const allJds = await ApiClient.listJDs();
        setItems(Array.isArray(allJds) ? allJds : []);
      } catch {
        setItems([]);
      }
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handlePublish = async (id: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await ApiClient.publishJD(id);
      await load();
      setMessage({ text: 'JD đã được công bố cho sinh viên đối chiếu và tối ưu CV!', type: 'success' });
    } catch (error: any) {
      setMessage({ text: error?.message || 'Không thể công bố JD. Vui lòng thử lại.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleFindCandidates = (item: JDItem) => {
    if (onNavigate) {
      onNavigate('suitable-candidates', {
        jobId: item.id,
        position: item.title,
        company: item.company || 'Doanh nghiệp liên kết',
        slots: 1,
      });
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;
      if (filterStatus === 'published' && !item.is_published) return false;
      if (filterStatus === 'draft' && item.is_published) return false;
      return true;
    });
  }, [items, searchQuery, filterStatus]);

  const publishedCount = items.filter((i) => i.is_published).length;
  const draftCount = items.length - publishedCount;

  if (viewMode === 'create') {
    return (
      <CounselorCreateJob
        editJobId={editingJobId}
        onNavigate={onNavigate || (() => {})}
        onBack={() => {
          setEditingJobId(null);
          setViewMode('list');
          void load();
        }}
        onSuccess={() => {
          setEditingJobId(null);
          setViewMode('list');
          void load();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 pb-8 antialiased">
      {/* ── HEADER ── */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-[#e2e8f0] shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#006948]/10 text-[#006948]">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="font-['Plus_Jakarta_Sans'] text-2xl md:text-3xl font-bold text-[#171d19]">
              Quản lý Job Description (JD)
            </h1>
          </div>
          <p className="font-['Inter'] text-sm text-[#475569] mt-1.5 ml-0 sm:ml-10">
            Tải lên, trích xuất tự động và công bố các bản mô tả công việc (JD) để hỗ trợ sinh viên đối chiếu và tối ưu CV.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setViewMode('create')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-['Inter'] text-sm font-semibold text-white bg-[#006948] hover:bg-[#047857] transition-all duration-200 shadow-xs hover:shadow-md shrink-0 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>Tải JD lên</span>
        </button>
      </header>

      {/* ── STATS STRIP ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#e2e8f0] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#006948]/10 text-[#006948] flex items-center justify-center shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="font-['Inter'] text-xs font-semibold text-[#64748b] uppercase tracking-wider">Tổng số JD</p>
            <p className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#171d19] mt-0.5">{items.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e2e8f0] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#ecfdf5] text-[#059669] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="font-['Inter'] text-xs font-semibold text-[#64748b] uppercase tracking-wider">Đã công bố cho SV</p>
            <p className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#059669] mt-0.5">{publishedCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e2e8f0] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#fffbeb] text-[#d97706] flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="font-['Inter'] text-xs font-semibold text-[#64748b] uppercase tracking-wider">Bản nháp / Chưa công bố</p>
            <p className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#d97706] mt-0.5">{draftCount}</p>
          </div>
        </div>
      </div>

      {/* ── NOTIFICATION MESSAGE ── */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between gap-3 border ${
            message.type === 'success'
              ? 'bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]'
              : message.type === 'error'
              ? 'bg-[#fef2f2] text-[#991b1b] border-[#fecaca]'
              : 'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-[#dc2626] shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── FILTER & SEARCH ── */}
      <div className="bg-white p-4 rounded-2xl border border-[#e2e8f0] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tiêu đề, công ty, địa điểm..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-[#171d19] focus:outline-none focus:border-[#006948] focus:bg-white transition-all duration-200"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
              filterStatus === 'all'
                ? 'bg-[#006948] text-white shadow-xs'
                : 'text-[#475569] hover:bg-[#f1f5f9] hover:text-[#171d19]'
            }`}
          >
            Tất cả ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('published')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
              filterStatus === 'published'
                ? 'bg-[#006948] text-white shadow-xs'
                : 'text-[#475569] hover:bg-[#f1f5f9] hover:text-[#171d19]'
            }`}
          >
            Đã công bố ({publishedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('draft')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
              filterStatus === 'draft'
                ? 'bg-[#006948] text-white shadow-xs'
                : 'text-[#475569] hover:bg-[#f1f5f9] hover:text-[#171d19]'
            }`}
          >
            Bản nháp ({draftCount})
          </button>
        </div>
      </div>

      {/* ── JD LIST / GRID ── */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const isPublished = Boolean(item.is_published);
            return (
              <article
                key={item.id}
                className="bg-white rounded-2xl p-5 border border-[#e2e8f0] shadow-xs hover:shadow-md hover:border-[#006948]/30 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CompanyLogoBadge company={item.company || 'Job'} size="md" />
                      <div>
                        <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#171d19] line-clamp-1">
                          {item.title}
                        </h3>
                        <p className="font-['Inter'] text-xs font-medium text-[#475569] flex items-center gap-1.5 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-[#64748b]" />
                          <span>{item.company || 'Chưa gắn doanh nghiệp'}</span>
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                        isPublished
                          ? 'bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0]'
                          : 'bg-[#fffbeb] text-[#b45309] border border-[#fde68a]'
                      }`}
                    >
                      {isPublished ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Đã công bố</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" />
                          <span>Bản nháp</span>
                        </>
                      )}
                    </span>
                  </div>

                  {item.location && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-[#64748b]">
                      <MapPin className="w-3.5 h-3.5 text-[#94a3b8]" />
                      <span>{item.location}</span>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-[#f1f5f9] flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleFindCandidates(item)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006948] hover:text-[#047857] hover:bg-[#006948]/5 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Tìm ứng viên &rarr;</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingJobId(item.id);
                        setViewMode('create');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#475569] hover:text-[#171d19] hover:bg-[#f1f5f9] px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <span>Chỉnh sửa</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isPublished ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handlePublish(item.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#006948] hover:bg-[#047857] transition-all disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Công bố JD</span>
                      </button>
                    ) : (
                      <span className="text-xs text-[#059669] font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sẵn sàng cho SV
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 border border-[#e2e8f0] shadow-xs text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#006948]/10 text-[#006948] flex items-center justify-center mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#171d19]">
            {searchQuery ? 'Không tìm thấy JD phù hợp' : 'Chưa có JD nào do Cố vấn tạo'}
          </h3>
          <p className="font-['Inter'] text-sm text-[#64748b] max-w-md mt-1.5">
            {searchQuery
              ? 'Thử điều chỉnh từ khóa tìm kiếm hoặc xóa bộ lọc để xem lại danh sách.'
              : 'Tải lên bản mô tả công việc (JD) đầu tiên từ file PDF, DOCX hoặc ảnh để hệ thống tự động bóc tách và hỗ trợ sinh viên đối chiếu CV.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => setViewMode('create')}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-['Inter'] text-sm font-semibold text-white bg-[#006948] hover:bg-[#047857] transition-all duration-200 shadow-xs cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Tải &amp; Soạn thảo JD đầu tiên</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
