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

        {/* <nav id="job-pagination" className="job-pagination" aria-label="Phân trang danh sách việc làm" hidden /> */}
      </div>

      {/* ═══ Modal Chi tiết công việc & Đối chiếu với CV ═══ */}
      <div id="job-recommendation-drawer" className="job-recommendation-drawer job-modal-overlay" aria-hidden="true">
        <div className="job-drawer-backdrop" id="job-drawer-backdrop" />
        <aside className="job-drawer-panel job-modal-panel" role="dialog" aria-modal="true" aria-labelledby="job-drawer-job-title">
          {/* 1. Modal Header */}
          <div className="job-drawer-header">
            <div className="job-drawer-header-left">
              <div className="job-drawer-badge-row">
                <span className="job-modal-tag">Chi tiết tuyển dụng &amp; Đối chiếu</span>
              </div>
              <h3 id="job-drawer-job-title" className="job-drawer-title">Backend Engineer</h3>
              <p id="job-drawer-job-company" className="job-drawer-company">ABC Company · Hồ Chí Minh · Hybrid</p>
            </div>
            <button type="button" className="job-drawer-close" id="job-drawer-close-btn" aria-label="Đóng chi tiết">
              <X size={20} />
            </button>
          </div>

          {/* 2. Modal Body */}
          <div className="job-drawer-body">
            {/* Top Highlight Strip: Active CV + Fit Score Hero */}
            <div className="job-drawer-top-banner">
              <div className="job-drawer-cv-banner" id="job-drawer-cv-banner">
                <div className="drawer-cv-banner-left">
                  <span className="cv-status-badge is-raw" id="job-drawer-cv-badge">CV gốc</span>
                  <div className="drawer-cv-banner-text">
                    <strong id="job-drawer-cv-name">CV đã chọn</strong>
                    <small>Bản CV đang dùng để xếp hạng &amp; so sánh</small>
                  </div>
                </div>
                <button type="button" className="btn-drawer-switch-cv" id="btn-drawer-switch-cv">
                  Đổi CV khác
                </button>
              </div>

              <div className="job-drawer-hero-card" id="job-drawer-hero-card">
                <div className="job-drawer-score-badge">
                  <span id="job-drawer-score-pct" className="job-drawer-score-num">84%</span>
                  <span id="job-drawer-score-label" className="job-drawer-score-label">Độ phù hợp hồ sơ</span>
                </div>
                <div className="job-drawer-confidence-badge is-high" id="job-drawer-confidence-badge">
                  Độ tin cậy: <strong>Cao</strong>
                </div>
              </div>
            </div>

            {/* Mandatory Warning Alert (shown conditionally) */}
            <div className="job-drawer-mandatory-alert" id="job-drawer-mandatory-alert" hidden>
              <span className="icon-warn" aria-hidden="true">⚠</span>
              <div className="mandatory-alert-content">
                <strong>Thiếu yêu cầu bắt buộc</strong>
                <p id="job-drawer-mandatory-detail">Hồ sơ chưa đáp ứng đủ tiêu chí bắt buộc của vị trí này. Điểm hiển thị được giới hạn tối đa 49%.</p>
              </div>
            </div>

            {/* 2-Column Content Layout: Left = Job Spec, Right = Match Evaluation */}
            <div className="job-drawer-grid">
              {/* Column 1: JD Chi tiết công việc */}
              <div className="job-drawer-col">
                <section className="job-drawer-section">
                  <h4 className="job-drawer-section-heading">📋 Mô tả công việc &amp; Trách nhiệm</h4>
                  <div className="job-drawer-desc-content" id="job-drawer-description">
                    <ul className="job-drawer-list">
                      <li>Thiết kế, xây dựng và tối ưu các RESTful API và microservices backend đáp ứng tải cao.</li>
                      <li>Phối hợp với frontend team và product team để triển khai các tính năng mới cho nền tảng.</li>
                      <li>Tối ưu hóa truy vấn cơ sở dữ liệu PostgreSQL và quản lý dữ liệu hiệu năng cao.</li>
                    </ul>
                  </div>
                </section>

                <section className="job-drawer-section">
                  <h4 className="job-drawer-section-heading">🎯 Yêu cầu ứng viên</h4>
                  <div className="job-drawer-req-content" id="job-drawer-requirements">
                    <ul className="job-drawer-list">
                      <li>Tối thiểu 2+ năm kinh nghiệm phát triển backend với Python / FastAPI hoặc Node.js.</li>
                      <li>Thành thạo cơ sở dữ liệu quan hệ (PostgreSQL / MySQL) và thiết kế schema hiệu quả.</li>
                      <li>Hiểu biết về kiến trúc hệ thống, Docker, CI/CD và tối ưu hóa hiệu năng ứng dụng.</li>
                    </ul>
                  </div>
                </section>

                <section className="job-drawer-section">
                  <h4 className="job-drawer-section-heading">⚡ Tech Stack &amp; Kỹ năng</h4>
                  <div className="job-drawer-skills-wrap" id="job-drawer-skills-list">
                    <span className="drawer-skill-pill">Python</span>
                    <span className="drawer-skill-pill">FastAPI</span>
                    <span className="drawer-skill-pill">PostgreSQL</span>
                    <span className="drawer-skill-pill">Docker</span>
                    <span className="drawer-skill-pill">Redis</span>
                    <span className="drawer-skill-pill">REST API</span>
                  </div>
                </section>
              </div>

              {/* Column 2: Đánh giá chi tiết với CV */}
              <div className="job-drawer-col">
                <section className="job-drawer-section">
                  <h4 className="job-drawer-section-heading">📊 Đánh giá 5 tiêu chí Rubric</h4>
                  <div className="job-drawer-breakdown-list">
                    <div className="job-drawer-breakdown-row">
                      <span className="criteria-label">Kỹ năng bắt buộc</span>
                      <span className="criteria-bar-wrap">
                        <span className="criteria-bar"><span className="criteria-bar-fill" style={{ width: '89%' }}></span></span>
                      </span>
                      <span className="criteria-score" id="job-drawer-must-have">31/35</span>
                    </div>
                    <div className="job-drawer-breakdown-row">
                      <span className="criteria-label">Kinh nghiệm</span>
                      <span className="criteria-bar-wrap">
                        <span className="criteria-bar"><span className="criteria-bar-fill" style={{ width: '83%' }}></span></span>
                      </span>
                      <span className="criteria-score" id="job-drawer-experience">25/30</span>
                    </div>
                    <div className="job-drawer-breakdown-row">
                      <span className="criteria-label">Học vấn</span>
                      <span className="criteria-bar-wrap">
                        <span className="criteria-bar"><span className="criteria-bar-fill" style={{ width: '80%' }}></span></span>
                      </span>
                      <span className="criteria-score" id="job-drawer-education">8/10</span>
                    </div>
                    <div className="job-drawer-breakdown-row">
                      <span className="criteria-label">Kỹ năng ưu tiên</span>
                      <span className="criteria-bar-wrap">
                        <span className="criteria-bar"><span className="criteria-bar-fill" style={{ width: '80%' }}></span></span>
                      </span>
                      <span className="criteria-score" id="job-drawer-nice-to-have">8/10</span>
                    </div>
                    <div className="job-drawer-breakdown-row">
                      <span className="criteria-label">Domain / Ngành</span>
                      <span className="criteria-bar-wrap">
                        <span className="criteria-bar"><span className="criteria-bar-fill" style={{ width: '80%' }}></span></span>
                      </span>
                      <span className="criteria-score" id="job-drawer-domain">12/15</span>
                    </div>
                  </div>
                </section>

                <section className="job-drawer-section">
                  <h4 className="job-drawer-section-heading">✓ Điểm mạnh phù hợp</h4>
                  <div className="job-drawer-evidence-list" id="job-drawer-strengths-list">
                    <div className="job-drawer-evidence-item strength">
                      <span className="icon-check">✓</span>
                      <span>FastAPI — khớp yêu cầu chính về backend framework</span>
                    </div>
                    <div className="job-drawer-evidence-item strength">
                      <span className="icon-check">✓</span>
                      <span>PostgreSQL — kinh nghiệm thiết kế schema</span>
                    </div>
                  </div>
                </section>

                <section className="job-drawer-section">
                  <h4 className="job-drawer-section-heading">△ Cần bổ sung / Khoảng trống</h4>
                  <div className="job-drawer-evidence-list" id="job-drawer-gaps-list">
                    <div className="job-drawer-evidence-item gap">
                      <span className="icon-warn">⚠</span>
                      <span>Redis — JD yêu cầu caching layer, CV chưa đề cập</span>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>

          {/* 3. Modal Footer */}
          <div className="job-drawer-footer">
            <div className="job-drawer-footer-actions">
              <button type="button" className="btn-drawer-action btn-modal-close" id="job-drawer-cancel-btn">
                Đóng
              </button>
              <button type="button" className="btn-drawer-action btn-full-match" id="btn-drawer-full-match">
                🎯 So khớp chi tiết với CV này
              </button>
              <button type="button" className="btn-drawer-action btn-mock-interview" id="btn-drawer-mock-interview">
                🎙️ Luyện phỏng vấn JD này
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
