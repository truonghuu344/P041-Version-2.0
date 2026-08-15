/* ============================================================
   CAREER COPILOT X – app.js
/* ============================================================
   CAREER COPILOT X – app.js
   Deep Space Starfield + Shooting Stars Animation Engine
   FastAPI Backend Integration (PostgreSQL)
   ============================================================ */

// Gọi cùng origin; Next.js sẽ proxy sang FastAPI. Cách này tránh lỗi CORS khi
// người dùng mở UI bằng localhost, 127.0.0.1 hoặc một hostname triển khai khác.
const API_BASE_URL = window.__CAREER_API_BASE_URL__ || '/api/v1';

class ApiClient {
  static getToken() {
    return localStorage.getItem('access_token');
  }

  static setToken(token) {
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  static getUser() {
    const u = localStorage.getItem('user_info');
    return u ? JSON.parse(u) : null;
  }

  static isAuthenticated() {
    // Cache user chỉ được ghi sau login hoặc sau khi /auth/me xác minh cookie HttpOnly.
    return Boolean(this.getUser());
  }

  static setUser(user) {
    localStorage.setItem('user_info', JSON.stringify(user));
  }

  static async logout() {
    await this.request('/auth/logout', { method: 'POST' }).catch(() => undefined);
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

    const config = { ...options, headers, credentials: 'include' };

    try {
      const requestUrl = /^https?:\/\//i.test(endpoint) ? endpoint : `${API_BASE_URL}${endpoint}`;
      const response = await fetch(requestUrl, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.detail || data.message || `Lỗi HTTP ${response.status}`;
        const requestError = new Error(errorMsg);
        requestError.status = response.status;
        requestError.payload = data;
        throw requestError;
      }

      return data;
    } catch (err) {
      if (!options.silent && (!err.status || err.status >= 500)) {
        console.error(`API Error [${endpoint}]:`, err);
      }
      if (err instanceof TypeError && /failed to fetch/i.test(err.message)) {
        throw new Error('Không thể kết nối máy chủ xử lý CV. Hãy kiểm tra FastAPI đang chạy ở cổng 8000.');
      }
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

  static async requestPasswordReset(email) {
    return await this.request('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  static async confirmPasswordReset(email, otp, newPassword) {
    return await this.request('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ email, otp, new_password: newPassword }),
    });
  }

  static async getMe() {
    try {
      const user = await this.request('/auth/me', { silent: true });
      if (user) {
        this.setUser(user);
      }
      return user;
    } catch (err) {
      if (err && err.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_info');
        return null;
      }
      throw err;
    }
  }

  static async googleAuth(credential, role = 'student') {
    const data = await this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential, role }),
    });
    if (data.access_token) {
      this.setToken(data.access_token);
      this.setUser(data.user);
    }
    return data;
  }

  // --- CV APIs ---
  static async uploadCV(file, title = '', useLLM = true) {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    formData.append('use_llm', String(Boolean(useLLM)));

    return await this.request('/cvs/upload', {
      method: 'POST',
      body: formData,
    });
  }

  static async uploadCVForMatch(file, title = '') {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    formData.append('use_llm', 'false');
    formData.append('parse_mode', 'auto');
    return await this.request('/cvs/upload', { method: 'POST', body: formData });
  }

  static async listCVs() {
    return await this.request('/cvs');
  }

  static async createManualCV(payload) {
    return await this.request('/cvs/manual', { method: 'POST', body: JSON.stringify(payload) });
  }

  static async decideSuggestion(analysisId, suggestionIndex, accepted, finalText = null) {
    return await this.request(`/analysis/${analysisId}/suggestions`, {
      method: 'PUT',
      body: JSON.stringify({ suggestion_index: suggestionIndex, accepted, final_text: finalText }),
    });
  }

  static async optimizeResume(analysisId, optimizationMode = 'balanced', language = 'vi') {
    return await this.request(`/analysis/${analysisId}/optimize`, {
      method: 'POST',
      body: JSON.stringify({ optimization_mode: optimizationMode, language }),
    });
  }

  static async listOptimizationDecisions(analysisId) {
    return await this.request(`/analysis/${analysisId}/suggestions`);
  }

  static async downloadCV(cvId, analysisId, template = null) {
    const query = new URLSearchParams();
    if (template) query.set('template', template);
    if (analysisId) query.set('analysis_id', analysisId);
    const token = this.getToken();
    const response = await fetch(`${API_BASE_URL}/cvs/${cvId}/export?${query}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'Không thể xuất PDF.');
    }
    return response.blob();
  }

  static async getCVAgentStatus() {
    return await this.request('/cvs/agent/status');
  }

  static async reanalyzeCV(cvId, useLLM = true) {
    const formData = new FormData();
    formData.append('use_llm', String(Boolean(useLLM)));
    return await this.request(`/cvs/${cvId}/analyze`, { method: 'POST', body: formData });
  }

  static async deleteCV(cvId) {
    return await this.request(`/cvs/${cvId}`, { method: 'DELETE' });
  }

  static async bulkDeleteCVs(cvIds) {
    const uniqueCVIds = [...new Set(cvIds)].filter(Boolean);
    try {
      return await this.request('/cvs/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ cv_ids: uniqueCVIds }),
      });
    } catch (err) {
      // Tương thích với tiến trình backend cũ chưa được restart sau khi thêm
      // endpoint bulk-delete: dùng API xóa đơn đã có thay vì làm hỏng toàn bộ thao tác.
      if (![404, 405].includes(err.status)) throw err;
      const deletedIds = [];
      for (const cvId of uniqueCVIds) {
        await this.deleteCV(cvId);
        deletedIds.push(cvId);
      }
      return { deleted_ids: deletedIds, deleted_count: deletedIds.length };
    }
  }

  // --- JD APIs ---
  static async listJDs() {
    return await this.request('/jds');
  }

  static async selectCatalogJD(sourceId) {
    return await this.request(`/jds/catalog/${encodeURIComponent(sourceId)}/select`, {
      method: 'POST',
    });
  }

  static async searchJobs(query = '', cvId = '', limit = 60) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (query) params.set('q', query);
    if (cvId) params.set('cv_id', cvId);
    return await this.request(`/jobs?${params.toString()}`);
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

  static async uploadJD(file, title = '', company = '', location = '') {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (company) formData.append('company', company);
    if (location) formData.append('location', location);
    return await this.request('/jds/upload', { method: 'POST', body: formData });
  }

  // --- Gap Analysis APIs ---
  static async runGapAnalysis(cvId, jdId) {
    return await this.request('/analysis/gap-analysis', {
      method: 'POST',
      body: JSON.stringify({ cv_id: cvId, jd_id: jdId }),
    });
  }

  // Match jobs run in the background so the UI can show deterministic pipeline progress.
  static async startMatch(cvId, jdId) {
    return await this.request('/matches', {
      method: 'POST',
      body: JSON.stringify({ cv_id: cvId, job_id: jdId }),
    });
  }

  static async getMatch(matchId) {
    return await this.request(`/matches/${matchId}`);
  }

  static async getMatchReport(matchId) {
    return await this.request(`/matches/${matchId}/report`);
  }

  static async getAnalysisHistory() {
    return await this.request('/analysis/history');
  }

  // --- Mock Interview APIs ---
  static async startInterview(cvId, jdId, totalQuestions = 5, context = {}) {
    return await this.request('/interviews/start', {
      method: 'POST',
      body: JSON.stringify({ cv_id: cvId, jd_id: jdId, total_questions: totalQuestions, ...context }),
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

  static async listInterviews() { return await this.request('/interviews'); }
  static async resumeInterview(sessionId) { return await this.request(`/interviews/${sessionId}/resume`); }
  static async rateInterview(sessionId, rating, comment = '') {
    return await this.request(`/interviews/${sessionId}/feedback`, {
      method: 'POST', body: JSON.stringify({ rating, comment }),
    });
  }

  static async grantCounselor(counselorEmail) {
    return await this.request('/counselor/consents', {
      method: 'POST', body: JSON.stringify({ counselor_email: counselorEmail }),
    });
  }
  static async listCounselorConsents() { return await this.request('/counselor/consents'); }
  static async revokeCounselor(assignmentId) {
    return await this.request(`/counselor/consents/${assignmentId}`, { method: 'DELETE' });
  }
  static async listAssignedStudents() { return await this.request('/counselor/students'); }
  static async getStudentOverview(studentId) { return await this.request(`/counselor/students/${studentId}`); }
  static async getProductMetrics() { return await this.request('/metrics/product'); }
  static async sendCounselorFeedback(studentId, content, kind = 'comment') {
    return await this.request(`/counselor/students/${studentId}/feedback`, {
      method: 'POST', body: JSON.stringify({ content, kind }),
    });
  }

  static async publishJD(jdId) { return await this.request(`/jds/${jdId}/publish`, { method: 'PATCH' }); }
  static async listEnterpriseJDs() { return await this.request('/enterprise/jds'); }
  static async shareCV(jdId, cvId, analysisId = null) {
    return await this.request('/enterprise/applications', {
      method: 'POST', body: JSON.stringify({ jd_id: jdId, cv_id: cvId, analysis_id: analysisId }),
    });
  }
  static async listCandidates(jdId) { return await this.request(`/enterprise/jds/${jdId}/candidates`); }
  static async getCandidateCV(applicationId) { return await this.request(`/enterprise/applications/${applicationId}/cv`); }
  static async decideCandidate(applicationId, candidateStatus) {
    return await this.request(`/enterprise/applications/${applicationId}`, {
      method: 'PATCH', body: JSON.stringify({ status: candidateStatus }),
    });
  }

  // --- Draggable Career Assistant Agent ---
  static getAssistantFallbackUrl(endpoint) {
    const configuredBase = window.__NOVA_API_BASE_URL__;
    if (configuredBase) return `${configuredBase.replace(/\/$/, '')}${endpoint}`;
    return '';
  }

  static async requestAssistant(endpoint, options = {}) {
    const localNovaUrl = this.getAssistantFallbackUrl(endpoint);
    if (localNovaUrl) {
      try {
        return await this.request(localNovaUrl, options);
      } catch (err) {
        if (err.status && ![404, 405].includes(err.status)) throw err;
      }
    }
    return await this.request(endpoint, options);
  }

  static async getAssistantStatus() {
    try {
      return await this.requestAssistant('/assistant/status', { silent: true });
    } catch (_err) {
      return { configured: false, weather_configured: false, model: 'Offline' };
    }
  }

  static async chatWithAssistant(message, history = [], currentPage = 'dashboard', conversationId = null, operation = null) {
    const options = {
      method: 'POST',
      body: JSON.stringify({
        message,
        history,
        current_page: currentPage,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        conversation_id: conversationId,
        operation,
      }),
    };
    return await this.requestAssistant('/assistant/chat', options);
  }

  static async listAssistantConversations() {
    return await this.requestAssistant('/assistant/conversations');
  }

  static async getAssistantConversation(conversationId) {
    return await this.requestAssistant(`/assistant/conversations/${conversationId}`);
  }

  static async deleteAssistantConversation(conversationId) {
    return await this.requestAssistant(`/assistant/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  // --- Admin APIs ---
  static async listAllUsers() {
    return await this.request('/admin/users');
  }

  static async createUserByAdmin(email, password, fullName, role) {
    return await this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName, role }),
    });
  }

  static async updateUserByAdmin(userId, payload) {
    return await this.request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  static async deleteUserByAdmin(userId) {
    return await this.request(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  static async listAILogs(search = '', success = '') {
    const params = new URLSearchParams({ limit: '100' });
    if (search) params.set('search', search);
    if (success !== '') params.set('success', success);
    return await this.requestAssistant(`/admin/ai-logs?${params.toString()}`);
  }

  static async getAILogStats() {
    return await this.requestAssistant('/admin/ai-logs/stats');
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


function startAppLogic() {
  initSpaceCanvas();

  function escapeHtml(value = '') {
    const node = document.createElement('div');
    node.textContent = String(value);
    return node.innerHTML;
  }

  function formatTextToHTML(value = '') {
    return escapeHtml(value).replace(/\r?\n/g, '<br>');
  }

  function applyDomField(id, property, value, missingIds = []) {
    const element = document.getElementById(id);
    if (!element) {
      missingIds.push(id);
      return false;
    }
    element[property] = value;
    return true;
  }

  /* ── STAR score badge grid (Situation/Task/Action/Result) ──
     Shared by loadPageSTARReport(), renderArchiveDetailStarSection() and the
     legacy loadSTARReport() modal so the 4 score cards look identical
     everywhere. Colors come from the --situation/--task/--action/--result
     CSS variables (light-mode pastel palette, dark-mode neon palette) —
     no hex is hardcoded here. `fallback` mirrors each caller's previous
     behavior: a number (e.g. 80) to substitute for missing scores, or null
     to render an em dash instead. */
  const STAR_BADGE_ICONS = {
    situation: '<svg viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    task: '<svg viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 12h6M9 16h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    action: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    result: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  };
  const STAR_BADGE_LABELS = [
    ['situation', 'Situation'],
    ['task', 'Task'],
    ['action', 'Action'],
    ['result', 'Result'],
  ];
  function renderStarBadgeGrid(scores = {}, fallback = null) {
    return STAR_BADGE_LABELS.map(([key, label]) => {
      const raw = scores ? scores[key] : null;
      const value = raw != null ? raw : (fallback != null ? fallback : '—');
      return `
        <div class="star-badge ${key}">
          <div class="star-badge-icon">${STAR_BADGE_ICONS[key]}</div>
          <span class="star-badge-label">${label}</span>
          <p class="star-badge-value">${value}</p>
        </div>
      `;
    }).join('');
  }

  /* ── Toast Notification Helper ── */
  function showToast(msg, type = 'info') {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t?.classList.add('show')));
    setTimeout(() => {
      t?.classList.remove('show');
      setTimeout(() => t.remove(), 350);
    }, 3200);
  }

  function applyDomField(id, prop, value, missingIds = []) {
    const el = document.getElementById(id);
    if (el) {
      el[prop] = value;
    } else {
      missingIds.push(id);
    }
  }

  /* ============================================================
     🚀 ROUTER & SINGLE PAGE VIEW SWITCHER
  ============================================================ */
  /* ============================================================
     🚀 ROUTER & SPACESHIP SINGLE PAGE VIEW SWITCHER
  ============================================================ */
  const ALL_VIEWS = ['dashboard', 'cv', 'find-jobs', 'jobs', 'match', 'gap', 'interview', 'history', 'profile', 'counselor', 'enterprise', 'admin'];
  const ROLE_HOME_VIEWS = Object.freeze({
    student: 'dashboard',
    counselor: 'counselor',
    enterprise: 'enterprise',
    admin: 'admin'
  });
  const ROLE_NAV_ITEMS = Object.freeze({
    guest: ['nav-dashboard', 'nav-cv', 'nav-find-jobs', 'nav-match', 'nav-interview', 'nav-gap'],
    student: ['nav-dashboard', 'nav-cv', 'nav-find-jobs', 'nav-match', 'nav-interview', 'nav-history', 'nav-gap'],
    counselor: ['nav-counselor', 'nav-counselor-reports'],
    enterprise: ['nav-enterprise', 'nav-jobs', 'nav-enterprise-applications'],
    admin: ['nav-admin']
  });
  const ALL_ROLE_NAV_IDS = [...new Set(Object.values(ROLE_NAV_ITEMS).flat())];
  const ROLE_DASHBOARD_VIEWS = new Set(Object.values(ROLE_HOME_VIEWS));
  let currentViewName = 'dashboard';

  function getRoleHomeView(user = ApiClient.getUser()) {
    return ROLE_HOME_VIEWS[user?.role] || 'dashboard';
  }

  function canAccessView(viewName, user = ApiClient.getUser()) {
    if (!ROLE_DASHBOARD_VIEWS.has(viewName)) return true;
    if (!user) return viewName === 'dashboard';
    return viewName === getRoleHomeView(user);
  }

  function switchToRoleHome() {
    switchView(getRoleHomeView());
  }

  const roomTitles = {
    dashboard: 'COMMAND DECK // HOME',
    cv: 'DECK ALPHA // RESUME LAB',
    'find-jobs': 'DECK BETA // AI JOB DISCOVERY',
    jobs: 'DECK BETA // CAREER MAP',
    match: 'DECK MATCH // AI ANALYSIS',
    interview: 'DECK GAMMA // SIMULATION CHAMBER',
    history: 'DECK EPSILON // MISSION ARCHIVE',
    'archive-detail': 'DECK EPSILON // CHI TIẾT NHIỆM VỤ',
    profile: 'DECK ZETA // CREW TERMINAL',
    counselor: 'HITL DECK // COUNSELOR',
    enterprise: 'RECRUITMENT DECK // ENTERPRISE',
    admin: 'DECK OMEGA // ADMIN PORTAL'
  };

  function switchView(targetViewName) {
    if (!ALL_VIEWS.includes(targetViewName)) targetViewName = 'dashboard';

    if (!canAccessView(targetViewName)) {
      targetViewName = getRoleHomeView();
      showToast('Bạn đã được chuyển về dashboard phù hợp với vai trò.', 'info');
    }

    const VIEW_ORDER = ['dashboard', 'cv', 'find-jobs', 'jobs', 'match', 'gap', 'interview', 'history', 'profile', 'counselor', 'enterprise', 'admin'];
    const currentIndex = VIEW_ORDER.indexOf(currentViewName);
    const targetIndex = VIEW_ORDER.indexOf(targetViewName);
    const direction = targetIndex >= currentIndex ? 'right' : 'left';

    // Trigger Spaceship Corridor Hatch Sweep Line
    const corridorSweep = document.getElementById('spaceship-corridor-sweep');
    if (corridorSweep) {
      corridorSweep?.classList.remove('sweep-left', 'sweep-right');
      void corridorSweep.offsetWidth; // Force reflow
      corridorSweep?.classList.add(`sweep-${direction}`, 'active');
      setTimeout(() => corridorSweep?.classList.remove('active'), 550);
    }

    ALL_VIEWS.forEach(key => {
      const vEl = document.getElementById(`view-${key}`);
      const navEl = document.getElementById(`nav-${key}`);
      if (vEl) {
        if (key === targetViewName) {
          vEl?.classList.add('active');
          vEl.style.display = 'block';
        } else {
          vEl?.classList.remove('active');
          vEl.style.display = 'none';
        }
      }
      if (navEl) {
        if (key === targetViewName) {
          navEl?.classList.add('active');
        } else {
          navEl?.classList.remove('active');
        }
      }
    });

    currentViewName = targetViewName;
    document.body.classList.toggle('focus-mode', targetViewName === 'match');
    document.querySelectorAll('[data-mobile-view]').forEach(button => {
      button?.classList.toggle('active', button.dataset.mobileView === targetViewName);
    });

    // Nova nằm ngoài các app-view và luôn khả dụng trên mọi trang/role.
    const novaCompanion = document.getElementById('ai-companion');
    const novaPanel = document.getElementById('ai-companion-chat');
    if (novaCompanion && (!novaPanel || novaPanel.hidden)) novaCompanion.hidden = false;

    // Update Room Indicator HUD Label
    const indicatorLabel = document.getElementById('indicator-label');
    if (indicatorLabel && roomTitles[targetViewName]) {
      indicatorLabel.textContent = roomTitles[targetViewName];
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Trigger page-specific data loading & widget setup
    if (targetViewName === 'cv') {
      loadSpaceshipCVList();
      loadCVAgentStatus();
    } else if (targetViewName === 'match') {
      loadSpaceshipCVList();
      loadCVJDOptions();
    } else if (targetViewName === 'gap') {
      renderGapDetailFromCurrentMatch();
    } else if (targetViewName === 'find-jobs') {
      initializeJobSearchView();
    } else if (targetViewName === 'jobs') {
      loadPageJDList();
      initStarMapNodes();
    } else if (targetViewName === 'interview') {
      populatePageInterviewOptions();
      startAudioWaveformAnim();
    } else if (targetViewName === 'history') {
      loadMissionArchive();
    } else if (targetViewName === 'profile') {
      loadStudentCounselorConsents();
    } else if (targetViewName === 'counselor') {
      loadCounselorDashboard();
    } else if (targetViewName === 'enterprise') {
      loadEnterpriseDashboard();
    } else if (targetViewName === 'admin') {
      loadAdminUsersList();
    }
  }

  window.switchView = switchView;

  function initStarMapNodes() {
    const nodes = document.querySelectorAll('.star-map-container .node-job');
    nodes.forEach(node => {
      node?.addEventListener('click', () => {
        nodes.forEach(n => n?.classList.remove('active'));
        node?.classList.add('active');
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

  // Register Navbar Link Click Handlers
  document.getElementById('brand-logo')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchToRoleHome();
  });

  document.getElementById('nav-dashboard')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchToRoleHome();
  });

  document.getElementById('nav-cv')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('cv');
  });

  document.getElementById('nav-find-jobs')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('find-jobs');
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

  document.getElementById('nav-admin')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('admin');
  });

  // Archive Filter Handlers
  document.querySelectorAll('.archive-filter-btn').forEach(btn => {
    btn?.addEventListener('click', () => {
      document.querySelectorAll('.archive-filter-btn').forEach(b => b?.classList.remove('active'));
      btn?.classList.add('active');
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
    btn?.addEventListener('click', () => {
      document.querySelectorAll('.persona-btn').forEach(b => b?.classList.remove('active'));
      btn?.classList.add('active');
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
  document.getElementById('feature-cv')?.addEventListener('click', () => switchView('cv'));

  document.getElementById('icon-location-btn')?.addEventListener('click', () => switchView('jobs'));
  document.getElementById('feature-keywords')?.addEventListener('click', () => switchView('find-jobs'));

  document.getElementById('icon-megaphone-btn')?.addEventListener('click', () => switchView('interview'));
  document.getElementById('btn-try-free')?.addEventListener('click', () => switchView('interview'));
  document.getElementById('feature-interview')?.addEventListener('click', () => switchView('interview'));
  document.getElementById('feature-deep-interview')?.addEventListener('click', () => switchView('interview'));

  document.getElementById('feature-optimize')?.addEventListener('click', () => switchView('cv'));

  /* ============================================================
     🌌 WHITE SPACESHIP CV UPLOAD & MANAGEMENT LOGIC
  ============================================================ */
  const cvPageForm = document.getElementById('cv-page-upload-form');
  const cvPageFileInput = document.getElementById('cv-page-file-input');
  const cvPageTitleInput = document.getElementById('cv-page-title-input');
  const cvDropzone = document.getElementById('cv-dropzone');
  const selectedFileNameEl = document.getElementById('selected-file-name');
  const cvPageListContainer = document.getElementById('cv-page-list-container');
  const careerCVTableBody = document.getElementById('career-cv-table-body');
  const careerSnapshot = document.getElementById('career-portfolio-snapshot');
  const careerVersionsSection = document.getElementById('career-versions-section');
  const careerEmptyState = document.getElementById('career-portfolio-empty');
  const careerBuddyInsight = document.getElementById('career-buddy-insight');
  const careerSearchInput = document.getElementById('career-cv-search');
  const cvBulkToolbar = document.getElementById('cv-bulk-toolbar');
  const cvSelectAll = document.getElementById('cv-select-all');
  const cvSelectedCount = document.getElementById('cv-selected-count');
  const btnDeleteSelectedCVs = document.getElementById('btn-delete-selected-cvs');
  const cvAgentProgress = document.getElementById('cv-agent-progress');
  const cvAnalysisCvSelect = document.getElementById('cv-analysis-cv-select');
  const cvSelectedCvHint = document.getElementById('cv-selected-cv-hint');
  const cvAnalysisJdSelect = document.getElementById('cv-analysis-jd-select');
  const cvSelectedJdHint = document.getElementById('cv-selected-jd-hint');
  const cvJdUploadForm = document.getElementById('cv-jd-upload-form');
  const cvJdFileInput = document.getElementById('cv-jd-file-input');
  const cvJdFileName = document.getElementById('cv-jd-file-name');
  const cvAnalysisResultsCard = document.getElementById('cv-analysis-results-card');
  const cvAnalysisEmptyState = document.getElementById('cv-analysis-empty-state');
  const cvAnalysisResultContent = document.getElementById('cv-analysis-result-content');
  const gapResultModal = document.getElementById('gap-result-modal');
  const gapResultModalClose = document.getElementById('gap-result-modal-close');
  const btnOptimizeCvAI = document.getElementById('btn-optimize-cv-ai');
  const cvAiOptimizationStatus = document.getElementById('cv-ai-optimization-status');
  const cvOptimizationMode = document.getElementById('cv-optimization-mode');

  const inspectorDeck = document.getElementById('cv-detail-inspector');
  const btnCloseInspector = document.getElementById('btn-close-cv-detail');
  let loadedCVs = [];
  let inspectedCV = null;
  let selectedCVIds = new Set();
  let latestCVAnalysisContext = null;
  let targetJobCatalog = [];
  let activeTargetJobFilter = '';
  let targetJobPage = 1;
  let gapResultPreviousFocus = null;
  const TARGET_JOBS_PER_PAGE = 8;

  function openGapResultModal() {
    if (!gapResultModal) return;
    gapResultPreviousFocus = document.activeElement;
    gapResultModal.hidden = false;
    document.body.classList.add('gap-result-modal-open');
    window.requestAnimationFrame(() => gapResultModalClose?.focus());
  }

  function closeGapResultModal() {
    if (!gapResultModal || gapResultModal.hidden) return;
    gapResultModal.hidden = true;
    document.body.classList.remove('gap-result-modal-open');
    if (gapResultPreviousFocus instanceof HTMLElement) gapResultPreviousFocus.focus();
  }

  gapResultModalClose?.addEventListener('click', closeGapResultModal);
  gapResultModal?.addEventListener('click', event => {
    if (event.target === gapResultModal) closeGapResultModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !gapResultModal?.hidden) closeGapResultModal();
  });

  function getMatchJobsPerPage() {
    const perPageSelect = document.getElementById('p1-job-per-page');
    const parsed = Number(perPageSelect?.value || TARGET_JOBS_PER_PAGE);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : TARGET_JOBS_PER_PAGE;
  }

  function formatJobSalary(value) {
    const raw = String(value || '').trim();
    if (!raw || /^negotiable$/i.test(raw)) return '';
    return raw;
  }

  function getSelectedTargetJob() {
    const sel = cvAnalysisJdSelect;
    if (!sel?.value) return null;
    const option = [...(sel.options || [])].find(item => item.value === sel.value);
    if (!option) return null;
    const [title, company = ''] = option.textContent.split('·').map(part => part.trim());
    return targetJobCatalog.find(job => job.title === title && (!company || job.company === company))
      || targetJobCatalog.find(job => job.title === title)
      || null;
  }

  function populateMatchLocationFilter() {
    const locationSelect = document.getElementById('p1-job-location-filter');
    if (!locationSelect) return;
    const previous = locationSelect.value;
    const locations = [...new Set(targetJobCatalog.map(job => job.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
    locationSelect.innerHTML = [
      '<option value="">Tất cả địa điểm</option>',
      ...locations.map(location => `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`),
    ].join('');
    if ([...locationSelect.options].some(option => option.value === previous)) {
      locationSelect.value = previous;
    }
  }

  async function waitForMatchResult(matchId, { timeoutMs = 120000, intervalMs = 1200 } = {}) {
    const startedAt = Date.now();
    let latest = null;
    while (Date.now() - startedAt < timeoutMs) {
      latest = await ApiClient.getMatch(matchId);
      if (latest.status === 'COMPLETED') {
        const result = latest.result || await ApiClient.getMatchReport(matchId);
        if (latest.analysis_id && !result.id) result.id = latest.analysis_id;
        return result;
      }
      if (latest.status === 'FAILED') {
        throw new Error(latest.error?.message || 'Không thể hoàn tất Match CV với JD.');
      }
      const progress = Math.max(0, Math.min(100, Number(latest.progress_percent || 0)));
      const matchButton = document.getElementById('p1-analyze-btn');
      if (matchButton) matchButton.textContent = `Đang phân tích ${progress}%`;
      await new Promise(resolve => window.setTimeout(resolve, intervalMs));
    }
    throw new Error('Match đang xử lý lâu hơn dự kiến. Vui lòng thử lại sau ít phút.');
  }

  function updateCVBulkSelectionUI() {
    const selectedCount = selectedCVIds.size;
    if (cvSelectedCount) {
      cvSelectedCount.textContent = selectedCount ? `Đã chọn ${selectedCount} CV` : 'Chưa chọn CV';
    }
    if (btnDeleteSelectedCVs) btnDeleteSelectedCVs.disabled = selectedCount === 0;
    if (cvSelectAll) {
      cvSelectAll.checked = loadedCVs.length > 0 && selectedCount === loadedCVs.length;
      cvSelectAll.indeterminate = selectedCount > 0 && selectedCount < loadedCVs.length;
    }
    cvPageListContainer?.querySelectorAll('.cv-manifest-item').forEach(item => {
      item?.classList.toggle('is-selected', selectedCVIds.has(item.dataset.cvId));
    });
  }

  function setAgentProgress(activeStep = '') {
    if (!cvAgentProgress) return;
    cvAgentProgress.hidden = !activeStep;
    const order = ['upload', 'extract', 'llm', 'guardrail', 'match', 'save'];
    const activeIndex = order.indexOf(activeStep);
    cvAgentProgress.querySelectorAll('[data-agent-step]').forEach((element, index) => {
      element?.classList.toggle('active', index === activeIndex);
      element?.classList.toggle('done', index < activeIndex);
    });
  }

  async function loadCVAgentStatus() {
    const statusEl = document.getElementById('cv-agent-runtime-status');
    const modelEl = document.getElementById('cv-agent-model');
    if (!statusEl || !ApiClient.isAuthenticated()) return;
    try {
      const status = await ApiClient.getCVAgentStatus();
      statusEl.innerHTML = `<i class="pill-dot ${status.configured ? 'green' : 'purple'}"></i> ${status.configured ? 'AI AGENT READY' : 'AI AGENT READY · GEMINI CHƯA CẤU HÌNH'}`;
      if (modelEl) modelEl.textContent = `${status.provider}/${status.model}`;
    } catch (err) {
      statusEl.innerHTML = '<i class="pill-dot purple"></i> KHÔNG ĐỌC ĐƯỢC AI STATUS';
    }
  }

  // Dropzone drag & drop handlers
  if (cvDropzone) {
    cvDropzone?.addEventListener('click', () => cvPageFileInput?.click());
    cvDropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      cvDropzone?.classList.add('dragover');
    });
    cvDropzone?.addEventListener('dragleave', () => cvDropzone?.classList.remove('dragover'));
    cvDropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      cvDropzone?.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        cvPageFileInput.files = e.dataTransfer.files;
        updateSelectedFileName();
      }
    });
  }

  if (cvPageFileInput) {
    cvPageFileInput?.addEventListener('change', updateSelectedFileName);
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

  function updateCVJDSelectionHint() {
    if (!cvSelectedJdHint || !cvAnalysisJdSelect) return;
    const selected = cvAnalysisJdSelect.options[cvAnalysisJdSelect.selectedIndex];
    if (cvAnalysisJdSelect.value && selected) {
      const selectedLabel = selected.textContent.trim();
      cvSelectedJdHint.textContent = `✓ AI Agent sẽ phân tích theo: ${selectedLabel}`;
      cvSelectedJdHint.title = selectedLabel;
      cvSelectedJdHint?.classList.add('is-selected');
    } else {
      cvSelectedJdHint.textContent = 'JD là bắt buộc để AI Agent phân tích đúng vị trí ứng tuyển.';
      cvSelectedJdHint.removeAttribute('title');
      cvSelectedJdHint?.classList.remove('is-selected');
    }
  }

  function updateCVSelectionHint() {
    if (!cvSelectedCvHint || !cvAnalysisCvSelect) return;
    const selected = cvAnalysisCvSelect.options[cvAnalysisCvSelect.selectedIndex];
    if (cvAnalysisCvSelect.value && selected) {
      cvSelectedCvHint.textContent = `✓ CV sẽ được phân tích: ${selected.textContent}`;
      cvSelectedCvHint?.classList.add('is-selected');
    } else {
      cvSelectedCvHint.textContent = 'Chọn CV trong kho hoặc tải file mới ngay bên dưới.';
      cvSelectedCvHint?.classList.remove('is-selected');
    }
  }

  async function loadCVJDOptions(preferredJdId = '') {
    if (!cvAnalysisJdSelect) return;
    if (!ApiClient.isAuthenticated()) {
      cvAnalysisJdSelect.innerHTML = '<option value="">Vui lòng đăng nhập để chọn JD</option>';
      cvAnalysisJdSelect.disabled = true;
      enhanceGapSelect(cvAnalysisJdSelect);
      updateCVJDSelectionHint();
      return;
    }
    const previousValue = preferredJdId || cvAnalysisJdSelect.value;
    try {
      const [jds, catalogResult] = await Promise.all([
        ApiClient.listJDs(),
        ApiClient.searchJobs('', '', 100).catch(() => ({ jobs: [] })),
      ]);
      const catalogJobs = catalogResult.jobs || [];
      targetJobCatalog = catalogJobs;
      const storedCatalogBySource = new Map(
        (jds || [])
          .filter(jd => jd.normalized_json?.source === 'data/jds' && jd.normalized_json?.source_id)
          .map(jd => [String(jd.normalized_json.source_id), jd]),
      );
      const savedJDs = (jds || []).filter(jd => jd.normalized_json?.source !== 'data/jds');
      const catalogOptions = catalogJobs.map(job => {
        const storedJD = storedCatalogBySource.get(String(job.source_id));
        const value = storedJD?.id || `catalog:${job.source_id}`;
        return `<option value="${escapeHtml(value)}">${escapeHtml(job.title)} · ${escapeHtml(job.company || 'Doanh nghiệp')}</option>`;
      });
      const savedOptions = savedJDs.map(jd => `<option value="${escapeHtml(jd.id)}">${escapeHtml(jd.title)} · ${escapeHtml(jd.company || 'Chưa ghi công ty')}</option>`);
      cvAnalysisJdSelect.disabled = false;
      cvAnalysisJdSelect.innerHTML = [
        '<option value="">Chọn một JD để phân tích CV</option>',
        ...(catalogOptions.length ? [`<optgroup label="JD DOANH NGHIỆP TRONG DATA/JDS (${catalogOptions.length})">${catalogOptions.join('')}</optgroup>`] : []),
        ...(savedOptions.length ? [`<optgroup label="JD ĐÃ LƯU HOẶC HỆ THỐNG">${savedOptions.join('')}</optgroup>`] : []),
      ].join('');
      if ([...cvAnalysisJdSelect.options].some(option => option.value === previousValue)) {
        cvAnalysisJdSelect.value = previousValue;
      } else if (preferredJdId) {
        // Race condition: JD vừa tạo chưa có trong listJDs() response → thêm option tạm để giữ value
        const tempOption = document.createElement('option');
        tempOption.value = preferredJdId;
        tempOption.textContent = 'JD vừa tải lên';
        cvAnalysisJdSelect.appendChild(tempOption);
        cvAnalysisJdSelect.value = preferredJdId;
      }
      const preselectedJDId = window.sessionStorage.getItem('career-preselected-jd-id');
      if (preselectedJDId && [...cvAnalysisJdSelect.options].some(option => option.value === preselectedJDId)) {
        cvAnalysisJdSelect.value = preselectedJDId;
        window.sessionStorage.removeItem('career-preselected-jd-id');
      }
      enhanceGapSelect(cvAnalysisJdSelect);
      updateCVJDSelectionHint();
      renderTargetJobDiscovery();
      document.dispatchEvent(new Event('career:match-ui-update'));
    } catch (err) {
      cvAnalysisJdSelect.innerHTML = '<option value="">Không thể tải danh sách JD</option>';
      cvAnalysisJdSelect.disabled = true;
      enhanceGapSelect(cvAnalysisJdSelect);
      showToast(`Không thể tải JD: ${err.message}`, 'error');
    }
  }

  function careerCVDate(cv) {
    const value = cv.updated_at || cv.created_at;
    if (!value) return 'Chưa có thời gian cập nhật';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Chưa có thời gian cập nhật' : `Cập nhật ${date.toLocaleDateString('vi-VN')}`;
  }

  function careerCVSkills(cv) {
    const parsed = cv.parsed_json || {};
    const skills = Array.isArray(parsed.hard_skills) ? parsed.hard_skills : (Array.isArray(parsed.skills) ? parsed.skills : []);
    return skills.slice(0, 3).map(skill => String(skill)).filter(Boolean);
  }

  function careerPreviewMarkup() {
    return `<div class="career-document-preview" aria-hidden="true"><div class="career-document-sheet"><span class="career-document-name">CAREER PROFILE</span><span class="career-document-title"></span><span class="career-document-label">EXPERIENCE</span><span class="career-document-line"></span><span class="career-document-line short"></span><span class="career-document-label">SKILLS</span><span class="career-document-skills"><i></i><i></i><i></i></span></div></div>`;
  }

  function renderCareerPortfolioCVs(cvs, query = '') {
    if (!careerCVTableBody) return;
    const normalizedQuery = String(query).trim().toLocaleLowerCase('vi');
    const ordered = [...(cvs || [])].sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
    const matching = normalizedQuery ? ordered.filter(cv => `${cv.title || ''} ${cv.file_name || ''}`.toLocaleLowerCase('vi').includes(normalizedQuery)) : ordered;
    const rowMarkup = (cv, index) => {
      const title = escapeHtml(cv.title || cv.file_name || 'CV chưa đặt tên');
      const skills = careerCVSkills(cv);
      return `<tr><td><strong>${title}</strong><small>${escapeHtml(cv.file_name || 'CV đã lưu')}</small></td><td>${escapeHtml(careerCVDate(cv))}</td><td><div class="career-skill-list">${skills.length ? skills.map(skill => `<span>${escapeHtml(skill)}</span>`).join('') : '<span>Chưa trích xuất</span>'}</div></td><td><span class="career-table-status">Đã lưu</span></td><td class="career-table-actions-cell"><button type="button" data-career-open-index="${index}">Mở</button><button type="button" data-career-match-id="${escapeHtml(cv.id)}">Match với Job</button></td></tr>`;
    };

    const hasCVs = ordered.length > 0;
    careerEmptyState.hidden = hasCVs;
    careerVersionsSection.hidden = !hasCVs;
    careerBuddyInsight.hidden = !hasCVs;
    careerSnapshot.hidden = !hasCVs;
    if (!hasCVs) return;

    careerSnapshot.innerHTML = `<span class="career-snapshot-item"><strong>${ordered.length}</strong> CV đã lưu</span>`;
    careerCVTableBody.innerHTML = matching.length ? matching.map(cv => rowMarkup(cv, ordered.indexOf(cv))).join('') : '<tr><td colspan="5" class="career-table-empty">Không tìm thấy CV phù hợp.</td></tr>';
  }

  function renderTargetJobDiscovery() {
    const grid = document.getElementById('p1-job-grid');
    const empty = document.getElementById('p1-job-empty');
    const count = document.getElementById('p1-job-count');
    const pagination = document.getElementById('p1-job-pagination');
    const query = document.getElementById('p1-job-search')?.value.trim().toLocaleLowerCase('vi') || '';
    const locationFilter = document.getElementById('p1-job-location-filter')?.value || '';
    const jobsPerPage = getMatchJobsPerPage();
    if (!grid) return;
    populateMatchLocationFilter();
    const jobs = targetJobCatalog.filter(job => {
      const haystack = [job.title, job.company, job.domain, job.location, ...(job.skills || [])].join(' ').toLocaleLowerCase('vi');
      const matchesQuery = !query || haystack.includes(query);
      const matchesFilter = !activeTargetJobFilter || haystack.includes(activeTargetJobFilter.toLocaleLowerCase('vi'));
      const matchesLocation = !locationFilter || String(job.location || '').includes(locationFilter);
      return matchesQuery && matchesFilter && matchesLocation;
    });
    const totalPages = Math.max(1, Math.ceil(jobs.length / jobsPerPage));
    targetJobPage = Math.min(targetJobPage, totalPages);
    const start = (targetJobPage - 1) * jobsPerPage;
    const pageJobs = jobs.slice(start, start + jobsPerPage);
    if (count) {
      count.textContent = jobs.length
        ? `Hiển thị ${start + 1} - ${Math.min(start + jobsPerPage, jobs.length)} trong ${jobs.length} công việc`
        : '';
    }
    if (empty) empty.hidden = jobs.length > 0;
    if (pagination) {
      pagination.hidden = jobs.length === 0;
      const visiblePages = [...new Set([
        1,
        totalPages,
        targetJobPage - 1,
        targetJobPage,
        targetJobPage + 1,
      ].filter(page => page >= 1 && page <= totalPages))].sort((a, b) => a - b);
      const pageButtons = visiblePages.map((page, index) => {
        const previous = visiblePages[index - 1];
        const gap = previous && page - previous > 1 ? '<span class="p1-pagination-ellipsis" aria-hidden="true">…</span>' : '';
        return `${gap}<button type="button" data-p1-job-page="${page}" class="${page === targetJobPage ? 'is-current' : ''}" aria-current="${page === targetJobPage ? 'page' : 'false'}">${page}</button>`;
      }).join('');
      pagination.innerHTML = jobs.length === 0 ? '' : `<button type="button" data-p1-job-page="prev" ${targetJobPage === 1 ? 'disabled' : ''} aria-label="Trang trước">‹</button>${pageButtons}<button type="button" data-p1-job-page="next" ${targetJobPage === totalPages ? 'disabled' : ''} aria-label="Trang sau">›</button>`;
    }
    grid.innerHTML = pageJobs.map(job => {
      const allSkills = job.skills || [];
      const skills = allSkills.slice(0, 4);
      const remainingSkills = Math.max(0, allSkills.length - skills.length);
      const meta = [job.location, job.remote_type, job.job_level].filter(Boolean);
      const salary = formatJobSalary(job.salary_range);
      const description = String(job.description || '').replace(/\s+/g, ' ').trim();
      return `<article class="p1-job-card" data-target-job="${escapeHtml(String(job.source_id))}" tabindex="0" role="button" aria-label="Chọn công việc ${escapeHtml(job.title || '')}">
        <span class="p1-job-card-radio" aria-hidden="true"></span>
        <div class="p1-job-card-head"><h4>${escapeHtml(job.title || 'Vị trí chưa đặt tên')}</h4>${job.company ? `<p>${escapeHtml(job.company)}</p>` : ''}</div>
        ${meta.length ? `<div class="p1-job-meta">${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}
        ${salary ? `<div class="p1-job-salary">${escapeHtml(salary)}</div>` : ''}
        ${description ? `<p class="p1-job-description">${escapeHtml(description.slice(0, 180))}${description.length > 180 ? '…' : ''}</p>` : ''}
        ${skills.length ? `<div class="p1-job-skills">${skills.map(skill => `<span>${escapeHtml(skill)}</span>`).join('')}${remainingSkills ? `<span>+${remainingSkills}</span>` : ''}</div>` : ''}
      </article>`;
    }).join('');
  }

  async function chooseTargetCatalogJob(sourceId) {
    if (!sourceId || !cvAnalysisJdSelect) return;
    const selected = targetJobCatalog.find(job => String(job.source_id) === String(sourceId));
    try {
      cvAnalysisJdSelect.disabled = true;
      const selectedJD = await ApiClient.selectCatalogJD(sourceId);
      await loadCVJDOptions(selectedJD.id);
      document.querySelectorAll('[data-target-job]').forEach(card => card.classList.toggle('is-selected', card.dataset.targetJob === String(sourceId)));
      showToast(`Đã chọn ${selected?.title || 'công việc mục tiêu'}.`, 'success');
    } catch (err) {
      showToast(`Không thể chọn công việc: ${err.message}`, 'error');
    } finally {
      cvAnalysisJdSelect.disabled = false;
    }
  }

  async function handleCVJDSelectionChange() {
    if (!cvAnalysisJdSelect) return;
    const value = cvAnalysisJdSelect.value;
    if (!value.startsWith('catalog:')) {
      updateCVJDSelectionHint();
      return;
    }

    const sourceId = value.slice('catalog:'.length);
    cvAnalysisJdSelect.disabled = true;
    if (cvSelectedJdHint) {
      cvSelectedJdHint.textContent = 'Đang nạp JD doanh nghiệp từ data/jds...';
      cvSelectedJdHint?.classList.add('is-selected');
    }
    try {
      const selectedJD = await ApiClient.selectCatalogJD(sourceId);
      await loadCVJDOptions(selectedJD.id);
      showToast('✅ Đã chọn JD doanh nghiệp từ data/jds.', 'success');
    } catch (err) {
      cvAnalysisJdSelect.value = '';
      updateCVJDSelectionHint();
      showToast(`❌ Không thể chọn JD trong data: ${err.message}`, 'error');
    } finally {
      cvAnalysisJdSelect.disabled = false;
    }
  }

  document.getElementById('p1-job-search')?.addEventListener('input', () => {
    targetJobPage = 1;
    renderTargetJobDiscovery();
  });
  document.getElementById('p1-job-filters')?.addEventListener('click', event => {
    const filterButton = event.target.closest('[data-job-filter]');
    if (!filterButton) return;
    activeTargetJobFilter = filterButton.dataset.jobFilter || '';
    targetJobPage = 1;
    document.querySelectorAll('[data-job-filter]').forEach(button => button.classList.toggle('is-selected', (button.dataset.jobFilter || '') === activeTargetJobFilter));
    renderTargetJobDiscovery();
  });
  document.getElementById('p1-job-location-filter')?.addEventListener('change', () => {
    targetJobPage = 1;
    renderTargetJobDiscovery();
  });
  document.getElementById('p1-job-per-page')?.addEventListener('change', () => {
    targetJobPage = 1;
    renderTargetJobDiscovery();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('#p1-job-pagination [data-p1-job-page]');
    if (!button || button.disabled) return;
    const value = button.dataset.p1JobPage;
    const nextPage = value === 'prev' ? targetJobPage - 1 : value === 'next' ? targetJobPage + 1 : Number(value);
    if (!Number.isInteger(nextPage) || nextPage < 1) return;
    targetJobPage = nextPage;
    renderTargetJobDiscovery();
    document.getElementById('p1-job-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('nav-match')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('match');
  });
  // --- Job Preview Modal Logic ---
  let currentPreviewJobId = null;
  const jobPreviewModal = document.getElementById('job-preview-modal');

  function closeJobPreviewModal() {
    if (!jobPreviewModal) return;
    jobPreviewModal.style.display = 'none';
    document.body.classList.remove('job-preview-modal-open');
  }

  function buildJobPreviewSections(job) {
    const rawDescription = String(job.description || '').replace(/\u00a0/g, ' ').trim();
    if (!rawDescription) return '<p class="job-preview-empty">JD chưa có mô tả chi tiết.</p>';

    let lines = rawDescription.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length === 1) {
      lines = rawDescription.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ỹ])/u).map(line => line.trim()).filter(Boolean);
    }

    const normalizedTitle = String(job.title || '').trim().toLocaleLowerCase('vi');
    const normalizedCompany = String(job.company || '').trim().toLocaleLowerCase('vi');
    const skillSet = new Set((job.skills || []).map(skill => String(skill).trim().toLocaleLowerCase('vi')));
    const metadataLabel = /^(thu nhập|mức lương|salary|loại hình|employment type|chức vụ|cấp bậc|kinh nghiệm|experience)\s*:?$/i;
    const headings = [
      [/^(giới thiệu công ty|company introduction|about (the )?company)\s*:?$/i, 'Giới thiệu công ty'],
      [/^(mô tả công việc|job description|tổng quan công việc|role overview)\s*:?$/i, 'Mô tả công việc'],
      [/^(trách nhiệm|nhiệm vụ|responsibilities|what you('ll| will) do)\s*:?$/i, 'Trách nhiệm chính'],
      [/^(yêu cầu|yêu cầu công việc|requirements|qualifications|what we('re| are) looking for)\s*:?$/i, 'Yêu cầu ứng viên'],
      [/^(quyền lợi|phúc lợi|benefits|what we offer)\s*:?$/i, 'Quyền lợi'],
    ];
    const sections = [];
    let current = { title: 'Mô tả công việc', items: [] };
    let skipMetadataValue = false;

    const flush = () => {
      if (!current.items.length) return;
      const existing = sections.find(section => section.title === current.title);
      if (existing) {
        const knownItems = new Set(existing.items.map(item => item.toLocaleLowerCase('vi')));
        current.items.forEach(item => {
          const normalized = item.toLocaleLowerCase('vi');
          if (!knownItems.has(normalized)) {
            existing.items.push(item);
            knownItems.add(normalized);
          }
        });
        return;
      }
      sections.push({ title: current.title, items: [...current.items] });
    };

    lines.forEach(rawLine => {
      const line = rawLine.replace(/^[•●▪◦*\-–—]+\s*/, '').trim();
      if (!line || line === '-') return;
      const normalized = line.toLocaleLowerCase('vi');
      if (normalized === normalizedTitle || normalized === normalizedCompany || skillSet.has(normalized)) return;
      if (skipMetadataValue) {
        skipMetadataValue = false;
        return;
      }
      if (metadataLabel.test(line)) {
        skipMetadataValue = true;
        return;
      }
      const heading = headings.find(([pattern]) => pattern.test(line));
      if (heading) {
        if (current.title === heading[1]) return;
        flush();
        current = { title: heading[1], items: [] };
        return;
      }
      const looksLikeLooseKeyword = line.split(/\s+/).length <= 3 && !/[.!,:;]/.test(line);
      if (current.title === 'Giới thiệu công ty' && looksLikeLooseKeyword) return;
      current.items.push(line);
    });
    flush();

    return sections.length
      ? sections.map(section => `
        <section class="job-preview-section">
          <h5>${escapeHtml(section.title)}</h5>
          <ul>${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </section>
      `).join('')
      : '<p class="job-preview-empty">JD chưa có nội dung hữu ích để hiển thị.</p>';
  }

  function openJobPreviewModal(sourceId) {
    if (!sourceId) return;
    const job = targetJobCatalog.find(j => String(j.source_id) === String(sourceId));
    if (!job) return;
    
    currentPreviewJobId = sourceId;
    const modal = document.getElementById('job-preview-modal');
    const content = document.getElementById('job-modal-content');
    if (modal && content) {
      const meta = [
        job.location && { label: 'Địa điểm', value: job.location },
        job.remote_type && { label: 'Hình thức', value: job.remote_type },
        job.job_level && { label: 'Cấp bậc', value: job.job_level },
        job.employment_type && { label: 'Loại hình', value: job.employment_type },
      ].filter(Boolean).filter(item => item.value !== 'Chưa xác định');
      const skills = Array.isArray(job.skills) ? job.skills.filter(Boolean) : [];
      content.innerHTML = `
        <article class="job-preview-detail">
          <header class="job-preview-hero">
            <span class="job-preview-kicker">Vị trí ứng tuyển</span>
            <h4>${escapeHtml(job.title || 'Vị trí chưa đặt tên')}</h4>
            <p>${escapeHtml(job.company || 'Doanh nghiệp chưa xác định')}</p>
            ${meta.length ? `<div class="job-preview-meta">${meta.map(item => `<span><small>${escapeHtml(item.label)}</small>${escapeHtml(item.value)}</span>`).join('')}</div>` : ''}
          </header>
          ${skills.length ? `<section class="job-preview-skills"><h5>Kỹ năng chính</h5><div>${skills.slice(0, 10).map(skill => `<span>${escapeHtml(skill)}</span>`).join('')}</div></section>` : ''}
          <div class="job-preview-description">${buildJobPreviewSections(job)}</div>
        </article>
      `;
      modal.style.display = 'flex';
      document.body.classList.add('job-preview-modal-open');
      window.requestAnimationFrame(() => document.getElementById('job-modal-close-btn')?.focus());
    }
  }

  document.getElementById('job-modal-close-btn')?.addEventListener('click', closeJobPreviewModal);
  document.getElementById('job-modal-cancel-btn')?.addEventListener('click', closeJobPreviewModal);
  document.getElementById('job-modal-select-btn')?.addEventListener('click', () => {
    if (currentPreviewJobId) {
      chooseTargetCatalogJob(currentPreviewJobId);
      closeJobPreviewModal();
    }
  });
  jobPreviewModal?.addEventListener('click', event => {
    if (event.target === jobPreviewModal) closeJobPreviewModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && jobPreviewModal?.style.display === 'flex') closeJobPreviewModal();
  });

  document.getElementById('p1-job-grid')?.addEventListener('click', event => {
    const sourceId = event.target.closest('[data-target-job]')?.dataset.targetJob;
    if (sourceId) {
      // If clicking the job card, show the modal instead of selecting immediately
      openJobPreviewModal(sourceId);
    }
  });
  document.getElementById('p1-job-grid')?.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    const sourceId = event.target.closest('[data-target-job]')?.dataset.targetJob;
    if (sourceId) { 
      event.preventDefault(); 
      openJobPreviewModal(sourceId);
    }
  });

  function setTargetJobMode(mode) {
    const explore = mode === 'explore';
    document.getElementById('p1-job-explore-tab')?.classList.toggle('is-selected', explore);
    document.getElementById('p1-job-explore-tab')?.setAttribute('aria-selected', String(explore));
    document.getElementById('p1-job-upload-tab')?.classList.toggle('is-selected', !explore);
    document.getElementById('p1-job-upload-tab')?.setAttribute('aria-selected', String(!explore));
    const discoveryPanel = document.getElementById('p1-job-explore-panel');
    const uploadPanel = document.getElementById('p1-job-upload-panel');
    const uploadForm = document.getElementById('cv-jd-upload-form');
    const divider = document.querySelector('.p1-jd-upload-divider');
    if (discoveryPanel) discoveryPanel.hidden = !explore;
    if (uploadPanel) uploadPanel.hidden = explore;
    if (uploadForm) uploadForm.hidden = explore;
    if (divider) divider.hidden = explore;
  }
  document.getElementById('p1-job-explore-tab')?.addEventListener('click', () => setTargetJobMode('explore'));
  document.getElementById('p1-job-upload-tab')?.addEventListener('click', () => setTargetJobMode('upload'));
  document.getElementById('p1-job-escape')?.addEventListener('click', () => setTargetJobMode('upload'));
  document.getElementById('p1-job-empty-upload')?.addEventListener('click', () => setTargetJobMode('upload'));

  function getJDRelevantOptimizationSuggestions(analysis) {
    const matchedSkills = Array.isArray(analysis?.hard_skills_matching) ? analysis.hard_skills_matching : [];
    const suggestions = Array.isArray(analysis?.suggestions) ? analysis.suggestions : [];
    const sensitivePattern = /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:facebook|linkedin|instagram)\.com\/|(?:^|\s)(?:địa chỉ|address)\s*[:：]|\b(?:xã|phường|quận|huyện|tỉnh|tp\.?|thành phố)\b/i;
    const standaloneContactPattern = /^(?:(?:https?:\/\/|www\.)\S+|\+?\d[\d\s().-]{7,}\d)$/i;
    return suggestions.map((item, sourceIndex) => ({ ...item, sourceIndex })).filter(item => {
      const original = String(item?.original_text || '').trim();
      const improved = String(item?.suggested_improvement || '').trim();
      const combined = `${original} ${improved}`.toLocaleLowerCase('vi');
      if (!original || !improved || sensitivePattern.test(combined) || standaloneContactPattern.test(original)) return false;
      return matchedSkills.some(skill => combined.includes(String(skill).toLocaleLowerCase('vi')));
    });
  }

  function renderInlineCVAnalysis(analysis, cvId, jdId) {
    if (!cvAnalysisResultContent || !analysis) return;
    latestCVAnalysisContext = { analysis, cvId, jdId };
    const score = Number(analysis.match_score || 0);
    const matched = Array.isArray(analysis.hard_skills_matching) ? analysis.hard_skills_matching : [];
    const partial = Array.isArray(analysis.hard_skills_partial) ? analysis.hard_skills_partial : [];
    const missingRaw = Array.isArray(analysis.hard_skills_missing) ? analysis.hard_skills_missing : [];
    const missing = missingRaw.filter(skill => !partial.includes(skill));
    const priorityActions = Array.isArray(analysis.priority_actions) ? analysis.priority_actions : [];
    const suggestions = getJDRelevantOptimizationSuggestions(analysis);
    const cvLabel = [...(cvAnalysisCvSelect?.options || [])].find(option => option.value === String(cvId))?.textContent || 'CV đã chọn';
    const jdLabel = [...(cvAnalysisJdSelect?.options || [])].find(option => option.value === String(jdId))?.textContent || 'JD đã chọn';
    const scoreEl = document.getElementById('cv-result-match-score');
    const scoreRing = scoreEl?.closest('.cv-result-score-ring');

    const setHTML = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    const compactText = (value, maxLength = 180) => {
      const text = String(value || '').trim();
      return text.length > maxLength ? `${text.slice(0, maxLength).trim()}…` : text;
    };

    if (scoreEl) scoreEl.textContent = `${score.toFixed(1)}%`;
    scoreRing?.style.setProperty('--match-score', `${Math.max(0, Math.min(100, score)) * 3.6}deg`);
    const missingIds = [];
    applyDomField('cv-result-context', 'textContent', `${cvLabel}  ↔  ${jdLabel}`, missingIds);
    applyDomField('cv-result-summary', 'textContent', compactText(analysis.executive_summary, 240)
      || `CV khớp ${matched.length} kỹ năng và cần bổ sung ${missing.length} kỹ năng theo JD.`, missingIds);

    const confidenceSummary = document.getElementById('cv-result-confidence-summary');
    if (confidenceSummary) {
      const matchLabels = {
        high_match: 'Match cao',
        application_ready: 'Có thể ứng tuyển',
        partial_match: 'Match một phần',
        low_match: 'Match thấp',
        insufficient_data: 'Chưa đủ dữ liệu',
      };
      setHTML('cv-result-confidence-summary', `
        <span>${escapeHtml(matchLabels[analysis.match_level] || analysis.match_level || 'Đang đánh giá')}</span>
        <span>Đáp ứng yêu cầu chính ${Math.round(Number(analysis.must_have_coverage || 0) * 100)}%</span>
        ${analysis.mandatory_requirement_failed ? '<span>⚠ Thiếu yêu cầu bắt buộc</span>' : ''}
      `);
    }

    const renderSkills = (items, variant) => items.length
      ? items.slice(0, 6).map(item => `<span class="cv-result-tag ${variant}">${escapeHtml(item)}</span>`).join('')
      : '<span class="cv-result-empty">Không có dữ liệu.</span>';
    applyDomField('cv-result-matching-skills', 'innerHTML', renderSkills(matched, 'matched'), missingIds);
    applyDomField('cv-result-missing-skills', 'innerHTML', renderSkills(missing, 'missing'), missingIds);
    applyDomField('cv-result-partial-skills', 'innerHTML', renderSkills(partial, 'partial'), missingIds);

    applyDomField('cv-result-priority-actions', 'innerHTML', priorityActions.length
      ? priorityActions.slice(0, 3).map((item, index) => {
        const title = typeof item === 'string' ? item : (item.gap || item.action || `Ưu tiên ${index + 1}`);
        const detail = typeof item === 'string' ? '' : (item.action || item.why_it_matters || '');
        const priority = typeof item === 'string' ? index + 1 : (item.priority || index + 1);
        return `<article class="cv-result-action"><span>${escapeHtml(priority)}</span><div><strong>${escapeHtml(compactText(title, 110))}</strong>${detail && detail !== title ? `<p>${escapeHtml(compactText(detail, 150))}</p>` : ''}</div></article>`;
      }).join('')
      : '<p class="cv-result-empty">Chưa phát hiện khoảng trống ưu tiên.</p>', missingIds);

    setHTML('cv-result-suggestions-preview', suggestions.length
      ? suggestions.slice(0, 3).map((item, index) => `
        <article class="cv-result-rewrite"><span>${index + 1}</span><div><strong>${escapeHtml(compactText(item.suggested_improvement, 180))}</strong><p>${escapeHtml(compactText(item.reason, 120))}</p></div></article>
      `).join('')
      : '<p class="cv-result-empty">Không có câu viết lại đủ bằng chứng.</p>');
    if (btnOptimizeCvAI) {
      btnOptimizeCvAI.disabled = !analysis.id || (analysis.integrity_guardrail || 'passed') !== 'passed';
      btnOptimizeCvAI.innerHTML = '<span aria-hidden="true">✦</span> Tối ưu & tải CV';
    }
    if (cvAiOptimizationStatus) {
      cvAiOptimizationStatus.hidden = true;
      cvAiOptimizationStatus.textContent = '';
    }

    if (missingIds.length) {
      console.error(`[renderInlineCVAnalysis] Không tìm thấy ${missingIds.length} phần tử DOM để hiển thị kết quả CV Analysis: ${missingIds.join(', ')}`);
      showToast(`⚠️ Kết quả đã tính nhưng giao diện thiếu vùng hiển thị (${missingIds.join(', ')}). Vui lòng tải lại trang.`, 'error');
    }

    if (cvAnalysisEmptyState) cvAnalysisEmptyState.hidden = true;
    if (cvAnalysisResultsCard) cvAnalysisResultsCard.hidden = false;
    cvAnalysisResultContent.hidden = false;
    openGapResultModal();
  }

  cvAnalysisCvSelect?.addEventListener('change', updateCVSelectionHint);
  cvAnalysisJdSelect?.addEventListener('change', handleCVJDSelectionChange);
  // Handle JD File Selection Name Bind dynamically
  document.addEventListener('change', event => {
    const input = event.target.closest('#cv-jd-file-input');
    if (!input) return;
    const label = document.getElementById('cv-jd-file-name');
    if (label) {
      label.textContent = input.files?.[0]?.name || 'PDF, DOCX, TXT hoặc ảnh';
    }
  });

  // Handle JD Upload Form Submit dynamically
  document.addEventListener('submit', async event => {
    const form = event.target.closest('#cv-jd-upload-form');
    if (!form) return;

    event.preventDefault();
    if (!ApiClient.isAuthenticated()) {
      showToast('Vui lòng đăng nhập để tải JD.', 'warning');
      openAuthModal();
      return;
    }
    const fileInput = document.getElementById('cv-jd-file-input');
    const file = fileInput?.files?.[0];
    if (!file) {
      showToast('Vui lòng chọn file JD dạng PDF, DOCX, TXT hoặc ảnh.', 'warning');
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    try {
      if (button) {
        button.disabled = true;
        button.textContent = 'Đang tải và trích xuất JD...';
      }
      const jd = await ApiClient.uploadJD(file, document.getElementById('cv-jd-title-input')?.value.trim() || '');
      form.reset();
      const fileNameLabel = document.getElementById('cv-jd-file-name');
      if (fileNameLabel) fileNameLabel.textContent = 'PDF, DOCX, TXT hoặc ảnh · tối đa 20 MB';
      await loadCVJDOptions(jd.id);
      showToast('✅ JD đã được tải lên và chọn làm mục tiêu.', 'success');
      if (typeof window.updateP1UI === 'function') {
        setTimeout(window.updateP1UI, 500);
        setTimeout(window.updateP1UI, 2000);
      }
    } catch (err) {
      showToast(`❌ Lỗi tải JD: ${err.message}`, 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Tải lên & chọn JD này';
      }
    }
  });

  // Handle Spaceship CV Upload Form Submit
  if (cvPageForm) {
    cvPageForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!ApiClient.isAuthenticated()) {
        showToast('⚠️ Vui lòng đăng nhập tài khoản để upload CV', 'warning');
        openAuthModal();
        return;
      }
      const selectedFile = cvPageFileInput?.files?.[0];
      let selectedCvId = cvAnalysisCvSelect?.value;
      if (!selectedFile && !selectedCvId) {
        showToast('⚠️ Vui lòng chọn CV đã lưu hoặc tải file CV mới', 'warning');
        cvAnalysisCvSelect?.focus();
        return;
      }
      const selectedJdId = cvAnalysisJdSelect?.value;
      if (!selectedJdId) {
        showToast('⚠️ Vui lòng chọn hoặc tải JD mục tiêu trước khi phân tích CV', 'warning');
        cvAnalysisJdSelect?.focus();
        return;
      }

      const submitButton = document.getElementById('btn-page-do-upload');
      try {
        if (submitButton) submitButton.disabled = true;
        let uploadedCV = null;
        if (selectedFile) {
          setAgentProgress('upload');
          uploadedCV = await ApiClient.uploadCVForMatch(
            selectedFile,
            cvPageTitleInput?.value.trim() || '',
          );
          selectedCvId = uploadedCV.id;
          await loadSpaceshipCVList(selectedCvId);
        } else {
          setAgentProgress('extract');
        }
        setAgentProgress('guardrail');
        const match = await ApiClient.startMatch(selectedCvId, selectedJdId);
        const analysis = await waitForMatchResult(match.match_id);
        analysis.match_id = analysis.match_id || match.match_id;
        setAgentProgress('match');
        renderInlineCVAnalysis(analysis, selectedCvId, selectedJdId);
        window.latestMatchId = match.match_id;
        localStorage.setItem('latest_match_id', match.match_id);
        refreshDashboardOverview();
        setAgentProgress('save');
        const llmCalled = Boolean(uploadedCV?.parsed_json?.agent_metadata?.llm_called);
        showToast(
          llmCalled ? '✅ Đã phân tích CV–JD với hỗ trợ AI khi cần.' : '✅ Đã phân tích nhanh CV–JD và lưu CV vào Kho CV.',
          'success',
        );
        if (cvPageTitleInput) cvPageTitleInput.value = '';
        if (cvPageFileInput) cvPageFileInput.value = '';
        if (selectedFileNameEl) {
          selectedFileNameEl.textContent = '';
          selectedFileNameEl.style.display = 'none';
        }
      } catch (err) {
        showToast(`❌ Không thể phân tích CV: ${err.message}`, 'error');
      } finally {
        if (submitButton) submitButton.disabled = false;
        window.setTimeout(() => setAgentProgress(''), 800);
      }
    });
  }

  const manualCVForm = document.getElementById('manual-cv-form');
  manualCVForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ApiClient.isAuthenticated()) {
      showToast('Vui lòng đăng nhập để tạo CV.', 'warning'); openAuthModal(); return;
    }
    const lineItems = id => (document.getElementById(id)?.value || '')
      .split('\n').map(value => value.trim()).filter(Boolean).map(description => ({ description }));
    const payload = {
      title: document.getElementById('manual-cv-title').value.trim(),
      template_name: document.getElementById('manual-cv-template').value,
      personal_info: {
        full_name: document.getElementById('manual-cv-name').value.trim(),
        email: document.getElementById('manual-cv-email').value.trim(),
        phone: document.getElementById('manual-cv-phone').value.trim(),
      },
      summary: document.getElementById('manual-cv-summary').value.trim(),
      skills: document.getElementById('manual-cv-skills').value.split(',').map(value => value.trim()).filter(Boolean),
      education: lineItems('manual-cv-education'),
      experience: lineItems('manual-cv-experience'),
      projects: lineItems('manual-cv-projects'),
    };
    try {
      const cv = await ApiClient.createManualCV(payload);
      await loadSpaceshipCVList(cv.id);
      manualCVForm.reset();
      showToast('✅ CV đã được lưu vào Career Workspace.', 'success');
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    }
  });

  // Load saved CVs into the analysis selector.
  // Load saved CVs into the analysis selector.
  async function loadSpaceshipCVList(preferredCvId = '') {
    if (!cvAnalysisCvSelect && !careerCVTableBody) return;
    if (!ApiClient.isAuthenticated()) {
      loadedCVs = [];
      if (cvAnalysisCvSelect) {
        cvAnalysisCvSelect.innerHTML = '<option value="">Vui lòng đăng nhập để chọn CV</option>';
        cvAnalysisCvSelect.disabled = true;
        enhanceGapSelect(cvAnalysisCvSelect);
      }
      
      const cardsGrid = document.getElementById('p1-cv-cards-grid');
      if (cardsGrid) {
        cardsGrid.innerHTML = '<p class="cv-grid-empty">Vui lòng đăng nhập để xem CV đã lưu.</p>';
      }

      renderCareerPortfolioCVs([]);
      updateCVSelectionHint();
      return;
    }

    const previousValue = preferredCvId || cvAnalysisCvSelect.value;
    try {
      loadedCVs = await ApiClient.listCVs();
      if (cvAnalysisCvSelect) {
        cvAnalysisCvSelect.disabled = false;
        cvAnalysisCvSelect.innerHTML = [
          '<option value="">Chọn một CV đã lưu</option>',
          ...(loadedCVs || []).map(cv => `<option value="${escapeHtml(cv.id)}">${escapeHtml(cv.title || cv.file_name || 'CV Hồ sơ')}</option>`),
        ].join('');
        if ([...cvAnalysisCvSelect.options].some(option => option.value === previousValue)) {
          cvAnalysisCvSelect.value = previousValue;
        }
        const preselectedCVId = window.sessionStorage.getItem('career-preselected-cv-id');
        if (preselectedCVId && [...cvAnalysisCvSelect.options].some(option => option.value === preselectedCVId)) {
          cvAnalysisCvSelect.value = preselectedCVId;
          window.sessionStorage.removeItem('career-preselected-cv-id');
        }
        enhanceGapSelect(cvAnalysisCvSelect);

        // Render CV Cards Grid for the Match CV redesigned view
        const cardsGrid = document.getElementById('p1-cv-cards-grid');
        if (cardsGrid) {
          if (loadedCVs && loadedCVs.length > 0) {
            cardsGrid.innerHTML = loadedCVs.map(cv => `
              <div class="cv-card${cv.id === cvAnalysisCvSelect.value ? ' is-selected' : ''}" data-cv-id="${escapeHtml(cv.id)}" role="button" tabindex="0" aria-pressed="${cv.id === cvAnalysisCvSelect.value ? 'true' : 'false'}">
                <div class="cv-card-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </div>
                <div class="cv-card-content">
                  <h4 class="cv-card-title">${escapeHtml(cv.title || cv.file_name || 'CV Hồ sơ')}</h4>
                  <p class="cv-card-meta">Cập nhật: ${cv.updated_at ? new Date(cv.updated_at).toLocaleDateString() : 'Gần đây'}</p>
                </div>
              </div>
            `).join('');

            // A saved-CV card is a selection control for Match CV.
            cardsGrid.querySelectorAll('.cv-card').forEach(card => {
              card.addEventListener('click', () => {
                selectSavedCV(card.getAttribute('data-cv-id'));
              });
              card.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                selectSavedCV(card.getAttribute('data-cv-id'));
              });
            });
          } else {
             cardsGrid.innerHTML = '<p class="cv-grid-empty">Chưa có CV nào được lưu.</p>';
          }
        }
      }
      renderCareerPortfolioCVs(loadedCVs, careerSearchInput?.value || '');
      updateCVSelectionHint();
    } catch (err) {
      if (cvAnalysisCvSelect) {
        cvAnalysisCvSelect.innerHTML = '<option value="">Không thể tải danh sách CV</option>';
        cvAnalysisCvSelect.disabled = true;
        enhanceGapSelect(cvAnalysisCvSelect);
      }
      const cardsGrid = document.getElementById('p1-cv-cards-grid');
      if (cardsGrid) {
        cardsGrid.innerHTML = '<p class="cv-grid-empty">Không thể tải CV.</p>';
      }
      updateCVSelectionHint();
      showToast(`Không thể tải CV: ${err.message}`, 'error');
    }
  }

  // --- CV Preview Modal Logic ---
  let currentPreviewCvId = null;
  function selectSavedCV(cvId) {
    if (!cvId || !cvAnalysisCvSelect) return false;
    const optionExists = [...cvAnalysisCvSelect.options].some(option => option.value === String(cvId));
    if (!optionExists) return false;

    cvAnalysisCvSelect.value = String(cvId);
    if (cvPageFileInput) cvPageFileInput.value = '';
    if (selectedFileNameEl) {
      selectedFileNameEl.textContent = '';
      selectedFileNameEl.style.display = 'none';
    }
    document.querySelectorAll('#p1-cv-cards-grid .cv-card').forEach(card => {
      const isSelected = card.getAttribute('data-cv-id') === String(cvId);
      card.classList.toggle('is-selected', isSelected);
      card.setAttribute('aria-pressed', String(isSelected));
    });
    cvAnalysisCvSelect.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function openCvPreviewModal(cv) {
    if (!cv) return;
    currentPreviewCvId = cv.id;
    const modal = document.getElementById('cv-preview-modal');
    const content = document.getElementById('cv-modal-content');
    if (modal && content) {
      content.innerHTML = `
        <div class="cv-preview-detail">
          <h4>${escapeHtml(cv.title || cv.file_name || 'CV Hồ sơ')}</h4>
          <p><strong>Ngày tạo:</strong> ${cv.created_at ? new Date(cv.created_at).toLocaleDateString() : 'Không rõ'}</p>
          <p><strong>Cập nhật:</strong> ${cv.updated_at ? new Date(cv.updated_at).toLocaleDateString() : 'Gần đây'}</p>
        </div>
      `;
      modal.style.display = 'flex';
    }
  }

  document.getElementById('cv-modal-close-btn')?.addEventListener('click', () => {
    const modal = document.getElementById('cv-preview-modal');
    if (modal) modal.style.display = 'none';
  });
  document.getElementById('cv-modal-cancel-btn')?.addEventListener('click', () => {
    const modal = document.getElementById('cv-preview-modal');
    if (modal) modal.style.display = 'none';
  });
  document.getElementById('cv-modal-select-btn')?.addEventListener('click', () => {
    if (selectSavedCV(currentPreviewCvId)) {
       const modal = document.getElementById('cv-preview-modal');
       if (modal) modal.style.display = 'none';
    }
  });

  function renderGapDetailFromCurrentMatch() {
    const result = latestCVAnalysisContext?.analysis;
    const container = document.getElementById('page-gap-results-container');
    const empty = document.getElementById('gap-detail-empty');
    if (!container || !empty) return;
    if (!result) { container.hidden = true; empty.hidden = false; return; }
    empty.hidden = true;
    container.hidden = false;
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value || ''; };
    const tags = values => (values || []).map(value => `<span class="cv-result-tag">${escapeHtml(value)}</span>`).join('') || '<span class="cv-result-empty">Chưa có dữ liệu.</span>';
    setText('page-gap-match-score-badge', `${Number(result.match_score || 0).toFixed(1)}%`);
    setText('page-gap-executive-summary', result.executive_summary || 'Kết quả được tổng hợp từ bằng chứng có trong CV.');
    document.getElementById('page-gap-matching-skills').innerHTML = tags(result.hard_skills_matching);
    document.getElementById('page-gap-partial-skills').innerHTML = tags(result.hard_skills_partial);
    document.getElementById('page-gap-missing-skills').innerHTML = tags(result.hard_skills_missing);
    document.getElementById('page-gap-priority-actions').innerHTML = (result.priority_actions || []).slice(0, 4).map((item, index) => `<p>${index + 1}. ${escapeHtml(typeof item === 'string' ? item : (item.action || item.gap || 'Cần xem xét'))}</p>`).join('') || '<p>Chưa có ưu tiên cụ thể.</p>';
    document.getElementById('page-gap-suggestions-list').innerHTML = (result.suggestions || []).slice(0, 3).map(item => `<p>${escapeHtml(item.suggested_improvement || item)}</p>`).join('') || '<p>Chưa có gợi ý diễn đạt đủ bằng chứng.</p>';
  }

  function renderResumeOptimizationReview(result, analysis) {
    const changes = Array.isArray(result?.changes) ? result.changes : [];
    const preview = document.getElementById('cv-result-suggestions-preview');
    const detailSummary = document.getElementById('cv-optimization-detail-summary');
    if (!preview) return;

    const sectionLabels = {
      summary: 'Tóm tắt nghề nghiệp',
      skills: 'Kỹ năng',
      experience: 'Kinh nghiệm',
      projects: 'Dự án',
      education: 'Học vấn',
      certifications: 'Chứng chỉ',
    };
    const plan = result?.optimization_plan && typeof result.optimization_plan === 'object'
      ? result.optimization_plan
      : {};
    const planItems = Object.entries(plan).flatMap(([section, items]) => (
      (Array.isArray(items) ? items : []).map(item => ({ section, text: item }))
    ));
    const missingRecommendations = Array.isArray(result?.missing_skills_recommendations)
      ? result.missing_skills_recommendations
      : [];
    const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
    const removedClaims = Array.isArray(result?.fact_check?.removed_claims)
      ? result.fact_check.removed_claims
      : [];
    const factClaims = Array.isArray(result?.fact_check?.claims) ? result.fact_check.claims : [];

    if (detailSummary) {
      detailSummary.hidden = false;
      detailSummary.innerHTML = `
        <div class="cv-optimization-report-head">
          <div>
            <span>BÁO CÁO CẢI THIỆN CV</span>
            <h5>CV cần cải thiện những gì?</h5>
            <p>AI chỉ áp dụng các thay đổi có thể đối chiếu với nội dung CV gốc.</p>
          </div>
          <div class="cv-optimization-report-stats">
            <strong>${changes.length}</strong><span>thay đổi hợp lệ</span>
            <strong>${removedClaims.length}</strong><span>claim đã loại</span>
          </div>
        </div>
        <div class="cv-optimization-report-grid">
          <section>
            <h6>Kế hoạch cải thiện theo từng phần</h6>
            ${planItems.length ? `<ul>${planItems.map(item => `
              <li><strong>${escapeHtml(sectionLabels[item.section] || item.section)}:</strong> ${escapeHtml(item.text)}</li>
            `).join('')}</ul>` : '<p>Không có đề xuất cấu trúc bổ sung.</p>'}
          </section>
          <section>
            <h6>Kỹ năng JD còn thiếu</h6>
            ${missingRecommendations.length ? missingRecommendations.map(item => `
              <article class="cv-missing-skill-detail">
                <strong>${escapeHtml(item.skill)}</strong>
                <p>${escapeHtml(item.reason)}</p>
                <small>Hành động đề xuất: ${escapeHtml(item.recommended_action)}</small>
              </article>
            `).join('') : '<p>Không phát hiện kỹ năng bắt buộc nào cần bổ sung.</p>'}
          </section>
        </div>
        <div class="cv-fact-check-detail">
          <strong>✓ Fact-check:</strong> ${factClaims.length} nội dung đã được kiểm chứng bằng CV gốc.
          ${removedClaims.length ? ` Đã loại ${removedClaims.length} nội dung không đủ bằng chứng.` : ' Không phát hiện claim bịa đặt.'}
        </div>
        ${removedClaims.length ? `<details class="cv-optimization-warnings"><summary>Vì sao các nội dung không được áp dụng? (${removedClaims.length})</summary><ul>${removedClaims.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></details>` : ''}
        ${warnings.length ? `<details class="cv-optimization-warnings"><summary>Cảnh báo và giới hạn (${warnings.length})</summary><ul>${warnings.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></details>` : ''}
      `;
    }

    preview.innerHTML = changes.length ? changes.map((item, index) => `
      <article class="cv-result-rewrite cv-optimization-review" data-index="${index}">
        <span>${index + 1}</span>
        <div>
          <div class="cv-optimization-change-head">
            <strong>${escapeHtml(sectionLabels[item.section] || item.section || 'Nội dung CV')}</strong>
            <span>Đã qua fact-check</span>
          </div>
          <div class="cv-before-after-grid">
            <section>
              <b>TRƯỚC — Nội dung CV gốc</b>
              <p>${escapeHtml(item.original)}</p>
            </section>
            <section>
              <label for="cv-optimized-text-${index}">SAU — Nội dung được tối ưu</label>
              <textarea id="cv-optimized-text-${index}" class="cv-optimized-text">${escapeHtml(item.optimized)}</textarea>
            </section>
          </div>
          <div class="cv-optimization-reason"><strong>Vì sao cần sửa?</strong><p>${escapeHtml(item.reason)}</p></div>
          <div class="cv-optimization-evidence"><strong>Bằng chứng trong CV:</strong> ${escapeHtml((item.evidence || []).join(' · '))}</div>
          <div class="cv-optimization-alignment-title">Liên quan trực tiếp tới yêu cầu JD:</div>
          <div class="cv-optimization-alignment">${(item.jd_alignment || []).map(skill => `<span>${escapeHtml(skill)}</span>`).join('')}</div>
        </div>
      </article>
    `).join('') : '<p class="cv-result-empty">Không có câu nào vượt qua kiểm tra bằng chứng để viết lại.</p>';

    window.requestAnimationFrame(() => detailSummary?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  function downloadOptimizedCVBlob(blob, cvLabel = 'CV') {
    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error('File CV tối ưu trả về không hợp lệ.');
    }
    const safeLabel = String(cvLabel || 'CV')
      .replace(/\.[^.]+$/, '')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .trim() || 'CV';
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeLabel}-toi-uu.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  btnOptimizeCvAI?.addEventListener('click', async () => {
    const analysis = latestCVAnalysisContext?.analysis;
    if (!analysis?.id) {
      showToast('Không tìm thấy mã kết quả phân tích để tạo bản tối ưu.', 'error');
      return;
    }
    if ((analysis.integrity_guardrail || 'passed') !== 'passed') {
      showToast('Kết quả chưa vượt qua kiểm tra bằng chứng nên AI chưa thể tự áp dụng.', 'warning');
      return;
    }

    btnOptimizeCvAI.disabled = true;
    btnOptimizeCvAI.innerHTML = '<span aria-hidden="true">✦</span> AI đang tối ưu & tạo PDF...';
    if (cvAiOptimizationStatus) {
      cvAiOptimizationStatus.hidden = false;
      cvAiOptimizationStatus.textContent = 'AI đang tạo đề xuất, lập evidence map và kiểm tra từng claim...';
    }
    try {
      const result = await ApiClient.optimizeResume(analysis.id, cvOptimizationMode?.value || 'balanced', 'vi');
      const changes = Array.isArray(result.changes) ? result.changes : [];
      analysis.suggestions = (result.changes || []).map(item => ({
        original_text: item.original,
        suggested_improvement: item.optimized,
        reason: item.reason,
        jd_alignment: item.jd_alignment,
        evidence: item.evidence,
      }));
      renderResumeOptimizationReview(result, analysis);
      if (!changes.length) {
        const removedCount = Array.isArray(result.fact_check?.removed_claims) ? result.fact_check.removed_claims.length : 0;
        btnOptimizeCvAI.disabled = false;
        btnOptimizeCvAI.innerHTML = '<span aria-hidden="true">↻</span> Thử tối ưu lại';
        if (cvAiOptimizationStatus) {
          cvAiOptimizationStatus.textContent = `AI đã kiểm tra nhưng chưa có thay đổi nào đủ bằng chứng để áp dụng${removedCount ? `; ${removedCount} nội dung không an toàn đã bị loại` : ''}. CV gốc được giữ nguyên.`;
        }
        showToast('Không có thay đổi đủ bằng chứng; xem báo cáo chi tiết bên trên.', 'warning');
        return;
      }
      if (cvAiOptimizationStatus) {
        cvAiOptimizationStatus.textContent = `Đang áp dụng ${changes.length} thay đổi đã qua fact-check vào bản sao CV...`;
      }
      await Promise.all(changes.map((item, index) => (
        ApiClient.decideSuggestion(analysis.id, index, true, item.optimized)
      )));

      if (cvAiOptimizationStatus) {
        cvAiOptimizationStatus.textContent = 'Đang dựng và tải xuống bản PDF đã tối ưu...';
      }
      const cvId = latestCVAnalysisContext?.cvId;
      if (!cvId) throw new Error('Không tìm thấy CV gốc để xuất bản tối ưu.');
      const blob = await ApiClient.downloadCV(cvId, analysis.id);
      const cvLabel = [...(cvAnalysisCvSelect?.options || [])]
        .find(option => option.value === String(cvId))?.textContent || 'CV';
      downloadOptimizedCVBlob(blob, cvLabel);

      const changeCount = changes.length;
      const removedCount = Array.isArray(result.fact_check?.removed_claims) ? result.fact_check.removed_claims.length : 0;
      analysis.optimizationApplied = true;
      btnOptimizeCvAI.disabled = false;
      btnOptimizeCvAI.innerHTML = '<span aria-hidden="true">↻</span> Tối ưu & tải lại';
      if (cvAiOptimizationStatus) {
        cvAiOptimizationStatus.textContent = `Đã áp dụng ${changeCount} thay đổi có bằng chứng${removedCount ? ` và loại ${removedCount} claim không hợp lệ` : ''}; bản CV tối ưu đã được tải xuống. CV gốc vẫn được giữ nguyên.`;
      }
      showToast('Đã tối ưu và tải xuống bản CV mới. CV gốc không bị thay đổi.', 'success');
    } catch (err) {
      btnOptimizeCvAI.disabled = false;
      btnOptimizeCvAI.innerHTML = '<span aria-hidden="true">✦</span> Thử tối ưu & tải lại';
      if (cvAiOptimizationStatus) {
        cvAiOptimizationStatus.textContent = `Chưa thể hoàn tất tối ưu: ${err.message}`;
      }
      showToast(`Không thể hoàn tất tối ưu: ${err.message}`, 'error');
    }
  });
  document.getElementById('gap-start-match')?.addEventListener('click', () => switchView('match'));

  careerSearchInput?.addEventListener('input', () => renderCareerPortfolioCVs(loadedCVs, careerSearchInput.value));

  async function uploadCareerPortfolioCV(file) {
    if (!file) return;
    if (!ApiClient.isAuthenticated()) {
      showToast('Vui lòng đăng nhập để lưu CV của bạn.', 'warning');
      return;
    }
    try {
      showToast('Đang tải CV và trích xuất nội dung...', 'info');
      await ApiClient.uploadCV(file, '', true);
      await loadSpaceshipCVList();
      showToast('CV đã được thêm vào Career Workspace.', 'success');
    } catch (err) {
      showToast(`Không thể tải CV: ${err.message}`, 'error');
    }
  }

  ['portfolio-cv-upload-input', 'portfolio-cv-upload-empty-input'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', event => uploadCareerPortfolioCV(event.target.files?.[0]));
  });

  document.getElementById('career-portfolio-workspace')?.addEventListener('click', event => {
    const matchButton = event.target.closest('[data-career-match-id], [data-career-start-match]');
    if (matchButton) {
      const cvId = matchButton.dataset.careerMatchId || loadedCVs[0]?.id;
      if (cvId) window.sessionStorage.setItem('career-preselected-cv-id', cvId);
      switchView('match');
      return;
    }
    const openButton = event.target.closest('[data-career-open-index], [data-career-cv-index]');
    if (!openButton) return;
    const index = Number(openButton.dataset.careerOpenIndex ?? openButton.dataset.careerCvIndex);
    if (loadedCVs[index]) inspectCVDetail(loadedCVs[index]);
  });

  document.getElementById('btn-compare-multi-position')?.addEventListener('click', async () => {
    if (!latestCVAnalysisContext) return;
    closeGapResultModal();
    switchView('find-jobs');
    activeJobSearchCV = latestCVAnalysisContext.cvId;
    await loadJobSearchCVOptions();
    if (jobSearchCVSelect) jobSearchCVSelect.value = activeJobSearchCV;
    if (jobMatchCVButton) jobMatchCVButton.disabled = false;
    await loadJobSearchResults({ cvId: activeJobSearchCV });
  });

  document.getElementById('btn-start-interview-from-analysis')?.addEventListener('click', async () => {
    if (!latestCVAnalysisContext) return;
    closeGapResultModal();
    switchView('interview');
    await populatePageInterviewOptions();
    if (pageSelectIntCv) pageSelectIntCv.value = latestCVAnalysisContext.cvId;
    if (pageSelectIntJd) pageSelectIntJd.value = latestCVAnalysisContext.jdId;
    enhanceGapSelect(pageSelectIntCv);
    enhanceGapSelect(pageSelectIntJd);
  });

  if (cvPageListContainer) {
    cvPageListContainer?.addEventListener('change', event => {
      const checkbox = event.target.closest('[data-cv-select-id]');
      if (!checkbox) return;
      if (checkbox.checked) selectedCVIds.add(checkbox.dataset.cvSelectId);
      else selectedCVIds.delete(checkbox.dataset.cvSelectId);
      updateCVBulkSelectionUI();
    });

    cvPageListContainer?.addEventListener('click', async event => {
      const inspectButton = event.target.closest('[data-cv-inspect-index]');
      if (inspectButton) {
        const cv = loadedCVs[Number(inspectButton.dataset.cvInspectIndex)];
        if (cv) inspectCVDetail(cv);
        return;
      }

      const deleteButton = event.target.closest('[data-cv-delete-id]');
      if (!deleteButton) return;
      const cv = loadedCVs.find(item => item.id === deleteButton.dataset.cvDeleteId);
      if (!cv) return;

      const confirmed = await showDeleteConfirm({
        title: 'Xác Nhận Xóa CV',
        description: `Bạn có chắc chắn muốn xóa CV <strong style="color:#fff;">"${escapeHtml(cv.title || 'CV Hồ sơ')}"</strong>?`,
        confirmLabel: 'Xóa CV',
        warning: '⚠️ File CV và toàn bộ kết quả phân tích liên quan sẽ bị xóa vĩnh viễn.',
      });
      if (!confirmed) return;

      try {
        deleteButton.disabled = true;
        deleteButton?.classList.add('is-loading');
        await ApiClient.deleteCV(cv.id);
        selectedCVIds.delete(cv.id);
        if (inspectedCV?.id === cv.id) {
          inspectedCV = null;
          if (inspectorDeck) inspectorDeck.style.display = 'none';
        }
        await loadSpaceshipCVList();
        showToast(`🗑️ Đã xóa CV ${cv.title || 'CV Hồ sơ'}`, 'success');
      } catch (err) {
        deleteButton.disabled = false;
        deleteButton?.classList.remove('is-loading');
        showToast(`❌ Không thể xóa CV: ${err.message}`, 'error');
      }
    });
  }

  cvSelectAll?.addEventListener('change', () => {
    selectedCVIds = cvSelectAll.checked ? new Set(loadedCVs.map(cv => cv.id)) : new Set();
    cvPageListContainer?.querySelectorAll('[data-cv-select-id]').forEach(checkbox => {
      checkbox.checked = cvSelectAll.checked;
    });
    updateCVBulkSelectionUI();
  });

  document.getElementById('nav-counselor')?.addEventListener('click', (e) => {
    e.preventDefault(); switchView('counselor');
  });
  document.getElementById('nav-enterprise')?.addEventListener('click', (e) => {
    e.preventDefault(); switchView('enterprise');
  });
  function openRoleMenuSection(viewName, navId, sectionId) {
    switchView(viewName);
    document.querySelectorAll('.role-only-link').forEach(link => link?.classList.remove('active'));
    document.getElementById(navId)?.classList.add('active');
    requestAnimationFrame(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }
  document.getElementById('nav-counselor-reports')?.addEventListener('click', (event) => {
    event.preventDefault();
    openRoleMenuSection('counselor', 'nav-counselor-reports', 'counselor-student-detail');
  });
  document.getElementById('nav-enterprise-applications')?.addEventListener('click', (event) => {
    event.preventDefault();
    openRoleMenuSection('enterprise', 'nav-enterprise-applications', 'enterprise-applications-panel');
  });

  btnDeleteSelectedCVs?.addEventListener('click', async () => {
    const selectedCVs = loadedCVs.filter(cv => selectedCVIds.has(cv.id));
    if (!selectedCVs.length) return;
    const preview = selectedCVs.slice(0, 3).map(cv => escapeHtml(cv.title || 'CV Hồ sơ')).join(', ');
    const remaining = selectedCVs.length > 3 ? ` và ${selectedCVs.length - 3} CV khác` : '';
    const confirmed = await showDeleteConfirm({
      title: `Xác Nhận Xóa ${selectedCVs.length} CV`,
      description: `Bạn đang xóa <strong style="color:#fff;">${selectedCVs.length} CV</strong>: ${preview}${remaining}.`,
      confirmLabel: `Xóa ${selectedCVs.length} CV`,
      warning: '⚠️ File CV và toàn bộ kết quả phân tích liên quan sẽ bị xóa vĩnh viễn.',
    });
    if (!confirmed) return;

    try {
      btnDeleteSelectedCVs.disabled = true;
      btnDeleteSelectedCVs?.classList.add('is-loading');
      const result = await ApiClient.bulkDeleteCVs(selectedCVs.map(cv => cv.id));
      if (inspectedCV && selectedCVIds.has(inspectedCV.id)) {
        inspectedCV = null;
        if (inspectorDeck) inspectorDeck.style.display = 'none';
      }
      selectedCVIds.clear();
      await loadSpaceshipCVList();
      showToast(`🗑️ Đã xóa ${result.deleted_count || selectedCVs.length} CV`, 'success');
    } catch (err) {
      showToast(`❌ Không thể xóa các CV đã chọn: ${err.message}`, 'error');
    } finally {
      btnDeleteSelectedCVs?.classList.remove('is-loading');
      updateCVBulkSelectionUI();
    }
  });

  function inspectCVDetail(cv) {
    if (!inspectorDeck) return;
    inspectedCV = cv;
    inspectorDeck.style.display = 'block';

    document.getElementById('inspector-cv-title').textContent = cv.title || 'CV Hồ sơ';
    document.getElementById('inspector-cv-meta').textContent = `Ngày quét: ${new Date(cv.created_at).toLocaleDateString('vi-VN')} | ID: ${cv.id}`;

    const parsed = cv.parsed_json || {};
    const personal = parsed.personal_info || {};
    const hardSkills = Array.isArray(parsed.hard_skills) ? parsed.hard_skills : (parsed.skills || []);
    const softSkills = Array.isArray(parsed.soft_skills) ? parsed.soft_skills : [];
    const metadata = parsed.agent_metadata || {};
    const atsQuality = parsed.ats_quality || {};
    const guardrail = parsed.guardrail || {};

    document.getElementById('inspector-personal-info').innerHTML = `
      <p style="margin:2px 0;"><strong>Họ tên:</strong> ${escapeHtml(personal.full_name || 'Chưa xác định')}</p>
      <p style="margin:2px 0;"><strong>Email:</strong> ${escapeHtml(personal.email || 'Chưa có')}</p>
      <p style="margin:2px 0;"><strong>Điện thoại:</strong> ${escapeHtml(personal.phone || 'Chưa có')}</p>
      <p style="margin:2px 0;"><strong>Địa điểm:</strong> ${escapeHtml(personal.location || 'Chưa có')}</p>
    `;

    const renderSkills = skills => skills.length
      ? skills.map(skill => `<span class="skill-tag-ship">${escapeHtml(skill)}</span>`).join('')
      : '<span class="inspector-meta">Không tìm thấy kỹ năng có bằng chứng trong CV.</span>';
    document.getElementById('inspector-skills-cloud').innerHTML = renderSkills(hardSkills);
    document.getElementById('inspector-soft-skills-cloud').innerHTML = renderSkills(softSkills);

    document.getElementById('inspector-agent-runtime').textContent = metadata.llm_succeeded
      ? 'LLM đã gọi thành công'
      : metadata.fallback_used ? 'Local fallback' : 'Dữ liệu cũ';
    document.getElementById('inspector-agent-model').textContent = metadata.model || 'Local parser';
    document.getElementById('inspector-ats-score').textContent = Number.isFinite(Number(atsQuality.score))
      ? `${Math.round(Number(atsQuality.score))}/100`
      : 'Chưa chấm';
    document.getElementById('inspector-guardrail').textContent = guardrail.status === 'passed'
      ? `Đạt · loại ${guardrail.rejected_unverified_claims || 0} claim`
      : 'Chưa có';

    document.getElementById('inspector-raw-preview').textContent = parsed.summary || 'CV chưa có phần tóm tắt được kiểm chứng.';

    const recordGroups = [
      ['Học vấn', parsed.education],
      ['Kinh nghiệm', parsed.experience],
      ['Dự án', parsed.projects],
      ['Chứng chỉ', parsed.certifications],
    ];
    document.getElementById('inspector-evidence-records').innerHTML = recordGroups
      .filter(([, records]) => Array.isArray(records) && records.length)
      .map(([label, records]) => `<div class="evidence-group"><h6>${label}</h6>${records.map(record => {
        const description = record.description || record.details || record.title || '';
        const period = record.period ? ` · ${record.period}` : '';
        return `<p><strong>${escapeHtml(record.title || label)}</strong>${escapeHtml(period)}<br>${escapeHtml(description)}</p>`;
      }).join('')}</div>`).join('') || '<div class="inspector-meta">Chưa có bản ghi có bằng chứng.</div>';

    const missing = Array.isArray(parsed.missing_information) ? parsed.missing_information : [];
    document.getElementById('inspector-missing-info').innerHTML = missing.length
      ? missing.map(item => `<span class="missing-chip">${escapeHtml(item)}</span>`).join('')
      : '<span class="missing-clear">Không phát hiện mục bắt buộc bị thiếu</span>';
  }

  if (btnCloseInspector) {
    btnCloseInspector?.addEventListener('click', () => {
      if (inspectorDeck) inspectorDeck.style.display = 'none';
    });
  }

  document.getElementById('btn-inspector-reanalyze')?.addEventListener('click', async () => {
    if (!inspectedCV?.id) return;
    const approved = window.confirm('CV chứa dữ liệu cá nhân và sẽ được gửi tới Google Gemini để phân tích. Bạn có đồng ý cho lần chạy này không?');
    if (!approved) return;
    const button = document.getElementById('btn-inspector-reanalyze');
    try {
      button.disabled = true;
      button.textContent = '⏳ Agent đang phân tích...';
      showToast('🤖 Đang gọi LLM và kiểm chứng từng claim...', 'info');
      const updated = await ApiClient.reanalyzeCV(inspectedCV.id, true);
      inspectCVDetail(updated);
      await loadSpaceshipCVList();
      showToast(metadataMessage(updated), updated?.parsed_json?.agent_metadata?.llm_succeeded ? 'success' : 'warning');
    } catch (err) {
      showToast(`❌ Không thể phân tích lại: ${err.message}`, 'error');
    } finally {
      button.disabled = false;
      button.textContent = '✨ Phân tích lại bằng LLM';
    }
  });

  function metadataMessage(cv) {
    const meta = cv?.parsed_json?.agent_metadata || {};
    return meta.llm_succeeded
      ? `LLM ${meta.model || ''} đã trả kết quả có cấu trúc.`
      : `LLM chưa thành công; agent dùng local fallback. ${meta.llm_error || ''}`;
  }

  document.getElementById('btn-inspector-gap')?.addEventListener('click', () => {
    openGapModal();
  });

  document.getElementById('btn-inspector-interview')?.addEventListener('click', () => {
    switchView('interview');
  });

  /* ============================================================
     💼 JOB DESCRIPTIONS PAGE LOGIC
  ============================================================ */
  const JD_TEMPLATE_CONTENT = `MẪU MÔ TẢ CÔNG VIỆC (JOB DESCRIPTION)

TÊN VỊ TRÍ:
TÊN CÔNG TY:
ĐỊA ĐIỂM / HÌNH THỨC LÀM VIỆC:

1. MÔ TẢ CÔNG VIỆC
- [Mô tả nhiệm vụ]

2. TRÁCH NHIỆM CHÍNH
- [Trách nhiệm chính]

3. YÊU CẦU BẮT BUỘC
- Kỹ năng chuyên môn:
- Số năm kinh nghiệm:
- Ngoại ngữ:

4. KỸ NĂNG ƯU TIÊN
- [Kỹ năng ưu tiên]

5. QUYỀN LỢI / CHẾ ĐỘ
- [Quyền lợi]
`;

  function downloadJDTemplate() {
    const blob = new Blob([JD_TEMPLATE_CONTENT], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'mau-job-description.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast('✅ Đã tải mẫu JD. Hãy điền nội dung rồi tải file lên.', 'success');
  }

  function bindJDFileName(input, label) {
    input?.addEventListener('change', () => {
      label.textContent = input.files?.[0]?.name || 'PDF, DOCX, TXT hoặc ảnh';
    });
  }

  const jobSearchForm = document.getElementById('job-search-form');
  const jobSearchInput = document.getElementById('job-search-input');
  const jobSearchCVSelect = document.getElementById('job-search-cv-select');
  const jobMatchCVButton = document.getElementById('job-match-cv-btn');
  const jobSearchResetButton = document.getElementById('job-search-reset-btn');
  const jobSearchResults = document.getElementById('job-search-results');
  const jobResultsSummary = document.getElementById('job-results-summary');
  const jobResultsMode = document.getElementById('job-results-mode');
  const jobPagination = document.getElementById('job-pagination');
  let activeJobSearchCV = '';
  let jobSearchPage = 1;
  const JOBS_PER_PAGE = 9;
  let visibleJobResults = [];

  function renderJobPagination() {
    if (!jobPagination) return;
    const totalPages = Math.ceil(visibleJobResults.length / JOBS_PER_PAGE);
    if (totalPages <= 1) {
      jobPagination.hidden = true;
      jobPagination.innerHTML = '';
      return;
    }
    const start = (jobSearchPage - 1) * JOBS_PER_PAGE;
    const end = Math.min(start + JOBS_PER_PAGE, visibleJobResults.length);
    const pageButtons = Array.from({ length: totalPages }, (_, index) => {
      const page = index + 1;
      return `<button type="button" class="${page === jobSearchPage ? 'is-current' : ''}" data-job-page="${page}" aria-label="Trang ${page}" aria-current="${page === jobSearchPage ? 'page' : 'false'}">${page}</button>`;
    }).join('');
    jobPagination.hidden = false;
    jobPagination.innerHTML = `<span>${start + 1}–${end} / ${visibleJobResults.length} công việc</span><div><button type="button" data-job-page="prev" ${jobSearchPage === 1 ? 'disabled' : ''}>Trước</button>${pageButtons}<button type="button" data-job-page="next" ${jobSearchPage === totalPages ? 'disabled' : ''}>Sau</button></div>`;
  }

  function renderJobCatalogCard(job) {
    const displayScore = Math.round(Number(job.display_fit_score ?? job.match_score ?? 80));
    const fitLabel = job.fit_label || (displayScore >= 80 ? 'Phù hợp cao' : displayScore >= 50 ? 'Phù hợp trung bình' : 'Ít phù hợp');
    const location = job.location || 'Hồ Chí Minh';
    const workMode = job.work_mode || job.remote_type || 'Hybrid';

    // Strengths
    const strengths = (job.top_strengths && job.top_strengths.length)
      ? job.top_strengths
      : (job.skills || ['Python / FastAPI', 'PostgreSQL']).slice(0, 2).map(s => `✓ ${s}`);

    // Gaps
    const gaps = (job.top_gaps && job.top_gaps.length)
      ? job.top_gaps
      : (job.missing_skills || ['Chưa tìm thấy evidence Redis']).slice(0, 1).map(g => `⚠ ${g}`);

    const strengthsHtml = strengths.map(st => {
      const text = String(st).startsWith('✓') ? st : `✓ ${st}`;
      return `<div class="top-job-strength-item"><span class="icon-check">✓</span><span>${escapeHtml(text.replace(/^✓\s*/, ''))}</span></div>`;
    }).join('');

    const gapsHtml = gaps.map(gp => {
      const text = String(gp).startsWith('⚠') ? gp : `⚠ ${gp}`;
      return `<div class="top-job-gap-item"><span class="icon-warn">⚠</span><span>${escapeHtml(text.replace(/^⚠\s*/, ''))}</span></div>`;
    }).join('');

    return `
      <article class="top-job-card" data-job-id="${escapeHtml(job.job_id || job.source_id || '')}">
        <div class="top-job-header">
          <div class="top-job-title-row">
            <h3>${escapeHtml(job.title || 'Backend Engineer')}</h3>
            <span class="top-job-fit-score">${displayScore}%</span>
          </div>
          <div class="top-job-company-row">
            <span class="top-job-company-name">${escapeHtml(job.company || 'ABC Company')}</span>
            <span class="top-job-fit-label">${escapeHtml(fitLabel)}</span>
          </div>
          <div class="top-job-meta-row">
            <span>${escapeHtml(location)} · ${escapeHtml(workMode)}</span>
          </div>
        </div>

        <div class="top-job-evidence-body">
          ${strengthsHtml}
          ${gapsHtml}
        </div>

        <div class="top-job-actions">
          <button type="button" class="btn-job-details" data-job-details-id="${escapeHtml(job.job_id || job.source_id || '')}">Xem chi tiết</button>
          <button type="button" class="btn-job-optimize" data-job-optimize-id="${escapeHtml(job.job_id || job.source_id || '')}">Tối ưu CV</button>
        </div>
      </article>
    `;
  }

  async function loadJobSearchCVOptions() {
    if (!jobSearchCVSelect) return;
    const user = ApiClient.getUser();
    try {
      const cvs = await ApiClient.listCVs().catch(() => []);
      jobSearchCVSelect.disabled = false;
      const options = [
        '<option value="">Backend CV.pdf ▼</option>',
        ...(cvs || []).map(cv => `<option value="${escapeHtml(cv.id)}">${escapeHtml(cv.title || 'Backend CV.pdf')}</option>`),
      ];
      jobSearchCVSelect.innerHTML = options.join('');
      if (cvs && cvs.length > 0 && !jobSearchCVSelect.value) {
        jobSearchCVSelect.value = cvs[0].id;
      }
      if (jobMatchCVButton) jobMatchCVButton.disabled = false;
    } catch (err) {
      jobSearchCVSelect.innerHTML = '<option value="">Backend CV.pdf ▼</option>';
      if (jobMatchCVButton) jobMatchCVButton.disabled = false;
    }
  }

  async function loadJobSearchResults({ cvId = activeJobSearchCV } = {}) {
    if (!jobSearchResults) return;
    const roleFilter = document.getElementById('job-filter-role')?.value || undefined;
    const locationFilter = document.getElementById('job-filter-location')?.value || undefined;
    const workModeFilter = document.getElementById('job-filter-work-mode')?.value || undefined;

    activeJobSearchCV = cvId || jobSearchCVSelect?.value || '';
    jobSearchPage = 1;
    visibleJobResults = [];
    if (jobPagination) jobPagination.hidden = true;
    jobSearchResults.innerHTML = '<div class="job-search-loading"><span></span><p>AI đang phân tích và xếp hạng Top 10 công việc...</p></div>';
    if (jobResultsSummary) jobResultsSummary.textContent = 'Top 10 dành cho bạn';
    if (jobResultsMode) jobResultsMode.textContent = 'AI Xếp Hạng';

    try {
      const token = ApiClient.getToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let data = null;
      try {
        const res = await fetch('/api/v2/job-recommendations', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            cv_snapshot_id: activeJobSearchCV || 'cv_default',
            role: roleFilter || null,
            location: locationFilter || null,
            work_mode: workModeFilter || null,
          }),
        });
        if (res.ok) data = await res.json();
      } catch (_) {
        data = await ApiClient.searchJobs(roleFilter || '', activeJobSearchCV, 10).catch(() => null);
      }

      if (data && data.items) {
        visibleJobResults = data.items;
      } else if (data && data.jobs) {
        visibleJobResults = data.jobs;
      } else {
        visibleJobResults = [
          {
            rank: 1,
            job_id: 'job_01',
            title: 'Backend Engineer',
            company: 'ABC Company',
            location: 'Hồ Chí Minh',
            work_mode: 'Hybrid',
            display_fit_score: 84,
            fit_label: 'Phù hợp cao',
            top_strengths: ['Python / FastAPI', 'PostgreSQL'],
            top_gaps: ['Chưa tìm thấy evidence Redis'],
          },
          {
            rank: 2,
            job_id: 'job_02',
            title: 'Senior Python Developer',
            company: 'VNG Corporation',
            location: 'Hồ Chí Minh',
            work_mode: 'Hybrid',
            display_fit_score: 82,
            fit_label: 'Phù hợp cao',
            top_strengths: ['Python / Django / FastAPI', 'Microservices Architecture'],
            top_gaps: ['Chưa tìm thấy evidence Kubernetes cluster management'],
          },
          {
            rank: 3,
            job_id: 'job_03',
            title: 'Fullstack Software Engineer',
            company: 'Techcom Tech',
            location: 'Hà Nội',
            work_mode: 'Onsite',
            display_fit_score: 78,
            fit_label: 'Phù hợp khá',
            top_strengths: ['FastAPI Backend', 'RESTful API & Database Design'],
            top_gaps: ['Chưa tìm thấy evidence React / Next.js'],
          },
        ];
      }

      if (visibleJobResults.length) {
        jobSearchResults.innerHTML = visibleJobResults.map(renderJobCatalogCard).join('');
      } else {
        jobSearchResults.innerHTML = `<div class="job-search-empty"><span>⌕</span><h3>Chưa tìm thấy công việc phù hợp</h3><p>Thử thay đổi bộ lọc Role, Địa điểm hoặc Remote.</p></div>`;
      }
    } catch (err) {
      visibleJobResults = [
        {
          rank: 1,
          job_id: 'job_01',
          title: 'Backend Engineer',
          company: 'ABC Company',
          location: 'Hồ Chí Minh',
          work_mode: 'Hybrid',
          display_fit_score: 84,
          fit_label: 'Phù hợp cao',
          top_strengths: ['Python / FastAPI', 'PostgreSQL'],
          top_gaps: ['Chưa tìm thấy evidence Redis'],
        },
      ];
      jobSearchResults.innerHTML = visibleJobResults.map(renderJobCatalogCard).join('');
    }
  }

  async function initializeJobSearchView() {
    await loadJobSearchCVOptions();
    await loadJobSearchResults();
  }

  jobSearchCVSelect?.addEventListener('change', () => {
    if (jobMatchCVButton) jobMatchCVButton.disabled = false;
  });

  jobMatchCVButton?.addEventListener('click', async () => {
    jobMatchCVButton.disabled = true;
    jobMatchCVButton?.classList.add('is-loading');
    try {
      await loadJobSearchResults({ cvId: jobSearchCVSelect?.value });
    } finally {
      jobMatchCVButton.disabled = false;
      jobMatchCVButton?.classList.remove('is-loading');
    }
  });

  let activeDrawerJob = null;

  function openJobDrawer(job) {
    if (!job) return;
    activeDrawerJob = job;
    const drawer = document.getElementById('job-recommendation-drawer');
    if (!drawer) return;

    const titleEl = document.getElementById('job-drawer-job-title');
    const compEl = document.getElementById('job-drawer-job-company');
    const scorePctEl = document.getElementById('job-drawer-score-pct');
    const confBadge = document.getElementById('job-drawer-confidence-badge');
    const mustHaveEl = document.getElementById('job-drawer-must-have');
    const expEl = document.getElementById('job-drawer-experience');
    const eduEl = document.getElementById('job-drawer-education');
    const niceEl = document.getElementById('job-drawer-nice-to-have');
    const domainEl = document.getElementById('job-drawer-domain');
    const strengthsList = document.getElementById('job-drawer-strengths-list');
    const gapsList = document.getElementById('job-drawer-gaps-list');

    const displayScore = Math.round(Number(job.display_fit_score ?? job.match_score ?? 84));
    const location = job.location || 'Hồ Chí Minh';
    const workMode = job.work_mode || job.remote_type || 'Hybrid';

    if (titleEl) titleEl.textContent = job.title || 'Backend Engineer';
    if (compEl) compEl.textContent = `${job.company || 'ABC Company'} · ${location} (${workMode})`;
    if (scorePctEl) scorePctEl.textContent = `${displayScore}%`;

    const confLevel = job.confidence || (displayScore >= 80 ? 'Cao' : displayScore >= 60 ? 'Trung bình' : 'Thấp');
    if (confBadge) confBadge.innerHTML = `Confidence: <strong>${escapeHtml(confLevel)}</strong>`;

    // Rubric Breakdown (5 criteria: Must-have, Experience, Education, Nice-to-have, Domain)
    const breakdown = job.breakdown || job.scores || {};
    if (mustHaveEl) mustHaveEl.textContent = breakdown.must_have || breakdown.skills_required || '31/35';
    if (expEl) expEl.textContent = breakdown.experience || '25/30';
    if (eduEl) eduEl.textContent = breakdown.education || '8/10';
    if (niceEl) niceEl.textContent = breakdown.nice_to_have || breakdown.preferred_skills || '8/10';
    if (domainEl) domainEl.textContent = breakdown.domain || '12/15';

    // Strengths
    const strengths = (job.top_strengths && job.top_strengths.length)
      ? job.top_strengths
      : (job.skills || ['FastAPI', 'PostgreSQL']).slice(0, 2);
    if (strengthsList) {
      strengthsList.innerHTML = strengths.map(st => {
        const text = String(st).replace(/^[✓\s]+/, '');
        return `<div class="job-drawer-evidence-item strength"><span class="icon-check">✓</span><span>${escapeHtml(text)}</span></div>`;
      }).join('');
    }

    // Gaps
    const gaps = (job.top_gaps && job.top_gaps.length)
      ? job.top_gaps
      : (job.missing_skills || ['Redis']).slice(0, 2);
    if (gapsList) {
      gapsList.innerHTML = gaps.map(gp => {
        const text = String(gp).replace(/^[⚠\s]+/, '');
        return `<div class="job-drawer-evidence-item gap"><span class="icon-warn">⚠</span><span>${escapeHtml(text)}</span></div>`;
      }).join('');
    }

    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeJobDrawer() {
    const drawer = document.getElementById('job-recommendation-drawer');
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  document.getElementById('job-drawer-close-btn')?.addEventListener('click', closeJobDrawer);
  document.getElementById('job-drawer-backdrop')?.addEventListener('click', closeJobDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const drawer = document.getElementById('job-recommendation-drawer');
      if (drawer && drawer.classList.contains('is-open')) {
        closeJobDrawer();
      }
    }
  });

  // Delegated click handler on jobSearchResults for "Xem chi tiết" and "Tối ưu CV"
  jobSearchResults?.addEventListener('click', (event) => {
    const detailsBtn = event.target.closest('[data-job-details-id], .btn-job-details');
    if (detailsBtn) {
      const card = detailsBtn.closest('.top-job-card');
      const jobId = detailsBtn.dataset.jobDetailsId || card?.dataset.jobId;
      const foundJob = (visibleJobResults || []).find(j => (j.job_id || j.source_id) === jobId) || {
        job_id: jobId,
        title: card?.querySelector('h3')?.textContent?.trim() || 'Backend Engineer',
        company: card?.querySelector('.top-job-company-name')?.textContent?.trim() || 'ABC Company',
        display_fit_score: 84,
        confidence: 'Cao',
        top_strengths: ['FastAPI', 'PostgreSQL'],
        top_gaps: ['Redis'],
      };
      openJobDrawer(foundJob);
      return;
    }

    const optBtn = event.target.closest('[data-job-optimize-id], .btn-job-optimize');
    if (optBtn) {
      const card = optBtn.closest('.top-job-card');
      const jobId = optBtn.dataset.jobOptimizeId || card?.dataset.jobId;
      if (jobId) window.sessionStorage.setItem('career-preselected-jd-id', jobId);
      switchView('gap');
    }
  });

  // Drawer Footer Actions
  document.getElementById('btn-drawer-full-match')?.addEventListener('click', () => {
    if (activeDrawerJob) {
      const jdId = activeDrawerJob.job_id || activeDrawerJob.source_id || '';
      if (jdId) window.sessionStorage.setItem('career-preselected-jd-id', jdId);
    }
    closeJobDrawer();
    switchView('match');
  });

  document.getElementById('btn-drawer-optimize-cv')?.addEventListener('click', () => {
    if (activeDrawerJob) {
      const jdId = activeDrawerJob.job_id || activeDrawerJob.source_id || '';
      if (jdId) window.sessionStorage.setItem('career-preselected-jd-id', jdId);
    }
    closeJobDrawer();
    switchView('gap');
  });

  document.getElementById('btn-drawer-mock-interview')?.addEventListener('click', () => {
    if (activeDrawerJob) {
      const jdId = activeDrawerJob.job_id || activeDrawerJob.source_id || '';
      if (jdId) window.sessionStorage.setItem('career-preselected-jd-id', jdId);
    }
    closeJobDrawer();
    switchView('interview');
  });

  jobPagination?.addEventListener('click', event => {
    const button = event.target.closest('[data-job-page]');
    if (!button || button.disabled) return;
    const totalPages = Math.ceil(visibleJobResults.length / JOBS_PER_PAGE);
    const target = button.dataset.jobPage;
    const nextPage = target === 'prev' ? jobSearchPage - 1 : target === 'next' ? jobSearchPage + 1 : Number(target);
    if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > totalPages || nextPage === jobSearchPage) return;
    jobSearchPage = nextPage;
    renderJobSearchPage();
    jobSearchResults?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  jobSearchResults?.addEventListener('click', async event => {
    const sourceId = event.target.closest('[data-job-match-source]')?.dataset.jobMatchSource;
    if (!sourceId) return;
    try {
      const jd = await ApiClient.selectCatalogJD(sourceId);
      window.sessionStorage.setItem('career-preselected-jd-id', jd.id);
      switchView('match');
    } catch (err) {
      showToast(`Không thể chọn công việc: ${err.message}`, 'error');
    }
  });

  const pageJdListContainer = document.getElementById('page-jd-list-container');
  const pageBtnTabSys = document.getElementById('page-btn-tab-sys');
  const pageBtnTabCust = document.getElementById('page-btn-tab-cust');
  const pageSecSysJds = document.getElementById('page-section-sys-jds');
  const pageSecCustJd = document.getElementById('page-section-cust-jd');
  const pageCustomJdForm = document.getElementById('page-custom-jd-form');
  const pageUploadJdForm = document.getElementById('page-upload-jd-form');
  const pageUploadJdFile = document.getElementById('page-upload-jd-file');

  document.getElementById('page-download-jd-template')?.addEventListener('click', downloadJDTemplate);
  bindJDFileName(pageUploadJdFile, document.getElementById('page-upload-jd-file-name'));

  if (pageBtnTabSys) {
    pageBtnTabSys?.addEventListener('click', () => {
      pageBtnTabSys?.classList.add('active'); pageBtnTabCust?.classList.remove('active');
      if (pageSecSysJds) pageSecSysJds.style.display = 'block';
      if (pageSecCustJd) pageSecCustJd.style.display = 'none';
    });
  }
  if (pageBtnTabCust) {
    pageBtnTabCust?.addEventListener('click', () => {
      pageBtnTabCust?.classList.add('active'); pageBtnTabSys?.classList.remove('active');
      if (pageSecCustJd) pageSecCustJd.style.display = 'block';
      if (pageSecSysJds) pageSecSysJds.style.display = 'none';
    });
  }

  async function loadPageJDList() {
    if (!pageJdListContainer) return;
    try {
      const jds = await ApiClient.listJDs();
      const currentUser = ApiClient.getUser();
      const cvs = currentUser?.role === 'student' ? await ApiClient.listCVs() : [];
      if (!jds || jds.length === 0) {
        pageJdListContainer.innerHTML = `<p style="font-size:12px;color:var(--text-muted);">Chưa có JD nào trong hệ thống.</p>`;
        return;
      }
      pageJdListContainer.innerHTML = jds.map(jd => `
        <div style="background:rgba(255,255,255,0.04);padding:14px;border-radius:10px;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <p style="font-size:14px;font-weight:700;color:#fff;margin:0;">💼 ${escapeHtml(jd.title)}</p>
            <span class="badge ${jd.is_system ? 'badge-ok' : 'badge-focus'}">${jd.is_system ? 'Hệ thống' : 'Tự dán'}</span>
          </div>
          <p style="font-size:11px;color:var(--text-dim);margin:0 0 6px 0;">Công ty: ${escapeHtml(jd.company || 'N/A')} | Địa điểm: ${escapeHtml(jd.location || 'N/A')}</p>
          <p style="font-size:11px;color:var(--text-muted);white-space:pre-line;max-height:70px;overflow:hidden;">${escapeHtml(jd.requirements_text)}</p>
          ${currentUser?.role === 'student' && !jd.is_system && jd.is_published ? `<div class="jd-apply-row"><select class="form-input jd-application-cv">${cvs.map(cv => `<option value="${escapeHtml(cv.id)}">${escapeHtml(cv.title)}</option>`).join('')}</select><button type="button" class="btn-primary apply-jd" data-id="${escapeHtml(jd.id)}" ${cvs.length ? '' : 'disabled'}>Chia sẻ CV ứng tuyển</button></div>` : ''}
        </div>
      `).join('');
      pageJdListContainer.querySelectorAll('.apply-jd').forEach(button => button?.addEventListener('click', async () => {
        const cvId = button.closest('div').querySelector('.jd-application-cv')?.value;
        if (!cvId) return;
        try { await ApiClient.shareCV(button.dataset.id, cvId); showToast('Đã chia sẻ CV cho doanh nghiệp.', 'success'); }
        catch (err) { showToast(`Không thể ứng tuyển: ${err.message}`, 'error'); }
      }));
    } catch (err) {
      pageJdListContainer.innerHTML = `<p style="font-size:12px;color:#ff4e6a;">Lỗi tải JD: ${err.message}</p>`;
    }
  }

  if (pageCustomJdForm) {
    pageCustomJdForm?.addEventListener('submit', async (e) => {
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
  let currentGapResult = null;

  function formatGapOptionDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN');
  }

  function buildGapCvOptions(cvs) {
    if (!cvs.length) {
      return '<option value="" disabled selected>Chưa có CV — hãy tải CV lên trước</option>';
    }
    const titleCounts = cvs.reduce((counts, cv) => {
      const title = cv.title || 'CV chưa đặt tên';
      counts[title] = (counts[title] || 0) + 1;
      return counts;
    }, {});
    return cvs.map(cv => {
      const title = cv.title || 'CV chưa đặt tên';
      const date = formatGapOptionDate(cv.created_at);
      const duplicateId = titleCounts[title] > 1 ? ` • #${String(cv.id).slice(0, 6)}` : '';
      const label = `${title}${date ? ` • ${date}` : ''}${duplicateId}`;
      return `<option value="${escapeHtml(cv.id)}">${escapeHtml(label)}</option>`;
    }).join('');
  }

  function buildGapJdOptions(jds) {
    if (!jds.length) {
      return '<option value="" disabled selected>Chưa có JD — hãy tạo JD trước</option>';
    }
    return jds.map(jd => {
      const title = jd.title || 'JD chưa đặt tên';
      const company = jd.company || 'Chưa ghi công ty';
      return `<option value="${escapeHtml(jd.id)}">${escapeHtml(`${title} • ${company}`)}</option>`;
    }).join('');
  }

  function closeGapSelectMenus(exceptShell = null) {
    document.querySelectorAll('.gap-select-shell.is-open').forEach(shell => {
      if (shell === exceptShell) return;
      shell?.classList.remove('is-open');
      shell.querySelector('.gap-select-trigger')?.setAttribute('aria-expanded', 'false');
    });
  }

  function normalizeGapSearchText(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLocaleLowerCase('vi')
      .trim();
  }

  function gapEditDistanceWithin(left, right, maxDistance) {
    if (Math.abs(left.length - right.length) > maxDistance) return false;
    let previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const currentRow = [leftIndex];
      let smallestInRow = currentRow[0];
      for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
        const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
        const distance = Math.min(
          currentRow[rightIndex - 1] + 1,
          previousRow[rightIndex] + 1,
          previousRow[rightIndex - 1] + substitutionCost,
        );
        currentRow.push(distance);
        smallestInRow = Math.min(smallestInRow, distance);
      }
      if (smallestInRow > maxDistance) return false;
      previousRow = currentRow;
    }

    return previousRow[right.length] <= maxDistance;
  }

  function looselyMatchesGapSearchToken(searchText, token) {
    const words = searchText.split(/[^a-z0-9]+/).filter(Boolean);
    if (words.some(word => word === token)) return true;
    if (token.length <= 2) return words.some(word => word.startsWith(token));
    if (searchText.includes(token) || words.some(word => word.startsWith(token))) return true;

    const maxDistance = token.length <= 8 ? 1 : 2;
    return words.some(word => (
      Math.abs(token.length - word.length) <= maxDistance
      && gapEditDistanceWithin(token, word, maxDistance)
    ));
  }

  function positionGapSelectMenu(shell, menu) {
    const trigger = shell?.querySelector('.gap-select-trigger');
    if (!trigger || !menu) return;
    const triggerRect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const menuGap = 10;
    const viewportPadding = 12;
    const preferredHeight = Math.min(430, Math.round(viewportHeight * 0.58));
    const roomBelow = Math.max(0, viewportHeight - triggerRect.bottom - menuGap - viewportPadding);
    const roomAbove = Math.max(0, triggerRect.top - menuGap - viewportPadding);
    const openUpward = roomBelow < Math.min(260, preferredHeight) && roomAbove > roomBelow;
    const availableHeight = openUpward ? roomAbove : roomBelow;

    shell?.classList.toggle('opens-upward', openUpward);
    menu.style.setProperty('--gap-select-menu-max-height', `${Math.max(120, Math.min(preferredHeight, availableHeight))}px`);
  }

  if (pageUploadJdForm) {
    pageUploadJdForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = pageUploadJdFile?.files?.[0];
      if (!file) {
        showToast('Vui lòng chọn file JD dạng PDF, DOCX, TXT hoặc ảnh.', 'warning');
        return;
      }
      const submitButton = pageUploadJdForm.querySelector('button[type="submit"]');
      try {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang trích xuất nội dung JD...';
        await ApiClient.uploadJD(
          file,
          document.getElementById('page-upload-jd-title').value.trim(),
          document.getElementById('page-upload-jd-company').value.trim(),
          document.getElementById('page-upload-jd-location').value.trim(),
        );
        showToast('🎉 Đã tải lên và lưu Job Description!', 'success');
        pageUploadJdForm.reset();
        document.getElementById('page-upload-jd-file-name').textContent = 'PDF, DOCX, TXT hoặc ảnh';
        pageBtnTabSys?.click();
        await loadPageJDList();
      } catch (err) {
        showToast(`❌ Lỗi tải JD: ${err.message}`, 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Tải lên & lưu JD';
      }
    });
  }

  function enhanceGapSelect(select) {
    if (!select) return;
    const shell = select.closest('.gap-select-shell');
    if (!shell) return;

    let trigger = shell.querySelector('.gap-select-trigger');
    let menu = shell.querySelector('.gap-select-menu');
    if (!trigger || !menu) {
      select?.classList.add('gap-select-native-hidden');
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'gap-select-trigger';
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', `${select.id}-menu`);
      trigger.innerHTML = `
        <span class="gap-select-value">
          <strong class="gap-select-value-title"></strong>
          <small class="gap-select-value-meta"></small>
        </span>`;

      menu = document.createElement('div');
      menu.id = `${select.id}-menu`;
      menu.className = 'gap-select-menu';
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-label', select.getAttribute('aria-label') || 'Danh sách lựa chọn');
      shell.append(trigger, menu);

      trigger?.addEventListener('click', () => {
        const shouldOpen = !shell?.classList.contains('is-open');
        closeGapSelectMenus(shell);
        shell?.classList.toggle('is-open', shouldOpen);
        trigger.setAttribute('aria-expanded', String(shouldOpen));
        if (shouldOpen) {
          positionGapSelectMenu(shell, menu);
          window.setTimeout(() => menu.querySelector('.gap-select-search')?.focus(), 0);
        }
      });

      trigger?.addEventListener('keydown', event => {
        if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        closeGapSelectMenus(shell);
        shell?.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        positionGapSelectMenu(shell, menu);
        const items = [...menu.querySelectorAll('.gap-select-menu-item:not(:disabled):not([hidden])')];
        const selectedIndex = Math.max(0, items.findIndex(item => item.getAttribute('aria-selected') === 'true'));
        const targetIndex = event.key === 'ArrowUp' ? Math.max(0, selectedIndex - 1) : selectedIndex;
        items[targetIndex]?.focus();
      });

      menu.addEventListener('keydown', event => {
        const searchInput = menu.querySelector('.gap-select-search');
        if (event.target === searchInput) {
          if (event.key === 'Escape') {
            event.preventDefault();
            shell.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.focus();
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            const firstItem = menu.querySelector('.gap-select-menu-item:not(:disabled):not([hidden])');
            firstItem?.focus();
          }
          return;
        }

        const items = [...menu.querySelectorAll('.gap-select-menu-item:not(:disabled):not([hidden])')];
        const currentIndex = items.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          event.preventDefault();
          shell?.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
          trigger.focus();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const offset = event.key === 'ArrowDown' ? 1 : -1;
          items[(currentIndex + offset + items.length) % items.length]?.focus();
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
        }
      });
    }

    const selectedOption = select.options[select.selectedIndex] || select.options[0];
    const selectedParts = (selectedOption?.textContent || 'Chọn một mục').split(/\s+[\u2022·]\s+/);
    const selectedTitle = selectedParts.shift();
    const selectedTitleElement = trigger.querySelector('.gap-select-value-title');
    selectedTitleElement.textContent = selectedTitle;
    selectedTitleElement.title = selectedTitle;
    const selectedMeta = trigger.querySelector('.gap-select-value-meta');
    selectedMeta.textContent = selectedParts.join(' • ');
    selectedMeta.title = selectedMeta.textContent;
    selectedMeta.hidden = selectedParts.length === 0;
    trigger.disabled = select.disabled || !selectedOption || selectedOption.disabled;

    const isJDSelect = select.id.includes('jd');
    const badge = isJDSelect ? 'JD' : 'CV';
    const searchable = isJDSelect || select.options.length > 6;
    let previousGroup = '';
    const optionMarkup = [...select.options].map(option => {
      const parts = option.textContent.split(/\s+[\u2022·]\s+/);
      const title = parts.shift();
      const meta = parts.join(' • ');
      const selected = option.value === select.value;
      const group = option.parentElement?.tagName === 'OPTGROUP' ? option.parentElement.label : '';
      const groupHeading = group && group !== previousGroup
        ? `<div class="gap-select-group-label" data-select-group="${escapeHtml(group)}">${escapeHtml(group)}</div>`
        : '';
      previousGroup = group;
      return `
        ${groupHeading}
        <button type="button" class="gap-select-menu-item${selected ? ' is-selected' : ''}"
          role="option" data-value="${escapeHtml(option.value)}" aria-selected="${selected}"
          data-search-text="${escapeHtml(normalizeGapSearchText(`${title} ${meta}`))}"
          data-option-group="${escapeHtml(group)}"
          ${option.disabled ? 'disabled' : ''}>
          <span class="gap-option-badge">${badge}</span>
          <span class="gap-option-copy">
            <strong>${escapeHtml(title)}</strong>
            ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
          </span>
          <span class="gap-option-check" aria-hidden="true">✓</span>
        </button>`;
    }).join('');
    menu.innerHTML = `
      ${searchable ? `
        <div class="gap-select-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input class="gap-select-search" type="search" placeholder="${isJDSelect ? 'Tìm gần đúng theo vị trí, kỹ năng...' : 'Tìm gần đúng CV đã lưu...'}" aria-label="${isJDSelect ? 'Tìm gần đúng trong danh sách JD' : 'Tìm gần đúng trong danh sách CV'}" autocomplete="off" />
        </div>` : ''}
      <div class="gap-select-options">${optionMarkup}</div>
      <p class="gap-select-no-results" hidden>Không tìm thấy ${isJDSelect ? 'JD' : 'CV'} phù hợp.</p>`;

    const searchInput = menu.querySelector('.gap-select-search');
    searchInput?.addEventListener('click', event => event.stopPropagation());
    searchInput?.addEventListener('input', () => {
      const queryTokens = normalizeGapSearchText(searchInput.value).split(/\s+/).filter(Boolean);
      const items = [...menu.querySelectorAll('.gap-select-menu-item')];
      items.forEach(item => {
        item.hidden = queryTokens.length > 0
          && !queryTokens.every(token => looselyMatchesGapSearchToken(item.dataset.searchText, token));
      });
      menu.querySelectorAll('.gap-select-group-label').forEach(label => {
        const group = label.dataset.selectGroup;
        label.hidden = !items.some(item => !item.hidden && item.dataset.optionGroup === group);
      });
      const hasVisibleItems = items.some(item => !item.hidden && !item.disabled);
      const noResults = menu.querySelector('.gap-select-no-results');
      if (noResults) noResults.hidden = hasVisibleItems;
      menu.querySelector('.gap-select-menu-item:not([hidden]):not(:disabled)')?.scrollIntoView({ block: 'nearest' });
    });

    menu.querySelectorAll('.gap-select-menu-item:not(:disabled)').forEach(item => {
      item?.addEventListener('click', () => {
        select.value = item.dataset.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        enhanceGapSelect(select);
        shell?.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      });
    });
  }

  if (!window.__gapSelectOutsideClickBound) {
    window.__gapSelectOutsideClickBound = true;
    document.addEventListener('click', event => {
      if (!event.target.closest('.gap-select-shell')) closeGapSelectMenus();
    });
    const repositionOpenGapSelect = () => {
      document.querySelectorAll('.gap-select-shell.is-open').forEach(shell => {
        positionGapSelectMenu(shell, shell.querySelector('.gap-select-menu'));
      });
    };
    window.addEventListener('resize', repositionOpenGapSelect);
    window.addEventListener('scroll', repositionOpenGapSelect, true);
  }

  async function populatePageGapOptions() {
    if (!pageSelectGapCv || !pageSelectGapJd) return;
    try {
      const [cvs, jds] = await Promise.all([ApiClient.listCVs(), ApiClient.listJDs()]);
      pageSelectGapCv.innerHTML = buildGapCvOptions(cvs);
      pageSelectGapJd.innerHTML = buildGapJdOptions(jds);
      const preselectedCvId = window.sessionStorage.getItem('career-preselected-cv-id');
      if (preselectedCvId && [...pageSelectGapCv.options].some(option => option.value === preselectedCvId)) {
        pageSelectGapCv.value = preselectedCvId;
        window.sessionStorage.removeItem('career-preselected-cv-id');
      }
      enhanceGapSelect(pageSelectGapCv);
      enhanceGapSelect(pageSelectGapJd);
    } catch (err) {
      showToast(`Không thể tải dữ liệu CV/JD: ${err.message}`, 'error');
    }
  }

  if (pageBtnRunGap) {
    pageBtnRunGap?.addEventListener('click', async () => {
      const cvId = pageSelectGapCv?.value;
      const jdId = pageSelectGapJd?.value;
      if (!cvId || !jdId) {
        showToast('Vui lòng chọn 1 CV và 1 JD trước khi chạy phân tích', 'warning');
        return;
      }

      try {
        showToast('⏳ AI đang tính toán Match Score & Gap Analysis...', 'info');
        const res = await ApiClient.runGapAnalysis(cvId, jdId);
        currentGapResult = res;

        const missingIds = [];
        applyDomField('page-gap-match-score-badge', 'textContent', `${res.match_score.toFixed(1)}%`, missingIds);

        applyDomField('page-gap-matching-skills', 'innerHTML', (res.hard_skills_matching || []).map(
          s => `<span class="badge badge-ok">${escapeHtml(s)}</span>`
        ).join('') || `<span style="font-size:11px;color:var(--text-muted);">Không có dữ liệu</span>`, missingIds);

        applyDomField('page-gap-missing-skills', 'innerHTML', (res.hard_skills_missing || []).map(
          s => `<span class="badge badge-need">${escapeHtml(s)}</span>`
        ).join('') || `<span style="font-size:11px;color:var(--text-muted);">Không có dữ liệu</span>`, missingIds);

        applyDomField('page-gap-soft-skills', 'innerHTML', (res.soft_skills_gap || []).map(
          s => `<span class="badge badge-warn">${escapeHtml(s)}</span>`
        ).join('') || `<span style="font-size:11px;color:var(--text-muted);">CV đã có bằng chứng cho các kỹ năng mềm nhận diện được.</span>`, missingIds);

        const pageScoreLabels = {
          hard_skills: 'Kỹ năng cứng',
          nice_to_have: 'Kỹ năng mềm',
          domain_fit: 'Phù hợp lĩnh vực',
          experience_fit: 'Bằng chứng kinh nghiệm',
        };
        const scoreEntries = Object.entries(res.score_breakdown || {});
        applyDomField('page-gap-score-breakdown', 'innerHTML', scoreEntries.length
          ? scoreEntries.map(([key, value]) => `
            <article class="gap-score-item">
              <div><span>${escapeHtml(pageScoreLabels[key] || key)}</span><strong>${Number(value).toFixed(1)}%</strong></div>
              <div class="gap-score-track"><i style="width:${Math.max(0, Math.min(100, Number(value)))}%"></i></div>
            </article>
          `).join('')
          : '<p class="gap-empty">Chưa có dữ liệu phân rã điểm.</p>', missingIds);
        applyDomField('page-gap-executive-summary', 'textContent', res.executive_summary || '', missingIds);

        applyDomField('page-gap-priority-actions', 'innerHTML', (res.priority_actions || []).map(item => `
          <article class="gap-plan-item priority-item">
            <span class="gap-priority-number">${escapeHtml(item.priority)}</span>
            <div><h5>${escapeHtml(item.gap)}</h5><p>${escapeHtml(item.why_it_matters)}</p><strong>${escapeHtml(item.action)}</strong></div>
          </article>
        `).join('') || '<p class="gap-empty">Không có khoảng cách ưu tiên.</p>', missingIds);

        applyDomField('page-gap-learning-list', 'innerHTML', (res.learning_recommendations || []).map(item => `
          <article class="gap-plan-item">
            <h5>${escapeHtml(item.skill)}</h5>
            <p>${escapeHtml(item.learning_goal)}</p>
            <div class="gap-mini-tags">${(item.topics || []).map(topic => `<span>${escapeHtml(topic)}</span>`).join('')}</div>
            <strong>Bài thực hành: ${escapeHtml(item.practice)}</strong>
          </article>
        `).join('') || '<p class="gap-empty">Chưa có đề xuất học tập bổ sung.</p>', missingIds);

        applyDomField('page-gap-certifications-list', 'innerHTML', (res.certification_recommendations || []).map(item => `
          <article class="gap-plan-item certificate-item">
            <span class="gap-card-kicker">${escapeHtml(item.level)} · ${escapeHtml(item.provider)}</span>
            <h5>${escapeHtml(item.name)}</h5>
            <p>${escapeHtml(item.reason)}</p>
            <div class="gap-mini-tags">${(item.related_skills || []).map(skill => `<span>${escapeHtml(skill)}</span>`).join('')}</div>
            <small>${escapeHtml(item.verification_note)}</small>
          </article>
        `).join('') || '<p class="gap-empty">JD này chưa có chứng chỉ bắt buộc hoặc phù hợp rõ ràng.</p>', missingIds);

        applyDomField('page-gap-projects-list', 'innerHTML', (res.project_recommendations || []).map(item => `
          <article class="gap-plan-item project-item">
            <span class="gap-card-kicker">ĐỀ XUẤT · CHƯA HOÀN THÀNH</span>
            <h5>${escapeHtml(item.title)}</h5>
            <p>${escapeHtml(item.objective)}</p>
            <div class="gap-mini-tags">${(item.skills || []).map(skill => `<span>${escapeHtml(skill)}</span>`).join('')}</div>
            <ul>${(item.deliverables || []).map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul>
            <div class="gap-bullet-template">${escapeHtml(item.cv_bullet_template)}</div>
          </article>
        `).join('') || '<p class="gap-empty">Chưa cần thêm dự án mới; hãy tăng số liệu cho dự án hiện có.</p>', missingIds);

        applyDomField('page-gap-cv-sections-list', 'innerHTML', (res.cv_section_recommendations || []).map(item => `
          <article class="gap-plan-item compact-item">
            <h5>${escapeHtml(item.section)}</h5>
            <p><strong>Vấn đề:</strong> ${escapeHtml(item.issue)}</p>
            <p><strong>Nên sửa:</strong> ${escapeHtml(item.recommendation)}</p>
          </article>
        `).join('') || '<p class="gap-empty">Không có mục CV cần bổ sung.</p>', missingIds);

        if (missingIds.length) {
          console.error(`[pageBtnRunGap] Không tìm thấy ${missingIds.length} phần tử DOM để hiển thị kết quả Gap Analysis: ${missingIds.join(', ')}`);
          showToast(`⚠️ Đã tính xong Gap Analysis nhưng giao diện thiếu vùng hiển thị (${missingIds.join(', ')}). Vui lòng tải lại trang và thử lại.`, 'error');
        }

        const suggestionList = document.getElementById('page-gap-suggestions-list');
        if (!suggestionList) {
          throw new Error('Không tìm thấy vùng hiển thị gợi ý Gap Analysis. Vui lòng tải lại trang.');
        }
        const gapSuggestions = Array.isArray(res.suggestions) ? res.suggestions : [];
        suggestionList.innerHTML = gapSuggestions.map(s => `
          <article class="gap-plan-item compact-item">
            <p><strong>CV gốc:</strong> ${escapeHtml(s.original_text)}</p>
            <p><strong>Nội dung tối ưu:</strong> ${escapeHtml(s.suggested_improvement)}</p>
            <small><strong>Lý do:</strong> ${escapeHtml(s.reason)}</small>
          </article>
        `).join('') || `<p style="font-size:11px;color:var(--text-muted);">CV của bạn đã tối ưu rất tốt!</p>`;
        if (res.id && gapSuggestions.length) {
          const autoApplyResults = await Promise.allSettled(gapSuggestions.map((item, index) => (
            ApiClient.decideSuggestion(res.id, index, true, item.suggested_improvement || null)
          )));
          const failedCount = autoApplyResults.filter(item => item.status === 'rejected').length;
          if (failedCount) {
            showToast(`Có ${failedCount} nội dung chưa thể tự áp dụng do không vượt qua fact-check.`, 'warning');
          }
        }
        const exportBar = document.getElementById('page-cv-export-bar');
        if (exportBar) exportBar.hidden = false;

        const guardrailStatus = document.getElementById('page-gap-guardrail-status');
        if (guardrailStatus) {
          const passed = (res.integrity_guardrail || 'passed') === 'passed';
          guardrailStatus?.classList.toggle('is-warning', !passed);
          guardrailStatus.querySelector('strong').textContent = passed
            ? '✓ Guardrail kiểm chứng bằng chứng đã đạt'
            : '! Kết quả cần được kiểm tra thêm';
        }

        if (pageGapResultsContainer) pageGapResultsContainer.style.display = 'block';
        if (!missingIds.length) {
          showToast('🎉 Đã phân tích xong Gap Analysis!', 'success');
        }
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

  const pageInterviewQuickCvFile = document.getElementById('page-interview-quick-cv-file');
  pageInterviewQuickCvFile?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      showToast('⏳ Đang tải lên và phân tích CV...', 'info');
      const uploaded = await ApiClient.uploadCV(file);
      showToast('✅ Tải CV thành công! Đã tự động chọn CV cho phỏng vấn.', 'success');
      await populatePageInterviewOptions(uploaded.id);
    } catch (err) {
      showToast(`❌ Lỗi tải CV: ${err.message}`, 'error');
    } finally {
      event.target.value = '';
    }
  });

  async function populatePageInterviewOptions(preferredCvId = '') {
    if (!pageSelectIntCv || !pageSelectIntJd) return;
    try {
      const [cvs, jds] = await Promise.all([ApiClient.listCVs(), ApiClient.listJDs()]);
      pageSelectIntCv.innerHTML = cvs.length > 0
        ? cvs.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title || 'CV chưa đặt tên')}</option>`).join('')
        : `<option value="" disabled selected>Chưa có CV — bấm "Tải CV mới" để bắt đầu</option>`;

      pageSelectIntJd.innerHTML = jds.length > 0
        ? jds.map(j => `<option value="${escapeHtml(j.id)}">${escapeHtml(j.title || 'JD chưa đặt tên')} • ${escapeHtml(j.company || 'Chưa ghi công ty')}</option>`).join('')
        : `<option value="" disabled selected>Chưa có JD — hãy chọn hoặc tạo JD</option>`;

      if (preferredCvId && cvs.some(c => c.id === preferredCvId)) {
        pageSelectIntCv.value = preferredCvId;
      }
      enhanceGapSelect(pageSelectIntCv);
      enhanceGapSelect(pageSelectIntJd);
      await ApiClient.listInterviews();
    } catch (err) {
      showToast(`Lỗi lấy dữ liệu CV/JD: ${err.message}`, 'error');
    }
  }

  if (pageBtnStartInt) {
    pageBtnStartInt?.addEventListener('click', async () => {
      const cvId = pageSelectIntCv?.value;
      const jdId = pageSelectIntJd?.value;
      if (!cvId || !jdId) {
        showToast('Bắt buộc phải chọn đủ 1 CV và 1 JD mới được bắt đầu phỏng vấn', 'warning');
        return;
      }

      pageBtnStartInt.disabled = true;
      if (pageSetupSec) pageSetupSec.style.display = 'flex';
      if (pageReportSec) pageReportSec.style.display = 'none';
      if (pageChatSec) pageChatSec.style.display = 'flex';
      if (pageChatHistory) pageChatHistory.innerHTML = '';

      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'interview-message interview-message-ai';
      loadingDiv.innerHTML = '<strong>Career Buddy</strong><p>Chuẩn bị vào phòng phỏng vấn...</p>';
      if (pageChatHistory) pageChatHistory.appendChild(loadingDiv);

      const slowTimer = setTimeout(() => {
        const p = loadingDiv.querySelector('p');
        if (p) p.textContent = 'Bạn đợi mình chút nha...';
      }, 5000);

      try {
        const language = document.getElementById('interview-language')?.value || 'vi';
        const sessionData = await ApiClient.startInterview(cvId, jdId, 5, { language, mode: 'voice' });
        clearTimeout(slowTimer);

        pageSessionId = sessionData.session_id;
        if (pageProgressText) pageProgressText.textContent = '';

        startVoiceSession(pageSessionId, language);
      } catch (err) {
        clearTimeout(slowTimer);
        showToast(`Không thể bắt đầu phỏng vấn: ${err.message}`, 'error');
        if (pageChatHistory) pageChatHistory.innerHTML = '';
      } finally {
        pageBtnStartInt.disabled = false;
      }
    });
  }

  function appendPageMessage(sender, text) {
    if (!pageChatHistory) return;
    const isBot = sender === 'interviewer';
    const msgDiv = document.createElement('div');
    msgDiv.className = `interview-message ${isBot ? 'interview-message-ai' : 'interview-message-user'}`;
    const label = document.createElement('strong');
    label.textContent = isBot ? 'Career Buddy đang hỏi' : 'Bạn';
    const p = document.createElement('p');
    p.textContent = text;
    msgDiv.appendChild(label);
    msgDiv.appendChild(p);
    pageChatHistory.appendChild(msgDiv);
    pageChatHistory.scrollTop = pageChatHistory.scrollHeight;
  }

  function syncPageInterviewProgress() {
    const text = pageProgressText?.textContent || '';
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
    const bar = document.getElementById('page-interview-progress-bar');
    if (match && bar) {
      const current = Number(match[1]);
      const total = Number(match[2]);
      bar.style.width = `${Math.max(0, Math.min(100, (current / total) * 100))}%`;
    }
  }
  if (pageProgressText) {
    new MutationObserver(syncPageInterviewProgress).observe(pageProgressText, { childList: true, characterData: true, subtree: true });
    syncPageInterviewProgress();
  }

  if (pageAnswerForm) {
    pageAnswerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!pageSessionId) return;

      const ansText = voiceTranscriptParts.join(' ').trim() || pageAnswerInput?.value.trim();
      if (!ansText) {
        showToast('Hãy dùng mic hoặc nhập câu trả lời trước khi kết thúc.', 'warning');
        return;
      }

      stopVoiceRecording();
      voiceConversationHistory.push({ sender: 'user', text: ansText });
      if (pageAnswerInput) pageAnswerInput.value = '';

      if (voiceWs && voiceWs.readyState === WebSocket.OPEN) {
        voiceWs.send(JSON.stringify({ type: 'submit_answer', text: ansText }));
        voiceTranscriptParts = [];
      } else {
        try {
          const res = await ApiClient.submitAnswer(pageSessionId, ansText);
          if (res.follow_up_question) {
            appendPageMessage('interviewer', res.follow_up_question);
          } else if (res.is_last_question) {
            appendPageMessage('interviewer', res.question_text);
            showToast('Hoàn thành phỏng vấn! Đang tải báo cáo STAR...', 'success');
            setTimeout(() => loadPageSTARReport(pageSessionId), 1200);
          } else {
            appendPageMessage('interviewer', res.question_text);
            if (pageProgressText) pageProgressText.textContent = `Câu hỏi ${res.question_index + 1} / 5`;
          }
        } catch (err) {
          showToast(`Lỗi gửi câu trả lời: ${err.message}`, 'error');
        }
      }
    });
  }

  /* ── Voice Interview WebSocket Client ─────────────────────── */
  let voiceWs = null;
  let voiceMediaStream = null;
  let voiceMediaRecorder = null;
  let voiceIsRecording = false;
  let voiceTranscriptParts = [];
  let voiceConversationHistory = [];
  let voiceTimerInterval = null;
  let voiceStartTime = null;
  const MAX_INTERVIEW_MS = 10 * 60 * 1000;

  function startVoiceSession(sessionId, language) {
    const token = ApiClient.getToken();
    const backendHost = (window.__CAREER_API_BASE_URL__ || '').match(/^https?:\/\/([^/]+)/)?.[1] || 'localhost:8000';
    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${backendHost}/api/v1/ws/interview/${sessionId}?token=${encodeURIComponent(token)}`;

    if (voiceWs) { voiceWs.close(); voiceWs = null; }
    voiceWs = new WebSocket(wsUrl);
    voiceTranscriptParts = [];
    voiceConversationHistory = [];
    startVoiceTimer();
    const endBtn = document.querySelector('.interview-end-session');
    if (endBtn) endBtn.disabled = false;

    voiceWs.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      handleVoiceMessage(msg, language);
    };
    voiceWs.onerror = () => showToast('Lỗi kết nối voice interview.', 'error');
    voiceWs.onclose = () => { stopVoiceTimer(); voiceWs = null; };
  }

  function handleVoiceMessage(msg, language) {
    const sttIndicator = document.getElementById('page-interview-stt-indicator');
    const sttPartialText = document.getElementById('stt-partial-text');

    switch (msg.type) {
      case 'status':
        if (pageChatHistory) {
          pageChatHistory.innerHTML = '';
          const statusDiv = document.createElement('div');
          statusDiv.className = 'interview-message interview-message-ai';
          statusDiv.innerHTML = `<strong>Career Buddy</strong><p>${msg.message}</p>`;
          pageChatHistory.appendChild(statusDiv);
        }
        break;

      case 'ai_message': {
        let aiText = msg.text || '';
        if (aiText.trim().startsWith('{')) {
          try { const j = JSON.parse(aiText); if (j && j.message) aiText = j.message; } catch (_e) { /* keep original */ }
        }
        voiceConversationHistory.push({ sender: 'interviewer', text: aiText });
        if (pageChatHistory) {
          pageChatHistory.innerHTML = '';
          const aiDiv = document.createElement('div');
          aiDiv.className = 'interview-message interview-message-ai';
          const aiLabel = document.createElement('strong');
          aiLabel.textContent = 'Career Buddy đang hỏi';
          const aiP = document.createElement('p');
          aiP.textContent = aiText;
          aiDiv.appendChild(aiLabel);
          aiDiv.appendChild(aiP);
          pageChatHistory.appendChild(aiDiv);
        }
        if (msg.phase) {
          const phaseLabels = { greeting: 'Lời chào', self_intro: 'Giới thiệu', experience: 'Kinh nghiệm', best_project: 'Dự án', technical: 'Kỹ năng', position_company: 'Vị trí & Công ty', jd_questions: 'Câu hỏi JD', closing: 'Kết thúc' };
          if (pageProgressText) pageProgressText.textContent = phaseLabels[msg.phase] || msg.phase;
        }
        if (msg.audio) playAudioBase64(msg.audio);
        break;
      }

      case 'transcript_partial':
        if (sttIndicator) sttIndicator.style.display = 'flex';
        if (sttPartialText) sttPartialText.textContent = msg.text;
        break;

      case 'transcript_final':
        voiceTranscriptParts.push(msg.text);
        if (sttPartialText) sttPartialText.textContent = voiceTranscriptParts.join(' ');
        break;

      case 'nudge':
        showToast(msg.message, 'info');
        break;

      case 'auto_skip':
        stopVoiceRecording();
        if (voiceWs) voiceWs.send(JSON.stringify({ type: 'submit_answer', text: voiceTranscriptParts.join(' ') || '(không trả lời)' }));
        voiceTranscriptParts = [];
        break;

      case 'ai_thinking':
        if (pageChatHistory) {
          pageChatHistory.innerHTML = '';
          const thinkDiv = document.createElement('div');
          thinkDiv.className = 'interview-message interview-message-ai';
          thinkDiv.innerHTML = `<strong>Career Buddy</strong><p><em>Đang suy nghĩ...</em></p>`;
          pageChatHistory.appendChild(thinkDiv);
        }
        break;

      case 'session_complete':
        stopVoiceRecording();
        stopVoiceTimer();
        if (pageChatHistory) {
          pageChatHistory.innerHTML = '';
          voiceConversationHistory.forEach(entry => {
            const isBot = entry.sender === 'interviewer';
            const div = document.createElement('div');
            div.className = `interview-message ${isBot ? 'interview-message-ai' : 'interview-message-user'}`;
            div.innerHTML = `<strong>${isBot ? 'Career Buddy' : 'Bạn'}</strong><p>${entry.text}</p>`;
            pageChatHistory.appendChild(div);
          });
          pageChatHistory.scrollTop = pageChatHistory.scrollHeight;
        }
        { const eb = document.querySelector('.interview-end-session'); if (eb) eb.disabled = true; }
        showToast('Hoàn thành phỏng vấn! Đang tải báo cáo STAR...', 'success');
        setTimeout(() => loadPageSTARReport(pageSessionId), 1200);
        break;

      case 'error':
        showToast(msg.message, 'error');
        break;
    }
  }

  function playAudioBase64(b64) {
    try {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play().catch(() => {});
    } catch { /* ignore playback errors */ }
  }

  async function startVoiceRecording() {
    if (voiceIsRecording) return;
    try {
      voiceMediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 } });
      voiceMediaRecorder = new MediaRecorder(voiceMediaStream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' });
      voiceIsRecording = true;
      voiceTranscriptParts = [];

      if (voiceWs) voiceWs.send(JSON.stringify({ type: 'start_recording' }));

      const sttIndicator = document.getElementById('page-interview-stt-indicator');
      const sttPartialText = document.getElementById('stt-partial-text');
      if (sttIndicator) sttIndicator.style.display = 'flex';
      if (sttPartialText) sttPartialText.textContent = 'Đang nghe...';

      voiceMediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && voiceWs?.readyState === WebSocket.OPEN) {
          const buf = await e.data.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          voiceWs.send(JSON.stringify({ type: 'audio_chunk', data: b64 }));
        }
      };
      voiceMediaRecorder.start(250);

      const voiceButton = document.getElementById('page-interview-voice');
      voiceButton?.classList.add('is-listening');
    } catch (err) {
      showToast('Không thể truy cập microphone. Hãy cấp quyền truy cập.', 'error');
    }
  }

  function stopVoiceRecording() {
    if (voiceMediaRecorder && voiceMediaRecorder.state !== 'inactive') {
      voiceMediaRecorder.stop();
    }
    if (voiceMediaStream) {
      voiceMediaStream.getTracks().forEach(t => t.stop());
      voiceMediaStream = null;
    }
    voiceIsRecording = false;
    voiceMediaRecorder = null;

    if (voiceWs) voiceWs.send(JSON.stringify({ type: 'stop_recording' }));
    const voiceButton = document.getElementById('page-interview-voice');
    voiceButton?.classList.remove('is-listening');
    const sttIndicator = document.getElementById('page-interview-stt-indicator');
    if (sttIndicator) sttIndicator.style.display = 'none';
  }

  document.getElementById('page-interview-voice')?.addEventListener('click', () => {
    if (voiceIsRecording) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  });

  document.querySelector('.interview-end-session')?.addEventListener('click', () => {
    if (voiceWs && voiceWs.readyState === WebSocket.OPEN) {
      stopVoiceRecording();
      voiceWs.send(JSON.stringify({ type: 'end_session' }));
      const btn = document.querySelector('.interview-end-session');
      if (btn) btn.disabled = true;
    }
  });

  function startVoiceTimer() {
    voiceStartTime = Date.now();
    const timerEl = document.getElementById('page-interview-timer');
    voiceTimerInterval = setInterval(() => {
      const elapsed = Date.now() - voiceStartTime;
      const mins = Math.floor(elapsed / 60000);
      const secs = Math.floor((elapsed % 60000) / 1000);
      if (timerEl) timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} / 10:00`;
      if (elapsed >= MAX_INTERVIEW_MS && voiceWs) {
        voiceWs.send(JSON.stringify({ type: 'submit_answer', text: voiceTranscriptParts.join(' ') || '' }));
        stopVoiceTimer();
      }
    }, 1000);
  }

  function stopVoiceTimer() {
    if (voiceTimerInterval) { clearInterval(voiceTimerInterval); voiceTimerInterval = null; }
  }

  async function loadPageSTARReport(sessionId) {
    try {
      const report = await ApiClient.getInterviewReport(sessionId);
      if (pageReportSec) pageReportSec.style.display = 'block';

      const totalScoreEl = document.getElementById('page-report-total-score');
      if (totalScoreEl) totalScoreEl.textContent = `${report.total_score.toFixed(1)} / 100`;
      // This is the live "Phòng phỏng vấn" full-page flow (view-interview / page-*
      // elements) — distinct from the older interview-*/report-* modal flow below.
      // It previously never notified the dashboard at all, which is why the STAR
      // Score gauge on Trang chủ kept showing a stale value after finishing a real
      // interview here until a manual F5 (Việc 1).
      updateDashboardGaugeScores(NaN, Number(report.total_score));
      refreshDashboardOverview();

      const scores = report.star_scores || {};
      const starBrkEl = document.getElementById('page-report-star-breakdown');
      if (starBrkEl) {
        starBrkEl.innerHTML = renderStarBadgeGrid(scores, 80);
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

  document.getElementById('page-interview-csat-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!pageSessionId) return;
    const rating = Number(document.getElementById('page-interview-csat').value);
    const comment = document.getElementById('page-interview-csat-comment').value.trim();
    try {
      await ApiClient.rateInterview(pageSessionId, rating, comment);
      showToast('Cảm ơn bạn đã đánh giá phiên phỏng vấn.', 'success');
      event.currentTarget.querySelector('button').disabled = true;
    } catch (err) { showToast(`Không gửi được đánh giá: ${err.message}`, 'error'); }
  });

  async function loadStudentCounselorConsents() {
    const list = document.getElementById('student-counselor-consent-list');
    if (!list || ApiClient.getUser()?.role !== 'student') return;
    try {
      const assignments = await ApiClient.listCounselorConsents();
      list.innerHTML = assignments.map(item => `
        <article class="hitl-item"><div><strong>${escapeHtml(item.counselor_name)}</strong><small>${escapeHtml(item.counselor_email)} · ${escapeHtml(item.status)}</small></div>
        ${item.status === 'active' ? `<button class="btn-outline revoke-consent" data-id="${escapeHtml(item.id)}">Thu hồi</button>` : ''}</article>
      `).join('') || '<p class="gap-empty">Bạn chưa cấp quyền cho cố vấn nào.</p>';
      list.querySelectorAll('.revoke-consent').forEach(button => button?.addEventListener('click', async () => {
        await ApiClient.revokeCounselor(button.dataset.id); showToast('Đã thu hồi quyền cố vấn.', 'success'); loadStudentCounselorConsents();
      }));
    } catch (err) { list.innerHTML = `<p class="gap-empty">${escapeHtml(err.message)}</p>`; }
  }

  document.getElementById('student-counselor-consent-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const email = document.getElementById('student-counselor-email').value.trim();
      await ApiClient.grantCounselor(email); event.currentTarget.reset();
      showToast('Đã cấp quyền truy cập cho cố vấn.', 'success'); loadStudentCounselorConsents();
    } catch (err) { showToast(`Không cấp được quyền: ${err.message}`, 'error'); }
  });

  async function loadCounselorDashboard() {
    const list = document.getElementById('counselor-student-list');
    if (!list) return;
    try {
      const [assignments, metrics] = await Promise.all([
        ApiClient.listAssignedStudents(),
        ApiClient.getProductMetrics().catch(() => null),
      ]);
      list.innerHTML = assignments.map(item => `<button class="hitl-item hitl-student" data-id="${escapeHtml(item.student_id)}"><span><strong>${escapeHtml(item.student_name)}</strong><small>${escapeHtml(item.student_email)}</small></span><span>›</span></button>`).join('') || '<p class="gap-empty">Chưa có sinh viên cấp quyền.</p>';
      list.querySelectorAll('.hitl-student').forEach(button => button?.addEventListener('click', () => loadCounselorStudent(button.dataset.id)));
      const kpi = document.getElementById('counselor-kpi-overview');
      if (kpi && metrics) {
        const adoptionMet = Boolean(metrics.adoption_target_met);
        const csatKnown = metrics.average_csat != null;
        const csatMet = metrics.csat_target_met === true;
        kpi.innerHTML = `
          <article class="counselor-kpi-card ${adoptionMet ? 'is-met' : 'is-pending'}"><small>Tỷ lệ sử dụng</small><strong>${Number(metrics.adoption_rate).toFixed(1)}%</strong><span>Mục tiêu ≥ ${Number(metrics.adoption_target || 60).toFixed(0)}% · ${adoptionMet ? 'Đạt' : 'Chưa đạt'}</span></article>
          <article class="counselor-kpi-card ${csatMet ? 'is-met' : 'is-pending'}"><small>CSAT phỏng vấn</small><strong>${csatKnown ? Number(metrics.average_csat).toFixed(1) + '/5' : 'Chưa có'}</strong><span>Mục tiêu ≥ ${Number(metrics.csat_target || 4).toFixed(1)}/5 · ${csatKnown ? (csatMet ? 'Đạt' : 'Chưa đạt') : 'Chờ dữ liệu'}</span></article>
          <article class="counselor-kpi-card"><small>Phiên hoàn thành</small><strong>${Number(metrics.completed_interviews || 0)}</strong><span>Điểm STAR TB ${metrics.average_interview_score != null ? Number(metrics.average_interview_score).toFixed(1) : '—'}</span></article>
        `;
      }
    } catch (err) { list.innerHTML = `<p class="gap-empty">${escapeHtml(err.message)}</p>`; }
  }

  /* ============================================================
     📜 MISSION ARCHIVE & STUDENT HISTORY ENGINE
  ============================================================ */
  let archiveDataCache = { cvs: [], analyses: [], interviews: [], jdMap: new Map(), cvMap: new Map(), acceptedOptimizations: new Map() };
  let currentArchiveFilter = 'all';

  async function loadMissionArchive() {
    const container = document.getElementById('archive-timeline-container');
    if (!container) return;
    if (!ApiClient.isAuthenticated()) {
      container.innerHTML = `<div class="empty-manifest"><p>⚠️ Vui lòng đăng nhập để xem lịch sử nhiệm vụ của bạn</p></div>`;
      return;
    }

    try {
      container.innerHTML = `<p class="loading-text">🌌 Đang truy xuất kho dữ liệu nhiệm vụ...</p>`;
      const [cvs, analyses, interviews, jds] = await Promise.all([
        ApiClient.listCVs().catch(() => []),
        ApiClient.getAnalysisHistory().catch(() => []),
        ApiClient.listInterviews().catch(() => []),
        ApiClient.listJDs().catch(() => []),
      ]);

      const optimizationRows = await Promise.all((analyses || []).map(async analysis => {
        const decisions = await ApiClient.listOptimizationDecisions(analysis.id).catch(() => []);
        return [analysis.id, (decisions || []).filter(decision => decision.accepted)];
      }));
      const jdMap = new Map((jds || []).map(jd => [jd.id, jd.title]));
      const cvMap = new Map((cvs || []).map(cv => [cv.id, cv.title]));
      archiveDataCache = { cvs: cvs || [], analyses: analyses || [], interviews: interviews || [], jdMap, cvMap, acceptedOptimizations: new Map(optimizationRows) };

      renderMissionArchiveCards();
    } catch (err) {
      container.innerHTML = `<div class="empty-manifest"><p style="color:#ef4444;">Không thể tải lịch sử nhiệm vụ: ${escapeHtml(err.message)}</p></div>`;
    }
  }

  function renderMissionArchiveCards() {
    const container = document.getElementById('archive-timeline-container');
    if (!container) return;

    const matchedCount = (archiveDataCache.analyses || []).length;
    const optimizedCount = (archiveDataCache.analyses || []).filter(analysis => (
      (archiveDataCache.acceptedOptimizations.get(analysis.id) || []).length > 0
    )).length;
    const interviewCount = (archiveDataCache.interviews || []).length;
    [['archive-match-count', matchedCount], ['archive-optimized-count', optimizedCount], ['archive-interview-count', interviewCount]]
      .forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
      });
    const getCVSource = (cvId) => {
      const cv = (archiveDataCache.cvs || []).find(item => String(item.id) === String(cvId));
      return cv?.file_path ? 'CV tải lên' : 'CV tạo từ biểu mẫu';
    };

    const items = [];

    // A Match result and an optimized CV are separate, auditable outputs.
    if (currentArchiveFilter === 'all' || currentArchiveFilter === 'match') {
      (archiveDataCache.analyses || []).forEach(analysis => {
        const cvTitle = archiveDataCache.cvMap.get(analysis.cv_id) || 'CV Hồ Sơ';
        const jdTitle = archiveDataCache.jdMap.get(analysis.jd_id) || 'Vị Trí Mục Tiêu';
        const score = Number(analysis.match_score || 0).toFixed(1);
        const cvSource = getCVSource(analysis.cv_id);
        items.push({
          type: 'match',
          date: new Date(analysis.created_at || Date.now()),
          html: `
            <div class="archive-card" data-type="match">
              <div class="archive-card-header">
                <span class="archive-tag tag-cv">CV ĐÃ MATCH VỚI JD</span>
                <span class="archive-time">${new Date(analysis.created_at).toLocaleDateString('vi-VN')}</span>
              </div>
              <h3 class="archive-card-title">${escapeHtml(cvTitle)}</h3>
              <p class="archive-card-sub">So khớp với <strong>${escapeHtml(jdTitle)}</strong> • Điểm phù hợp ${score}%</p>
              <span class="archive-source">${escapeHtml(cvSource)}</span>
              <div class="archive-card-footer">
                <span class="badge badge-ok">MATCH: ${score}%</span>
                <button class="archive-btn-view view-archive-detail-btn" data-type="gap" data-id="${escapeHtml(analysis.id)}">Xem báo cáo</button>
              </div>
            </div>
          `
        });
      });
    }

    if (currentArchiveFilter === 'all' || currentArchiveFilter === 'optimized') {
      (archiveDataCache.analyses || []).forEach(analysis => {
        const acceptedCount = (archiveDataCache.acceptedOptimizations.get(analysis.id) || []).length;
        if (!acceptedCount) return;
        const cvSource = getCVSource(analysis.cv_id);
        const cvTitle = archiveDataCache.cvMap.get(analysis.cv_id) || 'CV Hồ Sơ';
        const jdTitle = archiveDataCache.jdMap.get(analysis.jd_id) || 'Vị Trí Mục Tiêu';
        items.push({
          type: 'optimized',
          date: new Date(analysis.created_at || Date.now()),
          html: `
            <div class="archive-card" data-type="optimized">
              <span class="archive-source">${escapeHtml(cvSource)} · Đã áp dụng đề xuất AI</span>
              <div class="archive-card-header">
                <span class="archive-tag tag-optimized">CV ĐÃ TỐI ƯU</span>
                <span class="archive-time">${new Date(analysis.created_at).toLocaleDateString('vi-VN')}</span>
              </div>
              <h3 class="archive-card-title">${escapeHtml(cvTitle)}</h3>
              <p class="archive-card-sub">Đã áp dụng ${acceptedCount} đề xuất tối ưu cho <strong>${escapeHtml(jdTitle)}</strong>.</p>
              <div class="archive-card-footer">
                <span class="badge badge-ok">ĐÃ ÁP DỤNG</span>
                <button class="archive-btn-view view-archive-detail-btn" data-type="gap" data-id="${escapeHtml(analysis.id)}">Xem tối ưu</button>
              </div>
            </div>
          `,
        });
      });
    }

    // 3. Interview Tests, Results & Scores (Các bài kiểm tra phỏng vấn, kết quả và điểm số)
    if (currentArchiveFilter === 'all' || currentArchiveFilter === 'interview') {
      (archiveDataCache.interviews || []).forEach(session => {
        const jdTitle = archiveDataCache.jdMap.get(session.jd_id) || 'Vị trí phỏng vấn';
        const isCompleted = session.status === 'completed';
        const scoreText = session.total_score != null ? `${Number(session.total_score).toFixed(1)}/100 PTS` : 'Đang thực hiện';

        items.push({
          type: 'interview',
          date: new Date(session.created_at || Date.now()),
          html: `
            <div class="archive-card" data-type="interview">
              <div class="archive-card-header">
                <span class="archive-tag tag-interview">🎙️ PHỎNG VẤN STAR</span>
                <span class="archive-time">${new Date(session.created_at).toLocaleDateString('vi-VN')}</span>
              </div>
              <h3 class="archive-card-title">${escapeHtml(jdTitle)}</h3>
              <p class="archive-card-sub">Rubric STAR Score • Tiến độ ${session.current_question_index}/${session.total_questions} câu hỏi</p>
              <div class="archive-card-footer">
                <span class="badge ${isCompleted ? 'badge-ok' : 'badge-warn'}">${isCompleted ? `PASSED // ${scoreText}` : 'ONGOING'}</span>
                ${isCompleted ? `
                  <button class="archive-btn-view view-archive-detail-btn" data-type="interview" data-id="${escapeHtml(session.id)}">🔍 Xem chi tiết</button>
                ` : `
                  <button class="archive-btn-view resume-interview-btn" data-session-id="${escapeHtml(session.id)}">▶ Tiếp Tục</button>
                `}
              </div>
            </div>
          `
        });
      });
    }

    items.sort((a, b) => b.date - a.date);
    const resultCount = document.getElementById('archive-result-count');
    if (resultCount) resultCount.textContent = `${items.length} kết quả`;

    if (items.length === 0) {
      container.innerHTML = `<div class="empty-manifest"><p>Chưa có dữ liệu nhiệm vụ cho mục này.</p></div>`;
      return;
    }

    container.innerHTML = items.map(item => item.html).join('');
  }

  // Filter Buttons Handler
  document.querySelectorAll('.archive-filter-btn').forEach(btn => {
    btn?.addEventListener('click', () => {
      document.querySelectorAll('.archive-filter-btn').forEach(b => b?.classList.remove('active'));
      btn?.classList.add('active');
      currentArchiveFilter = btn.dataset.filter || 'all';
      renderMissionArchiveCards();
    });
  });

  // Archive Card Event Delegation
  document.getElementById('archive-timeline-container')?.addEventListener('click', async (event) => {
    const cvPdfBtn = event.target.closest('.export-cv-pdf-btn');
    if (cvPdfBtn) {
      const cvId = cvPdfBtn.dataset.cvId;
      try {
        cvPdfBtn.disabled = true;
        const blob = await ApiClient.downloadCV(cvId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CV-${cvId.slice(0, 8)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        showToast(`Không thể tải PDF: ${err.message}`, 'error');
      } finally {
        cvPdfBtn.disabled = false;
      }
      return;
    }

    const resumeBtn = event.target.closest('.resume-interview-btn');
    if (resumeBtn) {
      switchView('interview');
      return;
    }

    const viewCvBtn = event.target.closest('.view-archive-cv-btn');
    if (viewCvBtn) {
      switchView('cv');
      return;
    }

    const detailBtn = event.target.closest('.view-archive-detail-btn');
    if (detailBtn) {
      openMissionDetailView(detailBtn.dataset.type, detailBtn.dataset.id);
      return;
    }
  });

  // ===== Mission Archive Detail view (Việc 4: gộp "Xem Báo Cáo STAR" + "Xuất CV Tối Ưu" thành 1 nút "Xem chi tiết") =====
  // Note: the "Xuất CV Tối Ưu (PDF)" action was intentionally removed from this
  // view (2026-08-13) — the team hasn't finalized the CV PDF template yet, so
  // the export entry point is hidden from the UI until it's ready. The backend
  // ApiClient.downloadCV(cvId, analysisId) endpoint itself is left untouched
  // for reuse once a template is finalized.
  function renderArchiveDetailStarSection(report) {
    const starSection = document.getElementById('archive-detail-star-section');
    const gapSection = document.getElementById('archive-detail-gap-section');
    if (gapSection) gapSection.style.display = 'none';
    if (!starSection) return;

    const title = document.getElementById('archive-detail-title');
    const sub = document.getElementById('archive-detail-sub');
    if (title) title.textContent = '🎙️ Chi Tiết Phỏng Vấn STAR';
    if (sub) sub.textContent = 'Báo cáo chấm điểm đầy đủ theo rubric STAR (huấn luyện, không phán xét).';

    const scoreEl = document.getElementById('archive-detail-star-score');
    if (scoreEl) scoreEl.textContent = `${Number(report.total_score || 0).toFixed(1)} / 100 PTS`;

    const scores = report.star_scores || {};
    const breakdownEl = document.getElementById('archive-detail-star-breakdown');
    if (breakdownEl) {
      breakdownEl.innerHTML = renderStarBadgeGrid(scores, null);
    }

    const strengths = Array.isArray(report.strengths) ? report.strengths : [];
    const improvements = Array.isArray(report.improvements) ? report.improvements : [];
    const recommendations = Array.isArray(report.recommendations) ? report.recommendations : [];
    const strEl = document.getElementById('archive-detail-star-strengths');
    if (strEl) strEl.innerHTML = strengths.map(s => `<li>💪 ${escapeHtml(s)}</li>`).join('') || '<li>Chưa ghi nhận</li>';
    const impEl = document.getElementById('archive-detail-star-improvements');
    if (impEl) impEl.innerHTML = improvements.map(i => `<li>🛠️ ${escapeHtml(i)}</li>`).join('') || '<li>Chưa ghi nhận</li>';
    const recEl = document.getElementById('archive-detail-star-recommendations');
    if (recEl) recEl.innerHTML = recommendations.map(r => `<li>🚀 ${escapeHtml(r)}</li>`).join('') || '<li>Chưa ghi nhận</li>';

    starSection.style.display = 'block';
  }

  function renderArchiveDetailGapSection(analysis) {
    const starSection = document.getElementById('archive-detail-star-section');
    const gapSection = document.getElementById('archive-detail-gap-section');
    if (starSection) starSection.style.display = 'none';
    if (!gapSection) return;

    const title = document.getElementById('archive-detail-title');
    const sub = document.getElementById('archive-detail-sub');
    if (title) title.textContent = '🎯 Chi Tiết Gap Analysis & CV Đã Tối Ưu';
    if (sub) sub.textContent = 'Đề xuất chỉnh sửa CV vẫn cần bạn Accept/Reject — không tự áp dụng.';

    const cvTitle = archiveDataCache.cvMap.get(analysis.cv_id) || 'CV Hồ Sơ';
    const jdTitle = archiveDataCache.jdMap.get(analysis.jd_id) || 'Vị Trí Mục Tiêu';
    const contextEl = document.getElementById('archive-detail-gap-context');
    if (contextEl) contextEl.textContent = `${cvTitle}  ↔  ${jdTitle}`;

    const scoreEl = document.getElementById('archive-detail-gap-score');
    if (scoreEl) scoreEl.textContent = `${Number(analysis.match_score || 0).toFixed(1)}%`;

    const matched = Array.isArray(analysis.hard_skills_matching) ? analysis.hard_skills_matching : [];
    const partial = Array.isArray(analysis.hard_skills_partial) ? analysis.hard_skills_partial : [];
    const missingRaw = Array.isArray(analysis.hard_skills_missing) ? analysis.hard_skills_missing : [];
    const missing = missingRaw.filter(skill => !partial.includes(skill));
    const renderSkills = (items, variant) => items.length
      ? items.map(item => `<span class="cv-result-tag ${variant}">${escapeHtml(item)}</span>`).join('')
      : '<span class="cv-result-empty">Không có dữ liệu.</span>';
    const matchedEl = document.getElementById('archive-detail-gap-matched');
    if (matchedEl) matchedEl.innerHTML = renderSkills(matched, 'matched');
    const missingEl = document.getElementById('archive-detail-gap-missing');
    if (missingEl) missingEl.innerHTML = renderSkills(missing, 'missing');

    const priorityActions = Array.isArray(analysis.priority_actions) ? analysis.priority_actions : [];
    const actionsEl = document.getElementById('archive-detail-gap-actions');
    if (actionsEl) {
      actionsEl.innerHTML = priorityActions.length
        ? priorityActions.slice(0, 6).map((item, index) => {
          const itemTitle = typeof item === 'string' ? item : (item.gap || item.action || `Ưu tiên ${index + 1}`);
          const detail = typeof item === 'string' ? '' : (item.action || item.why_it_matters || '');
          return `<article class="cv-result-action"><span>${escapeHtml(item.priority || index + 1)}</span><div><strong>${escapeHtml(itemTitle)}</strong>${detail && detail !== itemTitle ? `<p>${escapeHtml(detail)}</p>` : ''}</div></article>`;
        }).join('')
        : '<p class="cv-result-empty">Chưa phát hiện khoảng trống ưu tiên.</p>';
    }

    const suggestions = Array.isArray(analysis.suggestions) ? analysis.suggestions : [];
    const suggEl = document.getElementById('archive-detail-gap-suggestions');
    if (suggEl) {
      suggEl.innerHTML = suggestions.length
        ? suggestions.slice(0, 6).map((item, index) => `
          <article class="cv-result-action learning"><span>${index + 1}</span><div><small>Gốc: ${escapeHtml(item.original_text)}</small><strong>${escapeHtml(item.suggested_improvement)}</strong><p>${escapeHtml(item.reason)}</p></div></article>
        `).join('')
        : '<p class="cv-result-empty">Không có câu viết lại đủ bằng chứng.</p>';
    }

    gapSection.style.display = 'block';
  }

  async function openMissionDetailView(type, id) {
    if (type === 'interview') {
      try {
        showToast('Đang tải báo cáo STAR...', 'info');
        const report = await ApiClient.getInterviewReport(id);
        renderArchiveDetailStarSection(report);
        switchView('archive-detail');
      } catch (err) {
        showToast(`Không thể xem báo cáo phỏng vấn: ${err.message}`, 'error');
      }
      return;
    }
    if (type === 'gap') {
      const analysis = (archiveDataCache.analyses || []).find(item => String(item.id) === String(id));
      if (!analysis) {
        showToast('Không tìm thấy dữ liệu phân tích này. Vui lòng tải lại trang Lịch sử.', 'error');
        return;
      }
      renderArchiveDetailGapSection(analysis);
      switchView('archive-detail');
    }
  }

  document.getElementById('btn-archive-detail-back')?.addEventListener('click', () => switchView('history'));

  // Modal display for STAR interview report
  async function openStarReportModal(sessionId) {
    try {
      showToast('Đang tải báo cáo STAR...', 'info');
      const report = await ApiClient.getInterviewReport(sessionId);
      
      const strengths = (report.strengths || []).map(s => `<li>💪 ${escapeHtml(s)}</li>`).join('') || '<li>Chưa ghi nhận</li>';
      const improvements = (report.improvements || []).map(i => `<li>🛠️ ${escapeHtml(i)}</li>`).join('') || '<li>Chưa ghi nhận</li>';
      const recommendations = (report.recommendations || []).map(r => `<li>🚀 ${escapeHtml(r)}</li>`).join('') || '<li>Chưa ghi nhận</li>';
      
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.style.display = 'flex';
      modal.style.zIndex = '99999';
      modal.innerHTML = `
        <div class="archive-modal-content">
          <div class="archive-modal-header">
            <h3>📊 Báo Cáo Chấm Điểm Phỏng Vấn (STAR Rubric)</h3>
            <button class="archive-modal-close" type="button">&times;</button>
          </div>
          <div style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.05);padding:12px;border-radius:10px;">
            <span>Điểm Tổng Kết Rubric STAR:</span>
            <strong style="font-size:22px;color:#00e5ff;">${Number(report.total_score).toFixed(1)} / 100 PTS</strong>
          </div>
          <div style="margin-bottom:14px;">
            <p style="color:#4ade80;font-weight:600;margin-bottom:6px;">Điểm Mạnh:</p>
            <ul style="padding-left:20px;margin:0;color:#cbd5e1;">${strengths}</ul>
          </div>
          <div style="margin-bottom:14px;">
            <p style="color:#fb923c;font-weight:600;margin-bottom:6px;">Cần Cải Thiện:</p>
            <ul style="padding-left:20px;margin:0;color:#cbd5e1;">${improvements}</ul>
          </div>
          <div style="margin-bottom:14px;">
            <p style="color:#c084fc;font-weight:600;margin-bottom:6px;">Khuyên Luyện Tập:</p>
            <ul style="padding-left:20px;margin:0;color:#cbd5e1;">${recommendations}</ul>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('.archive-modal-close')?.addEventListener('click', () => modal.remove());
      modal?.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    } catch (err) {
      showToast(`Không thể xem báo cáo phỏng vấn: ${err.message}`, 'error');
    }
  }

  async function loadCounselorStudent(studentId) {
    const detail = document.getElementById('counselor-student-detail');
    const form = document.getElementById('counselor-feedback-form');
    try {
      const data = await ApiClient.getStudentOverview(studentId);
      
      const cvsHtml = (data.cvs || []).map(cv => `
        <div class="student-item-card">
          <div class="student-item-info">
            <strong>📄 ${escapeHtml(cv.title || 'CV Hồ sơ')}</strong>
            <small>Tạo ngày: ${new Date(cv.created_at).toLocaleDateString('vi-VN')}</small>
          </div>
          <span class="badge badge-ok">Standard ATS</span>
        </div>
      `).join('') || '<p class="gap-empty">Sinh viên chưa tạo CV.</p>';

      const analysesHtml = (data.analyses || []).map(analysis => `
        <div class="student-item-card">
          <div class="student-item-info">
            <strong>✨ Gap Analysis Match: ${Number(analysis.match_score).toFixed(1)}%</strong>
            <small>Đề xuất cải thiện: ${(analysis.suggestions || []).length} gợi ý</small>
          </div>
          <span class="badge badge-ok" style="background:rgba(124,77,255,0.2);color:#b388ff;">Match ${Number(analysis.match_score).toFixed(1)}%</span>
        </div>
      `).join('');

      const interviewsHtml = (data.interviews || []).map(session => `
        <div class="student-item-card">
          <div class="student-item-info">
            <strong>🎙️ Phỏng Vấn STAR (${session.status === 'completed' ? 'Hoàn thành' : 'Đang làm'})</strong>
            <small>Điểm tổng kết: ${session.total_score != null ? Number(session.total_score).toFixed(1) + '/100 PTS' : 'N/A'}</small>
          </div>
          ${session.status === 'completed' ? `<button class="btn-outline view-student-star-report" data-session-id="${escapeHtml(session.id)}" style="padding:3px 8px;font-size:11px;">Xem Báo Cáo</button>` : '<span class="badge badge-warn">Ongoing</span>'}
        </div>
      `).join('') || '<p class="gap-empty">Chưa làm bài phỏng vấn thử.</p>';

      detail.innerHTML = `
        <h3>${escapeHtml(data.student.full_name)} <small style="font-size:13px;color:#94a3b8;">(${escapeHtml(data.student.email)})</small></h3>
        <div class="hitl-stats">
          <span>${data.cv_count}<small>CV</small></span>
          <span>${data.analysis_count}<small>Gap</small></span>
          <span>${data.completed_interview_count}<small>STAR</small></span>
          <span>${data.average_star_score}<small>Điểm TB</small></span>
        </div>

        <section class="counselor-progress-summary" aria-label="Tiến bộ phỏng vấn và CSAT">
          <div><small>Lần đầu</small><strong>${data.first_interview_score != null ? Number(data.first_interview_score).toFixed(1) : '—'}</strong><span>/100 STAR</span></div>
          <div><small>Gần nhất</small><strong>${data.latest_interview_score != null ? Number(data.latest_interview_score).toFixed(1) : '—'}</strong><span>/100 STAR</span></div>
          <div class="${Number(data.interview_score_delta || 0) >= 0 ? 'is-positive' : 'is-negative'}"><small>Thay đổi</small><strong>${data.interview_score_delta != null ? `${Number(data.interview_score_delta) >= 0 ? '+' : ''}${Number(data.interview_score_delta).toFixed(1)}` : '—'}</strong><span>điểm trước/sau</span></div>
          <div><small>CSAT sinh viên</small><strong>${data.average_csat != null ? Number(data.average_csat).toFixed(1) : '—'}</strong><span>/5</span></div>
        </section>

        <div class="student-progress-block">
          <h4>📄 Danh Sách CV Của Sinh Viên</h4>
          <div class="student-items-list">${cvsHtml}</div>
        </div>

        <div class="student-progress-block">
          <h4>✨ Các CV Đã Tối Ưu &amp; Gap Match</h4>
          <div class="student-items-list">${analysesHtml}</div>
        </div>

        <div class="student-progress-block">
          <h4>🎙️ Bài Kiểm Tra Phỏng Vấn &amp; Điểm Số</h4>
          <div class="student-items-list">${interviewsHtml}</div>
        </div>

        <h4 style="margin-top:16px;">Phản hồi gần đây từ Cố Vấn</h4>
        ${(data.recent_feedback || []).map(item => `<article class="feedback-item"><strong>${escapeHtml(item.kind)}</strong><p>${escapeHtml(item.content)}</p></article>`).join('') || '<p class="gap-empty">Chưa có phản hồi.</p>'}
      `;

      detail.querySelectorAll('.view-student-star-report').forEach(btn => {
        btn?.addEventListener('click', () => openStarReportModal(btn.dataset.sessionId));
      });

      document.getElementById('counselor-feedback-student-id').value = studentId;
      form.hidden = false;
    } catch (err) {
      detail.innerHTML = `<p class="gap-empty">${escapeHtml(err.message)}</p>`;
      form.hidden = true;
    }
  }

  document.getElementById('counselor-feedback-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const studentId = document.getElementById('counselor-feedback-student-id').value;
    try {
      await ApiClient.sendCounselorFeedback(studentId, document.getElementById('counselor-feedback-content').value.trim(), document.getElementById('counselor-feedback-kind').value);
      event.currentTarget.reset(); document.getElementById('counselor-feedback-student-id').value = studentId;
      showToast('Đã gửi phản hồi cho sinh viên.', 'success'); loadCounselorStudent(studentId);
    } catch (err) { showToast(err.message, 'error'); }
  });

  async function loadEnterpriseDashboard() {
    const list = document.getElementById('enterprise-jd-list');
    if (!list) return;
    try {
      const jds = await ApiClient.listEnterpriseJDs();
      list.innerHTML = jds.map(jd => `<article class="hitl-item"><div><strong>${escapeHtml(jd.title)}</strong><small>${jd.is_published ? 'Đã công bố' : 'Bản nháp'}</small></div><div>${!jd.is_published ? `<button class="btn-outline publish-jd" data-id="${escapeHtml(jd.id)}">Công bố</button>` : ''}<button class="btn-primary view-candidates" data-id="${escapeHtml(jd.id)}">Ứng viên</button></div></article>`).join('') || '<p class="gap-empty">Hãy tạo JD trong Thư viện Jobs.</p>';
      list.querySelectorAll('.publish-jd').forEach(button => button?.addEventListener('click', async () => { await ApiClient.publishJD(button.dataset.id); showToast('Đã công bố JD.', 'success'); loadEnterpriseDashboard(); }));
      list.querySelectorAll('.view-candidates').forEach(button => button?.addEventListener('click', () => loadEnterpriseCandidates(button.dataset.id)));
    } catch (err) { list.innerHTML = `<p class="gap-empty">${escapeHtml(err.message)}</p>`; }
  }

  async function loadEnterpriseCandidates(jdId) {
    const list = document.getElementById('enterprise-candidate-list');
    try {
      const candidates = await ApiClient.listCandidates(jdId);
      list.innerHTML = candidates.map(item => `<article class="candidate-card"><div><strong>${escapeHtml(item.candidate_name)}</strong><small>${escapeHtml(item.candidate_email)}</small></div><b>${Number(item.match_score).toFixed(1)}%</b><button class="btn-outline view-shared-cv" data-id="${escapeHtml(item.id)}">Xem CV đã chia sẻ</button><select class="form-input candidate-decision" data-id="${escapeHtml(item.id)}"><option value="submitted" ${item.status === 'submitted' ? 'selected' : ''}>Đã nộp</option><option value="shortlisted" ${item.status === 'shortlisted' ? 'selected' : ''}>Shortlist</option><option value="interview" ${item.status === 'interview' ? 'selected' : ''}>Mời phỏng vấn</option><option value="rejected" ${item.status === 'rejected' ? 'selected' : ''}>Từ chối</option></select></article>`).join('') || '<p class="gap-empty">Chưa có ứng viên chủ động chia sẻ CV.</p>';
      list.querySelectorAll('.view-shared-cv').forEach(button => button?.addEventListener('click', async () => {
        const detail = document.getElementById('enterprise-candidate-cv');
        try {
          const cv = await ApiClient.getCandidateCV(button.dataset.id);
          const parsed = cv.parsed_json || {};
          detail.hidden = false;
          detail.innerHTML = `<h3>${escapeHtml(cv.title)}</h3><p>${escapeHtml(parsed.summary || '')}</p><h4>Kỹ năng</h4><p>${escapeHtml((parsed.skills || []).join(', '))}</p><h4>Nội dung CV đã chia sẻ</h4><pre>${escapeHtml(cv.raw_text || '')}</pre>`;
        } catch (err) { showToast(err.message, 'error'); }
      }));
      list.querySelectorAll('.candidate-decision').forEach(select => select?.addEventListener('change', async () => { await ApiClient.decideCandidate(select.dataset.id, select.value); showToast('Đã cập nhật quyết định.', 'success'); }));
    } catch (err) { list.innerHTML = `<p class="gap-empty">${escapeHtml(err.message)}</p>`; }
  }

  /* ============================================================
     🔐 AUTH & USER STATE MANAGEMENT
  ============================================================ */
  const authContainer = document.getElementById('auth-container');
  const userNameEl = document.getElementById('user-name');
  const userRoleEl = document.getElementById('user-role-display');

  function applyRoleAccess(user) {
    document.body.classList.remove('role-student', 'role-counselor', 'role-enterprise', 'role-admin');
    if (user?.role) document.body.classList.add(`role-${user.role}`);
    const roleKey = ROLE_NAV_ITEMS[user?.role] ? user.role : 'guest';
    const visibleNavItems = new Set(ROLE_NAV_ITEMS[roleKey]);
    ALL_ROLE_NAV_IDS.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.hidden = !visibleNavItems.has(id);
        if (element.hidden) {
          element.style.setProperty('display', 'none', 'important');
        } else {
          element.style.removeProperty('display');
        }
      }
    });
    const isAdmin = user?.role === 'admin';
    const adminNav = document.getElementById('nav-admin');
    if (adminNav) {
      adminNav.hidden = !isAdmin;
      adminNav?.classList.toggle('visible', isAdmin);
    }
    const consentPanel = document.getElementById('student-counselor-consent-panel');
    if (consentPanel) consentPanel.hidden = user?.role !== 'student';
    const jobsNavText = document.querySelector('#nav-jobs .nav-text');
    if (jobsNavText) jobsNavText.textContent = 'Thư viện Jobs';

    const jobsTitle = document.querySelector('#view-jobs .page-title');
    const jobsSubtitle = document.querySelector('#view-jobs .page-sub');
    if (jobsTitle) {
      jobsTitle.textContent = '💼 Thư Viện Job Descriptions & Bản Đồ Điều Hướng';
    }
    if (jobsSubtitle) {
      jobsSubtitle.textContent = 'Khám phá các vị trí mục tiêu, phân tích quỹ đạo phù hợp & quản lý JD doanh nghiệp';
    }

    const companion = document.getElementById('ai-companion');
    const companionPanel = document.getElementById('ai-companion-chat');
    if (companion && (!companionPanel || companionPanel.hidden)) companion.hidden = false;
  }

  function resetUIAfterLogout() {
    document.querySelectorAll('form').forEach(form => form.reset());
    document.querySelectorAll('input, textarea').forEach(field => {
      if (field.type === 'checkbox' || field.type === 'radio') field.checked = false;
      else field.value = '';
    });
    document.querySelectorAll('select').forEach(select => {
      select.selectedIndex = 0;
    });
    document.querySelectorAll('.modal-overlay.open').forEach(modal => modal?.classList.remove('open'));
    const selectedFileBadge = document.getElementById('selected-file-name');
    if (selectedFileBadge) {
      selectedFileBadge.textContent = '';
      selectedFileBadge.style.display = 'none';
    }
    document.getElementById('cv-detail-inspector')?.style.setProperty('display', 'none');
    document.getElementById('page-interview-chat')?.style.setProperty('display', 'none');
    document.getElementById('page-interview-report')?.style.setProperty('display', 'none');
    document.getElementById('page-interview-setup')?.style.setProperty('display', 'block');
    [
      'spaceship-cv-list',
      'cv-list-container',
      'page-jd-list-container',
      'page-interview-chat-history',
      'admin-ai-log-list',
      'inspector-personal-info',
      'inspector-skills-cloud',
      'inspector-soft-skills-cloud',
      'inspector-raw-preview',
      'inspector-evidence-records',
      'inspector-missing-info',
    ].forEach(id => {
      const container = document.getElementById(id);
      if (container) container.innerHTML = '';
    });
    localStorage.removeItem('crew_target_role');
    adminAILogsLoaded = false;
    window.dispatchEvent(new Event('career:session-cleared'));
  }

  async function performLogout({ notify = true } = {}) {
    await ApiClient.logout();
    resetUIAfterLogout();
    if (notify) showToast('Đã đăng xuất tài khoản', 'info');
    checkUserSession();
    switchView('dashboard');
  }

  function updateDashboardGaugeScores(matchScore, starScore) {
    const gaugeCvLabel = document.getElementById('gauge-cv-label');
    const gaugeInterviewLabel = document.getElementById('gauge-interview-label');
    if (gaugeCvLabel && Number.isFinite(matchScore)) {
      gaugeCvLabel.textContent = `Match Score (${Math.round(matchScore)}%)`;
    }
    if (gaugeInterviewLabel && Number.isFinite(starScore)) {
      gaugeInterviewLabel.textContent = `STAR Score (${Math.round(starScore)}/100)`;
    }
  }

  async function refreshDashboardOverview() {
    if (!ApiClient.isAuthenticated()) return;
    const user = ApiClient.getUser();
    if (!user || user.role !== 'student') return;
    try {
      const [analyses, interviews] = await Promise.all([
        ApiClient.getAnalysisHistory().catch(() => []),
        ApiClient.listInterviews().catch(() => []),
      ]);
      const latestAnalysis = Array.isArray(analyses) ? analyses[0] : null;
      const latestInterview = Array.isArray(interviews)
        ? interviews.find(session => session.total_score !== null && session.total_score !== undefined && Number.isFinite(Number(session.total_score)))
        : null;
      updateDashboardGaugeScores(
        latestAnalysis ? Number(latestAnalysis.match_score) : NaN,
        latestInterview ? Number(latestInterview.total_score) : NaN,
      );
    } catch (err) {
      console.error('[refreshDashboardOverview] Không thể tải dữ liệu tổng quan Dashboard:', err);
    }
  }

  function checkUserSession() {
    const user = ApiClient.getUser();
    const navAdmin = document.getElementById('nav-admin');

    if (user) {
      applyRoleAccess(user);
      if (userNameEl) userNameEl.textContent = user.full_name || user.email;
      if (userRoleEl) userRoleEl.textContent = `Vai trò: ${user.role.toUpperCase()}`;
      const roleHomeView = getRoleHomeView(user);
      if (currentViewName !== roleHomeView) switchView(roleHomeView);
      refreshDashboardOverview();
      if (navAdmin) {
        if (user.role === 'admin') {
          navAdmin?.classList.add('visible');
        } else {
          navAdmin?.classList.remove('visible');
        }
      }
      if (authContainer) {
        authContainer.innerHTML = `
          <div class="candidate-account-menu" id="candidate-account-menu">
            <button class="candidate-avatar-trigger" id="candidate-avatar-trigger" aria-haspopup="true" aria-expanded="false">
              <span class="candidate-avatar-initial">${escapeHtml((user.full_name || user.email || 'N').trim().charAt(0).toUpperCase())}</span>
              <span class="candidate-avatar-chevron">⌄</span>
            </button>
            <div class="candidate-account-dropdown" id="candidate-account-dropdown">
              <button type="button" data-account-action="profile">Hồ sơ cá nhân</button>
              <button type="button" data-account-action="settings">Cài đặt</button>
              <div class="candidate-account-divider"></div>
              <button type="button" class="candidate-logout" id="btn-logout">Đăng xuất</button>
            </div>
          </div>
        `;
        const accountMenu = document.getElementById('candidate-account-menu');
        const accountTrigger = document.getElementById('candidate-avatar-trigger');
        accountTrigger?.addEventListener('click', () => {
          const open = accountMenu?.classList.toggle('open');
          accountTrigger.setAttribute('aria-expanded', String(Boolean(open)));
        });
        accountMenu?.querySelectorAll('[data-account-action]').forEach(button => button?.addEventListener('click', () => {
          accountMenu?.classList.remove('open');
          switchView('profile');
        }));
        document.getElementById('btn-logout')?.addEventListener('click', () => {
          performLogout();
        });
      }
    } else {
      applyRoleAccess(null);
      if (userNameEl) userNameEl.textContent = 'Chưa đăng nhập';
      if (userRoleEl) userRoleEl.textContent = 'Hệ thống Trợ Lý Nghề Nghiệp X';
      if (navAdmin) navAdmin?.classList.remove('visible');
      if (authContainer) {
        authContainer.innerHTML = `<button class="btn-login" id="btn-login">Đăng nhập</button>`;
        document.getElementById('btn-login')?.addEventListener('click', openAuthModal);
      }
    }
  }

  /* ============================================================
     👑 ADMIN MANAGEMENT PORTAL LOGIC
  ============================================================ */
  let adminUsersData = [];
  let adminAILogsLoaded = false;

  function activateAdminTab(tabName) {
    const isLogs = tabName === 'ai-logs';
    const usersTab = document.getElementById('admin-tab-users');
    const logsTab = document.getElementById('admin-tab-ai-logs');
    const usersPanel = document.getElementById('admin-users-panel');
    const logsPanel = document.getElementById('admin-ai-logs-panel');
    usersTab?.classList.toggle('is-active', !isLogs);
    logsTab?.classList.toggle('is-active', isLogs);
    usersTab?.setAttribute('aria-selected', String(!isLogs));
    logsTab?.setAttribute('aria-selected', String(isLogs));
    if (usersPanel) usersPanel.hidden = isLogs;
    if (logsPanel) logsPanel.hidden = !isLogs;
    if (isLogs && !adminAILogsLoaded) loadAdminAILogs();
  }

  function updateAILogStats(stats) {
    const mappings = {
      'ai-log-stat-total': stats.total_requests,
      'ai-log-stat-success': stats.successful_requests,
      'ai-log-stat-failed': stats.failed_requests,
      'ai-log-stat-users': stats.unique_users,
    };
    Object.entries(mappings).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value ?? 0;
    });
  }

  document.getElementById('page-download-optimized-cv')?.addEventListener('click', async () => {
    if (!currentGapResult) return;
    try {
      const template = document.getElementById('page-export-template')?.value || 'classic';
      const blob = await ApiClient.downloadCV(currentGapResult.cv_id, currentGapResult.id, template);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `optimized-cv-${template}.pdf`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) { showToast(`❌ ${err.message}`, 'error'); }
  });

  function renderAdminAILogs(logs) {
    const list = document.getElementById('admin-ai-log-list');
    if (!list) return;
    if (!logs.length) {
      list.innerHTML = '<div class="ai-log-empty">Không có AI log phù hợp với bộ lọc.</div>';
      return;
    }
    list.innerHTML = logs.map(log => {
      const timestamp = log.created_at
        ? new Date(log.created_at).toLocaleString('vi-VN')
        : 'Không rõ thời gian';
      const tools = (log.tools_used || []).map(tool => `<span>${escapeHtml(tool)}</span>`).join('');
      const statusLabel = log.llm_succeeded ? 'Thành công' : 'Lỗi';
      return `
        <article class="ai-log-card">
          <div class="ai-log-card-head">
            <div>
              <strong>${escapeHtml(log.user_full_name || 'User')}</strong>
              <span>${escapeHtml(log.user_email || '')}</span>
            </div>
            <span class="ai-log-status ${log.llm_succeeded ? 'is-success' : 'is-error'}">${statusLabel}</span>
          </div>
          <div class="ai-log-meta">
            <span>${escapeHtml(timestamp)}</span>
            <span>${escapeHtml(log.provider)} · ${escapeHtml(log.model)}</span>
            <span>${Number(log.latency_ms || 0)} ms</span>
            <span>Trang: ${escapeHtml(log.current_page || 'unknown')}</span>
          </div>
          <div class="ai-log-content">
            <div><span class="ai-log-label">PROMPT USER</span><p>${escapeHtml(log.prompt)}</p></div>
            <details>
              <summary>Xem phản hồi của Nova</summary>
              <p>${escapeHtml(log.response)}</p>
            </details>
          </div>
          ${tools ? `<div class="ai-log-tools"><b>Tools:</b>${tools}</div>` : ''}
          ${log.error_code ? `<div class="ai-log-error">Error: ${escapeHtml(log.error_code)}</div>` : ''}
        </article>
      `;
    }).join('');
  }

  async function loadAdminAILogs() {
    const list = document.getElementById('admin-ai-log-list');
    const search = document.getElementById('admin-ai-log-search')?.value.trim() || '';
    const success = document.getElementById('admin-ai-log-status')?.value ?? '';
    if (list) list.innerHTML = '<div class="ai-log-empty">⏳ Đang tải nhật ký AI…</div>';
    try {
      const [logs, stats] = await Promise.all([
        ApiClient.listAILogs(search, success),
        ApiClient.getAILogStats(),
      ]);
      renderAdminAILogs(logs.items || []);
      updateAILogStats(stats);
      adminAILogsLoaded = true;
    } catch (err) {
      if (list) list.innerHTML = `<div class="ai-log-empty is-error">Không thể tải AI log: ${escapeHtml(err.message)}</div>`;
      showToast(`Lỗi tải AI log: ${err.message}`, 'error');
    }
  }

  async function loadAdminUsersList() {
    const tbody = document.getElementById('admin-users-tbody');
    const user = ApiClient.getUser();

    if (!user || user.role !== 'admin') {
      showToast('❌ Bạn không có quyền truy cập Trang Quản Trị Admin', 'error');
      switchView('dashboard');
      return;
    }

    if (tbody) {
      tbody.innerHTML = `<tr><td colSpan="5" style="text-align:center;padding:30px;">⏳ Đang tải danh sách người dùng từ Server...</td></tr>`;
    }

    try {
      adminUsersData = await ApiClient.listAllUsers();
      renderAdminUsersTable(adminUsersData);
      updateAdminStats(adminUsersData);
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colSpan="5" style="text-align:center;padding:30px;color:#ff4e6a;">❌ Không thể tải danh sách user: ${err.message}</td></tr>`;
      }
      showToast(`Lỗi tải danh sách người dùng: ${err.message}`, 'error');
    }
  }

  function updateAdminStats(users) {
    const totalEl = document.getElementById('admin-stat-total');
    const adminEl = document.getElementById('admin-stat-admin');
    const studentEl = document.getElementById('admin-stat-student');
    const enterpriseEl = document.getElementById('admin-stat-enterprise');

    if (totalEl) totalEl.textContent = users.length;
    if (adminEl) adminEl.textContent = users.filter(u => u.role === 'admin').length;
    if (studentEl) studentEl.textContent = users.filter(u => u.role === 'student').length;
    if (enterpriseEl) enterpriseEl.textContent = users.filter(u => u.role === 'enterprise' || u.role === 'counselor').length;
  }

  function renderAdminUsersTable(users) {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    if (!users || users.length === 0) {
      tbody.innerHTML = `<tr><td colSpan="5" style="text-align:center;padding:30px;">Không tìm thấy người dùng nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const createdDate = u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : '---';
      let roleClass = 'role-student';
      if (u.role === 'admin') roleClass = 'role-admin';
      else if (u.role === 'counselor') roleClass = 'role-counselor';
      else if (u.role === 'enterprise') roleClass = 'role-enterprise';

      return `
        <tr>
          <td><strong>${escapeHtml(u.full_name || 'Chưa đặt tên')}</strong></td>
          <td>${escapeHtml(u.email)}</td>
          <td><span class="role-badge ${roleClass}">${escapeHtml(u.role)}</span></td>
          <td>${createdDate}</td>
          <td style="text-align:center;">
            <button class="btn-action-sm btn-edit-user" data-user-id="${escapeHtml(u.id)}">✏️ Sửa</button>
            ${u.role === 'admin' ? '<span class="admin-locked-label">🔒 Admin duy nhất</span>' : `<button class="btn-action-sm btn-delete-user" data-user-id="${escapeHtml(u.id)}">🗑️ Xóa</button>`}
          </td>
        </tr>
      `;
    }).join('');

    // Attach edit and delete button events
    tbody.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn?.addEventListener('click', () => {
        const uId = btn.getAttribute('data-user-id');
        const targetUser = adminUsersData.find(x => x.id === uId);
        if (targetUser) openAdminUserModal('edit', targetUser);
      });
    });

    tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn?.addEventListener('click', () => {
        const uId = btn.getAttribute('data-user-id');
        const targetUser = adminUsersData.find(x => x.id === uId);
        if (targetUser) deleteAdminUser(targetUser);
      });
    });
  }

  // Admin Search filter
  document.getElementById('admin-user-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderAdminUsersTable(adminUsersData);
    } else {
      const filtered = adminUsersData.filter(u => 
        (u.full_name && u.full_name.toLowerCase().includes(q)) || 
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q))
      );
      renderAdminUsersTable(filtered);
    }
  });

  document.getElementById('admin-tab-users')?.addEventListener('click', () => activateAdminTab('users'));
  document.getElementById('admin-tab-ai-logs')?.addEventListener('click', () => activateAdminTab('ai-logs'));
  document.getElementById('btn-refresh-ai-logs')?.addEventListener('click', loadAdminAILogs);
  document.getElementById('admin-ai-log-status')?.addEventListener('change', loadAdminAILogs);
  let aiLogSearchTimer = null;
  document.getElementById('admin-ai-log-search')?.addEventListener('input', () => {
    window.clearTimeout(aiLogSearchTimer);
    aiLogSearchTimer = window.setTimeout(loadAdminAILogs, 350);
  });

  // Admin User Modal Logic
  const adminUserModal = document.getElementById('modal-admin-user-overlay');
  const adminUserForm = document.getElementById('admin-user-form');
  const btnAdminAddUser = document.getElementById('btn-admin-add-user');
  const btnAdminCloseUser = document.getElementById('modal-admin-user-close');

  if (btnAdminAddUser) {
    btnAdminAddUser?.addEventListener('click', () => openAdminUserModal('add'));
  }

  if (btnAdminCloseUser) {
    btnAdminCloseUser?.addEventListener('click', () => closeAdminUserModal());
  }

  // Update modal header icon for edit mode
  function updateAdminModalIcon(mode) {
    const avatarEl = document.getElementById('admin-modal-avatar-icon');
    if (!avatarEl) return;
    if (mode === 'edit') {
      avatarEl.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    } else {
      avatarEl.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`;
    }
  }

  function openAdminUserModal(mode = 'add', user = null) {
    if (!adminUserModal) return;
    const titleEl = document.getElementById('admin-user-modal-title');
    const subEl = document.getElementById('admin-user-modal-sub');
    const pwdLabel = document.getElementById('admin-label-password');

    const editIdInput = document.getElementById('admin-edit-user-id');
    const fullnameInput = document.getElementById('admin-input-fullname');
    const emailInput = document.getElementById('admin-input-email');
    const roleInput = document.getElementById('admin-input-role');
    const pwdInput = document.getElementById('admin-input-password');
    const managedRoleOptions = `
      <option value="student">Sinh viên (Student)</option>
      <option value="counselor">Cố vấn (Counselor)</option>
      <option value="enterprise">Doanh nghiệp (Enterprise)</option>`;

    if (mode === 'edit' && user) {
      if (titleEl) titleEl.textContent = 'Chỉnh Sửa Người Dùng';
      if (subEl) subEl.textContent = `Cập nhật thông tin và vai trò cho ${user.email}`;
      if (pwdLabel) pwdLabel.textContent = 'Mật khẩu mới (Để trống nếu không đổi)';
      if (editIdInput) editIdInput.value = user.id;
      if (fullnameInput) fullnameInput.value = user.full_name || '';
      if (emailInput) emailInput.value = user.email || '';
      if (roleInput) {
        roleInput.innerHTML = user.role === 'admin'
          ? '<option value="admin">Quản trị viên hệ thống duy nhất</option>'
          : managedRoleOptions;
        roleInput.value = user.role || 'student';
        roleInput.disabled = user.role === 'admin';
      }
      if (pwdInput) pwdInput.value = '';
      updateAdminModalIcon('edit');
    } else {
      if (titleEl) titleEl.textContent = 'Thêm Người Dùng Mới';
      if (subEl) subEl.textContent = 'Tạo tài khoản mới với vai trò Student, Counselor hoặc Enterprise';
      if (pwdLabel) pwdLabel.textContent = 'Mật khẩu (Tối thiểu 6 ký tự)';
      if (editIdInput) editIdInput.value = '';
      if (fullnameInput) fullnameInput.value = '';
      if (emailInput) emailInput.value = '';
      if (roleInput) {
        roleInput.innerHTML = managedRoleOptions;
        roleInput.value = 'student';
        roleInput.disabled = false;
      }
      if (pwdInput) pwdInput.value = '';
      updateAdminModalIcon('add');
    }

    adminUserModal?.classList.add('open');
  }

  function closeAdminUserModal() {
    if (adminUserModal) adminUserModal?.classList.remove('open');
  }

  // Close admin modal when clicking overlay background
  if (adminUserModal) {
    adminUserModal?.addEventListener('click', (e) => {
      if (e.target === adminUserModal) closeAdminUserModal();
    });
  }


  if (adminUserForm) {
    adminUserForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const uId = document.getElementById('admin-edit-user-id')?.value;
      const fullName = document.getElementById('admin-input-fullname')?.value.trim();
      const email = document.getElementById('admin-input-email')?.value.trim();
      const role = document.getElementById('admin-input-role')?.value;
      const pwd = document.getElementById('admin-input-password')?.value.trim();

      try {
        if (uId) {
          // Edit mode
          const targetUser = adminUsersData.find(user => user.id === uId);
          const payload = { full_name: fullName, email: email };
          if (targetUser?.role !== 'admin') payload.role = role;
          if (pwd && pwd.length >= 6) payload.password = pwd;

          await ApiClient.updateUserByAdmin(uId, payload);
          showToast('✅ Cập nhật thông tin người dùng thành công!', 'success');
        } else {
          // Add mode
          if (!pwd || pwd.length < 6) {
            showToast('Mật khẩu tối thiểu 6 ký tự', 'warning');
            return;
          }
          await ApiClient.createUserByAdmin(email, pwd, fullName, role);
          showToast('✅ Thêm người dùng mới thành công!', 'success');
        }
        closeAdminUserModal();
        loadAdminUsersList();
      } catch (err) {
        showToast(`❌ Thao tác thất bại: ${err.message}`, 'error');
      }
    });
  }

  // ── Custom Delete Confirmation Modal ──
  const deleteConfirmOverlay = document.getElementById('modal-delete-confirm-overlay');
  const deleteConfirmTitle = document.getElementById('delete-confirm-title');
  const deleteConfirmDesc = document.getElementById('delete-confirm-desc');
  const deleteConfirmWarning = document.getElementById('delete-confirm-warning');
  const deleteConfirmCancel = document.getElementById('delete-confirm-cancel');
  const deleteConfirmOk = document.getElementById('delete-confirm-ok');
  let pendingDeleteResolve = null;

  function showDeleteConfirm({ title, description, confirmLabel, warning }) {
    return new Promise((resolve) => {
      pendingDeleteResolve = resolve;
      if (deleteConfirmTitle) deleteConfirmTitle.textContent = title;
      if (deleteConfirmDesc) deleteConfirmDesc.innerHTML = description;
      if (deleteConfirmWarning) deleteConfirmWarning.textContent = warning;
      if (deleteConfirmOk) deleteConfirmOk.textContent = confirmLabel;
      if (deleteConfirmOverlay) deleteConfirmOverlay?.classList.add('open');
    });
  }

  function closeDeleteConfirm(result) {
    if (deleteConfirmOverlay) deleteConfirmOverlay?.classList.remove('open');
    if (pendingDeleteResolve) {
      pendingDeleteResolve(result);
      pendingDeleteResolve = null;
    }
  }

  if (deleteConfirmCancel) {
    deleteConfirmCancel?.addEventListener('click', () => closeDeleteConfirm(false));
  }
  if (deleteConfirmOk) {
    deleteConfirmOk?.addEventListener('click', () => closeDeleteConfirm(true));
  }
  if (deleteConfirmOverlay) {
    deleteConfirmOverlay?.addEventListener('click', (e) => {
      if (e.target === deleteConfirmOverlay) closeDeleteConfirm(false);
    });
  }

  async function deleteAdminUser(user) {
    const currentUser = ApiClient.getUser();
    if (currentUser && currentUser.id === user.id) {
      showToast('❌ Không thể tự xóa tài khoản Admin đang đăng nhập', 'error');
      return;
    }

    const confirmed = await showDeleteConfirm({
      title: 'Xác Nhận Xóa Người Dùng',
      description: `Bạn có chắc chắn muốn xóa người dùng <strong style="color:#fff;">"${escapeHtml(user.full_name || 'Không tên')}"</strong> <span style="color:rgba(255,255,255,0.5);">(${escapeHtml(user.email)})</span>?`,
      confirmLabel: 'Xóa Người Dùng',
      warning: '⚠️ Thao tác này không thể hoàn tác.',
    });
    if (!confirmed) return;

    try {
      await ApiClient.deleteUserByAdmin(user.id);
      showToast(`🗑️ Đã xóa người dùng ${user.email} thành công`, 'success');
      loadAdminUsersList();
    } catch (err) {
      showToast(`❌ Lỗi xóa người dùng: ${err.message}`, 'error');
    }
  }

  // Khôi phục phiên từ cookie HttpOnly; dữ liệu user trong localStorage chỉ là cache hiển thị.
  ApiClient.getMe().then(() => checkUserSession()).catch(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    checkUserSession();
  });

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
  const forgotPasswordButton = document.getElementById('btn-forgot-password');
  const passwordResetOverlay = document.getElementById('password-reset-overlay');
  const passwordResetCloseButton = document.getElementById('password-reset-close');
  const passwordResetForm = document.getElementById('password-reset-form');
  const resetStep1 = document.getElementById('reset-step-1');
  const resetStep2 = document.getElementById('reset-step-2');
  const resetStep3 = document.getElementById('reset-step-3');
  const btnResetStep1 = document.getElementById('btn-reset-step-1');
  const btnResetStep2 = document.getElementById('btn-reset-step-2');
  const btnResetStep3 = document.getElementById('btn-reset-step-3');
  const passwordResetBack1 = document.getElementById('btn-password-reset-back');
  const passwordResetBack2 = document.getElementById('btn-password-reset-back-2');
  const resetStep2Sub = document.getElementById('reset-step-2-sub');
  const passwordResetTimer = document.getElementById('password-reset-timer');
  const googleButtonHost = document.getElementById('google-signin-button');
  const googleAuthHelp = document.getElementById('google-auth-help');

  let isRegisterMode = false;
  let currentResetStep = 1;
  let resetCountdownInterval = null;
  let googleIdentityInitialized = false;

  function openAuthModal() {
    if (authOverlay) authOverlay?.classList.add('open');
    renderGoogleSignInButton();
  }
  function closeAuthModal() {
    if (authOverlay) authOverlay?.classList.remove('open');
    document.getElementById('auth-role-select')?.classList.remove('is-open');
  }
  if (authClose) authClose?.addEventListener('click', closeAuthModal);

  function setAuthMode(register) {
    if (forgotPasswordButton) forgotPasswordButton.hidden = register;
    isRegisterMode = register;

    if (register) {
      tabRegister?.classList.add('active'); if (tabRegister) tabRegister.style.color = '#fff';
      tabLogin?.classList.remove('active'); if (tabLogin) tabLogin.style.color = 'var(--text-dim)';
      tabRegister?.setAttribute('aria-selected', 'true');
      tabLogin?.setAttribute('aria-selected', 'false');
      if (fullnameGroup) fullnameGroup.style.display = 'block';
      if (roleGroup) roleGroup.style.display = 'block';
      if (authTitle) authTitle.textContent = 'Tạo tài khoản mới';
      if (authSub) authSub.textContent = 'Tham gia CV Assistant để tối ưu CV & phỏng vấn';
      if (btnSubmitLabel) btnSubmitLabel.textContent = 'Đăng ký tài khoản';
    } else {
      tabLogin?.classList.add('active'); if (tabLogin) tabLogin.style.color = '#fff';
      tabRegister?.classList.remove('active'); if (tabRegister) tabRegister.style.color = 'var(--text-dim)';
      tabLogin?.setAttribute('aria-selected', 'true');
      tabRegister?.setAttribute('aria-selected', 'false');
      if (fullnameGroup) fullnameGroup.style.display = 'none';
      if (roleGroup) roleGroup.style.display = 'none';
      if (authTitle) authTitle.textContent = 'Chào mừng trở lại';
      if (authSub) authSub.textContent = 'Đăng nhập để tiếp tục hành trình phát triển sự nghiệp cùng AI';
      if (btnSubmitLabel) btnSubmitLabel.textContent = 'Đăng nhập';
    }
    if (authOverlay?.classList.contains('open')) renderGoogleSignInButton();
  }

  if (tabLogin) tabLogin?.addEventListener('click', () => setAuthMode(false));
  if (tabRegister) tabRegister?.addEventListener('click', () => setAuthMode(true));

  function updateResetSteps() {
    if (resetStep1) resetStep1.hidden = (currentResetStep !== 1);
    if (resetStep2) resetStep2.hidden = (currentResetStep !== 2);
    if (resetStep3) resetStep3.hidden = (currentResetStep !== 3);
  }

  function setPasswordResetMode(enabled) {
    if (!passwordResetForm || !passwordResetOverlay) return;
    passwordResetOverlay?.classList.toggle('open', enabled);
    if (enabled) {
      closeAuthModal();
      currentResetStep = 1;
      updateResetSteps();
      document.getElementById('reset-email')?.focus();
      return;
    }
    passwordResetForm.reset();
    clearInterval(resetCountdownInterval);
  }

  forgotPasswordButton?.addEventListener('click', () => setPasswordResetMode(true));
  passwordResetBack1?.addEventListener('click', () => {
    setPasswordResetMode(false);
    setAuthMode(false);
    openAuthModal();
  });
  passwordResetBack2?.addEventListener('click', () => {
    currentResetStep = 1;
    updateResetSteps();
  });
  passwordResetCloseButton?.addEventListener('click', () => setPasswordResetMode(false));

  passwordResetForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = document.getElementById('reset-email')?.value.trim();
    if (!email) return;

    if (currentResetStep === 1) {
      try {
        if (btnResetStep1) btnResetStep1.disabled = true;
        await ApiClient.requestPasswordReset(email);
        if (btnResetStep1) btnResetStep1.disabled = false;
        
        currentResetStep = 2;
        updateResetSteps();
        
        if (resetStep2Sub) resetStep2Sub.textContent = `Mã 6 số đã được gửi đến ${email}.`;
        
        if (passwordResetTimer) {
          passwordResetTimer.hidden = false;
          let secondsLeft = 600; // 10 minutes
          passwordResetTimer.textContent = `Mã hết hạn trong: 10:00`;
          clearInterval(resetCountdownInterval);
          resetCountdownInterval = setInterval(() => {
            secondsLeft--;
            if (secondsLeft <= 0) {
              clearInterval(resetCountdownInterval);
              passwordResetTimer.textContent = 'Mã OTP đã hết hạn.';
              if (btnResetStep2) btnResetStep2.disabled = true;
            } else {
              const m = Math.floor(secondsLeft / 60);
              const s = secondsLeft % 60;
              passwordResetTimer.textContent = `Mã hết hạn trong: ${m}:${s.toString().padStart(2, '0')}`;
            }
          }, 1000);
        }
        
        showToast('Kiểm tra hộp thư Gmail để lấy mã OTP.', 'success');
        document.getElementById('reset-otp')?.focus();
      } catch (err) {
        if (btnResetStep1) btnResetStep1.disabled = false;
        showToast(`❌ ${err.message}`, 'error');
      }
      return;
    }

    if (currentResetStep === 2) {
      const otp = document.getElementById('reset-otp')?.value.trim();
      if (!/^\d{6}$/.test(otp || '')) {
        showToast('Vui lòng nhập mã OTP gồm 6 số.', 'error');
        return;
      }
      currentResetStep = 3;
      updateResetSteps();
      document.getElementById('reset-new-password')?.focus();
      return;
    }

    if (currentResetStep === 3) {
      const otp = document.getElementById('reset-otp')?.value.trim();
      const newPassword = document.getElementById('reset-new-password')?.value;
      const confirmPassword = document.getElementById('reset-confirm-password')?.value;
      
      if (!newPassword || newPassword.length < 8) {
        showToast('Mật khẩu mới phải có ít nhất 8 ký tự.', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast('Mật khẩu xác nhận không khớp.', 'error');
        return;
      }
      
      try {
        if (btnResetStep3) btnResetStep3.disabled = true;
        const result = await ApiClient.confirmPasswordReset(email, otp, newPassword);
        showToast(result.message || 'Đặt lại mật khẩu thành công.', 'success');
        setPasswordResetMode(false);
        setAuthMode(false);
        openAuthModal();
        document.getElementById('input-email').value = email;
        document.getElementById('input-password')?.focus();
        if (btnResetStep3) btnResetStep3.disabled = false;
      } catch (err) {
        if (btnResetStep3) btnResetStep3.disabled = false;
        showToast(`❌ ${err.message}`, 'error');
        if (err.message.toLowerCase().includes('otp') || err.message.toLowerCase().includes('mã')) {
          currentResetStep = 2;
          updateResetSteps();
          document.getElementById('reset-otp')?.focus();
        }
      }
    }
  });

  function enhanceAuthRoleSelect() {
    const select = document.getElementById('input-role');
    const shell = document.getElementById('auth-role-select');
    if (!select || !shell) return;

    let trigger = shell.querySelector('.auth-role-trigger');
    let menu = shell.querySelector('.auth-role-menu');
    if (!trigger || !menu) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'auth-role-trigger';
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', 'auth-role-menu');
      trigger.innerHTML = '<span class="auth-role-current"></span><span class="auth-role-chevron" aria-hidden="true"></span>';
      menu = document.createElement('div');
      menu.id = 'auth-role-menu';
      menu.className = 'auth-role-menu';
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-label', 'Danh sách vai trò');
      shell.append(trigger, menu);

      trigger?.addEventListener('click', () => {
        const shouldOpen = !shell?.classList.contains('is-open');
        shell?.classList.toggle('is-open', shouldOpen);
        trigger.setAttribute('aria-expanded', String(shouldOpen));
        if (shouldOpen) menu.querySelector('[aria-selected="true"]')?.focus();
      });
      menu?.addEventListener('keydown', event => {
        const items = [...menu.querySelectorAll('.auth-role-option')];
        const currentIndex = items.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          event.preventDefault();
          shell?.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
          trigger.focus();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const offset = event.key === 'ArrowDown' ? 1 : -1;
          items[(currentIndex + offset + items.length) % items.length]?.focus();
        }
      });
    }

    const parseLabel = label => {
      const match = label.match(/^(.*?)\s*\((.*?)\)$/);
      return { title: match?.[1] || label, meta: match?.[2] || '' };
    };
    const selectedOption = select.options[select.selectedIndex] || select.options[0];
    const selectedLabel = parseLabel(selectedOption?.textContent || 'Chọn vai trò');
    trigger.querySelector('.auth-role-current').innerHTML = `<strong>${escapeHtml(selectedLabel.title)}</strong>${selectedLabel.meta ? `<small>${escapeHtml(selectedLabel.meta)}</small>` : ''}`;
    menu.innerHTML = [...select.options].map(option => {
      const label = parseLabel(option.textContent);
      const selected = option.value === select.value;
      return `<button type="button" class="auth-role-option${selected ? ' is-selected' : ''}" role="option" data-value="${escapeHtml(option.value)}" aria-selected="${selected}">
        <span class="auth-role-option-copy"><strong>${escapeHtml(label.title)}</strong><small>${escapeHtml(label.meta)}</small></span>
        <span class="auth-role-check" aria-hidden="true">✓</span>
      </button>`;
    }).join('');
    menu.querySelectorAll('.auth-role-option').forEach(item => item?.addEventListener('click', () => {
      select.value = item.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      enhanceAuthRoleSelect();
      shell?.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    }));
  }

  enhanceAuthRoleSelect();
  document.addEventListener('click', event => {
    const shell = document.getElementById('auth-role-select');
    if (shell && !event.target.closest('#auth-role-select')) {
      shell?.classList.remove('is-open');
      shell.querySelector('.auth-role-trigger')?.setAttribute('aria-expanded', 'false');
    }
  });

  async function loadGoogleIdentityServices() {
    if (window.google?.accounts?.id) return;
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-identity]');
      if (existing) existing.remove();
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = 'true';
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        reject(new Error('Google Identity Services không tải được.'));
      };
      document.head.appendChild(script);
    });
  }

  async function handleGoogleCredential(response) {
    if (!response?.credential) {
      showToast('Google không trả về thông tin đăng nhập.', 'error');
      return;
    }
    try {
      const role = isRegisterMode ? document.getElementById('input-role')?.value || 'student' : 'student';
      await ApiClient.googleAuth(response.credential, role);
      closeAuthModal();
      checkUserSession();
      showToast('✅ Google đã xác minh và đăng nhập thành công!', 'success');
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    }
  }

  // Nút do Google render nhận click trực tiếp, tránh popup bị chặn do mở bằng script.
  async function renderGoogleSignInButton() {
    if (!googleButtonHost) return;
    const clientId = googleButtonHost.dataset.clientId;
    if (!clientId) {
      googleButtonHost.innerHTML = '<span class="google-auth-loading">Google OAuth chưa được cấu hình.</span>';
      return;
    }
    googleButtonHost.setAttribute('aria-busy', 'true');
    googleButtonHost.innerHTML = '<span class="google-auth-loading">Đang tải nút Google…</span>';
    if (googleAuthHelp) googleAuthHelp.hidden = true;
    try {
      await loadGoogleIdentityServices();
      if (!googleIdentityInitialized) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredential,
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
          itp_support: true,
        });
        googleIdentityInitialized = true;
      }
      googleButtonHost.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonHost, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: isRegisterMode ? 'signup_with' : 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: Math.min(Math.max((googleButtonHost.clientWidth || 360) - 12, 240), 360),
        locale: 'vi',
      });
      googleButtonHost.removeAttribute('aria-busy');
    } catch (_err) {
      googleButtonHost.removeAttribute('aria-busy');
      googleButtonHost.innerHTML = '<button type="button" class="google-auth-retry">Tải lại nút Google</button>';
      googleButtonHost.querySelector('.google-auth-retry')?.addEventListener('click', renderGoogleSignInButton);
      if (googleAuthHelp) {
        googleAuthHelp.hidden = false;
        googleAuthHelp.textContent = 'Không tải được Google. Hãy tắt tiện ích chặn theo dõi cho trang này hoặc dùng Email.';
      }
    }
  }

  if (loginForm) {
    loginForm?.addEventListener('submit', async (e) => {
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
    if (!ApiClient.isAuthenticated()) {
      showToast('⚠️ Vui lòng đăng nhập trước khi tải CV', 'warning');
      openAuthModal();
      return;
    }
    if (cvOverlay) cvOverlay?.classList.add('open');
    loadCVList();
  }
  function closeCVModal() { if (cvOverlay) cvOverlay?.classList.remove('open'); }
  if (cvClose) cvClose?.addEventListener('click', closeCVModal);

  document.getElementById('icon-cv-btn')?.addEventListener('click', openCVModal);

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
    cvForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('cv-file-input');
      const titleInput = document.getElementById('cv-title-input');
      if (!fileInput.files[0]) {
        showToast('Vui lòng chọn CV dạng PDF, DOCX, JPG, JPEG hoặc PNG', 'warning');
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
  const uploadJdForm = document.getElementById('upload-jd-form');
  const uploadJdFile = document.getElementById('upload-jd-file');

  document.getElementById('download-jd-template')?.addEventListener('click', downloadJDTemplate);
  bindJDFileName(uploadJdFile, document.getElementById('upload-jd-file-name'));

  function openJDModal() {
    if (!ApiClient.isAuthenticated()) {
      showToast('⚠️ Vui lòng đăng nhập trước khi xem thư viện Jobs', 'warning');
      openAuthModal();
      return;
    }
    if (jdOverlay) jdOverlay?.classList.add('open');
    loadJDList();
  }
  function closeJDModal() { if (jdOverlay) jdOverlay?.classList.remove('open'); }
  if (jdClose) jdClose?.addEventListener('click', closeJDModal);

  document.getElementById('icon-location-btn')?.addEventListener('click', openJDModal);

  if (btnTabSysJd) {
    btnTabSysJd?.addEventListener('click', () => {
      btnTabSysJd?.classList.add('active'); btnTabCustJd?.classList.remove('active');
      if (secSysJd) secSysJd.style.display = 'block';
      if (secCustJd) secCustJd.style.display = 'none';
    });
  }
  if (btnTabCustJd) {
    btnTabCustJd?.addEventListener('click', () => {
      btnTabCustJd?.classList.add('active'); btnTabSysJd?.classList.remove('active');
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
    customJdForm?.addEventListener('submit', async (e) => {
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

  if (uploadJdForm) {
    uploadJdForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = uploadJdFile?.files?.[0];
      if (!file) {
        showToast('Vui lòng chọn file JD dạng PDF, DOCX, TXT hoặc ảnh.', 'warning');
        return;
      }
      const submitButton = uploadJdForm.querySelector('button[type="submit"]');
      try {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang trích xuất nội dung JD...';
        await ApiClient.uploadJD(
          file,
          document.getElementById('upload-jd-title').value.trim(),
          document.getElementById('upload-jd-company').value.trim(),
          document.getElementById('upload-jd-location').value.trim(),
        );
        showToast('🎉 Đã tải lên và lưu Job Description!', 'success');
        uploadJdForm.reset();
        document.getElementById('upload-jd-file-name').textContent = 'PDF, DOCX, TXT hoặc ảnh';
        btnTabSysJd?.click();
        await loadJDList();
      } catch (err) {
        showToast(`❌ Lỗi tải JD: ${err.message}`, 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Tải lên & lưu JD';
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
    if (!ApiClient.isAuthenticated()) {
      showToast('⚠️ Vui lòng đăng nhập trước khi chạy Gap Analysis', 'warning');
      openAuthModal();
      return;
    }
    if (gapOverlay) gapOverlay?.classList.add('open');
    populateGapOptions();
  }
  function closeGapModal() { if (gapOverlay) gapOverlay?.classList.remove('open'); }
  if (gapClose) gapClose?.addEventListener('click', closeGapModal);

  document.getElementById('icon-search-btn')?.addEventListener('click', openGapModal);

  async function populateGapOptions() {
    if (!selectGapCv || !selectGapJd) return;
    try {
      const [cvs, jds] = await Promise.all([ApiClient.listCVs(), ApiClient.listJDs()]);
      selectGapCv.innerHTML = buildGapCvOptions(cvs);
      selectGapJd.innerHTML = buildGapJdOptions(jds);
      enhanceGapSelect(selectGapCv);
      enhanceGapSelect(selectGapJd);
    } catch (err) {
      showToast(`Không thể tải dữ liệu CV/JD: ${err.message}`, 'error');
    }
  }

  if (btnRunGap) {
    btnRunGap?.addEventListener('click', async () => {
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
    if (!ApiClient.isAuthenticated()) {
      showToast('⚠️ Vui lòng đăng nhập trước khi bắt đầu phỏng vấn thử', 'warning');
      openAuthModal();
      return;
    }
    if (intOverlay) intOverlay?.classList.add('open');
    populateInterviewOptions();
  }
  function closeInterviewModal() { if (intOverlay) intOverlay?.classList.remove('open'); }
  if (intClose) intClose?.addEventListener('click', closeInterviewModal);

  document.getElementById('icon-megaphone-btn')?.addEventListener('click', openInterviewModal);

  async function populateInterviewOptions() {
    if (!selectIntCv || !selectIntJd) return;
    try {
      const [cvs, jds] = await Promise.all([ApiClient.listCVs(), ApiClient.listJDs()]);
      selectIntCv.innerHTML = cvs.length > 0
        ? cvs.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title || 'CV chưa đặt tên')}</option>`).join('')
        : `<option value="">(Bắt buộc upload 1 CV trước)</option>`;

      selectIntJd.innerHTML = jds.length > 0
        ? jds.map(j => `<option value="${escapeHtml(j.id)}">${escapeHtml(j.title || 'JD chưa đặt tên')} • ${escapeHtml(j.company || 'Chưa ghi công ty')}</option>`).join('')
        : `<option value="">(Bắt buộc chọn 1 JD trước)</option>`;
      enhanceGapSelect(selectIntCv);
      enhanceGapSelect(selectIntJd);
    } catch (err) {
      showToast(`Lỗi lấy dữ liệu CV/JD: ${err.message}`, 'error');
    }
  }

  if (btnStartInt) {
    btnStartInt?.addEventListener('click', async () => {
      const cvId = selectIntCv?.value;
      const jdId = selectIntJd?.value;
      if (!cvId || !jdId) {
        showToast('Bắt buộc phải chọn đủ 1 CV và 1 JD mới được bắt đầu phỏng vấn', 'warning');
        return;
      }

      try {
        showToast('⏳ AI đang tạo bộ câu hỏi phỏng vấn thử...', 'info');
        const sessionData = await ApiClient.startInterview(cvId, jdId, 5, { language: 'bilingual', mode: 'text' });

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
    answerForm?.addEventListener('submit', async (e) => {
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
      // Update the dashboard gauge immediately with the score we already have
      // from this report response, instead of relying solely on a re-fetch of
      // the interviews list (which can race with the backend write of total_score).
      updateDashboardGaugeScores(NaN, Number(report.total_score));
      refreshDashboardOverview();

      const scores = report.star_scores || {};
      const starBrkEl = document.getElementById('report-star-breakdown');
      if (starBrkEl) {
        starBrkEl.innerHTML = renderStarBadgeGrid(scores, 80);
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

  /* ============================================================
     🧑‍🚀 NOVA — FIXED GEMINI CAREER CHATBOT
  ============================================================ */
  function initAICompanion() {
    const companion = document.getElementById('ai-companion');
    const avatar = document.getElementById('ai-companion-avatar');
    const sourceImage = document.getElementById('ai-companion-source');
    const spriteCanvas = document.getElementById('ai-companion-canvas');
    const hint = document.getElementById('ai-companion-hint');
    const panel = document.getElementById('ai-companion-chat');
    const closeButton = document.getElementById('ai-companion-close');
    const historyButton = document.getElementById('ai-companion-history');
    const newChatButton = document.getElementById('ai-companion-new-chat');
    const historyPanel = document.getElementById('ai-companion-history-panel');
    const historyList = document.getElementById('ai-companion-history-list');
    const statusText = document.getElementById('ai-companion-status-text');
    const messagesElement = document.getElementById('ai-companion-messages');
    const form = document.getElementById('ai-companion-form');
    const input = document.getElementById('ai-companion-input');
    const sendButton = document.getElementById('ai-companion-send');
    if (!companion || !avatar || !panel || !messagesElement || !form || !input) return;

    let isOpen = false;
    let conversationHistory = [];
    let currentConversationId = null;
    let historyOpen = false;

    function getAssistantUnavailableMessage() {
      return 'Nova đang tạm thời chưa sẵn sàng. Bạn có thể thử lại sau hoặc tiếp tục dùng các công cụ Match CV, tối ưu CV và luyện phỏng vấn trong ứng dụng.';
    }

    function resetConversation() {
      currentConversationId = null;
      conversationHistory = [];
      messagesElement.innerHTML = '';
      appendChatMessage(
        'assistant',
        'Chào bạn! Mình có thể hỗ trợ CV, Gap Analysis và luyện phỏng vấn STAR. Bạn muốn bắt đầu từ đâu?'
      );
      setHistoryOpen(false);
      input.focus();
    }

    function setHistoryOpen(open) {
      historyOpen = Boolean(open);
      if (historyPanel) historyPanel.hidden = !historyOpen;
      historyButton?.setAttribute('aria-expanded', String(historyOpen));
      panel?.classList.toggle('history-open', historyOpen);
    }

    function formatConversationDate(value) {
      if (!value) return '';
      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value));
    }

    function renderConversationHistory(conversations) {
      if (!historyList) return;
      historyList.innerHTML = '';
      if (!conversations.length) {
        const empty = document.createElement('div');
        empty.className = 'ai-chat-history-empty';
        empty.textContent = 'Chưa có lịch sử. Hãy bắt đầu cuộc trò chuyện đầu tiên với Nova.';
        historyList.appendChild(empty);
        return;
      }
      conversations.forEach(conversation => {
        const row = document.createElement('div');
        row.className = `ai-chat-history-item${conversation.id === currentConversationId ? ' is-active' : ''}`;

        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.className = 'ai-chat-history-open';
        openButton.dataset.conversationId = conversation.id;
        const title = document.createElement('strong');
        title.textContent = conversation.title || 'Cuộc trò chuyện với Nova';
        const meta = document.createElement('span');
        meta.textContent = `${conversation.message_count} tin nhắn · ${formatConversationDate(conversation.updated_at)}`;
        openButton.append(title, meta);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'ai-chat-history-delete';
        deleteButton.dataset.deleteConversationId = conversation.id;
        deleteButton.setAttribute('aria-label', `Xóa ${conversation.title || 'cuộc hội thoại'}`);
        deleteButton.textContent = '×';
        row.append(openButton, deleteButton);
        historyList.appendChild(row);
      });
    }

    async function loadConversationHistory() {
      if (!historyList) return;
      if (!ApiClient.isAuthenticated()) {
        historyList.innerHTML = '<div class="ai-chat-history-empty">Đăng nhập để xem lịch sử hội thoại.</div>';
        return;
      }
      historyList.innerHTML = '<div class="ai-chat-history-empty">Đang tải lịch sử…</div>';
      try {
        renderConversationHistory(await ApiClient.listAssistantConversations());
      } catch (err) {
        historyList.innerHTML = `<div class="ai-chat-history-empty">Không thể tải lịch sử: ${escapeHtml(err.message)}</div>`;
      }
    }

    async function openSavedConversation(conversationId) {
      const conversation = await ApiClient.getAssistantConversation(conversationId);
      currentConversationId = conversation.id;
      conversationHistory = conversation.messages
        .map(message => ({ role: message.role, content: message.content }))
        .slice(-12);
      messagesElement.innerHTML = '';
      conversation.messages.forEach(message => {
        appendChatMessage(message.role, message.content, message.suggested_actions || []);
      });
      setHistoryOpen(false);
      input.focus();
    }

    function restoreCompanionPosition() {
      localStorage.removeItem('nova_companion_position');
      companion.style.removeProperty('left');
      companion.style.removeProperty('top');
      companion.style.removeProperty('right');
      companion.style.removeProperty('bottom');
    }

    function placeChatPanel() {
      if (!isOpen) return;
      const edge = window.innerWidth < 560 ? 10 : 24;
      panel.style.left = 'auto';
      panel.style.top = 'auto';
      panel.style.right = `${edge}px`;
      panel.style.bottom = `${edge}px`;
    }

    function toggleChat(forceOpen) {
      isOpen = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;
      panel.hidden = !isOpen;
      panel.setAttribute('aria-hidden', String(!isOpen));
      avatar.setAttribute('aria-expanded', String(isOpen));
      companion?.classList.toggle('chat-open', isOpen);
      hint?.classList.add('is-hidden');
      companion.hidden = isOpen;
      if (isOpen) {
        requestAnimationFrame(() => {
          placeChatPanel();
          input.focus();
        });
      }
    }

    function appendChatMessage(role, text, actions = []) {
      const message = document.createElement('div');
      message.className = `ai-chat-message ${role}`;
      const name = document.createElement('span');
      name.className = 'ai-chat-message-name';
      name.textContent = role === 'assistant' ? 'Nova' : 'Bạn';
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      message.append(name, paragraph);

      if (role === 'assistant' && actions.length) {
        const actionList = document.createElement('div');
        actionList.className = 'ai-chat-actions';
        actions.forEach(action => {
          if (action.action_type === 'evidence') {
            const details = document.createElement('details');
            details.className = 'ai-chat-evidence';
            const summary = document.createElement('summary');
            summary.textContent = action.label || 'Nguồn và bằng chứng';
            details.appendChild(summary);
            (action.sources || []).forEach(source => {
              const item = document.createElement('div');
              item.className = 'ai-chat-source';
              const title = document.createElement('strong');
              title.textContent = source.title || source.source_type;
              const meta = document.createElement('small');
              const provenanceLabels = {
                user_data: 'Dữ liệu người dùng',
                verified_analysis: 'Phân tích đã kiểm chứng',
                system_data: 'Dữ liệu hệ thống',
                recommendation: 'Khuyến nghị tương lai',
              };
              meta.textContent = `${provenanceLabels[source.provenance] || source.provenance || 'Nguồn'}${source.updated_at ? ` · ${formatConversationDate(source.updated_at)}` : ''}`;
              item.append(title, meta);
              if (source.quote) {
                const quote = document.createElement('blockquote');
                quote.textContent = source.quote;
                item.appendChild(quote);
              }
              details.appendChild(item);
            });
            actionList.appendChild(details);
            return;
          }
          if (['run_gap_analysis', 'start_interview'].includes(action.action_type)) {
            const card = document.createElement('div');
            card.className = 'ai-chat-operation';
            card.dataset.actionType = action.action_type;
            const cvSelect = document.createElement('select');
            cvSelect.dataset.resourceType = 'cv';
            cvSelect.setAttribute('aria-label', 'Chọn CV cho Nova');
            const jdSelect = document.createElement('select');
            jdSelect.dataset.resourceType = 'jd';
            jdSelect.setAttribute('aria-label', 'Chọn JD cho Nova');
            const fillOptions = (select, placeholder, options) => {
              const initial = document.createElement('option');
              initial.value = '';
              initial.textContent = placeholder;
              select.appendChild(initial);
              (options || []).forEach(option => {
                const element = document.createElement('option');
                element.value = option.id;
                element.textContent = `${option.label}${option.meta ? ` · ${option.meta}` : ''}`;
                select.appendChild(element);
              });
            };
            fillOptions(cvSelect, 'Chọn CV…', action.options?.cvs);
            fillOptions(jdSelect, 'Chọn JD…', action.options?.jds);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'ai-chat-operation-confirm';
            button.textContent = action.label;
            card.append(cvSelect, jdSelect, button);
            actionList.appendChild(card);
            return;
          }
          const targetPage = action.page === 'gap' ? 'cv' : action.page;
          if (!ALL_VIEWS.includes(targetPage)) return;
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.assistantTarget = targetPage;
          button.textContent = action.label;
          actionList.appendChild(button);
        });
        message.appendChild(actionList);
      }
      messagesElement.appendChild(message);
      messagesElement.scrollTop = messagesElement.scrollHeight;
      return message;
    }

    async function submitAssistantRequest(text, operation = null) {
      const previousHistory = conversationHistory.slice(-10);
      appendChatMessage('user', text);
      conversationHistory.push({ role: 'user', content: text });
      if (sendButton) sendButton.disabled = true;
      const typing = appendTypingIndicator();
      try {
        const result = await ApiClient.chatWithAssistant(
          text,
          previousHistory,
          currentViewName,
          currentConversationId,
          operation
        );
        typing.remove();
        currentConversationId = result.conversation_id;
        const response = result.llm_succeeded
          ? result.response
          : getAssistantUnavailableMessage();
        appendChatMessage('assistant', response, result.llm_succeeded ? (result.suggested_actions || []) : []);
        conversationHistory.push({ role: 'assistant', content: response });
        companion.classList.toggle('is-online', Boolean(result.llm_succeeded));
        if (statusText) {
          statusText.textContent = result.llm_succeeded
            ? 'Đang sẵn sàng hỗ trợ'
            : 'Dịch vụ AI tạm thời chưa sẵn sàng';
        }
        return result;
      } catch (err) {
        typing.remove();
        if (err.status === 401) {
          performLogout({ notify: false });
          appendChatMessage('assistant', 'Phiên đăng nhập đã hết hạn. Bạn hãy đăng nhập lại.');
          openAuthModal();
          return null;
        }
        const message = err.status === 404
          ? 'Nova hoặc dữ liệu bạn chọn hiện chưa sẵn sàng. Hãy thử lại sau.'
          : 'Nova chưa thể hoàn tất yêu cầu này. Hãy thử lại sau.';
        appendChatMessage('assistant', message);
        return null;
      } finally {
        if (sendButton) sendButton.disabled = false;
        input.focus();
      }
    }

    function appendTypingIndicator() {
      const message = document.createElement('div');
      message.className = 'ai-chat-message assistant';
      message.dataset.typing = 'true';
      message.innerHTML = '<span class="ai-chat-message-name">Nova</span><span class="ai-chat-typing"><i></i><i></i><i></i></span>';
      messagesElement.appendChild(message);
      messagesElement.scrollTop = messagesElement.scrollHeight;
      return message;
    }

    async function loadAssistantStatus() {
      try {
        const status = await ApiClient.getAssistantStatus();
        companion?.classList.toggle('is-online', Boolean(status.configured));
        if (statusText) {
          statusText.textContent = status.configured
            ? 'Đang sẵn sàng hỗ trợ'
            : 'Dịch vụ AI tạm thời chưa sẵn sàng';
        }
      } catch (_err) {
        companion?.classList.remove('is-online');
        if (statusText) statusText.textContent = 'Dịch vụ AI tạm thời chưa sẵn sàng';
      }
    }

    avatar?.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      toggleChat(true);
      event.preventDefault();
    });

    avatar?.addEventListener('click', event => {
      if (event.detail === 0) toggleChat(true);
    });
    closeButton?.addEventListener('click', () => toggleChat(false));
    historyButton?.addEventListener('click', async () => {
      setHistoryOpen(!historyOpen);
      if (historyOpen) await loadConversationHistory();
    });
    newChatButton?.addEventListener('click', resetConversation);

    historyList?.addEventListener('click', async event => {
      const deleteButton = event.target.closest('[data-delete-conversation-id]');
      if (deleteButton) {
        const conversationId = deleteButton.dataset.deleteConversationId;
        if (!window.confirm('Xóa cuộc hội thoại này? AI audit log dành cho Admin vẫn được giữ lại.')) return;
        try {
          await ApiClient.deleteAssistantConversation(conversationId);
          if (currentConversationId === conversationId) resetConversation();
          await loadConversationHistory();
        } catch (err) {
          showToast(`Không thể xóa hội thoại: ${err.message}`, 'error');
        }
        return;
      }
      const openButton = event.target.closest('[data-conversation-id]');
      if (!openButton) return;
      try {
        await openSavedConversation(openButton.dataset.conversationId);
      } catch (err) {
        showToast(`Không thể mở hội thoại: ${err.message}`, 'error');
      }
    });

    window.addEventListener('career:session-cleared', () => {
      input.value = '';
      input.style.height = 'auto';
      resetConversation();
      toggleChat(false);
    });

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || sendButton?.disabled) return;
      if (!ApiClient.isAuthenticated()) {
        appendChatMessage('assistant', 'Bạn cần đăng nhập để Nova có thể sử dụng hồ sơ và bảo vệ phiên chat.');
        openAuthModal();
        return;
      }

      input.value = '';
      input.style.height = 'auto';
      await submitAssistantRequest(text);
    });

    input?.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 100)}px`;
    });

    panel.addEventListener('click', async event => {
      const promptButton = event.target.closest('[data-assistant-prompt]');
      if (promptButton) {
        input.value = promptButton.dataset.assistantPrompt;
        form.requestSubmit();
        return;
      }
      const operationButton = event.target.closest('.ai-chat-operation-confirm');
      if (operationButton) {
        const card = operationButton.closest('.ai-chat-operation');
        const cvSelect = card?.querySelector('[data-resource-type="cv"]');
        const jdSelect = card?.querySelector('[data-resource-type="jd"]');
        const cvId = cvSelect?.value;
        const jdId = jdSelect?.value;
        if (!cvId || !jdId) {
          showToast('Vui lòng chọn cả CV và JD.', 'warning');
          return;
        }
        const cvLabel = cvSelect.options[cvSelect.selectedIndex]?.textContent || 'CV đã chọn';
        const jdLabel = jdSelect.options[jdSelect.selectedIndex]?.textContent || 'JD đã chọn';
        const actionType = card.dataset.actionType;
        const actionLabel = actionType === 'start_interview' ? 'tạo phiên phỏng vấn' : 'chạy Gap Analysis';
        if (!window.confirm(`Bạn muốn dùng ${cvLabel} và ${jdLabel} để ${actionLabel} không?`)) return;
        operationButton.disabled = true;
        await submitAssistantRequest(
          `Xác nhận ${actionLabel} với ${cvLabel} và ${jdLabel}.`,
          { action_type: actionType, cv_id: cvId, jd_id: jdId, confirmed: true, total_questions: 5 }
        );
        return;
      }
      const actionButton = event.target.closest('[data-assistant-target]');
      if (actionButton && ALL_VIEWS.includes(actionButton.dataset.assistantTarget)) {
        switchView(actionButton.dataset.assistantTarget);
        toggleChat(false);
      }
    });

    window.addEventListener('resize', () => {
      placeChatPanel();
    });

    if (sourceImage && spriteCanvas) {
      const spriteContext = spriteCanvas.getContext('2d', { willReadFrequently: true });
      let lastSpriteFrame = 0;
      function renderSprite(timestamp) {
        if (spriteContext && sourceImage.complete && sourceImage.naturalWidth && timestamp - lastSpriteFrame > 70) {
          lastSpriteFrame = timestamp;
          try {
            spriteContext.clearRect(0, 0, 64, 64);
            spriteContext.imageSmoothingEnabled = false;
            spriteContext.drawImage(sourceImage, 0, 0, 64, 64);
            const frame = spriteContext.getImageData(0, 0, 64, 64);
            for (let index = 0; index < frame.data.length; index += 4) {
              const red = frame.data[index];
              const green = frame.data[index + 1];
              const blue = frame.data[index + 2];
              if (green > 105 && green > red * 1.35 && green > blue * 1.28) {
                frame.data[index + 3] = 0;
              }
            }
            spriteContext.putImageData(frame, 0, 0);
          } catch (_err) {
            spriteCanvas?.classList.add('is-hidden');
            sourceImage?.classList.add('is-fallback');
          }
        }
        requestAnimationFrame(renderSprite);
      }
      requestAnimationFrame(renderSprite);
      sourceImage?.addEventListener('error', () => {
        spriteCanvas?.classList.add('is-hidden');
        sourceImage?.classList.add('is-fallback');
      });
    }

    restoreCompanionPosition();
    loadAssistantStatus();
    window.setTimeout(() => hint?.classList.add('is-hidden'), 6500);
  }

  initAICompanion();

  console.log('🚀 CV Assistant – Space canvas & Deep space background active!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAppLogic);
} else {
  startAppLogic();
}

/* ============================================================
   PIPELINE 1 – UI STATE CONTROLLER
   Syncs the guided-workflow UI (step indicator, card states,
   CTA enable/disable, loading steps) to existing app logic.
   Does NOT change any business logic or API calls.
============================================================ */
(function initP1UI() {
  // ── Element refs ──
  const cvSelect     = () => document.getElementById('cv-analysis-cv-select');
  const jdSelect     = () => document.getElementById('cv-analysis-jd-select');
  const cvFileInput  = () => document.getElementById('cv-page-file-input');
  const jdFileInput  = () => document.getElementById('cv-jd-file-input');
  const analyzeBtn   = document.getElementById('p1-analyze-btn');
  const ctaHint      = document.getElementById('p1-cta-hint');
  const cvCard       = document.getElementById('p1-cv-card');
  const jdCard       = document.getElementById('p1-jd-card');
  const step1        = document.getElementById('p1-step-1');
  const step2        = document.getElementById('p1-step-2');
  const step3        = document.getElementById('p1-step-3');
  const cvReadiness  = document.getElementById('p1-cv-readiness-item');
  const jdReadiness  = document.getElementById('p1-jd-readiness-item');
  const cvBanner     = document.getElementById('p1-cv-ready-banner');
  const jdBanner     = document.getElementById('p1-jd-ready-banner');
  const cvReadyName  = document.getElementById('p1-cv-ready-name');
  const jdReadyName  = document.getElementById('p1-jd-ready-name');
  const cvInputArea  = document.getElementById('p1-cv-input-area');
  const jdInputArea  = document.getElementById('p1-jd-input-area');
  const cvBrowser = document.getElementById('p1-cv-browser');
  const jobBrowser = document.getElementById('p1-job-browser');
  const cvBrowserContent = document.getElementById('p1-cv-browser-content');
  const jobBrowserContent = document.getElementById('p1-job-browser-content');
  function placeSelectionPanels() {
    const currentCvInput = document.getElementById('p1-cv-input-area');
    const currentJdInput = document.getElementById('p1-jd-input-area');
    const currentCvTarget = document.getElementById('p1-cv-browser-content');
    const currentJdTarget = document.getElementById('p1-job-browser-content');
    if (currentCvInput && currentCvTarget && currentCvInput.parentElement !== currentCvTarget) {
      currentCvTarget.appendChild(currentCvInput);
    }
    if (currentJdInput && currentJdTarget && currentJdInput.parentElement !== currentJdTarget) {
      currentJdTarget.appendChild(currentJdInput);
    }
  }

  placeSelectionPanels();
  setTimeout(placeSelectionPanels, 0);
  setTimeout(placeSelectionPanels, 250);
  const cvToggle     = document.getElementById('p1-cv-list-toggle');
  const cvListSec    = document.getElementById('p1-cv-list-section');
  const cvLoginGate  = document.getElementById('p1-cv-login-gate');
  const cvSelectSec  = document.getElementById('p1-cv-select-section');
  const jdLoginGate  = document.getElementById('p1-jd-login-gate');
  const jdSelectSec  = document.getElementById('p1-jd-select-section');
  const jdTitleField = document.getElementById('p1-jd-title-field');
  const cvJdDropzone = document.getElementById('cv-jd-dropzone');
  const jobSearchResults = document.getElementById('job-search-results');

  // ── Helper: check if CV is selected ──
  function hasCVSelected() {
    const sel = cvSelect();
    const file = cvFileInput();
    return (sel && sel.value) || (file && file.files && file.files.length > 0);
  }

  // ── Helper: check if JD is selected ──
  function hasJDSelected() {
    const sel = jdSelect();
    return sel && sel.value && !sel.value.startsWith('catalog:');
  }

  // ── Get display label for CV ──
  function getCVLabel() {
    const sel = cvSelect();
    const file = cvFileInput();
    if (sel && sel.value) {
      const opt = [...(sel.options || [])].find(o => o.value === sel.value);
      return opt ? opt.textContent.trim() : 'CV đã chọn';
    }
    if (file && file.files && file.files[0]) {
      const f = file.files[0];
      return `${f.name} · ${(f.size / 1024 / 1024).toFixed(1)} MB`;
    }
    return '';
  }

  // ── Get display label for JD ──
  function getJDLabel() {
    const sel = jdSelect();
    if (sel && sel.value) {
      const opt = [...(sel.options || [])].find(o => o.value === sel.value);
      return opt ? opt.textContent.trim() : 'JD đã chọn';
    }
    return '';
  }

  // ── Main UI update ──
  function updateP1UI() {
    const cvOk = hasCVSelected();
    const jdOk = hasJDSelected();

    const cvReadyMeta = document.getElementById('p1-cv-ready-meta');
    const jdReadyCompany = document.getElementById('p1-jd-ready-company');
    const jdReadyMeta = document.getElementById('p1-jd-ready-meta');

    // Step indicator
    if (step1) {
      step1.classList.toggle('is-done', cvOk);
      step1.classList.toggle('is-active', !cvOk);
    }
    if (step2) {
      step2.classList.toggle('is-done', jdOk);
      step2.classList.toggle('is-active', cvOk && !jdOk);
    }
    if (step3) {
      step3.classList.toggle('is-active', cvOk && jdOk);
      step3.classList.toggle('is-done', false);
    }

    // CV card state
    if (cvCard) cvCard.classList.toggle('is-ready', cvOk);
    if (cvReadiness) cvReadiness.classList.toggle('is-ready', cvOk);
    if (cvOk) {
      const sel = cvSelect();
      const file = cvFileInput();
      const selectedCard = sel?.value ? document.querySelector(`.cv-card[data-cv-id="${sel.value}"]`) : null;
      if (cvReadyName) {
        cvReadyName.textContent = selectedCard?.querySelector('.cv-card-title')?.textContent?.trim()
          || file?.files?.[0]?.name
          || getCVLabel();
      }
      if (cvReadyMeta) {
        cvReadyMeta.textContent = selectedCard?.querySelector('.cv-card-meta')?.textContent?.trim()
          || (file?.files?.[0] ? `${Math.max(1, Math.round(file.files[0].size / 1024))} KB` : '');
      }
    }
    if (cvBanner) cvBanner.style.display = cvOk ? 'grid' : 'none';
    if (cvInputArea) cvInputArea.style.display = 'block';
    // CV and JD are independent entry points. Keep both source panels available
    // so the user can upload or change either document without a forced order.
    if (cvBrowser) cvBrowser.hidden = false;

    // JD card state
    if (jdCard) jdCard.classList.toggle('is-ready', jdOk);
    if (jdReadiness) jdReadiness.classList.toggle('is-ready', jdOk);
    if (jdOk) {
      const selectedCard = document.querySelector('.p1-job-card.is-selected');
      const jdLabelParts = getJDLabel().split('·').map(part => part.trim());
      if (jdReadyName) jdReadyName.textContent = selectedCard?.querySelector('h4')?.textContent?.trim() || jdLabelParts[0] || getJDLabel();
      if (jdReadyCompany) jdReadyCompany.textContent = selectedCard?.querySelector('.p1-job-card-head p')?.textContent?.trim() || jdLabelParts[1] || '';
      if (jdReadyMeta) {
        jdReadyMeta.textContent = selectedCard
          ? [...selectedCard.querySelectorAll('.p1-job-meta span')].map(span => span.textContent.trim()).filter(Boolean).join(' • ')
          : '';
      }
    }
    if (jdBanner) jdBanner.style.display = jdOk ? 'grid' : 'none';
    if (jdInputArea) jdInputArea.style.display = 'block';
    if (jobBrowser) jobBrowser.hidden = false;

    // CTA
    if (analyzeBtn) {
      const canAnalyze = cvOk && jdOk;
      analyzeBtn.disabled = !canAnalyze;
      analyzeBtn.setAttribute('aria-disabled', String(!canAnalyze));
    }
    if (ctaHint && !(cvOk && jdOk)) {
      if (!hasCVSelected() && !hasJDSelected()) {
        ctaHint.textContent = 'Chọn CV và công việc để bắt đầu phân tích.';
      } else if (!hasCVSelected()) {
        ctaHint.textContent = 'Chọn CV để tiếp tục.';
      } else if (!hasJDSelected()) {
        ctaHint.textContent = 'Chọn công việc để tiếp tục.';
      }
    } else if (ctaHint) {
      ctaHint.textContent = 'Xem mức độ phù hợp, điểm mạnh và kỹ năng cần bổ sung';
    }
  }
  window.updateP1UI = updateP1UI;

  // ── Auth-aware login gate ──
  function updateLoginGates() {
    const isLoggedIn = typeof ApiClient !== 'undefined' && ApiClient.isAuthenticated && ApiClient.isAuthenticated();
    if (cvLoginGate) cvLoginGate.style.display = isLoggedIn ? 'none' : 'flex';
    if (cvSelectSec) cvSelectSec.style.display = isLoggedIn ? 'block' : 'none';
    if (jdLoginGate) jdLoginGate.style.display = isLoggedIn ? 'none' : 'flex';
    if (jdSelectSec) jdSelectSec.style.display = isLoggedIn ? 'block' : 'none';
  }

  // ── Login gate buttons ──
  document.getElementById('p1-cv-login-btn')?.addEventListener('click', () => {
    document.getElementById('btn-login')?.click();
  });
  document.getElementById('p1-jd-login-btn')?.addEventListener('click', () => {
    document.getElementById('btn-login')?.click();
  });

  // ── "Change" buttons reset the card ──
  document.getElementById('p1-cv-change-btn')?.addEventListener('click', () => {
    const sel = cvSelect();
    const fi  = cvFileInput();
    if (sel) sel.value = '';
    if (fi) fi.value = '';
    const badge = document.getElementById('selected-file-name');
    if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
    updateP1UI();
  });

  document.getElementById('p1-jd-change-btn')?.addEventListener('click', () => {
    const sel = jdSelect();
    if (sel) sel.value = '';
    updateP1UI();
  });

  // ── JD file input: show title field ──
  document.addEventListener('change', event => {
    const input = event.target.closest('#cv-jd-file-input');
    if (!input) return;
    const titleField = document.getElementById('p1-jd-title-field');
    if (titleField) {
      titleField.style.display = input.files && input.files[0] ? 'flex' : 'none';
    }
  });

  // ── JD dropzone events ──
  document.addEventListener('click', event => {
    const dropzone = event.target.closest('#cv-jd-dropzone');
    if (dropzone) {
      document.getElementById('cv-jd-file-input')?.click();
    }
  });
  document.addEventListener('dragover', event => {
    const dropzone = event.target.closest('#cv-jd-dropzone');
    if (dropzone) {
      event.preventDefault();
      dropzone.classList.add('dragover');
    }
  });
  document.addEventListener('dragleave', event => {
    const dropzone = event.target.closest('#cv-jd-dropzone');
    if (dropzone) {
      dropzone.classList.remove('dragover');
    }
  });
  document.addEventListener('drop', event => {
    const dropzone = event.target.closest('#cv-jd-dropzone');
    if (dropzone) {
      event.preventDefault();
      dropzone.classList.remove('dragover');
      const input = document.getElementById('cv-jd-file-input');
      if (input && event.dataTransfer.files && event.dataTransfer.files[0]) {
        input.files = event.dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });
  document.addEventListener('keydown', event => {
    const dropzone = event.target.closest('#cv-jd-dropzone');
    if (dropzone && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      document.getElementById('cv-jd-file-input')?.click();
    }
  });

  // ── Wire CTA button to the hidden submit ──
  analyzeBtn?.addEventListener('click', () => {
    if (analyzeBtn.disabled) return;
    if (!ApiClient.isAuthenticated()) {
      document.getElementById('btn-login')?.click();
      return;
    }
    // Trigger the real form submit which app.js handles
    const realSubmit = document.getElementById('btn-page-do-upload');
    if (realSubmit) {
      realSubmit.click();
    }
  });

  // ── Keep progress inside the CTA; results open in the GAP modal ──
  const realBtn = document.getElementById('btn-page-do-upload');
  if (realBtn && analyzeBtn) {
    const observer = new MutationObserver(() => {
      const isLoading = realBtn.disabled;
      if (isLoading) {
        analyzeBtn.innerHTML = 'AI đang đối chiếu CV với JD';
        analyzeBtn.classList.add('is-loading');
      } else {
        analyzeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path></svg><span>Phân tích Match</span><svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 5 7 7-7 7"></path></svg>';
        analyzeBtn.classList.remove('is-loading');
        updateP1UI();
      }
    });
    observer.observe(realBtn, { attributes: true, attributeFilter: ['disabled'] });
  }

  // ── CV list toggle ──
  if (cvToggle && cvListSec) {
    cvToggle.addEventListener('click', () => {
      const open = cvListSec.classList.toggle('is-open');
      cvToggle.classList.toggle('is-open', open);
      cvToggle.setAttribute('aria-expanded', String(open));
    });
  }

  // ── Listen to select changes ──
  document.addEventListener('change', (e) => {
    if (e.target && (e.target.id === 'cv-analysis-cv-select' || e.target.id === 'cv-analysis-jd-select')) {
      updateP1UI();
    }
  });

  // ── Listen to file input changes ──
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'cv-page-file-input') {
      updateP1UI();
    }
  });

  // ── After JD upload, selects refresh – poll for change ──
  const jdUploadForm = document.getElementById('cv-jd-upload-form');
  jdUploadForm?.addEventListener('submit', () => {
    // Give app.js time to update the select, then refresh UI
    setTimeout(updateP1UI, 500);
    setTimeout(updateP1UI, 2000);
    setTimeout(updateP1UI, 4000);
  });

  // ── Initial run (wait for app.js to populate selects) ──
  function scheduleInit() {
    updateLoginGates();
    updateP1UI();
    // Re-run after selects are populated by app.js
    setTimeout(() => { updateLoginGates(); updateP1UI(); }, 400);
    setTimeout(() => { updateLoginGates(); updateP1UI(); }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleInit);
  } else {
    scheduleInit();
  }

  // ── Listen for auth state changes (login/logout) ──
  document.addEventListener('auth:changed', () => {
    updateLoginGates();
    updateP1UI();
  });
  document.addEventListener('career:match-ui-update', updateP1UI);
})();

