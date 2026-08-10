/* ============================================================
   CAREER COPILOT X – app.js
   Deep Space Starfield + Shooting Stars Animation Engine
   FastAPI Backend Integration (PostgreSQL)
   ============================================================ */

// Gọi cùng origin; Next.js sẽ proxy sang FastAPI. Cách này tránh lỗi CORS khi
// người dùng mở UI bằng localhost, 127.0.0.1 hoặc một hostname triển khai khác.
const API_BASE_URL = window.__CAREER_API_BASE_URL__ || '/api/v1';

function formatApiError(data, status) {
  const detail = data?.detail ?? data?.message;
  const fieldLabels = {
    email: 'Email',
    password: 'Mật khẩu',
    full_name: 'Họ và tên',
    role: 'Vai trò',
    credential: 'Đăng nhập Google',
  };
  const translateMessage = (message) => {
    const normalized = String(message || '').replace(/^Value error,\s*/i, '');
    const exactMessages = {
      'Password must not contain whitespace': 'không được chứa khoảng trắng',
      'Password must contain a lowercase letter': 'phải có ít nhất một chữ thường',
      'Password must contain an uppercase letter': 'phải có ít nhất một chữ hoa',
      'Password must contain a number': 'phải có ít nhất một chữ số',
      'Admin accounts cannot be self-registered': 'không thể tự đăng ký tài khoản quản trị',
    };
    if (exactMessages[normalized]) return exactMessages[normalized];
    const minimum = normalized.match(/^String should have at least (\d+) characters?$/i);
    if (minimum) return `phải có ít nhất ${minimum[1]} ký tự`;
    const maximum = normalized.match(/^String should have at most (\d+) characters?$/i);
    if (maximum) return `không được vượt quá ${maximum[1]} ký tự`;
    if (/valid email address/i.test(normalized)) return 'không đúng định dạng';
    return normalized || 'Dữ liệu không hợp lệ';
  };

  if (Array.isArray(detail)) {
    return detail.map((issue) => {
      if (typeof issue === 'string') return issue;
      const location = Array.isArray(issue?.loc) ? issue.loc : [];
      const field = location.filter((part) => part !== 'body').at(-1);
      const label = fieldLabels[field] || field;
      const message = translateMessage(issue?.msg);
      return label ? `${label}: ${message}` : message;
    }).filter(Boolean).join(' • ');
  }
  if (detail && typeof detail === 'object') {
    return detail.message || JSON.stringify(detail);
  }
  return detail ? String(detail) : `Lỗi HTTP ${status}`;
}

class ApiClient {
  static getToken() {
    return null;
  }

  static setToken(_token) {
    // JWT phiên đăng nhập do backend giữ trong cookie HttpOnly.
    localStorage.removeItem('access_token');
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
        const errorMsg = formatApiError(data, response.status);
        const requestError = new Error(errorMsg);
        requestError.status = response.status;
        requestError.payload = data;
        throw requestError;
      }

