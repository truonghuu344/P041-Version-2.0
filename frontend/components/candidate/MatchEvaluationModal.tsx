'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  Loader2,
  Shield,
  X,
} from 'lucide-react';

import CriterionCard from './CriterionCard';
import EvidenceDrawer from './EvidenceDrawer';
import GapActionItem from './GapActionItem';
import { useMatchEvaluation } from '../../lib/hooks/useMatchEvaluation';
import type { EvidenceListData, RequirementDetail } from '../../lib/api/matchEvaluationClient';

interface MatchEvaluationModalProps {
  matchId: string | null;
  onClose: () => void;
  onNavigateOptimize: () => void;
  onNavigateInterview: () => void;
}

const TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'matched', label: 'Đã phù hợp' },
  { id: 'gaps', label: 'Cần cải thiện' },
  { id: 'all', label: 'Tất cả tiêu chí' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const CONFIDENCE_CONFIG: Record<string, { label: string; cls: string }> = {
  high: { label: 'Độ tin cậy cao', cls: 'eval-badge--success' },
  medium: { label: 'Độ tin cậy vừa', cls: 'eval-badge--warning' },
  low: { label: 'Độ tin cậy thấp', cls: 'eval-badge--danger' },
  very_low: { label: 'Cần kiểm tra lại', cls: 'eval-badge--neutral' },
};

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [ref, active]);
}

