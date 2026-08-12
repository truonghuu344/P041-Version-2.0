/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Briefcase, Check, CloudUpload, FileText, Mic, Moon, PencilLine, Search, Sparkles, Sun, Target, Terminal, Upload, X
} from 'lucide-react';

export default function GapView(props: any) {
  return (
    <>
        <section className="app-view" id="view-gap">
          <div className="page-container">
            <div className="page-header">
              <div className="page-badge badge-pink">DECK DELTA // NAVIGATION DECK</div>
              <h1 className="page-title ux-page-title"><Target aria-hidden="true" /> Phân tích độ phù hợp và kỹ năng cần bổ sung</h1>
              <p className="page-sub">So khớp CV với JD mục tiêu &amp; đề xuất tối ưu câu từ Chân Thật (Anti-Hallucination)</p>
            </div>

            <div className="trajectory-roadmap-card">
              <div className="roadmap-header">
                <span className="pulse-dot cyan"></span>
                <h3 className="roadmap-title">QUỸ ĐẠO BỔ SUNG KỸ NĂNG MỤC TIÊU (CAREER MILESTONE ROADMAP)</h3>
              </div>
              <div className="trajectory-steps">
                <div className="t-step step-done">
                  <div className="step-num">01</div>
                  <div className="step-content">
                    <span className="step-label">Nền Tảng Đã Có</span>
                    <span className="step-title">Python &amp; Web Dev Fundamentals</span>
                  </div>
                </div>
                <div className="t-step step-current">
                  <div className="step-num">02</div>
                  <div className="step-content">
                    <span className="step-label">Kỹ Năng Đang Bổ Sung</span>
                    <span className="step-title">FastAPI Backend &amp; Docker Deployment</span>
                  </div>
                </div>
                <div className="t-step step-next">
                  <div className="step-num">03</div>
                  <div className="step-content">
                    <span className="step-label">Milestone Tiếp Theo</span>
                    <span className="step-title">LangGraph Agent &amp; System Architecture</span>
                  </div>
                </div>
                <div className="t-step step-target">
                  <div className="step-num">04</div>
                  <div className="step-content">
                    <span className="step-label">Đích Đến Mục Tiêu</span>
                    <span className="step-title">Senior AI &amp; Fullstack Specialist</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="gap-workspace">
              <div className="gap-card">
                <div className="form-row gap-selection-grid margin-bottom">
                  <div className="form-group flex-1">
                    <label className="form-label">Chọn CV:</label>
                    <div className="gap-select-shell">
                      <span className="gap-select-icon" aria-hidden="true">📄</span>
                      <select id="page-gap-select-cv" className="form-input gap-select" aria-label="Chọn CV để phân tích"></select>
                      <span className="gap-select-chevron" aria-hidden="true">⌄</span>
                    </div>
                  </div>
                  <div className="form-group flex-1">
                    <label className="form-label">Chọn JD Mục Tiêu:</label>
                    <div className="gap-select-shell">
                      <span className="gap-select-icon" aria-hidden="true">🎯</span>
                      <select id="page-gap-select-jd" className="form-input gap-select" aria-label="Chọn JD mục tiêu"></select>
                      <span className="gap-select-chevron" aria-hidden="true">⌄</span>
                    </div>
                  </div>
                </div>
                <button id="page-btn-run-gap" className="btn-primary full-width gap-analysis-submit">
                  <span className="gap-submit-icon" aria-hidden="true">✦</span>
                  <span>Chạy Phân Tích Khớp Hồ Sơ CV - JD</span>
                </button>
              </div>

              <div id="page-gap-results-container" className="gap-results-card" style={{ display: 'none' }}>
                <div className="score-header">
                  <span className="score-title">Tỷ Lệ Phù Hợp (Match Score):</span>
                  <span id="page-gap-match-score-badge" className="badge badge-ok match-score-badge">0%</span>
                </div>

                <div className="gap-result-block">
                  <p className="block-title title-green">✅ Kỹ năng đáp ứng tốt (Matching Skills):</p>
                  <div id="page-gap-matching-skills" className="tags-row"></div>
                </div>

                <div className="gap-result-block">
                  <p className="block-title title-red">⚠️ Kỹ năng còn thiếu (Missing Skills):</p>
                  <div id="page-gap-missing-skills" className="tags-row"></div>
                </div>

                <div className="gap-result-block">
                  <p className="block-title title-purple">💡 Đề xuất chỉnh sửa câu từ chuẩn ATS (Anti-Hallucination):</p>
                  <div id="page-gap-suggestions-list" className="suggestions-stack"></div>
                </div>
              </div>
            </div>
          </div>
        </section>
    </>
  );
}
