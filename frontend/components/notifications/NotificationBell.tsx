'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ApiClient } from '../../api-client.js';
import { Bell } from './notificationIcons';
import NotificationPopover, { NotificationItem } from './NotificationPopover';

export type NotificationNavigationDetail =
  | { jobId: string }
  | { tab: 'candidates' | 'applications'; applicationId: string }
  | { studentId?: string | null }
  | { focusFeedback: boolean };

declare global {
  interface Window {
    switchView?: (view: string) => void;
  }
}

export interface NotificationBellProps {
  userRole?: string;
  onNavigate?: (view: string, detail?: NotificationNavigationDetail) => void;
}

export default function NotificationBell({
  userRole = 'student',
  onNavigate,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');

  // Fetch unread count for badge
  const fetchUnreadCount = useCallback(async () => {
    if (!ApiClient.isAuthenticated()) return;
    try {
      const data = await ApiClient.getNotificationUnreadCount();
      if (data && typeof data.unread_count === 'number') {
        setUnreadCount(data.unread_count);
      }
    } catch {
      // Fallback silent fail
    }
  }, []);

  // Fetch full notifications list
  const fetchNotifications = useCallback(async () => {
    if (!ApiClient.isAuthenticated()) return;
    try {
      const list = await ApiClient.listNotifications();
      if (Array.isArray(list)) {
        setNotifications(list);
        const unread = list.filter((item: NotificationItem) => !item.is_read).length;
        setUnreadCount(unread);
      }
    } catch {
      // Fallback
    }
  }, []);

  // Initial load and periodic refresh
  useEffect(() => {
    fetchUnreadCount();

    const handleRefresh = () => {
      fetchUnreadCount();
      if (isOpen) fetchNotifications();
    };

    window.addEventListener('career:notifications-refresh', handleRefresh);
    const interval = setInterval(fetchUnreadCount, 30000); // 30s poll

    return () => {
      window.removeEventListener('career:notifications-refresh', handleRefresh);
      clearInterval(interval);
    };
  }, [fetchUnreadCount, fetchNotifications, isOpen]);

  // When opening popover, load items
  const handleTogglePopover = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifications();
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

  // Click on a notification: mark read + deep link
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

    // 3. Deep link resolution
    if (onNavigate) {
      if (item.job_id && (item.category === 'job' || item.type === 'JOB_MATCHED')) {
        onNavigate('jobs', { jobId: item.job_id });
      } else if (item.application_id) {
        if (userRole === 'enterprise') {
          onNavigate('enterprise', { tab: 'candidates', applicationId: item.application_id });
        } else {
          onNavigate('jobs', { tab: 'applications', applicationId: item.application_id });
        }
      } else if (item.category === 'advisor') {
        if (userRole === 'counselor') {
          onNavigate('counselor', { studentId: item.candidate_id });
        } else {
          onNavigate('cv', { focusFeedback: true });
        }
      } else if (item.category === 'interview') {
        onNavigate('interview');
      } else {
        // Full notifications view fallback
        onNavigate('notifications');
      }
    } else if (typeof window !== 'undefined' && window.switchView) {
      if (item.job_id && (item.category === 'job' || item.type === 'JOB_MATCHED')) {
        window.switchView('jobs');
      } else if (item.application_id) {
        if (userRole === 'enterprise') {
          window.switchView('enterprise');
          window.dispatchEvent(new CustomEvent('navigate-enterprise', { detail: 'candidates' }));
        } else {
          window.switchView('jobs');
        }
      } else if (item.category === 'advisor') {
        if (userRole === 'counselor') {
          window.switchView('counselor');
        } else {
          window.switchView('cv');
        }
      } else if (item.category === 'interview') {
        window.switchView('interview');
      } else {
        window.switchView('notifications');
      }
    }
  };

  const handleViewAllClick = () => {
    setIsOpen(false);
    if (onNavigate) {
      onNavigate('notifications');
    } else if (typeof window !== 'undefined' && window.switchView) {
      window.switchView('notifications');
    }
  };

  return (
    <div className="header-notification-wrapper">
      <button
        type="button"
        id="btn-header-notification-bell"
        className={`notification-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={handleTogglePopover}
        aria-label="Thông báo"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell size={21} />
        {unreadCount > 0 && (
          <span className="notification-unread-badge" aria-label={`${unreadCount} thông báo chưa đọc`}>
            {unreadCount > 99 ? '99+' : unreadCount}
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
        userRole={userRole}
      />
    </div>
  );
}
