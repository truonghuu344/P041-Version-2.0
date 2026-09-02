'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClient } from '@/api-client.js';
import { Bell } from './notificationIcons';
import NotificationPopover, { NotificationItem } from './NotificationPopover';

export type NotificationNavigationDetail =
  | { jobId?: string; tab?: string }
  | {
      tab: 'candidates' | 'applications' | 'referrals' | 'internships';
      applicationId?: string;
      referralId?: string | null;
      internshipId?: string | null;
    }
  | { tab: 'job-detail' | 'referral-detail' | 'internship-detail'; jobId?: string | null; referralId?: string | null; internshipId?: string | null }
  | { studentId?: string | null; tab?: string }
  | { focusFeedback?: boolean; taskId?: string };

declare global {
  interface Window {
    switchView?: (view: string) => void;
  }
}

export interface NotificationBellProps {
  userRole?: string;
  currentRole?: string;
  onNavigate?: (view: string, detail?: NotificationNavigationDetail) => void;
}

export default function NotificationBell({
  userRole: propUserRole,
  currentRole: propCurrentRole,
  onNavigate,
}: NotificationBellProps) {
  const effectivePropRole = propUserRole || propCurrentRole;
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [currentRole, setCurrentRole] = useState<string>(effectivePropRole || 'student');

  const isMountedRef = useRef<boolean>(true);
  const isOpenRef = useRef<boolean>(isOpen);
  const isFetchingRef = useRef<boolean>(false);
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
  const propUserRoleRef = useRef<string | undefined>(effectivePropRole);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    propUserRoleRef.current = effectivePropRole;
    if (effectivePropRole && effectivePropRole !== currentRole) {
      setCurrentRole(effectivePropRole);
    }
  }, [effectivePropRole, currentRole]);

  // Resolve current active role
  const resolveUserRole = useCallback(() => {
    if (propUserRoleRef.current) return propUserRoleRef.current;
    try {
      const user = ApiClient.getUser();
      return (user?.role as string) || 'student';
    } catch {
      return 'student';
    }
  }, []);

  // Fetch unread count for badge (deduplicated, event-driven, no periodic polling)
  const fetchUnreadCount = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (!ApiClient.isAuthenticated()) return;

    if (isFetchingRef.current && inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    isFetchingRef.current = true;
    const fetchPromise = (async () => {
      try {
        const data = await ApiClient.getNotificationUnreadCount();
        if (!isMountedRef.current) return;
        if (data && typeof data.unread_count === 'number') {
          setUnreadCount(data.unread_count);
        }
      } catch {
        // 503 / Network failure: handled gracefully without aggressive retry loop
      } finally {
        isFetchingRef.current = false;
        inFlightPromiseRef.current = null;
      }
    })();

    inFlightPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, []);

  // Fetch full notifications list
  const fetchNotifications = useCallback(async () => {
    if (!ApiClient.isAuthenticated()) return;
    try {
      const list = await ApiClient.listNotifications({ category: 'all' });
      if (Array.isArray(list) && isMountedRef.current) {
        setNotifications(list);
        const unread = list.filter((item: NotificationItem) => !item.is_read).length;
        setUnreadCount(unread);
      }
    } catch {
      // Silent fallback
    }
  }, []);

  // Initial load, role sync, visibility listener and event listeners
  useEffect(() => {
    isMountedRef.current = true;
    const role = resolveUserRole();
    setCurrentRole(role);

    // 1. Fetch unread-count once after authenticated initialization
    fetchUnreadCount();

    const handleRefresh = () => {
      const r = resolveUserRole();
      setCurrentRole(r);
      fetchUnreadCount();
      if (isOpenRef.current) fetchNotifications();
    };

    const handleAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const uRole = customEvent.detail?.user?.role || resolveUserRole();
      setCurrentRole(uRole);
      fetchUnreadCount();
      if (isOpenRef.current) fetchNotifications();
    };

    // 2. Refresh when browser tab becomes visible again
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (ApiClient.isAuthenticated()) {
          fetchUnreadCount();
          if (isOpenRef.current) fetchNotifications();
        }
      }
    };

    window.addEventListener('career:notifications-refresh', handleRefresh);
    window.addEventListener('auth:changed', handleAuthChange);
    window.addEventListener('career:backend-ready', handleRefresh);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('career:notifications-refresh', handleRefresh);
      window.removeEventListener('auth:changed', handleAuthChange);
      window.removeEventListener('career:backend-ready', handleRefresh);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [resolveUserRole, fetchUnreadCount, fetchNotifications]);

  // When opening popover, refresh notifications and unread count
  const handleTogglePopover = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setCurrentRole(resolveUserRole());
      fetchNotifications();
      fetchUnreadCount();
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await ApiClient.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Click on a notification: mark read + deep link to exact destination
  const handleNotificationClick = async (item: NotificationItem) => {
    // 1. Mark as read immediately in UI & API
    if (!item.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await ApiClient.markNotificationRead(item.id);
      } catch {
        // silent fail
      }
    }

    // 2. Close popover
    setIsOpen(false);

    // 3. Deep link resolution based on Role and Event Type
    const role = currentRole || 'student';
    const normType = (item.type || '').toUpperCase();

    if (onNavigate) {
      if (role === 'counselor') {
        if (normType.includes('INTERNSHIP')) {
          onNavigate('counselor', { tab: 'internships' });
        } else if (normType.includes('REFERRAL') || normType.includes('CONSENT')) {
          onNavigate('counselor', { tab: 'referrals', studentId: item.candidate_id });
        } else if (normType.includes('TALENT_REQUEST') || normType.includes('OPPORTUNITY')) {
          onNavigate('counselor', { tab: 'opportunities' });
        } else {
          onNavigate('counselor', { studentId: item.candidate_id });
        }
      } else if (role === 'admin') {
if (normType.includes('AI_') || normType.includes('TOKEN')) {
          onNavigate('admin', { tab: 'ai-usage' });
        } else if (normType.includes('SYSTEM')) {
          onNavigate('admin', { tab: 'system' });
        } else {
          onNavigate('admin', { tab: 'dashboard' });
        }
      } else {
        // Student role
        if (normType.includes('CV') || normType.includes('FEEDBACK') || normType.includes('TASK')) {
          onNavigate('cv', { focusFeedback: true });
        } else if (normType.includes('REFERRAL') || normType.includes('CONSENT')) {
          onNavigate('jobs', { tab: 'applications' });
        } else if (item.job_id && (item.category === 'job' || normType.includes('JOB'))) {
          onNavigate('jobs', { jobId: item.job_id });
        } else if (item.application_id || item.category === 'application' || item.category === 'interview') {
          onNavigate('jobs', { tab: 'applications', applicationId: item.application_id || undefined });
        } else {
          onNavigate('notifications');
        }
      }
    } else if (typeof window !== 'undefined' && window.switchView) {
      if (role === 'counselor') {
        window.switchView('counselor');
        if (normType.includes('INTERNSHIP')) {
          window.dispatchEvent(new CustomEvent('navigate-counselor', { detail: 'internships' }));
        } else if (normType.includes('REFERRAL') || normType.includes('CONSENT')) {
          window.dispatchEvent(new CustomEvent('navigate-counselor', { detail: 'referrals' }));
        } else if (normType.includes('TALENT_REQUEST')) {
          window.dispatchEvent(new CustomEvent('navigate-counselor', { detail: 'opportunities' }));
        }
      } else if (role === 'admin') {
        window.switchView('admin');
if (normType.includes('AI_') || normType.includes('TOKEN')) {
          window.dispatchEvent(new CustomEvent('navigate-admin', { detail: 'ai-usage' }));
        } else if (normType.includes('SYSTEM')) {
          window.dispatchEvent(new CustomEvent('navigate-admin', { detail: 'system' }));
        }
      } else {
        // Student role
        let targetView = 'notifications';
        if (normType.includes('CV') || normType.includes('FEEDBACK') || normType.includes('TASK')) {
          targetView = 'cv';
        } else if (item.job_id && (item.category === 'job' || normType.includes('JOB'))) {
          targetView = 'jobs';
        } else if (item.application_id || item.category === 'application' || item.category === 'interview') {
          targetView = 'jobs';
        }
        window.switchView(targetView);
        if (typeof window !== 'undefined' && window.history?.pushState) {
          window.history.pushState({ view: targetView }, '', `/student/${targetView}`);
        }
      }
    }
  };

  const handleViewAllClick = () => {
    setIsOpen(false);
    if (onNavigate) {
      onNavigate('notifications');
    } else if (typeof window !== 'undefined' && window.switchView) {
      window.switchView('notifications');
      if (typeof window !== 'undefined' && window.history?.pushState) {
        window.history.pushState({ view: 'notifications' }, '', '/student/notifications');
      }
    }
  };

  return (
    <div className="header-notification-wrapper" style={{ position: 'relative', overflow: 'visible' }}>
      <button
        type="button"
        id="btn-header-notification-bell"
        className={`notification-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={handleTogglePopover}
        aria-label="Thông báo"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            className="notification-unread-badge"
            aria-label={`${unreadCount} thông báo chưa đọc`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationPopover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        onMarkAllAsRead={handleMarkAllAsRead}
        onNotificationClick={handleNotificationClick}
        onViewAllClick={handleViewAllClick}
        userRole={currentRole}
      />
    </div>
  );
}
