'use client';

import Image from 'next/image';
import { ArrowRight, FileText, Mic, Search, Target } from 'lucide-react';
import BuddyTourGuide from './BuddyTourGuide';

function goTo(primaryId: string, fallbackId?: string) {
  const target = document.getElementById(primaryId) || (fallbackId ? document.getElementById(fallbackId) : null);
  target?.click();
}

export default function DashboardView() {
  return (
    <section className="app-view active dashboard-dashboard home-dashboard" id="view-dashboard">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <h1 id="home-title" className="home-hero-title">
              Chuẩn bị tốt hơn<br />
              <span>cho công việc bạn muốn.</span>
            </h1>
            <p className="home-hero-description">
              Chọn đúng việc bạn cần: tối ưu CV, kiểm tra mức độ phù hợp với JD,
              hoặc luyện trả lời trước buổi phỏng vấn.
            </p>
            <div className="home-hero-actions" aria-label="Thao tác nhanh">
              <button type="button" className="home-btn home-btn-primary" onClick={() => goTo('nav-cv')}>
                <FileText size={18} /> Tối ưu CV <ArrowRight size={17} />
              </button>
              <button type="button" className="home-btn home-btn-secondary" onClick={() => goTo('nav-match', 'nav-gap')}>
                <Search size={18} /> Match CV với JD
              </button>
              <button type="button" className="home-btn home-btn-secondary" onClick={() => goTo('nav-interview')}>
                <Mic size={18} /> Luyện phỏng vấn voice
              </button>
            </div>
          </div>

          <div className="home-hero-visual" aria-label="Minh họa các tính năng CV Assistant">
            <div className="home-visual-aura" aria-hidden="true" />
            <div className="home-buddy-stage">
              <Image src="/images/buddy2.png" alt="CV Assistant Buddy" width={1536} height={1024} className="home-buddy-image" priority />
            </div>
          </div>
        </div>
      </section>

      <section className="home-features" aria-labelledby="home-features-title">
        <header className="home-features-header">
          <h2 id="home-features-title">Hôm nay bạn muốn làm gì?</h2>
          <p>Không có bước bắt buộc. Chọn đúng công cụ cho nhu cầu hiện tại của bạn.</p>
        </header>
        <div className="home-feature-grid">
          <button type="button" className="home-feature-card" onClick={() => goTo('nav-cv')}>
            <span className="home-feature-icon"><FileText size={25} /></span>
            <h3>Tạo hoặc cập nhật CV</h3>
            <p>Bắt đầu từ mẫu có sẵn hoặc tải lên CV hiện có.</p>
            <span className="home-feature-cta">Tạo & chỉnh sửa CV <ArrowRight size={18} /></span>
          </button>
          <button type="button" className="home-feature-card" onClick={() => goTo('nav-match', 'nav-gap')}>
            <span className="home-feature-icon"><Target size={25} /></span>
            <h3>Match CV với công việc</h3>
            <p>Chọn công việc và xem mức độ phù hợp của CV với JD.</p>
            <span className="home-feature-cta">Xem mức độ phù hợp <ArrowRight size={18} /></span>
          </button>
          <button type="button" className="home-feature-card" onClick={() => goTo('nav-interview')}>
            <span className="home-feature-icon"><Mic size={25} /></span>
            <h3>Luyện phỏng vấn voice</h3>
            <p>Thực hành trả lời câu hỏi phỏng vấn bằng giọng nói và nhận phản hồi chi tiết.</p>
            <span className="home-feature-cta">Luyện phỏng vấn <ArrowRight size={18} /></span>
          </button>
        </div>
      </section>
      <BuddyTourGuide />
    </section>
  );
}
