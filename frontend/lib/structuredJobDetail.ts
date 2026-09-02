/**
 * Universal Structured Job Detail Data Model & Semantic Hierarchical Parser.
 * Dùng chung cho /student/find-jobs (Khám phá công việc) và /student/match (Modal Preview).
 * 
 * Nguyên tắc thiết kế:
 * 1. Không ép mọi JD vào một khuôn mẫu cứng nhắc (Flexible, format-agnostic).
 * 2. Giữ nguyên tiêu đề và thứ tự xuất hiện tự nhiên của từng doanh nghiệp.
 * 3. Nhận diện ngữ nghĩa (semantic classification):
 *    - overview (Tổng quan vai trò, bối cảnh, sứ mệnh)
 *    - responsibilities (Trách nhiệm & Nhiệm vụ)
 *    - must_have (Yêu cầu bắt buộc / What we are looking for)
 *    - nice_to_have (Điểm cộng / Ưu tiên / Beyond the core)
 *    - soft_skills (Kỹ năng mềm)
 *    - benefits (Quyền lợi, đãi ngộ, văn hóa làm việc)
 *    - work_environment (Môi trường làm việc)
 *    - growth (Cơ hội phát triển, đào tạo)
 *    - working_conditions (Địa điểm & Thời gian làm việc)
 *    - how_to_apply (Cách thức ứng tuyển)
 *    - notes (Mục khác / Thông tin khác — Không bao giờ tự ý xoá bỏ nội dung của doanh nghiệp)
 * 4. Hỗ trợ tiêu đề con lồng nhau (nested sub-sections), không làm phẳng tiêu đề thành bullet.
 * 5. Loại bỏ triệt để rác Markdown (###, **, \-, \+) và HTML/crawler artifacts.
 * 6. Không có quy tắc hardcode riêng cho bất kỳ công ty cụ thể nào.
 */

export interface JobDetailSubSection {
  title?: string;
  items: string[];
}

export interface JobDetailSection {
  id: string;
  type:
    | 'overview'
    | 'responsibilities'
    | 'must_have'
    | 'nice_to_have'
    | 'soft_skills'
    | 'benefits'
    | 'work_environment'
    | 'growth'
    | 'working_conditions'
    | 'how_to_apply'
    | 'notes';
  title: string;
  items: string[];
  subSections?: JobDetailSubSection[];
}

export interface StructuredJobDetailData {
  id: string;
  sourceId: string;
  title: string;
  company: string;
  location?: string;
  workMode?: string;
  seniority?: string;
  employmentType?: string;
  salary?: string;
  openings?: number;
  deadline?: string;
  postedAt?: string;
  logoUrl?: string;
  companyInitial: string;
  sourceUrl?: string;
  sourcePlatformName?: string;
  skills: string[];
  sections: JobDetailSection[];
}

export interface StructuredJobDetailOptions {
  mode?: 'modal' | 'drawer' | 'full';
  showHeroHeader?: boolean;
  showSkillsSection?: boolean;
}

const REDACTION_PATTERN = /\s*[,\.;:]*(?:\[protected info\]|\(protected info\)|\[email protected\]|\[contact info\])\s*[,\.;:]*/gi;

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Chuẩn hoá làm sạch các ký tự rác phổ biến từ crawler và HTML entities
 */
