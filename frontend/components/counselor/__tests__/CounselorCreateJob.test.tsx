import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CounselorCreateJob from '@/components/counselor/CounselorCreateJob';
import { ApiClient } from '@/api-client.js';

jest.mock('@/api-client.js', () => ({
  ApiClient: {
    getCounselorPartners: jest.fn().mockResolvedValue([
      { id: 'partner-1', name: 'FPT Software', location: 'Hồ Chí Minh' },
      { id: 'partner-2', name: 'VNG Corporation', location: 'Hồ Chí Minh' },
    ]),
    createCustomJD: jest.fn().mockResolvedValue({ id: 'jd-custom-1', title: 'Senior AI Engineer' }),
    updateCounselorJD: jest.fn().mockResolvedValue({ id: 'jd-custom-1', title: 'Senior AI Engineer' }),
    publishJD: jest.fn().mockResolvedValue({ id: 'jd-custom-1', is_published: true }),
  },
}));

jest.mock('@/lib/jdUpload', () => ({
  uploadJDForParsing: jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      id: 'jd-parsed-123',
      title: 'Senior AI Engineer',
      company: 'FPT Software',
      location: 'Hồ Chí Minh',
      requirements_text: 'Yêu cầu: Thành thạo Python, PyTorch, FastAPI.',
      normalized_json: {
        title: 'Senior AI Engineer',
        company: 'FPT Software',
        department: 'AI & Data Research',
        level: 'Senior',
        employment_type: 'Full-time',
        work_model: 'Hybrid',
        location: 'Hồ Chí Minh',
        tags: ['Python', 'PyTorch', 'FastAPI', 'LLM'],
        salary_min: '30.000.000',
        salary_max: '50.000.000',
        deadline: '2026-10-31',
      },
    }),
  }),
}));

describe('CounselorCreateJob Component', () => {
  const mockOnNavigate = jest.fn();
  const mockOnBack = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Counselor full 4-step editor with partner selector and file uploader', async () => {
    render(
      <CounselorCreateJob
        onNavigate={mockOnNavigate}
        onBack={mockOnBack}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText(/Đăng & Quản lý JD \(Cố vấn\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Doanh nghiệp đối tác:/i)).toBeInTheDocument();
    expect(screen.getByText(/Tải lên JD có sẵn \(tự động bóc tách & điền biểu mẫu\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Kéo thả file JD hoặc bấm để chọn từ máy tính/i)).toBeInTheDocument();

    // Verify 4-step wizard buttons
    expect(screen.getByRole('button', { name: /1 Thông tin & File JD/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2 Soạn bài \(Word-Like Editor\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3 Câu hỏi ứng tuyển/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /4 Xem trước & Công bố/i })).toBeInTheDocument();
  });

  it('handles JD upload, parses data and populates form fields', async () => {
    render(
      <CounselorCreateJob
        onNavigate={mockOnNavigate}
        onBack={mockOnBack}
        onSuccess={mockOnSuccess}
      />
    );

    const file = new File(['Sample JD Content'], 'AI_Engineer_JD.pdf', { type: 'application/pdf' });
    const uploader = screen.getByText(/Kéo thả file JD hoặc bấm để chọn từ máy tính/i).closest('.recruiter-jd-uploader');
    expect(uploader).toBeInTheDocument();

    fireEvent.drop(uploader!, {
      dataTransfer: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Đã trích xuất thành công từ/i)).toBeInTheDocument();
    });

    const titleInput = screen.getByPlaceholderText(/VD: Senior React Developer \/ AI Engineer/i) as HTMLInputElement;
    expect(titleInput.value).toBe('Senior AI Engineer');

    const deptInput = screen.getByPlaceholderText(/VD: Công nghệ thông tin \/ Sản phẩm/i) as HTMLInputElement;
    expect(deptInput.value).toBe('AI & Data Research');

    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('PyTorch')).toBeInTheDocument();
    expect(screen.getByText('FastAPI')).toBeInTheDocument();
  });

  it('allows step navigation, section editing and candidate preview', async () => {
    render(
      <CounselorCreateJob
        onNavigate={mockOnNavigate}
        onBack={mockOnBack}
        onSuccess={mockOnSuccess}
      />
    );

    // Navigate to Step 2
    const step2Btn = screen.getByRole('button', { name: /2 Soạn bài \(Word-Like Editor\)/i });
    fireEvent.click(step2Btn);

    expect(screen.getByText(/Soạn nội dung bài đăng \(Word-Like Editor\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Điền nhanh bằng nội dung mẫu chuẩn/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. Giới thiệu tổng quan về vị trí/i)).toBeInTheDocument();

    // Navigate to Step 3
    const step3Btn = screen.getByRole('button', { name: /3 Câu hỏi ứng tuyển/i });
    fireEvent.click(step3Btn);
    expect(screen.getByText(/Câu hỏi sàng lọc ứng viên khi nộp hồ sơ/i)).toBeInTheDocument();

    // Navigate to Step 4
    const step4Btn = screen.getByRole('button', { name: /4 Xem trước & Công bố/i });
    fireEvent.click(step4Btn);
    expect(screen.getByText(/Giao diện ứng viên sẽ nhìn thấy/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xác nhận & Công bố JD/i })).toBeInTheDocument();
  });

  it('handles Save Draft and Publish with Counselor APIs', async () => {
    render(
      <CounselorCreateJob
        onNavigate={mockOnNavigate}
        onBack={mockOnBack}
        onSuccess={mockOnSuccess}
      />
    );

    const titleInput = screen.getByPlaceholderText(/VD: Senior React Developer \/ AI Engineer/i) as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Senior AI Engineer' } });

    const draftBtn = screen.getByRole('button', { name: /Lưu bản nháp/i });
    fireEvent.click(draftBtn);

    await waitFor(() => {
      expect(ApiClient.createCustomJD).toHaveBeenCalled();
    });

    const publishBtn = screen.getByRole('button', { name: /Công bố JD cho SV/i });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(ApiClient.publishJD).toHaveBeenCalled();
    });
  });
});
