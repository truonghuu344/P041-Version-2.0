/* ============================================================
   CAREER COPILOT X – app.js
   Deep Space Starfield + Shooting Stars Animation Engine
   FastAPI Backend Integration (PostgreSQL)
   ============================================================ */

const API_BASE_URL = 'http://localhost:8000/api/v1';

class ApiClient {
  static getToken() {
    return localStorage.getItem('access_token');
  }

  static setToken(token) {
    localStorage.setItem('access_token', token);
  }

  static getUser() {
    const u = localStorage.getItem('user_info');
    return u ? JSON.parse(u) : null;
  }

  static setUser(user) {
    localStorage.setItem('user_info', JSON.stringify(user));
  }

  static logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
  }

  static async request(endpoint, options = {}) {
    const headers = options.headers || {};
    const token = this.getToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const config = { ...options, headers };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.detail || data.message || `Lỗi HTTP ${response.status}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  // --- Auth APIs ---
  static async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.access_token) {
      this.setToken(data.access_token);
      this.setUser(data.user);
    }
    return data;
  }

  static async register(email, password, fullName, role = 'student') {
    return await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName, role }),
    });
  }

  static async getMe() {
    const user = await this.request('/auth/me');
    this.setUser(user);
    return user;
  }

  // --- CV APIs ---
  static async uploadCV(file, title = '') {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);

    return await this.request('/cvs/upload', {
      method: 'POST',
      body: formData,
    });
  }

  static async listCVs() {
    return await this.request('/cvs');
  }

  // --- JD APIs ---
  static async listJDs() {
    return await this.request('/jds');
  }

  static async createCustomJD(title, company, location, requirementsText) {
    return await this.request('/jds/custom', {
      method: 'POST',
      body: JSON.stringify({
        title,
        company,
        location,
        requirements_text: requirementsText,
      }),
    });
  }

  // --- Gap Analysis APIs ---
  static async runGapAnalysis(cvId, jdId) {
    return await this.request('/analysis/gap-analysis', {
      method: 'POST',
      body: JSON.stringify({ cv_id: cvId, jd_id: jdId }),
    });
  }

  // --- Mock Interview APIs ---
  static async startInterview(cvId, jdId, totalQuestions = 5) {
    return await this.request('/interviews/start', {
      method: 'POST',
      body: JSON.stringify({ cv_id: cvId, jd_id: jdId, total_questions: totalQuestions }),
    });
  }

  static async submitAnswer(sessionId, userAnswer) {
    return await this.request(`/interviews/${sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ user_answer: userAnswer }),
    });
  }

  static async getInterviewReport(sessionId) {
    return await this.request(`/interviews/${sessionId}/report`);
  }
}


