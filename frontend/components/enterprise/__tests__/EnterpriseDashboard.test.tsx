import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import EnterpriseDashboard from '../EnterpriseDashboard';

describe('EnterpriseDashboard (Recruiter Dashboard)', () => {
  const mockOnNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '<div id="ai-companion-hint"><strong>Hỏi Nova</strong><span>Hỗ trợ CV, JD và phỏng vấn</span></div>';
  });

  it('renders page header with dark title and primary button', () => {
    render(<EnterpriseDashboard onNavigate={mockOnNavigate} />);

    expect(screen.getByRole('heading', { name: /Dashboard tuyển dụng/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Tổng quan hoạt động tuyển dụng và ứng viên của bạn\./i)
    ).toBeInTheDocument();

    const createJobBtn = screen.getByRole('button', { name: /Đăng tin tuyển dụng/i });
    expect(createJobBtn).toBeInTheDocument();
    fireEvent.click(createJobBtn);
    expect(mockOnNavigate).toHaveBeenCalledWith('create-job');
  });

  it('renders all 4 white KPI cards with correct numbers and labels', () => {
    render(<EnterpriseDashboard onNavigate={mockOnNavigate} />);

    // 1. Tin đang tuyển
    const kpi1 = screen.getByTestId('kpi-active-jobs');
    expect(within(kpi1).getByText('Tin đang tuyển')).toBeInTheDocument();
    expect(within(kpi1).getByText('12')).toBeInTheDocument();
    expect(within(kpi1).getByText('Đang hoạt động')).toBeInTheDocument();

    // 2. Tổng ứng viên
    const kpi2 = screen.getByTestId('kpi-total-candidates');
    expect(within(kpi2).getByText('Tổng ứng viên')).toBeInTheDocument();
    expect(within(kpi2).getByText('84')).toBeInTheDocument();
    expect(within(kpi2).getByText('Trên 12 vị trí')).toBeInTheDocument();

    // 3. Ứng viên mới
    const kpi3 = screen.getByTestId('kpi-new-candidates');
    expect(within(kpi3).getByText('Ứng viên mới')).toBeInTheDocument();
    expect(within(kpi3).getByText('18')).toBeInTheDocument();
    expect(within(kpi3).getByText('7 ngày gần đây')).toBeInTheDocument();

    // 4. Sắp hết hạn
    const kpi4 = screen.getByTestId('kpi-expiring-jobs');
    expect(within(kpi4).getByText('Sắp hết hạn')).toBeInTheDocument();
    expect(within(kpi4).getByText('6')).toBeInTheDocument();
    expect(within(kpi4).getByText('Trong 7 ngày')).toBeInTheDocument();
  });

  it('renders Recent Jobs table with titles, badges, and action buttons', () => {
    render(<EnterpriseDashboard onNavigate={mockOnNavigate} />);

    expect(screen.getByRole('heading', { name: /Tin tuyển dụng gần đây/i })).toBeInTheDocument();
    expect(screen.getAllByText('Backend Developer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('AI Engineer Intern').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Frontend Developer').length).toBeGreaterThanOrEqual(1);

    // Status Badges
    const activeBadges = screen.getAllByText('● Đang tuyển');
    expect(activeBadges.length).toBe(2);
    expect(screen.getByText('Bản nháp')).toBeInTheDocument();

    // Actions
    const editBtn = screen.getByRole('button', { name: /Chỉnh sửa → cho Frontend Developer/i });
    fireEvent.click(editBtn);
    expect(mockOnNavigate).toHaveBeenCalledWith('create-job');
  });

  it('renders Cần chú ý (Attention Center) with actionable links', () => {
    render(<EnterpriseDashboard onNavigate={mockOnNavigate} />);

    expect(screen.getByRole('heading', { name: /Cần chú ý/i })).toBeInTheDocument();

    const viewNewCandBtn = screen.getByRole('button', { name: /Xem ứng viên →/i });
    expect(viewNewCandBtn).toBeInTheDocument();
    fireEvent.click(viewNewCandBtn);
    expect(mockOnNavigate).toHaveBeenCalledWith('candidates');

    const checkExpiringBtn = screen.getByRole('button', { name: /Kiểm tra →/i });
    expect(checkExpiringBtn).toBeInTheDocument();
    fireEvent.click(checkExpiringBtn);
    expect(mockOnNavigate).toHaveBeenCalledWith('jobs');

    const editDraftBtn = screen.getByRole('button', { name: /Tiếp tục chỉnh sửa →/i });
    expect(editDraftBtn).toBeInTheDocument();
    fireEvent.click(editDraftBtn);
    expect(mockOnNavigate).toHaveBeenCalledWith('create-job');
  });

  it('renders Recent Candidates table with match badges and tooltips', () => {
    render(<EnterpriseDashboard onNavigate={mockOnNavigate} />);

    expect(screen.getByRole('heading', { name: /Ứng viên gần đây/i })).toBeInTheDocument();

    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
    expect(screen.getByText('Lê Hoàng Nam')).toBeInTheDocument();
    expect(screen.getByText('Phạm Minh Đức')).toBeInTheDocument();
    expect(screen.getByText('Vũ Thảo Nguyên')).toBeInTheDocument();

    // Match badges with tooltips
    const match82 = screen.getByText('82% phù hợp');
    expect(match82).toBeInTheDocument();
    expect(match82).toHaveAttribute(
      'title',
      'Mức độ phù hợp dựa trên CV đã chia sẻ và yêu cầu công việc. Chỉ dùng để tham khảo.'
    );

    const viewProfileBtns = screen.getAllByRole('button', { name: /Xem hồ sơ/i });
    expect(viewProfileBtns.length).toBeGreaterThanOrEqual(5);
    fireEvent.click(viewProfileBtns[0]);
    expect(mockOnNavigate).toHaveBeenCalledWith('candidates');
  });

  it('updates AI companion hint text on mount and restores on unmount', () => {
    const { unmount } = render(<EnterpriseDashboard onNavigate={mockOnNavigate} />);

    const hint = document.getElementById('ai-companion-hint');
    expect(hint?.textContent).toContain('Hỏi Career AI');
    expect(hint?.textContent).toContain('Hỗ trợ đăng tin và quản lý ứng viên');

    unmount();
    expect(hint?.textContent).toContain('Hỏi Nova');
    expect(hint?.textContent).toContain('Hỗ trợ CV, JD và phỏng vấn');
  });
});
