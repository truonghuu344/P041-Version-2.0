/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Briefcase, Check, CloudUpload, FileText, Mic, Moon, PencilLine, Search, Sparkles, Sun, Target, Terminal, Upload, X
} from 'lucide-react';

export default function ProfileView(props: any) {
  return (
    <>
        <section className="app-view" id="view-profile">
          <div className="page-container">
            <div className="page-header">
              <div className="page-badge badge-cyan">DECK ZETA // CREW QUARTERS & IDENTITY TERMINAL</div>
              <h1 className="page-title">🧑‍🚀 Bảng Điều Khiển Thuyền Viên (Crew Quarters)</h1>
              <p className="page-sub">Quản lý hồ sơ cá nhân, cấu hình Trợ Lý AI Agent và theo dõi thông số nhiệm vụ</p>
            </div>

            <section className="mobile-account-preferences" aria-label="Tùy chọn tài khoản">
              <p>Tùy chọn nhanh</p>
              <div>
                <button type="button" onClick={() => document.getElementById('theme-toggle-btn')?.click()}>☀️ / 🌙 Giao diện</button>
                <button type="button" onClick={() => document.querySelector<HTMLButtonElement>('.lang-option[data-lang="vi"]')?.click()}>VN</button>
                <button type="button" onClick={() => document.querySelector<HTMLButtonElement>('.lang-option[data-lang="en"]')?.click()}>EN</button>
              </div>
            </section>

            <div className="profile-workspace">
              <div className="crew-badge-card">
                <div className="crew-avatar-wrap">
                  <div className="crew-avatar-glow"></div>
                  <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
                    <rect width="32" height="32" rx="10" fill="#1a1a4a" />
                    <circle cx="16" cy="12" r="6" fill="#00e5ff" />
                    <path d="M6 26c0-4 4-7 10-7s10 3 10 7" fill="#7c4dff" />
                  </svg>
                </div>
                <h2 className="crew-name" id="crew-profile-name">Phi Công Vũ Trụ</h2>
                <p className="crew-role-badge" id="crew-profile-role">CREW MEMBER // STUDENT</p>

                <div className="crew-stats-grid">
                  <div className="crew-stat-box">
                    <span className="stat-num">12</span>
                    <span className="stat-lbl">Nhiệm Vụ</span>
                  </div>
                  <div className="crew-stat-box">
                    <span className="stat-num">88%</span>
                    <span className="stat-lbl">Match Avg</span>
                  </div>
                  <div className="crew-stat-box">
                    <span className="stat-num">A+</span>
                    <span className="stat-lbl">STAR Grade</span>
                  </div>
                </div>
              </div>

              <div className="profile-settings-card">
                <h3 className="card-section-title">⚙️ Cấu Hình AI Persona & Hệ Thống Tàu</h3>

                <div className="form-group margin-bottom">
                  <label className="form-label">Chọn Phong Cách Trợ Lý AI (AI Persona):</label>
                  <div className="persona-selector">
                    <button className="persona-btn active" data-persona="mentor">
                      <span className="persona-icon">🎓</span>
                      <span className="persona-title">Friendly Mentor</span>
                      <span className="persona-desc">Tư vấn nhẹ nhàng, hướng dẫn từng bước</span>
                    </button>
                    <button className="persona-btn" data-persona="recruiter">
                      <span className="persona-icon">🤖</span>
                      <span className="persona-title">Strict Recruiter</span>
                      <span className="persona-desc">Đánh giá khắt khe chuẩn ATS quốc tế</span>
                    </button>
                    <button className="persona-btn" data-persona="techlead">
                      <span className="persona-icon">⚡</span>
                      <span className="persona-title">Technical Lead</span>
                      <span className="persona-desc">Hỏi sâu kiến trúc, code quality & problem solving</span>
                    </button>
                  </div>
                </div>

                <div className="form-group margin-bottom">
                  <label className="form-label">Vị trí mục tiêu của thuyền viên:</label>
                  <input type="text" className="form-input" id="profile-target-role" defaultValue="Fullstack AI Developer 2026" placeholder="Ví dụ: AI Engineer" />
                </div>

                <div className="form-row">
                  <button className="btn-primary flex-1" id="btn-save-profile">Lưu Cấu Hình Thuyền Viên</button>
                  <button className="btn-outline" id="btn-logout-crew">Đăng Xuất</button>
                </div>
              </div>
              <div className="profile-settings-card student-consent-card" id="student-counselor-consent-panel">
                <h3 className="card-section-title">🎓 Quyền truy cập của Cố vấn</h3>
                <p className="page-sub">Chỉ cố vấn bạn cấp quyền mới được xem tiến độ và gửi nhận xét.</p>
                <form id="student-counselor-consent-form" className="form-row">
                  <input id="student-counselor-email" type="email" className="form-input flex-1" placeholder="Email tài khoản Counselor" required />
                  <button className="btn-primary" type="submit">Cấp quyền</button>
                </form>
                <div id="student-counselor-consent-list" className="hitl-list"></div>
              </div>
            </div>
          </div>
        </section>
    </>
  );
}
