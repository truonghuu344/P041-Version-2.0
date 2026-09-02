/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Match Result Data Adapter & Normalization Engine
 * 
 * Canonical data mapping for CV <-> JD Match.
 * Answers strictly: "How well does this CV match this JD, and why?"
 * 
 * Ensures strict null safety, eliminates "undefined", and guarantees that
 * Score, Rating, Requirement Counts, Criteria, and Evidence are unified.
 */

export interface NormalizedRequirement {
  id: string;
  requirementId: string;
  title: string;
  status: 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'NOT_FOUND' | 'UNCERTAIN';
  statusLabel: string;
  isMandatory: boolean;
  typeLabel: 'Bắt buộc' | 'Ưu tiên';
  groupKey: string;
  groupLabel: string;
  jdText: string;
  cvText: string;
  gapText: string;
}

export interface NormalizedCriterion {
  group: string;
  label: string;
  icon: string;
  rawScore?: number;
  weightedScore?: number;
  status?: string;
  statusLabel?: string;
  reason?: string;
  requirements: NormalizedRequirement[];
  matchedCount: number;
  totalCount: number;
  ratioLabel: string;
}

export interface NormalizedStrength {
  title: string;
  evidence?: string;
}

export interface NormalizedGap {
  title: string;
  status: 'PARTIALLY_SUPPORTED' | 'NOT_FOUND' | 'UNCERTAIN';
  statusLabel: string;
  typeLabel: 'Bắt buộc' | 'Ưu tiên';
  isMandatory: boolean;
  reason?: string;
  jdText?: string;
  cvText?: string;
}

export interface NormalizedHardConstraint {
  title: string;
  status: string;
  statusLabel: string;
  reason?: string;
}

export interface NormalizedMatchResult {
  score: number | null;
  scoreDisplay: string;
  rating: string | null;
  ratingLabel: string;
  decisionMessage: string;
  isCompleted: boolean;
  summary: string;
  matchedCount: number;
  partialCount: number;
  missingCount: number;
  uncertainCount: number;
  totalCount: number;
  criteria: NormalizedCriterion[];
  matchedRequirements: NormalizedRequirement[];
  partialRequirements: NormalizedRequirement[];
  missingRequirements: NormalizedRequirement[];
  uncertainRequirements: NormalizedRequirement[];
  allRequirements: NormalizedRequirement[];
  strengths: NormalizedStrength[];
  gaps: NormalizedGap[];
  hardConstraints: NormalizedHardConstraint[];
  scoreExplanation?: any;
  categoryScoreExplanation?: any[];
  structuredStrengths?: any[];
  structuredBlockers?: any[];
  requirementSummary?: any;
  rawAnalysis: Record<string, unknown>;
}

export const GROUP_LABELS: Record<string, string> = {
  skills: 'Kỹ năng chuyên môn',
  responsibilities_task_fit: 'Trách nhiệm & Nhiệm vụ',
  experience_seniority: 'Kinh nghiệm & Cấp bậc',
  experience_level: 'Kinh nghiệm & Cấp bậc',
  domain_industry: 'Lĩnh vực chuyên môn',
  education: 'Học vấn & Bằng cấp',
  certifications_languages_other: 'Chứng chỉ & Ngoại ngữ',
  other: 'Yêu cầu khác',
};

export const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
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

export const GROUP_ICONS: Record<string, string> = {
  skills: '⚡',
  responsibilities_task_fit: '📋',
  experience_seniority: '💼',
  domain_industry: '🏢',
  education: '🎓',
  certifications_languages_other: '📜',
  other: '📌',
};

export const RATING_LABELS: Record<string, string> = {
  POOR: 'Phù hợp thấp',
  FAIR: 'Phù hợp một phần',
  AVERAGE: 'Phù hợp một phần',
  GOOD: 'Phù hợp tốt',
  EXCELLENT: 'Phù hợp rất tốt',
};

export const DECISION_MESSAGES: Record<string, string> = {
  POOR: 'CV còn thiếu nhiều yêu cầu của vị trí này.',
  FAIR: 'CV đáp ứng một phần yêu cầu và còn một số khoảng cách quan trọng.',
  AVERAGE: 'CV đáp ứng một phần yêu cầu và còn một số khoảng cách quan trọng.',
  GOOD: 'CV đáp ứng phần lớn yêu cầu của vị trí.',
  EXCELLENT: 'CV phù hợp rất tốt với vị trí này.',
};

