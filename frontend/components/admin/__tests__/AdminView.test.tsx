/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AdminView, { parseAdminRoute } from '@/components/admin/AdminView';
import AdminUsers from '@/components/admin/AdminUsers';
import { AdminApi } from '@/lib/api/adminApi';

const mockGetMe = jest.fn();
const mockUpdateProfile = jest.fn();
const mockChangePassword = jest.fn();
const mockUploadAvatar = jest.fn();
const mockDeleteAvatar = jest.fn();

jest.mock('@/api-client.js', () => ({
  ApiClient: {
    getMe: (...args: any[]) => mockGetMe(...args),
    updateProfile: (...args: any[]) => mockUpdateProfile(...args),
    changePassword: (...args: any[]) => mockChangePassword(...args),
    uploadAvatar: (...args: any[]) => mockUploadAvatar(...args),
    deleteAvatar: (...args: any[]) => mockDeleteAvatar(...args),
    getUser: jest.fn(() => null),
    setUser: jest.fn(),
  },
}));

jest.mock('@/lib/api/adminApi');

const MOCK_DASHBOARD = {
  counts: {
    users: 42,
    students: 30,
    counselors: 5,
    jobs: 12,
    applications: 25,
    internships: 8,
    unread_notifications: 4,
    delayed_reports: 1,
    referrals: 7,
  },
  recent_activity: [
    { id: 'ev1', event: 'cv_uploaded', user_name: 'Nguyễn Văn A', created_at: '2026-08-20T09:00:00Z', metadata: {} },
  ],
};

const MOCK_USERS_PAGE = {
  items: [
    { id: 'u1', email: 'sv@example.com', full_name: 'Sinh Viên A', role: 'student', created_at: '2026-07-01T00:00:00Z' },
    { id: 'u2', email: 'counselor@example.com', full_name: 'Cố Vấn B', role: 'counselor', created_at: '2026-07-02T00:00:00Z' },
  ],
  total: 2,
  limit: 20,
  offset: 0,
};

describe('parseAdminRoute', () => {
  it('maps /admin to dashboard and deep links to their tabs', () => {
    expect(parseAdminRoute('/admin')).toBe('dashboard');
    expect(parseAdminRoute('/admin/users')).toBe('users');
    expect(parseAdminRoute('/admin/recruitment')).toBe('recruitment');
    expect(parseAdminRoute('/admin/unknown')).toBe('dashboard');
  });
});

