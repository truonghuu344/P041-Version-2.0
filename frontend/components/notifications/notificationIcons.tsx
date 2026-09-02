import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock3,
  Ellipsis,
  Eye,
  FileCheck,
  FileEdit,
  FileText,
  FileUser,
  GraduationCap,
  ListTodo,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  UserRound,
  Users,
} from 'lucide-react';

export type NotificationSemantic = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export interface NotificationIconProps {
  type?: string;
  category?: string;
  entityType?: string;
  priority?: string;
  size?: number;
  className?: string;
}

/**
 * Determines the semantic color family for a notification based on type, priority, and category.
 * INFO: Blue (normal updates, viewed, schedule)
 * SUCCESS: Emerald (accepted, completed, offer, approved)
 * WARNING: Amber (action required, referral consent pending, approaching deadline)
 * DANGER: Red (rejected, overdue, canceled)
 * NEUTRAL: Slate (general historical)
 */
export function getNotificationSemantic(
  type?: string,
  category?: string,
  priority?: string
): NotificationSemantic {
  const normType = (type || '').toUpperCase();
  const normCat = (category || '').toLowerCase();
  const normPriority = (priority || '').toLowerCase();

  // Danger events
  if (
    normType.includes('REJECTED') ||
    normType.includes('DECLINED') ||
    normType.includes('OVERDUE') ||
    normType.includes('CANCELED') ||
    normType.includes('TERMINATED')
  ) {
    return 'danger';
  }

  // Warning / Action Required / Pending events
  if (
    normType.includes('CONSENT_REQUESTED') ||
    normType.includes('DUE_SOON') ||
    normType.includes('EXPIRING') ||
    normType.includes('REVISION_REQUESTED') ||
    normType.includes('RESCHEDULED') ||
    normType.includes('ACTION_REQUIRED') ||
    normType.includes('CHANGE_REQUESTED') ||
    normPriority === 'high' && (normType.includes('CONSENT') || normType.includes('REMINDER'))
  ) {
    return 'warning';
  }

  // Success events
  if (
    normType.includes('APPROVED') ||
    normType.includes('SHORTLISTED') ||
    normType.includes('OFFER_SENT') ||
    normType.includes('OFFER_ACCEPTED') ||
    normType.includes('CONFIRMED') ||
    normType.includes('COMPLETED') ||
    normType.includes('ACCEPTED') ||
    normType.includes('FINAL_EVALUATION')
  ) {
    return 'success';
  }

  // Info events (Standard default for new items, views, normal matches)
  if (
    normType.includes('JOB') ||
    normType.includes('APPLICATION') ||
    normType.includes('INTERVIEW') ||
    normType.includes('TALENT_REQUEST') ||
    normType.includes('REPORT_SUBMITTED') ||
    normType.includes('FEEDBACK') ||
    normType.includes('REFERRAL') ||
    normCat === 'job' ||
    normCat === 'application' ||
    normCat === 'interview' ||
    normCat === 'advisor'
  ) {
    return 'info';
  }

  return 'neutral';
}

/**
 * Returns the contextual CTA label matching Career Assistant X workflows.
 */
export function getNotificationCTA(
  type?: string,
  category?: string,
  userRole: string = 'student'
): string {
  const normType = (type || '').toUpperCase();
  const role = userRole.toLowerCase();

  if (role === 'counselor') {
    if (normType.includes('CONSENT_ACCEPTED')) {
      return 'Gửi tiến cử';
    }
    if (normType.includes('TASK_COMPLETED')) {
      return 'Xem tiến độ';
    }
    if (normType.includes('TALENT_REQUEST')) {
      return 'Xem yêu cầu';
    }
    if (normType.includes('INTERNSHIP')) {
      return normType.includes('EVALUATED') ? 'Xem đánh giá' : 'Xem thực tập';
    }
    if (normType.includes('REJECTED')) {
      return 'Xem phản hồi';
    }
    if (normType.includes('CV_UPDATED') || normType.includes('FEEDBACK_RESPONSE')) {
      return 'Xem hồ sơ';
    }
    return 'Xem tiến trình';
  }

  if (role === 'admin') {
    if (normType.includes('ENTERPRISE')) {
      return 'Kiểm duyệt DN';
    }
    if (normType.includes('AI_') || normType.includes('TOKEN')) {
      return 'Xem mức sử dụng AI';
    }
    if (normType.includes('SYSTEM')) {
      return 'Kiểm tra hệ thống';
    }
    return 'Xem chi tiết';
  }

  // Student CTAs
  if (normType.includes('CONSENT_REQUESTED')) {
    return 'Xem và xác nhận';
  }
  if (normType.includes('CV_CONFIRMED')) {
    return 'Xem CV';
  }
  if (normType.includes('CV_REVISION') || normType.includes('FEEDBACK')) {
    return 'Xem góp ý';
  }
  if (normType.includes('TASK_ASSIGNED')) {
    return 'Xem nhiệm vụ';
  }
  if (normType.includes('INTERVIEW')) {
    return 'Xem lịch phỏng vấn';
  }
  if (normType.includes('OFFER')) {
    return 'Xem Offer';
  }
  if (normType.includes('REJECTED')) {
    return 'Xem kết quả';
  }
  if (normType.includes('SHORTLISTED') || normType.includes('APPROVED')) {
    return 'Xem ứng tuyển';
  }
  if (normType.includes('INTERNSHIP')) {
    return 'Xem thực tập';
  }
  if (normType.includes('VIEWED')) {
    return 'Xem tiến trình';
  }

  return 'Xem chi tiết';
}

