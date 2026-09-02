'use client';

import React from 'react';
import {
  MapPin,
  BriefcaseBusiness,
  WalletCards,
  Users,
  Clock3,
  CalendarDays,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import {
  normalizeJobData,
  UnifiedJobCardOptions,
  escapeHtml,
} from '@/lib/unifiedJobCard';

export interface UnifiedJobCardProps {
  job: Record<string, unknown>;
  options?: UnifiedJobCardOptions;
  onSelect?: (jobId: string) => void;
  onViewDetails?: (jobId: string) => void;
}

export default function UnifiedJobCard({
  job,
  options = {},
  onSelect,
  onViewDetails,
}: UnifiedJobCardProps) {
  const data = normalizeJobData(job, options);
  const variant = options.variant || (job.catalog_mode ? 'catalog' : 'top-match');
  const isSelected = Boolean(options.isSelected);
  const rank = options.rank;

  const handleCardClick = (e: React.MouseEvent) => {
    const isRadio = (e.target as HTMLElement).closest('.p1-job-card-radio, [data-action="select-job"]');
    const isSourceLink = (e.target as HTMLElement).closest('.job-source-verify-link');
    if (isSourceLink) return;

    if (variant === 'match-picker') {
      if (isRadio && onSelect) {
        e.preventDefault();
        e.stopPropagation();
        onSelect(data.sourceId);
      } else if (onViewDetails) {
        onViewDetails(data.sourceId);
      }
    } else if (onViewDetails) {
      onViewDetails(data.id);
    }
  };

  const cardClasses = [
    'top-job-card',
    variant === 'match-picker' ? 'p1-job-card' : '',
    isSelected ? 'is-selected' : '',
    data.isMandatoryFailed && variant === 'top-match' ? 'is-mandatory-failed' : '',
  ].filter(Boolean).join(' ');

  return (
    <article
      className={cardClasses}
      data-job-id={variant === 'match-picker' ? undefined : data.id}
      data-target-job={variant === 'match-picker' ? data.sourceId : undefined}
      tabIndex={0}
      role="button"
      aria-label={
        variant === 'match-picker'
          ? `Chọn vị trí ${data.title} tại ${data.company}`
          : `Xem chi tiết ${data.title} tại ${data.company}`
      }
      aria-pressed={isSelected ? 'true' : undefined}
      onClick={handleCardClick}
    >
      {/* Top Row: Logo + Titles + Rank/Fit/Radio */}
      <div className="top-job-card-header">
        <div className="top-job-header-left">
          <div className="top-job-logo-wrap">
            {data.hasValidLogo && data.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={data.logoUrl}
                alt={data.company}
                className="top-job-logo-img"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                  const parent = (e.target as HTMLElement).parentElement;
                  if (parent) {
                    parent.innerHTML = `<span class="top-job-logo-initial">${escapeHtml(data.companyInitial)}</span>`;
                  }
                }}
              />
            ) : (
              <span className="top-job-logo-initial">{data.companyInitial}</span>
            )}
          </div>
          <div className="top-job-main-meta">
            <div className="top-job-title-row">
              {variant === 'top-match' && rank ? (
                <span className="top-job-rank-badge">#{rank}</span>
              ) : null}
              <h3 className="top-job-title" title={data.title}>
                {data.title}
              </h3>
            </div>
            <div className="top-job-company-name" title={data.company}>
              {data.company}
            </div>
          </div>
        </div>

        {variant === 'match-picker' ? (
          <button
            type="button"
            className={`p1-job-card-radio${isSelected ? ' is-selected' : ''}`}
            data-action="select-job"
            aria-label={`Chọn công việc ${data.title}`}
            title={isSelected ? 'Đang chọn vị trí này' : 'Chọn vị trí này để Match'}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(data.sourceId);
            }}
          />
        ) : variant === 'catalog' ? (
          <div className="top-job-catalog-badge">{data.fitLabel}</div>
        ) : (
          <div className="top-job-score-block">
            {data.scoreVisible && data.fitScore !== undefined ? (
              <div
                className={`top-job-fit-score ${
                  data.isMandatoryFailed ? 'is-mandatory-failed' : ''
                }`}
              >
                {data.fitScore}%
              </div>
            ) : null}
            <div
              className={`top-job-fit-badge ${
                data.isMandatoryFailed ? 'is-mandatory-failed' : ''
              }`}
            >
              {data.fitLabel}
            </div>
          </div>
        )}
      </div>

      {/* Core Metadata Row (Location · Work mode · Seniority · Employment) */}
      {(data.location || data.workMode || data.seniority || data.employmentType) && (
        <div className="top-job-core-meta-row">
          {data.location && (
            <span className="top-job-meta-item">
              <MapPin size={12} aria-hidden="true" />
              <span>{data.location}</span>
            </span>
          )}
          {data.location && (data.workMode || data.seniority || data.employmentType) && (
            <span className="top-job-meta-dot" aria-hidden="true">
              ·
            </span>
          )}
          {data.workMode && <span className="top-job-meta-item">{data.workMode}</span>}
          {data.workMode && (data.seniority || data.employmentType) && (
            <span className="top-job-meta-dot" aria-hidden="true">
              ·
            </span>
          )}
          {data.seniority && <span className="top-job-meta-item">{data.seniority}</span>}
          {data.seniority && data.employmentType && (
            <span className="top-job-meta-dot" aria-hidden="true">
              ·
            </span>
          )}
          {data.employmentType && (
            <span className="top-job-meta-item">{data.employmentType}</span>
          )}
        </div>
      )}

      {/* Hiring Highlights (Salary · Openings · Applicants) */}
      {(data.salary || data.openings || data.applicantCount) && (
        <div className="top-job-hiring-row">
          {data.salary && (
            <span className="top-job-highlight-pill pill-salary" title="Mức lương">
              <WalletCards size={12} aria-hidden="true" />
              <span>{data.salary}</span>
            </span>
          )}
          {data.openings && (
            <span className="top-job-highlight-pill pill-openings" title="Số lượng tuyển dụng">
              <Users size={12} aria-hidden="true" />
              <span>Tuyển {data.openings} người</span>
            </span>
          )}
          {data.applicantCount && (
            <span
              className="top-job-highlight-pill pill-applicants"
              title="Số lượng ứng viên đã nộp hồ sơ"
            >
              <BriefcaseBusiness size={12} aria-hidden="true" />
              <span>{data.applicantCount} ứng viên</span>
            </span>
          )}
        </div>
      )}

      {/* Mandatory Warning if any */}
      {data.isMandatoryFailed && variant === 'top-match' && (
        <div className="top-job-mandatory-warning" role="alert">
          <AlertTriangle size={12} aria-hidden="true" />
          <div className="mandatory-warning-text">
            <strong>Thiếu yêu cầu bắt buộc</strong>
            <span>Điểm hiển thị đã được giới hạn tối đa 49%.</span>
          </div>
        </div>
      )}

      {/* Skills with Required/Preferred/More */}
      {(data.skills.length > 0 || data.remainingSkillsCount > 0) && (
        <div className="top-job-card-skills">
          <div className="top-job-tags-wrap">
            {data.skills.map((s, idx) => (
              <span key={idx} className={`top-job-tag is-${s.type}`}>
                {s.type === 'required' || s.type === 'strength' ? (
                  <span className="tag-icon tag-icon-req">✓</span>
                ) : s.type === 'preferred' ? (
                  <span className="tag-icon tag-icon-pref">✦</span>
                ) : null}
                {s.text}
              </span>
            ))}
            {data.remainingSkillsCount > 0 && (
              <span
                className="top-job-tag is-more"
                title={`Các kỹ năng khác: ${data.remainingSkillsTooltip}`}
              >
                +{data.remainingSkillsCount} kỹ năng
              </span>
            )}
          </div>
        </div>
      )}

      {/* Timeline (Posted time · Deadline) */}
      {(data.postedTimeText || data.deadlineText) && (
        <div className="top-job-timeline-row">
          {data.postedTimeText && (
            <span className="top-job-timeline-item" title="Thời gian đăng tuyển">
              <Clock3 size={12} aria-hidden="true" />
              <span>{data.postedTimeText}</span>
            </span>
          )}
          {data.postedTimeText && data.deadlineText && (
            <span className="top-job-meta-dot" aria-hidden="true">
              ·
            </span>
          )}
          {data.deadlineText && (
            <span className="top-job-timeline-item" title="Hạn nộp hồ sơ">
              <CalendarDays size={12} aria-hidden="true" />
              <span>
                Hạn ứng tuyển: <strong>{data.deadlineText}</strong>
              </span>
            </span>
          )}
        </div>
      )}

      {/* Card Footer */}
      <div className="top-job-card-footer">
        {data.summaryText && (
          <div className="top-job-summary-line">
            <span className="summary-line-dot" />
            <span className="summary-line-text">{data.summaryText}</span>
          </div>
        )}
        <div className="top-job-card-action-bar">
          {data.hasSourceUrl ? (
            <a
              className="btn-job-source job-source-verify-link"
              href={data.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Mở tin tuyển dụng gốc trên ${data.sourcePlatformName}`}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="source-platform-prefix">Nguồn: {data.sourcePlatformName}</span>
              <span className="source-link-action">
                Xem tin tuyển dụng gốc <ExternalLink size={11} aria-hidden="true" />
              </span>
            </a>
          ) : (
            <div className="top-job-source-spacer" />
          )}

          {variant === 'match-picker' ? (
            <button
              type="button"
              className="btn-job-details btn-choose-job-match"
              data-action="select-job"
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(data.sourceId);
              }}
            >
              {isSelected ? '✓ Đã chọn' : 'Chọn để Match'}
            </button>
          ) : (
            <button
              type="button"
              className="btn-job-details btn-view-job-spec"
              data-job-details-id={data.id}
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails?.(data.id);
              }}
            >
              Xem chi tiết
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
