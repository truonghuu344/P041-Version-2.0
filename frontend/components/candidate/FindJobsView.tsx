import { BriefcaseBusiness, FileText, Sparkles, X } from 'lucide-react';

export default function FindJobsView() {
  return (
    <section className="app-view buddy-landing jobs-workspace" id="view-find-jobs">
      <div className="jobs-shell top-jobs-shell">
        <header className="jobs-page-header">
          <span className="jobs-eyebrow"><BriefcaseBusiness size={14} /> AI JOB RECOMMENDATIONS</span>
          <h2>Công việc phù hợp với CV</h2>
          <p>Phân tích CV theo hệ tiêu chí rubric và đề xuất Top 10 vị trí phù hợp nhất dành cho bạn.</p>
        </header>

        {/* Filter & Control Bar */}
        <form id="job-search-form" className="top-jobs-console-card" onSubmit={(e) => e.preventDefault()}>
          <div className="top-jobs-control-grid">
            {/* CV Selector */}
            <div className="control-group cv-select-group">
              <label htmlFor="job-search-cv-select">
                <FileText size={15} />
                <span>Chọn CV:</span>
              </label>
              <select id="job-search-cv-select" className="form-select top-jobs-select">
                <option value="">Chọn CV đã lưu</option>
              </select>
            </div>

            {/* Filter Dropdowns */}
            <div className="control-group filter-dropdowns-group">
              <div className="filter-item">
                <select id="job-filter-role" className="form-select filter-select">
                  <option value="">Role ▼</option>
                  <option value="Backend">Backend</option>
                  <option value="Frontend">Frontend</option>
                  <option value="Fullstack">Fullstack</option>
                  <option value="DevOps">DevOps / Cloud</option>
                  <option value="Data">Data / AI / ML</option>
                  <option value="Mobile">Mobile Developer</option>
                </select>
              </div>

              <div className="filter-item">
                <select id="job-filter-location" className="form-select filter-select">
                  <option value="">Địa điểm ▼</option>
                  <option value="Hà Nội">Hà Nội</option>
                  <option value="Hồ Chí Minh">Hồ Chí Minh</option>
                  <option value="Đà Nẵng">Đà Nẵng</option>
                </select>
              </div>

              <div className="filter-item">
                <select id="job-filter-work-mode" className="form-select filter-select">
                  <option value="">Remote ▼</option>
                  <option value="remote">Remote Only</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">Onsite</option>
                </select>
              </div>
            </div>

            {/* Submit Action */}
            <div className="control-group action-group">
              <button type="submit" id="job-match-cv-btn" className="btn-find-top-jobs">
                <Sparkles size={16} /> Tìm công việc phù hợp
              </button>
            </div>
          </div>
        </form>

        {/* Results Header */}
        <div className="top-jobs-results-header">
          <div className="results-title-wrap">
            <span className="pulse-dot green" />
            <h3 id="job-results-summary">Top 10 dành cho bạn</h3>
          </div>
          <span id="job-results-mode" className="results-mode-badge">AI Xếp Hạng</span>
        </div>

        {/* 1-Column Results List (No Grid) */}
        <div id="job-search-results" className="top-jobs-single-column-list" aria-live="polite">
          <div className="job-search-loading">
            <span />
            <p>Đang tải danh sách việc làm phù hợp...</p>
          </div>
        </div>

        <nav id="job-pagination" className="job-pagination" aria-label="Phân trang danh sách việc làm" hidden />
      </div>

      {/* ═══ Bước 23 — Drawer chi tiết Job Recommendation ═══ */}
      <div id="job-recommendation-drawer" className="job-recommendation-drawer" aria-hidden="true">
        <div className="job-drawer-backdrop" id="job-drawer-backdrop" />
        <aside className="job-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="job-drawer-job-title">
          <div className="job-drawer-header">
            <div className="job-drawer-header-left">
              <h3 id="job-drawer-job-title" className="job-drawer-title">Backend Engineer</h3>
              <p id="job-drawer-job-company" className="job-drawer-company">ABC Company · Hồ Chí Minh</p>
            </div>
            <button type="button" className="job-drawer-close" id="job-drawer-close-btn" aria-label="Đóng chi tiết">
              <X size={20} />
            </button>
          </div>

          <div className="job-drawer-body">
            {/* Score & Confidence Hero */}
            <div className="job-drawer-hero-card">
              <div className="job-drawer-score-badge">
                <span id="job-drawer-score-pct" className="job-drawer-score-num">84%</span>
                <span className="job-drawer-score-label">Độ phù hợp hồ sơ</span>
              </div>
              <div className="job-drawer-confidence-badge" id="job-drawer-confidence-badge">
                Confidence: <strong>Cao</strong>
              </div>
            </div>

            {/* Rubric Breakdown (5 Criteria) */}
            <section className="job-drawer-section">
              <h4 className="job-drawer-section-heading">Đánh giá tiêu chí</h4>
              <div className="job-drawer-breakdown-list">
                <div className="job-drawer-breakdown-row">
                  <span className="criteria-label">Kỹ năng bắt buộc</span>
                  <span className="criteria-score" id="job-drawer-must-have">31/35</span>
                </div>
                <div className="job-drawer-breakdown-row">
                  <span className="criteria-label">Kinh nghiệm</span>
                  <span className="criteria-score" id="job-drawer-experience">25/30</span>
                </div>
                <div className="job-drawer-breakdown-row">
                  <span className="criteria-label">Học vấn</span>
                  <span className="criteria-score" id="job-drawer-education">8/10</span>
                </div>
                <div className="job-drawer-breakdown-row">
                  <span className="criteria-label">Kỹ năng ưu tiên</span>
                  <span className="criteria-score" id="job-drawer-nice-to-have">8/10</span>
                </div>
                <div className="job-drawer-breakdown-row">
                  <span className="criteria-label">Domain</span>
                  <span className="criteria-score" id="job-drawer-domain">12/15</span>
                </div>
              </div>
            </section>

            {/* Điểm mạnh (Strengths) */}
            <section className="job-drawer-section">
              <h4 className="job-drawer-section-heading">Điểm mạnh</h4>
              <div className="job-drawer-evidence-list" id="job-drawer-strengths-list">
                <div className="job-drawer-evidence-item strength">
                  <span className="icon-check">✓</span>
                  <span>FastAPI</span>
                </div>
                <div className="job-drawer-evidence-item strength">
                  <span className="icon-check">✓</span>
                  <span>PostgreSQL</span>
                </div>
              </div>
            </section>

            {/* Khoảng trống (Gaps) */}
            <section className="job-drawer-section">
              <h4 className="job-drawer-section-heading">Khoảng trống</h4>
              <div className="job-drawer-evidence-list" id="job-drawer-gaps-list">
                <div className="job-drawer-evidence-item gap">
                  <span className="icon-warn">⚠</span>
                  <span>Redis</span>
                </div>
              </div>
            </section>
          </div>

          {/* Action CTAs */}
          <div className="job-drawer-footer">
            <button type="button" className="btn-drawer-action btn-full-match" id="btn-drawer-full-match">
              Xem Match đầy đủ
            </button>
            <button type="button" className="btn-drawer-action btn-optimize-cv" id="btn-drawer-optimize-cv">
              Tối ưu CV theo JD
            </button>
            <button type="button" className="btn-drawer-action btn-mock-interview" id="btn-drawer-mock-interview">
              Luyện phỏng vấn
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
