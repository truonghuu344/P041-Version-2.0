import React from 'react';
import { CheckCircle, AlertCircle, HelpCircle, MinusCircle } from 'lucide-react';
import type { CriterionSummary } from '../../lib/api/matchEvaluationClient';

interface CriterionCardProps {
  criterion: CriterionSummary;
  onClick?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  FULLY_MET:     { label: 'Đã đáp ứng',       icon: <CheckCircle size={13} aria-hidden="true" />, cls: 'eval-badge--success' },
  PARTIALLY_MET: { label: 'Đáp ứng một phần', icon: <MinusCircle size={13} aria-hidden="true" />, cls: 'eval-badge--warning' },
  NOT_MET:       { label: 'Cần bổ sung',       icon: <AlertCircle size={13} aria-hidden="true" />, cls: 'eval-badge--danger'  },
  UNCERTAIN:     { label: 'Cần kiểm tra',      icon: <HelpCircle  size={13} aria-hidden="true" />, cls: 'eval-badge--neutral' },
  DISABLED:      { label: 'Không áp dụng',     icon: <MinusCircle size={13} aria-hidden="true" />, cls: 'eval-badge--neutral' },
};

export default function CriterionCard({ criterion, onClick }: CriterionCardProps) {
  const cfg = STATUS_CONFIG[criterion.status] ?? STATUS_CONFIG.UNCERTAIN;
  const weightPct = Math.round(criterion.weight);
  const scorePct  = Math.round(criterion.weighted_score);
  const covPct    = criterion.requirements_total > 0
    ? (criterion.requirements_met / criterion.requirements_total) * 100
    : 0;

  return (
    <article
      className="eval-criterion-card"
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={`${criterion.label}: ${cfg.label}`}
    >
      <header className="eval-criterion-card__header">
        <div>
          <strong className="eval-criterion-card__name">{criterion.label}</strong>
          <span className="eval-criterion-card__weight"> {weightPct}%</span>
        </div>
        <span className={`eval-badge ${cfg.cls}`}>
          {cfg.icon}<span>{cfg.label}</span>
        </span>
      </header>

      {criterion.requirements_total > 0 && (
        <div className="eval-criterion-card__coverage">
          <div className="eval-progress-bar" aria-hidden="true">
            <div className="eval-progress-bar__fill" style={{ width: `${covPct}%` }} />
          </div>
          <span className="eval-criterion-card__req-count">
            {criterion.requirements_met}/{criterion.requirements_total} yêu cầu
          </span>
        </div>
      )}

      <div className="eval-criterion-card__score">
        <span className="eval-criterion-card__score-val">{scorePct}</span>
        <span className="eval-criterion-card__score-max">/{weightPct} điểm</span>
      </div>

      {criterion.top_gap_text && (
        <p className="eval-criterion-card__gap-preview">
          <AlertCircle size={12} aria-hidden="true" />
          <span>{criterion.top_gap_text}</span>
        </p>
      )}
    </article>
  );
}
