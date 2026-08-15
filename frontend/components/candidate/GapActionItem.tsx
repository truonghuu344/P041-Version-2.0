import React from 'react';
import { AlertTriangle, Lightbulb, BookOpen, HelpCircle, Star } from 'lucide-react';
import type { GapAction } from '../../lib/api/matchEvaluationClient';

interface GapActionItemProps {
  gap: GapAction;
  rank: number;
  onOptimize?: () => void;
  onInterview?: () => void;
}

const ICONS: Record<string, React.ReactNode> = {
  mandatory_missing: <AlertTriangle size={15} className="eval-gap-icon--danger"  aria-hidden="true" />,
  evidence_weak:     <Lightbulb     size={15} className="eval-gap-icon--warning" aria-hidden="true" />,
  skill_missing:     <BookOpen      size={15} className="eval-gap-icon--info"    aria-hidden="true" />,
  uncertain:         <HelpCircle    size={15} className="eval-gap-icon--neutral" aria-hidden="true" />,
  preferred_missing: <Star          size={15} className="eval-gap-icon--soft"    aria-hidden="true" />,
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Ưu tiên cao', medium: 'Ưu tiên vừa', low: 'Ưu tiên thấp',
};

export default function GapActionItem({ gap, rank, onOptimize, onInterview }: GapActionItemProps) {
  const icon    = ICONS[gap.action_type] ?? ICONS.uncertain;
  const prLabel = PRIORITY_LABEL[gap.priority] ?? gap.priority;
  const impact  = Math.round(gap.score_impact * 100) / 100;

  return (
    <article className={`eval-gap-item ${gap.mandatory ? 'eval-gap-item--mandatory' : ''}`}>
      <div className="eval-gap-item__header">
        <span className="eval-gap-item__rank" aria-hidden="true">{rank}</span>
        <span>{icon}</span>
        <div className="eval-gap-item__meta">
          {gap.mandatory && (
            <span className="eval-badge eval-badge--danger eval-badge--sm">
              <AlertTriangle size={11} aria-hidden="true" /> Bắt buộc
            </span>
          )}
          <span className="eval-badge eval-badge--neutral eval-badge--sm">{prLabel}</span>
          <span className="eval-gap-item__criterion">{gap.criterion_label ?? gap.criterion_id}</span>
        </div>
        {impact > 0 && (
          <span className="eval-gap-item__impact" title="Điểm có thể tăng nếu cải thiện">
            +{impact.toFixed(1)}
          </span>
        )}
      </div>

      <p className="eval-gap-item__text">
        {gap.requirement_text.charAt(0).toUpperCase() + gap.requirement_text.slice(1)}
      </p>
      <p className="eval-gap-item__action">{gap.action_text}</p>

      {gap.evidence_count > 0 && (
        <p className="eval-gap-item__evidence-hint">
          Tìm thấy {gap.evidence_count} bằng chứng liên quan — có thể làm rõ thêm.
        </p>
      )}

      {gap.action_type !== 'preferred_missing' && (
        <div className="eval-gap-item__cta">
          {onOptimize && (
            <button type="button" className="eval-btn eval-btn--outline eval-btn--sm" onClick={onOptimize}>
              Tối ưu CV theo JD
            </button>
          )}
          {onInterview && gap.action_type !== 'skill_missing' && (
            <button type="button" className="eval-btn eval-btn--ghost eval-btn--sm" onClick={onInterview}>
              Luyện phỏng vấn
            </button>
          )}
        </div>
      )}
    </article>
  );
}