function RequirementAccordion({
  req,
  onViewEvidence,
  evidenceLoading,
}: {
  req: RequirementDetail;
  onViewEvidence: (req: RequirementDetail) => void;
  evidenceLoading: boolean;
}) {
  const [open, setOpen] = useState(false);

  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    SUPPORTED: { label: 'Đã đáp ứng', cls: 'eval-badge--success' },
    PARTIALLY_SUPPORTED: { label: 'Một phần', cls: 'eval-badge--warning' },
    NOT_FOUND: { label: 'Không tìm thấy', cls: 'eval-badge--danger' },
    UNCERTAIN: { label: 'Không chắc', cls: 'eval-badge--neutral' },
  };
  const badge = STATUS_BADGE[req.status] ?? { label: req.status, cls: 'eval-badge--neutral' };

  return (
    <div className={`eval-req-accordion ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="eval-req-accordion__trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`eval-badge ${badge.cls} eval-badge--sm`}>{badge.label}</span>
        <span className="eval-req-accordion__text">{req.text}</span>
        <ChevronDown size={15} className="eval-req-accordion__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="eval-req-accordion__body" role="region">
          {req.mandatory && (
            <p className="eval-req-accordion__mandatory-note">
              <AlertTriangle size={13} aria-hidden="true" /> Yêu cầu bắt buộc
            </p>
          )}
          {req.criterion_score != null && (
            <p className="eval-req-accordion__score">
              Đóng góp điểm: <strong>{req.criterion_score.toFixed(1)}</strong>
            </p>
          )}
          <div className="eval-req-accordion__actions">
            <button
              type="button"
              className="eval-btn eval-btn--outline eval-btn--sm"
              onClick={() => onViewEvidence(req)}
              disabled={evidenceLoading}
            >
              {evidenceLoading ? (
                <Loader2 size={13} className="eval-spin" aria-hidden="true" />
              ) : (
                'Xem bằng chứng trong CV'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number | null | undefined }) {
  const pct = score ?? 0;
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color =
    pct >= 70
      ? 'var(--eval-color-success)'
      : pct >= 45
        ? 'var(--eval-color-warning)'
        : 'var(--eval-color-danger)';

  return (
    <div className="eval-score-ring" aria-label={`Điểm phù hợp: ${pct.toFixed(1)}%`} role="img">
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="var(--eval-color-track)"
          strokeWidth="8"
        />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="eval-score-ring__label">
        <strong>
          {pct.toFixed(0)}
          <span>%</span>
        </strong>
        <small>Phù hợp</small>
      </div>
    </div>
  );
}

export default function MatchEvaluationModal({
  matchId,
  onClose,
  onNavigateOptimize,
  onNavigateInterview,
}: MatchEvaluationModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [activeReq, setActiveReq] = useState<RequirementDetail | null>(null);
  const [evidenceData, setEvidenceData] = useState<EvidenceListData | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [expandedCriterion, setExpandedCriterion] = useState<string | null>(null);
  const [requirementsData, setRequirementsData] = useState<Record<string, RequirementDetail[]>>({});

  const dialogRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const {
    evaluation,
    evaluationState,
    evaluationError,
    refetchEvaluation,
    gaps,
    gapsState,
    fetchGaps,
    fetchRequirements,
    fetchEvidence,
  } = useMatchEvaluation(matchId);

  useFocusTrap(dialogRef, !!matchId);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (matchId) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [matchId]);

  useEffect(() => {
    if (activeTab === 'gaps' && !gaps && gapsState === 'idle') {
      fetchGaps();
    }
  }, [activeTab, gaps, gapsState, fetchGaps]);

  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const tabs = tabBarRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    if (!tabs) return;
    if (e.key === 'ArrowRight') {
      const next = (idx + 1) % tabs.length;
      tabs[next].focus();
      setActiveTab(TABS[next].id);
    } else if (e.key === 'ArrowLeft') {
      const prev = (idx - 1 + tabs.length) % tabs.length;
      tabs[prev].focus();
      setActiveTab(TABS[prev].id);
    }
  };

  const handleExpandCriterion = useCallback(
    async (criterionId: string) => {
      if (expandedCriterion === criterionId) {
        setExpandedCriterion(null);
        return;
      }
      setExpandedCriterion(criterionId);
      if (!requirementsData[criterionId]) {
        const data = await fetchRequirements(criterionId);
        if (data) {
          setRequirementsData((prev) => ({ ...prev, [criterionId]: data.items }));
        }
      }
    },
    [expandedCriterion, fetchRequirements, requirementsData],
  );

  const handleViewEvidence = useCallback(
    async (req: RequirementDetail) => {
      setActiveReq(req);
      setEvidenceData(null);
      setEvidenceLoading(true);
      const data = await fetchEvidence(req.requirement_id);
      setEvidenceData(data);
      setEvidenceLoading(false);
    },
    [fetchEvidence],
  );

  if (!matchId) return null;

  const confidenceCfg = evaluation?.confidence
    ? (CONFIDENCE_CONFIG[evaluation.confidence] ?? CONFIDENCE_CONFIG.medium)
    : null;

  return (
    <div
      className="eval-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="eval-modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="eval-modal-title"
        aria-describedby="eval-modal-desc"
      >
        <div className="eval-modal-sheet__drag-handle" aria-hidden="true" />

        <header className="eval-modal-header">
          <div className="eval-modal-header__score-area">
            <ScoreRing score={evaluation?.fit_score} />
            <div className="eval-modal-header__meta">
              <h2 id="eval-modal-title" className="eval-modal-header__title">
                Đánh giá chi tiết
              </h2>
              <p id="eval-modal-desc" className="eval-modal-header__subtitle">
                Độ phù hợp hồ sơ với JD — không phải xác suất được tuyển
              </p>
              <div className="eval-modal-header__badges">
                {confidenceCfg && (
                  <span className={`eval-badge ${confidenceCfg.cls}`} role="status">
                    <Shield size={12} aria-hidden="true" /> {confidenceCfg.label}
                  </span>
                )}
                {evaluation?.mandatory_gate?.failed && (
                  <span className="eval-badge eval-badge--danger" role="alert">
                    <AlertTriangle size={12} aria-hidden="true" />
                    Thiếu {evaluation.mandatory_gate.failed_requirements.length} yêu cầu bắt buộc
                  </span>
                )}
              </div>
              {evaluation?.criteria_summary && evaluation.criteria_summary.length > 0 && (
                <p className="eval-modal-header__criteria-summary">
                  {evaluation.criteria_summary.filter((c) => c.status === 'FULLY_MET').length}/
                  {evaluation.criteria_summary.length} tiêu chí đạt
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            className="eval-modal-close eval-icon-btn"
            onClick={onClose}
            aria-label="Đóng bảng đánh giá"
          >
            <X size={20} />
          </button>
        </header>

        <div ref={tabBarRef} className="eval-tab-bar" role="tablist" aria-label="Các tab đánh giá">
          {TABS.map((tab, idx) => (
            <button
              key={tab.id}
              id={`eval-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`eval-panel-${tab.id}`}
              className={`eval-tab-btn ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
            >
              {tab.label}
              {tab.id === 'gaps' && gaps && gaps.total > 0 && (
                <span className="eval-tab-badge" aria-label={`${gaps.total} điểm cần cải thiện`}>
                  {gaps.total}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="eval-modal-body">
          {evaluationState === 'loading' && (
            <div className="eval-center eval-center--col eval-center--full" aria-live="polite">
              <Loader2 size={28} className="eval-spin" aria-hidden="true" />
              <p>Đang tải kết quả đánh giá...</p>
              <div className="eval-skeleton-grid" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="eval-skeleton-card" />
                ))}
              </div>
            </div>
          )}

          {evaluationState === 'error' && (
            <div className="eval-center eval-center--col eval-center--full" role="alert">
              <AlertTriangle size={24} className="eval-color-danger" aria-hidden="true" />
              <p>{evaluationError ?? 'Không thể tải kết quả.'}</p>
              <button
                type="button"
                className="eval-btn eval-btn--primary"
                onClick={refetchEvaluation}
              >
                Thử lại
              </button>
            </div>
          )}

          {evaluationState === 'success' && evaluation?.status !== 'COMPLETED' && (
            <div className="eval-center eval-center--col eval-center--full" role="status">
              <p>Match đang xử lý ({evaluation?.status}). Vui lòng chờ và thử lại.</p>
              <button
                type="button"
                className="eval-btn eval-btn--outline"
                onClick={refetchEvaluation}
              >
                Làm mới
              </button>
            </div>
          )}

          {evaluationState === 'success' && evaluation?.status === 'COMPLETED' && (
            <>
              <div
                id="eval-panel-overview"
                role="tabpanel"
                aria-labelledby="eval-tab-overview"
                hidden={activeTab !== 'overview'}
                className="eval-panel"
              >
                <div className="eval-criterion-grid">
                  {evaluation.criteria_summary.map((crit) => (
                    <CriterionCard
                      key={crit.criterion_id}
                      criterion={crit}
                      onClick={() => {
                        setActiveTab('all');
                        handleExpandCriterion(crit.criterion_id);
                      }}
                    />
                  ))}
                </div>

                <div className="eval-panel-cta">
                  <button
                    type="button"
                    className="eval-btn eval-btn--primary"
                    onClick={onNavigateOptimize}
                  >
                    Tối ưu CV theo JD <ArrowRight size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="eval-btn eval-btn--outline"
                    onClick={onNavigateInterview}
                  >
                    Luyện phỏng vấn
                  </button>
                </div>
              </div>

              <div
                id="eval-panel-matched"
                role="tabpanel"
                aria-labelledby="eval-tab-matched"
                hidden={activeTab !== 'matched'}
                className="eval-panel"
              >
                <MatchedPanel
                  evaluation={evaluation}
                  fetchRequirements={fetchRequirements}
                  onViewEvidence={handleViewEvidence}
                  evidenceLoading={evidenceLoading}
                />
              </div>

              <div
                id="eval-panel-gaps"
                role="tabpanel"
                aria-labelledby="eval-tab-gaps"
                hidden={activeTab !== 'gaps'}
                className="eval-panel"
              >
                {gapsState === 'loading' && (
                  <div className="eval-center" aria-live="polite">
                    <Loader2 size={22} className="eval-spin" /> Đang tải...
                  </div>
                )}
                {gapsState === 'error' && (
                  <div role="alert">
                    <button type="button" onClick={fetchGaps}>
                      Thử lại
                    </button>
                  </div>
                )}
                {gapsState === 'success' && gaps && (
                  <>
                    {gaps.mandatory_failed_count > 0 && (
                      <div className="eval-mandatory-warning" role="alert">
                        <AlertTriangle size={16} aria-hidden="true" />
                        <strong>
                          {gaps.mandatory_failed_count} yêu cầu bắt buộc chưa có bằng chứng.
                        </strong>
                        <span>
                          Thiếu yêu cầu bắt buộc không tự động loại bạn — nhưng cần bổ sung CV trước
                          khi ứng tuyển.
                        </span>
                      </div>
                    )}
                    {gaps.gaps.length === 0 ? (
                      <div className="eval-center eval-center--col" role="status">
                        <CheckCircle size={24} aria-hidden="true" />
                        <p>Không có gap đáng kể. Bạn đã đáp ứng tốt các yêu cầu.</p>
                        <button
                          type="button"
                          className="eval-btn eval-btn--primary"
                          onClick={onNavigateInterview}
                        >
                          Luyện phỏng vấn ngay <ArrowRight size={15} />
                        </button>
                      </div>
                    ) : (
                      <ol className="eval-gap-list" aria-label="Danh sách gap theo mức độ ưu tiên">
                        {gaps.gaps.map((gap, idx) => (
                          <li key={gap.requirement_id}>
                            <GapActionItem
                              gap={gap}
                              rank={idx + 1}
                              onOptimize={onNavigateOptimize}
                              onInterview={onNavigateInterview}
                            />
                          </li>
                        ))}
                      </ol>
                    )}
                  </>
                )}
              </div>

              <div
                id="eval-panel-all"
                role="tabpanel"
                aria-labelledby="eval-tab-all"
                hidden={activeTab !== 'all'}
                className="eval-panel"
              >
                {evaluation.criteria_summary.map((crit) => (
                  <section key={crit.criterion_id} className="eval-criterion-section">
                    <button
                      type="button"
                      className="eval-criterion-section__trigger"
                      aria-expanded={expandedCriterion === crit.criterion_id}
                      onClick={() => handleExpandCriterion(crit.criterion_id)}
                    >
                      <span className="eval-criterion-section__label">{crit.label}</span>
                      <span className="eval-criterion-section__score">
                        {Math.round(crit.weighted_score)}/{Math.round(crit.weight)} điểm
                      </span>
                      <ChevronDown
                        size={16}
                        className={`eval-criterion-section__chevron ${expandedCriterion === crit.criterion_id ? 'is-open' : ''}`}
                        aria-hidden="true"
                      />
                    </button>

                    {expandedCriterion === crit.criterion_id && (
                      <div className="eval-criterion-section__body">
                        {!requirementsData[crit.criterion_id] && (
                          <div className="eval-center" aria-live="polite">
                            <Loader2 size={18} className="eval-spin" aria-hidden="true" /> Đang
                            tải...
                          </div>
                        )}
                        {requirementsData[crit.criterion_id]?.map((req) => (
                          <RequirementAccordion
                            key={req.requirement_id}
                            req={req}
                            onViewEvidence={handleViewEvidence}
                            evidenceLoading={
                              evidenceLoading && activeReq?.requirement_id === req.requirement_id
                            }
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
        </div>

        {activeReq && (
          <EvidenceDrawer
            requirementText={activeReq.text}
            evidence={evidenceData}
            loading={evidenceLoading}
            onClose={() => {
              setActiveReq(null);
              setEvidenceData(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function MatchedPanel({
  evaluation,
  fetchRequirements,
  onViewEvidence,
  evidenceLoading,
}: {
  evaluation: NonNullable<ReturnType<typeof useMatchEvaluation>['evaluation']>;
  fetchRequirements: ReturnType<typeof useMatchEvaluation>['fetchRequirements'];
  onViewEvidence: (req: RequirementDetail) => void;
  evidenceLoading: boolean;
}) {
  const [loaded, setLoaded] = useState<Record<string, RequirementDetail[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const results: Record<string, RequirementDetail[]> = {};
      for (const crit of evaluation.criteria_summary) {
        const data = await fetchRequirements(crit.criterion_id);
        if (data) results[crit.criterion_id] = data.items;
      }
      if (!cancelled) {
        setLoaded(results);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [evaluation.criteria_summary, fetchRequirements]);

  const matchedReqs = Object.values(loaded)
    .flat()
    .filter((r) => r.status === 'SUPPORTED' || r.status === 'PARTIALLY_SUPPORTED');

  if (loading) {
    return (
      <div className="eval-center eval-center--col" aria-live="polite">
        <Loader2 size={22} className="eval-spin" aria-hidden="true" />
        <span>Đang tải danh sách yêu cầu đã đáp ứng...</span>
      </div>
    );
  }

  if (matchedReqs.length === 0) {
    return (
      <div className="eval-empty" role="status">
        <p>Chưa tìm thấy yêu cầu nào được đáp ứng rõ ràng trong CV.</p>
        <p className="eval-empty__hint">Hãy bổ sung thêm bằng chứng cụ thể vào CV của bạn.</p>
      </div>
    );
  }

  return (
    <ul className="eval-matched-list" role="list" aria-label="Các yêu cầu đã được đáp ứng">
      {matchedReqs.map((req) => (
        <li key={req.requirement_id} className="eval-matched-item">
          <div className="eval-matched-item__header">
            <span
              className={`eval-badge ${req.status === 'SUPPORTED' ? 'eval-badge--success' : 'eval-badge--warning'} eval-badge--sm`}
            >
              {req.status === 'SUPPORTED' ? '✓ Đã đáp ứng' : '~ Một phần'}
            </span>
            {req.mandatory && (
              <span className="eval-badge eval-badge--danger eval-badge--sm">Bắt buộc</span>
            )}
          </div>
          <p className="eval-matched-item__text">{req.text}</p>
          <button
            type="button"
            className="eval-btn eval-btn--ghost eval-btn--sm"
            onClick={() => onViewEvidence(req)}
            disabled={evidenceLoading}
          >
            Xem bằng chứng trong CV
          </button>
        </li>
      ))}
    </ul>
  );
}
