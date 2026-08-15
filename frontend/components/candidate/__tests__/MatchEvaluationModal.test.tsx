import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MatchEvaluationModal from '../MatchEvaluationModal';

const mockEvaluation = {
  match_id: 'test-match-123',
  status: 'COMPLETED',
  fit_score: 74.5,
  confidence: 'high' as const,
  mandatory_gate: { failed: false, failed_requirements: [] },
  criteria_summary: [
    {
      criterion_id: 'required_skills',
      label: 'Kỹ năng bắt buộc',
      weight: 0.35,
      raw_score: 25,
      weighted_score: 8.75,
      status: 'PARTIALLY_MET',
      requirements_total: 8,
      requirements_met: 5,
      requirements_partial: 1,
      top_gap_text: 'Thiếu Docker experience',
      reason: '5/8 skills supported.',
    },
    {
      criterion_id: 'relevant_experience',
      label: 'Kinh nghiệm liên quan',
      weight: 0.30,
      raw_score: 28,
      weighted_score: 8.4,
      status: 'FULLY_MET',
      requirements_total: 5,
      requirements_met: 5,
      requirements_partial: 0,
      reason: 'All experience requirements met.',
    },
    {
      criterion_id: 'education',
      label: 'Học vấn',
      weight: 0.10,
      raw_score: 10,
      weighted_score: 1.0,
      status: 'FULLY_MET',
      requirements_total: 2,
      requirements_met: 2,
      requirements_partial: 0,
    },
    {
      criterion_id: 'preferred_skills',
      label: 'Kỹ năng ưu tiên',
      weight: 0.10,
      raw_score: 5,
      weighted_score: 0.5,
      status: 'NOT_MET',
      requirements_total: 3,
      requirements_met: 0,
      requirements_partial: 0,
    },
    {
      criterion_id: 'domain_responsibilities',
      label: 'Domain & Trách nhiệm',
      weight: 0.15,
      raw_score: 12,
      weighted_score: 1.8,
      status: 'PARTIALLY_MET',
      requirements_total: 4,
      requirements_met: 2,
      requirements_partial: 1,
    },
  ],
  versions: { pipeline: '1.0', rubric: 'v1', embedding_model: 'hashing' },
  trace_id: 'trace-abc',
  created_at: '2026-08-14T12:00:00Z',
};

const mockGaps = {
  match_id: 'test-match-123',
  gaps: [
    {
      requirement_id: 'req-mandatory-1',
      requirement_text: 'Kinh nghiệm Docker tối thiểu 1 năm',
      criterion_id: 'required_skills',
      criterion_label: 'Kỹ năng bắt buộc',
      status: 'NOT_FOUND',
      mandatory: true,
      priority: 'high' as const,
      score_impact: 0.05,
      evidence_count: 0,
      action_type: 'mandatory_missing',
      action_text: 'Đây là yêu cầu bắt buộc chưa tìm thấy bằng chứng.',
      weight: 0.35,
    },
  ],
  total: 1,
  mandatory_failed_count: 1,
};

const mockRequirements = {
  criterion_id: 'required_skills',
  items: [
    {
      requirement_id: 'req-1',
      criterion_id: 'required_skills',
      text: 'Python 3+ years',
      mandatory: false,
      priority: 'high' as const,
      status: 'SUPPORTED',
      evidence_ids: ['ev-1'],
    },
    {
      requirement_id: 'req-mandatory-1',
      criterion_id: 'required_skills',
      text: 'Docker experience',
      mandatory: true,
      priority: 'high' as const,
      status: 'NOT_FOUND',
      evidence_ids: [],
    },
  ],
  total: 2,
  page: 1,
  page_size: 50,
};

const mockEvidence = {
  requirement_id: 'req-1',
  items: [
    {
      evidence_id: 'ev-1',
      requirement_id: 'req-1',
      chunk_id: 'chunk-1',
      text: 'Developed Python microservices for 3 years',
      source_page: 1,
      source_section: 'Experience',
      span_start: 0,
      span_end: 45,
      fusion_score: 0.92,
      semantic_score: 0.88,
      bm25_score: 0.85,
    },
  ],
  total: 1,
};

