/* ============================================================
   CAREER COPILOT X – API CLIENT
   API Client tích hợp kết nối FastAPI Backend
   ============================================================ */

const API_BASE_URL =
  (typeof window !== 'undefined' && window.__CAREER_API_BASE_URL__) || '/api/v1';

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
    if (/invalid/i.test(normalized) || /credentials/i.test(normalized) || /unauthorized/i.test(normalized)) {
      return 'Email hoặc mật khẩu không chính xác. Bạn vui lòng kiểm tra lại nhé!';
    }
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
  if (detail && typeof detail === 'string') {
    if (/invalid/i.test(detail) || /credentials/i.test(detail) || status === 401) {
      return 'Email hoặc mật khẩu không chính xác. Bạn vui lòng kiểm tra lại nhé!';
    }
    return detail;
  }
  return detail ? String(detail) : `Lỗi HTTP ${status}`;
}

export class ApiClient {
  static getToken() {
    return null;
  }

  static setToken(_token) {
    localStorage.removeItem('access_token');
  }

  static getUser() {
    const u = localStorage.getItem('user_info');
    return u ? JSON.parse(u) : null;
  }

  static isAuthenticated() {
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

    const config = {
      ...options,
      headers,
      credentials: 'include',
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
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
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        role,
      }),
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
