/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
'use client';

import React from 'react';
import { Building2, ArrowRight } from 'lucide-react';
import { PARTNER_ECOSYSTEM, PartnerItem } from '@/lib/institutionConfig';
import { CounselorTab } from './CounselorNavbar';

interface PartnerTrustStripProps {
  onNavigate?: (tab: CounselorTab, params?: any) => void;
  partners?: PartnerItem[];
  className?: string;
}

export default function PartnerTrustStrip({
  onNavigate,
  partners = PARTNER_ECOSYSTEM,
  className = '',
}: PartnerTrustStripProps) {
  const handlePartnerClick = (partner: PartnerItem) => {
    if (!onNavigate) return;
    if (partner.id) {
      onNavigate('partner-detail', { partnerId: partner.id });
    } else {
      onNavigate('partners');
    }
  };

  return (
    <section
      aria-labelledby="partner-strip-title"
      className={`w-full p-5 mb-6 bg-white rounded-xl border border-[#E2E8F0] shadow-xs transition-colors ${className}`}
    >
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E2E8F0]/70">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#059669]" aria-hidden="true" />
            <h2
              id="partner-strip-title"
              className="font-['Plus_Jakarta_Sans'] text-base sm:text-lg font-bold text-[#171d19]"
            >
              Đơn vị liên kết
            </h2>
          </div>
          <p className="font-['Inter'] text-xs sm:text-sm text-[#64748B] mt-0.5">
            Đồng hành cùng sinh viên trong tuyển dụng và thực tập
          </p>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('partners')}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-xs sm:text-sm font-semibold text-[#059669] hover:text-[#047857] hover:bg-[#ECFDF5] transition-colors self-start sm:self-auto group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
          >
            <span>Xem mạng lưới</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>


      {/* ── CONTINUOUS SEAMLESS LOGO MARQUEE (SINGLE VISIBLE ROW) ── */}
      <div className="pt-4 overflow-hidden">
        <div
          className="partner-marquee partner-marquee-container py-1"
          role="region"
          aria-label="Danh sách logo doanh nghiệp liên kết cuộn tự động"
        >
          <div className="partner-marquee-track">
            {/* Group 1: Primary Interactive Track */}
            <div className="partner-marquee-group partner-group">
              {partners.map((partner) => (
                <button
                  key={`track1-${partner.id}`}
                  type="button"
                  onClick={() => handlePartnerClick(partner)}
                  className="partner-item group"
                  title={`${partner.name} - ${partner.industry || 'Đối tác đào tạo'}`}
                >
                  <div className="partner-logo-box">
                    {partner.logo ? (
                      <img
                        src={partner.logo}
                        alt={`Logo ${partner.name}`}
                        className="partner-logo"
                        loading="lazy"
                      />
                    ) : (
                      <div className="partner-fallback">
                        <Building2 className="w-4 h-4 text-[#64748B]" />
                        <span className="truncate">{partner.name}</span>
                      </div>
                    )}
                  </div>
                  <span className="partner-name">
                    {partner.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Group 2: Duplicate Seamless Track (aria-hidden for screen readers) */}
            <div
              className="partner-marquee-group partner-group"
              aria-hidden="true"
            >
              {partners.map((partner) => (
                <div
                  key={`track2-${partner.id}`}
                  onClick={() => handlePartnerClick(partner)}
                  tabIndex={-1}
                  className="partner-item group"
                >
                  <div className="partner-logo-box">
                    {partner.logo ? (
                      <img
                        src={partner.logo}
                        alt=""
                        className="partner-logo"
                        loading="lazy"
                      />
                    ) : (
                      <div className="partner-fallback">
                        <Building2 className="w-4 h-4 text-[#64748B]" />
                        <span className="truncate">{partner.name}</span>
                      </div>
                    )}
                  </div>
                  <span className="partner-name">
                    {partner.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