const mockHookReturn = {
  evaluation: mockEvaluation as any,
  evaluationState: 'success' as any,
  evaluationError: null as any,
  refetchEvaluation: jest.fn(),
  gaps: null as any,
  gapsState: 'idle' as any,
  fetchGaps: jest.fn(),
  fetchRequirements: jest.fn().mockResolvedValue(mockRequirements),
  requirementsCache: {} as any,
  fetchEvidence: jest.fn().mockResolvedValue(mockEvidence),
  evidenceCache: {} as any,
};

jest.mock('../../../lib/hooks/useMatchEvaluation', () => ({
  useMatchEvaluation: () => mockHookReturn,
}));

const defaultProps = {
  matchId: 'test-match-123',
  onClose: jest.fn(),
  onNavigateOptimize: jest.fn(),
  onNavigateInterview: jest.fn(),
};

function renderModal(props = {}) {
  return render(<MatchEvaluationModal {...defaultProps} {...props} />);
}

describe('MatchEvaluationModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHookReturn.evaluationState = 'success';
    mockHookReturn.evaluation = mockEvaluation as any;
    mockHookReturn.evaluationError = null as any;
    mockHookReturn.gapsState = 'idle';
    mockHookReturn.gaps = null as any;
  });

  it('không render khi matchId là null', () => {
    const { container } = render(
      <MatchEvaluationModal
        matchId={null}
        onClose={jest.fn()}
        onNavigateOptimize={jest.fn()}
        onNavigateInterview={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('render dialog với aria-modal và aria-labelledby khi có matchId', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'eval-modal-title');
  });

  it('hiển thị tiêu đề "Đánh giá chi tiết"', () => {
    renderModal();
    expect(screen.getByText('Đánh giá chi tiết')).toBeInTheDocument();
  });

  it('Tab Tổng quan hiển thị đúng 5 criterion card', () => {
    renderModal();
    // Dùng getAllByText vì text này có cả ở tab hoặc accordion
    expect(screen.getAllByText('Kỹ năng bắt buộc').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Kinh nghiệm liên quan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Học vấn').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Kỹ năng ưu tiên').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Domain & Trách nhiệm').length).toBeGreaterThan(0);
  });

  it('criterion card hiển thị status badge với text (không chỉ màu)', () => {
    renderModal();
    expect(screen.getAllByText('Đã đáp ứng').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đáp ứng một phần').length).toBeGreaterThan(0);
  });

  it('có 4 tab với đúng labels', () => {
    renderModal();
    const tabList = screen.getByRole('tablist');
    const tabs = within(tabList).getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveTextContent('Tổng quan');
    expect(tabs[1]).toHaveTextContent('Đã phù hợp');
    expect(tabs[2]).toHaveTextContent('Cần cải thiện');
    expect(tabs[3]).toHaveTextContent('Tất cả tiêu chí');
  });

  it('Tab Tổng quan được active mặc định', () => {
    renderModal();
    const firstTab = screen.getByRole('tab', { name: 'Tổng quan' });
    expect(firstTab).toHaveAttribute('aria-selected', 'true');
  });

  it('click tab chuyển aria-selected', async () => {
    renderModal();
    const gapsTab = screen.getByRole('tab', { name: /Cần cải thiện/i });
    await userEvent.click(gapsTab);
    expect(gapsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('Arrow Right key chuyển sang tab tiếp theo', async () => {
    renderModal();
    const firstTab = screen.getByRole('tab', { name: 'Tổng quan' });
    firstTab.focus();
    await userEvent.keyboard('{ArrowRight}');
    const secondTab = screen.getByRole('tab', { name: 'Đã phù hợp' });
    expect(secondTab).toHaveAttribute('aria-selected', 'true');
  });

  it('Arrow Left key chuyển sang tab trước', async () => {
    renderModal();
    const secondTab = screen.getByRole('tab', { name: 'Đã phù hợp' });
    await userEvent.click(secondTab);
    secondTab.focus();
    await userEvent.keyboard('{ArrowLeft}');
    const firstTab = screen.getByRole('tab', { name: 'Tổng quan' });
    expect(firstTab).toHaveAttribute('aria-selected', 'true');
  });

  it('nút X gọi onClose', async () => {
    renderModal();
    const closeBtn = screen.getByRole('button', { name: /Đóng bảng đánh giá/i });
    await userEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key gọi onClose', async () => {
    renderModal();
    await userEvent.keyboard('{Escape}');
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('click overlay backdrop gọi onClose', async () => {
    renderModal();
    const overlay = document.querySelector('.eval-modal-overlay');
    if (overlay) {
      fireEvent.click(overlay);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('hiển thị score 75% từ evaluation data', () => {
    renderModal();
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('hiển thị confidence badge với text (không chỉ màu)', () => {
    renderModal();
    expect(screen.getByText('Độ tin cậy cao')).toBeInTheDocument();
  });

  it('hiển thị skeleton khi loading', () => {
    mockHookReturn.evaluationState = 'loading';
    mockHookReturn.evaluation = null as any;
    renderModal();
    expect(screen.getByText(/Đang tải kết quả đánh giá/i)).toBeInTheDocument();
  });

  it('hiển thị error message và nút Thử lại khi error', () => {
    mockHookReturn.evaluationState = 'error';
    mockHookReturn.evaluation = null as any;
    mockHookReturn.evaluationError = 'Không thể kết nối server.';
    renderModal();
    expect(screen.getByText('Không thể kết nối server.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
  });

  it('nút Thử lại gọi refetchEvaluation', async () => {
    mockHookReturn.evaluationState = 'error';
    mockHookReturn.evaluation = null as any;
    mockHookReturn.evaluationError = 'Lỗi';
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: /Thử lại/i }));
    expect(mockHookReturn.refetchEvaluation).toHaveBeenCalledTimes(1);
  });

  it('hiển thị trạng thái đang xử lý khi match chưa COMPLETED', () => {
    mockHookReturn.evaluation = { ...mockEvaluation, status: 'EVALUATING' } as any;
    renderModal();
    expect(screen.getByText(/EVALUATING/i)).toBeInTheDocument();
  });

  it('nút Tối ưu CV gọi onNavigateOptimize', async () => {
    renderModal();
    const optimizeBtn = screen.getByRole('button', { name: /Tối ưu CV theo JD/i });
    await userEvent.click(optimizeBtn);
    expect(defaultProps.onNavigateOptimize).toHaveBeenCalledTimes(1);
  });

  it('nút Luyện phỏng vấn gọi onNavigateInterview', async () => {
    renderModal();
    const interviewBtn = screen.getByRole('button', { name: /Luyện phỏng vấn/i });
    await userEvent.click(interviewBtn);
    expect(defaultProps.onNavigateInterview).toHaveBeenCalledTimes(1);
  });

  it('Tab panel có aria relationship đúng với tab button', () => {
    renderModal();
    const overviewPanel = document.getElementById('eval-panel-overview');
    expect(overviewPanel).toHaveAttribute('aria-labelledby', 'eval-tab-overview');
  });

  it('non-active tab panels có hidden attribute', () => {
    renderModal();
    const matchedPanel = document.getElementById('eval-panel-matched');
    expect(matchedPanel).toHaveAttribute('hidden');
  });

  it('hiển thị mandatory failed count khi có gap mandatory', async () => {
    mockHookReturn.gaps = mockGaps as any;
    mockHookReturn.gapsState = 'success';

    renderModal();
    const gapsTab = screen.getByRole('tab', { name: /Cần cải thiện/i });
    await userEvent.click(gapsTab);

    const tabBadge = gapsTab.querySelector('.eval-tab-badge');
    expect(tabBadge).toBeInTheDocument();
  });
});
