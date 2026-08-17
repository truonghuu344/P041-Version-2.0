import React from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock3,
  Ellipsis,
  Eye,
  FileText,
  FileUser,
  GraduationCap,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';


export interface NotificationIconProps {
  type?: string;
  category?: string;
  entityType?: string;
  priority?: string;
  size?: number;
  className?: string;
}

/**
 * Maps notification event types and entities to semantic Lucide Icons.
 * Strictly adheres to 0% emojis, 100% Lucide React icons.
 */
export function getNotificationIconComponent(type?: string, category?: string) {
  const normType = (type || '').toUpperCase();
  const normCat = (category || '').toLowerCase();

  // Match by specific domain event type
  if (normType.includes('JOB_MATCHED') || normType.includes('JOB_RECOMMENDED') || normType.includes('JOB_CLOSED')) {
    return BriefcaseBusiness;
  }
  if (normType.includes('APPLICATION_SUBMITTED') || normType.includes('APPLICATION_RECEIVED')) {
    return FileUser;
  }
  if (normType.includes('APPLICATION_VIEWED') || normType.includes('VIEWED')) {
    return Eye;
  }
  if (normType.includes('APPLICATION_APPROVED') || normType.includes('OFFER_ACCEPTED') || normType.includes('APPROVED')) {
    return CircleCheck;
  }
  if (normType.includes('APPLICATION_REJECTED') || normType.includes('OFFER_DECLINED') || normType.includes('REJECTED')) {
    return CircleX;
  }
  if (normType.includes('INTERVIEW') || normType.includes('APPOINTMENT')) {
    return CalendarClock;
  }
  if (normType.includes('EMAIL')) {
    return Mail;
  }
  if (normType.includes('OFFER')) {
    return BadgeCheck;
  }
  if (normType.includes('FEEDBACK') || normType.includes('CV')) {
    return FileText;
  }
  if (normType.includes('CHANGE_REQUESTED') || normType.includes('ACTION_REQUIRED')) {
    return CircleAlert;
  }
  if (normType.includes('REFERRAL') || normType.includes('ADVISOR')) {
    return GraduationCap;
  }
  if (normType.includes('MESSAGE') || normType.includes('QUESTION')) {
    return MessageSquare;
  }
  if (normType.includes('REMINDER')) {
    return Clock3;
  }
  if (normType.includes('RESPONSE') || normType.includes('UPDATED')) {
    return RefreshCw;
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

  let colorClass = 'notif-icon-default';
  if (priority === 'high') {
    colorClass = 'notif-icon-high';
  } else if (priority === 'important') {
    colorClass = 'notif-icon-important';
  } else if (category === 'advisor') {
    colorClass = 'notif-icon-advisor';
  } else if (category === 'job') {
    colorClass = 'notif-icon-job';
  } else if (category === 'application') {
    colorClass = 'notif-icon-application';
  }

  return (
    <div className={`notif-icon-wrapper ${colorClass} ${className}`} aria-hidden="true">
      <IconComponent size={size} strokeWidth={2} />
    </div>
  );
}

export {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock3,
  Ellipsis,
  Eye,
  FileText,
  FileUser,
  GraduationCap,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
};

