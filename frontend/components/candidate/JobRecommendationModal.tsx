'use client';

import React from 'react';
import { X } from 'lucide-react';

export default function JobRecommendationModal() {
  return (
    <div
      id="job-recommendation-drawer"
      className="job-recommendation-drawer job-modal-overlay"
      aria-hidden="true"
    >
      <div className="job-drawer-backdrop" id="job-drawer-backdrop" />
      <aside
        className="job-drawer-panel job-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-drawer-job-title"
      >
        {/* 1. Modal Header */}
        <div className="job-drawer-header">
          <div className="job-drawer-header-left">
            <div className="job-drawer-badge-row">
              <span className="job-modal-tag">Chi tiết tuyển dụng &amp; Đối chiếu</span>
            </div>
            <h3 id="job-drawer-job-title" className="job-drawer-title">
              Backend Engineer
            </h3>
            <p id="job-drawer-job-company" className="job-drawer-company">
              ABC Company · Hồ Chí Minh · Hybrid
            </p>
          </div>
          <button
            type="button"
            className="job-drawer-close"
            id="job-drawer-close-btn"
            aria-label="Đóng chi tiết"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2. Modal Body */}
        <div className="job-drawer-body">
          {/* Top Highlight Strip: Active CV + Fit Score Hero */}
          <div className="job-drawer-top-banner">
            <div className="job-drawer-cv-banner" id="job-drawer-cv-banner">
              <div className="drawer-cv-banner-left">
                <span className="cv-status-badge is-raw" id="job-drawer-cv-badge">
                  Bản gốc
                </span>
                <div className="drawer-cv-banner-text">
                  <strong id="job-drawer-cv-name">Hồ sơ đối chiếu</strong>
                  <small>Bản CV đang dùng để đánh giá mức độ phù hợp</small>
                </div>
              </div>
              <button type="button" className="btn-drawer-switch-cv" id="btn-drawer-switch-cv">
                Đổi CV
              </button>
            </div>

            <div className="job-drawer-hero-card" id="job-drawer-hero-card">
              <div className="job-drawer-score-badge">
                <span id="job-drawer-score-pct" className="job-drawer-score-num">
                  84%
                </span>
                <span id="job-drawer-score-label" className="job-drawer-score-label">
                  Độ phù hợp hồ sơ
                </span>
              </div>
              <div className="job-drawer-confidence-badge is-high" id="job-drawer-confidence-badge">
                Độ tin cậy: <strong>Cao</strong>
              </div>
            </div>
          </div>

          {/* Mandatory Warning Alert (shown conditionally) */}
          <div className="job-drawer-mandatory-alert" id="job-drawer-mandatory-alert" hidden>
            <span className="icon-warn" aria-hidden="true">
              ⚠
            </span>
            <div className="mandatory-alert-content">
              <strong>Thiếu yêu cầu bắt buộc</strong>
              <p id="job-drawer-mandatory-detail">
                Hồ sơ chưa đáp ứng đủ tiêu chí bắt buộc của vị trí này. Điểm hiển thị được giới hạn
                tối đa 49%.
              </p>
            </div>
          </div>

          {/* 2-Column Content Layout: Left = Job Spec, Right = Match Evaluation */}
          <div className="job-drawer-grid">
            {/* Column 1: JD Chi tiết công việc */}
            <div className="job-drawer-col">
              <section className="job-drawer-section">
                <h4 className="job-drawer-section-heading">Mô tả công việc &amp; Trách nhiệm</h4>
                <div className="job-drawer-desc-content" id="job-drawer-description">
                  <ul className="job-drawer-list">
                    <li>
                      Thiết kế, xây dựng và tối ưu các RESTful API và microservices backend đáp ứng
                      tải cao.
                    </li>
                    <li>
                      Phối hợp với frontend team và product team để triển khai các tính năng mới cho
                      nền tảng.
                    </li>
                    <li>
                      Tối ưu hóa truy vấn cơ sở dữ liệu PostgreSQL và quản lý dữ liệu hiệu năng cao.
                    </li>
                  </ul>
                </div>
              </section>

              <section className="job-drawer-section">
                <h4 className="job-drawer-section-heading">Yêu cầu ứng viên</h4>
                <div className="job-drawer-req-content" id="job-drawer-requirements">
                  <ul className="job-drawer-list">
                    <li>
                      Tối thiểu 2+ năm kinh nghiệm phát triển backend với Python / FastAPI hoặc
                      Node.js.
                    </li>
                    <li>
                      Thành thạo cơ sở dữ liệu quan hệ (PostgreSQL / MySQL) và thiết kế schema hiệu
                      quả.
                    </li>
                    <li>
                      Hiểu biết về kiến trúc hệ thống, Docker, CI/CD và tối ưu hóa hiệu năng ứng
                      dụng.
                    </li>
                  </ul>
                </div>
              </section>

              <section className="job-drawer-section">
                <h4 className="job-drawer-section-heading">Kỹ năng &amp; Công nghệ</h4>
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
                <h4 className="job-drawer-section-heading">Đánh giá 5 tiêu chí năng lực</h4>
                <div className="job-drawer-breakdown-list">
                  <div className="job-drawer-breakdown-row">
                    <span className="criteria-label">Kỹ năng bắt buộc</span>
                    <span className="criteria-bar-wrap">
                      <span className="criteria-bar">
                        <span className="criteria-bar-fill" style={{ width: '89%' }}></span>
                      </span>
                    </span>
                    <span className="criteria-score" id="job-drawer-must-have">
                      31/35
                    </span>
                  </div>
                  <div className="job-drawer-breakdown-row">
                    <span className="criteria-label">Kinh nghiệm</span>
                    <span className="criteria-bar-wrap">
                      <span className="criteria-bar">
                        <span className="criteria-bar-fill" style={{ width: '83%' }}></span>
                      </span>
                    </span>
                    <span className="criteria-score" id="job-drawer-experience">
                      25/30
                    </span>
                  </div>
                  <div className="job-drawer-breakdown-row">
                    <span className="criteria-label">Học vấn</span>
                    <span className="criteria-bar-wrap">
                      <span className="criteria-bar">
                        <span className="criteria-bar-fill" style={{ width: '80%' }}></span>
                      </span>
                    </span>
                    <span className="criteria-score" id="job-drawer-education">
                      8/10
                    </span>
                  </div>
                  <div className="job-drawer-breakdown-row">
                    <span className="criteria-label">Kỹ năng ưu tiên</span>
                    <span className="criteria-bar-wrap">
                      <span className="criteria-bar">
                        <span className="criteria-bar-fill" style={{ width: '80%' }}></span>
                      </span>
                    </span>
                    <span className="criteria-score" id="job-drawer-nice-to-have">
                      8/10
                    </span>
                  </div>
                  <div className="job-drawer-breakdown-row">
                    <span className="criteria-label">Domain / Ngành</span>
                    <span className="criteria-bar-wrap">
                      <span className="criteria-bar">
                        <span className="criteria-bar-fill" style={{ width: '80%' }}></span>
                      </span>
                    </span>
                    <span className="criteria-score" id="job-drawer-domain">
                      12/15
                    </span>
                  </div>
                </div>
              </section>

              <section className="job-drawer-section">
                <h4 className="job-drawer-section-heading">Điểm mạnh phù hợp</h4>
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
                <h4 className="job-drawer-section-heading">Yêu cầu cần bổ sung</h4>
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
            <button
              type="button"
              className="btn-drawer-action btn-modal-close"
              id="job-drawer-cancel-btn"
            >
              Đóng
            </button>
            <button
              type="button"
              className="btn-drawer-action btn-full-match"
              id="btn-drawer-full-match"
            >
              So khớp chi tiết với CV này
            </button>
            <button
              type="button"
              className="btn-drawer-action btn-mock-interview"
              id="btn-drawer-mock-interview"
            >
              Luyện phỏng vấn vị trí này
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
