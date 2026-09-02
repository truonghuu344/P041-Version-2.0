import React from 'react';
import { render, screen } from '@testing-library/react';
import MatchView from '../MatchView';
import { normalizeMatchResult } from '../../../lib/matchResultAdapter';

describe('CV-JD Match Result UI and Requirement-Driven Model', () => {
  it('renders MatchView with redesigned match result modal and requirement containers', () => {
    render(<MatchView />);

    // Obsolete optimization preview sections should NOT exist in Match modal
    expect(screen.queryByText('3 việc nên làm trước khi ứng tuyển')).toBeNull();
    expect(screen.queryByText('AI đề xuất sửa CV')).toBeNull();
    expect(document.body.querySelector('#cv-result-priority-actions')).toBeNull();
    expect(document.body.querySelector('#cv-result-suggestions-preview')).toBeNull();

    // Must have the standard Match Result Modal and container IDs portaled to document.body
    const modal = document.body.querySelector('#gap-result-overlay');
    expect(modal).not.toBeNull();

    // Header context & Utility actions
    expect(document.body.querySelector('#cv-result-cv-name')).not.toBeNull();
    expect(document.body.querySelector('.gap-result-close-btn')).not.toBeNull();

    // Score / Core rating
    expect(document.body.querySelector('#cv-result-match-score')).not.toBeNull();
    expect(document.body.querySelector('#gap-header-rating-badge')).not.toBeNull();

    // Requirements & criteria groupings
    expect(document.body.querySelector('#cv-result-summary')).not.toBeNull();
    expect(document.body.querySelector('#cv-result-counts-row')).not.toBeNull();

    // Explainability sections
    expect(document.body.querySelector('#cv-result-category-explanation-section')).not.toBeNull();
    expect(document.body.querySelector('#cv-result-strengths-section')).not.toBeNull();
    expect(document.body.querySelector('#cv-result-weaknesses-section')).not.toBeNull();

    // The container for requirement rows (important ones, and all groups)
    expect(document.body.querySelector('#cv-result-important-reqs-list')).not.toBeNull();
    expect(document.body.querySelector('#cv-result-groups-container')).not.toBeNull();
  });

  it('renders sticky action footer with secondary and primary actions', () => {
    render(<MatchView />);
    const footer = document.body.querySelector('.gap-result-footer');
    expect(footer).not.toBeNull();
    expect(footer?.querySelector('#btn-optimize-cv-ai')).not.toBeNull();
    expect(footer?.querySelector('#btn-practice-interview')).not.toBeNull();
    expect(footer?.querySelector('#btn-browse-matching-jobs')).not.toBeNull();
  });

  it('keeps Match actions text-first and the dialog has one scrollable body', () => {
    render(<MatchView />);
    expect(document.body.querySelector('#btn-optimize-cv-ai svg')).toBeNull();
    expect(document.body.querySelector('.gap-result-body')).not.toBeNull();
    expect(document.body.querySelector('.gap-result-footer')).not.toBeNull();
  });

  it('verifies canonical data normalization and UI contracts with COMPLETED backend response', () => {
    const mockBackendResponse = {
      status: 'COMPLETED',
      progress_percent: 100,
      analysis_id: 'match-audit-104',
      final_score: 10.4,
      rating: 'POOR',
      error: null,
      result: {
        status: 'COMPLETED',
        match_score: 10.4,
        final_score: 10.4,
        rating: 'POOR',
        criteria: [
          {
            group: 'skills',
            label: 'Kỹ năng chuyên môn',
            raw_score: 49.5,
            weighted_score: 10.4,
            status: 'PARTIALLY_SUPPORTED',
            reason: 'Đáp ứng một phần kỹ năng',
            requirement_ids: ['req-1', 'req-2'],
          },
          {
            group: 'responsibilities_task_fit',
            label: 'Kinh nghiệm & trách nhiệm',
            raw_score: 0.0,
            weighted_score: 0.0,
            status: 'NOT_FOUND',
            reason: 'Chưa có kinh nghiệm thực tế',
            requirement_ids: ['req-3'],
          },
        ],
        requirements: {
          matched: [
            {
              requirement_id: 'req-1',
              normalized_value: 'React & TypeScript',
              status: 'SUPPORTED',
              type: 'REQUIRED',
              evidence: '2 năm làm việc với React',
              jd_text: 'Thành thạo React',
            },
          ],
          partial: [
            {
              requirement_id: 'req-2',
              normalized_value: 'Docker Containerization',
              status: 'PARTIALLY_SUPPORTED',
              type: 'PREFERRED',
              evidence: 'Đã tìm hiểu Docker cơ bản',
              jd_text: 'Kinh nghiệm triển khai Docker',
            },
          ],
          missing: [
            {
              requirement_id: 'req-3',
              normalized_value: 'Quản lý dự án Agile',
              group: 'responsibilities_task_fit',
              status: 'NOT_FOUND',
              type: 'REQUIRED',
              evidence: 'Không có thông tin trong CV',
              jd_text: 'Làm việc theo Agile',
            },
          ],
          uncertain: [],
        },
      },
    };

    const norm = normalizeMatchResult(mockBackendResponse);

    // 1. Score assertions
    expect(norm.score).toBe(10.4);
    expect(norm.scoreDisplay).toBe('10.4%');

    // 2. Rating assertions
    expect(norm.rating).toBe('POOR');
    expect(norm.ratingLabel).toBe('Phù hợp thấp');

    // 3. Counts assertions matching exact backend arrays
    expect(norm.matchedCount).toBe(1);
    expect(norm.partialCount).toBe(1);
    expect(norm.missingCount).toBe(1);
    expect(norm.uncertainCount).toBe(0);
    expect(norm.totalCount).toBe(3);

    // 4. Criteria & Group label assertions
    expect(norm.criteria).toHaveLength(2);
    expect(norm.criteria[0].label).toBe('Kỹ năng chuyên môn');
    expect(norm.criteria[0].icon).toBe('⚡');
    expect(norm.criteria[0].ratioLabel).toBe('1/2 đáp ứng');
    expect(norm.criteria[1].label).toBe('Kinh nghiệm & trách nhiệm');
    expect(norm.criteria[1].icon).toBe('📋');
    expect(norm.criteria[1].ratioLabel).toBe('0/1 đáp ứng');

    // 5. No literal 'undefined' anywhere in output
    const jsonString = JSON.stringify(norm);
    expect(jsonString).not.toContain('undefined');
    expect(jsonString).not.toContain('null Kỹ năng');

    // 6. Strengths only from SUPPORTED
    expect(norm.strengths).toHaveLength(1);
    expect(norm.strengths[0].title).toBe('React & TypeScript');

    // 7. Gaps from missing and partial
    expect(norm.gaps).toHaveLength(2);
    expect(norm.gaps.some(g => g.title === 'Docker Containerization')).toBe(true);
    expect(norm.gaps.some(g => g.title === 'Quản lý dự án Agile')).toBe(true);
  });

  it('handles score = 0 properly as "0%"', () => {
    const zeroScoreRes = {
      status: 'COMPLETED',
      final_score: 0,
      rating: 'POOR',
      result: {
        status: 'COMPLETED',
        match_score: 0,
        final_score: 0,
        requirements: { matched: [], partial: [], missing: [], uncertain: [] },
      },
    };
    const norm = normalizeMatchResult(zeroScoreRes);
    expect(norm.score).toBe(0);
    expect(norm.scoreDisplay).toBe('0%');
  });
});
