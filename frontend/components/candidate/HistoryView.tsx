import React from 'react';
import { FileCheck, History, Mic, Sparkles } from 'lucide-react';

export default function HistoryView() {
  return (
    <section className="app-view buddy-landing" id="view-history">
      <div className="buddy-hero-shell history-workspace">
        <header className="buddy-section-heading history-heading">
          <div>
            <span className="buddy-kicker"><History size={15} /> Lịch sử & báo cáo</span>
            <h2>CV <span>và kết quả</span> của bạn</h2>
            <p>Xem lại từng lượt Match, những CV đã áp dụng tối ưu và báo cáo phỏng vấn.</p>
          </div>
        </header>
        <section className="history-archive" aria-label="Kho lưu trữ kết quả">
          <nav className="archive-filters" aria-label="Lọc lịch sử">
            <button className="archive-filter-btn active" type="button" data-filter="all">Tất cả</button>
            <button className="archive-filter-btn" type="button" data-filter="match"><FileCheck size={16} /> CV đã Match với JD</button>
            <button className="archive-filter-btn" type="button" data-filter="optimized"><Sparkles size={16} /> CV đã tối ưu</button>
            <button className="archive-filter-btn" type="button" data-filter="interview"><Mic size={16} /> Phỏng vấn voice</button>
          </nav>
          <div id="archive-timeline-container" className="archive-grid" aria-live="polite" />
        </section>
      </div>
    </section>
  );
}
