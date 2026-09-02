/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import {
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  HelpCircle,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { CounselorTab } from './CounselorNavbar';

export interface CounselorTourStep {
  targetId: string;
  title: string;
  content: string;
  tabKey: CounselorTab;
  actionText?: string;
}

const counselorSteps: CounselorTourStep[] = [
  {
    targetId: 'counselor-kpi-overview',
    title: '1. Bảng Tổng quan KPI & Tiến độ',
    content: 'Nắm bắt nhanh số lượng sinh viên phụ trách, hồ sơ CV cần duyệt, nhu cầu nhân lực từ doanh nghiệp và mạng lưới đối tác liên kết.',
    tabKey: 'dashboard',
    actionText: 'Xem bảng tổng quan',
  },
  {
    targetId: 'counselor-nav-students',
    title: '2. Quản lý Sinh viên & Duyệt CV',
    content: 'Tra cứu danh sách sinh viên theo dạng bảng trực quan, lọc theo chuyên ngành/trạng thái, xem chi tiết CV và phê duyệt sẵn sàng ứng tuyển.',
    tabKey: 'students',
    actionText: 'Mở Danh sách Sinh viên',
  },
  {
    targetId: 'counselor-nav-opportunities',
    title: '3. Cơ hội Việc làm & Tiến cử Ứng viên',
    content: 'Khám phá các vị trí tuyển dụng thực tập/fresher từ doanh nghiệp, lọc danh sách sinh viên có điểm Match cao nhất và gửi hồ sơ tiến cử tức thì.',
    tabKey: 'opportunities',
    actionText: 'Mở Cơ hội việc làm',
  },
  {
    targetId: 'counselor-nav-jds',
    title: '4. Đăng & Quản lý JD Tuyển dụng',
    content: 'Tải file JD lên để AI tự động bóc tách thông tin, hoàn thiện tiêu chuẩn và công bố vị trí cho sinh viên đối chiếu hồ sơ tuyển dụng.',
    tabKey: 'jds',
    actionText: 'Mở Quản lý JD',
  },
];

interface CounselorTourGuideProps {
  onNavigateTab?: (tab: CounselorTab) => void;
}

export default function CounselorTourGuide({ onNavigateTab }: CounselorTourGuideProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = useState({ top: 120, left: 24 });

  const close = () => {
    try {
      localStorage.setItem('counselor-tour-seen', '1');
    } catch {
      // Ignore storage errors
    }
    setVisible(false);
  };

  const startTour = () => {
    setStep(0);
    setVisible(true);
  };

  useEffect(() => {
    try {
      const seen = localStorage.getItem('counselor-tour-seen');
      if (seen !== '1') {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }

    const onRestart = () => {
      startTour();
    };

    window.addEventListener('counselor-restart-tour', onRestart);
    return () => window.removeEventListener('counselor-restart-tour', onRestart);
  }, []);

  // Update target spotlight and card position
  useEffect(() => {
    if (!visible) {
      setTargetRect(null);
      return;
    }

    const currentStep = counselorSteps[step];
    if (!currentStep) return;

    const updatePosition = () => {
      const el = document.getElementById(currentStep.targetId);
      if (el) {
        // Scroll target smoothly into view
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);

        const cardWidth = 340;
        const isMobile = window.innerWidth < 768;

        if (isMobile) {
          setCardPos({
            top: Math.min(window.innerHeight - 280, Math.max(16, rect.bottom + 12)),
            left: Math.max(12, Math.min(window.innerWidth - cardWidth - 12, (window.innerWidth - cardWidth) / 2)),
          });
        } else {
          // Desktop positioning
          let top = rect.bottom + 14;
          let left = rect.left;

          if (top + 260 > window.innerHeight) {
            top = Math.max(16, rect.top - 240);
          }
          if (left + cardWidth > window.innerWidth) {
            left = window.innerWidth - cardWidth - 24;
          }

          setCardPos({
            top: Math.max(16, top),
            left: Math.max(16, left),
          });
        }
      } else {
        // Center card fallback if target element is not on current page
        setTargetRect(null);
        setCardPos({
          top: Math.max(80, window.innerHeight / 2 - 120),
          left: Math.max(16, (window.innerWidth - 340) / 2),
        });
      }
    };

    const timer = setTimeout(updatePosition, 100);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [step, visible]);

  const handleActionClick = () => {
    const currentStep = counselorSteps[step];
    if (currentStep && onNavigateTab) {
      onNavigateTab(currentStep.tabKey);
    }
  };

  const handleNext = () => {
    if (step < counselorSteps.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      // Automatically switch to the relevant tab if needed
      if (onNavigateTab && counselorSteps[nextStep]) {
        onNavigateTab(counselorSteps[nextStep].tabKey);
      }
    } else {
      close();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      const prevStep = step - 1;
      setStep(prevStep);
      if (onNavigateTab && counselorSteps[prevStep]) {
        onNavigateTab(counselorSteps[prevStep].tabKey);
      }
    }
  };

  return (
    <>
      {/* ── ACTIVE SPOTLIGHT OVERLAY & INTERACTIVE TOUR CARD ── */}
      {visible && (
        <div className="fixed inset-0 z-50 pointer-events-auto" data-testid="counselor-tour-guide">
          {/* Spotlight highlight box over the target element */}
          {targetRect && (
            <div
              className="fixed pointer-events-none rounded-2xl border-2 border-[#006948] bg-emerald-500/10 transition-all duration-300 shadow-[0_0_0_9999px_rgba(15,23,42,0.5)] ring-4 ring-[#006948]/30"
              style={{
                top: targetRect.top - 6,
                left: targetRect.left - 6,
                width: targetRect.width + 12,
                height: targetRect.height + 12,
              }}
            />
          )}

          {/* If no target rect found, dark backdrop fallback */}
          {!targetRect && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" onClick={close} />
          )}

          {/* Interactive Floating Tour Card */}
          <div
            className="fixed z-50 w-[340px] bg-white rounded-2xl border border-emerald-100 shadow-2xl p-4 md:p-5 space-y-3 transition-all duration-200 animate-in fade-in zoom-in-95"
            style={{ top: cardPos.top, left: cardPos.left }}
          >
            {/* Header: Mascot + Step title + Close */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0">
                  <Sparkles size={16} className="text-[#006948]" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#006948] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                    Bước {step + 1} / {counselorSteps.length}
                  </span>
                  <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-slate-900 mt-1">
                    {counselorSteps[step].title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={close}
                className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors shrink-0"
                title="Đóng hướng dẫn"
              >
                <X size={13} />
              </button>
            </div>

            {/* Content text */}
            <p className="text-xs text-slate-600 leading-relaxed font-['Inter']">
              {counselorSteps[step].content}
            </p>

            {/* Direct jump to feature button */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={handleActionClick}
                className="w-full py-1.5 px-3 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-[#006948] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>{counselorSteps[step].actionText}</span>
                <ArrowRight size={13} />
              </button>
            )}

            {/* Footer with Step dots & Next/Prev */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1">
                {counselorSteps.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === step ? 'w-4 bg-[#006948]' : 'w-1.5 bg-slate-200'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft size={13} />
                    <span>Trước</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-3.5 py-1.5 bg-[#006948] text-white text-xs font-bold rounded-xl hover:bg-[#047857] shadow-xs flex items-center gap-1 transition-all"
                >
                  <span>{step === counselorSteps.length - 1 ? 'Hoàn tất' : 'Tiếp tục'}</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
