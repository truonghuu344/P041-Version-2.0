import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import NotificationBell from '@/components/notifications/NotificationBell';
import NotificationPopover from '@/components/notifications/NotificationPopover';
import { getNotificationSemantic, getNotificationCTA } from '@/components/notifications/notificationIcons';
import { ApiClient } from '@/api-client.js';

jest.mock('@/api-client.js', () => ({
  ApiClient: {
    isAuthenticated: jest.fn(() => true),
    getUser: jest.fn(() => ({ id: 'user-1', email: 'test@example.com', role: 'student' })),
    getNotificationUnreadCount: jest.fn().mockResolvedValue({ unread_count: 2, total_count: 5 }),
    listNotifications: jest.fn().mockResolvedValue([
      {
        id: 'notif-1',
        recipient_user_id: 'user-1',
        recipient_role: 'student',
        type: 'JOB_MATCHED',
        category: 'job',
        entity_type: 'job',
        entity_id: 'job-1',
        title: 'Có công việc mới phù hợp với bạn',
        message: 'FPT Software vừa đăng vị trí Java Backend Intern.',
        is_read: false,
        priority: 'normal',
        action_url: '/jobs/job-1',
        job_id: 'job-1',
        metadata_json: { company: 'FPT Software', tags: ['Hybrid'] },
        created_at: new Date().toISOString(),
      },
      {
        id: 'notif-2',
        recipient_user_id: 'user-1',
        recipient_role: 'student',
        type: 'INTERVIEW_INVITED',
        category: 'interview',
        entity_type: 'interview',
        entity_id: 'app-1',
        title: 'Bạn có lời mời phỏng vấn',
        message: 'FPT Software mời bạn phỏng vấn cho vị trí Java Backend Intern.',
        is_read: true,
        priority: 'high',
        action_url: '/applications/app-1/interview',
        application_id: 'app-1',
        created_at: new Date().toISOString(),
      },
    ]),
    markNotificationRead: jest.fn().mockResolvedValue({}),
    markAllNotificationsRead: jest.fn().mockResolvedValue({ updated_count: 2 }),
  },
}));

