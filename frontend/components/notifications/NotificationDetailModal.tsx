/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect } from 'react';
import {
  X,
  Briefcase,
  Building,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { NotificationItem, formatTimeAgo } from './NotificationPopover';
import { NotificationIcon } from './notificationIcons';

interface Props {
  notification: NotificationItem | null;
  onClose: () => void;
  userRole?: string;
  onNavigate?: (view: string, detail?: any) => void;
}

export default function NotificationDetailModal({
  notification,
  onClose,
  userRole = 'student',
  onNavigate,
}: Props) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!notification) return null;

  const metadata = notification.metadata_json || {};
  const formattedDate = new Date(notification.created_at).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'application':
        return 'Hồ sơ & Ứng tuyển';
      case 'job':
        return 'Cơ hội việc làm';
      case 'interview':
        return 'Luyện phỏng vấn';
      case 'advisor':
        return 'Tư vấn & Cố vấn';
      case 'system':
        return 'Hệ thống';
      default:
        return 'Thông báo';
    }
  };

  const getDecisionBadge = (decision?: string) => {
    if (!decision) return null;
    const lower = String(decision).toLowerCase();
    if (lower === 'accepted' || lower === 'shortlisted' || lower === 'hired') {
      return {
        label: lower === 'hired' ? 'Đã tuyển dụng' : 'Đạt sơ tuyển',
        bg: '#dcfce7',
        color: '#15803d',
        icon: CheckCircle2,
      };
    }
    if (lower === 'interview') {
      return {
        label: 'Đã hẹn phỏng vấn',
        bg: '#dcfce7',
        color: '#15803d',
        icon: Calendar,
      };
    }
    if (lower === 'submitted' || lower === 'pending') {
      return {
        label: 'Đang xem xét',
        bg: '#eff6ff',
        color: '#1d4ed8',
        icon: CheckCircle2,
      };
    }
    if (lower === 'rejected') {
      return {
        label: 'Chưa phù hợp',
        bg: '#fee2e2',
        color: '#b91c1c',
        icon: AlertCircle,
      };
    }
    return {
      label: decision,
      bg: '#e0f2fe',
      color: '#0369a1',
      icon: CheckCircle2,
    };
  };

  const decisionBadge = getDecisionBadge(
    (metadata.decision as string) || (metadata.status as string)
  );

  const handleActionClick = () => {
    onClose();
    if (onNavigate) {
      if (notification.job_id && (notification.category === 'job' || notification.type === 'JOB_MATCHED')) {
        onNavigate('jobs', { jobId: notification.job_id });
      } else if (notification.application_id) {
      } else if (notification.category === 'advisor') {
        if (userRole === 'counselor') {
          onNavigate('counselor', { studentId: notification.candidate_id });
        } else {
          onNavigate('cv', { focusFeedback: true });
        }
      } else if (notification.category === 'interview') {
        onNavigate('interview');
      } else {
        onNavigate('find-jobs');
      }
    } else if (typeof window !== 'undefined' && window.switchView) {
      if (notification.job_id && (notification.category === 'job' || notification.type === 'JOB_MATCHED')) {
        window.switchView('find-jobs');
      } else if (notification.application_id) {
      } else if (notification.category === 'advisor') {
        if (userRole === 'counselor') {
          window.switchView('counselor');
        } else {
          window.switchView('cv');
        }
      } else if (notification.category === 'interview') {
        window.switchView('interview');
      } else {
        window.switchView('find-jobs');
      }
    }
  };

  const getActionBtnText = () => {
    if (notification.application_id) {
      return 'Xem danh sách việc phù hợp';
    }
    if (notification.job_id || notification.category === 'job') {
      return 'Xem công việc tuyển dụng';
    }
    if (notification.category === 'interview') {
      return 'Vào phòng phỏng vấn voice';
    }
    if (notification.category === 'advisor') {
      return 'Xem hồ sơ & Góp ý CV';
    }
    return 'Đi tới trang liên quan';
  };

  return (
    <div
      className="notification-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-modal-title"
    >
      <div className="notification-modal-card">
        {/* Header */}
        <div className="notification-modal-header">
          <div className="notification-modal-badge-row">
            <div className="notification-modal-icon-wrap">
              <NotificationIcon
                type={notification.type}
                category={notification.category}
                priority={notification.priority}
                size={22}
              />
            </div>
            <div className="notification-modal-category-info">
              <span className="notif-category-pill">
                {getCategoryName(notification.category)}
              </span>
              <span className="notif-time-text">
                <Clock size={12} /> {formatTimeAgo(notification.created_at)} ({formattedDate})
              </span>
            </div>
          </div>

          <button
            type="button"
            className="notification-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng"
            title="Đóng thông báo"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="notification-modal-body">
          <h2 id="notification-modal-title" className="notification-modal-title">
            {notification.title}
          </h2>

          <p className="notification-modal-message">{notification.message}</p>

          {/* Details / Metadata Info Card */}
          {(metadata.company_name ||
            metadata.job_title ||
            metadata.next_stage ||
            metadata.interview_time ||
            metadata.location ||
            decisionBadge) && (
            <div className="notification-meta-card">
              <h3 className="notif-meta-card-title">Chi tiết thông tin liên quan</h3>
              <div className="notif-meta-grid">
                {Boolean(metadata.company_name) && (
                  <div className="notif-meta-row">
                    <span className="meta-label">
                      <Building size={14} /> Doanh nghiệp:
                    </span>
                    <strong className="meta-value">{String(metadata.company_name)}</strong>
                  </div>
                )}

                {Boolean(metadata.job_title) && (
                  <div className="notif-meta-row">
                    <span className="meta-label">
                      <Briefcase size={14} /> Vị trí tuyển dụng:
                    </span>
                    <strong className="meta-value">{String(metadata.job_title)}</strong>
                  </div>
                )}

                {Boolean(decisionBadge) && decisionBadge && (
                  <div className="notif-meta-row">
                    <span className="meta-label">
                      <Sparkles size={14} /> Trạng thái kết quả:
                    </span>
                    <span
                      className="notif-decision-pill"
                      style={{
                        backgroundColor: decisionBadge.bg,
                        color: decisionBadge.color,
                      }}
                    >
                      <decisionBadge.icon size={13} /> {decisionBadge.label}
                    </span>
                  </div>
                )}

                {Boolean(metadata.next_stage) && (
                  <div className="notif-meta-row">
                    <span className="meta-label">
                      <ChevronRight size={14} /> Vòng tiếp theo:
                    </span>
                    <span className="meta-value">{String(metadata.next_stage)}</span>
                  </div>
                )}

                {Boolean(metadata.interview_time) && (
                  <div className="notif-meta-row">
                    <span className="meta-label">
                      <Calendar size={14} /> Thời gian phỏng vấn:
                    </span>
                    <span className="meta-value">{String(metadata.interview_time)}</span>
                  </div>
                )}

                {Boolean(metadata.location) && (
                  <div className="notif-meta-row">
                    <span className="meta-label">Địa điểm / Hình thức:</span>
                    <span className="meta-value">{String(metadata.location)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="notification-modal-footer">
          <button
            type="button"
            className="notif-modal-btn-secondary"
            onClick={onClose}
          >
            Đã đọc &amp; Đóng
          </button>
          <button
            type="button"
            className="notif-modal-btn-primary"
            onClick={handleActionClick}
          >
            <span>{getActionBtnText()}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
