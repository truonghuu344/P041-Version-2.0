/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiClient } from '@/api-client';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface AdminUserPage {
  items: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminDashboardData {
  counts: {
    users: number;
    students: number;
    counselors: number;
    jobs: number;
    applications: number;
    internships: number;
    unread_notifications: number;
    delayed_reports: number;
    referrals: number;
  };
  recent_activity: Array<{
    id: string;
    event: string;
    user_name: string | null;
    created_at: string;
    metadata: Record<string, any>;
  }>;
}

export interface AdminCounselor {
  id: string;
  name: string;
  email: string;
  created_at: string;
  title: string | null;
  active_assignments: number;
}

export interface AdminCounselorAssignment {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  status: string;
  consented_at: string | null;
  revoked_at: string | null;
}

export interface AdminRecruitmentJob {
  id: string;
  title: string;
  company: string | null;
  is_published: boolean;
  enterprise: string;
  created_at: string;
}

export interface AdminApplicationRow {
  id: string;
  job_title: string;
  student: string;
  status: string;
  source: string;
  match_score: number;
  created_at: string;
}

export interface AdminReferralRow {
  id: string;
  job_title: string;
  student: string;
  counselor: string | null;
  status: string;
  match_score: number;
  created_at: string;
}

export interface AdminRecruitmentData {
  jobs: AdminRecruitmentJob[];
  applications: AdminApplicationRow[];
  referrals: AdminReferralRow[];
  stats: {
    total_jobs: number;
    published_jobs: number;
    total_applications: number;
    total_referrals: number;
    applications_by_status: Record<string, number>;
  };
}

export interface AdminInternshipRow {
  id: string;
  student: string;
  company: string;
  position: string;
  progress_percent: number;
  last_report_status: string;
  status: string;
  updated_at: string;
}

export interface AdminInternshipDetail extends AdminInternshipRow {
  student_email: string;
  location: string;
  mentor_name: string;
  mentor_email: string | null;
  current_week: number;
  total_weeks: number;
  status_label: string;
  weekly_reports: any[];
  final_evaluation: Record<string, any> | null;
  created_at: string;
}

export interface AdminInternshipSummary {
  total: number;
  by_status: Record<string, number>;
  reports_by_status: Record<string, number>;
  evaluated: number;
}

export interface AdminSystemData {
  notification_count: number;
  unread_notification_count: number;
  ai_log_count: number;
  usage_event_count: number;
  internship_count: number;
  enterprise_pending_verification: number;
  notification_categories: Record<string, number>;
}

export interface AdminAuditLog {
  id: string;
  event_name: string;
  user_id: string | null;
  user_name: string | null;
  duration_ms: number | null;
  metadata_json: Record<string, any> | null;
  created_at: string;
}

export interface AdminAuditLogPage {
  items: AdminAuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminNotificationRow {
  id: string;
  recipient_user_id: string;
  recipient_name: string | null;
  recipient_role: string;
  type: string;
  category: string;
  title: string;
  message: string;
  is_read: boolean;
  priority: string;
  created_at: string;
}

export interface AdminNotificationPage {
  items: AdminNotificationRow[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Nhật ký trợ lý AI.
 * Lưu ý: backend còn trả về `prompt`, `response`, `provider`, `model`,
 * `error_code`, `conversation_id`, `tools_used` — đều là dữ liệu kỹ thuật hoặc
 * nội dung riêng tư của người dùng, nên UI admin không hiển thị các trường này.
 */
export interface AdminAILogRow {
  id: string;
  user_id: string;
  user_email: string;
  user_full_name: string;
  llm_succeeded: boolean;
  current_page: string | null;
  latency_ms: number;
  created_at: string;
}

export interface AdminAILogPage {
  items: AdminAILogRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminAILogStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  unique_users: number;
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const AdminApi = {
  getDashboard(): Promise<AdminDashboardData> {
    return (ApiClient as any).request('/admin/dashboard');
  },

  getUsersPage(
    params: { search?: string; role?: string; limit?: number; offset?: number } = {},
  ): Promise<AdminUserPage> {
    return (ApiClient as any).request(`/admin/users/page${buildQuery(params)}`);
  },

  createUser(payload: { email: string; password: string; full_name: string; role: string }): Promise<AdminUser> {
    return (ApiClient as any).request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateUser(userId: string, payload: Partial<{ full_name: string; email: string; role: string; password: string }>): Promise<AdminUser> {
    return (ApiClient as any).request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteUser(userId: string): Promise<void> {
    return (ApiClient as any).request(`/admin/users/${userId}`, { method: 'DELETE' });
  },

  getCounselors(): Promise<AdminCounselor[]> {
    return (ApiClient as any).request('/admin/counselors');
  },

  getCounselorAssignments(counselorId: string): Promise<AdminCounselorAssignment[]> {
    return (ApiClient as any).request(`/admin/counselors/${counselorId}/assignments`);
  },

  getRecruitment(params: { limit?: number } = {}): Promise<AdminRecruitmentData> {
    return (ApiClient as any).request(`/admin/recruitment${buildQuery(params)}`);
  },

  setJobPublication(jobId: string, isPublished: boolean): Promise<AdminRecruitmentJob> {
    return (ApiClient as any).request(
      `/admin/jobs/${jobId}/publication?is_published=${isPublished}`,
      { method: 'PATCH' },
    );
  },

  getInternships(): Promise<AdminInternshipRow[]> {
    return (ApiClient as any).request('/admin/internships');
  },

  getInternshipSummary(): Promise<AdminInternshipSummary> {
    return (ApiClient as any).request('/admin/internships/summary');
  },

  getInternshipDetail(internshipId: string): Promise<AdminInternshipDetail> {
    return (ApiClient as any).request(`/admin/internships/${internshipId}`);
  },

  getSystem(): Promise<AdminSystemData> {
    return (ApiClient as any).request('/admin/system');
  },

  getAuditLogs(
    params: { search?: string; event?: string; limit?: number; offset?: number } = {},
  ): Promise<AdminAuditLogPage> {
    return (ApiClient as any).request(`/admin/audit-logs${buildQuery(params)}`);
  },

  getNotifications(
    params: {
      category?: string;
      role?: string;
      unread_only?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<AdminNotificationPage> {
    return (ApiClient as any).request(`/admin/notifications${buildQuery(params)}`);
  },

  getAiLogStats(): Promise<AdminAILogStats> {
    return (ApiClient as any).request('/admin/ai-logs/stats');
  },

  getAiLogs(
    params: { search?: string; success?: boolean; limit?: number; offset?: number } = {},
  ): Promise<AdminAILogPage> {
    return (ApiClient as any).request(`/admin/ai-logs${buildQuery(params)}`);
  },

  broadcast(payload: {
    title: string;
    message: string;
    target_roles: Array<'student' | 'counselor'>;
    priority?: 'normal' | 'important' | 'high';
  }): Promise<{ delivered: number }> {
    return (ApiClient as any).request('/admin/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
