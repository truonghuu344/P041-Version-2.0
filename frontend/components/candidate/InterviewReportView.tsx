import {
  ArrowLeft,
  BarChart3,
  Check,
  MessageSquareText,
  RotateCcw,
  Sparkles,
  Star,
} from 'lucide-react';

// Trang báo cáo phỏng vấn độc lập (view-interview-report). Chỉ có 2 lối vào:
// (1) khi phỏng vấn kết thúc, (2) nút "Mở báo cáo đầy đủ" trong drawer Lịch sử.
// Không có mục nav riêng trên thanh điều hướng — xem app.js: switchView('interview-report').
// Toàn bộ dữ liệu do renderInterviewReport(sessionId) trong app.js đổ vào theo id.
export default function InterviewReportView() {
  return (
    <section className="app-view buddy-landing" id="view-interview-report">
      <div className="interview-shell">
        <section className="interview-report-card report-page-card" id="page-interview-report">
          <header className="report-page-header">
            <button type="button" id="page-report-back-history" className="report-header-back">
              <ArrowLeft size={16} /> Về Lịch sử
            </button>
            <div className="report-header-main">
              <span className="interview-icon">
                <BarChart3 size={19} />
              </span>
              <div>
                <h3>Báo cáo phiên luyện tập</h3>
                <p className="report-header-meta">
                  <span id="page-report-jd-title">—</span>
                  <span className="report-header-dot" aria-hidden="true">
                    ·
                  </span>
                  <span id="page-report-date">—</span>
                  <span className="report-header-dot" aria-hidden="true">
                    ·
                  </span>
                  <span id="page-report-mode-badge" className="report-mode-badge">
                    —
                  </span>
                </p>
              </div>
              <strong id="page-report-total-score">—</strong>
            </div>
            <button type="button" id="page-report-retry" className="report-header-retry">
              <RotateCcw size={16} /> Luyện lại vị trí này
            </button>
          </header>

          <div id="page-report-star-breakdown" className="interview-score-breakdown" />

          <div className="interview-report-columns">
            <article>
              <h4>
                <Check size={16} /> Điểm mạnh
              </h4>
              <ul id="page-report-strengths-list" />
            </article>
            <article>
              <h4>
                <Star size={16} /> Cần cải thiện
              </h4>
              <ul id="page-report-improvements-list" />
            </article>
          </div>

          <article className="interview-recommendations">
            <h4>
              <Sparkles size={16} /> Gợi ý luyện tập tiếp
            </h4>
            <ul id="page-report-recommendations-list" />
          </article>

          <section className="report-transcript-card">
            <h4>
              <MessageSquareText size={16} /> Toàn bộ hội thoại
            </h4>
            <div id="page-report-transcript" className="report-transcript-list" />
          </section>

          <form id="page-interview-csat-form" className="interview-feedback-form">
            <select id="page-interview-csat" required>
              <option value="">Đánh giá phiên này</option>
              <option value="5">5 — Rất hữu ích</option>
              <option value="4">4 — Hữu ích</option>
              <option value="3">3 — Bình thường</option>
              <option value="2">2 — Chưa tốt</option>
              <option value="1">1 — Không hữu ích</option>
            </select>
            <input id="page-interview-csat-comment" placeholder="Góp ý thêm (tuỳ chọn)" />
            <button type="submit">Gửi đánh giá</button>
          </form>
        </section>
      </div>
    </section>
  );
}
