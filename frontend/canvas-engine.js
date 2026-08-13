/* ============================================================
   ⭐  CANVAS DEEP SPACE + SHOOTING STARS ENGINE  ⭐
============================================================ */
export function initSpaceCanvas() {
  const canvas = document.getElementById('space-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H;
  // Keep a dense, clearly visible star field around the main content.
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

    }

    requestAnimationFrame(draw);
  }
  draw();
}