export const STATUS_TEXT: Record<string, string> = {
  SUPPORTED: 'Đáp ứng',
  PARTIALLY_SUPPORTED: 'Đáp ứng một phần',
  NOT_FOUND: 'Chưa đáp ứng',
  UNCERTAIN: 'Chưa đủ bằng chứng',
};

export function normalizeStatus(rawStatus?: string): 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'NOT_FOUND' | 'UNCERTAIN' {
  const upper = String(rawStatus || '').toUpperCase();
  if (['SUPPORTED', 'MATCHED', 'PASS'].includes(upper)) return 'SUPPORTED';
  if (['PARTIALLY_SUPPORTED', 'PARTIAL'].includes(upper)) return 'PARTIALLY_SUPPORTED';
  if (['NOT_FOUND', 'MISSING', 'CONFLICT', 'CONFLICTING', 'FAIL'].includes(upper)) return 'NOT_FOUND';
  return 'UNCERTAIN';
}

export function cleanRequirementTitle(text?: string, fallback = 'Yêu cầu chuyên môn'): string {
  if (!text) return fallback;
  const raw = String(text).trim();
  if (!raw || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return fallback;
  if (LANGUAGE_DISPLAY_NAMES[raw.toLowerCase()]) {
    return LANGUAGE_DISPLAY_NAMES[raw.toLowerCase()];
  }
  let s = raw;
  // Strip markdown headings (e.g. ### 4.)
  s = s.replace(/^#{1,6}\s*/, '');
  s = s.replace(/\\([#\-_*])/g, '$1');
  s = s.replace(/-{2,}/g, '-').trim();
  s = s.replace(/^(?:\d+[\.\)]+|\-|\•|\*|\+)\s*/, '');
  s = s.replace(/^(?:\d+\.\s*)?(?:Trách nhiệm & Nhiệm vụ chính|Trách nhiệm|Nhiệm vụ chính|Nhiệm vụ|Yêu cầu bắt buộc \(Must-Have\)|Yêu cầu bắt buộc|Yêu cầu ưu tiên \(Nice-To-Have\)|Yêu cầu ưu tiên|Yêu cầu công việc|Yêu cầu ứng viên|Yêu cầu khác|Mô tả công việc|Must-Have|Nice-To-Have|Responsibilities|Requirements|Overview)\s*[:\-–—]?\s*/gi, '');
  s = s.replace(/^[\-\•\*\+\d\.\)]+\s*/, '');
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

export function cleanVagueText(text?: string, fallback = ''): string {
  if (!text) return fallback;
  let s = String(text).trim();
  s = s.replace(/chưa có bằng chứng\b/gi, 'CV không đề cập nội dung này');
  s = s.replace(/không đủ bằng chứng\b/gi, 'CV chưa thể hiện rõ nội dung này');
  s = s.replace(/chưa đủ bằng chứng\b/gi, 'CV chưa thể hiện rõ nội dung này');
  s = s.replace(/cần làm rõ\b/gi, 'chưa được mô tả cụ thể');
  return s || fallback;
}

function isUsefulDisplayText(value: unknown): value is string {
  const text = String(value ?? '').trim();
  return Boolean(text) && !/^(?:null|undefined)$/i.test(text);
}

function evidenceSourcePriority(item: any): number {
  const source = String(item?.source_section || item?.chunk_type || item?.section || '').toLowerCase();
  if (/experience|work/.test(source)) return 0;
  if (/project/.test(source)) return 1;
  if (/skill/.test(source)) return 2;
  if (/certif/.test(source)) return 3;
  if (/education/.test(source)) return 4;
  if (/summary/.test(source)) return 5;
  return 6;
}

function isRelevantEvidence(text: string, title: string): boolean {
  const target = title.trim().toLocaleLowerCase();
  return Boolean(target) && text.toLocaleLowerCase().includes(target);
}

function isContactEvidence(text: string): boolean {
  return /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?84|0)[\s.()-]*\d(?:[\s.()-]*\d){7,9}|^(?:email|phone|mobile|address|địa chỉ)\s*:/i.test(text);
}

/** Return one relevant item only; a whole skills list is never evidence for one requirement. */
function bestRelevantEvidence(item: any, title: string): string {
  const candidates: Array<{ text: string; priority: number }> = [];
  const add = (value: unknown, source?: any) => {
    if (!isUsefulDisplayText(value)) return;
    const text = String(value).trim();
    if (!isContactEvidence(text) && isRelevantEvidence(text, title)) {
      candidates.push({ text, priority: evidenceSourcePriority(source) });
    }
  };

  add(item.cv_text, item);
  add(item.matched_text, item);
  const evidence = Array.isArray(item.evidence) ? item.evidence : [];
  evidence.forEach((entry: any) => add(entry?.text ?? entry?.quote ?? entry?.evidence_quote, entry));
  if (!evidence.length) add(item.evidence, item);
  candidates.sort((a, b) => a.priority - b.priority || a.text.length - b.text.length);
  const best = candidates[0];
  if (!best) return '';
  if (best.priority === 2 || best.text.trim().toLocaleLowerCase() === title.trim().toLocaleLowerCase()) {
    return `"${title}" — mục Kỹ năng`;
  }
  return best.text.length > 220 ? `${best.text.slice(0, 217).trim()}…` : best.text;
}

function mapRequirement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any,
  defaultGroupKey: string = 'skills',
  forcedStatus?: 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'NOT_FOUND' | 'UNCERTAIN'
): NormalizedRequirement {
  const status = forcedStatus || normalizeStatus(item.status || item.evaluation_status || item.match_status);
  const statusLabel = STATUS_TEXT[status] || 'Chưa xác định';

  const isMandatory = Boolean(
    item.type === 'REQUIRED' ||
    item.mandatory ||
    item.is_mandatory ||
    String(item.requirement_type || '').toUpperCase().includes('REQUIRED') ||
    String(item.type || '').toUpperCase().includes('REQUIRED')
  );

  const groupKey = isUsefulDisplayText(item.group) ? item.group : defaultGroupKey;
  const groupLabel = item.group_label ?? GROUP_LABELS[groupKey] ?? 'Kỹ năng chuyên môn';

  let rawTitle = item.normalized_value ?? item.original_value ?? item.requirement ?? item.text ?? item.title ?? '';
  if (typeof rawTitle === 'string' && LANGUAGE_DISPLAY_NAMES[rawTitle.trim().toLowerCase()]) {
    rawTitle = LANGUAGE_DISPLAY_NAMES[rawTitle.trim().toLowerCase()];
  }
  let title = cleanRequirementTitle(String(rawTitle || ''), '');
  if (!title) {
    title = cleanRequirementTitle(String(item.original_value || item.text || item.requirement || ''), groupLabel);
  }

  const defaultCvEvidence = status === 'SUPPORTED'
    ? 'CV có kinh nghiệm/kỹ năng đáp ứng yêu cầu này.'
    : status === 'PARTIALLY_SUPPORTED'
      ? `${title} xuất hiện trong mục Kỹ năng.`
      : 'Chưa tìm thấy bằng chứng phù hợp trong CV.';

  let rawEvidence = bestRelevantEvidence(item, title);
  if (status === 'NOT_FOUND' && (!rawEvidence || rawEvidence === 'Không đề cập trong CV.')) {
    rawEvidence = 'Chưa tìm thấy bằng chứng phù hợp trong CV.';
  } else if (!rawEvidence) {
    rawEvidence = defaultCvEvidence;
  }
  const cvEvidence = cleanVagueText(String(rawEvidence));

  const jdText = cleanVagueText(isUsefulDisplayText(item.jd_text) ? item.jd_text : title);
  const defaultGap = status === 'SUPPORTED'
    ? 'CV đáp ứng tốt yêu cầu này.'
    : status === 'PARTIALLY_SUPPORTED'
      ? `CV có đề cập ${title} trong mục Kỹ năng, nhưng chưa có bằng chứng về việc đã sử dụng ${title} trong dự án hoặc kinh nghiệm thực tế.`
      : 'CV hiện chưa chứng minh yêu cầu này.';

  const suppliedConclusion = item.gap ?? item.comparison ?? item.reason;
  const gapText = cleanVagueText(isUsefulDisplayText(suppliedConclusion) ? suppliedConclusion : defaultGap);

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

/**
 * Normalizes backend match response into canonical Match UI model.
 * 
 * Score and counts are strictly sourced from backend final_score and requirements.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeMatchResult(apiResponse: any): NormalizedMatchResult {
  if (!apiResponse || typeof apiResponse !== 'object') {
    return {
      score: null,
      scoreDisplay: '--%',
      rating: null,
      ratingLabel: '',
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

  let score: number | null = null;
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
  const ratingLabel = rawRating ? (RATING_LABELS[ratingUpper] || String(rawRating)) : '';
  const decisionMessage = DECISION_MESSAGES[ratingUpper] || (
    score !== null && score >= 80
      ? DECISION_MESSAGES.EXCELLENT
      : score !== null && score >= 60
        ? DECISION_MESSAGES.GOOD
        : score !== null && score >= 40
          ? DECISION_MESSAGES.FAIR
        : DECISION_MESSAGES.POOR
  );
  const displayDecisionMessage = decisionMessage.replace(
    /một số khoảng cách quan trọng/gi,
    'một số yêu cầu quan trọng chưa được đáp ứng'
  );

  // 3. REQUIREMENTS & CANONICAL COUNTS
  const resultObj = apiResponse.result || apiResponse || {};
  const reqObj = resultObj.requirements || apiResponse.requirements;

  let matchedReqs: NormalizedRequirement[] = [];
  let partialReqs: NormalizedRequirement[] = [];
  let missingReqs: NormalizedRequirement[] = [];
  let uncertainReqs: NormalizedRequirement[] = [];

  if (reqObj && typeof reqObj === 'object') {
    if (Array.isArray(reqObj.matched)) {
      matchedReqs = reqObj.matched.map((item: any) => mapRequirement(item, item.group || 'skills', 'SUPPORTED'));
    }
    if (Array.isArray(reqObj.partial)) {
      partialReqs = reqObj.partial.map((item: any) => mapRequirement(item, item.group || 'skills', 'PARTIALLY_SUPPORTED'));
    }
    if (Array.isArray(reqObj.missing)) {
      missingReqs = reqObj.missing.map((item: any) => mapRequirement(item, item.group || 'skills', 'NOT_FOUND'));
    }
    if (Array.isArray(reqObj.uncertain)) {
      uncertainReqs = reqObj.uncertain.map((item: any) => mapRequirement(item, item.group || 'skills', 'UNCERTAIN'));
    }
  } else {
    // Fallback if backend returns flat list
    const flatList = Array.isArray(resultObj.requirement_evidence)
      ? resultObj.requirement_evidence
      : Array.isArray(resultObj.evaluated_requirements)
        ? resultObj.evaluated_requirements
        : Array.isArray(resultObj.evidence)
          ? resultObj.evidence
          : [];

    flatList.forEach((item: any) => {
      const st = normalizeStatus(item.status || item.evaluation_status || item.match_status);
      const req = mapRequirement(item, item.group || 'skills', st);
      if (st === 'SUPPORTED') matchedReqs.push(req);
      else if (st === 'PARTIALLY_SUPPORTED') partialReqs.push(req);
      else if (st === 'NOT_FOUND') missingReqs.push(req);
      else uncertainReqs.push(req);
    });
  }

  const backendReqSummary = resultObj.requirement_summary || apiResponse.requirement_summary || null;
  const matchedCount = backendReqSummary && typeof backendReqSummary.supported === 'number' ? backendReqSummary.supported : matchedReqs.length;
  const partialCount = backendReqSummary && typeof backendReqSummary.partial === 'number' ? backendReqSummary.partial : partialReqs.length;
  const missingCount = backendReqSummary && typeof backendReqSummary.missing === 'number' ? backendReqSummary.missing : missingReqs.length;
  const uncertainCount = backendReqSummary && typeof backendReqSummary.uncertain === 'number' ? backendReqSummary.uncertain : uncertainReqs.length;
  const totalCount = backendReqSummary && typeof backendReqSummary.total === 'number' ? backendReqSummary.total : (matchedCount + partialCount + missingCount + uncertainCount);

  const allRequirements = [...matchedReqs, ...partialReqs, ...missingReqs, ...uncertainReqs];

  // 4. SUMMARY
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
  const criteriaList: NormalizedCriterion[] = [];
  const rawCriteria = Array.isArray(resultObj.criteria) ? resultObj.criteria : (Array.isArray(apiResponse.criteria) ? apiResponse.criteria : []);

  if (rawCriteria.length > 0) {
    rawCriteria.forEach((crit: any) => {
      const groupKey = crit.group || 'skills';
      const label = crit.label ?? GROUP_LABELS[groupKey] ?? 'Kỹ năng chuyên môn';
      const icon = GROUP_ICONS[groupKey] || '⚡';

      const critReqIds = new Set(Array.isArray(crit.requirement_ids) ? crit.requirement_ids : []);
      const associatedReqs = critReqIds.size > 0
        ? allRequirements.filter((r) => (r.id && critReqIds.has(r.id)) || (r.requirementId && critReqIds.has(r.requirementId)))
        : allRequirements.filter((r) => r.groupKey === groupKey);

      const cMatched = associatedReqs.filter((r) => r.status === 'SUPPORTED').length;

      criteriaList.push({
        group: groupKey,
        label,
        icon,
        rawScore: crit.raw_score,
        weightedScore: crit.weighted_score,
        status: crit.status,
        statusLabel: crit.status ? (STATUS_TEXT[crit.status] || crit.status) : undefined,
        reason: crit.reason,
        requirements: associatedReqs,
        matchedCount: cMatched,
        totalCount: associatedReqs.length,
        ratioLabel: `${cMatched}/${associatedReqs.length} đáp ứng`,
      });
    });
  } else {
    // Generate criteria groups from allRequirements
    const groupsMap = new Map<string, NormalizedRequirement[]>();
    allRequirements.forEach((r) => {
      const list = groupsMap.get(r.groupKey) || [];
      list.push(r);
      groupsMap.set(r.groupKey, list);
    });

    groupsMap.forEach((reqs, groupKey) => {
      const label = GROUP_LABELS[groupKey] ?? 'Kỹ năng chuyên môn';
      const icon = GROUP_ICONS[groupKey] || '⚡';
      const cMatched = reqs.filter((r) => r.status === 'SUPPORTED').length;
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

  // 6. STRENGTHS & GAPS (Strictly from canonical requirements)
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

  const strengthMap = new Map<string, NormalizedStrength>();
  matchedReqs.forEach((r) => {
    const key = r.title.toLowerCase();
    if (!strengthMap.has(key)) {
      strengthMap.set(key, {
        title: r.title,
        evidence: r.cvText && r.cvText.length > r.title.length ? r.cvText : undefined,
      });
    }
  });
  const strengths = Array.from(strengthMap.values());

  const gapMap = new Map<string, NormalizedGap>();
  [...missingReqs, ...partialReqs, ...uncertainReqs].forEach((r) => {
    const key = r.title.toLowerCase();
    if (!gapMap.has(key)) {
      gapMap.set(key, {
        title: r.title,
        status: r.status as 'PARTIALLY_SUPPORTED' | 'NOT_FOUND' | 'UNCERTAIN',
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
  const hardConstraints: NormalizedHardConstraint[] = [];
  const rawHC = resultObj.eligibility_details || apiResponse.eligibility_details || [];
  if (Array.isArray(rawHC)) {
    rawHC.forEach((item: any) => {
      const hcStatus = String(item.status || '').toUpperCase();
      const hcStatusLabel = hcStatus === 'MATCHED' || hcStatus === 'SUPPORTED' ? 'Đạt' : hcStatus === 'CONFLICT' ? 'Không phù hợp' : 'Chưa xác định';
      hardConstraints.push({
        title: cleanRequirementTitle(item.requirement || item.text || 'Điều kiện bắt buộc'),
        status: hcStatus,
        statusLabel: hcStatusLabel,
        reason: cleanVagueText(item.comparison || item.reason || ''),
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
