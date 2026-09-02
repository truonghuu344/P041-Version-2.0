/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  HelpCircle,
  ClipboardList,
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
  onInsertTemplate?: (id: string, type: JobSectionData['type']) => void;
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
  onInsertTemplate,
}: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(section.title);

  const getSemanticBadge = (type: JobSectionData['type']) => {
    switch (type) {
      case 'overview':
        return { label: 'Giới thiệu vị trí', bg: 'bg-slate-100 text-slate-700' };
      case 'responsibilities':
        return { label: 'Mô tả công việc', bg: 'bg-slate-100 text-slate-700' };
      case 'must_have':
        return { label: 'Yêu cầu bắt buộc', bg: 'bg-emerald-50 text-[#006948] border border-emerald-200/70 font-bold' };
      case 'nice_to_have':
        return { label: 'Yêu cầu ưu tiên', bg: 'bg-slate-100 text-slate-700' };
      case 'benefits':
        return { label: 'Quyền lợi', bg: 'bg-slate-100 text-slate-700' };
      case 'hiring_process':
        return { label: 'Quy trình tuyển dụng', bg: 'bg-slate-100 text-slate-700' };
      default:
        return { label: 'Mục tự thêm', bg: 'bg-slate-100 text-slate-700' };
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
    <div
      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3 transition-all"
      data-testid={`job-section-${section.type}`}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {isEditingTitle ? (
            <input
              type="text"
              className="h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:border-[#006948]"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              autoFocus
            />
          ) : (
            <h3
              className="font-['Plus_Jakarta_Sans'] text-sm md:text-base font-bold text-slate-900 cursor-pointer hover:text-[#006948] transition-colors truncate"
              onClick={() => setIsEditingTitle(true)}
              title="Bấm để sửa tiêu đề mục"
            >
              {section.title}
              {section.isRequired && <span className="text-red-500 ml-1">*</span>}
            </h3>
          )}

          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold shrink-0 ${badge.bg}`}>
            {badge.label}
          </span>
        </div>

        {/* Clean Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onInsertTemplate && (
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#006948] text-xs font-semibold transition-colors"
              onClick={() => onInsertTemplate(section.id, section.type)}
              title="Chèn nội dung mẫu chuẩn cho mục này"
            >
              <ClipboardList size={13} />
              <span>Nội dung mẫu</span>
            </button>
          )}

          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors border border-slate-200"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          {!section.isRequired && (
            <button
              type="button"
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors border border-red-200"
              onClick={() => onDeleteSection(section.id)}
              title="Xóa mục này"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Section Hint */}
      {!isCollapsed && section.hint && (
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <HelpCircle size={13} className="text-slate-400 shrink-0" />
          <span>{section.hint}</span>
        </p>
      )}

      {/* Section Rich Editor */}
      {!isCollapsed && (
        <div className="pt-1">
          <WordLikeEditor
            initialContent={section.content}
            onChange={(html) => onChangeContent(section.id, html)}
            placeholder={`Nhập chi tiết cho mục "${section.title}"...`}
            minHeight="120px"
          />
        </div>
      )}
    </div>
  );
}
