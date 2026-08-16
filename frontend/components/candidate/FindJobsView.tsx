import { m } from 'framer-motion';
import { BriefcaseBusiness, Sparkles } from 'lucide-react';

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
        <div className="top-jobs-console-card">
          <div className="top-jobs-control-grid">
            {/* Chọn CV */}
            <div className="control-group cv-select-group">
              <label htmlFor="job-search-cv-select">
                <span className="control-label-title">Chọn CV đối chiếu</span>
                <span className="control-label-hint">Áp dụng cho mọi CV trong Kho (CV gốc, Đã Match, Đã tối ưu)</span>
              </label>

              {/* Custom Interactive CV Selector with Status Badges */}
              <div className="top-jobs-cv-dropdown" id="top-jobs-cv-dropdown">
                <button type="button" className="top-jobs-cv-trigger" id="top-jobs-cv-trigger" aria-haspopup="listbox" aria-expanded="false">
                  <div className="cv-trigger-content">
                    <span className="cv-status-badge is-none" id="top-jobs-selected-cv-badge">Chưa chọn</span>
                    <div className="cv-trigger-details">
                      <strong className="cv-trigger-title" id="top-jobs-selected-cv-title">Chọn CV đã lưu...</strong>
                      <small className="cv-trigger-meta" id="top-jobs-selected-cv-meta"></small>
                    </div>
                  </div>
                  <span className="cv-trigger-chevron" aria-hidden="true">▾</span>
                </button>

                {/* Hidden native select for form & compatibility */}
                <select id="job-search-cv-select" className="visually-hidden-select" tabIndex={-1} aria-hidden="true">
                  <option value="">Chọn CV đã lưu...</option>
                </select>

                {/* Custom Dropdown Menu */}
                <div className="top-jobs-cv-menu" id="top-jobs-cv-menu" role="listbox" hidden>
                  <div className="top-jobs-cv-menu-header">
                    <span>Kho CV của bạn</span>
                    <small>Chọn CV bất kỳ để tìm việc phù hợp</small>
                  </div>
                  <div className="top-jobs-cv-list" id="top-jobs-cv-list">
                    {/* Dynamic CV options populated by JS */}
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="control-group filter-dropdowns-group">
              <div className="filter-header-label-wrap">
                <span className="filter-group-title">Bộ lọc tùy chọn</span>
                <span className="filter-group-hint">Không chọn gì → tự động xếp hạng toàn diện theo CV</span>
              </div>
              <div className="filter-items-row">
                <div className="filter-item">
                  <label htmlFor="job-filter-role" className="filter-item-label">Vị trí mong muốn (Tùy chọn)</label>
                  <select id="job-filter-role" className="form-select filter-select">
                    <option value="">Tất cả vị trí</option>
                    <option value="Backend">Backend</option>
                    <option value="Frontend">Frontend</option>
                    <option value="Fullstack">Fullstack</option>
                    <option value="DevOps">DevOps / Cloud</option>
                    <option value="Data">Data / AI / ML</option>
                    <option value="Mobile">Mobile Developer</option>
                  </select>
                </div>

                <div className="filter-item">
                  <label htmlFor="job-filter-location" className="filter-item-label">Địa điểm (Tùy chọn)</label>
                  <select id="job-filter-location" className="form-select filter-select">
                    <option value="">Tất cả địa điểm</option>
                    <option value="Hồ Chí Minh">Hồ Chí Minh</option>
                    <option value="Hà Nội">Hà Nội</option>
                    <option value="Đà Nẵng">Đà Nẵng</option>
                  </select>
                </div>

                <div className="filter-item">
                  <label htmlFor="job-filter-work-mode" className="filter-item-label">Hình thức làm việc (Tùy chọn)</label>
                  <select id="job-filter-work-mode" className="form-select filter-select">
                    <option value="">Tất cả hình thức</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="remote">Remote Only</option>
                    <option value="onsite">Onsite</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="control-group action-group">
              <div className="top-jobs-submit-copy">
                <span className="top-jobs-submit-status-pill">Sẵn sàng gợi ý</span>
                <span>Hệ thống hỗ trợ tìm việc trực tiếp từ CV gốc, Đã Match và Đã tối ưu.</span>
              </div>
              <button type="button" id="job-match-cv-btn" className="btn-find-top-jobs" disabled>
                <Sparkles size={16} /> Tìm công việc phù hợp
              </button>
            </div>
          </div>
        </div>

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

      </div>
    </section>
  );
}

