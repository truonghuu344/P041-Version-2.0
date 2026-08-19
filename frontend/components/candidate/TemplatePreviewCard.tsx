'use client';

import React from 'react';
import { Check, Eye, Sparkles, UserCheck } from 'lucide-react';

export interface CVTemplateInfo {
  id: string;
  name: string;
  category: 'all' | 'ats' | 'tech' | 'creative' | 'compact' | 'business';
  badge: string;
  badgeClass: string;
  role: string;
  desc: string;
  accentColor: string;
  layout: string;
  imageUrl: string;
  samplePdfUrl?: string;
}

export const CV_TEMPLATES: CVTemplateInfo[] = [
  {
    id: 'classic',
    name: 'Classic Harvard ATS',
    category: 'ats',
    badge: 'ATS 100% TIÊU CHUẨN',
    badgeClass: 'badge-ats',
    role: 'Mọi ngành nghề, IT, Quản lý, Tài chính',
    desc: 'Chuẩn Harvard 1 cột kinh điển, đạt điểm quét tối đa trên mọi hệ thống ATS (Workday, Greenhouse, Taleo).',
    accentColor: '#1e293b',
    layout: 'single-column',
    imageUrl: '/images/templates/classic.jpg',
    samplePdfUrl: '/api/v1/cvs/templates/classic',
  },
  {
    id: 'modern',
    name: 'Modern Tech Pro',
    category: 'tech',
    badge: 'PHỔ BIẾN NHẤT',
    badgeClass: 'badge-popular',
    role: 'Software Engineer, Data, AI, DevOps',
    desc: 'Bố cục 2 cột hiện đại với sidebar màu xanh ngọc, hiển thị kỹ năng dạng tags nổi bật và layout cân đối.',
    accentColor: '#0d9488',
    layout: 'two-column',
    imageUrl: '/images/templates/modern.jpg',
    samplePdfUrl: '/api/v1/cvs/templates/modern',
  },
  {
    id: 'creative',
    name: 'Creative Dark Timeline',
    category: 'creative',
    badge: 'DARK CREATIVE',
    badgeClass: 'badge-creative',
    role: 'UI/UX Designer, Product, Creative Tech',
    desc: 'Header tối màu cá tính, timeline kinh nghiệm dạng đồ họa và huy hiệu kỹ năng trực quan thu hút nhà tuyển dụng.',
    accentColor: '#0f172a',
    layout: 'timeline-banner',
    imageUrl: '/images/templates/creative.jpg',
    samplePdfUrl: '/api/v1/cvs/templates/creative',
  },
  {
    id: 'compact',
    name: 'Minimalist Compact',
    category: 'compact',
    badge: '1 TRANG TINH GỌN',
    badgeClass: 'badge-compact',
    role: 'Senior, Tech Lead, Executive, Manager',
    desc: 'Tối ưu hóa mật độ thông tin gói gọn trong 1 trang duy nhất, căn chỉnh lề sắc nét, loại bỏ chi tiết thừa.',
    accentColor: '#334155',
    layout: 'compact-single',
    imageUrl: '/images/templates/compact.jpg',
    samplePdfUrl: '/api/v1/cvs/templates/classic',
  },
  {
    id: 'elegant',
    name: 'Elegant Executive',
    category: 'business',
    badge: 'SANG TRỌNG',
    badgeClass: 'badge-elegant',
    role: 'Banking, Finance, Business Analyst, Legal',
    desc: 'Phong cách trang nhã với phân cách tinh tế, đường viền thanh lịch và cấu trúc phân cấp thông tin rõ ràng.',
    accentColor: '#1e3a8a',
    layout: 'elegant-split',
    imageUrl: '/images/templates/elegant.jpg',
    samplePdfUrl: '/api/v1/cvs/templates/modern',
  },
];

/* ── Realistic TopCV-Style Miniature Image Renderer ── */

export function MiniCVSheet({ templateId }: { templateId: string }) {
  const imageMap: Record<string, string> = {
    classic: '/images/templates/classic.jpg',
    modern: '/images/templates/modern.jpg',
    creative: '/images/templates/creative.jpg',
    compact: '/images/templates/compact.jpg',
    elegant: '/images/templates/elegant.jpg',
  };

  const src = imageMap[templateId] || imageMap.classic;

  return (
    <div className={`mini-cv-image-wrapper sheet-${templateId}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Mẫu thiết kế CV ${templateId}`}
        className="mini-cv-template-img"
        loading="lazy"
      />
    </div>
  );
}

interface TemplateCardProps {
  template: CVTemplateInfo;
  isSelected?: boolean;
  onSelect: (id: string) => void;
  onQuickPreview?: (template: CVTemplateInfo) => void;
}

export default function TemplatePreviewCard({
  template,
  isSelected,
  onSelect,
  onQuickPreview,
}: TemplateCardProps) {
  return (
    <article
      className={`template-card-item template-preview template-preview-${template.id}${
        isSelected ? ' is-selected' : ''
      }`}
    >
      <div
        className="template-preview-viewport"
        onClick={() => onSelect(template.id)}
        role="button"
        tabIndex={0}
        aria-label={`Chọn mẫu ${template.name}`}
      >
        <span className={`template-card-badge ${template.badgeClass}`}>
          {template.badge}
        </span>
        <MiniCVSheet templateId={template.id} />
        {onQuickPreview && (
          <button
            type="button"
            className="template-quick-zoom-btn"
            onClick={(e) => {
              e.stopPropagation();
              onQuickPreview(template);
            }}
          >
            <Eye size={13} /> Phóng to
          </button>
        )}
      </div>

      <div className="template-card-info">
        <div>
          <h3>{template.name}</h3>
          <div className="template-card-role">
            <Sparkles size={13} /> {template.role}
          </div>
          <p>{template.desc}</p>
        </div>

        <div className="template-preview-actions">
          <button
            type="button"
            className="template-select-btn"
            onClick={() => onSelect(template.id)}
          >
            {isSelected ? <Check size={16} /> : <UserCheck size={16} />}
            {isSelected ? 'Đang chọn' : 'Dùng mẫu này'}
          </button>
        </div>
      </div>
    </article>
  );
}
