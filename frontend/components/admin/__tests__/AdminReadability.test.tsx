/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Bảo vệ yêu cầu "giao diện admin dễ hiểu với người không chuyên":
 * không hiển thị JSON thô, mã sự kiện, ID kỹ thuật hay thuật ngữ lập trình.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AdminAiUsage from '@/components/admin/AdminAiUsage';
import AdminSystem from '@/components/admin/AdminSystem';
import AdminInternships from '@/components/admin/AdminInternships';
import { AdminApi } from '@/lib/api/adminApi';
import { roleLabel, verificationLabel } from '@/components/admin/adminShared';
import { appAreaLabel, eventLabel, formatResponseTime } from '@/lib/displayLabels';
import { describeDetails } from '@/lib/auditDetails';

jest.mock('@/lib/api/adminApi');

const AI_STATS = {
  total_requests: 120,
  successful_requests: 100,
  failed_requests: 20,
  unique_users: 34,
};

const AI_LOGS = {
  items: [
    {
      id: 'log-1',
      user_id: '11111111-2222-3333-4444-555555555555',
      user_email: 'sv@example.com',
      user_full_name: 'Sinh Viên A',
      llm_succeeded: true,
      current_page: 'cv',
      latency_ms: 2400,
      created_at: '2026-08-20T09:00:00Z',
    },
    {
      id: 'log-2',
      user_id: '66666666-7777-8888-9999-000000000000',
      user_email: 'sv2@example.com',
      user_full_name: 'Sinh Viên B',
      llm_succeeded: false,
      current_page: 'some_internal_view_key',
      latency_ms: 300,
      created_at: '2026-08-21T09:00:00Z',
    },
  ],
  total: 2,
  limit: 20,
  offset: 0,
};

describe('nhãn hiển thị luôn là tiếng Việt', () => {
  it('không bao giờ trả về mã thô khi gặp giá trị lạ', () => {
    expect(roleLabel('student')).toBe('Sinh viên');
    expect(roleLabel('platform_owner')).toBe('Vai trò khác');
    expect(roleLabel(null)).toBe('Vai trò khác');

    expect(verificationLabel('approved')).toBe('Đã duyệt');
    expect(verificationLabel('needs_more_docs')).toBe('Chưa xác định');

    expect(eventLabel('cv_parse')).toBe('Phân tích CV');
    expect(eventLabel('brand_new_backend_event')).toBe('Hoạt động hệ thống');

    expect(appAreaLabel('cv')).toBe('CV của tôi');
    expect(appAreaLabel('internal_debug_panel')).toBe('Khu vực khác');
    expect(appAreaLabel(null)).toBe('Không xác định');
  });

  it('mô tả thời gian phản hồi bằng ngôn ngữ thường ngày', () => {
    expect(formatResponseTime(320)).toBe('Dưới 1 giây');
    expect(formatResponseTime(2400)).toMatch(/giây$/);
    expect(formatResponseTime(null)).toBe('Không rõ');
  });
});

describe('describeDetails', () => {
  const lines = describeDetails(
    {
      grade: 'A',
      comment: 'Sinh viên chủ động và hoàn thành tốt công việc được giao.',
      evaluated_by_role: 'enterprise',
      criteria: { teamwork: 9, attitude: 10 },
      session_id: 'sess_9f2c',
      trace_id: 'abc123',
    },
    { maxLength: 400 },
  );
  const asMap = new Map(lines.map((line) => [line.label, line.value]));

  it('dịch key sang nhãn tiếng Việt và ẩn key kỹ thuật', () => {
    expect(asMap.get('Xếp loại')).toBe('A');
    expect(asMap.get('Vai trò người đánh giá')).toBe('Doanh nghiệp');
    expect(asMap.has('Session id')).toBe(false);
    expect(asMap.has('Trace id')).toBe(false);
  });

  it('không đổ JSON ra UI khi giá trị là object lồng nhau', () => {
    expect(asMap.get('Criteria')).toBe('2 mục thông tin');
    lines.forEach((line) => {
      expect(line.value).not.toContain('{');
      expect(line.value).not.toContain('"');
    });
  });

  it('giữ nguyên nội dung nhận xét dài thay vì cắt cụt', () => {
    expect(asMap.get('Nhận xét')).toBe('Sinh viên chủ động và hoàn thành tốt công việc được giao.');
  });
});

