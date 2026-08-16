import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EnterpriseCreateJob from '../EnterpriseCreateJob';

describe('EnterpriseCreateJob (JD Upload & Auto-Parsing)', () => {
  const mockOnNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders create job header, upload dropzone, and form sections', () => {
    render(<EnterpriseCreateJob onNavigate={mockOnNavigate} />);

    expect(screen.getByRole('heading', { name: /Đăng tin tuyển dụng/i })).toBeInTheDocument();
    expect(screen.getByText(/Tải lên JD có sẵn \(AI tự động trích xuất\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Kéo thả file JD hoặc bấm để chọn từ máy tính/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. Thông tin cơ bản/i)).toBeInTheDocument();
  });

  it('handles JD file upload and parses content into form fields', async () => {
    render(<EnterpriseCreateJob onNavigate={mockOnNavigate} />);

    const file = new File(['Sample JD Content'], 'AI_Engineer_JD.pdf', { type: 'application/pdf' });
    const uploader = screen.getByText(/Kéo thả file JD hoặc bấm để chọn từ máy tính/i).closest('.recruiter-jd-uploader');
    expect(uploader).toBeInTheDocument();

    // Trigger drop event
    fireEvent.drop(uploader!, {
      dataTransfer: {
        files: [file],
      },
    });

    // Wait for AI parsing to complete and populate form fields
    await waitFor(() => {
      expect(screen.getByText(/Đã trích xuất thành công từ/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify auto-filled title & department
    const titleInput = screen.getByPlaceholderText(/VD: Senior Backend Developer/i) as HTMLInputElement;
    expect(titleInput.value).toContain('AI Engineer');

    const deptInput = screen.getByPlaceholderText(/VD: Kỹ thuật \/ Engineering/i) as HTMLInputElement;
    expect(deptInput.value).toContain('AI & Data Research');
  });

  it('allows user to edit extracted values and preview before posting', async () => {
    render(<EnterpriseCreateJob onNavigate={mockOnNavigate} />);

    const titleInput = screen.getByPlaceholderText(/VD: Senior Backend Developer/i) as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Lead Cloud Architect' } });
    expect(titleInput.value).toBe('Lead Cloud Architect');

    // Click Preview in Header
    const previewBtns = screen.getAllByRole('button', { name: /Xem trước/i });
    fireEvent.click(previewBtns[0]);

    expect(screen.getByText('Xem trước tin tuyển dụng')).toBeInTheDocument();
    expect(screen.getByText('Lead Cloud Architect')).toBeInTheDocument();

    // Close preview
    const closeBtn = screen.getByRole('button', { name: /Đóng xem trước/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Xem trước tin tuyển dụng')).not.toBeInTheDocument();
  });

  it('navigates through steps and renders Word-like editor sections in Step 2', async () => {
    render(<EnterpriseCreateJob onNavigate={mockOnNavigate} />);

    // Click step 2 button
    const step2Btn = screen.getByRole('button', { name: /2 Soạn bài \(Word-Like Editor\)/i });
    fireEvent.click(step2Btn);

    expect(screen.getByText(/Soạn nội dung bài đăng \(Word-Like Editor\)/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. Giới thiệu tổng quan về vị trí/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Trách nhiệm & Nhiệm vụ chính/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Yêu cầu bắt buộc \(Must-Have\)/i)).toBeInTheDocument();
    expect(screen.getByText(/ATS: Must-Have \(Matching Core\)/i)).toBeInTheDocument();

    // Step 3: Questions
    const step3Btn = screen.getByRole('button', { name: /3 Câu hỏi ứng tuyển/i });
    fireEvent.click(step3Btn);
    expect(screen.getByText(/Câu hỏi sàng lọc ứng viên khi nộp hồ sơ/i)).toBeInTheDocument();

    // Step 4: Preview
    const step4Btn = screen.getByRole('button', { name: /4 Xem trước & Đăng tuyển/i });
    fireEvent.click(step4Btn);
    expect(screen.getByText(/Giao diện ứng viên sẽ nhìn thấy/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xác nhận & Đăng tuyển/i })).toBeInTheDocument();
  });

  it('opens and closes version history drawer', () => {
    render(<EnterpriseCreateJob onNavigate={mockOnNavigate} />);

    const versionBtn = screen.getByRole('button', { name: /Lịch sử phiên bản/i });
    fireEvent.click(versionBtn);

    expect(screen.getByText('Lịch sử phiên bản chỉnh sửa')).toBeInTheDocument();
    expect(screen.getByText(/Bản nháp hiện tại/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Đóng/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Lịch sử phiên bản chỉnh sửa')).not.toBeInTheDocument();
  });
});