/* ============================================================
   ⭐  CANVAS DEEP SPACE + SHOOTING STARS ENGINE  ⭐
============================================================ */
function initSpaceCanvas() {
  const canvas = document.getElementById('space-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H;
  // Restore a dense, clearly visible star field around the focal planets.
  const STAR_COUNT = 600;
  const BIG_STAR_COUNT = 100;
  const EDGE_STAR_COUNT = 190;
  const PARTICLE_COUNT = 40;
  const stars = [], bigStars = [], edgeStars = [], shootingStars = [], particles = [];

  // 🪐 3D DYNAMIC SPACE PLANETS (Canvas Render Engine)
  const spacePlanets = [
    {
      type: 'saturn',
      baseX: 0.16,
      baseY: 0.22,
      radius: 46,
      depth: 0.75,
      rotation: -0.42,
      driftAngle: 0,
      driftSpeed: 0.0003,
      opacity: 0.58,
    },
    {
      type: 'neptune',
      baseX: 0.84,
      baseY: 0.20,
      radius: 44,
      depth: 0.65,
      rotation: 0.12,
      driftAngle: 1.2,
      driftSpeed: 0.00022,
      opacity: 0.52,
    },
    {
      type: 'mars',
      baseX: 0.81,
      baseY: 0.64,
      radius: 38,
      depth: 0.85,
      rotation: 0.08,
      driftAngle: 2.4,
      driftSpeed: 0.00038,
      opacity: 0.48,
    }
  ];

  function drawCanvasPlanet(p, px, py) {
    ctx.save();
    ctx.translate(px, py);

    if (p.type === 'saturn') {
      ctx.rotate(p.rotation);

      // 1. Back Ring
      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius * 2.2, p.radius * 0.6, 0, Math.PI, 2 * Math.PI);
      const ringGradBack = ctx.createLinearGradient(-p.radius * 2.2, 0, p.radius * 2.2, 0);
      ringGradBack.addColorStop(0, 'rgba(190, 170, 145, 0.45)');
      ringGradBack.addColorStop(0.5, 'rgba(140, 120, 95, 0.22)');
      ringGradBack.addColorStop(1, 'rgba(90, 75, 60, 0.12)');
      ctx.strokeStyle = ringGradBack;
      ctx.lineWidth = 14;
      ctx.stroke();

      // 2. Planet Sphere Base
      const bodyGrad = ctx.createRadialGradient(-p.radius * 0.35, -p.radius * 0.35, p.radius * 0.1, 0, 0, p.radius);
      bodyGrad.addColorStop(0, '#e8dac8');
      bodyGrad.addColorStop(0.35, '#c4ab90');
      bodyGrad.addColorStop(0.7, '#866f56');
      bodyGrad.addColorStop(1, '#2c1e14');
      
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // 3. Surface Bands
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(120, 95, 70, 0.35)';
      ctx.fillRect(-p.radius, -p.radius * 0.2, p.radius * 2, p.radius * 0.22);
      ctx.fillStyle = 'rgba(90, 70, 50, 0.4)';
      ctx.fillRect(-p.radius, p.radius * 0.15, p.radius * 2, p.radius * 0.25);
      
      // Top-Left Light Source Shadow
      const shadowGrad = ctx.createRadialGradient(-p.radius * 0.3, -p.radius * 0.3, p.radius * 0.4, 0, 0, p.radius * 1.05);
      shadowGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
      shadowGrad.addColorStop(0.4, 'rgba(0,0,0,0)');
      shadowGrad.addColorStop(0.75, 'rgba(4,5,13,0.65)');
      shadowGrad.addColorStop(1, 'rgba(2,3,10,0.95)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4. Front Ring
      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius * 2.2, p.radius * 0.6, 0, 0, Math.PI);
      const ringGradFront = ctx.createLinearGradient(-p.radius * 2.2, 0, p.radius * 2.2, 0);
      ringGradFront.addColorStop(0, 'rgba(200, 180, 155, 0.65)');
      ringGradFront.addColorStop(0.5, 'rgba(150, 130, 105, 0.40)');
      ringGradFront.addColorStop(1, 'rgba(90, 75, 60, 0.20)');
      ctx.strokeStyle = ringGradFront;
      ctx.lineWidth = 14;
      ctx.stroke();

    } else if (p.type === 'neptune') {
      // 1. Icy atmosphere haze
      const hazeGrad = ctx.createRadialGradient(0, 0, p.radius * 0.8, 0, 0, p.radius * 1.3);
      hazeGrad.addColorStop(0, 'rgba(54, 126, 255, 0.25)');
      hazeGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = hazeGrad;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // 2. Planet Sphere Base
      const bodyGrad = ctx.createRadialGradient(-p.radius * 0.35, -p.radius * 0.35, p.radius * 0.1, 0, 0, p.radius);
      bodyGrad.addColorStop(0, '#9ee4ff');
      bodyGrad.addColorStop(0.3, '#4d9cff');
      bodyGrad.addColorStop(0.65, '#1c4cb8');
      bodyGrad.addColorStop(1, '#07174d');
      
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // 3. Blue atmospheric bands
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(132, 211, 255, 0.28)';
      ctx.fillRect(-p.radius, -p.radius * 0.3, p.radius * 2, p.radius * 0.25);
      ctx.fillStyle = 'rgba(8, 55, 159, 0.52)';
      ctx.fillRect(-p.radius, 0, p.radius * 2, p.radius * 0.28);
      ctx.fillStyle = 'rgba(78, 142, 255, 0.35)';
      ctx.fillRect(-p.radius, p.radius * 0.35, p.radius * 2, p.radius * 0.22);

      // Top-Left Light Source Shadow
      const shadowGrad = ctx.createRadialGradient(-p.radius * 0.3, -p.radius * 0.3, p.radius * 0.4, 0, 0, p.radius * 1.05);
      shadowGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
      shadowGrad.addColorStop(0.4, 'rgba(0,0,0,0)');
      shadowGrad.addColorStop(0.75, 'rgba(4,5,13,0.65)');
      shadowGrad.addColorStop(1, 'rgba(2,3,10,0.95)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

    } else if (p.type === 'mars') {
      // 1. Fiery Haze Glow
      const hazeGrad = ctx.createRadialGradient(0, 0, p.radius * 0.7, 0, 0, p.radius * 1.35);
      hazeGrad.addColorStop(0, 'rgba(200, 80, 30, 0.22)');
      hazeGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = hazeGrad;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // 2. Planet Sphere Base
      const bodyGrad = ctx.createRadialGradient(-p.radius * 0.35, -p.radius * 0.35, p.radius * 0.1, 0, 0, p.radius);
      bodyGrad.addColorStop(0, '#e29468');
      bodyGrad.addColorStop(0.35, '#b05028');
      bodyGrad.addColorStop(0.7, '#782410');
      bodyGrad.addColorStop(1, '#2a0802');
      
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // 3. Surface Dark Features
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(68, 16, 5, 0.45)';
      ctx.beginPath();
      ctx.arc(-p.radius * 0.2, p.radius * 0.1, p.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Top-Left Light Source Shadow
      const shadowGrad = ctx.createRadialGradient(-p.radius * 0.3, -p.radius * 0.3, p.radius * 0.4, 0, 0, p.radius * 1.05);
      shadowGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
      shadowGrad.addColorStop(0.4, 'rgba(0,0,0,0)');
      shadowGrad.addColorStop(0.75, 'rgba(4,5,13,0.65)');
      shadowGrad.addColorStop(1, 'rgba(2,3,10,0.96)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', () => { resize(); initStars(); });
  resize();

  const STAR_COLORS = [
    'rgba(255,255,255', 'rgba(200,200,255', 'rgba(180,220,255',
    'rgba(255,200,220', 'rgba(220,200,255', 'rgba(180,255,240',
  ];
  function randColor() {
    return STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
  }

  function initStars() {
    stars.length = 0; bigStars.length = 0; edgeStars.length = 0; particles.length = 0;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.3 + 0.3,
        color: randColor(), alpha: Math.random() * 0.6 + 0.3,
        twinkleSpeed: Math.random() * 0.015 + 0.005, twinkleDir: Math.random() > 0.5 ? 1 : -1,
        twinkleMin: Math.random() * 0.15 + 0.1, twinkleMax: Math.random() * 0.3 + 0.7,
      });
    }

    for (let i = 0; i < EDGE_STAR_COUNT; i++) {
      const onLeft = i % 2 === 0;
      const edgeDist = Math.pow(Math.random(), 1.8) * W * 0.25;
      edgeStars.push({
        x: onLeft ? edgeDist : W - edgeDist,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.4,
        color: randColor(),
        alpha: Math.random() * 0.55 + 0.35,
        twinkleSpeed: Math.random() * 0.018 + 0.006,
        twinkleDir: Math.random() > 0.5 ? 1 : -1,
        twinkleMin: 0.18, twinkleMax: 0.9,
        glow: Math.random() > 0.6 ? Math.random() * 4 + 1 : 0,
      });
    }

    for (let i = 0; i < BIG_STAR_COUNT; i++) {
      bigStars.push({
        x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2.2 + 1.0,
        color: randColor(), alpha: Math.random() * 0.5 + 0.4, glow: Math.random() * 8 + 3,
        twinkleSpeed: Math.random() * 0.02 + 0.006, twinkleDir: Math.random() > 0.5 ? 1 : -1,
        twinkleMin: 0.2, twinkleMax: 1.0,
      });
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.4 + 0.6,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35 - 0.15,
        alpha: Math.random() * 0.22 + 0.08,
        color: Math.random() > 0.5 ? 'rgba(185, 140, 255' : 'rgba(131, 232, 255'
      });
    }
  }
  initStars();

  // Shooting Star Spawner (Sao Băng)
  function spawnShootingStar() {
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? Math.random() * W * 0.3 : W * 0.7 + Math.random() * W * 0.3;
    const startY = Math.random() * H * 0.5;
    const angle = fromLeft ? (Math.PI / 180) * (30 + Math.random() * 25) : (Math.PI / 180) * (150 + Math.random() * 25);
    const speed = 9 + Math.random() * 11;
    const len = 90 + Math.random() * 150;

    shootingStars.push({
      x: startX, y: startY,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      len: len, alpha: 1, fade: 0.018 + Math.random() * 0.018,
      color: Math.random() > 0.5 ? '#00e5ff' : (Math.random() > 0.5 ? '#a78bfa' : '#ffffff'),
      width: 1.8 + Math.random() * 1.5,
    });
  }

  function scheduleShootingStar() {
    const delay = 1200 + Math.random() * 2500;
    setTimeout(() => {
      spawnShootingStar();
      scheduleShootingStar();
    }, delay);
  }
  scheduleShootingStar();
  spawnShootingStar();
  setTimeout(spawnShootingStar, 600);

  let targetCamX = 0, targetCamY = 0;
  let currentCamX = 0, currentCamY = 0;

  window.addEventListener('mousemove', (e) => {
    const mouseX = (e.clientX / (W || window.innerWidth) - 0.5) * 2;
    const mouseY = (e.clientY / (H || window.innerHeight) - 0.5) * 2;
    targetCamX = mouseX * 45;
    targetCamY = mouseY * 30;

    // Parallax mirrors the star field: nearby Saturn shifts more, while the
    // distant Mars has a gentler, star-like drift.
    const saturn = document.getElementById('planet-saturn');
    const neptune = document.getElementById('planet-neptune');
    const mars = document.getElementById('planet-mars');

    if (saturn) {
      saturn.style.setProperty('--planet-parallax-x', `${mouseX * 20}px`);
      saturn.style.setProperty('--planet-parallax-y', `${mouseY * 14}px`);
      saturn.style.setProperty('--planet-tilt', `${mouseX * 2.5}deg`);
      saturn.style.setProperty('--planet-scale', `${1.08 + Math.abs(mouseY) * 0.025}`);
    }
    if (neptune) {
      neptune.style.setProperty('--planet-parallax-x', `${mouseX * 12}px`);
      neptune.style.setProperty('--planet-parallax-y', `${mouseY * 9}px`);
      neptune.style.setProperty('--planet-tilt', `${mouseX * -1.8}deg`);
      neptune.style.setProperty('--planet-scale', `${0.94 + Math.abs(mouseY) * 0.018}`);
    }
    if (mars) {
      mars.style.setProperty('--planet-parallax-x', `${mouseX * 7}px`);
      mars.style.setProperty('--planet-parallax-y', `${mouseY * 5}px`);
      mars.style.setProperty('--planet-tilt', `${mouseX * 1.1}deg`);
      mars.style.setProperty('--planet-scale', `${0.76 + Math.abs(mouseY) * 0.012}`);
    }
  });

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Smooth lerp camera pan
    currentCamX += (targetCamX - currentCamX) * 0.06;
    currentCamY += (targetCamY - currentCamY) * 0.06;

    const isLight = document.body.classList.contains('light-mode') || 
                    document.documentElement.classList.contains('light-mode') ||
                    document.documentElement.getAttribute('data-theme') === 'light';

    if (isLight) {
      // 🌟 LIGHT UNIVERSE MORNING BASE GRADIENT (#F8FBFF -> #EEF5FF -> #DDEEFF)
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#f8fbff');
      bg.addColorStop(0.4, '#eef5ff');
      bg.addColorStop(1, '#ddeeff');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // 0. Draw Floating Space Dust Particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color},${p.alpha})`;
        ctx.fill();
      }

      // 1. Twinkling Morning Stars (100-200 stars, 1-3px, opacity 0.08~0.35, soft glows)
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.alpha += s.twinkleSpeed * s.twinkleDir;
        if (s.alpha >= s.twinkleMax) { s.alpha = s.twinkleMax; s.twinkleDir = -1; }
        if (s.alpha <= s.twinkleMin) { s.alpha = s.twinkleMin; s.twinkleDir = 1; }
        
        const ox = currentCamX * (s.r * 0.6);
        const oy = currentCamY * (s.r * 0.6);
        // Map alpha to 0.08 - 0.35 range exactly as requested
        const lAlpha = 0.08 + (s.alpha * 0.27);
        const lRadius = Math.min(3, Math.max(1, s.r * 1.2));

        const starColors = ['rgba(185,140,255', 'rgba(131,232,255', 'rgba(106,174,255', 'rgba(255,255,255'];
        const starColor = starColors[i % starColors.length];

        if (i % 4 === 0) {
          // Subtle halo glow for selected morning stars
          const rad = ctx.createRadialGradient(s.x + ox, s.y + oy, 0, s.x + ox, s.y + oy, lRadius + 3);
          rad.addColorStop(0, `${starColor},${lAlpha * 0.7})`);
          rad.addColorStop(1, 'transparent');
          ctx.fillStyle = rad;
          ctx.beginPath();
          ctx.arc(s.x + ox, s.y + oy, lRadius + 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, lRadius, 0, Math.PI * 2);
        ctx.fillStyle = `${starColor},${lAlpha})`;
        ctx.fill();
      }

      // 2. Edge stars in Light Mode
      for (let i = 0; i < edgeStars.length; i++) {
        const s = edgeStars[i];
        s.alpha += s.twinkleSpeed * s.twinkleDir;
        if (s.alpha >= s.twinkleMax) { s.alpha = s.twinkleMax; s.twinkleDir = -1; }
        if (s.alpha <= s.twinkleMin) { s.alpha = s.twinkleMin; s.twinkleDir = 1; }
        
        const ox = currentCamX * (s.r * 0.7);
        const oy = currentCamY * (s.r * 0.7);
        const lAlpha = 0.08 + (s.alpha * 0.25);
        const lRadius = Math.min(3, Math.max(1, s.r * 1.1));

        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, lRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(185,140,255,${lAlpha})`;
        ctx.fill();
      }

      // 3. Big glowing stars in Light Mode (soft cyan/purple glow)
      for (let i = 0; i < bigStars.length; i++) {
        const s = bigStars[i];
        s.alpha += s.twinkleSpeed * s.twinkleDir;
        if (s.alpha >= s.twinkleMax) { s.alpha = s.twinkleMax; s.twinkleDir = -1; }
        if (s.alpha <= s.twinkleMin) { s.alpha = s.twinkleMin; s.twinkleDir = 1; }

        const ox = currentCamX * (s.r * 0.95);
        const oy = currentCamY * (s.r * 0.95);
        const lAlpha = 0.1 + (s.alpha * 0.25);
        const lRadius = Math.min(3, Math.max(1.2, s.r * 0.9));

        const g = ctx.createRadialGradient(s.x + ox, s.y + oy, 0, s.x + ox, s.y + oy, lRadius + s.glow * 0.35);
        g.addColorStop(0, `rgba(131,232,255,${lAlpha * 0.5})`);
        g.addColorStop(0.5, `rgba(185,140,255,${lAlpha * 0.2})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, lRadius + s.glow * 0.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, lRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${lAlpha * 1.2})`;
        ctx.fill();
      }

      // 4. Shooting Stars in Light Mode (pastel cyan/purple trails)
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const st = shootingStars[i];
        st.x += st.vx;
        st.y += st.vy;
        st.alpha -= st.fade;

        if (st.alpha <= 0 || st.x < 0 || st.x > W || st.y > H) {
          shootingStars.splice(i, 1);
          continue;
        }

        const dist = Math.hypot(st.vx, st.vy);
        const tailX = st.x - (st.vx / dist) * st.len;
        const tailY = st.y - (st.vy / dist) * st.len;

        const grad = ctx.createLinearGradient(st.x, st.y, tailX, tailY);
        grad.addColorStop(0, '#B98CFF');
        grad.addColorStop(0.3, `rgba(131,232,255,${st.alpha * 0.6})`);
        grad.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.moveTo(st.x, st.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = st.width * 0.9;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(st.x, st.y, st.width * 1.1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(185,140,255,0.8)';
        ctx.fill();
      }
    } else {
      // 🌌 DARK DEEP SPACE GRADIENT (#050816 -> #0A0F2C -> #120A2F)
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#050816');
      bg.addColorStop(0.5, '#0a0f2c');
      bg.addColorStop(1, '#120a2f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // 1. Draw twinkling stars with 3D depth perspective
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.alpha += s.twinkleSpeed * s.twinkleDir;
        if (s.alpha >= s.twinkleMax) { s.alpha = s.twinkleMax; s.twinkleDir = -1; }
        if (s.alpha <= s.twinkleMin) { s.alpha = s.twinkleMin; s.twinkleDir = 1; }
        
        const ox = currentCamX * (s.r * 0.6);
        const oy = currentCamY * (s.r * 0.6);
        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `${s.color},${s.alpha})`;
        ctx.fill();
      }

      // 2. Draw edge stars with 3D depth perspective
      for (let i = 0; i < edgeStars.length; i++) {
        const s = edgeStars[i];
        s.alpha += s.twinkleSpeed * s.twinkleDir;
        if (s.alpha >= s.twinkleMax) { s.alpha = s.twinkleMax; s.twinkleDir = -1; }
        if (s.alpha <= s.twinkleMin) { s.alpha = s.twinkleMin; s.twinkleDir = 1; }
        
        const ox = currentCamX * (s.r * 0.7);
        const oy = currentCamY * (s.r * 0.7);
        if (s.glow > 0) {
          const rad = ctx.createRadialGradient(s.x + ox, s.y + oy, 0, s.x + ox, s.y + oy, s.r + s.glow);
          rad.addColorStop(0, `${s.color},${s.alpha})`);
          rad.addColorStop(1, 'transparent');
          ctx.fillStyle = rad;
          ctx.beginPath();
          ctx.arc(s.x + ox, s.y + oy, s.r + s.glow, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `${s.color},${s.alpha})`;
        ctx.fill();
      }

      // 3. Draw big glowing stars with 3D depth perspective
      for (let i = 0; i < bigStars.length; i++) {
        const s = bigStars[i];
        s.alpha += s.twinkleSpeed * s.twinkleDir;
        if (s.alpha >= s.twinkleMax) { s.alpha = s.twinkleMax; s.twinkleDir = -1; }
        if (s.alpha <= s.twinkleMin) { s.alpha = s.twinkleMin; s.twinkleDir = 1; }

        const ox = currentCamX * (s.r * 0.95);
        const oy = currentCamY * (s.r * 0.95);

        const g = ctx.createRadialGradient(s.x + ox, s.y + oy, 0, s.x + ox, s.y + oy, s.r + s.glow);
        g.addColorStop(0, `${s.color},${s.alpha * 0.9})`);
        g.addColorStop(0.4, `${s.color},${s.alpha * 0.3})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, s.r + s.glow, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // 4. Draw Shooting Stars (Sao Băng)
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const st = shootingStars[i];
        st.x += st.vx;
        st.y += st.vy;
        st.alpha -= st.fade;

        if (st.alpha <= 0 || st.x < 0 || st.x > W || st.y > H) {
          shootingStars.splice(i, 1);
          continue;
        }

        const dist = Math.hypot(st.vx, st.vy);
        const tailX = st.x - (st.vx / dist) * st.len;
        const tailY = st.y - (st.vy / dist) * st.len;

        const grad = ctx.createLinearGradient(st.x, st.y, tailX, tailY);
        grad.addColorStop(0, st.color);
        grad.addColorStop(0.2, `rgba(255,255,255,${st.alpha * 0.8})`);
        grad.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.moveTo(st.x, st.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = st.width;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Bright comet head
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.width * 1.3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // Planets are DOM background elements so their crop, haze, and depth remain
      // stable against the viewport edges. The canvas is reserved for deep stars.
    }

    requestAnimationFrame(draw);
  }
  draw();
}


