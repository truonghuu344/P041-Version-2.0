/**
 * API client cho Match Evaluation V2 endpoints.
 * Thành viên 4 — feat/match-evaluation-modal
 *
 * Nguyên tắc: không tự tính score, chỉ gọi và trả về data từ server.
 */

const BASE = '/api/v2/matches';

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function apiFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.detail || `Lỗi ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types (mirror v2_schemas.py) ──────────────────────────────────────────────

export interface EvidenceDetail {
  evidence_id: string;
  requirement_id: string;
  chunk_id: string;
  text: string;
  source_page?: number | null;
  source_section?: string | null;
  span_start?: number | null;
  span_end?: number | null;
  fusion_score?: number | null;
  semantic_score?: number | null;
  bm25_score?: number | null;
}

export interface EvidenceListData {
  requirement_id: string;
  items: EvidenceDetail[];
  total: number;
}

export interface RequirementDetail {
  requirement_id: string;
  criterion_id: string;
  text: string;
  mandatory: boolean;
  priority: 'high' | 'medium' | 'low';
  status: string;
  criterion_score?: number | null;
  evidence_ids: string[];
}

export interface RequirementListData {
  criterion_id: string;
  items: RequirementDetail[];
  total: number;
  page: number;
  page_size: number;
}

export interface MandatoryGate {
  failed: boolean;
  failed_requirements: string[];
}

export interface CriterionSummary {
  criterion_id: string;
  label: string;
  weight: number;
  raw_score: number;
  weighted_score: number;
  status: string;
  requirements_total: number;
  requirements_met: number;
  requirements_partial: number;
  top_gap_text?: string | null;
  reason?: string | null;
}

export interface MatchEvaluationData {
  match_id: string;
  status: string;
  fit_score?: number | null;
  confidence?: 'high' | 'medium' | 'low' | 'very_low' | null;
  mandatory_gate: MandatoryGate;
  criteria_summary: CriterionSummary[];
  versions: Record<string, string>;
  trace_id?: string | null;
  created_at?: string | null;
}

export interface GapAction {
  requirement_id: string;
  requirement_text: string;
  criterion_id: string;
  criterion_label?: string | null;
  status: string;
  mandatory: boolean;
  priority: 'high' | 'medium' | 'low';
  score_impact: number;
  evidence_count: number;
  action_type: string;
  action_text: string;
  weight: number;
}

export interface GapListData {
  match_id: string;
  gaps: GapAction[];
  total: number;
  mandatory_failed_count: number;
}

// ── API functions ─────────────────────────────────────────────────────────────

export function fetchMatchEvaluation(matchId: string, token: string): Promise<MatchEvaluationData> {
  return apiFetch(`${BASE}/${matchId}/evaluation`, token);
}

export function fetchMatchGaps(matchId: string, token: string): Promise<GapListData> {
  return apiFetch(`${BASE}/${matchId}/evaluation/gaps`, token);
}

export function fetchCriterionRequirements(
  matchId: string,
  criterionId: string,
  token: string,
  page = 1,
  pageSize = 50,
): Promise<RequirementListData> {
  return apiFetch(
    `${BASE}/${matchId}/evaluation/criteria/${criterionId}/requirements?page=${page}&page_size=${pageSize}`,
    token,
  );
}

export function fetchRequirementEvidence(
  matchId: string,
  requirementId: string,
  token: string,
): Promise<EvidenceListData> {
  return apiFetch(`${BASE}/${matchId}/evaluation/requirements/${requirementId}/evidence`, token);
}
