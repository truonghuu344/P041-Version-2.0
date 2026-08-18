import { BriefcaseBusiness, Database, Plus, Search, ShieldCheck } from 'lucide-react';

export default function FindJobsView() {
  return (
    <section className="app-view buddy-landing jobs-workspace" id="view-find-jobs">
      <div className="jobs-shell top-jobs-shell">
        <header className="jobs-page-header">
          <span className="jobs-eyebrow">
            <BriefcaseBusiness size={14} /> GỢI Ý VIỆC LÀM
          </span>
          <h2>Công việc phù hợp với hồ sơ</h2>
          <p>
            Phân tích hồ sơ theo tiêu chí năng lực và đề xuất các vị trí việc làm phù hợp nhất dành
            cho bạn.
          </p>
          <div className="top-jobs-local-note" role="note">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              Gợi ý được cá nhân hóa từ CV bạn chọn và các tiêu chí tìm việc của bạn.
            </span>
          </div>
        </header>

        {/* Filter & Control Bar */}
        <form
          id="job-search-form"
          className="top-jobs-console-card"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="top-jobs-control-grid">
            {/* Chọn CV */}
            <div className="control-group cv-select-group">
              <label htmlFor="job-search-cv-select">
                <span className="control-label-title">Chọn CV đối chiếu</span>
                <span className="control-label-hint">
                  Hệ thống phân tích dựa trên CV bạn chọn để tìm vị trí thích hợp
                </span>
              </label>

              {/* Custom Interactive CV Selector with Logical Categorization */}
              <div className="top-jobs-cv-dropdown" id="top-jobs-cv-dropdown">
                <button
                  type="button"
                  className="top-jobs-cv-trigger"
                  id="top-jobs-cv-trigger"
                  aria-haspopup="listbox"
                  aria-expanded="false"
                >
                  <div className="cv-trigger-content">
                    <span className="cv-status-badge is-none" id="top-jobs-selected-cv-badge">
                      Chưa chọn
                    </span>
                    <div className="cv-trigger-details">
                      <strong className="cv-trigger-title" id="top-jobs-selected-cv-title">
                        Chọn CV đã lưu...
                      </strong>
                      <small className="cv-trigger-meta" id="top-jobs-selected-cv-meta"></small>
                    </div>
                  </div>
                  <span className="cv-trigger-chevron" aria-hidden="true">
                    ▾
                  </span>
                </button>

                {/* Hidden native select for form & compatibility */}
                <select
                  id="job-search-cv-select"
                  className="visually-hidden-select"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <option value="">Chọn CV đã lưu...</option>
                </select>

                {/* Hidden file input for in-place CV upload */}
                <input
                  type="file"
                  id="find-jobs-cv-upload-input"
                  accept=".pdf,.docx"
                  className="visually-hidden-select"
                  hidden
                  aria-hidden="true"
                />

                {/* Custom Categorized Dropdown Menu */}
                <div className="top-jobs-cv-menu" id="top-jobs-cv-menu" role="listbox" hidden>
                  <div className="top-jobs-cv-menu-header">
                    <div className="menu-header-text">
                      <span className="menu-header-title">Danh sách CV của bạn</span>
                      <small className="menu-header-subtitle">
                        Chọn hồ sơ để hệ thống đối chiếu với yêu cầu công việc
                      </small>
                    </div>
                  </div>

                  {/* Quick Search inside Dropdown */}
                  <div className="top-jobs-cv-search-wrap">
                    <div className="top-jobs-cv-search-box">
                      <Search size={14} className="cv-search-icon" aria-hidden="true" />
                      <input
                        type="text"
                        id="top-jobs-cv-search-input"
                        className="top-jobs-cv-search-input"
                        placeholder="Tìm kiếm CV theo tên..."
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {/* Category Filter Tabs */}
                  <div className="top-jobs-cv-tabs-wrap">
                    <div
                      className="top-jobs-cv-tabs"
                      id="top-jobs-cv-tabs"
                      role="tablist"
                      aria-label="Phân loại CV"
                    >
                      <button
                        type="button"
                        className="cv-tab-btn is-active"
                        data-cv-tab="all"
                        role="tab"
                        aria-selected="true"
                      >
                        Tất cả{' '}
                        <span className="cv-tab-count" id="cv-tab-count-all">
                          0
                        </span>
                      </button>
                      <button
                        type="button"
                        className="cv-tab-btn"
                        data-cv-tab="raw"
                        role="tab"
                        aria-selected="false"
                      >
                        Bản gốc{' '}
                        <span className="cv-tab-count" id="cv-tab-count-raw">
                          0
                        </span>
                      </button>
                      <button
                        type="button"
                        className="cv-tab-btn"
                        data-cv-tab="optimized"
                        role="tab"
                        aria-selected="false"
                      >
                        Đã tối ưu{' '}
                        <span className="cv-tab-count" id="cv-tab-count-optimized">
                          0
                        </span>
                      </button>
                      <button
                        type="button"
                        className="cv-tab-btn"
                        data-cv-tab="matched"
                        role="tab"
                        aria-selected="false"
                      >
                        Đã đối chiếu{' '}
                        <span className="cv-tab-count" id="cv-tab-count-matched">
                          0
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Categorized CV List */}
                  <div className="top-jobs-cv-list" id="top-jobs-cv-list">
                    {/* Dynamic CV options populated by JS */}
                  </div>

                  {/* Menu Quick Action Footer */}
                  <div className="top-jobs-cv-menu-footer">
                    <span className="cv-menu-footer-hint">Hỗ trợ định dạng PDF, DOCX</span>
                    <button type="button" className="btn-menu-add-cv" id="btn-menu-add-cv">
                      <Plus size={14} /> Tải lên CV mới
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="control-group filter-dropdowns-group">
              <div className="filter-header-label-wrap">
                <span className="filter-group-title">Bộ lọc tùy chọn</span>
                <span className="filter-group-hint">
                  Không chọn gì → tự động xếp hạng toàn diện theo CV
                </span>
              </div>
              <div className="filter-items-row">
                <div className="filter-item">
                  <label htmlFor="job-filter-role" className="filter-item-label">
                    Vị trí mong muốn (Tùy chọn)
                  </label>
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
                  <label htmlFor="job-filter-location" className="filter-item-label">
                    Địa điểm (Tùy chọn)
                  </label>
                  <select
                    id="job-filter-location"
                    className="form-select filter-select"
                    defaultValue=""
                  >
                    <option value="">Tất cả địa điểm</option>
                  </select>
                </div>

                <div className="filter-item">
                  <label htmlFor="job-filter-work-mode" className="filter-item-label">
                    Hình thức làm việc (Tùy chọn)
                  </label>
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
                <span className="top-jobs-submit-status-pill">Bắt đầu với CV của bạn</span>
                <span>Chọn CV, thêm bộ lọc nếu cần, rồi xem các vị trí phù hợp.</span>
                <small className="top-jobs-submit-privacy">
                  <Database size={13} aria-hidden="true" /> CV chỉ cần tải lên một lần và có thể dùng lại ở những lần sau
                </small>
              </div>
              <button type="button" id="job-match-cv-btn" className="btn-find-top-jobs" disabled>
                <Search size={16} /> Tìm công việc phù hợp
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
          <div className="job-results-view-switch" role="tablist" aria-label="Chế độ xem việc làm">
            <button
              type="button"
              id="job-results-tab-recommended"
              className="job-results-view-tab is-active"
              role="tab"
              aria-selected="true"
            >
              Top 10 phù hợp
            </button>
            <button
              type="button"
              id="job-results-tab-catalog"
              className="job-results-view-tab"
              role="tab"
              aria-selected="false"
            >
              Khám phá tất cả
            </button>
            <span id="job-results-mode" className="results-mode-badge">
              Đề xuất phù hợp
            </span>
          </div>
        </div>

        {/* 1-Column Results List (No Grid) */}
        <div id="job-search-results" className="top-jobs-single-column-list" aria-live="polite">
          <article className="ai-activity-card is-compact top-jobs-initial-state" role="status">
            <header className="ai-activity-header">
              <div className="ai-activity-title-group">
                <div className="ai-activity-icon-orb" aria-hidden="true"><Search size={17} /></div>
                <div className="ai-activity-titles">
                  <h4 className="ai-activity-title">Sẵn sàng tìm việc theo CV</h4>
                  <p className="ai-activity-subtitle">Chọn CV rồi hệ thống sẽ hiển thị rõ từng bước xử lý và loại kết quả.</p>
                </div>
              </div>
              <span className="ai-activity-badge">Chờ chọn CV</span>
            </header>
            <div className="top-jobs-initial-legend">
              <span><i className="is-retrieval" />Gợi ý phù hợp: dựa trên hồ sơ của bạn</span>
              <span><i className="has-evidence" />Đã phân tích: có đánh giá mức độ phù hợp</span>
            </div>
          </article>
        </div>

        {/* Phân trang danh sách việc làm */}
        <nav id="job-pagination" className="job-pagination" aria-label="Phân trang danh sách việc làm" hidden />
      </div>
    </section>
  );
}
