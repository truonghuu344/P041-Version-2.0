/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Briefcase, Check, CloudUpload, FileText, Mic, Moon, PencilLine, Search, Sparkles, Sun, Target, Terminal, Upload, X
} from 'lucide-react';

export default function InterviewView(props: any) {
  return (
    <>
        <section className="app-view" id="view-interview">
          <div className="page-container">
            <div className="page-header">
              <div className="page-badge badge-purple">DECK GAMMA // SIMULATION CHAMBER</div>
              <h1 className="page-title">🎙️ Phòng Phỏng Vấn Thử (STAR Rubric Chamber)</h1>
              <p className="page-sub">Trợ lý AI đóng vai nhà tuyển dụng hỏi đáp chuyên sâu & tự động đánh giá theo mô hình STAR</p>
            </div>

            <div className="holo-interviewer-card">
              <div className="holo-avatar-wrap">
                <div className="holo-ring outer"></div>
                <div className="holo-ring inner"></div>
                <div className="holo-core-orb" id="holo-core-orb">
                  <span className="ai-symbol">🤖</span>
                </div>
                <div className="holo-waves" id="holo-waves">
                  <span></span><span></span><span></span><span></span><span></span>
                </div>
              </div>
              <div className="holo-info">
                <div className="holo-status-pill">
                  <span className="pulse-dot green"></span>
                  <span id="holo-ai-status">AI RECRUITER AGENT // ACTIVE & READY</span>
                </div>
                <h3 className="holo-ai-name">TRỢ LÝ PHỎNG VẤN VŨ TRỤ STAR RUBRIC</h3>
                <p className="holo-ai-desc">Tự động tạo câu hỏi dựa trên kinh nghiệm CV & yêu cầu JD. Phân tích trực tiếp câu trả lời theo 4 chỉ số STAR (Situation, Task, Action, Result).</p>
              </div>
              <div className="audio-waveform-box" id="audio-waveform">
                <div className="waveform-bar"></div>
                <div className="waveform-bar"></div>
                <div className="waveform-bar"></div>
                <div className="waveform-bar"></div>
                <div className="waveform-bar"></div>
                <div className="waveform-bar"></div>
                <div className="waveform-bar"></div>
              </div>
            </div>

            <div className="interview-workspace">
              <div id="page-interview-setup" className="interview-card">
                <h3 className="card-section-title">Thiết Lập Phiên Phỏng Vấn Thử</h3>
                <div className="form-row margin-bottom interview-selection-grid">
                  <div className="form-group flex-1">
                    <label className="form-label interview-select-label">
                      <span>Chọn CV phỏng vấn</span>
                      <small>Hồ sơ ứng viên</small>
                    </label>
                    <div className="gap-select-shell interview-select-shell interview-select-cv">
                      <span className="gap-select-icon" aria-hidden="true">📄</span>
                      <select id="page-interview-select-cv" className="form-input gap-select interview-select" aria-label="Chọn CV phỏng vấn"></select>
                      <span className="gap-select-chevron" aria-hidden="true">⌄</span>
                    </div>
                  </div>
                  <div className="form-group flex-1">
                    <label className="form-label interview-select-label">
                      <span>Chọn vị trí ứng tuyển</span>
                      <small>Mô tả công việc</small>
                    </label>
                    <div className="gap-select-shell interview-select-shell interview-select-jd">
                      <span className="gap-select-icon" aria-hidden="true">💼</span>
                      <select id="page-interview-select-jd" className="form-input gap-select interview-select" aria-label="Chọn vị trí ứng tuyển"></select>
                      <span className="gap-select-chevron" aria-hidden="true">⌄</span>
                    </div>
                  </div>
                </div>
                <button id="page-btn-start-interview" className="btn-primary full-width">Bắt Đầu Phiên Phỏng Vấn STAR</button>
              </div>

              <div id="page-interview-chat" className="interview-card chat-card" style={{ display: 'none' }}>
                <div className="chat-header">
                  <span id="page-interview-progress-text" className="progress-info">Câu hỏi 1 / 5</span>
                  <span className="badge badge-ok">Đang phỏng vấn</span>
                </div>

                <div id="page-interview-chat-history" className="chat-history-box"></div>

                <form id="page-interview-answer-form" className="chat-input-form">
                  <input type="text" id="page-interview-answer-input" className="form-input flex-1" placeholder="Nhập câu trả lời của bạn theo mô hình STAR..." required />
                  <button type="button" id="page-interview-voice" className="btn-outline ux-icon-button" aria-label="Nhập câu trả lời bằng giọng nói"><Mic size={19} /></button>
                  <button type="submit" className="btn-primary">Gửi Câu Trả Lời</button>
                </form>
              </div>

              <div id="page-interview-report" className="interview-card report-card" style={{ display: 'none' }}>
                <h3 className="report-title">📊 Báo Cáo Chấm Điểm Phỏng Vấn (STAR Rubric)</h3>
                <div className="score-summary">
                  <span>Điểm Tổng Kết:</span>
                  <span id="page-report-total-score" className="badge badge-ok score-badge">85/100</span>
                </div>

                <div id="page-report-star-breakdown" className="star-grid"></div>

                <div className="report-section">
                  <p className="report-label label-green">💪 Điểm Mạnh:</p>
                  <ul id="page-report-strengths-list" className="report-list"></ul>
                </div>

                <div className="report-section">
                  <p className="report-label label-orange">🛠️ Cần Cải Thiện:</p>
                  <ul id="page-report-improvements-list" className="report-list"></ul>
                </div>

                <div className="report-section">
                  <p className="report-label label-purple">🚀 Khuyên Luyện Tập:</p>
                  <ul id="page-report-recommendations-list" className="report-list"></ul>
                </div>
                <form id="page-interview-csat-form" className="csat-form">
                  <label>Đánh giá phiên luyện tập</label>
                  <select id="page-interview-csat" className="form-input" required>
                    <option value="">Chọn 1–5 sao</option><option value="5">5 — Rất hữu ích</option><option value="4">4 — Hữu ích</option><option value="3">3 — Bình thường</option><option value="2">2 — Chưa tốt</option><option value="1">1 — Không hữu ích</option>
                  </select>
                  <input id="page-interview-csat-comment" className="form-input" placeholder="Góp ý thêm (tùy chọn)" />
                  <button className="btn-outline" type="submit">Gửi đánh giá</button>
                </form>
              </div>
            </div>
          </div>
        </section>
    </>
  );
}
