'use client';

import { useEffect, useState } from 'react';

type CVTemplateName = 'modern' | 'classic' | 'compact';

export default function Page() {
  const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState(false);
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
      <canvas id="space-canvas" aria-hidden="true"></canvas>
      <div className="nebula-left" aria-hidden="true"></div>
      <div className="nebula-right" aria-hidden="true"></div>

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
            <a href="#" className="nav-link active" id="nav-dashboard"><span className="nav-text" data-i18n="nav-dashboard">Trang chủ</span></a>
            <a href="#" className="nav-link" id="nav-cv"><span className="nav-text" data-i18n="nav-cv">Phân tích CV</span></a>
            <a href="#" className="nav-link" id="nav-find-jobs"><span className="nav-text" data-i18n="nav-find-jobs">Tìm việc</span></a>
            <a href="#" className="nav-link" id="nav-jobs"><span className="nav-text" data-i18n="nav-jobs">Danh sách JD</span></a>
            <a href="#" className="nav-link" id="nav-interview"><span className="nav-text" data-i18n="nav-interview">Phòng phỏng vấn</span></a>
            <a href="#" className="nav-link" id="nav-history" hidden><span className="nav-text" data-i18n="nav-history">Lịch sử &amp; Báo cáo</span></a>
            <a href="#" className="nav-link role-only-link" id="nav-counselor" hidden><span className="nav-text">Sinh viên của tôi</span></a>
            <a href="#" className="nav-link role-only-link" id="nav-counselor-reports" hidden><span className="nav-text">Báo cáo</span></a>
            <a href="#" className="nav-link role-only-link" id="nav-enterprise" hidden><span className="nav-text">Dashboard</span></a>
            <a href="#" className="nav-link role-only-link" id="nav-enterprise-applications" hidden><span className="nav-text">Hồ sơ ứng tuyển</span></a>
            <a href="#" className="nav-link admin-only-link" id="nav-admin" hidden><span className="nav-text">Quản trị hệ thống</span></a>
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
        <section className="app-view active" id="view-dashboard">
          <div className="hero" id="hero">
            <div className="stars" id="stars"></div>
            <div className="stars stars-2" id="stars-2"></div>
            <div className="stars stars-3" id="stars-3"></div>
            <div className="hero-slash" aria-hidden="true">/</div>

            <div className="hero-container">
              <div className="hero-content">
                <h1 className="hero-title" id="hero-title" data-i18n="hero-title" data-i18n-html="true">
                  Improve your CV and interview skills.
                  <span className="hero-title-accent">Your agent is waiting.</span>
                </h1>
                <p className="hero-sub" id="hero-sub" data-i18n="hero-sub">
                  AI-powered career guidance tool to optimize your CV based on job descriptions (Anti-Hallucination) and practice mock interviews using the Rubric STAR method.
                </p>
                <div className="hero-actions" id="hero-actions">
                  <button className="btn-primary" id="btn-try-free" data-i18n="btn-try-free">TRY INTERVIEWING NOW</button>
                  <button className="btn-outline" id="btn-consult" data-i18n="btn-consult">Optimize your CV with AI.</button>
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
                      <span className="user-name" id="user-name" data-i18n="user-name-guest">Not logged in</span>
                      <span className="user-role" id="user-role-display" data-i18n="user-role-default">Career Assistant System X</span>
                    </div>
                  </div>
                  <div className="card-tabs" id="card-tabs">
                    <button className="tab active" id="tab-overview" data-i18n="tab-overview">Overview</button>
                    <button className="tab" id="tab-interviews" data-i18n="tab-interviews">Interviews</button>
                    <button className="tab" id="tab-history" data-i18n="tab-history">Association</button>
                  </div>
                </div>

                <div className="card-body">
                  <div className="card-summary" id="card-summary">
                    <p className="summary-title" data-i18n="summary-title">APPLICATION STATUS</p>
                    <div className="summary-item">
                      <span className="summary-label" id="label-cv-upload" data-i18n="label-cv-upload">CV has been uploaded.</span>
                      <span className="badge badge-ok" id="badge-cv-status" data-i18n="badge-cv-status">Ready</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label" id="label-interview-skills" data-i18n="label-interview-skills">Interview Skills</span>
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
                        <span className="gauge-label" id="gauge-direction-label" data-i18n="gauge-direction-label">Optimal Progress</span>
                      </div>
                    </div>

                    <div className="chart-area" id="chart-area">
                      <p className="chart-label" id="chart-title" data-i18n="chart-title">Interview evaluation history & resume optimization</p>
                      <svg className="chart-svg" viewBox="0 0 300 80" preserveAspectRatio="none">
                        <line x1="0" y1="20" x2="300" y2="20" stroke="#2a2a4a" strokeWidth="0.5"/>
                        <line x1="0" y1="40" x2="300" y2="40" stroke="#2a2a4a" strokeWidth="0.5"/>
                        <line x1="0" y1="60" x2="300" y2="60" stroke="#2a2a4a" strokeWidth="0.5"/>
                        <polyline points="0,70 40,55 80,40 120,50 160,30 200,45 240,20 300,35"
                          fill="none" stroke="#ff4e9a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <polygon points="0,70 40,55 80,40 120,50 160,30 200,45 240,20 300,35 300,80 0,80"
                          fill="url(#chartFill1)" opacity="0.2"/>
                        <polyline points="0,60 40,65 80,55 120,60 160,50 200,35 240,45 300,15"
                          fill="none" stroke="#7c4dff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>



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
                CV Assistant
              </h2>
              <div className="features-grid" id="features-grid">
                <div className="feature-item" id="feature-cv">
                  <div className="feature-icon">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <div>
                    <p className="feature-name" data-i18n="feat-opt-name">Phân tích CV</p>
                    <p className="feature-desc" data-i18n="feat-opt-desc">Tối ưu theo JD</p>
                  </div>
                </div>
                <div className="feature-item" id="feature-keywords">
                  <div className="feature-icon feature-icon-pink">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                      <path d="M5 3l14 9-14 9V3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="feature-name" data-i18n="feat-match-name">Danh sách JD</p>
                    <p className="feature-desc" data-i18n="feat-match-desc">Việc làm phù hợp</p>
                  </div>
                </div>
                <div className="feature-item" id="feature-deep-interview">
                  <div className="feature-icon feature-icon-purple">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="feature-name" data-i18n="feat-int-name">Phòng phỏng vấn</p>
                    <p className="feature-desc" data-i18n="feat-int-desc">STAR Rubric</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 3. PRICING SECTION ===== */}
        <section className="pricing-section" id="pricing-section">
          <div className="section-header center-header">
            <span className="section-tag" data-i18n="pricing-tag">⚡ NÂNG CẤP SỨC MẠNH AI</span>
            <h2 className="section-title-large" data-i18n="pricing-title">Các Gói Dịch Vụ & Nâng Cấp</h2>
            <p className="section-subtitle" data-i18n="pricing-sub">Lựa chọn gói phù hợp để làm chủ hành trình chinh phục mọi nhà tuyển dụng</p>
          </div>

          <div className="pricing-grid">
            {/* Basic Plan */}
            <div className="pricing-card basic-card">
              <div className="card-badge-placeholder"></div>
              <div className="plan-header">
                <h3 className="plan-title" data-i18n="plan-basic-name">Gói Cơ Bản</h3>
                <p className="plan-desc" data-i18n="plan-basic-desc">Trải nghiệm các tính năng cốt lõi cho ứng viên mới bắt đầu</p>
                <div className="plan-price">
                  <span className="price-amount" data-i18n="plan-basic-price">0đ</span>
                  <span className="price-period" data-i18n="plan-free-forever">/ Trọn đời</span>
                </div>
              </div>
              <ul className="plan-features">
                <li><span className="check-icon">✓</span> <span data-i18n="feat-b1">Tối ưu 3 CV cơ bản</span></li>
                <li><span className="check-icon">✓</span> <span data-i18n="feat-b2">Luyện phỏng vấn STAR 5 lượt/tháng</span></li>
                <li><span className="check-icon">✓</span> <span data-i18n="feat-b3">Tra cứu Thư viện JD mẫu hệ thống</span></li>
                <li className="dimmed"><span className="cross-icon">✕</span> <span data-i18n="feat-b4">Anti-Hallucination chuyên sâu</span></li>
                <li className="dimmed"><span className="cross-icon">✕</span> <span data-i18n="feat-b5">Tạo Custom Job Description</span></li>
              </ul>
              <button className="pricing-btn basic-btn" id="btn-plan-basic" data-i18n="btn-plan-basic">Bắt Đầu Miễn Phí</button>
            </div>

            {/* Pro Plan (Highlighted) */}
            <div className="pricing-card pro-card popular-highlight">
              <div className="popular-badge" data-i18n="badge-popular">🔥 PHỔ BIẾN NHẤT</div>
              <div className="plan-header">
                <h3 className="plan-title pro-title" data-i18n="plan-pro-name">Gói Pro Copilot</h3>
                <p className="plan-desc" data-i18n="plan-pro-desc">Tăng 300% cơ hội nhận Offer với sự trợ giúp toàn diện của AI Agent</p>
                <div className="plan-price">
                  <span className="price-amount pro-price" data-i18n="plan-pro-price">199.000đ</span>
                  <span className="price-period" data-i18n="plan-period-month">/ Tháng</span>
                </div>
              </div>
              <ul className="plan-features">
                <li><span className="check-icon cyan">✓</span> <strong data-i18n="feat-p1">Không giới hạn tối ưu CV theo JD</strong></li>
                <li><span className="check-icon cyan">✓</span> <strong data-i18n="feat-p2">Luyện phỏng vấn STAR AI toàn diện & gợi mở follow-up</strong></li>
                <li><span className="check-icon cyan">✓</span> <span data-i18n="feat-p3">Thuật toán Anti-Hallucination bảo toàn 100% độ thật</span></li>
                <li><span className="check-icon cyan">✓</span> <span data-i18n="feat-p4">Phân tích Gap Analysis & Đề xuất từ khóa ATS</span></li>
                <li><span className="check-icon cyan">✓</span> <span data-i18n="feat-p5">Xuất báo cáo đánh giá kỹ năng phỏng vấn PDF</span></li>
              </ul>
              <button className="pricing-btn pro-btn" id="btn-plan-pro" data-i18n="btn-plan-pro">Nâng Cấp Pro Ngay</button>
            </div>

            {/* Enterprise / Mentor Plan */}
            <div className="pricing-card enterprise-card">
              <div className="card-badge-placeholder"></div>
              <div className="plan-header">
                <h3 className="plan-title" data-i18n="plan-ent-name">Gói Enterprise / Mentor</h3>
                <p className="plan-desc" data-i18n="plan-ent-desc">Giải pháp chuyên sâu cho Nhà tuyển dụng, HR & Chuyên gia Hướng nghiệp</p>
                <div className="plan-price">
                  <span className="price-amount" data-i18n="plan-ent-price">499.000đ</span>
                  <span className="price-period" data-i18n="plan-period-month">/ Tháng</span>
                </div>
              </div>
              <ul className="plan-features">
                <li><span className="check-icon purple">✓</span> <strong data-i18n="feat-e1">Tất cả đặc quyền của Gói Pro</strong></li>
                <li><span className="check-icon purple">✓</span> <strong data-i18n="feat-e2">Tạo Custom Job Description không giới hạn</strong></li>
                <li><span className="check-icon purple">✓</span> <span data-i18n="feat-e3">Thiết lập bộ Rubric STAR phỏng vấn riêng</span></li>
                <li><span className="check-icon purple">✓</span> <span data-i18n="feat-e4">Quản lý kho ứng viên & Phân tích khớp hồ sơ hàng loạt</span></li>
                <li><span className="check-icon purple">✓</span> <span data-i18n="feat-e5">Hỗ trợ kỹ thuật 24/7 & API Integration</span></li>
              </ul>
              <button className="pricing-btn enterprise-btn" id="btn-plan-enterprise" data-i18n="btn-plan-enterprise">Liên Hệ Tư Vấn Enterprise</button>
            </div>
          </div>
        </section>

        {/* ===== 4. SOCIAL PROOF & STATS SECTION ===== */}
        <section className="stats-testimonials-section" id="stats-testimonials-section">
          {/* Counter Stats Grid */}
          <div className="stats-container">
            <div className="stat-box">
              <div className="stat-number-wrap">
                <span className="stat-number glow-cyan">10,000+</span>
              </div>
              <p className="stat-label" data-i18n="stat-cv-label">CV Tối Ưu Thành Công</p>
            </div>
            <div className="stat-box">
              <div className="stat-number-wrap">
                <span className="stat-number glow-purple">85%+</span>
              </div>
              <p className="stat-label" data-i18n="stat-pass-label">Tỷ Lệ Vượt Qua Phỏng Vấn</p>
            </div>
            <div className="stat-box">
              <div className="stat-number-wrap">
                <span className="stat-number glow-pink">4.9/5 ⭐</span>
              </div>
              <p className="stat-label" data-i18n="stat-rating-label">Đánh Giá Từ 5,000+ Ứng Viên</p>
            </div>
            <div className="stat-box">
              <div className="stat-number-wrap">
                <span className="stat-number glow-green">&lt; 30s</span>
              </div>
              <p className="stat-label" data-i18n="stat-speed-label">Thời Gian Phân Tích Match Score</p>
            </div>
          </div>

          {/* Testimonials */}
          <div className="testimonials-wrap">
            <div className="section-header center-header">
              <span className="section-tag" data-i18n="testi-tag">💬 CÂU CHUYỆN THÀNH CÔNG</span>
              <h2 className="section-title-large" data-i18n="testi-title">Ứng Viên Nói Gì Về CV Assistant?</h2>
              <p className="section-subtitle" data-i18n="testi-sub">Hàng ngàn ứng viên đã chinh phục được công việc mơ ước nhờ sự đồng hành của AI Agent</p>
            </div>

            <div className="testimonials-grid">
              <div className="testimonial-card">
                <div className="testi-stars">★★★★★</div>
                <p className="testi-content" data-i18n="testi-user1-text">
                  &ldquo;Nhờ Gap Analysis mà tôi biết chính xác CV mình thiếu những từ khóa ATS nào đối với vị trí Senior Frontend. AI còn tự động tối ưu câu từ vô cùng chân thật!&rdquo;
                </p>
                <div className="testi-author">
                  <div className="author-avatar avatar-cyan">TT</div>
                  <div>
                    <h4 className="author-name">Trần Minh Tuấn</h4>
                    <p className="author-role" data-i18n="testi-user1-role">Senior Frontend Engineer @ Top Tech Corp</p>
                  </div>
                </div>
              </div>

              <div className="testimonial-card highlighted-testimonial">
                <div className="testi-stars">★★★★★</div>
                <p className="testi-content" data-i18n="testi-user2-text">
                  &ldquo;Luyện phỏng vấn STAR với AI Agent giúp tôi rèn luyện phản xạ tuyệt vời. Khi bước vào phỏng vấn thực tế với HR, tôi hoàn toàn tự tin trả lời gãy gọn mạch lạc!&rdquo;
                </p>
                <div className="testi-author">
                  <div className="author-avatar avatar-purple">LH</div>
                  <div>
                    <h4 className="author-name">Lê Thu Hà</h4>
                    <p className="author-role" data-i18n="testi-user2-role">Product Manager @ Fintech Startup</p>
                  </div>
                </div>
              </div>

              <div className="testimonial-card">
                <div className="testi-stars">★★★★★</div>
                <p className="testi-content" data-i18n="testi-user3-text">
                  &ldquo;Tính năng Anti-Hallucination là cứu cánh của tôi! CV không hề bị AI &lsquo;bốc phét&rsquo; thêm kinh nghiệm ảo, nhà tuyển dụng đánh giá rất cao độ trung thực.&rdquo;
                </p>
                <div className="testi-author">
                  <div className="author-avatar avatar-pink">NQ</div>
                  <div>
                    <h4 className="author-name">Nguyễn Hoàng Quốc</h4>
                    <p className="author-role" data-i18n="testi-user3-role">AI Research Specialist @ Global Hub</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>

      {/* ===== 2. VIEW: CV UPLOAD ===== */}
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
                  <h1 className="vessel-title">TRẠM PHÂN TÍCH &amp; QUẢN LÝ HỒ SƠ CV</h1>
                  <div className="vessel-status-pills">
                    <span className="status-pill"><i className="pill-dot green"></i> SYSTEM ONLINE</span>
                    <span className="status-pill" id="cv-agent-runtime-status"><i className="pill-dot cyan"></i> ĐANG KIỂM TRA AI</span>
                    <span className="status-pill"><i className="pill-dot purple"></i> 3 TEMPLATES AVAILABLE</span>
                  </div>
                </div>
                <button type="button" id="btn-open-template-gallery" className="create-cv-template-cta" onClick={() => setIsTemplateGalleryOpen(true)} aria-haspopup="dialog" aria-controls="cv-template-modal-overlay">
                  <span className="create-cv-template-cta-icon" aria-hidden="true">✨</span>
                  <span><strong>TẠO CV MỚI</strong><small>Chọn 1 trong 3 template</small></span>
                </button>
              </div>
            </div>

            <div className="vessel-grid">
              <div className="vessel-card console-card">
                <div className="console-header">
                  <div className="console-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 3v12m0-12L8 7m4-4l4 4" stroke="#00d2ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="#00d2ff" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="console-title">CV DÙNG ĐỂ PHÂN TÍCH</h3>
                    <p className="console-subtitle">Chọn CV đã lưu hoặc tải CV mới để Gemini AI Agent phân tích theo JD</p>
                  </div>
                </div>

                <form id="cv-page-upload-form" className="spaceship-form">
                  <div className="cv-choice-block">
                    <label className="ship-label" htmlFor="cv-analysis-cv-select">Chọn CV đã lưu <span className="required-mark">*</span></label>
                    <div className="jd-select-wrap gap-select-shell cv-jd-select-shell">
                      <span className="gap-select-icon" aria-hidden="true">CV</span>
                      <select id="cv-analysis-cv-select" className="ship-input gap-select" aria-label="Chọn CV cần phân tích">
                        <option value="">Chọn một CV đã lưu</option>
                      </select>
                      <span className="jd-select-chevron gap-select-chevron" aria-hidden="true">⌄</span>
                    </div>
                    <p id="cv-selected-cv-hint" className="jd-selection-hint">Chọn CV trong kho hoặc tải file mới ngay bên dưới.</p>
                  </div>

                  <div className="jd-choice-divider"><span>HOẶC TẢI CV MỚI</span></div>

                  <div className="form-group">
                    <label className="ship-label" htmlFor="cv-page-title-input">Tên gợi nhớ CV (Tùy chọn)</label>
                    <div className="ship-input-wrap">
                      <input type="text" id="cv-page-title-input" className="ship-input" placeholder="Ví dụ: CV Software Engineer 2026" />
                    </div>
                  </div>

                  <div className="upload-dropzone" id="cv-dropzone">
                    <div className="dropzone-laser" id="dropzone-laser"></div>
                    <div className="dropzone-content">
                      <div className="dropzone-icon">
                        <svg width="48" height="48" fill="none" viewBox="0 0 24 24">
                          <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <p className="dropzone-text">Kéo thả file CV vào đây hoặc <span className="highlight-text">bấm để chọn file</span></p>
                      <p className="dropzone-sub">Hỗ trợ định dạng PDF, DOCX (Tối đa 10MB)</p>
                      <input type="file" id="cv-page-file-input" accept=".pdf,.docx" style={{ display: 'none' }} />
                      <span id="selected-file-name" className="selected-file-badge" style={{ display: 'none' }}></span>
                    </div>
                  </div>

                  <div className="llm-consent-card llm-always-on" role="status">
                    <span className="llm-always-on-icon" aria-hidden="true">✦</span>
                    <span className="llm-consent-copy">
                      <strong>Google Gemini + AI Agent luôn được bật</strong>
                      <small><span id="cv-agent-model">LLM đã cấu hình</span> sẽ parse CV, kiểm chứng dữ liệu và phân tích theo JD bạn chọn.</small>
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
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    PHÂN TÍCH CV THEO JD BẰNG GEMINI AI AGENT
                  </button>
                </form>

                <div className="ship-info-box">
                  <div className="box-title">⚡ TÍNH NĂNG TỰ ĐỘNG CỦA AI CORE</div>
                  <ul className="box-list">
                    <li><span className="check-mark">✓</span> Trích xuất kỹ năng Hard skills & Soft skills</li>
                    <li><span className="check-mark">✓</span> Phân tích thời gian kinh nghiệm và dự án</li>
                    <li><span className="check-mark">✓</span> Đánh giá chuẩn ATS & Anti-Hallucination</li>
                  </ul>
                </div>
              </div>

              <div className="vessel-card jd-context-card">
                <div className="console-header">
                  <div className="console-icon console-icon-jd">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M7 3h8l4 4v14H7z" stroke="#0f766e" strokeWidth="1.8" strokeLinejoin="round"/>
                      <path d="M15 3v5h5M10 12h6M10 16h6" stroke="#0f766e" strokeWidth="1.8" strokeLinecap="round"/>
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
                    <span className="gap-select-icon" aria-hidden="true">JD</span>
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
                    <span className="cv-jd-file-icon" aria-hidden="true">📄</span>
                    <span><strong>Chọn file JD</strong><small id="cv-jd-file-name">PDF, DOCX hoặc TXT · tối đa 5 MB</small></span>
                  </label>
                  <input type="file" id="cv-jd-file-input" className="visually-hidden-file" accept=".pdf,.docx,.txt" />
                  <button type="submit" className="ship-btn-secondary cv-jd-upload-button">Tải lên &amp; chọn JD này</button>
                </form>

              </div>
            </div>

            <div className="vessel-card cv-analysis-results-card" id="cv-analysis-results-card" aria-live="polite">
              <div className="console-header cv-results-header">
                <div className="console-icon console-icon-analysis">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3 className="console-title">KẾT QUẢ PHÂN TÍCH CV THEO JD</h3>
                  <p className="console-subtitle">Gemini AI Agent đánh giá độ phù hợp, khoảng trống kỹ năng và việc cần ưu tiên</p>
                </div>
              </div>

              <div id="cv-analysis-empty-state" className="cv-analysis-empty-state">
                <span className="cv-analysis-empty-icon" aria-hidden="true">✦</span>
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

                <section className="cv-result-deep-dive" aria-labelledby="cv-result-deep-dive-title">
                  <div className="cv-result-deep-dive-header">
                    <div>
                      <span className="analysis-result-kicker">BÁO CÁO ATS CHI TIẾT · JD HIỆN TẠI</span>
                      <h5 id="cv-result-deep-dive-title">Bằng chứng, lỗ hổng và kế hoạch hành động</h5>
                    </div>
                    <span id="cv-result-guardrail-status" className="cv-result-guardrail">✓ Anti-hallucination</span>
                  </div>

                  <div id="cv-result-score-breakdown" className="cv-result-score-breakdown"></div>

                  <div className="cv-result-deep-grid">
                    <section className="cv-result-panel">
                      <h5>Kỹ năng mềm còn thiếu bằng chứng</h5>
                      <div id="cv-result-soft-skills" className="cv-result-tags"></div>
                    </section>
                    <section className="cv-result-panel">
                      <h5>Khuyến nghị theo từng mục CV</h5>
                      <div id="cv-result-section-recommendations" className="cv-result-action-list"></div>
                    </section>
                    <section className="cv-result-panel">
                      <h5>Chứng chỉ nên cân nhắc</h5>
                      <div id="cv-result-certifications" className="cv-result-action-list"></div>
                    </section>
                    <section className="cv-result-panel">
                      <h5>Dự án portfolio đề xuất</h5>
                      <div id="cv-result-projects" className="cv-result-action-list"></div>
                    </section>
                  </div>

                  <section className="cv-result-panel cv-result-rewrite-panel">
                    <h5>Gợi ý viết lại có bằng chứng</h5>
                    <div id="cv-result-suggestions-preview" className="cv-result-action-list"></div>
                    <p className="cv-result-integrity-note">Mọi kỹ năng còn thiếu chỉ xuất hiện trong lộ trình học; hệ thống không tự chèn kinh nghiệm, dự án hoặc số liệu chưa có vào CV.</p>
                  </section>
                </section>

                <div className="cv-result-cta-row">
                  <button type="button" id="btn-compare-multi-position" className="ship-btn-secondary cv-result-detail-button">So sánh CV với nhiều vị trí</button>
                  <button type="button" id="btn-start-interview-from-analysis" className="ship-btn-primary cv-result-detail-button">Luyện phỏng vấn theo JD này</button>
                </div>
              </div>
            </div>

              <div className="vessel-card manual-cv-card" id="manual-cv-card" hidden={!selectedCVTemplate}>
                <div className="console-header">
                  <div className="console-icon console-icon-purple"><span aria-hidden="true">✎</span></div>
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

      {/* ===== 3. VIEW: TÌM VIỆC ===== */}
      <section className="app-view" id="view-find-jobs">
        <div className="page-container job-search-page">
          <div className="page-header job-search-heading">
            <div className="page-badge">AI JOB DISCOVERY // ENTERPRISE CATALOG</div>
            <h1 className="page-title">🔎 Tìm Việc Phù Hợp</h1>
            <p className="page-sub">Khám phá JD thật từ doanh nghiệp và để AI xếp hạng công việc theo CV của bạn.</p>
          </div>

          <section className="job-search-console" aria-labelledby="job-search-console-title">
            <div className="job-search-console-copy">
              <span className="job-search-kicker">98+ JD DOANH NGHIỆP</span>
              <h2 id="job-search-console-title">Tìm bằng từ khóa hoặc CV có sẵn</h2>
              <p>AI chỉ dùng nội dung và kỹ năng có trong CV để xếp hạng, không tự thêm kinh nghiệm.</p>
            </div>
            <form id="job-search-form" className="job-search-form">
              <label className="job-search-field" htmlFor="job-search-input">
                <span>Tìm kiếm JD</span>
                <span className="job-search-input-wrap">
                  <span aria-hidden="true">⌕</span>
                  <input id="job-search-input" type="search" placeholder="Ví dụ: Python, Frontend, ShopBack, Hà Nội..." autoComplete="off" />
                </span>
              </label>
              <button type="submit" className="job-search-primary">Tìm kiếm</button>
            </form>
            <div className="job-cv-match-row">
              <label htmlFor="job-search-cv-select">
                <span>Tìm việc bằng CV</span>
                <select id="job-search-cv-select" className="form-input">
                  <option value="">Chọn CV có sẵn của bạn</option>
                </select>
              </label>
              <button type="button" id="job-match-cv-btn" className="job-match-cv-btn" disabled>
                <span aria-hidden="true">✦</span> AI lọc JD phù hợp
              </button>
              <button type="button" id="job-search-reset-btn" className="job-search-reset">Xóa bộ lọc</button>
            </div>
          </section>

          <div className="job-results-toolbar">
            <div>
              <span className="pulse-dot green"></span>
              <strong id="job-results-summary">Đang tải danh sách việc làm...</strong>
            </div>
            <span id="job-results-mode" className="job-results-mode">Tất cả JD</span>
          </div>
          <div id="job-search-results" className="job-search-results" aria-live="polite">
            <div className="job-search-loading"><span></span><p>AI đang nạp dữ liệu JD doanh nghiệp...</p></div>
          </div>
        </div>
      </section>

      {/* ===== 4. VIEW: THƯ VIỆN JOBS ===== */}
      <section className="app-view" id="view-jobs">
        <div className="page-container">
          <div className="page-header">
            <div className="page-badge">DECK BETA // CAREER NAVIGATION ROOM</div>
            <h1 className="page-title">💼 Thư Viện Job Descriptions & Bản Đồ Điều Hướng</h1>
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
                <line x1="100" y1="120" x2="280" y2="60" stroke="rgba(0, 229, 255, 0.4)" strokeWidth="2" strokeDasharray="6 4" className="dash-anim"/>
                <line x1="100" y1="120" x2="300" y2="180" stroke="rgba(124, 77, 255, 0.4)" strokeWidth="2" strokeDasharray="6 4" className="dash-anim"/>
                <line x1="280" y1="60" x2="540" y2="70" stroke="rgba(0, 229, 255, 0.3)" strokeWidth="1.5"/>
                <line x1="300" y1="180" x2="560" y2="170" stroke="rgba(255, 78, 154, 0.3)" strokeWidth="1.5"/>
                <line x1="540" y1="70" x2="720" y2="120" stroke="rgba(55, 214, 122, 0.5)" strokeWidth="2"/>
                <line x1="560" y1="170" x2="720" y2="120" stroke="rgba(55, 214, 122, 0.5)" strokeWidth="2"/>
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
                <span className="node-icon">🎯</span>
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
                    <span className="jd-create-icon">📤</span>
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
                      <span className="jd-file-drop-icon">📄</span>
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
                    <span className="jd-create-icon">✍️</span>
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

      {/* ===== 4. VIEW: PHỎNG VẤN STAR ===== */}
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
                <button type="button" id="page-interview-voice" className="btn-outline" aria-label="Nhập câu trả lời bằng giọng nói">🎤</button>
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

      {/* ===== 6. VIEW: MISSION ARCHIVE ===== */}
      <section className="app-view" id="view-history">
        <div className="page-container">
          <div className="page-header">
            <div className="page-badge badge-purple">DECK EPSILON // MISSION ARCHIVE VAULT</div>
            <h1 className="page-title">📜 Kho Lưu Trữ Lịch Sử Nhiệm Vụ (Mission Archive)</h1>
            <p className="page-sub">Xem lại tất cả các bản phân tích CV, phiên phỏng vấn thử STAR & báo cáo Gap Match đã thực hiện</p>
          </div>

          <div className="archive-workspace">
            <div className="archive-filters">
              <button className="archive-filter-btn active" data-filter="all">Tất cả nhiệm vụ</button>
              <button className="archive-filter-btn" data-filter="cv">📄 Phân tích CV</button>
              <button className="archive-filter-btn" data-filter="interview">🎙️ Phỏng vấn STAR</button>
              <button className="archive-filter-btn" data-filter="gap">🎯 Gap Analysis</button>
            </div>

            <div id="archive-timeline-container" className="archive-grid">
              <div className="archive-card" data-type="cv">
                <div className="archive-card-header">
                  <span className="archive-tag tag-cv">📄 CV SCANNER</span>
                  <span className="archive-time">Hôm nay, 09:30</span>
                </div>
                <h3 className="archive-card-title">CV Software Engineer 2026</h3>
                <p className="archive-card-sub">Trích xuất 14 Hard Skills • Đạt chuẩn ATS Anti-Hallucination</p>
                <div className="archive-card-footer">
                  <span className="badge badge-ok">SUCCESS // PARSED</span>
                  <button className="archive-btn-view" id="btn-archive-view-cv">Xem Chi Tiết ➔</button>
                </div>
              </div>

              <div className="archive-card" data-type="interview">
                <div className="archive-card-header">
                  <span className="archive-tag tag-interview">🎙️ STAR INTERVIEW</span>
                  <span className="archive-time">Hôm qua, 15:45</span>
                </div>
                <h3 className="archive-card-title">Phiên Phỏng Vấn AI Engineer</h3>
                <p className="archive-card-sub">Chấm điểm Rubric STAR: 85/100 • 5/5 Câu hỏi hoàn thành</p>
                <div className="archive-card-footer">
                  <span className="badge badge-ok">PASSED // 85 PTS</span>
                  <button className="archive-btn-view" id="btn-archive-view-interview">Xem Báo Cáo ➔</button>
                </div>
              </div>

              <div className="archive-card" data-type="gap">
                <div className="archive-card-header">
                  <span className="archive-tag tag-gap">🎯 GAP MATCH</span>
                  <span className="archive-time">05/08/2026</span>
                </div>
                <h3 className="archive-card-title">So Khớp: CV vs Senior Fullstack JD</h3>
                <p className="archive-card-sub">Tỷ lệ phù hợp: 92% • Thiếu 2 kỹ năng nâng cao (Docker, K8s)</p>
                <div className="archive-card-footer">
                  <span className="badge badge-ok">MATCH RATE: 92%</span>
                  <button className="archive-btn-view" id="btn-archive-view-gap">Xem Lộ Trình ➔</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 7. VIEW: CREW TERMINAL ===== */}
      <section className="app-view" id="view-profile">
        <div className="page-container">
          <div className="page-header">
            <div className="page-badge badge-cyan">DECK ZETA // CREW QUARTERS & IDENTITY TERMINAL</div>
            <h1 className="page-title">🧑‍🚀 Bảng Điều Khiển Thuyền Viên (Crew Quarters)</h1>
            <p className="page-sub">Quản lý hồ sơ cá nhân, cấu hình Trợ Lý AI Agent và theo dõi thông số nhiệm vụ</p>
          </div>

          <div className="profile-workspace">
            <div className="crew-badge-card">
              <div className="crew-avatar-wrap">
                <div className="crew-avatar-glow"></div>
                <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="10" fill="#1a1a4a"/>
                  <circle cx="16" cy="12" r="6" fill="#00e5ff"/>
                  <path d="M6 26c0-4 4-7 10-7s10 3 10 7" fill="#7c4dff"/>
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

      <section className="app-view" id="view-counselor">
        <div className="page-container">
          <div className="page-header"><div className="page-badge">HUMAN-IN-THE-LOOP</div><h1 className="page-title">🎓 Dashboard Cố Vấn</h1><p className="page-sub">Chỉ hiển thị sinh viên đã chủ động cấp quyền.</p></div>
          <section className="counselor-kpi-section" aria-labelledby="counselor-kpi-title">
            <div><h3 id="counselor-kpi-title">KPI chất lượng sản phẩm</h3><p>Hiển thị dữ liệu thực tế; hệ thống không tự tuyên bố KPI nếu chưa đủ dữ liệu.</p></div>
            <div id="counselor-kpi-overview" className="counselor-kpi-overview"><p className="gap-empty">Đang tải KPI...</p></div>
          </section>
          <div className="role-dashboard-grid">
            <section className="role-panel"><h3>Sinh viên được phân công</h3><div id="counselor-student-list" className="hitl-list"></div></section>
            <section className="role-panel role-menu-target" id="counselor-student-detail"><h3>Báo cáo tiến độ sinh viên</h3><p className="gap-empty">Chọn một sinh viên để xem CV, Gap Analysis và lịch sử STAR.</p></section>
          </div>
          <form id="counselor-feedback-form" className="role-panel" hidden>
            <input type="hidden" id="counselor-feedback-student-id" />
            <select id="counselor-feedback-kind" className="form-input"><option value="comment">Nhận xét</option><option value="task">Bài tập</option><option value="star_note">Ghi chú STAR</option></select>
            <textarea id="counselor-feedback-content" className="form-input" placeholder="Nội dung phản hồi" required></textarea>
            <button className="btn-primary" type="submit">Gửi phản hồi</button>
          </form>
        </div>
      </section>

      <section className="app-view" id="view-enterprise">
        <div className="page-container">
          <div className="page-header"><div className="page-badge">ENTERPRISE RECRUITMENT</div><h1 className="page-title">🏢 Dashboard Tuyển Dụng</h1><p className="page-sub">Công bố JD, xem ứng viên đã chia sẻ CV và tham khảo Match Score.</p></div>
          <div className="role-dashboard-grid">
            <section className="role-panel"><h3>JD của doanh nghiệp</h3><div id="enterprise-jd-list" className="hitl-list"></div></section>
            <section className="role-panel role-menu-target" id="enterprise-applications-panel"><h3>Hồ sơ ứng tuyển theo Match Score</h3><p className="responsible-ai-note">Match Score chỉ để tham khảo; quyết định tuyển dụng luôn do con người thực hiện.</p><div id="enterprise-candidate-list" className="hitl-list"></div></section>
          </div>
          <section id="enterprise-candidate-cv" className="role-panel shared-cv-panel" hidden aria-live="polite"></section>
        </div>
      </section>

      {/* ===== 7. VIEW: ADMIN MANAGEMENT PORTAL ===== */}
      <section className="app-view" id="view-admin">
        <div className="spaceship-stage">
          <div className="section-header center-header" style={{ marginBottom: '32px' }}>
            <span className="section-tag glow-cyan" data-i18n="admin-tag">👑 QUẢN TRỊ VIÊN HỆ THỐNG</span>
            <h2 className="section-title-large" data-i18n="admin-title">Quản Lý Người Dùng & Phân Quyền</h2>
            <p className="section-subtitle" data-i18n="admin-sub">Quản lý người dùng với một Admin hệ thống duy nhất; không hỗ trợ chuyển quyền Admin</p>
          </div>

          <div className="admin-container">
            {/* Stats row */}
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <span className="admin-stat-num glow-cyan" id="admin-stat-total">0</span>
                <span className="admin-stat-lbl" data-i18n="admin-stat-total">Tổng Người Dùng</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-num glow-purple" id="admin-stat-admin">0</span>
                <span className="admin-stat-lbl" data-i18n="admin-stat-admin">Admin Hệ Thống Duy Nhất</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-num glow-pink" id="admin-stat-student">0</span>
                <span className="admin-stat-lbl" data-i18n="admin-stat-student">Sinh Viên / Candidate</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-num glow-green" id="admin-stat-enterprise">0</span>
                <span className="admin-stat-lbl" data-i18n="admin-stat-enterprise">Doanh Nghiệp & Mentor</span>
              </div>
            </div>

            <div className="admin-section-tabs" role="tablist" aria-label="Khu vực quản trị">
              <button type="button" id="admin-tab-users" className="admin-section-tab is-active" role="tab" aria-selected="true" aria-controls="admin-users-panel">👥 Người dùng</button>
              <button type="button" id="admin-tab-ai-logs" className="admin-section-tab" role="tab" aria-selected="false" aria-controls="admin-ai-logs-panel">✦ AI Logs</button>
            </div>

            <div id="admin-users-panel" role="tabpanel" aria-labelledby="admin-tab-users">
              {/* Actions & Search Header */}
              <div className="admin-toolbar">
                <div className="admin-search-wrap">
                  <input type="text" id="admin-user-search" className="form-input" placeholder="🔍 Tìm kiếm theo Tên hoặc Email..." />
                </div>
                <button className="btn-primary" id="btn-admin-add-user" data-i18n="btn-admin-add-user">➕ Thêm User Mới</button>
              </div>

              {/* Users Table */}
              <div className="admin-table-wrap">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th data-i18n="th-fullname">Họ và Tên</th>
                      <th data-i18n="th-email">Email</th>
                      <th data-i18n="th-role">Vai Trò</th>
                      <th data-i18n="th-created">Ngày Tạo</th>
                      <th style={{ textAlign: 'center' }} data-i18n="th-actions">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody id="admin-users-tbody">
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '30px' }}>Đang tải danh sách người dùng...</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div id="admin-ai-logs-panel" role="tabpanel" aria-labelledby="admin-tab-ai-logs" hidden>
              <div className="ai-log-stats" aria-label="Thống kê AI log">
                <span><strong id="ai-log-stat-total">0</strong> lượt gọi</span>
                <span><strong id="ai-log-stat-success">0</strong> thành công</span>
                <span><strong id="ai-log-stat-failed">0</strong> lỗi</span>
                <span><strong id="ai-log-stat-users">0</strong> user</span>
              </div>
              <div className="admin-toolbar ai-log-toolbar">
                <div className="admin-search-wrap">
                  <input type="search" id="admin-ai-log-search" className="form-input" placeholder="Tìm theo email, tên hoặc nội dung prompt..." />
                </div>
                <select id="admin-ai-log-status" className="form-input ai-log-filter" aria-label="Lọc trạng thái AI log">
                  <option value="">Tất cả trạng thái</option>
                  <option value="true">LLM thành công</option>
                  <option value="false">LLM lỗi</option>
                </select>
                <button type="button" id="btn-refresh-ai-logs" className="btn-outline">↻ Làm mới</button>
              </div>
              <p className="ai-log-privacy-note">🔒 Nhật ký chỉ dành cho Admin, bao gồm prompt và phản hồi để kiểm tra chất lượng, lỗi và việc sử dụng AI.</p>
              <div id="admin-ai-log-list" className="admin-ai-log-list" aria-live="polite">
                <div className="ai-log-empty">Chọn tab AI Logs để tải nhật ký.</div>
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
              <div className="auth-role-select" id="auth-role-select">
                <select id="input-role" className="auth-role-native" aria-label="Chọn vai trò tài khoản">
                  <option value="student">Sinh viên (Student)</option>
                  <option value="counselor">Cố vấn (Counselor)</option>
                  <option value="enterprise">Doanh nghiệp (Enterprise)</option>
                </select>
              </div>
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
              <button type="button" id="btn-password-reset-back" className="auth-forgot-password" style={{marginTop: '10px'}}>Quay lại đăng nhập</button>
            </div>

            {/* STEP 2: OTP */}
            <div id="reset-step-2" hidden>
              <div className="modal-header">
                <h2 className="modal-title">Xác thực OTP</h2>
                <p className="modal-sub" id="reset-step-2-sub">Mã 6 số đã được gửi đến email của bạn.</p>
              </div>
              <div className="form-group">
                <input type="text" id="reset-otp" className="form-input" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="------" style={{textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5em', fontWeight: 'bold'}} />
              </div>
              <p className="auth-reset-timer" id="password-reset-timer" style={{color: 'var(--primary-color)', fontSize: '0.9rem', marginBottom: '15px', textAlign: 'center'}}></p>
              <button type="submit" className="btn-submit" id="btn-reset-step-2">Xác thực</button>
              <button type="button" id="btn-password-reset-back-2" className="auth-forgot-password" style={{marginTop: '10px'}}>Nhập lại email</button>
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
            <div className="jd-modal-upload">
              <div className="jd-create-heading">
                <span className="jd-create-icon">📤</span>
                <div>
                  <h3>Tải file JD theo mẫu</h3>
                  <p>PDF, DOCX hoặc TXT — tối đa 5 MB.</p>
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
                  <span className="jd-file-drop-icon">📄</span>
                  <strong>Chọn file JD</strong>
                  <span id="upload-jd-file-name">PDF, DOCX hoặc TXT</span>
                </label>
                <input type="file" id="upload-jd-file" className="visually-hidden-file" accept=".pdf,.docx,.txt" required />
                <button type="submit" className="btn-primary" style={{ width: '100%' }}>Tải lên &amp; lưu JD</button>
              </form>
            </div>
            <div className="jd-section-divider"><span>HOẶC TỰ ĐIỀN NỘI DUNG</span></div>
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
          <div className="form-row gap-selection-grid" style={{ marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label" data-i18n="label-select-cv">Chọn CV:</label>
              <div className="gap-select-shell">
                <span className="gap-select-icon" aria-hidden="true">📄</span>
                <select id="gap-select-cv" className="form-input gap-select" aria-label="Chọn CV để phân tích"></select>
                <span className="gap-select-chevron" aria-hidden="true">⌄</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label" data-i18n="label-select-jd">Chọn JD Mục Tiêu:</label>
              <div className="gap-select-shell">
                <span className="gap-select-icon" aria-hidden="true">🎯</span>
                <select id="gap-select-jd" className="form-input gap-select" aria-label="Chọn JD mục tiêu"></select>
                <span className="gap-select-chevron" aria-hidden="true">⌄</span>
              </div>
            </div>
          </div>
          <button id="btn-run-gap-analysis" className="btn-primary gap-analysis-submit" style={{ width: '100%', marginBottom: '16px' }} data-i18n="btn-run-gap">
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
            <h2 className="modal-title" data-i18n="modal-int-title">🎙️ Phòng Phỏng Vấn Thử (STAR Rubric)</h2>
            <p className="modal-sub" data-i18n="modal-int-sub">Đóng vai nhà tuyển dụng hỏi đáp chuyên sâu & tự động gợi mở follow-up</p>
          </div>
          <div id="interview-setup-section" style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
            <div className="interview-selection-grid" style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" data-i18n="label-int-cv">Chọn CV Phỏng Vấn:</label>
                <div className="gap-select-shell interview-select-shell interview-select-cv">
                  <span className="gap-select-icon" aria-hidden="true">📄</span>
                  <select id="interview-select-cv" className="form-input gap-select interview-select" aria-label="Chọn CV phỏng vấn"></select>
                  <span className="gap-select-chevron" aria-hidden="true">⌄</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label" data-i18n="label-int-jd">Chọn JD Ứng Tuyển:</label>
                <div className="gap-select-shell interview-select-shell interview-select-jd">
                  <span className="gap-select-icon" aria-hidden="true">💼</span>
                  <select id="interview-select-jd" className="form-input gap-select interview-select" aria-label="Chọn vị trí ứng tuyển"></select>
                  <span className="gap-select-chevron" aria-hidden="true">⌄</span>
                </div>
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

      {/* ═══ Admin User Add/Edit Modal (Redesigned) ═══ */}
      <div className="modal-overlay" id="modal-admin-user-overlay">
        <div className="modal-card admin-user-modal-card">
          <button className="modal-close" id="modal-admin-user-close">&times;</button>

          {/* Header with avatar icon */}
          <div className="admin-modal-hero">
            <div className="admin-modal-avatar" id="admin-modal-avatar-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </div>
            <h2 className="modal-title" id="admin-user-modal-title" data-i18n="admin-modal-add-title">Thêm Người Dùng Mới</h2>
            <p className="modal-sub" id="admin-user-modal-sub" data-i18n="admin-modal-add-sub">Tạo tài khoản Student, Counselor hoặc Enterprise</p>
          </div>

          <form id="admin-user-form" className="admin-user-form">
            <input type="hidden" id="admin-edit-user-id" value="" />

            {/* Họ và tên */}
            <div className="form-group admin-form-group">
              <label className="form-label" data-i18n="label-fullname">Họ và tên</label>
              <div className="admin-input-wrap">
                <span className="admin-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
                <input type="text" id="admin-input-fullname" className="form-input admin-form-input" placeholder="Nguyễn Văn A" required />
              </div>
            </div>

            {/* Email */}
            <div className="form-group admin-form-group">
              <label className="form-label" data-i18n="label-email">Email</label>
              <div className="admin-input-wrap">
                <span className="admin-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </span>
                <input type="email" id="admin-input-email" className="form-input admin-form-input" placeholder="user@example.com" required />
              </div>
            </div>

            {/* Vai trò */}
            <div className="form-group admin-form-group">
              <label className="form-label" data-i18n="label-role">Vai trò</label>
              <div className="admin-input-wrap">
                <span className="admin-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
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
              <label className="form-label" id="admin-label-password" data-i18n="label-password">Mật khẩu (Tối thiểu 6 ký tự)</label>
              <div className="admin-input-wrap">
                <span className="admin-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <input type="password" id="admin-input-password" className="form-input admin-form-input" placeholder="••••••••" />
              </div>
            </div>

            <button type="submit" className="btn-primary admin-btn-save" id="btn-admin-save-user" data-i18n="btn-save-user">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              <span id="admin-btn-save-text">Lưu Thông Tin Người Dùng</span>
            </button>
          </form>
        </div>
      </div>

      {/* ═══ Fixed Gemini Career Chatbot ═══ */}
      <div id="ai-companion" className="ai-companion" aria-label="Chatbot AI Nova">
        <div id="ai-companion-hint" className="ai-companion-hint">Bấm để chat với Nova ✨</div>
        <button
          type="button"
          id="ai-companion-avatar"
          className="ai-companion-avatar"
          aria-label="Mở chat với trợ lý AI Nova"
          aria-expanded="false"
          aria-controls="ai-companion-chat"
        >
          {/* GIF gốc phải là img đang hoạt động để canvas đọc được từng frame animation. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            id="ai-companion-source"
            className="ai-companion-source"
            src="/assistant/idle-rotations-8dir.gif"
            alt="Nova - trợ lý nghề nghiệp AI"
            width={64}
            height={64}
            draggable={false}
          />
          <canvas id="ai-companion-canvas" className="ai-companion-canvas" width="64" height="64" aria-hidden="true"></canvas>
          <span id="ai-companion-status-dot" className="ai-companion-status-dot" aria-hidden="true"></span>
        </button>
      </div>

      <aside id="ai-companion-chat" className="ai-companion-chat" aria-hidden="true" hidden>
        <header className="ai-chat-header">
          <div className="ai-chat-identity">
            <span className="ai-chat-orb" aria-hidden="true">✦</span>
            <div>
              <strong>Nova · Career Agent</strong>
              <span id="ai-companion-status-text">Đang kiểm tra Gemini…</span>
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
            <p>Chào bạn! Mình có thể hỗ trợ CV, Gap Analysis và luyện phỏng vấn STAR. Bạn muốn bắt đầu từ đâu?</p>
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>
          </button>
        </form>
        <p className="ai-chat-privacy">Tin nhắn được lưu vào lịch sử tài khoản; Admin có thể xem AI log để kiểm tra chất lượng và lỗi hệ thống.</p>
      </aside>

      {/* ═══ Delete Confirmation Modal ═══ */}
      <div className="modal-overlay" id="modal-delete-confirm-overlay">
        <div className="modal-card delete-confirm-card">
          <div className="delete-confirm-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
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
      {/* ═══ 3-CV TEMPLATES SELECTION GALLERY MODAL ═══ */}
      <div
        className={`modal-overlay${isTemplateGalleryOpen ? ' open' : ''}`}
        id="cv-template-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cv-template-modal-title"
        aria-hidden={!isTemplateGalleryOpen}
        style={{ display: isTemplateGalleryOpen ? 'flex' : 'none', zIndex: 9999 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsTemplateGalleryOpen(false);
        }}
      >
        <div className="archive-modal-content" style={{ maxWidth: '920px', width: '94%' }}>
          <div className="archive-modal-header">
            <div>
              <h2 id="cv-template-modal-title" style={{ margin: 0, fontSize: '20px', color: '#00e5ff' }}>🎨 CHỌN TEMPLATE CV PHÙ HỢP CỦA BẠN</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>Mỗi template có bố cục cấu trúc thiết kế hoàn toàn khác nhau cho từng ngành nghề</p>
            </div>
            <button className="archive-modal-close" id="btn-close-template-modal" type="button" onClick={() => setIsTemplateGalleryOpen(false)} aria-label="Đóng thư viện template">&times;</button>
          </div>

          <div className="template-gallery-grid">
            {/* Template 1: Modern 2-Column */}
            <article className="template-card template-card-modern">
              <div className="template-preview template-preview-modern" aria-label="Xem trước CV bố cục hai cột">
                <div className="preview-sidebar"><i></i><i></i><i></i><i></i><i></i></div>
                <div className="preview-main"><b></b><i></i><i></i><span></span><i></i><i></i><span></span><i></i><i></i></div>
              </div>
              <div className="template-card-content">
                <div className="template-card-header">
                  <span className="archive-tag tag-cv">HỒ SƠ 2 CỘT</span>
                  <span className="badge badge-ok">PHỔ BIẾN NHẤT</span>
                </div>
                <h3 className="template-title">Modern Two-Column</h3>
                <p className="template-desc">Hai cột rõ ràng: thông tin, kỹ năng và học vấn bên trái; mục tiêu, kinh nghiệm và dự án bên phải.</p>
              </div>
              <div className="template-card-actions">
                <a className="template-download-btn" href="/api/v1/cvs/templates/modern/download?v=2" download="cv-template-modern.pdf">↓ Tải mẫu PDF</a>
                <button type="button" className="template-use-btn" onClick={() => selectCVTemplate('modern')}>Dùng mẫu này →</button>
              </div>
            </article>

            {/* Template 2: Classic ATS Single Column */}
            <article className="template-card template-card-classic">
              <div className="template-preview template-preview-classic" aria-label="Xem trước CV ATS bố cục một cột">
                <b></b><em></em><span></span><i></i><i></i><span></span><i></i><i></i><span></span><i></i><i></i>
              </div>
              <div className="template-card-content">
                <div className="template-card-header">
                  <span className="archive-tag tag-optimized">ATS STANDARD</span>
                  <span className="badge badge-ok template-badge-blue">CHUẨN DOANH NGHIỆP</span>
                </div>
                <h3 className="template-title">Classic ATS Standard</h3>
                <p className="template-desc">Một cột theo thứ tự thời gian, tiêu đề rõ ràng và ít yếu tố trang trí để hệ thống ATS dễ đọc.</p>
              </div>
              <div className="template-card-actions">
                <a className="template-download-btn" href="/api/v1/cvs/templates/classic/download?v=2" download="cv-template-classic-ats.pdf">↓ Tải mẫu PDF</a>
                <button type="button" className="template-use-btn" onClick={() => selectCVTemplate('classic')}>Dùng mẫu này →</button>
              </div>
            </article>

            {/* Template 3: Creative Tech Minimalist */}
            <article className="template-card template-card-creative">
              <div className="template-preview template-preview-creative" aria-label="Xem trước CV Creative Tech dạng timeline">
                <div className="preview-banner"><b></b><i></i></div>
                <div className="preview-tags"><i></i><i></i><i></i></div>
                <div className="preview-timeline"><span></span><i></i><span></span><i></i><span></span><i></i></div>
              </div>
              <div className="template-card-content">
                <div className="template-card-header">
                  <span className="archive-tag tag-interview">CREATIVE TECH</span>
                  <span className="badge badge-ok template-badge-teal">SÁNG TẠO</span>
                </div>
                <h3 className="template-title">Creative Tech Timeline</h3>
                <p className="template-desc">Banner cá nhân, kỹ năng dạng thẻ và kinh nghiệm theo timeline; phù hợp hồ sơ công nghệ và sáng tạo.</p>
              </div>
              <div className="template-card-actions">
                <a className="template-download-btn" href="/api/v1/cvs/templates/compact/download?v=2" download="cv-template-creative-tech.pdf">↓ Tải mẫu PDF</a>
                <button type="button" className="template-use-btn" onClick={() => selectCVTemplate('compact')}>Dùng mẫu này →</button>
              </div>
            </article>
          </div>
        </div>
      </div>
    </>
  );
}