function startAppLogic() {
  initSpaceCanvas();

  /* ── Toast Notification Helper ── */
  function showToast(msg, type = 'info') {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 350);
    }, 3200);
  }

  /* ============================================================
     🚀 ROUTER & SINGLE PAGE VIEW SWITCHER
  ============================================================ */
  /* ============================================================
     🚀 ROUTER & SPACESHIP SINGLE PAGE VIEW SWITCHER
  ============================================================ */
  const VIEW_ORDER = ['dashboard', 'cv', 'jobs', 'interview', 'gap'];
  let currentViewName = 'dashboard';

  const views = {
    dashboard: document.getElementById('view-dashboard'),
    cv: document.getElementById('view-cv'),
    jobs: document.getElementById('view-jobs'),
    interview: document.getElementById('view-interview'),
    gap: document.getElementById('view-gap')
  };

  const navLinks = {
    dashboard: document.getElementById('nav-dashboard'),
    cv: document.getElementById('nav-cv'),
    jobs: document.getElementById('nav-jobs'),
    interview: document.getElementById('nav-interview'),
    gap: document.getElementById('nav-gap')
  };

  const roomTitles = {
    dashboard: 'COMMAND DECK // HOME',
    cv: 'DECK ALPHA // RESUME LAB',
    jobs: 'DECK BETA // CAREER MAP',
    interview: 'DECK GAMMA // SIMULATION CHAMBER',
    gap: 'DECK DELTA // NAVIGATION DECK',
    history: 'DECK EPSILON // MISSION ARCHIVE',
    profile: 'DECK ZETA // CREW TERMINAL'
  };

  function switchView(targetViewName) {
    if (!views[targetViewName]) targetViewName = 'dashboard';
    if (targetViewName === currentViewName && document.querySelector('.app-view.active')) return;

    const currentIndex = VIEW_ORDER.indexOf(currentViewName);
    const targetIndex = VIEW_ORDER.indexOf(targetViewName);
    const direction = targetIndex >= currentIndex ? 'right' : 'left';

    // Trigger Spaceship Corridor Hatch Sweep Line
    const corridorSweep = document.getElementById('spaceship-corridor-sweep');
    if (corridorSweep) {
      corridorSweep.classList.remove('sweep-left', 'sweep-right');
      void corridorSweep.offsetWidth; // Force reflow
      corridorSweep.classList.add(`sweep-${direction}`, 'active');
      setTimeout(() => corridorSweep.classList.remove('active'), 550);
    }

    const currentEl = views[currentViewName];
    const targetEl = views[targetViewName];

    // Animate current view out & target view in
    Object.keys(views).forEach(key => {
      const vEl = views[key];
      if (!vEl) return;

      vEl.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');

      if (key === targetViewName) {
        vEl.classList.add('active');
        vEl.classList.add(direction === 'right' ? 'slide-in-right' : 'slide-in-left');
      } else if (key === currentViewName) {
        vEl.classList.add(direction === 'right' ? 'slide-out-left' : 'slide-out-right');
        setTimeout(() => {
          if (key !== currentViewName) vEl.classList.remove('active');
        }, 400);
      } else {
        vEl.classList.remove('active');
      }
    });

    currentViewName = targetViewName;

    // Update Room Indicator HUD Label
    const indicatorLabel = document.getElementById('indicator-label');
    if (indicatorLabel && roomTitles[targetViewName]) {
      indicatorLabel.textContent = roomTitles[targetViewName];
    }

    // Update nav links active class
    Object.keys(navLinks).forEach(key => {
      if (navLinks[key]) {
        if (key === targetViewName) {
          navLinks[key].classList.add('active');
        } else {
          navLinks[key].classList.remove('active');
        }
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Trigger page-specific data loading & widget setup
    if (targetViewName === 'cv') {
      loadSpaceshipCVList();
    } else if (targetViewName === 'jobs') {
      loadPageJDList();
      initStarMapNodes();
    } else if (targetViewName === 'interview') {
      populatePageInterviewOptions();
      startAudioWaveformAnim();
    } else if (targetViewName === 'gap') {
      populatePageGapOptions();
    }
  }

  function initStarMapNodes() {
    const nodes = document.querySelectorAll('.star-map-container .node-job');
    nodes.forEach(node => {
      node.addEventListener('click', () => {
        nodes.forEach(n => n.classList.remove('active'));
        node.classList.add('active');
        showToast(`Đã định vị mục tiêu: ${node.querySelector('.node-title')?.textContent || 'Vị trí công việc'}`);
      });
    });
  }

  function startAudioWaveformAnim() {
    const bars = document.querySelectorAll('#audio-waveform .waveform-bar');
    if (!bars.length) return;
    bars.forEach(bar => {
      const h = Math.floor(Math.random() * 24) + 6;
      bar.style.height = `${h}px`;
    });
  }

  /* ============================================================
     MULTI-LANGUAGE (i18n) ENGINE - 5 Languages
     - vi: Tiếng Việt (Default)
     - en: English
     - ja: 日本語
     - ko: 한국어
     - zh: 中文
     ============================================================ */
  const LANG_DATA = {
    vi: { code: 'VIE', flag: '🇻🇳', name: 'Tiếng Việt' },
    en: { code: 'ENG', flag: '🇺🇸', name: 'English' },
    ja: { code: 'JPN', flag: '🇯🇵', name: '日本語' },
    ko: { code: 'KOR', flag: '🇰🇷', name: '한국어' },
    zh: { code: 'ZHO', flag: '🇨🇳', name: '中文' },
  };

  const TRANSLATIONS = {
    vi: {
      'nav-dashboard': 'Dashboard',
      'nav-cv': 'CV Upload',
      'nav-jobs': 'Thư viện Jobs',
      'nav-interview': 'Phỏng vấn STAR',
      'nav-gap': 'Gap Analysis',
      'btn-login': 'Đăng nhập',
      'btn-logout': 'Đăng xuất',
      'hero-title': 'Nâng cấp CV và phỏng vấn, <span class="hero-title-accent">Agent của bạn đang đợi.</span>',
      'hero-sub': 'Công cụ AI hướng nghiệp tối ưu CV theo JD (Anti-Hallucination) & luyện phỏng vấn thử theo Rubric STAR.',
      'btn-try-free': 'THỬ PHỎNG VẤN NGAY',
      'btn-consult': 'Tối ưu CV với AI',
      'user-name-guest': 'Chưa đăng nhập',
      'user-role-default': 'Hệ thống Trợ Lý Nghề Nghiệp X',
      'tab-overview': 'Overview',
      'tab-interviews': 'Interviews',
      'tab-history': 'History',
      'summary-title': 'TÌNH TRẠNG HỒ SƠ',
      'label-cv-upload': 'Đã Upload CV',
      'badge-cv-status': 'Sẵn sàng',
      'label-interview-skills': 'Kỹ năng Phỏng vấn',
      'badge-interview-status': 'STAR Rubric',
      'label-ai-match': 'AI Match Score',
      'badge-match-score': 'Anti-Hallucination',
      'gauge-cv-label': 'Match Score (85%)',
      'gauge-interview-label': 'STAR Score (82/100)',
      'gauge-direction-label': 'Tiến Độ Tối Ưu',
      'chart-title': 'Lịch sử đánh giá phỏng vấn & tối ưu hồ sơ',
      'agent-title': 'Agent AI – Trí Tuệ<br />Nhân Tạo hỗ trợ',
      'feat-opt-name': 'Tự động',
      'feat-opt-desc': 'tối ưu CV',
      'feat-int-name': 'Phỏng vấn',
      'feat-int-desc': 'STAR Rubric',
      'feat-match-name': 'Match Score',
      'feat-match-desc': 'Gap Analysis',
      'feat-custom-name': 'Tạo Custom',
      'feat-custom-desc': 'Job Description',
      'auth-title-login': 'Chào mừng trở lại',
      'auth-sub-login': 'Đăng nhập để tiếp tục hành trình nâng cấp sự nghiệp cùng AI Agent',
      'auth-title-reg': 'Tạo tài khoản mới',
      'auth-sub-reg': 'Tham gia Career Assistant X để tối ưu CV & phỏng vấn',
      'tab-auth-login': 'Đăng Nhập',
      'tab-auth-register': 'Đăng Ký',
      'label-fullname': 'Họ và tên',
      'label-role': 'Vai trò',
      'label-email': 'Email',
      'label-password': 'Mật khẩu',
      'btn-submit-login': 'Đăng nhập',
      'btn-submit-reg': 'Đăng ký tài khoản',
      'modal-cv-title': '📄 Upload & Quản Lý CV',
      'modal-cv-sub': 'Trích xuất kỹ năng, kinh nghiệm & dự án tự động bằng AI',
      'label-cv-name': 'Tên CV (Tùy chọn)',
      'label-cv-file': 'Chọn File CV (.pdf hoặc .docx, max 10MB)',
      'btn-cv-upload': 'Tải Lên & Parse CV',
      'cv-saved-list-title': 'Danh sách CV đã lưu của bạn:',
      'modal-jd-title': '💼 Thư Viện Job Descriptions (JD)',
      'modal-jd-sub': 'Chọn JD mẫu từ hệ thống hoặc dán JD công ty bên ngoài',
      'tab-system-jds': 'JD Mẫu Hệ Thống',
      'tab-custom-jd': 'Dán JD Tùy Chỉnh',
      'label-jd-position': 'Tên vị trí công việc',
      'label-jd-company': 'Tên công ty',
      'label-jd-location': 'Địa điểm',
      'label-jd-requirements': 'Nội dung Yêu cầu Công việc (Requirements Text)',
      'btn-save-custom-jd': 'Lưu Job Description Tùy Chỉnh',
      'modal-gap-title': '🎯 Phân Tích Match Score & Gap Analysis',
      'modal-gap-sub': 'So khớp CV với JD & đề xuất tối ưu câu từ Chân Thật (Anti-Hallucination)',
      'label-select-cv': 'Chọn CV:',
      'label-select-jd': 'Chọn JD Mục Tiêu:',
      'btn-run-gap': 'Phân Tích Khớp CV - JD',
      'modal-int-title': '🎙️ Phòng Phỏng Vấn Thử (STAR Rubric)',
      'modal-int-sub': 'Đóng vai nhà tuyển dụng hỏi đáp chuyên sâu & tự động gợi mở follow-up',
      'label-int-cv': 'Chọn CV Phỏng Vấn:',
      'label-int-jd': 'Chọn JD Ứng Tuyển:',
      'btn-start-int': 'Bắt Đầu Phiên Phỏng Vấn',
      'placeholder-answer': 'Nhập câu trả lời của bạn...',
      'btn-send-answer': 'Gửi'
    },
    en: {
      'nav-dashboard': 'Dashboard',
      'nav-cv': 'CV Upload',
      'nav-jobs': 'Jobs Library',
      'nav-interview': 'STAR Interview',
      'nav-gap': 'Gap Analysis',
      'btn-login': 'Log in',
      'btn-logout': 'Log out',
      'hero-title': 'Upgrade your CV & interview skills, <span class="hero-title-accent">Your AI Agent awaits.</span>',
      'hero-sub': 'AI career copilot for JD-targeted CV optimization (Anti-Hallucination) & STAR Rubric mock interviews.',
      'btn-try-free': 'PRACTICE INTERVIEW NOW',
      'btn-consult': 'Optimize CV with AI',
      'user-name-guest': 'Not Logged In',
      'user-role-default': 'Career Assistant System X',
      'tab-overview': 'Overview',
      'tab-interviews': 'Interviews',
      'tab-history': 'History',
      'summary-title': 'PROFILE STATUS',
      'label-cv-upload': 'Uploaded CV',
      'badge-cv-status': 'Ready',
      'label-interview-skills': 'Interview Skills',
      'badge-interview-status': 'STAR Rubric',
      'label-ai-match': 'AI Match Score',
      'badge-match-score': 'Anti-Hallucination',
      'gauge-cv-label': 'Match Score (85%)',
      'gauge-interview-label': 'STAR Score (82/100)',
      'gauge-direction-label': 'Optimal Progress',
      'chart-title': 'Interview Assessment & Profile Optimization History',
      'agent-title': 'AI Agent – Powered by<br />Artificial Intelligence',
      'feat-opt-name': 'Automatic',
      'feat-opt-desc': 'CV Optimization',
      'feat-int-name': 'Interview',
      'feat-int-desc': 'STAR Rubric',
      'feat-match-name': 'Match Score',
      'feat-match-desc': 'Gap Analysis',
      'feat-custom-name': 'Custom Job',
      'feat-custom-desc': 'Description',
      'auth-title-login': 'Welcome Back',
      'auth-sub-login': 'Log in to connect with FastAPI Backend',
      'auth-title-reg': 'Create New Account',
      'auth-sub-reg': 'Join Career Assistant X to optimize CV & interviews',
      'tab-auth-login': 'Log In',
      'tab-auth-register': 'Register',
      'label-fullname': 'Full Name',
      'label-role': 'Role',
      'label-email': 'Email',
      'label-password': 'Password',
      'btn-submit-login': 'Log In',
      'btn-submit-reg': 'Register Account',
      'modal-cv-title': '📄 Upload & Manage CV',
      'modal-cv-sub': 'Automated AI skill, experience & project extraction',
      'label-cv-name': 'CV Title (Optional)',
      'label-cv-file': 'Choose CV File (.pdf or .docx, max 10MB)',
      'btn-cv-upload': 'Upload & Parse CV',
      'cv-saved-list-title': 'Your Saved CVs:',
      'modal-jd-title': '💼 Job Descriptions (JD) Library',
      'modal-jd-sub': 'Select system sample JDs or paste external company JDs',
      'tab-system-jds': 'System Sample JDs',
      'tab-custom-jd': 'Paste Custom JD',
      'label-jd-position': 'Job Position Title',
      'label-jd-company': 'Company Name',
      'label-jd-location': 'Location',
      'label-jd-requirements': 'Job Requirements Text',
      'btn-save-custom-jd': 'Save Custom Job Description',
      'modal-gap-title': '🎯 Match Score & Gap Analysis',
      'modal-gap-sub': 'Match CV with JD & get truthful (Anti-Hallucination) suggestions',
      'label-select-cv': 'Select CV:',
      'label-select-jd': 'Select Target JD:',
      'btn-run-gap': 'Analyze CV - JD Match',
      'modal-int-title': '🎙️ Mock Interview Room (STAR Rubric)',
      'modal-int-sub': 'Roleplay recruiter for deep Q&A & automatic follow-ups',
      'label-int-cv': 'Select Interview CV:',
      'label-int-jd': 'Select Target JD:',
      'btn-start-int': 'Start Interview Session',
      'placeholder-answer': 'Enter your response...',
      'btn-send-answer': 'Send'
    },
    ja: {
      'nav-dashboard': 'ダッシュボード',
      'nav-cv': 'CVアップロード',
      'nav-jobs': '求人ライブラリ',
      'nav-interview': 'STAR面接',
      'nav-gap': 'ギャップ分析',
      'btn-login': 'ログイン',
      'btn-logout': 'ログアウト',
      'hero-title': 'CVと面接をアップグレード、<span class="hero-title-accent">AIエージェントが待っています。</span>',
      'hero-sub': '求人票(JD)に合わせたCV最適化（アンチハルシネーション）＆ STARルーブリックによる模擬面接。',
      'btn-try-free': '今すぐ模擬面接を開始',
      'btn-consult': 'AIでCVを最適化',
      'user-name-guest': '未ログイン',
      'user-role-default': 'キャリアアシスタントシステム X',
      'tab-overview': '概要',
      'tab-interviews': '面接履歴',
      'tab-history': '履歴',
      'summary-title': 'プロフィール状態',
      'label-cv-upload': 'CVアップロード',
      'badge-cv-status': '準備完了',
      'label-interview-skills': '面接スキル',
      'badge-interview-status': 'STAR基準',
      'label-ai-match': 'AIマッチスコア',
      'badge-match-score': 'アンチハルシネーション',
      'gauge-cv-label': 'マッチスコア (85%)',
      'gauge-interview-label': 'STARスコア (82/100)',
      'gauge-direction-label': '最適化進捗',
      'chart-title': '面接評価およびCV最適化履歴',
      'agent-title': 'AIエージェント –<br />人工知能支援システム',
      'feat-opt-name': '自動化',
      'feat-opt-desc': 'CV最適化',
      'feat-int-name': '面接練習',
      'feat-int-desc': 'STAR基準',
      'feat-match-name': 'マッチスコア',
      'feat-match-desc': 'ギャップ分析',
      'feat-custom-name': 'カスタム作成',
      'feat-custom-desc': '求人票 (JD)',
      'auth-title-login': 'おかえりなさい',
      'auth-sub-login': 'FastAPIバックエンドにログイン',
      'auth-title-reg': '新規アカウント作成',
      'auth-sub-reg': 'AIエージェントの全機能を利用登録',
      'tab-auth-login': 'ログイン',
      'tab-auth-register': '新規登録',
      'label-fullname': 'お名前',
      'label-role': '役割',
      'label-email': 'メールアドレス',
      'label-password': 'パスワード',
      'btn-submit-login': 'ログイン',
      'btn-submit-reg': '今すぐ登録',
      'modal-cv-title': '📄 CVのアップロードと管理',
      'modal-cv-sub': 'AIによるスキル、経験、プロジェクトの自動抽出',
      'label-cv-name': 'CVタイトル（任意）',
      'label-cv-file': 'CVファイルを選択 (.pdf または .docx, 最大10MB)',
      'btn-cv-upload': 'アップロードして解析',
      'cv-saved-list-title': '保存済みCV一覧:',
      'modal-jd-title': '💼 求人票 (JD) ライブラリ',
      'modal-jd-sub': 'システムサンプルまたは外部企業の求人票を選択',
      'tab-system-jds': 'システムサンプルJD',
      'tab-custom-jd': 'カスタムJD貼り付け',
      'label-jd-position': '職種名',
      'label-jd-company': '会社名',
      'label-jd-location': '勤務地',
      'label-jd-requirements': '募集要件テキスト',
      'btn-save-custom-jd': 'カスタムJDを保存',
      'modal-gap-title': '🎯 マッチスコア ＆ ギャップ分析',
      'modal-gap-sub': 'CVとJDを照合し、信頼性の高い改善案を提示（アンチハルシネーション）',
      'label-select-cv': 'CVを選択:',
      'label-select-jd': '目標JDを選択:',
      'btn-run-gap': 'CV-JD適合度を分析',
      'modal-int-title': '🎙️ 模擬面接ルーム (STAR基準)',
      'modal-int-sub': '面接官AIによる深掘り質問と自動フォローアップ',
      'label-int-cv': '面接用CVを選択:',
      'label-int-jd': '応募先JDを選択:',
      'btn-start-int': '面接セッションを開始',
      'placeholder-answer': '回答を入力してください...',
      'btn-send-answer': '送信'
    },
    ko: {
      'nav-dashboard': '대시보드',
      'nav-cv': 'CV 업로드',
      'nav-jobs': '채용 라이브러리',
      'nav-interview': 'STAR 면접',
      'nav-gap': '갭 분석',
      'btn-login': '로그인',
      'btn-logout': '로그아웃',
      'hero-title': 'CV 및 면접 실력을 업그레이드하세요, <span class="hero-title-accent">AI 에이전트가 기다립니다.</span>',
      'hero-sub': 'JD 맞춤형 CV 최적화(Anti-Hallucination) 및 STAR 루브릭 기반 AI 모의 면접 도구.',
      'btn-try-free': '지금 모의 면접 시작',
      'btn-consult': 'AI로 CV 최적화',
      'user-name-guest': '로그인되지 않음',
      'user-role-default': '커리어 어시스턴트 시스템 X',
      'tab-overview': '개요',
      'tab-interviews': '면접',
      'tab-history': '기록',
      'summary-title': '프로필 상태',
      'label-cv-upload': 'CV 업로드',
      'badge-cv-status': '준비됨',
      'label-interview-skills': '면접 스킬',
      'badge-interview-status': 'STAR 루브릭',
      'label-ai-match': 'AI 매칭 점수',
      'badge-match-score': '안티 헐루시네이션',
      'gauge-cv-label': '매칭 점수 (85%)',
      'gauge-interview-label': 'STAR 점수 (82/100)',
      'gauge-direction-label': '최적화 진행률',
      'chart-title': '면접 평가 및 프로필 최적화 이력',
      'agent-title': 'AI 에이전트 –<br />인공지능 지원 시스템',
      'feat-opt-name': '자동화',
      'feat-opt-desc': 'CV 최적화',
      'feat-int-name': '면접 연습',
      'feat-int-desc': 'STAR 루브릭',
      'feat-match-name': '매칭 점수',
      'feat-match-desc': '갭 분석',
      'feat-custom-name': '커스텀 생성',
      'feat-custom-desc': '직무 기술서 (JD)',
      'auth-title-login': '다시 오신 것을 환영합니다',
      'auth-sub-login': 'FastAPI 백엔드 연결을 위해 로그인하세요',
      'auth-title-reg': '새 계정 생성',
      'auth-sub-reg': 'AI 에이전트의 모든 기능을 사용하려면 가입하세요',
      'tab-auth-login': '로그인',
      'tab-auth-register': '회원가입',
      'label-fullname': '이름',
      'label-role': '역할',
      'label-email': '이메일',
      'label-password': '비밀번호',
      'btn-submit-login': '로그인',
      'btn-submit-reg': '지금 가입하기',
      'modal-cv-title': '📄 CV 업로드 및 관리',
      'modal-cv-sub': 'AI 기반 스킬, 경력 및 프로젝트 자동 추출',
      'label-cv-name': 'CV 제목 (선택)',
      'label-cv-file': 'CV 파일 선택 (.pdf 또는 .docx, 최대 10MB)',
      'btn-cv-upload': '업로드 및 CV 파싱',
      'cv-saved-list-title': '저장된 CV 목록:',
      'modal-jd-title': '💼 직무 기술서 (JD) 라이브러리',
      'modal-jd-sub': '시스템 샘플 JD 선택 또는 외부 기업 JD 붙여넣기',
      'tab-system-jds': '시스템 샘플 JD',
      'tab-custom-jd': '커스텀 JD 붙여넣기',
      'label-jd-position': '직무 명칭',
      'label-jd-company': '회사명',
      'label-jd-location': '위치',
      'label-jd-requirements': '자격 요건 텍스트',
      'btn-save-custom-jd': '커스텀 JD 저장',
      'modal-gap-title': '🎯 매칭 점수 & 갭 분석',
      'modal-gap-sub': 'CV와 JD를 비교하고 신뢰성 높은 최적화 제안 (Anti-Hallucination)',
      'label-select-cv': 'CV 선택:',
      'label-select-jd': '목표 JD 선택:',
      'btn-run-gap': 'CV - JD 매칭 분석',
      'modal-int-title': '🎙️ 모의 면접실 (STAR 루브릭)',
      'modal-int-sub': '면접관 역할 수행 및 심층 질문/팔로우업 질문 생성',
      'label-int-cv': '면접용 CV 선택:',
      'label-int-jd': '지원 JD 선택:',
      'btn-start-int': '면접 세션 시작',
      'placeholder-answer': '답변을 입력하세요...',
      'btn-send-answer': '전송'
    },
    zh: {
      'nav-dashboard': '仪表板',
      'nav-cv': '上传简历',
      'nav-jobs': '职位库',
      'nav-interview': 'STAR 面试',
      'nav-gap': '差距分析',
      'btn-login': '登录',
      'btn-logout': '退出',
      'hero-title': '提升您的 CV 与面试表现，<span class="hero-title-accent">您的 AI 助手正在等待。</span>',
      'hero-sub': '基于目标 JD 的简历优化（防幻觉）与基于 STAR 标准的 AI 模拟面试工具。',
      'btn-try-free': '立即开始模拟面试',
      'btn-consult': '使用 AI 优化简历',
      'user-name-guest': '未登录',
      'user-role-default': '职业助手系统 X',
      'tab-overview': '概览',
      'tab-interviews': '面试记录',
      'tab-history': '历史',
      'summary-title': '简历与面试状态',
      'label-cv-upload': '已上传简历',
      'badge-cv-status': '就绪',
      'label-interview-skills': '面试技能',
      'badge-interview-status': 'STAR 标准',
      'label-ai-match': 'AI 匹配得分',
      'badge-match-score': '防幻觉校验',
      'gauge-cv-label': '匹配得分 (85%)',
      'gauge-interview-label': 'STAR 得分 (82/100)',
      'gauge-direction-label': '优化进度',
      'chart-title': '面试评估与简历优化历史记录',
      'agent-title': 'AI 智能助手 –<br />人工智能辅助',
      'feat-opt-name': '自动',
      'feat-opt-desc': '简历优化',
      'feat-int-name': '面试',
      'feat-int-desc': 'STAR 标准',
      'feat-match-name': '匹配得分',
      'feat-match-desc': '差距分析',
      'feat-custom-name': '自定义',
      'feat-custom-desc': '职位描述 (JD)',
      'auth-title-login': '欢迎回来',
      'auth-sub-login': '登录以连接 FastAPI 后端',
      'auth-title-reg': '创建新账号',
      'auth-sub-reg': '注册以解锁 AI 智能助手全部功能',
      'tab-auth-login': '登录',
      'tab-auth-register': '注册',
      'label-fullname': '姓名',
      'label-role': '身份/角色',
      'label-email': '邮箱',
      'label-password': '密码',
      'btn-submit-login': '登录',
      'btn-submit-reg': '立即注册',
      'modal-cv-title': '📄 上传与管理简历',
      'modal-cv-sub': 'AI 自动提取技能、工作经验与项目经历',
      'label-cv-name': '简历名称 (可选)',
      'label-cv-file': '选择简历文件 (.pdf 或 .docx, 最大 10MB)',
      'btn-cv-upload': '上传并解析简历',
      'cv-saved-list-title': '您已保存的简历列表：',
      'modal-jd-title': '💼 职位描述 (JD) 库',
      'modal-jd-sub': '选择系统内置模板 JD 或粘贴外部公司 JD',
      'tab-system-jds': '系统模板 JD',
      'tab-custom-jd': '粘贴自定义 JD',
      'label-jd-position': '职位名称',
      'label-jd-company': '公司名称',
      'label-jd-location': '工作地点',
      'label-jd-requirements': '职位要求文本 (Requirements)',
      'btn-save-custom-jd': '保存自定义 JD',
      'modal-gap-title': '🎯 匹配得分与差距分析',
      'modal-gap-sub': '对比 CV 与 JD 并提供真实可靠的优化建议 (Anti-Hallucination)',
      'label-select-cv': '选择简历：',
      'label-select-jd': '选择目标 JD：',
      'btn-run-gap': '运行 CV - JD 匹配分析',
      'modal-int-title': '🎙️ 模拟面试室 (STAR 标准)',
      'modal-int-sub': '扮演面试官进行深度问答并自动生成追问',
      'label-int-cv': '选择面试简历：',
      'label-int-jd': '选择应聘 JD：',
      'btn-start-int': '开始面试会话',
      'placeholder-answer': '请输入您的回答...',
      'btn-send-answer': '发送'
    }
  };

  function initLanguageSwitcher() {
    const langSwitcher = document.getElementById('lang-switcher');
    const langBtn = document.getElementById('lang-btn');
    const currentFlag = document.getElementById('lang-current-flag');
    const currentCode = document.getElementById('lang-current-code');

    let currentLang = localStorage.getItem('career_copilot_lang') || 'vi';

    function applyLanguage(lang) {
      if (!LANG_DATA[lang]) lang = 'vi';
      currentLang = lang;
      localStorage.setItem('career_copilot_lang', lang);
      document.documentElement.lang = lang;

      if (currentFlag) currentFlag.textContent = LANG_DATA[lang].flag;
      if (currentCode) currentCode.textContent = LANG_DATA[lang].code;

      document.querySelectorAll('.lang-option').forEach(opt => {
        if (opt.dataset.lang === lang) {
          opt.classList.add('active');
        } else {
          opt.classList.remove('active');
        }
      });

      const dict = TRANSLATIONS[lang] || TRANSLATIONS.vi;
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key] !== undefined) {
          if (el.getAttribute('data-i18n-html') === 'true') {
            el.innerHTML = dict[key];
          } else {
            el.textContent = dict[key];
          }
        }
      });

      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key] !== undefined) {
          el.placeholder = dict[key];
        }
      });
    }

    if (langBtn && langSwitcher) {
      langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = langSwitcher.classList.contains('open');
        langSwitcher.classList.toggle('open', !isOpen);
        langBtn.setAttribute('aria-expanded', !isOpen);
      });

      document.addEventListener('click', (e) => {
        if (!langSwitcher.contains(e.target)) {
          langSwitcher.classList.remove('open');
          langBtn.setAttribute('aria-expanded', 'false');
        }
      });

      document.querySelectorAll('.lang-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const selectedLang = opt.dataset.lang;
          applyLanguage(selectedLang);
          langSwitcher.classList.remove('open');
          langBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }

    applyLanguage(currentLang);
  }

  initLanguageSwitcher();

  function initThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    const savedTheme = localStorage.getItem('career_copilot_theme') || localStorage.getItem('theme') || 'dark';

    function applyTheme(theme) {
      if (theme === 'light') {
        document.body.classList.add('light-mode');
        document.documentElement.classList.add('light-mode', 'light');
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.body.classList.remove('light-mode');
        document.documentElement.classList.remove('light-mode', 'light');
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      localStorage.setItem('career_copilot_theme', theme);
      localStorage.setItem('theme', theme);
    }

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        themeBtn.classList.add('animating');
        setTimeout(() => themeBtn.classList.remove('animating'), 400);

        const isLight = document.body.classList.contains('light-mode') || document.documentElement.classList.contains('light-mode');
        applyTheme(isLight ? 'dark' : 'light');
      });
    }

    applyTheme(savedTheme);
  }

  initThemeToggle();

  // Register Navbar Link Click Handlers
  document.getElementById('brand-logo')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('dashboard');
  });

  document.getElementById('nav-dashboard')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('dashboard');
  });

  document.getElementById('nav-cv')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('cv');
  });

  document.getElementById('nav-jobs')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('jobs');
  });

  document.getElementById('nav-interview')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('interview');
  });

  document.getElementById('nav-gap')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('gap');
  });

  document.getElementById('nav-history')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('history');
  });

  document.getElementById('nav-profile')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('profile');
  });

  // Archive Filter Handlers
  document.querySelectorAll('.archive-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.archive-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-filter');
      document.querySelectorAll('.archive-card').forEach(card => {
        if (filter === 'all' || card.getAttribute('data-type') === filter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Persona Selector Handlers
  document.querySelectorAll('.persona-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.persona-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const persona = btn.getAttribute('data-persona');
      localStorage.setItem('ai_persona', persona);
      showToast(`Đã đổi phong cách Trợ Lý AI: ${btn.querySelector('.persona-title')?.textContent}`);
    });
  });

  document.getElementById('btn-save-profile')?.addEventListener('click', () => {
    const roleVal = document.getElementById('profile-target-role')?.value || '';
    if (roleVal) {
      localStorage.setItem('crew_target_role', roleVal);
      showToast('Đã lưu cấu hình thuyền viên thành công!');
    }
  });

  // Action Buttons View Switch Triggers
  document.getElementById('icon-cv-btn')?.addEventListener('click', () => switchView('cv'));
  document.getElementById('btn-consult')?.addEventListener('click', () => switchView('cv'));

  document.getElementById('icon-location-btn')?.addEventListener('click', () => switchView('jobs'));
  document.getElementById('feature-career')?.addEventListener('click', () => switchView('jobs'));

  document.getElementById('icon-megaphone-btn')?.addEventListener('click', () => switchView('interview'));
  document.getElementById('btn-try-free')?.addEventListener('click', () => switchView('interview'));
  document.getElementById('feature-deep-interview')?.addEventListener('click', () => switchView('interview'));

  document.getElementById('icon-search-btn')?.addEventListener('click', () => switchView('gap'));
  document.getElementById('feature-optimize')?.addEventListener('click', () => switchView('gap'));
  document.getElementById('feature-keywords')?.addEventListener('click', () => switchView('gap'));

  /* ============================================================
     🌌 WHITE SPACESHIP CV UPLOAD & MANAGEMENT LOGIC
  ============================================================ */
  const cvPageForm = document.getElementById('cv-page-upload-form');
  const cvPageFileInput = document.getElementById('cv-page-file-input');
  const cvPageTitleInput = document.getElementById('cv-page-title-input');
  const cvDropzone = document.getElementById('cv-dropzone');
  const selectedFileNameEl = document.getElementById('selected-file-name');
  const cvPageListContainer = document.getElementById('cv-page-list-container');

  const inspectorDeck = document.getElementById('cv-detail-inspector');
  const btnCloseInspector = document.getElementById('btn-close-cv-detail');
  let loadedCVs = [];

  // Dropzone drag & drop handlers
  if (cvDropzone) {
    cvDropzone.addEventListener('click', () => cvPageFileInput?.click());
    cvDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      cvDropzone.classList.add('dragover');
    });
    cvDropzone.addEventListener('dragleave', () => cvDropzone.classList.remove('dragover'));
    cvDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      cvDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        cvPageFileInput.files = e.dataTransfer.files;
        updateSelectedFileName();
      }
    });
  }

  if (cvPageFileInput) {
    cvPageFileInput.addEventListener('change', updateSelectedFileName);
  }

  function updateSelectedFileName() {
    if (cvPageFileInput && cvPageFileInput.files[0]) {
      const file = cvPageFileInput.files[0];
      if (selectedFileNameEl) {
        selectedFileNameEl.textContent = `📄 Đã chọn: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        selectedFileNameEl.style.display = 'inline-block';
      }
    }
  }

  // Handle Spaceship CV Upload Form Submit
  if (cvPageForm) {
    cvPageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!ApiClient.getToken()) {
        showToast('⚠️ Vui lòng đăng nhập tài khoản để upload CV', 'warning');
        openAuthModal();
        return;
      }
      if (!cvPageFileInput.files[0]) {
        showToast('⚠️ Vui lòng chọn file CV dạng .pdf hoặc .docx', 'warning');
        return;
      }

      try {
        showToast('🚀 AI Core đang quét & parse CV...', 'info');
        const res = await ApiClient.uploadCV(cvPageFileInput.files[0], cvPageTitleInput.value.trim());
        showToast('🎉 Tải lên & trích xuất CV thành công!', 'success');
        cvPageForm.reset();
        if (selectedFileNameEl) selectedFileNameEl.style.display = 'none';
        loadSpaceshipCVList();
        if (res && res.cv) inspectCVDetail(res.cv);
      } catch (err) {
        showToast(`❌ Lỗi upload CV: ${err.message}`, 'error');
      }
    });
  }

  // Load CV Manifest List inside Spaceship View
  async function loadSpaceshipCVList() {
    if (!cvPageListContainer) return;
    if (!ApiClient.getToken()) {
      cvPageListContainer.innerHTML = `<div class="empty-manifest"><p>⚠️ Vui lòng đăng nhập để xem danh sách CV đã lưu</p></div>`;
      return;
    }

    try {
      loadedCVs = await ApiClient.listCVs();
      if (!loadedCVs || loadedCVs.length === 0) {
        cvPageListContainer.innerHTML = `<div class="empty-manifest"><p>Chưa có bản CV nào trong kho dữ liệu. Hãy quét CV đầu tiên ở trạm bên trái!</p></div>`;
        return;
      }

      cvPageListContainer.innerHTML = loadedCVs.map((cv, idx) => `
        <div class="cv-manifest-item">
          <div>
            <p class="cv-item-title">📄 ${cv.title || 'CV Hồ sơ'}</p>
            <p class="cv-item-date">Ngày tạo: ${new Date(cv.created_at).toLocaleDateString('vi-VN')} | Standard ATS</p>
          </div>
          <div class="cv-item-actions">
            <button class="btn-ship-sm view" onclick="window.inspectCVByIndex(${idx})">Inspect AI</button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      cvPageListContainer.innerHTML = `<div class="empty-manifest"><p style="color:#ef4444;">Không thể kết nối kho dữ liệu CV: ${err.message}</p></div>`;
    }
  }

  window.inspectCVByIndex = function(index) {
    if (loadedCVs && loadedCVs[index]) {
      inspectCVDetail(loadedCVs[index]);
    }
  };

  function inspectCVDetail(cv) {
    if (!inspectorDeck) return;
    inspectorDeck.style.display = 'block';

    document.getElementById('inspector-cv-title').textContent = cv.title || 'CV Hồ sơ';
    document.getElementById('inspector-cv-meta').textContent = `Ngày quét: ${new Date(cv.created_at).toLocaleDateString('vi-VN')} | ID: ${cv.id}`;

    const parsed = cv.parsed_data || {};
    const personal = parsed.personal_info || {};
    const skills = parsed.hard_skills || parsed.skills || ['Python', 'FastAPI', 'React', 'JavaScript', 'Git', 'PostgreSQL', 'ATS Optimization'];

    document.getElementById('inspector-personal-info').innerHTML = `
      <p style="margin:2px 0;"><strong>Họ tên:</strong> ${personal.full_name || 'Đã trích xuất từ CV'}</p>
      <p style="margin:2px 0;"><strong>Email:</strong> ${personal.email || 'N/A'}</p>
      <p style="margin:2px 0;"><strong>Điện thoại:</strong> ${personal.phone || 'N/A'}</p>
    `;

    document.getElementById('inspector-skills-cloud').innerHTML = skills.map(s => `
      <span class="skill-tag-ship">⚡ ${s}</span>
    `).join('');

    document.getElementById('inspector-raw-preview').textContent = parsed.summary || cv.raw_text?.slice(0, 300) || 'Nội dung CV đã được AI phân tích cấu trúc và mã hóa thành công.';
  }

  if (btnCloseInspector) {
    btnCloseInspector.addEventListener('click', () => {
      if (inspectorDeck) inspectorDeck.style.display = 'none';
    });
  }

  document.getElementById('btn-inspector-gap')?.addEventListener('click', () => {
    switchView('gap');
  });

  document.getElementById('btn-inspector-interview')?.addEventListener('click', () => {
    switchView('interview');
  });

  /* ============================================================
     💼 JOB DESCRIPTIONS PAGE LOGIC
  ============================================================ */
  const pageJdListContainer = document.getElementById('page-jd-list-container');
  const pageBtnTabSys = document.getElementById('page-btn-tab-sys');
  const pageBtnTabCust = document.getElementById('page-btn-tab-cust');
  const pageSecSysJds = document.getElementById('page-section-sys-jds');
  const pageSecCustJd = document.getElementById('page-section-cust-jd');
  const pageCustomJdForm = document.getElementById('page-custom-jd-form');

  if (pageBtnTabSys) {
    pageBtnTabSys.addEventListener('click', () => {
      pageBtnTabSys.classList.add('active'); pageBtnTabCust?.classList.remove('active');
      if (pageSecSysJds) pageSecSysJds.style.display = 'block';
      if (pageSecCustJd) pageSecCustJd.style.display = 'none';
    });
  }
  if (pageBtnTabCust) {
    pageBtnTabCust.addEventListener('click', () => {
      pageBtnTabCust.classList.add('active'); pageBtnTabSys?.classList.remove('active');
      if (pageSecCustJd) pageSecCustJd.style.display = 'block';
      if (pageSecSysJds) pageSecSysJds.style.display = 'none';
    });
  }

  async function loadPageJDList() {
    if (!pageJdListContainer) return;
    try {
      const jds = await ApiClient.listJDs();
      if (!jds || jds.length === 0) {
        pageJdListContainer.innerHTML = `<p style="font-size:12px;color:var(--text-muted);">Chưa có JD nào trong hệ thống.</p>`;
        return;
      }
      pageJdListContainer.innerHTML = jds.map(jd => `
        <div style="background:rgba(255,255,255,0.04);padding:14px;border-radius:10px;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <p style="font-size:14px;font-weight:700;color:#fff;margin:0;">💼 ${jd.title}</p>
            <span class="badge ${jd.is_system ? 'badge-ok' : 'badge-focus'}">${jd.is_system ? 'Hệ thống' : 'Tự dán'}</span>
          </div>
          <p style="font-size:11px;color:var(--text-dim);margin:0 0 6px 0;">Công ty: ${jd.company || 'N/A'} | Địa điểm: ${jd.location || 'N/A'}</p>
          <p style="font-size:11px;color:var(--text-muted);white-space:pre-line;max-height:70px;overflow:hidden;">${jd.requirements_text}</p>
        </div>
      `).join('');
    } catch (err) {
      pageJdListContainer.innerHTML = `<p style="font-size:12px;color:#ff4e6a;">Lỗi tải JD: ${err.message}</p>`;
    }
  }

  if (pageCustomJdForm) {
    pageCustomJdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('page-custom-jd-title').value.trim();
      const company = document.getElementById('page-custom-jd-company').value.trim();
      const location = document.getElementById('page-custom-jd-location').value.trim();
      const requirementsText = document.getElementById('page-custom-jd-requirements').value.trim();

      try {
        await ApiClient.createCustomJD(title, company, location, requirementsText);
        showToast('🎉 Đã thêm Job Description tùy chỉnh thành công!', 'success');
        pageCustomJdForm.reset();
        pageBtnTabSys?.click();
        loadPageJDList();
      } catch (err) {
        showToast(`❌ Lỗi tạo JD: ${err.message}`, 'error');
      }
    });
  }

  /* ============================================================
     🎯 GAP ANALYSIS PAGE LOGIC
  ============================================================ */
  const pageSelectGapCv = document.getElementById('page-gap-select-cv');
  const pageSelectGapJd = document.getElementById('page-gap-select-jd');
  const pageBtnRunGap = document.getElementById('page-btn-run-gap');
  const pageGapResultsContainer = document.getElementById('page-gap-results-container');

  async function populatePageGapOptions() {
    if (!pageSelectGapCv || !pageSelectGapJd) return;
    try {
      const [cvs, jds] = await Promise.all([ApiClient.listCVs(), ApiClient.listJDs()]);
      pageSelectGapCv.innerHTML = cvs.length > 0
        ? cvs.map(c => `<option value="${c.id}">${c.title}</option>`).join('')
        : `<option value="">(Vui lòng upload CV trước)</option>`;

      pageSelectGapJd.innerHTML = jds.length > 0
        ? jds.map(j => `<option value="${j.id}">${j.title} - ${j.company}</option>`).join('')
        : `<option value="">(Vui lòng tạo JD trước)</option>`;
    } catch (err) {
      showToast(`Không thể tải dữ liệu CV/JD: ${err.message}`, 'error');
    }
  }

  if (pageBtnRunGap) {
    pageBtnRunGap.addEventListener('click', async () => {
      const cvId = pageSelectGapCv?.value;
      const jdId = pageSelectGapJd?.value;
      if (!cvId || !jdId) {
        showToast('Vui lòng chọn 1 CV và 1 JD trước khi chạy phân tích', 'warning');
        return;
      }

      try {
        showToast('⏳ AI đang tính toán Match Score & Gap Analysis...', 'info');
        const res = await ApiClient.runGapAnalysis(cvId, jdId);

        document.getElementById('page-gap-match-score-badge').textContent = `${res.match_score.toFixed(1)}%`;

        document.getElementById('page-gap-matching-skills').innerHTML = (res.hard_skills_matching || []).map(
          s => `<span class="badge badge-ok">${s}</span>`
        ).join('') || `<span style="font-size:11px;color:var(--text-muted);">Không có dữ liệu</span>`;

        document.getElementById('page-gap-missing-skills').innerHTML = (res.hard_skills_missing || []).map(
          s => `<span class="badge badge-need">${s}</span>`
        ).join('') || `<span style="font-size:11px;color:var(--text-muted);">Không có dữ liệu</span>`;

        document.getElementById('page-gap-suggestions-list').innerHTML = (res.suggestions || []).map(s => `
          <div style="background:rgba(255,255,255,0.03);padding:8px 10px;border-radius:6px;border-left:3px solid #b084fc;">
            <p style="font-size:11px;color:var(--text-muted);margin:0 0 2px 0;"><strong>Gốc:</strong> ${s.original_text}</p>
            <p style="font-size:12px;color:#00e676;margin:0 0 2px 0;"><strong>Tối ưu:</strong> ${s.suggested_improvement}</p>
            <p style="font-size:10px;color:var(--text-dim);margin:0;"><em>${s.reason}</em></p>
          </div>
        `).join('') || `<p style="font-size:11px;color:var(--text-muted);">CV của bạn đã tối ưu rất tốt!</p>`;

        if (pageGapResultsContainer) pageGapResultsContainer.style.display = 'block';
        showToast('🎉 Đã phân tích xong Gap Analysis!', 'success');
      } catch (err) {
        showToast(`❌ Lỗi chạy Gap Analysis: ${err.message}`, 'error');
      }
    });
  }

  /* ============================================================
     🎙️ STAR MOCK INTERVIEW PAGE LOGIC
  ============================================================ */
  const pageSelectIntCv = document.getElementById('page-interview-select-cv');
  const pageSelectIntJd = document.getElementById('page-interview-select-jd');
  const pageBtnStartInt = document.getElementById('page-btn-start-interview');
  const pageSetupSec = document.getElementById('page-interview-setup');
  const pageChatSec = document.getElementById('page-interview-chat');
  const pageReportSec = document.getElementById('page-interview-report');
  const pageChatHistory = document.getElementById('page-interview-chat-history');
  const pageAnswerForm = document.getElementById('page-interview-answer-form');
  const pageAnswerInput = document.getElementById('page-interview-answer-input');
  const pageProgressText = document.getElementById('page-interview-progress-text');

  let pageSessionId = null;

  async function populatePageInterviewOptions() {
    if (!pageSelectIntCv || !pageSelectIntJd) return;
    try {
      const [cvs, jds] = await Promise.all([ApiClient.listCVs(), ApiClient.listJDs()]);
      pageSelectIntCv.innerHTML = cvs.length > 0
        ? cvs.map(c => `<option value="${c.id}">${c.title}</option>`).join('')
        : `<option value="">(Bắt buộc upload 1 CV trước)</option>`;

      pageSelectIntJd.innerHTML = jds.length > 0
        ? jds.map(j => `<option value="${j.id}">${j.title} - ${j.company}</option>`).join('')
        : `<option value="">(Bắt buộc chọn 1 JD trước)</option>`;
    } catch (err) {
      showToast(`Lỗi lấy dữ liệu CV/JD: ${err.message}`, 'error');
    }
  }

  if (pageBtnStartInt) {
    pageBtnStartInt.addEventListener('click', async () => {
      const cvId = pageSelectIntCv?.value;
      const jdId = pageSelectIntJd?.value;
      if (!cvId || !jdId) {
        showToast('Bắt buộc phải chọn đủ 1 CV và 1 JD mới được bắt đầu phỏng vấn', 'warning');
        return;
      }

      try {
        showToast('⏳ AI đang tạo bộ câu hỏi phỏng vấn thử...', 'info');
        const sessionData = await ApiClient.startInterview(cvId, jdId, 5);

        pageSessionId = sessionData.session_id;
        if (pageSetupSec) pageSetupSec.style.display = 'none';
        if (pageReportSec) pageReportSec.style.display = 'none';
        if (pageChatSec) pageChatSec.style.display = 'block';
        if (pageChatHistory) pageChatHistory.innerHTML = '';

        appendPageMessage('interviewer', sessionData.question_text);
        if (pageProgressText) pageProgressText.textContent = `Câu hỏi 1 / 5`;
        showToast('🎙️ Phiên phỏng vấn thử đã bắt đầu!', 'success');
      } catch (err) {
        showToast(`❌ Không thể bắt đầu phỏng vấn: ${err.message}`, 'error');
      }
    });
  }

  function appendPageMessage(sender, text) {
    if (!pageChatHistory) return;
    const isBot = sender === 'interviewer';
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `
      align-self: ${isBot ? 'flex-start' : 'flex-end'};
      max-width: 80%;
      background: ${isBot ? 'rgba(124,77,255,0.15)' : 'rgba(0,230,118,0.15)'};
      border: 1px solid ${isBot ? 'rgba(124,77,255,0.3)' : 'rgba(0,230,118,0.3)'};
      padding: 10px 14px;
      border-radius: 12px;
      color: #fff;
      font-size: 13px;
      line-height: 1.4;
    `;
    msgDiv.innerHTML = `<strong>${isBot ? '🤖 Nhà tuyển dụng AI' : '👤 Bạn'}:</strong> ${text}`;
    pageChatHistory.appendChild(msgDiv);
    pageChatHistory.scrollTop = pageChatHistory.scrollHeight;
  }

  if (pageAnswerForm) {
    pageAnswerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ansText = pageAnswerInput?.value.trim();
      if (!ansText || !pageSessionId) return;

      appendPageMessage('user', ansText);
      if (pageAnswerInput) pageAnswerInput.value = '';

      try {
        const res = await ApiClient.submitAnswer(pageSessionId, ansText);

        if (res.follow_up_question) {
          appendPageMessage('interviewer', `🔍 <em>Follow-up:</em> ${res.follow_up_question}`);
        } else if (res.is_last_question) {
          appendPageMessage('interviewer', res.question_text);
          showToast('🎉 Hoàn thành phỏng vấn! Đang tải báo cáo STAR...', 'success');
          setTimeout(() => loadPageSTARReport(pageSessionId), 1200);
        } else {
          appendPageMessage('interviewer', res.question_text);
          if (pageProgressText) pageProgressText.textContent = `Câu hỏi ${res.question_index + 1} / 5`;
        }
      } catch (err) {
        showToast(`❌ Lỗi gửi câu trả lời: ${err.message}`, 'error');
      }
    });
  }

  async function loadPageSTARReport(sessionId) {
    try {
      const report = await ApiClient.getInterviewReport(sessionId);
      if (pageChatSec) pageChatSec.style.display = 'none';
      if (pageReportSec) pageReportSec.style.display = 'block';

      const totalScoreEl = document.getElementById('page-report-total-score');
      if (totalScoreEl) totalScoreEl.textContent = `${report.total_score.toFixed(1)} / 100`;

      const scores = report.star_scores || {};
      const starBrkEl = document.getElementById('page-report-star-breakdown');
      if (starBrkEl) {
        starBrkEl.innerHTML = `
          <div style="background:rgba(255,255,255,0.04);padding:8px;border-radius:6px;text-align:center;">
            <span style="font-size:10px;color:var(--text-dim);">Situation</span>
            <p style="font-size:14px;font-weight:700;color:#00e676;margin:2px 0 0 0;">${scores.situation || 80}</p>
          </div>
          <div style="background:rgba(255,255,255,0.04);padding:8px;border-radius:6px;text-align:center;">
            <span style="font-size:10px;color:var(--text-dim);">Task</span>
            <p style="font-size:14px;font-weight:700;color:#00bcd4;margin:2px 0 0 0;">${scores.task || 80}</p>
          </div>
          <div style="background:rgba(255,255,255,0.04);padding:8px;border-radius:6px;text-align:center;">
            <span style="font-size:10px;color:var(--text-dim);">Action</span>
            <p style="font-size:14px;font-weight:700;color:#b084fc;margin:2px 0 0 0;">${scores.action || 80}</p>
          </div>
          <div style="background:rgba(255,255,255,0.04);padding:8px;border-radius:6px;text-align:center;">
            <span style="font-size:10px;color:var(--text-dim);">Result</span>
            <p style="font-size:14px;font-weight:700;color:#ff8c42;margin:2px 0 0 0;">${scores.result || 80}</p>
          </div>
        `;
      }

      const stEl = document.getElementById('page-report-strengths-list');
      if (stEl) stEl.innerHTML = (report.strengths || []).map(s => `<li>${s}</li>`).join('');

      const impEl = document.getElementById('page-report-improvements-list');
      if (impEl) impEl.innerHTML = (report.improvements || []).map(i => `<li>${i}</li>`).join('');

      const recEl = document.getElementById('page-report-recommendations-list');
      if (recEl) recEl.innerHTML = (report.recommendations || []).map(r => `<li>${r}</li>`).join('');
    } catch (err) {
      showToast(`Không thể tải báo cáo: ${err.message}`, 'error');
    }
  }

  /* ============================================================
     🔐 AUTH & USER STATE MANAGEMENT
  ============================================================ */
  const authContainer = document.getElementById('auth-container');
  const userNameEl = document.getElementById('user-name');
  const userRoleEl = document.getElementById('user-role-display');

  function checkUserSession() {
    const user = ApiClient.getUser();
    const token = ApiClient.getToken();

    if (user && token) {
      if (userNameEl) userNameEl.textContent = user.full_name || user.email;
      if (userRoleEl) userRoleEl.textContent = `Vai trò: ${user.role.toUpperCase()}`;
      if (authContainer) {
        authContainer.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:12px;color:var(--text-dim);">${user.full_name || user.email}</span>
            <button class="btn-outline" id="btn-logout" style="padding:6px 12px;font-size:12px;">Đăng xuất</button>
          </div>
        `;
        document.getElementById('btn-logout').addEventListener('click', () => {
          ApiClient.logout();
          showToast('Đã đăng xuất tài khoản', 'info');
          checkUserSession();
        });
      }
    } else {
      if (userNameEl) userNameEl.textContent = 'Chưa đăng nhập';
      if (userRoleEl) userRoleEl.textContent = 'Hệ thống Trợ Lý Nghề Nghiệp X';
      if (authContainer) {
        authContainer.innerHTML = `<button class="btn-login" id="btn-login">Đăng nhập</button>`;
        document.getElementById('btn-login').addEventListener('click', openAuthModal);
      }
    }
  }

  if (ApiClient.getToken()) {
    ApiClient.getMe().then(() => checkUserSession()).catch(() => {
      ApiClient.logout();
      checkUserSession();
    });
  } else {
    checkUserSession();
  }

  /* ── Auth Modal Logic ── */
  const authOverlay = document.getElementById('modal-overlay');
  const authClose = document.getElementById('modal-close');
  const tabLogin = document.getElementById('tab-auth-login');
  const tabRegister = document.getElementById('tab-auth-register');
  const fullnameGroup = document.getElementById('form-fullname-group');
  const roleGroup = document.getElementById('form-role-group');
  const authTitle = document.getElementById('auth-title');
  const authSub = document.getElementById('auth-sub');
  const btnSubmitLabel = document.getElementById('btn-submit-label');
  const loginForm = document.getElementById('login-form');

  let isRegisterMode = false;

  function openAuthModal() {
    if (authOverlay) authOverlay.classList.add('open');
  }
  function closeAuthModal() {
    if (authOverlay) authOverlay.classList.remove('open');
  }
  if (authClose) authClose.addEventListener('click', closeAuthModal);

  function setAuthMode(register) {
    isRegisterMode = register;
    const currentLang = localStorage.getItem('career_copilot_lang') || 'vi';
    const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.vi;

    if (register) {
      tabRegister?.classList.add('active'); if (tabRegister) tabRegister.style.color = '#fff';
      tabLogin?.classList.remove('active'); if (tabLogin) tabLogin.style.color = 'var(--text-dim)';
      if (fullnameGroup) fullnameGroup.style.display = 'block';
      if (roleGroup) roleGroup.style.display = 'block';
      if (authTitle) authTitle.textContent = dict['auth-title-reg'] || 'Tạo tài khoản mới';
      if (authSub) authSub.textContent = dict['auth-sub-reg'] || 'Tham gia Career Assistant X để tối ưu CV & phỏng vấn';
      if (btnSubmitLabel) btnSubmitLabel.textContent = dict['btn-submit-reg'] || 'Đăng ký tài khoản';
    } else {
      tabLogin?.classList.add('active'); if (tabLogin) tabLogin.style.color = '#fff';
      tabRegister?.classList.remove('active'); if (tabRegister) tabRegister.style.color = 'var(--text-dim)';
      if (fullnameGroup) fullnameGroup.style.display = 'none';
      if (roleGroup) roleGroup.style.display = 'none';
      if (authTitle) authTitle.textContent = dict['auth-title-login'] || 'Chào mừng trở lại';
      if (authSub) authSub.textContent = dict['auth-sub-login'] || 'Đăng nhập để tiếp tục hành trình nâng cấp sự nghiệp cùng AI Agent';
      if (btnSubmitLabel) btnSubmitLabel.textContent = dict['btn-submit-login'] || 'Đăng nhập';
    }
  }

  if (tabLogin) tabLogin.addEventListener('click', () => setAuthMode(false));
  if (tabRegister) tabRegister.addEventListener('click', () => setAuthMode(true));

  // Google Sign-In & Registration Event Handler
  document.getElementById('btn-google-auth')?.addEventListener('click', () => {
    showToast('🔑 Đang kết nối với Google Sign-In...');
    setTimeout(() => {
      const mockGoogleUser = {
        email: 'user.google@gmail.com',
        full_name: 'Google User (Verified)',
        role: 'student'
      };
      ApiClient.setToken('google-oauth-jwt-token');
      ApiClient.setUser(mockGoogleUser);
      checkUserSession();
      closeAuthModal();
      showToast('✅ Đăng nhập bằng Google thành công!');
    }, 800);
  });

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('input-email').value.trim();
      const password = document.getElementById('input-password').value;

      if (!email || !password) {
        showToast('Vui lòng điền đầy đủ Email và Mật khẩu', 'error');
        return;
      }

      try {
        if (isRegisterMode) {
          const fullName = document.getElementById('input-fullname').value.trim() || email.split('@')[0];
          const role = document.getElementById('input-role').value;
          await ApiClient.register(email, password, fullName, role);
          showToast('🎉 Đăng ký thành công! Đang tự động đăng nhập...', 'success');
          await ApiClient.login(email, password);
        } else {
          await ApiClient.login(email, password);
          showToast('✅ Đăng nhập thành công!', 'success');
        }
        closeAuthModal();
        checkUserSession();
      } catch (err) {
        showToast(`❌ ${err.message}`, 'error');
      }
    });
  }

  /* ============================================================
     📄 CV UPLOAD & MANAGEMENT MODAL
  ============================================================ */
  const cvOverlay = document.getElementById('modal-cv-overlay');
  const cvClose = document.getElementById('modal-cv-close');
  const cvForm = document.getElementById('cv-upload-form');
  const cvListContainer = document.getElementById('cv-list-container');

  function openCVModal() {
    if (!ApiClient.getToken()) {
      showToast('⚠️ Vui lòng đăng nhập trước khi tải CV', 'warning');
      openAuthModal();
      return;
    }
    if (cvOverlay) cvOverlay.classList.add('open');
    loadCVList();
  }
  function closeCVModal() { if (cvOverlay) cvOverlay.classList.remove('open'); }
  if (cvClose) cvClose.addEventListener('click', closeCVModal);

  document.getElementById('nav-cv')?.addEventListener('click', (e) => { e.preventDefault(); openCVModal(); });
  document.getElementById('icon-cv-btn')?.addEventListener('click', openCVModal);
  document.getElementById('btn-consult')?.addEventListener('click', openCVModal);

  async function loadCVList() {
    if (!cvListContainer) return;
    try {
      const cvs = await ApiClient.listCVs();
      if (!cvs || cvs.length === 0) {
        cvListContainer.innerHTML = `<p style="font-size:12px;color:var(--text-muted);">Bạn chưa có CV nào. Hãy upload CV đầu tiên ở trên!</p>`;
        return;
      }
      cvListContainer.innerHTML = cvs.map(cv => `
        <div style="background:rgba(255,255,255,0.04);padding:10px;border-radius:8px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <p style="font-size:13px;font-weight:600;color:#fff;margin:0;">📄 ${cv.title}</p>
            <p style="font-size:11px;color:var(--text-dim);margin:2px 0 0 0;">Ngày tạo: ${new Date(cv.created_at).toLocaleDateString('vi-VN')}</p>
          </div>
          <span class="badge badge-ok">Parsed AI</span>
        </div>
      `).join('');
    } catch (err) {
      cvListContainer.innerHTML = `<p style="font-size:12px;color:#ff4e6a;">Không thể tải danh sách CV: ${err.message}</p>`;
    }
  }

  if (cvForm) {
    cvForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('cv-file-input');
      const titleInput = document.getElementById('cv-title-input');
      if (!fileInput.files[0]) {
        showToast('Vui lòng chọn file CV dạng .pdf hoặc .docx', 'warning');
        return;
      }

      try {
        showToast('⏳ Đang tải file lên & trích xuất AI...', 'info');
        await ApiClient.uploadCV(fileInput.files[0], titleInput.value.trim());
        showToast('🎉 Tải lên & parse CV thành công!', 'success');
        cvForm.reset();
        loadCVList();
      } catch (err) {
        showToast(`❌ Lỗi upload CV: ${err.message}`, 'error');
      }
    });
  }

  /* ============================================================
     💼 JOB DESCRIPTIONS MODAL
  ============================================================ */
  const jdOverlay = document.getElementById('modal-jd-overlay');
  const jdClose = document.getElementById('modal-jd-close');
  const jdListContainer = document.getElementById('jd-list-container');
  const btnTabSysJd = document.getElementById('btn-tab-system-jds');
  const btnTabCustJd = document.getElementById('btn-tab-custom-jd');
  const secSysJd = document.getElementById('section-system-jds');
  const secCustJd = document.getElementById('section-custom-jd');
  const customJdForm = document.getElementById('custom-jd-form');

  function openJDModal() {
    if (!ApiClient.getToken()) {
      showToast('⚠️ Vui lòng đăng nhập trước khi xem thư viện Jobs', 'warning');
      openAuthModal();
      return;
    }
    if (jdOverlay) jdOverlay.classList.add('open');
    loadJDList();
  }
  function closeJDModal() { if (jdOverlay) jdOverlay.classList.remove('open'); }
  if (jdClose) jdClose.addEventListener('click', closeJDModal);

  document.getElementById('nav-jobs')?.addEventListener('click', (e) => { e.preventDefault(); openJDModal(); });
  document.getElementById('icon-location-btn')?.addEventListener('click', openJDModal);
  document.getElementById('feature-career')?.addEventListener('click', openJDModal);

  if (btnTabSysJd) {
    btnTabSysJd.addEventListener('click', () => {
      btnTabSysJd.classList.add('active'); btnTabCustJd?.classList.remove('active');
      if (secSysJd) secSysJd.style.display = 'block';
      if (secCustJd) secCustJd.style.display = 'none';
    });
  }
  if (btnTabCustJd) {
    btnTabCustJd.addEventListener('click', () => {
      btnTabCustJd.classList.add('active'); btnTabSysJd?.classList.remove('active');
      if (secCustJd) secCustJd.style.display = 'block';
      if (secSysJd) secSysJd.style.display = 'none';
    });
  }

  async function loadJDList() {
    if (!jdListContainer) return;
    try {
      const jds = await ApiClient.listJDs();
      if (!jds || jds.length === 0) {
        jdListContainer.innerHTML = `<p style="font-size:12px;color:var(--text-muted);">Chưa có JD nào trong hệ thống.</p>`;
        return;
      }
      jdListContainer.innerHTML = jds.map(jd => `
        <div style="background:rgba(255,255,255,0.04);padding:12px;border-radius:8px;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <p style="font-size:14px;font-weight:600;color:#fff;margin:0;">💼 ${jd.title}</p>
            <span class="badge ${jd.is_system ? 'badge-ok' : 'badge-focus'}">${jd.is_system ? 'Hệ thống' : 'Tự dán'}</span>
          </div>
          <p style="font-size:11px;color:var(--text-dim);margin:4px 0;">Công ty: ${jd.company || 'N/A'} | Địa điểm: ${jd.location || 'N/A'}</p>
          <p style="font-size:11px;color:var(--text-muted);white-space:pre-line;max-height:60px;overflow:hidden;">${jd.requirements_text}</p>
        </div>
      `).join('');
    } catch (err) {
      jdListContainer.innerHTML = `<p style="font-size:12px;color:#ff4e6a;">Lỗi tải JD: ${err.message}</p>`;
    }
  }

  if (customJdForm) {
    customJdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('custom-jd-title').value.trim();
      const company = document.getElementById('custom-jd-company').value.trim();
      const location = document.getElementById('custom-jd-location').value.trim();
      const requirementsText = document.getElementById('custom-jd-requirements').value.trim();

      try {
        await ApiClient.createCustomJD(title, company, location, requirementsText);
        showToast('🎉 Đã thêm Job Description tùy chỉnh thành công!', 'success');
        customJdForm.reset();
        btnTabSysJd?.click();
        loadJDList();
      } catch (err) {
        showToast(`❌ Lỗi tạo JD: ${err.message}`, 'error');
      }
    });
  }

  /* ============================================================
     🎯 GAP ANALYSIS MODAL
  ============================================================ */
  const gapOverlay = document.getElementById('modal-gap-overlay');
  const gapClose = document.getElementById('modal-gap-close');
  const selectGapCv = document.getElementById('gap-select-cv');
  const selectGapJd = document.getElementById('gap-select-jd');
  const btnRunGap = document.getElementById('btn-run-gap-analysis');
  const gapResultsContainer = document.getElementById('gap-results-container');

  function openGapModal() {
    if (!ApiClient.getToken()) {
      showToast('⚠️ Vui lòng đăng nhập trước khi chạy Gap Analysis', 'warning');
      openAuthModal();
      return;
    }
    if (gapOverlay) gapOverlay.classList.add('open');
    populateGapOptions();
  }
  function closeGapModal() { if (gapOverlay) gapOverlay.classList.remove('open'); }
  if (gapClose) gapClose.addEventListener('click', closeGapModal);

  document.getElementById('nav-gap')?.addEventListener('click', (e) => { e.preventDefault(); openGapModal(); });
  document.getElementById('icon-search-btn')?.addEventListener('click', openGapModal);
  document.getElementById('feature-optimize')?.addEventListener('click', openGapModal);
  document.getElementById('feature-keywords')?.addEventListener('click', openGapModal);

  async function populateGapOptions() {
    if (!selectGapCv || !selectGapJd) return;
    try {
      const [cvs, jds] = await Promise.all([ApiClient.listCVs(), ApiClient.listJDs()]);
      selectGapCv.innerHTML = cvs.length > 0
        ? cvs.map(c => `<option value="${c.id}">${c.title}</option>`).join('')
        : `<option value="">(Vui lòng upload CV trước)</option>`;

      selectGapJd.innerHTML = jds.length > 0
        ? jds.map(j => `<option value="${j.id}">${j.title} - ${j.company}</option>`).join('')
        : `<option value="">(Vui lòng tạo JD trước)</option>`;
    } catch (err) {
      showToast(`Không thể tải dữ liệu CV/JD: ${err.message}`, 'error');
    }
  }

  if (btnRunGap) {
    btnRunGap.addEventListener('click', async () => {
      const cvId = selectGapCv?.value;
      const jdId = selectGapJd?.value;
      if (!cvId || !jdId) {
        showToast('Vui lòng chọn 1 CV và 1 JD trước khi chạy phân tích', 'warning');
        return;
      }

      try {
        showToast('⏳ AI đang tính toán Match Score & Gap Analysis...', 'info');
        const res = await ApiClient.runGapAnalysis(cvId, jdId);

        document.getElementById('gap-match-score-badge').textContent = `${res.match_score.toFixed(1)}%`;

        document.getElementById('gap-matching-skills').innerHTML = (res.hard_skills_matching || []).map(
          s => `<span class="badge badge-ok">${s}</span>`
        ).join('') || `<span style="font-size:11px;color:var(--text-muted);">Không có dữ liệu</span>`;

        document.getElementById('gap-missing-skills').innerHTML = (res.hard_skills_missing || []).map(
          s => `<span class="badge badge-need">${s}</span>`
        ).join('') || `<span style="font-size:11px;color:var(--text-muted);">Không có dữ liệu</span>`;

        document.getElementById('gap-suggestions-list').innerHTML = (res.suggestions || []).map(s => `
          <div style="background:rgba(255,255,255,0.03);padding:8px 10px;border-radius:6px;border-left:3px solid #b084fc;">
            <p style="font-size:11px;color:var(--text-muted);margin:0 0 2px 0;"><strong>Gốc:</strong> ${s.original_text}</p>
            <p style="font-size:12px;color:#00e676;margin:0 0 2px 0;"><strong>Tối ưu:</strong> ${s.suggested_improvement}</p>
            <p style="font-size:10px;color:var(--text-dim);margin:0;"><em>${s.reason}</em></p>
          </div>
        `).join('') || `<p style="font-size:11px;color:var(--text-muted);">CV của bạn đã tối ưu rất tốt!</p>`;

        if (gapResultsContainer) gapResultsContainer.style.display = 'block';
        showToast('🎉 Đã phân tích xong Gap Analysis!', 'success');
      } catch (err) {
        showToast(`❌ Lỗi chạy Gap Analysis: ${err.message}`, 'error');
      }
    });
  }

  /* ============================================================
     🎙️ STAR MOCK INTERVIEW SIMULATOR MODAL
  ============================================================ */
  const intOverlay = document.getElementById('modal-interview-overlay');
  const intClose = document.getElementById('modal-interview-close');
  const selectIntCv = document.getElementById('interview-select-cv');
  const selectIntJd = document.getElementById('interview-select-jd');
  const btnStartInt = document.getElementById('btn-start-interview-session');
  const setupSec = document.getElementById('interview-setup-section');
  const chatSec = document.getElementById('interview-chat-section');
  const reportSec = document.getElementById('interview-report-section');
  const chatHistory = document.getElementById('interview-chat-history');
  const answerForm = document.getElementById('interview-answer-form');
  const answerInput = document.getElementById('interview-answer-input');
  const progressText = document.getElementById('interview-progress-text');

  let currentSessionId = null;

  function openInterviewModal() {
    if (!ApiClient.getToken()) {
      showToast('⚠️ Vui lòng đăng nhập trước khi bắt đầu phỏng vấn thử', 'warning');
      openAuthModal();
      return;
    }
    if (intOverlay) intOverlay.classList.add('open');
    populateInterviewOptions();
  }
  function closeInterviewModal() { if (intOverlay) intOverlay.classList.remove('open'); }
  if (intClose) intClose.addEventListener('click', closeInterviewModal);

  document.getElementById('nav-interview')?.addEventListener('click', (e) => { e.preventDefault(); openInterviewModal(); });
  document.getElementById('icon-megaphone-btn')?.addEventListener('click', openInterviewModal);
  document.getElementById('btn-try-free')?.addEventListener('click', openInterviewModal);
  document.getElementById('feature-deep-interview')?.addEventListener('click', openInterviewModal);

  async function populateInterviewOptions() {
    if (!selectIntCv || !selectIntJd) return;
    try {
      const [cvs, jds] = await Promise.all([ApiClient.listCVs(), ApiClient.listJDs()]);
      selectIntCv.innerHTML = cvs.length > 0
        ? cvs.map(c => `<option value="${c.id}">${c.title}</option>`).join('')
        : `<option value="">(Bắt buộc upload 1 CV trước)</option>`;

      selectIntJd.innerHTML = jds.length > 0
        ? jds.map(j => `<option value="${j.id}">${j.title} - ${j.company}</option>`).join('')
        : `<option value="">(Bắt buộc chọn 1 JD trước)</option>`;
    } catch (err) {
      showToast(`Lỗi lấy dữ liệu CV/JD: ${err.message}`, 'error');
    }
  }

  if (btnStartInt) {
    btnStartInt.addEventListener('click', async () => {
      const cvId = selectIntCv?.value;
      const jdId = selectIntJd?.value;
      if (!cvId || !jdId) {
        showToast('Bắt buộc phải chọn đủ 1 CV và 1 JD mới được bắt đầu phỏng vấn', 'warning');
        return;
      }

      try {
        showToast('⏳ AI đang tạo bộ câu hỏi phỏng vấn thử...', 'info');
        const sessionData = await ApiClient.startInterview(cvId, jdId, 5);

        currentSessionId = sessionData.session_id;
        if (setupSec) setupSec.style.display = 'none';
        if (reportSec) reportSec.style.display = 'none';
        if (chatSec) chatSec.style.display = 'flex';
        if (chatHistory) chatHistory.innerHTML = '';

        appendMessage('interviewer', sessionData.question_text);
        if (progressText) progressText.textContent = `Câu hỏi 1 / 5`;
        showToast('🎙️ Phiên phỏng vấn thử đã bắt đầu!', 'success');
      } catch (err) {
        showToast(`❌ Không thể bắt đầu phỏng vấn: ${err.message}`, 'error');
      }
    });
  }

  function appendMessage(sender, text) {
    if (!chatHistory) return;
    const isBot = sender === 'interviewer';
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `
      align-self: ${isBot ? 'flex-start' : 'flex-end'};
      max-width: 80%;
      background: ${isBot ? 'rgba(124,77,255,0.15)' : 'rgba(0,230,118,0.15)'};
      border: 1px solid ${isBot ? 'rgba(124,77,255,0.3)' : 'rgba(0,230,118,0.3)'};
      padding: 10px 14px;
      border-radius: 12px;
      color: #fff;
      font-size: 13px;
      line-height: 1.4;
    `;
    msgDiv.innerHTML = `<strong>${isBot ? '🤖 Nhà tuyển dụng AI' : '👤 Bạn'}:</strong> ${text}`;
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  if (answerForm) {
    answerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ansText = answerInput?.value.trim();
      if (!ansText || !currentSessionId) return;

      appendMessage('user', ansText);
      if (answerInput) answerInput.value = '';

      try {
        const res = await ApiClient.submitAnswer(currentSessionId, ansText);

        if (res.follow_up_question) {
          appendMessage('interviewer', `🔍 <em>Follow-up:</em> ${res.follow_up_question}`);
        } else if (res.is_last_question) {
          appendMessage('interviewer', res.question_text);
          showToast('🎉 Hoàn thành phỏng vấn! Đang tải báo cáo STAR...', 'success');
          setTimeout(() => loadSTARReport(currentSessionId), 1200);
        } else {
          appendMessage('interviewer', res.question_text);
          if (progressText) progressText.textContent = `Câu hỏi ${res.question_index + 1} / 5`;
        }
      } catch (err) {
        showToast(`❌ Lỗi gửi câu trả lời: ${err.message}`, 'error');
      }
    });
  }

  async function loadSTARReport(sessionId) {
    try {
      const report = await ApiClient.getInterviewReport(sessionId);
      if (chatSec) chatSec.style.display = 'none';
      if (reportSec) reportSec.style.display = 'block';

      const totalScoreEl = document.getElementById('report-total-score');
      if (totalScoreEl) totalScoreEl.textContent = `${report.total_score.toFixed(1)} / 100`;

      const scores = report.star_scores || {};
      const starBrkEl = document.getElementById('report-star-breakdown');
      if (starBrkEl) {
        starBrkEl.innerHTML = `
          <div style="background:rgba(255,255,255,0.04);padding:8px;border-radius:6px;">
            <span style="font-size:10px;color:var(--text-dim);">Situation</span>
            <p style="font-size:14px;font-weight:700;color:#00e676;margin:2px 0 0 0;">${scores.situation || 80}</p>
          </div>
          <div style="background:rgba(255,255,255,0.04);padding:8px;border-radius:6px;">
            <span style="font-size:10px;color:var(--text-dim);">Task</span>
            <p style="font-size:14px;font-weight:700;color:#00bcd4;margin:2px 0 0 0;">${scores.task || 80}</p>
          </div>
          <div style="background:rgba(255,255,255,0.04);padding:8px;border-radius:6px;">
            <span style="font-size:10px;color:var(--text-dim);">Action</span>
            <p style="font-size:14px;font-weight:700;color:#b084fc;margin:2px 0 0 0;">${scores.action || 80}</p>
          </div>
          <div style="background:rgba(255,255,255,0.04);padding:8px;border-radius:6px;">
            <span style="font-size:10px;color:var(--text-dim);">Result</span>
            <p style="font-size:14px;font-weight:700;color:#ff8c42;margin:2px 0 0 0;">${scores.result || 80}</p>
          </div>
        `;
      }

      const stEl = document.getElementById('report-strengths-list');
      if (stEl) stEl.innerHTML = (report.strengths || []).map(s => `<li>${s}</li>`).join('');

      const impEl = document.getElementById('report-improvements-list');
      if (impEl) impEl.innerHTML = (report.improvements || []).map(i => `<li>${i}</li>`).join('');

      const recEl = document.getElementById('report-recommendations-list');
      if (recEl) recEl.innerHTML = (report.recommendations || []).map(r => `<li>${r}</li>`).join('');
    } catch (err) {
      showToast(`Không thể tải báo cáo: ${err.message}`, 'error');
    }
  }

  console.log('🚀 Career Copilot X – Space canvas & Deep space background active!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAppLogic);
} else {
  startAppLogic();
}
