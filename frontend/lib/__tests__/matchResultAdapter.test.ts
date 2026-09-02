import {
  normalizeMatchResult,
  RATING_LABELS,
  STATUS_TEXT,
} from '../matchResultAdapter';

describe('normalizeMatchResult Adapter', () => {
  const mockCompletedResponse = {
    status: 'COMPLETED',
    progress_percent: 100,
    analysis_id: 'match-analysis-123',
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
          reason: 'Có kinh nghiệm cơ bản nhưng thiếu chuyên sâu',
          requirement_ids: ['req-1', 'req-2', 'req-3'],
        },
        {
          group: 'responsibilities_task_fit',
          label: 'Kinh nghiệm & trách nhiệm',
          raw_score: 30.0,
          weighted_score: 0.0,
          status: 'NOT_FOUND',
          reason: 'Chưa có kinh nghiệm quản lý dự án',
          requirement_ids: ['req-4'],
        },
      ],
      requirements: {
        matched: [
          {
            requirement_id: 'req-1',
            normalized_value: 'JavaScript / TypeScript',
            status: 'SUPPORTED',
            type: 'REQUIRED',
            evidence: '2 năm làm việc với React và TypeScript',
            jd_text: 'Thành thạo JavaScript / TypeScript',
          },
        ],
        partial: [
          {
            requirement_id: 'req-2',
            normalized_value: 'Docker & Containerization',
            status: 'PARTIALLY_SUPPORTED',
            type: 'PREFERRED',
            evidence: 'Đã tự học Docker cơ bản',
            jd_text: 'Có kinh nghiệm triển khai Docker',
          },
          {
            requirement_id: 'req-3',
            normalized_value: 'CI/CD Automation',
            status: 'PARTIALLY_SUPPORTED',
            type: 'REQUIRED',
            evidence: 'Hiểu quy trình GitHub Actions',
            jd_text: 'Thiết lập CI/CD pipeline',
          },
        ],
        missing: [
          {
            requirement_id: 'req-4',
            normalized_value: 'Quản lý dự án Agile',
            status: 'NOT_FOUND',
            type: 'REQUIRED',
            evidence: 'Không đề cập trong CV',
            jd_text: 'Kinh nghiệm làm việc theo Scrum/Agile',
          },
          {
            requirement_id: 'req-5',
            normalized_value: 'Kubernetes Cluster Management',
            status: 'NOT_FOUND',
            type: 'PREFERRED',
            evidence: '',
            jd_text: 'Kinh nghiệm vận hành K8s',
          },
        ],
        uncertain: [],
      },
      evidence: [],
    },
  };

  it('correctly maps canonical score and formats as 10.4%', () => {
    const normalized = normalizeMatchResult(mockCompletedResponse);
    expect(normalized.score).toBe(10.4);
    expect(normalized.scoreDisplay).toBe('10.4%');
  });

  it('correctly maps score = 0 as 0% instead of missing/fallback', () => {
    const zeroScoreResponse = {
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
    const normalized = normalizeMatchResult(zeroScoreResponse);
    expect(normalized.score).toBe(0);
    expect(normalized.scoreDisplay).toBe('0%');
  });

  it('shows "0%" for completed result without score and "--%" for incomplete', () => {
    const noScoreCompleted = {
      status: 'COMPLETED',
      result: { status: 'COMPLETED' },
    };
    const normalizedCompleted = normalizeMatchResult(noScoreCompleted);
    expect(normalizedCompleted.score).toBeNull();
    expect(normalizedCompleted.scoreDisplay).toBe('0%');

    const pendingResponse = {
      status: 'PENDING',
    };
    const normalizedPending = normalizeMatchResult(pendingResponse);
    expect(normalizedPending.scoreDisplay).toBe('--%');
  });

  it('maps rating POOR to "Phù hợp thấp" and correct decision message', () => {
    const normalized = normalizeMatchResult(mockCompletedResponse);
    expect(normalized.rating).toBe('POOR');
    expect(normalized.ratingLabel).toBe('Phù hợp thấp');
    expect(normalized.decisionMessage).toBe('CV còn thiếu nhiều yêu cầu của vị trí này.');

    expect(RATING_LABELS.POOR).toBe('Phù hợp thấp');
    expect(RATING_LABELS.FAIR).toBe('Phù hợp một phần');
    expect(RATING_LABELS.GOOD).toBe('Phù hợp tốt');
    expect(RATING_LABELS.EXCELLENT).toBe('Phù hợp rất tốt');
  });

  it('maps decision messages accurately for each rating level without resume advice', () => {
    const poorRes = normalizeMatchResult({ status: 'COMPLETED', rating: 'POOR' });
    expect(poorRes.decisionMessage).toBe('CV còn thiếu nhiều yêu cầu của vị trí này.');

    const fairRes = normalizeMatchResult({ status: 'COMPLETED', rating: 'FAIR' });
    expect(fairRes.decisionMessage).toBe('CV đáp ứng một phần yêu cầu và còn một số yêu cầu quan trọng chưa được đáp ứng.');

    const goodRes = normalizeMatchResult({ status: 'COMPLETED', rating: 'GOOD' });
    expect(goodRes.decisionMessage).toBe('CV đáp ứng phần lớn yêu cầu của vị trí.');

    const excRes = normalizeMatchResult({ status: 'COMPLETED', rating: 'EXCELLENT' });
    expect(excRes.decisionMessage).toBe('CV phù hợp rất tốt với vị trí này.');
  });

  it('computes exact requirement counts matching backend arrays', () => {
    const normalized = normalizeMatchResult(mockCompletedResponse);
    expect(normalized.matchedCount).toBe(1);
    expect(normalized.partialCount).toBe(2);
    expect(normalized.missingCount).toBe(2);
    expect(normalized.uncertainCount).toBe(0);
    expect(normalized.totalCount).toBe(5);

    expect(normalized.summary).toBe(
      '5 yêu cầu được đối chiếu: 1 Đáp ứng · 2 Đáp ứng một phần · 2 Chưa đáp ứng'
    );
  });

  it('maps criteria group labels using criterion.label first without "undefined"', () => {
    const normalized = normalizeMatchResult(mockCompletedResponse);
    expect(normalized.criteria).toHaveLength(2);
    expect(normalized.criteria[0].label).toBe('Kỹ năng chuyên môn');
    expect(normalized.criteria[0].icon).toBe('⚡');
    expect(normalized.criteria[0].ratioLabel).toBe('1/3 đáp ứng');
    expect(normalized.criteria[1].label).toBe('Kinh nghiệm & trách nhiệm');
    expect(normalized.criteria[1].icon).toBe('📋');
    expect(normalized.criteria[1].ratioLabel).toBe('0/1 đáp ứng');

    // Never contain "undefined"
    normalized.criteria.forEach((c) => {
      expect(c.label).not.toContain('undefined');
      expect(c.icon).not.toContain('undefined');
    });
  });

  it('uses direct backend status mappings', () => {
    expect(STATUS_TEXT.SUPPORTED).toBe('Đáp ứng');
    expect(STATUS_TEXT.PARTIALLY_SUPPORTED).toBe('Đáp ứng một phần');
    expect(STATUS_TEXT.NOT_FOUND).toBe('Chưa đáp ứng');
    expect(STATUS_TEXT.UNCERTAIN).toBe('Chưa đủ bằng chứng');
  });

  it('normalizes language code "en" to "Tiếng Anh" and removes markdown headings', () => {
    const responseWithCodes = {
      status: 'COMPLETED',
      result: {
        requirements: {
          matched: [
            {
              requirement_id: 'req-lang',
              normalized_value: 'en',
              status: 'SUPPORTED',
              type: 'REQUIRED',
            },
          ],
          partial: [
            {
              requirement_id: 'req-docker',
              normalized_value: 'Docker',
              status: 'PARTIALLY_SUPPORTED',
              type: 'REQUIRED',
              evidence: 'Docker',
            },
          ],
          missing: [
            {
              requirement_id: 'req-fastapi',
              normalized_value: '### 4. FastAPI',
              status: 'NOT_FOUND',
              type: 'REQUIRED',
            },
          ],
          uncertain: [],
        },
      },
    };
    const normalized = normalizeMatchResult(responseWithCodes);
    expect(normalized.matchedRequirements[0].title).toBe('Tiếng Anh');
    expect(normalized.partialRequirements[0].title).toBe('Docker');
    expect(normalized.partialRequirements[0].gapText).toContain('CV có đề cập Docker trong mục Kỹ năng');
    expect(normalized.missingRequirements[0].title).toBe('FastAPI');
    expect(normalized.missingRequirements[0].cvText).toBe('Chưa tìm thấy bằng chứng phù hợp trong CV.');
    expect(normalized.missingRequirements[0].gapText).toBe('CV hiện chưa chứng minh yêu cầu này.');
  });

  it('guarantees "undefined" and "null" are never rendered in any field', () => {
    const rawResultWithNulls = {
      status: 'COMPLETED',
      final_score: null,
      rating: null,
      result: {
        criteria: [
          {
            group: 'domain_industry',
            label: undefined,
            requirement_ids: ['req-dom'],
          },
          {
            group: 'certifications_languages_other',
            label: undefined,
            requirement_ids: ['req-cert'],
          },
        ],
        requirements: {
          matched: [
            {
              requirement_id: 'req-dom',
              normalized_value: null,
              original_value: null,
              requirement: 'Thương mại điện tử',
              status: 'SUPPORTED',
            },
            {
              requirement_id: 'req-cert',
              normalized_value: 'en',
              status: 'SUPPORTED',
            },
          ],
          partial: [],
          missing: [],
          uncertain: [],
        },
      },
    };
    const normalized = normalizeMatchResult(rawResultWithNulls);
    expect(normalized.criteria[0].label).toBe('Lĩnh vực chuyên môn');
    expect(normalized.criteria[1].label).toBe('Chứng chỉ & Ngoại ngữ');
    expect(normalized.criteria[0].label).not.toContain('undefined');
    expect(normalized.criteria[1].label).not.toContain('undefined');

    normalized.allRequirements.forEach((r) => {
      expect(r.title).not.toContain('undefined');
      expect(r.title).not.toContain('null');
      expect(r.groupLabel).not.toContain('undefined');
      expect(r.cvText).not.toContain('undefined');
      expect(r.gapText).not.toContain('undefined');
    });
  });

  it('builds strengths only from SUPPORTED and deduplicates', () => {
    const responseWithDuplicates = {
      status: 'COMPLETED',
      result: {
        requirements: {
          matched: [
            { normalized_value: 'Giao tiếp tốt', status: 'SUPPORTED' },
            { normalized_value: 'giao tiếp tốt', status: 'SUPPORTED' },
          ],
          partial: [],
          missing: [],
          uncertain: [],
        },
      },
    };
    const normalized = normalizeMatchResult(responseWithDuplicates);
    expect(normalized.strengths).toHaveLength(1);
    expect(normalized.strengths[0].title).toBe('Giao tiếp tốt');
  });
});
