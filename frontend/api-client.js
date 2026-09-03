/* ============================================================
   CAREER COPILOT X – app.js
/* ============================================================
   CAREER COPILOT X – app.js
   Deep Space Starfield + Shooting Stars Animation Engine
   FastAPI Backend Integration (PostgreSQL)
   ============================================================ */

import { feLog, getOrCreateRequestId, initFetchLogging } from './lib/logger';

if (typeof window !== 'undefined') {
  initFetchLogging();
}

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

function getSafeApiMessage(status, endpoint = '') {
  if (status === 401) {
    if (endpoint.includes('/auth/login') || endpoint.includes('/auth/token')) {
      return 'Email hoặc mật khẩu không chính xác.';
    }
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 404) return 'Dữ liệu bạn yêu cầu không còn tồn tại hoặc không khả dụng.';
  if (status === 409) return 'Thao tác này chưa thể thực hiện ở trạng thái hiện tại.';
  if (status === 422) return endpoint.includes('/auth/') ? 'Thông tin nhập chưa hợp lệ. Vui lòng kiểm tra và thử lại.' : 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại thông tin.';
  if (status === 429) return 'Hệ thống đang nhận nhiều yêu cầu. Vui lòng thử lại sau ít phút.';
  if (status === 502 || status === 503) return 'Dịch vụ tạm thời không khả dụng. Hệ thống đang tự động kết nối lại.';
  return 'Đã xảy ra sự cố. Vui lòng thử lại sau.';
}

// ── Centralized Request Resilience & Health Engine ──
const BACKOFF_DELAYS = [5000, 10000, 20000, 30000];

let isBackendAvailable = true;
let healthBackoffIndex = 0;
let healthRetryTimeoutId = null;
let healthCheckInFlightPromise = null;
let hasInitializedHealthCheck = false;
const inFlightRequests = new Map();
const recentGetCache = new Map();
const resumptionListeners = new Set();

function logDiagnostic(type, data = {}) {
  // Never log tokens or sensitive credential fields
  const safeData = { ...data };
  delete safeData.token;
  delete safeData.access_token;
  delete safeData.Authorization;
  delete safeData.password;
  delete safeData.credential;

  if (type === 'BACKEND_UNAVAILABLE') {
    console.warn('[Resilience] BACKEND_UNAVAILABLE', safeData);
    feLog({ action: 'BACKEND_UNAVAILABLE', extraData: safeData });
  } else if (type === 'HEALTH_RETRY') {
    console.info(`[Resilience] HEALTH_RETRY (next retry in ${safeData.nextRetryMs}ms)`);
    feLog({ action: 'HEALTH_RETRY', extraData: safeData });
  } else if (type === 'BACKEND_READY') {
    console.info('[Resilience] BACKEND_READY');
    feLog({ action: 'BACKEND_READY' });
  } else if (type === 'DUPLICATE_PREVENTED') {
    console.debug(`[Resilience] duplicate request prevented: ${safeData.key || ''}`);
    feLog({ action: 'DUPLICATE_REQUEST_PREVENTED', api: safeData.key || '' });
  }
}

function scheduleHealthRetry() {
  if (healthRetryTimeoutId) return;
  const delay = BACKOFF_DELAYS[Math.min(healthBackoffIndex, BACKOFF_DELAYS.length - 1)];
  healthBackoffIndex = Math.min(healthBackoffIndex + 1, BACKOFF_DELAYS.length - 1);
  logDiagnostic('HEALTH_RETRY', { nextRetryMs: delay });
  healthRetryTimeoutId = setTimeout(async () => {
    healthRetryTimeoutId = null;
    await ApiClient.checkHealth();
  }, delay);
}

function markBackendUnavailable(statusOrReason) {
  const wasAvailable = isBackendAvailable;
  isBackendAvailable = false;
  if (wasAvailable) {
    logDiagnostic('BACKEND_UNAVAILABLE', { statusOrReason });
  }
  scheduleHealthRetry();
}

export class ApiClient {
  static isAvailable() {
    return isBackendAvailable;
  }

  static onBackendReady(callback) {
    resumptionListeners.add(callback);
    return () => resumptionListeners.delete(callback);
  }

