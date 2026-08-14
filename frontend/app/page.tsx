'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { FileText, Home, Mic, Target, Upload, UserRound } from 'lucide-react';

type CVTemplateName = 'modern' | 'classic' | 'compact';

import DashboardView from '../components/candidate/DashboardView';
import CVView from '../components/candidate/CVView';
import MatchView from '../components/candidate/MatchView';
import FindJobsView from '../components/candidate/FindJobsView';
import JobsView from '../components/candidate/JobsView';
import GapView from '../components/candidate/GapView';
import InterviewView from '../components/candidate/InterviewView';
import HistoryView from '../components/candidate/HistoryView';
import ProfileView from '../components/candidate/ProfileView';
import UpgradeView from '../components/candidate/UpgradeView';
import CounselorView from '../components/counselor/CounselorView';
import EnterpriseView from '../components/enterprise/EnterpriseView';
import AdminView from '../components/admin/AdminView';

export default function Page() {
  const [, setIsTemplateGalleryOpen] = useState(false);
  const [selectedCVTemplate, setSelectedCVTemplate] = useState<CVTemplateName | null>(null);

  useEffect(() => {
    // Import app.js dynamically on client side
    import('../app.js');
  }, []);

  const selectCVTemplate = (templateName: CVTemplateName) => {
    setSelectedCVTemplate(templateName);
    setIsTemplateGalleryOpen(false);
    const manualForm = document.getElementById('manual-cv-form');
    window.requestAnimationFrame(() => manualForm?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  return (
    <>
      <header className="navbar" id="navbar">
        <div className="navbar-inner">
          <a href="#" className="brand" id="brand-logo">
            <span className="brand-icon"><Image src="/images/buddy1.png" alt="CV Assistant" width={36} height={36} priority /></span>
            <span className="brand-name">CV Assistant</span>
          </a>
          <nav className="nav-links" id="nav-links">
            <a href="#" className="nav-link active" id="nav-dashboard"><span className="nav-text">Trang chủ</span></a>
            <a href="#" className="nav-link" id="nav-match"><span className="nav-text">Match CV</span></a>
            <a href="#" className="nav-link" id="nav-interview"><span className="nav-text">Phỏng vấn voice</span></a>
            <a href="#" className="nav-link" id="nav-find-jobs"><span className="nav-text">Việc phù hợp</span></a>
            <a href="#" className="nav-link" id="nav-cv"><span className="nav-text">Kho CV</span></a>
            <a href="#" className="nav-link" id="nav-history" hidden><span className="nav-text">Lịch sử &amp; Báo cáo</span></a>
            <a href="#" className="nav-link role-only-link" id="nav-counselor" hidden><span className="nav-text">Sinh viên của tôi</span></a>
            <a href="#" className="nav-link role-only-link" id="nav-counselor-reports" hidden><span className="nav-text">Báo cáo</span></a>
            <a href="#" className="nav-link role-only-link" id="nav-enterprise" hidden><span className="nav-text">Dashboard</span></a>
            <a href="#" className="nav-link role-only-link" id="nav-enterprise-applications" hidden><span className="nav-text">Hồ sơ ứng tuyển</span></a>
            <a href="#" className="nav-link admin-only-link" id="nav-admin" hidden><span className="nav-text">Quản trị hệ thống</span></a>
          </nav>

          <div className="header-utilities"><div id="auth-container"><button className="btn-login" id="btn-login">Đăng nhập</button></div></div>

          <button className="hamburger" id="hamburger" aria-label="Toggle menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </header>

      <nav className="candidate-bottom-nav" aria-label="Điều hướng Candidate">
        <button type="button" data-mobile-view="dashboard" className="active" onClick={() => window.switchView?.('dashboard')}><Home size={18} />Tổng quan</button>
        <button type="button" data-mobile-view="match" onClick={() => window.switchView?.('match')}><Target size={18} />Match</button>
        <button type="button" data-mobile-view="interview" onClick={() => window.switchView?.('interview')}><Mic size={18} />Voice</button>
        <button type="button" data-mobile-view="cv" onClick={() => window.switchView?.('cv')}><FileText size={18} />Kho CV</button>
        <button type="button" data-mobile-view="profile" onClick={() => window.switchView?.('profile')}><UserRound size={18} />Tôi</button>
      </nav>

      {/* ===== SPACESHIP CORRIDOR TRANSITION SWEEP ===== */}
      <div id="spaceship-corridor-sweep" className="spaceship-corridor-sweep" aria-hidden="true">
        <div className="sweep-beam"></div>
        <div className="hatch-door left"></div>
        <div className="hatch-door right"></div>
      </div>

      <main>
        <DashboardView />
        <CVView selectedCVTemplate={selectedCVTemplate} setIsTemplateGalleryOpen={setIsTemplateGalleryOpen} selectCVTemplate={selectCVTemplate} />
        <FindJobsView />
        <JobsView />
        <MatchView />
        <GapView />
        <InterviewView />
        <HistoryView />
        <ProfileView />
        <CounselorView />
        <EnterpriseView />
        <AdminView />
        <UpgradeView />
      </main>

      <div className="modal-overlay" id="modal-overlay" role="dialog">
        <div className="modal-card auth-modal-card" id="modal-card" aria-modal="true" aria-labelledby="auth-title">
          <button className="modal-close" id="modal-close" aria-label="Đóng">&times;</button>
          <div className="modal-header">
            <div className="auth-welcome-mark" aria-hidden="true"><span>✦</span></div>
            <p className="auth-eyebrow">CV ASSISTANT</p>
            <h2 className="modal-title" id="auth-title">Chào mừng trở lại</h2>
            <p className="modal-sub" id="auth-sub">Đăng nhập để tiếp tục hành trình chinh phục công việc phù hợp.</p>
          </div>
          {/* Google Sign-in / Register Option */}
          <div className="google-auth-wrap">
            <div
              className="google-signin-button"
              id="google-signin-button"
              data-client-id={process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || ''}
              aria-live="polite"
            >
              <span className="google-auth-loading">Đang tải nút Google…</span>
            </div>
            <p className="google-auth-help" id="google-auth-help" hidden></p>
            <div className="auth-divider">
              <span>hoặc dùng Email</span>
            </div>
          </div>
          <div className="auth-tabs" role="tablist" aria-label="Đăng nhập hoặc đăng ký">
            <button type="button" id="tab-auth-login" className="tab active" role="tab" aria-selected="true">Đăng Nhập</button>
            <button type="button" id="tab-auth-register" className="tab" role="tab" aria-selected="false">Đăng Ký</button>
          </div>
          <form className="login-form" id="login-form">
            <div className="form-group" id="form-fullname-group" style={{ display: 'none' }}>
              <label className="form-label">Họ và tên</label>
              <input type="text" id="input-fullname" className="form-input" placeholder="Nguyễn Văn A" />
            </div>
            <div className="form-group" id="form-role-group" style={{ display: 'none' }}>
              <label className="form-label">Vai trò</label>
              <div className="auth-role-select" id="auth-role-select">
                <select id="input-role" className="auth-role-native" aria-label="Chọn vai trò tài khoản">
                  <option value="student">Sinh viên (Student)</option>
                  <option value="counselor">Cố vấn (Counselor)</option>
                  <option value="enterprise">Doanh nghiệp (Enterprise)</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" id="input-email" className="form-input" placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Mật khẩu</label>
              <input type="password" id="input-password" className="form-input" placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn-submit" id="btn-submit">
              <span id="btn-submit-label">Đăng nhập</span>
            </button>
          </form>
          <button type="button" id="btn-forgot-password" className="auth-forgot-password">Quên mật khẩu?</button>
        </div>
      </div>

      <div className="modal-overlay" id="password-reset-overlay" role="dialog" aria-modal="true" aria-labelledby="password-reset-title">
        <div className="modal-card password-reset-card">
          <button type="button" className="modal-close" id="password-reset-close" aria-label="Đóng">&times;</button>
          <form className="login-form" id="password-reset-form">

            {/* STEP 1: EMAIL */}
            <div id="reset-step-1">
              <div className="modal-header">
                <h2 className="modal-title" id="password-reset-title">Quên mật khẩu</h2>
                <p className="modal-sub">Nhập email của bạn để nhận mã OTP.</p>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reset-email">Email</label>
                <input type="email" id="reset-email" className="form-input" placeholder="you@example.com" required />
              </div>
              <button type="submit" className="btn-submit" id="btn-reset-step-1">Tiếp tục</button>
              <button type="button" id="btn-password-reset-back" className="auth-forgot-password" style={{ marginTop: '10px' }}>Quay lại đăng nhập</button>
            </div>

            {/* STEP 2: OTP */}
            <div id="reset-step-2" hidden>
              <div className="modal-header">
                <h2 className="modal-title">Xác thực OTP</h2>
                <p className="modal-sub" id="reset-step-2-sub">Mã 6 số đã được gửi đến email của bạn.</p>
              </div>
              <div className="form-group">
                <input type="text" id="reset-otp" className="form-input" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="------" style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5em', fontWeight: 'bold' }} />
              </div>
              <p className="auth-reset-timer" id="password-reset-timer" style={{ color: 'var(--primary-color)', fontSize: '0.9rem', marginBottom: '15px', textAlign: 'center' }}></p>
              <button type="submit" className="btn-submit" id="btn-reset-step-2">Xác thực</button>
              <button type="button" id="btn-password-reset-back-2" className="auth-forgot-password" style={{ marginTop: '10px' }}>Nhập lại email</button>
            </div>

            {/* STEP 3: NEW PASSWORD */}
            <div id="reset-step-3" hidden>
              <div className="modal-header">
                <h2 className="modal-title">Tạo mật khẩu mới</h2>
                <p className="modal-sub">Mật khẩu của bạn phải có tối thiểu 8 ký tự.</p>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reset-new-password">Mật khẩu mới</label>
                <input type="password" id="reset-new-password" className="form-input" minLength={8} placeholder="Ít nhất 8 ký tự" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reset-confirm-password">Xác nhận mật khẩu mới</label>
                <input type="password" id="reset-confirm-password" className="form-input" minLength={8} placeholder="Nhập lại mật khẩu" />
              </div>
              <button type="submit" className="btn-submit" id="btn-reset-step-3">Cập nhật mật khẩu</button>
            </div>

          </form>
        </div>
      </div>

      <div className="modal-overlay" id="modal-cv-overlay">
        <div className="modal-card" style={{ maxWidth: '640px' }}>
          <button className="modal-close" id="modal-cv-close">&times;</button>
          <div className="modal-header">
            <h2 className="modal-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}><FileText size={24} color="var(--primary)" /> Upload & Quản Lý CV</h2>
            <p className="modal-sub">Trích xuất kỹ năng, kinh nghiệm & dự án tự động bằng AI</p>
          </div>
          <form id="cv-upload-form" style={{ marginBottom: '20px' }}>
            <div className="form-group">
              <label className="form-label">Tên CV (Tùy chọn)</label>
              <input type="text" id="cv-title-input" className="form-input" placeholder="Ví dụ: CV Backend Developer 2026" />
            </div>
            <div className="form-group">
              <label className="form-label">Chọn CV (PDF, DOCX hoặc ảnh, tối đa 20 MB)</label>
              <input type="file" id="cv-file-input" className="form-input" accept=".pdf,.docx,.jpg,.jpeg,.png" required />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>Tải Lên & Parse CV</button>
          </form>
          <h3 style={{ fontSize: '14px', color: 'var(--text-dim)', marginBottom: '10px' }}>Danh sách CV đã lưu của bạn:</h3>
          <div id="cv-list-container" style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}></div>
        </div>
      </div>

      <div className="modal-overlay" id="modal-jd-overlay">
        <div className="modal-card" style={{ maxWidth: '680px' }}>
          <button className="modal-close" id="modal-jd-close">&times;</button>
          <div className="modal-header">
            <h2 className="modal-title">💼 Thư Viện Job Descriptions (JD)</h2>
            <p className="modal-sub">Chọn JD mẫu từ hệ thống hoặc dán JD công ty bên ngoài</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <button id="btn-tab-system-jds" className="tab active" style={{ flex: 1 }}>JD Mẫu Hệ Thống</button>
            <button id="btn-tab-custom-jd" className="tab" style={{ flex: 1 }}>Dán JD Tùy Chỉnh</button>
          </div>
          <div id="section-system-jds">
            <div id="jd-list-container" style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}></div>
          </div>
          <div id="section-custom-jd" style={{ display: 'none' }}>
            <div className="jd-modal-upload">
              <div className="jd-create-heading">
                <div className="jd-create-icon"><FileText size={32} /></div>
                <div>
                  <h3>Tải file JD theo mẫu</h3>
                  <p>PDF, DOCX, TXT, JPG, JPEG hoặc PNG — tối đa 20 MB.</p>
                </div>
              </div>
              <button type="button" id="download-jd-template" className="jd-template-button">⬇ Tải mẫu JD (.txt)</button>
              <form id="upload-jd-form">
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Tên vị trí <span className="field-note">(tùy chọn)</span></label>
                    <input type="text" id="upload-jd-title" className="form-input" placeholder="Tự lấy từ tên file" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Tên công ty</label>
                    <input type="text" id="upload-jd-company" className="form-input" placeholder="Tech Company" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Địa điểm</label>
                  <input type="text" id="upload-jd-location" className="form-input" placeholder="Hà Nội / Remote" />
                </div>
                <label className="jd-file-drop compact" htmlFor="upload-jd-file">
                  <div className="jd-file-drop-icon" style={{ color: "var(--accent)", marginBottom: "15px" }}><Upload size={48} /></div>
                  <strong>Chọn file JD</strong>
                  <span id="upload-jd-file-name">PDF, DOCX, TXT hoặc ảnh</span>
                </label>
                <input type="file" id="upload-jd-file" className="visually-hidden-file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png" required />
                <button type="submit" className="btn-primary" style={{ width: '100%' }}>Tải lên &amp; lưu JD</button>
              </form>
            </div>
            <div className="jd-section-divider"><span>HOẶC TỰ ĐIỀN NỘI DUNG</span></div>
            <form id="custom-jd-form">
              <div className="form-group">
                <label className="form-label">Tên vị trí công việc</label>
                <input type="text" id="custom-jd-title" className="form-input" placeholder="Ví dụ: AI Engineer" required />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Tên công ty</label>
                  <input type="text" id="custom-jd-company" className="form-input" placeholder="Tech Company" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Địa điểm</label>
                  <input type="text" id="custom-jd-location" className="form-input" placeholder="Hà Nội" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Nội dung Yêu cầu Công việc (Requirements Text)</label>
                <textarea id="custom-jd-requirements" className="form-input" style={{ height: '110px' }} required></textarea>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>Lưu Job Description Tùy Chỉnh</button>
            </form>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="modal-gap-overlay">
        <div className="modal-card" style={{ maxWidth: '720px' }}>
          <button className="modal-close" id="modal-gap-close">&times;</button>
          <div className="modal-header">
            <h2 className="modal-title">🎯 Phân Tích Match Score & Gap Analysis</h2>
            <p className="modal-sub">So khớp CV với JD & đề xuất tối ưu câu từ Chân Thật (Anti-Hallucination)</p>
          </div>
          <div className="form-row gap-selection-grid" style={{ marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Chọn CV:</label>
              <div className="gap-select-shell">
                <span className="gap-select-icon" aria-hidden="true">📄</span>
                <select id="gap-select-cv" className="form-input gap-select" aria-label="Chọn CV để phân tích"></select>
                <span className="gap-select-chevron" aria-hidden="true">⌄</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">Chọn JD Mục Tiêu:</label>
              <div className="gap-select-shell">
                <span className="gap-select-icon" aria-hidden="true">🎯</span>
                <select id="gap-select-jd" className="form-input gap-select" aria-label="Chọn JD mục tiêu"></select>
                <span className="gap-select-chevron" aria-hidden="true">⌄</span>
              </div>
            </div>
          </div>
          <button id="btn-run-gap-analysis" className="btn-primary gap-analysis-submit" style={{ width: '100%', marginBottom: '16px' }}>
            <span className="gap-submit-icon" aria-hidden="true">✦</span>
            <span>Phân Tích Khớp CV - JD</span>
          </button>

          <div id="gap-results-container" style={{ display: 'none', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span>Match Score:</span>
              <span id="gap-match-score-badge" className="badge badge-ok">0%</span>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', color: '#00e676' }}>✅ Matching Skills:</p>
              <div id="gap-matching-skills" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}></div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', color: '#ff4e6a' }}>⚠️ Missing Skills:</p>
              <div id="gap-missing-skills" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}></div>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#b084fc' }}>💡 Đề xuất tối ưu ATS:</p>
              <div id="gap-suggestions-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="modal-interview-overlay">
        <div className="modal-card" style={{ maxWidth: '760px', height: '85vh', display: 'flex', flexDirection: 'column' }}>
          <button className="modal-close" id="modal-interview-close">&times;</button>
          <div className="modal-header">
            <h2 className="modal-title">🎙️ Phòng Phỏng Vấn Thử (STAR Rubric)</h2>
            <p className="modal-sub">Đóng vai nhà tuyển dụng hỏi đáp chuyên sâu & tự động gợi mở follow-up</p>
          </div>
          <div id="interview-setup-section" style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
            <div className="interview-selection-grid" style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Chọn CV Phỏng Vấn:</label>
                <div className="gap-select-shell interview-select-shell interview-select-cv">
                  <span className="gap-select-icon" aria-hidden="true">📄</span>
                  <select id="interview-select-cv" className="form-input gap-select interview-select" aria-label="Chọn CV phỏng vấn"></select>
                  <span className="gap-select-chevron" aria-hidden="true">⌄</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Chọn JD Ứng Tuyển:</label>
                <div className="gap-select-shell interview-select-shell interview-select-jd">
                  <span className="gap-select-icon" aria-hidden="true">💼</span>
                  <select id="interview-select-jd" className="form-input gap-select interview-select" aria-label="Chọn vị trí ứng tuyển"></select>
                  <span className="gap-select-chevron" aria-hidden="true">⌄</span>
                </div>
              </div>
            </div>
            <button id="btn-start-interview-session" className="btn-primary" style={{ width: '100%' }}>Bắt Đầu Phiên Phỏng Vấn</button>
          </div>

          <div id="interview-chat-section" style={{ display: 'none', flex: 1, flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
              <span id="interview-progress-text" style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Câu hỏi 1 / 5</span>
              <span className="badge badge-ok">Đang diễn ra</span>
            </div>
            <div id="interview-chat-history" style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}></div>
            <form id="interview-answer-form" style={{ display: 'flex', gap: '8px' }}>
              <input type="text" id="interview-answer-input" className="form-input" placeholder="Nhập câu trả lời của bạn..." style={{ flex: 1 }} required />
              <button type="submit" className="btn-primary" id="btn-send-answer">Gửi</button>
            </form>
          </div>

          <div id="interview-report-section" style={{ display: 'none', flex: 1, overflowY: 'auto', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '16px', color: '#00e676' }}>📊 Báo Cáo Chấm Điểm Phỏng Vấn (STAR Rubric)</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <span>Điểm Tổng Kết:</span>
              <span id="report-total-score" className="badge badge-ok" style={{ fontSize: '18px' }}>85/100</span>
            </div>
            <div id="report-star-breakdown" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px', textAlign: 'center' }}></div>
            <div>
              <p style={{ fontSize: '12px', color: '#00e676' }}>💪 Điểm Mạnh:</p>
              <ul id="report-strengths-list" style={{ fontSize: '12px', color: 'var(--text-dim)' }}></ul>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#ff8c42' }}>🛠️ Cần Cải Thiện:</p>
              <ul id="report-improvements-list" style={{ fontSize: '12px', color: 'var(--text-dim)' }}></ul>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#b084fc' }}>🚀 Khuyên Luyện Tập:</p>
              <ul id="report-recommendations-list" style={{ fontSize: '12px', color: 'var(--text-dim)' }}></ul>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Admin User Add/Edit Modal (Redesigned) ═══ */}
      <div className="modal-overlay" id="modal-admin-user-overlay">
        <div className="modal-card admin-user-modal-card">
          <button className="modal-close" id="modal-admin-user-close">&times;</button>

          {/* Header with avatar icon */}
          <div className="admin-modal-hero">
            <div className="admin-modal-avatar" id="admin-modal-avatar-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <h2 className="modal-title" id="admin-user-modal-title">Thêm Người Dùng Mới</h2>
            <p className="modal-sub" id="admin-user-modal-sub">Tạo tài khoản Student, Counselor hoặc Enterprise</p>
          </div>

          <form id="admin-user-form" className="admin-user-form">
            <input type="hidden" id="admin-edit-user-id" value="" />

            {/* Họ và tên */}
            <div className="form-group admin-form-group">
              <label className="form-label">Họ và tên</label>
              <div className="admin-input-wrap">
                <span className="admin-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </span>
                <input type="text" id="admin-input-fullname" className="form-input admin-form-input" placeholder="Nguyễn Văn A" required />
              </div>
            </div>

            {/* Email */}
            <div className="form-group admin-form-group">
              <label className="form-label">Email</label>
              <div className="admin-input-wrap">
                <span className="admin-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                </span>
                <input type="email" id="admin-input-email" className="form-input admin-form-input" placeholder="user@example.com" required />
              </div>
            </div>

            {/* Vai trò */}
            <div className="form-group admin-form-group">
              <label className="form-label">Vai trò</label>
              <div className="admin-input-wrap">
                <span className="admin-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </span>
                <select id="admin-input-role" className="form-input admin-form-input admin-form-select">
                  <option value="student">Sinh viên (Student)</option>
                  <option value="counselor">Cố vấn (Counselor)</option>
                  <option value="enterprise">Doanh nghiệp (Enterprise)</option>
                </select>
              </div>
              <p className="admin-role-policy">🔒 Hệ thống chỉ có một Admin. Không thể cấp hoặc chuyển quyền Admin cho user khác.</p>
            </div>

            {/* Mật khẩu */}
            <div className="form-group admin-form-group">
              <label className="form-label" id="admin-label-password">Mật khẩu (Tối thiểu 6 ký tự)</label>
              <div className="admin-input-wrap">
                <span className="admin-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </span>
                <input type="password" id="admin-input-password" className="form-input admin-form-input" placeholder="••••••••" />
              </div>
            </div>

            <button type="submit" className="btn-primary admin-btn-save" id="btn-admin-save-user">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
              <span id="admin-btn-save-text">Lưu Thông Tin Người Dùng</span>
            </button>
          </form>
        </div>
      </div>

      {/* ═══ Fixed Gemini Career Chatbot ═══ */}
      <div id="ai-companion" className="ai-companion" aria-label="Chatbot AI Nova">
        <div id="ai-companion-hint" className="ai-companion-hint"><strong>Hỏi Nova</strong><span>Hỗ trợ CV, JD và phỏng vấn</span></div>
        <button
          type="button"
          id="ai-companion-avatar"
          className="ai-companion-avatar"
          aria-label="Mở chat với trợ lý AI Nova"
          aria-expanded="false"
          aria-controls="ai-companion-chat"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            id="ai-companion-source"
            className="ai-companion-source is-fallback"
            src="/images/chatbot.png"
            alt="Nova - trợ lý nghề nghiệp AI"
            width={64}
            height={64}
            draggable={false}
          />
          <canvas id="ai-companion-canvas" className="ai-companion-canvas is-hidden" width="64" height="64" aria-hidden="true"></canvas>
          <span className="ai-companion-launcher-copy"><strong>Hỏi Nova</strong><small>Trợ lý nghề nghiệp</small></span>
          <span id="ai-companion-status-dot" className="ai-companion-status-dot" aria-hidden="true"></span>
        </button>
      </div>

      <aside id="ai-companion-chat" className="ai-companion-chat" aria-hidden="true" hidden>
        <header className="ai-chat-header">
          <div className="ai-chat-identity">
            <span className="ai-chat-orb" aria-hidden="true"><Image src="/images/chatbot.png" alt="" width={38} height={38} className="ai-chat-orb-image" /></span>
            <div>
              <strong>Nova · Trợ lý nghề nghiệp</strong>
              <span id="ai-companion-status-text">Đang chuẩn bị hỗ trợ bạn</span>
            </div>
          </div>
          <div className="ai-chat-header-actions">
            <button type="button" id="ai-companion-history" className="ai-chat-header-btn" aria-label="Xem lịch sử hội thoại" aria-expanded="false" title="Lịch sử hội thoại">☰</button>
            <button type="button" id="ai-companion-new-chat" className="ai-chat-header-btn" aria-label="Tạo cuộc hội thoại mới" title="Cuộc trò chuyện mới">＋</button>
            <button type="button" id="ai-companion-close" className="ai-chat-close" aria-label="Đóng cửa sổ chat">×</button>
          </div>
        </header>
        <section id="ai-companion-history-panel" className="ai-chat-history-panel" aria-label="Lịch sử hội thoại" hidden>
          <div className="ai-chat-history-heading">
            <strong>Lịch sử hội thoại</strong>
            <span>Chỉ bạn có thể xem các cuộc trò chuyện này</span>
          </div>
          <div id="ai-companion-history-list" className="ai-chat-history-list"></div>
        </section>
        <div id="ai-companion-messages" className="ai-chat-messages" aria-live="polite">
          <div className="ai-chat-message assistant">
            <span className="ai-chat-message-name">Nova</span>
            <p>Chào bạn. Hãy chọn một gợi ý bên dưới hoặc mô tả mục tiêu của bạn; Nova sẽ hướng dẫn theo CV và JD bạn đang có.</p>
          </div>
        </div>
        <div className="ai-chat-quick-prompts" aria-label="Câu hỏi gợi ý">
          <button type="button" data-assistant-prompt="Tôi nên cải thiện CV từ đâu?">Cải thiện CV</button>
          <button type="button" data-assistant-prompt="Hãy hướng dẫn tôi phân tích khoảng cách với JD.">So khớp JD</button>
          <button type="button" data-assistant-prompt="Hãy giúp tôi luyện phỏng vấn STAR.">Luyện STAR</button>
        </div>
        <form id="ai-companion-form" className="ai-chat-form">
          <textarea id="ai-companion-input" rows={1} maxLength={4000} placeholder="Nhắn cho Nova…" aria-label="Tin nhắn gửi trợ lý AI"></textarea>
          <button type="submit" id="ai-companion-send" aria-label="Gửi tin nhắn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg>
          </button>
        </form>
        <p className="ai-chat-privacy">Nova là trợ lý AI và có thể mắc sai sót. Hãy kiểm tra lại thông tin quan trọng.</p>
      </aside>

      {/* ═══ Delete Confirmation Modal ═══ */}
      <div className="modal-overlay" id="modal-delete-confirm-overlay">
        <div className="modal-card delete-confirm-card">
          <div className="delete-confirm-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
          <h3 className="delete-confirm-title" id="delete-confirm-title">Xác Nhận Xóa Người Dùng</h3>
          <p className="delete-confirm-desc" id="delete-confirm-desc">Bạn có chắc chắn muốn xóa người dùng này?</p>
          <p className="delete-confirm-warning" id="delete-confirm-warning">⚠️ Thao tác này không thể hoàn tác.</p>
          <div className="delete-confirm-actions">
            <button className="delete-confirm-btn-cancel" id="delete-confirm-cancel">Hủy bỏ</button>
            <button className="delete-confirm-btn-delete" id="delete-confirm-ok">Xóa Người Dùng</button>
          </div>
        </div>
      </div>
      
    </>
  );
}
