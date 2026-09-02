/**
 * Chuyển metadata thô của nhật ký hệ thống thành mô tả tiếng Việt dễ hiểu,
 * giúp admin không phải đọc JSON / mã kỹ thuật trên UI.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Key thuần kỹ thuật (trace/log nội bộ) — ẩn khỏi UI admin. */
const TECHNICAL_KEYS = new Set([
  'trace_id',
  'checksum',
  'request_id',
  'span_id',
  'user_agent',
  'ip',
  'session_key',
  'session_id',
  'conversation_id',
  'correlation_id',
  'pipeline_version',
  'schema_version',
]);

const KEY_LABELS: Record<string, string> = {
  variant_id: 'Phiên bản CV',
  cv_id: 'Hồ sơ CV',
  resume_id: 'Hồ sơ CV',
  jd_id: 'Bản mô tả công việc',
  job_id: 'Việc làm',
  application_id: 'Đơn ứng tuyển',
  interview_id: 'Buổi phỏng vấn',
  match_id: 'Kết quả đối chiếu',
  passed: 'Kết quả kiểm định',
  mode: 'Chế độ xử lý',
  company: 'Công ty',
  location: 'Địa điểm',
  title: 'Tiêu đề',
  role: 'Vị trí',
  score: 'Điểm',
  match_score: 'Điểm đối chiếu',
  overall_score: 'Điểm tổng',
  revision_no: 'Lượt chỉnh sửa',
  section: 'Phần CV',
  reason: 'Lý do',
  status: 'Trạng thái',
  stage: 'Giai đoạn',
  category: 'Danh mục',
  priority: 'Mức ưu tiên',
  target_roles: 'Nhóm nhận',
  delivered: 'Đã gửi tới',
  source: 'Nguồn',
  filename: 'Tên tệp',
  file_name: 'Tên tệp',
  size: 'Dung lượng',
  language: 'Ngôn ngữ',
  model: 'Mô hình AI',
  tokens: 'Số token',
  skills_count: 'Số kỹ năng',
  missing_skills: 'Kỹ năng còn thiếu',
  questions_count: 'Số câu hỏi',
  question_count: 'Số câu hỏi',
  duration: 'Thời lượng',
  follow_up: 'Câu hỏi đào sâu',
  completed: 'Đã hoàn tất',
  editor_type: 'Người chỉnh sửa',
  turns: 'Số lượt hỏi – đáp',
  // Đánh giá cuối kỳ thực tập (do mentor doanh nghiệp gửi).
  grade: 'Xếp loại',
  comment: 'Nhận xét',
  evaluated_by: 'Người đánh giá',
  evaluated_by_role: 'Vai trò người đánh giá',
  evaluated_at: 'Thời điểm đánh giá',
};

/** Các key mang nội dung câu chữ — không cắt ngắn quá tay. */
const LONG_TEXT_KEYS = new Set(['comment', 'reason', 'note', 'feedback', 'description', 'message']);

const VALUE_LABELS: Record<string, Record<string, string>> = {
  mode: {
    HAS_CV: 'Có CV sẵn',
    NO_CV: 'Chưa có CV',
    has_cv: 'Có CV sẵn',
    no_cv: 'Chưa có CV',
  },
  status: {
    DRAFT: 'Bản nháp',
    PUBLISHED: 'Đã xuất bản',
    ARCHIVED: 'Đã lưu trữ',
    VALIDATED: 'Đã kiểm định',
    FAILED: 'Thất bại',
  },
  priority: {
    normal: 'Bình thường',
    high: 'Cao',
    urgent: 'Khẩn cấp',
  },
  language: {
    vi: 'Tiếng Việt',
    en: 'Tiếng Anh',
  },
  editor_type: {
    user: 'Người dùng tự sửa',
    ai: 'Trợ lý AI đề xuất',
  },
  evaluated_by_role: {
    enterprise: 'Doanh nghiệp',
    counselor: 'Cố vấn',
    admin: 'Quản trị viên',
    student: 'Sinh viên',
  },
};

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function shorten(value: string, max = 40): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function prettifyKey(key: string): string {
  const text = key.replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatValue(key: string, value: any, maxLength: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') {
    if (key === 'passed') return value ? 'Đạt' : 'Không đạt';
    return value ? 'Có' : 'Không';
  }
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (Array.isArray(value)) {
    const items = value.map((item) => formatValue(key, item, maxLength)).filter(Boolean);
    return items.length ? items.join(', ') : null;
  }
  if (typeof value === 'object') {
    // Object lồng nhau: mô tả bằng số lượng mục thay vì đổ JSON ra UI.
    const count = Object.keys(value as Record<string, any>).length;
    return count ? `${count} mục thông tin` : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const enumLabels = VALUE_LABELS[key];
  if (enumLabels && enumLabels[text]) return enumLabels[text];
  if (enumLabels && enumLabels[text.toLowerCase()]) return enumLabels[text.toLowerCase()];
  if (UUID_LIKE.test(text)) return text.slice(0, 8);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  }
  return shorten(text, LONG_TEXT_KEYS.has(key) ? Math.max(maxLength, 400) : maxLength);
}

export interface AuditDetailLine {
  label: string;
  value: string;
}

export interface DescribeDetailsOptions {
  /** Độ dài tối đa của mỗi giá trị trước khi cắt ngắn (mặc định 40, đủ gọn cho bảng). */
  maxLength?: number;
}

/**
 * Mô tả một object dữ liệu thô thành danh sách dòng "nhãn – giá trị" tiếng Việt.
 * Dùng cho nhật ký hệ thống và cho các khối dữ liệu JSON khác trong khu vực admin.
 */
export function describeDetails(
  data?: Record<string, any> | null,
  options: DescribeDetailsOptions = {},
): AuditDetailLine[] {
  if (!data || typeof data !== 'object') return [];
  const maxLength = options.maxLength ?? 40;
  const lines: AuditDetailLine[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (TECHNICAL_KEYS.has(key)) continue;
    const formatted = formatValue(key, value, maxLength);
    if (formatted) lines.push({ label: KEY_LABELS[key] ?? prettifyKey(key), value: formatted });
  }
  return lines;
}

/** Alias theo ngữ cảnh nhật ký hệ thống (metadata_json của UsageEvent). */
export function describeAuditDetails(metadata?: Record<string, any> | null): AuditDetailLine[] {
  return describeDetails(metadata);
}
