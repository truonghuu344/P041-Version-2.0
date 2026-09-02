/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Briefcase,
  Check,
  ChevronDown,
  CloudUpload,
  FileText,
  Pencil,
  Search,
  Target,
  Upload,
  X,
} from 'lucide-react';
import AppToast, { AppToastMessage } from '@/components/shared/AppToast';

export default function MatchView() {
  const [toast, setToast] = React.useState<AppToastMessage | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);


  React.useEffect(() => {
    const syncGates = () => {
      (window as any).updateLoginGates?.();
      (window as any).updateP1UI?.();
    };

    syncGates();
    document.addEventListener('auth:changed', syncGates);

    return () => {
      document.removeEventListener('auth:changed', syncGates);
    };
  }, []);

  return (
    <section className="app-view buddy-landing" id="view-match">
      <div className="match-workspace">
        <header className="match-hero">
          <h2 data-i18n-text="match-title">
            Match CV <span>với công việc</span>
          </h2>
          <span data-i18n-text="match-description">
            Chọn CV và công việc. Bạn sẽ thấy phân tích mức độ phù hợp, điểm mạnh và những kỹ năng
            cần bổ sung để ứng tuyển hiệu quả hơn.
          </span>
        </header>

        <div className="match-workflow">
          <div className="match-source-grid">
            <section className="match-source" id="p1-cv-card">
              <div className="match-source-head" id="p1-step-1">
                <h3 data-i18n-text="match-cv-source">Chọn CV</h3>
              </div>

              <div className="p1-ready-banner" id="p1-cv-ready-banner">
                <div className="match-selection-card" id="p1-cv-readiness-item">
                  <span className="match-selection-card-icon" aria-hidden="true">
                    <FileText size={18} />
                  </span>
                  <div className="match-selection-card-body">
                    <strong id="p1-cv-ready-name" />
                    <span id="p1-cv-ready-meta" />
                  </div>
                  <span className="match-selection-card-check" aria-hidden="true">
                    <Check size={14} />
                  </span>
                </div>
                <button id="p1-cv-change-btn" type="button" className="match-change-btn">
                  <Pencil size={14} aria-hidden="true" />
                  Đổi CV
                </button>
              </div>

              <div id="p1-cv-input-area">
                <div id="p1-cv-login-gate" className="p1-login-gate is-hidden" hidden style={{ display: 'none' }}>
                  <span>Đăng nhập để dùng CV đã lưu.</span>
                  <button id="p1-cv-login-btn" type="button" className="p1-login-btn">
                    Đăng nhập
                  </button>
                </div>
                <div id="p1-cv-select-section">
                  <label htmlFor="cv-analysis-cv-select" style={{ display: 'none' }}>
                    CV đã lưu
                  </label>
                  <select id="cv-analysis-cv-select" style={{ display: 'none' }}>
                    <option value="">Chọn CV đã lưu...</option>
                  </select>
                  <div id="p1-cv-cards-grid" className="cv-cards-grid" />
                </div>
                <div className="match-source-divider">hoặc</div>
                <form id="cv-page-upload-form">
                  <input id="cv-page-title-input" hidden />
                  <label className="match-upload" id="cv-dropzone">
                    <CloudUpload size={27} />
                    <strong>Upload CV tạm thời</strong>
                    <span>PDF hoặc DOCX · tối đa 10 MB</span>
                    <input id="cv-page-file-input" type="file" accept=".pdf,.docx" hidden />
                  </label>
                  <span id="selected-file-name" />
                  <button id="btn-page-do-upload" type="submit" hidden>
                    Upload
                  </button>
                </form>
              </div>
            </section>

            <section className="match-source" id="p1-jd-card">
              <div className="match-source-head" id="p1-step-2">
                <h3 data-i18n-text="match-jd-source">Chọn công việc</h3>
              </div>

              <div className="p1-ready-banner" id="p1-jd-ready-banner">
                <div className="match-selection-card" id="p1-jd-readiness-item">
                  <span className="match-selection-card-icon" aria-hidden="true">
                    <Briefcase size={18} />
                  </span>
                  <div className="match-selection-card-body">
                    <strong id="p1-jd-ready-name" />
                    <span id="p1-jd-ready-company" />
                    <span id="p1-jd-ready-meta" />
                  </div>
                </div>
                <button id="p1-jd-change-btn" type="button" className="match-change-btn">
                  <Pencil size={14} aria-hidden="true" />
                  Đổi việc
                </button>
              </div>

              <div id="p1-jd-input-area">
                <label htmlFor="cv-analysis-jd-select" style={{ display: 'none' }}>
                  Job Description đã chọn
                </label>
                <select id="cv-analysis-jd-select" style={{ display: 'none' }} defaultValue="">
                  <option value="">Chọn Job Description...</option>
                </select>
                <div className="match-tabs" role="tablist">
                  <button
                    id="p1-job-explore-tab"
                    type="button"
                    role="tab"
                    aria-selected="true"
                    className="is-selected"
                    data-i18n-text="match-tab-catalog"
                  >
                    <Briefcase size={15} aria-hidden="true" />
                    Việc làm có sẵn
                  </button>
                  <button
                    id="p1-job-upload-tab"
                    type="button"
                    role="tab"
                    aria-selected="false"
                    data-i18n-text="match-tab-upload"
                  >
                    <Upload size={15} aria-hidden="true" />
                    Tải JD lên
                  </button>
                </div>

                <div id="p1-job-explore-panel">
                  <div className="match-job-toolbar">
                    <label className="match-job-search" htmlFor="p1-job-search">
                      <Search size={17} aria-hidden="true" />
                      <input
                        id="p1-job-search"
                        type="search"
                        placeholder="Tìm theo chức danh, công ty hoặc kỹ năng..."
                      />
                    </label>
                    <div id="p1-job-filters" className="match-filters">
                      <button type="button" data-job-filter="" className="is-selected">
                        Tất cả
                      </button>
                      <button type="button" data-job-filter="Backend">
                        Backend
                      </button>
                      <button type="button" data-job-filter="Frontend">
                        Frontend
                      </button>
                      <button type="button" data-job-filter="Data">
                        Data
                      </button>
                      <button type="button" data-job-filter="DevOps">
                        DevOps
                      </button>
                      <button type="button" data-job-filter="AI">
                        AI/ML
                      </button>
                    </div>
                    <label className="match-job-location" htmlFor="p1-job-location-filter">
                      <select id="p1-job-location-filter" defaultValue="">
                        <option value="">Tất cả địa điểm</option>
                      </select>
                      <ChevronDown size={15} aria-hidden="true" />
                    </label>
                  </div>

                  <div id="p1-job-grid" className="p1-job-grid" />
                  <div id="p1-job-empty" hidden>
                    Chưa có công việc phù hợp.{' '}
                    <button id="p1-job-empty-upload" type="button">
                      Tải JD riêng
                    </button>
                  </div>
                </div>

                <div id="p1-job-upload-panel" hidden>
                  <div id="p1-jd-login-gate" className="p1-login-gate is-hidden" hidden style={{ display: 'none' }}>
                    <span>Đăng nhập để lưu JD riêng.</span>
                    <button id="p1-jd-login-btn" type="button" className="p1-login-btn">
                      Đăng nhập
                    </button>
                  </div>
                  <form id="cv-jd-upload-form" className="cv-jd-upload-form">
                    <input
                      id="cv-jd-title-input"
                      className="cv-jd-title-input"
                      name="title"
                      type="text"
                      maxLength={200}
                      placeholder="Tên vị trí (không bắt buộc)"
                    />
                    <label className="match-upload cv-jd-upload-dropzone" id="cv-jd-dropzone">
                      <Upload size={25} />
                      <strong>Upload Job Description</strong>
                      <span id="cv-jd-file-name">PDF, DOCX, TXT hoặc ảnh</span>
                      <input
                        id="cv-jd-file-input"
                        type="file"
                        accept=".pdf,.docx,.txt,image/*"
                        hidden
                      />
                    </label>
                    <button type="submit" id="btn-submit-jd" className="cv-jd-submit-btn">
                      Dùng JD này để phân tích
                    </button>
                  </form>
                </div>
              </div>
            </section>
          </div>

          <section className="match-ready" id="p1-cta-area">
            <div className="match-ready-head" id="p1-step-3">
              <strong data-i18n-text="match-ready">Phân tích</strong>
            </div>
            <button id="p1-analyze-btn" type="button">
              <Target size={17} aria-hidden="true" />
              <span data-i18n-text="match-analyze">Phân tích Match</span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <span id="p1-cta-hint">Xem mức độ phù hợp, điểm mạnh và kỹ năng cần bổ sung</span>
          </section>
        </div>

        <section
          className="match-cv-browser"
          id="p1-cv-browser"
          aria-labelledby="match-cv-browser-title"
        >
          <header>
            <h3 id="match-cv-browser-title">Chọn CV</h3>
            <p>Chọn một CV đã lưu hoặc tải lên CV tạm thời.</p>
          </header>
          <div id="p1-cv-browser-content" />
        </section>

        <section
          className="match-job-browser"
          id="p1-job-browser"
          aria-labelledby="match-job-browser-title"
        >
          <header>
            <h3 id="match-job-browser-title">Chọn công việc</h3>
            <p>Chọn một công việc có sẵn hoặc tải lên JD riêng.</p>
          </header>
          <div id="p1-job-browser-content" />
        </section>
      </div>

      <div id="cv-analysis-results-card" className="cv-analysis-results-card" style={{ display: 'none' }}>
        <div id="cv-analysis-result-content" />
      </div>

      {mounted && createPortal(
        <div id="gap-result-overlay" className="gap-result-overlay" role="presentation" hidden>
        <div className="gap-result-dialog" role="dialog" aria-modal="true" aria-labelledby="gap-modal-title">
          {/* Sticky Header */}
          <header className="gap-result-header">
            <div className="gap-result-header-info">
              <div className="gap-result-context-block">
                <span id="cv-result-cv-name" className="gap-result-cv-name">CV</span>
              </div>
              <h2 id="gap-modal-title" className="sr-only">Kết quả đối chiếu CV và JD</h2>
            </div>
            <div className="gap-result-header-actions">
              <button type="button" id="gap-result-modal-close" className="gap-result-close-btn" aria-label="Đóng">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          </header>

          {/* Scrollable Content Body */}
          <div className="gap-result-body">
            {/* Decision-Focused Summary */}
            <section className="match-ux-hero" aria-label="Đánh giá độ phù hợp">
              <div className="match-ux-score-block">
                <span id="cv-result-match-score" className="match-ux-score-value">0%</span>
                <span id="gap-header-rating-badge" className="match-ux-rating-badge">Phù hợp thấp</span>
                <button type="button" id="btn-how-match-works" className="match-ux-how-btn">Điểm Match được tính như thế nào?</button>
              </div>
              <div className="match-ux-summary-block">
                <div id="cv-result-counts-row" className="match-ux-status-counters">
                  <div className="match-ux-status-item is-matched">
                    <strong id="pill-count-matched">0</strong> <span>Đáp ứng</span>
                  </div>
                  <div className="match-ux-status-item is-partial">
                    <strong id="pill-count-partial">0</strong> <span>Một phần</span>
                  </div>
                  <div className="match-ux-status-item is-missing">
                    <strong id="pill-count-missing">0</strong> <span>Chưa đáp ứng</span>
                  </div>
                  <div className="match-ux-status-item is-uncertain" id="pill-count-uncertain-wrapper" hidden>
                    <strong id="pill-count-uncertain">0</strong> <span>Chưa đủ bằng chứng</span>
                  </div>
                </div>

                <p id="cv-result-summary" className="match-ux-summary-text">CV hiện còn thiếu một số yêu cầu quan trọng của vị trí.</p>
              </div>
            </section>

            {/* Category Score Explanation (TẠI SAO LÀ X%?) */}
            <section id="cv-result-category-explanation-section" className="match-ux-explain-section" aria-label="Giải trình điểm theo danh mục">
              <h3 id="cv-result-category-explanation-title" className="match-ux-section-title">Tại sao là 0%?</h3>
              <div id="cv-result-category-explanation-grid" className="match-ux-category-grid"></div>
            </section>

            {/* Strengths & Blockers Section */}
            <div className="match-ux-highlights-row">
              <section id="cv-result-strengths-section" className="match-ux-highlight-card is-strength" aria-label="Vì sao bạn phù hợp">
                <h4 id="cv-result-strengths-title">Vì sao bạn phù hợp?</h4>
                <ul id="cv-result-strengths-list"></ul>
              </section>
              <section id="cv-result-weaknesses-section" className="match-ux-highlight-card is-weakness" aria-label="Rào cản chính">
                <h4 id="cv-result-weaknesses-title">Rào cản chính</h4>
                <ul id="cv-result-weaknesses-list"></ul>
              </section>
            </div>

            {/* Help modal on how Match works */}
            <div id="match-how-it-works-modal" className="match-ux-help-popover" hidden>
              <div className="match-ux-help-content">
                <h4>Điểm Match được tính như thế nào?</h4>
                <p>Điểm Match được tính toán dựa trên mức độ đáp ứng các yêu cầu trong JD qua bằng chứng từ kinh nghiệm, dự án và kỹ năng trong CV của bạn. Các yêu cầu bắt buộc và kinh nghiệm cốt lõi có mức ảnh hưởng cao hơn các yêu cầu ưu tiên.</p>
                <button type="button" id="btn-close-how-match-works" className="match-ux-help-close-btn">Đã hiểu</button>
              </div>
            </div>

            {/* Background Fit (30-second view) */}
            <div id="cv-result-background-fit-section" className="match-ux-background-grid" hidden>
              <h4>Thông tin nền tảng</h4>
              <div className="match-ux-background-items" id="cv-result-background-items"></div>
            </div>

            {/* Eligibility Hard Constraints (if any) */}
            <div id="cv-result-eligibility-section" hidden />

            {/* Important Requirements First */}
            <div id="cv-result-important-reqs-section" className="match-ux-important-reqs">
              <h3 className="match-ux-section-title">Yêu cầu quan trọng của vị trí</h3>
              <div id="cv-result-important-reqs-list" className="match-ux-reqs-list"></div>
              <button type="button" id="btn-show-all-reqs" className="match-ux-expand-all-btn">Xem toàn bộ 0 yêu cầu</button>
            </div>

            {/* Full Requirement Groups Container (Hidden initially) */}
            <div id="cv-result-groups-container" className="match-groups-container match-ux-reqs-list" hidden>
              <div className="match-ux-major-section">
                <h3 className="match-ux-major-title">A. Bạn đáp ứng yêu cầu ứng viên thế nào?</h3>
                <div id="cv-result-qualifications-section"></div>
              </div>
              <div className="match-ux-major-section">
                <h3 className="match-ux-major-title">B. Bạn phù hợp với công việc phải làm thế nào?</h3>
                <div id="cv-result-responsibilities-section"></div>
              </div>
            </div>
          </div>

          {/* Sticky Action Footer */}
          <footer className="gap-result-footer">
            <button type="button" id="btn-practice-interview" className="gap-result-action gap-result-action--secondary">
              <span>Luyện phỏng vấn</span>
            </button>
            <button type="button" id="btn-browse-matching-jobs" className="gap-result-action gap-result-action--secondary">
              <span>Xem việc làm phù hợp</span>
            </button>
            <button type="button" id="btn-gap-find-jobs" className="gap-result-action gap-result-action--secondary" style={{ display: 'none' }}>
              <span>Quay lại việc làm</span>
            </button>
            <button type="button" id="btn-optimize-cv-ai" className="gap-result-action gap-result-action--primary">
              <span>Tối ưu CV theo JD</span>
            </button>
          </footer>
        </div>
      </div>,
        document.body
      )}

      {toast && (
        <AppToast
          toast={toast}
          onClose={() => setToast(null)}
        />
      )}
    </section>
  );
}
