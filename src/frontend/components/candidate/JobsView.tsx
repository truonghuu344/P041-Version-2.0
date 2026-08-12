/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Briefcase, Check, CloudUpload, FileText, Mic, Moon, PencilLine, Search, Sparkles, Sun, Target, Terminal, Upload, X
} from 'lucide-react';

export default function JobsView(props: any) {
  return (
    <>
        <section className="app-view" id="view-jobs">
          <div className="page-container">
            <div className="page-header">
              <div className="page-badge">DECK BETA // CAREER NAVIGATION ROOM</div>
              <h1 className="page-title ux-page-title"><Briefcase aria-hidden="true" /> Thư viện mô tả công việc</h1>
              <p className="page-sub">Khám phá các vị trí mục tiêu, phân tích quỹ đạo phù hợp & quản lý JD doanh nghiệp</p>
            </div>

            <div className="career-nav-map-card">
              <div className="map-header">
                <div className="map-title-wrap">
                  <span className="pulse-dot green"></span>
                  <h3 className="map-title">BẢN ĐỒ QUỸ ĐẠO SỰ NGHIỆP VŨ TRỤ (STAR NAVIGATION MAP)</h3>
                </div>
                <span className="map-subtitle">Click vào các tọa độ Vị Trí (Nodes) để định vị mục tiêu & xem tỷ lệ khớp</span>
              </div>

              <div className="star-map-container" id="star-map-container">
                <svg className="map-svg-overlay" viewBox="0 0 800 240" preserveAspectRatio="none">
                  <line x1="100" y1="120" x2="280" y2="60" stroke="rgba(0, 229, 255, 0.4)" strokeWidth="2" strokeDasharray="6 4" className="dash-anim" />
                  <line x1="100" y1="120" x2="300" y2="180" stroke="rgba(124, 77, 255, 0.4)" strokeWidth="2" strokeDasharray="6 4" className="dash-anim" />
                  <line x1="280" y1="60" x2="540" y2="70" stroke="rgba(0, 229, 255, 0.3)" strokeWidth="1.5" />
                  <line x1="300" y1="180" x2="560" y2="170" stroke="rgba(255, 78, 154, 0.3)" strokeWidth="1.5" />
                  <line x1="540" y1="70" x2="720" y2="120" stroke="rgba(55, 214, 122, 0.5)" strokeWidth="2" />
                  <line x1="560" y1="170" x2="720" y2="120" stroke="rgba(55, 214, 122, 0.5)" strokeWidth="2" />
                </svg>

                <div className="map-node node-origin">
                  <div className="node-pulse"></div>
                  <span className="node-icon">🧑‍🚀</span>
                  <span className="node-label">CURRENT PROFILE</span>
                </div>

                <div className="map-node node-job active" style={{ left: '34%', top: '22%' }} data-job="ai-eng">
                  <div className="node-badge">94% MATCH</div>
                  <span className="node-icon">🤖</span>
                  <span className="node-title">AI Engineer</span>
                </div>

                <div className="map-node node-job" style={{ left: '36%', top: '70%' }} data-job="fullstack">
                  <div className="node-badge">88% MATCH</div>
                  <span className="node-icon">💻</span>
                  <span className="node-title">Fullstack Lead</span>
                </div>

                <div className="map-node node-job" style={{ left: '66%', top: '28%' }} data-job="data-sci">
                  <div className="node-badge">82% MATCH</div>
                  <span className="node-icon">📊</span>
                  <span className="node-title">Data Scientist</span>
                </div>

                <div className="map-node node-job" style={{ left: '68%', top: '68%' }} data-job="product-mgr">
                  <div className="node-badge">76% MATCH</div>
                  <span className="node-icon"><Target aria-hidden="true" /></span>
                  <span className="node-title">Product Owner</span>
                </div>

                <div className="map-node node-target" style={{ left: '88%', top: '50%' }}>
                  <div className="node-star-glow"></div>
                  <span className="node-icon">🏆</span>
                  <span className="node-title">CHIEF AI ARCHITECT</span>
                </div>
              </div>
            </div>

            <div className="jobs-layout">
              <div className="jobs-tabs-bar">
                <button id="page-btn-tab-sys" className="tab active">JD Mẫu Hệ Thống</button>
                <button id="page-btn-tab-cust" className="tab">Dán JD Tùy Chỉnh</button>
              </div>

              <div id="page-section-sys-jds" className="jobs-panel">
                <div id="page-jd-list-container" className="jd-cards-grid">
                  <p className="loading-text">Đang tải danh sách Job Description...</p>
                </div>
              </div>

              <div id="page-section-cust-jd" className="jobs-panel" style={{ display: 'none' }}>
                <div className="jd-create-grid">
                  <section className="card-form jd-create-card jd-upload-card">
                    <div className="jd-create-heading">
                      <div className="jd-create-icon"><FileText size={32} /></div>
                      <div>
                        <h3>Tải file JD theo mẫu</h3>
                        <p>Hỗ trợ PDF, DOCX hoặc TXT, tối đa 5 MB.</p>
                      </div>
                    </div>
                    <button type="button" id="page-download-jd-template" className="jd-template-button">⬇ Tải mẫu JD (.txt)</button>
                    <form id="page-upload-jd-form">
                      <div className="form-group">
                        <label className="form-label">Tên vị trí <span className="field-note">(có thể để trống)</span></label>
                        <input type="text" id="page-upload-jd-title" className="form-input" placeholder="Tự lấy theo tên file nếu để trống" />
                      </div>
                      <div className="form-row">
                        <div className="form-group flex-1">
                          <label className="form-label">Công ty</label>
                          <input type="text" id="page-upload-jd-company" className="form-input" placeholder="Tên doanh nghiệp" />
                        </div>
                        <div className="form-group flex-1">
                          <label className="form-label">Địa điểm</label>
                          <input type="text" id="page-upload-jd-location" className="form-input" placeholder="Hà Nội / Remote" />
                        </div>
                      </div>
                      <label className="jd-file-drop" htmlFor="page-upload-jd-file">
                        <div className="jd-file-drop-icon" style={{ color: "var(--accent)", marginBottom: "15px" }}><Upload size={48} /></div>
                        <strong>Chọn file JD đã điền</strong>
                        <span id="page-upload-jd-file-name">PDF, DOCX hoặc TXT</span>
                      </label>
                      <input type="file" id="page-upload-jd-file" className="visually-hidden-file" accept=".pdf,.docx,.txt" required />
                      <button type="submit" className="btn-primary full-width">Tải lên &amp; lưu JD</button>
                    </form>
                  </section>

                  <div className="jd-create-or" aria-hidden="true"><span>HOẶC</span></div>

                  <section className="card-form jd-create-card">
                    <div className="jd-create-heading">
                      <div className="jd-create-icon"><FileText size={32} /></div>
                      <div>
                        <h3>Tự điền nội dung JD</h3>
                        <p>Nhập hoặc dán mô tả công việc trực tiếp.</p>
                      </div>
                    </div>
                    <form id="page-custom-jd-form">
                      <div className="form-group">
                        <label className="form-label">Tên vị trí công việc</label>
                        <input type="text" id="page-custom-jd-title" className="form-input" placeholder="Ví dụ: Senior Fullstack Developer" required />
                      </div>
                      <div className="form-row">
                        <div className="form-group flex-1">
                          <label className="form-label">Tên công ty</label>
                          <input type="text" id="page-custom-jd-company" className="form-input" placeholder="Tech Global Corp" />
                        </div>
                        <div className="form-group flex-1">
                          <label className="form-label">Địa điểm</label>
                          <input type="text" id="page-custom-jd-location" className="form-input" placeholder="TP. Hồ Chí Minh / Hà Nội" />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Nội dung yêu cầu công việc</label>
                        <textarea id="page-custom-jd-requirements" className="form-input textarea-large" placeholder="Dán nội dung chi tiết mô tả công việc, yêu cầu kỹ năng vào đây..." required></textarea>
                      </div>
                      <button type="submit" className="btn-primary full-width">Lưu JD từ nội dung</button>
                    </form>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </section>
    </>
  );
}
