/* ===========================
   CAREER COPILOT X – app.js
   =========================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ============================================================
     ⭐  CANVAS SPACE BACKGROUND  ⭐
     Full-page starfield with twinkling + shooting stars
  ============================================================ */
  const canvas = document.getElementById('space-canvas');
  const ctx    = canvas.getContext('2d');

  let W, H;
  const STAR_COUNT      = 380;   // regular stars
  const BIG_STAR_COUNT  = 70;    // glowing star clusters
  const EDGE_STAR_COUNT = 120;   // concentrated along side edges
  const stars           = [];
  const bigStars        = [];
  const edgeStars       = [];    // extra stars on left/right sides
  const shootingStars   = [];

  /* Resize canvas to fill window */
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', () => { resize(); initStars(); });
  resize();

  /* ---------- Star colors ---------- */
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

  /* ---------- Init small stars ---------- */
  function initStars() {
    stars.length = 0;
    bigStars.length = 0;
    edgeStars.length = 0;

    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x:      Math.random() * W,
        y:      Math.random() * H,
        r:      Math.random() * 1.2 + 0.3,
        color:  randColor(),
        alpha:  Math.random() * 0.6 + 0.3,
        twinkleSpeed: Math.random() * 0.015 + 0.005,
        twinkleDir:   Math.random() > 0.5 ? 1 : -1,
        twinkleMin:   Math.random() * 0.15 + 0.1,
        twinkleMax:   Math.random() * 0.3  + 0.65,
      });
    }

    /* Edge-concentrated stars – denser near left/right margins */
    for (let i = 0; i < EDGE_STAR_COUNT; i++) {
      const onLeft = i % 2 === 0;
      // Exponential distribution: more stars close to edge
      const edgeDist = Math.pow(Math.random(), 1.8) * W * 0.22;
      edgeStars.push({
        x:      onLeft ? edgeDist : W - edgeDist,
        y:      Math.random() * H,
        r:      Math.random() * 1.5 + 0.4,
        color:  randColor(),
        alpha:  Math.random() * 0.55 + 0.35,
        twinkleSpeed: Math.random() * 0.018 + 0.006,
        twinkleDir:   Math.random() > 0.5 ? 1 : -1,
        twinkleMin:   0.18,
        twinkleMax:   0.90,
        glow:   Math.random() > 0.6 ? Math.random() * 4 + 1 : 0,
      });
    }

    /* Slightly bigger, more vivid stars */
    for (let i = 0; i < BIG_STAR_COUNT; i++) {
      bigStars.push({
        x:      Math.random() * W,
        y:      Math.random() * H,
        r:      Math.random() * 2.2 + 1.0,
        color:  randColor(),
        alpha:  Math.random() * 0.5 + 0.4,
        glow:   Math.random() * 8  + 3,
        twinkleSpeed: Math.random() * 0.02  + 0.006,
        twinkleDir:   Math.random() > 0.5 ? 1 : -1,
        twinkleMin:   0.2,
        twinkleMax:   1.0,
      });
    }
  }
  initStars();

  /* ---------- Shooting stars ---------- */
  function spawnShootingStar() {
    // Spawn from left or right edge (or top-sides) with a diagonal angle
    const fromLeft = Math.random() > 0.5;
    const startX   = fromLeft
      ? Math.random() * W * 0.3                    // left third
      : W * 0.7 + Math.random() * W * 0.3;         // right third
    const startY   = Math.random() * H * 0.55;     // upper half
    const angle    = fromLeft
      ? (Math.PI / 180) * (30 + Math.random() * 25)   // heading down-right
      : (Math.PI / 180) * (150 + Math.random() * 25); // heading down-left
    const speed    = 8 + Math.random() * 10;
    const len      = 80  + Math.random() * 140;

    shootingStars.push({
      x:     startX,
      y:     startY,
      vx:    Math.cos(angle) * speed,
      vy:    Math.sin(angle) * speed,
      len:   len,
      alpha: 1,
      fade:  0.025 + Math.random() * 0.02,
      tail:  [], // history positions
      tailMax: Math.round(len / speed) + 2,
      color: Math.random() > 0.6 ? '#a78bfa' : '#ffffff',
      width: 1.5 + Math.random() * 1.2,
    });
  }

  /* Schedule next shooting star: 3-9 seconds */
  function scheduleShootingStar() {
    const delay = 3000 + Math.random() * 6000;
    setTimeout(() => {
      spawnShootingStar();
      scheduleShootingStar();
    }, delay);
  }
  scheduleShootingStar();
  // Spawn 1 immediately after a short pause so it feels alive
  setTimeout(spawnShootingStar, 800);

  /* ---------- Draw loop ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);

    /* ── Deep space gradient background ── */
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0,   '#040514');
    bg.addColorStop(0.5, '#06071a');
    bg.addColorStop(1,   '#080924');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* ── Nebula clouds on sides ── */
    // Left nebula – purple
    const nl = ctx.createRadialGradient(0, H * 0.38, 0, 0, H * 0.38, W * 0.34);
    nl.addColorStop(0,    'rgba(100, 60, 220, 0.13)');
    nl.addColorStop(0.45, 'rgba(80,  40, 180, 0.06)');
    nl.addColorStop(1,    'rgba(0,   0,   0,  0)');
    ctx.fillStyle = nl;
    ctx.fillRect(0, 0, W, H);

    // Right nebula – cyan/teal
    const nr = ctx.createRadialGradient(W, H * 0.58, 0, W, H * 0.58, W * 0.34);
    nr.addColorStop(0,    'rgba(0, 180, 220, 0.10)');
    nr.addColorStop(0.45, 'rgba(40, 100, 200, 0.05)');
    nr.addColorStop(1,    'rgba(0,   0,   0,  0)');
    ctx.fillStyle = nr;
    ctx.fillRect(0, 0, W, H);

    // Bottom-left nebula – deep violet accent
    const nb = ctx.createRadialGradient(W * 0.1, H * 0.85, 0, W * 0.1, H * 0.85, W * 0.25);
    nb.addColorStop(0,    'rgba(120, 40, 200, 0.09)');
    nb.addColorStop(1,    'rgba(0,   0,   0,  0)');
    ctx.fillStyle = nb;
    ctx.fillRect(0, 0, W, H);

    /* ── Edge stars (denser on sides) ── */
    for (const s of edgeStars) {
      s.alpha += s.twinkleSpeed * s.twinkleDir;
      if (s.alpha >= s.twinkleMax) { s.alpha = s.twinkleMax; s.twinkleDir = -1; }
      if (s.alpha <= s.twinkleMin) { s.alpha = s.twinkleMin; s.twinkleDir =  1; }

      if (s.glow > 0) {
        const eg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r + s.glow);
        eg.addColorStop(0,   `${s.color},${(s.alpha * 0.9).toFixed(2)})`);
        eg.addColorStop(1,   `${s.color},0)`);
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

    /* ── Small stars with twinkle ── */
    for (const s of stars) {
      s.alpha += s.twinkleSpeed * s.twinkleDir;
      if (s.alpha >= s.twinkleMax) { s.alpha = s.twinkleMax; s.twinkleDir = -1; }
      if (s.alpha <= s.twinkleMin) { s.alpha = s.twinkleMin; s.twinkleDir =  1; }

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `${s.color},${s.alpha.toFixed(2)})`;
      ctx.fill();
    }

    /* ── Big glowing stars ── */
    for (const s of bigStars) {
      s.alpha += s.twinkleSpeed * s.twinkleDir;
      if (s.alpha >= s.twinkleMax) { s.alpha = s.twinkleMax; s.twinkleDir = -1; }
      if (s.alpha <= s.twinkleMin) { s.alpha = s.twinkleMin; s.twinkleDir =  1; }

      const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r + s.glow);
      grd.addColorStop(0,   `${s.color},${(s.alpha).toFixed(2)})`);
      grd.addColorStop(0.4, `${s.color},${(s.alpha * 0.4).toFixed(2)})`);
      grd.addColorStop(1,   `${s.color},0)`);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r + s.glow, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `${s.color},${Math.min(s.alpha * 1.4, 1).toFixed(2)})`;
      ctx.fill();
    }

    /* ── Shooting stars ── */
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const m = shootingStars[i];

      // Record tail
      m.tail.push({ x: m.x, y: m.y });
      if (m.tail.length > m.tailMax) m.tail.shift();

      // Draw gradient tail
      if (m.tail.length > 1) {
        const tail0 = m.tail[0];
        const tail1 = m.tail[m.tail.length - 1];
        const grad  = ctx.createLinearGradient(tail0.x, tail0.y, tail1.x, tail1.y);
        grad.addColorStop(0, `rgba(255,255,255,0)`);
        grad.addColorStop(0.6, m.color === '#a78bfa'
          ? `rgba(167,139,250,${(m.alpha * 0.6).toFixed(2)})`
          : `rgba(255,255,255,${(m.alpha * 0.55).toFixed(2)})`);
        grad.addColorStop(1, m.color === '#a78bfa'
          ? `rgba(200,180,255,${m.alpha.toFixed(2)})`
          : `rgba(255,255,255,${m.alpha.toFixed(2)})`);

        ctx.beginPath();
        ctx.moveTo(m.tail[0].x, m.tail[0].y);
        for (let t = 1; t < m.tail.length; t++) {
          ctx.lineTo(m.tail[t].x, m.tail[t].y);
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth   = m.width;
        ctx.lineCap     = 'round';
        ctx.stroke();
      }

      // Draw head glow
      const headGrd = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 5);
      headGrd.addColorStop(0, `rgba(255,255,255,${m.alpha.toFixed(2)})`);
      headGrd.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.beginPath();
      ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = headGrd;
      ctx.fill();

      // Move
      m.x += m.vx;
      m.y += m.vy;
      m.alpha -= m.fade;

      // Remove when faded or off-screen
      if (m.alpha <= 0 || m.x < -60 || m.x > W + 60 || m.y > H + 60) {
        shootingStars.splice(i, 1);
      }
    }

    requestAnimationFrame(draw);
  }
  draw();

  /* ============================================================
     🎛  REST OF UI LOGIC
  ============================================================ */

  /* ── Hamburger menu ── */
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      const open = navLinks.style.display === 'flex';
      navLinks.style.display = open ? 'none' : 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '56px';
      navLinks.style.left = '0';
      navLinks.style.right = '0';
      navLinks.style.background = 'rgba(8,9,28,0.97)';
      navLinks.style.padding = '12px 20px 20px';
      navLinks.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
    });
  }

  /* ── Tab switching ── */
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  /* ── Gauge animation on load ── */
  const gaugeArcs = document.querySelectorAll('.gauge-arc');
  setTimeout(() => {
    gaugeArcs.forEach(arc => {
      arc.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
    });
  }, 300);

  /* ── Intersection Observer for fade-in ── */
  const style = document.createElement('style');
  style.textContent = `
    .fade-in {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.6s ease, transform 0.6s ease;
    }
    .fade-in.visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);

  const observer = new IntersectionObserver(
    (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
    { threshold: 0.1 }
  );
  document.querySelectorAll('.dashboard-card, .icon-row-section, .agent-card').forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
  });

  /* ── Scroll navbar effect ── */
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.style.background = window.scrollY > 20
      ? 'rgba(6,7,26,0.96)'
      : 'rgba(8,9,28,0.78)';
  });

  /* ── Button ripple ── */
  function addRipple(btn) {
    btn.addEventListener('click', function (e) {
      const ripple = document.createElement('span');
      const rect   = btn.getBoundingClientRect();
      ripple.style.cssText = `
        position:absolute; border-radius:50%; background:rgba(255,255,255,0.25);
        width:120px; height:120px;
        top:${e.clientY - rect.top - 60}px;
        left:${e.clientX - rect.left - 60}px;
        transform:scale(0); animation:ripple 0.5s linear;
        pointer-events:none;
      `;
      btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  }
  const rippleStyle = document.createElement('style');
  rippleStyle.textContent = `@keyframes ripple { to { transform:scale(2.5); opacity:0; } }`;
  document.head.appendChild(rippleStyle);
  document.querySelectorAll('.btn-primary, .btn-outline, .icon-btn').forEach(addRipple);

  /* ── Cursor glow (desktop) ── */
  if (window.innerWidth > 768) {
    const glow = document.createElement('div');
    glow.style.cssText = `
      position:fixed; width:500px; height:500px; border-radius:50%;
      background:radial-gradient(circle, rgba(124,77,255,0.055) 0%, transparent 68%);
      pointer-events:none; z-index:0; transform:translate(-50%,-50%);
      transition:left 0.12s ease, top 0.12s ease; will-change:left,top;
    `;
    document.body.appendChild(glow);
    document.addEventListener('mousemove', (e) => {
      glow.style.left = e.clientX + 'px';
      glow.style.top  = e.clientY + 'px';
    });
  }

  /* ============================================================
     🔐  LOGIN MODAL
  ============================================================ */
  const overlay      = document.getElementById('modal-overlay');
  const modalCard    = document.getElementById('modal-card');
  const btnLogin     = document.getElementById('btn-login');
  const modalClose   = document.getElementById('modal-close');
  const loginForm    = document.getElementById('login-form');
  const inputEmail   = document.getElementById('input-email');
  const inputPwd     = document.getElementById('input-password');
  const emailError   = document.getElementById('email-error');
  const pwdError     = document.getElementById('password-error');
  const submitBtn    = document.getElementById('btn-submit');
  const togglePwd    = document.getElementById('toggle-password');
  const googleBtn    = document.getElementById('btn-google-login');

  /* ── Open / Close ── */
  function openModal() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => inputEmail && inputEmail.focus(), 350);
  }
  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    resetForm();
  }

  if (btnLogin)    btnLogin.addEventListener('click', openModal);
  if (modalClose)  modalClose.addEventListener('click', closeModal);

  // Close on overlay click (outside card)
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) closeModal();
  });

  /* ── Form reset ── */
  function resetForm() {
    if (!loginForm) return;
    loginForm.reset();
    clearError(inputEmail, emailError);
    clearError(inputPwd, pwdError);
    submitBtn && submitBtn.classList.remove('loading');
    submitBtn && (submitBtn.disabled = false);
  }

  /* ── Validation helpers ── */
  function setError(input, errorEl, msg) {
    if (!input || !errorEl) return;
    input.classList.add('error');
    errorEl.textContent = msg;
  }
  function clearError(input, errorEl) {
    if (!input || !errorEl) return;
    input.classList.remove('error');
    errorEl.textContent = '';
  }
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }

  // Live clear errors on input
  inputEmail && inputEmail.addEventListener('input', () => clearError(inputEmail, emailError));
  inputPwd   && inputPwd.addEventListener('input',   () => clearError(inputPwd, pwdError));

  /* ── Password toggle ── */
  if (togglePwd && inputPwd) {
    togglePwd.addEventListener('click', () => {
      const isHidden = inputPwd.type === 'password';
      inputPwd.type  = isHidden ? 'text' : 'password';
      // Swap icon: eye vs eye-off
      togglePwd.querySelector('svg').innerHTML = isHidden
        ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
           <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
           <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`
        : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5"/>
           <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>`;
    });
  }

  /* ── Toast helper ── */
  function showToast(msg, type = 'info') {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => t.classList.add('show'));
    });
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 350);
    }, 3200);
  }

  /* ── Form submit ── */
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;

      const email = inputEmail ? inputEmail.value.trim() : '';
      const pwd   = inputPwd   ? inputPwd.value         : '';

      clearError(inputEmail, emailError);
      clearError(inputPwd,   pwdError);

      if (!email) {
        setError(inputEmail, emailError, 'Vui lòng nhập email.');
        valid = false;
      } else if (!isValidEmail(email)) {
        setError(inputEmail, emailError, 'Email không hợp lệ.');
        valid = false;
      }
      if (!pwd) {
        setError(inputPwd, pwdError, 'Vui lòng nhập mật khẩu.');
        valid = false;
      } else if (pwd.length < 6) {
        setError(inputPwd, pwdError, 'Mật khẩu phải có ít nhất 6 ký tự.');
        valid = false;
      }

      if (!valid) return;

      // Simulate loading
      if (submitBtn) {
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
      }

      setTimeout(() => {
        if (submitBtn) {
          submitBtn.classList.remove('loading');
          submitBtn.disabled = false;
        }
        // Demo: show success toast and close
        closeModal();
        showToast('🎉 Đăng nhập thành công! Chào mừng bạn.', 'success');
      }, 1600);
    });
  }

  /* ── Google login ── */
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      // Ripple effect on Google button
      googleBtn.style.position = 'relative';
      googleBtn.style.overflow = 'hidden';
      const r = document.createElement('span');
      r.style.cssText = `
        position:absolute; border-radius:50%; background:rgba(255,255,255,0.15);
        width:200px; height:200px; top:50%; left:50%;
        transform:translate(-50%,-50%) scale(0);
        animation:ripple 0.5s linear; pointer-events:none;
      `;
      googleBtn.appendChild(r);
      setTimeout(() => r.remove(), 600);

      // Simulate Google OAuth loading
      googleBtn.textContent = '';
      const spinner = document.createElement('span');
      spinner.style.cssText = `
        display:inline-block; width:18px; height:18px;
        border:2.5px solid rgba(255,255,255,0.3); border-top-color:#fff;
        border-radius:50%; animation:spin 0.7s linear infinite;
      `;
      googleBtn.appendChild(spinner);
      const label = document.createElement('span');
      label.textContent = 'Đang kết nối...';
      googleBtn.appendChild(label);
      googleBtn.disabled = true;

      setTimeout(() => {
        googleBtn.disabled = false;
        // Re-render original content
        googleBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          <span>Tiếp tục với Google</span>`;
        closeModal();
        showToast('✅ Đăng nhập Google thành công!', 'success');
      }, 1800);
    });
  }

  /* ── Forgot password ── */
  const forgotLink = document.getElementById('forgot-link');
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('📧 Tính năng đặt lại mật khẩu sẽ sớm ra mắt!', 'info');
    });
  }

  /* ── Register link ── */
  const registerLink = document.getElementById('register-link');
  if (registerLink) {
    registerLink.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
      showToast('✨ Trang đăng ký sẽ sớm ra mắt!', 'info');
    });
  }

  console.log('🚀 Career Copilot X – Space background active!');
});
