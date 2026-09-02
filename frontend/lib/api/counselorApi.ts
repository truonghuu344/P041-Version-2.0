/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiClient } from '@/api-client';

export interface CounselorDashboardData {
  total_students: number;
  pending_cv_review: number;
  partner_companies: number;
  open_talent_requests: number;
  upcoming_interviews: number;
  interviewing_students: Array<{
    id: string;
    name: string;
    major: string;
    avatar?: string;
    position: string;
    company: string;
    companyType?: string;
    status: string;
    statusLabel: string;
  }>;
  urgent_actions: Array<{
    id: string;
    severity: 'warning' | 'danger' | 'info' | 'success';
    title: string;
    desc: string;
    timeText: string;
    targetTab: string;
    studentId?: string;
    internshipId?: string;
    referralId?: string;
  }>;
}

export interface StudentListItem {
  id: string;
  name: string;
  email: string;
  major: string;
  cohort: string;
  targetRole: string;
  avatar?: string;
  initials?: string;
  cvStatus: 'pending' | 'verified' | 'needs_task';
  gpa: string;
  skills: string[];
  matchRate: number;
  lastActive: string;
}

export interface StudentListResponse {
  items: StudentListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface OpportunityItem {
  id: string;
  company: string;
  logo?: string;
  position: string;
  location: string;
  slots: number;
  matchRate: number;
  type: string;
  field: string;
  allowance?: string;
  mustHave: string[];
  niceToHave: string[];
  deadline?: string;
  desc: string;
  isTalentRequest?: boolean;
}

export interface CandidateMatchItem {
  id: string;
  name: string;
  university: string;
  avatar?: string;
  initials?: string;
  matchScore: number;
  ratingLabel: string;
  matchedSkills: string[];
  missingSkills: string[];
  cvStatus: 'pending' | 'verified' | 'needs_task';
  availability: string;
  cvId?: string;
}

export interface ReferralItem {
  id: string;
  studentId: string;
  studentName: string;
  studentMajor: string;
  studentAvatar?: string;
  position: string;
  company: string;
  matchScore: number;
  skills: string[];
  date: string;
  lastUpdated: string;
  stage: 'waiting_consent' | 'shared_enterprise' | 'interviewing' | 'offered' | 'ended';
  stageLabel: string;
  notes: string;
}

export interface InternshipItem {
  id: string;
  studentId: string;
  studentName: string;
  studentMajor: string;
  studentAvatar?: string;
  initials?: string;
  company: string;
  location: string;
  position: string;
  mentorName: string;
  mentorTitle: string;
  mentorEmail?: string;
  currentWeek: number;
  totalWeeks: number;
  lastReportStatus: 'submitted' | 'reviewed' | 'pending' | 'delayed';
  statusLabel: string;
  progressPercent: number;
  weeklyReports?: Array<{ week: number; title: string; status: string; score?: number }>;
}

export interface PartnerItem {
  id: string;
  name: string;
  logo?: string;
  banner?: string;
  industry: string;
  location: string;
  description: string;
  internsCount: number;
  openTalentRequests: number;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface CounselorProfileData {
  fullName: string;
  academicTitle: string;
  faculty: string;
  department: string;
  workEmail: string;
  phoneExt: string;
  officeLocation: string;
  roleTitle: string;
  assignedStudentsCount: number;
  activeCohorts: string[];
  specializations: string[];
  officeHours: string;
  bio: string;
  notificationPreferences: {
    emailOnNewCV: boolean;
    emailOnMatchAlert: boolean;
    emailOnInternshipReport: boolean;
    weeklySummaryDigest: boolean;
  };
}

export const CounselorApi = {
  async getDashboard(): Promise<CounselorDashboardData> {
    return (ApiClient as any).getCounselorDashboard();
  },

  async getStudents(params: {
    search?: string;
    major?: string;
    cv_status?: string;
    sort_by?: string;
    page?: number;
    page_size?: number;
  } = {}): Promise<StudentListResponse> {
    const res = await (ApiClient as any).getCounselorStudents(params);
    return {
      items: (res.items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        major: item.major,
        cohort: item.cohort,
        targetRole: item.target_role,
        avatar: item.avatar,
        initials: item.initials,
        cvStatus: item.cv_status as 'pending' | 'verified' | 'needs_task',
        gpa: item.gpa,
        skills: item.skills || [],
        matchRate: item.match_rate || 0,
        lastActive: item.last_active || 'Hôm nay',
      })),
      total: res.total || 0,
      page: res.page || 1,
      page_size: res.page_size || 6,
      total_pages: res.total_pages || 1,
    };
  },

