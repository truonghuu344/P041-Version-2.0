/**
 * Unified Job Card Renderer & Utilities
 * Dùng chung cho:
 * 1. Top 10 đề xuất theo CV (`top-match`)
 * 2. Toàn bộ catalog việc làm (`catalog`)
 * 3. CV-JD Match job picker (`match-picker`)
 */

export interface NormalizedJobData {
  id: string;
  sourceId: string;
  title: string;
  company: string;
  companyInitial: string;
  logoUrl?: string;
  hasValidLogo: boolean;
  location?: string;
  workMode?: string;
  seniority?: string;
  employmentType?: string;
  salary?: string;
  openings?: number;
  applicantCount?: number;
  postedTimeText?: string;
  deadlineText?: string;
  skills: Array<{ text: string; type: 'required' | 'preferred' | 'general' | 'strength' }>;
  remainingSkillsCount: number;
  remainingSkillsTooltip: string;
  sourceUrl?: string;
  sourcePlatformName: string;
  hasSourceUrl: boolean;
  fitScore?: number;
  scoreVisible: boolean;
  fitLabel: string;
  isMandatoryFailed: boolean;
  summaryText?: string;
}

export interface UnifiedJobCardOptions {
  variant?: 'top-match' | 'catalog' | 'match-picker';
  rank?: number;
  isSelected?: boolean;
  isRetrievalOnly?: boolean;
}

// ── Lucide SVG Icons ──────────────────────────────────────────────────────────

export const LUCIDE_ICONS = {
  mapPin: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`,
  briefcase: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-briefcase-business" aria-hidden="true"><path d="M12 12h.01"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M22 13a18.15 18.15 0 0 1-20 0"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>`,
  walletCards: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wallet-cards" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2"/><path d="M3 11h3c.8 0 1.6.3 2.1.9l1.1.9c.5.6 1.3.9 2.1.9H21"/></svg>`,
  users: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  clock3: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock-3" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16.5 12"/></svg>`,
  calendarDays: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar-days" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>`,
  externalLink: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`,
  checkCircle2: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle-2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  chevronRight: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`,
  alertTriangle: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
};

// ── Helper Utilities ─────────────────────────────────────────────────────────

export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getCompanyInitials(name?: string | null): string {
  const raw = String(name || 'Doanh nghiệp')
    .replace(/^(công ty|cty|tập đoàn|doanh nghiệp|ngân hàng|tổng công ty)\s+/i, '')
    .trim();
  const match = raw.match(/^[a-zA-ZÀ-ỹ0-9]/);
  return match ? match[0].toUpperCase() : 'D';
}

export function formatJobRelativeTimeVi(dateStr?: string | null): string {
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

export function formatJobDeadlineVi(deadlineStr?: string | null): string {
  if (!deadlineStr) return '';
  const clean = String(deadlineStr).trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, , m, d] = match;
    return `${d}/${m}`;
  }
  if (/^\d{1,2}\/\d{1,2}/.test(clean)) return clean;
  return clean;
}

export function getJobSourceName(job: Record<string, unknown>): string {
  if (job.source_name && String(job.source_name).trim() && !/^(none|n\/a|unknown|chưa xác định)$/i.test(String(job.source_name))) {
    return String(job.source_name).trim();
  }
  if (job.source && String(job.source).trim() && !/^(none|n\/a|unknown|chưa xác định)$/i.test(String(job.source))) {
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
  } catch {
    // ignore malformed url
  }
  return 'Nguồn tuyển dụng';
}

function cleanMetaValue(val: unknown): string | undefined {
  if (val === null || val === undefined) return undefined;
  const str = String(val).trim();
  if (!str || /^(unknown|chưa xác định|n\/a|none|undefined|null)$/i.test(str)) return undefined;
  return str;
}

/**
 * Chuẩn hoá dữ liệu JD từ bất kỳ schema backend nào (Top 10 đề xuất, Catalog, hay Match target jobs)
 */
