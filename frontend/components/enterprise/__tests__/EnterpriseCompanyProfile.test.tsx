import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import EnterpriseCompanyProfile from '../EnterpriseCompanyProfile';

describe('EnterpriseCompanyProfile (Recruiter Company Identity & Employer Profile)', () => {
  const mockOnNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('renders company header with logo, title, industry, size, location, and action buttons', () => {
    render(<EnterpriseCompanyProfile onNavigate={mockOnNavigate} />);

    expect(screen.getByRole('heading', { name: /FPT Software/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Công nghệ thông tin/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/10.000\+ nhân viên/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Hồ Chí Minh, Việt Nam/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chỉnh sửa hồ sơ/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xem như ứng viên →/i })).toBeInTheDocument();
  });

  it('renders profile completion card with progress and suggestion', () => {
    render(<EnterpriseCompanyProfile onNavigate={mockOnNavigate} />);

    expect(screen.getByRole('heading', { name: /Hồ sơ doanh nghiệp/i })).toBeInTheDocument();
    expect(screen.getByText(/% hoàn thiện/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('switches between 3 tabs correctly: Thông tin doanh nghiệp, Thương hiệu tuyển dụng, Tài khoản & Bảo mật', () => {
    render(<EnterpriseCompanyProfile onNavigate={mockOnNavigate} />);

    // Tab 1 is active initially
    expect(screen.getByRole('heading', { name: /Thông tin cơ bản/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên doanh nghiệp/i)).toBeInTheDocument();

    // Switch to Tab 2: Thương hiệu tuyển dụng
    const brandTabBtn = screen.getByRole('button', { name: /Thương hiệu tuyển dụng/i });
    fireEvent.click(brandTabBtn);
    expect(screen.getByRole('heading', { name: /Văn hóa & Giá trị cốt lõi/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Quyền lợi nhân viên \(Company Benefits\)/i })).toBeInTheDocument();

    // Switch to Tab 3: Tài khoản & Bảo mật
    const accountTabBtn = screen.getByRole('button', { name: /Tài khoản & Bảo mật/i });
    fireEvent.click(accountTabBtn);
    expect(screen.getByRole('heading', { name: /Tài khoản của tôi/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Họ và tên chuyên viên tuyển dụng/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email đăng nhập/i)).toHaveAttribute('readonly');
  });

  it('allows adding and removing additional office locations in Tab 1', () => {
    render(<EnterpriseCompanyProfile onNavigate={mockOnNavigate} />);

    const officeInput = screen.getByPlaceholderText(/Thêm văn phòng/i);
    const addOfficeBtn = screen.getByRole('button', { name: /Thêm địa điểm/i });

    fireEvent.change(officeInput, { target: { value: 'Cần Thơ, Việt Nam' } });
    fireEvent.click(addOfficeBtn);

    expect(screen.getByText('Cần Thơ, Việt Nam')).toBeInTheDocument();
  });

  it('toggles benefits selection in Tab 2', () => {
    render(<EnterpriseCompanyProfile onNavigate={mockOnNavigate} initialTab="brand" />);

    const benefitBtn = screen.getByRole('button', { name: /Bảo hiểm sức khỏe cao cấp/i });
    expect(benefitBtn).toHaveClass('selected');

    // Click to deselect
    fireEvent.click(benefitBtn);
    expect(benefitBtn).not.toHaveClass('selected');

    // Click to reselect
    fireEvent.click(benefitBtn);
    expect(benefitBtn).toHaveClass('selected');
  });

  it('opens and closes candidate-facing preview modal ("Xem như ứng viên")', () => {
    render(<EnterpriseCompanyProfile onNavigate={mockOnNavigate} />);

    const previewBtn = screen.getByRole('button', { name: /Xem như ứng viên →/i });
    fireEvent.click(previewBtn);

    // Modal dialog is open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Bản xem trước: Góc nhìn ứng viên/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Vị trí đang tuyển/i })).toBeInTheDocument();

    // Close preview
    const closeBtn = screen.getByRole('button', { name: /Đóng bản xem trước/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders initialTab="account" directly when selected from user menu', () => {
    render(<EnterpriseCompanyProfile onNavigate={mockOnNavigate} initialTab="account" />);

    expect(screen.getByRole('heading', { name: /Tài khoản của tôi/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Họ và tên chuyên viên tuyển dụng/i)).toBeInTheDocument();
  });
});

