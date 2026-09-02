/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  RemoveFormatting,
  Heading2,
  Heading3,
} from 'lucide-react';

export interface WordLikeEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  readOnly?: boolean;
}

export default function WordLikeEditor({
  initialContent = '',
  onChange,
  placeholder = 'Nhập hoặc dán nội dung tuyển dụng tại đây...',
  minHeight = '140px',
  readOnly = false,
}: WordLikeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(initialContent);
  const [isFocused, setIsFocused] = useState(false);

  // Sync initial content
  useEffect(() => {
    if (editorRef.current && initialContent !== editorRef.current.innerHTML) {
      if (document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = initialContent;
        setContent(initialContent);
      }
    }
  }, [initialContent]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setContent(html);
      if (onChange) {
        onChange(html);
      }
    }
  }, [onChange]);

  const execCmd = (command: string, value: string | undefined = undefined) => {
    if (readOnly) return;
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const plainText = e.clipboardData.getData('text/plain');
    if (plainText) {
      const formatted = plainText
        .split('\n')
        .map((line) => (line.trim() ? `<p>${line}</p>` : '<p><br></p>'))
        .join('');
      document.execCommand('insertHTML', false, formatted);
      handleInput();
    }
  };

  return (
    <div
      className={`rounded-xl border transition-all overflow-hidden bg-white ${
        isFocused ? 'border-[#006948] ring-1 ring-[#006948]' : 'border-slate-200'
      }`}
      data-testid="word-like-editor"
    >
      {/* Sleek Minimal Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-1 p-1.5 bg-slate-50 border-b border-slate-200/80 flex-wrap">
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-700 transition-colors"
            onClick={() => execCmd('bold')}
            title="In đậm (Ctrl+B)"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-700 transition-colors"
            onClick={() => execCmd('italic')}
            title="In nghiêng (Ctrl+I)"
          >
            <Italic size={14} />
          </button>
          <div className="w-px h-4 bg-slate-300 mx-0.5" />
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-700 transition-colors"
            onClick={() => execCmd('formatBlock', '<h2>')}
            title="Tiêu đề vừa (H2)"
          >
            <Heading2 size={14} />
          </button>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-700 transition-colors"
            onClick={() => execCmd('formatBlock', '<h3>')}
            title="Tiêu đề nhỏ (H3)"
          >
            <Heading3 size={14} />
          </button>
          <div className="w-px h-4 bg-slate-300 mx-0.5" />
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-700 transition-colors"
            onClick={() => execCmd('insertUnorderedList')}
            title="Danh sách dấu chấm"
          >
            <List size={14} />
          </button>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-700 transition-colors"
            onClick={() => execCmd('insertOrderedList')}
            title="Danh sách số"
          >
            <ListOrdered size={14} />
          </button>
          <div className="w-px h-4 bg-slate-300 mx-0.5" />
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-700 transition-colors"
            onClick={() => execCmd('removeFormat')}
            title="Xóa định dạng"
          >
            <RemoveFormatting size={14} />
          </button>
        </div>
      )}

      {/* Editable Canvas */}
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{ minHeight }}
        data-placeholder={placeholder}
        className="p-4 outline-none text-sm text-slate-800 leading-relaxed font-['Inter'] [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-slate-400 [&:empty]:before:pointer-events-none prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:text-slate-900 prose-headings:my-2"
      />
    </div>
  );
}
