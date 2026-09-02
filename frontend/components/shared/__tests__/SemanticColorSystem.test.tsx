import React from 'react';
import { render, screen } from '@testing-library/react';
import StatusBadge, { resolveStatusConfig } from '@/components/shared/StatusBadge';
import DeadlineIndicator from '@/components/shared/DeadlineIndicator';
import SemanticAlert from '@/components/shared/SemanticAlert';

describe('System-wide Semantic Color System', () => {
  describe('StatusBadge mapping', () => {
    it('maps PENDING_CONSENT to warning Amber', () => {
      const config = resolveStatusConfig('PENDING_CONSENT');
      expect(config.family).toBe('warning');
      expect(config.classes).toContain('#FFFBEB');
    });

    it('maps SUBMITTED and VIEWED to info Blue', () => {
      expect(resolveStatusConfig('SUBMITTED').family).toBe('info');
      expect(resolveStatusConfig('VIEWED').family).toBe('info');
      expect(resolveStatusConfig('INTERVIEW').family).toBe('info');
    });

    it('maps SHORTLISTED, OFFERED, ACCEPTED to success Green', () => {
      expect(resolveStatusConfig('SHORTLISTED').family).toBe('success');
      expect(resolveStatusConfig('OFFERED').family).toBe('success');
      expect(resolveStatusConfig('ACCEPTED').family).toBe('success');
      expect(resolveStatusConfig('APPROVED').family).toBe('success');
    });

    it('maps REJECTED, TERMINATED, OVERDUE to danger Red', () => {
      expect(resolveStatusConfig('REJECTED').family).toBe('danger');
      expect(resolveStatusConfig('TERMINATED').family).toBe('danger');
      expect(resolveStatusConfig('OVERDUE').family).toBe('danger');
    });

    it('maps WITHDRAWN and DRAFT to neutral Slate', () => {
      expect(resolveStatusConfig('WITHDRAWN').family).toBe('neutral');
      expect(resolveStatusConfig('DRAFT').family).toBe('neutral');
    });

    it('renders StatusBadge with accessible label and semantic data attribute', () => {
      render(<StatusBadge status="OFFERED" />);
      const badge = screen.getByLabelText(/Trạng thái: Đã nhận Offer/i);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-semantic-family', 'success');
    });
  });

  describe('DeadlineIndicator logic', () => {
    it('handles completed task with success state regardless of date', () => {
      render(<DeadlineIndicator deadline="01/01/2020" isCompleted={true} />);
      expect(screen.getByLabelText(/Đã hoàn thành đúng hạn/i)).toBeInTheDocument();
    });

    it('handles overdue date with danger state', () => {
      render(<DeadlineIndicator deadline="01/01/2020" isCompleted={false} />);
      expect(screen.getByText(/Quá hạn/i)).toBeInTheDocument();
    });

    it('handles normal future date (> 3 days) with neutral state', () => {
      const futureDate = new Date(Date.now() + 10 * 86400000);
      const day = String(futureDate.getDate()).padStart(2, '0');
      const month = String(futureDate.getMonth() + 1).padStart(2, '0');
      const year = futureDate.getFullYear();
      const dateStr = `${day}/${month}/${year}`;

      render(<DeadlineIndicator deadline={dateStr} isCompleted={false} />);
      expect(screen.getByText(new RegExp(`Hạn: ${dateStr}`))).toBeInTheDocument();
    });
  });

  describe('SemanticAlert component', () => {
    it('renders alert with title and content in appropriate role', () => {
      render(
        <SemanticAlert type="warning" title="Cần chú ý">
          Sinh viên chưa xác nhận hồ sơ.
        </SemanticAlert>
      );
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText(/Cần chú ý/i)).toBeInTheDocument();
      expect(screen.getByText(/Sinh viên chưa xác nhận hồ sơ./i)).toBeInTheDocument();
    });
  });
});
