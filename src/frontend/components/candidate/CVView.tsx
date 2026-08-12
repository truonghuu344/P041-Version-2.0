/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Briefcase, Check, CloudUpload, FileText, Mic, Moon, PencilLine, Search, Sparkles, Sun, Target, Terminal, Upload, X
} from 'lucide-react';

export default function CVView({ selectedCVTemplate, setIsTemplateGalleryOpen, selectCVTemplate }: any) {
  return (
    <>
        <section className="app-view" id="view-cv">
          <div className="spaceship-stage">
            <div className="spaceship-windows-bar">
              <div className="porthole-window">
                <div className="porthole-glass"></div>
                <div className="porthole-ring"></div>
                <div className="porthole-label">OBSERVATION BAY Alpha</div>
              </div>
              <div className="porthole-window center-porthole">
                <div className="porthole-glass"></div>
                <div className="porthole-ring"></div>
                <div className="porthole-label">ORBITAL VIEW // CV PARSER COMMAND</div>
              </div>
              <div className="porthole-window">
                <div className="porthole-glass"></div>
                <div className="porthole-ring"></div>
                <div className="porthole-label">OBSERVATION BAY Beta</div>
              </div>
            </div>

            <div className="spaceship-vessel">
              <div className="vessel-header">
                <div className="vessel-badge">
                  <span className="pulse-dot"></span>
                  <span className="vessel-badge-text">WHITE SPACESHIP COMMAND DECK</span>
                </div>
                <div className="vessel-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h1 className="vessel-title">Phân tích CV theo vị trí ứng tuyển</h1>
                    <div className="vessel-status-pills">
                      <span className="status-pill"><i className="pill-dot green"></i> SYSTEM ONLINE</span>
                      <span className="status-pill" id="cv-agent-runtime-status"><i className="pill-dot cyan"></i> ĐANG KIỂM TRA AI</span>
                      <span className="status-pill"><i className="pill-dot purple"></i> 3 TEMPLATES AVAILABLE</span>
                    </div>
                  </div>
                  <button type="button" id="btn-open-template-gallery" className="create-cv-template-cta" onClick={() => setIsTemplateGalleryOpen(true)} aria-haspopup="dialog" aria-controls="cv-template-modal-overlay">
                    <span className="create-cv-template-cta-icon" aria-hidden="true"><PencilLine size={24} /></span>
                    <span><strong>TẠO CV MỚI</strong><small>Chọn 1 trong 3 template</small></span>
                  </button>
                </div>
              </div>

              <div className="vessel-grid">
                <div className="vessel-card console-card">
                  <div className="console-header">
                    <div className="console-icon">
                      <Terminal color="#00d2ff" size={24} />
                    </div>
                    <div>
                      <h3 className="console-title">CV DÙNG ĐỂ PHÂN TÍCH</h3>
                      <p className="console-subtitle">Chọn CV đã lưu hoặc tải CV mới. Sau đó chọn JD ở cột bên phải để nhận đánh giá phù hợp.</p>
                    </div>
                  </div>

                  <form id="cv-page-upload-form" className="spaceship-form">
                    <div className="cv-choice-block">
                      <label className="ship-label" htmlFor="cv-analysis-cv-select">Chọn CV đã lưu <span className="required-mark">*</span></label>
                      <div className="jd-select-wrap">
                        <select id="cv-analysis-cv-select" className="ship-input" aria-label="Chọn CV cần phân tích">
                          <option value="">Chọn một CV đã lưu</option>
                        </select>
                        <span className="jd-select-chevron" aria-hidden="true">⌄</span>
                      </div>
                      <p id="cv-selected-cv-hint" className="jd-selection-hint">Chọn CV trong kho hoặc tải file mới ngay bên dưới.</p>
                    </div>

                    <div className="jd-choice-divider"><span>HOẶC TẢI CV MỚI</span></div>

                    <div className="upload-dropzone" id="cv-dropzone" role="button" tabIndex={0} aria-label="Chọn file CV định dạng PDF hoặc DOCX">
                      <div className="dropzone-laser" id="dropzone-laser"></div>
                      <div className="dropzone-content">
                        <div className="dropzone-icon">
                          <CloudUpload color="#2563eb" size={48} />
                        </div>
                        <p className="dropzone-text">Kéo thả file CV vào đây hoặc <span className="highlight-text">bấm để chọn file</span></p>
                        <p className="dropzone-sub">Hỗ trợ định dạng PDF, DOCX (Tối đa 10MB)</p>
                        <input type="file" id="cv-page-file-input" accept=".pdf,.docx" style={{ display: 'none' }} />
                        <span id="selected-file-name" className="selected-file-badge" style={{ display: 'none' }}></span>
                      </div>
                    </div>

                    <div className="llm-consent-card llm-always-on" role="status">
                      <span className="llm-always-on-icon" aria-hidden="true"><Sparkles size={16} /></span>
                      <span className="llm-consent-copy">
                        <strong>Phân tích tự động đang sẵn sàng</strong>
                        <small><span id="cv-agent-model">Hệ thống</span> sẽ đọc CV, kiểm tra thông tin và so sánh với JD bạn chọn.</small>
                      </span>
                      <span className="llm-consent-badge">TỰ ĐỘNG</span>
                    </div>

                    <div id="cv-agent-progress" className="agent-progress" hidden>
                      <span data-agent-step="upload">1. Tải file</span>
                      <span data-agent-step="extract">2. Trích text</span>
                      <span data-agent-step="llm">3. Gemini parse</span>
                      <span data-agent-step="guardrail">4. Kiểm chứng</span>
                      <span data-agent-step="match">5. So khớp JD</span>
                      <span data-agent-step="save">6. Hoàn tất</span>
                    </div>

                    <button type="submit" className="ship-btn-primary" id="btn-page-do-upload">
                      <Target size={18} aria-hidden="true" />
                      PHÂN TÍCH CV THEO JD
                    </button>
                  </form>

                  <div className="ship-info-box">
                    <div className="box-title"><Sparkles size={16} aria-hidden="true" /> BẠN SẼ NHẬN ĐƯỢC</div>
                    <ul className="box-list">
                      <li><Check size={15} className="check-mark" /> Kỹ năng đang có trong CV</li>
                      <li><Check size={15} className="check-mark" /> Điểm mạnh cần giữ lại</li>
                      <li><Check size={15} className="check-mark" /> Kỹ năng cần ưu tiên bổ sung</li>
                    </ul>
                  </div>
                </div>

                <div className="vessel-card jd-context-card">
                  <div className="console-header">
                    <div className="console-icon console-icon-jd">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M7 3h8l4 4v14H7z" stroke="#0f766e" strokeWidth="1.8" strokeLinejoin="round" />
                        <path d="M15 3v5h5M10 12h6M10 16h6" stroke="#0f766e" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="console-title">JD MỤC TIÊU ĐỂ PHÂN TÍCH</h3>
                      <p className="console-subtitle">Chọn JD doanh nghiệp trong data/jds, JD đã lưu hoặc tải JD mới. AI Agent sẽ luôn so khớp CV với JD này.</p>
                    </div>
                  </div>

                  <div className="jd-choice-block">
                    <label className="ship-label" htmlFor="cv-analysis-jd-select">Chọn JD trong data hoặc JD đã lưu <span className="required-mark">*</span></label>
                    <div className="jd-select-wrap gap-select-shell cv-jd-select-shell">
                      <span className="gap-select-icon" aria-hidden="true"><Briefcase size={17} /></span>
                      <select id="cv-analysis-jd-select" className="ship-input gap-select" required aria-label="Chọn JD mục tiêu">
                        <option value="">Chọn một JD để phân tích CV</option>
                      </select>
                      <span className="jd-select-chevron gap-select-chevron" aria-hidden="true">⌄</span>
                    </div>
                    <p id="cv-selected-jd-hint" className="jd-selection-hint">JD là bắt buộc để AI Agent phân tích đúng vị trí ứng tuyển.</p>
                  </div>

                  <div className="jd-choice-divider"><span>HOẶC TẢI JD MỚI</span></div>

                  <form id="cv-jd-upload-form" className="cv-jd-upload-form">
                    <div className="form-group">
                      <label className="ship-label" htmlFor="cv-jd-title-input">Tên vị trí <span className="field-note">(có thể để trống)</span></label>
                      <input type="text" id="cv-jd-title-input" className="ship-input" placeholder="Tự lấy theo tên file" />
                    </div>
                    <label className="cv-jd-file-drop" htmlFor="cv-jd-file-input">
                      <span className="cv-jd-file-icon" aria-hidden="true"><FileText size={24} /></span>
                      <span><strong>Chọn file JD</strong><small id="cv-jd-file-name">PDF, DOCX hoặc TXT · tối đa 5 MB</small></span>
                    </label>
                    <input type="file" id="cv-jd-file-input" className="visually-hidden-file" accept=".pdf,.docx,.txt" />
                    <button type="submit" className="ship-btn-secondary cv-jd-upload-button">Tải lên &amp; chọn JD này</button>
                  </form>

                </div>
              </div>

              <div className="vessel-card cv-analysis-results-card" id="cv-analysis-results-card" aria-live="polite">
                <div className="console-header cv-results-header">
                  <div className="console-icon console-icon-analysis"><Target color="#0f766e" size={24} /></div>
                  <div>
                    <h3 className="console-title">KẾT QUẢ PHÂN TÍCH CV THEO JD</h3>
                    <p className="console-subtitle">Gemini AI Agent đánh giá độ phù hợp, khoảng trống kỹ năng và việc cần ưu tiên</p>
                  </div>
                </div>

                <div id="cv-analysis-empty-state" className="cv-analysis-empty-state">
                  <span className="cv-analysis-empty-icon" aria-hidden="true"><Target size={22} /></span>
                  <h4>Chưa có kết quả phân tích</h4>
                  <p>Chọn CV, chọn JD mục tiêu rồi bấm <strong>Phân tích CV theo JD</strong>. Kết quả sẽ hiển thị tại đây.</p>
                </div>

                <div id="cv-analysis-result-content" className="cv-analysis-result-content" hidden>
                  <div className="cv-result-overview">
                    <div className="cv-result-score-ring">
                      <strong id="cv-result-match-score">--%</strong>
                      <span>MATCH SCORE</span>
                    </div>
                    <div className="cv-result-summary-block">
                      <span className="analysis-result-kicker">GEMINI AI AGENT · PHÂN TÍCH HOÀN TẤT</span>
                      <h4 id="cv-result-context">CV · JD</h4>
                      <p id="cv-result-summary"></p>
                    </div>
                  </div>

                  <div className="cv-result-skills-grid">
                    <section className="cv-result-panel is-matched">
                      <h5><span aria-hidden="true">✓</span> Kỹ năng phù hợp</h5>
                      <div id="cv-result-matching-skills" className="cv-result-tags"></div>
                    </section>
                    <section className="cv-result-panel is-missing">
                      <h5><span aria-hidden="true">!</span> Kỹ năng cần bổ sung</h5>
                      <div id="cv-result-missing-skills" className="cv-result-tags"></div>
                    </section>
                  </div>

                  <div className="cv-result-detail-grid">
                    <section className="cv-result-panel">
                      <h5>Việc cần ưu tiên</h5>
                      <div id="cv-result-priority-actions" className="cv-result-action-list"></div>
                    </section>
                    <section className="cv-result-panel">
                      <h5>Lộ trình học đề xuất</h5>
                      <div id="cv-result-learning-actions" className="cv-result-action-list"></div>
                    </section>
                  </div>

                  <button type="button" id="btn-open-full-gap-result" className="ship-btn-secondary cv-result-detail-button">Xem bản phân tích chi tiết</button>
                </div>
              </div>

              <div className="vessel-card manual-cv-card" id="manual-cv-card" hidden={!selectedCVTemplate}>
                <div className="console-header">
                  <div className="console-icon console-icon-purple"><PencilLine aria-hidden="true" size={22} /></div>
                  <div>
                    <h3 className="console-title">TẠO CV MỚI TỪ TEMPLATE ĐÃ CHỌN</h3>
                    <p className="console-subtitle">Chỉ nhập thông tin có thật. Bạn có thể kiểm tra và xuất PDF sau khi lưu.</p>
                  </div>
                </div>
                <form id="manual-cv-form" className="manual-cv-form">
                  <input type="hidden" id="manual-cv-template" value={selectedCVTemplate || 'classic'} readOnly />
                  <div className="manual-cv-grid">
                    <div className="form-group"><label className="ship-label" htmlFor="manual-cv-title">Tên CV</label><input id="manual-cv-title" className="ship-input" placeholder="CV Frontend Developer 2026" required /></div>
                    <div className="form-group"><label className="ship-label" htmlFor="manual-cv-name">Họ và tên</label><input id="manual-cv-name" className="ship-input" required /></div>
                    <div className="form-group"><label className="ship-label" htmlFor="manual-cv-email">Email</label><input id="manual-cv-email" type="email" className="ship-input" /></div>
                    <div className="form-group"><label className="ship-label" htmlFor="manual-cv-phone">Số điện thoại</label><input id="manual-cv-phone" className="ship-input" /></div>
                  </div>
                  <div className="form-group"><label className="ship-label" htmlFor="manual-cv-summary">Giới thiệu ngắn</label><textarea id="manual-cv-summary" className="ship-input" placeholder="Mục tiêu nghề nghiệp và thế mạnh nổi bật"></textarea></div>
                  <div className="form-group"><label className="ship-label" htmlFor="manual-cv-skills">Kỹ năng</label><input id="manual-cv-skills" className="ship-input" placeholder="Python, React, SQL (ngăn cách bằng dấu phẩy)" /></div>
                  <div className="manual-cv-grid">
                    <div className="form-group"><label className="ship-label" htmlFor="manual-cv-education">Học vấn</label><textarea id="manual-cv-education" className="ship-input" placeholder="Mỗi nội dung một dòng"></textarea></div>
                    <div className="form-group"><label className="ship-label" htmlFor="manual-cv-experience">Kinh nghiệm</label><textarea id="manual-cv-experience" className="ship-input" placeholder="Mỗi nội dung một dòng"></textarea></div>
                  </div>
                  <div className="form-group"><label className="ship-label" htmlFor="manual-cv-projects">Dự án</label><textarea id="manual-cv-projects" className="ship-input" placeholder="Mỗi dự án một dòng"></textarea></div>
                  <button type="submit" className="ship-btn-primary">LƯU CV THEO TEMPLATE ĐÃ CHỌN</button>
                </form>
              </div>
            </div>
          </div>
        </section>
    </>
  );
}
