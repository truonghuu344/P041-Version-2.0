'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ApiClient } from '../../api-client.js';
import {
  Bell,
  CheckCheck,
  NotificationIcon,
  Search,
  SlidersHorizontal,
} from './notificationIcons';
import { formatTimeAgo, NotificationItem } from './NotificationPopover';

export default function NotificationsView() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [userRole, setUserRole] = useState<string>('student');
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load user role
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const user = ApiClient.getUser();
      if (user?.role) {
        setUserRole(user.role);
      }
    }
  }, []);

  // Fetch notifications
  const loadNotifications = useCallback(async () => {
    if (!ApiClient.isAuthenticated()) return;
    setIsLoading(true);
    try {
      const data = await ApiClient.listNotifications({ category: 'all' });
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const handleRefresh = () => loadNotifications();
    window.addEventListener('career:notifications-refresh', handleRefresh);
    return () => window.removeEventListener('career:notifications-refresh', handleRefresh);
  }, [loadNotifications]);

  // Mark single as read
  const handleItemClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      try {
        await ApiClient.markNotificationRead(item.id);
        window.dispatchEvent(new Event('career:notifications-refresh'));
      } catch {
        // silent fail
      }
    }

    // Deep link navigation
    if (typeof window !== 'undefined' && (window as any).switchView) {
      if (item.job_id && (item.category === 'job' || item.type === 'JOB_MATCHED')) {
        (window as any).switchView('jobs');
      } else if (item.application_id) {
        if (userRole === 'enterprise') {
          (window as any).switchView('enterprise');
          window.dispatchEvent(new CustomEvent('navigate-enterprise', { detail: 'candidates' }));
        } else {
          (window as any).switchView('jobs');
        }
      } else if (item.category === 'advisor') {
        if (userRole === 'counselor') {
          (window as any).switchView('counselor');
        } else {
          (window as any).switchView('cv');
        }
      } else if (item.category === 'interview') {
        (window as any).switchView('interview');
      }
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await ApiClient.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true, read_at: new Date().toISOString() }))
      );
      window.dispatchEvent(new Event('career:notifications-refresh'));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  // Subtitle based on role (Section 29)
  const getRoleSubtitle = () => {
    switch (userRole) {
      case 'enterprise':
        return 'Cập nhật về ứng viên và hoạt động tuyển dụng.';
      case 'counselor':
        return 'Cập nhật từ ứng viên và các hoạt động tư vấn.';
      default:
        return 'Cập nhật về công việc, hồ sơ ứng tuyển và cố vấn của bạn.';
    }
  };

  // Filter categories based on role (Section 19)
  const getCategoriesForRole = () => {
    if (userRole === 'enterprise') {
      return [
        { id: 'all', label: 'Tất cả danh mục' },
        { id: 'application', label: 'Ứng viên' },
        { id: 'job', label: 'Tin tuyển dụng' },
        { id: 'interview', label: 'Phỏng vấn' },
      ];
    }
    if (userRole === 'counselor') {
      return [
        { id: 'all', label: 'Tất cả danh mục' },
        { id: 'advisor', label: 'Ứng viên' },
        { id: 'interview', label: 'Lịch' },
        { id: 'message', label: 'Trao đổi' },
      ];
    }
    return [
      { id: 'all', label: 'Tất cả danh mục' },
      { id: 'application', label: 'Ứng tuyển' },
      { id: 'job', label: 'Doanh nghiệp' },
      { id: 'advisor', label: 'Cố vấn' },
    ];
  };

  const categories = getCategoriesForRole();

  // Filter items
  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'unread' && item.is_read) return false;
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q) ||
        (item.metadata_json && JSON.stringify(item.metadata_json).toLowerCase().includes(q))
      );
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Empty state copy based on role (Section 30)
  const getEmptyStateCopy = () => {
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

  const emptyStateCopy = getEmptyStateCopy();

  return (
    <section className="app-view notifications-view-page" id="view-notifications" style={{ display: 'none' }}>
      {/* Header */}
      <div className="notifications-page-header">
        <div className="notifications-page-title-group">
          <h1>
            <Bell size={24} />
            <span>Thông báo</span>
          </h1>
          <p className="notifications-page-subtitle">{getRoleSubtitle()}</p>
        </div>

        <button
          type="button"
          className="notifications-header-mark-all-btn"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
        >
          <CheckCheck size={16} />
          <span>Đánh dấu tất cả đã đọc</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="notifications-toolbar">
        <div className="notifications-toolbar-left">
          {/* Status Tabs */}
          <div className="notification-popover-tabs" style={{ padding: 0, background: 'transparent', border: 'none' }}>
            <button
              type="button"
              className={`notification-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              type="button"
              className={`notification-tab-btn ${activeTab === 'unread' ? 'active' : ''}`}
              onClick={() => setActiveTab('unread')}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          {/* Category Filter */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
            <SlidersHorizontal size={15} style={{ color: '#64748b' }} />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="custom-select"
              style={{
                fontSize: '13px',
                padding: '5px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#334155',
                outline: 'none',
              }}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="notifications-toolbar-right">
          <div className="notifications-search-input-wrap">
            <span className="notifications-search-icon">
              <Search size={15} />
            </span>
            <input
              type="text"
              placeholder="Tìm kiếm thông báo..."
              className="notifications-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="notifications-full-list">
        {filteredNotifications.length === 0 ? (
          <div className="notification-empty-state" style={{ padding: '60px 20px' }}>
            <div className="notification-empty-icon" style={{ width: '56px', height: '56px' }}>
              <Bell size={28} />
            </div>
            <h3 className="notification-empty-title">{emptyStateCopy.title}</h3>
            <p className="notification-empty-desc">{emptyStateCopy.desc}</p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const timeAgo = formatTimeAgo(item.created_at);
            const metadata = item.metadata_json || {};
            const tag = metadata.tags?.[0] || metadata.next_stage || metadata.location;

            return (
              <div
                key={item.id}
                className={`notifications-full-item ${!item.is_read ? 'unread' : ''}`}
                onClick={() => handleItemClick(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleItemClick(item);
                  }
                }}
              >
                <NotificationIcon
                  type={item.type}
                  category={item.category}
                  priority={item.priority}
                  size={22}
                />
                <div className="notif-content">
                  <div className="notif-title-row">
                    <h4 className="notif-title">{item.title}</h4>
                    {!item.is_read && <span className="notif-unread-indicator" title="Chưa đọc" />}
                  </div>
                  <p className="notif-message">{item.message}</p>
                  <div className="notif-meta-row">
                    {item.priority === 'high' && (
                      <span className="notif-tag priority-high">Ưu tiên cao</span>
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
    </section>
  );
}
