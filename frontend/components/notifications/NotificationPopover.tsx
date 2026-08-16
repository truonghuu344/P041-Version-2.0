'use client';

import React, { useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  Bell,
  CheckCheck,
  NotificationIcon,
} from './notificationIcons';

export interface NotificationItem {
  id: string;
  recipient_user_id: string;
  recipient_role: string;
  actor_user_id?: string | null;
  actor_role?: string | null;
  type: string;
  category: string;
  entity_type: string;
  entity_id?: string | null;
  title: string;
  message: string;
  is_read: boolean;
  read_at?: string | null;
  priority: 'normal' | 'important' | 'high';
  action_url: string;
  company_id?: string | null;
  job_id?: string | null;
  application_id?: string | null;
  candidate_id?: string | null;
  advisor_id?: string | null;
  metadata_json?: {
    tags?: string[];
    location?: string;
    interview_time?: string;
    next_stage?: string;
    decision?: string;
    [key: string]: unknown;
  } | null;
  created_at: string;
}

export interface NotificationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  unreadCount: number;
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
  onMarkAllAsRead: () => void;
  onNotificationClick: (item: NotificationItem) => void;
  onViewAllClick: () => void;
  userRole?: string;
}

export function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Vừa xong';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} ngày trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

export default function NotificationPopover({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  activeCategory,
  onSelectCategory,
  onMarkAllAsRead,
  onNotificationClick,
  onViewAllClick,
  userRole = 'student',
}: NotificationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter tabs configured per role
  const getTabsForRole = () => {
    if (userRole === 'enterprise') {
      return [
        { id: 'all', label: 'Tất cả' },
        { id: 'unread', label: 'Chưa đọc' },
        { id: 'application', label: 'Ứng viên' },
        { id: 'interview', label: 'Phỏng vấn' },
      ];
    }
    if (userRole === 'counselor') {
      return [
        { id: 'all', label: 'Tất cả' },
        { id: 'unread', label: 'Chưa đọc' },
        { id: 'advisor', label: 'Ứng viên' },
        { id: 'interview', label: 'Lịch' },
      ];
    }
    // Candidate default
    return [
      { id: 'all', label: 'Tất cả' },
      { id: 'unread', label: 'Chưa đọc' },
      { id: 'application', label: 'Ứng tuyển' },
      { id: 'advisor', label: 'Cố vấn' },
    ];
  };

  const tabs = getTabsForRole();

  // Filter list by activeCategory
  const filteredNotifications = notifications.filter((item) => {
    if (activeCategory === 'unread') return !item.is_read;
    if (activeCategory === 'all') return true;
    return item.category === activeCategory;
  });

  const getEmptyMessage = () => {
    if (userRole === 'enterprise') {
      return {
        title: 'Chưa có thông báo',
        desc: 'Hoạt động mới từ ứng viên sẽ xuất hiện tại đây.',
      };
    }
    if (userRole === 'counselor') {
      return {
        title: 'Chưa có thông báo',
        desc: 'Các yêu cầu và cập nhật từ ứng viên sẽ xuất hiện tại đây.',
      };
    }
    return {
      title: 'Chưa có thông báo',
      desc: 'Cập nhật từ doanh nghiệp và cố vấn sẽ xuất hiện tại đây.',
    };
  };

  const emptyInfo = getEmptyMessage();

  return (
    <div
      ref={popoverRef}
      className="notification-popover-card"
      role="dialog"
      aria-label="Trung tâm thông báo"
    >
      {/* Popover Header */}
      <div className="notification-popover-header">
        <div className="notification-popover-title-row">
          <h3 className="notification-popover-title">Thông báo</h3>
          <span className={`notification-count-tag ${unreadCount > 0 ? 'has-unread' : ''}`}>
            {unreadCount > 0 ? `${unreadCount} mới` : 'Đã cập nhật'}
          </span>
        </div>
        <button
          type="button"
          className="notification-btn-mark-all"
          onClick={onMarkAllAsRead}
          disabled={unreadCount === 0}
          title="Đánh dấu tất cả đã đọc"
        >
          <CheckCheck size={16} />
          <span>Đã đọc tất cả</span>
        </button>
      </div>

      {/* Role Quick Filter Tabs */}
      <div className="notification-popover-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeCategory === tab.id}
            className={`notification-tab-btn ${activeCategory === tab.id ? 'active' : ''}`}
            onClick={() => onSelectCategory(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification Items List */}
      <div className="notification-popover-list">
        {filteredNotifications.length === 0 ? (
          <div className="notification-empty-state">
            <div className="notification-empty-icon">
              <Bell size={24} />
            </div>
            <h4 className="notification-empty-title">{emptyInfo.title}</h4>
            <p className="notification-empty-desc">{emptyInfo.desc}</p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const timeAgo = formatTimeAgo(item.created_at);
            const metadata = item.metadata_json || {};
            const tag = metadata.tags?.[0] || metadata.next_stage || metadata.location;

            return (
              <div
                key={item.id}
                className={`notification-item-card ${!item.is_read ? 'unread' : ''}`}
                onClick={() => onNotificationClick(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNotificationClick(item);
                  }
                }}
              >
                <NotificationIcon
                  type={item.type}
                  category={item.category}
                  priority={item.priority}
                  size={19}
                />
                <div className="notif-content">
                  <div className="notif-title-row">
                    <h5 className="notif-title">{item.title}</h5>
                    {!item.is_read && <span className="notif-unread-indicator" title="Chưa đọc" />}
                  </div>
                  <p className="notif-message">{item.message}</p>
                  <div className="notif-meta-row">
                    {item.priority === 'high' && (
                      <span className="notif-tag priority-high">Ưu tiên</span>
                    )}
                    {tag && <span className="notif-tag">{tag}</span>}
                    {timeAgo && <span className="notif-time">{timeAgo}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Popover Footer */}
      <div className="notification-popover-footer">
        <button
          type="button"
          className="notification-btn-view-all"
          onClick={() => {
            onClose();
            onViewAllClick();
          }}
        >
          <span>Xem tất cả thông báo</span>
          <ArrowUpRight size={16} />
        </button>
      </div>
    </div>
  );
}
