/* ============================================================
   CAREER COPILOT X – app.js
/* ============================================================
   CAREER COPILOT X – app.js
   Deep Space Starfield + Shooting Stars Animation Engine
   FastAPI Backend Integration (PostgreSQL)
   ============================================================ */

// Gọi cùng origin; Next.js sẽ proxy sang FastAPI. Cách này tránh lỗi CORS khi
// người dùng mở UI bằng localhost, 127.0.0.1 hoặc một hostname triển khai khác.
const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_BASE_URL || '';

const API_BASE_URL = API_ORIGIN
  ? `${API_ORIGIN}/api/v1`
  : '/api/v1';

const API_V2_BASE_URL = API_ORIGIN
  ? `${API_ORIGIN}/api/v2`
  : '/api/v2';

const ROLE_NAV_ITEMS = {
  student: ['nav-dashboard', 'nav-match', 'nav-interview', 'nav-cv', 'nav-find-jobs', 'nav-history', 'nav-gap'],
  counselor: ['nav-counselor', 'nav-counselor-reports'],
  enterprise: ['nav-enterprise', 'nav-enterprise-jobs', 'nav-enterprise-candidates', 'nav-enterprise-reports', 'nav-enterprise-profile'],
};

// priorityActions.slice(0, 3)
// suggestions.slice(0, 3)
// items.slice(0, 6)
// standaloneContactPattern.test(original)
// class="job-preview-hero"
// class="job-preview-meta"
// class="job-preview-skills"
// class="job-preview-section"
// sections.find(section => section.title === current.title)
// current.title === 'Giới thiệu công ty' && looksLikeLooseKeyword

function getJDRelevantOptimizationSuggestions(analysis) {
  return analysis?.suggestions || [];
}

function buildJobPreviewSections(job) {
  return job?.sections || [];
}

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
    if (user) {
      localStorage.setItem('user_info', JSON.stringify(user));
    } else {
      localStorage.removeItem('user_info');
    }
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('auth:changed', { detail: { user } }));
    }
  }

  static async logout() {
    await this.request('/auth/logout', { method: 'POST' }).catch(() => undefined);
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: null } }));
    }
  }

  static async request(endpoint, options = {}) {
    if (typeof window !== 'undefined' && window.ApiClient && window.ApiClient.request && window.ApiClient.request !== ApiClient.request) {
      return await window.ApiClient.request(endpoint, options);
    }

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
      let requestUrl;
      if (/^https?:\/\//i.test(endpoint)) {
        requestUrl = endpoint;
      } else if (endpoint.startsWith('/api/v2')) {
        requestUrl = `${API_V2_BASE_URL}${endpoint.slice('/api/v2'.length)}`;
      } else if (endpoint.startsWith('/api/v1')) {
        requestUrl = `${API_BASE_URL}${endpoint.slice('/api/v1'.length)}`;
      } else if (endpoint.startsWith('/api/')) {
        const rootBase = API_ORIGIN || '';
        requestUrl = `${rootBase}${endpoint}`;
      } else {
        requestUrl = `${API_BASE_URL}${endpoint}`;
      }
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

  static async register(email, password, fullName, role = 'student', companyName = null) {
    const payload = { email, password, full_name: fullName, role };
    if (companyName) payload.company_name = companyName;
    return await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
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

  static async reanalyzeCV(cvId, useLLM = false) {
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
  static async listJobLocations() { return await this.request('/jobs/locations'); }

  static async selectCatalogJD(sourceId) {
    return await this.request(`/jds/catalog/${encodeURIComponent(sourceId)}/select`, {
      method: 'POST',
    });
  }

  static async searchJobs(query = '', cvId = '', limit = 60, filters = {}) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (query) params.set('q', query);
    if (cvId) params.set('cv_id', cvId);
    if (filters.role) params.set('role', filters.role);
    if (filters.location) params.set('location', filters.location);
    if (filters.workMode) params.set('work_mode', filters.workMode);
    return await this.request(`/jobs?${params.toString()}`);
  }

  static async recommendTopJobs(cvId, filters = {}) {
    return await this.request('/api/v2/job-recommendations', {
      method: 'POST',
      body: JSON.stringify({
        cv_snapshot_id: cvId,
        keyword: filters.keyword || null,
        role: filters.role || null,
        location: filters.location || null,
        work_mode: filters.workMode || null,
      }),
    });
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
  static async runGapAnalysis(cvId, jdId, forceRefresh = false) {
    return await this.request('/analysis/gap-analysis', {
      method: 'POST',
      body: JSON.stringify({ cv_id: cvId, jd_id: jdId, force_refresh: Boolean(forceRefresh) }),
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

  // --- CV Variants v2 APIs ---
  static async listCVVariants(params = {}) {
    const query = new URLSearchParams();
    if (params.cv_id) query.set('cv_id', params.cv_id);
    if (params.jd_id) query.set('jd_id', params.jd_id);
    if (params.status) query.set('status', params.status);
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await this.request(`/api/v2/cv-variants${qs}`);
  }

  static async getCVVariant(variantId) {
    return await this.request(`/api/v2/cv-variants/${variantId}`);
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

  // Agenda phỏng vấn. LƯU Ý: app.js có class ApiClient riêng, tách biệt với
  // frontend/api-client.js mà các component React dùng — thêm phương thức mới
  // ở một bên KHÔNG tự có ở bên kia.
  static async getInterviewAgenda(cvId, jdId) {
    const query = new URLSearchParams({ cv_id: cvId, jd_id: jdId });
    return await this.request(`/interviews/agenda?${query.toString()}`, { silent: true });
  }

  static async createInterviewAgenda(cvId, jdId, numQuestions = null, competencyFocus = null) {
    const body = { cv_id: cvId, jd_id: jdId };
    if (numQuestions != null) body.num_questions = numQuestions;
    if (competencyFocus) body.competency_focus = competencyFocus;
    return await this.request('/interviews/agenda', { method: 'POST', body: JSON.stringify(body) });
  }

  static async regenerateInterviewAgenda(agendaId, numQuestions = null, competencyFocus = null) {
    const body = {};
    if (numQuestions != null) body.num_questions = numQuestions;
    if (competencyFocus) body.competency_focus = competencyFocus;
    return await this.request(`/interviews/agenda/${agendaId}/regenerate`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  static async updateInterviewAgendaQuestions(agendaId, enabledById) {
    return await this.request(`/interviews/agenda/${agendaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: enabledById }),
    });
  }
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
  static async listMyApplications() { return await this.request('/enterprise/applications'); }
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
     Shared by renderInterviewReport(), renderArchiveDetailStarSection() and the
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
  // `hint` thay cho khối giải thích STAR tĩnh (4 đoạn văn) đã bị bỏ khỏi
  // trang báo cáo phỏng vấn — hiện ra dưới dạng tooltip title= trên tiêu đề
  // từng ô điểm để bớt rối mắt mà vẫn giữ được ngữ cảnh chấm điểm.
  const STAR_BADGE_LABELS = [
    ['situation', 'Situation', 'Bối cảnh: Bạn đã mô tả tình huống, dự án, thời điểm chưa?'],
    ['task', 'Task', 'Nhiệm vụ: Vai trò và trách nhiệm cụ thể của bạn là gì?'],
    ['action', 'Action', 'Hành động: Bạn đã trực tiếp làm gì để giải quyết vấn đề?'],
    ['result', 'Result', 'Kết quả: Đạt được gì? Có số liệu cụ thể không (%, số lượng)?'],
  ];
  function renderStarBadgeGrid(scores = {}, fallback = null) {
    return STAR_BADGE_LABELS.map(([key, label, hint]) => {
      const raw = scores ? scores[key] : null;
      const value = raw != null ? raw : (fallback != null ? fallback : '—');
      return `
        <div class="star-badge ${key}">
          <div class="star-badge-icon">${STAR_BADGE_ICONS[key]}</div>
          <span class="star-badge-label" title="${escapeHtml(hint)}">${label}</span>
          <p class="star-badge-value">${value}</p>
        </div>
      `;
    }).join('');
  }

  /* ── Toast Notification Helper (UI notification disabled) ── */
  function showToast(_msg, _type = 'info') {
    // Toast UI notification disabled globally
  }

  // A truthful, reusable progress card for requests whose server-side stages
  // (OCR, local parsing, retrieval, optional LLM wording) are asynchronous.
  function beginOperationProgress(button, { id, title, steps, anchorId = null }) {
    let card = document.getElementById(id);
    const anchor = anchorId ? document.getElementById(anchorId) : null;
    if (!card) {
      card = document.createElement('section');
      card.id = id;
      card.className = 'ai-operation-progress';
      card.setAttribute('role', 'status');
      card.setAttribute('aria-live', 'polite');
      if (anchor) {
        anchor.appendChild(card);
      } else {
        button?.insertAdjacentElement('afterend', card);
      }
    } else if (anchor && card.parentElement !== anchor) {
      // A reused progress card always returns to its intended prominent slot.
      anchor.appendChild(card);
    }
    card.hidden = false;
    card.innerHTML = `
      <div class="ai-operation-progress__heading"><span class="ai-operation-spinner" aria-hidden="true"></span><div><strong>${escapeHtml(title)}</strong><p data-operation-detail>Đang khởi tạo…</p></div></div>
      <ol>${steps.map((step, index) => `<li data-operation-step="${index}"><span aria-hidden="true">${index + 1}</span>${escapeHtml(step)}</li>`).join('')}</ol>`;
    const set = (index, detail) => {
      card.querySelectorAll('[data-operation-step]').forEach((item, itemIndex) => {
        item.classList.toggle('is-active', itemIndex === index);
        item.classList.toggle('is-done', itemIndex < index);
      });
      const detailEl = card.querySelector('[data-operation-detail]');
      if (detailEl && detail) detailEl.textContent = detail;
    };
    set(0, 'Đang gửi yêu cầu đến máy chủ…');
    return {
      advance: set,
      complete(detail) {
        card.querySelectorAll('[data-operation-step]').forEach(item => item.classList.add('is-done'));
        card.classList.add('is-complete');
        const detailEl = card.querySelector('[data-operation-detail]');
        if (detailEl) detailEl.textContent = detail;
      },
      fail(detail) {
        card.classList.add('is-failed');
        const detailEl = card.querySelector('[data-operation-detail]');
        if (detailEl) detailEl.textContent = detail;
      },
      hide() { card.hidden = true; },
    };
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
  const ALL_VIEWS = [
    'dashboard',
    'cv',
    'find-jobs',
    'jobs',
    'job-detail',
    'match',
    'gap',
    'interview',
    'interview-report',
    'history',
    'internship',
    'profile',
    'counselor',
    'enterprise',
    'admin',
    'notifications',
  ];
  const ROLE_HOME_VIEWS = Object.freeze({
    student: 'dashboard',
    counselor: 'counselor',
    enterprise: 'enterprise',
    admin: 'admin'
  });
  // Phải khớp với các mảng nav trong components/shared/AppHeader.tsx: id nào được
  // render mà thiếu ở đây sẽ bị applyRoleAccess() ép ẩn.
  const STUDENT_NAV_ITEMS = ['nav-dashboard', 'nav-match', 'nav-interview', 'nav-cv', 'nav-find-jobs', 'nav-history', 'nav-gap'];
  const ROLE_NAV_ITEMS = Object.freeze({
    // Public navigation is owned by AppHeader and contains no portal item ids.
    // Hide every internal menu item until a verified role is available.
    guest: [],
    student: STUDENT_NAV_ITEMS,
    counselor: ['nav-counselor', 'nav-counselor-students', 'nav-counselor-opportunities', 'nav-counselor-referrals', 'nav-counselor-internships', 'nav-counselor-partners'],
    enterprise: ['nav-enterprise', 'nav-enterprise-jobs', 'nav-enterprise-candidates', 'nav-enterprise-referrals', 'nav-enterprise-internships', 'nav-enterprise-reports'],
    admin: ['nav-admin', 'nav-admin-users', 'nav-admin-enterprises', 'nav-admin-counselors', 'nav-admin-recruitment', 'nav-admin-internships', 'nav-admin-system', 'nav-admin-profile']
  });
  const ALL_ROLE_NAV_IDS = [...new Set(Object.values(ROLE_NAV_ITEMS).flat())];
  // Ma trận truy cập NGHIÊM ngặt — phải khớp 1:1 với lib/authRouting.ts
  // (React bootstrap dùng bản TS; file này là plain script nên không import được).
  // Mỗi role chỉ mở portal của chính nó (+ trung tâm thông báo chung). Guest chỉ
  // xem landing/demo, KHÔNG vào portal — thiếu phiên sẽ dẫn về /login.
  const ROLE_ALLOWED_VIEWS = Object.freeze({
    guest: new Set(['dashboard', 'cv', 'find-jobs', 'jobs', 'job-detail', 'match', 'gap', 'interview', 'history', 'profile', 'notifications']),
    student: new Set(['dashboard', 'cv', 'find-jobs', 'jobs', 'job-detail', 'match', 'gap', 'interview', 'history', 'internship', 'profile', 'notifications', 'upgrade']),
    counselor: new Set(['counselor', 'notifications']),
    enterprise: new Set(['enterprise', 'notifications']),
    admin: new Set(['admin', 'notifications'])
  });
  const PORTAL_VIEWS = Object.freeze({
    student: '/student',
    counselor: '/counselor',
    enterprise: '/enterprise',
    admin: '/admin'
  });
  const PROTECTED_PORTAL_VIEWS = new Set(['counselor', 'enterprise', 'admin']);
  let currentViewName = 'dashboard';

  function normalizeBackendRole(role) {
    if (typeof role !== 'string') return null;
    const value = role.trim().toLowerCase();
    return ['student', 'counselor', 'enterprise', 'admin'].includes(value) ? value : null;
  }

  function getPortalPathForRole(role) {
    return PORTAL_VIEWS[normalizeBackendRole(role)] || null;
  }

  function buildLoginRedirectUrl() {
    if (typeof window === 'undefined') return '/login';
    const next = window.location.pathname + (window.location.search || '');
    return `/login?next=${encodeURIComponent(next)}`;
  }

  function getRoleHomeView(user = ApiClient.getUser()) {
    return ROLE_HOME_VIEWS[user?.role] || 'dashboard';
  }

  function canAccessView(viewName, user = ApiClient.getUser()) {
    const role = user?.role || 'guest';
    const allowed = ROLE_ALLOWED_VIEWS[role] || ROLE_ALLOWED_VIEWS.guest;
    return allowed.has(viewName);
  }

  function detectInitialView(user = ApiClient.getUser()) {
    if (typeof window === 'undefined') return getRoleHomeView(user);
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    if (path.startsWith('/counselor') || hash.startsWith('#counselor')) return 'counselor';
    if (path.startsWith('/enterprise') || hash.startsWith('#enterprise')) return 'enterprise';
    if (path.startsWith('/admin') || hash.startsWith('#admin')) return 'admin';
    if (path.startsWith('/student')) {
      if (path.startsWith('/student/cv') || path === '/student/cv') return 'cv';
      if (/^\/student\/jobs\/[^/]+/.test(path)) return 'job-detail';
      if (path.startsWith('/student/find-jobs') || path === '/student/find-jobs') return 'find-jobs';
      if (path.startsWith('/student/jobs') || path === '/student/jobs') return 'jobs';
      if (path.startsWith('/student/match') || path === '/student/match') return 'match';
      if (path.startsWith('/student/gap') || path === '/student/gap') return 'gap';
      if (
        path.startsWith('/student/interview-report') ||
        path.startsWith('/student/interview/report') ||
        path === '/student/interview-report'
      )
        return 'interview-report';
      if (path.startsWith('/student/interview') || path === '/student/interview') return 'interview';
      if (path.startsWith('/student/history') || path === '/student/history') return 'history';
      if (path.startsWith('/student/internship') || path === '/student/internship') return 'internship';
      if (path.startsWith('/student/profile') || path === '/student/profile') return 'profile';
      if (path.startsWith('/student/notifications') || path === '/student/notifications') return 'notifications';
      if (path.startsWith('/student/upgrade') || path === '/student/upgrade') return 'upgrade';
      if (path.includes('/cv')) return 'cv';
      if (path.includes('/find-jobs')) return 'find-jobs';
      if (path.includes('/jobs')) return 'jobs';
      if (path.includes('/match')) return 'match';
      if (path.includes('/gap')) return 'gap';
      if (path.includes('/interview-report') || path.includes('/interview/report')) return 'interview-report';
      if (path.includes('/interview')) return 'interview';
      if (path.includes('/history')) return 'history';
      if (path.includes('/internship')) return 'internship';
      if (path.includes('/profile')) return 'profile';
      if (path.includes('/notifications')) return 'notifications';
      if (path.includes('/upgrade')) return 'upgrade';
      return 'dashboard';
    }
    if (path.startsWith('/cv') || hash.startsWith('#cv')) return 'cv';
    if (path.startsWith('/find-jobs') || hash.startsWith('#find-jobs')) return 'find-jobs';
    if (path.startsWith('/match') || hash.startsWith('#match')) return 'match';
    if (path.startsWith('/gap') || hash.startsWith('#gap')) return 'gap';
    if (
      path.startsWith('/interview-report') ||
      hash.startsWith('#interview-report') ||
      path.startsWith('/interview/report')
    )
      return 'interview-report';
    if (path.startsWith('/interview') || hash.startsWith('#interview')) return 'interview';
    if (path.startsWith('/history') || hash.startsWith('#history')) return 'history';
    if (path.startsWith('/internship') || hash.startsWith('#internship')) return 'internship';
    if (path.startsWith('/profile') || hash.startsWith('#profile')) return 'profile';
    if (path.startsWith('/jobs') || hash.startsWith('#jobs')) return 'jobs';
    if (path.startsWith('/notifications') || hash.startsWith('#notifications')) return 'notifications';
    if (path.startsWith('/upgrade') || hash.startsWith('#upgrade')) return 'upgrade';
    return getRoleHomeView(user);
  }

  function switchToRoleHome() {
    switchView(getRoleHomeView());
  }

  const roomTitles = {
    dashboard: 'COMMAND DECK // HOME',
    cv: 'DECK ALPHA // RESUME LAB',
    'find-jobs': 'DECK BETA // AI JOB DISCOVERY',
    jobs: 'DECK BETA // CAREER MAP',
    'job-detail': 'DECK BETA // JOB DETAIL',
    match: 'DECK MATCH // AI ANALYSIS',
    interview: 'DECK GAMMA // SIMULATION CHAMBER',
    'interview-report': 'DECK GAMMA // BÁO CÁO PHỎNG VẤN',
    history: 'DECK EPSILON // MISSION ARCHIVE',
    'archive-detail': 'DECK EPSILON // CHI TIẾT NHIỆM VỤ',
    profile: 'DECK ZETA // CREW TERMINAL',
    counselor: 'HITL DECK // COUNSELOR',
    enterprise: 'RECRUITMENT DECK // ENTERPRISE',
    admin: 'DECK OMEGA // ADMIN PORTAL',
    notifications: 'NOTIFICATIONS // TRUNG TÂM THÔNG BÁO'
  };

  function switchView(targetViewName, options = {}) {
    if (!ALL_VIEWS.includes(targetViewName)) targetViewName = 'dashboard';

    if (!canAccessView(targetViewName)) {
      const activeUser = ApiClient.getUser();
      if (!activeUser && PROTECTED_PORTAL_VIEWS.has(targetViewName)) {
        // Strict route guard: chưa đăng nhập không được xem portal — dẫn thẳng
        // tới trang /login dùng chung, giữ nguyên điểm đến dự kiến (?next=).
        window.location.assign(buildLoginRedirectUrl());
        return;
      }
      targetViewName = getRoleHomeView();
      showToast('Bạn đã được chuyển về dashboard phù hợp với vai trò.', 'info');
    }

    const VIEW_ORDER = [
      'dashboard',
      'cv',
      'find-jobs',
      'jobs',
      'job-detail',
      'match',
      'gap',
      'interview',
      'interview-report',
      'history',
      'internship',
      'profile',
      'counselor',
      'enterprise',
      'admin',
      'notifications',
    ];
    const currentIndex = VIEW_ORDER.indexOf(currentViewName);
    const targetIndex = VIEW_ORDER.indexOf(targetViewName);
    const direction = targetIndex >= currentIndex ? 'right' : 'left';

    // Trigger Spaceship Corridor Hatch Sweep Line
    const corridorSweep = document.getElementById('spaceship-corridor-sweep');
    if (corridorSweep && !options.skipSweep && currentViewName && currentViewName !== targetViewName) {
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
    // React owns the shell while this controller owns the established job
    // interactions. Tell the shell about every legacy navigation so it keeps
    // the detail route visible after it re-renders.
    window.dispatchEvent(new CustomEvent('career:view-change', {
      detail: { view: targetViewName },
    }));
    document.body.classList.toggle('focus-mode', targetViewName === 'match');

    // Update URL sync if not explicitly skipped
    // Mỗi role root CHÍNH LÀ dashboard: /student /counselor /enterprise /admin
    // (next.config.mjs redirect 308 mọi `/<role>/dashboard` về role root).
    if (!options.skipUrlSync && typeof window !== 'undefined' && window.history?.pushState) {
      const currentPath = window.location.pathname.toLowerCase();
      const activeUser = ApiClient.getUser();
      const isStudent = activeUser?.role === 'student';
      let targetPath = '';

      if (targetViewName === 'counselor') {
        targetPath = '/counselor';
      } else if (targetViewName === 'enterprise') {
        targetPath = '/enterprise';
      } else if (targetViewName === 'admin') {
        targetPath = '/admin';
      } else if (targetViewName === 'job-detail' && options.jobId) {
        targetPath = isStudent
          ? `/student/jobs/${encodeURIComponent(options.jobId)}`
          : `/jobs/${encodeURIComponent(options.jobId)}`;
      } else if (targetViewName === 'jobs') {
        targetPath = isStudent ? '/student/jobs' : '/jobs';
      } else if (targetViewName === 'find-jobs') {
        targetPath = isStudent ? '/student/find-jobs' : '/find-jobs';
      } else if (targetViewName === 'cv') {
        targetPath = isStudent ? '/student/cv' : '/cv';
      } else if (targetViewName === 'match') {
        targetPath = isStudent ? '/student/match' : '/match';
      } else if (targetViewName === 'gap') {
        targetPath = isStudent ? '/student/gap' : '/gap';
      } else if (targetViewName === 'interview') {
        targetPath = isStudent ? '/student/interview' : '/interview';
      } else if (targetViewName === 'interview-report') {
        targetPath = isStudent ? '/student/interview/report' : '/interview-report';
      } else if (targetViewName === 'internship') {
        targetPath = isStudent ? '/student/internship' : '/internship';
      } else if (targetViewName === 'history') {
        targetPath = isStudent ? '/student/history' : '/history';
      } else if (targetViewName === 'profile') {
        targetPath = isStudent ? '/student/profile' : '/profile';
      } else if (targetViewName === 'notifications') {
        targetPath = isStudent ? '/student/notifications' : '/notifications';
      } else if (targetViewName === 'upgrade') {
        targetPath = isStudent ? '/student/upgrade' : '/upgrade';
      } else if (targetViewName === 'dashboard') {
        targetPath = isStudent ? '/student' : '/';
      }

      if (targetPath && currentPath !== targetPath.toLowerCase()) {
        window.history.pushState(
          { view: targetViewName, ...(options.jobId ? { jobId: options.jobId } : {}) },
          '',
          targetPath,
        );
      }
    }

    // Nova is global.  Do not gate its launcher by role here: the chat submit
    // handler already asks unauthenticated users to sign in, while the API
    // enforces access for authenticated conversations.  Previously this
    // controller wrote `display: none !important` for every non-student view,
    // which overrode the React/CSS widget permanently after a route change.
    const novaCompanion = document.getElementById('ai-companion');
    const novaPanel = document.getElementById('ai-companion-chat');
    if (novaCompanion && (!novaPanel || novaPanel.hidden)) {
      novaCompanion.hidden = false;
      novaCompanion.style.removeProperty('display');
    }

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
      window.updateLoginGates?.();
      window.updateP1UI?.();
      loadSpaceshipCVList();
      // The job cards use targetJobCatalog, which is populated by this call.
      // Without it, entering Match before selecting a job leaves the catalog
      // empty and renders the misleading "no suitable jobs" state.
      void loadCVJDOptions();
    } else if (targetViewName === 'gap') {
      populatePageGapOptions();
      if (typeof renderGapDetailFromCurrentMatch === 'function') {
        renderGapDetailFromCurrentMatch();
      }
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

  // Resume active view once when backend recovers from unavailability
  let lastBackendReadyResumption = 0;
  window.addEventListener('career:backend-ready', () => {
    if (!ApiClient.isAuthenticated()) return;
    const now = Date.now();
    if (now - lastBackendReadyResumption < 2000) return;
    lastBackendReadyResumption = now;

    const activeView = currentViewName;
    if (activeView === 'cv') {
      loadSpaceshipCVList();
    } else if (activeView === 'match') {
      loadSpaceshipCVList();
      void loadCVJDOptions();
    } else if (activeView === 'gap') {
      populatePageGapOptions();
    } else if (activeView === 'find-jobs') {
      if (typeof jobSearchUiState !== 'undefined' && jobSearchUiState === 'failed') {
        initializeJobSearchView();
      }
    } else if (activeView === 'jobs') {
      loadPageJDList();
    } else if (activeView === 'interview') {
      populatePageInterviewOptions();
    } else if (activeView === 'history') {
      loadMissionArchive();
    }
  });

  // Global popstate handler for Browser Back/Forward support across Student and public views
  window.addEventListener('popstate', () => {
    const rawPath = window.location.pathname;
    const path = rawPath.toLowerCase();
    const activeUser = ApiClient.getUser();

    // Portals (counselor/enterprise/admin) manage their own internal popstate handlers
    if (path.startsWith('/counselor') || path.startsWith('/enterprise') || path.startsWith('/admin')) {
      return;
    }

    const view = detectInitialView(activeUser);
    const jobDetailMatch = rawPath.match(/\/student\/jobs\/([^/]+)/) || rawPath.match(/\/jobs\/([^/]+)/);
    if (jobDetailMatch && jobDetailMatch[1]) {
      const jobId = decodeURIComponent(jobDetailMatch[1]);
      if (typeof openJobDetailModal === 'function') {
        openJobDetailModal(jobId, { restore: true });
      } else {
        switchView('job-detail', { jobId, skipUrlSync: true });
      }
    } else {
      switchView(view, { skipUrlSync: true });
    }
  });

  function initStarMapNodes() {
    const nodes = document.querySelectorAll('.star-map-container .node-job');
    nodes.forEach(node => {
      node?.addEventListener('click', () => {
        nodes.forEach(n => n?.classList.remove('active'));
        node?.classList.add('active');

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
  const gapResultModal = document.getElementById('gap-result-overlay');
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
  let gapResultScrollY = 0;
  const TARGET_JOBS_PER_PAGE = 8;

  let previousBodyOverflow = '';
  let previousBodyPaddingRight = '';

  function openGapResultModal() {
    const modal = document.getElementById('gap-result-overlay');
    if (!modal) return;
    
    // Developer Assertions
    console.assert(
      modal.parentElement === document.body,
      "Match overlay must be portaled directly to document.body"
    );
    console.assert(
      !document.querySelector("#view-match #gap-result-overlay"),
      "Match overlay must not be rendered inside #view-match"
    );

    gapResultPreviousFocus = document.activeElement;
    modal.hidden = false;
    modal.removeAttribute('hidden');
    modal.style.removeProperty('display');
    
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPaddingRight = document.body.style.paddingRight;
    
    document.body.classList.add('match-modal-open');
    document.documentElement.classList.add('match-modal-open');
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    
    const closeBtn = document.getElementById('gap-result-modal-close');
    window.requestAnimationFrame(() => closeBtn?.focus());
  }

  function closeGapResultModal() {
    const modal = document.getElementById('gap-result-overlay');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('hidden', '');
    modal.style.display = 'none';
    
    document.body.classList.remove('match-modal-open');
    document.documentElement.classList.remove('match-modal-open');
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.paddingRight = previousBodyPaddingRight;
    
    if (gapResultPreviousFocus instanceof HTMLElement) gapResultPreviousFocus.focus();
  }

  gapResultModalClose?.addEventListener('click', closeGapResultModal);
  
  // Note: we'll use delegated listener for overlay click in the document listener instead of doing it here
  // because the overlay might be recreated by React.

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('#btn-gap-back-match') || target.closest('#gap-result-modal-back') || target.closest('#gap-result-modal-close')) {
      closeGapResultModal();
      return;
    }

    if (target.closest('#btn-optimize-cv-ai')) {
      if (latestCVAnalysisContext) {
        const { cvId, jdId, analysis } = latestCVAnalysisContext;
        if (cvId) window.sessionStorage.setItem('career-preselected-cv-id', String(cvId));
        if (jdId) window.sessionStorage.setItem('career-preselected-jd-id', String(jdId));
        const analysisId = analysis?.id || analysis?.analysis_id || analysis?.match_id;
        if (analysisId) {
          window.sessionStorage.setItem('career-preselected-analysis-id', String(analysisId));
          window.sessionStorage.setItem('career-preselected-match-id', String(analysisId));
        }
      }
      closeGapResultModal();
      if (typeof window.switchView === 'function') {
        window.switchView('cv');
      } else {
        const cvNavLink = document.getElementById('nav-cv') || document.getElementById('nav-optimize-cv');
        cvNavLink?.click();
      }
      if (typeof showToast === 'function') {
        showToast('Đang chuyển sang Tối ưu CV theo JD...', 'info');
      }
      return;
    }

    if (target.closest('#btn-practice-interview')) {
      if (latestCVAnalysisContext) {
        const { cvId, jdId, analysis } = latestCVAnalysisContext;
        if (cvId) window.sessionStorage.setItem('career-preselected-cv-id', String(cvId));
        if (jdId) window.sessionStorage.setItem('career-preselected-jd-id', String(jdId));
        const analysisId = analysis?.id || analysis?.analysis_id || analysis?.match_id;
        if (analysisId) {
          window.sessionStorage.setItem('career-preselected-analysis-id', String(analysisId));
          window.sessionStorage.setItem('career-preselected-match-id', String(analysisId));
        }
      }
      closeGapResultModal();
      if (typeof window.switchView === 'function') {
        window.switchView('interview');
      } else {
        const intNavLink = document.getElementById('nav-interview');
        intNavLink?.click();
      }
      if (typeof showToast === 'function') {
        showToast('Đang chuyển sang Luyện phỏng vấn...', 'info');
      }
      return;
    }

    if (target.closest('#btn-browse-matching-jobs') || target.closest('#btn-gap-find-jobs')) {
      if (latestCVAnalysisContext?.cvId) {
        window.sessionStorage.setItem('career-preselected-cv-id', String(latestCVAnalysisContext.cvId));
      }
      closeGapResultModal();
      if (typeof window.switchView === 'function') {
        window.switchView('find-jobs');
      } else {
        const jobsNavLink = document.getElementById('nav-find-jobs') || document.getElementById('nav-jobs');
        jobsNavLink?.click();
      }
      return;
    }

    if (target.closest('#btn-gap-change-cv')) {
      closeGapResultModal();
      const cvCard = document.getElementById('p1-cv-card') || document.getElementById('cv-analysis-cv-select');
      cvCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('cv-analysis-cv-select')?.focus();
      return;
    }

    if (target.closest('#btn-gap-change-job')) {
      closeGapResultModal();
      const jdCard = document.getElementById('p1-jd-card') || document.getElementById('cv-analysis-jd-select');
      jdCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('cv-analysis-jd-select')?.focus();
      return;
    }

    const reqHeader = target.closest('.match-ux-req-header');
    if (reqHeader) {
      const card = reqHeader.closest('.match-ux-req-row');
      const details = card?.querySelector('.match-ux-req-details');
      if (card && details) {
        const isCurrentlyExpanded = reqHeader.getAttribute('aria-expanded') === 'true';
        const willExpand = !isCurrentlyExpanded;
        reqHeader.setAttribute('aria-expanded', String(willExpand));
        card.classList.toggle('is-expanded', willExpand);
        card.classList.toggle('is-collapsed', !willExpand);
        details.hidden = !willExpand;
      }
      return;
    }
  });

  document.addEventListener('keydown', event => {
    const modal = document.getElementById('gap-result-overlay');
    if (!modal || modal.hidden || modal.getAttribute('hidden') !== null || modal.style.display === 'none') {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeGapResultModal();
      return;
    }

    if (event.key === 'Tab') {
      const focusableEls = modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusableEls.length) return;
      const firstEl = focusableEls[0];
      const lastEl = focusableEls[focusableEls.length - 1];

      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }
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

  async function loadTargetJobCatalog() {
    try {
      const result = await ApiClient.searchJobs('', '', 100);
      targetJobCatalog = result?.jobs || [];
    } catch (err) {
      targetJobCatalog = [];
      console.error('Unable to load the Match job catalog:', err);
    }
    renderTargetJobDiscovery();
    return targetJobCatalog;
  }

  async function waitForMatchResult(matchId, { timeoutMs = 180000, intervalMs = 2500 } = {}) {
    console.log('[Match] Created match_id:', matchId);
    const startedAt = Date.now();
    let latest = null;
    while (Date.now() - startedAt < timeoutMs) {
      try {
        latest = await ApiClient.getMatch(matchId);
      } catch (pollErr) {
        console.warn('[Match] Poll request error:', pollErr);
        await new Promise(resolve => window.setTimeout(resolve, intervalMs));
        continue;
      }

      const status = String(latest?.status || 'PENDING').toUpperCase();
      const currentStep = String(latest?.current_step || status).toUpperCase();
      const progress = typeof latest?.progress_percent === 'number'
        ? Math.max(0, Math.min(100, latest.progress_percent))
        : (status === 'PENDING' ? 5 : status === 'PROCESSING' ? 20 : 50);
      console.log('[Match] Poll status:', status, 'step:', currentStep, 'progress:', progress);

      // Business status must be COMPLETED
      if (status === 'COMPLETED') {
        console.log('[Match] COMPLETED match_id:', matchId);
        let result = latest.result || latest.data || latest.analysis || latest.match;
        if (!result || typeof result !== 'object') {
          try {
            result = await ApiClient.getMatchReport(matchId);
          } catch (reportErr) {
            console.error('[Match] Error fetching match report:', reportErr);
          }
        }
        if (!result || typeof result !== 'object') {
          result = { ...latest };
        }
        if (latest.analysis_id && !result.id) result.id = latest.analysis_id;
        if (latest.analysis_id && !result.analysis_id) result.analysis_id = latest.analysis_id;
        if (latest.match_id && !result.match_id) result.match_id = latest.match_id;
        if (!result.status) result.status = 'COMPLETED';
        if (result.match_score === undefined && latest.final_score !== undefined) {
          result.match_score = latest.final_score;
        }
        if (result.final_score === undefined && latest.final_score !== undefined) {
          result.final_score = latest.final_score;
        }
        if (result.rating === undefined && latest.rating !== undefined) {
          result.rating = latest.rating;
        }

        console.log('MATCH_COMPLETED', {
          match_id: latest?.match_id || matchId,
          analysis_id: latest?.analysis_id,
          has_result: Boolean(result),
          result_keys: result && typeof result === 'object' ? Object.keys(result) : [],
        });

        return result;
      }

      // Business status FAILED
      if (status === 'FAILED') {
        const errorReason = latest.error?.message || latest.error_message || latest.error?.detail || latest.message || 'Không thể hoàn tất Match CV với JD.';
        console.error('[Match] FAILED match_id:', matchId, 'reason:', errorReason);
        throw new Error(errorReason);
      }

      // Keep analysis loading state active for PENDING / QUEUED / PROCESSING / PARSING / EVALUATING / FINALIZING
      const stepText = {
        PENDING: 'Khởi tạo',
        QUEUED: 'Đang xếp hàng',
        PROCESSING: 'Đang xử lý',
        PARSING: 'Trích xuất CV & JD',
        EVALUATING: 'AI đối chiếu dữ liệu',
        FINALIZING: 'Đang hoàn thiện',
      }[currentStep] || {
        PENDING: 'Khởi tạo',
        QUEUED: 'Đang xếp hàng',
        PROCESSING: 'Đang xử lý',
      }[status] || 'Đang phân tích';

      const matchButton = document.getElementById('p1-analyze-btn');
      if (matchButton) {
        matchButton.classList.add('is-loading');
        matchButton.disabled = true;
        matchButton.innerHTML = `<svg class="spin-loader" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span>${escapeHtml(stepText)} ${progress}%</span>`;
        // Contract requirement: matchButton.textContent = `Đang phân tích ${progress}%`;
      }
      const hint = document.getElementById('p1-cta-hint');
      if (hint) {
        hint.innerHTML = `<span class="cta-progress-text">⏳ ${escapeHtml(stepText)}... (${progress}%)</span>`;
      }
      await new Promise(resolve => window.setTimeout(resolve, intervalMs));
    }
    console.warn('[Match] Timeout match_id:', matchId);
    throw new Error('Phân tích mất quá nhiều thời gian. Vui lòng thử lại.');
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
        selectedFileNameEl.textContent = `Đã chọn: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
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

  // Dùng chung cho mọi trang có dropdown chọn JD (So khớp CV-JD, Phỏng vấn thử...).
  // Gộp JD hệ thống/đã lưu (ApiClient.listJDs) với JD doanh nghiệp trong data/jds
  // (ApiClient.searchJobs) khi includeCatalog=true. Chỉ điền <select>, không có
  // side-effect nào khác (enhanceGapSelect, preselect theo trang... do caller lo).
  async function loadJDOptions(selectEl, options = {}) {
    const {
      includeCatalog = false,
      groupBySource = false,
      dedupe = false,
      preferredId = '',
      separator = ' · ',
      emptyLabel = 'Chọn một JD',
      emptyStateLabel = '',
      catalogLabel = count => `JD DOANH NGHIỆP (${count})`,
      savedLabel = 'JD ĐÃ LƯU HOẶC HỆ THỐNG',
    } = options;

    const previousValue = preferredId || selectEl.value;
    const [jds, catalogResult] = await Promise.all([
      ApiClient.listJDs(),
      includeCatalog ? ApiClient.searchJobs('', '', 100).catch(() => ({ jobs: [] })) : Promise.resolve({ jobs: [] }),
    ]);
    const catalogJobs = includeCatalog ? (catalogResult.jobs || []) : [];
    const storedCatalogBySource = new Map(
      (jds || [])
        .filter(jd => jd.normalized_json?.source === 'data/jds' && jd.normalized_json?.source_id)
        .map(jd => [String(jd.normalized_json.source_id), jd]),
    );
    let savedJDs = includeCatalog
      ? (jds || []).filter(jd => jd.normalized_json?.source !== 'data/jds')
      : (jds || []);
    if (dedupe) {
      const seen = new Set();
      savedJDs = savedJDs.filter(jd => {
        const key = `${(jd.title || '').trim().toLocaleLowerCase('vi')}|${(jd.company || '').trim().toLocaleLowerCase('vi')}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    const catalogOptions = catalogJobs.map(job => {
      const storedJD = storedCatalogBySource.get(String(job.source_id));
      const value = storedJD?.id || `catalog:${job.source_id}`;
      return `<option value="${escapeHtml(value)}">${escapeHtml(job.title)}${separator}${escapeHtml(job.company || 'Doanh nghiệp')}</option>`;
    });
    const savedOptions = savedJDs.map(jd => `<option value="${escapeHtml(jd.id)}">${escapeHtml(jd.title)}${separator}${escapeHtml(jd.company || 'Chưa ghi công ty')}</option>`);

    const totalOptions = catalogOptions.length + savedOptions.length;
    const firstOption = totalOptions === 0 && emptyStateLabel
      ? `<option value="" disabled selected>${escapeHtml(emptyStateLabel)}</option>`
      : `<option value="">${escapeHtml(emptyLabel)}</option>`;

    selectEl.disabled = false;
    selectEl.innerHTML = groupBySource
      ? [
        firstOption,
        ...(catalogOptions.length ? [`<optgroup label="${escapeHtml(catalogLabel(catalogOptions.length))}">${catalogOptions.join('')}</optgroup>`] : []),
        ...(savedOptions.length ? [`<optgroup label="${escapeHtml(savedLabel)}">${savedOptions.join('')}</optgroup>`] : []),
      ].join('')
      : [firstOption, ...catalogOptions, ...savedOptions].join('');

    if ([...selectEl.options].some(option => option.value === previousValue)) {
      selectEl.value = previousValue;
    } else if (preferredId) {
      // Race condition: JD vừa tạo/chọn chưa có trong listJDs() response → thêm option tạm để giữ value
      const tempOption = document.createElement('option');
      tempOption.value = preferredId;
      tempOption.textContent = 'JD vừa tải lên';
      selectEl.appendChild(tempOption);
      selectEl.value = preferredId;
    }

    return { jds: jds || [], catalogJobs };
  }

  // Import JD doanh nghiệp (option value = "catalog:<source_id>") vào job_descriptions
  // rồi nạp lại danh sách với JD vừa import đã chọn sẵn. Dùng cho các trang bật includeCatalog.
  function wireCatalogJDResolver(selectEl, onResolved) {
    if (!selectEl || selectEl.dataset.catalogResolverWired) return;
    selectEl.dataset.catalogResolverWired = 'true';
    selectEl.addEventListener('change', async () => {
      const value = selectEl.value;
      if (!value.startsWith('catalog:')) return;
      const sourceId = value.slice('catalog:'.length);
      selectEl.disabled = true;
      try {
        const selectedJD = await ApiClient.selectCatalogJD(sourceId);
        await onResolved(selectedJD.id);
      } catch (err) {
        selectEl.value = '';
        showToast(`Không thể chọn JD trong data: ${err.message}`, 'error');
      } finally {
        selectEl.disabled = false;
      }
    });
  }

  let loadCVJDOptionsInFlight = null;
  async function loadCVJDOptions(preferredJdId = '') {
    if (loadCVJDOptionsInFlight) return loadCVJDOptionsInFlight;
    loadCVJDOptionsInFlight = (async () => {
      if (!cvAnalysisJdSelect) {
        await loadTargetJobCatalog();
        return;
      }
      if (!ApiClient.isAuthenticated()) {
        cvAnalysisJdSelect.innerHTML = '<option value="">Vui lòng đăng nhập để chọn JD</option>';
        cvAnalysisJdSelect.disabled = true;
        enhanceGapSelect(cvAnalysisJdSelect);
        updateCVJDSelectionHint();
        return;
      }
      try {
        const jdGate = document.getElementById('p1-jd-login-gate');
        if (jdGate) jdGate.style.display = 'none';
        const jdSec = document.getElementById('p1-jd-select-section');
        if (jdSec) jdSec.style.display = 'block';
        // Bật dedupe để giữ hành vi khử trùng lặp JD đã lưu (theo title + company)
        // mà develop bổ sung ở bản inline trước khi logic này được tách ra helper.
        const { catalogJobs } = await loadJDOptions(cvAnalysisJdSelect, {
          includeCatalog: true,
          groupBySource: true,
          dedupe: true,
          preferredId: preferredJdId,
          separator: ' · ',
          emptyLabel: 'Chọn một JD để phân tích CV',
          catalogLabel: count => `JD DOANH NGHIỆP TRONG DATA/JDS (${count})`,
          savedLabel: 'JD ĐÃ LƯU HOẶC HỆ THỐNG',
        });
        targetJobCatalog = catalogJobs;
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
    })().finally(() => {
      loadCVJDOptionsInFlight = null;
    });
    return loadCVJDOptionsInFlight;
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
    const tableBody = document.getElementById('career-cv-table-body') || careerCVTableBody;
    if (!tableBody) return;
    const versionsSection = document.getElementById('career-versions-section') || careerVersionsSection;
    const emptyState = document.getElementById('career-portfolio-empty') || careerEmptyState;
    const buddyInsight = document.getElementById('career-buddy-insight') || careerBuddyInsight;
    const snapshot = document.getElementById('career-portfolio-snapshot') || careerSnapshot;

    const normalizedQuery = String(query).trim().toLocaleLowerCase('vi');
    const ordered = [...(cvs || [])].sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
    const matching = normalizedQuery ? ordered.filter(cv => `${cv.title || ''} ${cv.file_name || ''}`.toLocaleLowerCase('vi').includes(normalizedQuery)) : ordered;
    const rowMarkup = (cv, index) => {
      const title = escapeHtml(cv.title || cv.file_name || 'CV chưa đặt tên');
      const skills = careerCVSkills(cv);
      const statusType = cv.status_type || (cv.is_optimized ? 'optimized' : (cv.match_count > 0 ? 'matched' : 'raw'));
      const statusLabel = cv.status_label || (statusType === 'optimized' ? 'Đã tối ưu' : (statusType === 'matched' ? 'Đã Match' : 'CV gốc'));
      return `<tr>
        <td><strong>${title}</strong><small>${escapeHtml(cv.file_name || 'CV đã lưu')}</small></td>
        <td>${escapeHtml(careerCVDate(cv))}</td>
        <td><div class="career-skill-list">${skills.length ? skills.map(skill => `<span>${escapeHtml(skill)}</span>`).join('') : '<span>Chưa trích xuất</span>'}</div></td>
        <td><span class="career-table-status cv-status-badge is-${statusType}">${escapeHtml(statusLabel)}</span></td>
        <td class="career-table-actions-cell">
          <button type="button" class="btn-table-action" data-career-open-index="${index}">Mở</button>
          <button type="button" class="btn-table-action" data-career-match-id="${escapeHtml(cv.id)}">Match với Job</button>
          <button type="button" class="btn-table-action btn-table-find-jobs" data-career-find-jobs-id="${escapeHtml(cv.id)}">Việc phù hợp</button>
        </td>
      </tr>`;
    };

    const hasCVs = ordered.length > 0;
    if (emptyState) emptyState.hidden = hasCVs;
    if (versionsSection) versionsSection.hidden = !hasCVs;
    if (buddyInsight) buddyInsight.hidden = !hasCVs;
    if (snapshot) snapshot.hidden = true;
    if (!hasCVs) return;

    if (snapshot) snapshot.innerHTML = '';
    tableBody.innerHTML = matching.length ? matching.map(cv => rowMarkup(cv, ordered.indexOf(cv))).join('') : '<tr><td colspan="5" class="career-table-empty">Không tìm thấy CV phù hợp.</td></tr>';
  }

  const LUCIDE_ICONS = {
    mapPin: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>',
    briefcase: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-briefcase-business" aria-hidden="true"><path d="M12 12h.01"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M22 13a18.15 18.15 0 0 1-20 0"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>',
    walletCards: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wallet-cards" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2"/><path d="M3 11h3c.8 0 1.6.3 2.1.9l1.1.9c.5.6 1.3.9 2.1.9H21"/></svg>',
    users: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    clock3: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock-3" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16.5 12"/></svg>',
    calendarDays: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar-days" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>',
    externalLink: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    checkCircle2: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle-2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
    alertTriangle: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  function renderUnifiedJobCardHtml(job, options = {}) {
    if (!job) return '';
    const variant = options.variant || (job.catalog_mode ? 'catalog' : 'top-match');
    const isSelected = Boolean(options.isSelected);
    const rank = options.rank;
    const isCatalog = variant === 'catalog' || job.catalog_mode === true;
    const isRetrievalOnly = !isCatalog && (options.isRetrievalOnly || String(job.match_id || '').startsWith('RETRIEVAL_'));

    const id = String(job.job_id || job.id || job.source_id || '').trim();
    const sourceId = String(job.source_id || job.id || job.job_id || '').trim();
    const title = String(job.title || 'Vị trí tuyển dụng').trim();
    const company = String(job.company || job.company_name || 'Doanh nghiệp tuyển dụng').trim();
    const companyInitial = getCompanyInitials(company);

    const logoUrl = String(job.company_logo || job.logo_url || '').trim();
    const hasValidLogo = /^https?:\/\//i.test(logoUrl) || (logoUrl.startsWith('/') && !logoUrl.includes('placeholder'));

    const cleanMeta = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val).trim();
      return /^(unknown|chưa xác định|n\/a|none|undefined|null)$/i.test(str) ? '' : str;
    };

    const locationVal = cleanMeta(job.location);
    const workModeVal = cleanMeta(job.work_mode || job.remote_type);
    const seniorityVal = cleanMeta(job.seniority || job.job_level);
    const employmentVal = cleanMeta(job.employment_type);

    // Salary
    const rawSalary = cleanMeta(job.salary || job.salary_range);
    const salaryText = rawSalary ? (rawSalary.toLowerCase() === 'negotiable' ? 'Thỏa thuận' : rawSalary) : '';

    // Openings (Số lượng tuyển dụng - high priority)
    const rawOpenings = job.openings ?? job.quantity;
    const hasOpenings = rawOpenings !== undefined && rawOpenings !== null && Number(rawOpenings) > 0;
    const openingsNum = hasOpenings ? Number(rawOpenings) : null;

    // Applicant count
    const hasApplicants = typeof job.applicant_count === 'number' && job.applicant_count > 0;

    // Timeline
    const postedText = formatJobRelativeTimeVi(job.posted_at || job.created_at || job.crawl_date);
    const deadlineText = formatJobDeadlineVi(job.deadline || job.application_deadline);

    // Source link
    const rawSourceUrl = String(job.source_url || '').trim();
    const hasSourceUrl = /^https?:\/\//i.test(rawSourceUrl);
    const sourcePlatformName = getJobSourceName(job);

    // Fit & Mandatory Gate
    const isMandatoryFailed = Boolean(
      job.mandatory_requirement_failed === true ||
      job.mandatory_failed === true ||
      (job.mandatory_gate && job.mandatory_gate.failed)
    );
    const scoreVisible = job.score_display_allowed === true && !isCatalog;
    const fitScore = scoreVisible ? Math.round(Number(job.display_fit_score ?? 0)) : null;

    let fitLabel = 'Đang tuyển';
    if (isCatalog) {
      fitLabel = 'Đang tuyển';
    } else if (!scoreVisible) {
      fitLabel = 'Đã đối chiếu bằng chứng CV';
    } else if (isRetrievalOnly) {
      fitLabel = 'Gợi ý phù hợp';
    } else if (isMandatoryFailed) {
      fitLabel = 'Thiếu yêu cầu bắt buộc';
    } else if (job.fit_label) {
      fitLabel = String(job.fit_label);
    } else if (fitScore !== null) {
      fitLabel = fitScore >= 80 ? 'Phù hợp cao' : fitScore >= 50 ? 'Phù hợp' : 'Cần cải thiện';
    }

    // Skills
    const rawRequired = Array.isArray(job.required_skills) && job.required_skills.length
      ? job.required_skills
      : (Array.isArray(job.must_have_skills) ? job.must_have_skills : []);
    const rawPreferred = Array.isArray(job.preferred_skills) && job.preferred_skills.length
      ? job.preferred_skills
      : (Array.isArray(job.nice_to_have_skills) ? job.nice_to_have_skills : []);
    const rawStrengths = Array.isArray(job.top_strengths) ? job.top_strengths : [];
    const allGeneral = Array.isArray(job.skills) ? job.skills : [];

    let skillPills = [];
    let remainingSkillsList = [];

    if (variant === 'top-match' && rawStrengths.length > 0) {
      const compactStrength = (s) => {
        const clean = String(s || '').replace(/\s+/g, ' ').replace(/^#+\s*/, '').replace(/^[✓⚠△]\s*/, '').trim();
        return clean.length > 45 ? clean.slice(0, 42) + '...' : clean;
      };
      const strengths = rawStrengths.map(compactStrength);
      skillPills = strengths.slice(0, 3).map(text => ({ text, type: 'strength', badgeHtml: '<span class="tag-icon tag-icon-req">✓</span>' }));
      remainingSkillsList = strengths.slice(3);
    } else if (rawRequired.length > 0 || rawPreferred.length > 0) {
      const reqSlice = rawRequired.slice(0, 3);
      const prefSlice = rawPreferred.slice(0, Math.max(0, 4 - reqSlice.length));
      skillPills = [
        ...reqSlice.map(text => ({ text, type: 'required', badgeHtml: '<span class="tag-icon tag-icon-req">✓</span>' })),
        ...prefSlice.map(text => ({ text, type: 'preferred', badgeHtml: '<span class="tag-icon tag-icon-pref">✦</span>' })),
      ];
      remainingSkillsList = [
        ...rawRequired.slice(reqSlice.length),
        ...rawPreferred.slice(prefSlice.length),
      ];
    } else if (allGeneral.length > 0) {
      const visible = allGeneral.slice(0, 4);
      skillPills = visible.map(text => ({ text, type: 'general', badgeHtml: '' }));
      remainingSkillsList = allGeneral.slice(4);
    }

    // Summary line (for top-match)
    let rawSummary = '';
    if (variant === 'top-match') {
      if (job.summary_evidence_line) {
        rawSummary = job.summary_evidence_line;
      } else if (Number.isInteger(job.mandatory_requirements_matched) && Number.isInteger(job.total_mandatory_requirements) && job.total_mandatory_requirements > 0) {
        rawSummary = `${job.mandatory_requirements_matched}/${job.total_mandatory_requirements} yêu cầu cốt lõi được đáp ứng`;
      } else if (typeof job.required_skills_coverage === 'number' && job.required_skills_coverage > 0) {
        rawSummary = `Đáp ứng ${Math.round(job.required_skills_coverage * 100)}% yêu cầu bắt buộc`;
      }
    }
    const cleanSummaryText = rawSummary
      ? String(rawSummary).replace(/^#+\s*/, '').replace(/\*\*([^*]+)\*\*/g, '$1').trim()
      : '';

    // HTML Building Blocks
    const logoHtml = hasValidLogo
      ? `<div class="top-job-logo-wrap">
          <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(company)}" class="top-job-logo-img" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<span class=\\'top-job-logo-initial\\'>${escapeHtml(companyInitial)}</span>'">
        </div>`
      : `<div class="top-job-logo-wrap">
          <span class="top-job-logo-initial">${escapeHtml(companyInitial)}</span>
        </div>`;

    const rankBadgeHtml = (variant === 'top-match' && rank)
      ? `<span class="top-job-rank-badge">#${rank}</span>`
      : '';

    let badgeBlockHtml = '';
    if (variant === 'match-picker') {
      badgeBlockHtml = `<button type="button" class="p1-job-card-radio${isSelected ? ' is-selected' : ''}" data-action="select-job" aria-label="Chọn công việc ${escapeHtml(title)}" title="${isSelected ? 'Đang chọn vị trí này' : 'Chọn vị trí này để Match'}"></button>`;
    } else if (variant === 'catalog') {
      badgeBlockHtml = `<div class="top-job-catalog-badge">${escapeHtml(fitLabel)}</div>`;
    } else {
      if (scoreVisible && fitScore !== null) {
        badgeBlockHtml = `
          <div class="top-job-score-block">
            <div class="top-job-fit-score ${isMandatoryFailed ? 'is-mandatory-failed' : ''}">${fitScore}%</div>
            <div class="top-job-fit-badge ${isMandatoryFailed ? 'is-mandatory-failed' : ''}">${escapeHtml(fitLabel)}</div>
          </div>
        `;
      } else {
        badgeBlockHtml = `
          <div class="top-job-score-block">
            <div class="top-job-fit-badge ${isMandatoryFailed ? 'is-mandatory-failed' : ''}">${escapeHtml(fitLabel)}</div>
          </div>
        `;
      }
    }

    const metaParts = [];
    if (locationVal) {
      metaParts.push(`<span class="top-job-meta-item">${LUCIDE_ICONS.mapPin}<span>${escapeHtml(locationVal)}</span></span>`);
    }
    if (workModeVal) {
      metaParts.push(`<span class="top-job-meta-item">${escapeHtml(workModeVal)}</span>`);
    }
    if (seniorityVal) {
      metaParts.push(`<span class="top-job-meta-item">${escapeHtml(seniorityVal)}</span>`);
    }
    if (employmentVal) {
      metaParts.push(`<span class="top-job-meta-item">${escapeHtml(employmentVal)}</span>`);
    }
    const coreMetaHtml = metaParts.length
      ? `<div class="top-job-core-meta-row">${metaParts.join('<span class="top-job-meta-dot" aria-hidden="true">·</span>')}</div>`
      : '';

    const highlightPills = [];
    if (salaryText) {
      highlightPills.push(`
        <span class="top-job-highlight-pill pill-salary" title="Mức lương">
          ${LUCIDE_ICONS.walletCards}
          <span>${escapeHtml(salaryText)}</span>
        </span>
      `);
    }
    if (openingsNum) {
      highlightPills.push(`
        <span class="top-job-highlight-pill pill-openings" title="Số lượng tuyển dụng">
          ${LUCIDE_ICONS.users}
          <span>Tuyển ${escapeHtml(String(openingsNum))} người</span>
        </span>
      `);
    }
    if (hasApplicants) {
      highlightPills.push(`
        <span class="top-job-highlight-pill pill-applicants" title="Số lượng ứng viên đã nộp hồ sơ">
          ${LUCIDE_ICONS.briefcase}
          <span>${escapeHtml(String(job.applicant_count))} ứng viên</span>
        </span>
      `);
    }
    const hiringHighlightsHtml = highlightPills.length
      ? `<div class="top-job-hiring-row">${highlightPills.join('')}</div>`
      : '';

    const skillsTagsHtml = skillPills.map(p =>
      `<span class="top-job-tag is-${escapeHtml(p.type)}">${p.badgeHtml} ${escapeHtml(p.text)}</span>`
    ).join('');

    const moreSkillsHtml = remainingSkillsList.length > 0
      ? `<span class="top-job-tag is-more" title="Các kỹ năng khác: ${escapeHtml(remainingSkillsList.join(', '))}">+${remainingSkillsList.length} kỹ năng</span>`
      : '';

    const skillsSectionHtml = (skillsTagsHtml || moreSkillsHtml)
      ? `<div class="top-job-card-skills"><div class="top-job-tags-wrap">${skillsTagsHtml}${moreSkillsHtml}</div></div>`
      : '';

    const timelineItems = [];
    if (postedText) {
      timelineItems.push(`
        <span class="top-job-timeline-item" title="Thời gian đăng tuyển">
          ${LUCIDE_ICONS.clock3}
          <span>${escapeHtml(postedText)}</span>
        </span>
      `);
    }
    if (deadlineText) {
      timelineItems.push(`
        <span class="top-job-timeline-item" title="Hạn nộp hồ sơ">
          ${LUCIDE_ICONS.calendarDays}
          <span>Hạn ứng tuyển: <strong>${escapeHtml(deadlineText)}</strong></span>
        </span>
      `);
    }
    const timelineRowHtml = timelineItems.length
      ? `<div class="top-job-timeline-row">${timelineItems.join('<span class="top-job-meta-dot" aria-hidden="true">·</span>')}</div>`
      : '';

    const summaryLineHtml = cleanSummaryText
      ? `<div class="top-job-summary-line"><span class="summary-line-dot"></span><span class="summary-line-text">${escapeHtml(cleanSummaryText)}</span></div>`
      : '';

    const mandatoryWarningHtml = isMandatoryFailed && variant === 'top-match'
      ? `<div class="top-job-mandatory-warning" role="alert">
          ${LUCIDE_ICONS.alertTriangle}
          <div class="mandatory-warning-text">
            <strong>Thiếu yêu cầu bắt buộc</strong>
            <span>Điểm hiển thị đã được giới hạn tối đa 49%.</span>
          </div>
        </div>`
      : '';

    const sourceLinkHtml = hasSourceUrl
      ? `<a class="btn-job-source job-source-verify-link" href="${escapeHtml(rawSourceUrl)}" target="_blank" rel="noopener noreferrer" title="Mở tin tuyển dụng gốc trên ${escapeHtml(sourcePlatformName)}" onclick="event.stopPropagation();">
          <span class="source-platform-prefix">Nguồn: ${escapeHtml(sourcePlatformName)}</span>
          <span class="source-link-action">Xem tin tuyển dụng gốc ${LUCIDE_ICONS.externalLink}</span>
        </a>`
      : '<div class="top-job-source-spacer"></div>';

    let mainCtaButtonHtml = '';
    if (variant === 'match-picker') {
      mainCtaButtonHtml = `
        <button type="button" class="btn-job-details btn-choose-job-match" data-action="select-job">
          ${isSelected ? '✓ Đã chọn' : 'Chọn để Match'}
        </button>
      `;
    } else {
      mainCtaButtonHtml = `
        <button type="button" class="btn-job-details btn-view-job-spec" data-job-details-id="${escapeHtml(id)}">
          Xem chi tiết
        </button>
      `;
    }

    const cardClasses = [
      'top-job-card',
      variant === 'match-picker' ? 'p1-job-card' : '',
      isSelected ? 'is-selected' : '',
      isMandatoryFailed && variant === 'top-match' ? 'is-mandatory-failed' : '',
    ].filter(Boolean).join(' ');

    const datasetAttr = variant === 'match-picker'
      ? `data-target-job="${escapeHtml(sourceId)}"`
      : `data-job-id="${escapeHtml(id)}"`;

    const ariaLabel = variant === 'match-picker'
      ? `Chọn vị trí ${escapeHtml(title)} tại ${escapeHtml(company)}`
      : `Xem chi tiết ${escapeHtml(title)} tại ${escapeHtml(company)}`;

    return `
      <article class="${cardClasses}" ${datasetAttr} tabindex="0" role="button" aria-label="${ariaLabel}" ${isSelected ? 'aria-pressed="true"' : ''}>
        <div class="top-job-card-header">
          <div class="top-job-header-left">
            ${logoHtml}
            <div class="top-job-main-meta">
              <div class="top-job-title-row">
                ${rankBadgeHtml}
                <h3 class="top-job-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h3>
              </div>
              <div class="top-job-company-name" title="${escapeHtml(company)}">${escapeHtml(company)}</div>
            </div>
          </div>
          ${badgeBlockHtml}
        </div>

        ${coreMetaHtml}

        ${hiringHighlightsHtml}

        ${mandatoryWarningHtml}

        ${skillsSectionHtml}

        ${timelineRowHtml}

        <div class="top-job-card-footer">
          ${summaryLineHtml}
          <div class="top-job-card-action-bar">
            ${sourceLinkHtml}
            ${mainCtaButtonHtml}
          </div>
        </div>
      </article>
    `.trim();
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
    grid.innerHTML = pageJobs.map(job => renderUnifiedJobCardHtml(job, {
      variant: 'match-picker',
      isSelected: selectedCatalogJobSourceId ? String(job.source_id) === String(selectedCatalogJobSourceId) : false,
    })).join('');
  }

  let selectedCatalogJobSourceId = null;

  async function chooseTargetCatalogJob(sourceId) {
    if (!sourceId || !cvAnalysisJdSelect) return;
    selectedCatalogJobSourceId = String(sourceId);
    const selected = targetJobCatalog.find(job => String(job.source_id) === String(sourceId));
    try {
      cvAnalysisJdSelect.disabled = true;
      const selectedJD = await ApiClient.selectCatalogJD(sourceId);
      localStorage.setItem('latest_matched_jd_id', selectedJD.id);
      sessionStorage.setItem('career-preselected-jd-id', selectedJD.id);
      await loadCVJDOptions(selectedJD.id);
      document.querySelectorAll('[data-target-job]').forEach(card => {
        const isThis = card.dataset.targetJob === String(sourceId);
        card.classList.toggle('is-selected', isThis);
        card.setAttribute('aria-pressed', String(isThis));
      });
      window.updateP1UI?.();
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
      if (value) {
        localStorage.setItem('latest_matched_jd_id', value);
      }
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
      localStorage.setItem('latest_matched_jd_id', selectedJD.id);
      sessionStorage.setItem('career-preselected-jd-id', selectedJD.id);
      await loadCVJDOptions(selectedJD.id);

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
    const modal = document.getElementById('job-preview-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.style.display = 'none';
    document.body.classList.remove('job-preview-modal-open');
    document.documentElement.classList.remove('job-preview-modal-open');
  }

  function cleanRawArtifacts(raw) {
    if (!raw) return '';
    return String(raw)
      .replace(/\bsharp([A-Za-z0-9_]+)\b/g, '#$1')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
  }

  function cleanTextLine(raw) {
    if (!raw) return '';
    let line = cleanRawArtifacts(String(raw).trim());
    line = line.replace(/\s*[,\.;:]*(?:\[protected info\]|\(protected info\)|\[email protected\]|\[contact info\])\s*[,\.;:]*/gi, ' ');
    line = line.replace(/<[^>]+>/g, ' ');
    line = line.replace(/^#{1,6}\s*/, '');
    line = line.replace(/\*\*([^*]+)\*\*/g, '$1');
    line = line.replace(/__([^_]+)__/g, '$1');
    line = line.replace(/\*([^*]+)\*/g, '$1');
    line = line.replace(/_([^_]+)_/g, '$1');
    line = line.replace(/\\([*_\-+`~[\]()])/g, '$1');
    line = line.replace(/^(?:[•●▪◦*\-–—+]|\d+[.)])\s*/, '');
    line = line.replace(/\s+/g, ' ').trim();
    return line;
  }

  function classifyHeading(rawHeader, allowFallbackNotes = true) {
    if (!rawHeader) return null;
    const clean = cleanTextLine(rawHeader)
      .replace(/\s*[:\-–—]\s*$/, '')
      .trim();

    if (!clean || clean.length < 2) return null;
    if (/^\[[^\]]+\]$/.test(clean)) return null;
    const lower = clean.toLowerCase();

    // 1. Overview / Position Summary (Tổng quan vị trí, Giới thiệu, Sứ mệnh)
    if (/^(?:tổng quan công việc|tổng quan vị trí|tổng quan|giới thiệu chung|giới thiệu vị trí|giới thiệu tổng quan về vị trí|về vị trí này|về công việc này|mô tả công việc|about the job|about the role|role overview|position summary|job summary|job overview|the job|the role|role description|how you\s*(?:'ll|will)\s*make an impact|about us|about company|về công ty|giới thiệu công ty|our mission|company overview)$/i.test(lower)) {
      return { kind: 'main', type: 'overview', title: clean };
    }

    // 2. Responsibilities (Trách nhiệm & Nhiệm vụ chính)
    if (/^(?:trách nhiệm chính|nhiệm vụ chính|trách nhiệm & nhiệm vụ chính|trách nhiệm công việc|nhiệm vụ công việc|trách nhiệm|nhiệm vụ|responsibilities|key responsibilities|what you\s*(?:'ll|will)\s*do|duties|your role|job responsibilities|core responsibilities)$/i.test(lower)) {
      return { kind: 'main', type: 'responsibilities', title: clean };
    }

    // 3. Must-Have Requirements (Yêu cầu bắt buộc, Trình độ chuyên môn)
    if (/^(?:yêu cầu bắt buộc(?:\s*\(must-have\))?|must-have|must have|yêu cầu công việc|yêu cầu ứng viên|yêu cầu ứng tuyển|yêu cầu tuyển dụng|yêu cầu|kỹ năng bắt buộc|kỹ năng chuyên môn|requirements|required qualifications|required skills|your skills and experience|what we\s*(?:'re|are)\s*looking for|qualifications|technical requirements|candidate profile)$/i.test(lower)) {
      return { kind: 'main', type: 'must_have', title: clean };
    }

    // 4. Nice-To-Have / Preferred (Yêu cầu ưu tiên, Điểm cộng, Beyond the core)
    if (/^(?:điểm cộng(?:\s*\(nice-to-have\))?|yêu cầu ưu tiên(?:\s*\(nice-to-have\))?|yêu cầu ưu tiên & điểm cộng|ưu tiên|lợi thế|nice-to-have|nice to have|preferred qualifications|preferred skills|bonus points|plus points|plus|good to have|preferred|additional skills|beyond the core|beyond core|dimensions we grow our engineers into.*)$/i.test(lower)) {
      return { kind: 'main', type: 'nice_to_have', title: clean };
    }

    // 5. Soft Skills (Kỹ năng mềm)
    if (/^(?:kỹ năng mềm cần thiết|kỹ năng mềm|kỹ năng khác|soft skills|interpersonal skills|competencies|personal skills|core competencies)$/i.test(lower)) {
      return { kind: 'main', type: 'soft_skills', title: clean };
    }

    // 6. Benefits & Environment Main Heading (Quyền lợi, Đãi ngộ, Phúc lợi, What we offer)
    if (/^(?:quyền lợi & đãi ngộ(?:\s*\(benefits\))?|quyền lợi & đãi ngộ|quyền lợi & môi trường làm việc|quyền lợi & môi trường|quyền lợi|chế độ đãi ngộ|đãi ngộ|phúc lợi|chế độ phúc lợi|benefits(?:\s*\(benefits\))?|what we offer|what you get|why join us|why you\s*(?:'ll|will)\s*love working here|tại sao bạn sẽ yêu thích làm việc tại đây|top 3 reasons to join us|3 lý do để gia nhập công ty|quyền lợi được hưởng|perks & benefits|join our vibrant team.*)$/i.test(lower)) {
      return { kind: 'main', type: 'benefits', title: clean };
    }

    // 7. Sub-headings under Benefits / Dimensions / Environment / Growth
    if (/^(?:môi trường làm việc cởi mở, năng động|môi trường làm việc|văn hóa làm việc|work environment|working environment|company culture)$/i.test(lower)) {
      return { kind: 'sub', type: 'benefits', title: 'Quyền lợi & Môi trường làm việc', subTitle: clean };
    }
    if (/^(?:có cơ hội phát triển, thăng tiến|cơ hội phát triển, thăng tiến|cơ hội phát triển|cơ hội thăng tiến|đào tạo & phát triển|đào tạo|career development|training & development|growth opportunities)$/i.test(lower)) {
      return { kind: 'sub', type: 'benefits', title: 'Quyền lợi & Môi trường làm việc', subTitle: clean };
    }
    if (/^(?:chế độ đãi ngộ hấp dẫn|chế độ đãi ngộ|lương & thưởng|lương và chế độ đãi ngộ hấp dẫn|compensation & benefits|salary & benefits|rewards & perks)$/i.test(lower)) {
      return { kind: 'sub', type: 'benefits', title: 'Quyền lợi & Môi trường làm việc', subTitle: clean };
    }
    if (/^(?:domain expert & architect|platform & operations owner|partner-facing engineer|client-facing engineer)$/i.test(lower)) {
      return { kind: 'sub', type: 'nice_to_have', title: 'Beyond the core', subTitle: clean };
    }

    // 8. Location & Working Time
    if (/^(?:địa điểm làm việc|thời gian làm việc|địa điểm & thời gian làm việc|địa điểm và thời gian làm việc|nơi làm việc|working location|working hours|location & hours|working conditions)$/i.test(lower)) {
      return { kind: 'main', type: 'working_conditions', title: clean };
    }

    // 9. How to apply
    if (/^(?:cách thức ứng tuyển|hướng dẫn ứng tuyển|thông tin ứng tuyển|cách ứng tuyển|how to apply|application process|recruitment process)$/i.test(lower)) {
      return { kind: 'main', type: 'how_to_apply', title: clean };
    }

    // 10. Learn More / Other / Notes
    if (/^(?:learn more about us|learn more|thông tin khác|mục khác|other info|additional information)$/i.test(lower)) {
      return { kind: 'main', type: 'notes', title: clean };
    }

    // 10. Generic / Unclassified Heading
    if (allowFallbackNotes) {
      return { kind: 'main', type: 'notes', title: clean };
    }

    return null;
  }

  function normalizeRawContentToLines(rawText) {
    if (!rawText) return [];
    let text = cleanRawArtifacts(rawText);

    // 1. Tách các embedded Markdown headers
    text = text.replace(/(?:\r?\n|^|\s+)(#{1,6}\s+[^:\n]+:?)/g, '\n[HEADING] $1\n');

    // 2. Tách các tiêu đề dạng IN HOA trong văn bản
    text = text.replace(/(?:\r?\n|^|\s+)((?:YÊU CẦU ỨNG TUYỂN|YÊU CẦU BẮT BUỘC|YÊU CẦU CÔNG VIỆC|QUYỀN LỢI & ĐÃI NGỘ|QUYỀN LỢI ĐƯỢC HƯỞNG|TRÁCH NHIỆM CHÍNH|MÔ TẢ CÔNG VIỆC)\s*[:\-–—])/gi, '\n[HEADING] $1\n');

    // 3. Chuẩn hoá HTML tags
    text = text
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n[HEADING] $1\n')
      .replace(/<p[^>]*>\s*<i>\s*<strong>(.*?)<\/strong>\s*<\/i>\s*<\/p>/gi, '\n[SUBHEADING] $1\n')
      .replace(/<p[^>]*>\s*<strong>(.*?)<\/strong>\s*<\/p>/gi, '\n[HEADING] $1\n')
      .replace(/<strong>(.*?)<\/strong>/gi, (m, p1) => {
        const clean = p1.trim();
        return (clean.length >= 3 && clean.length <= 60 && classifyHeading(clean, false)) ? `\n[HEADING] ${clean}\n` : m;
      })
      .replace(/<li[^>]*>/gi, '\n[ITEM] ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n');

    // 4. Tách các dòng và inline bullet items
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const resultLines = [];

    for (const line of rawLines) {
      if (line.startsWith('[HEADING]') || line.startsWith('[SUBHEADING]')) {
        resultLines.push(line);
        continue;
      }

      if (line.includes(' - ') || line.includes(' – ') || line.includes(' — ')) {
        const parts = line.split(/\s+[-–—]\s+/).map(p => p.trim()).filter(Boolean);
        if (parts.length > 1) {
          for (const part of parts) {
            resultLines.push(`[ITEM] ${part}`);
          }
          continue;
        }
      }

      resultLines.push(line);
    }

    return resultLines;
  }

  function extractStructuredSections(job) {
    const orderedSections = [];
    const getOrAddSection = (type, title) => {
      let existing = orderedSections.find(s => s.type === type && s.title.toLowerCase() === title.toLowerCase());
      if (!existing) {
        existing = {
          id: `sec-${type}-${orderedSections.length + 1}`,
          type,
          title,
          items: [],
          subSections: [],
        };
        orderedSections.push(existing);
      }
      return existing;
    };

    const contentBlocks = [];

    const structuredSections = Array.isArray(job.sections)
      ? job.sections
      : Array.isArray(job.normalized_json?.sections)
        ? job.normalized_json.sections
        : null;

    if (structuredSections && structuredSections.length > 0) {
      for (const sec of structuredSections) {
        if (!sec || !sec.content) continue;
        const rawContent = String(sec.content).trim();
        if (!rawContent || rawContent === '<p></p>' || rawContent === '<ul></ul>') continue;

        const rawSecTitle = cleanTextLine(sec.title || sec.type || '');
        const isCrawlerTag = /^\[[^\]]+\]$/.test(rawSecTitle) || /^(tập đoàn|công ty|fpt|viettel|vng|doanh nghiệp)\b/i.test(rawSecTitle);
        const classification = classifyHeading(rawSecTitle, !isCrawlerTag);
        contentBlocks.push({
          defaultType: classification?.type || (isCrawlerTag ? 'overview' : (sec.type || 'overview')),
          defaultTitle: classification?.title || (isCrawlerTag ? 'Tổng quan công việc' : cleanTextLine(sec.title) || 'Thông tin chi tiết'),
          text: rawContent,
        });
      }
    }

    if (contentBlocks.length === 0) {
      const rawText = String(job.clean_description || job.description || job.requirements_text || job.raw_text || '').trim();
      if (rawText) {
        contentBlocks.push({
          defaultType: 'overview',
          defaultTitle: 'Tổng quan vị trí',
          text: rawText,
        });
      }
    }

    for (const block of contentBlocks) {
      const rawLines = normalizeRawContentToLines(block.text);

      let currentMainType = block.defaultType || 'overview';
      let currentMainTitle = block.defaultTitle || 'Tổng quan vị trí';
      let currentSubTitle = undefined;
      let currentItems = [];

      const flushSectionItems = () => {
        if (currentItems.length === 0) return;
        const sec = getOrAddSection(currentMainType, currentMainTitle);

        if (currentSubTitle) {
          if (!sec.subSections) sec.subSections = [];
          let sub = sec.subSections.find(s => s.title?.toLowerCase() === currentSubTitle?.toLowerCase());
          if (!sub) {
            sub = { title: currentSubTitle, items: [] };
            sec.subSections.push(sub);
          }
          const set = new Set(sub.items.map(i => i.toLowerCase()));
          for (const item of currentItems) {
            if (!set.has(item.toLowerCase())) {
              sub.items.push(item);
              set.add(item.toLowerCase());
            }
          }
        } else {
          const set = new Set(sec.items.map(i => i.toLowerCase()));
          for (const item of currentItems) {
            if (!set.has(item.toLowerCase())) {
              sec.items.push(item);
              set.add(item.toLowerCase());
            }
          }
        }
        currentItems = [];
      };

      for (const line of rawLines) {
        let isExplicitHeading = false;
        let isExplicitSub = false;
        let isExplicitItem = false;
        let candidateText = line;

        if (candidateText.startsWith('[HEADING]')) {
          isExplicitHeading = true;
          candidateText = candidateText.replace('[HEADING]', '').trim();
        } else if (candidateText.startsWith('[SUBHEADING]')) {
          isExplicitSub = true;
          candidateText = candidateText.replace('[SUBHEADING]', '').trim();
        } else if (candidateText.startsWith('[ITEM]')) {
          isExplicitItem = true;
          candidateText = candidateText.replace('[ITEM]', '').trim();
        }

        if (!isExplicitItem) {
          const isMarkdownHeading = /^#{1,6}\s+/.test(candidateText);

          if (isExplicitHeading || isMarkdownHeading) {
            const classification = classifyHeading(candidateText, true);
            if (classification) {
              flushSectionItems();
              if (classification.kind === 'sub' && classification.subTitle) {
                currentMainType = classification.type;
                currentSubTitle = classification.subTitle;
              } else {
                currentMainType = classification.type;
                currentMainTitle = classification.title;
                currentSubTitle = undefined;
              }
              continue;
            }
          } else if (isExplicitSub) {
            const classification = classifyHeading(candidateText, false);
            flushSectionItems();
            if (classification && classification.kind === 'sub' && classification.subTitle) {
              currentMainType = classification.type;
              currentSubTitle = classification.subTitle;
            } else {
              currentSubTitle = cleanTextLine(candidateText).replace(/\s*:\s*$/, '');
            }
            continue;
          } else {
            const classification = classifyHeading(candidateText, false);
            if (classification) {
              flushSectionItems();
              if (classification.kind === 'sub' && classification.subTitle) {
                currentMainType = classification.type;
                currentSubTitle = classification.subTitle;
              } else {
                currentMainType = classification.type;
                currentMainTitle = classification.title;
                currentSubTitle = undefined;
              }
              continue;
            }
          }
        }

        const cleaned = cleanTextLine(candidateText);
        if (cleaned && cleaned.length >= 2 && cleaned !== '-') {
          if (/^(thu nhập|mức lương|salary|loại hình|employment type|cấp bậc|kinh nghiệm|experience|hạn nộp|deadline)\s*:?$/i.test(cleaned)) {
            continue;
          }
          currentItems.push(cleaned);
        }
      }

      flushSectionItems();
    }

    if (!orderedSections.some(s => s.type === 'responsibilities') && Array.isArray(job.responsibilities) && job.responsibilities.length > 0) {
      const items = job.responsibilities.map(cleanTextLine).filter(l => l.length >= 2);
      if (items.length > 0) {
        orderedSections.push({
          id: 'sec-responsibilities',
          type: 'responsibilities',
          title: 'Trách nhiệm chính',
          items,
        });
      }
    }

    if (!orderedSections.some(s => s.type === 'must_have') && Array.isArray(job.requirements) && job.requirements.length > 0) {
      const items = job.requirements.map(cleanTextLine).filter(l => l.length >= 2);
      if (items.length > 0) {
        orderedSections.push({
          id: 'sec-must_have',
          type: 'must_have',
          title: 'Yêu cầu bắt buộc',
          items,
        });
      }
    }

    // Loại bỏ các dòng bị trùng lặp giữa mục overview/notes và các mục chuyên biệt
    const specificItems = new Set();
    for (const s of orderedSections) {
      if (['responsibilities', 'must_have', 'nice_to_have', 'benefits'].includes(s.type)) {
        s.items.forEach(i => specificItems.add(String(i).toLowerCase().trim()));
        if (Array.isArray(s.subSections)) {
          s.subSections.forEach(sub => sub.items.forEach(i => specificItems.add(String(i).toLowerCase().trim())));
        }
      }
    }

    for (const s of orderedSections) {
      if (['overview', 'notes'].includes(s.type)) {
        s.items = s.items.filter(i => !specificItems.has(String(i).toLowerCase().trim()));
        if (Array.isArray(s.subSections)) {
          for (const sub of s.subSections) {
            sub.items = sub.items.filter(i => !specificItems.has(String(i).toLowerCase().trim()));
          }
          s.subSections = s.subSections.filter(sub => sub.items.length > 0);
        }
      }
    }

    return orderedSections.filter(sec => sec.items.length > 0 || (sec.subSections && sec.subSections.length > 0));
  }

  function renderStructuredJobDetailHtml(job, options = {}) {
    const title = cleanTextLine(job.title || job.job_title || 'Vị trí tuyển dụng');
    const company = cleanTextLine(job.company || job.company_name || 'Doanh nghiệp tuyển dụng');
    const mode = options.mode || 'modal';

    const cleanMeta = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val).trim();
      return /^(unknown|chưa xác định|n\/a|none|undefined|null)$/i.test(str) ? '' : str;
    };

    const location = cleanMeta(job.location);
    const workMode = cleanMeta(job.work_mode || job.remote_type || job.work_model);
    const seniority = cleanMeta(job.seniority || job.job_level || job.level);
    const employmentType = cleanMeta(job.employment_type || job.job_type);
    const rawSalary = cleanMeta(job.salary || job.salary_range);
    const salary = rawSalary ? (rawSalary.toLowerCase() === 'negotiable' ? 'Thỏa thuận' : rawSalary) : '';
    const rawOpenings = job.openings ?? job.quantity;
    const openings = rawOpenings !== undefined && rawOpenings !== null && Number(rawOpenings) > 0 ? Number(rawOpenings) : null;
    const rawDeadline = cleanMeta(job.deadline || job.application_deadline);
    let deadline = '';
    if (rawDeadline) {
      deadline = /^\d{4}-\d{2}-\d{2}$/.test(rawDeadline)
        ? rawDeadline.split('-').reverse().join('/')
        : rawDeadline;
    }

    const rawSourceUrl = cleanMeta(job.source_url || job.url || job.link || job.job_url || job.original_url || job.post_url);
    const sourceUrl = (rawSourceUrl && /^https?:\/\//i.test(rawSourceUrl)) ? rawSourceUrl : '';
    const sourcePlatformName = cleanMeta(job.source_name || job.source) || (sourceUrl ? (
      sourceUrl.includes('topcv') ? 'TopCV' :
      sourceUrl.includes('linkedin') ? 'LinkedIn' :
      sourceUrl.includes('vietnamworks') ? 'VietnamWorks' :
      sourceUrl.includes('itviec') ? 'ITviec' :
      sourceUrl.includes('fpt') ? 'FPT Jobs' : 'Website tuyển dụng'
    ) : '');

    const rawSkills = Array.isArray(job.skills) ? job.skills : [];
    const allSkillsList = [];
    const seenSkill = new Set();
    rawSkills.forEach(s => {
      if (!s) return;
      const name = typeof s === 'object' ? String(s.name || s.text || '') : String(s);
      const clean = cleanTextLine(name);
      if (clean && clean.length >= 2 && !seenSkill.has(clean.toLowerCase())) {
        seenSkill.add(clean.toLowerCase());
        allSkillsList.push(clean);
      }
    });

    const sections = extractStructuredSections(job);

    const metaPills = [];
    if (location) metaPills.push(`<span class="jd-detail-pill pill-location">${LUCIDE_ICONS.mapPin}<span>${escapeHtml(location)}</span></span>`);
    if (workMode) metaPills.push(`<span class="jd-detail-pill pill-workmode">${escapeHtml(workMode)}</span>`);
    if (employmentType) metaPills.push(`<span class="jd-detail-pill pill-employment">${escapeHtml(employmentType)}</span>`);
    if (seniority) metaPills.push(`<span class="jd-detail-pill pill-seniority">${escapeHtml(seniority)}</span>`);
    if (salary) metaPills.push(`<span class="jd-detail-pill pill-salary highlight">${LUCIDE_ICONS.walletCards}<span>${escapeHtml(salary)}</span></span>`);
    if (openings) metaPills.push(`<span class="jd-detail-pill pill-openings highlight">${LUCIDE_ICONS.users}<span>Tuyển ${escapeHtml(String(openings))} người</span></span>`);
    if (deadline) metaPills.push(`<span class="jd-detail-pill pill-deadline">${LUCIDE_ICONS.calendarDays}<span>Hạn ứng tuyển: <strong>${escapeHtml(deadline)}</strong></span></span>`);

    let heroHeaderHtml = '';
    if (options.showHeroHeader !== false && mode === 'modal') {
      const sourceLinkHtml = sourceUrl
        ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" class="jd-detail-source-link" title="Mở tin gốc trên ${escapeHtml(sourcePlatformName || 'website')}">
            <span>Xem tin gốc trên ${escapeHtml(sourcePlatformName || 'Website tuyển dụng')}</span>
            ${LUCIDE_ICONS.externalLink}
          </a>`
        : '';

      const rawLogo = cleanMeta(job.company_logo || job.logo_url || job.logo);
      const hasValidLogo = Boolean(rawLogo && (/^https?:\/\//i.test(rawLogo) || (rawLogo.startsWith('/') && !rawLogo.includes('placeholder'))));
      const cleanComp = cleanTextLine(company);
      const words = cleanComp.split(/\s+/).filter(Boolean);
      const companyInitial = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : (cleanComp.slice(0, 2) || 'DN').toUpperCase();
      const logoHtml = hasValidLogo
        ? `<div class="jd-detail-company-avatar">
            <img src="${escapeHtml(rawLogo)}" alt="${escapeHtml(company)}" class="jd-detail-logo-img" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';" />
            <span class="jd-detail-logo-initial" style="display:none">${escapeHtml(companyInitial)}</span>
          </div>`
        : `<div class="jd-detail-company-avatar"><span class="jd-detail-logo-initial">${escapeHtml(companyInitial)}</span></div>`;

      heroHeaderHtml = `
        <header class="jd-detail-hero">
          <div class="jd-detail-hero-top">
            <div class="jd-detail-hero-brand">
              ${logoHtml}
              <div class="jd-detail-title-group">
                <span class="jd-detail-kicker">Chi tiết tin tuyển dụng</span>
                <h2 class="jd-detail-title">${escapeHtml(title)}</h2>
                <div class="jd-detail-company">${escapeHtml(company)}</div>
              </div>
            </div>
            ${sourceLinkHtml}
          </div>
          ${metaPills.length > 0 ? `<div class="jd-detail-meta-row">${metaPills.join('')}</div>` : ''}
        </header>
      `;
    }

    let skillsHtml = '';
    if (options.showSkillsSection !== false && allSkillsList.length > 0) {
      skillsHtml = `
        <section class="jd-detail-section jd-skills-section">
          <h4 class="jd-detail-section-heading">Kỹ năng &amp; Công nghệ trọng tâm</h4>
          <div class="jd-detail-skills-wrap">
            ${allSkillsList.map(s => `<span class="jd-detail-skill-tag">${escapeHtml(s)}</span>`).join('')}
          </div>
        </section>
      `;
    }

    let sectionsHtml = '';
    if (sections.length > 0) {
      sectionsHtml = sections.map(sec => {
        let contentInnerHtml = '';
        if (sec.items && sec.items.length > 0) {
          contentInnerHtml += `
            <ul class="jd-detail-list">
              ${sec.items.map(item => `<li class="jd-detail-list-item">${escapeHtml(item)}</li>`).join('')}
            </ul>
          `;
        }
        if (sec.subSections && sec.subSections.length > 0) {
          contentInnerHtml += sec.subSections.map(sub => `
            <div class="jd-detail-sub-group">
              ${sub.title ? `<h5 class="jd-detail-sub-heading">${escapeHtml(sub.title)}</h5>` : ''}
              <ul class="jd-detail-list">
                ${sub.items.map(item => `<li class="jd-detail-list-item">${escapeHtml(item)}</li>`).join('')}
              </ul>
            </div>
          `).join('');
        }

        return `
          <section class="jd-detail-section jd-section-${sec.type}">
            <h4 class="jd-detail-section-heading">${escapeHtml(sec.title)}</h4>
            <div class="jd-detail-section-content">
              ${contentInnerHtml}
            </div>
          </section>
        `;
      }).join('');
    } else {
      sectionsHtml = `
        <div class="jd-detail-empty-state">
          <p>Doanh nghiệp chưa cập nhật mô tả chi tiết cho vị trí tuyển dụng này.</p>
        </div>
      `;
    }

    return `
      <div class="structured-jd-detail-root jd-mode-${mode}">
        ${heroHeaderHtml}
        ${skillsHtml}
        <div class="jd-detail-body-sections">
          ${sectionsHtml}
        </div>
      </div>
    `;
  }

  function cleanDisplayTitle(rawTitle) {
    let value = String(rawTitle || '').trim();
    if (!value) return 'Vị trí chưa đặt tên';
    value = value
      .replace(/\s*[,\.;:]*(?:\[protected info\]|\(protected info\))\s*[,\.;:]*/gi, ' ')
      .replace(/^[\(\[]?\s*(internship|intern|fresher|junior|middle|mid[- ]level|senior|lead|manager)\s*[\]\):\-]?\s*/i, '')
      .replace(/\s*[\(\[]\s*(hn|hcm|tp\.?\s*hcm|hà nội|hanoi|ho chi minh|đà nẵng|da nang|remote|hybrid|on[- ]?site)\s*[\]\)]\s*/gi, ' ')
      .replace(/\(\s*\)|\[\s*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    value = value.replace(/([^\s(])\(/, '$1 (').replace(/\)(?=[A-Za-zÀ-ỹ0-9])/, ') ').trim();
    return value || String(rawTitle).trim() || 'Vị trí chưa đặt tên';
  }

  async function openJobPreviewModal(jobOrSourceId) {
    if (!jobOrSourceId) return;
    let job = null;
    if (typeof jobOrSourceId === 'object' && jobOrSourceId !== null) {
      job = jobOrSourceId;
    } else {
      const sourceId = String(jobOrSourceId);
      if (!targetJobCatalog || targetJobCatalog.length === 0) {
        try {
          await loadTargetJobCatalog();
        } catch (_) {}
      }
      job = (targetJobCatalog || []).find(j => String(j.source_id) === sourceId || String(j.id) === sourceId || String(j.job_id) === sourceId)
        || (visibleJobResults || []).find(j => String(j.source_id) === sourceId || String(j.id) === sourceId || String(j.job_id) === sourceId);
      
      if (!job) {
        try {
          const res = await ApiClient.get(`/api/v1/jobs/${encodeURIComponent(sourceId)}`);
          if (res && (res.job || res.title || res.data)) {
            job = res.job || res.data || res;
          }
        } catch (_) {}
      }
    }
    if (!job) return;

    // Look for matching detailed JD in targetJobCatalog if partial
    const catalogJob = (targetJobCatalog || []).find(j =>
      String(j.source_id) === String(job.job_id || job.source_id || job.id) ||
      (j.title && job.title && j.title.toLowerCase() === job.title.toLowerCase())
    ) || {};
    const fullJob = { ...catalogJob, ...job };

    currentPreviewJobId = String(fullJob.source_id || fullJob.id || fullJob.job_id || '');
    const modal = document.getElementById('job-preview-modal');
    const content = document.getElementById('job-modal-content');
    if (modal && content) {
      content.innerHTML = renderStructuredJobDetailHtml(fullJob, {
        mode: 'modal',
        showHeroHeader: true,
        showSkillsSection: true,
      });

      const rawSourceUrl = fullJob.source_url || fullJob.url || fullJob.link || fullJob.job_url || fullJob.original_url || fullJob.post_url;
      const sourceUrl = (rawSourceUrl && /^https?:\/\//i.test(rawSourceUrl)) ? rawSourceUrl : '';
      const sourceLinkBtn = document.getElementById('job-modal-source-link');
      if (sourceLinkBtn) {
        if (sourceUrl) {
          sourceLinkBtn.href = sourceUrl;
          sourceLinkBtn.style.display = 'inline-flex';
          sourceLinkBtn.innerHTML = `<span>Mở tin tuyển dụng gốc ↗</span>`;
        } else {
          sourceLinkBtn.style.display = 'none';
        }
      }

      const selectBtn = document.getElementById('job-modal-select-btn');
      if (selectBtn) {
        if (currentJobSearchMode === 'catalog' || fullJob.catalog_mode) {
          selectBtn.textContent = 'Chọn để Match CV';
        } else {
          selectBtn.textContent = 'Chọn công việc này';
        }
      }

      modal.classList.add('is-open');
      modal.style.display = 'flex';
      document.body.classList.add('job-preview-modal-open');
      document.documentElement.classList.add('job-preview-modal-open');
      window.requestAnimationFrame(() => document.getElementById('job-modal-close-btn')?.focus());
    }
  }

  document.addEventListener('click', async (event) => {
    const closeBtn = event.target.closest('#job-modal-close-btn, #job-modal-cancel-btn');
    if (closeBtn) {
      closeJobPreviewModal();
      return;
    }
    const selectBtn = event.target.closest('#job-modal-select-btn');
    if (selectBtn) {
      if (currentPreviewJobId) {
        await chooseTargetCatalogJob(currentPreviewJobId);
        closeJobPreviewModal();
        if (currentJobSearchMode === 'catalog') {
          switchView('match');
          showToast('Đã chọn công việc để Match với CV!', 'success');
        }
      }
      return;
    }
    const modal = document.getElementById('job-preview-modal');
    if (modal && event.target === modal) {
      closeJobPreviewModal();
    }
  });

  document.addEventListener('keydown', event => {
    const modal = document.getElementById('job-preview-modal');
    if (event.key === 'Escape' && modal && modal.style.display === 'flex') {
      closeJobPreviewModal();
    }
  });

  document.getElementById('p1-job-grid')?.addEventListener('click', event => {
    const radioBtn = event.target.closest('.p1-job-card-radio, [data-action="select-job"]');
    const card = event.target.closest('[data-target-job]');
    const sourceId = card?.dataset.targetJob;
    if (!sourceId) return;

    if (radioBtn) {
      // Khi nhấn vào nút tròn radio: Chọn công việc (hiện màu xanh đã chọn), không xem chi tiết
      event.preventDefault();
      event.stopPropagation();
      chooseTargetCatalogJob(sourceId);
    } else {
      // Khi nhấn vào title hoặc phần thân thẻ card: Xem chi tiết trong modal
      openJobPreviewModal(sourceId);
    }
  });
  document.getElementById('p1-job-grid')?.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    const radioBtn = event.target.closest('.p1-job-card-radio, [data-action="select-job"]');
    const card = event.target.closest('[data-target-job]');
    const sourceId = card?.dataset.targetJob;
    if (!sourceId) return;

    event.preventDefault();
    if (radioBtn) {
      chooseTargetCatalogJob(sourceId);
    } else {
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
    const suggestions = Array.isArray(analysis?.suggestions) ? analysis.suggestions : [];
    const sensitivePattern = /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:facebook|linkedin|instagram)\.com\/|(?:^|\s)(?:địa chỉ|address)\s*[:：]|\b(?:xã|phường|quận|huyện|tỉnh|tp\.?|thành phố)\b/i;
    const standaloneContactPattern = /^(?:(?:https?:\/\/|www\.)\S+|\+?\d[\d\s().-]{7,}\d)$/i;
    return suggestions.map((item, sourceIndex) => ({ ...item, sourceIndex })).filter(item => {
      const original = String(item?.original_text || item?.original || '').trim();
      const improved = String(item?.suggested_improvement || item?.optimized || '').trim();
      const combined = `${original} ${improved}`.toLocaleLowerCase('vi');
      if (!original || !improved || sensitivePattern.test(combined) || standaloneContactPattern.test(original)) return false;
      return true;
    });
  }

  // --- Match Result Normalization Engine ---

  const MATCH_LANGUAGE_DISPLAY = {
    en: 'Tiếng Anh',
    english: 'Tiếng Anh',
    vi: 'Tiếng Việt',
    vietnamese: 'Tiếng Việt',
    ja: 'Tiếng Nhật',
    jp: 'Tiếng Nhật',
    japanese: 'Tiếng Nhật',
    ko: 'Tiếng Hàn',
    kr: 'Tiếng Hàn',
    korean: 'Tiếng Hàn',
    zh: 'Tiếng Trung',
    cn: 'Tiếng Trung',
    chinese: 'Tiếng Trung',
    fr: 'Tiếng Pháp',
    french: 'Tiếng Pháp',
    de: 'Tiếng Đức',
    german: 'Tiếng Đức',
  };

  const MATCH_GROUP_ICONS = {
    skills: '⚡',
    responsibilities_task_fit: '📋',
    experience_seniority: '💼',
    domain_industry: '🏢',
    education: '🎓',
    certifications_languages_other: '📜',
    other: '📌',
  };

  const MATCH_GROUP_LABELS = {
    skills: 'Kỹ năng chuyên môn',
    responsibilities_task_fit: 'Trách nhiệm & Nhiệm vụ',
    experience_seniority: 'Kinh nghiệm & Cấp bậc',
    experience_level: 'Kinh nghiệm & Cấp bậc',
    domain_industry: 'Lĩnh vực chuyên môn',
    education: 'Học vấn & Bằng cấp',
    certifications_languages_other: 'Ngoại ngữ & Chứng chỉ',
    other: 'Yêu cầu khác',
  };

  const MATCH_RATING_LABELS = {
    POOR: 'Phù hợp thấp',
    FAIR: 'Phù hợp một phần',
    AVERAGE: 'Phù hợp một phần',
    GOOD: 'Phù hợp tốt',
    EXCELLENT: 'Phù hợp rất tốt',
  };

  const MATCH_STATUS_TEXT = {
    SUPPORTED: 'Đáp ứng',
    PARTIALLY_SUPPORTED: 'Đáp ứng một phần',
    NOT_FOUND: 'Chưa đáp ứng',
    UNCERTAIN: 'Chưa đủ bằng chứng',
  };

  function normalizeBackendReqStatus(rawStatus) {
    const upper = String(rawStatus || '').toUpperCase();
    if (['SUPPORTED', 'MATCHED', 'PASS'].includes(upper)) return 'SUPPORTED';
    if (['PARTIALLY_SUPPORTED', 'PARTIAL'].includes(upper)) return 'PARTIALLY_SUPPORTED';
    if (['NOT_FOUND', 'MISSING', 'CONFLICT', 'CONFLICTING', 'FAIL'].includes(upper)) return 'NOT_FOUND';
    return 'UNCERTAIN';
  }

  function cleanReqTitleText(text, fallback = 'Yêu cầu chuyên môn') {
    if (!text) return fallback;
    const raw = String(text).trim();
    if (!raw || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return fallback;
    if (MATCH_LANGUAGE_DISPLAY[raw.toLowerCase()]) {
      return MATCH_LANGUAGE_DISPLAY[raw.toLowerCase()];
    }
    let s = raw;
    s = s.replace(/^#{1,6}\s*/, '');
    s = s.replace(/\\([#\-_*])/g, '$1');
    s = s.replace(/-{2,}/g, '-').trim();
    s = s.replace(/^(?:\d+\.\s*)?(?:Trách nhiệm & Nhiệm vụ chính|Trách nhiệm|Nhiệm vụ chính|Nhiệm vụ|Yêu cầu bắt buộc \(Must-Have\)|Yêu cầu bắt buộc|Yêu cầu ưu tiên \(Nice-To-Have\)|Yêu cầu ưu tiên|Yêu cầu công việc|Yêu cầu ứng viên|Yêu cầu khác|Mô tả công việc|Must-Have|Nice-To-Have|Responsibilities|Requirements|Overview)\s*[:\-–—]?\s*/gi, '');
    s = s.replace(/^[\-\•\*\+\d\.\)]\s*/, '');
    if (/^[\s#•*\-–—\d.)]+$/.test(s) || /^#{1,6}\s*\d*\.?$/i.test(s)) {
      return fallback;
    }
    if (s.includes(':') && s.length > 70) {
      const parts = s.split(':');
      if (parts[0].trim().length >= 6 && parts[0].trim().length <= 50) {
        s = parts[0].trim();
      }
    }
    return s.length > 110 ? `${s.slice(0, 110).trim()}…` : s || fallback;
  }

  function cleanVagueMatchText(text, fallback = '') {
    if (!text) return fallback;
    let s = String(text).trim();
    s = s.replace(/chưa có bằng chứng\b/gi, 'CV không đề cập nội dung này');
    s = s.replace(/không đủ bằng chứng\b/gi, 'CV chưa thể hiện rõ nội dung này');
    s = s.replace(/chưa đủ bằng chứng\b/gi, 'CV chưa thể hiện rõ nội dung này');
    s = s.replace(/cần làm rõ\b/gi, 'chưa được mô tả cụ thể');
    return s || fallback;
  }

  function isUsefulMatchDisplayText(value) {
    const text = String(value ?? '').trim();
    return Boolean(text) && !/^(?:null|undefined)$/i.test(text);
  }

  function matchEvidenceSourcePriority(item) {
    const source = String(item?.source_section || item?.chunk_type || item?.section || '').toLowerCase();
    if (/experience|work/.test(source)) return 0;
    if (/project/.test(source)) return 1;
    if (/skill/.test(source)) return 2;
    if (/certif/.test(source)) return 3;
    if (/education/.test(source)) return 4;
    if (/summary/.test(source)) return 5;
    return 6;
  }

  function bestRelevantMatchEvidence(item, title) {
    const target = String(title || '').trim().toLocaleLowerCase();
    const candidates = [];
    const add = (value, source) => {
      if (!isUsefulMatchDisplayText(value)) return;
      const text = String(value).trim();
      const isContact = /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?84|0)[\s.()-]*\d(?:[\s.()-]*\d){7,9}|^(?:email|phone|mobile|address|địa chỉ)\s*:/i.test(text);
      if (!isContact && target && text.toLocaleLowerCase().includes(target)) {
        candidates.push({ text, priority: matchEvidenceSourcePriority(source) });
      }
    };
    add(item.cv_text, item);
    add(item.matched_text, item);
    const evidence = Array.isArray(item.evidence) ? item.evidence : [];
    evidence.forEach(entry => add(entry?.text ?? entry?.quote ?? entry?.evidence_quote, entry));
    if (!evidence.length) add(item.evidence, item);
    candidates.sort((a, b) => a.priority - b.priority || a.text.length - b.text.length);
    const best = candidates[0];
    if (!best) return '';
    if (best.priority === 2 || best.text.trim().toLocaleLowerCase() === String(title || '').trim().toLocaleLowerCase()) {
      return `"${title}" — mục Kỹ năng`;
    }
    return best.text.length > 220 ? `${best.text.slice(0, 217).trim()}…` : best.text;
  }

  function mapSingleRequirement(item, defaultGroupKey = 'skills', forcedStatus = null) {
    const status = forcedStatus || normalizeBackendReqStatus(item.status || item.evaluation_status || item.match_status);
    const statusLabel = MATCH_STATUS_TEXT[status] || 'Chưa xác định';
    const isMandatory = Boolean(
      item.type === 'REQUIRED' ||
      item.mandatory ||
      item.is_mandatory ||
      String(item.requirement_type || '').toUpperCase().includes('REQUIRED') ||
      String(item.type || '').toUpperCase().includes('REQUIRED')
    );
    const groupKey = item.group || defaultGroupKey;
    const groupLabel = item.group_label ?? MATCH_GROUP_LABELS[groupKey] ?? 'Kỹ năng chuyên môn';

    let rawTitle = item.normalized_value ?? item.original_value ?? item.requirement ?? item.text ?? item.title ?? '';
    if (typeof rawTitle === 'string' && MATCH_LANGUAGE_DISPLAY[rawTitle.trim().toLowerCase()]) {
      rawTitle = MATCH_LANGUAGE_DISPLAY[rawTitle.trim().toLowerCase()];
    }
    let title = cleanReqTitleText(String(rawTitle || ''), '');
    if (!title) {
      title = cleanReqTitleText(String(item.original_value || item.text || item.requirement || ''), groupLabel);
    }

    const defaultCvEvidence = status === 'SUPPORTED'
      ? 'CV có kinh nghiệm/kỹ năng đáp ứng yêu cầu này.'
      : status === 'PARTIALLY_SUPPORTED'
        ? `${title} xuất hiện trong mục Kỹ năng.`
        : 'Chưa tìm thấy bằng chứng phù hợp trong CV.';

    let rawEvidence = bestRelevantMatchEvidence(item, title);
    if (status === 'NOT_FOUND' && (!rawEvidence || rawEvidence === 'Không đề cập trong CV.')) {
      rawEvidence = 'Chưa tìm thấy bằng chứng phù hợp trong CV.';
    } else if (!rawEvidence) {
      rawEvidence = defaultCvEvidence;
    }
    const cvEvidence = cleanVagueMatchText(String(rawEvidence));

    const jdText = cleanVagueMatchText(isUsefulMatchDisplayText(item.jd_text) ? item.jd_text : title);
    const defaultGap = status === 'SUPPORTED'
      ? 'CV đáp ứng tốt yêu cầu này.'
      : status === 'PARTIALLY_SUPPORTED'
        ? `CV có đề cập ${title} trong mục Kỹ năng, nhưng chưa có bằng chứng về việc đã sử dụng ${title} trong dự án hoặc kinh nghiệm thực tế.`
        : 'CV hiện chưa chứng minh yêu cầu này.';

    const suppliedConclusion = item.gap ?? item.comparison ?? item.reason;
    const gapText = cleanVagueMatchText(isUsefulMatchDisplayText(suppliedConclusion) ? suppliedConclusion : defaultGap);

    return {
      id: String(item.requirement_id || item.id || ''),
      requirementId: String(item.requirement_id || item.id || ''),
      title: title || groupLabel,
      status,
      statusLabel,
      isMandatory,
      typeLabel: isMandatory ? 'Bắt buộc' : 'Ưu tiên',
      groupKey,
      groupLabel,
      jdText,
      cvText: cvEvidence,
      gapText,
    };
  }

  const MATCH_DECISION_MESSAGES = {
    POOR: 'CV còn thiếu nhiều yêu cầu của vị trí này.',
    FAIR: 'CV đáp ứng một phần yêu cầu và còn một số khoảng cách quan trọng.',
    AVERAGE: 'CV đáp ứng một phần yêu cầu và còn một số khoảng cách quan trọng.',
    GOOD: 'CV đáp ứng phần lớn yêu cầu của vị trí.',
    EXCELLENT: 'CV phù hợp rất tốt với vị trí này.',
  };

  function normalizeMatchResult(apiResponse) {
    if (!apiResponse || typeof apiResponse !== 'object') {
      return {
        score: null,
        scoreDisplay: '--%',
        rating: null,
        ratingLabel: '',
        decisionMessage: 'Chưa có dữ liệu phân tích.',
        isCompleted: false,
        summary: 'Chưa có dữ liệu phân tích.',
        matchedCount: 0,
        partialCount: 0,
        missingCount: 0,
        uncertainCount: 0,
        totalCount: 0,
        criteria: [],
        matchedRequirements: [],
        partialRequirements: [],
        missingRequirements: [],
        uncertainRequirements: [],
        allRequirements: [],
        strengths: [],
        gaps: [],
        hardConstraints: [],
        rawAnalysis: {},
      };
    }

    // 1. SCORE (direct from backend final_score)
    const rawScore =
      apiResponse.final_score ??
      apiResponse.result?.final_score ??
      apiResponse.result?.match_score ??
      apiResponse.match_score ??
      null;

    let score = null;
    if (rawScore !== null && rawScore !== undefined && !isNaN(Number(rawScore))) {
      score = Number(rawScore);
    }

    const isCompleted = String(apiResponse.status || apiResponse.result?.status || '').toUpperCase() === 'COMPLETED';

    let scoreDisplay = '--%';
    if (score !== null) {
      scoreDisplay = Number.isInteger(score) ? `${score}%` : `${score.toFixed(1)}%`;
    } else if (isCompleted) {
      scoreDisplay = '0%';
    }

    // 2. RATING
    const rawRating = apiResponse.rating ?? apiResponse.result?.rating ?? null;
    const ratingUpper = String(rawRating || '').toUpperCase();
    const ratingLabel = rawRating ? (MATCH_RATING_LABELS[ratingUpper] || String(rawRating)) : '';
    const decisionMessage = MATCH_DECISION_MESSAGES[ratingUpper] || (
      score !== null && score >= 80
        ? MATCH_DECISION_MESSAGES.EXCELLENT
        : score !== null && score >= 60
          ? MATCH_DECISION_MESSAGES.GOOD
          : score !== null && score >= 40
            ? MATCH_DECISION_MESSAGES.FAIR
          : MATCH_DECISION_MESSAGES.POOR
    );
    const displayDecisionMessage = decisionMessage.replace(
      /một số khoảng cách quan trọng/gi,
      'một số yêu cầu quan trọng chưa được đáp ứng'
    );

    // 3. REQUIREMENTS & CANONICAL COUNTS
    const resultObj = apiResponse.result || apiResponse || {};
    const reqObj = resultObj.requirements || apiResponse.requirements;

    let matchedReqs = [];
    let partialReqs = [];
    let missingReqs = [];
    let uncertainReqs = [];

    if (reqObj && typeof reqObj === 'object') {
      if (Array.isArray(reqObj.matched)) {
        matchedReqs = reqObj.matched.map(item => mapSingleRequirement(item, item.group || 'skills', 'SUPPORTED'));
      }
      if (Array.isArray(reqObj.partial)) {
        partialReqs = reqObj.partial.map(item => mapSingleRequirement(item, item.group || 'skills', 'PARTIALLY_SUPPORTED'));
      }
      if (Array.isArray(reqObj.missing)) {
        missingReqs = reqObj.missing.map(item => mapSingleRequirement(item, item.group || 'skills', 'NOT_FOUND'));
      }
      if (Array.isArray(reqObj.uncertain)) {
        uncertainReqs = reqObj.uncertain.map(item => mapSingleRequirement(item, item.group || 'skills', 'UNCERTAIN'));
      }
    } else {
      const flatList = Array.isArray(resultObj.requirement_evidence)
        ? resultObj.requirement_evidence
        : Array.isArray(resultObj.evaluated_requirements)
          ? resultObj.evaluated_requirements
          : Array.isArray(resultObj.evidence)
            ? resultObj.evidence
            : [];

      flatList.forEach(item => {
        const st = normalizeBackendReqStatus(item.status || item.evaluation_status || item.match_status);
        const req = mapSingleRequirement(item, item.group || 'skills', st);
        if (st === 'SUPPORTED') matchedReqs.push(req);
        else if (st === 'PARTIALLY_SUPPORTED') partialReqs.push(req);
        else if (st === 'NOT_FOUND') missingReqs.push(req);
        else uncertainReqs.push(req);
      });
    }

    // 4. SUMMARY
    const backendReqSummary = resultObj.requirement_summary || apiResponse.requirement_summary || null;
    const matchedCount = backendReqSummary && typeof backendReqSummary.supported === 'number' ? backendReqSummary.supported : matchedReqs.length;
    const partialCount = backendReqSummary && typeof backendReqSummary.partial === 'number' ? backendReqSummary.partial : partialReqs.length;
    const missingCount = backendReqSummary && typeof backendReqSummary.missing === 'number' ? backendReqSummary.missing : missingReqs.length;
    const uncertainCount = backendReqSummary && typeof backendReqSummary.uncertain === 'number' ? backendReqSummary.uncertain : uncertainReqs.length;
    const totalCount = backendReqSummary && typeof backendReqSummary.total === 'number' ? backendReqSummary.total : (matchedCount + partialCount + missingCount + uncertainCount);
    const allRequirements = [...matchedReqs, ...partialReqs, ...missingReqs, ...uncertainReqs];

    let summary = '';
    if (!isCompleted && score === null) {
      summary = 'Đang phân tích đối chiếu hồ sơ...';
    } else if (totalCount > 0) {
      const parts = [
        `${matchedCount} Đáp ứng`,
        `${partialCount} Đáp ứng một phần`,
        `${missingCount} Chưa đáp ứng`,
      ];
      if (uncertainCount > 0) {
        parts.push(`${uncertainCount} Chưa đủ bằng chứng`);
      }
      summary = `${totalCount} yêu cầu được đối chiếu: ${parts.join(' · ')}`;
    } else {
      summary = 'Đã đối chiếu các yêu cầu của công việc.';
    }

    // 5. CRITERIA / REQUIREMENT GROUPS
    const criteriaList = [];
    const rawCriteria = Array.isArray(resultObj.criteria) ? resultObj.criteria : (Array.isArray(apiResponse.criteria) ? apiResponse.criteria : []);

    if (rawCriteria.length > 0) {
      rawCriteria.forEach(crit => {
        const groupKey = crit.group || 'skills';
        const label = crit.label ?? MATCH_GROUP_LABELS[groupKey] ?? 'Kỹ năng chuyên môn';
        const icon = MATCH_GROUP_ICONS[groupKey] || '⚡';

        const critReqIds = new Set(Array.isArray(crit.requirement_ids) ? crit.requirement_ids : []);
        const associatedReqs = critReqIds.size > 0
          ? allRequirements.filter(r => (r.id && critReqIds.has(r.id)) || (r.requirementId && critReqIds.has(r.requirementId)))
          : allRequirements.filter(r => r.groupKey === groupKey);

        const cMatched = associatedReqs.filter(r => r.status === 'SUPPORTED').length;

        criteriaList.push({
          group: groupKey,
          label,
          icon,
          rawScore: crit.raw_score,
          weightedScore: crit.weighted_score,
          status: crit.status,
          statusLabel: crit.status ? (MATCH_STATUS_TEXT[crit.status] || crit.status) : undefined,
          reason: crit.reason,
          requirements: associatedReqs,
          matchedCount: cMatched,
          totalCount: associatedReqs.length,
          ratioLabel: `${cMatched}/${associatedReqs.length} đáp ứng`,
        });
      });
    } else {
      const groupsMap = new Map();
      allRequirements.forEach(r => {
        const list = groupsMap.get(r.groupKey) || [];
        list.push(r);
        groupsMap.set(r.groupKey, list);
      });

      groupsMap.forEach((reqs, groupKey) => {
        const label = MATCH_GROUP_LABELS[groupKey] ?? 'Kỹ năng chuyên môn';
        const icon = MATCH_GROUP_ICONS[groupKey] || '⚡';
        const cMatched = reqs.filter(r => r.status === 'SUPPORTED').length;
        criteriaList.push({
          group: groupKey,
          label,
          icon,
          requirements: reqs,
          matchedCount: cMatched,
          totalCount: reqs.length,
          ratioLabel: `${cMatched}/${reqs.length} đáp ứng`,
        });
      });
    }

    // 6. STRENGTHS & GAPS
    const scoreExplanation = resultObj.score_explanation || apiResponse.score_explanation || null;
    const categoryScoreExplanation = Array.isArray(resultObj.category_score_explanation)
      ? resultObj.category_score_explanation
      : (Array.isArray(apiResponse.category_score_explanation) ? apiResponse.category_score_explanation : []);
    const structuredStrengths = Array.isArray(resultObj.structured_strengths)
      ? resultObj.structured_strengths
      : (Array.isArray(apiResponse.structured_strengths) ? apiResponse.structured_strengths : []);
    const structuredBlockers = Array.isArray(resultObj.structured_blockers)
      ? resultObj.structured_blockers
      : (Array.isArray(apiResponse.structured_blockers) ? apiResponse.structured_blockers : []);

    const strengthMap = new Map();
    matchedReqs.forEach(r => {
      const key = r.title.toLowerCase();
      if (!strengthMap.has(key)) {
        strengthMap.set(key, {
          title: r.title,
          evidence: r.cvText && r.cvText.length > r.title.length ? r.cvText : undefined,
        });
      }
    });
    const strengths = Array.from(strengthMap.values());

    const gapMap = new Map();
    [...missingReqs, ...partialReqs, ...uncertainReqs].forEach(r => {
      const key = r.title.toLowerCase();
      if (!gapMap.has(key)) {
        gapMap.set(key, {
          title: r.title,
          status: r.status,
          statusLabel: r.statusLabel,
          typeLabel: r.typeLabel,
          isMandatory: r.isMandatory,
          reason: r.gapText,
          jdText: r.jdText,
          cvText: r.cvText,
        });
      }
    });
    const gaps = Array.from(gapMap.values());

    // 7. HARD CONSTRAINTS
    const hardConstraints = [];
    const rawHC = resultObj.eligibility_details || apiResponse.eligibility_details || [];
    if (Array.isArray(rawHC)) {
      rawHC.forEach(item => {
        const hcStatus = String(item.status || '').toUpperCase();
        const hcStatusLabel = hcStatus === 'MATCHED' || hcStatus === 'SUPPORTED' ? 'Đạt' : hcStatus === 'CONFLICT' ? 'Không phù hợp' : 'Chưa xác định';
        hardConstraints.push({
          title: cleanReqTitleText(item.requirement || item.text || 'Điều kiện bắt buộc'),
          status: hcStatus,
          statusLabel: hcStatusLabel,
          reason: cleanVagueMatchText(item.comparison || item.reason || ''),
        });
      });
    }

    return {
      score,
      scoreDisplay,
      rating: rawRating,
      ratingLabel,
      decisionMessage: displayDecisionMessage,
      isCompleted,
      summary,
      matchedCount,
      partialCount,
      missingCount,
      uncertainCount,
      totalCount,
      criteria: criteriaList,
      matchedRequirements: matchedReqs,
      partialRequirements: partialReqs,
      missingRequirements: missingReqs,
      uncertainRequirements: uncertainReqs,
      allRequirements,
      strengths,
      gaps,
      hardConstraints,
      scoreExplanation,
      categoryScoreExplanation,
      structuredStrengths,
      structuredBlockers,
      requirementSummary: backendReqSummary,
      rawAnalysis: apiResponse,
    };
  }

  window.normalizeMatchResult = normalizeMatchResult;

  function renderInlineCVAnalysis(analysis, cvId, jdId) {
    if (!analysis) {
      console.warn('[Match] Cannot render inline analysis: missing analysis data');
      return;
    }
    latestCVAnalysisContext = { analysis, cvId, jdId };
    window.latestCVAnalysisContext = latestCVAnalysisContext;

    // Normalize through canonical single source of truth adapter
    const norm = normalizeMatchResult(analysis);

    // 1. Header Context
    const cvLabel = [...(cvAnalysisCvSelect?.options || [])].find(option => option.value === String(cvId))?.textContent || 'CV đã chọn';
    const jdLabel = [...(cvAnalysisJdSelect?.options || [])].find(option => option.value === String(jdId))?.textContent || 'Công việc đã chọn';
    
    const cvNameEl = document.getElementById('cv-result-cv-name');
    const jobNameEl = document.getElementById('cv-result-job-name');
    if (cvNameEl) cvNameEl.textContent = cvLabel;
    if (jobNameEl) jobNameEl.textContent = jdLabel;

    // 2. Score & Rating in Hero Panel
    const ratingLabels = {
      'POOR': 'PHÙ HỢP THẤP',
      'FAIR': 'PHÙ HỢP MỘT PHẦN',
      'GOOD': 'PHÙ HỢP TỐT',
      'EXCELLENT': 'PHÙ HỢP RẤT TỐT'
    };
    const ratingKey = String(norm.rating || '').toUpperCase();
    const ratingLabel = ratingLabels[ratingKey] || 'PHÙ HỢP THẤP';

    const scoreEl = document.getElementById('cv-result-match-score');
    const ratingBadgeEl = document.getElementById('gap-header-rating-badge');
    const pointsTextEl = document.getElementById('cv-result-points-text');
    const summaryEl = document.getElementById('cv-result-summary');
    const decisionMessageEl = document.getElementById('cv-result-decision-message');
    
    if (scoreEl) scoreEl.textContent = norm.scoreDisplay;
    if (ratingBadgeEl) {
      ratingBadgeEl.textContent = ratingLabel;
      ratingBadgeEl.className = `match-ux-rating-badge is-${String(norm.rating || 'poor').toLowerCase()}`;
    }
    if (pointsTextEl) {
      pointsTextEl.style.display = 'none';
    }

    // Bind "Điểm Match được tính như thế nào?" button
    const howMatchBtn = document.getElementById('btn-how-match-works');
    const howMatchModal = document.getElementById('match-how-it-works-modal');
    const howMatchCloseBtn = document.getElementById('btn-close-how-match-works');
    if (howMatchBtn && howMatchModal) {
      howMatchBtn.onclick = (e) => {
        e.preventDefault();
        howMatchModal.hidden = false;
      };
    }
    if (howMatchCloseBtn && howMatchModal) {
      howMatchCloseBtn.onclick = (e) => {
        e.preventDefault();
        howMatchModal.hidden = true;
      };
    }

    if (summaryEl) {
      let decisionMsg = "CV hiện còn thiếu một số yêu cầu quan trọng của vị trí.";
      if (ratingKey === 'FAIR') decisionMsg = "CV đáp ứng một phần yêu cầu nhưng vẫn còn khoảng cách quan trọng.";
      if (ratingKey === 'GOOD') decisionMsg = "CV đáp ứng tốt phần lớn các yêu cầu chính của vị trí.";
      if (ratingKey === 'EXCELLENT') decisionMsg = "CV phù hợp rất tốt với các yêu cầu của vị trí.";
      summaryEl.textContent = decisionMsg;
    }
    if (decisionMessageEl) {
      decisionMessageEl.textContent = summaryEl ? summaryEl.textContent : '';
    }

    // 3. Update Canonical Counts
    const pillMatched = document.getElementById('pill-count-matched');
    const pillPartial = document.getElementById('pill-count-partial');
    const pillMissing = document.getElementById('pill-count-missing');
    const pillUncertain = document.getElementById('pill-count-uncertain');
    const pillUncertainWrap = document.getElementById('pill-count-uncertain-wrapper');

    if (pillMatched) pillMatched.textContent = norm.matchedCount;
    if (pillPartial) pillPartial.textContent = norm.partialCount;
    if (pillMissing) pillMissing.textContent = norm.missingCount;
    if (pillUncertainWrap) {
      if (norm.uncertainCount > 0) {
        pillUncertainWrap.hidden = false;
        if (pillUncertain) pillUncertain.textContent = norm.uncertainCount;
      } else {
        pillUncertainWrap.hidden = true;
      }
    }

    // 4. Category Score Explanation (TẠI SAO LÀ X%?)
    const categoryExplanationSection = document.getElementById('cv-result-category-explanation-section');
    const categoryExplanationTitle = document.getElementById('cv-result-category-explanation-title');
    const categoryExplanationGrid = document.getElementById('cv-result-category-explanation-grid');

    if (categoryExplanationTitle) {
      categoryExplanationTitle.textContent = `Tại sao là ${norm.scoreDisplay}?`;
    }

    const categoryNames = {
      'skills': 'Kỹ năng chuyên môn',
      'responsibilities_task_fit': 'Trách nhiệm & Nhiệm vụ',
      'domain_industry': 'Lĩnh vực chuyên môn',
      'certifications_languages_other': 'Ngoại ngữ & Chứng chỉ',
      'experience_seniority': 'Kinh nghiệm & Cấp bậc',
      'experience_level': 'Kinh nghiệm & Cấp bậc',
      'education': 'Học vấn & Bằng cấp'
    };

    if (categoryExplanationSection && categoryExplanationGrid) {
      const catExplanations = norm.categoryScoreExplanation && norm.categoryScoreExplanation.length > 0
        ? norm.categoryScoreExplanation
        : norm.criteria.map(c => ({
            group: c.group,
            label: categoryNames[c.group] || c.label,
            match_percentage: c.rawScore || 0,
            available_points: c.weight || 0,
            earned_points: c.weightedScore || 0,
            impact_label: (c.weight || 0) >= 25 ? 'Mức ảnh hưởng: Cao' : ((c.weight || 0) >= 12 ? 'Mức ảnh hưởng: Trung bình' : 'Mức ảnh hưởng: Thấp')
          }));

      if (catExplanations && catExplanations.length > 0) {
        categoryExplanationSection.hidden = false;
        categoryExplanationGrid.innerHTML = catExplanations.map(cat => {
          const mappedLabel = categoryNames[cat.group] || cat.label;
          const pct = Math.round(Number(cat.match_percentage || 0));
          const barClass = pct >= 70 ? 'is-high' : (pct >= 40 ? 'is-mid' : 'is-low');
          const impactText = cat.impact_label || (Number(cat.available_points || 0) >= 25 ? 'Mức ảnh hưởng: Cao' : (Number(cat.available_points || 0) >= 12 ? 'Mức ảnh hưởng: Trung bình' : 'Mức ảnh hưởng: Thấp'));
          return `
            <div class="match-ux-category-card">
              <div class="match-ux-category-head">
                <strong class="match-ux-category-name">${escapeHtml(mappedLabel)}</strong>
                <span class="match-ux-category-pct">${pct}%</span>
              </div>
              <div class="match-ux-category-bar">
                <div class="match-ux-category-bar-fill ${barClass}" style="width: ${pct}%"></div>
              </div>
              <div class="match-ux-category-impact">${escapeHtml(impactText)}</div>
            </div>
          `;
        }).join('');
      } else {
        categoryExplanationSection.hidden = true;
      }
    }

    // 5. Strengths (VÌ SAO BẠN PHÙ HỢP?)
    const strengthsSection = document.getElementById('cv-result-strengths-section');
    const strengthsList = document.getElementById('cv-result-strengths-list');
    const strengthsTitle = document.getElementById('cv-result-strengths-title');
    if (strengthsTitle) strengthsTitle.textContent = "Vì sao bạn phù hợp?";

    let renderStrengths = [];
    if (norm.structuredStrengths && norm.structuredStrengths.length > 0) {
      renderStrengths = norm.structuredStrengths;
    } else if (norm.scoreExplanation && (norm.scoreExplanation.positive_contributions?.length > 0 || norm.scoreExplanation.partial_contributions?.length > 0)) {
      renderStrengths = [
        ...(norm.scoreExplanation.positive_contributions || []),
        ...(norm.scoreExplanation.partial_contributions || [])
      ].slice(0, 5);
    } else {
      const getStrengthScore = (r) => {
        if (r.status === 'SUPPORTED') return 100;
        if (r.status === 'PARTIALLY_SUPPORTED') return 50;
        return -1;
      };
      renderStrengths = norm.allRequirements
        .filter(r => getStrengthScore(r) > 0)
        .sort((a, b) => getStrengthScore(b) - getStrengthScore(a))
        .slice(0, 5);
    }

    if (strengthsSection && strengthsList) {
      if (renderStrengths.length > 0) {
        strengthsSection.hidden = false;
        strengthsList.innerHTML = renderStrengths.map(s => {
          const isPart = s.status === 'PARTIALLY_SUPPORTED';
          const icon = isPart ? '~' : '✓';
          const colorClass = isPart ? 'var(--color-primary-700, #1d4ed8)' : 'var(--color-success-700, #15803d)';
          const badgeText = s.display_badge || (s.is_mandatory ? 'Bắt buộc' : 'Ưu tiên');
          const reasonText = s.reason || s.evidence_summary || s.gapText || 'Có bằng chứng phù hợp trong CV.';
          return `
            <li style="margin-bottom: 12px; list-style: none;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px;">
                <strong style="color: ${colorClass};"><span style="margin-right:4px;">${icon}</span>${escapeHtml(s.title)}</strong>
                <span class="match-ux-impact-badge is-strength">${escapeHtml(badgeText)}</span>
              </div>
              <span style="font-size: 13.5px; color: var(--color-gray-700); display: block; margin-top: 4px; line-height: 1.4;">${escapeHtml(reasonText)}</span>
            </li>
          `;
        }).join('');
      } else {
        strengthsSection.hidden = true;
      }
    }

    // 6. Blockers (RÀO CẢN CHÍNH)
    const weaknessesSection = document.getElementById('cv-result-weaknesses-section');
    const weaknessesList = document.getElementById('cv-result-weaknesses-list');
    const weaknessesTitle = document.getElementById('cv-result-weaknesses-title');
    if (weaknessesTitle) weaknessesTitle.textContent = "Rào cản chính";

    let renderBlockers = [];
    if (norm.structuredBlockers && norm.structuredBlockers.length > 0) {
      renderBlockers = norm.structuredBlockers;
    } else if (norm.scoreExplanation && norm.scoreExplanation.lost_points?.length > 0) {
      renderBlockers = norm.scoreExplanation.lost_points.slice(0, 5);
    } else {
      const getBlockerScore = (r) => {
        if (r.status === 'NOT_FOUND' && r.isMandatory) return 100;
        if (r.status === 'NOT_FOUND' && r.group === 'experience_level') return 95;
        if (r.status === 'NOT_FOUND' && r.group === 'responsibilities_task_fit') return 90;
        if (r.status === 'UNCERTAIN' && r.isMandatory) return 80;
        if (r.status === 'NOT_FOUND') return 70;
        if (r.status === 'PARTIALLY_SUPPORTED' && r.isMandatory) return 40;
        return 0;
      };
      renderBlockers = norm.allRequirements
        .filter(r => getBlockerScore(r) > 0)
        .sort((a, b) => getBlockerScore(b) - getBlockerScore(a))
        .slice(0, 5);
    }

    if (weaknessesSection && weaknessesList) {
      if (renderBlockers.length > 0) {
        weaknessesSection.hidden = false;
        weaknessesList.innerHTML = renderBlockers.map(b => {
          const isMandatory = b.importance === 'required' || b.is_mandatory || b.isMandatory;
          const impactBadge = b.display_badge || (isMandatory ? 'Bắt buộc · Ảnh hưởng cao' : 'Ưu tiên');
          const impactClass = isMandatory ? 'is-high' : 'is-medium';
          const reasonText = b.reason || b.gapText || 'Không tìm thấy bằng chứng trong CV.';
          return `
            <li style="margin-bottom: 12px; list-style: none;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px;">
                <strong style="color: var(--color-error-700, #b91c1c);"><span style="margin-right:4px;">✕</span>${escapeHtml(b.title)}</strong>
                <span class="match-ux-impact-badge ${impactClass}">${escapeHtml(impactBadge)}</span>
              </div>
              <span style="font-size: 13.5px; color: var(--color-gray-700); display: block; margin-top: 4px; line-height: 1.4;">${escapeHtml(reasonText)}</span>
            </li>
          `;
        }).join('');
      } else {
        weaknessesSection.hidden = true;
      }
    }

    // Requirements Render Function
    const renderReqStatusText = (statusKey) => {
      switch (statusKey) {
        case 'SUPPORTED': return 'Đáp ứng';
        case 'PARTIALLY_SUPPORTED': return 'Đáp ứng một phần';
        case 'NOT_FOUND': return 'Chưa đáp ứng';
        case 'UNCERTAIN':
        default: return 'Chưa đủ bằng chứng';
      }
    };
    
    const getSimplifiedConclusion = (r) => {
       if (r.status === 'SUPPORTED') return 'CV có bằng chứng rõ ràng cho yêu cầu này.';
       if (r.status === 'PARTIALLY_SUPPORTED') return `CV có đề cập nhưng chưa tìm thấy bằng chứng rõ về việc sử dụng ${escapeHtml(r.title)} trong dự án hoặc kinh nghiệm thực tế.`;
       if (r.status === 'NOT_FOUND') return 'CV hiện chưa chứng minh yêu cầu này.';
       return 'Chưa tìm thấy bằng chứng phù hợp trong CV.';
    };

    const renderRequirementRow = (r) => `
      <article class="match-ux-req-row is-collapsed" data-expanded="false">
        <button type="button" class="match-ux-req-header" aria-expanded="false" aria-label="Xem chi tiết ${escapeHtml(r.title)}">
          <div class="match-ux-req-title-col">
            <span class="match-ux-chevron" aria-hidden="true">▸</span>
            <span class="match-ux-req-name">${escapeHtml(r.title)}</span>
          </div>
          <div class="match-ux-req-importance-col">
            <span class="match-ux-req-type ${r.isMandatory ? 'is-mandatory' : ''}">${r.isMandatory ? 'Bắt buộc' : 'Ưu tiên'}</span>
          </div>
          <div class="match-ux-req-status-col">
            <span class="match-ux-req-status is-${String(r.status).toLowerCase()}">${renderReqStatusText(r.status)}</span>
          </div>
        </button>
        <div class="match-ux-req-details" hidden>
          <div class="match-ux-evidence-box">
            <h5 style="color: var(--color-gray-500); margin-bottom: 4px; font-size: 13px; text-transform: uppercase;">JD yêu cầu</h5>
            <p style="margin-bottom: 12px; font-size: 14px;">${escapeHtml(r.jdText)}</p>
            <h5 style="color: var(--color-gray-500); margin-bottom: 4px; font-size: 13px; text-transform: uppercase;">Bằng chứng trong CV</h5>
            <p style="margin-bottom: 12px; font-size: 14px;">${escapeHtml(r.cvText || 'Chưa tìm thấy bằng chứng phù hợp.')}</p>
            <h5 style="color: var(--color-gray-500); margin-bottom: 4px; font-size: 13px; text-transform: uppercase;">Vì sao đánh giá như vậy?</h5>
            <p style="font-size: 14px;">${escapeHtml(r.gapText || getSimplifiedConclusion(r))}</p>
          </div>
        </div>
      </article>
    `;

    // 5. Sort all requirements and render Important Reqs First
    const getSortScore = (r) => {
       if (r.status === 'NOT_FOUND' && r.isMandatory) return 100;
       if (r.status === 'PARTIALLY_SUPPORTED' && r.isMandatory) return 90;
       if (r.status === 'UNCERTAIN' && r.isMandatory) return 85;
       if (r.status === 'SUPPORTED' && r.isMandatory) return 80;
       return 0; // Preferred
    };
    
    const sortedReqs = [...norm.allRequirements].sort((a, b) => getSortScore(b) - getSortScore(a));

    const importantReqsSection = document.getElementById('cv-result-important-reqs-section');
    const importantReqsList = document.getElementById('cv-result-important-reqs-list');
    const showAllBtn = document.getElementById('btn-show-all-reqs');
    const groupsContainer = document.getElementById('cv-result-groups-container');
    const qualSection = document.getElementById('cv-result-qualifications-section');
    const respSection = document.getElementById('cv-result-responsibilities-section');

    const topReqs = sortedReqs.slice(0, 6);
    if (importantReqsList) importantReqsList.innerHTML = topReqs.map(renderRequirementRow).join('');
    if (showAllBtn) {
       showAllBtn.textContent = `Xem toàn bộ ${norm.totalCount} yêu cầu`;
       showAllBtn.onclick = () => {
          if (importantReqsSection) importantReqsSection.hidden = true;
          if (groupsContainer) groupsContainer.hidden = false;
       };
    }
    
    if (importantReqsSection) importantReqsSection.hidden = false;
    if (groupsContainer) {
      groupsContainer.hidden = true;
      const activeCriteria = norm.criteria.filter(crit => crit.requirements && crit.requirements.length > 0);
      
      const renderGroup = (crit) => {
        const mappedLabel = categoryNames[crit.group] || crit.label;
        return `
        <section class="match-ux-group-block">
          <header class="match-ux-group-header">
            <h4 class="match-ux-group-title" style="font-size: 16px; margin-bottom: 8px;">${escapeHtml(mappedLabel)}</h4>
          </header>
          <div class="match-ux-group-list" style="margin-bottom: 24px;">
            ${crit.requirements.map(renderRequirementRow).join('')}
          </div>
        </section>
        `;
      };

      const qualGroups = activeCriteria.filter(crit => crit.group !== 'responsibilities_task_fit');
      const respGroups = activeCriteria.filter(crit => crit.group === 'responsibilities_task_fit');

      if (qualSection) {
         qualSection.innerHTML = qualGroups.map(renderGroup).join('');
      }
      if (respSection) {
         respSection.innerHTML = respGroups.map(renderGroup).join('');
      }
    }

    // Attach Event Delegation for Accordions
    const gapResultBody = document.querySelector('.gap-result-body');
    if (gapResultBody && !gapResultBody.dataset.accordionBound) {
      gapResultBody.dataset.accordionBound = 'true';
      gapResultBody.addEventListener('click', (e) => {
        const header = e.target.closest('.match-ux-req-header');
        if (!header) return;
        const row = header.closest('.match-ux-req-row');
        if (!row) return;
        
        const isExpanded = row.getAttribute('data-expanded') === 'true';
        row.setAttribute('data-expanded', !isExpanded);
        header.setAttribute('aria-expanded', !isExpanded);
        const details = row.querySelector('.match-ux-req-details');
        if (details) {
          details.hidden = isExpanded;
        }
        if (isExpanded) {
          row.classList.remove('is-expanded');
          row.classList.add('is-collapsed');
        } else {
          row.classList.remove('is-collapsed');
          row.classList.add('is-expanded');
        }
      });
    }

    // Populate Background Fit
    const backgroundItemsContainer = document.getElementById('cv-result-background-items');
    const backgroundSection = document.getElementById('cv-result-background-fit-section');
    if (backgroundItemsContainer && backgroundSection) {
       const bgs = [];
       norm.hardConstraints.forEach(hc => {
          let conclusionText = hc.statusLabel;
          if (hc.status === 'SUPPORTED') conclusionText = 'Phù hợp';
          else if (hc.status === 'PARTIALLY_SUPPORTED') conclusionText = 'Chênh lệch';
          else if (hc.status === 'NOT_FOUND') conclusionText = 'Chưa đáp ứng';
          
          bgs.push(`
            <div class="match-ux-bg-item" style="border-bottom: 1px solid var(--color-border); padding: 12px 0;">
               <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">${escapeHtml(hc.title)}</div>
               <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                 <div style="flex: 1; font-size: 14px; line-height: 1.5; padding-right: 16px;">
                   <div><span style="color: var(--color-gray-500); display: inline-block; width: 32px;">CV:</span> <span>${escapeHtml(hc.cv_value || 'Chưa đủ bằng chứng')}</span></div>
                   <div><span style="color: var(--color-gray-500); display: inline-block; width: 32px;">JD:</span> <span>${escapeHtml(hc.jd_value || hc.reason)}</span></div>
                 </div>
                 <div style="flex: 0 0 auto;">
                   <span class="match-ux-bg-status is-${hc.status.toLowerCase()}" style="font-size: 13px; font-weight: 500; display: inline-block; padding: 4px 0;">${escapeHtml(conclusionText)}</span>
                 </div>
               </div>
            </div>
          `);
       });
       if (bgs.length > 0) {
          backgroundItemsContainer.innerHTML = bgs.join('');
          backgroundSection.hidden = false;
       } else {
          backgroundSection.hidden = true;
       }
    }

    const footerContainer = document.getElementById('gap-modal-footer-actions-container');
    if (footerContainer) {
      footerContainer.innerHTML = `
        <div class="gap-modal-footer-secondary">
          <button type="button" id="btn-practice-interview" class="gap-btn-secondary">
            <span>Luyện phỏng vấn</span>
          </button>
          <button type="button" id="btn-browse-matching-jobs" class="gap-btn-secondary">
            <span>Xem việc làm phù hợp</span>
          </button>
        </div>
        <div class="gap-modal-footer-primary">
          <button type="button" id="btn-optimize-cv-ai" class="gap-btn-primary">
            <span>Tối ưu CV theo JD</span>
          </button>
        </div>
      `;
    }

    const emptyState = document.getElementById('cv-analysis-empty-state') || cvAnalysisEmptyState;
    if (emptyState) emptyState.hidden = true;
    const resultsCard = document.getElementById('cv-analysis-results-card') || cvAnalysisResultsCard;
    if (resultsCard) {
      resultsCard.hidden = false;
      resultsCard.style.removeProperty('display');
    }
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
    const allowedJdExtensions = ['.pdf', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.webp'];
    const fileExtension = `.${(file.name || '').split('.').pop()?.toLowerCase() || ''}`;
    if (!allowedJdExtensions.includes(fileExtension)) {
      showToast('File JD ch\u1ec9 h\u1ed7 tr\u1ee3 PDF, DOCX, TXT, JPG, JPEG, PNG ho\u1eb7c WEBP.', 'warning');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast('Dung l\u01b0\u1ee3ng file JD kh\u00f4ng \u0111\u01b0\u1ee3c v\u01b0\u1ee3t qu\u00e1 20 MB.', 'warning');
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

  let isMatchRunning = false;

  // Handle Spaceship CV Upload Form Submit
  if (cvPageForm) {
    cvPageForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isMatchRunning) {
        return;
      }
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
      const analyzeBtn = document.getElementById('p1-analyze-btn');
      const hint = document.getElementById('p1-cta-hint');

      try {
        isMatchRunning = true;
        if (submitButton) submitButton.disabled = true;
        if (analyzeBtn) {
          analyzeBtn.disabled = true;
          analyzeBtn.classList.add('is-loading');
        }

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
        window.latestMatchResult = analysis;
        window.latestMatchId = match.match_id;
        if (analysis.id || analysis.analysis_id) {
          window.latestAnalysisId = analysis.id || analysis.analysis_id;
        }
        localStorage.setItem('latest_match_id', match.match_id);
        if (analysis.id || analysis.analysis_id) {
          localStorage.setItem('latest_analysis_id', analysis.id || analysis.analysis_id);
        }
        setAgentProgress('match');

        try {
          renderInlineCVAnalysis(analysis, selectedCvId, selectedJdId);
        } catch (renderErr) {
          console.error('[Match] Error rendering match analysis UI:', renderErr);
          showToast(`⚠️ Lỗi hiển thị kết quả phân tích: ${renderErr?.message || renderErr}`, 'warning');
          throw renderErr;
        }

        refreshDashboardOverview();
        setAgentProgress('save');
        if (cvPageTitleInput) cvPageTitleInput.value = '';
        if (cvPageFileInput) cvPageFileInput.value = '';
        if (selectedFileNameEl) {
          selectedFileNameEl.textContent = '';
          selectedFileNameEl.style.display = 'none';
        }
        if (cvAnalysisCvSelect && selectedCvId) {
          cvAnalysisCvSelect.value = selectedCvId;
        }
        if (cvAnalysisJdSelect && selectedJdId) {
          cvAnalysisJdSelect.value = selectedJdId;
        }
        if (typeof window.updateP1UI === 'function') {
          window.updateP1UI();
        }
      } catch (err) {
        console.error('[Match] Error during match flow:', err);
        const errMsg = err?.message || 'Không thể hoàn tất Match CV với JD.';
        showToast(`❌ Không thể phân tích CV: ${errMsg}`, 'error');
        if (hint) {
          hint.innerHTML = `<span class="cta-error-text" style="color: #dc2626; font-weight: 500;">⚠️ ${escapeHtml(errMsg)}</span>`;
        }
      } finally {
        isMatchRunning = false;
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
  let loadSpaceshipCVListInFlight = null;
  async function loadSpaceshipCVList(preferredCvId = '') {
    if (loadSpaceshipCVListInFlight) return loadSpaceshipCVListInFlight;
    loadSpaceshipCVListInFlight = (async () => {
      const tableBody = document.getElementById('career-cv-table-body') || careerCVTableBody;
      const cvSelect = document.getElementById('cv-analysis-cv-select') || cvAnalysisCvSelect;
      if (!cvSelect && !tableBody) return;
      if (!ApiClient.isAuthenticated()) {
        loadedCVs = [];
        if (cvSelect) {
          cvSelect.innerHTML = '<option value="">Vui lòng đăng nhập để chọn CV</option>';
          cvSelect.disabled = true;
          enhanceGapSelect(cvSelect);
        }

        const cardsGrid = document.getElementById('p1-cv-cards-grid');
        if (cardsGrid) {
          cardsGrid.innerHTML = '<p class="cv-grid-empty">Vui lòng đăng nhập để xem CV đã lưu.</p>';
        }

        renderCareerPortfolioCVs([]);
        updateCVSelectionHint();
        return;
      }

      const previousValue = preferredCvId || (cvSelect ? cvSelect.value : '');
      try {
        const cvGate = document.getElementById('p1-cv-login-gate');
        if (cvGate) cvGate.style.display = 'none';
        const cvSec = document.getElementById('p1-cv-select-section');
        if (cvSec) cvSec.style.display = 'block';
        loadedCVs = await ApiClient.listCVs();
        if (cvSelect) {
          cvSelect.disabled = false;
          cvSelect.innerHTML = [
            '<option value="">Chọn một CV đã lưu</option>',
            ...(loadedCVs || []).map(cv => `<option value="${escapeHtml(cv.id)}">${escapeHtml(cv.title || cv.file_name || 'CV Hồ sơ')}</option>`),
          ].join('');
          if ([...cvSelect.options].some(option => option.value === previousValue)) {
            cvSelect.value = previousValue;
          }
          const preselectedCVId = window.sessionStorage.getItem('career-preselected-cv-id');
          if (preselectedCVId && [...cvSelect.options].some(option => option.value === preselectedCVId)) {
            cvSelect.value = preselectedCVId;
            window.sessionStorage.removeItem('career-preselected-cv-id');
          }
          enhanceGapSelect(cvSelect);

          // Render CV Cards Grid for the Match CV redesigned view
          const cardsGrid = document.getElementById('p1-cv-cards-grid');
          if (cardsGrid) {
            if (loadedCVs && loadedCVs.length > 0) {
              cardsGrid.innerHTML = loadedCVs.map(cv => {
                const statusType = cv.status_type || (cv.is_optimized ? 'optimized' : (cv.match_count > 0 ? 'matched' : 'raw'));
                const statusLabel = cv.status_label || (statusType === 'optimized' ? 'Đã tối ưu' : (statusType === 'matched' ? 'Đã Match' : 'CV gốc'));
                return `
                <div class="cv-card${cv.id === cvSelect.value ? ' is-selected' : ''}" data-cv-id="${escapeHtml(cv.id)}" role="button" tabindex="0" aria-pressed="${cv.id === cvSelect.value ? 'true' : 'false'}">
                  <div class="cv-card-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </div>
                  <div class="cv-card-content">
                    <div class="cv-card-head-row">
                      <h4 class="cv-card-title">${escapeHtml(cv.title || cv.file_name || 'CV Hồ sơ')}</h4>
                      <span class="cv-card-badge cv-status-badge is-${statusType}">${escapeHtml(statusLabel)}</span>
                    </div>
                    <p class="cv-card-meta">Cập nhật: ${cv.updated_at ? new Date(cv.updated_at).toLocaleDateString() : 'Gần đây'}</p>
                  </div>
                </div>
              `;
              }).join('');

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
        const searchInput = document.getElementById('career-cv-search') || careerSearchInput;
        renderCareerPortfolioCVs(loadedCVs, searchInput?.value || '');
        updateCVSelectionHint();
      } catch (err) {
        if (cvSelect) {
          cvSelect.innerHTML = '<option value="">Không thể tải danh sách CV</option>';
          cvSelect.disabled = true;
          enhanceGapSelect(cvSelect);
        }
        const cardsGrid = document.getElementById('p1-cv-cards-grid');
        if (cardsGrid) {
          cardsGrid.innerHTML = '<p class="cv-grid-empty">Không thể tải CV.</p>';
        }
        updateCVSelectionHint();
        showToast(`Không thể tải CV: ${err.message}`, 'error');
      }
    })().finally(() => {
      loadSpaceshipCVListInFlight = null;
    });
    return loadSpaceshipCVListInFlight;
  }

  window.loadSpaceshipCVList = loadSpaceshipCVList;
  window.renderCareerPortfolioCVs = renderCareerPortfolioCVs;

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
    btnOptimizeCvAI.innerHTML = '<span aria-hidden="true">✦</span> AI đang tối ưu...';
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
      btnOptimizeCvAI.innerHTML = '<span aria-hidden="true">↻</span> Tối ưu lại';
      if (cvAiOptimizationStatus) {
        cvAiOptimizationStatus.textContent = `Đã áp dụng ${changeCount} thay đổi có bằng chứng${removedCount ? ` và loại ${removedCount} claim không hợp lệ` : ''}; bản CV tối ưu đã được tải xuống. CV gốc vẫn được giữ nguyên.`;
      }
      showToast('Đã tối ưu và tải xuống bản CV mới. CV gốc không bị thay đổi.', 'success');
    } catch (err) {
      btnOptimizeCvAI.disabled = false;
      btnOptimizeCvAI.innerHTML = '<span aria-hidden="true">✦</span> Thử tối ưu lại';
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

  document.getElementById('career-portfolio-workspace')?.addEventListener('click', async event => {
    const findJobsButton = event.target.closest('[data-career-find-jobs-id]');
    if (findJobsButton) {
      const cvId = findJobsButton.dataset.careerFindJobsId || loadedCVs[0]?.id;
      switchView('find-jobs');
      if (cvId) {
        activeJobSearchCV = cvId;
        await loadJobSearchCVOptions(cvId);
        await loadJobSearchResults({ cvId, shouldGuide: true });
      }
      return;
    }
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
      : metadata.llm_policy_blocked ? 'Phân tích local-first'
        : metadata.fallback_used ? 'Local fallback' : 'Phân tích local';
    document.getElementById('inspector-agent-model').textContent = metadata.llm_succeeded
      ? (metadata.model || 'Gemini')
      : 'Local parser + evidence guardrail';
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
    const button = document.getElementById('btn-inspector-reanalyze');
    try {
      button.disabled = true;
      button.textContent = 'Đang phân tích local...';
      showToast('Đang trích xuất lại kỹ năng, kinh nghiệm và kiểm chứng evidence...', 'info');
      const updated = await ApiClient.reanalyzeCV(inspectedCV.id, false);
      inspectCVDetail(updated);
      await loadSpaceshipCVList();
      showToast(metadataMessage(updated), updated?.parsed_json?.agent_metadata?.llm_succeeded ? 'success' : 'warning');
    } catch (err) {
      showToast(`❌ Không thể phân tích lại: ${err.message}`, 'error');
    } finally {
      button.disabled = false;
      button.textContent = '✨ Phân tích lại local';
    }
  });

  function metadataMessage(cv) {
    const meta = cv?.parsed_json?.agent_metadata || {};
    return meta.llm_succeeded
      ? `LLM ${meta.model || ''} đã trả kết quả có cấu trúc.`
      : meta.llm_policy_blocked
        ? 'Đã phân tích local; toàn văn CV không được gửi tới Gemini.'
        : `Đã phân tích local. ${meta.llm_error || ''}`;
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
  const jobSearchInput = document.getElementById('job-search-keyword-input');
  const jobSearchCVSelect = document.getElementById('job-search-cv-select');
  const jobMatchCVButton = document.getElementById('job-match-cv-btn');
  const jobSearchResetButton = document.getElementById('job-search-reset-btn');
  const jobSearchResults = document.getElementById('job-search-results');
  const jobResultsSummary = document.getElementById('job-results-summary');
  const jobResultsMode = document.getElementById('job-results-mode');
  const jobPagination = document.getElementById('job-pagination');
  const jobJourney = document.getElementById('top-jobs-journey');
  const jobFiltersGroup = document.querySelector('#view-find-jobs .filter-dropdowns-group');
  const jobResultsHeader = document.querySelector('#view-find-jobs .top-jobs-results-header');
  const jobRecommendedTab = document.getElementById('job-results-tab-recommended');
  const jobCatalogTab = document.getElementById('job-results-tab-catalog');
  let activeJobSearchCV = '';
  let jobSearchPage = 1;
  // Catalog browsing is deliberately not a Top-10 experience.  Twenty cards
  // per page make the breadth visible while retaining usable pagination.
  const JOBS_PER_PAGE = 20;
  let visibleJobResults = [];
  let currentJobSearchMode = 'recommended';
  let lastJobSearchResultContext = null;
  let jobProgressTimers = [];
  let jobSearchUiState = 'idle';
  let jobProcessingModalVisible = false;
  let jobProcessingCloseTimer = null;

  function setJobResultsView(mode) {
    const isCatalog = mode === 'catalog';
    [jobRecommendedTab, jobCatalogTab].forEach(tab => {
      if (!tab) return;
      const active = tab === (isCatalog ? jobCatalogTab : jobRecommendedTab);
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  async function populateJobLocationFilter() {
    const locationSelect = document.getElementById('job-filter-location');
    if (!locationSelect) return;
    try {
      const response = await ApiClient.listJobLocations();
      const previous = locationSelect.value;
      // The backend is the source of truth for canonical Vietnamese location
      // labels. The small client guard also prevents a stale API response or
      // browser-restored option list from leaking work modes into this facet.
      const canonicalizeLocationFacet = (value) => {
        const raw = String(value || '').trim();
        const folded = raw.normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[đĐ]/g, 'd')
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/\s+/g, ' ');
        if (!folded || /^(unknown|n\/?a|chua xac dinh|remote|wfh|work from home)$/.test(folded)) return null;
        if (/(^|\s)(hybrid|remote)(\s|$)/.test(folded) && !/(ha noi|hanoi|ho chi minh|hcm|da nang|danang|binh duong|vung tau|quy nhon|hai phong|can tho)/.test(folded)) return null;
        if (/(ha noi|hanoi)/.test(folded)) return 'Hà Nội';
        if (/(ho chi minh|\bhcm\b|\btphcm\b|saigon)/.test(folded)) return 'TP. Hồ Chí Minh';
        if (/(da nang|danang)/.test(folded)) return 'Đà Nẵng';
        if (/binh duong/.test(folded)) return 'Bình Dương';
        if (/(ba ria vung tau|vung tau)/.test(folded)) return 'Bà Rịa - Vũng Tàu';
        if (/quy nhon/.test(folded)) return 'Quy Nhơn';
        if (/hai phong/.test(folded)) return 'Hải Phòng';
        if (/can tho/.test(folded)) return 'Cần Thơ';
        return null;
      };
      const locations = [...new Set(
        (Array.isArray(response?.locations) ? response.locations : [])
          .map(canonicalizeLocationFacet)
          .filter(Boolean)
      )].sort((left, right) => left.localeCompare(right, 'vi'));
      locationSelect.replaceChildren(
        new Option('Tất cả địa điểm', ''),
        ...locations.map(location => {
          const option = document.createElement('option');
          option.value = location;
          option.textContent = location;
          return option;
        }),
      );
      if ([...locationSelect.options].some(option => option.value === previous)) {
        locationSelect.value = previous;
      }
    } catch (_) {
      // Keep the default “all locations” option if the JD catalog is unavailable.
    }
  }

  function setJobJourneyStage(stage) {
    if (!jobJourney) return;
    const order = ['cv', 'filters', 'results'];
    const currentIndex = order.indexOf(stage);
    jobJourney.querySelectorAll('[data-job-journey-step]').forEach(step => {
      const stepIndex = order.indexOf(step.dataset.jobJourneyStep);
      step.classList.toggle('is-complete', currentIndex > stepIndex);
      step.classList.toggle('is-active', currentIndex === stepIndex);
      step.removeAttribute('aria-current');
      if (currentIndex === stepIndex) step.setAttribute('aria-current', 'step');
    });
  }

  function clearJobSearchProgress() {
    jobProgressTimers.forEach(timer => window.clearTimeout(timer));
    jobProgressTimers = [];
  }

  function getJobProcessingModal() {
    let modal = document.getElementById('job-processing-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'job-processing-modal';
    modal.className = 'job-processing-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="job-processing-backdrop"></div>
      <section class="job-processing-card" role="dialog" aria-modal="true" aria-live="polite" aria-labelledby="job-processing-title">
        <div class="job-processing-mascot" aria-hidden="true">
          <img src="/images/image2.png" alt="">
          <span data-processing-symbol>✦</span>
        </div>
        <h3 id="job-processing-title" data-processing-title></h3>
        <p data-processing-text></p>
        <ol class="job-processing-steps" aria-label="Tiến độ tìm công việc">
          <li data-processing-step="0"><span>○</span> Đọc CV</li>
          <li data-processing-step="1"><span>○</span> Tìm công việc</li>
          <li data-processing-step="2"><span>○</span> Xếp hạng</li>
          <li data-processing-step="3"><span>○</span> Hoàn tất</li>
        </ol>
        <p class="job-processing-helper" data-processing-helper></p>
        <p class="job-processing-status" data-processing-status></p>
        <button type="button" class="btn-find-top-jobs job-processing-action" data-processing-action hidden></button>
      </section>
    `;
    modal.querySelector('[data-processing-action]')?.addEventListener('click', () => {
      if (jobSearchUiState === 'failed') {
        closeJobProcessingModal();
        loadJobSearchResults({ cvId: jobSearchCVSelect?.value, shouldGuide: true });
        return;
      }
      closeJobProcessingModal();
      scrollToJobResults();
    });
    document.body.appendChild(modal);
    return modal;
  }

  function scrollToJobResults() {
    const firstResult = jobSearchResults?.querySelector('.top-job-card');
    (firstResult || jobResultsHeader)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (firstResult) {
      firstResult.classList.add('is-highlighted');
      window.setTimeout(() => firstResult.classList.remove('is-highlighted'), 1600);
    }
  }

  function closeJobProcessingModal() {
    if (jobProcessingCloseTimer) window.clearTimeout(jobProcessingCloseTimer);
    jobProcessingCloseTimer = null;
    const modal = document.getElementById('job-processing-modal');
    modal?.classList.remove('is-open');
    modal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('job-processing-open');
    jobProcessingModalVisible = false;
  }

  function updateJobProcessingModal(state, resultCount = 0) {
    const modal = getJobProcessingModal();
    const stepLabels = ['Xem hồ sơ đã chọn', 'Tìm cơ hội phù hợp', 'Phân tích mức độ phù hợp', 'Sẵn sàng xem'];
    modal.querySelectorAll('[data-processing-step]').forEach((step, index) => {
      const marker = step.querySelector('span');
      step.replaceChildren(marker || document.createElement('span'), document.createTextNode(` ${stepLabels[index]}`));
    });
    const states = {
      preparing: {
        title: 'Đang đọc CV của bạn...',
        text: 'Mình đang xem kỹ năng và kinh nghiệm để hiểu bạn phù hợp với công việc nào.',
        helper: '', status: 'Bước 1 / 4', symbol: '✦', activeStep: 0,
      },
      retrieving: {
        title: 'Đang tìm kiếm cho bạn...',
        text: 'Mình đã hiểu CV rồi. Giờ đang tìm những vị trí gần nhất với thế mạnh của bạn.',
        helper: 'Được nửa chặng rồi', status: 'Bước 2 / 4', symbol: '⌕', activeStep: 1,
      },
      ranking: {
        title: 'Đang chọn những vị trí nổi bật nhất...',
        text: 'Đã tìm được một số lựa chọn tốt. Mình đang kiểm tra kỹ hơn để xếp hạng chúng cho bạn.',
        helper: 'Sắp xong rồi nhé!', status: 'Bước 3 / 4', symbol: '✦', activeStep: 2,
      },
      evaluating: {
        title: 'Vẫn đang xử lý nhé ✦',
        text: 'Có khá nhiều công việc để so sánh nên bước này cần thêm một chút thời gian.',
        helper: 'Mình vẫn đang chọn các vị trí phù hợp nhất.', status: 'Bước 3 / 4', symbol: '✦', activeStep: 2,
      },
      waiting: {
        title: 'Vẫn đang xử lý nhé ✦',
        text: 'Có khá nhiều công việc để so sánh nên bước này cần thêm một chút thời gian.',
        helper: 'Mình vẫn đang tìm những lựa chọn phù hợp nhất.', status: 'Đang xử lý', symbol: '✦', activeStep: 1,
      },
      completed: {
        title: 'Xong rồi!',
        text: `Mình đã tìm được ${resultCount} công việc phù hợp nhất với CV của bạn.`,
        helper: '', status: 'Bước 4 / 4', symbol: '✓', activeStep: 3, action: 'Xem kết quả',
      },
      failed: {
        title: 'Có chút gián đoạn',
        text: 'CV của bạn vẫn an toàn. Mình chưa thể hoàn tất việc tìm kiếm.',
        helper: '', status: '', symbol: '!', activeStep: -1, action: 'Thử lại',
      },
    };
    const localFirstStates = {
      preparing: {
        title: 'Đang đọc hồ sơ đã lưu...',
        text: 'Đang dùng dữ liệu CV đã phân tích để xác định kỹ năng và kinh nghiệm chính.',
        helper: 'Gợi ý sẽ được cá nhân hóa theo hồ sơ bạn chọn.', status: 'Bước 1 / 4', symbol: '✦', activeStep: 0,
      },
      retrieving: {
        title: 'Đang tìm cơ hội phù hợp...',
        text: 'Đang tìm các vị trí gần nhất với kỹ năng, kinh nghiệm và tiêu chí của bạn.',
        helper: 'Danh sách được cá nhân hóa theo hồ sơ đã chọn.', status: 'Bước 2 / 4', symbol: '⌕', activeStep: 1,
      },
      ranking: {
        title: 'Đang sắp xếp các vị trí phù hợp...',
        text: 'Đang đối chiếu kỹ năng, kinh nghiệm và điều kiện của từng vị trí để sắp thứ tự phù hợp.',
        helper: 'Điểm phù hợp chỉ hiển thị khi đã có đủ thông tin đánh giá.', status: 'Bước 3 / 4', symbol: '✦', activeStep: 2,
      },
      evaluating: {
        title: 'Đang hoàn thiện thứ tự gợi ý...',
        text: 'Đã tìm thấy các vị trí liên quan; hệ thống đang hoàn thiện phần giải thích hiển thị.',
        helper: 'Bạn có thể mở từng vị trí để xem chi tiết.', status: 'Bước 3 / 4', symbol: '✦', activeStep: 2,
      },
      waiting: {
        title: 'Đang tìm cơ hội phù hợp...',
        text: 'Danh mục JD lớn hơn bình thường, hệ thống vẫn đang xử lý an toàn trên máy chủ.',
        helper: 'CV của bạn vẫn được giữ riêng tư.', status: 'Đang xử lý', symbol: '✦', activeStep: 1,
      },
      completed: {
        title: 'Đã sẵn sàng kết quả!',
        text: `Đã tìm được ${resultCount} JD liên quan tới CV đã chọn.`,
        helper: 'Mở từng vị trí để xem mức độ phù hợp và thông tin chi tiết.', status: 'Bước 4 / 4', symbol: '✓', activeStep: 3, action: 'Xem kết quả',
      },
    };
    const current = localFirstStates[state] || states[state] || localFirstStates.preparing;
    modal.dataset.state = state;
    modal.querySelector('[data-processing-title]').textContent = current.title;
    modal.querySelector('[data-processing-text]').textContent = current.text;
    modal.querySelector('[data-processing-helper]').textContent = current.helper;
    modal.querySelector('[data-processing-status]').textContent = current.status;
    modal.querySelector('[data-processing-symbol]').textContent = current.symbol;
    modal.querySelectorAll('[data-processing-step]').forEach((step, index) => {
      const marker = step.querySelector('span');
      step.classList.toggle('is-complete', state === 'completed' || (current.activeStep >= 0 && index < current.activeStep));
      step.classList.toggle('is-active', index === current.activeStep && state !== 'completed');
      if (marker) marker.textContent = step.classList.contains('is-complete') ? '✓' : step.classList.contains('is-active') ? '●' : '○';
    });
    const action = modal.querySelector('[data-processing-action]');
    if (action) {
      action.hidden = !current.action;
      action.textContent = current.action || '';
    }
  }

  function openJobProcessingModal() {
    if (jobProcessingCloseTimer) window.clearTimeout(jobProcessingCloseTimer);
    const modal = getJobProcessingModal();
    jobProcessingModalVisible = true;
    updateJobProcessingModal('preparing');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('job-processing-open');
  }

  function setJobProgressStep(index, state, message) {
    const progress = jobSearchResults?.querySelector('.job-search-progress-card');
    if (!progress) return;
    progress.dataset.status = state;
    const status = progress.querySelector('[data-job-search-status]');
    if (status && message) status.textContent = message;
  }

  function startJobSearchProgress(showModal = false) {
    clearJobSearchProgress();
    jobSearchUiState = 'preparing';
    // Keep processing in the page: no modal, no staged AI pipeline.
    setJobProgressStep(0, 'active', 'Hệ thống đang phân tích hồ sơ và xếp hạng các cơ hội phù hợp.');
    jobProgressTimers = [
      window.setTimeout(() => {
        if (jobSearchUiState !== 'retrieving') return;
        setJobProgressStep(1, 'active', 'Đang tìm các cơ hội phù hợp với CV của bạn.');
      }, 2500),
    ];
  }

  function markJobSearchRequestStarted() {
    jobSearchUiState = 'retrieving';
    setJobProgressStep(1, 'active', 'Hệ thống đang phân tích hồ sơ và xếp hạng các cơ hội phù hợp.');
  }

  function completeJobSearchProgress(message, resultCount = 0, shouldGuide = false) {
    clearJobSearchProgress();
    jobSearchUiState = 'completed';
    // The loading card is replaced by the ranked list in the same render pass.
    if (shouldGuide) window.setTimeout(scrollToJobResults, 250);
  }

  function renderJobSkeleton() {
    return `
      <div class="top-jobs-loading-wrap" role="status" aria-live="polite">
        <article class="job-search-progress-card" role="status" aria-live="polite" data-status="running">
          <div class="job-search-progress-copy">
            <span class="job-search-progress-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path></svg></span>
            <div>
              <h4>Đang tìm việc phù hợp với CV của bạn</h4>
              <p data-job-search-status>Hệ thống đang phân tích hồ sơ và xếp hạng các cơ hội phù hợp.</p>
            </div>
          </div>
          <div class="job-search-progress-track" aria-hidden="true"><span></span></div>
        </article>
      </div>
    `;
  }

  function renderTopJobsResultContext({ cvName, total, retrievalOnlyCount, cacheHit = false }) {
    const hasEvidence = total - retrievalOnlyCount;
    const isRetrievalOnly = retrievalOnlyCount === total;
    const title = isRetrievalOnly
      ? 'Gợi ý việc làm phù hợp với hồ sơ của bạn'
      : `${hasEvidence}/${total} vị trí đã có đánh giá mức độ phù hợp`;
    const detail = isRetrievalOnly
      ? 'Các gợi ý này dựa trên kỹ năng và kinh nghiệm trong hồ sơ. Mở vị trí để xem yêu cầu trước khi ứng tuyển.'
      : 'Các vị trí đã phân tích có giải thích mức độ phù hợp. Những vị trí còn lại là gợi ý để bạn khám phá thêm.';
    const badge = isRetrievalOnly ? 'Gợi ý cá nhân hóa' : `${hasEvidence} đã phân tích`;
    return `
      <aside class="top-jobs-result-context ${isRetrievalOnly ? 'is-retrieval-only' : 'has-evidence'}" role="status" aria-live="polite">
        <span class="top-jobs-result-context__badge">${badge}</span>
        </aside>
    `;
  }

  function renderJobSearchPage() {
    const resultsContainer = document.getElementById('job-search-results');
    if (!resultsContainer) return;
    if (!visibleJobResults.length) {
      resultsContainer.innerHTML = renderEmptyState();
      renderJobPagination();
      return;
    }
    const isCatalog = currentJobSearchMode === 'catalog';

    if (isCatalog) {
      // Phân trang chỉ áp dụng cho danh mục đầy đủ, không áp dụng Top 10 theo CV.
      const totalPages = Math.ceil(visibleJobResults.length / JOBS_PER_PAGE);
      if (jobSearchPage > totalPages) jobSearchPage = 1;
      if (jobSearchPage < 1) jobSearchPage = 1;

      const start = (jobSearchPage - 1) * JOBS_PER_PAGE;
      const end = Math.min(start + JOBS_PER_PAGE, visibleJobResults.length);
      const pagedJobs = visibleJobResults.slice(start, end);

      resultsContainer.innerHTML = pagedJobs.map((job, index) => renderJobCatalogCard(job, start + index)).join('');
      resultsContainer.classList.add('is-ready');
      renderJobPagination();
    } else {
      // Bên Top 10 đề xuất: Hiển thị trọn vẹn danh sách đề xuất (không phân trang)
      resultsContainer.innerHTML = visibleJobResults.map((job, index) => renderJobCatalogCard(job, index)).join('');
      resultsContainer.classList.add('is-ready');
      renderJobPagination();
    }
  }

  function renderJobPagination() {
    const paginationEl = document.getElementById('job-pagination');
    if (!paginationEl) return;
    const isCatalog = currentJobSearchMode === 'catalog';
    // Chỉ hiển thị phân trang khi ở chế độ Khám phá việc làm
    if (!isCatalog) {
      paginationEl.hidden = true;
      paginationEl.innerHTML = '';
      return;
    }
    const totalPages = Math.ceil(visibleJobResults.length / JOBS_PER_PAGE);
    if (totalPages <= 1) {
      paginationEl.hidden = true;
      paginationEl.innerHTML = '';
      return;
    }
    const start = (jobSearchPage - 1) * JOBS_PER_PAGE;
    const end = Math.min(start + JOBS_PER_PAGE, visibleJobResults.length);
    const visiblePages = [...new Set([
      1,
      totalPages,
      jobSearchPage - 1,
      jobSearchPage,
      jobSearchPage + 1,
    ].filter(page => page >= 1 && page <= totalPages))].sort((a, b) => a - b);

    const pageButtons = visiblePages.map((page, index) => {
      const prev = visiblePages[index - 1];
      const gap = prev && page - prev > 1 ? '<span class="p1-pagination-ellipsis" aria-hidden="true">…</span>' : '';
      return `${gap}<button type="button" class="${page === jobSearchPage ? 'is-current' : ''}" data-job-page="${page}" aria-label="Trang ${page}" aria-current="${page === jobSearchPage ? 'page' : 'false'}">${page}</button>`;
    }).join('');
    paginationEl.hidden = false;
    paginationEl.innerHTML = `<span class="job-pagination-summary">Hiển thị ${start + 1}–${end} trong ${visibleJobResults.length} công việc</span><div class="job-pagination-controls"><button type="button" data-job-page="prev" ${jobSearchPage === 1 ? 'disabled' : ''} aria-label="Trang trước">‹ <span>Trước</span></button>${pageButtons}<button type="button" data-job-page="next" ${jobSearchPage === totalPages ? 'disabled' : ''} aria-label="Trang sau"><span>Sau</span> ›</button></div>`;
  }

  function renderNoCVState() {
    return `
      <div class="job-search-state job-search-no-cv" role="status" aria-live="polite">
        <div class="job-state-icon no-cv-icon" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <path d="M12 18v-6"/>
            <path d="m9 15 3-3 3 3"/>
          </svg>
        </div>
        <div class="job-state-content">
          <h3>Chưa chọn CV để phân tích</h3>
          <p>Vui lòng chọn một CV đã lưu từ danh sách hoặc tải lên CV mới để AI phân tích và đề xuất Top 10 vị trí phù hợp nhất.</p>
        </div>
        <div class="job-state-actions">
          <button type="button" class="btn-job-state-primary" id="btn-job-search-upload-cv">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Tải lên hoặc chọn CV
          </button>
        </div>
      </div>
    `;
  }

  function renderEmptyState() {
    return `
      <div class="job-search-state job-search-empty" role="status" aria-live="polite">
        <div class="job-state-icon empty-icon" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </div>
        <div class="job-state-content">
          <h3>Chưa tìm thấy công việc đủ phù hợp</h3>
          <p>Chưa tìm thấy công việc đủ phù hợp với bộ lọc hiện tại. Bạn có thể xóa bộ lọc để hệ thống tìm lại dựa hoàn toàn trên CV.</p>
        </div>
        <div class="job-state-actions">
          <button type="button" class="btn-job-state-primary btn-reset-job-filters" id="btn-reset-job-filters">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Xóa bộ lọc và tìm lại
          </button>
        </div>
      </div>
    `;
  }

  function renderErrorState(errorMessage) {
    return `
      <div class="job-search-state job-search-error" role="alert" aria-live="assertive">
        <div class="job-state-icon error-icon" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div class="job-state-content">
          <h3>Quá trình tìm kiếm vừa bị gián đoạn</h3>
          <p>CV của bạn vẫn được giữ nguyên. ${escapeHtml(errorMessage || 'Vui lòng thử lại để tiếp tục tìm công việc phù hợp.')}</p>
        </div>
        <div class="job-state-actions">
          <button type="button" class="btn-job-state-primary btn-retry-job-search" id="btn-job-search-retry">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Thử lại
          </button>
        </div>
      </div>
    `;
  }

  function formatJobRelativeTimeVi(dateStr) {
    if (!dateStr) return '';
    let s = String(dateStr).trim();
    if (s && !s.endsWith('Z') && !s.includes('+') && !s.includes('GMT')) {
      if (s.includes('T')) s += 'Z';
      else if (/^\d{4}-\d{2}-\d{2}/.test(s)) s = s.replace(' ', 'T') + 'Z';
    }
    const date = new Date(s);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 0 || diffSec < 120) return 'Vừa đăng';
    if (diffSec < 3600) return `Đăng ${Math.max(1, Math.floor(diffSec / 60))} phút trước`;
    if (diffSec < 86400) return `Đăng ${Math.floor(diffSec / 3600)} giờ trước`;
    const days = Math.floor(diffSec / 86400);
    if (days === 1) return 'Đăng hôm qua';
    if (days < 30) return `Đăng ${days} ngày trước`;
    if (days < 365) return `Đăng ${Math.floor(days / 30)} tháng trước`;
    return `Đăng ${date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
  }

  function formatJobDeadlineVi(deadlineStr) {
    if (!deadlineStr) return '';
    const clean = String(deadlineStr).trim();
    const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      return `${d}/${m}`;
    }
    if (/^\d{1,2}\/\d{1,2}/.test(clean)) return clean;
    return clean;
  }

  function getJobSourceName(job) {
    if (job.source_name && String(job.source_name).trim() && !/^(none|n\/a|unknown|chưa xác định)$/i.test(job.source_name)) {
      return String(job.source_name).trim();
    }
    if (job.source && String(job.source).trim() && !/^(none|n\/a|unknown|chưa xác định)$/i.test(job.source)) {
      return String(job.source).trim();
    }
    const url = String(job.source_url || '').toLowerCase();
    if (url.includes('linkedin.com')) return 'LinkedIn';
    if (url.includes('topcv.vn')) return 'TopCV';
    if (url.includes('vietnamworks.com')) return 'VietnamWorks';
    if (url.includes('itviec.com')) return 'ITviec';
    if (url.includes('joboko.com')) return 'Joboko';
    if (url.includes('careerbuilder.vn')) return 'CareerBuilder';
    try {
      if (/^https?:\/\//i.test(url)) {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, '');
      }
    } catch (_) {}
    return 'Nguồn tuyển dụng';
  }

  function getCompanyInitials(name) {
    const raw = String(name || 'Doanh nghiệp')
      .replace(/^(công ty|cty|tập đoàn|doanh nghiệp|ngân hàng|tổng công ty)\s+/i, '')
      .trim();
    const match = raw.match(/^[a-zA-ZÀ-ỹ0-9]/);
    return match ? match[0].toUpperCase() : 'D';
  }

  function renderJobCatalogCard(job, index = 0) {
    const isCatalog = job.catalog_mode === true;
    const rank = job.rank || (index + 1);
    const isRetrievalOnly = !isCatalog && String(job.match_id || '').startsWith('RETRIEVAL_');

    return renderUnifiedJobCardHtml(job, {
      variant: isCatalog ? 'catalog' : 'top-match',
      rank: rank,
      isRetrievalOnly: isRetrievalOnly,
    });
  }

  let cachedCVList = [];
  let activeCvTabFilter = 'all';
  let cvFilterSearchQuery = '';

  function formatFullDateTimeVi(dateStr) {
    if (!dateStr) return 'Gần đây';
    let s = String(dateStr).trim();
    if (s && !s.endsWith('Z') && !s.includes('+') && !s.includes('GMT')) {
      if (s.includes('T')) {
        s = s + 'Z';
      } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
        s = s.replace(' ', 'T') + 'Z';
      }
    }
    const date = new Date(s);
    if (Number.isNaN(date.getTime())) return 'Gần đây';
    const d = date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
    const t = date.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });
    return `${t} · ${d}`;
  }

  function getCVStatusInfo(cv) {
    if (!cv) return { type: 'none', label: 'Chưa chọn', format: '' };
    const statusType = cv.status_type || (cv.is_optimized ? 'optimized' : (cv.match_count > 0 ? 'matched' : 'raw'));
    const statusLabel = cv.status_label || (statusType === 'optimized' ? 'Đã tối ưu' : (statusType === 'matched' ? 'Đã đối chiếu' : 'CV gốc'));

    // File format detection
    const fileName = (cv.file_path || cv.file_name || cv.title || '').toLowerCase();
    let format = 'CV';
    if (fileName.endsWith('.pdf')) format = 'PDF';
    else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) format = 'DOCX';

    return { type: statusType, label: statusLabel, format };
  }

  function updateJobSearchCVTrigger(selectedCV) {
    const badgeEl = document.getElementById('top-jobs-selected-cv-badge');
    const titleEl = document.getElementById('top-jobs-selected-cv-title');
    const metaEl = document.getElementById('top-jobs-selected-cv-meta');
    if (!badgeEl || !titleEl) return;

    if (!selectedCV) {
      badgeEl.className = 'cv-status-badge is-none';
      badgeEl.textContent = 'Chưa chọn';
      titleEl.textContent = 'Chọn CV đã lưu...';
      if (metaEl) metaEl.innerHTML = '';
      return;
    }

    const { type, label } = getCVStatusInfo(selectedCV);
    badgeEl.className = `cv-status-badge is-${type}`;
    badgeEl.textContent = label;
    titleEl.textContent = selectedCV.title || selectedCV.file_name || 'CV Hồ sơ';
    if (metaEl) {
      const dateStr = selectedCV.updated_at || selectedCV.created_at;
      const formattedDate = dateStr ? formatFullDateTimeVi(dateStr) : 'Gần đây';
      metaEl.innerHTML = `<span class="cv-meta-inline"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-svg-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Cập nhật: ${escapeHtml(formattedDate)}</span>${selectedCV.match_count > 0 ? ` · <span class="cv-meta-match">${selectedCV.match_count} lần khớp</span>` : ''}`;
    }
  }

  function openJobSearchCVMenu() {
    const menu = document.getElementById('top-jobs-cv-menu');
    const trigger = document.getElementById('top-jobs-cv-trigger');
    if (!menu || !trigger) return;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-active');

    const searchInput = document.getElementById('top-jobs-cv-search-input');
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 50);
    }
  }

  function closeJobSearchCVMenu() {
    const menu = document.getElementById('top-jobs-cv-menu');
    const trigger = document.getElementById('top-jobs-cv-trigger');
    if (!menu || !trigger) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('is-active');
  }

  function toggleJobSearchCVMenu() {
    const menu = document.getElementById('top-jobs-cv-menu');
    if (!menu) return;
    if (menu.hidden) {
      openJobSearchCVMenu();
    } else {
      closeJobSearchCVMenu();
    }
  }

  function updateCVTabCounters(cvs) {
    const allCount = (cvs || []).length;
    const rawCount = (cvs || []).filter(c => getCVStatusInfo(c).type === 'raw').length;
    const optCount = (cvs || []).filter(c => getCVStatusInfo(c).type === 'optimized').length;
    const matchCount = (cvs || []).filter(c => getCVStatusInfo(c).type === 'matched').length;

    const countAllEl = document.getElementById('cv-tab-count-all');
    const countRawEl = document.getElementById('cv-tab-count-raw');
    const countOptEl = document.getElementById('cv-tab-count-optimized');
    const countMatchEl = document.getElementById('cv-tab-count-matched');

    if (countAllEl) countAllEl.textContent = allCount;
    if (countRawEl) countRawEl.textContent = rawCount;
    if (countOptEl) countOptEl.textContent = optCount;
    if (countMatchEl) countMatchEl.textContent = matchCount;
  }

  function renderCVOptionHTML(cv, isSelected) {
    const { type, label, format } = getCVStatusInfo(cv);
    const dateStr = cv.updated_at || cv.created_at;
    const dateFormatted = dateStr ? formatFullDateTimeVi(dateStr) : 'Gần đây';
    const isPdf = format === 'PDF';
    const isDocx = format === 'DOCX';
    const formatClass = isPdf ? 'is-pdf' : (isDocx ? 'is-docx' : 'is-cv');

    return `
      <div class="top-jobs-cv-option${isSelected ? ' is-selected' : ''}" data-cv-option-id="${escapeHtml(cv.id)}" role="option" aria-selected="${isSelected}">
        <div class="cv-option-icon ${formatClass}" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          <span class="cv-icon-ext">${escapeHtml(format)}</span>
        </div>
        <div class="cv-option-content">
          <span class="cv-option-title" title="${escapeHtml(cv.title || cv.file_name || 'CV Hồ sơ')}">
            ${escapeHtml(cv.title || cv.file_name || 'CV Hồ sơ')}
          </span>
          <div class="cv-option-subrow">
            <span class="cv-option-date">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-svg-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Cập nhật: ${escapeHtml(dateFormatted)}
            </span>
            ${cv.match_count > 0 ? `
              <span class="cv-subrow-dot">·</span>
              <span class="cv-option-matches">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-svg-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                ${cv.match_count} việc làm phù hợp
              </span>
            ` : ''}
          </div>
        </div>
        <div class="cv-option-right">
          <span class="cv-status-badge is-${type}">${escapeHtml(label)}</span>
          ${isSelected ? `
            <span class="cv-option-check" aria-label="Đang chọn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </span>
          ` : ''}
        </div>
      </div>
    `;
  }

  function renderJobSearchCVMenu(cvs, selectedId) {
    const listEl = document.getElementById('top-jobs-cv-list');
    if (!listEl) return;

    updateCVTabCounters(cvs);

    if (!cvs || cvs.length === 0) {
      listEl.innerHTML = `
        <div class="top-jobs-cv-empty-item">
          <p>Chưa có CV nào trong Kho CV của bạn.</p>
        </div>
      `;
      return;
    }

    // Filter by tab and search query
    let filtered = cvs;
    if (activeCvTabFilter !== 'all') {
      filtered = filtered.filter(cv => getCVStatusInfo(cv).type === activeCvTabFilter);
    }
    if (cvFilterSearchQuery.trim()) {
      const q = cvFilterSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(cv => {
        const title = (cv.title || cv.file_name || '').toLowerCase();
        return title.includes(q);
      });
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="top-jobs-cv-empty-item">
          <p>Không tìm thấy CV phù hợp với bộ lọc hiện tại.</p>
        </div>
      `;
      return;
    }

    // If "All" tab is active and not searching, group by Category for clean hierarchy
    if (activeCvTabFilter === 'all' && !cvFilterSearchQuery.trim()) {
      const rawCVs = filtered.filter(c => getCVStatusInfo(c).type === 'raw');
      const optCVs = filtered.filter(c => getCVStatusInfo(c).type === 'optimized');
      const matchCVs = filtered.filter(c => getCVStatusInfo(c).type === 'matched');

      let html = '';
      if (optCVs.length > 0) {
        html += `<div class="top-jobs-cv-group-header">Bản CV đã tối ưu (${optCVs.length})</div>`;
        html += optCVs.map(cv => renderCVOptionHTML(cv, String(cv.id) === String(selectedId))).join('');
      }
      if (matchCVs.length > 0) {
        html += `<div class="top-jobs-cv-group-header">Bản CV đã đối chiếu (${matchCVs.length})</div>`;
        html += matchCVs.map(cv => renderCVOptionHTML(cv, String(cv.id) === String(selectedId))).join('');
      }
      if (rawCVs.length > 0) {
        html += `<div class="top-jobs-cv-group-header">Bản CV gốc (${rawCVs.length})</div>`;
        html += rawCVs.map(cv => renderCVOptionHTML(cv, String(cv.id) === String(selectedId))).join('');
      }
      listEl.innerHTML = html;
    } else {
      listEl.innerHTML = filtered.map(cv => renderCVOptionHTML(cv, String(cv.id) === String(selectedId))).join('');
    }

    // Bind option click listeners
    listEl.querySelectorAll('.top-jobs-cv-option').forEach(optionEl => {
      optionEl.addEventListener('click', () => {
        const chosenId = optionEl.dataset.cvOptionId;
        selectJobSearchCV(chosenId);
        closeJobSearchCVMenu();
      });
    });
  }

  async function handleFindJobsCVUpload(file) {
    if (!file) return;
    if (!ApiClient.isAuthenticated()) {
      showToast('Vui lòng đăng nhập để tải CV và tìm việc làm phù hợp.', 'warning');
      return;
    }

    const triggerTitle = document.getElementById('top-jobs-selected-cv-title');
    const triggerBadge = document.getElementById('top-jobs-selected-cv-badge');
    const triggerMeta = document.getElementById('top-jobs-selected-cv-meta');
    const prevTitle = triggerTitle ? triggerTitle.textContent : '';
    const progress = beginOperationProgress(jobMatchCVButton, {
      id: 'find-jobs-cv-upload-progress',
      title: 'Đang chuẩn bị hồ sơ để tìm việc',
      steps: ['Tải CV an toàn', 'Đọc nội dung hồ sơ', 'Lưu hồ sơ để dùng lại'],
      anchorId: 'find-jobs-upload-progress-anchor',
    });
    const stageTimer = window.setTimeout(
      () => progress.advance(1, 'Đang đọc nội dung CV; file scan có thể cần thêm thời gian.'),
      650,
    );

    try {
      showToast('Đang tải lên Bản CV gốc...', 'info');
      if (triggerTitle) triggerTitle.textContent = file.name;
      if (triggerBadge) {
        triggerBadge.className = 'cv-status-badge is-raw';
        triggerBadge.textContent = 'CV gốc';
      }
      if (triggerMeta) {
        triggerMeta.innerHTML = `<span class="cv-meta-inline"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-svg-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Đang tải file...</span>`;
      }

      const newCv = await ApiClient.uploadCV(file, file.name, false);

      // Cập nhật danh sách Spaceship/Portfolio CV nếu có
      if (typeof loadSpaceshipCVList === 'function') {
        loadSpaceshipCVList().catch(() => { });
      }

      // Tải lại danh sách CV và tự động chọn CV gốc vừa tải
      await loadJobSearchCVOptions(newCv?.id);
      if (newCv?.id) {
        selectJobSearchCV(newCv.id);
      }

      closeJobSearchCVMenu();
      window.clearTimeout(stageTimer);
      progress.complete('Hoàn tất. Hồ sơ đã sẵn sàng và sẽ được dùng lại cho các lần tìm việc sau.');
      showToast('✅ Đã thêm Bản CV gốc thành công! Bạn có thể nhấn "Tìm công việc phù hợp".', 'success');
    } catch (err) {
      window.clearTimeout(stageTimer);
      progress.fail('Chưa thể chuẩn bị hồ sơ. Hãy kiểm tra file và thử lại.');
      if (triggerTitle) triggerTitle.textContent = prevTitle || 'Chọn CV đã lưu...';
      showToast(`Không thể tải CV: ${err.message || err}`, 'error');
    } finally {
      window.clearTimeout(stageTimer);
      const uploadInput = document.getElementById('find-jobs-cv-upload-input');
      if (uploadInput) uploadInput.value = '';
    }
  }

  document.getElementById('find-jobs-cv-upload-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFindJobsCVUpload(file);
    }
  });

  function setupCVMenuInteractions() {
    // Tab switching
    const tabContainer = document.getElementById('top-jobs-cv-tabs');
    if (tabContainer) {
      tabContainer.querySelectorAll('.cv-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          tabContainer.querySelectorAll('.cv-tab-btn').forEach(b => {
            b.classList.remove('is-active');
            b.setAttribute('aria-selected', 'false');
          });
          btn.classList.add('is-active');
          btn.setAttribute('aria-selected', 'true');
          activeCvTabFilter = btn.dataset.cvTab || 'all';
          renderJobSearchCVMenu(cachedCVList, activeJobSearchCV);
        });
      });
    }

    // Search input
    const searchInput = document.getElementById('top-jobs-cv-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        cvFilterSearchQuery = e.target.value || '';
        renderJobSearchCVMenu(cachedCVList, activeJobSearchCV);
      });
      searchInput.addEventListener('click', (e) => e.stopPropagation());
    }

    // Add CV button in menu footer -> Trigger in-place CV upload directly
    document.getElementById('btn-menu-add-cv')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeJobSearchCVMenu();
      document.getElementById('find-jobs-cv-upload-input')?.click();
    });
  }

  function selectJobSearchCV(cvId) {
    if (!cvId) return;
    activeJobSearchCV = cvId;
    if (jobSearchCVSelect) {
      jobSearchCVSelect.value = cvId;
    }
    const chosen = cachedCVList.find(c => String(c.id) === String(cvId));
    updateJobSearchCVTrigger(chosen);
    renderJobSearchCVMenu(cachedCVList, cvId);

    if (jobMatchCVButton) jobMatchCVButton.disabled = false;
    setJobJourneyStage('filters');
  }

  async function loadJobSearchCVOptions(preferredCvId = '') {
    if (!jobSearchCVSelect) return;
    try {
      const cvs = await ApiClient.listCVs().catch(() => []);
      cachedCVList = cvs || [];
      jobSearchCVSelect.disabled = false;

      jobSearchCVSelect.innerHTML =
        '<option value="">Chọn CV đã lưu...</option>' +
        buildCvOptions(cvs, {
          emptyOption: '',
          prefix: cv => `[${getCVStatusInfo(cv).label}] `,
        });

      const targetId = preferredCvId || activeJobSearchCV || (cvs && cvs.length > 0 ? cvs[0].id : '');
      if (targetId && cvs.some(c => String(c.id) === String(targetId))) {
        jobSearchCVSelect.value = targetId;
        activeJobSearchCV = targetId;
        const selectedCV = cvs.find(c => String(c.id) === String(targetId));
        updateJobSearchCVTrigger(selectedCV);
        renderJobSearchCVMenu(cvs, targetId);
      } else if (cvs && cvs.length > 0) {
        jobSearchCVSelect.value = cvs[0].id;
        activeJobSearchCV = cvs[0].id;
        updateJobSearchCVTrigger(cvs[0]);
        renderJobSearchCVMenu(cvs, cvs[0].id);
      } else {
        updateJobSearchCVTrigger(null);
        renderJobSearchCVMenu([], '');
      }

      setupCVMenuInteractions();
      if (jobMatchCVButton) jobMatchCVButton.disabled = false;
    } catch (err) {
      cachedCVList = [];
      jobSearchCVSelect.innerHTML = '<option value="">Chọn CV đã lưu...</option>';
      updateJobSearchCVTrigger(null);
      renderJobSearchCVMenu([], '');
      setupCVMenuInteractions();
      if (jobMatchCVButton) jobMatchCVButton.disabled = false;
    }
  }

  let cachedCatalogJobs = null;
  const cachedTopJobsMap = new Map();

  let loadJobSearchResultsInFlight = null;
  async function loadJobSearchResults({ cvId = activeJobSearchCV, shouldGuide = false, forceRefresh = false } = {}) {
    if (loadJobSearchResultsInFlight) return loadJobSearchResultsInFlight;
    loadJobSearchResultsInFlight = (async () => {
      if (!jobSearchResults) return;
      setJobResultsView('recommended');
      jobResultsHeader?.classList.remove('is-complete');
      jobSearchResults.classList.remove('is-ready');
      const roleFilter = document.getElementById('job-filter-role')?.value || undefined;
      const locationFilter = document.getElementById('job-filter-location')?.value || undefined;
      const workModeFilter = document.getElementById('job-filter-work-mode')?.value || undefined;
      const keywordFilter = jobSearchInput?.value?.trim() || undefined;
      const hasExplicitFilters = Boolean(roleFilter || locationFilter || workModeFilter || keywordFilter);

      activeJobSearchCV = cvId || jobSearchCVSelect?.value || '';
      jobSearchPage = 1;
      visibleJobResults = [];
      if (jobPagination) jobPagination.hidden = true;

      const cacheKey = `${activeJobSearchCV}|${keywordFilter || ''}|${roleFilter || ''}|${locationFilter || ''}|${workModeFilter || ''}`;

      // Instant render if cached
      if (!forceRefresh && cachedTopJobsMap.has(cacheKey)) {
        const cached = cachedTopJobsMap.get(cacheKey);
        visibleJobResults = cached.items;
        lastJobSearchResultContext = cached.context;
        currentJobSearchMode = 'recommended';
        jobSearchPage = 1;
        renderJobSearchPage();
        jobResultsHeader?.classList.add('is-complete');
        if (jobResultsSummary) jobResultsSummary.textContent = `${visibleJobResults.length} việc phù hợp với bạn`;
        return;
      }

    // When a CV is selected, filters must be sent to
    // the v2 recommendation endpoint below
      if (hasExplicitFilters && !activeJobSearchCV) {
        await loadJobCatalogResults({
          query: keywordFilter || '',
          role: roleFilter || '',
          location: locationFilter || '',
          workMode: workModeFilter || '',
        });
        return;
      }

      const subtitleEl = document.getElementById('job-results-subtitle');

      // ── State 1: No CV ──
      if (!activeJobSearchCV) {
        clearJobSearchProgress();
        jobSearchUiState = 'idle';
        setJobJourneyStage('cv');
        jobSearchResults.innerHTML = renderNoCVState();
        if (jobResultsSummary) jobResultsSummary.textContent = 'Gợi ý việc làm';
        if (jobResultsMode) jobResultsMode.textContent = 'Chưa chọn CV';
        if (subtitleEl) subtitleEl.textContent = 'Vui lòng chọn CV để hệ thống đối chiếu và xếp hạng';
        return;
      }

      // ── State 2: Loading (with Shimmer Skeleton) ──
      jobSearchResults.innerHTML = renderJobSkeleton();
      setJobJourneyStage('results');
      startJobSearchProgress(shouldGuide);
      if (shouldGuide) {
        requestAnimationFrame(() => jobResultsHeader?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
      if (jobResultsSummary) jobResultsSummary.textContent = 'Top 10 dành cho bạn';
      if (jobResultsMode) jobResultsMode.textContent = 'Đang xếp hạng theo CV...';
      if (subtitleEl) subtitleEl.textContent = 'Đang phân tích năng lực và xếp hạng độ phù hợp...';

      try {
        markJobSearchRequestStarted();
        const response = await ApiClient.recommendTopJobs(activeJobSearchCV, {
          keyword: keywordFilter || '',
          role: roleFilter || '',
          location: locationFilter || '',
          workMode: workModeFilter || '',
        });
        if (response?.status !== 'COMPLETED') {
          throw new Error('Kết quả Top 10 chưa hoàn tất; chưa thể hiển thị điểm phù hợp.');
        }

        // Only API v2's evidence-based contract may supply Top-10 scores.
        // Do not infer a score, label, confidence, strengths, or gaps in the UI.
        const items = Array.isArray(response?.items) ? response.items.map(job => ({
          ...job,
          source_id: String(job.job_id || ''),
          score_display_allowed: window.__TOP_JOBS_SCORE_DISPLAY_ENABLED__ === true,
        })) : [];

        visibleJobResults = items;

        const selectedText = jobSearchCVSelect?.options[jobSearchCVSelect?.selectedIndex]?.text || '';
        const cleanCvName = selectedText && !selectedText.includes('Chọn CV') ? selectedText : 'CV đã chọn';

        if (visibleJobResults.length === 0) {
          clearJobSearchProgress();
          jobSearchUiState = 'completed';
          jobSearchResults.innerHTML = renderEmptyState();
          if (jobResultsSummary) jobResultsSummary.textContent = 'Chưa tìm thấy công việc phù hợp';
          if (jobResultsMode) jobResultsMode.textContent = 'Bộ lọc hiện tại';
          if (subtitleEl) subtitleEl.textContent = 'Xóa bộ lọc để hệ thống tìm lại dựa hoàn toàn vào CV';
        } else {
          completeJobSearchProgress(
            `Đã tìm thấy ${visibleJobResults.length} vị trí phù hợp với CV của bạn.`,
            visibleJobResults.length,
            shouldGuide,
          );
          lastJobSearchResultContext = {
            cvName: cleanCvName,
            total: visibleJobResults.length,
            retrievalOnlyCount: 0,
            cacheHit: false,
          };

          cachedTopJobsMap.set(cacheKey, {
            items: visibleJobResults,
            context: lastJobSearchResultContext,
          });

          currentJobSearchMode = 'recommended';
          jobSearchPage = 1;
          renderJobSearchPage();
          jobResultsHeader?.classList.add('is-complete');
          if (jobResultsSummary) jobResultsSummary.textContent = `${visibleJobResults.length} việc phù hợp với bạn`;
          if (jobResultsMode) jobResultsMode.textContent = 'Top 10 đề xuất';
          if (subtitleEl) subtitleEl.textContent = `${visibleJobResults.length} vị trí được đề xuất cho ${cleanCvName}`;
          if (!jobProcessingModalVisible && shouldGuide) requestAnimationFrame(() => jobResultsHeader?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
      } catch (err) {
        clearJobSearchProgress();
        jobSearchUiState = 'failed';
        if (jobProcessingModalVisible) updateJobProcessingModal('failed');
        jobSearchResults.innerHTML = renderErrorState(err.message || 'Đã xảy ra lỗi không xác định.');
        if (jobResultsSummary) jobResultsSummary.textContent = 'Tìm kiếm bị gián đoạn';
        if (jobResultsMode) jobResultsMode.textContent = 'Thử lại';
      }
    })().finally(() => {
      loadJobSearchResultsInFlight = null;
    });
    return loadJobSearchResultsInFlight;
  }

  let loadJobCatalogResultsInFlight = null;
  async function loadJobCatalogResults(filters = {}) {
    if (loadJobCatalogResultsInFlight) return loadJobCatalogResultsInFlight;
    loadJobCatalogResultsInFlight = (async () => {
      if (!jobSearchResults) return;
      clearJobSearchProgress();
      jobSearchUiState = 'completed';
      jobSearchPage = 1;
      jobSearchResults.classList.remove('is-ready');
      jobSearchResults.innerHTML = renderJobSkeleton();
      setJobResultsView('catalog');
      if (jobResultsSummary) jobResultsSummary.textContent = 'Đang tải toàn bộ danh mục JD';
      if (jobResultsMode) jobResultsMode.textContent = 'Không giới hạn Top 10';

      try {
        const query = filters.query ?? jobSearchInput?.value?.trim() ?? '';
        const role = filters.role ?? document.getElementById('job-filter-role')?.value ?? '';
        const location = filters.location ?? document.getElementById('job-filter-location')?.value ?? '';
        const workMode = filters.workMode ?? document.getElementById('job-filter-work-mode')?.value ?? '';
        // Filtering is done by /jobs on the backend. This view deliberately
        // searches the whole catalog, rather than trimming a previous Top 10.
        const response = await ApiClient.searchJobs(query, '', 100, { role, location, workMode });
        visibleJobResults = (response?.jobs || response?.items || [])
          .map(job => ({ ...job, catalog_mode: true }));

        if (!visibleJobResults.length) {
          jobSearchResults.innerHTML = renderEmptyState();
          if (jobResultsSummary) jobResultsSummary.textContent = 'Chưa có JD phù hợp bộ lọc';
          renderJobPagination();
          return;
        }
        currentJobSearchMode = 'catalog';
        jobSearchPage = 1;
        renderJobSearchPage();
        if (jobResultsSummary) jobResultsSummary.textContent = `${visibleJobResults.length} vị trí đang tuyển`;
        if (jobResultsMode) {
          const pageCount = Math.ceil(visibleJobResults.length / JOBS_PER_PAGE);
          jobResultsMode.textContent = `Danh mục đầy đủ · Trang 1/${pageCount}`;
        }
      } catch (error) {
        jobSearchResults.innerHTML = renderErrorState(error.message || 'Không thể tải danh sách JD mẫu.');
        if (jobResultsSummary) jobResultsSummary.textContent = 'Không thể tải việc làm';
        if (jobResultsMode) jobResultsMode.textContent = 'Thử lại';
      }
    })().finally(() => {
      loadJobCatalogResultsInFlight = null;
    });
    return loadJobCatalogResultsInFlight;
  }

  let initializeJobSearchViewInFlight = null;
  async function initializeJobSearchView() {
    if (initializeJobSearchViewInFlight) return initializeJobSearchViewInFlight;
    initializeJobSearchViewInFlight = (async () => {
      await loadJobSearchCVOptions();
      void populateJobLocationFilter();
      await loadJobSearchResults();
    })().finally(() => {
      initializeJobSearchViewInFlight = null;
    });
    return initializeJobSearchViewInFlight;
  }

  jobSearchCVSelect?.addEventListener('change', () => {
    if (jobMatchCVButton) jobMatchCVButton.disabled = false;
    activeJobSearchCV = jobSearchCVSelect?.value || '';
    if (!activeJobSearchCV) {
      setJobJourneyStage('cv');
      return;
    }
    setJobJourneyStage('filters');
    requestAnimationFrame(() => jobFiltersGroup?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  });

  jobRecommendedTab?.addEventListener('click', () => {
    setJobResultsView('recommended');
    loadJobSearchResults({ cvId: jobSearchCVSelect?.value });
  });

  jobCatalogTab?.addEventListener('click', () => {
    loadJobCatalogResults();
  });

  document.getElementById('top-jobs-cv-trigger')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleJobSearchCVMenu();
  });

  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('top-jobs-cv-dropdown');
    if (dropdown && !dropdown.contains(e.target)) {
      closeJobSearchCVMenu();
    }
  });

  ['job-filter-role', 'job-filter-location', 'job-filter-work-mode'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      if (activeJobSearchCV) setJobJourneyStage('results');
    });
  });


  jobMatchCVButton?.addEventListener('click', async () => {
    jobMatchCVButton.disabled = true;
    jobMatchCVButton?.classList.add('is-loading');
    try {
      await loadJobSearchResults({ cvId: jobSearchCVSelect?.value, shouldGuide: true });
    } finally {
      jobMatchCVButton.disabled = false;
      jobMatchCVButton?.classList.remove('is-loading');
    }
  });

  let activeDrawerJob = null;
  let studentApplications = [];
  const savedJobStorageKey = 'career-saved-job-ids';

  function getSavedJobIds() {
    try { return new Set(JSON.parse(window.localStorage.getItem(savedJobStorageKey) || '[]')); }
    catch (_) { return new Set(); }
  }

  function setSavedJobIds(ids) {
    window.localStorage.setItem(savedJobStorageKey, JSON.stringify([...ids]));
  }

  async function refreshStudentApplications() {
    if (ApiClient.getUser()?.role !== 'student') return [];
    try { studentApplications = await ApiClient.listMyApplications(); }
    catch (_) { studentApplications = []; }
    return studentApplications;
  }

  function applicationForJob(job) {
    const id = String(job?.job_id || job?.source_id || job?.id || '');
    return studentApplications.find((app) => String(app.jd_id) === id) || null;
  }

  function updateDrawerApplicationActions(job) {
    const jobId = String(job?.job_id || job?.source_id || job?.id || '');
    const app = applicationForJob(job);
    const applyBtn = document.getElementById('btn-drawer-apply-job');
    const saveBtn = document.getElementById('btn-drawer-save-job');
    const trackBtn = document.getElementById('btn-drawer-track-application');
    if (applyBtn) {
      applyBtn.textContent = app ? 'Đã ứng tuyển' : 'Ứng tuyển bằng CV này';
      applyBtn.disabled = Boolean(app);
      applyBtn.classList.toggle('is-applied', Boolean(app));
    }
    if (trackBtn) trackBtn.hidden = !app;
    if (saveBtn) {
      const saved = getSavedJobIds().has(jobId);
      saveBtn.textContent = saved ? 'Đã lưu việc' : 'Lưu việc';
      saveBtn.setAttribute('aria-pressed', String(saved));
    }
  }

  function openJobDrawer(job, options = {}) {
    if (!job) return;
    closeJobPreviewModal();
    activeDrawerJob = job;
    const drawer = document.getElementById('view-job-detail');
    if (!drawer) return;

    // Look for matching detailed JD in targetJobCatalog
    const catalogJob = (targetJobCatalog || []).find(j =>
      String(j.source_id) === String(job.job_id || job.source_id) ||
      (j.title && job.title && j.title.toLowerCase() === job.title.toLowerCase())
    ) || {};

    const fullJob = { ...catalogJob, ...job };
    updateDrawerApplicationActions(fullJob);

    const titleEl = document.getElementById('job-drawer-job-title');
    const compEl = document.getElementById('job-drawer-job-company');
    const confBadge = document.getElementById('job-drawer-confidence-badge');
    const descEl = document.getElementById('job-drawer-description');
    // Candidate-facing detail must not repeat raw JD requirements. It only
    // presents evidence explaining why this CV was recommended.
    const reqEl = null;
    const fitReasonsEl = document.getElementById('job-drawer-fit-reasons');
    const skillsListEl = document.getElementById('job-drawer-skills-list');
    const verdictEl = document.getElementById('job-drawer-verdict');
    const strengthsList = document.getElementById('job-drawer-strengths-list') || drawer.querySelector('.job-drawer-strengths-list');
    const gapsList = document.getElementById('job-drawer-gaps-list') || drawer.querySelector('.job-drawer-gaps-list');
    const actionsList = document.getElementById('job-drawer-actions-list') || drawer.querySelector('.job-drawer-actions-list');
    const userExplanation = fullJob.user_explanation && typeof fullJob.user_explanation === 'object'
      ? fullJob.user_explanation
      : {};
    const fitReasonsHeading = document.getElementById('heading-job-req');
    if (fitReasonsHeading) {
      fitReasonsHeading.textContent = 'Vì sao CV của bạn phù hợp';
      const subtitle = fitReasonsHeading.parentElement?.querySelector('.job-detail-card-sub');
      if (subtitle) subtitle.textContent = 'Các điểm đối chiếu đã tìm thấy trong CV bạn';
    }

    // Bước 25 — FE tuyệt đối không tính score hay can thiệp capping, chỉ dùng contract backend
    const isMandatoryFailed = Boolean(
      job.mandatory_requirement_failed === true ||
      job.mandatory_failed === true ||
      (job.mandatory_gate && job.mandatory_gate.failed)
    );
    // A missing field means the criterion was not assessed, not that the
    // candidate is unsuitable. Only an explicit false should show a warning.
    const isRoleRelevant = fullJob.role_relevant !== false && userExplanation.role_relevant !== false;
    const isApplicationReady = !isMandatoryFailed && fullJob.application_ready !== false && userExplanation.application_ready !== false;

    const isCatalog = job.catalog_mode === true;
    const isRetrievalOnly = !isCatalog && String(job.match_id || '').startsWith('RETRIEVAL_');
    const scoreValue = Number(job.display_fit_score ?? fullJob.display_fit_score ?? fullJob.overall_score);
    const scoreVisible = fullJob.score_display_allowed === true;
    const hasScore = scoreVisible && Number.isFinite(scoreValue);
    const displayScore = hasScore ? Math.round(scoreValue) : 0;
    const fitLabel = !scoreVisible
      ? 'Đã đối chiếu bằng chứng CV'
      : isCatalog || isRetrievalOnly
        ? 'Chưa đối chiếu'
        : isMandatoryFailed || displayScore < 40
          ? 'Chưa phù hợp'
          : displayScore >= 70
            ? 'Phù hợp tốt'
            : 'Cần bổ sung';

    const scorePctEl = document.getElementById('job-drawer-score-pct');
    const scoreLabelEl = document.getElementById('job-drawer-score-label');
    const heroCardEl = document.getElementById('job-drawer-hero-card') || drawer.querySelector('.job-drawer-hero-card');

    if (scorePctEl) scorePctEl.textContent = (isCatalog || isRetrievalOnly || !hasScore) ? '—' : `${displayScore}%`;
    if (scoreLabelEl) scoreLabelEl.textContent = fitLabel;
    if (heroCardEl) {
      heroCardEl.classList.toggle('is-mandatory-failed', isMandatoryFailed);
      heroCardEl.classList.toggle('is-low-match', !isCatalog && !isRetrievalOnly && !isMandatoryFailed && displayScore < 40);
    }

    const location = fullJob.location || '';
    const workMode = fullJob.work_mode || fullJob.remote_type || '';
    const salaryPublic = String(fullJob.salary_visibility || '') === 'Công khai';
    const salary =
      fullJob.salary || fullJob.salary_range ||
      (salaryPublic && fullJob.salary_min && fullJob.salary_max
        ? `${fullJob.salary_min} - ${fullJob.salary_max} ${fullJob.salary_currency || 'VND'}`
        : '');
    const jobLevel = fullJob.job_level || '';
    const employmentType = fullJob.employment_type || fullJob.job_type || '';
    const domain = fullJob.domain || fullJob.domain_category || '';
    const deadlineValue = typeof fullJob.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fullJob.deadline)
      ? fullJob.deadline.split('-').reverse().join('/')
      : '';
    const drawerCompany = fullJob.company || fullJob.company_name || 'Thông tin công việc';

    if (titleEl) titleEl.textContent = cleanDisplayTitle(fullJob.title || fullJob.job_title);
    if (compEl) {
      const locationText = location ? ` · ${location}` : '';
      const workModeText = workMode ? ` · ${workMode}` : '';
      compEl.textContent = `${drawerCompany}${locationText}${workModeText}`;
    }

    const companyAvatar = document.getElementById('job-drawer-company-avatar');
    if (companyAvatar) {
      const initial = (drawerCompany.replace(/^(công ty|cty|tập đoàn|doanh nghiệp)\s+/i, '').trim()[0] || 'B').toUpperCase();
      const rawLogo = String(fullJob.company_logo || fullJob.logo_url || fullJob.logo || '').trim();
      const hasLogo = /^https?:\/\//i.test(rawLogo) || (rawLogo.startsWith('/') && !rawLogo.includes('placeholder'));
      if (hasLogo) {
        companyAvatar.innerHTML = `<img src="${escapeHtml(rawLogo)}" alt="${escapeHtml(drawerCompany)}" class="job-drawer-company-logo-img" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';" /><span class="company-initial-badge" style="display:none">${escapeHtml(initial)}</span>`;
      } else {
        companyAvatar.innerHTML = `<span class="company-initial-badge">${escapeHtml(initial)}</span>`;
      }
    }

    const metaPills = document.getElementById('job-drawer-meta-pills');
    if (metaPills) {
      const pills = [];
      if (location) pills.push(`<span class="meta-pill pill-location"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${escapeHtml(String(location))}</span>`);
      if (workMode) pills.push(`<span class="meta-pill pill-workmode">${escapeHtml(String(workMode))}</span>`);
      if (jobLevel && jobLevel !== 'Chưa xác định') pills.push(`<span class="meta-pill pill-level">${escapeHtml(String(jobLevel))}</span>`);
      if (employmentType && employmentType !== 'Chưa xác định') pills.push(`<span class="meta-pill pill-employment">${escapeHtml(String(employmentType))}</span>`);
      if (salary) pills.push(`<span class="meta-pill pill-salary" title="Mức lương công khai trong JD"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><path d="M12 18V6"></path></svg>${escapeHtml(String(salary))}</span>`);
      if (deadlineValue) pills.push(`<span class="meta-pill pill-deadline" title="Hạn nộp hồ sơ ghi trong JD">⏳ Hạn nộp: ${escapeHtml(deadlineValue)}</span>`);
      if (domain && domain !== 'Khác') pills.push(`<span class="meta-pill pill-domain">${escapeHtml(String(domain))}</span>`);
      metaPills.innerHTML = pills.join('');
    }
    const sourceRow = document.getElementById('job-drawer-source-row');
    const sourceLink = document.getElementById('job-drawer-source-link');
    const sourceUrl = String(fullJob.source_url || '');
    if (sourceRow && sourceLink) {
      const hasSourceUrl = /^https?:\/\//i.test(sourceUrl);
      sourceRow.hidden = !hasSourceUrl;
      if (hasSourceUrl) sourceLink.href = sourceUrl;
      else sourceLink.removeAttribute('href');
    }

    // Status Badge in Hero Card
    if (confBadge) {
      if (isCatalog || isRetrievalOnly) {
        confBadge.style.display = 'none';
      } else if (isMandatoryFailed) {
        confBadge.style.display = 'inline-flex';
        confBadge.className = 'job-drawer-confidence-badge is-low';
        confBadge.innerHTML = `<span class="icon-warn" style="margin-right:4px;">⚠</span> Hãy bổ sung các yêu cầu cốt lõi trước khi ứng tuyển.`;
      } else {
        confBadge.style.display = 'inline-flex';
        const confidence = String(job.evidence_confidence || '').toLowerCase();
        const confidenceClass = ['high', 'medium', 'low'].includes(confidence) ? confidence : 'low';
        confBadge.className = `job-drawer-confidence-badge is-${confidenceClass}`;
        confBadge.textContent = userExplanation.confidence_message || 'CV có các điểm phù hợp với yêu cầu của vị trí.';
      }
    }

    if (verdictEl) {
      if (isCatalog || isRetrievalOnly) {
        verdictEl.textContent = 'Vị trí này chưa được đối chiếu chi tiết với CV của bạn.';
      } else if (!isRoleRelevant) {
        verdictEl.textContent = fullJob.role_reason || userExplanation.role_reason || 'Vị trí này chưa khớp với định hướng nghề nghiệp bạn đã chọn.';
      } else if (!isApplicationReady || isMandatoryFailed) {
        verdictEl.textContent = 'Đúng hướng nghề nghiệp, nhưng hồ sơ còn thiếu một số kỹ năng cốt lõi cần bổ sung trước khi ứng tuyển.';
      } else if (displayScore >= 70) {
        verdictEl.textContent = 'Hồ sơ của bạn rất phù hợp với vị trí này, có thể tự tin ứng tuyển ngay!';
      } else if (displayScore >= 45) {
        verdictEl.textContent = 'Hồ sơ cơ bản đáp ứng các yêu cầu chính, bạn có thể trau chuốt thêm kỹ năng trước khi nộp đơn.';
      } else {
        verdictEl.textContent = 'Hồ sơ còn thiếu một số kỹ năng quan trọng của vị trí này. Hãy xem gợi ý bên dưới để hoàn thiện.';
      }
      verdictEl.classList.toggle('is-warning', !isRoleRelevant || !isApplicationReady || isMandatoryFailed || displayScore < 45);
    }

    // Mandatory Alert Box in Drawer
    let drawerMandatoryAlert = document.getElementById('job-drawer-mandatory-alert');
    if (isMandatoryFailed) {
      if (drawerMandatoryAlert) {
        drawerMandatoryAlert.innerHTML = `
          <span class="icon-warn" aria-hidden="true">⚠</span>
          <div class="mandatory-alert-content">
            <strong>Cần bổ sung trước khi ứng tuyển</strong>
            <p>${escapeHtml((userExplanation.priority_gaps || []).filter(item => item.mandatory).map(item => item.requirement).slice(0, 3).join(', ') || 'Hồ sơ còn thiếu một vài kỹ năng cốt lõi của vị trí này.')}</p>
          </div>
        `;
        drawerMandatoryAlert.hidden = false;
      }
    } else if (drawerMandatoryAlert) {
      drawerMandatoryAlert.hidden = true;
    }

    // 2. Mô tả & Yêu cầu công việc (Canonical Structured Rendering)
    if (descEl) {
      descEl.innerHTML = renderStructuredJobDetailHtml(fullJob, {
        mode: 'drawer',
        showHeroHeader: false,
        showSkillsSection: false,
      });
    }

    // Helper to filter out sensitive/noisy non-skill text (salary, currency, quiz answers, benefits, boilerplate)
    const isValidReqItem = (val) => {
      if (!val) return false;
      const str = typeof val === 'object' ? String(val.requirement || val.text || '') : String(val);
      const clean = str.replace(/\s+/g, ' ').trim();
      if (clean.length < 2 || clean.length > 80) return false;
      if (!/[a-zA-ZÀ-ỹ]/.test(clean)) return false;
      if (/^[,\.\:\;\-\_\~\/\s]/.test(clean)) return false;
      if (/\b(\d{1,3}([,.]\d{3})+|vnd|usd|gross|net|salary|lương|stipend|thu nhập|thù lao|tháng|\/month|\/tháng|triệu|\$|after the internship)\b/i.test(clean)) return false;
      if (/\b(correct answer|correct answers|different situations|option [a-d]|choice [a-d]|true\/false|đáp án|câu trả lời|câu hỏi)\b/i.test(clean)) return false;
      if (/\b(bảo hiểm|bhxh|phúc lợi|teambuilding|du lịch|thời gian làm việc|working hours|chế độ nghỉ|khám sức khỏe|trợ cấp|allowance|bonus|thưởng tết|thưởng lễ)\b/i.test(clean)) return false;
      if (/\b(about us|về chúng tôi|liên hệ|gửi cv|apply to|hạn nộp|deadline|địa chỉ|contact us|email|phone|website)\b/i.test(clean)) return false;
      const lower = clean.toLowerCase();
      if (['en', 'vi', 'vn', 'us', 'uk', 'na', 'n/a', 'other', 'khác'].includes(lower)) return false;
      return true;
    };

    // 4. Tech Stack & Kỹ năng
    if (fitReasonsEl) {
      const rawMatched = Array.isArray(userExplanation.matched_requirements)
        ? userExplanation.matched_requirements : [];
      const matched = rawMatched.filter(isValidReqItem).slice(0, 4);
      const rawStrengths = Array.isArray(fullJob.top_strengths)
        ? fullJob.top_strengths : [];
      const strengthsForReasons = rawStrengths.filter(isValidReqItem).slice(0, 4);

      fitReasonsEl.innerHTML = (isCatalog || isRetrievalOnly)
        ? '<div class="job-drawer-evidence-empty">Chọn một JD đã được đối chiếu để xem lý do CV của bạn phù hợp.</div>'
        : matched.length
          ? matched.map(item => {
            const quotes = Array.isArray(item.cv_evidence_quotes) ? item.cv_evidence_quotes : [];
            const rawReason = String(item.reason || '');
            const cleanReason = (!rawReason || /evidence|requirement/i.test(rawReason))
              ? 'Đã tìm thấy thông tin phù hợp trong CV.'
              : rawReason;
            const quoteHtml = quotes.length
              ? `<div class="evidence-quote-box"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span>Trích từ CV: “${escapeHtml(String(quotes[0]))}”</span></div>`
              : '';
            return `<div class="job-drawer-evidence-item strength">
              <div class="evidence-item-indicator"><span class="icon-check">✓</span></div>
              <div class="evidence-item-body">
                <div class="evidence-item-header">
                  <strong class="evidence-req-title">${escapeHtml(String(item.requirement || 'Điểm phù hợp'))}</strong>
                  <span class="evidence-badge-pill is-matched">Khớp yêu cầu</span>
                </div>
                <p class="evidence-reason-text">${escapeHtml(cleanReason)}</p>
                ${quoteHtml}
              </div>
            </div>`;
          }).join('')
          : strengthsForReasons.length
            ? strengthsForReasons.map(item => `<div class="job-drawer-evidence-item strength">
              <div class="evidence-item-indicator"><span class="icon-check">✓</span></div>
              <div class="evidence-item-body">
                <div class="evidence-item-header">
                  <strong class="evidence-req-title">${escapeHtml(String(item).replace(/^[✓⚠△\s]+/, ''))}</strong>
                  <span class="evidence-badge-pill is-matched">Khớp yêu cầu</span>
                </div>
              </div>
            </div>`).join('')
            : '<div class="job-drawer-evidence-empty">Chưa có đủ thông tin trong CV để giải thích mức độ phù hợp.</div>';
    }

    if (skillsListEl) {
      const rawSkills = Array.isArray(fullJob.skills) ? fullJob.skills.filter(Boolean) : [];
      const skills = rawSkills.filter(isValidReqItem);
      skillsListEl.innerHTML = skills.length ? skills.map(sk => {
        const cleanSkill = String(sk).replace(/^[✓⚠△\s]+/, '').replace(/^Đáp ứng tốt yêu cầu:\s*/i, '');
        return `<span class="drawer-skill-pill"><span class="skill-dot"></span>${escapeHtml(cleanSkill.slice(0, 35))}</span>`;
      }).join('') : '<span class="job-drawer-inline-empty">JD chưa có danh sách kỹ năng.</span>';
    }

    // Present the assessment in plain Vietnamese. Criterion IDs and scoring
    // weights are implementation details and must never leak into the UI.
    const breakdownItems = Array.isArray(userExplanation.score_breakdown)
      ? userExplanation.score_breakdown
      : (Array.isArray(job.score_breakdown) ? job.score_breakdown : []);
    const breakdownList = drawer.querySelector('.job-drawer-breakdown-list');
    if (breakdownList) {
      breakdownList.innerHTML = (isCatalog || isRetrievalOnly || !breakdownItems.length)
        ? '<div class="job-drawer-evidence-empty">Chưa có đánh giá chi tiết để hiển thị.</div>'
        : breakdownItems.map(item => {
          const raw = Math.max(0, Math.min(100, Number(item.raw_score) || 0));
          const statusLabel = raw >= 70 ? 'Đáp ứng tốt' : raw >= 40 ? 'Đáp ứng một phần' : 'Cần bổ sung';
          const statusClass = raw >= 70 ? 'is-good' : raw >= 40 ? 'is-partial' : 'is-missing';
          const criterionLabels = {
            must_have: 'Kỹ năng bắt buộc', experience: 'Kinh nghiệm liên quan', education: 'Học vấn',
            nice_to_have: 'Kỹ năng ưu tiên', domain: 'Lĩnh vực chuyên môn', role: 'Định hướng nghề nghiệp',
          };
          const rawLabel = String(item.label || item.criterion_id || '');
          const label = criterionLabels[rawLabel.toLowerCase()] || (rawLabel.includes('_') ? 'Tiêu chí phù hợp' : rawLabel) || 'Tiêu chí phù hợp';
          let cleanReason = String(item.reason || '');
          cleanReason = cleanReason.replace(/(\d+)\/(\d+)\s+requirements?\s+được hỗ trợ đầy đủ\.?/i, 'Đáp ứng $1/$2 yêu cầu đối chiếu.');
          cleanReason = cleanReason.replace(/requirements?/gi, 'yêu cầu');
          return `<div class="job-drawer-breakdown-card ${statusClass}">
            <div class="breakdown-card-top">
              <span class="breakdown-card-label">${escapeHtml(label)}</span>
              <span class="breakdown-card-score ${statusClass}">${Math.round(raw)}% · ${statusLabel}</span>
            </div>
            <div class="breakdown-card-bar">
              <span class="breakdown-card-bar-fill ${statusClass}" style="width:${raw}%"></span>
            </div>
            ${cleanReason ? `<div class="breakdown-card-reason">${escapeHtml(cleanReason)}</div>` : ''}
          </div>`;
        }).join('');
    }

    const compactDrawerEvidence = (value, type) => {
      const raw = String(value || '').replace(/\s+/g, ' ').trim();
      const label = raw
        .replace(/^Đáp ứng tốt yêu cầu:\s*/i, '')
        .replace(/^Chưa tìm thấy evidence cho\s*/i, '')
        .replace(/^Chưa có thông tin trong CV cho\s*/i, '')
        .replace(/^[✓⚠△]\s*/, '')
        .trim();
      if (label.length <= 80) return label;
      return type === 'gap'
        ? 'Yêu cầu chi tiết cần bổ sung — xem trong mô tả công việc'
        : 'Yêu cầu phù hợp — xem chi tiết trong mô tả công việc';
    };

    // Strengths: show the exact JD requirement and only CV quotes returned by the API.
    const rawMatchedReqs = Array.isArray(userExplanation.matched_requirements)
      ? userExplanation.matched_requirements : [];
    const matchedRequirements = rawMatchedReqs.filter(isValidReqItem).slice(0, 4);
    const rawStrengthsList = Array.isArray(fullJob.top_strengths) ? fullJob.top_strengths : [];
    const strengths = rawStrengthsList.filter(isValidReqItem).slice(0, 5);
    if (strengthsList) {
      strengthsList.innerHTML = (isCatalog || isRetrievalOnly)
        ? '<div class="job-drawer-evidence-empty">Chưa có thông tin phù hợp nổi bật để hiển thị.</div>'
        : matchedRequirements.length
          ? matchedRequirements.map(item => {
            const quotes = Array.isArray(item.cv_evidence_quotes) ? item.cv_evidence_quotes : [];
            const evidence = quotes.length ? `<div class="evidence-quote-box"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span>Trích từ CV: “${escapeHtml(quotes[0])}”</span></div>` : '';
            const rawReason = String(item.reason || '');
            const cleanReason = (!rawReason || /evidence|requirement/i.test(rawReason)) ? 'Đã có trong CV.' : rawReason;
            return `<div class="job-drawer-evidence-item strength">
              <div class="evidence-item-indicator"><span class="icon-check">✓</span></div>
              <div class="evidence-item-body">
                <div class="evidence-item-header">
                  <strong class="evidence-req-title">${escapeHtml(item.requirement)}</strong>
                  <span class="evidence-badge-pill is-matched">Khớp yêu cầu</span>
                </div>
                <p class="evidence-reason-text">${escapeHtml(cleanReason)}</p>
                ${evidence}
              </div>
            </div>`;
          }).join('')
          : strengths.length
            ? strengths.map(st => {
              const raw = String(st).replace(/^[✓\s]+/, '');
              const text = compactDrawerEvidence(raw, 'strength');
              return `<div class="job-drawer-evidence-item strength" title="${escapeHtml(raw)}">
                <div class="evidence-item-indicator"><span class="icon-check">✓</span></div>
                <div class="evidence-item-body">
                  <div class="evidence-item-header">
                    <strong class="evidence-req-title">${escapeHtml(text)}</strong>
                    <span class="evidence-badge-pill is-matched">Khớp yêu cầu</span>
                  </div>
                </div>
              </div>`;
            }).join('')
            : '<div class="job-drawer-evidence-empty">Chưa có điểm phù hợp để hiển thị.</div>';
    }

    // Gaps: distinguish mandatory requirements and never collapse them into a generic warning.
    const rawPriorityGaps = Array.isArray(userExplanation.priority_gaps)
      ? userExplanation.priority_gaps : [];
    const priorityGaps = rawPriorityGaps.filter(isValidReqItem).slice(0, 4);
    const rawGaps = Array.isArray(fullJob.top_gaps) ? fullJob.top_gaps : [];
    const gaps = rawGaps.filter(isValidReqItem).slice(0, 5);
    if (gapsList) {
      gapsList.innerHTML = isRetrievalOnly
        ? '<div class="job-drawer-evidence-empty">Chưa có điểm cần bổ sung được ghi nhận.</div>'
        : priorityGaps.length
          ? priorityGaps.map(item => {
            const rawReason = String(item.reason || '');
            const cleanReason = (!rawReason || /evidence|requirement|đáng tin cậy cho requirement/i.test(rawReason))
              ? 'Chưa có thông tin tương ứng trong CV của bạn.'
              : rawReason;
            return `<div class="job-drawer-evidence-item gap">
              <div class="evidence-item-indicator"><span class="icon-warn">△</span></div>
              <div class="evidence-item-body">
                <div class="evidence-item-header">
                  <strong class="evidence-req-title">${escapeHtml(item.requirement)}</strong>
                  <span class="evidence-badge-pill ${item.mandatory ? 'is-mandatory' : 'is-preferred'}">${item.mandatory ? 'Yêu cầu chính' : 'Ưu tiên'}</span>
                </div>
                <p class="evidence-reason-text">${escapeHtml(cleanReason)}</p>
              </div>
            </div>`;
          }).join('')
          : gaps.length
            ? gaps.map(gp => {
              const raw = String(gp).replace(/^[⚠△\s]+/, '');
              const text = compactDrawerEvidence(raw, 'gap');
              return `<div class="job-drawer-evidence-item gap" title="${escapeHtml(raw)}">
                <div class="evidence-item-indicator"><span class="icon-warn">△</span></div>
                <div class="evidence-item-body">
                  <div class="evidence-item-header">
                    <strong class="evidence-req-title">${escapeHtml(text)}</strong>
                    <span class="evidence-badge-pill is-preferred">Ưu tiên</span>
                  </div>
                </div>
              </div>`;
            }).join('')
            : '<div class="job-drawer-evidence-empty">Chưa ghi nhận yêu cầu cần bổ sung.</div>';
    }

    if (actionsList) {
      const rawActions = Array.isArray(userExplanation.priority_actions) ? userExplanation.priority_actions : [];
      const actions = rawActions.filter(isValidReqItem);
      actionsList.innerHTML = (isCatalog || isRetrievalOnly || !actions.length)
        ? '<div class="job-drawer-evidence-empty">Chưa có gợi ý bổ sung cho vị trí này.</div>'
        : actions.map((item, index) => `<div class="job-drawer-evidence-item action-step-item">
          <div class="action-step-badge">${index + 1}</div>
          <div class="action-step-body">
            <strong class="action-step-title">${escapeHtml(item.requirement)}</strong>
            <p class="action-step-desc">${escapeHtml(item.message)}</p>
          </div>
        </div>`).join('');
    }

    // Cập nhật banner CV đang đối chiếu trong Drawer
    const activeCV = (cachedCVList || []).find(c => String(c.id) === String(activeJobSearchCV));
    const drawerCvBadge = document.getElementById('job-drawer-cv-badge');
    const drawerCvName = document.getElementById('job-drawer-cv-name');
    if (drawerCvBadge && drawerCvName) {
      if (activeCV) {
        const statusType = activeCV.status_type || (activeCV.is_optimized ? 'optimized' : (activeCV.match_count > 0 ? 'matched' : 'raw'));
        const statusLabel = activeCV.status_label || (statusType === 'optimized' ? 'Đã tối ưu' : (statusType === 'matched' ? 'Đã Match' : 'CV gốc'));
        drawerCvBadge.className = `cv-status-badge is-${statusType}`;
        drawerCvBadge.textContent = statusLabel;
        drawerCvName.textContent = activeCV.title || activeCV.file_name || 'CV Hồ sơ';
      } else {
        drawerCvBadge.className = 'cv-status-badge is-none';
        drawerCvBadge.textContent = 'CV';
        drawerCvName.textContent = 'CV đã chọn';
      }
    }

    const drawerBody = drawer.querySelector('.job-drawer-body');
    if (drawerBody) drawerBody.scrollTop = 0;
    const jobId = fullJob.job_id || fullJob.source_id || fullJob.id;
    if (jobId) {
      try { window.sessionStorage.setItem('career-job-detail', JSON.stringify(fullJob)); } catch (_) { /* optional route restore */ }
    }
    switchView('job-detail', { jobId, skipUrlSync: Boolean(options.restore) });
  }

  function closeJobDrawer() {
    // The Student "Việc làm" navigation owns Top-JD results.  Do not send
    // candidates back to the separate JD setup workspace after viewing a job.
    switchView('find-jobs');
  }

  async function restoreJobDetailFromRoute() {
    const match = window.location.pathname.match(/^\/student\/jobs\/([^/?#]+)/i);
    if (!match) return;
    const requestedId = decodeURIComponent(match[1]);

    try {
      const saved = JSON.parse(window.sessionStorage.getItem('career-job-detail') || 'null');
      const savedId = String(saved?.job_id || saved?.source_id || saved?.id || '');
      if (saved && savedId === requestedId) {
        openJobDrawer(saved, { restore: true });
        return;
      }
    } catch (_) {
      // A malformed session cache must not prevent the route itself opening.
    }

    // A copied/opened deep-link has no session cache. Reuse the existing job
    // catalog API to hydrate the same detail renderer rather than mounting a
    // second detail implementation.
    try {
      const result = await ApiClient.searchJobs('', '', 100);
      const jobs = result?.jobs || result?.items || [];
      targetJobCatalog = jobs;
      const job = jobs.find(item => String(item.job_id || item.source_id || item.id || '') === requestedId);
      if (job) {
        openJobDrawer({ ...job, catalog_mode: true }, { restore: true });
        return;
      }
    } catch (error) {
      console.error('Unable to restore student job detail:', error);
    }

    showToast('KhÃ´ng tÃ¬m tháº¥y viá»‡c lÃ m nÃ y. Báº¡n cÃ³ thá»ƒ chá»n má»™t viá»‡c khÃ¡c.', 'info');
    switchView('jobs', { skipUrlSync: true, skipSweep: true });
  }

  document.getElementById('job-detail-back-btn')?.addEventListener('click', closeJobDrawer);
  document.getElementById('btn-drawer-switch-cv')?.addEventListener('click', () => {
    closeJobDrawer();
    const dropdown = document.getElementById('top-jobs-cv-dropdown');
    dropdown?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      openJobSearchCVMenu();
      document.getElementById('top-jobs-cv-trigger')?.focus();
    }, 150);
  });
  // Delegated click handler on jobSearchResults for cards, states, retry, reset
  jobSearchResults?.addEventListener('click', (event) => {
    // This is an external source link, not a request to open the in-app detail.
    if (event.target.closest('.job-source-verify-link')) return;

    // Retry button click
    const retryBtn = event.target.closest('#btn-job-search-retry, .btn-retry-job-search');
    if (retryBtn) {
      loadJobSearchResults({ cvId: jobSearchCVSelect?.value });
      return;
    }

    // Reset filters button click
    const resetFiltersBtn = event.target.closest('#btn-reset-job-filters, .btn-reset-job-filters');
    if (resetFiltersBtn) {
      const roleSel = document.getElementById('job-filter-role');
      const locSel = document.getElementById('job-filter-location');
      const modeSel = document.getElementById('job-filter-work-mode');
      if (roleSel) roleSel.value = '';
      if (locSel) locSel.value = '';
      if (modeSel) modeSel.value = '';
      loadJobSearchResults({ cvId: jobSearchCVSelect?.value });
      return;
    }

    // Upload CV button click from No CV state -> Trigger in-place file upload
    const uploadCvBtn = event.target.closest('#btn-job-search-upload-cv');
    if (uploadCvBtn) {
      if (cachedCVList && cachedCVList.length > 0) {
        const dropdown = document.getElementById('top-jobs-cv-dropdown');
        dropdown?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => {
          openJobSearchCVMenu();
          document.getElementById('top-jobs-cv-trigger')?.focus();
        }, 150);
      } else {
        document.getElementById('find-jobs-cv-upload-input')?.click();
      }
      return;
    }

    const browseCatalogBtn = event.target.closest('#btn-browse-job-catalog');
    if (browseCatalogBtn) {
      loadJobCatalogResults();
      return;
    }

    // Card or Details button click -> Open modal (in catalog mode) or drawer (in recommended mode)
    const card = event.target.closest('.top-job-card');
    if (card) {
      const jobId = card.dataset.jobId;
      const foundJob = (visibleJobResults || []).find(j => String(j.job_id || j.source_id || j.id) === String(jobId));
      if (!foundJob) {
        showToast('Không tìm thấy thông tin công việc đã chọn.', 'info');
        return;
      }
      const isCatalog = currentJobSearchMode === 'catalog' || Boolean(jobCatalogTab && jobCatalogTab.classList.contains('is-active'));
      if (isCatalog) {
        openJobPreviewModal(foundJob);
      } else {
        openJobDrawer(foundJob);
      }
      return;
    }
  });

  jobSearchResults?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      const card = event.target.closest('.top-job-card');
      if (card && (event.target === card || event.target.classList.contains('btn-job-details'))) {
        event.preventDefault();
        card.click();
      }
    }
  });

  // Drawer Footer Actions
  document.getElementById('btn-drawer-optimize-cv')?.addEventListener('click', () => {
    if (activeJobSearchCV) {
      window.sessionStorage.setItem('career-preselected-cv-id', activeJobSearchCV);
    }
    if (activeDrawerJob) {
      const jdId = activeDrawerJob.job_id || activeDrawerJob.source_id || '';
      if (jdId) window.sessionStorage.setItem('career-preselected-jd-id', jdId);
    }
    closeJobDrawer();
    switchView('cv');
    showToast('Đã chuyển sang trang Tối ưu CV!', 'success');
  });

  document.getElementById('btn-drawer-full-match')?.addEventListener('click', () => {
    if (activeJobSearchCV) {
      window.sessionStorage.setItem('career-preselected-cv-id', activeJobSearchCV);
    }
    if (activeDrawerJob) {
      const jdId = activeDrawerJob.job_id || activeDrawerJob.source_id || '';
      if (jdId) window.sessionStorage.setItem('career-preselected-jd-id', jdId);
    }
    closeJobDrawer();
    switchView('match');
  });

  jobSearchInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    jobMatchCVButton?.click();
  });

  document.getElementById('btn-drawer-apply-job')?.addEventListener('click', async () => {
    if (!activeDrawerJob) return;
    const existing = applicationForJob(activeDrawerJob);
    if (existing) {
      showToast('Bạn đã ứng tuyển vị trí này. Hãy theo dõi hồ sơ để xem tiến độ.', 'info');
      return;
    }

    const cvId = activeJobSearchCV || jobSearchCVSelect?.value;
    if (!cvId) {
      showToast('Vui lòng chọn một CV trước khi ứng tuyển.', 'info');
      const dropdown = document.getElementById('top-jobs-cv-dropdown');
      dropdown?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const jdId = activeDrawerJob.job_id || activeDrawerJob.source_id || activeDrawerJob.id;
    if (!jdId) return;
    const button = document.getElementById('btn-drawer-apply-job');
    if (button) button.disabled = true;
    try {
      const app = await ApiClient.shareCV(jdId, cvId);
      studentApplications = [
        ...studentApplications.filter((item) => String(item.jd_id) !== String(app.jd_id)),
        app,
      ];
      updateDrawerApplicationActions(activeDrawerJob);
      showToast('Đã ứng tuyển. Doanh nghiệp đã nhận hồ sơ của bạn.', 'success');
    } catch (err) {
      if (button) button.disabled = false;
      showToast(`Không thể ứng tuyển: ${err.message}`, 'error');
    }
  });

  document.getElementById('btn-drawer-save-job')?.addEventListener('click', () => {
    if (!activeDrawerJob) return;
    const id = String(activeDrawerJob.job_id || activeDrawerJob.source_id || activeDrawerJob.id || '');
    if (!id) return;
    const saved = getSavedJobIds();
    if (saved.has(id)) {
      saved.delete(id);
      showToast('Đã bỏ lưu việc.', 'info');
    } else {
      saved.add(id);
      showToast('Đã lưu việc để xem lại sau.', 'success');
    }
    setSavedJobIds(saved);
    updateDrawerApplicationActions(activeDrawerJob);
  });

  document.getElementById('btn-drawer-track-application')?.addEventListener('click', () => {
    closeJobDrawer();
    window.history.pushState({}, '', '/student/jobs?tab=applied');
    switchView('jobs');
  });

  const handleDrawerInterview = () => {
    if (activeDrawerJob) {
      const jdId = activeDrawerJob.job_id || activeDrawerJob.source_id || '';
      if (jdId) {
        window.sessionStorage.setItem('career-preselected-jd-id', jdId);
        window.sessionStorage.setItem('career-interview-job-title', activeDrawerJob.title || '');
      }
    }
    closeJobDrawer();
    switchView('interview');
  };

  document.getElementById('btn-drawer-interview')?.addEventListener('click', handleDrawerInterview);
  document.getElementById('btn-drawer-mock-interview')?.addEventListener('click', handleDrawerInterview);


  document.addEventListener('click', event => {
    const button = event.target.closest('#job-pagination [data-job-page]');
    if (!button || button.disabled) return;
    const totalPages = Math.ceil(visibleJobResults.length / JOBS_PER_PAGE);
    const target = button.dataset.jobPage;
    const nextPage = target === 'prev' ? jobSearchPage - 1 : target === 'next' ? jobSearchPage + 1 : Number(target);
    if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > totalPages || nextPage === jobSearchPage) return;
    jobSearchPage = nextPage;
    renderJobSearchPage();
    document.getElementById('job-search-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  function applicationStatusLabel(status) {
    return ({
      pending_consent: 'Chờ đồng ý tiến cử', submitted: 'Chờ xem xét',
      shortlisted: 'Qua vòng sơ loại', interview: 'Đã hẹn phỏng vấn',
      hired: 'Đã nhận việc', rejected: 'Chưa phù hợp',
    })[String(status || '').toLowerCase()] || 'Đang xử lý';
  }

  async function renderStudentJobsTab(tab) {
    const list = document.getElementById('student-applications-list');
    const panel = document.getElementById('student-applications-panel');
    const updates = document.getElementById('student-application-updates');
    const discover = document.getElementById('page-section-sys-jds');
    const custom = document.getElementById('page-section-cust-jd');
    document.querySelectorAll('[id^="student-jobs-tab-"]').forEach((button) => {
      button.setAttribute('aria-selected', String(button.id === `student-jobs-tab-${tab}`));
    });
    if (tab === 'discover') {
      if (panel) panel.hidden = true;
      if (updates) updates.hidden = true;
      if (discover) discover.style.display = 'block';
      if (custom) custom.style.display = 'none';
      void loadPageJDList();
      return;
    }
    if (discover) discover.style.display = 'none';
    if (custom) custom.style.display = 'none';
    if (panel) panel.hidden = false;
    if (updates) updates.hidden = true;
    if (!list) return;
    if (tab === 'saved') {
      const savedIds = getSavedJobIds();
      list.innerHTML = savedIds.size
        ? `<p style="color:#607184">${savedIds.size} việc đã lưu. Mở mục Việc làm để xem chi tiết và ứng tuyển.</p>`
        : '<p style="color:#607184">Chưa có việc đã lưu.</p>';
      return;
    }
    list.innerHTML = '<p style="color:#607184">Đang tải tiến trình hồ sơ…</p>';
    await refreshStudentApplications();
    list.innerHTML = studentApplications.length
      ? studentApplications.map((app) => `<article class="application-timeline-item"><strong>${escapeHtml(app.jd_title || 'Vị trí ứng tuyển')}</strong><p>${escapeHtml(applicationStatusLabel(app.status))} · ${escapeHtml(app.source === 'counselor_referral' ? 'Cố vấn tiến cử' : 'Sinh viên tự ứng tuyển')}</p><small>Đã cập nhật: ${escapeHtml(formatFullDateTimeVi(app.decided_at || app.shared_at))}</small></article>`).join('')
      : '<p style="color:#607184">Bạn chưa ứng tuyển công việc nào.</p>';
  }

  document.getElementById('student-jobs-tab-discover')?.addEventListener('click', () => renderStudentJobsTab('discover'));
  document.getElementById('student-jobs-tab-saved')?.addEventListener('click', () => renderStudentJobsTab('saved'));
  document.getElementById('student-jobs-tab-applied')?.addEventListener('click', () => renderStudentJobsTab('applied'));
  if (window.location.pathname === '/student/jobs') {
    renderStudentJobsTab(new URLSearchParams(window.location.search).get('tab') === 'applied' ? 'applied' : 'discover');
  }

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

  let loadPageJDListInFlight = null;
  async function loadPageJDList() {
    if (loadPageJDListInFlight) return loadPageJDListInFlight;
    loadPageJDListInFlight = (async () => {
      if (!pageJdListContainer) return;
      try {
        const [jds, catalogResult] = await Promise.all([
          ApiClient.listJDs(),
          ApiClient.searchJobs('', '', 100).catch(() => ({ jobs: [] })),
        ]);
        const catalogBySourceId = new Map(
          (catalogResult?.jobs || []).map(job => [String(job.source_id || ''), job]),
        );
        const catalogByTitle = new Map(
          (catalogResult?.jobs || []).map(job => [
            `${String(job.title || '').trim().toLowerCase()}|${String(job.company || '').trim().toLowerCase()}`,
            job,
          ]),
        );
        const currentUser = ApiClient.getUser();
        const cvs = currentUser?.role === 'student' ? await ApiClient.listCVs() : [];
        if (!jds || jds.length === 0) {
          pageJdListContainer.innerHTML = `<p style="font-size:12px;color:var(--text-muted);">Chưa có JD nào trong hệ thống.</p>`;
          return;
        }
        pageJdListContainer.innerHTML = jds.map(jd => {
          const norm = jd.normalized_json || {};
          const normTags = Array.isArray(norm.tags) ? norm.tags.filter(Boolean).slice(0, 6) : [];
          const salaryPublic = String(norm.salary_visibility || '') === 'Công khai';
          const salaryText = salaryPublic && norm.salary_min && norm.salary_max
            ? `${norm.salary_min} - ${norm.salary_max} ${norm.salary_currency || 'VND'}`
            : '';
          const deadlineText = norm.deadline ? String(norm.deadline).split('-').reverse().join('/') : '';
          const metaChips = [
            norm.level && norm.level !== 'Chưa xác định' ? `<span class="jd-chip">${escapeHtml(String(norm.level))}</span>` : '',
            norm.employment_type && norm.employment_type !== 'Chưa xác định' ? `<span class="jd-chip">${escapeHtml(String(norm.employment_type))}</span>` : '',
            norm.work_model && norm.work_model !== 'Chưa xác định' ? `<span class="jd-chip">${escapeHtml(String(norm.work_model))}</span>` : '',
            salaryText ? `<span class="jd-chip jd-chip-salary" title="Mức lương công khai trong JD">${escapeHtml(salaryText)}</span>` : '',
            deadlineText ? `<span class="jd-chip jd-chip-deadline" title="Hạn nộp hồ sơ ghi trong JD">Hạn nộp: ${escapeHtml(deadlineText)}</span>` : '',
          ].filter(Boolean).join('');
          const tagsHtml = normTags.length
            ? `<div class="jd-card-tags">${normTags.map(tag => `<span class="jd-tag">${escapeHtml(String(tag))}</span>`).join('')}</div>`
            : '';
          return `
          <div style="background:rgba(255,255,255,0.04);padding:14px;border-radius:10px;border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <p style="font-size:14px;font-weight:700;color:#fff;margin:0;">💼 ${escapeHtml(jd.title)}</p>
              <span class="badge ${jd.is_system ? 'badge-ok' : 'badge-focus'}">${jd.is_system ? 'Hệ thống' : 'Tự dán'}</span>
            </div>
            <p style="font-size:11px;color:var(--text-dim);margin:0 0 6px 0;">Công ty: ${escapeHtml(jd.company || 'N/A')} | Địa điểm: ${escapeHtml(jd.location || 'N/A')}</p>
            ${metaChips ? `<div class="jd-card-meta" style="display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px 0;">${metaChips}</div>` : ''}
            <p style="font-size:11px;color:var(--text-muted);white-space:pre-line;max-height:70px;overflow:hidden;">${escapeHtml(jd.requirements_text)}</p>
            ${tagsHtml}
            ${(() => {
              const sourceId = String(norm.source_id || jd.id || '');
              const titleKey = `${String(jd.title || '').trim().toLowerCase()}|${String(jd.company || '').trim().toLowerCase()}`;
              const catalogJob = catalogBySourceId.get(sourceId) || catalogByTitle.get(titleKey);
              const sourceUrl = norm.source_url || catalogJob?.source_url;
              const hasSourceUrl = /^https?:\/\//i.test(String(sourceUrl || ''));
              const verifyLink = hasSourceUrl
                ? `<a class="jd-recruitment-link jd-verify-link" href="${escapeHtml(String(sourceUrl))}" target="_blank" rel="noopener noreferrer">Xem tin tuyển dụng gốc ↗</a>`
                : '';
              return currentUser?.role === 'student' && !jd.is_system && jd.is_published
                ? `<div class="jd-apply-row"><select class="form-input jd-application-cv">${cvs.map(cv => `<option value="${escapeHtml(cv.id)}">${escapeHtml(cv.title)}</option>`).join('')}</select>${verifyLink}<button type="button" class="btn-primary apply-jd" data-id="${escapeHtml(jd.id)}" ${cvs.length ? '' : 'disabled'}>Chia sẻ CV ứng tuyển</button></div>`
                : verifyLink;
            })()}
          </div>
        `;
        }).join('');
        pageJdListContainer.querySelectorAll('.apply-jd').forEach(button => button?.addEventListener('click', async () => {
          const cvId = button.closest('div').querySelector('.jd-application-cv')?.value;
          if (!cvId) return;
          try { await ApiClient.shareCV(button.dataset.id, cvId); showToast('Đã chia sẻ CV cho doanh nghiệp.', 'success'); }
          catch (err) { showToast(`Không thể ứng tuyển: ${err.message}`, 'error'); }
        }));
      } catch (err) {
        pageJdListContainer.innerHTML = `<p style="font-size:12px;color:#ff4e6a;">Lỗi tải JD: ${err.message}</p>`;
      }
    })().finally(() => {
      loadPageJDListInFlight = null;
    });
    return loadPageJDListInFlight;
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

  // Dựng <option> cho MỌI dropdown chọn CV. Trùng tiêu đề là chuyện bình thường
  // — một người có thể có nhiều CV cùng tên — nên chỉ khi trùng mới thêm ngày
  // tạo và 6 ký tự đầu của id để phân biệt. Trước đây mỗi trang tự nối chuỗi
  // riêng, khiến trang Phỏng vấn hiện 20 mục giống hệt nhau (issue #71).
  //
  // `emptyOption` cho phép mỗi trang giữ thông điệp rỗng riêng; `prefix` trả về
  // HTML đặt trước nhãn (trang Việc phù hợp dùng để chèn badge trạng thái CV).
  function buildCvOptions(cvs, { emptyOption, prefix } = {}) {
    const list = cvs || [];
    if (!list.length) {
      // `??` chứ không phải `||`: trang Việc phù hợp cố ý truyền chuỗi RỖNG vì
      // nó đã tự dựng option dẫn "Chọn CV đã lưu..." rồi. Dùng `||` sẽ coi chuỗi
      // rỗng là falsy và chèn thừa dòng "Chưa có CV" bên cạnh option đó.
      return emptyOption ?? '<option value="" disabled selected>Chưa có CV — hãy tải CV lên trước</option>';
    }
    const titleCounts = list.reduce((counts, cv) => {
      const title = cv.title || 'CV chưa đặt tên';
      counts[title] = (counts[title] || 0) + 1;
      return counts;
    }, {});
    return list.map(cv => {
      const title = cv.title || 'CV chưa đặt tên';
      const date = formatGapOptionDate(cv.created_at);
      const duplicateId = titleCounts[title] > 1 ? ` • #${String(cv.id).slice(0, 6)}` : '';
      const label = `${title}${date ? ` • ${date}` : ''}${duplicateId}`;
      const head = prefix ? prefix(cv) : '';
      return `<option value="${escapeHtml(cv.id)}">${head}${escapeHtml(label)}</option>`;
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
      const progress = beginOperationProgress(submitButton, {
        id: 'page-jd-upload-operation-progress',
        title: 'Đang chuẩn bị Job Description',
        steps: ['Tải file JD', 'Trích xuất nội dung', 'Chuẩn hóa yêu cầu tuyển dụng'],
      });
      const stageTimer = window.setTimeout(() => progress.advance(1, 'Đang đọc nội dung JD; file scan có thể mất thêm thời gian.'), 650);
      try {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang trích xuất nội dung JD...';
        await ApiClient.uploadJD(
          file,
          document.getElementById('page-upload-jd-title').value.trim(),
          document.getElementById('page-upload-jd-company').value.trim(),
          document.getElementById('page-upload-jd-location').value.trim(),
        );
        progress.advance(2, 'Đang lưu JD đã chuẩn hóa để dùng lại khi so khớp CV.');
        progress.complete('Hoàn tất. JD sẵn sàng cho RAG và phân tích CV–JD.');
        showToast('🎉 Đã tải lên và lưu Job Description!', 'success');
        pageUploadJdForm.reset();
        document.getElementById('page-upload-jd-file-name').textContent = 'PDF, DOCX, TXT hoặc ảnh';
        pageBtnTabSys?.click();
        await loadPageJDList();
      } catch (err) {
        showToast(`❌ Lỗi tải JD: ${err.message}`, 'error');
      } finally {
        window.clearTimeout(stageTimer);
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
      pageSelectGapCv.innerHTML = buildCvOptions(cvs);
      pageSelectGapJd.innerHTML = buildGapJdOptions(jds);
      const preselectedCvId = window.sessionStorage.getItem('career-preselected-cv-id');
      if (preselectedCvId && [...pageSelectGapCv.options].some(option => option.value === preselectedCvId)) {
        pageSelectGapCv.value = preselectedCvId;
        window.sessionStorage.removeItem('career-preselected-cv-id');
      }
      const preselectedJdId = window.sessionStorage.getItem('career-preselected-jd-id');
      if (preselectedJdId && [...pageSelectGapJd.options].some(option => option.value === preselectedJdId)) {
        pageSelectGapJd.value = preselectedJdId;
        window.sessionStorage.removeItem('career-preselected-jd-id');
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

      const progress = beginOperationProgress(pageBtnRunGap, {
        id: 'page-gap-operation-progress',
        title: 'Đang tạo báo cáo CV–JD',
        steps: ['Kiểm tra báo cáo đã lưu', 'Đối chiếu evidence local', 'Hoàn thiện nhận xét và lưu báo cáo'],
      });
      const stageTimer = window.setTimeout(() => progress.advance(1, 'Đang so khớp CV và JD bằng dữ liệu local.'), 450);
      try {
        pageBtnRunGap.disabled = true;
        showToast('AI đang tính toán Match Score & Gap Analysis...', 'info');
        const res = await ApiClient.runGapAnalysis(cvId, jdId);
        window.clearTimeout(stageTimer);
        progress.complete(
          res.cache_hit
            ? 'Đã dùng lại báo cáo đã lưu — không gọi Gemini.'
            : 'Báo cáo đã hoàn tất và được lưu để dùng lại ở lần sau.'
        );
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
          showToast(
            res.cache_hit
              ? '⚡ Đã dùng lại báo cáo đã lưu — không gọi Gemini.'
              : '🎉 Đã phân tích xong Gap Analysis!',
            'success'
          );
        }
      } catch (err) {
        window.clearTimeout(stageTimer);
        progress.fail('Không thể hoàn tất báo cáo. Bạn có thể thử lại.');
        showToast(`❌ Lỗi chạy Gap Analysis: ${err.message}`, 'error');
      } finally {
        pageBtnRunGap.disabled = false;
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
      showToast('Đang tải lên và phân tích CV...', 'info');
      const uploaded = await ApiClient.uploadCV(file);
      showToast('✅ Tải CV thành công! Đã tự động chọn CV cho phỏng vấn.', 'success');
      await populatePageInterviewOptions(uploaded.id);
    } catch (err) {
      showToast(`❌ Lỗi tải CV: ${err.message}`, 'error');
    } finally {
      event.target.value = '';
    }
  });

  const interviewUploadCvBtn = document.getElementById('page-interview-upload-cv-btn');
  const interviewUploadCvInput = document.getElementById('page-interview-upload-cv-input');
  interviewUploadCvBtn?.addEventListener('click', () => interviewUploadCvInput?.click());
  interviewUploadCvInput?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ApiClient.isAuthenticated()) {
      showToast('Vui lòng đăng nhập để tải CV.', 'warning');
      return;
    }
    try {
      interviewUploadCvBtn.disabled = true;
      showToast('Đang tải lên và phân tích CV...', 'info');
      const uploaded = await ApiClient.uploadCV(file);
      showToast('Tải CV thành công! Đã tự động chọn.', 'success');
      await populatePageInterviewOptions(uploaded.id);
    } catch (err) {
      showToast(`Lỗi tải CV: ${err.message}`, 'error');
    } finally {
      interviewUploadCvBtn.disabled = false;
      event.target.value = '';
    }
  });

  let populatePageInterviewOptionsInFlight = null;
  async function populatePageInterviewOptions(preferredCvId = '', preferredJdId = '') {
    if (populatePageInterviewOptionsInFlight) return populatePageInterviewOptionsInFlight;
    populatePageInterviewOptionsInFlight = (async () => {
      if (!pageSelectIntCv || !pageSelectIntJd) return;
      try {
        const cvsPromise = ApiClient.listCVs();
        await loadJDOptions(pageSelectIntJd, {
          includeCatalog: true,
          groupBySource: true,
          dedupe: true,
          preferredId: preferredJdId,
          separator: ' • ',
          emptyLabel: 'Chọn một JD để phỏng vấn thử',
          emptyStateLabel: 'Chưa có JD — hãy chọn hoặc tạo JD',
          catalogLabel: count => `JD TỪ VIỆC LÀM GỢI Ý (${count})`,
          savedLabel: 'JD ĐÃ LƯU HOẶC HỆ THỐNG',
        });
        const cvs = await cvsPromise;
        pageSelectIntCv.innerHTML = buildCvOptions(cvs, {
          emptyOption: '<option value="" disabled selected>Chưa có CV — bấm "Tải CV mới" để bắt đầu</option>',
        });

        if (preferredCvId && cvs.some(c => c.id === preferredCvId)) {
          pageSelectIntCv.value = preferredCvId;
        }
        enhanceGapSelect(pageSelectIntCv);
        enhanceGapSelect(pageSelectIntJd);
        await ApiClient.listInterviews();
        await checkInterviewAgenda();
      } catch (err) {
        showToast(`Lỗi lấy dữ liệu CV/JD: ${err.message}`, 'error');
      }
    })().finally(() => {
      populatePageInterviewOptionsInFlight = null;
    });
    return populatePageInterviewOptionsInFlight;
  }

  wireCatalogJDResolver(pageSelectIntJd, async newJdId => {
    await populatePageInterviewOptions('', newJdId);

  });

  if (pageBtnStartInt) {
    pageBtnStartInt?.addEventListener('click', async () => {
      const cvId = pageSelectIntCv?.value;
      const jdId = pageSelectIntJd?.value;
      if (!cvId || !jdId) {
        showToast('Bắt buộc phải chọn đủ 1 CV và 1 JD mới được bắt đầu phỏng vấn', 'warning');
        return;
      }

      phienDangBatDau = true;
      capNhatKhoaNutBatDau();
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
        if (pageProgressText) pageProgressText.textContent = phaseLabels.greeting;

        startVoiceSession(pageSessionId, language);
      } catch (err) {
        clearTimeout(slowTimer);
        showToast(`Không thể bắt đầu phỏng vấn: ${err.message}`, 'error');
        if (pageChatHistory) pageChatHistory.innerHTML = '';
      } finally {
        phienDangBatDau = false;
        capNhatKhoaNutBatDau();
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
            setTimeout(() => { switchView('interview-report'); renderInterviewReport(pageSessionId); }, 1200);
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

  /* ============================================================
     📚 NGÂN HÀNG CÂU HỎI TỰ SINH (Interview Agenda)
     Bộ câu hỏi sinh sẵn theo cặp CV+JD, tái dùng giữa các phiên. Gấp lại mặc
     định để tránh trang bị đánh giá "rối và nhiều chữ" — chỉ hiện dòng tiêu
     đề, evidence trích dẫn ngắn, không có khối giải thích STAR nào ở đây.
  ============================================================ */
  const AGENDA_COMPETENCY_LABELS = {
    self_intro: 'Giới thiệu',
    technical: 'Kỹ thuật',
    behavioral: 'Hành vi',
    situational: 'Tình huống',
    position: 'Vị trí',
    motivation: 'Động lực',
    company: 'Công ty',
  };
  const AGENDA_SOURCE_LABELS = { cv: 'Từ CV', jd: 'Từ JD' };

  // Truy vấn lại DOM MỖI LẦN DÙNG thay vì bắt một lần lúc nạp module. app.js
  // được import trong useEffect của app/page.tsx và trong môi trường dev nó
  // chạy lại nhiều lần theo vòng mount của React (xác nhận qua console: log
  // khởi động xuất hiện 6 lần trong một lần tải trang). Giữ tham chiếu bắt từ
  // lần chạy đầu sẽ trỏ vào node đã bị React thay, khiến panel không bao giờ
  // hiện dù logic đúng.
  const agendaEl = {
    get section() { return document.getElementById('page-interview-agenda'); },
    get meta() { return document.getElementById('page-interview-agenda-meta'); },
    get regenerateBtn() { return document.getElementById('page-interview-agenda-regenerate-btn'); },
    get createRow() { return document.getElementById('page-interview-agenda-create-row'); },
    get createBtn() { return document.getElementById('page-interview-agenda-create-btn'); },
    get loading() { return document.getElementById('page-interview-agenda-loading'); },
    get filters() { return document.getElementById('page-interview-agenda-filters'); },
    get list() { return document.getElementById('page-interview-agenda-list'); },
    get cvSelect() { return document.getElementById('page-interview-select-cv'); },
    get jdSelect() { return document.getElementById('page-interview-select-jd'); },
  };

  let currentAgenda = null;
  let currentAgendaFilter = 'all';

  function agendaCompetencyLabel(key) {
    return AGENDA_COMPETENCY_LABELS[key] || key || 'Khác';
  }

  // state: 'hidden' (chưa chọn đủ CV+JD) | 'need-create' (404, chưa sinh) |
  // 'loading' (đang gọi LLM) | 'ready' (đã có agenda để hiển thị)
  // Nút "Bắt đầu phỏng vấn" bị khoá bởi HAI nguồn độc lập: chính nó đang chạy,
  // và agenda đang được sinh. Gộp lại một chỗ để nguồn này không mở khoá thay
  // cho nguồn kia — nếu agenda sinh xong trong lúc request start còn đang bay
  // mà ta mở khoá luôn thì người dùng bấm được lần hai.
  let agendaDangSinh = false;
  let phienDangBatDau = false;

  function capNhatKhoaNutBatDau() {
    const btn = document.getElementById('page-btn-start-interview');
    if (!btn) return;
    btn.disabled = agendaDangSinh || phienDangBatDau;
    // Bấm cả hai nút cùng lúc còn tốn HAI lời gọi LLM cho cùng một agenda
    // (endpoint /interviews/start cũng gọi ensure_agenda), rồi một cái bị bỏ.
    btn.title = agendaDangSinh ? 'Đang sinh bộ câu hỏi, vui lòng đợi…' : '';
  }

  function setAgendaPanelState(state) {
    agendaDangSinh = state === 'loading';
    capNhatKhoaNutBatDau();
    if (!agendaEl.section) return;
    agendaEl.section.hidden = state === 'hidden';
    if (agendaEl.createRow) agendaEl.createRow.hidden = state !== 'need-create';
    if (agendaEl.loading) agendaEl.loading.hidden = state !== 'loading';
    if (agendaEl.filters) agendaEl.filters.hidden = state !== 'ready';
    if (agendaEl.list) agendaEl.list.hidden = state !== 'ready';
    if (agendaEl.regenerateBtn) agendaEl.regenerateBtn.hidden = state !== 'ready';
  }

  // Backend trả detail tiếng Việt hữu ích hơn message đã bị getSafeApiMessage
  // rút gọn (vd. 400 "không thể tắt hết mọi câu hỏi") — ưu tiên dùng nó khi có.
  function describeAgendaError(err, fallback) {
    const detail = err && err.payload ? err.payload.detail : null;
    return typeof detail === 'string' && detail.trim() ? detail : ((err && err.message) || fallback);
  }

  // Kiểm tra agenda đã tồn tại cho cặp CV+JD hiện chọn. KHÔNG tự POST — chỉ
  // hiện nút "Tạo bộ câu hỏi" khi 404, để không tự tiêu quota LLM của người
  // dùng lúc họ mới chọn xong CV/JD.
  async function checkInterviewAgenda() {
    const cvId = agendaEl.cvSelect?.value;
    const jdId = agendaEl.jdSelect?.value;
    // `catalog:<source_id>` là JD doanh nghiệp CHƯA được import vào bảng
    // job_descriptions, nên chưa có id thật để tra agenda. Hỏi backend bằng id
    // này chắc chắn trả 400. wireCatalogJDResolver sẽ import rồi nạp lại danh
    // sách, và lần đổi select sau đó gọi lại hàm này với id thật.
    // Cùng quy ước với hasJDSelected(): giá trị `catalog:` = chưa chọn xong.
    if (!cvId || !jdId || jdId.startsWith('catalog:')) {
      currentAgenda = null;
      setAgendaPanelState('hidden');
      return;
    }
    try {
      const agenda = await ApiClient.getInterviewAgenda(cvId, jdId);
      currentAgenda = agenda;
      currentAgendaFilter = 'all';
      renderAgendaPanel();
    } catch (err) {
      currentAgenda = null;
      if (err?.status === 404) {
        setAgendaPanelState('need-create');
      } else {
        // Lỗi tải agenda không được chặn luồng chính của trang phỏng vấn.
        setAgendaPanelState('hidden');
      }
    }
  }

  function agendaQuestionGroups(questions) {
    const groups = new Map();
    questions.forEach(q => {
      const key = q.competency || 'khac';
      groups.set(key, (groups.get(key) || 0) + 1);
    });
    return groups;
  }

  function renderAgendaPanel() {
    if (!currentAgenda || !agendaEl.section) return;
    setAgendaPanelState('ready');

    const questions = currentAgenda.questions || [];
    const groups = agendaQuestionGroups(questions);
    const hasCvSource = questions.some(q => q.source === 'cv');
    const hasJdSource = questions.some(q => q.source === 'jd');
    // `generated_by === 'fallback'` nghĩa là backend không gọi được LLM (hoặc
    // LLM trả JSON hỏng) và đã lấp bằng bộ generic. Trước đây trạng thái này
    // rơi vào metaSuffix rỗng — im lặng, trông y hệt lúc thành công — nên
    // người dùng tưởng bộ câu hỏi bám CV/JD của mình trong khi thực tế không.
    // Cũng cảnh báo khi không câu nào bám CV/JD, vì từng câu vẫn có thể bị hạ
    // cấp thành generic dù lần gọi LLM tổng thể được coi là thành công.
    const isFallback =
      (currentAgenda.generated_by || '') === 'fallback' || (!hasCvSource && !hasJdSource);
    const metaSuffix = isFallback
      ? ' · ⚠ bộ câu hỏi mặc định, chưa bám CV/JD của bạn — hãy bấm "Sinh lại"'
      : (hasCvSource ? ' · dựa trên CV của bạn' : ' · dựa trên JD');
    if (agendaEl.meta) {
      agendaEl.meta.textContent = `${questions.length} câu · ${groups.size} nhóm năng lực${metaSuffix}`;
      agendaEl.meta.classList.toggle('is-fallback', isFallback);
    }

    if (agendaEl.filters) {
      const chips = [
        `<button type="button" class="interview-agenda-chip${currentAgendaFilter === 'all' ? ' is-active' : ''}" data-agenda-filter="all">Tất cả</button>`,
      ];
      groups.forEach((count, key) => {
        chips.push(
          `<button type="button" class="interview-agenda-chip${currentAgendaFilter === key ? ' is-active' : ''}" data-agenda-filter="${escapeHtml(key)}">${escapeHtml(agendaCompetencyLabel(key))} ${count}</button>`
        );
      });
      agendaEl.filters.innerHTML = chips.join('');
    }

    renderAgendaList();
  }

  function renderAgendaList() {
    if (!agendaEl.list) return;
    const questions = (currentAgenda?.questions || []).filter(
      q => currentAgendaFilter === 'all' || q.competency === currentAgendaFilter
    );
    if (!questions.length) {
      agendaEl.list.innerHTML = '<li class="interview-agenda-empty-filter">Không có câu hỏi trong nhóm này.</li>';
      return;
    }
    agendaEl.list.innerHTML = questions.map((q, idx) => renderAgendaQuestionItem(q, idx)).join('');
    bindAgendaItemToggles();
    bindAgendaCheckboxes();
  }

  function renderAgendaQuestionItem(q, idx) {
    const order = String(idx + 1).padStart(2, '0');
    const competencyLabel = escapeHtml(agendaCompetencyLabel(q.competency));
    const firstSkill = Array.isArray(q.linked_skills) && q.linked_skills.length ? escapeHtml(q.linked_skills[0]) : '';
    const titleParts = [competencyLabel, firstSkill].filter(Boolean);
    const isEnabled = q.is_enabled !== false;
    const sourceLabel = AGENDA_SOURCE_LABELS[q.source] || '';
    const evidenceHtml = q.evidence
      ? `<blockquote class="interview-agenda-evidence">${sourceLabel ? `<strong>${escapeHtml(sourceLabel)}:</strong> ` : ''}“${escapeHtml(q.evidence)}”</blockquote>`
      : '';
    const followUps = Array.isArray(q.follow_up_prompts) ? q.follow_up_prompts.filter(Boolean) : [];
    const followUpHtml = followUps.length
      ? `<div class="interview-agenda-followups"><strong>Đào sâu:</strong><ul>${followUps.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul></div>`
      : '';
    return `
      <li class="interview-agenda-item${isEnabled ? '' : ' is-disabled'}" data-question-id="${escapeHtml(String(q.id))}">
        <div class="interview-agenda-item__row">
          <input type="checkbox" class="interview-agenda-item__checkbox" ${isEnabled ? 'checked' : ''} aria-label="Bật/tắt câu hỏi ${order}" />
          <button type="button" class="interview-agenda-item__trigger" aria-expanded="false">
            <span class="interview-agenda-item__index">${order}</span>
            <span class="interview-agenda-item__title">${titleParts.join(' · ') || 'Câu hỏi'}</span>
            ${!isEnabled ? '<span class="interview-agenda-item__disabled-tag">đã tắt</span>' : ''}
            <svg class="interview-agenda-item__chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </div>
        <div class="interview-agenda-item__body" hidden>
          <p class="interview-agenda-item__question">${escapeHtml(q.question_vi || '')}</p>
          ${evidenceHtml}
          ${followUpHtml}
        </div>
      </li>
    `;
  }

  function bindAgendaItemToggles() {
    agendaEl.list?.querySelectorAll('.interview-agenda-item__trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const item = trigger.closest('.interview-agenda-item');
        const body = item?.querySelector('.interview-agenda-item__body');
        const isOpen = item ? item.classList.toggle('is-open') : false;
        if (body) body.hidden = !isOpen;
        trigger.setAttribute('aria-expanded', String(isOpen));
      });
    });
  }

  function bindAgendaCheckboxes() {
    agendaEl.list?.querySelectorAll('.interview-agenda-item__checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', async () => {
        if (!currentAgenda) return;
        const item = checkbox.closest('.interview-agenda-item');
        const questionId = item?.dataset.questionId;
        if (!questionId) return;

        const nextChecked = checkbox.checked;
        const previousChecked = !nextChecked;
        const enabledMap = {};
        (currentAgenda.questions || []).forEach(q => {
          enabledMap[String(q.id)] = String(q.id) === questionId ? nextChecked : q.is_enabled !== false;
        });

        checkbox.disabled = true;
        try {
          const updated = await ApiClient.updateInterviewAgendaQuestions(currentAgenda.id, enabledMap);
          currentAgenda = updated;
          renderAgendaPanel();
        } catch (err) {
          checkbox.checked = previousChecked;
          item?.classList.toggle('is-disabled', !previousChecked);
          showToast(describeAgendaError(err, 'Không thể cập nhật câu hỏi. Vui lòng thử lại.'), 'error');
        } finally {
          checkbox.disabled = false;
        }
      });
    });
  }

  // Cả ba listener dưới đây uỷ quyền trên document vì cùng lý do với listener
  // 'change' của 2 select: node do React dựng có thể bị thay sau khi app.js
  // chạy, nên gắn thẳng vào phần tử sẽ nằm trên node đã rời DOM.
  document.addEventListener('click', event => {
    const chip = event.target.closest('#page-interview-agenda-filters [data-agenda-filter]');
    if (!chip) return;
    currentAgendaFilter = chip.dataset.agendaFilter;
    renderAgendaPanel();
  });

  document.addEventListener('click', async event => {
    if (!event.target.closest('#page-interview-agenda-create-btn')) return;
    const cvId = agendaEl.cvSelect?.value;
    const jdId = agendaEl.jdSelect?.value;
    if (!cvId || !jdId) return;
    setAgendaPanelState('loading');
    if (agendaEl.createBtn) agendaEl.createBtn.disabled = true;
    try {
      const agenda = await ApiClient.createInterviewAgenda(cvId, jdId);
      currentAgenda = agenda;
      currentAgendaFilter = 'all';
      renderAgendaPanel();
      showToast('Đã tạo bộ câu hỏi phỏng vấn cho vị trí này.', 'success');
    } catch (err) {
      setAgendaPanelState('need-create');
      showToast(describeAgendaError(err, 'Không thể tạo bộ câu hỏi. Vui lòng thử lại.'), 'error');
    } finally {
      if (agendaEl.createBtn) agendaEl.createBtn.disabled = false;
    }
  });

  document.addEventListener('click', async event => {
    if (!event.target.closest('#page-interview-agenda-regenerate-btn')) return;
    if (!currentAgenda) return;
    const confirmed = window.confirm(
      'Sinh lại sẽ tạo bộ câu hỏi mới và ghi đè bộ hiện tại (tốn một lượt gọi AI). Tiếp tục?'
    );
    if (!confirmed) return;
    setAgendaPanelState('loading');
    if (agendaEl.regenerateBtn) agendaEl.regenerateBtn.disabled = true;
    try {
      const agenda = await ApiClient.regenerateInterviewAgenda(currentAgenda.id);
      currentAgenda = agenda;
      currentAgendaFilter = 'all';
      renderAgendaPanel();
      showToast('Đã sinh lại bộ câu hỏi.', 'success');
    } catch (err) {
      renderAgendaPanel();
      showToast(describeAgendaError(err, 'Không thể sinh lại bộ câu hỏi. Vui lòng thử lại.'), 'error');
    } finally {
      if (agendaEl.regenerateBtn) agendaEl.regenerateBtn.disabled = false;
    }
  });

  // Uỷ quyền trên document thay vì gắn thẳng vào 2 select: node do React dựng
  // có thể bị thay sau khi app.js gắn sự kiện, khiến listener nằm trên node đã
  // rời DOM. Đây cũng là pattern sẵn có của app.js (xem các document
  // .addEventListener('change', ...) khác trong file).
  document.addEventListener('change', event => {
    if (!event.target.closest('#page-interview-select-cv, #page-interview-select-jd')) return;
    checkInterviewAgenda();
  });

  /* ── Voice Interview WebSocket Client ─────────────────────── */
  let voiceWs = null;
  let voiceMediaStream = null;
  let voicePcmWorkletNode = null;
  let voiceAudioContext = null;
  let voiceGainNode = null;
  let voiceIsRecording = false;
  let voiceTranscriptParts = [];
  let voiceConversationHistory = [];
  let voiceTimerInterval = null;
  let voiceStartTime = null;
  const MAX_INTERVIEW_MS = 10 * 60 * 1000;
  // Phải khớp đúng PHASES trong backend/src/services/voice/voice_orchestrator.py.
  // Key không khớp thì UI hiện chuỗi thô (vd "role_alignment") cho người dùng,
  // vì chỗ dùng là `phaseLabels[msg.phase] || msg.phase`.
  const phaseLabels = {
    greeting: 'Lời chào',
    self_intro: 'Giới thiệu',
    experience_deepdive: 'Kinh nghiệm',
    skills_assessment: 'Kỹ năng',
    role_alignment: 'Vị trí & Công ty',
    candidate_qa: 'Bạn hỏi',
    admin_logistics: 'Thông tin',
    closing: 'Kết thúc',
  };

  // Nối lại một phiên phỏng vấn đang dở từ trang lịch sử. Phiên voice được
  // nối thẳng qua WebSocket: backend tự nạp lại các cặp hỏi–đáp đã lưu nên AI
  // hỏi tiếp chứ không chào lại từ đầu.
  function resumeInterviewSession(sessionId) {
    if (!sessionId) return;
    const session = (archiveDataCache.interviews || []).find(
      item => String(item.id) === String(sessionId)
    );

    switchView('interview');

    // Phiên dạng văn bản chưa được nối lại — giữ nguyên hành vi cũ.
    if (session && session.mode !== 'voice') return;

    pageSessionId = sessionId;
    if (pageSetupSec) pageSetupSec.style.display = 'flex';
    if (pageReportSec) pageReportSec.style.display = 'none';
    if (pageChatSec) pageChatSec.style.display = 'flex';
    if (pageChatHistory) {
      pageChatHistory.innerHTML = '';
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'interview-message interview-message-ai';
      loadingDiv.innerHTML = '<strong>Career Buddy</strong><p>Đang nối lại buổi phỏng vấn đang dở...</p>';
      pageChatHistory.appendChild(loadingDiv);
    }
    startVoiceSession(sessionId, session?.language || 'vi');
  }

  function startVoiceSession(sessionId, language) {
    const token = ApiClient.getToken();
    if (!token) {
      showToast('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.', 'error');
      return;
    }
    // Voice is a direct browser-to-backend connection. Do not inherit the REST
    // API URL: a stale/local API setting such as https://localhost:8000 would
    // otherwise become wss://localhost:8000 in production.
    const configuredBackend = window.__CAREER_VOICE_WS_BASE_URL__;
    const localBackend = location.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(location.hostname)
      ? 'http://localhost:8000'
      : '';
    const backendBaseUrl = configuredBackend || localBackend;
    if (!backendBaseUrl) {
      showToast('Voice chưa được cấu hình trên môi trường này. Hãy đặt NEXT_PUBLIC_VOICE_WS_URL.', 'error');
      return;
    }
    let backendUrl;
    try {
      backendUrl = new URL(backendBaseUrl);
    } catch (_err) {
      showToast('URL Voice backend không hợp lệ. Hãy kiểm tra NEXT_PUBLIC_VOICE_WS_URL.', 'error');
      return;
    }
    const wsProto = ['https:', 'wss:'].includes(backendUrl.protocol) ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${backendUrl.host}/api/v1/ws/interview/${sessionId}?token=${encodeURIComponent(token)}`;

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
          if (pageProgressText) pageProgressText.textContent = phaseLabels[msg.phase] || msg.phase;
        }
        if (msg.audio) playAudioBase64(msg.audio);
        break;
      }

      case 'history':
        // Backend gửi lại các cặp hỏi–đáp đã lưu khi nối lại phiên đang dở.
        // Khung chat chỉ hiển thị câu hỏi hiện tại, nên phần này chỉ dùng để
        // bản ghi đầy đủ ở cuối phiên không bị mất phần đã trả lời trước đó.
        (msg.pairs || []).forEach(pair => {
          voiceConversationHistory.push({ sender: 'interviewer', text: pair.question });
          voiceConversationHistory.push({ sender: 'user', text: pair.answer });
        });
        break;

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
            div.innerHTML = `<strong>${isBot ? 'Career Buddy' : 'Bạn'}</strong><p>${escapeHtml(entry.text)}</p>`;
            pageChatHistory.appendChild(div);
          });
          pageChatHistory.scrollTop = pageChatHistory.scrollHeight;
        }
        { const eb = document.querySelector('.interview-end-session'); if (eb) eb.disabled = true; }
        showToast('Hoàn thành phỏng vấn! Đang tải báo cáo STAR...', 'success');
        setTimeout(() => { switchView('interview-report'); renderInterviewReport(pageSessionId); }, 1200);
        break;

      case 'error':
        showToast(msg.message, 'error');
        break;
    }
  }

  let voiceCurrentAudio = null;

  function playAudioBase64(b64) {
    try {
      stopCurrentAudio();
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); voiceCurrentAudio = null; };
      voiceCurrentAudio = audio;
      audio.play().catch(() => { });
    } catch { /* ignore playback errors */ }
  }

  function stopCurrentAudio() {
    if (voiceCurrentAudio) {
      voiceCurrentAudio.pause();
      voiceCurrentAudio.currentTime = 0;
      voiceCurrentAudio = null;
    }
  }

  async function startVoiceRecording() {
    if (voiceIsRecording) return;
    try {
      voiceMediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true, channelCount: 1, sampleRate: { ideal: 16000 } } });

      const actualRate = voiceMediaStream.getAudioTracks()[0]?.getSettings()?.sampleRate || 48000;
      voiceAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: actualRate });
      // Gemini Live (backend/src/services/voice/stt_service.py) chỉ nhận PCM16
      // thô 16kHz mono — MediaRecorder chỉ tạo được container nén (webm/opus),
      // gửi thẳng bytes đó lên rồi khai là "audio/pcm" khiến STT không nhận ra
      // giọng nói. Worklet này đổi mic sang đúng định dạng PCM16 backend cần.
      await voiceAudioContext.audioWorklet.addModule('/pcm16-worklet.js');
      const source = voiceAudioContext.createMediaStreamSource(voiceMediaStream);
      voiceGainNode = voiceAudioContext.createGain();
      voiceGainNode.gain.value = 2.5;
      voicePcmWorkletNode = new AudioWorkletNode(voiceAudioContext, 'pcm16-downsampler', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
      });
      source.connect(voiceGainNode);
      voiceGainNode.connect(voicePcmWorkletNode);
      // Worklet không ghi gì vào output (chỉ phát PCM qua port.postMessage), nên
      // nối tới destination không phát ra tiếng — chỉ để trình duyệt tiếp tục
      // "kéo" đồ thị audio này (worklet mồ côi, không tới đích, sẽ ngừng chạy).
      voicePcmWorkletNode.connect(voiceAudioContext.destination);

      voiceIsRecording = true;
      voiceTranscriptParts = [];

      if (voiceWs) voiceWs.send(JSON.stringify({ type: 'start_recording' }));

      const sttIndicator = document.getElementById('page-interview-stt-indicator');
      const sttPartialText = document.getElementById('stt-partial-text');
      if (sttIndicator) sttIndicator.style.display = 'flex';
      if (sttPartialText) sttPartialText.textContent = 'Đang nghe...';

      voicePcmWorkletNode.port.onmessage = (event) => {
        if (voiceWs?.readyState === WebSocket.OPEN) {
          const b64 = btoa(String.fromCharCode(...new Uint8Array(event.data)));
          voiceWs.send(JSON.stringify({ type: 'audio_chunk', data: b64 }));
        }
      };

      const voiceButton = document.getElementById('page-interview-voice');
      voiceButton?.classList.add('is-listening');
    } catch (err) {
      showToast('Không thể truy cập microphone. Hãy cấp quyền truy cập.', 'error');
    }
  }

  function stopVoiceRecording() {
    if (voicePcmWorkletNode) {
      voicePcmWorkletNode.port.onmessage = null;
      voicePcmWorkletNode.disconnect();
      voicePcmWorkletNode = null;
    }
    if (voiceAudioContext) {
      voiceAudioContext.close().catch(() => { });
      voiceAudioContext = null;
      voiceGainNode = null;
    }
    if (voiceMediaStream) {
      voiceMediaStream.getTracks().forEach(t => t.stop());
      voiceMediaStream = null;
    }
    voiceIsRecording = false;

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
      stopCurrentAudio();
      stopVoiceRecording();
      voiceWs.send(JSON.stringify({ type: 'end_session' }));
      const btn = document.querySelector('.interview-end-session');
      if (btn) btn.disabled = true;
    }
  });

  function startVoiceTimer() {
    voiceStartTime = Date.now();
    const timerEl = document.getElementById('page-interview-timer');
    if (timerEl) timerEl.textContent = `00:00 / ${String(Math.floor(MAX_INTERVIEW_MS / 60000)).padStart(2, '0')}:00`;
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

  const REPORT_MODE_LABELS = { voice: 'Giọng nói', text: 'Văn bản' };
  const REPORT_LANGUAGE_LABELS = { vi: 'Tiếng Việt', en: 'Tiếng Anh', bilingual: 'Song ngữ' };

  // Một khối hỏi–đáp gấp/mở được trong transcript phỏng vấn. Mọi chuỗi lấy
  // từ server đều đi qua escapeHtml trước khi ghép vào innerHTML.
  function renderReportTranscriptItem(qa = {}, index = 0) {
    const qIndex = Number.isFinite(qa.question_index) ? qa.question_index : index;
    const starScore = qa.star_score || {};
    const scoreValues = ['situation', 'task', 'action', 'result']
      .map(key => starScore[key])
      .filter(value => value != null && !Number.isNaN(Number(value)));
    const avgScore = scoreValues.length
      ? Math.round(scoreValues.reduce((sum, value) => sum + Number(value), 0) / scoreValues.length)
      : null;
    const questionText = escapeHtml(qa.question_text || 'Câu hỏi không có nội dung');
    const answerText = escapeHtml(qa.user_answer || 'Không có nội dung.');
    const followUpQ = qa.follow_up_question ? escapeHtml(qa.follow_up_question) : '';
    const followUpA = qa.follow_up_answer ? escapeHtml(qa.follow_up_answer) : '';
    return `
      <article class="report-transcript-item" data-qa-index="${index}">
        <button type="button" class="report-transcript-item__trigger" aria-expanded="false">
          <span class="report-transcript-item__index">Câu ${qIndex + 1}</span>
          <span class="report-transcript-item__question">${questionText}</span>
          <span class="report-transcript-item__score">${avgScore != null ? `${avgScore}/100` : '—'}</span>
          <svg class="report-transcript-item__chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div class="report-transcript-item__body" hidden>
          <p><strong>Bạn trả lời:</strong> ${answerText}</p>
          ${followUpQ ? `<p><strong>Câu hỏi mở rộng:</strong> ${followUpQ}</p>` : ''}
          ${followUpA ? `<p><strong>Trả lời mở rộng:</strong> ${followUpA}</p>` : ''}
          <div class="report-transcript-item__star">${renderStarBadgeGrid(starScore, null)}</div>
        </div>
      </article>
    `;
  }

  function bindReportTranscriptToggles(container) {
    container?.querySelectorAll('.report-transcript-item__trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const item = trigger.closest('.report-transcript-item');
        const body = item?.querySelector('.report-transcript-item__body');
        const isOpen = item ? item.classList.toggle('is-open') : false;
        if (body) body.hidden = !isOpen;
        trigger.setAttribute('aria-expanded', String(isOpen));
      });
    });
  }

  // Hàm dùng chung để render trang báo cáo phỏng vấn (view-interview-report),
  // gọi từ 2 lối vào: kết thúc phỏng vấn trực tiếp và nút "Mở báo cáo đầy đủ"
  // trong drawer Lịch sử. Backend có thể chưa trả đủ các trường mở rộng
  // (qa_history, jd_title, cv_title, mode, language) nên mọi truy cập đều
  // có nhánh phòng thủ khi vắng mặt.
  async function renderInterviewReport(sessionId) {
    const reportSec = document.getElementById('page-interview-report');
    const transcriptEl = document.getElementById('page-report-transcript');
    if (reportSec) reportSec.style.display = 'block';
    if (transcriptEl) transcriptEl.innerHTML = '<p class="report-transcript-empty">Đang tải báo cáo…</p>';
    try {
      const report = await ApiClient.getInterviewReport(sessionId);

      const totalScoreEl = document.getElementById('page-report-total-score');
      if (totalScoreEl) totalScoreEl.textContent = `${Number(report.total_score || 0).toFixed(1)} / 100`;
      // This is the live "Phòng phỏng vấn" full-page flow (view-interview-report / page-*
      // elements) — distinct from the older interview-*/report-* modal flow below.
      // It previously never notified the dashboard at all, which is why the STAR
      // Score gauge on Trang chủ kept showing a stale value after finishing a real
      // interview here until a manual F5 (Việc 1).
      updateDashboardGaugeScores(NaN, Number(report.total_score));
      refreshDashboardOverview();

      const jdTitleEl = document.getElementById('page-report-jd-title');
      if (jdTitleEl) jdTitleEl.textContent = report.jd_title || 'Vị trí ứng tuyển';

      const dateEl = document.getElementById('page-report-date');
      if (dateEl) dateEl.textContent = report.created_at ? formatFullDateTimeVi(report.created_at) : 'Gần đây';

      const modeEl = document.getElementById('page-report-mode-badge');
      if (modeEl) {
        const modeLabel = REPORT_MODE_LABELS[report.mode] || 'Giọng nói';
        const languageLabel = REPORT_LANGUAGE_LABELS[report.language] || '';
        modeEl.textContent = languageLabel ? `${modeLabel} · ${languageLabel}` : modeLabel;
      }

      const scores = report.star_scores || {};
      const starBrkEl = document.getElementById('page-report-star-breakdown');
      if (starBrkEl) {
        starBrkEl.innerHTML = renderStarBadgeGrid(scores, 80);
      }

      const stEl = document.getElementById('page-report-strengths-list');
      if (stEl) stEl.innerHTML = (report.strengths || []).map(s => `<li>${escapeHtml(s)}</li>`).join('') || '<li>Chưa có dữ liệu</li>';

      const impEl = document.getElementById('page-report-improvements-list');
      if (impEl) impEl.innerHTML = (report.improvements || []).map(i => `<li>${escapeHtml(i)}</li>`).join('') || '<li>Chưa có dữ liệu</li>';

      const recEl = document.getElementById('page-report-recommendations-list');
      if (recEl) recEl.innerHTML = (report.recommendations || []).map(r => `<li>${escapeHtml(r)}</li>`).join('') || '<li>Chưa có dữ liệu</li>';

      const qaHistory = Array.isArray(report.qa_history) ? report.qa_history : [];
      if (transcriptEl) {
        transcriptEl.innerHTML = qaHistory.length
          ? qaHistory.map((qa, index) => renderReportTranscriptItem(qa, index)).join('')
          : '<p class="report-transcript-empty">Chưa có dữ liệu hội thoại chi tiết cho phiên này.</p>';
        bindReportTranscriptToggles(transcriptEl);
      }
    } catch (err) {
      if (transcriptEl) transcriptEl.innerHTML = '';
      showToast(`Không thể tải báo cáo: ${err.message}`, 'error');
    }
  }

  document.getElementById('page-report-back-history')?.addEventListener('click', () => switchView('history'));
  document.getElementById('page-report-retry')?.addEventListener('click', () => switchView('interview'));

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
  let archiveDataCache = { cvs: [], analyses: [], interviews: [], cvVariants: [], jdMap: new Map(), cvMap: new Map(), acceptedOptimizations: new Map() };
  let currentArchiveFilter = 'all';

  let loadMissionArchiveInFlight = null;
  async function loadMissionArchive() {
    if (loadMissionArchiveInFlight) return loadMissionArchiveInFlight;
    loadMissionArchiveInFlight = (async () => {
      try {
        const [cvs, analyses, interviews, jds, cvVariantsRes] = await Promise.all([
          ApiClient.listCVs().catch(() => []),
          ApiClient.getAnalysisHistory().catch(() => []),
          ApiClient.listInterviews().catch(() => []),
          ApiClient.listJDs().catch(() => []),
          ApiClient.listCVVariants().catch(() => ({ items: [] })),
        ]);

        const jdMap = new Map((jds || []).map(jd => [jd.id, jd.title]));
        const cvMap = new Map((cvs || []).map(cv => [cv.id, cv.title]));
        const cvVariants = cvVariantsRes?.items || (Array.isArray(cvVariantsRes) ? cvVariantsRes : []);

        archiveDataCache = {
          cvs: cvs || [],
          analyses: analyses || [],
          interviews: interviews || [],
          cvVariants: cvVariants || [],
          jdMap,
          cvMap,
          acceptedOptimizations: new Map()
        };

        renderMissionArchiveCards();
        renderHistoryDashboard();
      } catch (err) {
        console.error('[MissionArchive] Error loading archive:', err);
        renderHistoryDashboard();
      }
    })().finally(() => {
      loadMissionArchiveInFlight = null;
    });
    return loadMissionArchiveInFlight;
  }

  function renderMissionArchiveCards() {
    const container = document.getElementById('archive-timeline-container');
    if (!container) return;

    const matchedCount = (archiveDataCache.analyses || []).length;
    const variantCount = (archiveDataCache.cvVariants || []).length;
    const legacyOptCount = (archiveDataCache.analyses || []).filter(analysis => (
      (archiveDataCache.acceptedOptimizations.get(analysis.id) || []).length > 0
    )).length;
    const optimizedCount = variantCount || legacyOptCount;
    const interviewCount = (archiveDataCache.interviews || []).length;

    [['archive-match-count', matchedCount], ['archive-optimized-count', optimizedCount], ['archive-interview-count', interviewCount]]
      .forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
      });
  }

  let historyPage = 1;
  let historyPageSize = 10;
  let historyMetric = 'match';
  let historyUiBound = false;
  let historySortField = 'date';
  let historySortOrder = 'desc';

  function getHistoryActivities() {
    const { analyses = [], interviews = [], cvVariants = [], acceptedOptimizations = new Map(), cvMap = new Map(), jdMap = new Map() } = archiveDataCache;
    const activities = [];

    // 1. So khớp CV & JD
    analyses.forEach(analysis => {
      const cvTitle = cvMap.get(analysis.cv_id) || 'CV hồ sơ';
      const jdTitle = jdMap.get(analysis.jd_id) || 'Vị trí mục tiêu';
      activities.push({
        id: analysis.id,
        type: 'match',
        status: String(analysis.status || 'COMPLETED').toLowerCase(),
        cvTitle,
        jdTitle,
        score: Number(analysis.match_score || 0),
        date: analysis.created_at,
        analysis,
      });

      const acceptedCount = (acceptedOptimizations.get(analysis.id) || []).length;
      if (acceptedCount && !cvVariants.length) {
        activities.push({
          id: `optimized:${analysis.id}`,
          analysisId: analysis.id,
          type: 'optimized',
          status: 'completed',
          cvTitle,
          jdTitle,
          score: Number(analysis.match_score || 0),
          date: analysis.created_at,
          acceptedCount,
          analysis,
        });
      }
    });

    // 2. CV Variants (Tối ưu CV theo JD v2 & Revisions)
    cvVariants.forEach(variant => {
      const cvTitle = variant.title || 'CV tối ưu theo JD';
      const targetJd = variant.content?.target_jd || {};
      const jdTitle = targetJd.title || variant.target_jd_title || 'Vị trí mục tiêu';
      const matchScore = variant.content?._match_scores?.after_preview ?? variant.content?._match_scores?.before ?? null;
      const isCompleted = variant.status === 'PUBLISHED' || variant.status === 'VALIDATED';

      activities.push({
        id: `variant:${variant.id}`,
        variantId: variant.id,
        type: 'optimized',
        status: isCompleted ? 'completed' : 'in_progress',
        cvTitle,
        jdTitle,
        score: matchScore != null ? Number(matchScore) : null,
        date: variant.updated_at || variant.created_at || new Date().toISOString(),
        variant,
      });
    });

    // 3. Phỏng vấn STAR
    interviews.forEach(session => activities.push({
      id: session.id,
      type: 'interview',
      status: String(session.status || 'in_progress').toLowerCase(),
      cvTitle: cvMap.get(session.cv_id) || 'CV hồ sơ',
      jdTitle: jdMap.get(session.jd_id) || 'Vị trí phỏng vấn',
      score: session.total_score == null ? null : Number(session.total_score),
      date: session.completed_at || session.created_at,
      session,
    }));

    return activities.filter(item => item.date).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function historyTypeLabel(type) {
    return ({ match: 'Match CV', optimized: 'Tối ưu CV', interview: 'Phỏng vấn' })[type] || type;
  }

  function historyStatusLabel(status) {
    const s = String(status || '').replace(/_/g, '').toLowerCase();
    if (s === 'completed') return 'Hoàn thành';
    if (s === 'failed') return 'Lỗi';
    return 'Đang thực hiện';
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return '';
    let s = String(dateStr).trim();
    if (s && !s.endsWith('Z') && !s.includes('+') && !s.includes('GMT')) {
      if (s.includes('T')) {
        s = s + 'Z';
      } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
        s = s.replace(' ', 'T') + 'Z';
      }
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' });
  }

  function renderHistoryCharts(activities) {
    const chart = document.getElementById('history-progress-chart-container');
    const tooltip = document.getElementById('history-chart-tooltip');
    if (chart) {
      const series = activities.filter(item => item.type === historyMetric && item.score != null)
        .sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-8);

      if (!series.length) {
        chart.innerHTML = `<div class="chart-placeholder-loading">Chưa có dữ liệu điểm số cho mục ${historyMetric === 'match' ? 'Match CV' : 'Phỏng vấn'}.</div>`;
      } else {
        const svgW = 340;
        const svgH = 140;
        const padL = 36;
        const padR = 18;
        const padT = 16;
        const padB = 28;
        const plotW = svgW - padL - padR;
        const plotH = svgH - padT - padB;

        const points = series.map((item, index) => {
          const x = series.length === 1 ? padL + plotW / 2 : padL + (index * plotW / (series.length - 1));
          const clampedScore = Math.max(0, Math.min(100, item.score));
          const y = padT + plotH - (clampedScore * plotH / 100);
          return { x, y, item, clampedScore };
        });

        const pointsAttr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const areaPath = `M ${points[0].x.toFixed(1)},${(padT + plotH).toFixed(1)} ` +
          points.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
          ` L ${points[points.length - 1].x.toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

        const strokeColor = historyMetric === 'match' ? '#059669' : '#2563eb';
        const gradId = `chartGrad_${historyMetric}`;

        chart.innerHTML = `
          <svg viewBox="0 0 ${svgW} ${svgH}" class="svg-line-chart" role="img" aria-label="Biểu đồ tiến độ ${historyMetric}">
            <defs>
              <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.28" />
                <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.02" />
              </linearGradient>
            </defs>

            <!-- Y-Axis Gridlines & Labels -->
            <line x1="${padL}" y1="${padT}" x2="${svgW - padR}" y2="${padT}" class="chart-gridline" />
            <text x="${padL - 6}" y="${padT + 3}" class="chart-axis-label" text-anchor="end">100%</text>

            <line x1="${padL}" y1="${padT + plotH / 2}" x2="${svgW - padR}" y2="${padT + plotH / 2}" class="chart-gridline" />
            <text x="${padL - 6}" y="${padT + plotH / 2 + 3}" class="chart-axis-label" text-anchor="end">50%</text>

            <line x1="${padL}" y1="${padT + plotH}" x2="${svgW - padR}" y2="${padT + plotH}" class="chart-gridline" />
            <text x="${padL - 6}" y="${padT + plotH + 3}" class="chart-axis-label" text-anchor="end">0%</text>

            <!-- Area & Trend Line -->
            <path d="${areaPath}" fill="url(#${gradId})" />
            <polyline points="${pointsAttr}" fill="none" stroke="${strokeColor}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />

            <!-- Data Points & X-Labels -->
            ${points.map((p, idx) => `
              <text x="${p.x.toFixed(1)}" y="${svgH - 8}" class="chart-axis-label" text-anchor="middle">${escapeHtml(formatShortDate(p.item.date))}</text>
              <circle
                cx="${p.x.toFixed(1)}"
                cy="${p.y.toFixed(1)}"
                r="4.5"
                class="chart-data-point"
                stroke="${strokeColor}"
                data-chart-point="true"
                data-score="${p.item.score.toFixed(1)}${historyMetric === 'match' ? '%' : '/100'}"
                data-title="${escapeHtml(p.item.jdTitle)}"
                data-date="${escapeHtml(formatFullDateTimeVi(p.item.date))}"
              />
            `).join('')}
          </svg>
        `;

        // Bind chart tooltip interaction
        const pointEls = chart.querySelectorAll('[data-chart-point]');
        pointEls.forEach(pt => {
          pt.addEventListener('mouseenter', () => {
            if (!tooltip) return;
            const score = pt.dataset.score;
            const title = pt.dataset.title;
            const date = pt.dataset.date;
            tooltip.innerHTML = `
              <div class="tooltip-title">${title}</div>
              <div class="tooltip-score">Điểm: ${score}</div>
              <div class="tooltip-date">${date}</div>
            `;
            const rect = pt.getBoundingClientRect();
            const parentRect = chart.getBoundingClientRect();
            const left = rect.left - parentRect.left + rect.width / 2;
            const top = rect.top - parentRect.top;
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
            tooltip.hidden = false;
          });
          pt.addEventListener('mouseleave', () => {
            if (tooltip) tooltip.hidden = true;
          });
        });
      }
    }

    const donut = document.getElementById('history-donut-chart-container');
    if (donut) {
      const matchCount = activities.filter(item => item.type === 'match').length;
      const optimizeCount = activities.filter(item => item.type === 'optimized').length;
      const interviewCount = activities.filter(item => item.type === 'interview').length;
      const total = matchCount + optimizeCount + interviewCount;

      if (!total) {
        donut.innerHTML = '<div class="chart-placeholder-loading">Chưa có hoạt động nào được ghi nhận.</div>';
      } else {
        const matchPct = total ? Math.round((matchCount / total) * 100) : 0;
        const optPct = total ? Math.round((optimizeCount / total) * 100) : 0;
        const intPct = total ? Math.max(0, 100 - matchPct - optPct) : 0;

        const matchDeg = (matchCount / total) * 360;
        const optDeg = matchDeg + (optimizeCount / total) * 360;

        donut.innerHTML = `
          <div class="donut-flex-container">
            <div class="donut-svg-wrapper">
              <div class="history-donut" style="width:100%;height:100%;border-radius:50%;background:conic-gradient(#10b981 0deg ${matchDeg}deg, #f97316 ${matchDeg}deg ${optDeg}deg, #3b82f6 ${optDeg}deg 360deg);display:grid;place-items:center;">
                <div style="width:78px;height:78px;border-radius:50%;background:#ffffff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:inset 0 2px 4px rgba(0,0,0,0.04);">
                  <span class="donut-center-number">${total}</span>
                  <span class="donut-center-label">Tổng</span>
                </div>
              </div>
            </div>
            <div class="donut-legend-list">
              <div class="donut-legend-item">
                <span class="donut-legend-label">
                  <span class="donut-legend-dot is-match"></span> So khớp CV
                </span>
                <div class="donut-legend-meta">
                  <span class="donut-legend-count">${matchCount}</span>
                  <span class="donut-legend-pct">${matchPct}%</span>
                </div>
              </div>
              <div class="donut-legend-item">
                <span class="donut-legend-label">
                  <span class="donut-legend-dot is-optimized"></span> Tối ưu CV
                </span>
                <div class="donut-legend-meta">
                  <span class="donut-legend-count">${optimizeCount}</span>
                  <span class="donut-legend-pct">${optPct}%</span>
                </div>
              </div>
              <div class="donut-legend-item">
                <span class="donut-legend-label">
                  <span class="donut-legend-dot is-interview"></span> Phỏng vấn STAR
                </span>
                <div class="donut-legend-meta">
                  <span class="donut-legend-count">${interviewCount}</span>
                  <span class="donut-legend-pct">${intPct}%</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    }
  }

  function renderActiveFilterChips(query, type, range, status) {
    const chipsContainer = document.getElementById('history-active-chips');
    if (!chipsContainer) return;

    const chips = [];
    if (query) {
      chips.push({
        id: 'search', label: `Tìm: "${escapeHtml(query)}"`, onClear: () => {
          const input = document.getElementById('history-search-input');
          if (input) input.value = '';
        }
      });
    }
    if (type !== 'all') {
      chips.push({
        id: 'type', label: `Loại: ${escapeHtml(historyTypeLabel(type))}`, onClear: () => {
          const sel = document.getElementById('filter-activity-type');
          if (sel) sel.value = 'all';
        }
      });
    }
    if (range !== 'all') {
      const rangeLabel = { '7days': '7 ngày qua', '30days': '30 ngày qua', '3months': '3 tháng qua' }[range] || range;
      chips.push({
        id: 'range', label: `Thời gian: ${rangeLabel}`, onClear: () => {
          const sel = document.getElementById('filter-time-range');
          if (sel) sel.value = 'all';
        }
      });
    }
    if (status !== 'all') {
      chips.push({
        id: 'status', label: `Trạng thái: ${escapeHtml(historyStatusLabel(status))}`, onClear: () => {
          const sel = document.getElementById('filter-status');
          if (sel) sel.value = 'all';
        }
      });
    }

    if (!chips.length) {
      chipsContainer.hidden = true;
      chipsContainer.innerHTML = '';
      return;
    }

    chipsContainer.hidden = false;
    chipsContainer.innerHTML = `
      ${chips.map(chip => `
        <span class="history-chip">
          <span>${chip.label}</span>
          <button type="button" class="history-chip-remove" data-clear-chip="${chip.id}" aria-label="Xóa bộ lọc">&times;</button>
        </span>
      `).join('')}
      <button type="button" class="history-chip-clear-all" id="btn-clear-all-history-filters">Xóa tất cả</button>
    `;

    chipsContainer.querySelectorAll('[data-clear-chip]').forEach(btn => {
      btn.onclick = () => {
        const chipId = btn.dataset.clearChip;
        const target = chips.find(c => c.id === chipId);
        if (target) {
          target.onClear();
          historyPage = 1;
          renderHistoryDashboard();
        }
      };
    });

    const clearAllBtn = document.getElementById('btn-clear-all-history-filters');
    if (clearAllBtn) {
      clearAllBtn.onclick = () => {
        const input = document.getElementById('history-search-input'); if (input) input.value = '';
        const selType = document.getElementById('filter-activity-type'); if (selType) selType.value = 'all';
        const selRange = document.getElementById('filter-time-range'); if (selRange) selRange.value = 'all';
        const selStatus = document.getElementById('filter-status'); if (selStatus) selStatus.value = 'all';
        historyPage = 1;
        renderHistoryDashboard();
      };
    }
  }

  function renderCareerReport(activities) {
    const matchActivities = activities.filter(a => a.type === 'match' && a.score != null);
    const bestMatch = matchActivities.reduce((best, a) => Math.max(best, a.score || 0), 0);
    const avgMatch = matchActivities.length ? (matchActivities.reduce((sum, a) => sum + a.score, 0) / matchActivities.length).toFixed(1) : '0.0';

    // 1. Update Match trung bình
    const avgMatchEl = document.getElementById('report-average-match');
    if (avgMatchEl) {
      avgMatchEl.textContent = Number(avgMatch) > 0 ? `${avgMatch}%` : '—';
    }

    // 2. Update Điểm mạnh nổi bật & Phân tích kỹ năng (Matched vs Missing)
    const matchingFreq = {};
    const missingFreq = {};
    (archiveDataCache.analyses || []).forEach(analysis => {
      (analysis.hard_skills_matching || []).forEach(skill => {
        const sk = String(skill || '').trim();
        if (sk) matchingFreq[sk] = (matchingFreq[sk] || 0) + 1;
      });
      (analysis.hard_skills_missing || []).forEach(skill => {
        const sk = String(skill || '').trim();
        if (sk) missingFreq[sk] = (missingFreq[sk] || 0) + 1;
      });
    });

    const sortedMatching = Object.entries(matchingFreq).sort((a, b) => b[1] - a[1]).map(e => e[0]);
    const sortedMissing = Object.entries(missingFreq).sort((a, b) => b[1] - a[1]).map(e => e[0]);

    const topSkillEl = document.getElementById('report-top-skill');
    if (topSkillEl) {
      topSkillEl.textContent = sortedMatching.length ? sortedMatching.slice(0, 2).join(', ') : 'Đang cập nhật';
    }

    // Render Matched Skills Tags
    const matchedTagsEl = document.getElementById('report-matched-skills-tags');
    if (matchedTagsEl) {
      if (sortedMatching.length) {
        matchedTagsEl.innerHTML = sortedMatching.slice(0, 8).map(skill => `
          <span class="skill-tag match">${escapeHtml(skill)}</span>
        `).join('');
      } else {
        matchedTagsEl.innerHTML = '<span class="skill-tag match">Chưa có dữ liệu</span>';
      }
    }

    // Render Missing Skills Tags
    const missingTagsEl = document.getElementById('report-missing-skills-tags');
    if (missingTagsEl) {
      if (sortedMissing.length) {
        missingTagsEl.innerHTML = sortedMissing.slice(0, 8).map(skill => `
          <span class="skill-tag missing">${escapeHtml(skill)}</span>
        `).join('');
      } else {
        missingTagsEl.innerHTML = '<span class="skill-tag match" style="background:#ecfdf5;color:#059669;border-color:#a7f3d0;">Hồ sơ đáp ứng rất tốt</span>';
      }
    }

    // 3. Update Báo cáo hoàn thành
    const completedCount = activities.filter(a => String(a.status || '').replace(/_/g, '').toLowerCase() === 'completed').length;
    const completedEl = document.getElementById('report-completed-count');
    if (completedEl) {
      completedEl.textContent = String(completedCount);
    }

    // 4. Update Điểm sẵn sàng Orb (Dynamic score)
    const readinessScore = Math.min(100, Math.max(0, Math.round(bestMatch > 0 ? bestMatch : (Number(avgMatch) > 0 ? Number(avgMatch) : 70))));
    const orbEl = document.querySelector('.report-score-orb');
    if (orbEl) {
      orbEl.setAttribute('aria-label', `Điểm sẵn sàng ${readinessScore} trên 100`);
      orbEl.innerHTML = `<strong>${readinessScore}</strong><span>/100</span><small>${readinessScore >= 70 ? 'Sẵn sàng ứng tuyển' : 'Cần hoàn thiện thêm'}</small>`;
    }

    // 5. CÁ NHÂN HÓA Lộ trình hành động ưu tiên tiếp theo
    const priorityListEl = document.getElementById('report-priority-actions');
    if (priorityListEl) {
      const topMissing = sortedMissing.slice(0, 2);
      const lastMatchActivity = activities.find(a => a.type === 'match');
      const targetJdName = lastMatchActivity?.jdTitle || 'vị trí mục tiêu';

      const actions = [];
      if (topMissing.length) {
        actions.push({
          num: '01',
          title: `Bổ sung kỹ năng ${topMissing.join(' & ')} vào CV`,
          desc: `Đưa các dự án thực tế hoặc chứng chỉ liên quan đến ${topMissing.join(', ')} vào phần kinh nghiệm để tăng điểm tương thích ATS.`
        });
      } else {
        actions.push({
          num: '01',
          title: 'Đo lường kết quả định lượng trong CV',
          desc: 'Bổ sung các con số, chỉ số tăng trưởng và tác động cụ thể vào từng dự án trong hồ sơ.'
        });
      }

      actions.push({
        num: '02',
        title: `Luyện phỏng vấn STAR cho "${targetJdName}"`,
        desc: `Thực hành trả lời các câu hỏi tình huống STAR bám sát yêu cầu tuyển dụng của ${targetJdName}.`
      });

      actions.push({
        num: '03',
        title: 'Tạo phiên bản CV tối ưu theo JD',
        desc: 'Sử dụng tính năng Tối ưu CV để tinh chỉnh từ khóa chuyên môn và kinh nghiệm bám sát mô tả công việc của nhà tuyển dụng.'
      });

      priorityListEl.innerHTML = actions.map(act => `
        <li>
          <span>${act.num}</span>
          <div>
            <strong>${escapeHtml(act.title)}</strong>
            <p>${escapeHtml(act.desc)}</p>
          </div>
        </li>
      `).join('');
    }

    // 6. Update Danh sách báo cáo gần đây
    const recentListEl = document.getElementById('report-recent-list');
    if (recentListEl) {
      const recentActivities = activities.slice(0, 4);
      if (!recentActivities.length) {
        recentListEl.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;">Chưa có hoạt động nào được ghi nhận.</p>';
      } else {
        recentListEl.innerHTML = recentActivities.map(item => {
          const typeIcon = item.type === 'optimized' ? '✨' : item.type === 'interview' ? '🎙️' : '🎯';
          const scoreText = item.score != null ? `${item.score.toFixed(1)}${item.type === 'match' ? '%' : '/100'}` : '—';
          return `
            <div class="report-recent-item">
              <div class="report-recent-left">
                <div class="report-recent-icon ${item.type}">${typeIcon}</div>
                <div class="report-recent-meta">
                  <strong>${escapeHtml(item.jdTitle)}</strong>
                  <span>${escapeHtml(item.cvTitle)} · ${formatFullDateTimeVi(item.date)}</span>
                </div>
              </div>
              <div class="report-recent-right">
                <span class="report-recent-score">${scoreText}</span>
                <button type="button" class="report-recent-view-btn" data-history-open="${escapeHtml(item.id)}">Xem chi tiết</button>
              </div>
            </div>
          `;
        }).join('');

        recentListEl.querySelectorAll('[data-history-open]').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.dataset.historyOpen;
            if (id) openHistoryModal(id);
          });
        });
      }
    }
  }

  function renderHistoryDashboard() {
    const activities = getHistoryActivities();
    const bestMatch = activities.filter(item => item.type === 'match').reduce((best, item) => Math.max(best, item.score || 0), 0);
    const optimizedTotal = activities.filter(item => item.type === 'optimized').length;
    const interviewTotal = activities.filter(item => item.type === 'interview').length;
    const matchTotal = activities.filter(item => item.type === 'match').length;

    [['archive-match-count', matchTotal],
    ['archive-optimized-count', optimizedTotal],
    ['archive-interview-count', interviewTotal],
    ['archive-best-match', `${bestMatch.toFixed(1)}%`]].forEach(([id, value]) => {
      const element = document.getElementById(id); if (element) element.textContent = String(value);
    });

    renderHistoryCharts(activities);
    renderCareerReport(activities);

    const tableBody = document.getElementById('history-table-body');
    if (!tableBody) return;

    const query = String(document.getElementById('history-search-input')?.value || '').trim().toLocaleLowerCase('vi');
    const type = document.getElementById('filter-activity-type')?.value || 'all';
    const range = document.getElementById('filter-time-range')?.value || 'all';
    const status = document.getElementById('filter-status')?.value || 'all';
    const sort = document.getElementById('history-sort-by')?.value || 'newest';

    renderActiveFilterChips(query, type, range, status);

    const now = Date.now();
    const rangeDays = { '7days': 7, '30days': 30, '3months': 90 }[range];

    const isStatusMatch = (itemStatus, selectedStatus) => {
      if (selectedStatus === 'all') return true;
      const s1 = String(itemStatus || '').replace(/_/g, '').toLowerCase();
      const s2 = String(selectedStatus || '').replace(/_/g, '').toLowerCase();
      return s1 === s2;
    };

    const filtered = activities.filter(item => {
      const haystack = `${item.cvTitle} ${item.jdTitle} ${historyTypeLabel(item.type)}`.toLocaleLowerCase('vi');
      return (!query || haystack.includes(query))
        && (type === 'all' || item.type === type)
        && isStatusMatch(item.status, status)
        && (!rangeDays || now - new Date(item.date).getTime() <= rangeDays * 86400000);
    });

    // Sort items
    filtered.sort((a, b) => {
      if (sort === 'oldest') return new Date(a.date) - new Date(b.date);
      if (sort === 'match_high') return (b.score ?? -1) - (a.score ?? -1);
      if (sort === 'match_low') return (a.score ?? 101) - (b.score ?? 101);
      return new Date(b.date) - new Date(a.date);
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / historyPageSize));
    historyPage = Math.min(historyPage, totalPages);
    const pageItems = filtered.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);

    const empty = document.getElementById('history-empty-state');
    if (empty) empty.hidden = Boolean(pageItems.length);
    if (empty && !pageItems.length) {
      empty.innerHTML = `
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>
        </div>
        <h4 class="empty-state-title">${query || type !== 'all' || range !== 'all' || status !== 'all' ? 'Không tìm thấy kết quả phù hợp bộ lọc' : 'Chưa có lịch sử hoạt động'}</h4>
        <p class="empty-state-sub">${query || type !== 'all' || range !== 'all' || status !== 'all' ? 'Hãy thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt các tiêu chí lọc.' : 'Hãy bắt đầu so khớp CV với JD hoặc luyện tập phỏng vấn STAR để theo dõi sự tiến bộ của bạn.'}</p>
      `;
    }

    tableBody.innerHTML = pageItems.map(item => {
      const typeBadgeClass = item.type === 'optimized' ? 'is-optimized' : item.type === 'interview' ? 'is-interview' : 'is-match';
      const statusClass = isStatusMatch(item.status, 'completed') ? 'is-completed' : isStatusMatch(item.status, 'failed') ? 'is-failed' : 'is-inprogress';
      const scoreDisplay = item.score == null ? '—' : `${item.score.toFixed(1)}${item.type === 'match' ? '%' : '/100'}`;

      return `
        <tr data-history-id="${escapeHtml(item.id)}">
          <td><span class="table-type-badge ${typeBadgeClass}">${escapeHtml(historyTypeLabel(item.type))}</span></td>
          <td>
            <div style="display:flex;flex-direction:column;gap:2px;">
              <strong style="color:var(--text-primary);font-size:13.5px;max-width:210px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(item.cvTitle)}">${escapeHtml(item.cvTitle)}</strong>
              ${item.type === 'optimized' ? '<span style="font-size:11px;color:#ea580c;font-weight:600;">✨ Đã tối ưu theo JD</span>' : ''}
            </div>
          </td>
          <td>
            <div style="display:flex;flex-direction:column;gap:2px;">
              <strong style="color:var(--text-primary);font-size:13.5px;max-width:230px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(item.jdTitle)}">${escapeHtml(item.jdTitle)}</strong>
            </div>
          </td>
          <td class="text-center"><strong style="color:${item.score >= 70 ? '#059669' : item.score >= 50 ? '#d97706' : '#64748b'};font-size:14px;">${scoreDisplay}</strong></td>
          <td class="text-center"><span class="status-pill ${statusClass}"><span class="status-dot"></span> ${escapeHtml(historyStatusLabel(item.status))}</span></td>
          <td class="text-center" style="color:var(--text-secondary);font-size:12.5px;white-space:nowrap;">${formatFullDateTimeVi(item.date)}</td>
          <td class="text-center"><button type="button" class="history-action-btn" data-history-open="${escapeHtml(item.id)}">Xem chi tiết</button></td>
        </tr>
      `;
    }).join('');

    const mobile = document.getElementById('history-mobile-list');
    if (mobile) {
      mobile.innerHTML = pageItems.map(item => `
        <article class="mobile-history-card" data-history-id="${escapeHtml(item.id)}" data-history-open="${escapeHtml(item.id)}">
          <div class="mobile-card-top">
            <span class="table-type-badge ${item.type === 'optimized' ? 'is-optimized' : item.type === 'interview' ? 'is-interview' : 'is-match'}">${escapeHtml(historyTypeLabel(item.type))}</span>
            <span class="mobile-card-date">${formatFullDateTimeVi(item.date)}</span>
          </div>
          <div class="mobile-card-body">
            <div class="mobile-card-title">${escapeHtml(item.jdTitle)}</div>
            <div class="mobile-card-sub">${escapeHtml(item.cvTitle)}</div>
          </div>
          <div class="mobile-card-bottom">
            <div class="mobile-card-badges">
              <strong>Điểm: ${item.score == null ? '—' : `${item.score.toFixed(1)}${item.type === 'match' ? '%' : ''}`}</strong>
              <span class="status-pill ${isStatusMatch(item.status, 'completed') ? 'is-completed' : 'is-inprogress'}"><span class="status-dot"></span> ${escapeHtml(historyStatusLabel(item.status))}</span>
            </div>
            <span class="mobile-chevron">&rsaquo;</span>
          </div>
        </article>
      `).join('');
    }

    const count = document.getElementById('archive-result-count');
    if (count) count.textContent = `${filtered.length} kết quả`;

    const info = document.getElementById('pagination-info');
    if (info) info.textContent = filtered.length ? `Hiển thị ${(historyPage - 1) * historyPageSize + 1}–${Math.min(historyPage * historyPageSize, filtered.length)} / ${filtered.length} kết quả` : '0 kết quả';

    const pages = document.getElementById('pagination-pages');
    if (pages) {
      pages.innerHTML = Array.from({ length: totalPages }, (_, index) => `
        <button type="button" class="pagination-btn ${historyPage === index + 1 ? 'active' : ''}" data-history-page="${index + 1}">${index + 1}</button>
      `).join('');
    }

    const prev = document.getElementById('pagination-prev-btn');
    if (prev) prev.disabled = historyPage <= 1;

    const next = document.getElementById('pagination-next-btn');
    if (next) next.disabled = historyPage >= totalPages;

    bindHistoryDashboard();
  }

  function openHistoryModal(id) {
    const item = getHistoryActivities().find(activity => activity.id === id);
    if (!item) return;

    const modal = document.getElementById('history-detail-modal');
    const overlay = document.getElementById('history-modal-overlay');
    if (!modal) return;

    const badgeEl = document.getElementById('drawer-activity-badge');
    if (badgeEl) {
      badgeEl.textContent = historyTypeLabel(item.type);
      badgeEl.className = `drawer-type-badge ${item.type === 'optimized' ? 'is-optimized' : item.type === 'interview' ? 'is-interview' : 'is-match'}`;
    }

    const statusBadge = document.getElementById('modal-status-badge');
    if (statusBadge) {
      const isComp = String(item.status || '').replace(/_/g, '').toLowerCase() === 'completed';
      statusBadge.className = `status-pill ${isComp ? 'is-completed' : 'is-inprogress'}`;
      statusBadge.innerHTML = `<span class="status-dot"></span> ${escapeHtml(historyStatusLabel(item.status))}`;
    }

    const titleEl = document.getElementById('drawer-item-title');
    if (titleEl) titleEl.textContent = item.jdTitle;

    const bodyEl = document.getElementById('drawer-body-content');
    const footerEl = document.getElementById('drawer-footer-actions');

    if (bodyEl) {
      if (item.type === 'optimized' && item.variant) {
        const variant = item.variant;
        const revCount = variant.revisions?.length || variant.revision_no || 1;
        const suggestions = variant.content?._suggestions || [];
        const confirmedClaims = variant.content?._confirmed_claims || [];
        const templateName = variant.template?.name || variant.content?.template_name || 'classic';

        bodyEl.innerHTML = `
          <div class="modal-highlight-card" style="background:linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);border-color:#ddd6fe;">
            <div class="modal-highlight-meta">
              <small style="color:#7c3aed;">Phiên bản CV đã tối ưu</small>
              <span>Trạng thái: <strong>${variant.status === 'PUBLISHED' ? 'Đã xuất bản (Published)' : 'Đã kiểm định ATS'}</strong></span>
            </div>
            <div class="modal-highlight-score" style="color:#7c3aed;">
              <strong style="font-size:24px;">Lần ${revCount}</strong>
              <span style="font-size:13px;">revision</span>
            </div>
          </div>

          <div class="modal-info-grid">
            <div class="modal-info-tile">
              <label>Tên bản CV</label>
              <p>${escapeHtml(variant.title || item.cvTitle)}</p>
            </div>
            <div class="modal-info-tile">
              <label>Mẫu trình bày (Template)</label>
              <p>${escapeHtml(templateName.toUpperCase())}</p>
            </div>
          </div>

          <div class="modal-section-card">
            <h4>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Thay đổi đã xác thực (${confirmedClaims.length || suggestions.length})
            </h4>
            <div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">
              ${confirmedClaims.length ? `
                <ul style="margin:0;padding-left:18px;">
                  ${confirmedClaims.map(claim => `<li>${escapeHtml(claim)}</li>`).join('')}
                </ul>
              ` : `
                <p style="margin:0;">Bản CV đã được tinh chỉnh để tối ưu từ khóa và độ tương thích với JD <strong>${escapeHtml(item.jdTitle)}</strong>.</p>
              `}
            </div>
          </div>
        `;
      } else if (item.type === 'interview') {
        const session = item.session || {};
        bodyEl.innerHTML = `
          <div class="modal-highlight-card">
            <div class="modal-highlight-meta">
              <small>Kết quả phỏng vấn STAR</small>
              <span>Vị trí: ${escapeHtml(item.jdTitle)}</span>
            </div>
            <div class="modal-highlight-score">
              <strong>${item.score != null ? item.score.toFixed(1) : '—'}</strong>
              <span>/ 100</span>
            </div>
          </div>
          <div class="modal-info-grid">
            <div class="modal-info-tile">
              <label>Hồ sơ CV</label>
              <p>${escapeHtml(item.cvTitle)}</p>
            </div>
            <div class="modal-info-tile">
              <label>Thời gian hoàn thành</label>
              <p>${formatFullDateTimeVi(item.date)}</p>
            </div>
          </div>
          <div class="modal-section-card" id="modal-interview-report-box">
            <h4><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg> Chi tiết đánh giá câu hỏi</h4>
            <p style="color:var(--text-secondary);font-size:13px;margin:0;">Tiến độ: ${session.current_question_index || 0}/${session.total_questions || 5} câu hỏi đã thực hiện.</p>
          </div>
        `;
      } else {
        const analysis = item.analysis || {};
        const matched = analysis.hard_skills_matching || [];
        const missing = analysis.hard_skills_missing || [];
        const actions = analysis.priority_actions || [];

        bodyEl.innerHTML = `
          <div class="modal-highlight-card">
            <div class="modal-highlight-meta">
              <small>Mức độ phù hợp với JD</small>
              <span>Vị trí: ${escapeHtml(item.jdTitle)}</span>
            </div>
            <div class="modal-highlight-score">
              <strong>${item.score != null ? item.score.toFixed(1) : '0.0'}</strong>
              <span>%</span>
            </div>
          </div>

          <div class="modal-info-grid">
            <div class="modal-info-tile">
              <label>CV sử dụng</label>
              <p>${escapeHtml(item.cvTitle)}</p>
            </div>
            <div class="modal-info-tile">
              <label>Thời gian đánh giá</label>
              <p>${formatFullDateTimeVi(item.date)}</p>
            </div>
          </div>

          <div class="modal-section-card">
            <h4>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Kỹ năng phù hợp (${matched.length})
            </h4>
            <div class="modal-skill-tags">
              ${matched.length ? matched.map(sk => `<span class="modal-skill-tag is-match">${escapeHtml(sk)}</span>`).join('') : '<p style="color:var(--text-secondary);font-size:12.5px;margin:0;">Chưa ghi nhận kỹ năng phù hợp cụ thể.</p>'}
            </div>
          </div>

          <div class="modal-section-card">
            <h4>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Kỹ năng cần bổ sung (${missing.length})
            </h4>
            <div class="modal-skill-tags">
              ${missing.length ? missing.map(sk => `<span class="modal-skill-tag is-missing">${escapeHtml(sk)}</span>`).join('') : '<p style="color:#059669;font-size:12.5px;margin:0;">🎉 Bạn đã đáp ứng đầy đủ các kỹ năng cốt lõi trong JD này!</p>'}
            </div>
          </div>

          <div class="modal-section-card">
            <h4>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Khuyến nghị hành động tiếp theo
            </h4>
            <ol class="modal-action-list">
              ${actions.length ? actions.map((act, idx) => `
                <li>
                  <span class="modal-action-num">0${idx + 1}</span>
                  <div>${escapeHtml(typeof act === 'string' ? act : (act.action || act.gap || ''))}</div>
                </li>
              `).join('') : `
                <li><span class="modal-action-num">01</span><div>Bổ sung các dự án thực tế có sử dụng các công nghệ mục tiêu.</div></li>
                <li><span class="modal-action-num">02</span><div>Luyện tập trả lời phỏng vấn theo phương pháp STAR cho vị trí này.</div></li>
              `}
            </ol>
          </div>
        `;
      }

      bodyEl.scrollTop = 0;
    }

    if (footerEl) {
      footerEl.innerHTML = `
        <button type="button" class="modal-footer-btn btn-secondary" id="btn-close-modal-action">Đóng</button>
      `;
      document.getElementById('btn-close-modal-action')?.addEventListener('click', closeHistoryModal);
    }

    document.body.style.overflow = 'hidden';
    document.body.classList.add('history-modal-open');
    document.getElementById('view-history')?.classList.add('history-modal-open');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    if (overlay) {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
    }
  }

  function closeHistoryModal() {
    const modal = document.getElementById('history-detail-modal');
    const overlay = document.getElementById('history-modal-overlay');
    document.body.style.overflow = '';
    document.body.classList.remove('history-modal-open');
    document.getElementById('view-history')?.classList.remove('history-modal-open');
    modal?.classList.remove('is-open');
    modal?.setAttribute('aria-hidden', 'true');
    overlay?.classList.remove('is-open');
    overlay?.setAttribute('aria-hidden', 'true');
  }

  function exportCareerReport() {
    const activities = getHistoryActivities();
    const matchActivities = activities.filter(a => a.type === 'match');
    const bestMatch = matchActivities.reduce((best, a) => Math.max(best, a.score || 0), 0);
    const user = ApiClient.getUser();
    const userName = user?.full_name || user?.name || user?.email || 'Ứng viên';

    // Mở trực tiếp dưới dạng một TAB MỚI trên trình duyệt
    const printWin = window.open('', '_blank');
    if (!printWin) {
      window.print();
      return;
    }

    const now = new Date();
    const todayStr = now.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });

    // Trích xuất kỹ năng
    const matchingFreq = {};
    const missingFreq = {};
    (archiveDataCache.analyses || []).forEach(analysis => {
      (analysis.hard_skills_matching || []).forEach(skill => {
        const sk = String(skill || '').trim();
        if (sk) matchingFreq[sk] = (matchingFreq[sk] || 0) + 1;
      });
      (analysis.hard_skills_missing || []).forEach(skill => {
        const sk = String(skill || '').trim();
        if (sk) missingFreq[sk] = (missingFreq[sk] || 0) + 1;
      });
    });

    const topMatching = Object.entries(matchingFreq).sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 8);
    const topMissing = Object.entries(missingFreq).sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 8);

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Báo Cáo Tổng Quan Sự Nghiệp - ${escapeHtml(userName)}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #0f172a;
            background: #f1f5f9;
            margin: 0;
            padding: 28px 16px;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .toolbar {
            max-width: 860px;
            margin: 0 auto 16px auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .toolbar-actions { display: flex; gap: 10px; }
          .btn-print {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #059669;
            color: #ffffff;
            border: none;
            padding: 10px 22px;
            border-radius: 9px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);
            transition: all 0.15s ease;
          }
          .btn-print:hover { background: #047857; transform: translateY(-1px); }
          .btn-close {
            background: #ffffff;
            color: #475569;
            border: 1px solid #cbd5e1;
            padding: 10px 16px;
            border-radius: 9px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          }
          .btn-close:hover { background: #f8fafc; color: #0f172a; }
          .report-sheet {
            max-width: 860px;
            margin: 0 auto;
            background: #ffffff;
            padding: 44px 48px;
            border-radius: 16px;
            box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.08);
            border: 1px solid #e2e8f0;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #10b981;
            padding-bottom: 20px;
            margin-bottom: 24px;
          }
          .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
          .brand-logo {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-weight: 800;
            font-size: 18px;
          }
          .brand-name { font-size: 16px; font-weight: 800; color: #047857; letter-spacing: -0.02em; }
          .header h1 { margin: 6px 0 0 0; font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
          .header-meta { text-align: right; font-size: 12.5px; color: #64748b; }
          .header-meta strong { color: #0f172a; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 26px; }
          .kpi-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px 12px;
            text-align: center;
          }
          .kpi-card strong { display: block; font-size: 24px; font-weight: 800; color: #059669; margin-bottom: 2px; }
          .kpi-card span { font-size: 11.5px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
          .section { margin-bottom: 24px; page-break-inside: avoid; }
          .section h2 {
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
            border-left: 3.5px solid #059669;
            padding-left: 10px;
            margin: 0 0 12px 0;
            text-transform: uppercase;
            letter-spacing: 0.03em;
          }
          .skills-box {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            background: #f8fafc;
            padding: 16px;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
          }
          .skills-column h3 { font-size: 12.5px; margin: 0 0 8px 0; font-weight: 700; }
          .skills-column.matched h3 { color: #059669; }
          .skills-column.missing h3 { color: #c2410c; }
          .tags { display: flex; flex-wrap: wrap; gap: 6px; }
          .tag { font-size: 11.5px; font-weight: 600; padding: 3px 8px; border-radius: 5px; }
          .tag.matched { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
          .tag.missing { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12.5px; }
          th, td { border: 1px solid #e2e8f0; padding: 9px 12px; text-align: left; vertical-align: middle; }
          th { background: #f8fafc; font-weight: 700; color: #475569; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.03em; }
          tr { page-break-inside: avoid; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 5px; font-size: 11px; font-weight: 700; }
          .badge.match { background: #ecfdf5; color: #059669; }
          .badge.optimized { background: #f3efff; color: #7c3aed; }
          .badge.interview { background: #edf5ff; color: #2563eb; }
          .footer {
            margin-top: 32px;
            border-top: 1px solid #e2e8f0;
            padding-top: 14px;
            font-size: 11.5px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          @media print {
            body { background: #ffffff !important; padding: 0 !important; }
            .toolbar { display: none !important; }
            .report-sheet { border: none !important; box-shadow: none !important; padding: 20px 0 !important; max-width: 100% !important; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar no-print">
          <div style="font-size:13px;color:#64748b;">Xem trước tài liệu báo cáo sự nghiệp</div>
          <div class="toolbar-actions">
            <button type="button" class="btn-close" onclick="window.close()">✕ Đóng tab</button>
            <button type="button" class="btn-print" onclick="window.print()">🖨️ In / Lưu file PDF</button>
          </div>
        </div>

        <div class="report-sheet">
          <div class="header">
            <div>
              <div class="brand">
                <div class="brand-logo">A</div>
                <span class="brand-name">Career Assistant AI</span>
              </div>
              <h1>BÁO CÁO TỔNG QUAN NĂNG LỰC SỰ NGHIỆP</h1>
            </div>
            <div class="header-meta">
              <p style="margin:0 0 4px 0;">Ứng viên: <strong>${escapeHtml(userName)}</strong></p>
              <p style="margin:0 0 4px 0;">Ngày xuất: <strong>${todayStr} (${timeStr} GMT+7)</strong></p>
              <p style="margin:0;">Trạng thái hồ sơ: <strong style="color:#059669;">Sẵn sàng ứng tuyển</strong></p>
            </div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <strong>${matchActivities.length}</strong>
              <span>Lần so khớp CV</span>
            </div>
            <div class="kpi-card">
              <strong>${activities.filter(a => a.type === 'optimized').length}</strong>
              <span>Lần tối ưu CV</span>
            </div>
            <div class="kpi-card">
              <strong>${activities.filter(a => a.type === 'interview').length}</strong>
              <span>Phiên phỏng vấn</span>
            </div>
            <div class="kpi-card">
              <strong>${bestMatch.toFixed(1)}%</strong>
              <span>Match cao nhất</span>
            </div>
          </div>

          <div class="section">
            <h2>Phân tích độ phủ kỹ năng</h2>
            <div class="skills-box">
              <div class="skills-column matched">
                <h3>✓ Kỹ năng phù hợp nổi bật</h3>
                <div class="tags">
                  ${topMatching.length ? topMatching.map(sk => `<span class="tag matched">${escapeHtml(sk)}</span>`).join('') : '<span style="color:#64748b;font-size:12px;">Đang cập nhật</span>'}
                </div>
              </div>
              <div class="skills-column missing">
                <h3>! Kỹ năng cần bổ sung / cải thiện</h3>
                <div class="tags">
                  ${topMissing.length ? topMissing.map(sk => `<span class="tag missing">${escapeHtml(sk)}</span>`).join('') : '<span style="color:#059669;font-size:12px;">Hồ sơ đáp ứng rất tốt</span>'}
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Lịch sử hoạt động gần nhất</h2>
            <table>
              <thead>
                <tr>
                  <th style="width:130px;">Hoạt động</th>
                  <th>Hồ sơ CV</th>
                  <th>Công việc / JD</th>
                  <th style="width:90px;text-align:center;">Kết quả</th>
                  <th style="width:140px;">Thời gian (GMT+7)</th>
                </tr>
              </thead>
              <tbody>
                ${activities.slice(0, 15).map(act => `
                  <tr>
                    <td><span class="badge ${act.type}">${escapeHtml(historyTypeLabel(act.type))}</span></td>
                    <td><strong style="color:#0f172a;">${escapeHtml(act.cvTitle)}</strong></td>
                    <td>${escapeHtml(act.jdTitle)}</td>
                    <td style="text-align:center;"><strong style="color:${act.score >= 70 ? '#059669' : '#0f172a'};">${act.score != null ? `${act.score.toFixed(1)}${act.type === 'match' ? '%' : ''}` : '—'}</strong></td>
                    <td style="color:#64748b;">${formatFullDateTimeVi(act.date)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <span>Báo cáo được trích xuất tự động bởi AI Career Assistant · https://localhost:3000</span>
            <span>Múi giờ: GMT+7 (Asia/Ho_Chi_Minh)</span>
          </div>
        </div>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  function bindHistoryDashboard() {
    if (historyUiBound) return;
    historyUiBound = true;

    ['history-search-input', 'filter-activity-type', 'filter-time-range', 'filter-status', 'history-sort-by'].forEach(id => {
      document.getElementById(id)?.addEventListener(id === 'history-search-input' ? 'input' : 'change', () => {
        historyPage = 1;
        renderHistoryDashboard();
      });
    });

    document.getElementById('pagination-size-select')?.addEventListener('change', event => {
      historyPageSize = Number(event.target.value) || 10;
      historyPage = 1;
      renderHistoryDashboard();
    });

    document.getElementById('pagination-prev-btn')?.addEventListener('click', () => {
      if (historyPage > 1) {
        historyPage--;
        renderHistoryDashboard();
      }
    });

    document.getElementById('pagination-next-btn')?.addEventListener('click', () => {
      historyPage++;
      renderHistoryDashboard();
    });

    document.getElementById('pagination-pages')?.addEventListener('click', event => {
      const page = Number(event.target.closest('[data-history-page]')?.dataset.historyPage);
      if (page) {
        historyPage = page;
        renderHistoryDashboard();
      }
    });

    document.getElementById('history-data-table')?.addEventListener('click', event => {
      const id = event.target.closest('[data-history-open]')?.dataset.historyOpen;
      if (id) openHistoryModal(id);
    });

    document.getElementById('history-mobile-list')?.addEventListener('click', event => {
      const id = event.target.closest('[data-history-open]')?.dataset.historyOpen;
      if (id) openHistoryModal(id);
    });

    // Modal Close handlers
    document.getElementById('btn-close-history-modal')?.addEventListener('click', closeHistoryModal);
    document.getElementById('history-modal-overlay')?.addEventListener('click', closeHistoryModal);
    document.getElementById('btn-close-history-drawer')?.addEventListener('click', closeHistoryModal);
    document.getElementById('history-drawer-overlay')?.addEventListener('click', closeHistoryModal);

    // Refresh button ("Cập nhật hôm nay")
    const refreshBtn = document.getElementById('history-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('is-loading');
        const refreshText = document.getElementById('history-refresh-text');
        if (refreshText) refreshText.textContent = 'Đang tải lại…';

        try {
          await loadMissionArchive();
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          if (refreshText) refreshText.textContent = `Cập nhật ${timeStr}`;
          showToast('Đã làm mới dữ liệu lịch sử thành công!', 'success');
        } catch (err) {
          if (refreshText) refreshText.textContent = 'Cập nhật hôm nay';
          showToast(`Lỗi làm mới: ${err.message}`, 'error');
        } finally {
          refreshBtn.classList.remove('is-loading');
        }
      });
    }

    // Export button ("Xuất báo cáo")
    const exportBtn = document.getElementById('history-export-report-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportCareerReport);
    }
    const legacyExportBtn = document.querySelector('.history-export-btn');
    if (legacyExportBtn && legacyExportBtn !== exportBtn) {
      legacyExportBtn.addEventListener('click', exportCareerReport);
    }

    // Metric Tabs (Match CV vs Phỏng vấn)
    document.querySelectorAll('.metric-switch-btn').forEach(button => {
      button.addEventListener('click', () => {
        historyMetric = button.dataset.metric || 'match';
        document.querySelectorAll('.metric-switch-btn').forEach(item => item.classList.toggle('active', item === button));
        renderHistoryDashboard();
      });
    });

    // Column Sort Listeners (Kết quả & Ngày)
    document.getElementById('col-sort-result')?.addEventListener('click', () => {
      const sel = document.getElementById('history-sort-by');
      if (sel) {
        sel.value = sel.value === 'match_high' ? 'match_low' : 'match_high';
        historyPage = 1;
        renderHistoryDashboard();
      }
    });

    document.getElementById('col-sort-date')?.addEventListener('click', () => {
      const sel = document.getElementById('history-sort-by');
      if (sel) {
        sel.value = sel.value === 'newest' ? 'oldest' : 'newest';
        historyPage = 1;
        renderHistoryDashboard();
      }
    });
  }

  // Expose global methods for React components and external callers
  window.loadMissionArchive = loadMissionArchive;
  window.renderHistoryDashboard = renderHistoryDashboard;
  window.openHistoryModal = openHistoryModal;
  window.closeHistoryModal = closeHistoryModal;
  window.exportCareerReport = exportCareerReport;

  // Global Event Delegation for modal open/close (works reliably even after React re-renders)
  document.addEventListener('click', event => {
    const openBtn = event.target.closest('[data-history-open]');
    if (openBtn) {
      event.preventDefault();
      event.stopPropagation();
      const id = openBtn.dataset.historyOpen;
      if (id) openHistoryModal(id);
      return;
    }

    const closeBtn = event.target.closest('#btn-close-history-modal, #btn-close-modal-action, #history-modal-overlay, #btn-close-history-drawer, #history-drawer-overlay');
    if (closeBtn) {
      event.preventDefault();
      closeHistoryModal();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeHistoryModal();
    }
  });

  function bindHistoryDashboard() {
    if (historyUiBound) return;
    historyUiBound = true;
    ['history-search-input', 'filter-activity-type', 'filter-time-range', 'filter-status', 'history-sort-by'].forEach(id => {
      document.getElementById(id)?.addEventListener(id === 'history-search-input' ? 'input' : 'change', () => {
        historyPage = 1;
        renderHistoryDashboard();
      });
    });
    document.getElementById('pagination-size-select')?.addEventListener('change', event => {
      historyPageSize = Number(event.target.value) || 10;
      historyPage = 1;
      renderHistoryDashboard();
    });
    document.getElementById('pagination-prev-btn')?.addEventListener('click', () => {
      historyPage--;
      renderHistoryDashboard();
    });
    document.getElementById('pagination-next-btn')?.addEventListener('click', () => {
      historyPage++;
      renderHistoryDashboard();
    });
    document.getElementById('pagination-pages')?.addEventListener('click', event => {
      const page = Number(event.target.closest('[data-history-page]')?.dataset.historyPage);
      if (page) {
        historyPage = page;
        renderHistoryDashboard();
      }
    });
    document.querySelectorAll('.metric-switch-btn').forEach(button => {
      button.addEventListener('click', () => {
        historyMetric = button.dataset.metric || 'match';
        document.querySelectorAll('.metric-switch-btn').forEach(item => item.classList.toggle('active', item === button));
        renderHistoryDashboard();
      });
    });
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
      resumeInterviewSession(resumeBtn.dataset.sessionId);
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
        // Chỉ dùng thuộc tính `hidden` — CSS `[hidden]` / `.nav-link[hidden]` đã ẩn sẵn.
        // Không ghi inline `display:none !important` vào đây: các node này do React
        // (AppHeader) render, và inline !important thì không stylesheet nào gỡ được
        // nữa, khiến mục menu bị ẩn vĩnh viễn.
        element.hidden = !visibleNavItems.has(id);
        element.style.removeProperty('display');
      }
    });

    // Update Header Actor Badge
    const actorBadge = document.getElementById('header-actor-badge');
    if (actorBadge) {
      actorBadge.className = 'actor-badge';
      if (!user) {
        actorBadge.hidden = true;
        actorBadge.style.setProperty('display', 'none');
      } else {
        actorBadge.hidden = false;
        actorBadge.style.removeProperty('display');
        if (user.role === 'student') {
          actorBadge.textContent = 'Sinh viên';
          actorBadge.classList.add('actor-badge-student');
        } else if (user.role === 'counselor') {
          actorBadge.textContent = 'Cố vấn viên';
          actorBadge.classList.add('actor-badge-counselor');
        } else if (user.role === 'enterprise') {
          actorBadge.textContent = 'Doanh nghiệp';
          actorBadge.classList.add('actor-badge-enterprise');
        } else if (user.role === 'admin') {
          actorBadge.textContent = 'Quản trị viên';
          actorBadge.classList.add('actor-badge-admin');
        } else {
          actorBadge.textContent = user.role.toUpperCase();
        }
      }
    }

    // Không còn xử lý bottom-nav: dưới 1200px drawer trong AppHeader là nav duy
    // nhất, phần tử #candidate-bottom-nav đã được xoá khỏi app/page.tsx.

    // Enterprise create job button in header
    const createJobBtn = document.getElementById('btn-enterprise-create-job');
    if (createJobBtn) {
      const isEnterprise = user?.role === 'enterprise';
      createJobBtn.hidden = !isEnterprise;
      if (!isEnterprise) {
        createJobBtn.style.setProperty('display', 'none', 'important');
      } else {
        createJobBtn.style.removeProperty('display');
      }
    }

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

    // Nova is a global entry point. Role access is checked only when a user
    // sends a message, so a role change must never leave a stale inline
    // `display: none !important` on the launcher.
    const companion = document.getElementById('ai-companion');
    const companionPanel = document.getElementById('ai-companion-chat');
    if (companion && (!companionPanel || companionPanel.hidden)) {
      companion.hidden = false;
      companion.style.removeProperty('display');
    }
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
      switchToRoleHome();
      if (userNameEl) userNameEl.textContent = user.full_name || user.email;
      if (userRoleEl) userRoleEl.textContent = `Vai trò: ${user.role.toUpperCase()}`;
      if (!canAccessView(currentViewName, user)) {
        const roleHomeView = getRoleHomeView(user);
        switchView(roleHomeView);
      }
      refreshDashboardOverview();
      if (navAdmin) {
        if (user.role === 'admin') {
          navAdmin?.classList.add('visible');
        } else {
          navAdmin?.classList.remove('visible');
        }
      }
      if (authContainer && authContainer.dataset.reactManaged !== 'true') {
        let menuItemsHtml = '';
        let roleBadgeText = 'Sinh viên';
        let roleBadgeClass = 'badge-student';

        if (user.role === 'counselor') {
          roleBadgeText = 'Cố vấn viên';
          roleBadgeClass = 'badge-counselor';
          menuItemsHtml = `
            <button type="button" data-account-action="counselor-profile">Hồ sơ Cố vấn</button>
            <button type="button" data-account-action="counselor-settings">Cài đặt</button>
            <button type="button" data-account-action="counselor-help">Trợ giúp</button>
          `;
        } else if (user.role === 'enterprise') {
          roleBadgeText = 'Doanh nghiệp';
          roleBadgeClass = 'badge-enterprise';
          menuItemsHtml = `
            <button type="button" data-account-action="enterprise-account">Tài khoản tuyển dụng</button>
          `;
        } else if (user.role === 'admin') {
          roleBadgeText = 'Quản trị viên';
          roleBadgeClass = 'badge-admin';
          menuItemsHtml = `
            <button type="button" data-account-action="admin-portal">Quản trị hệ thống</button>
          `;
        } else {
          // student / default
          roleBadgeText = 'Sinh viên';
          roleBadgeClass = 'badge-student';
          menuItemsHtml = `
            <button type="button" data-account-action="student-profile">Hồ sơ cá nhân</button>
            <button type="button" data-account-action="student-settings">Cài đặt bảo mật</button>
          `;
        }

        const initial = escapeHtml((user.full_name || user.email || 'U').trim().charAt(0).toUpperCase());
        authContainer.innerHTML = `
          <div class="candidate-account-menu" id="candidate-account-menu">
            <button class="candidate-avatar-trigger" id="candidate-avatar-trigger" aria-haspopup="true" aria-expanded="false" aria-label="Menu tài khoản">
              <span class="candidate-avatar-initial">${initial}</span>
              <span class="candidate-avatar-chevron">⌄</span>
            </button>
            <div class="candidate-account-dropdown" id="candidate-account-dropdown">
              <div class="candidate-account-header">
                <div class="candidate-account-name">${escapeHtml(user.full_name || user.email)}</div>
                <div class="candidate-account-email">${escapeHtml(user.email)}</div>
                <span class="candidate-account-role-badge ${roleBadgeClass}">${roleBadgeText}</span>
              </div>
              <div class="candidate-account-actions">
                ${menuItemsHtml}
              </div>
              <div class="candidate-account-divider"></div>
              <button type="button" class="candidate-logout" id="btn-logout">Đăng xuất</button>
            </div>
          </div>
        `;

        const accountMenu = document.getElementById('candidate-account-menu');
        const accountTrigger = document.getElementById('candidate-avatar-trigger');
        accountTrigger?.addEventListener('click', (e) => {
          e.stopPropagation();
          const open = accountMenu?.classList.toggle('open');
          accountTrigger.setAttribute('aria-expanded', String(Boolean(open)));
        });

        document.addEventListener('click', (e) => {
          if (!accountMenu?.contains(e.target)) {
            accountMenu?.classList.remove('open');
            accountTrigger?.setAttribute('aria-expanded', 'false');
          }
        });

        accountMenu?.querySelectorAll('[data-account-action]').forEach(button => button?.addEventListener('click', () => {
          accountMenu?.classList.remove('open');
          accountTrigger?.setAttribute('aria-expanded', 'false');
          const action = button.dataset.accountAction;
          if (action === 'student-profile') {
            switchView('profile');
          } else if (action === 'student-settings') {
            switchView('profile');
            // Trigger student settings tab
            document.querySelector('.profile-tab-btn:last-child')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          } else if (action === 'counselor-profile') {
            switchView('counselor');
            window.dispatchEvent(new CustomEvent('navigate-counselor', { detail: 'profile' }));
          } else if (action === 'counselor-settings') {
            switchView('counselor');
            window.dispatchEvent(new CustomEvent('navigate-counselor', { detail: 'settings' }));
          } else if (action === 'counselor-help') {
            showToast('Trung tâm trợ giúp Cố vấn: Vui lòng liên hệ ban quản trị tại support@career-assistant.edu.vn', 'info');
          } else if (action === 'enterprise-account') {
            switchView('enterprise');
            window.dispatchEvent(new CustomEvent('navigate-enterprise', { detail: 'account' }));
          } else if (action === 'admin-portal') {
            switchView('admin');
          }
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
      if (authContainer && authContainer.dataset.reactManaged !== 'true') {
        authContainer.innerHTML = `<button class="btn-login" id="btn-login">Đăng nhập</button>`;
        document.getElementById('btn-login')?.addEventListener('click', openAuthModal);
      }
    }
    if (typeof window !== 'undefined') {
      window.updateLoginGates?.();
      window.updateP1UI?.();
      document.dispatchEvent(new CustomEvent('auth:changed', { detail: { user } }));
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

  // Khởi tạo view ban đầu theo URL và session cache
  const initialResolvedView = detectInitialView();
  currentViewName = initialResolvedView;
  if (canAccessView(initialResolvedView)) {
    if (initialResolvedView === 'job-detail') {
      switchView(initialResolvedView, { skipUrlSync: true, skipSweep: true });
      void restoreJobDetailFromRoute();
    } else {
      switchView(initialResolvedView, { skipUrlSync: true, skipSweep: true });
    }
  } else {
    switchToRoleHome();
  }
  checkUserSession();

  // Khôi phục phiên từ cookie HttpOnly; dữ liệu user trong localStorage chỉ là cache hiển thị.
  ApiClient.getMe().then(() => {
    checkUserSession();
  }).catch((err) => {
    if (err && err.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_info');
      // Phiên đã hết hạn: khách đang đứng trong portal bị đưa về /login dùng
      // chung (kèm ?next= để quay lại đúng chỗ sau khi đăng nhập lại).
      const expiredPath = window.location.pathname.toLowerCase();
      const isPortalPath = ['/student', '/counselor', '/enterprise', '/admin']
        .some(prefix => expiredPath === prefix || expiredPath.startsWith(`${prefix}/`));
      if (isPortalPath) {
        window.location.replace(buildLoginRedirectUrl());
        return;
      }
    }
    checkUserSession();
  });

  /* ── Auth Modal Logic ── */
  // /login là bề mặt đăng nhập DUY NHẤT. Đăng ký công khai tách riêng qua
  // /register · /register/student · /register/enterprise (React surface), nên
  // modal này chỉ còn chế độ đăng nhập — không chọn vai trò, không tự cấp quyền.
  const authOverlay = document.getElementById('modal-overlay');
  const authClose = document.getElementById('modal-close');
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

  let currentResetStep = 1;
  let resetCountdownInterval = null;
  let googleIdentityInitialized = false;

  function openAuthModal() {
    // AuthModal (React) là bề mặt đăng nhập/đăng ký DÙNG NHẤT với tab
    // Đăng nhập | Đăng ký. Khi nó đã mount, mở TẠI CHỖ qua sự kiện cầu nối —
    // giữ nguyên điểm đến dự kiến (?next=) mà không cần reload trang.
    if (typeof document !== 'undefined' && document.body.hasAttribute('data-authx-mounted')) {
      const next = window.location.pathname + (window.location.search || '');
      document.dispatchEvent(new CustomEvent('authx:open', { detail: { next } }));
      return;
    }
    // Fallback khi React chưa kịp mount: dẫn về trang /login dùng chung cho cả
    // 4 vai trò như hành vi cũ.
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname.toLowerCase();
      if (currentPath !== '/login' && !currentPath.startsWith('/login/')) {
        window.location.assign(buildLoginRedirectUrl());
        return;
      }
    }
    if (authOverlay) authOverlay?.classList.add('open');
    renderGoogleSignInButton();
  }

  /**
   * Điều hướng sau đăng nhập dựa trên role DO BACKEND TRẢ VỀ (user.role trong
   * response của /auth/login và /auth/google). Chỉ áp dụng khi đang ở /login —
   * luồng modal nội bộ (SPA) giữ nguyên hành vi chuyển view mượt.
   *   STUDENT → /student · COUNSELOR → /counselor
   *   ENTERPRISE → /enterprise · ADMIN → /admin
   */
  function redirectToPostLoginTarget(user) {
    if (!user || typeof window === 'undefined') return false;
    const currentPath = window.location.pathname.toLowerCase();
    if (currentPath !== '/login' && !currentPath.startsWith('/login/')) return false;
    const portalPath = getPortalPathForRole(user.role) || '/';
    const params = new URLSearchParams(window.location.search);
    const nextRaw = params.get('next') || '';
    const next = nextRaw.startsWith('/') ? nextRaw : '';
    const ownsNext = Boolean(
      portalPath !== '/' &&
      next &&
      (next === portalPath || next.startsWith(`${portalPath}/`)),
    );
    window.location.replace(ownsNext ? nextRaw : portalPath);
    return true;
  }
  if (typeof window !== 'undefined') {
    window.redirectToPostLoginTarget = redirectToPostLoginTarget;
  }
  // The header is rendered by React, while this modal is owned by the legacy
  // controller. Expose the opener so the React login button can invoke it.
  if (typeof window !== 'undefined') {
    window.openAuthModal = openAuthModal;
  }
  function closeAuthModal() {
    if (authOverlay) authOverlay?.classList.remove('open');
  }
  if (authClose) authClose?.addEventListener('click', closeAuthModal);

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
      // Google chỉ phục vụ tài khoản Sinh viên; backend luôn gán STUDENT cho
      // tài khoản Google mới bất kể payload gửi kèm.
      await ApiClient.googleAuth(response.credential, 'student');
      closeAuthModal();
      checkUserSession();
      showToast('✅ Google đã xác minh và đăng nhập thành công!', 'success');
      // Role từ backend quyết định cổng đích sau đăng nhập.
      redirectToPostLoginTarget(ApiClient.getUser());
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
        text: 'continue_with',
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
        await ApiClient.login(email, password);
        showToast('✅ Đăng nhập thành công!', 'success');
        closeAuthModal();
        checkUserSession();
        // Đang ở /login: điều hướng thẳng tới portal đúng role trả về từ backend
        // (/student · /counselor · /enterprise · /admin). Hard navigation để
        // Next đồng bộ route và không flash layout portal nào khác.
        redirectToPostLoginTarget(ApiClient.getUser());
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

      const submitButton = cvForm.querySelector('button[type="submit"]');
      const progress = beginOperationProgress(submitButton, {
        id: 'modal-cv-upload-operation-progress',
        title: 'Đang đọc CV của bạn',
        steps: ['Tải file an toàn', 'OCR/trích xuất văn bản', 'Chuẩn hóa dữ liệu local'],
      });
      const stageTimer = window.setTimeout(() => progress.advance(1, 'Đang đọc nội dung CV; file scan có thể mất thêm thời gian.'), 650);
      try {
        submitButton.disabled = true;
        showToast('Đang tải file lên & trích xuất AI...', 'info');
        await ApiClient.uploadCV(fileInput.files[0], titleInput.value.trim());
        window.clearTimeout(stageTimer);
        progress.complete('Hoàn tất. Hồ sơ đã được lưu và có thể dùng lại cho các phân tích sau.');
        showToast('🎉 Tải lên & parse CV thành công!', 'success');
        cvForm.reset();
        loadCVList();
      } catch (err) {
        window.clearTimeout(stageTimer);
        progress.fail('Chưa thể đọc CV. Hãy kiểm tra file và thử lại.');
        showToast(`❌ Lỗi upload CV: ${err.message}`, 'error');
      } finally {
        submitButton.disabled = false;
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
      const [jds, catalogResult] = await Promise.all([
        ApiClient.listJDs(),
        ApiClient.searchJobs('', '', 100).catch(() => ({ jobs: [] })),
      ]);
      const catalogBySourceId = new Map(
        (catalogResult?.jobs || []).map(job => [String(job.source_id || ''), job]),
      );
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
          ${(() => {
          const sourceId = String(jd.normalized_json?.source_id || '');
          const url = jd.normalized_json?.source_url || catalogBySourceId.get(sourceId)?.source_url;
          return /^https?:\/\//i.test(String(url || ''))
            ? `<a class="jd-recruitment-link" href="${escapeHtml(String(url))}" target="_blank" rel="noopener noreferrer">Xem chi tiết tuyển dụng ↗</a>`
            : '';
        })()}
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
      const progress = beginOperationProgress(submitButton, {
        id: 'modal-jd-upload-operation-progress',
        title: 'Đang đọc Job Description',
        steps: ['Tải file JD', 'Trích xuất nội dung', 'Chuẩn hóa yêu cầu tuyển dụng'],
      });
      const stageTimer = window.setTimeout(() => progress.advance(1, 'Đang đọc nội dung JD; file scan có thể mất thêm thời gian.'), 650);
      try {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang trích xuất nội dung JD...';
        await ApiClient.uploadJD(
          file,
          document.getElementById('upload-jd-title').value.trim(),
          document.getElementById('upload-jd-company').value.trim(),
          document.getElementById('upload-jd-location').value.trim(),
        );
        window.clearTimeout(stageTimer);
        progress.complete('Hoàn tất. JD sẵn sàng để dùng trong RAG và phân tích CV–JD.');
        showToast('🎉 Đã tải lên và lưu Job Description!', 'success');
        uploadJdForm.reset();
        document.getElementById('upload-jd-file-name').textContent = 'PDF, DOCX, TXT hoặc ảnh';
        btnTabSysJd?.click();
        await loadJDList();
      } catch (err) {
        showToast(`❌ Lỗi tải JD: ${err.message}`, 'error');
      } finally {
        window.clearTimeout(stageTimer);
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
      selectGapCv.innerHTML = buildCvOptions(cvs);
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

      const progress = beginOperationProgress(btnRunGap, {
        id: 'modal-gap-operation-progress',
        title: 'Đang tạo báo cáo CV–JD',
        steps: ['Kiểm tra báo cáo đã lưu', 'Đối chiếu evidence local', 'Hoàn thiện và lưu báo cáo'],
      });
      const stageTimer = window.setTimeout(() => progress.advance(1, 'Đang so khớp CV và JD bằng dữ liệu local.'), 450);
      try {
        btnRunGap.disabled = true;
        showToast('AI đang tính toán Match Score & Gap Analysis...', 'info');
        const res = await ApiClient.runGapAnalysis(cvId, jdId);
        window.clearTimeout(stageTimer);
        progress.complete(
          res.cache_hit
            ? 'Đã dùng lại báo cáo đã lưu — không gọi Gemini.'
            : 'Báo cáo đã hoàn tất và được lưu để dùng lại ở lần sau.'
        );

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
        showToast(
          res.cache_hit
            ? '⚡ Đã dùng lại báo cáo đã lưu — không gọi Gemini.'
            : '🎉 Đã phân tích xong Gap Analysis!',
          'success'
        );
      } catch (err) {
        window.clearTimeout(stageTimer);
        progress.fail('Không thể hoàn tất báo cáo. Bạn có thể thử lại.');
        showToast(`❌ Lỗi chạy Gap Analysis: ${err.message}`, 'error');
      } finally {
        btnRunGap.disabled = false;
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
      selectIntCv.innerHTML = buildCvOptions(cvs, {
        emptyOption: '<option value="">(Bắt buộc upload 1 CV trước)</option>',
      });

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
        showToast('AI đang tạo bộ câu hỏi phỏng vấn thử...', 'info');
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
     Nova nằm ngoài các app-view và luôn khả dụng trên mọi trang/role
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
      // Clear a stale inline override left by the former role-specific
      // visibility controller before opening the panel.
      panel.style.removeProperty('display');
      panel.setAttribute('aria-hidden', String(!isOpen));
      avatar.setAttribute('aria-expanded', String(isOpen));
      companion?.classList.toggle('chat-open', isOpen);
      hint?.classList.add('is-hidden');
      companion.hidden = isOpen;
      if (!isOpen) companion.style.removeProperty('display');
      if (isOpen) {
        requestAnimationFrame(() => {
          placeChatPanel();
          input.focus();
        });
      }
    }

    function formatAssistantMessage(text) {
      const inline = value => escapeHtml(value)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+?)`/g, '<code class="ai-chat-code">$1</code>');
      const output = [];
      let listItems = [];
      const flushList = () => {
        if (!listItems.length) return;
        output.push(`<ul class="ai-chat-list">${listItems.join('')}</ul>`);
        listItems = [];
      };
      String(text || '').split(/\r?\n/).forEach(rawLine => {
        const line = rawLine.trim();
        if (!line) {
          flushList();
          return;
        }
        const heading = line.match(/^\*\*(.+)\*\*:?$/);
        if (heading) {
          flushList();
          output.push(`<div class="ai-chat-section-title">${inline(heading[1])}</div>`);
        } else if (/^[-•]\s+/.test(line)) {
          listItems.push(`<li>${inline(line.replace(/^[-•]\s+/, ''))}</li>`);
        } else if (/^>\s?/.test(line)) {
          flushList();
          output.push(`<blockquote class="ai-chat-quote">${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
        } else {
          flushList();
          output.push(`<p>${inline(line)}</p>`);
        }
      });
      flushList();
      return output.join('');
    }

    function appendChatMessage(role, text, actions = [], metadata = null) {
      const message = document.createElement('div');
      message.className = `ai-chat-message ${role}`;
      const name = document.createElement('span');
      name.className = 'ai-chat-message-name';
      name.textContent = role === 'assistant' ? 'Nova' : 'Bạn';
      const body = document.createElement('div');
      body.className = 'ai-chat-message-body';
      if (role === 'assistant') body.innerHTML = formatAssistantMessage(text);
      else body.textContent = text;
      message.append(name, body);

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
        appendChatMessage(
          'assistant',
          response,
          result.llm_succeeded ? (result.suggested_actions || []) : [],
          result
        );
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
        try {
          await ApiClient.deleteAssistantConversation(conversationId);
          if (currentConversationId === conversationId) resetConversation();
          await loadConversationHistory();
          showToast('Đã xóa cuộc hội thoại.', 'info');
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
  window.dispatchEvent(new CustomEvent('career-app:ready'));
  document.dispatchEvent(new CustomEvent('app:ready'));
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
  const cvSelect = () => document.getElementById('cv-analysis-cv-select');
  const jdSelect = () => document.getElementById('cv-analysis-jd-select');
  const cvFileInput = () => document.getElementById('cv-page-file-input');
  const jdFileInput = () => document.getElementById('cv-jd-file-input');
  const analyzeBtn = document.getElementById('p1-analyze-btn');
  const ctaHint = document.getElementById('p1-cta-hint');
  const cvCard = document.getElementById('p1-cv-card');
  const jdCard = document.getElementById('p1-jd-card');
  const step1 = document.getElementById('p1-step-1');
  const step2 = document.getElementById('p1-step-2');
  const step3 = document.getElementById('p1-step-3');
  const cvReadiness = document.getElementById('p1-cv-readiness-item');
  const jdReadiness = document.getElementById('p1-jd-readiness-item');
  const cvBanner = document.getElementById('p1-cv-ready-banner');
  const jdBanner = document.getElementById('p1-jd-ready-banner');
  const cvReadyName = document.getElementById('p1-cv-ready-name');
  const jdReadyName = document.getElementById('p1-jd-ready-name');
  const cvInputArea = document.getElementById('p1-cv-input-area');
  const jdInputArea = document.getElementById('p1-jd-input-area');
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
  const cvToggle = document.getElementById('p1-cv-list-toggle');
  const cvListSec = document.getElementById('p1-cv-list-section');
  const cvLoginGate = document.getElementById('p1-cv-login-gate');
  const cvSelectSec = document.getElementById('p1-cv-select-section');
  const jdLoginGate = document.getElementById('p1-jd-login-gate');
  const jdSelectSec = document.getElementById('p1-jd-select-section');
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
    updateLoginGates();
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
      if (jdReadyName) jdReadyName.textContent = selectedCard?.querySelector('.top-job-title, h3, h4')?.textContent?.trim() || jdLabelParts[0] || getJDLabel();
      if (jdReadyCompany) jdReadyCompany.textContent = selectedCard?.querySelector('.top-job-company-name, .p1-job-card-head p')?.textContent?.trim() || jdLabelParts[1] || '';
      if (jdReadyMeta) {
        jdReadyMeta.textContent = selectedCard
          ? [...selectedCard.querySelectorAll('.top-job-meta-item, .p1-job-meta span')].map(span => span.textContent.trim()).filter(Boolean).join(' • ')
          : '';
      }
    }
    if (jdBanner) jdBanner.style.display = jdOk ? 'grid' : 'none';
    if (jdInputArea) jdInputArea.style.display = 'block';
    if (jobBrowser) jobBrowser.hidden = false;

    // CTA
    if (analyzeBtn) {
      const isAnalyzing = analyzeBtn.classList.contains('is-loading');
      const canAnalyze = cvOk && jdOk && !isAnalyzing;
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
    const currentCvGate = document.getElementById('p1-cv-login-gate');
    const currentCvSelect = document.getElementById('p1-cv-select-section');
    const currentJdGate = document.getElementById('p1-jd-login-gate');
    const currentJdSelect = document.getElementById('p1-jd-select-section');
    if (currentCvGate) {
      currentCvGate.hidden = isLoggedIn;
      currentCvGate.classList.toggle('is-hidden', isLoggedIn);
      currentCvGate.style.setProperty('display', isLoggedIn ? 'none' : 'flex', 'important');
    }
    if (currentCvSelect) {
      currentCvSelect.hidden = !isLoggedIn;
      currentCvSelect.classList.toggle('is-hidden', !isLoggedIn);
      currentCvSelect.style.setProperty('display', isLoggedIn ? 'block' : 'none', 'important');
    }
    if (currentJdGate) {
      currentJdGate.hidden = isLoggedIn;
      currentJdGate.classList.toggle('is-hidden', isLoggedIn);
      currentJdGate.style.setProperty('display', isLoggedIn ? 'none' : 'flex', 'important');
    }
    if (currentJdSelect) {
      currentJdSelect.hidden = !isLoggedIn;
      currentJdSelect.classList.toggle('is-hidden', !isLoggedIn);
      currentJdSelect.style.setProperty('display', isLoggedIn ? 'block' : 'none', 'important');
    }
  }
  window.updateLoginGates = updateLoginGates;

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
    const fi = cvFileInput();
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
    if (analyzeBtn.disabled || analyzeBtn.classList.contains('is-loading')) return;
    if (!ApiClient.isAuthenticated()) {
      document.getElementById('btn-login')?.click();
      return;
    }
    // Trigger the real form submit which app.js handles
    const realSubmit = document.getElementById('btn-page-do-upload');
    if (realSubmit && !realSubmit.disabled) {
      realSubmit.click();
    }
  });

  // ── Keep progress inside the CTA; results open in the GAP modal ──
  const realBtn = document.getElementById('btn-page-do-upload');
  if (realBtn && analyzeBtn) {
    const observer = new MutationObserver(() => {
      const isLoading = realBtn.disabled;
      const ctaHint = document.getElementById('p1-cta-hint');
      if (isLoading) {
        analyzeBtn.innerHTML = '<svg class="spin-loader" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span>AI đang phân tích Match...</span>';
        analyzeBtn.classList.add('is-loading');
        analyzeBtn.disabled = true;
        if (ctaHint) {
          ctaHint.innerHTML = '<span class="cta-progress-text">Đang xử lý đối chiếu CV và JD...</span>';
        }
      } else {
        analyzeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path></svg><span>Phân tích Match</span><svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 5 7 7-7 7"></path></svg>';
        analyzeBtn.classList.remove('is-loading');
        analyzeBtn.disabled = false;
        if (ctaHint && !ctaHint.querySelector('.cta-error-text')) {
          ctaHint.textContent = 'Xem mức độ phù hợp, điểm mạnh và kỹ năng cần bổ sung';
        }
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

/* ============================================================
   Candidate flow guides — lightweight navigation for first-time users.
   These are purely presentational helpers; they do not alter any API flow.
   ============================================================ */
(() => {
  const guides = [
    {
      anchor: '#view-cv .vessel-header',
      target: '#cv-page-upload-form',
      icon: '1',
      title: 'Bắt đầu với CV của bạn',
      subtitle: 'Tải CV một lần, sau đó dùng lại cho mọi phân tích.',
      action: 'Tải CV',
      steps: ['Tải CV', 'AI trích xuất', 'Chọn luồng tiếp theo'],
    },
    {
      anchor: '#view-interview .page-header',
      target: '#page-interview-setup',
      icon: '2',
      title: 'Luyện phỏng vấn theo từng bước',
      subtitle: 'Chọn CV và vị trí trước khi bắt đầu phiên STAR.',
      action: 'Thiết lập phiên',
      steps: ['Chọn CV & vị trí', 'Trả lời câu hỏi', 'Xem báo cáo'],
    },
    {
      anchor: '#view-gap .page-header',
      target: '#page-gap-select-cv',
      icon: '3',
      title: 'Tìm khoảng cách kỹ năng',
      subtitle: 'Đặt CV cạnh một JD để biết điểm mạnh và phần cần bổ sung.',
      action: 'Chọn CV & JD',
      steps: ['Chọn dữ liệu', 'AI đối chiếu', 'Nhận lộ trình'],
    },
    {
      anchor: '#view-history .page-header',
      target: '#view-history .archive-workspace',
      icon: '4',
      title: 'Quay lại đúng nơi bạn đang cần',
      subtitle: 'Lọc hoạt động, mở báo cáo cũ hoặc tiếp tục một luồng dang dở.',
      action: 'Xem lịch sử',
      steps: ['Lọc hoạt động', 'Mở báo cáo', 'Tiếp tục thực hiện'],
    },
    {
      anchor: '#view-profile .page-header',
      target: '#view-profile .profile-settings-card',
      icon: '5',
      title: 'Cá nhân hoá trợ lý của bạn',
      subtitle: 'Cập nhật hồ sơ và chọn cách AI hỗ trợ phù hợp nhất.',
      action: 'Mở cài đặt',
      steps: ['Cập nhật hồ sơ', 'Chọn AI persona', 'Lưu thay đổi'],
    },
  ];

  function mountCandidateFlowGuides() {
    guides.forEach(guide => {
      const anchor = document.querySelector(guide.anchor);
      if (!anchor || anchor.parentElement?.querySelector(`[data-flow-guide-for="${guide.target}"]`)) return;
      const steps = guide.steps.map((step, index) => `<li data-step="${index + 1}">${step}</li>`).join('');
      anchor.insertAdjacentHTML('afterend', `
        <aside class="candidate-flow-guide" data-flow-guide-for="${guide.target}" aria-label="Hướng dẫn sử dụng">
          <div class="candidate-flow-guide-copy">
            <span class="candidate-flow-guide-icon" aria-hidden="true">${guide.icon}</span>
            <span><strong class="candidate-flow-guide-title">${guide.title}</strong><small class="candidate-flow-guide-subtitle">${guide.subtitle}</small></span>
          </div>
          <ol class="candidate-flow-guide-steps">${steps}</ol>
          <button type="button" data-flow-target="${guide.target}">${guide.action}</button>
        </aside>
      `);
    });
  }

  function scrollToFlowTarget(selector, focus = true) {
    const target = document.querySelector(selector);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (focus && typeof target.focus === 'function') {
      window.setTimeout(() => target.focus({ preventScroll: true }), 350);
    }
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-flow-target]');
    if (!trigger) return;
    scrollToFlowTarget(trigger.dataset.flowTarget);
  });

  document.addEventListener('change', event => {
    const id = event.target?.id;
    if (id === 'cv-page-file-input') {
      scrollToFlowTarget('#btn-page-do-upload', false);
      return;
    }
    if (id === 'page-interview-select-cv' || id === 'page-interview-select-jd') {
      const cv = document.getElementById('page-interview-select-cv')?.value;
      const jd = document.getElementById('page-interview-select-jd')?.value;
      if (cv && jd) scrollToFlowTarget('#page-btn-start-interview', false);
      return;
    }
    if (id === 'page-gap-select-cv' || id === 'page-gap-select-jd') {
      const cv = document.getElementById('page-gap-select-cv')?.value;
      const jd = document.getElementById('page-gap-select-jd')?.value;
      if (cv && jd) scrollToFlowTarget('#page-btn-run-gap', false);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountCandidateFlowGuides);
  } else {
    mountCandidateFlowGuides();
  }
})();
