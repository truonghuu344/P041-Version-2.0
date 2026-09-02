'use client';

import { CV_TEMPLATES } from './TemplatePreviewCard';
import { VariantContent } from '@/lib/cvVariantsApi';

interface CVLivePreviewProps {
  content: VariantContent;
  template: string;
}

const CONTACT_ORDER: Array<{ key: string; label?: string }> = [
  { key: 'email' },
  { key: 'phone' },
  { key: 'location' },
  { key: 'linkedin' },
  { key: 'github' },
  { key: 'website' },
];

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value != null ? String(value).trim() : '';
}

function firstNonEmpty(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = str(item[key]);
    if (value) return value;
  }
  return '';
}

function entryTitle(item: Record<string, unknown>): string {
  return firstNonEmpty(item, ['role', 'position', 'title', 'degree', 'name', 'school', 'company']);
}

function entrySubtitle(item: Record<string, unknown>, title: string): string {
  const subtitle = firstNonEmpty(item, [
    'company',
    'organization',
    'school',
    'university',
    'institution',
    'issuer',
    'authority',
    'role',
  ]);
  return subtitle && subtitle !== title ? subtitle : '';
}

function entryPeriod(item: Record<string, unknown>): string {
  const direct = firstNonEmpty(item, ['duration', 'period', 'time', 'date', 'year']);
  if (direct) return direct;
  const start = str(item.start_date);
  const end = str(item.end_date);
  if (start || end) return [start, end || 'Hiện tại'].filter(Boolean).join(' – ');
  return '';
}

function entryBullets(item: Record<string, unknown>): string[] {
  const bullets = item.bullets;
  if (Array.isArray(bullets)) {
    const lines = bullets.map((b) => str(b)).filter(Boolean);
    if (lines.length) return lines;
  }
  const fallback = firstNonEmpty(item, ['description', 'summary', 'details']);
  if (!fallback) return [];
  return fallback
    .split(/\n+|•+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function entryTechnologies(item: Record<string, unknown>): string[] {
  const tech = item.technologies;
  return Array.isArray(tech) ? tech.map((t) => str(t)).filter(Boolean) : [];
}

function PreviewEntries({ items }: { items: Array<Record<string, unknown>> }) {
  return (
    <>
      {items.map((item, index) => {
        const title = entryTitle(item);
        const subtitle = entrySubtitle(item, title);
        const period = entryPeriod(item);
        const bullets = entryBullets(item);
        const technologies = entryTechnologies(item);
        if (!title && !subtitle && !bullets.length) return null;
        return (
          <div className="cv-live-entry" key={index}>
            <div className="cv-live-entry-head">
              <div className="cv-live-entry-title-group">
                {title && <strong>{title}</strong>}
                {subtitle && <span className="cv-live-entry-subtitle">{subtitle}</span>}
              </div>
              {period && <span className="cv-live-entry-period">{period}</span>}
            </div>
            {bullets.length > 0 && (
              <ul className="cv-live-entry-bullets">
                {bullets.map((bullet, bulletIndex) => (
                  <li key={bulletIndex}>{bullet}</li>
                ))}
              </ul>
            )}
            {technologies.length > 0 && (
              <p className="cv-live-entry-tech">
                <b>Công nghệ:</b> {technologies.join(', ')}
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}

export default function CVLivePreview({ content, template }: CVLivePreviewProps) {
  const meta = CV_TEMPLATES.find((t) => t.id === template) || CV_TEMPLATES[0];
  const fullName = str(content.personal_info?.full_name);
  const headline = str(content.headline);
  const contactLine = CONTACT_ORDER.map(({ key }) => str(content.personal_info?.[key]))
    .filter(Boolean)
    .join(' · ');
  const summary = str(content.summary);
  const skills = (content.skills || []).map((s) => str(s)).filter(Boolean);
  const experience = content.experience || [];
  const projects = content.projects || [];
  const education = content.education || [];
  const certifications = content.certifications || [];
  const isTwoColumn = meta.layout === 'two-column';

  const mainSections = (
    <>
      {summary && (
        <section className="cv-live-section">
          <h4 style={{ borderColor: meta.accentColor }}>Tóm tắt</h4>
          <p className="cv-live-summary">{summary}</p>
        </section>
      )}
      {!isTwoColumn && skills.length > 0 && (
        <section className="cv-live-section">
          <h4 style={{ borderColor: meta.accentColor }}>Kỹ năng</h4>
          <div className="cv-live-skill-pills">
            {skills.map((skill) => (
              <span key={skill} className="cv-live-skill-pill" style={{ color: meta.accentColor }}>
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}
      {experience.length > 0 && (
        <section className="cv-live-section">
          <h4 style={{ borderColor: meta.accentColor }}>Kinh nghiệm làm việc</h4>
          <PreviewEntries items={experience} />
        </section>
      )}
      {projects.length > 0 && (
        <section className="cv-live-section">
          <h4 style={{ borderColor: meta.accentColor }}>Dự án tiêu biểu</h4>
          <PreviewEntries items={projects} />
        </section>
      )}
      {education.length > 0 && (
        <section className="cv-live-section">
          <h4 style={{ borderColor: meta.accentColor }}>Học vấn</h4>
          <PreviewEntries items={education} />
        </section>
      )}
      {certifications.length > 0 && (
        <section className="cv-live-section">
          <h4 style={{ borderColor: meta.accentColor }}>Chứng chỉ & Hoạt động</h4>
          <PreviewEntries items={certifications} />
        </section>
      )}
    </>
  );

  return (
    <div className={`cv-live-preview cv-live-preview-${meta.layout}`}>
      <div className="cv-live-preview-scale">
        <div className="cv-live-sheet">
          <header className="cv-live-header" style={{ borderColor: meta.accentColor }}>
            <h3>{fullName || 'Họ và tên'}</h3>
            {headline && <p className="cv-live-headline">{headline}</p>}
            {contactLine && <p className="cv-live-contact">{contactLine}</p>}
          </header>
          {isTwoColumn ? (
            <div className="cv-live-columns">
              <aside
                className="cv-live-sidebar"
                style={{ background: `${meta.accentColor}14`, borderColor: `${meta.accentColor}33` }}
              >
                {skills.length > 0 && (
                  <div className="cv-live-section">
                    <h4 style={{ borderColor: meta.accentColor }}>Kỹ năng</h4>
                    <div className="cv-live-skill-pills">
                      {skills.map((skill) => (
                        <span
                          key={skill}
                          className="cv-live-skill-pill"
                          style={{ color: meta.accentColor, borderColor: meta.accentColor }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
              <div className="cv-live-main">{mainSections}</div>
            </div>
          ) : (
            <div className="cv-live-main">{mainSections}</div>
          )}
          {!fullName && !summary && !experience.length && !projects.length && !education.length && (
            <p className="cv-live-empty">
              Nội dung CV của bạn sẽ hiện ở đây khi bạn chỉnh sửa hoặc chấp nhận đề xuất từ AI.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