export function normalizeJobData(job: Record<string, unknown>, options: UnifiedJobCardOptions = {}): NormalizedJobData {
  const isCatalog = options.variant === 'catalog' || job.catalog_mode === true;
  const isRetrievalOnly = !isCatalog && (options.isRetrievalOnly || String(job.match_id || '').startsWith('RETRIEVAL_'));

  const id = String(job.job_id || job.id || job.source_id || '').trim();
  const sourceId = String(job.source_id || job.id || job.job_id || '').trim();
  const title = String(job.title || 'Vị trí tuyển dụng').trim();
  const company = String(job.company || job.company_name || 'Doanh nghiệp tuyển dụng').trim();
  const companyInitial = getCompanyInitials(company);

  const logoUrl = String(job.company_logo || job.logo_url || '').trim();
  const hasValidLogo = /^https?:\/\//i.test(logoUrl) || (logoUrl.startsWith('/') && !logoUrl.includes('placeholder'));

  const location = cleanMetaValue(job.location);
  const workMode = cleanMetaValue(job.work_mode || job.remote_type);
  const seniority = cleanMetaValue(job.seniority || job.job_level);
  const employmentType = cleanMetaValue(job.employment_type);

  // Salary
  let salary: string | undefined;
  const rawSalary = cleanMetaValue(job.salary || job.salary_range);
  if (rawSalary) {
    salary = rawSalary.toLowerCase() === 'negotiable' ? 'Thỏa thuận' : rawSalary;
  }

  // Openings (Số lượng tuyển)
  let openings: number | undefined;
  const rawOpenings = job.openings ?? job.quantity;
  if (rawOpenings !== undefined && rawOpenings !== null && Number(rawOpenings) > 0) {
    openings = Number(rawOpenings);
  }

  // Applicant count
  let applicantCount: number | undefined;
  if (typeof job.applicant_count === 'number' && job.applicant_count > 0) {
    applicantCount = job.applicant_count;
  }

  // Timeline
  const postedTimeText = formatJobRelativeTimeVi(
    typeof job.posted_at === 'string'
      ? job.posted_at
      : typeof job.created_at === 'string'
      ? job.created_at
      : typeof job.crawl_date === 'string'
      ? job.crawl_date
      : undefined,
  );
  const deadlineText = formatJobDeadlineVi(
    typeof job.deadline === 'string'
      ? job.deadline
      : typeof job.application_deadline === 'string'
      ? job.application_deadline
      : undefined,
  );

  // Source link
  const rawSourceUrl = String(job.source_url || '').trim();
  const hasSourceUrl = /^https?:\/\//i.test(rawSourceUrl);
  const sourcePlatformName = getJobSourceName(job);

  // Fit & Confidence
  const mandatoryGate =
    typeof job.mandatory_gate === 'object' && job.mandatory_gate !== null
      ? (job.mandatory_gate as { failed?: boolean })
      : null;
  const isMandatoryFailed = Boolean(
    job.mandatory_requirement_failed === true ||
      job.mandatory_failed === true ||
      Boolean(mandatoryGate?.failed),
  );
  const scoreVisible = job.score_display_allowed === true && !isCatalog;
  const fitScore = scoreVisible ? Math.round(Number(job.display_fit_score ?? 0)) : undefined;

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
  } else if (fitScore !== undefined) {
    fitLabel = fitScore >= 80 ? 'Phù hợp cao' : fitScore >= 50 ? 'Phù hợp' : 'Cần cải thiện';
  }

  // Skills processing (Required / Preferred / General / Strengths)
  const rawRequiredSkills = Array.isArray(job.required_skills) && job.required_skills.length
    ? job.required_skills
    : (Array.isArray(job.must_have_skills) ? job.must_have_skills : []);
  const rawPreferredSkills = Array.isArray(job.preferred_skills) && job.preferred_skills.length
    ? job.preferred_skills
    : (Array.isArray(job.nice_to_have_skills) ? job.nice_to_have_skills : []);
  const rawStrengths = Array.isArray(job.top_strengths) ? job.top_strengths : [];
  const allGeneralSkills = Array.isArray(job.skills) ? job.skills : [];

  let skillItems: Array<{ text: string; type: 'required' | 'preferred' | 'general' | 'strength' }> = [];
  let remainingList: string[] = [];

  if (options.variant === 'top-match' && rawStrengths.length > 0) {
    const compactStrength = (s: string) => {
      const clean = String(s || '').replace(/\s+/g, ' ').replace(/^#+\s*/, '').replace(/^[✓⚠△]\s*/, '').trim();
      return clean.length > 45 ? clean.slice(0, 42) + '...' : clean;
    };
    const strengths = rawStrengths.map(compactStrength);
    skillItems = strengths.slice(0, 3).map(text => ({ text, type: 'strength' }));
    remainingList = strengths.slice(3);
  } else if (rawRequiredSkills.length > 0 || rawPreferredSkills.length > 0) {
    const reqSlice = rawRequiredSkills.slice(0, 3);
    const prefSlice = rawPreferredSkills.slice(0, Math.max(0, 4 - reqSlice.length));
    skillItems = [
      ...reqSlice.map((text: string) => ({ text, type: 'required' as const })),
      ...prefSlice.map((text: string) => ({ text, type: 'preferred' as const })),
    ];
    remainingList = [
      ...rawRequiredSkills.slice(reqSlice.length),
      ...rawPreferredSkills.slice(prefSlice.length),
    ];
  } else if (allGeneralSkills.length > 0) {
    const visible = allGeneralSkills.slice(0, 4);
    skillItems = visible.map((text: string) => ({ text, type: 'general' as const }));
    remainingList = allGeneralSkills.slice(4);
  }

  // Clean Summary text (No raw Markdown headers ###)
  let rawSummary = '';
  if (options.variant === 'top-match') {
    if (typeof job.summary_evidence_line === 'string') {
      rawSummary = job.summary_evidence_line;
    } else if (
      typeof job.mandatory_requirements_matched === 'number' &&
      typeof job.total_mandatory_requirements === 'number' &&
      job.total_mandatory_requirements > 0
    ) {
      rawSummary = `${job.mandatory_requirements_matched}/${job.total_mandatory_requirements} yêu cầu cốt lõi được đáp ứng`;
    } else if (typeof job.required_skills_coverage === 'number' && job.required_skills_coverage > 0) {
      rawSummary = `Đáp ứng ${Math.round(job.required_skills_coverage * 100)}% yêu cầu bắt buộc`;
    }
  }
  const summaryText = rawSummary
    ? String(rawSummary).replace(/^#+\s*/, '').replace(/\*\*([^*]+)\*\*/g, '$1').trim()
    : undefined;

  return {
    id,
    sourceId,
    title,
    company,
    companyInitial,
    logoUrl: hasValidLogo ? logoUrl : undefined,
    hasValidLogo,
    location,
    workMode,
    seniority,
    employmentType,
    salary,
    openings,
    applicantCount,
    postedTimeText: postedTimeText || undefined,
    deadlineText: deadlineText || undefined,
    skills: skillItems,
    remainingSkillsCount: remainingList.length,
    remainingSkillsTooltip: remainingList.join(', '),
    sourceUrl: hasSourceUrl ? rawSourceUrl : undefined,
    sourcePlatformName,
    hasSourceUrl,
    fitScore,
    scoreVisible,
    fitLabel,
    isMandatoryFailed,
    summaryText,
  };
}

/**
 * Sinh mã HTML hoàn chỉnh cho thẻ JD Unified Job Card.
 */
export function renderUnifiedJobCardHtml(job: Record<string, unknown>, options: UnifiedJobCardOptions = {}): string {
  const data = normalizeJobData(job, options);
  const variant = options.variant || (job.catalog_mode ? 'catalog' : 'top-match');
  const isSelected = Boolean(options.isSelected);
  const rank = options.rank;

  // 1. Logo HTML with deterministic letter fallback
  const logoHtml = data.hasValidLogo
    ? `<div class="top-job-logo-wrap">
        <img src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(data.company)}" class="top-job-logo-img" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<span class=\\'top-job-logo-initial\\'>${escapeHtml(data.companyInitial)}</span>'">
      </div>`
    : `<div class="top-job-logo-wrap">
        <span class="top-job-logo-initial">${escapeHtml(data.companyInitial)}</span>
      </div>`;

  // 2. Rank badge (Top 10 or catalog)
  const rankBadgeHtml = (variant === 'top-match' && rank)
    ? `<span class="top-job-rank-badge">#${rank}</span>`
    : '';

  // 3. Score or Status badge (Header right)
  let badgeBlockHtml = '';
  if (variant === 'match-picker') {
    // In match picker: Radio button is rendered on the right
    badgeBlockHtml = `
      <button type="button" class="p1-job-card-radio${isSelected ? ' is-selected' : ''}" data-action="select-job" aria-label="Chọn công việc ${escapeHtml(data.title)}" title="${isSelected ? 'Đang chọn vị trí này' : 'Chọn vị trí này để Match'}"></button>
    `;
  } else if (variant === 'catalog') {
    badgeBlockHtml = `<div class="top-job-catalog-badge">${escapeHtml(data.fitLabel)}</div>`;
  } else {
    // top-match
    if (data.scoreVisible && data.fitScore !== undefined) {
      badgeBlockHtml = `
        <div class="top-job-score-block">
          <div class="top-job-fit-score ${data.isMandatoryFailed ? 'is-mandatory-failed' : ''}">${data.fitScore}%</div>
          <div class="top-job-fit-badge ${data.isMandatoryFailed ? 'is-mandatory-failed' : ''}">${escapeHtml(data.fitLabel)}</div>
        </div>
      `;
    } else {
      badgeBlockHtml = `
        <div class="top-job-score-block">
          <div class="top-job-fit-badge ${data.isMandatoryFailed ? 'is-mandatory-failed' : ''}">${escapeHtml(data.fitLabel)}</div>
        </div>
      `;
    }
  }

  // 4. Core Metadata (Location · Work mode · Seniority · Employment type)
  const metaItems: string[] = [];
  if (data.location) {
    metaItems.push(`<span class="top-job-meta-item">${LUCIDE_ICONS.mapPin}<span>${escapeHtml(data.location)}</span></span>`);
  }
  if (data.workMode) {
    metaItems.push(`<span class="top-job-meta-item">${escapeHtml(data.workMode)}</span>`);
  }
  if (data.seniority) {
    metaItems.push(`<span class="top-job-meta-item">${escapeHtml(data.seniority)}</span>`);
  }
  if (data.employmentType) {
    metaItems.push(`<span class="top-job-meta-item">${escapeHtml(data.employmentType)}</span>`);
  }
  const coreMetaRowHtml = metaItems.length
    ? `<div class="top-job-core-meta-row">${metaItems.join('<span class="top-job-meta-dot" aria-hidden="true">·</span>')}</div>`
    : '';

  // 5. Hiring Highlights: Openings & Salary & Applicants
  const highlightPills: string[] = [];
  if (data.salary) {
    highlightPills.push(`
      <span class="top-job-highlight-pill pill-salary" title="Mức lương">
        ${LUCIDE_ICONS.walletCards}
        <span>${escapeHtml(data.salary)}</span>
      </span>
    `);
  }
  if (data.openings) {
    highlightPills.push(`
      <span class="top-job-highlight-pill pill-openings" title="Số lượng tuyển dụng">
        ${LUCIDE_ICONS.users}
        <span>Tuyển ${escapeHtml(String(data.openings))} người</span>
      </span>
    `);
  }
  if (data.applicantCount) {
    highlightPills.push(`
      <span class="top-job-highlight-pill pill-applicants" title="Số lượng ứng viên đã nộp hồ sơ">
        ${LUCIDE_ICONS.briefcase}
        <span>${escapeHtml(String(data.applicantCount))} ứng viên</span>
      </span>
    `);
  }
  const hiringHighlightsHtml = highlightPills.length
    ? `<div class="top-job-hiring-row">${highlightPills.join('')}</div>`
    : '';

  // 6. Skills Tags
  const skillTagsHtml = data.skills.map(s => {
    let iconPrefix = '';
    if (s.type === 'required' || s.type === 'strength') {
      iconPrefix = `<span class="tag-icon tag-icon-req">✓</span>`;
    } else if (s.type === 'preferred') {
      iconPrefix = `<span class="tag-icon tag-icon-pref">✦</span>`;
    }
    return `<span class="top-job-tag is-${escapeHtml(s.type)}">${iconPrefix}${escapeHtml(s.text)}</span>`;
  }).join('');

  const moreSkillsHtml = data.remainingSkillsCount > 0
    ? `<span class="top-job-tag is-more" title="Các kỹ năng khác: ${escapeHtml(data.remainingSkillsTooltip)}">+${data.remainingSkillsCount} kỹ năng</span>`
    : '';

  const skillsSectionHtml = (skillTagsHtml || moreSkillsHtml)
    ? `<div class="top-job-card-skills"><div class="top-job-tags-wrap">${skillTagsHtml}${moreSkillsHtml}</div></div>`
    : '';

  // 7. Timeline (Posted time · Deadline)
  const timelineItems: string[] = [];
  if (data.postedTimeText) {
    timelineItems.push(`
      <span class="top-job-timeline-item" title="Thời gian đăng tuyển">
        ${LUCIDE_ICONS.clock3}
        <span>${escapeHtml(data.postedTimeText)}</span>
      </span>
    `);
  }
  if (data.deadlineText) {
    timelineItems.push(`
      <span class="top-job-timeline-item" title="Hạn nộp hồ sơ">
        ${LUCIDE_ICONS.calendarDays}
        <span>Hạn ứng tuyển: <strong>${escapeHtml(data.deadlineText)}</strong></span>
      </span>
    `);
  }
  const timelineRowHtml = timelineItems.length
    ? `<div class="top-job-timeline-row">${timelineItems.join('<span class="top-job-meta-dot" aria-hidden="true">·</span>')}</div>`
    : '';

  // 8. Summary / Mandatory warning (for top-match)
  const summaryLineHtml = data.summaryText
    ? `<div class="top-job-summary-line"><span class="summary-line-dot"></span><span class="summary-line-text">${escapeHtml(data.summaryText)}</span></div>`
    : '';

  const mandatoryWarningHtml = data.isMandatoryFailed && variant === 'top-match'
    ? `<div class="top-job-mandatory-warning" role="alert">
        ${LUCIDE_ICONS.alertTriangle}
        <div class="mandatory-warning-text">
          <strong>Thiếu yêu cầu bắt buộc</strong>
          <span>Điểm hiển thị đã được giới hạn tối đa 49%.</span>
        </div>
      </div>`
    : '';

  // 9. Source Link
  const sourceLinkHtml = data.hasSourceUrl
    ? `<a class="btn-job-source job-source-verify-link" href="${escapeHtml(data.sourceUrl)}" target="_blank" rel="noopener noreferrer" title="Mở tin tuyển dụng gốc trên ${escapeHtml(data.sourcePlatformName)}" onclick="event.stopPropagation();">
        <span class="source-platform-prefix">Nguồn: ${escapeHtml(data.sourcePlatformName)}</span>
        <span class="source-link-action">Xem tin tuyển dụng gốc ${LUCIDE_ICONS.externalLink}</span>
      </a>`
    : '<div class="top-job-source-spacer"></div>';

  // 10. Main CTA Button
  let mainCtaButtonHtml = '';
  if (variant === 'match-picker') {
    mainCtaButtonHtml = `
      <button type="button" class="btn-job-details btn-choose-job-match" data-action="select-job">
        ${isSelected ? '✓ Đã chọn' : 'Chọn để Match'}
      </button>
    `;
  } else {
    mainCtaButtonHtml = `
      <button type="button" class="btn-job-details btn-view-job-spec" data-job-details-id="${escapeHtml(data.id)}">
        Xem chi tiết
      </button>
    `;
  }

  // Construct card container attributes
  const cardClasses = [
    'top-job-card',
    variant === 'match-picker' ? 'p1-job-card' : '',
    isSelected ? 'is-selected' : '',
    data.isMandatoryFailed && variant === 'top-match' ? 'is-mandatory-failed' : '',
  ].filter(Boolean).join(' ');

  const datasetAttr = variant === 'match-picker'
    ? `data-target-job="${escapeHtml(data.sourceId)}"`
    : `data-job-id="${escapeHtml(data.id)}"`;

  const ariaLabel = variant === 'match-picker'
    ? `Chọn vị trí ${escapeHtml(data.title)} tại ${escapeHtml(data.company)}`
    : `Xem chi tiết ${escapeHtml(data.title)} tại ${escapeHtml(data.company)}`;

  return `
    <article class="${cardClasses}" ${datasetAttr} tabindex="0" role="button" aria-label="${ariaLabel}" ${isSelected ? 'aria-pressed="true"' : ''}>
      <!-- Top Row: Logo + Titles + Rank/Fit/Radio -->
      <div class="top-job-card-header">
        <div class="top-job-header-left">
          ${logoHtml}
          <div class="top-job-main-meta">
            <div class="top-job-title-row">
              ${rankBadgeHtml}
              <h3 class="top-job-title" title="${escapeHtml(data.title)}">${escapeHtml(data.title)}</h3>
            </div>
            <div class="top-job-company-name" title="${escapeHtml(data.company)}">${escapeHtml(data.company)}</div>
          </div>
        </div>
        ${badgeBlockHtml}
      </div>

      <!-- Core Metadata Row (Location · Work mode · Seniority · Employment) -->
      ${coreMetaRowHtml}

      <!-- Hiring Highlights (Salary · Openings · Applicants) -->
      ${hiringHighlightsHtml}

      <!-- Mandatory Warning if any -->
      ${mandatoryWarningHtml}

      <!-- Skills with Required/Preferred/More -->
      ${skillsSectionHtml}

      <!-- Timeline (Posted time · Deadline) -->
      ${timelineRowHtml}

      <!-- Card Footer -->
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
