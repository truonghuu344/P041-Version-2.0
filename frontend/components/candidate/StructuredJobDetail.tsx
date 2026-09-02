'use client';

import React from 'react';
import {
  MapPin,
  Wallet,
  Users,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import {
  normalizeStructuredJobDetail,
  StructuredJobDetailOptions,
} from '@/lib/structuredJobDetail';

interface Props {
  job: Record<string, unknown>;
  options?: StructuredJobDetailOptions;
}

export default function StructuredJobDetail({ job, options = {} }: Props) {
  const data = normalizeStructuredJobDetail(job, options);
  const mode = options.mode || 'modal';

  return (
    <div className={`structured-jd-detail-root jd-mode-${mode}`}>
      {/* 1. Hero Header (when in modal mode) */}
      {options.showHeroHeader !== false && mode === 'modal' && (
        <header className="jd-detail-hero">
          <div className="jd-detail-hero-top">
            <div className="jd-detail-title-group">
              <span className="jd-detail-kicker">Chi tiết tin tuyển dụng</span>
              <h2 className="jd-detail-title">{data.title}</h2>
              <div className="jd-detail-company">{data.company}</div>
            </div>
            {data.sourceUrl && (
              <a
                href={data.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="jd-detail-source-link"
                title={`Mở tin gốc trên ${data.sourcePlatformName || 'website'}`}
              >
                <span>Xem tin gốc trên {data.sourcePlatformName || 'Website tuyển dụng'}</span>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
          </div>

          {/* Meta Pills */}
          <div className="jd-detail-meta-row">
            {data.location && (
              <span className="jd-detail-pill pill-location">
                <MapPin size={14} aria-hidden="true" />
                <span>{data.location}</span>
              </span>
            )}
            {data.workMode && (
              <span className="jd-detail-pill pill-workmode">{data.workMode}</span>
            )}
            {data.employmentType && (
              <span className="jd-detail-pill pill-employment">{data.employmentType}</span>
            )}
            {data.seniority && (
              <span className="jd-detail-pill pill-seniority">{data.seniority}</span>
            )}
            {data.salary && (
              <span className="jd-detail-pill pill-salary highlight">
                <Wallet size={14} aria-hidden="true" />
                <span>{data.salary}</span>
              </span>
            )}
            {data.openings && (
              <span className="jd-detail-pill pill-openings highlight">
                <Users size={14} aria-hidden="true" />
                <span>Tuyển {data.openings} người</span>
              </span>
            )}
            {data.deadline && (
              <span className="jd-detail-pill pill-deadline">
                <Calendar size={14} aria-hidden="true" />
                <span>Hạn ứng tuyển: <strong>{data.deadline}</strong></span>
              </span>
            )}
          </div>
        </header>
      )}

      {/* 2. Skills Section */}
      {options.showSkillsSection !== false && data.skills.length > 0 && (
        <section className="jd-detail-section jd-skills-section">
          <h4 className="jd-detail-section-heading">Kỹ năng &amp; Công nghệ trọng tâm</h4>
          <div className="jd-detail-skills-wrap">
            {data.skills.map((skill, idx) => (
              <span key={`${skill}-${idx}`} className="jd-detail-skill-tag">
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 3. Body Sections with Hierarchical Sub-sections */}
      <div className="jd-detail-body-sections">
        {data.sections.length > 0 ? (
          data.sections.map((sec) => (
            <section key={sec.id} className={`jd-detail-section jd-section-${sec.type}`}>
              <h4 className="jd-detail-section-heading">{sec.title}</h4>
              <div className="jd-detail-section-content">
                {sec.items.length > 0 && (
                  <ul className="jd-detail-list">
                    {sec.items.map((item, idx) => (
                      <li key={`${sec.id}-item-${idx}`} className="jd-detail-list-item">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                {sec.subSections && sec.subSections.length > 0 && (
                  sec.subSections.map((sub, sIdx) => (
                    <div key={`${sec.id}-sub-${sIdx}`} className="jd-detail-sub-group">
                      {sub.title && <h5 className="jd-detail-sub-heading">{sub.title}</h5>}
                      <ul className="jd-detail-list">
                        {sub.items.map((subItem, iIdx) => (
                          <li key={`${sec.id}-sub-${sIdx}-item-${iIdx}`} className="jd-detail-list-item">
                            {subItem}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))
        ) : (
          <div className="jd-detail-empty-state">
            <p>Doanh nghiệp chưa cập nhật mô tả chi tiết cho vị trí tuyển dụng này.</p>
          </div>
        )}
      </div>
    </div>
  );
}
