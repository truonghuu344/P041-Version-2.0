/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import {
  Monitor,
  Smartphone,
  MapPin,
  Briefcase,
  Clock,
  DollarSign,
  Calendar,
  Building,
  CheckCircle2,
  Share2,
  Bookmark,
  Send,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { JobSectionData } from './JobSectionBlock';

export interface ScreeningQuestion {
  id: string;
  question: string;
  type: 'text' | 'yes_no' | 'number';
  required: boolean;
}

interface Props {
  title: string;
  department: string;
  level: string;
  employmentType: string;
  workModel: string;
  locationCity: string;
  address: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  salaryVisibility: string;
  deadline: string;
  tags: string[];
  sections: JobSectionData[];
  questions: ScreeningQuestion[];
}

export default function JobCandidatePreview({
  title,
  department,
  level,
  employmentType,
  workModel,
  locationCity,
  address,
  salaryMin,
  salaryMax,
  salaryCurrency,
  salaryVisibility,
  deadline,
  tags,
  sections,
  questions,
}: Props) {
  const [deviceView, setDeviceView] = useState<'desktop' | 'mobile'>('desktop');

  const formattedSalary = salaryVisibility === 'Công khai' && (salaryMin || salaryMax)
    ? `${salaryMin ? salaryMin + ' ' : ''}${salaryMax ? '- ' + salaryMax + ' ' : ''}${salaryCurrency}/tháng`
    : 'Thỏa thuận khi phỏng vấn';

  return (
    <div className="candidate-preview-wrapper" data-testid="job-candidate-preview">
      {/* Device Switcher Bar */}
      <div className="candidate-preview-control-bar">
        <div className="preview-mode-title">
          <Sparkles size={16} style={{ color: 'var(--primary, #147a5a)' }} />
          <span>Giao diện ứng viên sẽ nhìn thấy (WYSIWYG Candidate View)</span>
        </div>
        <div className="preview-device-toggle">
          <button
            type="button"
            className={`device-btn ${deviceView === 'desktop' ? 'active' : ''}`}
            onClick={() => setDeviceView('desktop')}
          >
            <Monitor size={15} />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            className={`device-btn ${deviceView === 'mobile' ? 'active' : ''}`}
            onClick={() => setDeviceView('mobile')}
          >
            <Smartphone size={15} />
            <span>Mobile Phone</span>
          </button>
        </div>
      </div>

      {/* Simulator Frame */}
      <div className={`candidate-preview-canvas ${deviceView === 'mobile' ? 'is-mobile-view' : ''}`}>
        {deviceView === 'mobile' && <div className="mobile-notch" />}

        <div className="candidate-job-detail-card">
          {/* Top Job Banner */}
          <div className="candidate-job-hero">
            <div className="hero-company-badge">
              <Building size={16} />
              <span>Career Assistant Partner Enterprise</span>
            </div>
            <h1 className="candidate-job-title">{title || 'Tiêu đề vị trí tuyển dụng'}</h1>
            
            <div className="candidate-job-meta-grid">
              <div className="meta-item">
                <MapPin size={15} />
                <span>{locationCity} {address ? `(${address})` : ''}</span>
              </div>
              <div className="meta-item">
                <Briefcase size={15} />
                <span>{employmentType} · {workModel}</span>
              </div>
              <div className="meta-item">
                <DollarSign size={15} />
                <span style={{ fontWeight: 600, color: 'var(--primary, #147a5a)' }}>{formattedSalary}</span>
              </div>
              <div className="meta-item">
                <Calendar size={15} />
                <span>Hạn nộp: {deadline || '30/09/2026'}</span>
              </div>
            </div>

            {/* Tags / Skills */}
            {tags && tags.length > 0 && (
              <div className="candidate-job-tags">
                {tags.map((t) => (
                  <span key={t} className="candidate-tag-pill">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Quick Action CTA */}
            <div className="candidate-cta-row">
              <button type="button" className="candidate-apply-btn" disabled>
                <Send size={15} />
                <span>Ứng tuyển ngay bằng AI Matching</span>
              </button>
              <button type="button" className="candidate-save-btn" disabled>
                <Bookmark size={15} />
              </button>
            </div>
          </div>

          <div className="candidate-divider" />

          {/* Structured Rich Sections */}
          <div className="candidate-sections-flow">
            {sections.map((sec) => {
              if (!sec.content || sec.content === '<p><br></p>') return null;
              return (
                <section key={sec.id} className="candidate-detail-section">
                  <h2 className="candidate-section-heading">{sec.title}</h2>
                  <div
                    className="candidate-rich-content word-editor-content"
                    dangerouslySetInnerHTML={{ __html: sec.content }}
                  />
                </section>
              );
            })}
          </div>

          {/* Screening Questions Preview */}
          {questions && questions.length > 0 && (
            <div className="candidate-screening-preview">
              <h3 className="candidate-screening-title">
                <HelpCircle size={16} style={{ color: 'var(--primary)' }} />
                <span>Câu hỏi khảo sát khi ứng tuyển ({questions.length} câu)</span>
              </h3>
              <div className="screening-questions-list">
                {questions.map((q, i) => (
                  <div key={q.id} className="screening-q-item">
                    <p className="screening-q-text">
                      <strong>Câu {i + 1}:</strong> {q.question}
                      {q.required && <span className="req">*</span>}
                    </p>
                    <input
                      type="text"
                      className="screening-q-input"
                      placeholder="Câu trả lời của ứng viên..."
                      disabled
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
