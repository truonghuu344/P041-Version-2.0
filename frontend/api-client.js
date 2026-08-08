/* ============================================================
   CAREER COPILOT X – API CLIENT
   API Client tích hợp kết nối FastAPI Backend
   ============================================================ */

const API_BASE_URL =
  (typeof window !== 'undefined' && window.__CAREER_API_BASE_URL__) || '/api/v1';

export class ApiClient {
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

    const config = {
      ...options,
      headers,
    };

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
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        role,
      }),
    });
  }

  static async getMe() {
    const user = await this.request('/auth/me');
    this.setUser(user);
    return user;
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

  static async getCVDetail(cvId) {
    return await this.request(`/cvs/${cvId}`);
  }

  static async getCVAgentStatus() {
    return await this.request('/cvs/agent/status');
  }

  static async reanalyzeCV(cvId, useLLM = true) {
    const formData = new FormData();
    formData.append('use_llm', String(Boolean(useLLM)));
    return await this.request(`/cvs/${cvId}/analyze`, { method: 'POST', body: formData });
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
      body: JSON.stringify({
        cv_id: cvId,
        jd_id: jdId,
      }),
    });
  }

  static async getAnalysisHistory() {
    return await this.request('/analysis/history');
  }

  // --- Mock Interview APIs ---
  static async startInterview(cvId, jdId, totalQuestions = 5) {
    return await this.request('/interviews/start', {
      method: 'POST',
      body: JSON.stringify({
        cv_id: cvId,
        jd_id: jdId,
        total_questions: totalQuestions,
      }),
    });
  }

  static async submitAnswer(sessionId, userAnswer) {
    return await this.request(`/interviews/${sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({
        user_answer: userAnswer,
      }),
    });
  }

  static async getInterviewReport(sessionId) {
    return await this.request(`/interviews/${sessionId}/report`);
  }
}