/**
 * Maps notification event types and entities to semantic Lucide Icons.
 */
export function getNotificationIconComponent(type?: string, category?: string) {
  const normType = (type || '').toUpperCase();
  const normCat = (category || '').toLowerCase();

  // CV & Task
  if (normType.includes('TASK')) {
    return ListTodo;
  }
  if (normType.includes('FEEDBACK') || normType.includes('CV')) {
    return FileEdit;
  }

  // Referral & Consent
  if (normType.includes('CONSENT_REQUESTED') || normType.includes('CONSENT_ACCEPTED')) {
    return UserCheck;
  }
  if (normType.includes('REFERRAL') || normType.includes('NOMINATE')) {
    return Send;
  }

  // Internship
  if (normType.includes('INTERNSHIP')) {
    return BookOpenCheck;
  }

  // Talent Request
  if (normType.includes('TALENT_REQUEST')) {
    return Users;
  }

  // Job match
  if (normType.includes('JOB_MATCHED') || normType.includes('JOB_RECOMMENDED') || normType.includes('JOB_CLOSED')) {
    return BriefcaseBusiness;
  }

  // Application
  if (normType.includes('APPLICATION_SUBMITTED') || normType.includes('APPLICATION_RECEIVED')) {
    return FileUser;
  }
  if (normType.includes('APPLICATION_VIEWED') || normType.includes('VIEWED')) {
    return Eye;
  }
  if (normType.includes('APPLICATION_APPROVED') || normType.includes('SHORTLISTED') || normType.includes('CONFIRMED')) {
    return CircleCheck;
  }
  if (normType.includes('APPLICATION_REJECTED') || normType.includes('DECLINED') || normType.includes('REJECTED')) {
    return CircleX;
  }

  // Interview & Scheduling
  if (normType.includes('INTERVIEW') || normType.includes('APPOINTMENT')) {
    return CalendarClock;
  }

  // Offer
  if (normType.includes('OFFER')) {
    return BadgeCheck;
  }

  // Overdue / Alert
  if (normType.includes('OVERDUE') || normType.includes('ALERT') || normType.includes('WARNING')) {
    return AlertTriangle;
  }
  if (normType.includes('REMINDER') || normType.includes('DUE_SOON')) {
    return Clock3;
  }

  // Fallback by category
  switch (normCat) {
    case 'job':
      return BriefcaseBusiness;
    case 'application':
      return FileUser;
    case 'interview':
      return CalendarClock;
    case 'advisor':
      return GraduationCap;
    case 'candidate':
      return UserRound;
    case 'offer':
      return BadgeCheck;
    case 'message':
      return MessageSquare;
    default:
      return Bell;
  }
}

export function NotificationIcon({
  type,
  category,
  priority,
  size = 20,
  className = '',
}: NotificationIconProps) {
  const IconComponent = getNotificationIconComponent(type, category);
  const semantic = getNotificationSemantic(type, category, priority);

  return (
    <div
      className={`notif-icon-wrapper notif-semantic-${semantic} ${className}`}
      aria-hidden="true"
    >
      <IconComponent size={size} strokeWidth={2} />
    </div>
  );
}

export {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock3,
  Ellipsis,
  Eye,
  FileCheck,
  FileEdit,
  FileText,
  FileUser,
  GraduationCap,
  ListTodo,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  UserRound,
  Users,
};
