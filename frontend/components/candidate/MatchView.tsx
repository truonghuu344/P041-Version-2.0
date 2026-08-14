/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import {
  ArrowRight,
  Briefcase,
  Check,
  ChevronDown,
  CloudUpload,
  FileText,
  Pencil,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';

export default function MatchView() {
  return (
    <section className="app-view buddy-landing" id="view-match">
      <div className="match-workspace">
        <header className="match-hero">
          <h2 data-i18n-text="match-title">
            Match CV <span>với công việc</span>
          </h2>
          <span data-i18n-text="match-description">
            Chọn CV và công việc. Bạn sẽ thấy phân tích mức độ phù hợp, điểm mạnh và những kỹ năng cần bổ sung để ứng tuyển hiệu quả hơn.
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
                <div id="p1-cv-login-gate" className="p1-login-gate" style={{ display: 'none' }}>
                  <span>Đăng nhập để dùng CV đã lưu.</span>
                  <button id="p1-cv-login-btn" type="button">Đăng nhập</button>
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

                  <div className="match-job-grid-footer">
                    <p id="p1-job-count" />
                    <nav
                      id="p1-job-pagination"
                      className="p1-job-pagination"
                      aria-label="Phân trang công việc"
                    />
                    <label className="match-job-per-page" htmlFor="p1-job-per-page">
                      Hiển thị
                      <select id="p1-job-per-page" defaultValue="8">
                        <option value="8">8</option>
                      </select>
                      / trang
                    </label>
                  </div>
                </div>

                <div id="p1-job-upload-panel" hidden>
                  <div id="p1-jd-login-gate" className="p1-login-gate" style={{ display: 'none' }}>
                    <span>Đăng nhập để lưu JD riêng.</span>
                    <button id="p1-jd-login-btn" type="button">Đăng nhập</button>
                  </div>
                  <div id="p1-jd-select-section" hidden>
                    <select id="cv-analysis-jd-select">
                      <option value="">Chọn JD đã lưu</option>
                    </select>
                  </div>
                  <form id="cv-jd-upload-form">
                    <input id="cv-jd-title-input" placeholder="Tên vị trí (tuỳ chọn)" />
                    <input id="p1-jd-title-field" hidden />
                    <label className="match-upload" id="cv-jd-dropzone">
                      <Upload size={25} />
                      <strong>Upload Job Description</strong>
                      <span id="cv-jd-file-name">PDF, DOCX, TXT hoặc ảnh</span>
                      <input id="cv-jd-file-input" type="file" accept=".pdf,.docx,.txt,image/*" hidden />
                    </label>
                    <button type="submit">Dùng JD này để phân tích</button>
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
              <Sparkles size={17} aria-hidden="true" />
              <span data-i18n-text="match-analyze">Phân tích Match</span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <span id="p1-cta-hint">Xem mức độ phù hợp, điểm mạnh và kỹ năng cần bổ sung</span>
          </section>
        </div>

        <section className="match-cv-browser" id="p1-cv-browser" aria-labelledby="match-cv-browser-title">
          <header>
            <h3 id="match-cv-browser-title">Chọn CV</h3>
            <p>Chọn một CV đã lưu hoặc tải lên CV tạm thời.</p>
          </header>
          <div id="p1-cv-browser-content" />
        </section>

        <section className="match-job-browser" id="p1-job-browser" aria-labelledby="match-job-browser-title">
          <header>
            <h3 id="match-job-browser-title">Chọn công việc</h3>
          </header>
          <div id="p1-job-browser-content" />
        </section>

        <section id="p1-analysis-journey" className="p1-analysis-journey" hidden aria-live="polite">
          <h3 id="p1-analysis-title">AI đang đối chiếu CV và công việc</h3>
          <p id="p1-analysis-supporting">Kết quả dựa trên bằng chứng trong CV, không chỉ từ khóa.</p>
          <p id="p1-analysis-cv-label" />
          <p id="p1-analysis-jd-label" />
          <p id="p1-analysis-insight-title" />
          <p id="p1-analysis-insight-body" />
          <p id="p1-analysis-error" hidden>
            Không thể hoàn tất phân tích. <button id="p1-analysis-retry">Thử lại</button>
          </p>
        </section>

        <section id="cv-analysis-results-card" className="match-summary" hidden>
          <div id="cv-analysis-empty-state" />
          <div id="cv-analysis-result-content" hidden>
            <header className="match-result-overview">
              <div className="cv-result-score-ring">
                <strong id="cv-result-match-score">—</strong>
                <span>Match score</span>
              </div>
              <div className="cv-result-summary-block">
                <p id="cv-result-context" />
                <h3>Kết quả đánh giá</h3>
                <p id="cv-result-summary" />
                <div id="cv-result-confidence-summary" className="cv-result-confidence-summary" />
              </div>
            </header>
            <div className="cv-result-skills-grid">
              <section className="cv-result-panel is-positive">
                <h4>✓ Điểm phù hợp nổi bật</h4>
                <div id="cv-result-matching-skills" className="cv-result-tags" />
              </section>
              <section className="cv-result-panel is-attention">
                <h4>! Cần làm rõ hoặc bổ sung</h4>
                <div id="cv-result-missing-skills" className="cv-result-tags" />
                <div id="cv-result-partial-skills" className="cv-result-tags" />
              </section>
            </div>
            <section className="cv-result-priority-panel">
              <div>
                <h4>Ưu tiên cải thiện</h4>
                <p>Chỉ dựa trên yêu cầu JD và evidence trong CV của bạn.</p>
              </div>
              <div id="cv-result-priority-actions" className="cv-result-action-list" />
            </section>
            <section className="cv-result-detail-panel">
              <h4>Điểm theo tiêu chí</h4>
              <div id="cv-result-score-breakdown" className="cv-result-score-breakdown" />
              <div id="cv-result-criteria" className="cv-result-criteria-list" />
            </section>
            <div id="cv-result-warnings" className="cv-result-warnings" />
            <div className="match-result-actions">
              <button id="btn-open-full-gap-result" type="button">
                Xem Gap Analysis chi tiết <ArrowRight size={15} />
              </button>
              <button id="btn-compare-multi-position" type="button">
                Match với Job khác
              </button>
              <button id="btn-start-interview-from-analysis" type="button">
                Luyện phỏng vấn voice
              </button>
            </div>
            <div id="cv-result-requirement-evidence" hidden />
            <div id="cv-result-soft-skills" hidden />
            <div id="cv-result-learning-actions" hidden />
            <div id="cv-result-section-recommendations" hidden />
            <div id="cv-result-certifications" hidden />
            <div id="cv-result-projects" hidden />
            <div id="cv-result-suggestions-preview" hidden />
            <div id="cv-result-guardrail-status" hidden />
          </div>
        </section>

        <div id="cv-preview-modal" className="cv-modal-overlay" style={{ display: 'none' }}>
          <div className="cv-modal-card">
            <button type="button" className="cv-modal-close" id="cv-modal-close-btn">
              &times;
            </button>
            <div className="cv-modal-header">
              <h3 id="cv-modal-title">Chi tiết CV</h3>
            </div>
            <div className="cv-modal-body" id="cv-modal-content" />
            <div className="cv-modal-footer">
              <button type="button" className="cv-modal-cancel" id="cv-modal-cancel-btn">
                Hủy
              </button>
              <button type="button" className="cv-modal-select" id="cv-modal-select-btn">
                Chọn CV này
              </button>
            </div>
          </div>
        </div>

        <div id="job-preview-modal" className="cv-modal-overlay" style={{ display: 'none' }}>
          <div className="cv-modal-card" style={{ maxWidth: '600px' }}>
            <button type="button" className="cv-modal-close" id="job-modal-close-btn">
              &times;
            </button>
            <div className="cv-modal-header">
              <h3 id="job-modal-title">Chi tiết Job</h3>
            </div>
            <div
              className="cv-modal-body"
              id="job-modal-content"
              style={{ maxHeight: '400px', overflowY: 'auto' }}
            />
            <div className="cv-modal-footer">
              <button type="button" className="cv-modal-cancel" id="job-modal-cancel-btn">
                Hủy
              </button>
              <button type="button" className="cv-modal-select" id="job-modal-select-btn">
                Chọn Job này
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
