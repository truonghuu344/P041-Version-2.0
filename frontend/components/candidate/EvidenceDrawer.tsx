import React from 'react';
import { X, BookOpen, Loader2 } from 'lucide-react';
import type { EvidenceDetail, EvidenceListData } from '../../lib/api/matchEvaluationClient';

interface EvidenceDrawerProps {
  requirementText: string;
  evidence: EvidenceListData | null;
  loading: boolean;
  onClose: () => void;
}

function EvidenceItem({ ev }: { ev: EvidenceDetail }) {
  return (
    <article className="eval-evidence-item">
      <blockquote className="eval-evidence-quote">
        <mark className="eval-evidence-mark">{ev.text}</mark>
      </blockquote>
      <div className="eval-evidence-meta">
        {ev.source_section && (
          <span className="eval-evidence-tag">{ev.source_section}</span>
        )}
        {ev.source_page != null && (
          <span className="eval-evidence-tag">Trang {ev.source_page}</span>
        )}
        {ev.fusion_score != null && (
          <span className="eval-evidence-tag eval-evidence-tag--score"
            title={`BM25: ${ev.bm25_score?.toFixed(3) ?? 'n/a'} | Semantic: ${ev.semantic_score?.toFixed(3) ?? 'n/a'}`}>
            Liên quan: {(ev.fusion_score * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </article>
  );
}

export default function EvidenceDrawer({ requirementText, evidence, loading, onClose }: EvidenceDrawerProps) {
  return (
    <aside className="eval-evidence-drawer" role="complementary" aria-label="Bằng chứng trong CV">
      <header className="eval-evidence-drawer__header">
        <div className="eval-evidence-drawer__title-row">
          <BookOpen size={16} aria-hidden="true" />
          <h4>Bằng chứng trong CV</h4>
        </div>
        <button type="button" className="eval-icon-btn" onClick={onClose} aria-label="Đóng panel">
          <X size={18} />
        </button>
      </header>

      <p className="eval-evidence-drawer__req-text">{requirementText}</p>

      <div className="eval-evidence-drawer__body">
        {loading && (
          <div className="eval-center eval-center--col" aria-live="polite">
            <Loader2 size={22} className="eval-spin" aria-hidden="true" />
            <span>Đang tải bằng chứng...</span>
          </div>
        )}
        {!loading && evidence && evidence.items.length === 0 && (
          <div className="eval-empty eval-empty--sm">
            <p>Không tìm thấy bằng chứng cho yêu cầu này.</p>
            <p className="eval-empty__hint">Hãy bổ sung mô tả cụ thể hơn vào CV.</p>
          </div>
        )}
        {!loading && evidence && evidence.items.length > 0 && (
          <ul className="eval-evidence-list" role="list">
            {evidence.items.map((ev) => (
              <li key={ev.evidence_id}><EvidenceItem ev={ev} /></li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