  async getStudentDetail(studentId: string): Promise<any> {
    return (ApiClient as any).getCounselorStudentDetail(studentId);
  },

  async verifyStudent(studentId: string, payload: { feedback?: string; referral_note?: string }): Promise<any> {
    return (ApiClient as any).verifyCounselorStudent(studentId, payload);
  },

  async assignTask(studentId: string, payload: {
    title: string;
    description: string;
    due_date?: string;
    priority?: string;
    target_role?: string;
  }): Promise<any> {
    return (ApiClient as any).createCounselorTask(studentId, payload);
  },

  async createCounselorFeedback(
    studentId: string,
    payload: { content: string; kind?: string },
  ): Promise<any> {
    return (ApiClient as any).createCounselorFeedback(studentId, payload);
  },

  async getOpportunities(params: { tab?: string; search?: string; field?: string } = {}): Promise<OpportunityItem[]> {
    const res = await (ApiClient as any).getCounselorOpportunities(params);
    return (res || []).map((item: any) => ({
      id: item.id,
      company: item.company,
      logo: item.logo,
      position: item.position,
      location: item.location,
      slots: item.slots || 1,
      matchRate: item.match_rate || 85,
      type: item.type || 'Thực tập',
      field: item.field || 'it',
      allowance: item.allowance,
      mustHave: item.must_have || [],
      niceToHave: item.nice_to_have || [],
      deadline: item.deadline,
      desc: item.desc || '',
      isTalentRequest: item.is_talent_request,
    }));
  },

