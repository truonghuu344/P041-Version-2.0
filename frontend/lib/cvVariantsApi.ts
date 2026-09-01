export type VariantMode = 'HAS_CV' | 'NO_CV';
export type VariantStatus = 'DRAFT' | 'DRAFT_BLOCKED' | 'VALIDATED' | 'PUBLISHED';

export interface CVSummary {
  id: string;
  title: string;
}

export interface JDSummary {
  id: string;
  title: string;
  company?: string | null;
}

export interface VariantSuggestion {
  id: string;
  block_id?: string;
  section?: string;
  original: string;
  proposed: string;
  final_text?: string;
  reason?: string;
  jd_alignment?: string[];
  source_evidence_ids?: string[];
  source_spans?: Array<{ text: string; start?: number; end?: number }>;
  decision: 'pending' | 'accept' | 'reject' | 'edit';
  validator_status: string;
}

export interface VariantGapAnalysis {
  missing_skills: string[];
  missing_sections: string[];
  blueprint: {
    title: string;
    skills: string[];
    description: string;
    deliverables: string[];
    draft_bullet: string;
  };
}

export interface VariantContent {
  personal_info: Record<string, string>;
  summary: string;
  skills: string[];
  experience: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  education: Array<Record<string, unknown>>;
  certifications?: Array<Record<string, unknown>>;
  template_name?: 'classic' | 'modern' | 'compact';
  _suggestions?: VariantSuggestion[];
  _confirmed_claims?: string[];
  _match_scores?: { before: number; after_preview: number };
  _gap_analysis?: VariantGapAnalysis;
  _source_confirmed?: boolean;
}

export interface VariantValidation {
  variant_id: string;
  status: VariantStatus;
  passed: boolean;
  content_hash: string;
  validators: Array<{ name: string; passed: boolean; errors: string[] }>;
  claims_total: number;
  claims_supported: number;
  claims_blocked: number;
  render: { pages: number; bytes: number; template: string };
  trace_id: string;
}

export interface CVVariant {
  id: string;
  title: string;
  mode: VariantMode;
  status: VariantStatus;
  content: VariantContent;
  template: { id: string; name: 'classic' | 'modern' | 'compact'; version: number };
  ai_metadata: {
    provider?: string;
    model?: string;
    fallback_used?: boolean;
    prompt_version?: string;
    latency_ms?: number;
  };
  validator_result: VariantValidation | null;
  rendered_checksum: string | null;
  revision_no: number;
  trace_id: string;
  created_at?: string;
  updated_at?: string;
  revisions: Array<{
    revision_no: number;
    editor_type: string;
    change_summary?: string;
    created_at: string;
  }>;
}

function safeApiError(status: number): string {
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 404) return 'Dữ liệu không còn tồn tại hoặc không khả dụng.';
  if (status === 409) return 'Thao tác này chưa thể thực hiện ở trạng thái hiện tại.';
  if (status === 422) return 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại thông tin.';
  if (status === 429) return 'Hệ thống đang bận. Vui lòng thử lại sau ít phút.';
  return 'Đã xảy ra sự cố. Vui lòng thử lại sau.';
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = typeof window === 'undefined' ? null : window.localStorage.getItem('access_token');
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

function resolveApiUrl(endpoint: string): string {
  if (!endpoint || /^https?:\/\//i.test(endpoint)) return endpoint || '';
  const root = 'https://p041-version-2-0.onrender.com';
  const customV1 = (typeof window !== 'undefined' && window.__CAREER_API_BASE_URL__) || `${root}/api/v1`;
  const customV2 = (typeof window !== 'undefined' && window.__CAREER_API_V2_BASE_URL__) || `${root}/api/v2`;
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (clean.startsWith('/api/v2/')) return `${customV2.replace(/\/api\/v2\/?$/, '')}${clean}`;
  if (clean.startsWith('/api/v1/')) return `${customV1.replace(/\/api\/v1\/?$/, '')}${clean}`;
  return `${customV1.replace(/\/$/, '')}${clean}`;
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const targetUrl = resolveApiUrl(url);
  const response = await fetch(targetUrl, {
    ...init,
    credentials: 'include',
    headers: authHeaders({
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string>) || {}),
    }),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(safeApiError(response.status));
  }
  return body as T;
}

export const cvVariantsApi = {
  async prerequisites(): Promise<{ cvs: CVSummary[]; jds: JDSummary[] }> {
    const [cvs, jds] = await Promise.all([
      requestJson<CVSummary[]>('/api/v1/cvs'),
      requestJson<JDSummary[]>('/api/v1/jds'),
    ]);
    return { cvs: Array.isArray(cvs) ? cvs : [], jds: Array.isArray(jds) ? jds : [] };
  },

  create(payload: Record<string, unknown>, idempotencyKey: string): Promise<CVVariant> {
    return requestJson('/api/v2/cv-variants', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    });
  },

  list(): Promise<{ items: CVVariant[]; total: number }> {
    return requestJson('/api/v2/cv-variants');
  },

  get(id: string): Promise<CVVariant> {
    return requestJson(`/api/v2/cv-variants/${encodeURIComponent(id)}`);
  },

  autosave(
    id: string,
    content: VariantContent,
    confirmedClaims: string[] = [],
  ): Promise<CVVariant> {
    return requestJson(`/api/v2/cv-variants/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        content,
        confirmed_claims: confirmedClaims,
        change_summary: 'Autosave từ CV wizard',
      }),
    });
  },

  decide(
    id: string,
    suggestionId: string,
    decision: 'accept' | 'reject' | 'edit',
    finalText?: string,
  ): Promise<CVVariant> {
    return requestJson(
      `/api/v2/cv-variants/${encodeURIComponent(id)}/suggestions/${encodeURIComponent(suggestionId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ decision, final_text: finalText || null }),
      },
    );
  },

  validate(id: string): Promise<VariantValidation> {
    return requestJson(`/api/v2/cv-variants/${encodeURIComponent(id)}/validate`, {
      method: 'POST',
    });
  },

  publish(id: string): Promise<{ checksum: string; download_url: string; status: 'PUBLISHED' }> {
    return requestJson(`/api/v2/cv-variants/${encodeURIComponent(id)}/publish`, { method: 'POST' });
  },

  async createCustomJd(payload: {
    title: string;
    company?: string;
    requirements_text: string;
  }): Promise<JDSummary> {
    const result = await requestJson<{ id: string; title: string; company?: string | null }>(
      '/api/v1/jds/custom',
      {
        method: 'POST',
        body: JSON.stringify({
          title: payload.title,
          company: payload.company || '',
          location: '',
          requirements_text: payload.requirements_text,
        }),
      },
    );
    return {
      id: result.id,
      title: result.title,
      company: result.company,
    };
  },

  async pdf(id: string, preview = false): Promise<Blob> {
    const response = await fetch(
      `/api/v2/cv-variants/${encodeURIComponent(id)}/export${preview ? '?preview=true' : ''}`,
      {
        credentials: 'include',
        headers: authHeaders(),
      },
    );
    if (!response.ok) {
      throw new Error(safeApiError(response.status));
    }
    return response.blob();
  },
};
