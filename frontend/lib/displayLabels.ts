/**
 * Bản đồ nhãn hiển thị dùng chung toàn hệ thống.
 * Mục tiêu: không bao giờ hiển thị mã thô (enum/event/field name) cho người dùng.
 */

export const EVENT_LABELS: Record<string, string> = {
  cv_parse: 'Phân tích CV',
  cv_uploaded: 'Tải lên CV',
  cv_analyzed: 'Phân tích CV',
  gap_analysis: 'Phân tích khoảng thiếu kỹ năng',
  resume_optimization: 'Tối ưu CV theo vị trí',
  cv_jd_match_completed: 'Đối chiếu CV – JD hoàn tất',
  match_run: 'Chạy đối chiếu CV – JD',
  interview_start: 'Bắt đầu phỏng vấn thử',
  interview_started: 'Bắt đầu phỏng vấn thử',
  interview_answer: 'Trả lời câu hỏi phỏng vấn',
  interview_completed: 'Hoàn tất phỏng vấn thử',
  voice_interview_session: 'Phiên phỏng vấn bằng giọng nói',
  cv_variant_created: 'Tạo phiên bản CV',
  cv_variant_revision: 'Chỉnh sửa phiên bản CV',
  cv_variant_validated: 'Kiểm định ATS phiên bản CV',
  cv_variant_published: 'Xuất bản phiên bản CV',
  cv_variant_deleted: 'Xoá phiên bản CV',
};

export function eventLabel(event?: string | null): string {
  if (!event) return 'Hoạt động hệ thống';
  return EVENT_LABELS[event] || 'Hoạt động hệ thống';
}

/**
 * Danh sách sự kiện thực sự được backend ghi nhận (UsageEvent.event_name),
 * dùng cho bộ lọc nhật ký của admin thay vì để admin tự nhập mã sự kiện.
 * Giữ đúng thứ tự theo hành trình sử dụng của sinh viên.
 */
export const AUDIT_EVENT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'cv_parse', label: EVENT_LABELS.cv_parse },
  { value: 'cv_variant_created', label: EVENT_LABELS.cv_variant_created },
  { value: 'cv_variant_revision', label: EVENT_LABELS.cv_variant_revision },
  { value: 'cv_variant_validated', label: EVENT_LABELS.cv_variant_validated },
  { value: 'cv_variant_published', label: EVENT_LABELS.cv_variant_published },
  { value: 'cv_variant_deleted', label: EVENT_LABELS.cv_variant_deleted },
  { value: 'cv_jd_match_completed', label: EVENT_LABELS.cv_jd_match_completed },
  { value: 'gap_analysis', label: EVENT_LABELS.gap_analysis },
  { value: 'resume_optimization', label: EVENT_LABELS.resume_optimization },
  { value: 'interview_start', label: EVENT_LABELS.interview_start },
  { value: 'interview_answer', label: EVENT_LABELS.interview_answer },
  { value: 'voice_interview_session', label: EVENT_LABELS.voice_interview_session },
];

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: 'Toàn thời gian',
  'full-time': 'Toàn thời gian',
  fulltime: 'Toàn thời gian',
  part_time: 'Bán thời gian',
  'part-time': 'Bán thời gian',
  parttime: 'Bán thời gian',
  internship: 'Thực tập',
  intern: 'Thực tập',
  trainee: 'Thực tập sinh',
  contract: 'Theo hợp đồng',
  freelance: 'Freelance',
  temporary: 'Tạm thời',
  other: 'Khác',
};

export function employmentTypeLabel(value?: string | null): string {
  if (!value) return 'Toàn thời gian';
  const raw = String(value).trim();
  if (!raw) return 'Toàn thời gian';
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  return (
    EMPLOYMENT_TYPE_LABELS[raw] ||
    EMPLOYMENT_TYPE_LABELS[key] ||
    EMPLOYMENT_TYPE_LABELS[key.replace(/_/g, '-')] ||
    'Loại hình khác'
  );
}

export const CV_SECTION_LABELS: Record<string, string> = {
  personal_info: 'Thông tin cá nhân',
  summary: 'Tóm tắt bản thân',
  objective: 'Mục tiêu nghề nghiệp',
  experience: 'Kinh nghiệm làm việc',
  work_experience: 'Kinh nghiệm làm việc',
  education: 'Học vấn',
  skills: 'Kỹ năng',
  projects: 'Dự án',
  certifications: 'Chứng chỉ',
  activities: 'Hoạt động',
  awards: 'Giải thưởng',
  languages: 'Ngoại ngữ',
  references: 'Người tham chiếu',
};

export function cvSectionLabel(value?: string | null, fallback = 'Nội dung CV'): string {
  if (!value) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  return CV_SECTION_LABELS[raw] || CV_SECTION_LABELS[raw.toLowerCase()] || fallback;
}

export const APPLICATION_STAGE_LABELS: Record<string, string> = {
  submitted: 'Đã nộp hồ sơ',
  shortlisted: 'Qua vòng sơ loại',
  interview: 'Phỏng vấn',
  interviewing: 'Đang phỏng vấn',
  interview_scheduled: 'Đã hẹn phỏng vấn',
  hired: 'Trúng tuyển',
  offered: 'Đề nghị nhận việc',
  accepted: 'Đã đồng ý nhận việc',
  rejected: 'Chưa phù hợp',
  withdrawn: 'Đã rút hồ sơ',
  viewed: 'Doanh nghiệp đã xem',
  pending: 'Chờ xử lý',
  pending_review: 'Chờ xem xét',
  pending_consent: 'Chờ sinh viên đồng ý',
  waiting_consent: 'Chờ sinh viên đồng ý',
};

export function applicationStageLabel(value?: string | null): string | undefined {
  if (!value) return undefined;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return undefined;
  return APPLICATION_STAGE_LABELS[raw];
}

export function formatMetaTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Khu vực người dùng đang mở khi gọi trợ lý AI (`current_page`).
 * Giá trị gốc là khoá view nội bộ của ứng dụng — đổi sang tên màn hình
 * mà người quản trị nhìn thấy trên giao diện.
 */
export const APP_AREA_LABELS: Record<string, string> = {
  dashboard: 'Trang tổng quan',
  cv: 'CV của tôi',
  'find-jobs': 'Việc làm',
  jobs: 'Việc làm',
  'job-detail': 'Chi tiết việc làm',
  match: 'So khớp CV',
  interview: 'Phỏng vấn thử',
  history: 'Lịch sử & Báo cáo',
  profile: 'Hồ sơ cá nhân',
  notifications: 'Thông báo',
  counselor: 'Khu vực Cố vấn',
  admin: 'Khu vực Quản trị',
};

export function appAreaLabel(value?: string | null): string {
  if (!value) return 'Không xác định';
  const key = String(value).trim().toLowerCase();
  if (!key) return 'Không xác định';
  return APP_AREA_LABELS[key] || 'Khu vực khác';
}

/**
 * Thời gian phản hồi cho người đọc không chuyên: dùng giây khi đủ lớn,
 * kèm cách diễn đạt gần với cảm nhận thực tế.
 */
export function formatResponseTime(latencyMs?: number | null): string {
  if (latencyMs === null || latencyMs === undefined || Number.isNaN(latencyMs)) return 'Không rõ';
  if (latencyMs < 1000) return 'Dưới 1 giây';
  return `${(latencyMs / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giây`;
}
