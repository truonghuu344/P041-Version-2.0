/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  X,
  Info,
} from 'lucide-react';
import {
  INSTITUTION_CONFIG,
  COUNSELOR_RESOURCES,
  SYSTEM_LEGAL_LINKS,
  SYSTEM_VERSION,
  ResourceItem,
  LegalLinkItem,
} from '@/lib/institutionConfig';
import { CounselorTab } from './CounselorNavbar';

export type CounselorFooterVariant = 'full' | 'compact';

export interface CounselorFooterProps {
  variant?: CounselorFooterVariant;
  onNavigate?: (tab: CounselorTab, params?: any) => void;
  className?: string;
}

export default function CounselorFooter({
  variant = 'full',
  onNavigate,
  className = '',
}: CounselorFooterProps) {
  const currentYear = new Date().getFullYear();
  const [activeModal, setActiveModal] = useState<{
    title: string;
    content: string;
    subtitle?: string;
  } | null>(null);

  const handleOpenResource = (res: ResourceItem) => {
    setActiveModal({
      title: res.label,
      subtitle: res.description,
      content:
        res.content ||
        'Tài liệu hướng dẫn nghiệp vụ chuẩn cho Cố vấn học tập và Giảng viên trong hệ sinh thái Career Assistant.',
    });
  };

  const handleOpenLegal = (legal: LegalLinkItem) => {
    setActiveModal({
      title: legal.title,
      subtitle: 'Quy định và chính sách hệ sinh thái Career Assistant',
      content: legal.content,
    });
  };

  const handleCloseModal = () => {
    setActiveModal(null);
  };

  // COMPACT VARIANT
  if (variant === 'compact') {
    return (
      <>
        <footer
          role="contentinfo"
          aria-label="Compact Application Footer"
          className={`w-full mt-5 py-3 px-4 sm:px-5 border border-[#E2E8F0] rounded-xl bg-[#F8FAFC] text-[#475569] transition-all counselor-footer-compact ${className}`}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-center sm:text-left">
              <Image
                src="/images/image2.png"
                alt="Career Assistant"
                width={20}
                height={20}
                className="w-5 h-5 object-contain shrink-0"
              />
              <span className="font-semibold text-[#171d19]">
                &copy; {currentYear} Career Assistant
              </span>
              <span className="hidden md:inline text-[#CBD5E1]">&bull;</span>
              <span className="text-[#64748B] hidden md:inline">
                Hệ sinh thái kết nối Sinh viên – Nhà trường – Doanh nghiệp
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[#64748B]">
              {SYSTEM_LEGAL_LINKS.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenLegal(item)}
                  className="bg-transparent border-0 outline-none shadow-none text-[#64748B] hover:text-[#006948] transition-colors p-0 cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#006948] rounded"
                >
                  {item.label}
                </button>
              ))}
              <span className="text-[#CBD5E1]">&bull;</span>
              <span className="font-mono text-[11px] bg-[#E2E8F0]/70 text-[#475569] px-2 py-0.5 rounded font-medium">
                {SYSTEM_VERSION}
              </span>
            </div>
          </div>
        </footer>
        {renderModal(activeModal, handleCloseModal)}
      </>
    );
  }

  // FULL VARIANT
  return (
    <>
      <footer
        role="contentinfo"
        aria-label="Career Assistant Product Footer"
        className={`w-full mt-5 border border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] antialiased rounded-xl p-4 sm:p-5 md:p-6 counselor-footer-full ${className}`}
      >
        {/* 4-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 items-start">
          {/* Column 1: Brand & Mission */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <Image
                src="/images/image2.png"
                alt="Career Assistant"
                width={36}
                height={36}
                className="w-9 h-9 object-contain rounded-lg shrink-0"
              />
              <div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#171d19] leading-tight">
                  Career Assistant
                </h3>
                <span className="font-['Inter'] text-xs font-medium text-[#006948]">
                  Cổng Cố vấn & Hướng nghiệp
                </span>
              </div>
            </div>

            <p className="font-['Inter'] text-xs sm:text-sm text-[#475569] leading-relaxed">
              Nền tảng đồng hành cùng sinh viên từ định hướng nghề nghiệp, hoàn thiện hồ sơ năng lực đến cơ hội việc làm và thực tập doanh nghiệp.
            </p>

            <div className="space-y-1 text-xs text-[#64748B]">
              <p className="flex items-center gap-1.5 text-xs text-[#006948] font-medium">
                <ShieldCheck className="w-4 h-4 shrink-0 text-[#006948]" />
                <span>Vận hành cùng mạng lưới đối tác doanh nghiệp uy tín.</span>
              </p>
              <p className="text-xs text-[#64748B]">
                Bảo chứng năng lực và hỗ trợ hướng nghiệp đa kênh cho sinh viên.
              </p>
            </div>
          </div>

          {/* Column 2: Danh cho Co van */}
          <div className="flex flex-col gap-2.5">
            <h4 className="font-['Plus_Jakarta_Sans'] text-xs font-bold text-[#171d19] tracking-wider uppercase">
              Dành cho Cố vấn
            </h4>
            <nav aria-label="Counselor Navigation" className="flex flex-col gap-2">
              {[
                { label: 'Sinh viên phụ trách', tab: 'students' as CounselorTab },
                { label: 'Cơ hội việc làm', tab: 'opportunities' as CounselorTab },
                { label: 'Tiến cử', tab: 'referrals' as CounselorTab },
                { label: 'Theo dõi thực tập', tab: 'internships' as CounselorTab },
                { label: 'Đối tác doanh nghiệp', tab: 'partners' as CounselorTab },
              ].map((link) => (
                <button
                  key={link.tab}
                  type="button"
                  onClick={() => onNavigate && onNavigate(link.tab)}
                  className="text-left font-['Inter'] text-xs sm:text-sm text-[#475569] hover:text-[#006948] transition-colors bg-transparent border-0 outline-none shadow-none p-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#006948] rounded self-start"
                >
                  {link.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Column 3: Ho tro & Tai nguyen */}
          <div className="flex flex-col gap-2.5">
            <h4 className="font-['Plus_Jakarta_Sans'] text-xs font-bold text-[#171d19] tracking-wider uppercase">
              Hỗ trợ & Tài nguyên
            </h4>
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {COUNSELOR_RESOURCES.map((res) => (
                <li key={res.id}>
                  <button
                    type="button"
                    onClick={() => handleOpenResource(res)}
                    className="text-left font-['Inter'] text-xs sm:text-sm text-[#475569] hover:text-[#006948] transition-colors bg-transparent border-0 outline-none shadow-none p-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#006948] rounded"
                    title={res.description}
                  >
                    {res.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Nha truong & Lien he */}
          <div className="flex flex-col gap-2.5">
            <h4 className="font-['Plus_Jakarta_Sans'] text-xs font-bold text-[#171d19] tracking-wider uppercase">
              Nhà trường & Liên hệ
            </h4>

            <div className="flex flex-col gap-2 text-xs sm:text-sm text-[#475569]">
              <div>
                <p className="font-semibold text-[#171d19]">{INSTITUTION_CONFIG.facultyName}</p>
                <p className="text-xs text-[#64748B] mt-0.5">{INSTITUTION_CONFIG.universityName}</p>
              </div>

              <div className="flex items-start gap-1.5 text-xs text-[#475569]">
                <MapPin className="w-3.5 h-3.5 text-[#006948] shrink-0 mt-0.5" />
                <span className="leading-snug">{INSTITUTION_CONFIG.address}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[#475569]">
                <Mail className="w-3.5 h-3.5 text-[#006948] shrink-0" />
                <a
                  href={`mailto:${INSTITUTION_CONFIG.email}`}
                  className="text-[#475569] hover:text-[#006948] transition-colors no-underline"
                >
                  {INSTITUTION_CONFIG.email}
                </a>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[#475569]">
                <Phone className="w-3.5 h-3.5 text-[#006948] shrink-0" />
                <span>{INSTITUTION_CONFIG.hotline}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                <Clock className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                <span>{INSTITUTION_CONFIG.workingHours}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Legal / copyright row */}
        <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[#64748B]">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-center md:text-left">
            <span className="font-semibold text-[#171d19]">
              &copy; {currentYear} Career Assistant.
            </span>
            <span>Bảo lưu mọi quyền.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {SYSTEM_LEGAL_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleOpenLegal(link)}
                className="bg-transparent border-0 outline-none shadow-none text-[#64748B] hover:text-[#006948] transition-colors p-0 cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#006948] rounded"
              >
                {link.label}
              </button>
            ))}
            <span className="text-[#CBD5E1] hidden sm:inline">&bull;</span>
            <span className="font-mono text-[11px] bg-[#E2E8F0]/70 text-[#475569] px-2 py-0.5 rounded font-medium">
              {SYSTEM_VERSION}
            </span>
          </div>
        </div>
      </footer>

      {renderModal(activeModal, handleCloseModal)}
    </>
  );
}

function renderModal(
  activeModal: { title: string; subtitle?: string; content: string } | null,
  onClose: () => void
) {
  if (!activeModal) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="counselor-footer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-[#E2E8F0] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="counselor-footer-modal-title"
                className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#171d19]"
              >
                {activeModal.title}
              </h3>
              {activeModal.subtitle && (
                <p className="font-['Inter'] text-xs text-[#64748B] mt-0.5">
                  {activeModal.subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="text-[#64748B] hover:text-[#171d19] p-1 rounded-lg hover:bg-[#F1F5F9] transition-colors border-0 bg-transparent cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="font-['Inter'] text-sm text-[#334155] leading-relaxed bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]/80">
          {activeModal.content}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white font-['Inter'] text-xs font-semibold rounded-lg transition-colors border-0 cursor-pointer shadow-sm"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}
