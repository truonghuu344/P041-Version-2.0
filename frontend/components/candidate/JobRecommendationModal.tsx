'use client';

/* eslint-disable react/no-unescaped-entities */

import React from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Target,
  Building2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Bot,
  TrendingUp,
} from 'lucide-react';

export default function JobRecommendationModal({ isActive = false }: { isActive?: boolean }) {
  const handleOptimize = () => {
    if (typeof window !== 'undefined' && window.switchView) {
      window.switchView('cv');
    }
  };

  return (
    <section
      id="view-job-detail"
      className={`app-view student-job-detail-page${isActive ? ' active' : ''}`}
      aria-label="Chi tiết việc làm và đối chiếu CV"
    >
      <div className="student-job-detail-container">
        <article className="job-drawer-panel job-detail-page-panel" aria-labelledby="job-drawer-job-title">
          {/* 1. Header / Top Navigation & Hero Banner */}
          <header className="job-detail-hero-section">
            <div className="job-detail-nav-bar">
              <button
                type="button"
                id="job-detail-back-btn"
                className="job-detail-back-btn"
                aria-label="Quay lại danh sách việc làm"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span>Quay lại danh sách việc làm</span>
              </button>

              <div className="job-drawer-source-row" id="job-drawer-source-row" hidden>
                <a
                  id="job-drawer-source-link"
                  className="job-source-external-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Xem tin tuyển dụng gốc"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  <span>Xem tin tuyển dụng gốc</span>
                </a>
              </div>
            </div>

            <div className="job-detail-hero-card">
              <div className="job-detail-hero-main">
                <div className="job-company-avatar" id="job-drawer-company-avatar" aria-hidden="true">
                  <Building2 size={24} />
                </div>
                <div className="job-detail-hero-content">
                  <div className="job-drawer-badge-row">
                    <span className="job-modal-tag">
                      <Sparkles size={12} className="tag-icon" aria-hidden="true" />
                      Chi tiết tuyển dụng &amp; Đối chiếu AI
                    </span>
                  </div>
                  <h1 id="job-drawer-job-title" className="job-detail-main-title">
                    Chi tiết vị trí tuyển dụng
                  </h1>
                  <p id="job-drawer-job-company" className="job-detail-company-text">
                    Đang tải thông tin doanh nghiệp...
                  </p>
                  <div
                    id="job-drawer-meta-pills"
                    className="job-detail-meta-pills"
                    aria-label="Thông tin tổng quan về vị trí"
                  />
                </div>
              </div>
            </div>
          </header>

          {/* 2. Main Body: 2-Column Responsive Layout */}
          <div className="job-drawer-body job-detail-grid-layout">
            {/* Cột 1: Thông tin công việc (JD Specification) */}
            <div className="job-detail-column job-detail-main-col">
              {/* Lý do CV phù hợp */}
              <section className="job-detail-card" aria-labelledby="heading-job-req">
                <div className="job-detail-card-header">
                  <div className="card-header-icon bg-emerald-light">
                    <CheckCircle2 size={18} aria-hidden="true" />
                  </div>
                  <div className="card-header-titles">
                    <h2 id="heading-job-req" className="job-detail-card-heading">
                      Vì sao CV của bạn phù hợp
                    </h2>
                    <p className="job-detail-card-sub">Các điểm đối chiếu đã tìm thấy trong CV bạn</p>
                  </div>
                </div>
                <div className="job-detail-card-body">
                  <div className="job-drawer-evidence-list" id="job-drawer-fit-reasons">
                    {/* Nội dung được nạp động theo JD thực tế từ backend */}
                  </div>
                </div>
              </section>

              {/* Kỹ năng & Công nghệ */}
              <section className="job-detail-card" aria-labelledby="heading-job-skills">
                <div className="job-detail-card-header">
                  <div className="card-header-icon bg-teal-light">
                    <Layers size={18} aria-hidden="true" />
                  </div>
                  <div className="card-header-titles">
                    <h2 id="heading-job-skills" className="job-detail-card-heading">
                      Kỹ năng &amp; Công nghệ
                    </h2>
                    <p className="job-detail-card-sub">Các công nghệ và bộ kỹ năng trọng tâm của vị trí</p>
                  </div>
                </div>
                <div className="job-detail-card-body">
                  <div className="job-drawer-skills-wrap" id="job-drawer-skills-list">
                    {/* Danh sách kỹ năng được nạp động theo JD thực tế từ backend */}
                  </div>
                </div>
              </section>

              <section className="job-detail-card evidence-card" aria-labelledby="heading-gaps">
                <div className="job-detail-card-header mini-header">
                  <div className="card-header-icon bg-amber-light mini-icon">
                    <AlertTriangle size={16} aria-hidden="true" />
                  </div>
                  <h3 id="heading-gaps" className="job-detail-card-heading mini-heading">
                    Điểm cần bổ sung
                  </h3>
                </div>
                <div className="job-detail-card-body">
                  <div className="job-drawer-evidence-list" id="job-drawer-gaps-list" />
                </div>
              </section>
            </div>

            {/* Cột 2: Đánh giá độ phù hợp & AI Copilot */}
            <div className="job-detail-column job-detail-match-col">
              {/* CV Active Banner */}
              <div className="job-detail-cv-card" id="job-drawer-cv-banner">
                <div className="drawer-cv-banner-left">
                  <span className="cv-status-badge is-raw" id="job-drawer-cv-badge">
                    Bản gốc
                  </span>
                  <div className="drawer-cv-banner-text">
                    <span className="job-summary-eyebrow">Hồ sơ đối chiếu hiện tại</span>
                    <strong id="job-drawer-cv-name">Hồ sơ đối chiếu</strong>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-drawer-switch-cv"
                  id="btn-drawer-switch-cv"
                  aria-label="Đổi CV khác"
                >
                  Đổi CV
                </button>
              </div>

              {/* Match Score & AI Verdict */}
              <section className="job-match-summary-card" aria-label="Tóm tắt mức độ phù hợp">
                <div className="job-match-summary-header">
                  <div className="match-summary-icon">
                    <Bot size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <span className="job-summary-eyebrow">AI Match Analysis</span>
                    <h3 className="job-match-title">Mức độ phù hợp với hồ sơ</h3>
                  </div>
                </div>

                <div className="job-drawer-hero-card" id="job-drawer-hero-card">
                  <div className="job-drawer-score-badge">
                    <span id="job-drawer-score-pct" className="job-drawer-score-num">
                      —
                    </span>
                    <span id="job-drawer-score-label" className="job-drawer-score-label">
                      Đang phân tích...
                    </span>
                  </div>
                  <div className="job-drawer-confidence-badge" id="job-drawer-confidence-badge" style={{ display: 'none' }} />
                </div>

                <div className="job-drawer-verdict" id="job-drawer-verdict" role="status" />

                <div className="job-drawer-mandatory-alert" id="job-drawer-mandatory-alert" hidden>
                  <AlertTriangle size={18} className="icon-warn-svg" aria-hidden="true" />
                  <div className="mandatory-alert-content">
                    <strong>Cần bổ sung trước khi ứng tuyển</strong>
                    <p id="job-drawer-mandatory-detail" />
                  </div>
                </div>
              </section>

              {/* Tiêu chí chi tiết (Breakdown) */}
              <section className="job-detail-card match-breakdown-card" aria-labelledby="heading-breakdown">
                <div className="job-detail-card-header">
                  <div className="card-header-icon bg-indigo-light">
                    <Target size={18} aria-hidden="true" />
                  </div>
                  <div className="card-header-titles">
                    <h3 id="heading-breakdown" className="job-detail-card-heading">
                      Chi tiết tiêu chí đánh giá
                    </h3>
                    <p className="job-detail-card-sub">Đối chiếu theo từng nhóm yêu cầu của vị trí</p>
                  </div>
                </div>
                <div className="job-detail-card-body">
                  <div className="job-drawer-breakdown-list" id="job-drawer-breakdown-list">
                    {/* Các tiêu chí được nạp động 100% từ kết quả đối chiếu JD */}
                  </div>
                </div>
              </section>

              {/* Lộ trình hành động tiếp theo */}
              <section className="job-detail-card action-plan-card" aria-labelledby="heading-actions">
                <div className="job-detail-card-header mini-header">
                  <div className="card-header-icon bg-purple-light mini-icon">
                    <TrendingUp size={16} aria-hidden="true" />
                  </div>
                  <h3 id="heading-actions" className="job-detail-card-heading mini-heading">
                    Lộ trình chuẩn bị ứng tuyển
                  </h3>
                </div>
                <div className="job-detail-card-body">
                  <div className="job-drawer-evidence-list" id="job-drawer-actions-list" />
                </div>
              </section>
            </div>
          </div>

          {/* 3. Action Bar / Sticky Footer */}
          <footer className="job-detail-sticky-footer">
            <div className="job-drawer-footer-actions">
              <button
                type="button"
                className="btn-drawer-action btn-optimize-cv"
                id="btn-drawer-optimize-cv"
                onClick={handleOptimize}
              >
                <Sparkles size={16} aria-hidden="true" />
                <span>Tối ưu CV theo JD</span>
              </button>

              <button
                type="button"
                className="btn-drawer-action btn-interview"
                id="btn-drawer-interview"
              >
                <Bot size={16} aria-hidden="true" />
                <span>Luyện phỏng vấn AI</span>
              </button>

              <button
                type="button"
                className="btn-drawer-action btn-apply-job"
                id="btn-drawer-apply-job"
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Ứng tuyển bằng CV này</span>
              </button>

              <button
                type="button"
                className="btn-drawer-action btn-track-app"
                id="btn-drawer-track-application"
                hidden
              >
                <span>Xem trạng thái ứng tuyển</span>
              </button>
            </div>
          </footer>
        </article>
      </div>
    </section>
  );
}
