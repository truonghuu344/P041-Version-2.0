/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  ArrowRight,
  Compass,
} from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  content: string;
  navTarget: string;
  actionText: string;
}

const candidateSteps: TourStep[] = [
  {
    targetId: 'intent-card-cv',
    title: '1. Tạo & Tối Ưu CV Chuẩn STAR',
    content: 'Chuyển hóa từng dòng mô tả công việc thành câu thành tích định lượng theo mô hình STAR, tối ưu từ khóa giúp CV vượt qua mọi vòng lọc ATS.',
    navTarget: 'nav-cv',
    actionText: 'Bắt đầu tối ưu CV',
  },
  {
    targetId: 'intent-card-match',
    title: '2. So Khớp CV & Gap Analysis',
    content: 'Tải CV và dán JD tuyển dụng để AI đối chiếu 100% yêu cầu, tính điểm Match % và chỉ ra chính xác các kỹ năng còn thiếu.',
    navTarget: 'nav-match',
    actionText: 'So khớp CV với JD ngay',
  },
  {
    targetId: 'intent-card-interview',
    title: '3. Luyện Phỏng Vấn Giọng Nói 1-1',
    content: 'Thực hành trả lời câu hỏi trực tiếp bằng giọng nói thời gian thực với AI Coach, nhận báo cáo phân tích độ tự tin và phản xạ STAR.',
    navTarget: 'nav-interview',
    actionText: 'Vào phòng phỏng vấn thử',
  },
];

export default function BuddyTourGuide() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = useState({ top: 140, left: 24 });

  const close = () => {
    try {
      localStorage.setItem('cv-assistant-tour-seen', '1');
    } catch {
      // Ignore
    }
    setVisible(false);
  };

  const startTour = () => {
    setStep(0);
    setVisible(true);
  };

  useEffect(() => {
    try {
      const seen = localStorage.getItem('cv-assistant-tour-seen');
      if (seen !== '1') {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }

    const onRestart = () => {
      startTour();
    };

    window.addEventListener('cv-assistant-restart-tour', onRestart);
    return () => window.removeEventListener('cv-assistant-restart-tour', onRestart);
  }, []);

  // Update target spotlight and card position
  useEffect(() => {
    if (!visible) {
      setTargetRect(null);
      return;
    }

    const currentStep = candidateSteps[step];
    if (!currentStep) return;

    const updatePosition = () => {
      const el = document.getElementById(currentStep.targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    const currentStep = candidateSteps[step];
    if (currentStep) {
      const navBtn = document.getElementById(currentStep.navTarget);
      if (navBtn) {
        close();
        navBtn.click();
      }
    }
  };

  const handleNext = () => {
    if (step < candidateSteps.length - 1) {
      setStep(step + 1);
    } else {
      close();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  return (
    <>
      {/* ── ACTIVE SPOTLIGHT OVERLAY & INTERACTIVE TOUR CARD ── */}
      {visible && (
        <div className="fixed inset-0 z-50 pointer-events-auto" data-testid="candidate-tour-guide">
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

          {/* Fallback backdrop */}
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
                    Bước {step + 1} / {candidateSteps.length}
                  </span>
                  <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-slate-900 mt-1">
                    {candidateSteps[step].title}
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
              {candidateSteps[step].content}
            </p>

            {/* Direct jump to feature button */}
            <button
              type="button"
              onClick={handleActionClick}
              className="w-full py-1.5 px-3 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-[#006948] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>{candidateSteps[step].actionText}</span>
              <ArrowRight size={13} />
            </button>

            {/* Footer with Step dots & Next/Prev */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1">
                {candidateSteps.map((_, i) => (
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
                  <span>{step === candidateSteps.length - 1 ? 'Hoàn tất' : 'Tiếp tục'}</span>
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
