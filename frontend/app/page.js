'use client';

import { useEffect } from 'react';

export default function Page() {
  useEffect(() => {
    // Import app.js dynamically on client side
    import('../app.js');
  }, []);

  return (
    <>
      <canvas id="space-canvas" aria-hidden="true"></canvas>
      <div className="nebula-left" aria-hidden="true"></div>
      <div className="nebula-right" aria-hidden="true"></div>

      {/* 🌌 Cinematic Deep Space Far Planets (Dark Mode) */}
      <div className="dark-planets-container" id="dark-planets-container" aria-hidden="true">
        {/* Saturn (Top-Left Edge - Distant & Cropped) */}
        <div className="dark-planet planet-saturn" id="planet-saturn">
          <svg className="planet-svg" viewBox="0 0 200 160" fill="none">
            <defs>
              <linearGradient id="saturnBody" x1="20%" y1="20%" x2="80%" y2="80%">
                <stop offset="0%" stopColor="#d2c4b0"/>
                <stop offset="40%" stopColor="#aa9680"/>
                <stop offset="75%" stopColor="#786450"/>
                <stop offset="100%" stopColor="#2a1e14"/>
              </linearGradient>
              <linearGradient id="saturnRing" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(190, 170, 145, 0.7)"/>
                <stop offset="50%" stopColor="rgba(140, 120, 95, 0.4)"/>
                <stop offset="100%" stopColor="rgba(80, 65, 50, 0.2)"/>
              </linearGradient>
              {/* Unified Top-Left Light Source Shadow */}
              <radialGradient id="saturnUnifiedShadow" cx="22%" cy="22%" r="78%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2"/>
                <stop offset="35%" stopColor="#000000" stopOpacity="0"/>
                <stop offset="70%" stopColor="#04050d" stopOpacity="0.65"/>
                <stop offset="100%" stopColor="#02030a" stopOpacity="0.95"/>
              </radialGradient>
            </defs>
            <g transform="rotate(-30 100 80)">
              {/* Back Ring */}
              <ellipse cx="100" cy="80" rx="90" ry="24" stroke="url(#saturnRing)" strokeWidth="10" fill="none" opacity="0.5"/>
              {/* Planet Body */}
              <circle cx="100" cy="80" r="38" fill="url(#saturnBody)"/>
              <path d="M 64 72 Q 100 78 136 72 Q 100 66 64 72" fill="#786450" opacity="0.35"/>
              <path d="M 65 88 Q 100 94 135 88 Q 100 82 65 88" fill="#503c28" opacity="0.4"/>
              {/* Unified Shadow */}
              <circle cx="100" cy="80" r="38" fill="url(#saturnUnifiedShadow)"/>
              {/* Front Ring */}
              <path d="M 10 80 A 90 24 0 0 0 190 80" stroke="url(#saturnRing)" strokeWidth="10" fill="none"/>
            </g>
          </svg>
        </div>

        {/* Neptune (mid-distance, placed beside the hero focal point) */}
        <div className="dark-planet planet-neptune" id="planet-neptune">
          <svg className="planet-svg" viewBox="0 0 160 160" fill="none">
            <defs>
              <radialGradient id="neptuneBody" cx="28%" cy="24%" r="76%">
                <stop offset="0%" stopColor="#b9f0ff"/>
                <stop offset="28%" stopColor="#5eb5ff"/>
                <stop offset="62%" stopColor="#245dc8"/>
                <stop offset="100%" stopColor="#071744"/>
              </radialGradient>
              <radialGradient id="neptuneShadow" cx="24%" cy="22%" r="80%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28"/>
                <stop offset="35%" stopColor="#000000" stopOpacity="0"/>
                <stop offset="72%" stopColor="#020825" stopOpacity="0.6"/>
                <stop offset="100%" stopColor="#010312" stopOpacity="0.92"/>
              </radialGradient>
              <radialGradient id="neptuneHaze" cx="50%" cy="50%" r="50%">
                <stop offset="65%" stopColor="#54b7ff" stopOpacity="0.24"/>
                <stop offset="100%" stopColor="#54b7ff" stopOpacity="0"/>
              </radialGradient>
            </defs>
            <circle cx="80" cy="80" r="76" fill="url(#neptuneHaze)"/>
            <circle cx="80" cy="80" r="60" fill="url(#neptuneBody)"/>
            <path d="M 22 58 Q 80 70 138 58 Q 80 48 22 58" fill="#b2ecff" opacity="0.26"/>
            <path d="M 20 78 Q 80 89 140 78 Q 80 68 20 78" fill="#123d9d" opacity="0.46"/>
            <path d="M 25 98 Q 80 106 135 98 Q 80 89 25 98" fill="#68c8ff" opacity="0.2"/>
            <ellipse cx="105" cy="73" rx="10" ry="6" fill="#d4f6ff" opacity="0.16"/>
            <circle cx="80" cy="80" r="60" fill="url(#neptuneShadow)"/>
          </svg>
        </div>

        {/* Mars (Bottom-Right Edge - Distant & Cropped) */}
        <div className="dark-planet planet-mars" id="planet-mars">
          <svg className="planet-svg" viewBox="0 0 150 150" fill="none">
            <defs>
              <radialGradient id="marsBody" x1="20%" y1="20%" x2="80%" y2="80%">
                <stop offset="0%" stopColor="#d88454"/>
                <stop offset="35%" stopColor="#b05028"/>
                <stop offset="70%" stopColor="#782410"/>
                <stop offset="100%" stopColor="#2a0802"/>
              </radialGradient>
              {/* Unified Top-Left Light Source Shadow */}
              <radialGradient id="marsUnifiedShadow" cx="22%" cy="22%" r="78%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2"/>
                <stop offset="35%" stopColor="#000000" stopOpacity="0"/>
                <stop offset="70%" stopColor="#04050d" stopOpacity="0.65"/>
                <stop offset="100%" stopColor="#02030a" stopOpacity="0.96"/>
              </radialGradient>
              <radialGradient id="marsHaze" cx="50%" cy="50%" r="50%">
                <stop offset="65%" stopColor="#b05028" stopOpacity="0.2"/>
                <stop offset="100%" stopColor="#b05028" stopOpacity="0"/>
              </radialGradient>
            </defs>
            <circle cx="75" cy="75" r="72" fill="url(#marsHaze)"/>
            <circle cx="75" cy="75" r="54" fill="url(#marsBody)"/>
            {/* Subtle Surface Texture */}
            <path d="M 35 60 Q 75 50 105 70 Q 70 85 35 60" fill="#441005" opacity="0.45"/>
            <path d="M 55 85 Q 95 75 115 100 Q 75 110 55 85" fill="#2d0500" opacity="0.5"/>
            {/* Unified Shadow */}
            <circle cx="75" cy="75" r="54" fill="url(#marsUnifiedShadow)"/>
          </svg>
        </div>
      </div>

      {/* Universe Morning Theme Layered Atmosphere Container (Light Mode) */}
      <div className="galaxy-blur-container" id="galaxy-blur-container" aria-hidden="true">
        <div className="bg-layer-gradient"></div>
        <div className="nebula-purple"></div>
        <div className="nebula-cyan"></div>
        <div className="aurora-left"></div>
        <div className="aurora-right"></div>
        <div className="center-white-glow"></div>
      </div>

      <header className="navbar" id="navbar">
        <div className="navbar-inner">
          <a href="#" className="brand" id="brand-logo">
            <span className="brand-icon">CV</span>
            <span className="brand-name">CV Assistant</span>
          </a>
          <nav className="nav-links" id="nav-links">
            <a href="#" className="nav-link active" id="nav-dashboard" data-i18n="nav-dashboard"><span className="nav-icon">🚀</span> <span className="nav-text">Dashboard</span></a>
            <a href="#" className="nav-link" id="nav-cv" data-i18n="nav-cv"><span className="nav-icon">🧪</span> <span className="nav-text">CV Upload</span></a>
            <a href="#" className="nav-link" id="nav-jobs" data-i18n="nav-jobs"><span className="nav-icon">🗺️</span> <span className="nav-text">Thư viện Jobs</span></a>
            <a href="#" className="nav-link" id="nav-interview" data-i18n="nav-interview"><span className="nav-icon">🎙️</span> <span className="nav-text">Phỏng vấn STAR</span></a>
            <a href="#" className="nav-link" id="nav-gap" data-i18n="nav-gap"><span className="nav-icon">🎯</span> <span className="nav-text">Gap Analysis</span></a>
          </nav>

          <div id="auth-container">
            <button className="btn-login" id="btn-login" data-i18n="btn-login">Đăng nhập</button>
          </div>

          {/* Light / Dark Mode Toggle */}
          <button className="theme-toggle-btn" id="theme-toggle-btn" title="Đổi chế độ Sáng/Tối (Light/Dark Mode)" aria-label="Toggle theme">
            <span className="theme-icon moon-icon">🌙</span>
            <span className="theme-icon sun-icon">☀️</span>
          </button>

          <div className="lang-switcher" id="lang-switcher">
            <button className="lang-btn" id="lang-btn" aria-haspopup="true" aria-expanded="false" title="Đổi ngôn ngữ / Change Language">
              <span className="lang-flag" id="lang-current-flag">🇻🇳</span>
              <span className="lang-code" id="lang-current-code">VIE</span>
              <svg className="lang-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            <div className="lang-dropdown" id="lang-dropdown">
              <button className="lang-option active" data-lang="vi">
                <span className="lang-flag">🇻🇳</span>
                <span className="lang-name">Tiếng Việt</span>
              </button>
              <button className="lang-option" data-lang="en">
                <span className="lang-flag">🇺🇸</span>
                <span className="lang-name">English</span>
              </button>
              <button className="lang-option" data-lang="ja">
                <span className="lang-flag">🇯🇵</span>
                <span className="lang-name">日本語</span>
              </button>
              <button className="lang-option" data-lang="ko">
                <span className="lang-flag">🇰🇷</span>
                <span className="lang-name">한국어</span>
              </button>
              <button className="lang-option" data-lang="zh">
                <span className="lang-flag">🇨🇳</span>
                <span className="lang-name">中文</span>
              </button>
            </div>
          </div>

          <button className="hamburger" id="hamburger" aria-label="Toggle menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </header>

      {/* ===== SPACESHIP CORRIDOR TRANSITION SWEEP ===== */}
      <div id="spaceship-corridor-sweep" className="spaceship-corridor-sweep" aria-hidden="true">
        <div className="sweep-beam"></div>
        <div className="hatch-door left"></div>
        <div className="hatch-door right"></div>
      </div>

      <main>
        <section className="hero" id="hero">
          <div className="stars" id="stars"></div>
          <div className="stars stars-2" id="stars-2"></div>
          <div className="stars stars-3" id="stars-3"></div>
          <div className="hero-slash" aria-hidden="true">/</div>

          <div className="hero-content">
            <h1 className="hero-title" id="hero-title" data-i18n="hero-title" data-i18n-html="true">
              Nâng cấp CV và phỏng vấn,
              <span className="hero-title-accent">Agent của bạn đang đợi.</span>
            </h1>
            <p className="hero-sub" id="hero-sub" data-i18n="hero-sub">
              Công cụ AI hướng nghiệp tối ưu CV theo JD (Anti-Hallucination) & luyện phỏng vấn thử theo Rubric STAR.
            </p>
            <div className="hero-actions" id="hero-actions">
              <button className="btn-primary" id="btn-try-free" data-i18n="btn-try-free">THỬ PHỎNG VẤN NGAY</button>
              <button className="btn-outline" id="btn-consult" data-i18n="btn-consult">Tối ưu CV với AI</button>
            </div>
          </div>

          <div className="dashboard-card" id="dashboard-card">
            <div className="card-header">
              <div className="user-info">
                <div className="avatar" id="user-avatar">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <rect width="32" height="32" rx="8" fill="#1a1a3e"/>
                    <rect x="4" y="4" width="10" height="8" rx="1" fill="#7c4dff" opacity="0.7"/>
                    <rect x="18" y="4" width="10" height="8" rx="1" fill="#00bcd4" opacity="0.7"/>
                    <rect x="4" y="16" width="24" height="3" rx="1" fill="#ff4e6a" opacity="0.5"/>
                    <rect x="4" y="22" width="16" height="3" rx="1" fill="#ffffff" opacity="0.3"/>
                  </svg>
                </div>
                <div className="user-text">
                  <span className="user-name" id="user-name" data-i18n="user-name-guest">Chưa đăng nhập</span>
                  <span className="user-role" id="user-role-display" data-i18n="user-role-default">Hệ thống Trợ Lý Nghề Nghiệp X</span>
                </div>
              </div>
              <div className="card-tabs" id="card-tabs">
                <button className="tab active" id="tab-overview" data-i18n="tab-overview">Overview</button>
                <button className="tab" id="tab-interviews" data-i18n="tab-interviews">Interviews</button>
                <button className="tab" id="tab-history" data-i18n="tab-history">History</button>
              </div>
            </div>

            <div className="card-body">
              <div className="card-summary" id="card-summary">
                <p className="summary-title" data-i18n="summary-title">Tình Trạng Hồ Sơ</p>
                <div className="summary-item">
                  <span className="summary-label" id="label-cv-upload" data-i18n="label-cv-upload">Đã Upload CV</span>
                  <span className="badge badge-ok" id="badge-cv-status" data-i18n="badge-cv-status">Sẵn sàng</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label" id="label-interview-skills" data-i18n="label-interview-skills">Kỹ năng Phỏng vấn</span>
                  <span className="badge badge-need" id="badge-interview-status" data-i18n="badge-interview-status">STAR Rubric</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label" id="label-ai-match" data-i18n="label-ai-match">AI Match Score</span>
                  <span className="badge badge-focus" id="badge-match-score" data-i18n="badge-match-score">Anti-Hallucination</span>
                </div>
              </div>

              <div className="card-metrics" id="card-metrics">
                <div className="gauges-row" id="gauges-row">
                  <div className="gauge-item" id="gauge-cv">
                    <svg className="gauge-svg" viewBox="0 0 80 50" fill="none">
                      <path d="M10 45 A30 30 0 0 1 70 45" stroke="#2a2a4a" strokeWidth="6" strokeLinecap="round"/>
                      <path d="M10 45 A30 30 0 0 1 70 45" stroke="url(#gCv)" strokeWidth="6" strokeLinecap="round" strokeDasharray="94" strokeDashoffset="15" className="gauge-arc"/>
                      <defs>
                        <linearGradient id="gCv" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#ff4e6a"/>
                          <stop offset="100%" stopColor="#ff8c42"/>
                        </linearGradient>
                      </defs>
                      <circle cx="40" cy="45" r="3" fill="#ff6a5e"/>
                    </svg>
                    <span className="gauge-label" id="gauge-cv-label" data-i18n="gauge-cv-label">Match Score (85%)</span>
                  </div>
                  <div className="gauge-item" id="gauge-interview">
                    <svg className="gauge-svg" viewBox="0 0 80 50" fill="none">
                      <path d="M10 45 A30 30 0 0 1 70 45" stroke="#2a2a4a" strokeWidth="6" strokeLinecap="round"/>
                      <path d="M10 45 A30 30 0 0 1 70 45" stroke="url(#gInt)" strokeWidth="6" strokeLinecap="round" strokeDasharray="94" strokeDashoffset="20" className="gauge-arc"/>
                      <defs>
                        <linearGradient id="gInt" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#00e676"/>
                          <stop offset="100%" stopColor="#00bcd4"/>
                        </linearGradient>
                      </defs>
                      <circle cx="40" cy="45" r="3" fill="#00e676"/>
                    </svg>
                    <span className="gauge-label" id="gauge-interview-label" data-i18n="gauge-interview-label">STAR Score (82/100)</span>
                  </div>
                  <div className="gauge-item" id="gauge-direction">
                    <svg className="gauge-svg" viewBox="0 0 80 50" fill="none">
                      <path d="M10 45 A30 30 0 0 1 70 45" stroke="#2a2a4a" strokeWidth="6" strokeLinecap="round"/>
                      <path d="M10 45 A30 30 0 0 1 70 45" stroke="url(#gDir)" strokeWidth="6" strokeLinecap="round" strokeDasharray="94" strokeDashoffset="25" className="gauge-arc"/>
                      <defs>
                        <linearGradient id="gDir" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#f9c74f"/>
                          <stop offset="100%" stopColor="#f8961e"/>
                        </linearGradient>
                      </defs>
                      <circle cx="40" cy="45" r="3" fill="#f9c74f"/>
                    </svg>
                    <span className="gauge-label" id="gauge-direction-label" data-i18n="gauge-direction-label">Tiến Độ Tối Ưu</span>
                  </div>
                </div>

                <div className="chart-area" id="chart-area">
                  <p className="chart-label" id="chart-title" data-i18n="chart-title">Lịch sử đánh giá phỏng vấn & tối ưu hồ sơ</p>
                  <svg className="chart-svg" viewBox="0 0 300 80" preserveAspectRatio="none">
                    <line x1="0" y1="20" x2="300" y2="20" stroke="#2a2a4a" strokeWidth="0.5"/>
                    <line x1="0" y1="40" x2="300" y2="40" stroke="#2a2a4a" strokeWidth="0.5"/>
                    <line x1="0" y1="60" x2="300" y2="60" stroke="#2a2a4a" strokeWidth="0.5"/>
                    <polyline points="0,70 40,55 80,40 120,50 160,30 200,45 240,20 300,35"
                      fill="none" stroke="#ff4e9a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="icon-row-section" id="icon-row-section">
          <div className="icon-row" id="icon-row">
            <button className="icon-btn" id="icon-cv-btn" title="Upload & Quản Lý CV">
              <svg width="26" height="26" fill="none" viewBox="0 0 24 24">
                <path d="M12 3L4 7v10l8 4 8-4V7l-8-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M12 3v18M4 7l8 4 8-4" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </button>
            <button className="icon-btn" id="icon-location-btn" title="Thư Viện Job Descriptions (JD)">
              <svg width="26" height="26" fill="none" viewBox="0 0 24 24">
                <path d="M12 21s-7-6.686-7-11A7 7 0 0 1 19 10c0 4.314-7 11-7 11z" stroke="#ff4e6a" strokeWidth="1.5"/>
                <circle cx="12" cy="10" r="2.5" stroke="#ff4e6a" strokeWidth="1.5"/>
              </svg>
            </button>
            <button className="icon-btn" id="icon-megaphone-btn" title="Phòng Phỏng Vấn Thử STAR">
              <svg width="26" height="26" fill="none" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3z" stroke="#c084fc" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M17 9a4 4 0 0 1 0 6" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M19.5 6.5a8 8 0 0 1 0 11" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="icon-btn" id="icon-search-btn" title="Chạy Gap Analysis (CV vs JD)">
              <svg width="26" height="26" fill="none" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </section>

        <section className="agent-section" id="agent-section">
          <div className="agent-card" id="agent-card">
            <div className="agent-visual" id="agent-visual">
              <div className="ai-card-outer">
                <div className="ai-card-back"></div>
                <div className="ai-card-inner" id="ai-card-inner">
                  <span className="ai-label">AI</span>
                </div>
              </div>
            </div>

            <div className="agent-info" id="agent-info">
              <h2 className="agent-title" id="agent-title" data-i18n="agent-title" data-i18n-html="true">
                Agent AI – Trí Tuệ<br />Nhân Tạo hỗ trợ
              </h2>
              <div className="features-grid" id="features-grid">
                <div className="feature-item" id="feature-optimize">
                  <div className="feature-icon">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <div>
                    <p className="feature-name" data-i18n="feat-opt-name">Tự động</p>
                    <p className="feature-desc" data-i18n="feat-opt-desc">tối ưu CV</p>
                  </div>
                </div>
                <div className="feature-item" id="feature-deep-interview">
                  <div className="feature-icon feature-icon-purple">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="feature-name" data-i18n="feat-int-name">Phỏng vấn</p>
                    <p className="feature-desc" data-i18n="feat-int-desc">STAR Rubric</p>
                  </div>
                </div>
                <div className="feature-item" id="feature-keywords">
                  <div className="feature-icon feature-icon-pink">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                      <path d="M5 3l14 9-14 9V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="feature-name" data-i18n="feat-match-name">Match Score</p>
                    <p className="feature-desc" data-i18n="feat-match-desc">Gap Analysis</p>
                  </div>
                </div>
                <div className="feature-item" id="feature-career">
                  <div className="feature-icon feature-icon-blue">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M7 8h10M7 12h7M7 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="feature-name" data-i18n="feat-custom-name">Tạo Custom</p>
                    <p className="feature-desc" data-i18n="feat-custom-desc">Job Description</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className="modal-overlay" id="modal-overlay" role="dialog">
        <div className="modal-card" id="modal-card">
          <button className="modal-close" id="modal-close">&times;</button>
          <div className="modal-header">
            <h2 className="modal-title" id="auth-title" data-i18n="auth-title-login">Chào mừng trở lại</h2>
            <p className="modal-sub" id="auth-sub" data-i18n="auth-sub-login">Đăng nhập để tiếp tục hành trình nâng cấp sự nghiệp cùng AI Agent</p>
          </div>
          {/* Google Sign-in / Register Option */}
          <div className="google-auth-wrap">
            <button type="button" className="btn-google-auth" id="btn-google-auth">
              <svg className="google-icon" width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span id="btn-google-text">Tiếp tục bằng Google</span>
            </button>
            <div className="auth-divider">
              <span>hoặc dùng Email</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
            <button type="button" id="tab-auth-login" className="tab active" style={{ flex: 1 }} data-i18n="tab-auth-login">Đăng Nhập</button>
            <button type="button" id="tab-auth-register" className="tab" style={{ flex: 1 }} data-i18n="tab-auth-register">Đăng Ký</button>
          </div>
          <form className="login-form" id="login-form">
            <div className="form-group" id="form-fullname-group" style={{ display: 'none' }}>
              <label className="form-label" data-i18n="label-fullname">Họ và tên</label>
              <input type="text" id="input-fullname" className="form-input" placeholder="Nguyễn Văn A" />
            </div>
            <div className="form-group" id="form-role-group" style={{ display: 'none' }}>
              <label className="form-label" data-i18n="label-role">Vai trò</label>
              <select id="input-role" className="form-input" style={{ background: '#0e0f30', color: '#fff' }}>
                <option value="student">Sinh viên (Student)</option>
                <option value="counselor">Cố vấn (Counselor)</option>
                <option value="enterprise">Doanh nghiệp (Enterprise)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" data-i18n="label-email">Email</label>
              <input type="email" id="input-email" className="form-input" placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label className="form-label" data-i18n="label-password">Mật khẩu</label>
              <input type="password" id="input-password" className="form-input" placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn-submit" id="btn-submit">
              <span id="btn-submit-label" data-i18n="btn-submit-login">Đăng nhập</span>
            </button>
          </form>
        </div>
      </div>

      <div className="modal-overlay" id="modal-cv-overlay">
        <div className="modal-card" style={{ maxWidth: '640px' }}>
          <button className="modal-close" id="modal-cv-close">&times;</button>
          <div className="modal-header">
            <h2 className="modal-title" data-i18n="modal-cv-title">📄 Upload & Quản Lý CV</h2>
            <p className="modal-sub" data-i18n="modal-cv-sub">Trích xuất kỹ năng, kinh nghiệm & dự án tự động bằng AI</p>
          </div>
          <form id="cv-upload-form" style={{ marginBottom: '20px' }}>
            <div className="form-group">
              <label className="form-label" data-i18n="label-cv-name">Tên CV (Tùy chọn)</label>
              <input type="text" id="cv-title-input" className="form-input" placeholder="Ví dụ: CV Backend Developer 2026" />
            </div>
            <div className="form-group">
              <label className="form-label" data-i18n="label-cv-file">Chọn File CV (.pdf hoặc .docx, max 10MB)</label>
              <input type="file" id="cv-file-input" className="form-input" accept=".pdf,.docx" required />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }} data-i18n="btn-cv-upload">Tải Lên & Parse CV</button>
          </form>
          <h3 style={{ fontSize: '14px', color: 'var(--text-dim)', marginBottom: '10px' }} data-i18n="cv-saved-list-title">Danh sách CV đã lưu của bạn:</h3>
          <div id="cv-list-container" style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}></div>
        </div>
      </div>

      <div className="modal-overlay" id="modal-jd-overlay">
        <div className="modal-card" style={{ maxWidth: '680px' }}>
          <button className="modal-close" id="modal-jd-close">&times;</button>
          <div className="modal-header">
            <h2 className="modal-title" data-i18n="modal-jd-title">💼 Thư Viện Job Descriptions (JD)</h2>
            <p className="modal-sub" data-i18n="modal-jd-sub">Chọn JD mẫu từ hệ thống hoặc dán JD công ty bên ngoài</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <button id="btn-tab-system-jds" className="tab active" style={{ flex: 1 }} data-i18n="tab-system-jds">JD Mẫu Hệ Thống</button>
            <button id="btn-tab-custom-jd" className="tab" style={{ flex: 1 }} data-i18n="tab-custom-jd">Dán JD Tùy Chỉnh</button>
          </div>
          <div id="section-system-jds">
            <div id="jd-list-container" style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}></div>
          </div>
          <div id="section-custom-jd" style={{ display: 'none' }}>
            <form id="custom-jd-form">
              <div className="form-group">
                <label className="form-label" data-i18n="label-jd-position">Tên vị trí công việc</label>
                <input type="text" id="custom-jd-title" className="form-input" placeholder="Ví dụ: AI Engineer" required />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label" data-i18n="label-jd-company">Tên công ty</label>
                  <input type="text" id="custom-jd-company" className="form-input" placeholder="Tech Company" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label" data-i18n="label-jd-location">Địa điểm</label>
                  <input type="text" id="custom-jd-location" className="form-input" placeholder="Hà Nội" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" data-i18n="label-jd-requirements">Nội dung Yêu cầu Công việc (Requirements Text)</label>
                <textarea id="custom-jd-requirements" className="form-input" style={{ height: '110px' }} required></textarea>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%' }} data-i18n="btn-save-custom-jd">Lưu Job Description Tùy Chỉnh</button>
            </form>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="modal-gap-overlay">
        <div className="modal-card" style={{ maxWidth: '720px' }}>
          <button className="modal-close" id="modal-gap-close">&times;</button>
          <div className="modal-header">
            <h2 className="modal-title" data-i18n="modal-gap-title">🎯 Phân Tích Match Score & Gap Analysis</h2>
            <p className="modal-sub" data-i18n="modal-gap-sub">So khớp CV với JD & đề xuất tối ưu câu từ Chân Thật (Anti-Hallucination)</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label" data-i18n="label-select-cv">Chọn CV:</label>
              <select id="gap-select-cv" className="form-input" style={{ background: '#0e0f30', color: '#fff' }}></select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label" data-i18n="label-select-jd">Chọn JD Mục Tiêu:</label>
              <select id="gap-select-jd" className="form-input" style={{ background: '#0e0f30', color: '#fff' }}></select>
            </div>
          </div>
          <button id="btn-run-gap-analysis" className="btn-primary" style={{ width: '100%', marginBottom: '16px' }} data-i18n="btn-run-gap">Phân Tích Khớp CV - JD</button>

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
            <h2 className="modal-title" data-i18n="modal-int-title">🎙️ Phòng Phỏng Vấn Thử (STAR Rubric)</h2>
            <p className="modal-sub" data-i18n="modal-int-sub">Đóng vai nhà tuyển dụng hỏi đáp chuyên sâu & tự động gợi mở follow-up</p>
          </div>
          <div id="interview-setup-section" style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" data-i18n="label-int-cv">Chọn CV Phỏng Vấn:</label>
                <select id="interview-select-cv" className="form-input" style={{ background: '#0e0f30', color: '#fff' }}></select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label" data-i18n="label-int-jd">Chọn JD Ứng Tuyển:</label>
                <select id="interview-select-jd" className="form-input" style={{ background: '#0e0f30', color: '#fff' }}></select>
              </div>
            </div>
            <button id="btn-start-interview-session" className="btn-primary" style={{ width: '100%' }} data-i18n="btn-start-int">Bắt Đầu Phiên Phỏng Vấn</button>
          </div>

          <div id="interview-chat-section" style={{ display: 'none', flex: 1, flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
              <span id="interview-progress-text" style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Câu hỏi 1 / 5</span>
              <span className="badge badge-ok">Đang diễn ra</span>
            </div>
            <div id="interview-chat-history" style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}></div>
            <form id="interview-answer-form" style={{ display: 'flex', gap: '8px' }}>
              <input type="text" id="interview-answer-input" className="form-input" placeholder="Nhập câu trả lời của bạn..." style={{ flex: 1 }} required data-i18n-placeholder="placeholder-answer" />
              <button type="submit" className="btn-primary" id="btn-send-answer" data-i18n="btn-send-answer">Gửi</button>
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
    </>
  );
}