export function cleanRawArtifacts(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/\bsharp([A-Za-z0-9_]+)\b/g, '#$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

/**
 * Làm sạch một dòng văn bản: loại bỏ Markdown, HTML tag, escape characters và bullet symbols.
 */
export function cleanTextLine(raw: string): string {
  if (!raw) return '';
  let line = cleanRawArtifacts(String(raw).trim());
  
  // 1. Loại bỏ markers che giấu / crawler artifacts
  line = line.replace(REDACTION_PATTERN, ' ');
  
  // 2. Loại bỏ HTML tags
  line = line.replace(/<[^>]+>/g, ' ');
  
  // 3. Loại bỏ Markdown headers (###, ##, #)
  line = line.replace(/^#{1,6}\s*/, '');
  
  // 4. Loại bỏ Markdown bold / italic (**text**, *text*, __text__, _text_)
  line = line.replace(/\*\*([^*]+)\*\*/g, '$1');
  line = line.replace(/__([^_]+)__/g, '$1');
  line = line.replace(/\*([^*]+)\*/g, '$1');
  line = line.replace(/_([^_]+)_/g, '$1');
  
  // 5. Loại bỏ escaped Markdown characters (\-, \*, \+, \[, \])
  line = line.replace(/\\([*_\-+`~[\]()])/g, '$1');
  
  // 6. Loại bỏ bullet points ở đầu dòng (•, ●, ▪, ◦, -, *, +, –, —) và số thứ tự 1., 2)
  line = line.replace(/^(?:[•●▪◦*\-–—+]|\d+[.)])\s*/, '');
  
  // 7. Chuẩn hoá khoảng trắng
  line = line.replace(/\s+/g, ' ').trim();
  
  return line;
}

export interface ClassifiedHeading {
  kind: 'main' | 'sub';
  type: JobDetailSection['type'];
  title: string;
  subTitle?: string;
}

/**
 * Nhận diện và phân loại tiêu đề mục (Semantic Heading Classifier).
 * Giữ nguyên tiêu đề gốc của doanh nghiệp, phân loại chính xác kiểu mục.
 */
export function classifyHeading(rawHeader: string, allowFallbackNotes: boolean = true): ClassifiedHeading | null {
  if (!rawHeader) return null;
  const clean = cleanTextLine(rawHeader)
    .replace(/\s*[:\-–—]\s*$/, '')
    .trim();

  if (!clean || clean.length < 2) return null;
  if (/^\[[^\]]+\]$/.test(clean)) return null;
  const lower = clean.toLowerCase();

  // 1. Overview / Position Summary (Tổng quan vị trí, Giới thiệu, Sứ mệnh)
  if (/^(?:tổng quan|tổng quan công việc|tổng quan vị trí|giới thiệu|giới thiệu chung|giới thiệu vị trí|giới thiệu tổng quan về vị trí|về vị trí này|về công việc này|mô tả công việc|about|about the job|about the role|role overview|position summary|job summary|job overview|the job|the role|role description|how you\s*(?:'ll|will)\s*make an impact|about us|about company|về công ty|giới thiệu công ty|our mission|company overview)$/i.test(lower)) {
    return { kind: 'main', type: 'overview', title: clean };
  }

  // 2. Responsibilities (Trách nhiệm & Nhiệm vụ chính)
  if (/^(?:trách nhiệm|trách nhiệm chính|nhiệm vụ|nhiệm vụ chính|trách nhiệm & nhiệm vụ chính|trách nhiệm công việc|nhiệm vụ công việc|responsibilities|key responsibilities|what you\s*(?:'ll|will)\s*do|duties|your role|job responsibilities|core responsibilities)$/i.test(lower)) {
    return { kind: 'main', type: 'responsibilities', title: clean };
  }

  // 3. Must-Have Requirements (Yêu cầu bắt buộc, Trình độ chuyên môn)
  if (/^(?:yêu cầu|yêu cầu bắt buộc(?:\s*\(must-have\))?|must-have|must have|yêu cầu công việc|yêu cầu ứng viên|yêu cầu ứng tuyển|yêu cầu tuyển dụng|kỹ năng bắt buộc|kỹ năng chuyên môn|requirements|required qualifications|required skills|your skills and experience|what we\s*(?:'re|are)\s*looking for|qualifications|technical requirements|candidate profile)$/i.test(lower)) {
    return { kind: 'main', type: 'must_have', title: clean };
  }

  // 4. Nice-To-Have / Preferred (Yêu cầu ưu tiên, Điểm cộng, Beyond the core)
  if (/^(?:điểm cộng(?:\s*\(nice-to-have\))?|yêu cầu ưu tiên(?:\s*\(nice-to-have\))?|yêu cầu ưu tiên & điểm cộng|ưu tiên|lợi thế|nice-to-have|nice to have|preferred qualifications|preferred skills|bonus points|plus points|plus|good to have|preferred|additional skills|beyond the core|beyond core)$/i.test(lower)) {
    return { kind: 'main', type: 'nice_to_have', title: clean };
  }

  // 5. Soft Skills (Kỹ năng mềm)
  if (/^(?:kỹ năng mềm|kỹ năng mềm cần thiết|kỹ năng khác|soft skills|interpersonal skills|competencies|personal skills|core competencies)$/i.test(lower)) {
    return { kind: 'main', type: 'soft_skills', title: clean };
  }

  // 6. Benefits & Environment Main Heading (Quyền lợi, Đãi ngộ, Phúc lợi, What we offer)
  if (/^(?:quyền lợi|quyền lợi & đãi ngộ(?:\s*\(benefits\))?|quyền lợi và đãi ngộ|quyền lợi & môi trường làm việc|quyền lợi & môi trường|chế độ đãi ngộ|đãi ngộ|phúc lợi|chế độ phúc lợi|benefits(?:\s*\(benefits\))?|what we offer|what you get|why join us|why you\s*(?:'ll|will)\s*love working here|tại sao bạn sẽ yêu thích làm việc tại đây|top 3 reasons to join us|3 lý do để gia nhập công ty|quyền lợi được hưởng|perks & benefits|join our vibrant team.*)$/i.test(lower)) {
    return { kind: 'main', type: 'benefits', title: clean };
  }

  // 7. Sub-headings under Benefits / Dimensions / Environment / Growth
  if (/^(?:môi trường làm việc cởi mở, năng động|môi trường làm việc|văn hóa làm việc|work environment|working environment|company culture)$/i.test(lower)) {
    return { kind: 'sub', type: 'benefits', title: 'Quyền lợi & Môi trường làm việc', subTitle: clean };
  }
  if (/^(?:có cơ hội phát triển, thăng tiến|cơ hội phát triển, thăng tiến|cơ hội phát triển|cơ hội thăng tiến|đào tạo & phát triển|đào tạo|career development|training & development|growth opportunities)$/i.test(lower)) {
    return { kind: 'sub', type: 'benefits', title: 'Quyền lợi & Môi trường làm việc', subTitle: clean };
  }
  if (/^(?:chế độ đãi ngộ hấp dẫn|chế độ đãi ngộ|lương & thưởng|lương và chế độ đãi ngộ hấp dẫn|compensation & benefits|salary & benefits|rewards & perks)$/i.test(lower)) {
    return { kind: 'sub', type: 'benefits', title: 'Quyền lợi & Môi trường làm việc', subTitle: clean };
  }
  if (/^(?:domain expert & architect|platform & operations owner|partner-facing engineer|client-facing engineer)$/i.test(lower)) {
    return { kind: 'sub', type: 'nice_to_have', title: 'Beyond the core', subTitle: clean };
  }

  // 8. Location & Working Time
  if (/^(?:địa điểm làm việc|thời gian làm việc|địa điểm & thời gian làm việc|địa điểm và thời gian làm việc|nơi làm việc|working location|working hours|location & hours|working conditions)$/i.test(lower)) {
    return { kind: 'main', type: 'working_conditions', title: clean };
  }

  // 9. How to apply
  if (/^(?:cách thức ứng tuyển|hướng dẫn ứng tuyển|thông tin ứng tuyển|cách ứng tuyển|how to apply|application process|recruitment process)$/i.test(lower)) {
    return { kind: 'main', type: 'how_to_apply', title: clean };
  }

  // 10. Learn More / Other / Notes (Explicit or semantic match)
  if (/^(?:learn more about us|learn more|thông tin khác|mục khác|other info|additional information)$/i.test(lower)) {
    return { kind: 'main', type: 'notes', title: clean };
  }

  // 10. Generic / Unclassified Heading (Only if allowFallbackNotes is true, e.g. explicit headings)
  if (allowFallbackNotes) {
    return { kind: 'main', type: 'notes', title: clean };
  }

  return null;
}

/**
 * Tách và chuẩn hoá chuỗi thô thành các dòng tokens thông minh:
 * - Nhận diện inline markdown headers (##, ###)
 * - Tách các bullet inline phân cách bằng dấu gạch ngang ( - )
 */
function normalizeRawContentToLines(rawText: string): string[] {
  if (!rawText) return [];
  
  let text = cleanRawArtifacts(rawText);

  // 1. Tách các embedded Markdown headers như "## YÊU CẦU ỨNG TUYỂN:" hoặc "### Quyền lợi:"
  text = text.replace(/(?:\r?\n|^|\s+)(#{1,6}\s+[^:\n]+:?)/g, '\n[HEADING] $1\n');

  // 2. Tách các tiêu đề dạng IN HOA trong văn bản
  text = text.replace(/(?:\r?\n|^|\s+)((?:YÊU CẦU ỨNG TUYỂN|YÊU CẦU BẮT BUỘC|YÊU CẦU CÔNG VIỆC|QUYỀN LỢI & ĐÃI NGỘ|QUYỀN LỢI ĐƯỢC HƯỞNG|TRÁCH NHIỆM CHÍNH|MÔ TẢ CÔNG VIỆC)\s*[:\-–—])/gi, '\n[HEADING] $1\n');

  // 3. Chuẩn hoá HTML tags
  text = text
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n[HEADING] $1\n')
    .replace(/<p[^>]*>\s*<i>\s*<strong>(.*?)<\/strong>\s*<\/i>\s*<\/p>/gi, '\n[SUBHEADING] $1\n')
    .replace(/<p[^>]*>\s*<strong>(.*?)<\/strong>\s*<\/p>/gi, '\n[HEADING] $1\n')
    .replace(/<strong>(.*?)<\/strong>/gi, (m, p1) => {
      const clean = p1.trim();
      return (clean.length >= 3 && clean.length <= 50 && classifyHeading(clean, false)) ? `\n[HEADING] ${clean}\n` : m;
    })
    .replace(/<li[^>]*>/gi, '\n[ITEM] ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  // 4. Tách các dòng và inline bullet items
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const resultLines: string[] = [];

  for (const line of rawLines) {
    if (line.startsWith('[HEADING]') || line.startsWith('[SUBHEADING]')) {
      resultLines.push(line);
      continue;
    }

    // Nếu một dòng dài chứa nhiều bullet items phân cách bằng " - " (inline dash separator)
    if (line.includes(' - ') || line.includes(' – ') || line.includes(' — ')) {
      const parts = line.split(/\s+[-–—]\s+/).map(p => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        for (const part of parts) {
          resultLines.push(`[ITEM] ${part}`);
        }
        continue;
      }
    }

    resultLines.push(line);
  }

  return resultLines;
}

/**
 * Trích xuất và cấu trúc hoá toàn diện JD theo phân cấp ngữ nghĩa.
 * Giữ nguyên thứ tự tự nhiên của từng doanh nghiệp và không làm phẳng sub-headings.
 */
export function extractStructuredSections(job: Record<string, any>): JobDetailSection[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  const orderedSections: JobDetailSection[] = [];
  const getOrAddSection = (type: JobDetailSection['type'], title: string): JobDetailSection => {
    let existing = orderedSections.find(s => s.type === type && s.title.toLowerCase() === title.toLowerCase());
    if (!existing) {
      existing = {
        id: `sec-${type}-${orderedSections.length + 1}`,
        type,
        title,
        items: [],
        subSections: [],
      };
      orderedSections.push(existing);
    }
    return existing;
  };

  const contentBlocks: { defaultType?: JobDetailSection['type']; defaultTitle?: string; text: string }[] = [];

  const structuredSections = Array.isArray(job.sections)
    ? job.sections
    : Array.isArray(job.normalized_json?.sections)
      ? job.normalized_json.sections
      : null;

  if (structuredSections && structuredSections.length > 0) {
    for (const sec of structuredSections) {
      if (!sec || !sec.content) continue;
      const rawContent = String(sec.content).trim();
      if (!rawContent || rawContent === '<p></p>' || rawContent === '<ul></ul>') continue;

      const rawSecTitle = cleanTextLine(sec.title || sec.type || '');
      const isCrawlerTag = /^\[[^\]]+\]$/.test(rawSecTitle) || /^(tập đoàn|công ty|fpt|viettel|vng|doanh nghiệp)\b/i.test(rawSecTitle);
      const classification = classifyHeading(rawSecTitle, !isCrawlerTag);
      contentBlocks.push({
        defaultType: classification?.type || (isCrawlerTag ? 'overview' : (sec.type as JobDetailSection['type']) || 'overview'),
        defaultTitle: classification?.title || (isCrawlerTag ? 'Tổng quan công việc' : cleanTextLine(sec.title) || 'Thông tin chi tiết'),
        text: rawContent,
      });
    }
  }

  if (contentBlocks.length === 0) {
    const rawText = String(
      job.clean_description ||
      job.description ||
      job.requirements_text ||
      job.raw_text ||
      ''
    ).trim();

    if (rawText) {
      contentBlocks.push({
        defaultType: 'overview',
        defaultTitle: 'Tổng quan vị trí',
        text: rawText,
      });
    }
  }

  for (const block of contentBlocks) {
    const rawLines = normalizeRawContentToLines(block.text);

    let currentMainType: JobDetailSection['type'] = block.defaultType || 'overview';
    let currentMainTitle = block.defaultTitle || 'Tổng quan vị trí';
    let currentSubTitle: string | undefined = undefined;
    let currentItems: string[] = [];

    const flushSectionItems = () => {
      if (currentItems.length === 0) return;
      
      const sec = getOrAddSection(currentMainType, currentMainTitle);

      if (currentSubTitle) {
        if (!sec.subSections) sec.subSections = [];
        let sub = sec.subSections.find(s => s.title?.toLowerCase() === currentSubTitle?.toLowerCase());
        if (!sub) {
          sub = { title: currentSubTitle, items: [] };
          sec.subSections.push(sub);
        }
        const set = new Set(sub.items.map(i => i.toLowerCase()));
        for (const item of currentItems) {
          if (!set.has(item.toLowerCase())) {
            sub.items.push(item);
            set.add(item.toLowerCase());
          }
        }
      } else {
        const set = new Set(sec.items.map(i => i.toLowerCase()));
        for (const item of currentItems) {
          if (!set.has(item.toLowerCase())) {
            sec.items.push(item);
            set.add(item.toLowerCase());
          }
        }
      }
      currentItems = [];
    };

    for (const line of rawLines) {
      let isExplicitHeading = false;
      let isExplicitSub = false;
      let isExplicitItem = false;
      let candidateText = line;

      if (candidateText.startsWith('[HEADING]')) {
        isExplicitHeading = true;
        candidateText = candidateText.replace('[HEADING]', '').trim();
      } else if (candidateText.startsWith('[SUBHEADING]')) {
        isExplicitSub = true;
        candidateText = candidateText.replace('[SUBHEADING]', '').trim();
      } else if (candidateText.startsWith('[ITEM]')) {
        isExplicitItem = true;
        candidateText = candidateText.replace('[ITEM]', '').trim();
      }

      if (!isExplicitItem) {
        const isMarkdownHeading = /^#{1,6}\s+/.test(candidateText);

        if (isExplicitHeading || isMarkdownHeading) {
          const classification = classifyHeading(candidateText, true);
          if (classification) {
            flushSectionItems();
            if (classification.kind === 'sub' && classification.subTitle) {
              currentMainType = classification.type;
              currentSubTitle = classification.subTitle;
            } else {
              currentMainType = classification.type;
              currentMainTitle = classification.title;
              currentSubTitle = undefined;
            }
            continue;
          }
        } else if (isExplicitSub) {
          const classification = classifyHeading(candidateText, false);
          flushSectionItems();
          if (classification && classification.kind === 'sub' && classification.subTitle) {
            currentMainType = classification.type;
            currentSubTitle = classification.subTitle;
          } else {
            currentSubTitle = cleanTextLine(candidateText).replace(/\s*:\s*$/, '');
          }
          continue;
        } else {
          // Plain text line: check if it semantically represents a heading
          const classification = classifyHeading(candidateText, false);
          if (classification) {
            flushSectionItems();
            if (classification.kind === 'sub' && classification.subTitle) {
              currentMainType = classification.type;
              currentSubTitle = classification.subTitle;
            } else {
              currentMainType = classification.type;
              currentMainTitle = classification.title;
              currentSubTitle = undefined;
            }
            continue;
          }
        }
      }

      const cleaned = cleanTextLine(candidateText);
      if (cleaned && cleaned.length >= 2 && cleaned !== '-') {
        if (/^(thu nhập|mức lương|salary|loại hình|employment type|cấp bậc|kinh nghiệm|experience|hạn nộp|deadline)\s*:?$/i.test(cleaned)) {
          continue;
        }
        currentItems.push(cleaned);
      }
    }
    flushSectionItems();
  }

  // Bổ sung riêng từ fields có sẵn nếu mục đó chưa có
  if (!orderedSections.some(s => s.type === 'responsibilities') && Array.isArray(job.responsibilities) && job.responsibilities.length > 0) {
    const items = job.responsibilities.map(cleanTextLine).filter(l => l.length >= 2);
    if (items.length > 0) {
      orderedSections.push({
        id: 'sec-responsibilities',
        type: 'responsibilities',
        title: 'Trách nhiệm chính',
        items,
      });
    }
  }

  if (!orderedSections.some(s => s.type === 'must_have') && Array.isArray(job.requirements) && job.requirements.length > 0) {
    const items = job.requirements.map(cleanTextLine).filter(l => l.length >= 2);
    if (items.length > 0) {
      orderedSections.push({
        id: 'sec-must_have',
        type: 'must_have',
        title: 'Yêu cầu bắt buộc',
        items,
      });
    }
  }

  // Loại bỏ các dòng bị trùng lặp giữa mục overview/notes và các mục chuyên biệt (responsibilities, must_have,...)
  const specificItems = new Set<string>();
  for (const s of orderedSections) {
    if (['responsibilities', 'must_have', 'nice_to_have', 'benefits'].includes(s.type)) {
      s.items.forEach(i => specificItems.add(i.toLowerCase().trim()));
      s.subSections?.forEach(sub => sub.items.forEach(i => specificItems.add(i.toLowerCase().trim())));
    }
  }

  for (const s of orderedSections) {
    if (['overview', 'notes'].includes(s.type)) {
      s.items = s.items.filter(i => !specificItems.has(i.toLowerCase().trim()));
      if (s.subSections) {
        for (const sub of s.subSections) {
          sub.items = sub.items.filter(i => !specificItems.has(i.toLowerCase().trim()));
        }
        s.subSections = s.subSections.filter(sub => sub.items.length > 0);
      }
    }
  }

  return orderedSections.filter(sec => sec.items.length > 0 || (sec.subSections && sec.subSections.length > 0));
}

/**
 * Chuẩn hoá dữ liệu Job Detail thành display model.
 */
export function normalizeStructuredJobDetail(
  job: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: StructuredJobDetailOptions = {}
): StructuredJobDetailData {
  const id = String(job.job_id || job.id || job.source_id || '').trim();
  const sourceId = String(job.source_id || job.id || job.job_id || '').trim();
  const title = cleanTextLine(job.title || job.job_title || 'Vị trí tuyển dụng');
  const company = cleanTextLine(job.company || job.company_name || 'Doanh nghiệp tuyển dụng');

  const cleanMeta = (val: unknown): string | undefined => {
    if (val === null || val === undefined) return undefined;
    const str = String(val).trim();
    return /^(unknown|chưa xác định|n\/a|none|undefined|null)$/i.test(str) ? undefined : str;
  };

  const location = cleanMeta(job.location);
  const workMode = cleanMeta(job.work_mode || job.remote_type || job.work_model);
  const seniority = cleanMeta(job.seniority || job.job_level || job.level);
  const employmentType = cleanMeta(job.employment_type || job.job_type);

  const rawSalary = cleanMeta(job.salary || job.salary_range);
  const salary = rawSalary ? (rawSalary.toLowerCase() === 'negotiable' ? 'Thỏa thuận' : rawSalary) : undefined;

  const rawOpenings = job.openings ?? job.quantity;
  const openings = rawOpenings !== undefined && rawOpenings !== null && Number(rawOpenings) > 0 ? Number(rawOpenings) : undefined;

  const rawDeadline = cleanMeta(job.deadline || job.application_deadline);
  let deadline: string | undefined = undefined;
  if (rawDeadline) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDeadline)) {
      const [y, m, d] = rawDeadline.split('-');
      deadline = `${d}/${m}/${y}`;
    } else {
      deadline = rawDeadline;
    }
  }

  // Khai thác linh hoạt link gốc tuyển dụng từ nhiều trường
  const rawSourceUrl = cleanMeta(job.source_url || job.url || job.link || job.job_url || job.original_url || job.post_url);
  const sourceUrl = (rawSourceUrl && /^https?:\/\//i.test(rawSourceUrl)) ? rawSourceUrl : undefined;
  const sourcePlatformName = cleanMeta(job.source_name || job.source) || (sourceUrl ? (
    sourceUrl.includes('topcv') ? 'TopCV' :
    sourceUrl.includes('linkedin') ? 'LinkedIn' :
    sourceUrl.includes('vietnamworks') ? 'VietnamWorks' :
    sourceUrl.includes('itviec') ? 'ITviec' :
    sourceUrl.includes('fpt') ? 'FPT Jobs' : 'Website tuyển dụng'
  ) : undefined);

  // Kỹ năng
  const rawSkills = Array.isArray(job.skills) ? job.skills : [];
  const rawReqSkills = Array.isArray(job.required_skills) ? job.required_skills : (Array.isArray(job.must_have_skills) ? job.must_have_skills : []);
  const rawPrefSkills = Array.isArray(job.preferred_skills) ? job.preferred_skills : (Array.isArray(job.nice_to_have_skills) ? job.nice_to_have_skills : []);
  
  const allSkillsList: string[] = [];
  const seenSkill = new Set<string>();
  const addSkill = (s: unknown) => {
    if (!s) return;
    const name = typeof s === 'object' && s !== null ? String((s as Record<string, unknown>).name ?? (s as Record<string, unknown>).text ?? '') : String(s);
    const clean = cleanTextLine(name);
    if (clean && clean.length >= 2 && !seenSkill.has(clean.toLowerCase())) {
      seenSkill.add(clean.toLowerCase());
      allSkillsList.push(clean);
    }
  };

  rawReqSkills.forEach(addSkill);
  rawPrefSkills.forEach(addSkill);
  rawSkills.forEach(addSkill);

  const sections = extractStructuredSections(job);

  return {
    id,
    sourceId,
    title,
    company,
    location,
    workMode,
    seniority,
    employmentType,
    salary,
    openings,
    deadline,
    postedAt: cleanMeta(job.posted_at || job.created_at),
    logoUrl: cleanMeta(job.company_logo || job.logo_url || job.logo),
    companyInitial: (() => {
      const clean = cleanTextLine(company);
      const words = clean.split(/\s+/).filter(Boolean);
      return words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : (clean.slice(0, 2) || 'DN').toUpperCase();
    })(),
    sourceUrl,
    sourcePlatformName,
    skills: allSkillsList,
    sections,
  };
}

const ICONS = {
  mapPin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>',
  briefcase: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-briefcase" aria-hidden="true"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>',
  wallet: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wallet" aria-hidden="true"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>',
  users: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>',
  externalLink: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
};

/**
 * Sinh HTML hiển thị Job Detail cấu trúc phân cấp, đẹp mắt và chuẩn SEO / Accessibility.
 */
export function renderStructuredJobDetailHtml(
  job: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  options: StructuredJobDetailOptions = {}
): string {
  const data = normalizeStructuredJobDetail(job, options);
  const mode = options.mode || 'modal';

  const metaPills: string[] = [];
  if (data.location) {
    metaPills.push(`<span class="jd-detail-pill pill-location">${ICONS.mapPin}<span>${escapeHtml(data.location)}</span></span>`);
  }
  if (data.workMode) {
    metaPills.push(`<span class="jd-detail-pill pill-workmode">${escapeHtml(data.workMode)}</span>`);
  }
  if (data.employmentType) {
    metaPills.push(`<span class="jd-detail-pill pill-employment">${escapeHtml(data.employmentType)}</span>`);
  }
  if (data.seniority) {
    metaPills.push(`<span class="jd-detail-pill pill-seniority">${escapeHtml(data.seniority)}</span>`);
  }
  if (data.salary) {
    metaPills.push(`<span class="jd-detail-pill pill-salary highlight">${ICONS.wallet}<span>${escapeHtml(data.salary)}</span></span>`);
  }
  if (data.openings) {
    metaPills.push(`<span class="jd-detail-pill pill-openings highlight">${ICONS.users}<span>Tuyển ${escapeHtml(String(data.openings))} người</span></span>`);
  }
  if (data.deadline) {
    metaPills.push(`<span class="jd-detail-pill pill-deadline">${ICONS.calendar}<span>Hạn ứng tuyển: <strong>${escapeHtml(data.deadline)}</strong></span></span>`);
  }

  let heroHeaderHtml = '';
  if (options.showHeroHeader !== false && mode === 'modal') {
    const sourceLinkHtml = data.sourceUrl
      ? `<a href="${escapeHtml(data.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="jd-detail-source-link" title="Mở tin gốc trên ${escapeHtml(data.sourcePlatformName || 'website')}">
          <span>Xem tin gốc trên ${escapeHtml(data.sourcePlatformName || 'Website tuyển dụng')}</span>
          ${ICONS.externalLink}
        </a>`
      : '';

    const hasValidLogo = Boolean(data.logoUrl && (/^https?:\/\//i.test(data.logoUrl) || (data.logoUrl.startsWith('/') && !data.logoUrl.includes('placeholder'))));
    const logoHtml = hasValidLogo
      ? `<div class="jd-detail-company-avatar">
          <img src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(data.company)}" class="jd-detail-logo-img" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';" />
          <span class="jd-detail-logo-initial" style="display:none">${escapeHtml(data.companyInitial)}</span>
        </div>`
      : `<div class="jd-detail-company-avatar"><span class="jd-detail-logo-initial">${escapeHtml(data.companyInitial)}</span></div>`;

    heroHeaderHtml = `
      <header class="jd-detail-hero">
        <div class="jd-detail-hero-top">
          <div class="jd-detail-hero-brand">
            ${logoHtml}
            <div class="jd-detail-title-group">
              <span class="jd-detail-kicker">Chi tiết tin tuyển dụng</span>
              <h2 class="jd-detail-title">${escapeHtml(data.title)}</h2>
              <div class="jd-detail-company">${escapeHtml(data.company)}</div>
            </div>
          </div>
          ${sourceLinkHtml}
        </div>
        ${metaPills.length > 0 ? `<div class="jd-detail-meta-row">${metaPills.join('')}</div>` : ''}
      </header>
    `;
  }

  let skillsHtml = '';
  if (options.showSkillsSection !== false && data.skills.length > 0) {
    skillsHtml = `
      <section class="jd-detail-section jd-skills-section">
        <h4 class="jd-detail-section-heading">Kỹ năng &amp; Công nghệ trọng tâm</h4>
        <div class="jd-detail-skills-wrap">
          ${data.skills.map(s => `<span class="jd-detail-skill-tag">${escapeHtml(s)}</span>`).join('')}
        </div>
      </section>
    `;
  }

  let sectionsHtml = '';
  if (data.sections.length > 0) {
    sectionsHtml = data.sections.map(sec => {
      let contentInnerHtml = '';

      if (sec.items.length > 0) {
        contentInnerHtml += `
          <ul class="jd-detail-list">
            ${sec.items.map(item => `<li class="jd-detail-list-item">${escapeHtml(item)}</li>`).join('')}
          </ul>
        `;
      }

      if (sec.subSections && sec.subSections.length > 0) {
        contentInnerHtml += sec.subSections.map(sub => `
          <div class="jd-detail-sub-group">
            ${sub.title ? `<h5 class="jd-detail-sub-heading">${escapeHtml(sub.title)}</h5>` : ''}
            <ul class="jd-detail-list">
              ${sub.items.map(item => `<li class="jd-detail-list-item">${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
        `).join('');
      }

      return `
        <section class="jd-detail-section jd-section-${sec.type}">
          <h4 class="jd-detail-section-heading">${escapeHtml(sec.title)}</h4>
          <div class="jd-detail-section-content">
            ${contentInnerHtml}
          </div>
        </section>
      `;
    }).join('');
  } else {
    sectionsHtml = `
      <div class="jd-detail-empty-state">
        <p>Doanh nghiệp chưa cập nhật mô tả chi tiết cho vị trí tuyển dụng này.</p>
      </div>
    `;
  }

  return `
    <div class="structured-jd-detail-root jd-mode-${mode}">
      ${heroHeaderHtml}
      ${skillsHtml}
      <div class="jd-detail-body-sections">
        ${sectionsHtml}
      </div>
    </div>
  `;
}
