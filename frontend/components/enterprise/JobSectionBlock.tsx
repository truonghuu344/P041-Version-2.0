/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import {
  GripVertical,
  ChevronDown,
  ChevronUp,
  Trash2,
  Sparkles,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  CheckCircle2,
  Layers
} from 'lucide-react';
import WordLikeEditor from './WordLikeEditor';

export interface JobSectionData {
  id: string;
  type: 'overview' | 'responsibilities' | 'must_have' | 'nice_to_have' | 'benefits' | 'hiring_process' | 'custom';
  title: string;
  hint: string;
  content: string;
  isRequired?: boolean;
}

interface Props {
  section: JobSectionData;
  index: number;
  totalSections: number;
  onChangeContent: (id: string, newHtml: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDeleteSection: (id: string) => void;
  onRenameTitle?: (id: string, newTitle: string) => void;
}

export default function JobSectionBlock({
  section,
  index,
  totalSections,
  onChangeContent,
  onMoveUp,
  onMoveDown,
  onDeleteSection,
  onRenameTitle,
}: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(section.title);

  const getSemanticBadge = (type: JobSectionData['type']) => {
    switch (type) {
      case 'overview':
        return { label: 'ATS: Introduction', bg: '#ecfdf5', color: '#065f46' };
      case 'responsibilities':
        return { label: 'ATS: Responsibilities', bg: '#eff6ff', color: '#1e40af' };
      case 'must_have':
        return { label: 'ATS: Must-Have (Matching Core)', bg: '#fef2f2', color: '#991b1b' };
      case 'nice_to_have':
        return { label: 'ATS: Nice-To-Have', bg: '#fefce8', color: '#854d0e' };
      case 'benefits':
        return { label: 'ATS: Benefits & Perks', bg: '#f5f3ff', color: '#5b21b6' };
      case 'hiring_process':
        return { label: 'ATS: Hiring Process', bg: '#f0fdf4', color: '#166534' };
      default:
        return { label: 'ATS: Custom Section', bg: '#f3f4f6', color: '#374151' };
    }
  };

  const badge = getSemanticBadge(section.type);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (onRenameTitle && titleValue.trim()) {
      onRenameTitle(section.id, titleValue.trim());
    }
  };

  return (
    <div className="job-section-block" data-testid={`job-section-${section.type}`}>
      {/* Section Header */}
      <div className="job-section-header">
        <div className="section-drag-handle" title="Kéo thả hoặc dùng nút mũi tên để đổi thứ tự">
          <GripVertical size={16} />
        </div>

        <div className="section-title-wrap">
          {isEditingTitle ? (
            <input
              type="text"
              className="section-title-edit-input"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              autoFocus
            />
          ) : (
            <h3
              className="section-block-title"
              onClick={() => setIsEditingTitle(true)}
              title="Nhấn để chỉnh sửa tên mục"
            >
              {section.title}
              {section.isRequired && <span className="req">*</span>}
            </h3>
          )}
          <span
            className="section-semantic-badge"
            style={{ backgroundColor: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
        </div>

        {/* Action Controls */}
        <div className="section-actions">
          <button
            type="button"
            className="section-ctrl-btn"
            disabled={index === 0}
            onClick={() => onMoveUp(index)}
            title="Di chuyển lên trên"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            className="section-ctrl-btn"
            disabled={index === totalSections - 1}
            onClick={() => onMoveDown(index)}
            title="Di chuyển xuống dưới"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            className="section-ctrl-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          {!section.isRequired && (
            <button
              type="button"
              className="section-ctrl-btn is-delete"
              onClick={() => onDeleteSection(section.id)}
              title="Xóa mục này"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Section Hint */}
      {!isCollapsed && section.hint && (
        <p className="job-section-hint">
          <HelpCircle size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          {section.hint}
        </p>
      )}

      {/* Section Rich Editor */}
      {!isCollapsed && (
        <div className="job-section-editor-wrap">
          <WordLikeEditor
            initialContent={section.content}
            onChange={(html) => onChangeContent(section.id, html)}
            placeholder={`Nhập chi tiết cho mục "${section.title}"...`}
            minHeight="140px"
          />
        </div>
      )}
    </div>
  );
}
