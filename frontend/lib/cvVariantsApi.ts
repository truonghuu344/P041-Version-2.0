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
  ai_metadata: { provider?: string; model?: string; fallback_used?: boolean; prompt_version?: string; latency_ms?: number };
  validator_result: VariantValidation | null;
  rendered_checksum: string | null;
  revision_no: number;
  trace_id: string;
  revisions: Array<{ revision_no: number; editor_type: string; change_summary?: string; created_at: string }>;
}

interface ApiErrorBody {
  code?: string;
  message?: string;
  detail?: string | { message?: string };
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = typeof window === 'undefined' ? null : window.localStorage.getItem('access_token');
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: authHeaders({ 'Content-Type': 'application/json', ...(init.headers as Record<string, string> || {}) }),
  });
  const body = await response.json().catch(() => ({} as ApiErrorBody)) as ApiErrorBody & T;
  if (!response.ok) {
    const detail = typeof body.detail === 'string' ? body.detail : body.detail?.message;
    throw new Error(body.message || detail || `Lỗi HTTP ${response.status}`);
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

  autosave(id: string, content: VariantContent, confirmedClaims: string[] = []): Promise<CVVariant> {
    return requestJson(`/api/v2/cv-variants/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ content, confirmed_claims: confirmedClaims, change_summary: 'Autosave từ CV wizard' }),
    });
  },

  decide(id: string, suggestionId: string, decision: 'accept' | 'reject' | 'edit', finalText?: string): Promise<CVVariant> {
    return requestJson(`/api/v2/cv-variants/${encodeURIComponent(id)}/suggestions/${encodeURIComponent(suggestionId)}`, {
      method: 'PUT',
      body: JSON.stringify({ decision, final_text: finalText || null }),
    });
  },

  validate(id: string): Promise<VariantValidation> {
    return requestJson(`/api/v2/cv-variants/${encodeURIComponent(id)}/validate`, { method: 'POST' });
  },

  publish(id: string): Promise<{ checksum: string; download_url: string; status: 'PUBLISHED' }> {
    return requestJson(`/api/v2/cv-variants/${encodeURIComponent(id)}/publish`, { method: 'POST' });
  },

  async pdf(id: string, preview = false): Promise<Blob> {
    const response = await fetch(`/api/v2/cv-variants/${encodeURIComponent(id)}/export${preview ? '?preview=true' : ''}`, {
      credentials: 'include',
      headers: authHeaders(),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({} as ApiErrorBody)) as ApiErrorBody;
      throw new Error(body.message || (typeof body.detail === 'string' ? body.detail : body.detail?.message) || 'Không thể mở PDF.');
    }
    return response.blob();
  },
};
