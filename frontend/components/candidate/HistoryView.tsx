import React from 'react';
import { FileCheck, Mic, Sparkles } from 'lucide-react';

export default function HistoryView() {
  return (
    <section className="app-view buddy-landing" id="view-history">
      <main className="history-workspace">
        <header className="history-heading">
          <div>
            <h2>
              Lịch sử <span>kết quả</span>
            </h2>
            <p>Tìm lại báo cáo Match, phiên phỏng vấn và các CV đã áp dụng đề xuất tối ưu.</p>
          </div>
        </header>

        <section className="history-summary" aria-label="Tổng quan kết quả">
          <article className="history-summary-item is-match">
            <span className="history-summary-icon">
              <FileCheck size={20} />
            </span>
            <div>
              <strong id="archive-match-count">0</strong>
              <span>Kết quả Match CV và JD</span>
            </div>
          </article>
          <article className="history-summary-item is-optimized">
            <span className="history-summary-icon">
              <Sparkles size={20} />
            </span>
            <div>
              <strong id="archive-optimized-count">0</strong>
              <span>CV đã áp dụng đề xuất tối ưu</span>
            </div>
          </article>
          <article className="history-summary-item is-interview">
            <span className="history-summary-icon">
              <Mic size={20} />
            </span>
            <div>
              <strong id="archive-interview-count">0</strong>
              <span>Phiên phỏng vấn voice</span>
            </div>
          </article>
        </section>

        <section className="history-archive" aria-label="Kho lưu trữ kết quả">
          <div className="archive-toolbar">
            <nav className="archive-filters" aria-label="Lọc lịch sử">
              <button className="archive-filter-btn active" type="button" data-filter="all">
                Tất cả
              </button>
              <button className="archive-filter-btn" type="button" data-filter="match">
                <FileCheck size={16} /> Match CV và JD
              </button>
              <button className="archive-filter-btn" type="button" data-filter="optimized">
                <Sparkles size={16} /> CV đã tối ưu
              </button>
              <button className="archive-filter-btn" type="button" data-filter="interview">
                <Mic size={16} /> Phỏng vấn voice
              </button>
            </nav>
            <span id="archive-result-count" className="archive-result-count" aria-live="polite" />
          </div>
          <div id="archive-timeline-container" className="archive-grid" aria-live="polite" />
        </section>
      </main>
    </section>
  );
}