describe('AdminView shell', () => {
  beforeAll(() => {
    window.scrollTo = jest.fn();
  });

  beforeEach(() => {
    window.history.pushState(null, '', '/admin');
    (AdminApi.getDashboard as jest.Mock).mockResolvedValue(MOCK_DASHBOARD);
    (AdminApi.getUsersPage as jest.Mock).mockResolvedValue(MOCK_USERS_PAGE);
    (AdminApi.getCounselors as jest.Mock).mockResolvedValue([]);
    (AdminApi.getRecruitment as jest.Mock).mockResolvedValue({
      jobs: [],
      applications: [],
      referrals: [],
      stats: { total_jobs: 0, published_jobs: 0, total_applications: 0, total_referrals: 0, applications_by_status: {} },
    });
    (AdminApi.getInternships as jest.Mock).mockResolvedValue([]);
    (AdminApi.getInternshipSummary as jest.Mock).mockResolvedValue({ total: 0, by_status: {}, reports_by_status: {}, evaluated: 0 });
    (AdminApi.getSystem as jest.Mock).mockResolvedValue({
      notification_count: 0,
      unread_notification_count: 0,
      ai_log_count: 0,
      usage_event_count: 0,
      internship_count: 0,
      notification_categories: {},
    });
    (AdminApi.getAuditLogs as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (AdminApi.getNotifications as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('renders the admin shell without a duplicated header menu', async () => {
    render(<AdminView isActive />);
    // Hero tiêu đề dùng chung không còn lặp trên mọi tab; nội dung vẫn nạp.
    expect(screen.queryByText('Điều hành nền tảng')).not.toBeInTheDocument();
    // Điều hướng duy nhất nằm ở AppHeader — trong trang không còn dải tab lặp.
    expect(screen.queryByRole('tablist', { name: /Khu vực quản trị/i })).not.toBeInTheDocument();
    expect(await screen.findByText('Cần chú ý')).toBeInTheDocument();
  });

  it('shows dashboard KPI values coming from the real API payload', async () => {
    render(<AdminView isActive />);
    expect(await screen.findByText('42')).toBeInTheDocument(); // users
    await waitFor(() => expect(AdminApi.getDashboard).toHaveBeenCalled());
  });

  it('switches to the users tab via navigate-admin event and syncs the URL', async () => {
    render(<AdminView isActive />);
    act(() => {
      window.dispatchEvent(new CustomEvent('navigate-admin', { detail: { tab: 'users' } }));
    });
    expect(await screen.findByText('sv@example.com')).toBeInTheDocument();
    expect(screen.getByText('counselor@example.com')).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/admin/users'));
  });

  it('switches tabs via navigate-admin custom events', async () => {
    render(<AdminView isActive />);
    act(() => {
      window.dispatchEvent(new CustomEvent('navigate-admin', { detail: { tab: 'counselors' } }));
    });
    await waitFor(() => expect(AdminApi.getCounselors).toHaveBeenCalled());
  });

  it('parses and builds profile routes like any other admin tab', () => {
    expect(parseAdminRoute('/admin/profile')).toBe('profile');
  });

  it('renders the admin profile section with account details', async () => {
    mockGetMe.mockResolvedValue({
      id: 'a1',
      email: 'admin@cva.com',
      full_name: 'System Administrator',
      role: 'admin',
      avatar_url: null,
      created_at: '2026-07-01T00:00:00Z',
    });
    render(<AdminView isActive />);
    act(() => {
      window.dispatchEvent(new CustomEvent('navigate-admin', { detail: { tab: 'profile' } }));
    });
    expect(await screen.findByText('admin@cva.com')).toBeInTheDocument();
    expect(screen.getByText('Quản trị viên')).toBeInTheDocument();
    expect(screen.getByText('Đổi mật khẩu')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Họ và tên$/i), { target: { value: 'Tên Mới' } });
    mockUpdateProfile.mockResolvedValue({
      id: 'a1',
      email: 'admin@cva.com',
      full_name: 'Tên Mới',
      role: 'admin',
      created_at: '2026-07-01T00:00:00Z',
    });
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/i }));
    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith({ full_name: 'Tên Mới' }),
    );

    fireEvent.change(screen.getByLabelText(/Mật khẩu hiện tại/i), { target: { value: 'OldPass123' } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới$/i), { target: { value: 'NewPass1234' } });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu mới/i), { target: { value: 'NewPass1234' } });
    mockChangePassword.mockResolvedValue({ message: 'ok' });
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật mật khẩu/i }));
    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledWith('OldPass123', 'NewPass1234'));
  });
});

describe('AdminUsers console actions', () => {
  beforeEach(() => {
    window.history.pushState(null, '', '/admin');
    (AdminApi.getUsersPage as jest.Mock).mockResolvedValue(MOCK_USERS_PAGE);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('opens the create modal and submits a new account through AdminApi.createUser', async () => {
    (AdminApi.createUser as jest.Mock).mockResolvedValue({ id: 'u3' });
    render(<AdminUsers />);
    fireEvent.click(await screen.findByRole('button', { name: /Thêm tài khoản/i }));
    fireEvent.change(await screen.findByLabelText(/Họ và tên/i), { target: { value: 'Người Mới' } });
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'moi@example.com' } });
    fireEvent.change(screen.getByLabelText(/Mật khẩu khởi tạo/i), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: /^Tạo tài khoản$/i }));
    await waitFor(() => expect(AdminApi.createUser).toHaveBeenCalledWith({
      email: 'moi@example.com',
      password: 'Password123!',
      full_name: 'Người Mới',
      role: 'student',
    }));
  });

  it('asks for confirmation before deleting an account', async () => {
    (AdminApi.deleteUser as jest.Mock).mockResolvedValue(undefined);
    render(<AdminUsers />);
    const deleteButtons = await screen.findAllByRole('button', { name: /Xoá/i });
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(await screen.findByRole('button', { name: /Xoá vĩnh viễn/i }));
    await waitFor(() => expect(AdminApi.deleteUser).toHaveBeenCalledWith('u1'));
  });
});
