import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationBell from '../NotificationBell';
import NotificationPopover from '../NotificationPopover';

jest.mock('../../../api-client.js', () => ({
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
        message: 'ABC Technology vừa đăng vị trí Backend Developer tại TP. Hồ Chí Minh.',
        is_read: false,
        priority: 'normal',
        action_url: '/jobs/job-1',
        job_id: 'job-1',
        metadata_json: { tags: ['Hybrid', 'Full-time'] },
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
        message: 'ABC Technology mời bạn phỏng vấn cho vị trí Backend Developer.',
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

describe('NotificationBell & Popover Tests', () => {
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

  test('filters notifications by category tab', () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        recipient_user_id: 'user-1',
        recipient_role: 'student',
        type: 'APPLICATION_APPROVED',
        category: 'application',
        entity_type: 'application',
        title: 'Hồ sơ của bạn đã được duyệt',
        message: 'ABC Technology đã duyệt hồ sơ.',
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
        title: 'Bạn có nhận xét mới từ cố vấn',
        message: 'Cố vấn Minh Anh đã gửi nhận xét.',
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
    expect(screen.getByText('Bạn có nhận xét mới từ cố vấn')).toBeInTheDocument();

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
    expect(screen.queryByText('Bạn có nhận xét mới từ cố vấn')).not.toBeInTheDocument();
  });
});
