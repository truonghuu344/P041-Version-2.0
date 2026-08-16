/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  CheckSquare,
  Indent,
  Outdent,
  Link as LinkIcon,
  Unlink,
  Table as TableIcon,
  Minus,
  Quote,
  Sparkles,
  Maximize2,
  Minimize2,
  RemoveFormatting,
  Plus,
  Trash2,
  ChevronDown,
  Info,
  Check,
  X,
  Type,
  Palette,
  Highlighter,
  HelpCircle
} from 'lucide-react';

export interface WordLikeEditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  readOnly?: boolean;
}

// Preset color palettes (WCAG compliant / contrast safe)
const TEXT_COLORS = [
  { name: 'Mặc định (Đen xám)', value: '#17322b' },
  { name: 'Xanh lá thương hiệu', value: '#147a5a' },
  { name: 'Xanh dương Slate', value: '#2563eb' },
  { name: 'Tím Indigo', value: '#4f46e5' },
  { name: 'Đỏ đậm', value: '#b91c1c' },
  { name: 'Xám vừa', value: '#475569' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Không highlight', value: 'transparent' },
  { name: 'Xanh lục dịu', value: '#dcfce7' },
  { name: 'Vàng nhạt', value: '#fef3c7' },
  { name: 'Xanh dương nhạt', value: '#e0f2fe' },
  { name: 'Hồng phấn', value: '#ffe4e6' },
  { name: 'Tím nhạt', value: '#f3e8ff' },
];

const FONT_FAMILIES = [
  { name: 'Mặc định (Inter / System)', value: 'var(--font-inter, Inter, sans-serif)' },
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
];

const FONT_SIZES = [
  { name: '12px (Nhỏ)', value: '12px' },
  { name: '14px (Phụ)', value: '14px' },
  { name: '16px (Chuẩn)', value: '16px' },
  { name: '18px (Nổi bật)', value: '18px' },
  { name: '20px (Tiêu đề nhỏ)', value: '20px' },
  { name: '24px (Tiêu đề vừa)', value: '24px' },
];

export default function WordLikeEditor({
  initialContent = '',
  onChange,
  placeholder = 'Nhập hoặc dán nội dung tuyển dụng tại đây...',
  minHeight = '320px',
  isFullscreen = false,
  onToggleFullscreen,
  readOnly = false,
}: WordLikeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(initialContent);

  // Active formats state for toolbar highlights
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    alignLeft: true,
    alignCenter: false,
    alignRight: false,
    bulletList: false,
    orderedList: false,
    heading: 'p',
    fontFamily: FONT_FAMILIES[0].value,
    fontSize: '16px',
    textColor: '#17322b',
    highlightColor: 'transparent',
  });

  // Modals and Popovers state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [savedSelectionRange, setSavedSelectionRange] = useState<Range | null>(null);

  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);

  // Slash commands state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState('');

  // Floating Contextual AI State
  const [showAIPopover, setShowAIPopover] = useState(false);
  const [aiPopoverPos, setAiPopoverPos] = useState({ top: 0, left: 0 });
  const [selectedAIText, setSelectedAIText] = useState('');
  const [aiDiffModal, setAiDiffModal] = useState<{
    original: string;
    suggested: string;
    actionLabel: string;
  } | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);

  // Paste Toast Notification
  const [pasteNotification, setPasteNotification] = useState<{
    visible: boolean;
    rawText: string;
  }>({ visible: false, rawText: '' });

  // Sync external initialContent if changed
  useEffect(() => {
    if (editorRef.current && initialContent !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = initialContent;
      setContent(initialContent);
    }
  }, [initialContent]);

  // Execute standard execCommand or DOM action
  const execCmd = (command: string, value: string | undefined = undefined) => {
    if (readOnly) return;
    try {
      editorRef.current?.focus();
      if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
        document.execCommand(command, false, value);
      }
    } catch {
      // JSDOM or browser fallback
    }
    handleEditorInput();
    updateToolbarState();
  };

  // Inspect current selection for toolbar state sync
  const updateToolbarState = useCallback(() => {
    if (!editorRef.current) return;
    try {
      const isBold = document.queryCommandState('bold');
      const isItalic = document.queryCommandState('italic');
      const isUnderline = document.queryCommandState('underline');
      const isStrike = document.queryCommandState('strikeThrough');
      const isBullet = document.queryCommandState('insertUnorderedList');
      const isNumbered = document.queryCommandState('insertOrderedList');
      const isLeft = document.queryCommandState('justifyLeft');
      const isCenter = document.queryCommandState('justifyCenter');
      const isRight = document.queryCommandState('justifyRight');

      const selection = window.getSelection();
      let heading = 'p';
      if (selection && selection.rangeCount > 0) {
        let node: Node | null = selection.anchorNode;
        while (node && node !== editorRef.current) {
          if (node.nodeName === 'H1') { heading = 'h1'; break; }
          if (node.nodeName === 'H2') { heading = 'h2'; break; }
          if (node.nodeName === 'H3') { heading = 'h3'; break; }
          if (node.nodeName === 'BLOCKQUOTE') { heading = 'quote'; break; }
          if ((node as HTMLElement).classList?.contains('editor-callout')) { heading = 'callout'; break; }
          node = node.parentNode;
        }
      }

      setActiveFormats((prev) => ({
        ...prev,
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        strikethrough: isStrike,
        bulletList: isBullet,
        orderedList: isNumbered,
        alignLeft: isLeft || (!isCenter && !isRight),
        alignCenter: isCenter,
        alignRight: isRight,
        heading,
      }));
    } catch {
      // Browser selection error fallback
    }
  }, []);

  // Handle content change & notification
  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setContent(html);
    if (onChange) {
      onChange(html);
    }
  };

  // Save current selection range (for modals)
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      setSavedSelectionRange(sel.getRangeAt(0).cloneRange());
    }
  };

  const restoreSelection = () => {
    if (savedSelectionRange) {
      try {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedSelectionRange);
        }
      } catch {
        // JSDOM selection error fallback
      }
    }
  };

  // Selection change listener for Floating AI & Toolbar sync
  const handleSelectionChange = () => {
    updateToolbarState();

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !editorRef.current) {
      setShowAIPopover(false);
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 3 && editorRef.current.contains(selection.anchorNode)) {
      setSelectedAIText(text);
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const editorRect = editorRef.current.getBoundingClientRect();

      setAiPopoverPos({
        top: Math.max(10, rect.top - editorRect.top - 42),
        left: Math.min(editorRect.width - 240, Math.max(10, rect.left - editorRect.left + rect.width / 2 - 100)),
      });
      setShowAIPopover(true);
    } else {
      setShowAIPopover(false);
    }
  };

  // Format block (p, h1, h2, h3, quote, callout)
  const handleApplyFormat = (tag: string) => {
    if (tag === 'quote') {
      execCmd('formatBlock', '<blockquote>');
    } else if (tag === 'callout') {
      // Create callout wrapper
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const calloutDiv = document.createElement('div');
        calloutDiv.className = 'editor-callout';
        calloutDiv.innerHTML = `<div class="editor-callout-icon">💡</div><div class="editor-callout-content">${range.extractContents().textContent || 'Lưu ý quan trọng cho ứng viên...'}</div>`;
        range.insertNode(calloutDiv);
        handleEditorInput();
      }
    } else {
      execCmd('formatBlock', `<${tag}>`);
    }
    setShowFormatDropdown(false);
  };

  // Checklist creation
  const handleInsertChecklist = () => {
    const checklistHtml = `
      <ul class="editor-checklist" style="list-style: none; padding-left: 0;">
        <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
          <input type="checkbox" style="margin-top: 4px; cursor: pointer;" />
          <span>Nhiệm vụ hoặc kỹ năng cần kiểm tra...</span>
        </li>
      </ul>
    `;
    execCmd('insertHTML', checklistHtml);
  };

  // Table insertion
  const handleInsertTable = (rows: number, cols: number) => {
    let tableHtml = '<table class="word-editor-table" style="width: 100%; border-collapse: collapse; margin: 12px 0;"><thead><tr>';
    for (let c = 0; c < cols; c++) {
      tableHtml += `<th style="border: 1px solid #d1d5db; padding: 8px 12px; background: #f8fafc; text-align: left; font-weight: 600;">Tiêu đề ${c + 1}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < cols; c++) {
        tableHtml += `<td style="border: 1px solid #d1d5db; padding: 8px 12px;">Nội dung ${r + 1}-${c + 1}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p><br></p>';
    
    restoreSelection();
    execCmd('insertHTML', tableHtml);
    setShowTableModal(false);
  };

  // Modify active table
  const handleTableAction = (action: 'addRowAbove' | 'addRowBelow' | 'addColLeft' | 'addColRight' | 'delRow' | 'delCol' | 'delTable') => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    let cell: HTMLTableCellElement | null = null;
    let node: Node | null = selection.anchorNode;
    while (node && node !== editorRef.current) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') {
        cell = node as HTMLTableCellElement;
        break;
      }
      node = node.parentNode;
    }

    if (!cell) {
      alert('Vui lòng đặt con trỏ chuột bên trong một ô bảng để thao tác.');
      return;
    }

    const row = cell.parentElement as HTMLTableRowElement;
    const table = row.closest('table') as HTMLTableElement;
    if (!table) return;

    const rowIndex = row.rowIndex;
    const cellIndex = cell.cellIndex;

    if (action === 'addRowBelow') {
      const newRow = table.insertRow(rowIndex + 1);
      for (let i = 0; i < row.cells.length; i++) {
        const newCell = newRow.insertCell(i);
        newCell.style.border = '1px solid #d1d5db';
        newCell.style.padding = '8px 12px';
        newCell.innerHTML = 'Nội dung mới';
      }
    } else if (action === 'addRowAbove') {
      const newRow = table.insertRow(rowIndex);
      for (let i = 0; i < row.cells.length; i++) {
        const newCell = newRow.insertCell(i);
        newCell.style.border = '1px solid #d1d5db';
        newCell.style.padding = '8px 12px';
        newCell.innerHTML = 'Nội dung mới';
      }
    } else if (action === 'addColRight') {
      for (let r = 0; r < table.rows.length; r++) {
        const targetRow = table.rows[r];
        const newCell = targetRow.insertCell(cellIndex + 1);
        newCell.style.border = '1px solid #d1d5db';
        newCell.style.padding = '8px 12px';
        if (targetRow.parentElement?.tagName === 'THEAD') {
          newCell.style.background = '#f8fafc';
          newCell.style.fontWeight = '600';
          newCell.innerHTML = 'Cột mới';
        } else {
          newCell.innerHTML = 'Dữ liệu';
        }
      }
    } else if (action === 'addColLeft') {
      for (let r = 0; r < table.rows.length; r++) {
        const targetRow = table.rows[r];
        const newCell = targetRow.insertCell(cellIndex);
        newCell.style.border = '1px solid #d1d5db';
        newCell.style.padding = '8px 12px';
        if (targetRow.parentElement?.tagName === 'THEAD') {
          newCell.style.background = '#f8fafc';
          newCell.style.fontWeight = '600';
          newCell.innerHTML = 'Cột mới';
        } else {
          newCell.innerHTML = 'Dữ liệu';
        }
      }
    } else if (action === 'delRow') {
      table.deleteRow(rowIndex);
      if (table.rows.length === 0) table.remove();
    } else if (action === 'delCol') {
      for (let r = 0; r < table.rows.length; r++) {
        if (table.rows[r].cells[cellIndex]) {
          table.rows[r].deleteCell(cellIndex);
        }
      }
    } else if (action === 'delTable') {
      table.remove();
    }

    handleEditorInput();
  };

  // Link handling
  const handleOpenLinkModal = () => {
    saveSelection();
    const sel = window.getSelection();
    if (sel) {
      setLinkText(sel.toString() || '');
    }
    setLinkUrl('https://');
    setShowLinkModal(true);
  };

  const handleApplyLink = () => {
    restoreSelection();
    if (!linkUrl || linkUrl === 'https://') return;
    
    // Sanitize link URL (prevent javascript: or data: URIs)
    const sanitizedUrl = linkUrl.trim().startsWith('http://') || linkUrl.trim().startsWith('https://') || linkUrl.trim().startsWith('mailto:')
      ? linkUrl.trim()
      : `https://${linkUrl.trim()}`;

    if (linkText) {
      const linkHtml = `<a href="${sanitizedUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--primary, #147a5a); text-decoration: underline;">${linkText}</a>`;
      execCmd('insertHTML', linkHtml);
    } else {
      execCmd('createLink', sanitizedUrl);
    }
    setShowLinkModal(false);
  };

  const handleRemoveLink = () => {
    restoreSelection();
    execCmd('unlink');
    setShowLinkModal(false);
  };

  // Keyboard Shortcuts listener
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;

    // Slash command trigger
    if (e.key === '/' && !showSlashMenu) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const editorRect = editorRef.current.getBoundingClientRect();
        setSlashMenuPos({
          top: rect.bottom - editorRect.top + 8,
          left: Math.max(10, rect.left - editorRect.left),
        });
        setShowSlashMenu(true);
        setSlashQuery('');
      }
    } else if (showSlashMenu) {
      if (e.key === 'Escape') {
        setShowSlashMenu(false);
      }
    }

    // Ctrl / Cmd Shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          execCmd('bold');
          break;
        case 'i':
          e.preventDefault();
          execCmd('italic');
          break;
        case 'u':
          e.preventDefault();
          execCmd('underline');
          break;
        case 'k':
          e.preventDefault();
          handleOpenLinkModal();
          break;
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            execCmd('redo');
          } else {
            execCmd('undo');
          }
          break;
        case 'y':
          e.preventDefault();
          execCmd('redo');
          break;
        default:
          break;
      }
    }
  };

  // Copy / Paste Sanitizer
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    const htmlData = clipboardData.getData('text/html');
    const plainText = clipboardData.getData('text/plain');

    if (htmlData) {
      // Sanitize HTML from Word / Google Docs / Web
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlData, 'text/html');

      // Strip dangerous or extraneous elements
      const dangerousTags = ['script', 'style', 'meta', 'link', 'iframe', 'object', 'embed', 'form', 'svg'];
      dangerousTags.forEach((tag) => {
        const els = doc.querySelectorAll(tag);
        els.forEach((el) => el.remove());
      });

      // Remove Word MSO tracking attributes & styles
      const allElements = doc.querySelectorAll('*');
      allElements.forEach((el) => {
        // Strip inline style fonts/colors if they are external
        el.removeAttribute('class');
        el.removeAttribute('id');
        el.removeAttribute('v:shapes');
        el.removeAttribute('o:spid');
        
        // Remove tracking attributes
        const attrs = Array.from(el.attributes);
        attrs.forEach((attr) => {
          if (attr.name.startsWith('on') || attr.name.startsWith('data-') || attr.name.startsWith('mso-')) {
            el.removeAttribute(attr.name);
          }
        });
      });

      const cleanHtml = doc.body.innerHTML;
      execCmd('insertHTML', cleanHtml);

      // Show friendly paste banner
      setPasteNotification({ visible: true, rawText: plainText });
      setTimeout(() => setPasteNotification({ visible: false, rawText: '' }), 5000);
    } else if (plainText) {
      // Format simple plain text linebreaks
      const formatted = plainText
        .split('\n')
        .map((line) => (line.trim() ? `<p>${line}</p>` : '<p><br></p>'))
        .join('');
      execCmd('insertHTML', formatted);
    }
  };

  // Paste Action Options
  const handleKeepPlainTextOnly = () => {
    if (pasteNotification.rawText) {
      const clean = pasteNotification.rawText
        .split('\n')
        .map((line) => `<p>${line}</p>`)
        .join('');
      if (editorRef.current) {
        editorRef.current.innerHTML = clean;
        handleEditorInput();
      }
    }
    setPasteNotification({ visible: false, rawText: '' });
  };

  const handleClearAllFormatting = () => {
    execCmd('removeFormat');
    setPasteNotification({ visible: false, rawText: '' });
  };

  // Contextual AI Actions
  const handleExecuteAI = (actionType: 'professional' | 'shorten' | 'clarify' | 'grammar' | 'bullets') => {
    if (!selectedAIText) return;
    setIsAILoading(true);

    setTimeout(() => {
      let result = '';
      let label = '';
      switch (actionType) {
        case 'professional':
          label = 'Viết lại chuyên nghiệp hơn';
          result = `Chịu trách nhiệm thiết kế, tối ưu hóa và duy trì các hệ thống phần mềm hiệu năng cao, bảo đảm tính sẵn sàng và khả năng mở rộng của dịch vụ.`;
          break;
        case 'shorten':
          label = 'Rút gọn nội dung';
          result = selectedAIText.length > 40 ? selectedAIText.substring(0, Math.floor(selectedAIText.length * 0.65)) + '...' : selectedAIText;
          break;
        case 'clarify':
          label = 'Làm rõ & Chi tiết hơn';
          result = `${selectedAIText} Đảm bảo tuân thủ tiêu chuẩn clean code, viết tài liệu kỹ thuật đầy đủ và cộng tác chặt chẽ cùng đội ngũ Product/QA.`;
          break;
        case 'grammar':
          label = 'Sửa lỗi chính tả & ngữ pháp';
          result = selectedAIText
            .replace(/dc/g, 'được')
            .replace(/ko/g, 'không')
            .replace(/ng/g, 'người')
            .trim();
          break;
        case 'bullets':
          label = 'Chuyển thành Bullet Points';
          result = selectedAIText
            .split(/[,.;\n]+/)
            .filter((s) => s.trim().length > 0)
            .map((s) => `• ${s.trim()}`)
            .join('\n');
          break;
      }

      setIsAILoading(false);
      setShowAIPopover(false);
      setAiDiffModal({
        original: selectedAIText,
        suggested: result,
        actionLabel: label,
      });
    }, 600);
  };

  const handleApplyAISuggestion = () => {
    if (aiDiffModal && editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      const updated = currentHtml.replace(aiDiffModal.original, aiDiffModal.suggested.replace(/\n/g, '<br/>'));
      editorRef.current.innerHTML = updated;
      handleEditorInput();
    }
    setAiDiffModal(null);
  };

  return (
    <div className={`word-editor-container ${isFullscreen ? 'is-fullscreen' : ''}`} data-testid="word-like-editor">
      {/* Sticky Formatting Toolbar */}
      <div className="word-editor-toolbar" role="toolbar" aria-label="Soạn thảo văn bản">
        {/* History Group */}
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn"
            title="Hoàn tác (Ctrl+Z)"
            onClick={() => execCmd('undo')}
            aria-label="Undo"
          >
            <Undo size={15} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            title="Làm lại (Ctrl+Y)"
            onClick={() => execCmd('redo')}
            aria-label="Redo"
          >
            <Redo size={15} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Text Style Dropdown */}
        <div className="toolbar-dropdown-wrap">
          <button
            type="button"
            className="toolbar-select-btn"
            onClick={() => setShowFormatDropdown(!showFormatDropdown)}
            title="Định dạng đoạn văn"
          >
            <span>
              {activeFormats.heading === 'h1' && 'Heading 1'}
              {activeFormats.heading === 'h2' && 'Heading 2'}
              {activeFormats.heading === 'h3' && 'Heading 3'}
              {activeFormats.heading === 'quote' && 'Trích dẫn'}
              {activeFormats.heading === 'callout' && 'Callout Box'}
              {activeFormats.heading === 'p' && 'Văn bản thường'}
            </span>
            <ChevronDown size={13} />
          </button>

          {showFormatDropdown && (
            <div className="toolbar-menu-dropdown">
              <button type="button" className="toolbar-menu-item" onClick={() => handleApplyFormat('p')}>
                <span>Văn bản thường (Normal text)</span>
              </button>
              <button type="button" className="toolbar-menu-item" onClick={() => handleApplyFormat('h1')}>
                <span style={{ fontSize: '18px', fontWeight: 800 }}>Heading 1 (Tiêu đề lớn)</span>
              </button>
              <button type="button" className="toolbar-menu-item" onClick={() => handleApplyFormat('h2')}>
                <span style={{ fontSize: '16px', fontWeight: 700 }}>Heading 2 (Tiêu đề vừa)</span>
              </button>
              <button type="button" className="toolbar-menu-item" onClick={() => handleApplyFormat('h3')}>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>Heading 3 (Tiêu đề nhỏ)</span>
              </button>
              <button type="button" className="toolbar-menu-item" onClick={() => handleApplyFormat('quote')}>
                <span>Trích dẫn (Quote)</span>
              </button>
              <button type="button" className="toolbar-menu-item" onClick={() => handleApplyFormat('callout')}>
                <span>Hộp ghi chú nổi bật (Callout)</span>
              </button>
            </div>
          )}
        </div>

        {/* Font Family Selector */}
        <div className="toolbar-dropdown-wrap">
          <button
            type="button"
            className="toolbar-select-btn"
            onClick={() => setShowFontPicker(!showFontPicker)}
            title="Font chữ an toàn"
          >
            <span>Font chữ</span>
            <ChevronDown size={13} />
          </button>

          {showFontPicker && (
            <div className="toolbar-menu-dropdown">
              {FONT_FAMILIES.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  className="toolbar-menu-item"
                  style={{ fontFamily: f.value }}
                  onClick={() => {
                    execCmd('fontName', f.value);
                    setShowFontPicker(false);
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Font Size Selector */}
        <div className="toolbar-dropdown-wrap">
          <button
            type="button"
            className="toolbar-select-btn"
            onClick={() => setShowFontSizePicker(!showFontSizePicker)}
            title="Cỡ chữ"
          >
            <span>{activeFormats.fontSize}</span>
            <ChevronDown size={13} />
          </button>

          {showFontSizePicker && (
            <div className="toolbar-menu-dropdown" style={{ minWidth: '110px' }}>
              {FONT_SIZES.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  className="toolbar-menu-item"
                  onClick={() => {
                    setActiveFormats((prev) => ({ ...prev, fontSize: s.value }));
                    execCmd('fontSize', '3'); // standard mapping fallback
                    setShowFontSizePicker(false);
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="toolbar-divider" />

        {/* Basic Formatting Group */}
        <div className="toolbar-group">
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.bold ? 'active' : ''}`}
            title="Đậm (Ctrl+B)"
            onClick={() => execCmd('bold')}
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.italic ? 'active' : ''}`}
            title="Nghiêng (Ctrl+I)"
            onClick={() => execCmd('italic')}
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.underline ? 'active' : ''}`}
            title="Gạch chân (Ctrl+U)"
            onClick={() => execCmd('underline')}
          >
            <Underline size={15} />
          </button>
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.strikethrough ? 'active' : ''}`}
            title="Gạch ngang chữ"
            onClick={() => execCmd('strikeThrough')}
          >
            <Strikethrough size={15} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Colors & Highlight Group */}
        <div className="toolbar-group">
          {/* Text Color Picker */}
          <div className="toolbar-dropdown-wrap">
            <button
              type="button"
              className="toolbar-btn"
              title="Màu chữ"
              onClick={() => setShowColorPicker(!showColorPicker)}
            >
              <Palette size={15} />
            </button>
            {showColorPicker && (
              <div className="toolbar-menu-dropdown color-palette-menu">
                <p className="color-palette-title">Màu chữ tương phản chuẩn</p>
                <div className="color-grid">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className="color-swatch"
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                      onClick={() => {
                        execCmd('foreColor', c.value);
                        setShowColorPicker(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Highlight Color Picker */}
          <div className="toolbar-dropdown-wrap">
            <button
              type="button"
              className="toolbar-btn"
              title="Màu đánh dấu (Highlight pastel)"
              onClick={() => setShowHighlightPicker(!showHighlightPicker)}
            >
              <Highlighter size={15} />
            </button>
            {showHighlightPicker && (
              <div className="toolbar-menu-dropdown color-palette-menu">
                <p className="color-palette-title">Màu Highlight Pastel</p>
                <div className="color-grid">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className="color-swatch"
                      style={{ backgroundColor: c.value, border: c.value === 'transparent' ? '1px dashed #9ca3af' : 'none' }}
                      title={c.name}
                      onClick={() => {
                        execCmd('hiliteColor', c.value);
                        setShowHighlightPicker(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Clear Formatting */}
          <button
            type="button"
            className="toolbar-btn"
            title="Xóa định dạng"
            onClick={handleClearAllFormatting}
          >
            <RemoveFormatting size={15} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Alignment Group */}
        <div className="toolbar-group">
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.alignLeft ? 'active' : ''}`}
            title="Căn trái"
            onClick={() => execCmd('justifyLeft')}
          >
            <AlignLeft size={15} />
          </button>
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.alignCenter ? 'active' : ''}`}
            title="Căn giữa"
            onClick={() => execCmd('justifyCenter')}
          >
            <AlignCenter size={15} />
          </button>
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.alignRight ? 'active' : ''}`}
            title="Căn phải"
            onClick={() => execCmd('justifyRight')}
          >
            <AlignRight size={15} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Lists & Indent Group */}
        <div className="toolbar-group">
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.bulletList ? 'active' : ''}`}
            title="Danh sách dấu chấm"
            onClick={() => execCmd('insertUnorderedList')}
          >
            <List size={15} />
          </button>
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.orderedList ? 'active' : ''}`}
            title="Danh sách số"
            onClick={() => execCmd('insertOrderedList')}
          >
            <ListOrdered size={15} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            title="Danh sách Checklist kiểm tra"
            onClick={handleInsertChecklist}
          >
            <CheckSquare size={15} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            title="Giảm thụt lề"
            onClick={() => execCmd('outdent')}
          >
            <Outdent size={15} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            title="Tăng thụt lề"
            onClick={() => execCmd('indent')}
          >
            <Indent size={15} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Link, Table & Divider Group */}
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn"
            title="Chèn liên kết (Ctrl+K)"
            onClick={handleOpenLinkModal}
          >
            <LinkIcon size={15} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            title="Chèn bảng biểu"
            onClick={() => {
              saveSelection();
              setShowTableModal(true);
            }}
          >
            <TableIcon size={15} />
          </button>
          <button
            type="button"
            className="toolbar-btn"
            title="Đường phân cách ngang"
            onClick={() => execCmd('insertHorizontalRule')}
          >
            <Minus size={15} />
          </button>
        </div>

        {/* Fullscreen Toggle */}
        {onToggleFullscreen && (
          <div className="toolbar-group" style={{ marginLeft: 'auto' }}>
            <button
              type="button"
              className="toolbar-btn"
              title={isFullscreen ? 'Thoát toàn màn hình' : 'Chế độ soạn thảo toàn màn hình'}
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        )}
      </div>

      {/* Paste Notification Banner */}
      {pasteNotification.visible && (
        <div className="word-paste-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={16} />
            <span>Nội dung đã được dán và làm sạch theo chuẩn Career Assistant.</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="word-paste-opt-btn"
              onClick={() => setPasteNotification({ visible: false, rawText: '' })}
            >
              Giữ định dạng sạch
            </button>
            <button
              type="button"
              className="word-paste-opt-btn is-plain"
              onClick={handleKeepPlainTextOnly}
            >
              Chỉ giữ văn bản thuần
            </button>
          </div>
        </div>
      )}

      {/* Document Canvas Workspace */}
      <div className="word-canvas-wrapper" onClick={() => editorRef.current?.focus()}>
        <div className="word-document-paper" style={{ minHeight }}>
          {/* Editable Document Area */}
          <div
            ref={editorRef}
            className="word-editor-content"
            contentEditable={!readOnly}
            suppressContentEditableWarning
            onInput={handleEditorInput}
            onKeyDown={handleKeyDown}
            onKeyUp={handleSelectionChange}
            onMouseUp={handleSelectionChange}
            onPaste={handlePaste}
            data-placeholder={placeholder}
          />
        </div>
      </div>

      {/* Floating Contextual AI Selection Tool */}
      {showAIPopover && (
        <div
          className="word-floating-ai-popover"
          style={{ top: `${aiPopoverPos.top}px`, left: `${aiPopoverPos.left}px` }}
        >
          <div className="ai-popover-header">
            <Sparkles size={14} style={{ color: '#10b981' }} />
            <strong>AI Trợ lý JD</strong>
          </div>
          <div className="ai-popover-actions">
            <button type="button" onClick={() => handleExecuteAI('professional')}>
              Viết lại chuyên nghiệp hơn
            </button>
            <button type="button" onClick={() => handleExecuteAI('shorten')}>
              Rút gọn nội dung
            </button>
            <button type="button" onClick={() => handleExecuteAI('clarify')}>
              Làm rõ & Chi tiết
            </button>
            <button type="button" onClick={() => handleExecuteAI('grammar')}>
              Sửa ngữ pháp & chính tả
            </button>
            <button type="button" onClick={() => handleExecuteAI('bullets')}>
              Chuyển thành Bullet Points
            </button>
          </div>
        </div>
      )}

      {/* Slash Commands Dropdown */}
      {showSlashMenu && (
        <div
          className="word-slash-menu"
          style={{ top: `${slashMenuPos.top}px`, left: `${slashMenuPos.left}px` }}
        >
          <div className="slash-menu-header">Lệnh định dạng nhanh (Gõ / để mở)</div>
          <button type="button" onClick={() => { handleApplyFormat('h1'); setShowSlashMenu(false); }}>
            <strong>H1</strong> Heading 1 (Tiêu đề lớn)
          </button>
          <button type="button" onClick={() => { handleApplyFormat('h2'); setShowSlashMenu(false); }}>
            <strong>H2</strong> Heading 2 (Tiêu đề vừa)
          </button>
          <button type="button" onClick={() => { execCmd('insertUnorderedList'); setShowSlashMenu(false); }}>
            <strong>•</strong> Danh sách Bullet points
          </button>
          <button type="button" onClick={() => { execCmd('insertOrderedList'); setShowSlashMenu(false); }}>
            <strong>1.</strong> Danh sách đánh số
          </button>
          <button type="button" onClick={() => { handleInsertChecklist(); setShowSlashMenu(false); }}>
            <strong>☑</strong> Checklist ứng tuyển
          </button>
          <button type="button" onClick={() => { handleApplyFormat('quote'); setShowSlashMenu(false); }}>
            <strong>“</strong> Trích dẫn / Quote
          </button>
          <button type="button" onClick={() => { handleApplyFormat('callout'); setShowSlashMenu(false); }}>
            <strong>💡</strong> Hộp ghi chú Callout
          </button>
          <button type="button" onClick={() => { handleInsertTable(3, 2); setShowSlashMenu(false); }}>
            <strong>⊞</strong> Bảng 2 cột chuẩn JD
          </button>
          <button type="button" onClick={() => { execCmd('insertHorizontalRule'); setShowSlashMenu(false); }}>
            <strong>―</strong> Đường phân cách ngang
          </button>
        </div>
      )}

      {/* Link Insertion Modal */}
      {showLinkModal && (
        <div className="word-modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="word-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="word-modal-header">
              <h3>Chèn liên kết</h3>
              <button type="button" onClick={() => setShowLinkModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="word-modal-body">
              <label className="word-modal-label">Văn bản hiển thị</label>
              <input
                type="text"
                className="word-modal-input"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="VD: Tìm hiểu thêm về công ty"
              />
              <label className="word-modal-label" style={{ marginTop: '12px' }}>Đường dẫn URL</label>
              <input
                type="url"
                className="word-modal-input"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com/careers"
              />
            </div>
            <div className="word-modal-footer">
              <button
                type="button"
                className="word-btn-danger"
                onClick={handleRemoveLink}
              >
                Gỡ liên kết
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="word-btn-secondary"
                  onClick={() => setShowLinkModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="word-btn-primary"
                  onClick={handleApplyLink}
                >
                  Áp dụng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insert Table Modal & Quick Table Actions */}
      {showTableModal && (
        <div className="word-modal-overlay" onClick={() => setShowTableModal(false)}>
          <div className="word-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="word-modal-header">
              <h3>Chèn bảng biểu (Tối đa 6 cột × 20 hàng)</h3>
              <button type="button" onClick={() => setShowTableModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="word-modal-body">
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="word-modal-label">Số cột (Columns, tối đa 6)</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    className="word-modal-input"
                    value={tableCols}
                    onChange={(e) => setTableCols(Math.min(6, Math.max(1, parseInt(e.target.value) || 1)))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="word-modal-label">Số hàng (Rows, tối đa 20)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    className="word-modal-input"
                    value={tableRows}
                    onChange={(e) => setTableRows(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                  />
                </div>
              </div>

              {/* Table Quick Preset Templates */}
              <div style={{ marginTop: '16px' }}>
                <p className="word-modal-label">Mẫu bảng thông dụng:</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="word-badge-btn"
                    onClick={() => { setTableRows(3); setTableCols(2); }}
                  >
                    Quyền lợi & Chi tiết (2 cột)
                  </button>
                  <button
                    type="button"
                    className="word-badge-btn"
                    onClick={() => { setTableRows(4); setTableCols(3); }}
                  >
                    Kỹ năng & Mức độ (3 cột)
                  </button>
                </div>
              </div>
            </div>
            <div className="word-modal-footer">
              <button
                type="button"
                className="word-btn-secondary"
                onClick={() => setShowTableModal(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="word-btn-primary"
                onClick={() => handleInsertTable(tableRows, tableCols)}
              >
                Tạo bảng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Suggestion Diff / Comparison Modal */}
      {aiDiffModal && (
        <div className="word-modal-overlay">
          <div className="word-modal-box" style={{ maxWidth: '640px' }}>
            <div className="word-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: '#10b981' }} />
                <h3>Đề xuất cải thiện từ AI: {aiDiffModal.actionLabel}</h3>
              </div>
              <button type="button" onClick={() => setAiDiffModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="word-modal-body">
              <div style={{ marginBottom: '14px' }}>
                <label className="word-modal-label" style={{ color: '#991b1b' }}>Đoạn văn gốc:</label>
                <div className="diff-box diff-original">{aiDiffModal.original}</div>
              </div>
              <div>
                <label className="word-modal-label" style={{ color: '#166534' }}>Đoạn văn sau khi cải thiện:</label>
                <div className="diff-box diff-suggested">{aiDiffModal.suggested}</div>
              </div>
            </div>
            <div className="word-modal-footer">
              <button
                type="button"
                className="word-btn-secondary"
                onClick={() => handleExecuteAI('professional')}
              >
                Thử lại phương án khác
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="word-btn-secondary"
                  onClick={() => setAiDiffModal(null)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="word-btn-primary"
                  onClick={handleApplyAISuggestion}
                >
                  <Check size={16} />
                  <span>Áp dụng vào văn bản</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