      return data;
    } catch (err) {
      const isAnonymousSessionCheck = endpoint === '/auth/me' && err?.status === 401;
      if (!isAnonymousSessionCheck) console.error(`API Error [${endpoint}]:`, err);
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

  static async getMe() {
    try {
      const user = await this.request('/auth/me');
      this.setUser(user);
      return user;
    } catch (err) {
      if (err?.status === 401) {
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
  static async uploadCV(file, title = '', useLLM = false) {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    formData.append('use_llm', String(Boolean(useLLM)));

    return await this.request('/cvs/upload', {
      method: 'POST',
      body: formData,
    });
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

  static async downloadCV(cvId, analysisId, template = 'classic') {
    const query = new URLSearchParams({ template });
    if (analysisId) query.set('analysis_id', analysisId);
    const response = await fetch(`${API_BASE_URL}/cvs/${cvId}/export?${query}`, {
      credentials: 'include',
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
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      return `http://127.0.0.1:8001/api/v1${endpoint}`;
    }
    return '';
  }

  static async requestAssistant(endpoint, options = {}) {
    const localNovaUrl = this.getAssistantFallbackUrl(endpoint);
    if (localNovaUrl) {
      try {
        return await this.request(localNovaUrl, options);
      } catch (err) {
        // Nếu Nova local phản hồi lỗi nghiệp vụ/xác thực thì giữ nguyên lỗi đó.
        // Chỉ quay về same-origin khi cổng local chưa chạy hoặc chưa có endpoint.
        if (err.status && ![404, 405].includes(err.status)) throw err;
      }
    }
    return await this.request(endpoint, options);
  }

  static async getAssistantStatus() {
    return await this.requestAssistant('/assistant/status');
  }

  static async chatWithAssistant(message, history = [], currentPage = 'dashboard', conversationId = null) {
    const options = {
      method: 'POST',
      body: JSON.stringify({
        message,
        history,
        current_page: currentPage,
        conversation_id: conversationId,
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

  function escapeHtml(value = '') {
    const node = document.createElement('div');
    node.textContent = String(value);
    return node.innerHTML;
  }

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
  const ALL_VIEWS = ['dashboard', 'cv', 'jobs', 'interview', 'gap', 'history', 'profile', 'counselor', 'enterprise', 'admin'];
  const ROLE_HOME_VIEWS = Object.freeze({
    student: 'dashboard',
    counselor: 'counselor',
    enterprise: 'enterprise',
    admin: 'admin'
  });
  const ROLE_NAV_ITEMS = Object.freeze({
    guest: ['nav-dashboard'],
    student: ['nav-dashboard', 'nav-cv', 'nav-interview', 'nav-history'],
    counselor: ['nav-counselor', 'nav-counselor-reports'],
    enterprise: ['nav-enterprise', 'nav-jobs', 'nav-enterprise-applications'],
    admin: ['nav-admin']
  });
  const ALL_ROLE_NAV_IDS = [...new Set(Object.values(ROLE_NAV_ITEMS).flat().concat('nav-gap'))];
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
    jobs: 'DECK BETA // CAREER MAP',
    interview: 'DECK GAMMA // SIMULATION CHAMBER',
    gap: 'DECK DELTA // NAVIGATION DECK',
    history: 'DECK EPSILON // MISSION ARCHIVE',
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

    const VIEW_ORDER = ['dashboard', 'cv', 'jobs', 'interview', 'gap', 'history', 'profile', 'counselor', 'enterprise', 'admin'];
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

    ALL_VIEWS.forEach(key => {
      const vEl = document.getElementById(`view-${key}`);
      const navEl = document.getElementById(`nav-${key}`);
      if (vEl) {
        if (key === targetViewName) {
          vEl.classList.add('active');
          vEl.style.display = 'block';
        } else {
          vEl.classList.remove('active');
          vEl.style.display = 'none';
        }
      }
      if (navEl) {
        if (key === targetViewName) {
          navEl.classList.add('active');
        } else {
          navEl.classList.remove('active');
        }
      }
    });

    currentViewName = targetViewName;

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
    } else if (targetViewName === 'jobs') {
      loadPageJDList();
      initStarMapNodes();
    } else if (targetViewName === 'interview') {
      populatePageInterviewOptions();
      startAudioWaveformAnim();
    } else if (targetViewName === 'gap') {
      populatePageGapOptions();
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
      'nav-dashboard': 'Trang chủ',
      'nav-cv': 'Hồ sơ CV',
      'nav-jobs': 'Danh sách JD',
      'nav-interview': 'Phòng phỏng vấn',
      'nav-history': 'Lịch sử & Báo cáo',
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
      'quick-access-badge': '✨ TRUY CẬP NHANH CÁC TÍNH NĂNG CỐT LÕI',
      'icon-label-cv': '📄 CV Scanner',
      'icon-label-jd': '💼 Thư viện JD',
      'icon-label-interview': '🎙️ Phỏng vấn STAR',
      'icon-label-gap': '🎯 Gap Analysis',
      'title-cv-btn': 'Upload & Quản lý CV',
      'title-jd-btn': 'Thư viện Job Descriptions (JD)',
      'title-int-btn': 'Phòng phỏng vấn thử STAR',
      'title-gap-btn': 'Chạy Gap Analysis (CV vs JD)',
      'pricing-tag': '⚡ NÂNG CẤP SỨC MẠNH AI',
      'pricing-title': 'Các Gói Dịch Vụ & Nâng Cấp',
      'pricing-sub': 'Lựa chọn gói phù hợp để làm chủ hành trình chinh phục mọi nhà tuyển dụng',
      'plan-basic-name': 'Gói Cơ Bản',
      'plan-basic-desc': 'Trải nghiệm các tính năng cốt lõi cho ứng viên mới bắt đầu',
      'plan-basic-price': '0đ',
      'plan-free-forever': '/ Trọn đời',
      'feat-b1': 'Tối ưu 3 CV cơ bản',
      'feat-b2': 'Luyện phỏng vấn STAR 5 lượt/tháng',
      'feat-b3': 'Tra cứu Thư viện JD mẫu hệ thống',
      'feat-b4': 'Anti-Hallucination chuyên sâu',
      'feat-b5': 'Tạo Custom Job Description',
      'btn-plan-basic': 'Bắt Đầu Miễn Phí',
      'badge-popular': '🔥 PHỔ BIẾN NHẤT',
      'plan-pro-name': 'Gói Pro Copilot',
      'plan-pro-desc': 'Tăng 300% cơ hội nhận Offer với sự trợ giúp toàn diện của AI Agent',
      'plan-pro-price': '199.000đ',
      'plan-period-month': '/ Tháng',
      'feat-p1': 'Không giới hạn tối ưu CV theo JD',
      'feat-p2': 'Luyện phỏng vấn STAR AI toàn diện & gợi mở follow-up',
      'feat-p3': 'Thuật toán Anti-Hallucination bảo toàn 100% độ thật',
      'feat-p4': 'Phân tích Gap Analysis & Đề xuất từ khóa ATS',
      'feat-p5': 'Xuất báo cáo đánh giá kỹ năng phỏng vấn PDF',
      'btn-plan-pro': 'Nâng Cấp Pro Ngay',
      'plan-ent-name': 'Gói Enterprise / Mentor',
      'plan-ent-desc': 'Giải pháp chuyên sâu cho Nhà tuyển dụng, HR & Chuyên gia Hướng nghiệp',
      'plan-ent-price': '499.000đ',
      'feat-e1': 'Tất cả đặc quyền của Gói Pro',
      'feat-e2': 'Tạo Custom Job Description không giới hạn',
      'feat-e3': 'Thiết lập bộ Rubric STAR phỏng vấn riêng',
      'feat-e4': 'Quản lý kho ứng viên & Phân tích khớp hồ sơ hàng loạt',
      'feat-e5': 'Hỗ trợ kỹ thuật 24/7 & API Integration',
      'btn-plan-enterprise': 'Liên Hệ Tư Vấn Enterprise',
      'stat-cv-label': 'CV Tối Ưu Thành Công',
      'stat-pass-label': 'Tỷ Lệ Vượt Qua Phỏng Vấn',
      'stat-rating-label': 'Đánh Giá Từ 5,000+ Ứng Viên',
      'stat-speed-label': 'Thời Gian Phân Tích Match Score',
      'testi-tag': '💬 CÂU CHUYỆN THÀNH CÔNG',
      'testi-title': 'Ứng Viên Nói Gì Về Career Assistant X?',
      'testi-sub': 'Hàng ngàn ứng viên đã chinh phục được công việc mơ ước nhờ sự đồng hành của AI Agent',
      'testi-user1-text': '"Nhờ Gap Analysis mà tôi biết chính xác CV mình thiếu những từ khóa ATS nào đối với vị trí Senior Frontend. AI còn tự động tối ưu câu từ vô cùng chân thật!"',
      'testi-user1-role': 'Senior Frontend Engineer @ Top Tech Corp',
      'testi-user2-text': '"Luyện phỏng vấn STAR với AI Agent giúp tôi rèn luyện phản xạ tuyệt vời. Khi bước vào phỏng vấn thực tế với HR, tôi hoàn toàn tự tin trả lời gãy gọn mạch lạc!"',
      'testi-user2-role': 'Product Manager @ Fintech Startup',
      'testi-user3-text': '"Tính năng Anti-Hallucination là cứu cánh của tôi! CV không hề bị AI \'bốc phét\' thêm kinh nghiệm ảo, nhà tuyển dụng đánh giá rất cao độ trung thực."',
      'testi-user3-role': 'AI Research Specialist @ Global Hub'
    },
    en: {
      'nav-dashboard': 'Home',
      'nav-cv': 'CV Profiles',
      'nav-jobs': 'JD List',
      'nav-interview': 'Interview Room',
      'nav-history': 'History & Reports',
      'nav-gap': 'Gap Analysis',
      'btn-login': 'Log in',
      'btn-logout': 'Log out',
      'hero-title': 'Improve your CV and interview skills. <span class="hero-title-accent">Your agent is waiting.</span>',
      'hero-sub': 'AI-powered career guidance tool to optimize your CV based on job descriptions (Anti-Hallucination) and practice mock interviews using the Rubric STAR method.',
      'btn-try-free': 'TRY INTERVIEWING NOW',
      'btn-consult': 'Optimize your CV with AI.',
      'user-name-guest': 'Not logged in',
      'user-role-default': 'Career Assistant System X',
      'tab-overview': 'Overview',
      'tab-interviews': 'Interviews',
      'tab-history': 'Association',
      'summary-title': 'APPLICATION STATUS',
      'label-cv-upload': 'CV has been uploaded.',
      'badge-cv-status': 'Ready',
      'label-interview-skills': 'Interview Skills',
      'badge-interview-status': 'STAR Rubric',
      'label-ai-match': 'AI Match Score',
      'badge-match-score': 'Anti-Hallucination',
      'gauge-cv-label': 'Match Score (85%)',
      'gauge-interview-label': 'STAR Score (82/100)',
      'gauge-direction-label': 'Optimal Progress',
      'chart-title': 'Interview evaluation history & resume optimization',
      'agent-title': 'AI Agent – Powered by<br />Artificial Intelligence',
      'feat-opt-name': 'Automatic',
      'feat-opt-desc': 'CV Optimization',
      'feat-int-name': 'Interview',
      'feat-int-desc': 'STAR Rubric',
      'feat-match-name': 'Match Score',
      'feat-match-desc': 'Gap Analysis',
      'feat-custom-name': 'Custom Job',
      'feat-custom-desc': 'Description',
      'quick-access-badge': '✨ QUICK ACCESS TO CORE FEATURES',
      'icon-label-cv': '📄 CV Scanner',
      'icon-label-jd': '💼 JD Library',
      'icon-label-interview': '🎙️ STAR Interview',
      'icon-label-gap': '🎯 Gap Analysis',
      'title-cv-btn': 'Upload & Manage CV',
      'title-jd-btn': 'Job Descriptions Library',
      'title-int-btn': 'STAR Mock Interview Room',
      'title-gap-btn': 'Run Gap Analysis (CV vs JD)',
      'pricing-tag': '⚡ UPGRADE YOUR AI POWER',
      'pricing-title': 'Pricing Plans & Upgrades',
      'pricing-sub': 'Choose the right plan to master your job hunt with AI Copilot',
      'plan-basic-name': 'Basic Plan',
      'plan-basic-desc': 'Experience core AI features for beginners',
      'plan-basic-price': '$0',
      'plan-free-forever': '/ Free forever',
      'feat-b1': 'Optimize up to 3 basic CVs',
      'feat-b2': '5 STAR interview sessions / month',
      'feat-b3': 'Access system sample JDs library',
      'feat-b4': 'Deep Anti-Hallucination check',
      'feat-b5': 'Create Custom Job Descriptions',
      'btn-plan-basic': 'Start Free',
      'badge-popular': '🔥 MOST POPULAR',
      'plan-pro-name': 'Pro Copilot Plan',
      'plan-pro-desc': 'Boost your offer rate by 300% with full AI Agent support',
      'plan-pro-price': '$9.99',
      'plan-period-month': '/ Month',
      'feat-p1': 'Unlimited JD-targeted CV optimizations',
      'feat-p2': 'Comprehensive STAR AI mock interviews with follow-ups',
      'feat-p3': 'Anti-Hallucination algorithm ensures 100% truthfulness',
      'feat-p4': 'Deep Gap Analysis & ATS keyword recommendations',
      'feat-p5': 'Export interview evaluation reports to PDF',
      'btn-plan-pro': 'Upgrade to Pro',
      'plan-ent-name': 'Enterprise / Mentor Plan',
      'plan-ent-desc': 'Tailored solution for Recruiters, HRs & Career Coaches',
      'plan-ent-price': '$24.99',
      'feat-e1': 'All Pro Plan privileges included',
      'feat-e2': 'Unlimited Custom Job Descriptions',
      'feat-e3': 'Custom STAR interview rubric setup',
      'feat-e4': 'Candidate pool management & bulk resume matching',
      'feat-e5': '24/7 dedicated support & API integration',
      'btn-plan-enterprise': 'Contact Enterprise',
      'stat-cv-label': 'CVs Successfully Optimized',
      'stat-pass-label': 'Interview Pass Rate',
      'stat-rating-label': 'Rating from 5,000+ Candidates',
      'stat-speed-label': 'Match Score Analysis Time',
      'testi-tag': '💬 SUCCESS STORIES',
      'testi-title': 'What Candidates Say About Career Assistant X',
      'testi-sub': 'Thousands of candidates landed their dream job with AI Agent assistance',
      'testi-user1-text': '"Thanks to Gap Analysis, I knew exactly which ATS keywords my CV was missing for the Senior Frontend role. AI rewrote it authentically without fluff!"',
      'testi-user1-role': 'Senior Frontend Engineer @ Top Tech Corp',
      'testi-user2-text': '"Practicing STAR interviews with AI Agent built my reflexes. When interviewing with HR, I answered confidently and structured every answer crisp!"',
      'testi-user2-role': 'Product Manager @ Fintech Startup',
      'testi-user3-text': '"Anti-Hallucination is a lifesaver! AI did not invent fake experiences on my CV. Recruiters praised my resume for its genuine transparency."',
      'testi-user3-role': 'AI Research Specialist @ Global Hub'
    },
    ja: {
      'nav-dashboard': 'ホーム',
      'nav-cv': 'CVプロフィール',
      'nav-jobs': 'JD一覧',
      'nav-interview': '面接ルーム',
      'nav-history': '履歴とレポート',
      'nav-gap': 'ギャップ分析',
      'btn-login': 'ログイン',
      'btn-logout': 'ログアウト',
      'hero-title': 'CVと面接スキルを強化、<span class="hero-title-accent">AIエージェントが待機中。</span>',
      'hero-sub': '求人票(JD)に合わせたCV最適化（アンチハルシネーション）＆ STARルーブリックによる模擬面接。',
      'btn-try-free': '今すぐ模擬面接を開始',
      'btn-consult': 'AIでCVを最適化',
      'user-name-guest': '未ログイン',
      'user-role-default': 'キャリアアシスタント X',
      'tab-overview': '概要',
      'tab-interviews': '面接履歴',
      'tab-history': '関連付け',
      'summary-title': 'アプリケーションステータス',
      'label-cv-upload': 'CVアップロード済み',
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
      'quick-access-badge': '✨ コア機能へのクイックアクセス',
      'icon-label-cv': '📄 CVスキャナー',
      'icon-label-jd': '💼 求人ライブラリ',
      'icon-label-interview': '🎙️ STAR面接',
      'icon-label-gap': '🎯 ギャップ分析',
      'title-cv-btn': 'CVアップロード・管理',
      'title-jd-btn': '求人票ライブラリ',
      'title-int-btn': 'STAR模擬面接ルーム',
      'title-gap-btn': 'ギャップ分析実行',
      'pricing-tag': '⚡ AIパワーをアップグレード',
      'pricing-title': 'サービスプランとアップグレード',
      'pricing-sub': '面接成功に向けた最適なプランを選択しましょう',
      'plan-basic-name': 'ベーシックプラン',
      'plan-basic-desc': '初心者向けのコア機能を無料で体験',
      'plan-basic-price': '¥0',
      'plan-free-forever': '/ 永久無料',
      'feat-b1': '基本CV最適化（3回まで）',
      'feat-b2': 'STAR模擬面接（月5回まで）',
      'feat-b3': 'システムサンプル求人票の閲覧',
      'feat-b4': '詳細なアンチハルシネーション検証',
      'feat-b5': 'カスタム求人票(JD)の作成',
      'btn-plan-basic': '無料で始める',
      'badge-popular': '🔥 一番人気',
      'plan-pro-name': 'Pro Copilot プラン',
      'plan-pro-desc': 'AIエージェントのフル活用で内定獲得率を300%向上',
      'plan-pro-price': '¥1,480',
      'plan-period-month': '/ 月',
      'feat-p1': '無制限のJD適合CV最適化',
      'feat-p2': 'STARルーブリックによる完全AI模擬面接＆深掘り質問',
      'feat-p3': '100%信頼性を保つアンチハルシネーションアルゴリズム',
      'feat-p4': 'ギャップ分析とATSキーワード推奨',
      'feat-p5': '面接評価レポートのPDF出力',
      'btn-plan-pro': '今すぐProにアップグレード',
      'plan-ent-name': 'エンタープライズ / メンター',
      'plan-ent-desc': '採用担当者、HR、キャリアアドバイザー向けソリューション',
      'plan-ent-price': '¥3,980',
      'feat-e1': 'Proプランのすべての特典を含む',
      'feat-e2': 'カスタム求人票(JD)の無制限作成',
      'feat-e3': '独自のSTAR面接評価基準の設定',
      'feat-e4': '候補者プール管理と一括CV適合度分析',
      'feat-e5': '24/7技術サポート＆API連携',
      'btn-plan-enterprise': 'エンタープライズに相談',
      'stat-cv-label': 'CV最適化実績数',
      'stat-pass-label': '面接通過率',
      'stat-rating-label': '5,000名以上のユーザー評価',
      'stat-speed-label': '適合度分析スピード',
      'testi-tag': '💬 成功事例・受講者の声',
      'testi-title': 'Career Assistant Xの評判と評価',
      'testi-sub': 'AIエージェントと共に夢の職種への転職を成功させたユーザーの声',
      'testi-user1-text': '「ギャップ分析のおかげで、Senior Frontendポジションに必要なATSキーワードが明確になりました。AIの修正文も非常に誠実で魅力的です！」',
      'testi-user1-role': 'Senior Frontend Engineer @ Top Tech Corp',
      'testi-user2-text': '「STAR模擬面接で反復練習したおかげで、本番の面接でも焦らず論理的に答えることができました！」',
      'testi-user2-role': 'Product Manager @ Fintech Startup',
      'testi-user3-text': '「アンチハルシネーション機能のおかげで、経歴を誇張することなく本物のCVを作成でき、面接官からも高い評価を得ました。」',
      'testi-user3-role': 'AI Research Specialist @ Global Hub'
    },
    ko: {
      'nav-dashboard': '홈',
      'nav-cv': 'CV 프로필',
      'nav-jobs': 'JD 목록',
      'nav-interview': '면접실',
      'nav-history': '기록 및 보고서',
      'nav-gap': '갭 분석',
      'btn-login': '로그인',
      'btn-logout': '로그아웃',
      'hero-title': 'CV 및 면접 실력을 업그레이드하세요, <span class="hero-title-accent">AI 에이전트가 기다립니다.</span>',
      'hero-sub': 'JD 맞춤형 CV 최적화(Anti-Hallucination) 및 STAR 루브릭 기반 AI 모의 면접 도구.',
      'btn-try-free': '지금 모의 면접 시작',
      'btn-consult': 'AI로 CV 최적화',
      'user-name-guest': '로그인되지 않음',
      'user-role-default': '커리어 어시스턴트 X',
      'tab-overview': '개요',
      'tab-interviews': '면접',
      'tab-history': '연관성',
      'summary-title': '지원 상태',
      'label-cv-upload': 'CV 업로드됨',
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
      'quick-access-badge': '✨ 핵심 기능 빠른 액세스',
      'icon-label-cv': '📄 CV 스캐너',
      'icon-label-jd': '💼 JD 라이브러리',
      'icon-label-interview': '🎙️ STAR 면접',
      'icon-label-gap': '🎯 갭 분석',
      'title-cv-btn': 'CV 업로드 및 관리',
      'title-jd-btn': '직무 기술서 라이브러리',
      'title-int-btn': 'STAR 모의 면접실',
      'title-gap-btn': '갭 분석 실행',
      'pricing-tag': '⚡ AI 파워 업그레이드',
      'pricing-title': '서비스 요금제 및 업그레이드',
      'pricing-sub': '목표 직무 합격을 위한 최적의 플랜을 선택하세요',
      'plan-basic-name': '기본 플랜',
      'plan-basic-desc': '초보자를 위한 핵심 AI 기능 무료 체험',
      'plan-basic-price': '₩0',
      'plan-free-forever': '/ 평생 무료',
      'feat-b1': '기본 CV 최적화 3회',
      'feat-b2': 'STAR 모의 면접 월 5회',
      'feat-b3': '시스템 샘플 JD 라이브러리 열람',
      'feat-b4': '심층 안티 헐루시네이션 검증',
      'feat-b5': '커스텀 직무 기술서(JD) 생성',
      'btn-plan-basic': '무료로 시작하기',
      'badge-popular': '🔥 가장 인기',
      'plan-pro-name': 'Pro Copilot 플랜',
      'plan-pro-desc': 'AI 에이전트 전폭 지원으로 합격률 300% 향상',
      'plan-pro-price': '₩12,900',
      'plan-period-month': '/ 월',
      'feat-p1': '무제한 JD 맞춤형 CV 최적화',
      'feat-p2': '완벽한 STAR 루브릭 AI 면접 및 심층 팔로우업 질문',
      'feat-p3': '100% 진실성을 보장하는 안티 헐루시네이션 알고리즘',
      'feat-p4': '갭 분석 및 ATS 핵심 키워드 추천',
      'feat-p5': '면접 평가 리포트 PDF 다운로드',
      'btn-plan-pro': '지금 Pro로 업그레이드',
      'plan-ent-name': '엔터프라이즈 / 멘토',
      'plan-ent-desc': '채용 담당자, HR 및 커리어 코치를 위한 전문 솔루션',
      'plan-ent-price': '₩34,900',
      'feat-e1': 'Pro 플랜의 모든 혜택 포함',
      'feat-e2': '무제한 커스텀 직무 기술서(JD) 생성',
      'feat-e3': '자체 STAR 면접 평가 기준 설정',
      'feat-e4': '지원자 풀 관리 및 대량 이력서 매칭 분석',
      'feat-e5': '24/7 전담 지원 및 API 연동',
      'btn-plan-enterprise': '엔터프라이즈 문의하기',
      'stat-cv-label': '성공적으로 최적화된 CV',
      'stat-pass-label': '면접 합격률',
      'stat-rating-label': '5,000+ 지원자의 평점',
      'stat-speed-label': '매칭 분석 소요 시간',
      'testi-tag': '💬 합격 후기',
      'testi-title': '지원자들이 말하는 Career Assistant X',
      'testi-sub': '수천 명의 지원자가 AI 에이전트와 함께 꿈의 기업에 합격했습니다',
      'testi-user1-text': '"갭 분석 덕분에 Senior Frontend 직무에 부족했던 ATS 키워드를 정확히 파악했습니다. AI 최적화 문장도 과장 없이 솔직하고 매끄러웠습니다!"',
      'testi-user1-role': 'Senior Frontend Engineer @ Top Tech Corp',
      'testi-user2-text': '"STAR 모의 면접으로 실전 순발력을 길렀습니다. 실제 HR 면접에서 자신감 있게 완벽한 답변을 할 수 있었습니다!"',
      'testi-user2-role': 'Product Manager @ Fintech Startup',
      'testi-user3-text': '"안티 헐루시네이션 기능이 핵심이었습니다! 거짓 경력 생성 없이 진실된 CV를 완성하여 면접관의 호평을 받았습니다."',
      'testi-user3-role': 'AI Research Specialist @ Global Hub'
    },
    zh: {
      'nav-dashboard': '首页',
      'nav-cv': '简历档案',
      'nav-jobs': 'JD 列表',
      'nav-interview': '面试室',
      'nav-history': '历史与报告',
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
      'tab-history': '关联',
      'summary-title': '申请状态',
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
      'quick-access-badge': '✨ 核心功能快速入口',
      'icon-label-cv': '📄 简历扫描',
      'icon-label-jd': '💼 职位库',
      'icon-label-interview': '🎙️ STAR 面试',
      'icon-label-gap': '🎯 差距分析',
      'title-cv-btn': '上传与管理简历',
      'title-jd-btn': '职位描述库',
      'title-int-btn': 'STAR 模拟面试室',
      'title-gap-btn': '运行差距分析',
      'pricing-tag': '⚡ 升级 AI 赋能',
      'pricing-title': '服务套餐与升级方案',
      'pricing-sub': '选择最适合您的方案，在 AI 助手的陪伴下轻松斩获 Offer',
      'plan-basic-name': '基础套餐',
      'plan-basic-desc': '免费体验核心 AI 功能，适合刚开始求职的应届生与求职者',
      'plan-basic-price': '¥0',
      'plan-free-forever': '/ 永久免费',
      'feat-b1': '基础简历优化 3 次',
      'feat-b2': 'STAR 模拟面试 5 次/月',
      'feat-b3': '查阅系统内置模板 JD 库',
      'feat-b4': '防幻觉深度校验',
      'feat-b5': '创建自定义职位描述 (JD)',
      'btn-plan-basic': '免费开始使用',
      'badge-popular': '🔥 最受欢迎',
      'plan-pro-name': 'Pro 智能助手套餐',
      'plan-pro-desc': '全方位 AI 助手辅助，提升 300% 的 Offer 获得率',
      'plan-pro-price': '¥68',
      'plan-period-month': '/ 月',
      'feat-p1': '无限制基于 JD 优化简历',
      'feat-p2': '全方位 STAR 标准 AI 模拟面试与智能追问',
      'feat-p3': '防幻觉算法保障 100% 真实透明',
      'feat-p4': '差距分析 (Gap Analysis) 与 ATS 关键词推荐',
      'feat-p5': '导出 PDF 版面试能力评估报告',
      'btn-plan-pro': '立即升级 Pro',
      'plan-ent-name': '企业 / 导师套餐',
      'plan-ent-desc': '专为招聘官、HR 及职业规划导师打造的深度解决方案',
      'plan-ent-price': '¥188',
      'feat-e1': '包含 Pro 套餐的所有高级特权',
      'feat-e2': '无限制创建自定义 Job Description',
      'feat-e3': '自定义 STAR 面试评估标准集',
      'feat-e4': '人才库管理与批量简历匹配分析',
      'feat-e5': '24/7 专属技术支持与 API 接口集成',
      'btn-plan-enterprise': '联系企业咨询',
      'stat-cv-label': '成功优化简历数',
      'stat-pass-label': '面试通过率',
      'stat-rating-label': '5,000+ 求职者五星好评',
      'stat-speed-label': '匹配得分分析耗时',
      'testi-tag': '💬 成功求职故事',
      'testi-title': '求职者如何评价 Career Assistant X？',
      'testi-sub': '数以千计的求职者在 AI 助手的陪伴下成功斩获心仪 Offer',
      'testi-user1-text': '“多亏了 Gap Analysis 差距分析，我准确知道了 Senior Frontend 岗位简历缺少的 ATS 关键词。AI 自动润色语言既真实又专业！”',
      'testi-user1-role': 'Senior Frontend Engineer @ Top Tech Corp',
      'testi-user2-text': '“与 AI 智能助手进行 STAR 模拟面试极大地锻炼了我的应变能力。在真正的 HR 面试中，我回答得游刃有余！”',
      'testi-user2-role': 'Product Manager @ Fintech Startup',
      'testi-user3-text': '“防幻觉功能是我的救星！AI 完全没有凭空捏造虚假经历，面试官对简历的真实性给予了极高评价。”',
      'testi-user3-role': 'AI Research Specialist @ Global Hub'
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

      document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (dict[key] !== undefined) {
          el.title = dict[key];
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
  const cvBulkToolbar = document.getElementById('cv-bulk-toolbar');
  const cvSelectAll = document.getElementById('cv-select-all');
  const cvSelectedCount = document.getElementById('cv-selected-count');
  const btnDeleteSelectedCVs = document.getElementById('btn-delete-selected-cvs');
  const cvUseLLM = document.getElementById('cv-use-llm');
  const cvAgentProgress = document.getElementById('cv-agent-progress');

  const inspectorDeck = document.getElementById('cv-detail-inspector');
  const btnCloseInspector = document.getElementById('btn-close-cv-detail');
  let loadedCVs = [];
  let inspectedCV = null;
  let selectedCVIds = new Set();

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
      item.classList.toggle('is-selected', selectedCVIds.has(item.dataset.cvId));
    });
  }

  function setAgentProgress(activeStep = '') {
    if (!cvAgentProgress) return;
    cvAgentProgress.hidden = !activeStep;
    const order = ['upload', 'extract', 'llm', 'guardrail', 'save'];
    const activeIndex = order.indexOf(activeStep);
    cvAgentProgress.querySelectorAll('[data-agent-step]').forEach((element, index) => {
      element.classList.toggle('active', index === activeIndex);
      element.classList.toggle('done', index < activeIndex);
    });
  }

  async function loadCVAgentStatus() {
    const statusEl = document.getElementById('cv-agent-runtime-status');
    const modelEl = document.getElementById('cv-agent-model');
    if (!statusEl || !ApiClient.isAuthenticated()) return;
    try {
      const status = await ApiClient.getCVAgentStatus();
      statusEl.innerHTML = `<i class="pill-dot ${status.configured ? 'green' : 'purple'}"></i> ${status.configured ? 'AI AGENT READY' : 'LOCAL READY · THIẾU API KEY'}`;
      if (modelEl) modelEl.textContent = `${status.provider}/${status.model}`;
      if (cvUseLLM) cvUseLLM.disabled = !status.configured;
    } catch (err) {
      statusEl.innerHTML = '<i class="pill-dot purple"></i> KHÔNG ĐỌC ĐƯỢC AI STATUS';
    }
  }

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
      if (!ApiClient.isAuthenticated()) {
        showToast('⚠️ Vui lòng đăng nhập tài khoản để upload CV', 'warning');
        openAuthModal();
        return;
      }
      if (!cvPageFileInput.files[0]) {
        showToast('⚠️ Vui lòng chọn file CV dạng .pdf hoặc .docx', 'warning');
        return;
      }

      const submitButton = document.getElementById('btn-page-do-upload');
      const useLLM = Boolean(cvUseLLM?.checked);
      try {
        if (submitButton) submitButton.disabled = true;
        setAgentProgress('upload');
        showToast(useLLM ? '🤖 CV Agent đang gọi LLM và kiểm chứng dữ liệu...' : '🔒 Đang parse CV cục bộ...', 'info');
        setAgentProgress(useLLM ? 'llm' : 'extract');
        const res = await ApiClient.uploadCV(
          cvPageFileInput.files[0],
          cvPageTitleInput.value.trim(),
          useLLM,
        );
        setAgentProgress('save');
        const llmSucceeded = Boolean(res?.parsed_json?.agent_metadata?.llm_succeeded);
        showToast(
          llmSucceeded ? '🎉 LLM Agent đã phân tích và guardrail đã kiểm chứng!' : '✅ CV đã parse an toàn; xem trạng thái agent trong Inspector.',
          'success',
        );
        cvPageForm.reset();
        if (selectedFileNameEl) selectedFileNameEl.style.display = 'none';
        await loadSpaceshipCVList();
        if (res?.id) inspectCVDetail(res);
      } catch (err) {
        showToast(`❌ Lỗi upload CV: ${err.message}`, 'error');
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
      manualCVForm.reset();
      showToast('✅ Đã tạo CV thủ công; hãy kiểm tra nội dung trước khi sử dụng.', 'success');
      await loadSpaceshipCVList();
      inspectCVDetail(cv);
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    }
  });

  // Load CV Manifest List inside Spaceship View
  async function loadSpaceshipCVList() {
    if (!cvPageListContainer) return;
    if (!ApiClient.isAuthenticated()) {
      selectedCVIds.clear();
      if (cvBulkToolbar) cvBulkToolbar.hidden = true;
      cvPageListContainer.innerHTML = `<div class="empty-manifest"><p>⚠️ Vui lòng đăng nhập để xem danh sách CV đã lưu</p></div>`;
      return;
    }

    try {
      loadedCVs = await ApiClient.listCVs();
      if (!loadedCVs || loadedCVs.length === 0) {
        selectedCVIds.clear();
        if (cvBulkToolbar) cvBulkToolbar.hidden = true;
        cvPageListContainer.innerHTML = `<div class="empty-manifest"><p>Chưa có bản CV nào trong kho dữ liệu. Hãy quét CV đầu tiên ở trạm bên trái!</p></div>`;
        return;
      }

      const availableIds = new Set(loadedCVs.map(cv => cv.id));
      selectedCVIds = new Set([...selectedCVIds].filter(id => availableIds.has(id)));
      if (cvBulkToolbar) cvBulkToolbar.hidden = false;

      cvPageListContainer.innerHTML = loadedCVs.map((cv, idx) => `
        <div class="cv-manifest-item" data-cv-id="${escapeHtml(cv.id)}">
          <label class="cv-row-checkbox" aria-label="Chọn ${escapeHtml(cv.title || 'CV Hồ sơ')}">
            <input type="checkbox" data-cv-select-id="${escapeHtml(cv.id)}" ${selectedCVIds.has(cv.id) ? 'checked' : ''}>
            <span class="cv-checkbox-visual" aria-hidden="true"></span>
          </label>
          <div class="cv-item-copy">
            <p class="cv-item-title">📄 ${escapeHtml(cv.title || 'CV Hồ sơ')}</p>
            <p class="cv-item-date">Ngày tạo: ${new Date(cv.created_at).toLocaleDateString('vi-VN')} | Standard ATS</p>
          </div>
          <div class="cv-item-actions">
            <button class="btn-ship-sm view" type="button" data-cv-inspect-index="${idx}">Inspect AI</button>
            <button class="btn-ship-sm delete" type="button" data-cv-delete-id="${escapeHtml(cv.id)}" aria-label="Xóa ${escapeHtml(cv.title || 'CV Hồ sơ')}">
              <span aria-hidden="true">🗑</span> Xóa
            </button>
          </div>
        </div>
      `).join('');
      updateCVBulkSelectionUI();
    } catch (err) {
      cvPageListContainer.innerHTML = `<div class="empty-manifest"><p style="color:#ef4444;">Không thể kết nối kho dữ liệu CV: ${err.message}</p></div>`;
    }
  }

  if (cvPageListContainer) {
    cvPageListContainer.addEventListener('change', event => {
      const checkbox = event.target.closest('[data-cv-select-id]');
      if (!checkbox) return;
      if (checkbox.checked) selectedCVIds.add(checkbox.dataset.cvSelectId);
      else selectedCVIds.delete(checkbox.dataset.cvSelectId);
      updateCVBulkSelectionUI();
    });

    cvPageListContainer.addEventListener('click', async event => {
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
        deleteButton.classList.add('is-loading');
        await ApiClient.deleteCV(cv.id);
        selectedCVIds.delete(cv.id);
        if (inspectedCV?.id === cv.id) {
          inspectedCV = null;
          if (inspectorDeck) inspectorDeck.style.display = 'none';
        }
        await loadSpaceshipCVList();
        await populatePageGapOptions();
        showToast(`🗑️ Đã xóa CV ${cv.title || 'CV Hồ sơ'}`, 'success');
      } catch (err) {
        deleteButton.disabled = false;
        deleteButton.classList.remove('is-loading');
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
    document.querySelectorAll('.role-only-link').forEach(link => link.classList.remove('active'));
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
      btnDeleteSelectedCVs.classList.add('is-loading');
      const result = await ApiClient.bulkDeleteCVs(selectedCVs.map(cv => cv.id));
      if (inspectedCV && selectedCVIds.has(inspectedCV.id)) {
        inspectedCV = null;
        if (inspectorDeck) inspectorDeck.style.display = 'none';
      }
      selectedCVIds.clear();
      await loadSpaceshipCVList();
      await populatePageGapOptions();
      showToast(`🗑️ Đã xóa ${result.deleted_count || selectedCVs.length} CV`, 'success');
    } catch (err) {
      showToast(`❌ Không thể xóa các CV đã chọn: ${err.message}`, 'error');
    } finally {
      btnDeleteSelectedCVs.classList.remove('is-loading');
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
    btnCloseInspector.addEventListener('click', () => {
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
    switchView('gap');
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
      label.textContent = input.files?.[0]?.name || 'PDF, DOCX hoặc TXT';
    });
  }

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
      pageJdListContainer.querySelectorAll('.apply-jd').forEach(button => button.addEventListener('click', async () => {
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
      shell.classList.remove('is-open');
      shell.querySelector('.gap-select-trigger')?.setAttribute('aria-expanded', 'false');
    });
  }

  if (pageUploadJdForm) {
    pageUploadJdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = pageUploadJdFile?.files?.[0];
      if (!file) {
        showToast('Vui lòng chọn file JD dạng PDF, DOCX hoặc TXT.', 'warning');
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
        document.getElementById('page-upload-jd-file-name').textContent = 'PDF, DOCX hoặc TXT';
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
      select.classList.add('gap-select-native-hidden');
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

      trigger.addEventListener('click', () => {
        const shouldOpen = !shell.classList.contains('is-open');
        closeGapSelectMenus(shell);
        shell.classList.toggle('is-open', shouldOpen);
        trigger.setAttribute('aria-expanded', String(shouldOpen));
      });

      trigger.addEventListener('keydown', event => {
        if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        closeGapSelectMenus(shell);
        shell.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        const items = [...menu.querySelectorAll('.gap-select-menu-item:not(:disabled)')];
        const selectedIndex = Math.max(0, items.findIndex(item => item.getAttribute('aria-selected') === 'true'));
        const targetIndex = event.key === 'ArrowUp' ? Math.max(0, selectedIndex - 1) : selectedIndex;
        items[targetIndex]?.focus();
      });

      menu.addEventListener('keydown', event => {
        const items = [...menu.querySelectorAll('.gap-select-menu-item:not(:disabled)')];
        const currentIndex = items.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          event.preventDefault();
          shell.classList.remove('is-open');
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
    const selectedParts = (selectedOption?.textContent || 'Chọn một mục').split(' • ');
    trigger.querySelector('.gap-select-value-title').textContent = selectedParts.shift();
    const selectedMeta = trigger.querySelector('.gap-select-value-meta');
    selectedMeta.textContent = selectedParts.join(' • ');
    selectedMeta.hidden = selectedParts.length === 0;
    trigger.disabled = !selectedOption || selectedOption.disabled;

    const badge = select.id.includes('cv') ? 'CV' : 'JD';
    menu.innerHTML = [...select.options].map(option => {
      const parts = option.textContent.split(' • ');
      const title = parts.shift();
      const meta = parts.join(' • ');
      const selected = option.value === select.value;
      return `
        <button type="button" class="gap-select-menu-item${selected ? ' is-selected' : ''}"
          role="option" data-value="${escapeHtml(option.value)}" aria-selected="${selected}"
          ${option.disabled ? 'disabled' : ''}>
          <span class="gap-option-badge">${badge}</span>
          <span class="gap-option-copy">
            <strong>${escapeHtml(title)}</strong>
            ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
          </span>
          <span class="gap-option-check" aria-hidden="true">✓</span>
        </button>`;
    }).join('');

    menu.querySelectorAll('.gap-select-menu-item:not(:disabled)').forEach(item => {
      item.addEventListener('click', () => {
        select.value = item.dataset.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        enhanceGapSelect(select);
        shell.classList.remove('is-open');
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
  }

  async function populatePageGapOptions() {
    if (!pageSelectGapCv || !pageSelectGapJd) return;
    try {
      const [cvs, jds] = await Promise.all([ApiClient.listCVs(), ApiClient.listJDs()]);
      pageSelectGapCv.innerHTML = buildGapCvOptions(cvs);
      pageSelectGapJd.innerHTML = buildGapJdOptions(jds);
      enhanceGapSelect(pageSelectGapCv);
      enhanceGapSelect(pageSelectGapJd);
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
        currentGapResult = res;

        document.getElementById('page-gap-match-score-badge').textContent = `${res.match_score.toFixed(1)}%`;

        document.getElementById('page-gap-matching-skills').innerHTML = (res.hard_skills_matching || []).map(
          s => `<span class="badge badge-ok">${escapeHtml(s)}</span>`
        ).join('') || `<span style="font-size:11px;color:var(--text-muted);">Không có dữ liệu</span>`;

        document.getElementById('page-gap-missing-skills').innerHTML = (res.hard_skills_missing || []).map(
          s => `<span class="badge badge-need">${escapeHtml(s)}</span>`
        ).join('') || `<span style="font-size:11px;color:var(--text-muted);">Không có dữ liệu</span>`;

        document.getElementById('page-gap-executive-summary').textContent = res.executive_summary || '';

        document.getElementById('page-gap-priority-actions').innerHTML = (res.priority_actions || []).map(item => `
          <article class="gap-plan-item priority-item">
            <span class="gap-priority-number">${escapeHtml(item.priority)}</span>
            <div><h5>${escapeHtml(item.gap)}</h5><p>${escapeHtml(item.why_it_matters)}</p><strong>${escapeHtml(item.action)}</strong></div>
          </article>
        `).join('') || '<p class="gap-empty">Không có khoảng cách ưu tiên.</p>';

        document.getElementById('page-gap-learning-list').innerHTML = (res.learning_recommendations || []).map(item => `
          <article class="gap-plan-item">
            <h5>${escapeHtml(item.skill)}</h5>
            <p>${escapeHtml(item.learning_goal)}</p>
            <div class="gap-mini-tags">${(item.topics || []).map(topic => `<span>${escapeHtml(topic)}</span>`).join('')}</div>
            <strong>Bài thực hành: ${escapeHtml(item.practice)}</strong>
          </article>
        `).join('') || '<p class="gap-empty">Chưa có đề xuất học tập bổ sung.</p>';

        document.getElementById('page-gap-certifications-list').innerHTML = (res.certification_recommendations || []).map(item => `
          <article class="gap-plan-item certificate-item">
            <span class="gap-card-kicker">${escapeHtml(item.level)} · ${escapeHtml(item.provider)}</span>
            <h5>${escapeHtml(item.name)}</h5>
            <p>${escapeHtml(item.reason)}</p>
            <div class="gap-mini-tags">${(item.related_skills || []).map(skill => `<span>${escapeHtml(skill)}</span>`).join('')}</div>
            <small>${escapeHtml(item.verification_note)}</small>
          </article>
        `).join('') || '<p class="gap-empty">JD này chưa có chứng chỉ bắt buộc hoặc phù hợp rõ ràng.</p>';

        document.getElementById('page-gap-projects-list').innerHTML = (res.project_recommendations || []).map(item => `
          <article class="gap-plan-item project-item">
            <span class="gap-card-kicker">ĐỀ XUẤT · CHƯA HOÀN THÀNH</span>
            <h5>${escapeHtml(item.title)}</h5>
            <p>${escapeHtml(item.objective)}</p>
            <div class="gap-mini-tags">${(item.skills || []).map(skill => `<span>${escapeHtml(skill)}</span>`).join('')}</div>
            <ul>${(item.deliverables || []).map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul>
            <div class="gap-bullet-template">${escapeHtml(item.cv_bullet_template)}</div>
          </article>
        `).join('') || '<p class="gap-empty">Chưa cần thêm dự án mới; hãy tăng số liệu cho dự án hiện có.</p>';

        document.getElementById('page-gap-cv-sections-list').innerHTML = (res.cv_section_recommendations || []).map(item => `
          <article class="gap-plan-item compact-item">
            <h5>${escapeHtml(item.section)}</h5>
            <p><strong>Vấn đề:</strong> ${escapeHtml(item.issue)}</p>
            <p><strong>Nên sửa:</strong> ${escapeHtml(item.recommendation)}</p>
          </article>
        `).join('') || '<p class="gap-empty">Không có mục CV cần bổ sung.</p>';

        const suggestionList = document.getElementById('page-gap-suggestions-list');
        suggestionList.innerHTML = (res.suggestions || []).map((s, index) => `
          <div class="suggestion-decision-card" data-index="${index}">
            <p style="font-size:11px;color:var(--text-muted);margin:0 0 2px 0;"><strong>Gốc:</strong> ${escapeHtml(s.original_text)}</p>
            <label>Tối ưu (có thể chỉnh trước khi duyệt)</label>
            <textarea class="form-input suggestion-final-text">${escapeHtml(s.suggested_improvement)}</textarea>
            <p style="font-size:10px;color:var(--text-dim);margin:0;"><em>${escapeHtml(s.reason)}</em></p>
            <div class="suggestion-actions"><button type="button" class="btn-outline suggestion-reject">Từ chối</button><button type="button" class="btn-primary suggestion-accept">Chấp nhận</button><span class="suggestion-status">Chưa quyết định</span></div>
          </div>
        `).join('') || `<p style="font-size:11px;color:var(--text-muted);">CV của bạn đã tối ưu rất tốt!</p>`;
        suggestionList.querySelectorAll('.suggestion-decision-card').forEach(card => {
          const save = async accepted => {
            const index = Number(card.dataset.index);
            const finalText = card.querySelector('.suggestion-final-text').value.trim();
            try {
              await ApiClient.decideSuggestion(res.id, index, accepted, accepted ? finalText : null);
              card.dataset.decision = accepted ? 'accepted' : 'rejected';
              card.querySelector('.suggestion-status').textContent = accepted ? '✓ Đã chấp nhận' : '✕ Đã từ chối';
              showToast(accepted ? 'Đã lưu nội dung được duyệt.' : 'Đã loại gợi ý.', 'success');
            } catch (err) { showToast(`Không lưu được quyết định: ${err.message}`, 'error'); }
          };
          card.querySelector('.suggestion-accept').addEventListener('click', () => save(true));
          card.querySelector('.suggestion-reject').addEventListener('click', () => save(false));
        });
        const exportBar = document.getElementById('page-cv-export-bar');
        if (exportBar) exportBar.hidden = false;

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
        ? cvs.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title || 'CV chưa đặt tên')}</option>`).join('')
        : `<option value="">(Bắt buộc upload 1 CV trước)</option>`;

      pageSelectIntJd.innerHTML = jds.length > 0
        ? jds.map(j => `<option value="${escapeHtml(j.id)}">${escapeHtml(j.title || 'JD chưa đặt tên')} • ${escapeHtml(j.company || 'Chưa ghi công ty')}</option>`).join('')
        : `<option value="">(Bắt buộc chọn 1 JD trước)</option>`;
      enhanceGapSelect(pageSelectIntCv);
      enhanceGapSelect(pageSelectIntJd);
      const sessions = await ApiClient.listInterviews();
      const ongoing = sessions.find(session => session.status === 'ongoing');
      let resumeButton = document.getElementById('page-resume-interview');
      if (ongoing && !resumeButton && pageSetupSec) {
        resumeButton = document.createElement('button');
        resumeButton.id = 'page-resume-interview';
        resumeButton.type = 'button';
        resumeButton.className = 'btn-outline full-width';
        resumeButton.textContent = `Tiếp tục phiên đang lưu (${ongoing.current_question_index + 1}/${ongoing.total_questions})`;
        resumeButton.addEventListener('click', async () => {
          try {
            const question = await ApiClient.resumeInterview(ongoing.id);
            pageSessionId = ongoing.id;
            pageSetupSec.style.display = 'none'; pageChatSec.style.display = 'block';
            pageChatHistory.innerHTML = '';
            appendPageMessage('interviewer', question.follow_up_question || question.question_text);
            pageProgressText.textContent = `Câu hỏi ${question.question_index + 1} / ${ongoing.total_questions}`;
          } catch (err) { showToast(err.message, 'error'); }
        });
        pageSetupSec.appendChild(resumeButton);
      }
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

  document.getElementById('page-interview-voice')?.addEventListener('click', () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Trình duyệt này chưa hỗ trợ nhập giọng nói.', 'warning'); return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN'; recognition.interimResults = false;
    recognition.onresult = event => { pageAnswerInput.value = event.results[0][0].transcript; };
    recognition.onerror = () => showToast('Không nhận diện được giọng nói.', 'error');
    recognition.start();
  });

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
      list.querySelectorAll('.revoke-consent').forEach(button => button.addEventListener('click', async () => {
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
      const assignments = await ApiClient.listAssignedStudents();
      list.innerHTML = assignments.map(item => `<button class="hitl-item hitl-student" data-id="${escapeHtml(item.student_id)}"><span><strong>${escapeHtml(item.student_name)}</strong><small>${escapeHtml(item.student_email)}</small></span><span>›</span></button>`).join('') || '<p class="gap-empty">Chưa có sinh viên cấp quyền.</p>';
      list.querySelectorAll('.hitl-student').forEach(button => button.addEventListener('click', () => loadCounselorStudent(button.dataset.id)));
    } catch (err) { list.innerHTML = `<p class="gap-empty">${escapeHtml(err.message)}</p>`; }
  }

  async function loadCounselorStudent(studentId) {
    const detail = document.getElementById('counselor-student-detail');
    const form = document.getElementById('counselor-feedback-form');
    try {
      const data = await ApiClient.getStudentOverview(studentId);
      detail.innerHTML = `<h3>${escapeHtml(data.student.full_name)}</h3><div class="hitl-stats"><span>${data.cv_count}<small>CV</small></span><span>${data.analysis_count}<small>Gap</small></span><span>${data.completed_interview_count}<small>STAR</small></span><span>${data.average_star_score}<small>Điểm TB</small></span></div><h4>Phản hồi gần đây</h4>${data.recent_feedback.map(item => `<article class="feedback-item"><strong>${escapeHtml(item.kind)}</strong><p>${escapeHtml(item.content)}</p></article>`).join('') || '<p class="gap-empty">Chưa có phản hồi.</p>'}`;
      document.getElementById('counselor-feedback-student-id').value = studentId;
      form.hidden = false;
    } catch (err) { detail.innerHTML = `<p class="gap-empty">${escapeHtml(err.message)}</p>`; form.hidden = true; }
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
      list.querySelectorAll('.publish-jd').forEach(button => button.addEventListener('click', async () => { await ApiClient.publishJD(button.dataset.id); showToast('Đã công bố JD.', 'success'); loadEnterpriseDashboard(); }));
      list.querySelectorAll('.view-candidates').forEach(button => button.addEventListener('click', () => loadEnterpriseCandidates(button.dataset.id)));
    } catch (err) { list.innerHTML = `<p class="gap-empty">${escapeHtml(err.message)}</p>`; }
  }

  async function loadEnterpriseCandidates(jdId) {
    const list = document.getElementById('enterprise-candidate-list');
    try {
      const candidates = await ApiClient.listCandidates(jdId);
      list.innerHTML = candidates.map(item => `<article class="candidate-card"><div><strong>${escapeHtml(item.candidate_name)}</strong><small>${escapeHtml(item.candidate_email)}</small></div><b>${Number(item.match_score).toFixed(1)}%</b><button class="btn-outline view-shared-cv" data-id="${escapeHtml(item.id)}">Xem CV đã chia sẻ</button><select class="form-input candidate-decision" data-id="${escapeHtml(item.id)}"><option value="submitted" ${item.status === 'submitted' ? 'selected' : ''}>Đã nộp</option><option value="shortlisted" ${item.status === 'shortlisted' ? 'selected' : ''}>Shortlist</option><option value="interview" ${item.status === 'interview' ? 'selected' : ''}>Mời phỏng vấn</option><option value="rejected" ${item.status === 'rejected' ? 'selected' : ''}>Từ chối</option></select></article>`).join('') || '<p class="gap-empty">Chưa có ứng viên chủ động chia sẻ CV.</p>';
      list.querySelectorAll('.view-shared-cv').forEach(button => button.addEventListener('click', async () => {
        const detail = document.getElementById('enterprise-candidate-cv');
        try {
          const cv = await ApiClient.getCandidateCV(button.dataset.id);
          const parsed = cv.parsed_json || {};
          detail.hidden = false;
          detail.innerHTML = `<h3>${escapeHtml(cv.title)}</h3><p>${escapeHtml(parsed.summary || '')}</p><h4>Kỹ năng</h4><p>${escapeHtml((parsed.skills || []).join(', '))}</p><h4>Nội dung CV đã chia sẻ</h4><pre>${escapeHtml(cv.raw_text || '')}</pre>`;
        } catch (err) { showToast(err.message, 'error'); }
      }));
      list.querySelectorAll('.candidate-decision').forEach(select => select.addEventListener('change', async () => { await ApiClient.decideCandidate(select.dataset.id, select.value); showToast('Đã cập nhật quyết định.', 'success'); }));
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
      if (element) element.hidden = !visibleNavItems.has(id);
    });
    const isAdmin = user?.role === 'admin';
    const adminNav = document.getElementById('nav-admin');
    if (adminNav) {
      adminNav.hidden = !isAdmin;
      adminNav.classList.toggle('visible', isAdmin);
    }
    const consentPanel = document.getElementById('student-counselor-consent-panel');
    if (consentPanel) consentPanel.hidden = user?.role !== 'student';
    const jobsNavText = document.querySelector('#nav-jobs .nav-text');
    if (jobsNavText) {
      const currentLang = localStorage.getItem('career_copilot_lang') || 'vi';
      const defaultLabel = (TRANSLATIONS[currentLang] || TRANSLATIONS.vi)['nav-jobs'] || 'Thư viện Jobs';
      jobsNavText.textContent = defaultLabel;
    }

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
    document.querySelectorAll('.modal-overlay.open').forEach(modal => modal.classList.remove('open'));
    const selectedFileBadge = document.getElementById('selected-file-name');
    if (selectedFileBadge) {
      selectedFileBadge.textContent = '';
      selectedFileBadge.style.display = 'none';
    }
    document.getElementById('page-gap-results-container')?.style.setProperty('display', 'none');
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

  function checkUserSession() {
    const user = ApiClient.getUser();
    const navAdmin = document.getElementById('nav-admin');

    if (user) {
      applyRoleAccess(user);
      if (userNameEl) userNameEl.textContent = user.full_name || user.email;
      if (userRoleEl) userRoleEl.textContent = `Vai trò: ${user.role.toUpperCase()}`;
      const roleHomeView = getRoleHomeView(user);
      if (currentViewName !== roleHomeView) switchView(roleHomeView);
      if (navAdmin) {
        if (user.role === 'admin') {
          navAdmin.classList.add('visible');
        } else {
          navAdmin.classList.remove('visible');
        }
      }
      if (authContainer) {
        authContainer.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:12px;color:var(--text-dim);">${user.full_name || user.email}</span>
            <button class="btn-outline" id="btn-logout" style="padding:6px 12px;font-size:12px;">Đăng xuất</button>
          </div>
        `;
        document.getElementById('btn-logout').addEventListener('click', () => {
          performLogout();
        });
      }
    } else {
      applyRoleAccess(null);
      if (userNameEl) userNameEl.textContent = 'Chưa đăng nhập';
      if (userRoleEl) userRoleEl.textContent = 'Hệ thống Trợ Lý Nghề Nghiệp X';
      if (navAdmin) navAdmin.classList.remove('visible');
      if (authContainer) {
        authContainer.innerHTML = `<button class="btn-login" id="btn-login">Đăng nhập</button>`;
        document.getElementById('btn-login').addEventListener('click', openAuthModal);
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
      btn.addEventListener('click', () => {
        const uId = btn.getAttribute('data-user-id');
        const targetUser = adminUsersData.find(x => x.id === uId);
        if (targetUser) openAdminUserModal('edit', targetUser);
      });
    });

    tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', () => {
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
    btnAdminAddUser.addEventListener('click', () => openAdminUserModal('add'));
  }

  if (btnAdminCloseUser) {
    btnAdminCloseUser.addEventListener('click', () => closeAdminUserModal());
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

    adminUserModal.classList.add('open');
  }

  function closeAdminUserModal() {
    if (adminUserModal) adminUserModal.classList.remove('open');
  }

  // Close admin modal when clicking overlay background
  if (adminUserModal) {
    adminUserModal.addEventListener('click', (e) => {
      if (e.target === adminUserModal) closeAdminUserModal();
    });
  }


  if (adminUserForm) {
    adminUserForm.addEventListener('submit', async (e) => {
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
      if (deleteConfirmOverlay) deleteConfirmOverlay.classList.add('open');
    });
  }

  function closeDeleteConfirm(result) {
    if (deleteConfirmOverlay) deleteConfirmOverlay.classList.remove('open');
    if (pendingDeleteResolve) {
      pendingDeleteResolve(result);
      pendingDeleteResolve = null;
    }
  }

  if (deleteConfirmCancel) {
    deleteConfirmCancel.addEventListener('click', () => closeDeleteConfirm(false));
  }
  if (deleteConfirmOk) {
    deleteConfirmOk.addEventListener('click', () => closeDeleteConfirm(true));
  }
  if (deleteConfirmOverlay) {
    deleteConfirmOverlay.addEventListener('click', (e) => {
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
  const googleButtonHost = document.getElementById('google-signin-button');
  const googleAuthHelp = document.getElementById('google-auth-help');

  let isRegisterMode = false;
  let googleIdentityInitialized = false;

  function openAuthModal() {
    if (authOverlay) authOverlay.classList.add('open');
    renderGoogleSignInButton();
  }
  function closeAuthModal() {
    if (authOverlay) authOverlay.classList.remove('open');
    document.getElementById('auth-role-select')?.classList.remove('is-open');
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
    if (authOverlay?.classList.contains('open')) renderGoogleSignInButton();
  }

  if (tabLogin) tabLogin.addEventListener('click', () => setAuthMode(false));
  if (tabRegister) tabRegister.addEventListener('click', () => setAuthMode(true));

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

      trigger.addEventListener('click', () => {
        const shouldOpen = !shell.classList.contains('is-open');
        shell.classList.toggle('is-open', shouldOpen);
        trigger.setAttribute('aria-expanded', String(shouldOpen));
        if (shouldOpen) menu.querySelector('[aria-selected="true"]')?.focus();
      });
      menu.addEventListener('keydown', event => {
        const items = [...menu.querySelectorAll('.auth-role-option')];
        const currentIndex = items.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          event.preventDefault();
          shell.classList.remove('is-open');
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
    menu.querySelectorAll('.auth-role-option').forEach(item => item.addEventListener('click', () => {
      select.value = item.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      enhanceAuthRoleSelect();
      shell.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    }));
  }

  enhanceAuthRoleSelect();
  document.addEventListener('click', event => {
    const shell = document.getElementById('auth-role-select');
    if (shell && !event.target.closest('#auth-role-select')) {
      shell.classList.remove('is-open');
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
      const currentLang = localStorage.getItem('career_copilot_lang') || 'vi';
      window.google.accounts.id.renderButton(googleButtonHost, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: isRegisterMode ? 'signup_with' : 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: Math.min(Math.max((googleButtonHost.clientWidth || 360) - 12, 240), 360),
        locale: currentLang,
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
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('input-email').value.trim();
      const password = document.getElementById('input-password').value;

      if (!email || !password) {
        showToast('Vui lòng điền đầy đủ Email và Mật khẩu', 'error');
        return;
      }

      if (isRegisterMode) {
        let passwordError = '';
        if (password.length < 8) passwordError = 'Mật khẩu phải có ít nhất 8 ký tự.';
        else if (password.length > 128) passwordError = 'Mật khẩu không được vượt quá 128 ký tự.';
        else if (/\s/.test(password)) passwordError = 'Mật khẩu không được chứa khoảng trắng.';
        else if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
          passwordError = 'Mật khẩu phải có chữ hoa, chữ thường và chữ số.';
        }
        if (passwordError) {
          showToast(`❌ ${passwordError}`, 'error');
          document.getElementById('input-password')?.focus();
          return;
        }
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
    if (cvOverlay) cvOverlay.classList.add('open');
    loadCVList();
  }
  function closeCVModal() { if (cvOverlay) cvOverlay.classList.remove('open'); }
  if (cvClose) cvClose.addEventListener('click', closeCVModal);

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
    if (jdOverlay) jdOverlay.classList.add('open');
    loadJDList();
  }
  function closeJDModal() { if (jdOverlay) jdOverlay.classList.remove('open'); }
  if (jdClose) jdClose.addEventListener('click', closeJDModal);

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

  if (uploadJdForm) {
    uploadJdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = uploadJdFile?.files?.[0];
      if (!file) {
        showToast('Vui lòng chọn file JD dạng PDF, DOCX hoặc TXT.', 'warning');
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
        document.getElementById('upload-jd-file-name').textContent = 'PDF, DOCX hoặc TXT';
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
    if (gapOverlay) gapOverlay.classList.add('open');
    populateGapOptions();
  }
  function closeGapModal() { if (gapOverlay) gapOverlay.classList.remove('open'); }
  if (gapClose) gapClose.addEventListener('click', closeGapModal);

  document.getElementById('icon-search-btn')?.addEventListener('click', openGapModal);
  document.getElementById('feature-optimize')?.addEventListener('click', openGapModal);
  document.getElementById('feature-keywords')?.addEventListener('click', openGapModal);

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
    if (!ApiClient.isAuthenticated()) {
      showToast('⚠️ Vui lòng đăng nhập trước khi bắt đầu phỏng vấn thử', 'warning');
      openAuthModal();
      return;
    }
    if (intOverlay) intOverlay.classList.add('open');
    populateInterviewOptions();
  }
  function closeInterviewModal() { if (intOverlay) intOverlay.classList.remove('open'); }
  if (intClose) intClose.addEventListener('click', closeInterviewModal);

  document.getElementById('icon-megaphone-btn')?.addEventListener('click', openInterviewModal);
  document.getElementById('btn-try-free')?.addEventListener('click', openInterviewModal);
  document.getElementById('feature-deep-interview')?.addEventListener('click', openInterviewModal);

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
      panel.classList.toggle('history-open', historyOpen);
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
      companion.classList.toggle('chat-open', isOpen);
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
          if (!ALL_VIEWS.includes(action.page)) return;
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.assistantTarget = action.page;
          button.textContent = action.label;
          actionList.appendChild(button);
        });
        message.appendChild(actionList);
      }
      messagesElement.appendChild(message);
      messagesElement.scrollTop = messagesElement.scrollHeight;
      return message;
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
        companion.classList.toggle('is-online', Boolean(status.configured));
        if (statusText) {
          statusText.textContent = status.configured
            ? `${status.weather_configured ? 'Gemini + Weather online' : 'Gemini online'} · ${status.model}`
            : 'Thiếu GEMINI_API_KEY';
        }
      } catch (_err) {
        companion.classList.remove('is-online');
        if (statusText) statusText.textContent = 'Backend agent chưa sẵn sàng';
      }
    }

    avatar.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      toggleChat(true);
      event.preventDefault();
    });

    avatar.addEventListener('click', event => {
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

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || sendButton?.disabled) return;
      if (!ApiClient.isAuthenticated()) {
        appendChatMessage('assistant', 'Bạn cần đăng nhập để Nova có thể sử dụng hồ sơ và bảo vệ phiên chat.');
        openAuthModal();
        return;
      }

      const previousHistory = conversationHistory.slice(-10);
      appendChatMessage('user', text);
      conversationHistory.push({ role: 'user', content: text });
      input.value = '';
      input.style.height = 'auto';
      if (sendButton) sendButton.disabled = true;
      const typing = appendTypingIndicator();
      try {
        const result = await ApiClient.chatWithAssistant(
          text,
          previousHistory,
          currentViewName,
          currentConversationId
        );
        typing.remove();
        currentConversationId = result.conversation_id;
        appendChatMessage('assistant', result.response, result.suggested_actions || []);
        conversationHistory.push({ role: 'assistant', content: result.response });
        companion.classList.toggle('is-online', Boolean(result.llm_succeeded));
        if (statusText) {
          statusText.textContent = result.llm_succeeded
            ? `Gemini online · ${result.model}`
            : 'Gemini chưa phản hồi';
        }
      } catch (err) {
        typing.remove();
        if (err.status === 401) {
          performLogout({ notify: false });
          appendChatMessage('assistant', 'Phiên đăng nhập đã hết hạn. Bạn hãy đăng nhập lại rồi gửi câu hỏi thời tiết.');
          openAuthModal();
          return;
        }
        const message = err.status === 404
          ? 'Nova backend chưa sẵn sàng. Vui lòng thử lại sau ít phút.'
          : `Mình chưa thể trả lời: ${err.message}`;
        appendChatMessage('assistant', message);
      } finally {
        if (sendButton) sendButton.disabled = false;
        input.focus();
      }
    });

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 100)}px`;
    });

    panel.addEventListener('click', event => {
      const promptButton = event.target.closest('[data-assistant-prompt]');
      if (promptButton) {
        input.value = promptButton.dataset.assistantPrompt;
        form.requestSubmit();
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
            spriteCanvas.classList.add('is-hidden');
            sourceImage.classList.add('is-fallback');
          }
        }
        requestAnimationFrame(renderSprite);
      }
      requestAnimationFrame(renderSprite);
      sourceImage.addEventListener('error', () => {
        spriteCanvas.classList.add('is-hidden');
        sourceImage.classList.add('is-fallback');
      });
    }

    restoreCompanionPosition();
    // Assistant là module tùy chọn. Không tự gọi endpoint khi trang vừa tải vì
    // backend auth hiện chưa triển khai nhóm /assistant; chỉ kiểm tra khi người
    // dùng thực sự mở hoặc sử dụng trợ lý.
    companion.classList.remove('is-online');
    if (statusText) statusText.textContent = 'Trợ lý AI chưa được bật';
    window.setTimeout(() => hint?.classList.add('is-hidden'), 6500);
  }

  initAICompanion();

  console.log('🚀 Career Copilot X – Space canvas & Deep space background active!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAppLogic);
} else {
  startAppLogic();
}

export {};
