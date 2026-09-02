/**
 * Career Copilot X - Standardized Frontend Logger
 * 
 * FE log format: role | route | action | API | status | error
 * Supports Dev mode (detailed styled console logs) & Production mode (compact),
 * automatic X-Request-ID header management, sensitive data sanitization, and fetch interception.
 */

const SENSITIVE_KEYS = [
  'password',
  'pass',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'authorization',
  'cookie',
  'credit_card',
  'cvv',
];

const REDACTED_VALUE = '******';

/**
 * Mask sensitive data fields (passwords, tokens, API keys) in log payloads.
 */
export function maskSensitiveData(data: unknown, depth = 5): unknown {
  if (depth <= 0 || data === null || data === undefined) return data;

  if (typeof data === 'string') {
    let masked = data.replace(/(Bearer\s+)[A-Za-z0-9\-_.]+/gi, `$1${REDACTED_VALUE}`);
    masked = masked.replace(/(password=)[^&]+/gi, `$1${REDACTED_VALUE}`);
    return masked;
  }

  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item, depth - 1));
  }

  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>;
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
        copy[key] = REDACTED_VALUE;
      } else {
        copy[key] = maskSensitiveData(record[key], depth - 1);
      }
    }
    return copy;
  }

  return data;
}

export function getCurrentUserRole(): string {
  if (typeof window === 'undefined') return 'guest';
  try {
    const userInfoStr = localStorage.getItem('user_info');
    if (userInfoStr) {
      const user = JSON.parse(userInfoStr);
      return user.role || 'guest';
    }
  } catch {
    // Ignore JSON parse errors
  }
  return 'guest';
}

export function getCurrentRoute(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

export function generateRequestId(): string {
  const randomStr = Math.random().toString(36).substring(2, 10);
  const timeStr = Date.now().toString(36);
  return `req_${timeStr}_${randomStr}`;
}

let activeRequestId: string | null = null;

export function getOrCreateRequestId(): string {
  if (!activeRequestId) {
    activeRequestId = generateRequestId();
  }
  return activeRequestId;
}

export function setRequestId(reqId: string): void {
  activeRequestId = reqId;
}

export function resetRequestId(): string {
  activeRequestId = generateRequestId();
  return activeRequestId;
}

export interface FELogParams {
  role?: string;
  route?: string;
  action: string;
  api?: string;
  status: number | string;
  error?: string | null;
  extraData?: unknown;
}

/**
 * Standard FE Logger. Output format: role | route | action | API | status | error
 */
export function feLog({
  role = getCurrentUserRole(),
  route = getCurrentRoute(),
  action,
  api = 'N/A',
  status,
  error = null,
  extraData = null,
}: FELogParams): void {
  const isDev = process.env.NODE_ENV !== 'production';
  const reqId = getOrCreateRequestId();
  const errorText = error ? String(error) : '';
  const statusStr = String(status);

  const logMessage = `${role} | ${route} | ${action} | ${api} | ${statusStr} | ${errorText}`;
  const sanitizedExtra = extraData ? maskSensitiveData(extraData) : null;

  if (isDev) {
    // 401 chỉ báo "chưa đăng nhập" (guest kiểm tra phiên, token hết hạn) —
    // app đã xử lý bằng cách hiện lại form đăng nhập, không phải lỗi thật.
    const numericStatus = Number(status);
    const isError = numericStatus !== 401 && (numericStatus >= 400 || Boolean(errorText));
    const badgeStyle = isError
      ? 'background: #ef4444; color: #ffffff; font-weight: bold; padding: 2px 6px; border-radius: 4px;'
      : 'background: #3b82f6; color: #ffffff; font-weight: bold; padding: 2px 6px; border-radius: 4px;';

    if (isError) {
      console.error(`%c[FE LOG]%c [${reqId}] ${logMessage}`, badgeStyle, 'color: inherit;', sanitizedExtra || '');
    } else {
      console.log(`%c[FE LOG]%c [${reqId}] ${logMessage}`, badgeStyle, 'color: inherit;', sanitizedExtra || '');
    }
  } else {
    // Production mode: concise single line
    const numericStatus = Number(status);
    const isError = numericStatus !== 401 && (numericStatus >= 400 || Boolean(errorText));
    if (isError) {
      console.error(`[FE LOG] [${reqId}] ${logMessage}`);
    } else {
      console.log(`[FE LOG] [${reqId}] ${logMessage}`);
    }
  }
}

/**
 * Patch global window.fetch to automatically append X-Request-ID header
 * and log every FE -> BE call with role | route | action | API | status | error
 */
let fetchPatched = false;

export function initFetchLogging(): void {
  if (typeof window === 'undefined' || fetchPatched) return;

  // Không có fetch gốc thì không thể bọc. Nếu vẫn gán wrapper, wrapper sẽ giữ
  // originalFetch = undefined và mọi lời gọi sau đó nổ "originalFetch is not a
  // function" — fetch bị phá vĩnh viễn (jsdom, môi trường thiếu polyfill).
  if (typeof window.fetch !== 'function') return;

  fetchPatched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const reqId = getOrCreateRequestId();
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ? init.method.toUpperCase() : 'GET';
    const apiLabel = `${method} ${urlStr}`;

    // Infer flow action from URL if not provided
    let action = 'API_REQUEST';
    if (urlStr.includes('/cv')) action = 'CV_FLOW';
    else if (urlStr.includes('/job')) action = 'JOB_FLOW';
    else if (urlStr.includes('/application') || urlStr.includes('/matches')) action = 'APPLICATION_FLOW';
    else if (urlStr.includes('/counselor/referrals')) action = 'REFERRAL_FLOW';
    else if (urlStr.includes('/consent')) action = 'CONSENT_FLOW';
    else if (urlStr.includes('/interview')) action = 'INTERVIEW_FLOW';
    else if (urlStr.includes('/internship')) action = 'INTERNSHIP_FLOW';
    else if (urlStr.includes('/notification')) action = 'NOTIFICATION_FLOW';

    // Inject X-Request-ID header
    const headers = new Headers(init?.headers || {});
    if (!headers.has('X-Request-ID')) {
      headers.set('X-Request-ID', reqId);
    }
    // Callers that already log their own request (e.g. ApiClient) mark this
    // so it isn't reported a second time here.
    const skipLog = headers.has('X-Client-Logged');
    if (skipLog) headers.delete('X-Client-Logged');

    const modifiedInit: RequestInit = {
      ...init,
      headers,
    };

    try {
      const response = await originalFetch(input, modifiedInit);
      const status = response.status;

      if (!skipLog) {
        if (!response.ok) {
          feLog({
            action,
            api: apiLabel,
            status,
            error: `HTTP ${status} ${response.statusText}`,
          });
        } else {
          feLog({
            action,
            api: apiLabel,
            status,
            error: null,
          });
        }
      }

      return response;
    } catch (err: unknown) {
      if (!skipLog) {
        feLog({
          action,
          api: apiLabel,
          status: 'FETCH_ERROR',
          error: err instanceof Error ? err.message : 'Network error',
        });
      }
      throw err;
    }
  };
}
