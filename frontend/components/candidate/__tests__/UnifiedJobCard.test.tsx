import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import UnifiedJobCard from '../UnifiedJobCard';
import { renderUnifiedJobCardHtml, normalizeJobData } from '@/lib/unifiedJobCard';

describe('UnifiedJobCard Component & Renderer', () => {
  const sampleJob = {
    job_id: 'job-101',
    source_id: 'src-101',
    title: 'Senior Backend Engineer',
    company: 'Công ty Cổ phần Công nghệ ABC',
    location: 'Hà Nội',
    work_mode: 'Hybrid',
    seniority: 'Senior',
    employment_type: 'Toàn thời gian',
    salary: '30 - 45 triệu',
    openings: 5,
    applicant_count: 12,
    posted_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    deadline: '2026-09-30',
    required_skills: ['Go', 'PostgreSQL', 'Docker', 'Kubernetes'],
    preferred_skills: ['gRPC', 'Redis'],
    source_url: 'https://topcv.vn/job/101',
    display_fit_score: 88,
    score_display_allowed: true,
    fit_label: 'Phù hợp cao',
  };

  describe('normalizeJobData', () => {
    it('normalizes job data correctly with all fields', () => {
      const normalized = normalizeJobData(sampleJob, { variant: 'top-match', rank: 1 });
      expect(normalized.title).toBe('Senior Backend Engineer');
      expect(normalized.company).toBe('Công ty Cổ phần Công nghệ ABC');
      expect(normalized.companyInitial).toBe('C');
      expect(normalized.location).toBe('Hà Nội');
      expect(normalized.workMode).toBe('Hybrid');
      expect(normalized.salary).toBe('30 - 45 triệu');
      expect(normalized.openings).toBe(5);
      expect(normalized.fitScore).toBe(88);
      expect(normalized.fitLabel).toBe('Phù hợp cao');
      expect(normalized.sourcePlatformName).toBe('TopCV');
      expect(normalized.skills.length).toBe(4);
      expect(normalized.remainingSkillsCount).toBe(2);
    });

    it('hides unknown or empty fields', () => {
      const emptyJob = {
        title: 'Developer',
        location: 'unknown',
        salary: 'chưa xác định',
        seniority: 'n/a',
      };
      const normalized = normalizeJobData(emptyJob, { variant: 'catalog' });
      expect(normalized.location).toBeUndefined();
      expect(normalized.salary).toBeUndefined();
      expect(normalized.seniority).toBeUndefined();
      expect(normalized.openings).toBeUndefined();
    });
  });

  describe('renderUnifiedJobCardHtml', () => {
    it('renders top-match variant with rank and fit score', () => {
      const html = renderUnifiedJobCardHtml(sampleJob, { variant: 'top-match', rank: 1 });
      expect(html).toContain('#1');
      expect(html).toContain('88%');
      expect(html).toContain('Phù hợp cao');
      expect(html).toContain('Tuyển 5 người');
      expect(html).toContain('Xem chi tiết');
      expect(html).toContain('TopCV');
    });

    it('renders catalog variant with catalog badge and no artificial score', () => {
      const html = renderUnifiedJobCardHtml(sampleJob, { variant: 'catalog' });
      expect(html).toContain('top-job-catalog-badge');
      expect(html).toContain('Đang tuyển');
      expect(html).not.toContain('88%');
      expect(html).toContain('Tuyển 5 người');
      expect(html).toContain('Xem chi tiết');
    });

    it('renders match-picker variant with radio and CTA button', () => {
      const html = renderUnifiedJobCardHtml(sampleJob, {
        variant: 'match-picker',
        isSelected: true,
      });
      expect(html).toContain('p1-job-card-radio');
      expect(html).toContain('is-selected');
      expect(html).toContain('✓ Đã chọn');
      expect(html).toContain('data-target-job="src-101"');
    });
  });

  describe('React UnifiedJobCard Component', () => {
    it('renders React component properly for top-match', () => {
      const onViewDetails = jest.fn();
      const { container } = render(
        <UnifiedJobCard
          job={sampleJob}
          options={{ variant: 'top-match', rank: 1 }}
          onViewDetails={onViewDetails}
        />
      );

      expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument();
      expect(screen.getByText('Công ty Cổ phần Công nghệ ABC')).toBeInTheDocument();
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('88%')).toBeInTheDocument();
      expect(screen.getByText('Tuyển 5 người')).toBeInTheDocument();
      expect(screen.getByText('+2 kỹ năng')).toBeInTheDocument();

      const detailsBtn = container.querySelector('.btn-view-job-spec') as HTMLElement;
      expect(detailsBtn).toBeInTheDocument();
      fireEvent.click(detailsBtn);
      expect(onViewDetails).toHaveBeenCalledWith('job-101');
    });

    it('renders React component properly for match-picker and triggers onSelect', () => {
      const onSelect = jest.fn();
      const { container } = render(
        <UnifiedJobCard
          job={sampleJob}
          options={{ variant: 'match-picker', isSelected: false }}
          onSelect={onSelect}
        />
      );

      const selectBtn = container.querySelector('.btn-choose-job-match') as HTMLElement;
      expect(selectBtn).toBeInTheDocument();
      fireEvent.click(selectBtn);
      expect(onSelect).toHaveBeenCalledWith('src-101');
    });
  });
});
