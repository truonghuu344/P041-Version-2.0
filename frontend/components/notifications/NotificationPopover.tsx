'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpRight,
  Bell,
  CheckCheck,
  ChevronRight,
  getNotificationCTA,
  getNotificationSemantic,
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
    company?: string;
    job_title?: string;
    role?: string;
    quantity?: number;
    deadline?: string;
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
    if (diffSec < 172800) return 'Hôm qua';
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} ngày trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
  const [mounted, setMounted] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number }>({ top: 70, right: 70 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePopoverPos = useCallback(() => {
    const bellBtn = document.getElementById('btn-header-notification-bell');
    if (bellBtn) {
      const rect = bellBtn.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 8,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePopoverPos();
      window.addEventListener('resize', updatePopoverPos);
      window.addEventListener('scroll', updatePopoverPos, true);
      return () => {
        window.removeEventListener('resize', updatePopoverPos);
        window.removeEventListener('scroll', updatePopoverPos, true);
      };
    }
  }, [isOpen, updatePopoverPos]);

  // Close when clicking outside, excluding bell button trigger
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const bellBtn = document.getElementById('btn-header-notification-bell');
      const target = event.target as Node;
      if (bellBtn && bellBtn.contains(target)) {
        return;
      }
      if (popoverRef.current && popoverRef.current.contains(target)) {
        return;
      }
      console.log('[DEBUG Header] Notification Popover outside click closing popover', target);
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  // Filter tabs configured per role
  const getTabsForRole = () => {
    if (userRole === 'counselor') {
      return [
        { id: 'all', label: 'Tất cả' },
        { id: 'unread', label: 'Chưa đọc' },
        { id: 'advisor', label: 'Hồ sơ & CV' },
        { id: 'candidate', label: 'Tiến cử' },
        { id: 'application', label: 'Thực tập' },
      ];
    }
    if (userRole === 'admin') {
      return [
        { id: 'all', label: 'Tất cả' },
        { id: 'unread', label: 'Chưa đọc' },
        { id: 'system', label: 'Hệ thống' },
        { id: 'candidate', label: 'Người dùng' },
      ];
    }
    // Student default
    return [
      { id: 'all', label: 'Tất cả' },
      { id: 'unread', label: 'Chưa đọc' },
      { id: 'application', label: 'Ứng tuyển' },
      { id: 'advisor', label: 'Cố vấn' },
      { id: 'job', label: 'Việc làm' },
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
    if (userRole === 'counselor') {
      return {
        title: 'Chưa có thông báo',
        desc: 'Cập nhật tiến độ của sinh viên, yêu cầu nhân lực và xác nhận tiến cử sẽ xuất hiện tại đây.',
      };
    }
    if (userRole === 'admin') {
      return {
        title: 'Chưa có thông báo',
        desc: 'Các cảnh báo hệ thống, kiểm duyệt doanh nghiệp và báo cáo sẽ xuất hiện tại đây.',
      };
    }
    return {
      title: 'Chưa có thông báo',
      desc: 'Cập nhật từ doanh nghiệp tuyển dụng và nhận xét từ cố vấn sẽ xuất hiện tại đây.',
    };
  };

  const emptyInfo = getEmptyMessage();

  return createPortal(
    <div
      ref={popoverRef}
      className="notification-popover-card"
      role="dialog"
      aria-label="Trung tâm thông báo"
      aria-modal="true"
      style={{
        position: 'fixed',
        top: `${popoverPos.top}px`,
        right: `${popoverPos.right}px`,
        zIndex: 1000000,
        pointerEvents: 'auto',
      }}
    >
      {/* Popover Header */}
      <div className="notification-popover-header">
        <div className="notification-popover-title-row">
          <h3 className="notification-popover-title">Thông báo</h3>
          <span className={`notification-count-tag ${unreadCount > 0 ? 'has-unread' : ''}`}>
            {unreadCount > 0 ? `${unreadCount > 9 ? '9+' : unreadCount} mới` : 'Đã cập nhật'}
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
          <span>Đánh dấu tất cả đã đọc</span>
        </button>
      </div>

      {/* Role Quick Filter Tabs */}
      <div className="notification-popover-tabs" role="tablist" aria-label="Bộ lọc thông báo">
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
      <div className="notification-popover-list" tabIndex={0} aria-label="Danh sách thông báo">
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
            const tag =
              metadata.company ||
              metadata.role ||
              metadata.interview_time ||
              metadata.next_stage ||
              metadata.tags?.[0] ||
              metadata.location;

            const semantic = getNotificationSemantic(item.type, item.category, item.priority);
            const ctaLabel = getNotificationCTA(item.type, item.category, userRole);

            return (
              <div
                key={item.id}
                className={`notification-item-card ${!item.is_read ? 'unread' : 'read'} notif-card-semantic-${semantic}`}
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
                    {!item.is_read && (
                      <span className="notif-unread-indicator" title="Chưa đọc" aria-label="Chưa đọc" />
                    )}
                  </div>
                  <p className="notif-message">{item.message}</p>
                  <div className="notif-meta-row">
                    {semantic === 'warning' && (
                      <span className="notif-tag priority-warning">Cần xử lý</span>
                    )}
                    {semantic === 'danger' && (
                      <span className="notif-tag priority-danger">Quan trọng</span>
                    )}
                    {semantic === 'success' && (
                      <span className="notif-tag priority-success">Hoàn thành</span>
                    )}
                    {tag && <span className="notif-tag">{tag}</span>}
                    {timeAgo && <span className="notif-time">{timeAgo}</span>}
                  </div>
                  <div className="notif-cta-container">
                    <button
                      type="button"
                      className={`notif-inline-cta notif-cta-semantic-${semantic}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onNotificationClick(item);
                      }}
                    >
                      <span>{ctaLabel}</span>
                      <ChevronRight size={14} />
                    </button>
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
          <span>Xem tất cả</span>
          <ArrowUpRight size={15} />
        </button>
      </div>
    </div>,
    document.body
  );
}