describe('AdminAiUsage', () => {
  beforeEach(() => {
    (AdminApi.getAiLogStats as jest.Mock).mockResolvedValue(AI_STATS);
    (AdminApi.getAiLogs as jest.Mock).mockResolvedValue(AI_LOGS);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('hiển thị số liệu sử dụng và diễn giải từng lượt hỏi bằng tiếng Việt', async () => {
    const { container } = render(<AdminAiUsage />);

    expect(await screen.findByText('Lượt hỏi trợ lý AI')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    // 100/120 = 83% < 90% → cảnh báo cho admin.
    expect(screen.getByText('83%')).toBeInTheDocument();
    expect(screen.getByText('Cần kiểm tra lại')).toBeInTheDocument();

    // Nhãn KPI và nhãn trong bảng trùng chữ nên đọc riêng trong bảng.
    const table = within(screen.getByRole('table'));
    expect(table.getByText('CV của tôi')).toBeInTheDocument();
    expect(table.getByText('Khu vực khác')).toBeInTheDocument();
    expect(table.getByText('Trả lời thành công')).toBeInTheDocument();
    expect(table.getByText('Không trả lời được')).toBeInTheDocument();
    expect(table.getByText('Dưới 1 giây')).toBeInTheDocument();

    // Không để lộ mã view nội bộ, UUID người dùng hay khối JSON.
    const text = container.textContent || '';
    expect(text).not.toContain('some_internal_view_key');
    expect(text).not.toContain('11111111-2222');
    expect(text).not.toContain('latency_ms');
    expect(container.querySelector('pre')).toBeNull();
  });

  it('lọc theo kết quả trả lời bằng tuỳ chọn tiếng Việt, không phải cờ boolean thô', async () => {
    render(<AdminAiUsage />);
    await screen.findByText('Lượt hỏi trợ lý AI');

    fireEvent.change(screen.getByLabelText('Lọc theo kết quả trả lời'), { target: { value: 'failed' } });
    await waitFor(() =>
      expect(AdminApi.getAiLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ success: false, offset: 0 }),
      ),
    );
  });
});

describe('AdminSystem', () => {
  beforeEach(() => {
    (AdminApi.getSystem as jest.Mock).mockResolvedValue({
      notification_count: 4,
      unread_notification_count: 1,
      ai_log_count: 120,
      usage_event_count: 900,
      internship_count: 3,
      notification_categories: {},
    });
    (AdminApi.getAuditLogs as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'ev-1',
          event_name: 'cv_variant_published',
          user_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          user_email: 'sv@example.com',
          user_full_name: 'Sinh Viên A',
          created_at: '2026-08-20T09:00:00Z',
          metadata: { variant_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', trace_id: 'zzz' },
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    (AdminApi.getNotifications as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (AdminApi.getAiLogStats as jest.Mock).mockResolvedValue(AI_STATS);
    (AdminApi.getAiLogs as jest.Mock).mockResolvedValue(AI_LOGS);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lọc nhật ký bằng danh sách sự kiện có sẵn thay vì để admin tự nhập mã', async () => {
    render(<AdminSystem />);
    const select = await screen.findByLabelText('Lọc theo loại hoạt động');
    expect(select.tagName).toBe('SELECT');

    const options = Array.from(select.querySelectorAll('option'));
    expect(options.length).toBeGreaterThan(1);
    // Nhãn hiển thị là tiếng Việt; mã sự kiện chỉ nằm trong `value`.
    options.forEach((option) => {
      expect(option.textContent || '').not.toMatch(/^[a-z0-9]+(_[a-z0-9]+)+$/);
    });

    fireEvent.change(select, { target: { value: 'cv_variant_published' } });
    await waitFor(() =>
      expect(AdminApi.getAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ event: 'cv_variant_published' }),
      ),
    );
  });

  it('hiển thị hoạt động bằng nhãn tiếng Việt, không lộ mã sự kiện hay trace', async () => {
    const { container } = render(<AdminSystem />);
    expect(await screen.findByText('Xuất bản phiên bản CV')).toBeInTheDocument();
    const text = container.textContent || '';
    expect(text).not.toContain('cv_variant_published');
    expect(text).not.toContain('trace_id');
    expect(text).not.toContain('zzz');
  });

  it('có tab theo dõi trợ lý AI và không hiển thị nội dung hội thoại', async () => {
    render(<AdminSystem />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Sử dụng trợ lý AI' }));

    expect(await screen.findByText('Lượt hỏi trợ lý AI')).toBeInTheDocument();
    await waitFor(() => expect(AdminApi.getAiLogs).toHaveBeenCalled());
    expect(
      screen.getByText(/Nội dung trao đổi giữa người dùng và trợ lý AI không được hiển thị/i),
    ).toBeInTheDocument();
  });
});

describe('AdminInternships', () => {
  const ROW = {
    id: 'i1',
    student: 'Sinh Viên A',
    company: 'Công ty A',
    position: 'Thực tập viên Backend',
    progress_percent: 80,
    last_report_status: 'submitted',
    status: 'ongoing',
    updated_at: '2026-08-20T09:00:00Z',
  };

  beforeEach(() => {
    (AdminApi.getInternships as jest.Mock).mockResolvedValue([ROW]);
    (AdminApi.getInternshipSummary as jest.Mock).mockResolvedValue({
      total: 1,
      by_status: { ongoing: 1 },
      reports_by_status: { submitted: 1 },
      evaluated: 1,
    });
    (AdminApi.getInternshipDetail as jest.Mock).mockResolvedValue({
      ...ROW,
      student_email: 'sv@example.com',
      location: 'Hà Nội',
      mentor_name: 'Anh B',
      mentor_email: 'b@congtya.vn',
      current_week: 8,
      total_weeks: 10,
      status_label: 'ongoing',
      weekly_reports: [],
      created_at: '2026-06-01T00:00:00Z',
      final_evaluation: {
        grade: 'A',
        comment: 'Hoàn thành tốt nhiệm vụ.',
        evaluated_by_role: 'enterprise',
        evaluated_at: '2026-08-19T09:00:00Z',
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('hiển thị đánh giá cuối kỳ dưới dạng nhãn – giá trị, không phải JSON', async () => {
    const { container } = render(<AdminInternships />);
    fireEvent.click(await screen.findByRole('button', { name: /Chi tiết/i }));

    expect(await screen.findByText('Đánh giá cuối kỳ')).toBeInTheDocument();
    // "Doanh nghiệp" cũng là tiêu đề cột của bảng nên chỉ đọc trong modal.
    const modal = within(screen.getByRole('dialog'));
    expect(modal.getByText('Xếp loại')).toBeInTheDocument();
    expect(modal.getByText('Hoàn thành tốt nhiệm vụ.')).toBeInTheDocument();
    expect(modal.getByText('Vai trò người đánh giá')).toBeInTheDocument();
    expect(modal.getByText('Doanh nghiệp')).toBeInTheDocument();

    // Không còn khối <pre>{JSON.stringify(...)}</pre> như bản trước.
    expect(container.querySelector('pre')).toBeNull();
    const text = container.textContent || '';
    expect(text).not.toContain('evaluated_by_role');
    expect(text).not.toContain('"grade"');
  });

  it('dịch trạng thái báo cáo và kỳ thực tập sang tiếng Việt', async () => {
    const { container } = render(<AdminInternships />);
    // Chữ tiếng Việt còn xuất hiện ở KPI và ở bộ lọc, nên chỉ đọc trong bảng.
    const table = within(await screen.findByRole('table'));
    expect(table.getByText('Đã nộp báo cáo')).toBeInTheDocument();
    expect(table.getByText('Đang thực tập')).toBeInTheDocument();
    const text = container.textContent || '';
    expect(text).not.toContain('submitted');
    expect(text).not.toContain('ongoing');
  });
});