  static triggerResumption() {
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('career:backend-ready'));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('career:backend-ready'));
    }
    for (const callback of resumptionListeners) {
      try {
        callback();
      } catch (_) {
        // Suppress listener errors to prevent breaking resumption chain
      }
    }
  }

  static async checkHealth() {
    if (healthCheckInFlightPromise) {
      logDiagnostic('DUPLICATE_PREVENTED', { key: 'GET /health (in-flight)' });
      return healthCheckInFlightPromise;
    }

    healthCheckInFlightPromise = (async () => {
      const healthUrl = API_ORIGIN ? `${API_ORIGIN}/health` : '/backend-health';
      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        });

        if (response.ok && response.status === 200) {
          const wasUnavailable = !isBackendAvailable;
          isBackendAvailable = true;
          healthBackoffIndex = 0;
          if (healthRetryTimeoutId) {
            clearTimeout(healthRetryTimeoutId);
            healthRetryTimeoutId = null;
          }
          logDiagnostic('BACKEND_READY');
          if (wasUnavailable || hasInitializedHealthCheck) {
            ApiClient.triggerResumption();
          }
          return true;
        } else {
          markBackendUnavailable(response.status);
          return false;
        }
      } catch (err) {
        markBackendUnavailable('network_error');
        return false;
      } finally {
        healthCheckInFlightPromise = null;
      }
    })();

    return healthCheckInFlightPromise;
  }

  static async checkHealthOnce() {
    if (hasInitializedHealthCheck) return;
    hasInitializedHealthCheck = true;
    return await this.checkHealth();
  }

  static isBackendHealthy() {
    return isBackendAvailable;
  }

  static isBackendAvailable() {
    return isBackendAvailable;
  }

  static resetResilienceForTest() {
    isBackendAvailable = true;
    healthBackoffIndex = 0;
    if (healthRetryTimeoutId) {
      clearTimeout(healthRetryTimeoutId);
      healthRetryTimeoutId = null;
    }
    healthCheckInFlightPromise = null;
    hasInitializedHealthCheck = false;
    inFlightRequests.clear();
    recentGetCache.clear();
    resumptionListeners.clear();
  }

  static resetResilienceState() {
    this.resetResilienceForTest();
  }

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
    const isHealthEndpoint = endpoint === '/health' || endpoint === '/backend-health';
    
    // Stop launching business requests while backend is temporarily unavailable
    if (!isBackendAvailable && !isHealthEndpoint) {
      const unavailError = new Error('Dịch vụ tạm thời không khả dụng. Hệ thống đang tự động kết nối lại.');
      unavailError.status = 503;
      unavailError.isInfrastructureError = true;
      throw unavailError;
    }

    const method = (options.method || 'GET').toUpperCase();
    const isGet = method === 'GET';
    const isRecommendationPost = method === 'POST' && endpoint.includes('/job-recommendations');
    const shouldDeduplicate = isGet || isRecommendationPost;

    let dedupKey = '';
    if (shouldDeduplicate) {
      const bodyPart = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : '';
      dedupKey = `${method}:${endpoint}:${bodyPart}`;

      if (inFlightRequests.has(dedupKey)) {
        logDiagnostic('DUPLICATE_PREVENTED', { key: dedupKey });
        return inFlightRequests.get(dedupKey);
      }

      if (isGet && !options.noCache && recentGetCache.has(dedupKey)) {
        const cached = recentGetCache.get(dedupKey);
        const ttl = options.cacheTtlMs || (endpoint.includes('/jobs/locations') ? 60000 : 300);
        if (Date.now() - cached.timestamp < ttl) {
          logDiagnostic('DUPLICATE_PREVENTED', { key: dedupKey });
          return Promise.resolve(cached.data);
        }
      }
    }

    const executeRequest = (async () => {
      const headers = options.headers || {};
      const token = this.getToken();
      const requestId = getOrCreateRequestId();

      headers['X-Request-ID'] = requestId;
      // ApiClient logs its own feLog below; tell the global fetch wrapper to
      // skip its generic log so each request isn't reported twice.
      headers['X-Client-Logged'] = '1';

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
          if ([502, 503].includes(response.status)) {
            markBackendUnavailable(response.status);
          }

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

          if (!options.silent) {
            feLog({
              action: 'API_CLIENT_REQUEST',
              api: `${options.method || 'GET'} ${endpoint}`,
              status: response.status,
              error: errorMsg,
              extraData: options.body ? options.body : null,
            });
          }

          const safeMsg = getSafeApiMessage(response.status, endpoint);
          const customMsg = (typeof data?.detail === 'string' && data.detail.trim() && response.status !== 500) ? data.detail : safeMsg;
          const requestError = new Error(customMsg || safeMsg);
          requestError.status = response.status;
          requestError.payload = data;
          if ([502, 503].includes(response.status)) {
            requestError.isInfrastructureError = true;
          }
          throw requestError;
        }

        if (!options.silent) {
          feLog({
            action: 'API_CLIENT_REQUEST',
            api: `${options.method || 'GET'} ${endpoint}`,
            status: response.status,
            error: null,
          });
        }

        if (shouldDeduplicate && isGet) {
          recentGetCache.set(dedupKey, { data, timestamp: Date.now() });
        }

        return data;
      } catch (err) {
        if (!options.silent && (!err.status || err.status >= 500)) {
          feLog({
            action: 'API_CLIENT_ERROR',
            api: `${options.method || 'GET'} ${endpoint}`,
            status: err.status || 'ERROR',
            error: err.message,
          });
        }

        if (err instanceof TypeError && /failed to fetch/i.test(err.message)) {
          markBackendUnavailable('network_error');
          const netErr = new Error('Không thể kết nối máy chủ xử lý CV. Hãy kiểm tra kết nối mạng hoặc FastAPI.');
          netErr.status = 503;
          netErr.isInfrastructureError = true;
          throw netErr;
        }
        throw err;
      } finally {
        if (dedupKey) {
          inFlightRequests.delete(dedupKey);
        }
      }
    })();

    if (dedupKey) {
      inFlightRequests.set(dedupKey, executeRequest);
    }

    return executeRequest;
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
      void this.checkHealthOnce();
    }
    return data;
  }

  /**
   * @param {string} email
   * @param {string} password
   * @param {string} fullName
   * @param {'student' | 'counselor'} [role]
   * @param {string | null} [companyName]
   */
  static async register(email, password, fullName, role = 'student', companyName = null) {
    // Public registration only ever creates student/counselor accounts; the
    // backend re-validates and assigns the final role itself.
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
    // The first render waits for this request before replacing the neutral
    // bootstrap loader. A cold or unreachable backend must not leave the
    // whole UI stuck on that loader indefinitely.
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), 12000)
      : null;
    try {
      const user = await this.request('/auth/me', {
        silent: true,
        noCache: true,
        ...(controller ? { signal: controller.signal } : {}),
      });
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
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
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
      void this.checkHealthOnce();
    }
    return data;
  }

  // --- Profile APIs (dùng chung cho mọi vai trò, gồm Admin) ---
  static async updateProfile(payload) {
    const user = await this.request('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (user) {
      this.setUser(user);
    }
    return user;
  }

  static async changePassword(currentPassword, newPassword) {
    return await this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  }

  static async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('file', file);
    const user = await this.request('/auth/me/avatar', { method: 'POST', body: formData });
    if (user) {
      this.setUser(user);
    }
    return user;
  }

  static async deleteAvatar() {
    const user = await this.request('/auth/me/avatar', { method: 'DELETE' });
    if (user) {
      this.setUser(user);
    }
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

  static async listMyJDs() {
    return await this.request('/jds/mine');
  }

  static async getJD(jdId) {
    return await this.request(`/jds/${encodeURIComponent(jdId)}`);
  }

  static async getJob(jobId) {
    return await this.request(`/jds/${encodeURIComponent(jobId)}`);
  }

  static async listJobLocations() {
    return await this.request('/jobs/locations');
  }

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
        cv_id: cvId,
        keyword: filters.keyword || null,
        role: filters.role || null,
        location: filters.location || null,
        work_mode: filters.workMode || null,
        limit: filters.limit || 10,
      }),
    });
  }

  static async createCustomJD(title, company, location, requirementsText, metadata = null) {
    return await this.request('/jds/custom', {
      method: 'POST',
      body: JSON.stringify({
        title,
        company,
        location,
        requirements_text: requirementsText,
        metadata,
      }),
    });
  }

  static async updateCounselorJD(jdId, payload) {
    return await this.request(`/jds/${encodeURIComponent(jdId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  static async publishJD(jdId) {
    return await this.request(`/jds/${encodeURIComponent(jdId)}/publish`, {
      method: 'PATCH',
    });
  }

  static async deleteJD(jdId) {
    return await this.request(`/jds/${encodeURIComponent(jdId)}`, {
      method: 'DELETE',
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

  // --- Interview Agenda APIs (ngân hàng câu hỏi tự sinh) ---
  static async getInterviewAgenda(cvId, jdId) {
    const query = new URLSearchParams({ cv_id: cvId, jd_id: jdId });
    return await this.request(`/interviews/agenda?${query.toString()}`, { silent: true });
  }

  static async createInterviewAgenda(cvId, jdId, numQuestions = null, competencyFocus = null) {
    const body = { cv_id: cvId, jd_id: jdId };
    if (numQuestions) body.num_questions = numQuestions;
    if (competencyFocus) body.competency_focus = competencyFocus;
    return await this.request('/interviews/agenda', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  static async regenerateInterviewAgenda(agendaId, numQuestions = null, competencyFocus = null) {
    const body = {};
    if (numQuestions) body.num_questions = numQuestions;
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
    try {
      const query = new URLSearchParams();
      if (params.category && params.category !== 'all') query.set('category', params.category);
      if (params.unread_only) query.set('unread_only', 'true');
      if (params.limit) query.set('limit', String(params.limit));
      if (params.offset) query.set('offset', String(params.offset));
      const qs = query.toString() ? `?${query.toString()}` : '';
      const res = await this.request(`/notifications${qs}`, { silent: true });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  static async getNotificationUnreadCount() {
    return await this.request('/notifications/unread-count', { silent: true });
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

  // --- Counselor HITL APIs ---
  static async getCounselorDashboard() {
    return await this.request('/counselor/dashboard');
  }

  static async getCounselorStudents(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.major && params.major !== 'all') query.set('major', params.major);
    if (params.cv_status && params.cv_status !== 'all') query.set('cv_status', params.cv_status);
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await this.request(`/counselor/students${qs}`);
  }

  static async getCounselorStudentDetail(studentId) {
    return await this.request(`/counselor/students/${studentId}`);
  }

  static async verifyCounselorStudent(studentId, payload = {}) {
    return await this.request(`/counselor/students/${studentId}/verify`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async createCounselorTask(studentId, payload) {
    return await this.request(`/counselor/students/${studentId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async createCounselorFeedback(studentId, payload) {
    return await this.request(`/counselor/students/${studentId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async getCounselorOpportunities(params = {}) {
    const query = new URLSearchParams();
    if (params.tab) query.set('tab', params.tab);
    if (params.search) query.set('search', params.search);
    if (params.field && params.field !== 'all') query.set('field', params.field);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await this.request(`/counselor/opportunities${qs}`);
  }

  static async getCounselorJobCandidates(jobId) {
    return await this.request(`/counselor/opportunities/${jobId}/candidates`);
  }

  static async createCounselorReferral(payload) {
    return await this.request('/counselor/referrals', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async getCounselorReferrals(params = {}) {
    const query = new URLSearchParams();
    if (params.stage && params.stage !== 'all') query.set('stage', params.stage);
    if (params.search) query.set('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await this.request(`/counselor/referrals${qs}`);
  }

  static async getCounselorReferralDetail(referralId) {
    return await this.request(`/counselor/referrals/${referralId}`);
  }

  static async updateCounselorReferral(referralId, payload) {
    return await this.request(`/counselor/referrals/${referralId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  static async getCounselorInternships(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await this.request(`/counselor/internships${qs}`);
  }

  static async getCounselorInternshipDetail(internshipId) {
    return await this.request(`/counselor/internships/${internshipId}`);
  }

  static async getCounselorPartners() {
    return await this.request('/counselor/partners');
  }

  static async getCounselorPartnerDetail(partnerId) {
    return await this.request(`/counselor/partners/${partnerId}`);
  }

  static async getCounselorProfile() {
    return await this.request('/counselor/profile');
  }

  static async updateCounselorProfile(payload) {
    return await this.request('/counselor/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
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
}

if (typeof window !== 'undefined') {
  window.ApiClient = ApiClient;
}