describe('Role-Aware NotificationBell & Popover Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders Notification Bell with unread badge when unread > 0', async () => {
    render(<NotificationBell userRole="student" />);

    const bellBtn = screen.getByRole('button', { name: /thông báo/i });
    expect(bellBtn).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  test('opens Popover when clicking Bell and displays notifications', async () => {
    render(<NotificationBell userRole="student" />);

    const bellBtn = screen.getByRole('button', { name: /thông báo/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /trung tâm thông báo/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Có công việc mới phù hợp với bạn')).toBeInTheDocument();
    expect(screen.getByText('Bạn có lời mời phỏng vấn')).toBeInTheDocument();
  });

  test('filters notifications by role category tab for Student', () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        recipient_user_id: 'user-1',
        recipient_role: 'student',
        type: 'APPLICATION_APPROVED',
        category: 'application',
        entity_type: 'application',
        title: 'Hồ sơ của bạn đã được duyệt',
        message: 'FPT Software đã duyệt hồ sơ.',
        is_read: false,
        priority: 'normal' as const,
        action_url: '/jobs/job-1/applications/app-1',
        created_at: new Date().toISOString(),
      },
      {
        id: 'notif-2',
        recipient_user_id: 'user-1',
        recipient_role: 'student',
        type: 'ADVISOR_FEEDBACK_SENT',
        category: 'advisor',
        entity_type: 'cv',
        title: 'CV cần chỉnh sửa',
        message: 'Cố vấn đã gửi góp ý cho CV Backend của bạn.',
        is_read: false,
        priority: 'normal' as const,
        action_url: '/cv/1/feedback',
        created_at: new Date().toISOString(),
      },
    ];

    const { rerender } = render(
      <NotificationPopover
        isOpen={true}
        onClose={jest.fn()}
        notifications={mockNotifications}
        unreadCount={2}
        activeCategory="all"
        onSelectCategory={jest.fn()}
        onMarkAllAsRead={jest.fn()}
        onNotificationClick={jest.fn()}
        onViewAllClick={jest.fn()}
        userRole="student"
      />
    );

    expect(screen.getByText('Hồ sơ của bạn đã được duyệt')).toBeInTheDocument();
    expect(screen.getByText('CV cần chỉnh sửa')).toBeInTheDocument();

    // Rerender with 'application' filter
    rerender(
      <NotificationPopover
        isOpen={true}
        onClose={jest.fn()}
        notifications={mockNotifications}
        unreadCount={2}
        activeCategory="application"
        onSelectCategory={jest.fn()}
        onMarkAllAsRead={jest.fn()}
        onNotificationClick={jest.fn()}
        onViewAllClick={jest.fn()}
        userRole="student"
      />
    );

    expect(screen.getByText('Hồ sơ của bạn đã được duyệt')).toBeInTheDocument();
    expect(screen.queryByText('CV cần chỉnh sửa')).not.toBeInTheDocument();
  });

  test('displays appropriate CTA and semantic colors for each role', () => {
    // 1. Student CV revision CTA
    expect(getNotificationCTA('CV_REVISION_REQUESTED', 'advisor', 'student')).toBe('Xem góp ý');
    expect(getNotificationSemantic('CV_REVISION_REQUESTED', 'advisor', 'normal')).toBe('warning');

    // 2. Student Referral consent CTA
    expect(getNotificationCTA('REFERRAL_CONSENT_REQUESTED', 'advisor', 'student')).toBe('Xem và xác nhận');
    expect(getNotificationSemantic('REFERRAL_CONSENT_REQUESTED', 'advisor', 'high')).toBe('warning');

    // 3. Counselor Student consent accepted CTA
    expect(getNotificationCTA('REFERRAL_CONSENT_ACCEPTED', 'advisor', 'counselor')).toBe('Gửi tiến cử');
    expect(getNotificationSemantic('REFERRAL_CONSENT_ACCEPTED', 'advisor', 'normal')).toBe('success');

  });

  test('displays 9+ when unread count exceeds 9', () => {
    render(
      <NotificationPopover
        isOpen={true}
        onClose={jest.fn()}
        notifications={[]}
        unreadCount={15}
        activeCategory="all"
        onSelectCategory={jest.fn()}
        onMarkAllAsRead={jest.fn()}
        onNotificationClick={jest.fn()}
        onViewAllClick={jest.fn()}
        userRole="counselor"
      />
    );

    expect(screen.getByText('9+ mới')).toBeInTheDocument();
  });

  test('fetches unread count on mount without periodic polling timer', async () => {
    jest.useFakeTimers();
    const mockGetUnreadCount = ApiClient.getNotificationUnreadCount as jest.Mock;

    render(<NotificationBell userRole="student" />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);

    // Fast forward 60 seconds -> should NOT make periodic polling requests
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  test('refreshes unread count on tab visibility change and bell click', async () => {
    const mockGetUnreadCount = ApiClient.getNotificationUnreadCount as jest.Mock;
    render(<NotificationBell userRole="student" />);

    await waitFor(() => {
      expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);
    });

    // 1. Simulate tab becoming visible again
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(mockGetUnreadCount).toHaveBeenCalledTimes(2);
    });

    // 2. Open Notification Bell -> triggers refresh
    const bellBtn = screen.getByRole('button', { name: /thông báo/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(mockGetUnreadCount).toHaveBeenCalledTimes(3);
    });
  });

  test('handles 503/network error gracefully without aggressive retry loop', async () => {
    const mockGetUnreadCount = ApiClient.getNotificationUnreadCount as jest.Mock;
    mockGetUnreadCount.mockRejectedValueOnce(new Error('503 Service Unavailable'));

    render(<NotificationBell userRole="student" />);

    await waitFor(() => {
      expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);
    });
    // Component renders safely with default 0 without crashing or aggressively retrying
    const bellBtn = screen.getByRole('button', { name: /thông báo/i });
    expect(bellBtn).toBeInTheDocument();
  });
});
