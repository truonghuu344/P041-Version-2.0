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

function getSafeApiMessage(status, endpoint = '') {
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 404) return 'Dữ liệu bạn yêu cầu không còn tồn tại hoặc không khả dụng.';
  if (status === 409) return 'Thao tác này chưa thể thực hiện ở trạng thái hiện tại.';
  if (status === 422) return endpoint.includes('/auth/') ? 'Thông tin nhập chưa hợp lệ. Vui lòng kiểm tra và thử lại.' : 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại thông tin.';
  if (status === 429) return 'Hệ thống đang nhận nhiều yêu cầu. Vui lòng thử lại sau ít phút.';
  return 'Đã xảy ra sự cố. Vui lòng thử lại sau.';
}

export class ApiClient {
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
        let errorMsg = `Lỗi HTTP ${response.status}`;
        if (data) {
          if (typeof data.detail === 'string' && data.detail.trim()) {
            errorMsg = data.detail;
          } else if (Array.isArray(data.detail) && data.detail.length > 0) {
            errorMsg = data.detail.map(item => {
              if (typeof item === 'string') return item;
              if (item && item.msg) {
                const loc = Array.isArray(item.loc) ? item.loc.filter(l => l !== 'body').join('.') : '';
                if (loc === 'email' && (item.msg.includes('email') || item.msg.includes('valid'))) {
                  return 'Email không đúng định dạng hợp lệ';
                }
                if (loc === 'password' && item.msg.includes('at least')) {
                  return 'Mật khẩu phải có tối thiểu 6 ký tự';
                }
                if (loc === 'full_name' && item.msg.includes('at least')) {
                  return 'Họ và tên phải có tối thiểu 2 ký tự';
                }
                return loc ? `${loc}: ${item.msg}` : item.msg;
              }
              return JSON.stringify(item);
            }).join('; ');
          } else if (typeof data.message === 'string' && data.message.trim()) {
            errorMsg = data.message;
          }
        }
        const requestError = new Error(getSafeApiMessage(response.status, endpoint));
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
      throw new Error(getSafeApiMessage(response.status, '/cvs/export'));
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

  static async chatWithAssistant(message, history = [], currentPage = 'dashboard', conversationId = null) {
    const options = {
      method: 'POST',
      body: JSON.stringify({
        message,
        history,
        current_page: currentPage,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
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

  // --- Multi-Role Notification APIs ---
  static async listNotifications(params = {}) {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'all') query.set('category', params.category);
    if (params.unread_only) query.set('unread_only', 'true');
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await this.request(`/notifications${qs}`);
  }

  static async getNotificationUnreadCount() {
    return await this.request('/notifications/unread-count');
  }

  static async markNotificationRead(notificationId) {
    return await this.request(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  }

  static async markAllNotificationsRead() {
    return await this.request('/notifications/mark-all-read', {
      method: 'POST',
    });
  }

  static async deleteNotification(notificationId) {
    return await this.request(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  }

  static async getNotificationPreferences() {
    return await this.request('/notifications/preferences');
  }

  static async updateNotificationPreferences(payload) {
    return await this.request('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
}