  async getJobCandidates(jobId: string): Promise<CandidateMatchItem[]> {
    const res = await (ApiClient as any).getCounselorJobCandidates(jobId);
    return (res || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      university: item.university,
      avatar: item.avatar,
      initials: item.initials,
      matchScore: item.match_score,
      ratingLabel: item.rating_label,
      matchedSkills: item.matched_skills || [],
      missingSkills: item.missing_skills || [],
      cvStatus: item.cv_status,
      availability: item.availability,
      cvId: item.cv_id,
    }));
  },

  async createReferral(payload: { student_id: string; jd_id: string; cv_id?: string; notes?: string }): Promise<any> {
    return (ApiClient as any).createCounselorReferral(payload);
  },

  async getReferrals(params: { stage?: string; search?: string } = {}): Promise<ReferralItem[]> {
    const res = await (ApiClient as any).getCounselorReferrals(params);
    return (res || []).map((item: any) => ({
      id: item.id,
      studentId: item.student_id,
      studentName: item.student_name,
      studentMajor: item.student_major,
      studentAvatar: item.student_avatar,
      position: item.position,
      company: item.company,
      matchScore: item.match_score,
      skills: item.skills || [],
      date: item.date,
      lastUpdated: item.last_updated,
      stage: item.stage,
      stageLabel: item.stage_label,
      notes: item.notes,
    }));
  },

  async getReferralDetail(referralId: string): Promise<ReferralItem> {
    const item = await (ApiClient as any).getCounselorReferralDetail(referralId);
    return {
      id: item.id,
      studentId: item.student_id,
      studentName: item.student_name,
      studentMajor: item.student_major,
      studentAvatar: item.student_avatar,
      position: item.position,
      company: item.company,
      matchScore: item.match_score,
      skills: item.skills || [],
      date: item.date,
      lastUpdated: item.last_updated,
      stage: item.stage,
      stageLabel: item.stage_label,
      notes: item.notes,
    };
  },

  async updateReferral(referralId: string, payload: { stage?: string; notes?: string }): Promise<any> {
    return (ApiClient as any).updateCounselorReferral(referralId, payload);
  },

  async getInternships(params: { search?: string } = {}): Promise<InternshipItem[]> {
    const res = await (ApiClient as any).getCounselorInternships(params);
    return (res || []).map((item: any) => ({
      id: item.id,
      studentId: item.student_id,
      studentName: item.student_name,
      studentMajor: item.student_major,
      studentAvatar: item.student_avatar,
      initials: item.initials,
      company: item.company,
      location: item.location,
      position: item.position,
      mentorName: item.mentor_name,
      mentorTitle: item.mentor_title,
      mentorEmail: item.mentor_email,
      currentWeek: item.current_week,
      totalWeeks: item.total_weeks,
      lastReportStatus: item.last_report_status,
      statusLabel: item.status_label,
      progressPercent: item.progress_percent,
      weeklyReports: (item.weekly_reports || []).map((report: any) => ({
        ...report,
        workDone: report.work_done || report.workDone || '',
        nextPlan: report.next_plan || report.nextPlan || '',
        mentorFeedback: report.mentor_feedback || report.mentorFeedback || '',
        mentorScore: report.score ? `${report.score}/10` : (report.mentorScore || ''),
      })),
    }));
  },

  async getInternshipDetail(internshipId: string): Promise<InternshipItem> {
    const item = await (ApiClient as any).getCounselorInternshipDetail(internshipId);
    return {
      id: item.id,
      studentId: item.student_id,
      studentName: item.student_name,
      studentMajor: item.student_major,
      studentAvatar: item.student_avatar,
      initials: item.initials,
      company: item.company,
      location: item.location,
      position: item.position,
      mentorName: item.mentor_name,
      mentorTitle: item.mentor_title,
      mentorEmail: item.mentor_email,
      currentWeek: item.current_week,
      totalWeeks: item.total_weeks,
      lastReportStatus: item.last_report_status,
      statusLabel: item.status_label,
      progressPercent: item.progress_percent,
      weeklyReports: (item.weekly_reports || []).map((report: any) => ({
        ...report,
        workDone: report.work_done || report.workDone || '',
        nextPlan: report.next_plan || report.nextPlan || '',
        mentorFeedback: report.mentor_feedback || report.mentorFeedback || '',
        mentorScore: report.score ? `${report.score}/10` : (report.mentorScore || ''),
      })),
    };
  },

  async getPartners(): Promise<PartnerItem[]> {
    const res = await (ApiClient as any).getCounselorPartners();
    return (res || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      logo: item.logo,
      banner: item.banner,
      industry: item.industry,
      location: item.location,
      description: item.description,
      internsCount: item.interns_count,
      openTalentRequests: item.open_talent_requests,
      contactPerson: item.contact_person,
      contactEmail: item.contact_email,
      contactPhone: item.contact_phone,
    }));
  },

  async getPartnerDetail(partnerId: string): Promise<PartnerItem> {
    const item = await (ApiClient as any).getCounselorPartnerDetail(partnerId);
    return {
      id: item.id,
      name: item.name,
      logo: item.logo,
      banner: item.banner,
      industry: item.industry,
      location: item.location,
      description: item.description,
      internsCount: item.interns_count,
      openTalentRequests: item.open_talent_requests,
      contactPerson: item.contact_person,
      contactEmail: item.contact_email,
      contactPhone: item.contact_phone,
    };
  },

  async getProfile(): Promise<CounselorProfileData> {
    const res = await (ApiClient as any).getCounselorProfile();
    return {
      fullName: res.full_name,
      academicTitle: res.academic_title,
      faculty: res.faculty,
      department: res.department,
      workEmail: res.work_email,
      phoneExt: res.phone_ext,
      officeLocation: res.office_location,
      roleTitle: res.role_title,
      assignedStudentsCount: res.assigned_students_count,
      activeCohorts: res.active_cohorts || [],
      specializations: res.specializations || [],
      officeHours: res.office_hours,
      bio: res.bio,
      notificationPreferences: res.notification_preferences || {
        emailOnNewCV: true,
        emailOnMatchAlert: true,
        emailOnInternshipReport: true,
        weeklySummaryDigest: true,
      },
    };
  },

  async updateProfile(payload: any): Promise<CounselorProfileData> {
    const res = await (ApiClient as any).updateCounselorProfile(payload);
    return {
      fullName: res.full_name,
      academicTitle: res.academic_title,
      faculty: res.faculty,
      department: res.department,
      workEmail: res.work_email,
      phoneExt: res.phone_ext,
      officeLocation: res.office_location,
      roleTitle: res.role_title,
      assignedStudentsCount: res.assigned_students_count,
      activeCohorts: res.active_cohorts || [],
      specializations: res.specializations || [],
      officeHours: res.office_hours,
      bio: res.bio,
      notificationPreferences: res.notification_preferences || {},
    };
  },
};
