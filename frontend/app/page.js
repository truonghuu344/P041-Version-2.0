'use client';

import { useEffect } from 'react';

export default function Page() {
  useEffect(() => {
    const canvas = document.getElementById('space-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const STAR_COUNT = 380;
    const BIG_STAR_COUNT = 70;
    const EDGE_STAR_COUNT = 120;
    const stars = [];
    const bigStars = [];
    const edgeStars = [];
    const shootingStars = [];
    const STAR_COLORS = [
      'rgba(255,255,255',
      'rgba(200,200,255',
      'rgba(180,220,255',
      'rgba(255,200,220',
      'rgba(220,200,255',
      'rgba(180,255,240',
    ];

    function randColor() {
      return STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
    }

    function initStars() {
      stars.length = 0;
      bigStars.length = 0;
      edgeStars.length = 0;

      for (let i = 0; i < STAR_COUNT; i += 1) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.2 + 0.3,
          color: randColor(),
          alpha: Math.random() * 0.6 + 0.3,
          twinkleSpeed: Math.random() * 0.015 + 0.005,
          twinkleDir: Math.random() > 0.5 ? 1 : -1,
          twinkleMin: Math.random() * 0.15 + 0.1,
          twinkleMax: Math.random() * 0.3 + 0.65,
        });
      }

      for (let i = 0; i < EDGE_STAR_COUNT; i += 1) {
        const onLeft = i % 2 === 0;
        const edgeDist = Math.pow(Math.random(), 1.8) * W * 0.22;
        edgeStars.push({
          x: onLeft ? edgeDist : W - edgeDist,
          y: Math.random() * H,
          r: Math.random() * 1.5 + 0.4,
          color: randColor(),
          alpha: Math.random() * 0.55 + 0.35,
          twinkleSpeed: Math.random() * 0.018 + 0.006,
          twinkleDir: Math.random() > 0.5 ? 1 : -1,
          twinkleMin: 0.18,
          twinkleMax: 0.9,
          glow: Math.random() > 0.6 ? Math.random() * 4 + 1 : 0,
        });
      }

      for (let i = 0; i < BIG_STAR_COUNT; i += 1) {
        bigStars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 2.2 + 1.0,
          color: randColor(),
          alpha: Math.random() * 0.5 + 0.4,
          glow: Math.random() * 8 + 3,
          twinkleSpeed: Math.random() * 0.02 + 0.006,
          twinkleDir: Math.random() > 0.5 ? 1 : -1,
          twinkleMin: 0.2,
          twinkleMax: 1.0,
        });
      }
    }

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      initStars();
    }

    function spawnShootingStar() {
      const fromLeft = Math.random() > 0.5;
      const startX = fromLeft
        ? Math.random() * W * 0.3
        : W * 0.7 + Math.random() * W * 0.3;
      const startY = Math.random() * H * 0.55;
      const angle = fromLeft
        ? (Math.PI / 180) * (30 + Math.random() * 25)
        : (Math.PI / 180) * (150 + Math.random() * 25);
      const speed = 8 + Math.random() * 10;
      const len = 80 + Math.random() * 140;

      shootingStars.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len,
        alpha: 1,
        fade: 0.025 + Math.random() * 0.02,
        tail: [],
        tailMax: Math.round(len / speed) + 2,
        color: Math.random() > 0.6 ? '#a78bfa' : '#ffffff',
        width: 1.5 + Math.random() * 1.2,
      });
    }

    function scheduleShootingStar() {
      const delay = 3000 + Math.random() * 6000;
      setTimeout(() => {
        spawnShootingStar();
        scheduleShootingStar();
      }, delay);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#040514');
      bg.addColorStop(0.5, '#06071a');
      bg.addColorStop(1, '#080924');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const nl = ctx.createRadialGradient(0, H * 0.38, 0, 0, H * 0.38, W * 0.34);
      nl.addColorStop(0, 'rgba(100, 60, 220, 0.13)');
      nl.addColorStop(0.45, 'rgba(80, 40, 180, 0.06)');
      nl.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nl;
      ctx.fillRect(0, 0, W, H);

      const nr = ctx.createRadialGradient(W, H * 0.58, 0, W, H * 0.58, W * 0.34);
      nr.addColorStop(0, 'rgba(0, 180, 220, 0.10)');
      nr.addColorStop(0.45, 'rgba(40, 100, 200, 0.05)');
      nr.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nr;
      ctx.fillRect(0, 0, W, H);

      const nb = ctx.createRadialGradient(W * 0.1, H * 0.85, 0, W * 0.1, H * 0.85, W * 0.25);
      nb.addColorStop(0, 'rgba(120, 40, 200, 0.09)');
      nb.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nb;
      ctx.fillRect(0, 0, W, H);

      for (const s of edgeStars) {
        s.alpha += s.twinkleSpeed * s.twinkleDir;
        if (s.alpha >= s.twinkleMax) { s.alpha = s.twinkleMax; s.twinkleDir = -1; }
        if (s.alpha <= s.twinkleMin) { s.alpha = s.twinkleMin; s.twinkleDir = 1; }

        if (s.glow > 0) {
          const eg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r + s.glow);
          eg.addColorStop(0, `${s.color},${(s.alpha * 0.9).toFixed(2)})`);
          eg.addColorStop(1, `${s.color},0)`);
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r + s.glow, 0, Math.PI * 2);
          ctx.fillStyle = eg;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `${s.color},${s.alpha.toFixed(2)})`;
        ctx.fill();
      }

      for (const s of stars) {
        s.alpha += s.twinkleSpeed * s.twinkleDir;
        if (s.alpha >= s.twinkleMax) { s.alpha = s.twinkleMax; s.twinkleDir = -1; }
        if (s.alpha <= s.twinkleMin) { s.alpha = s.twinkleMin; s.twinkleDir = 1; }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `${s.color},${s.alpha.toFixed(2)})`;
        ctx.fill();
      }

      for (const s of bigStars) {
        s.alpha += s.twinkleSpeed * s.twinkleDir;
        if (s.alpha >= s.twinkleMax) { s.alpha = s.twinkleMax; s.twinkleDir = -1; }
        if (s.alpha <= s.twinkleMin) { s.alpha = s.twinkleMin; s.twinkleDir = 1; }
        const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r + s.glow);
        grd.addColorStop(0, `${s.color},${s.alpha.toFixed(2)})`);
        grd.addColorStop(0.4, `${s.color},${(s.alpha * 0.4).toFixed(2)})`);
        grd.addColorStop(1, `${s.color},0)`);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r + s.glow, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `${s.color},${Math.min(s.alpha * 1.4, 1).toFixed(2)})`;
        ctx.fill();
      }

      for (let i = shootingStars.length - 1; i >= 0; i -= 1) {
        const m = shootingStars[i];
        m.tail.push({ x: m.x, y: m.y });
        if (m.tail.length > m.tailMax) m.tail.shift();

        if (m.tail.length > 1) {
          const tail0 = m.tail[0];
          const tail1 = m.tail[m.tail.length - 1];
          const grad = ctx.createLinearGradient(tail0.x, tail0.y, tail1.x, tail1.y);
          grad.addColorStop(0, 'rgba(255,255,255,0)');
          grad.addColorStop(0.6, m.color === '#a78bfa'
            ? `rgba(167,139,250,${(m.alpha * 0.6).toFixed(2)})`
            : `rgba(255,255,255,${(m.alpha * 0.55).toFixed(2)})`);
          grad.addColorStop(1, m.color === '#a78bfa'
            ? `rgba(200,180,255,${m.alpha.toFixed(2)})`
            : `rgba(255,255,255,${m.alpha.toFixed(2)})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = m.width;
          ctx.beginPath();
          ctx.moveTo(tail0.x, tail0.y);
          ctx.lineTo(tail1.x, tail1.y);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.fillStyle = m.color === '#a78bfa' ? 'rgba(167,139,250,1)' : 'rgba(255,255,255,1)';
        ctx.arc(m.x, m.y, m.width * 0.9, 0, Math.PI * 2);
        ctx.fill();

        m.x += m.vx;
        m.y += m.vy;
        m.alpha -= m.fade;
        if (m.alpha <= 0 || m.x < -100 || m.y > H + 100 || m.x > W + 100) {
          shootingStars.splice(i, 1);
        }
      }

      requestAnimationFrame(draw);
    }

    resize();
    scheduleShootingStar();
    setTimeout(spawnShootingStar, 800);
    draw();

    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <main>
      <canvas id="space-canvas" aria-hidden="true" />
      <div className="nebula-left" aria-hidden="true" />
      <div className="nebula-right" aria-hidden="true" />

      <header className="navbar" id="navbar">
        <div className="navbar-inner">
          <a href="#" className="brand" id="brand-logo">
            <span className="brand-icon">CX</span>
            <span className="brand-name">Career Copilot X</span>
          </a>
          <nav className="nav-links" id="nav-links">
            <a href="#" className="nav-link active" id="nav-dashboard">Dashboard</a>
            <a href="#" className="nav-link" id="nav-cv">CV</a>
            <a href="#" className="nav-link" id="nav-jobs">Jobs</a>
            <a href="#" className="nav-link" id="nav-interview">Interview</a>
            <a href="#" className="nav-link" id="nav-career-coach">Career Coach</a>
            <a href="#" className="nav-link" id="nav-reports">Reports</a>
          </nav>
          <button className="btn-login" id="btn-login">Đăng nhập</button>
          <button className="hamburger" id="hamburger" aria-label="Toggle menu">
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <section className="hero" id="hero">
        <div className="stars" id="stars" />
        <div className="stars stars-2" id="stars-2" />
        <div className="stars stars-3" id="stars-3" />
        <div className="hero-slash" aria-hidden="true">/</div>

        <div className="hero-content">
          <h1 className="hero-title" id="hero-title">
            Nâng cấp CV và phỏng vấn,
            <span className="hero-title-accent">Agent của bạn đang đợi.</span>
          </h1>
          <p className="hero-sub" id="hero-sub">
            Công cụ hỗ trợ cho CV, phỏng vấn thử, và tư vấn nghề nghiệp – được thiết kế cho sinh viên.
          </p>
          <div className="hero-actions" id="hero-actions">
            <button className="btn-primary" id="btn-try-free">THỬ MIỄN PHÍ</button>
            <button className="btn-outline" id="btn-consult">Tư vấn Chuyên gia</button>
          </div>
        </div>

        <div className="dashboard-card" id="dashboard-card">
          <div className="card-header">
            <div className="user-info">
              <div className="avatar" id="user-avatar">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="8" fill="#1a1a3e" />
                  <rect x="4" y="4" width="10" height="8" rx="1" fill="#7c4dff" opacity="0.7" />
                  <rect x="18" y="4" width="10" height="8" rx="1" fill="#00bcd4" opacity="0.7" />
                  <rect x="4" y="16" width="24" height="3" rx="1" fill="#ff4e6a" opacity="0.5" />
                  <rect x="4" y="22" width="16" height="3" rx="1" fill="#ffffff" opacity="0.3" />
                </svg>
              </div>
              <div className="user-text">
                <span className="user-name" id="user-name">Duy Nguyễn</span>
                <span className="user-role">Giao diện cá nhân của bạn</span>
              </div>
            </div>
            <div className="card-tabs" id="card-tabs">
              <button className="tab active" id="tab-overview">Overview</button>
              <button className="tab" id="tab-interviews">Interviews</button>
              <button className="tab" id="tab-history">History</button>
            </div>
          </div>

          <div className="card-body">
            <div className="card-summary" id="card-summary">
              <p className="summary-title">Summary</p>
              <div className="summary-item">
                <span className="summary-label">Tối ưu CV</span>
                <span className="badge badge-ok">Ok</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Kỹ năng Phỏng vấn</span>
                <span className="badge badge-need">Needimo</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Định hướng</span>
                <span className="badge badge-focus">Focus</span>
              </div>
            </div>

            <div className="card-metrics" id="card-metrics">
              <div className="gauges-row" id="gauges-row">
                <div className="gauge-item" id="gauge-cv">
                  <svg className="gauge-svg" viewBox="0 0 80 50" fill="none">
                    <path d="M10 45 A30 30 0 0 1 70 45" stroke="#2a2a4a" strokeWidth="6" strokeLinecap="round" />
                    <path d="M10 45 A30 30 0 0 1 70 45" stroke="url(#gCv)" strokeWidth="6" strokeLinecap="round" strokeDasharray="94" strokeDashoffset="25" className="gauge-arc" />
                    <defs>
                      <linearGradient id="gCv" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ff4e6a" />
                        <stop offset="100%" stopColor="#ff8c42" />
                      </linearGradient>
                    </defs>
                    <circle cx="40" cy="45" r="3" fill="#ff6a5e" />
                  </svg>
                  <span className="gauge-label">Tối ưu CV</span>
                </div>
                <div className="gauge-item" id="gauge-interview">
                  <svg className="gauge-svg" viewBox="0 0 80 50" fill="none">
                    <path d="M10 45 A30 30 0 0 1 70 45" stroke="#2a2a4a" strokeWidth="6" strokeLinecap="round" />
                    <path d="M10 45 A30 30 0 0 1 70 45" stroke="url(#gInt)" strokeWidth="6" strokeLinecap="round" strokeDasharray="94" strokeDashoffset="20" className="gauge-arc" />
                    <defs>
                      <linearGradient id="gInt" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#00e676" />
                        <stop offset="100%" stopColor="#00bcd4" />
                      </linearGradient>
                    </defs>
                    <circle cx="40" cy="45" r="3" fill="#00e676" />
                  </svg>
                  <span className="gauge-label">Kỹ năng Phỏng vấn</span>
                </div>
                <div className="gauge-item" id="gauge-direction">
                  <svg className="gauge-svg" viewBox="0 0 80 50" fill="none">
                    <path d="M10 45 A30 30 0 0 1 70 45" stroke="#2a2a4a" strokeWidth="6" strokeLinecap="round" />
                    <path d="M10 45 A30 30 0 0 1 70 45" stroke="url(#gDir)" strokeWidth="6" strokeLinecap="round" strokeDasharray="94" strokeDashoffset="40" className="gauge-arc" />
                    <defs>
                      <linearGradient id="gDir" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f9c74f" />
                        <stop offset="100%" stopColor="#f8961e" />
                      </linearGradient>
                    </defs>
                    <circle cx="40" cy="45" r="3" fill="#f9c74f" />
                  </svg>
                  <span className="gauge-label">Định hướng</span>
                </div>
              </div>

              <div className="chart-area" id="chart-area">
                <p className="chart-label">Tiến độ học tập và phỏng vấn</p>
                <svg className="chart-svg" viewBox="0 0 300 80" preserveAspectRatio="none">
                  <line x1="0" y1="20" x2="300" y2="20" stroke="#2a2a4a" strokeWidth="0.5" />
                  <line x1="0" y1="40" x2="300" y2="40" stroke="#2a2a4a" strokeWidth="0.5" />
                  <line x1="0" y1="60" x2="300" y2="60" stroke="#2a2a4a" strokeWidth="0.5" />
                  <polyline points="0,70 40,55 80,40 120,50 160,30 200,45 240,20 300,35" fill="none" stroke="#ff4e9a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <polygon points="0,70 40,55 80,40 120,50 160,30 200,45 240,20 300,35 300,80 0,80" fill="url(#chartFill1)" opacity="0.2" />
                  <polyline points="0,60 40,65 80,55 120,60 160,50 200,35 240,45 300,15" fill="none" stroke="#7c4dff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <polygon points="0,60 40,65 80,55 120,60 160,50 200,35 240,45 300,15 300,80 0,80" fill="url(#chartFill2)" opacity="0.15" />
                  <defs>
                    <linearGradient id="chartFill1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff4e9a" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#ff4e9a" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="chartFill2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c4dff" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#7c4dff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="icon-row-section" id="icon-row-section">
        <div className="icon-row" id="icon-row">
          <button className="icon-btn" id="icon-cv-btn" aria-label="CV">
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24">
              <path d="M12 3L4 7v10l8 4 8-4V7l-8-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M12 3v18M4 7l8 4 8-4" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button className="icon-btn" id="icon-location-btn" aria-label="Jobs">
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24">
              <path d="M12 21s-7-6.686-7-11A7 7 0 0 1 19 10c0 4.314-7 11-7 11z" stroke="#ff4e6a" strokeWidth="1.5" />
              <circle cx="12" cy="10" r="2.5" stroke="#ff4e6a" strokeWidth="1.5" />
            </svg>
          </button>
          <button className="icon-btn" id="icon-megaphone-btn" aria-label="Interview">
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3z" stroke="#c084fc" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M17 9a4 4 0 0 1 0 6" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M19.5 6.5a8 8 0 0 1 0 11" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button className="icon-btn" id="icon-search-btn" aria-label="Search">
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </section>

      <section className="agent-section" id="agent-section">
        <div className="agent-card" id="agent-card">
          <div className="agent-visual" id="agent-visual">
            <div className="ai-card-outer">
              <div className="ai-card-back" />
              <div className="ai-card-inner" id="ai-card-inner">
                <span className="ai-label">AI</span>
              </div>
            </div>
          </div>

          <div className="agent-info" id="agent-info">
            <h2 className="agent-title" id="agent-title">
              Agent AI – Trí Tuệ
              <br />
              Nhân Tạo hỗ trợ
            </h2>
            <div className="features-grid" id="features-grid">
              <div className="feature-item" id="feature-optimize">
                <div className="feature-icon">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>
                <div>
                  <p className="feature-name">Tự động</p>
                  <p className="feature-desc">tối ưu</p>
                </div>
              </div>
              <div className="feature-item" id="feature-deep-interview">
                <div className="feature-icon feature-icon-purple">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="feature-name">Phỏng vấn</p>
                  <p className="feature-desc">sâu</p>
                </div>
              </div>
              <div className="feature-item" id="feature-career">
                <div className="feature-icon feature-icon-cyan">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <path d="M4 19h16M6 19V8h12v11M9 8V6h6v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="feature-name">Định hướng</p>
                  <p className="feature-desc">nghề nghiệp</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
