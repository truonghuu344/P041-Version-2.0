import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  History,
  LogIn,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import {
  CVSummary,
  CVVariant,
  JDSummary,
  VariantContent,
  VariantMode,
  VariantSuggestion,
  VariantValidation,
  cvVariantsApi,
} from '@/lib/cvVariantsApi';
import { CV_TEMPLATES, MiniCVSheet } from './TemplatePreviewCard';
import CVLivePreview from './CVLivePreview';
import CVEntryListEditor from './CVEntryListEditor';

const VALIDATOR_LABELS: Record<string, { title: string; desc: string }> = {
  schema: {
    title: 'Cấu trúc định dạng CV',
    desc: 'Đảm bảo các trường thông tin hợp lệ chuẩn ATS.',
  },
  atomic_claim: {
    title: 'Xác thực nguồn dữ liệu',
    desc: 'Mọi thông tin trong CV đều có bằng chứng từ hồ sơ gốc.',
  },
  entailment: {
    title: 'Tính trung thực & Logic',
    desc: 'Không tự ý phóng đại cấp bậc hay bóp méo nội dung.',
  },
  numeric_date: {
    title: 'Bảo toàn số liệu & Thời gian',
    desc: 'Giữ nguyên 100% các con số đo lường hiệu suất và mốc thời gian.',
  },
  metric_integrity: {
    title: 'Bảo toàn số liệu & Thời gian',
    desc: 'Giữ nguyên 100% các con số đo lường hiệu suất và mốc thời gian.',
  },
  jd_leakage: {
    title: 'Kiểm soát từ khóa mục tiêu',
    desc: 'Không sao chép từ khóa của JD khi chưa có kinh nghiệm thực tế.',
  },
  keyword_stuffing: {
    title: 'Kiểm soát từ khóa mục tiêu',
    desc: 'Không sao chép từ khóa của JD khi chưa có kinh nghiệm thực tế.',
  },
  protected_content: {
    title: 'Bảo vệ thông tin cá nhân',
    desc: 'Bảo toàn họ tên, học vấn và các trường thông tin bất biến.',
  },
  render_layout: {
    title: 'Bố cục & Định dạng in ấn',
    desc: 'Đảm bảo bản in PDF chuẩn ATS, vừa vặn trang giấy và dễ đọc.',
  },
};

type StudentValidationIssue = { reason: string; section: string };

const SECTION_LABELS: Record<string, string> = {
  skills: 'Kỹ năng', summary: 'Tóm tắt', experience: 'Kinh nghiệm làm việc',
  projects: 'Dự án', education: 'Học vấn', certifications: 'Chứng chỉ', personal_info: 'Thông tin cá nhân',
};

function studentIssues(validatorName: string, errors: string[]): StudentValidationIssue[] {
  const skillPaths = errors.filter((item) => /^skills\.\d+(?:\.\d+)?[:.]/i.test(item));
  const output: StudentValidationIssue[] = skillPaths.length
    ? [{ reason: `Có ${skillPaths.length} kỹ năng chưa đủ dữ liệu để xác minh.`, section: 'Kỹ năng' }]
    : [];
  for (const raw of errors) {
    if (/^skills\.\d+(?:\.\d+)?[:.]/i.test(raw)) continue;
    const sectionKey = Object.keys(SECTION_LABELS).find((key) => new RegExp(`(^|\\.)${key}(\\.|:|$)`, 'i').test(raw));
    const section = SECTION_LABELS[sectionKey || ''] || (
      validatorName === 'protected_content' ? 'Thông tin cá nhân' : 'Nội dung CV'
    );
    let reason = 'Một số thông tin chưa thể xác minh từ CV gốc.';
    if (/name|họ tên|full_name/i.test(raw)) reason = 'Họ tên cần khớp với CV gốc.';
    else if (/email|phone|điện thoại/i.test(raw)) reason = 'Thông tin liên hệ cần đầy đủ và khớp với CV gốc.';
    else if (/markdown|định dạng|schema|object|danh sách/i.test(raw)) reason = 'Nội dung có định dạng chưa phù hợp để xuất CV.';
    else if (/số|ngày|date|numeric/i.test(raw)) reason = 'Số liệu hoặc thời gian cần khớp với CV gốc.';
    else if (/keyword|JD|kỹ năng còn thiếu|công nghệ/i.test(raw)) reason = 'CV đang có từ khóa chưa có bằng chứng trong hồ sơ gốc.';
    else if (/render|PDF|trang|layout/i.test(raw)) reason = 'Bố cục PDF cần được điều chỉnh để in rõ ràng.';
    output.push({ reason, section });
  }
  return Array.from(new Map(output.map((item) => [`${item.section}|${item.reason}`, item])).values());
}

const emptyContent = (): VariantContent => ({
  personal_info: { full_name: '', email: '', phone: '' },
  summary: '',
  skills: [],
  experience: [],
  projects: [],
  education: [],
  certifications: [],
  template_name: 'classic',
});

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .trim();
}

interface SearchableJdSelectProps {
  items: JDSummary[];
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

function SearchableJdSelect({ items, value, disabled, onChange }: SearchableJdSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedItem = items.find((item) => item.id === value);
  const normalizedQuery = normalizeSearchValue(query);
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (!normalizedQuery) return true;
        const searchableValue = normalizeSearchValue(`${item.title} ${item.company || ''}`);
        return normalizedQuery.split(/\s+/).every((term) => searchableValue.includes(term));
      }),
    [items, normalizedQuery],
  );

  const closeMenu = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    setQuery('');
    setActiveIndex(0);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    const selectedIndex = items.findIndex((item) => item.id === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  }, [disabled, items, value]);

  const selectItem = useCallback(
    (item: JDSummary) => {
      onChange(item.id);
      closeMenu(true);
    },
    [closeMenu, onChange],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    requestAnimationFrame(() => searchRef.current?.focus());
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [closeMenu, isOpen]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(filteredItems.length - 1, 0)));
  }, [filteredItems.length]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === 'Tab') {
      closeMenu();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
        return;
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        if (!filteredItems.length) return 0;
        return (current + direction + filteredItems.length) % filteredItems.length;
      });
      return;
    }
    if (event.key === 'Enter') {
      if (!isOpen) {
        event.preventDefault();
        openMenu();
      } else if (filteredItems[activeIndex]) {
        event.preventDefault();
        selectItem(filteredItems[activeIndex]);
      }
    }
  };

  const placeholder = disabled
    ? 'Đăng nhập để xem danh sách JD'
    : items.length === 0
      ? 'Chưa có JD khả dụng'
      : `Chọn trong ${items.length} JD có sẵn`;

  return (
    <div
      ref={rootRef}
      className={`cv-jd-combobox${isOpen ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        className="cv-jd-combobox-trigger"
        role="combobox"
        aria-label="Chọn JD mục tiêu ứng tuyển"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="cv-jd-combobox-list"
        aria-activedescendant={
          isOpen && filteredItems[activeIndex]
            ? `cv-jd-option-${filteredItems[activeIndex].id}`
            : undefined
        }
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
      >
        <span className="cv-jd-combobox-leading" aria-hidden="true">
          <BriefcaseBusiness size={17} />
        </span>
        <span className="cv-jd-combobox-value">
          <strong>{selectedItem?.title || placeholder}</strong>
          {selectedItem?.company && <small>{selectedItem.company}</small>}
        </span>
        <ChevronDown className="cv-jd-combobox-chevron" size={18} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="cv-jd-combobox-menu">
          <div className="cv-jd-combobox-search">
            <Search size={17} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              placeholder="Tìm vị trí hoặc công ty..."
              aria-label="Tìm kiếm JD"
              autoComplete="off"
            />
            <span>
              {filteredItems.length}/{items.length}
            </span>
          </div>
          <div
            id="cv-jd-combobox-list"
            className="cv-jd-combobox-list"
            role="listbox"
            aria-label="Danh sách JD"
          >
            {filteredItems.length === 0 ? (
              <div className="cv-jd-combobox-empty" role="status">
                <Search size={22} aria-hidden="true" />
                <strong>Không tìm thấy JD</strong>
                <span>Thử tên vị trí, kỹ năng hoặc công ty khác.</span>
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const isSelected = item.id === value;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    id={`cv-jd-option-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`cv-jd-combobox-option${isSelected ? ' is-selected' : ''}${isActive ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectItem(item)}
                  >
                    <span className="cv-jd-combobox-option-icon" aria-hidden="true">
                      <BriefcaseBusiness size={16} />
                    </span>
                    <span className="cv-jd-combobox-option-copy">
                      <strong>{item.title}</strong>
                      <small>{item.company || 'Chưa cập nhật công ty'}</small>
                    </span>
                    {isSelected && (
                      <Check className="cv-jd-combobox-check" size={17} aria-hidden="true" />
                    )}
                  </button>
                );
              })
            )}
          </div>
          <div className="cv-jd-combobox-hint">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> Di chuyển
            </span>
            <span>
              <kbd>Enter</kbd> Chọn
            </span>
            <span>
              <kbd>Esc</kbd> Đóng
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function statusLabel(status: CVVariant['status']): string {
  return {
    DRAFT: 'Bản nháp',
    DRAFT_BLOCKED: 'Chưa đạt chuẩn ATS',
    VALIDATED: 'Đã kiểm định ATS',
    PUBLISHED: 'Đã kiểm định ATS',
  }[status];
}

export default function CVVariantWizard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mode, setMode] = useState<VariantMode>('HAS_CV');
  const [cvs, setCvs] = useState<CVSummary[]>([]);
  const [jds, setJds] = useState<JDSummary[]>([]);
  const [variants, setVariants] = useState<CVVariant[]>([]);
  const [cvId, setCvId] = useState('');
  const [jdId, setJdId] = useState('');
  const [showPasteJdModal, setShowPasteJdModal] = useState(false);
  const [customJdTitle, setCustomJdTitle] = useState('');
  const [customJdCompany, setCustomJdCompany] = useState('');
  const [customJdText, setCustomJdText] = useState('');
  const [savingCustomJd, setSavingCustomJd] = useState(false);
  const [title, setTitle] = useState('CV tối ưu theo JD');
  const [template, setTemplate] = useState<
    'classic' | 'modern' | 'compact' | 'creative' | 'elegant'
  >('classic');
  const [rawFullName, setRawFullName] = useState('');
  const [rawEmail, setRawEmail] = useState('');
  const [rawSummary, setRawSummary] = useState('');
  const [rawSkills, setRawSkills] = useState('');
  const [rawExperience, setRawExperience] = useState('');
  const [rawProjects, setRawProjects] = useState('');
  const [rawEducation, setRawEducation] = useState('');

  const insertBullet = (currentValue: string, setter: (val: string) => void) => {
    const trimmed = currentValue.trimEnd();
    const nextVal = trimmed ? `${trimmed}\n• ` : '• ';
    setter(nextVal);
  };

  const handleBulletKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    currentValue: string,
    setter: (val: string) => void,
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const target = e.currentTarget;
      const cursor = target.selectionStart;
      const textBefore = currentValue.substring(0, cursor);
      const textAfter = currentValue.substring(cursor);
      const lines = textBefore.split('\n');
      const currentLine = lines[lines.length - 1];

      if (currentLine.trim().startsWith('•') || currentLine.trim().startsWith('-')) {
        e.preventDefault();
        if (currentLine.trim() === '•' || currentLine.trim() === '-') {
          const newBefore = lines.slice(0, -1).join('\n') + (lines.length > 1 ? '\n' : '');
          setter(newBefore + textAfter);
          return;
        }
        const newText = `${textBefore}\n• ${textAfter}`;
        setter(newText);
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = cursor + 3;
        }, 0);
      }
    }
  };

  const [content, setContent] = useState<VariantContent>(emptyContent);
  const [active, setActive] = useState<CVVariant | null>(null);
  const [validation, setValidation] = useState<VariantValidation | null>(null);
  const [sourceConfirmed, setSourceConfirmed] = useState(false);
  const [confirmedClaim, setConfirmedClaim] = useState('');
  const [confirmClaimChecked, setConfirmClaimChecked] = useState(false);
  const [suggestionEdits, setSuggestionEdits] = useState<Record<string, string>>({});
  const [editorTab, setEditorTab] = useState<'ai' | 'manual'>('ai');
  const [isCreateExpanded, setIsCreateExpanded] = useState(false);
  const [isValidationExpanded, setIsValidationExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const autosaveGeneration = useRef(0);
  const studentValidators = useMemo(() => {
    const shown = new Set<string>();
    return (validation?.validators || []).map((validator) => {
      const issues = studentIssues(validator.name, validator.errors).filter((issue) => {
        const key = `${issue.section}|${issue.reason}`;
        if (shown.has(key)) return false;
        shown.add(key);
        return true;
      });
      return { ...validator, issues };
    }).filter((validator) => validator.passed || validator.issues.length > 0);
  }, [validation]);
  const validationValidators = validation?.validators || [];
  const hasValidationFailures = validationValidators.some((validator) => !validator.passed);
  const showValidationDetails = hasValidationFailures || isValidationExpanded;
  const activeId = active?.id;
  const selectedCvTitle = cvs.find((cv) => cv.id === cvId)?.title || 'Chưa chọn CV nguồn';
  const selectedJdTitle = jds.find((jd) => jd.id === jdId)?.title || 'Chưa chọn JD mục tiêu';

  useEffect(() => {
    if (activeId) setIsCreateExpanded(false);
  }, [activeId]);

  useEffect(() => {
    if (active && !dirty && !validation) {
      void cvVariantsApi
        .validate(active.id)
        .then((report) => {
          setValidation(report);
        })
        .catch(() => {});
    }
  }, [active, dirty, validation]);

  const load = useCallback(async () => {
    const token =
      typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null;
    if (!token && !isAuthenticated) return;
    setBusy('load');
    setError('');
    try {
      // CV/JD là điều kiện cần để tạo bản tối ưu; lịch sử variant chỉ là phần bổ trợ.
      // Không để một bản revision cũ bị lỗi trên server khóa toàn bộ luồng tạo CV mới.
      const options = await cvVariantsApi.prerequisites();

      // Tự động lọc trùng (Deduplicate) CV theo tên/tiêu đề
      const uniqueCvs: CVSummary[] = [];
      const seenCvTitles = new Set<string>();
      for (const cv of options.cvs || []) {
        const normTitle = (cv.title || '').trim().toLowerCase();
        if (normTitle && !seenCvTitles.has(normTitle)) {
          seenCvTitles.add(normTitle);
          uniqueCvs.push(cv);
        }
      }

      // Tự động lọc trùng (Deduplicate) JD theo tên vị trí + công ty
      const uniqueJds: JDSummary[] = [];
      const seenJdKeys = new Set<string>();
      for (const jd of options.jds || []) {
        const normTitle = (jd.title || '').trim().toLowerCase();
        const normCompany = (jd.company || '').trim().toLowerCase();
        const key = `${normTitle}___${normCompany}`;
        if (normTitle && !seenJdKeys.has(key)) {
          seenJdKeys.add(key);
          uniqueJds.push(jd);
        }
      }

      setCvs(uniqueCvs);
      setJds(uniqueJds);

      const preferredJd =
        (typeof window !== 'undefined' &&
          (window.localStorage.getItem('latest_matched_jd_id') ||
            window.sessionStorage.getItem('career-preselected-jd-id'))) ||
        '';

      setCvId((current) =>
        uniqueCvs.some((c) => c.id === current) ? current : uniqueCvs[0]?.id || '',
      );
      setJdId((current) => {
        if (current && uniqueJds.some((j) => j.id === current)) return current;
        if (preferredJd && uniqueJds.some((j) => j.id === preferredJd)) return preferredJd;
        return uniqueJds[0]?.id || '';
      });
      try {
        const history = await cvVariantsApi.list();
        setVariants(history.items);
      } catch (historyError) {
        setVariants([]);
        setMessage(
          'Chưa tải được lịch sử revision cũ. Bạn vẫn có thể tạo và tối ưu CV mới bình thường.',
        );
        console.warn('Không tải được lịch sử CV variant:', historyError);
      }
      const win =
        typeof window !== 'undefined'
          ? (window as unknown as { loadSpaceshipCVList?: () => void })
          : null;
      if (win?.loadSpaceshipCVList) {
        void win.loadSpaceshipCVList();
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu CV Variant.',
      );
    } finally {
      setBusy('');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const checkAuth = () => {
      const token =
        typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null;
      const apiAuth = (
        window as unknown as { ApiClient?: { isAuthenticated?: () => boolean } }
      )?.ApiClient?.isAuthenticated?.();
      const isAuth = Boolean(token || apiAuth);
      setIsAuthenticated(isAuth);
      return isAuth;
    };

    checkAuth();

    const handleAuthChanged = (e: Event | CustomEvent<{ user?: unknown }>) => {
      const customEvent = e as CustomEvent<{ user?: unknown }>;
      const user = customEvent?.detail?.user;
      const token =
        typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null;
      if (user || token) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setCvs([]);
        setJds([]);
        setVariants([]);
        setActive(null);
        setError('');
      }
    };

    const handleSessionCleared = () =>
      handleAuthChanged(new CustomEvent('auth:cleared', { detail: { user: null } }));

    document.addEventListener('auth:changed', handleAuthChanged);
    window.addEventListener('career:session-ready', checkAuth);
    window.addEventListener('career:session-cleared', handleSessionCleared);
    return () => {
      document.removeEventListener('auth:changed', handleAuthChanged);
      window.removeEventListener('career:session-ready', checkAuth);
      window.removeEventListener('career:session-cleared', handleSessionCleared);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  useEffect(() => {
    if (!active || !dirty || active.status === 'PUBLISHED') return;
    const generation = ++autosaveGeneration.current;
    const timeout = window.setTimeout(async () => {
      setBusy('autosave');
      try {
        const confirmations =
          confirmClaimChecked && confirmedClaim.trim() ? [confirmedClaim.trim()] : [];
        const saved = await cvVariantsApi.autosave(active.id, content, confirmations);
        if (generation === autosaveGeneration.current) {
          setActive(saved);
          setValidation(null);
          setDirty(false);
          setMessage(`Đã tự động lưu phiên bản ${saved.revision_no}.`);
          if (confirmations.length) {
            setConfirmedClaim('');
            setConfirmClaimChecked(false);
          }
        }
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Autosave thất bại.');
      } finally {
        setBusy('');
      }
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [active, confirmClaimChecked, confirmedClaim, content, dirty]);

  const suggestions = useMemo(() => content._suggestions || [], [content]);
  const canCreate = Boolean(
    jdId &&
      (mode === 'HAS_CV'
        ? cvId
        : sourceConfirmed &&
          (rawFullName.trim() || content.personal_info.full_name) &&
          (rawSkills.trim() || content.skills.length > 0)),
  );

  const updateContent = (update: (previous: VariantContent) => VariantContent) => {
    setContent(update);
    setDirty(true);
    setMessage('Đang chờ autosave…');
  };

  const handleSaveCustomJd = async () => {
    if (!customJdTitle.trim() || !customJdText.trim()) {
      setError('Vui lòng nhập tên vị trí và nội dung mô tả công việc (JD).');
      return;
    }
    setSavingCustomJd(true);
    setError('');
    try {
      const formattedTitle = customJdCompany.trim()
        ? `${customJdTitle.trim()} — ${customJdCompany.trim()}`
        : customJdTitle.trim();
      const createdJd = await cvVariantsApi.createCustomJd({
        title: formattedTitle,
        company: customJdCompany.trim(),
        requirements_text: customJdText.trim(),
      });
      setJds((prev) => [createdJd, ...prev.filter((item) => item.id !== createdJd.id)]);
      setJdId(createdJd.id);
      setShowPasteJdModal(false);
      setCustomJdTitle('');
      setCustomJdCompany('');
      setCustomJdText('');

      const selectedCv = cvs.find((c) => c.id === cvId);
      const cleanCv = selectedCv
        ? selectedCv.title.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
        : 'CV';
      const cleanJd = customJdTitle.trim();
      setTitle(`CV ${cleanCv} tối ưu theo ${cleanJd}`);
      setMessage(`Đã lưu JD "${createdJd.title}" vào tài khoản và chọn cho phiên tối ưu.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu JD mới.');
    } finally {
      setSavingCustomJd(false);
    }
  };

  const create = async () => {
    if (!canCreate) return;
    setBusy('create');
    setError('');
    try {
      const parseSkillsList = (text: string) => {
        if (!text) return [];
        return text
          .split(/[,;\n|•]/)
          .map((s) => s.trim())
          .filter(Boolean);
      };

      const parseRecordList = (text: string) => {
        if (!text) return [];
        const lines = text
          .split(/\n+|•+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (lines.length > 0) {
          return lines.map((line) => ({ description: line }));
        }
        return [{ description: text.trim() }];
      };

      const payloadContent =
        mode === 'NO_CV'
          ? {
              personal_info: {
                full_name: rawFullName.trim() || content.personal_info.full_name || '',
                email: rawEmail.trim() || content.personal_info.email || '',
                phone: content.personal_info.phone || '',
              },
              summary: rawSummary.trim() || content.summary || '',
              skills: rawSkills ? parseSkillsList(rawSkills) : content.skills,
              experience: rawExperience ? parseRecordList(rawExperience) : content.experience,
              projects: rawProjects ? parseRecordList(rawProjects) : content.projects,
              education: rawEducation ? parseRecordList(rawEducation) : content.education,
              template_name: template,
            }
          : null;

      const variant = await cvVariantsApi.create(
        {
          mode,
          cv_id: mode === 'HAS_CV' ? cvId : null,
          jd_id: jdId,
          template_name: template,
          title,
          content: payloadContent,
          candidate_evidence_confirmed: mode === 'NO_CV' ? sourceConfirmed : false,
          language: 'vi',
          optimization_mode: 'balanced',
        },
        crypto.randomUUID(),
      );
      setActive(variant);
      setContent(variant.content);
      setValidation(variant.validator_result);
      setDirty(false);
      setSuggestionEdits(
        Object.fromEntries(
          (variant.content._suggestions || []).map((item) => [item.id, item.proposed]),
        ),
      );
      setVariants((items) => [variant, ...items.filter((item) => item.id !== variant.id)]);
      setMessage('Đã khởi tạo bản CV tối ưu; hồ sơ gốc được bảo toàn 100%.');
      const win =
        typeof window !== 'undefined'
          ? (window as unknown as { loadSpaceshipCVList?: () => void })
          : null;
      if (win?.loadSpaceshipCVList) {
        void win.loadSpaceshipCVList();
      }
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : 'Không tạo được bản CV tối ưu.',
      );
    } finally {
      setBusy('');
    }
  };

  const openVariant = async (id: string) => {
    setBusy('open');
    setError('');
    try {
      const variant = await cvVariantsApi.get(id);
      setActive(variant);
      setContent(variant.content);
      if (variant.content?.template_name) {
        setTemplate(variant.content.template_name as typeof template);
      } else if (variant.template?.name) {
        setTemplate(variant.template.name as typeof template);
      }
      setValidation(variant.validator_result);
      setSuggestionEdits(
        Object.fromEntries(
          (variant.content._suggestions || []).map((item) => [
            item.id,
            item.final_text || item.proposed,
          ]),
        ),
      );
      setDirty(false);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Không mở được variant.');
    } finally {
      setBusy('');
    }
  };

  const decide = async (suggestion: VariantSuggestion, decision: 'accept' | 'reject' | 'edit') => {
    if (!active) return;
    setBusy(`suggestion-${suggestion.id}`);
    setError('');
    try {
      const text = suggestionEdits[suggestion.id] || suggestion.proposed;
      const resolvedDecision =
        decision === 'accept' && text !== suggestion.proposed ? 'edit' : decision;
      const variant = await cvVariantsApi.decide(active.id, suggestion.id, resolvedDecision, text);
      setActive(variant);
      setContent(variant.content);
      setValidation(null);
      setDirty(false);
      setMessage(
        `Đã ${resolvedDecision === 'reject' ? 'từ chối' : 'áp dụng'} đề xuất và lưu revision ${variant.revision_no}.`,
      );
    } catch (decisionError) {
      setError(
        decisionError instanceof Error ? decisionError.message : 'Không lưu được quyết định.',
      );
    } finally {
      setBusy('');
    }
  };

  const applyAllSuggestions = async () => {
    if (!active || !suggestions.length) return;
    setBusy('apply-all');
    setError('');
    try {
      let currentVariant = active;
      for (const suggestion of suggestions) {
        if (suggestion.decision !== 'accept') {
          const text = suggestionEdits[suggestion.id] || suggestion.proposed;
          currentVariant = await cvVariantsApi.decide(
            currentVariant.id,
            suggestion.id,
            'accept',
            text,
          );
        }
      }
      setActive(currentVariant);
      setContent(currentVariant.content);
      setValidation(null);
      setDirty(false);
      setMessage('Đã áp dụng tất cả đề xuất tối ưu.');
    } catch (applyError) {
      setError(
        applyError instanceof Error ? applyError.message : 'Không thể áp dụng tất cả đề xuất.',
      );
    } finally {
      setBusy('');
    }
  };

  const handlePreviewAndDownload = async (download = false) => {
    if (!active) return;
    // Open synchronously while this click still has user-gesture permission.
    // Opening only after the async validation/export requests causes browsers
    // to treat the preview as an unsolicited popup and block it.
    const previewWindow = window.open('', '_blank');
    if (previewWindow) previewWindow.opener = null;
    setBusy(download ? 'download' : 'preview');
    setError('');
    try {
      // Preview/export must be generated from the same saved revision the user
      // is looking at.  Previously a pending autosave could validate/export an
      // older revision and make the button appear to do nothing.
      let currentVariant = active;
      let currentReport = dirty ? null : validation;
      if (dirty) {
        currentVariant = await cvVariantsApi.autosave(
          active.id,
          content,
          content._confirmed_claims || [],
        );
        setActive(currentVariant);
        setContent(currentVariant.content);
        setValidation(null);
        setDirty(false);
      }
      if (!currentReport || !currentReport.passed) {
        currentReport = await cvVariantsApi.validate(currentVariant.id);
        setValidation(currentReport);
      }
      if (currentReport?.passed && download) {
        if (currentVariant.status !== 'PUBLISHED') {
          await cvVariantsApi.publish(currentVariant.id);
          const refreshed = await cvVariantsApi.get(currentVariant.id);
          currentVariant = refreshed;
          setActive(refreshed);
          setVariants((items) => [refreshed, ...items.filter((item) => item.id !== refreshed.id)]);
        }
      } else if (!currentReport?.passed && download) {
        const failedCount = currentReport?.validators.filter((v) => !v.passed).length || 1;
        setError(
          `⚠️ Bản CV có ${failedCount} tiêu chí kiểm định chưa đạt. Vui lòng xem chi tiết các mục vi phạm màu đỏ bên dưới.`,
        );
        previewWindow?.close();
        return;
      }
      // Fetch the published immutable asset rather than asking the server to
      // re-render a preview. This makes preview and download byte-identical.
      const blob = await cvVariantsApi.pdf(currentVariant.id, !download);
      const url = URL.createObjectURL(blob);
      if (previewWindow) {
        previewWindow.location.replace(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      if (download) {
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `cv-${active.id}.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (pdfError) {
      previewWindow?.close();
      setError(pdfError instanceof Error ? pdfError.message : 'Không mở được PDF.');
    } finally {
      setBusy('');
    }
  };

  const handleCvChange = (newCvId: string) => {
    setCvId(newCvId);
    const selectedCv = cvs.find((c) => c.id === newCvId);
    const selectedJd = jds.find((j) => j.id === jdId);
    if (selectedCv && selectedJd) {
      const cleanCv = selectedCv.title.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      const cleanJd = selectedJd.title.split('—')[0].trim();
      setTitle(`CV ${cleanCv} tối ưu theo ${cleanJd}`);
    }
  };

  const handleJdChange = (newJdId: string) => {
    setJdId(newJdId);
    const selectedCv = cvs.find((c) => c.id === cvId);
    const selectedJd = jds.find((j) => j.id === newJdId);
    if (selectedCv && selectedJd) {
      const cleanCv = selectedCv.title.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      const cleanJd = selectedJd.title.split('—')[0].trim();
      setTitle(`CV ${cleanCv} tối ưu theo ${cleanJd}`);
    }
  };

  const handleSelectTemplate = (selectedTemplate: typeof template) => {
    setTemplate(selectedTemplate);
    if (active) {
      updateContent((prev) => ({
        ...prev,
        template_name: selectedTemplate,
      }));
    }
  };

  return (
    <section className="cv-variant-wizard" aria-labelledby="cv-variant-title">
      <header className="cv-variant-wizard-head">
        <div>
          <p>TỐI ƯU HỒ SƠ ỨNG TUYỂN</p>
          <h3 id="cv-variant-title">Tạo và tối ưu CV theo JD</h3>
          <span>
            Hồ sơ gốc luôn được bảo toàn 100%. Hệ thống tự động kiểm định 7 tiêu chuẩn ATS để đảm
            bảo CV trung thực và tối ưu nhất.
          </span>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={!isAuthenticated || Boolean(busy)}
        >
          <History size={16} /> Làm mới
        </button>
      </header>

      {error && (
        <div className="cv-variant-alert error" role="alert">
          <ShieldAlert size={17} /> {error}
        </div>
      )}
      {message && (
        <div className="cv-variant-alert success" aria-live="polite">
          <CheckCircle2 size={17} /> {message}
        </div>
      )}

      {active && !isCreateExpanded ? (
        <div className="cv-variant-create-summary">
          <div className="cv-variant-create-summary-copy">
            <span>CV: <strong>{mode === 'NO_CV' ? 'CV mới từ đầu' : selectedCvTitle}</strong></span>
            <span aria-hidden="true">→</span>
            <span>JD: <strong>{selectedJdTitle}</strong></span>
          </div>
          <button
            type="button"
            className="cv-variant-disclosure-btn"
            onClick={() => setIsCreateExpanded(true)}
            aria-expanded="false"
          >
            Đổi lựa chọn <ChevronDown size={16} />
          </button>
        </div>
      ) : (
        <>
      <div className="cv-variant-mode" role="group" aria-label="Chọn cách tạo CV">
        <button
          type="button"
          className={mode === 'HAS_CV' ? 'active' : ''}
          onClick={() => setMode('HAS_CV')}
        >
          Đã có CV trên hệ thống
        </button>
        <button
          type="button"
          className={mode === 'NO_CV' ? 'active' : ''}
          onClick={() => setMode('NO_CV')}
        >
          Tạo CV mới từ đầu
        </button>
      </div>

      {!isAuthenticated && mode === 'HAS_CV' && (
        <div className="cv-variant-login-notice">
          <div className="cv-variant-login-notice-text">
            <strong>Bạn chưa đăng nhập:</strong> Vui lòng đăng nhập tài khoản để chọn CV và JD đã
            lưu, hoặc chuyển sang chế độ <strong>&quot;Tạo CV mới từ đầu&quot;</strong> để tự tạo CV
            mới.
          </div>
          <button
            type="button"
            className="cv-variant-login-btn"
            onClick={() => {
              const btn =
                document.getElementById('header-login-btn') ||
                (document.querySelector('.header-login-btn') as HTMLElement);
              btn?.click();
            }}
          >
            <LogIn size={15} /> Đăng nhập ngay
          </button>
        </div>
      )}

      <div className="cv-variant-create-grid">
        {mode === 'HAS_CV' && (
          <div className="cv-variant-field-group">
            <div className="cv-variant-label-row">
              <span className="cv-variant-label-text">CV nguồn</span>
            </div>
            <select
              value={cvId}
              onChange={(event) => handleCvChange(event.target.value)}
              disabled={!isAuthenticated || cvs.length === 0}
            >
              {!isAuthenticated ? (
                <option value="">Đăng nhập để xem danh sách CV đã lưu</option>
              ) : cvs.length === 0 ? (
                <option value="">
                  Chưa có CV nào (Tải lên CV ở trên hoặc chọn &apos;Tạo CV mới từ đầu&apos;)
                </option>
              ) : (
                <>
                  <option value="">-- Chọn CV nguồn ({cvs.length} CV có sẵn) --</option>
                  {cvs.map((cv) => (
                    <option key={cv.id} value={cv.id}>
                      {cv.title}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        )}

        <div className="cv-variant-field-group">
          <div className="cv-variant-label-row">
            <span className="cv-variant-label-text">JD mục tiêu ứng tuyển</span>
          </div>
          <SearchableJdSelect
            items={jds}
            value={jdId}
            onChange={handleJdChange}
            disabled={!isAuthenticated || jds.length === 0}
          />
        </div>

        <div className="cv-variant-field-group">
          <div className="cv-variant-label-row">
            <span className="cv-variant-label-text">Tên bản CV tối ưu</span>
          </div>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

      </div>

      <div className="cv-variant-template-picker cv-variant-template-strip">
        <label className="cv-variant-template-picker-label">
          <span>Chọn mẫu CV trực quan</span>
          <span style={{ fontSize: '0.8rem', color: '#0d9488', fontWeight: 600 }}>
            {CV_TEMPLATES.find((t) => t.id === template)?.name} ·{' '}
            {CV_TEMPLATES.find((t) => t.id === template)?.badge}
          </span>
        </label>
        <div
          className="cv-variant-template-grid"
          role="radiogroup"
          aria-label="Chọn mẫu thiết kế CV"
        >
          {CV_TEMPLATES.map((tmpl) => {
            const isSelected = template === tmpl.id;
            return (
              <div
                key={tmpl.id}
                className={`cv-variant-template-option${isSelected ? ' is-active' : ''}`}
                onClick={() => handleSelectTemplate(tmpl.id as typeof template)}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectTemplate(tmpl.id as typeof template);
                  }
                }}
              >
                {isSelected && (
                  <div className="active-indicator" title="Mẫu đang chọn">
                    ✓
                  </div>
                )}
                <div className="cv-variant-mini-sheet">
                  <MiniCVSheet templateId={tmpl.id} />
                </div>
                <div className="cv-variant-template-title">{tmpl.name}</div>
                <span className="cv-variant-template-badge">{tmpl.badge}</span>
              </div>
            );
          })}
        </div>
      </div>

      {mode === 'NO_CV' && (
        <div className="cv-variant-guided-form">
          <div className="cv-variant-guided-form-head">
            <h4>Nhập thông tin hồ sơ của bạn</h4>
            <p>
              Điền các thông tin thực tế từ quá trình học tập và làm việc. Hệ thống sẽ tự động
              chuyển đổi thành hồ sơ chuẩn ATS.
            </p>
          </div>
          <div className="cv-variant-field-group">
            <div className="cv-variant-label-row">
              <span className="cv-variant-label-text">Họ và tên *</span>
            </div>
            <input
              placeholder="Nguyễn Văn A"
              value={rawFullName}
              onChange={(event) => setRawFullName(event.target.value)}
            />
          </div>
          <div className="cv-variant-field-group">
            <div className="cv-variant-label-row">
              <span className="cv-variant-label-text">Email liên hệ *</span>
            </div>
            <input
              type="email"
              placeholder="nguyenvana@gmail.com"
              value={rawEmail}
              onChange={(event) => setRawEmail(event.target.value)}
            />
          </div>
          <div className="cv-variant-field-group wide">
            <div className="cv-variant-label-row">
              <span className="cv-variant-label-text">Tóm tắt bản thân</span>
            </div>
            <textarea
              placeholder="Giới thiệu ngắn 2-3 câu về định hướng nghề nghiệp và thế mạnh của bạn..."
              value={rawSummary}
              onChange={(event) => setRawSummary(event.target.value)}
              rows={2}
            />
          </div>
          <div className="cv-variant-field-group wide">
            <div className="cv-variant-label-row">
              <span className="cv-variant-label-text">Kỹ năng chuyên môn *</span>
            </div>
            <input
              placeholder="Python, SQL, Machine Learning, Docker, Git, React..."
              value={rawSkills}
              onChange={(event) => setRawSkills(event.target.value)}
            />
          </div>
          <div className="cv-variant-field-group">
            <div className="cv-variant-label-row">
              <span className="cv-variant-label-text">Kinh nghiệm làm việc</span>
              <button
                type="button"
                className="cv-variant-insert-bullet-btn"
                onClick={() => insertBullet(rawExperience, setRawExperience)}
                title="Chèn dấu gạch đầu dòng •"
              >
                + Thêm gạch đầu dòng (•)
              </button>
            </div>
            <textarea
              placeholder="Vị trí, công ty, thời gian và các nhiệm vụ hoặc thành tựu chính..."
              value={rawExperience}
              onChange={(event) => setRawExperience(event.target.value)}
              onKeyDown={(event) => handleBulletKeyDown(event, rawExperience, setRawExperience)}
              rows={4}
            />
          </div>
          <div className="cv-variant-field-group">
            <div className="cv-variant-label-row">
              <span className="cv-variant-label-text">Dự án tiêu biểu</span>
              <button
                type="button"
                className="cv-variant-insert-bullet-btn"
                onClick={() => insertBullet(rawProjects, setRawProjects)}
                title="Chèn dấu gạch đầu dòng •"
              >
                + Thêm gạch đầu dòng (•)
              </button>
            </div>
            <textarea
              placeholder="Tên dự án, công nghệ sử dụng và kết quả hoặc đóng góp nổi bật..."
              value={rawProjects}
              onChange={(event) => setRawProjects(event.target.value)}
              onKeyDown={(event) => handleBulletKeyDown(event, rawProjects, setRawProjects)}
              rows={4}
            />
          </div>
          <div className="cv-variant-field-group wide">
            <div className="cv-variant-label-row">
              <span className="cv-variant-label-text">Học vấn & Bằng cấp *</span>
              <button
                type="button"
                className="cv-variant-insert-bullet-btn"
                onClick={() => insertBullet(rawEducation, setRawEducation)}
                title="Chèn dấu gạch đầu dòng •"
              >
                + Thêm gạch đầu dòng (•)
              </button>
            </div>
            <textarea
              placeholder="Trường đại học/cao đẳng, chuyên ngành, bằng cấp hoặc chứng chỉ..."
              value={rawEducation}
              onChange={(event) => setRawEducation(event.target.value)}
              onKeyDown={(event) => handleBulletKeyDown(event, rawEducation, setRawEducation)}
              rows={3}
            />
          </div>
          <label className="cv-variant-confirm wide">
            <input
              type="checkbox"
              checked={sourceConfirmed}
              onChange={(event) => setSourceConfirmed(event.target.checked)}
            />{' '}
            Tôi cam kết toàn bộ thông tin trên là trung thực và chính xác theo trải nghiệm thực tế
            của tôi.
          </label>
        </div>
      )}

      <div className="cv-variant-create-action-container">
        <button
          className="cv-variant-create-btn"
          type="button"
          disabled={!canCreate || Boolean(busy)}
          onClick={() => void create()}
        >
          {busy === 'create' ? 'Đang phân tích & tối ưu CV…' : 'Khởi tạo và tối ưu CV theo JD'}
        </button>
      </div>
        </>
      )}

      {active && (
        <div className="cv-variant-editor">
          {/* Header Status & Clean Metric Summary */}
          <div className="cv-variant-editor-head">
            <div className="cv-variant-status-row">
              <div>
                <strong>{active.title}</strong>
                <span className={`status-${active.status.toLowerCase()}`}>
                  {statusLabel(active.status)}
                </span>
              </div>
              <small>
                Phiên bản {active.revision_no} ·{' '}
                {busy === 'autosave' ? 'Đang tự động lưu…' : dirty ? 'Chưa lưu' : 'Đã lưu'}
              </small>
            </div>

            <div className="cv-variant-score-summary">
              <div className="cv-variant-score-box">
                <span className="cv-variant-score-label">Mức độ bao phủ từ khóa JD</span>
                <strong className="cv-variant-score-val after">
                  {content._match_scores?.after_preview ?? 85}%
                </strong>
              </div>
              <div className="cv-variant-score-box">
                <span className="cv-variant-score-label">Đề xuất tối ưu từ AI</span>
                <strong className="cv-variant-score-val after">
                  {suggestions.filter((s) => s.decision === 'accept').length} / {suggestions.length}{' '}
                  đã duyệt
                </strong>
              </div>
              <div
                className="cv-variant-trust-pill"
                title="Hệ thống chỉ tối ưu từ ngữ và bám sát sự thật, tuyệt đối không bịa đặt kinh nghiệm/kỹ năng"
              >
                <ShieldCheck size={16} /> {validation ? `${validation.claims_supported}/${validation.claims_total} claims verified · ${validation.verification_status}` : 'Chưa kiểm định nguồn'}
              </div>
            </div>
          </div>

          <div className="cv-variant-split">
            <div className="cv-variant-split-left">
              <div className="cv-variant-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={editorTab === 'ai'}
                  onClick={() => setEditorTab('ai')}
                >
                  Đề xuất AI {suggestions.length ? `(${suggestions.length})` : ''}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={editorTab === 'manual'}
                  onClick={() => setEditorTab('manual')}
                >
                  Chỉnh sửa thủ công
                </button>
              </div>

              {editorTab === 'ai' && (
          <section className="cv-variant-suggestions-section">
            <div className="cv-variant-section-head">
              <div>
                <h4>Đề xuất tối ưu từ AI</h4>
                <p className="cv-variant-section-desc">
                  Các câu gợi ý viết lại bám sát yêu cầu JD mà vẫn giữ 100% sự thật từ kinh nghiệm
                  của bạn.
                </p>
              </div>
              {suggestions.length > 0 && active.status !== 'PUBLISHED' && (
                <button
                  type="button"
                  className="cv-variant-apply-all-btn"
                  onClick={() => void applyAllSuggestions()}
                  disabled={Boolean(busy)}
                >
                  <Check size={15} /> Áp dụng tất cả gợi ý ({suggestions.length})
                </button>
              )}
            </div>

            {suggestions.length ? (
              <div className="cv-variant-suggestions">
                {suggestions.map((suggestion) => (
                  <article key={suggestion.id} className="cv-variant-suggestion-card">
                    <header>
                      <span className="cv-variant-suggestion-section">
                        {suggestion.section ? suggestion.section.toUpperCase() : 'NỘI DUNG CV'}
                      </span>
                      {suggestion.decision === 'accept' && (
                        <span className="cv-variant-suggestion-badge accepted">✓ Đã áp dụng</span>
                      )}
                      {suggestion.decision === 'reject' && (
                        <span className="cv-variant-suggestion-badge rejected">✕ Đã bỏ qua</span>
                      )}
                    </header>
                    <div className="cv-variant-diff">
                      <div className="cv-variant-diff-original">
                        <b>Câu gốc trong CV</b>
                        <p>{suggestion.original}</p>
                      </div>
                      <div className="cv-variant-diff-proposed">
                        <b>Đề xuất tối ưu theo JD</b>
                        <textarea
                          disabled={active.status === 'PUBLISHED' || suggestion.is_actionable === false}
                          value={
                            suggestionEdits[suggestion.id] ??
                            suggestion.final_text ??
                            suggestion.proposed
                          }
                          onChange={(event) =>
                            setSuggestionEdits((items) => ({
                              ...items,
                              [suggestion.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="cv-variant-suggestion-meta">
                      <p>
                        <b>Lý do tối ưu:</b> {suggestion.reason}
                      </p>
                      {suggestion.source_spans?.length ? (
                        <p className="cv-variant-evidence-tag">
                          <b>Nguồn dẫn chứng:</b>{' '}
                          {suggestion.source_spans.map((span) => span.text).join(' · ')}
                        </p>
                      ) : null}
                    </div>
                    {active.status !== 'PUBLISHED' && suggestion.is_actionable !== false && (
                      <div className="cv-variant-suggestion-actions">
                        <button
                          type="button"
                          className={`btn-accept ${suggestion.decision === 'accept' ? 'is-active' : ''}`}
                          disabled={Boolean(busy)}
                          onClick={() => void decide(suggestion, 'accept')}
                        >
                          <CheckCircle2 size={15} /> Chấp nhận
                        </button>
                        <button
                          type="button"
                          className={`btn-reject ${suggestion.decision === 'reject' ? 'is-active' : ''}`}
                          disabled={Boolean(busy)}
                          onClick={() => void decide(suggestion, 'reject')}
                          title="Từ chối / Bỏ qua đề xuất"
                        >
                          <XCircle size={15} /> Bỏ qua
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="cv-variant-empty-suggestions">
                <p>Nội dung CV hiện tại đã có cấu trúc tốt hoặc chưa phát hiện câu cần rewrite.</p>
              </div>
            )}

            {/* Gap Analysis & Project Blueprint Card */}
            {active.content?._gap_analysis && (
              <section className="cv-variant-gap-card">
                <div className="cv-variant-gap-head">
                  <span className="cv-variant-gap-tag">💡 GỢI Ý NÂNG CAO NĂNG LỰC</span>
                  <h4>Khoảng trống kỹ năng & Gợi ý Dự án thực chiến</h4>
                  <p className="cv-variant-section-desc">
                    Dựa trên các kỹ năng trọng tâm của JD mà CV chưa thể hiện, AI gợi ý đề tài dự án
                    thực tế để bạn tham khảo phát triển chuyên môn:
                  </p>
                </div>

                {active.content._gap_analysis.missing_skills?.length > 0 && (
                  <div className="cv-variant-gap-skills">
                    <strong>Kỹ năng còn thiếu theo JD:</strong>
                    <div className="cv-variant-tag-list">
                      {active.content._gap_analysis.missing_skills.map((skill) => (
                        <span key={skill} className="cv-variant-missing-tag">
                          + {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {active.content._gap_analysis.blueprint && (
                  <div className="cv-variant-blueprint-card">
                    <div className="cv-variant-blueprint-title">
                      🎯 Dự án gợi ý:{' '}
                      <strong>{active.content._gap_analysis.blueprint.title}</strong>
                    </div>
                    <p className="cv-variant-blueprint-desc">
                      {active.content._gap_analysis.blueprint.description}
                    </p>
                    <div className="cv-variant-blueprint-bullet">
                      <strong>Chỉ thêm vào CV sau khi bạn hoàn thành và xác nhận thông tin là chính xác:</strong>
                      <p>{active.content._gap_analysis.blueprint.draft_bullet}</p>
                    </div>
                  </div>
                )}
              </section>
            )}
          </section>
              )}

              {editorTab === 'manual' && (
            <div className="cv-variant-manual-editor-card">
              <div className="cv-variant-truth-warning">
                <ShieldAlert size={18} />
                <div>
                  <strong>Lưu ý về tính trung thực của hồ sơ:</strong> Vui lòng chỉ chỉnh sửa hoặc
                  bổ sung những trải nghiệm, kỹ năng và kết quả mà bạn đã thực sự thực hiện. Hệ
                  thống sẽ tự động đối chiếu với hồ sơ gốc để đảm bảo độ tin cậy khi xuất bản.
                </div>
              </div>

              <div className="cv-variant-edit-grid">
                <label>
                  Họ tên
                  <input
                    value={content.personal_info.full_name || ''}
                    onChange={(event) =>
                      updateContent((item) => ({
                        ...item,
                        personal_info: { ...item.personal_info, full_name: event.target.value },
                      }))
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={content.personal_info.email || ''}
                    onChange={(event) =>
                      updateContent((item) => ({
                        ...item,
                        personal_info: { ...item.personal_info, email: event.target.value },
                      }))
                    }
                  />
                </label>
                <label className="wide">
                  Tóm tắt
                  <textarea
                    value={content.summary}
                    onChange={(event) =>
                      updateContent((item) => ({ ...item, summary: event.target.value }))
                    }
                  />
                </label>
                <label className="wide">
                  Kỹ năng (cách nhau bởi dấu phẩy)
                  <input
                    value={content.skills.join(', ')}
                    onChange={(event) =>
                      updateContent((item) => ({
                        ...item,
                        skills: event.target.value
                          .split(',')
                          .map((value) => value.trim())
                          .filter(Boolean),
                      }))
                    }
                  />
                </label>
              </div>

              <div className="cv-variant-entry-section">
                <h5>Kinh nghiệm làm việc</h5>
                <CVEntryListEditor
                  items={content.experience}
                  onChange={(next) => updateContent((item) => ({ ...item, experience: next }))}
                  fields={[
                    { key: 'role', label: 'Vị trí', placeholder: 'AI Engineer Intern' },
                    { key: 'company', label: 'Công ty', placeholder: 'VNG, FPT Software...' },
                    { key: 'period', label: 'Thời gian', placeholder: 'Th6 2025 – Hiện tại' },
                  ]}
                  addLabel="Thêm kinh nghiệm làm việc"
                  emptyLabel="Chưa có kinh nghiệm nào."
                  disabled={active.status === 'PUBLISHED'}
                />
              </div>

              <div className="cv-variant-entry-section">
                <h5>Dự án tiêu biểu</h5>
                <CVEntryListEditor
                  items={content.projects}
                  onChange={(next) => updateContent((item) => ({ ...item, projects: next }))}
                  fields={[
                    { key: 'title', label: 'Tên dự án', placeholder: 'AI-Powered Career Platform' },
                    { key: 'technologies', label: 'Công nghệ', placeholder: 'Python, FastAPI, React' },
                    { key: 'period', label: 'Thời gian', placeholder: 'Th3 2026 – nay' },
                  ]}
                  addLabel="Thêm dự án"
                  emptyLabel="Chưa có dự án nào."
                  disabled={active.status === 'PUBLISHED'}
                />
              </div>

              <div className="cv-variant-entry-section">
                <h5>Học vấn</h5>
                <CVEntryListEditor
                  items={content.education}
                  onChange={(next) => updateContent((item) => ({ ...item, education: next }))}
                  fields={[
                    { key: 'school', label: 'Trường', placeholder: 'Đại học Bách Khoa Hà Nội' },
                    { key: 'degree', label: 'Bằng cấp', placeholder: 'Cử nhân CNTT' },
                    { key: 'period', label: 'Thời gian', placeholder: '2022 – 2026' },
                  ]}
                  addLabel="Thêm học vấn"
                  emptyLabel="Chưa có thông tin học vấn."
                  disabled={active.status === 'PUBLISHED'}
                />
              </div>

              <div className="cv-variant-entry-section">
                <h5>Chứng chỉ & Hoạt động</h5>
                <CVEntryListEditor
                  items={content.certifications || []}
                  onChange={(next) => updateContent((item) => ({ ...item, certifications: next }))}
                  fields={[
                    { key: 'title', label: 'Tên chứng chỉ', placeholder: 'AWS Certified Cloud Practitioner' },
                    { key: 'issuer', label: 'Đơn vị cấp', placeholder: 'Amazon Web Services' },
                    { key: 'period', label: 'Thời gian', placeholder: '2025' },
                  ]}
                  addLabel="Thêm chứng chỉ / hoạt động"
                  emptyLabel="Chưa có chứng chỉ hoặc hoạt động nào."
                  disabled={active.status === 'PUBLISHED'}
                />
              </div>
            </div>
              )}
            </div>

            <div className="cv-variant-split-right">
              <CVLivePreview content={content} template={template} />
            </div>
          </div>

          {/* Publish & Export Gate */}
          <section className="cv-variant-validation">
            <div className="cv-variant-validation-head">
              <div>
                <h4>Kiểm định ATS & Xuất file CV</h4>
                {validation ? (
                  <p className={hasValidationFailures ? 'cv-variant-validation-result failed' : 'cv-variant-validation-result'}>
                    {hasValidationFailures ? '✕' : '✓'} {validationValidators.filter((validator) => validator.passed).length}/{validationValidators.length} tiêu chí đạt
                  </p>
                ) : (
                  <p className="cv-variant-section-desc">Đang kiểm tra các tiêu chí ATS cho bản CV này.</p>
                )}
              </div>
              {validation && (
                <button
                  type="button"
                  className={`cv-variant-disclosure-btn${showValidationDetails ? ' is-open' : ''}`}
                  onClick={() => setIsValidationExpanded((expanded) => !expanded)}
                  aria-expanded={showValidationDetails}
                >
                  {showValidationDetails ? 'Ẩn chi tiết' : 'Xem chi tiết'} <ChevronDown size={16} />
                </button>
              )}
            </div>

            {validation && showValidationDetails && (
              <div className="cv-variant-validator-summary">
                <div className="cv-variant-validator-grid">
                  {validationValidators.map((validator) => {
                    const label = VALIDATOR_LABELS[validator.name] || {
                      title: 'Kiểm tra nội dung CV',
                      desc: 'Kiểm tra thông tin cần thiết trước khi xuất PDF.',
                    };
                    return (
                      <article
                        key={validator.name}
                        className={validator.passed ? 'passed' : 'failed'}
                      >
                        <div className="cv-variant-validator-head">
                          <strong>
                            {validator.passed ? '✓' : '✕'} {label.title}
                          </strong>
                        </div>
                        {label.desc && <p className="cv-variant-validator-desc">{label.desc}</p>}
                        {validator.errors.map((item) => (
                          <small key={item}>{item}</small>
                        ))}
                      </article>
                    );
                  })}
                </div>
                <p className="cv-variant-validation-stats">
                  {validation.claims_supported}/{validation.claims_total} thông tin đã xác thực
                  nguồn · Bản in PDF {validation.render.pages} trang chuẩn ATS
                </p>
              </div>
            )}

            {/* Publish phiên bản khi đạt chuẩn ATS */}
            <div className="cv-variant-unified-action-row">
              <button
                type="button"
                className="cv-variant-preview-btn"
                onClick={() => void handlePreviewAndDownload(false)}
                disabled={Boolean(busy)}
                title="Preview PDF: Xem trước bản in PDF (không tải file về máy)"
                >
                <Eye size={18} /> {busy === 'preview' ? 'Đang xem trước…' : 'Xem trước PDF'}
              </button>
              <button
                type="button"
                className="cv-variant-preview-download-btn"
                onClick={() => void handlePreviewAndDownload(true)}
                disabled={Boolean(busy)}
                title="Tải PDF: Kiểm định đạt chuẩn ATS, publish và tải file PDF về máy"
                >
                <Download size={18} /> {busy === 'download' ? 'Đang tải CV…' : 'Tải CV (PDF)'}
              </button>
              {validation && !validation.passed && (
                <small className="cv-variant-export-block-reason">
                  Chưa thể tải: {studentValidators.flatMap((item) => item.issues).map((item) => `${item.section}: ${item.reason}`)[0] || 'Hãy hoàn tất kiểm định.'}
                </small>
              )}
              {validation ? (
                validation.passed ? (
                  <div className="cv-variant-verified-badge">
                    <CheckCircle2 size={16} /> {validation.verification_status || 'Verified'} · JD keyword coverage {validation.jd_keyword_coverage ?? 0}% · ATS content coverage {validation.ats_content_coverage ?? 0}%
                  </div>
                ) : (
                  <div className="cv-variant-failed-badge">
                    <XCircle size={16} /> Chưa đạt kiểm định (
                    {validation.validators.filter((v) => !v.passed).length} tiêu chí vi phạm)
                  </div>
                )
              ) : (
                <div className="cv-variant-draft-badge">
                  <AlertTriangle size={16} /> Bản nháp (Đang kiểm tra...)
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <section className="cv-variant-history">
        <div className="cv-variant-section-head cv-variant-history-head">
          <div>
            <h4>Lịch sử revision ({Math.min(variants.length, 5)})</h4>
          </div>
          <button
            type="button"
            className={`cv-variant-disclosure-btn${isHistoryExpanded ? ' is-open' : ''}`}
            onClick={() => setIsHistoryExpanded((expanded) => !expanded)}
            aria-expanded={isHistoryExpanded}
          >
            {isHistoryExpanded ? 'Ẩn lịch sử' : 'Xem lịch sử'} <ChevronDown size={16} />
          </button>
        </div>
        {isHistoryExpanded && (variants.length ? (
          <div className="cv-variant-history-list">
            {variants.slice(0, 5).map((variant) => {
              let formattedDate = 'Vừa xong';
              if (variant.created_at) {
                try {
                  let raw = variant.created_at.trim();
                  if (!raw.endsWith('Z') && !raw.includes('+')) {
                    raw = raw.replace(' ', 'T') + 'Z';
                  }
                  formattedDate = new Date(raw).toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });
                } catch {
                  formattedDate = variant.created_at;
                }
              }

              const tplName =
                CV_TEMPLATES.find((t) => t.id === variant.content?.template_name)?.name ||
                'Mẫu Harvard ATS';

              return (
                <div key={variant.id} className="cv-variant-history-item">
                  <div className="cv-variant-history-info">
                    <div className="cv-variant-history-title-row">
                      <strong>{variant.title}</strong>
                      <span className={`status-${variant.status.toLowerCase()}`}>
                        {statusLabel(variant.status)}
                      </span>
                    </div>
                    <div className="cv-variant-history-meta">
                      <span className="cv-variant-history-template-tag">{tplName}</span>
                      <span className="cv-variant-dot">•</span>
                      <span>
                        {variant.revision_no > 1
                          ? `Chỉnh sửa lần ${variant.revision_no}`
                          : 'Bản tạo mới'}
                      </span>
                      <span className="cv-variant-dot">•</span>
                      <span>{formattedDate}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="cv-variant-history-open-btn"
                    onClick={() => void openVariant(variant.id)}
                  >
                    Mở bản này →
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="cv-variant-empty-text">Chưa có phiên bản nào được lưu.</p>
        ))}
      </section>

      {/* Modal Dán JD mới */}
      {showPasteJdModal && (
        <div className="cv-variant-modal-backdrop" onClick={() => setShowPasteJdModal(false)}>
          <div className="cv-variant-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cv-variant-modal-head">
              <div className="cv-variant-modal-title">
                <h4>Dán nội dung JD mới</h4>
                <p>
                  Nhập thông tin vị trí tuyển dụng để lưu vào hệ thống và tối ưu CV theo JD này.
                </p>
              </div>
            </div>

            <div className="cv-variant-modal-body">
              <label>
                Tên vị trí tuyển dụng *
                <input
                  type="text"
                  placeholder="Ví dụ: Senior AI Engineer, Data Engineer Intern..."
                  value={customJdTitle}
                  onChange={(e) => setCustomJdTitle(e.target.value)}
                />
              </label>

              <label>
                Tên công ty (Tùy chọn)
                <input
                  type="text"
                  placeholder="Ví dụ: VNG, FPT Software, Shopee..."
                  value={customJdCompany}
                  onChange={(e) => setCustomJdCompany(e.target.value)}
                />
              </label>

              <label>
                Nội dung mô tả công việc (Yêu cầu, trách nhiệm, kỹ năng) *
                <textarea
                  rows={6}
                  placeholder="Dán toàn bộ nội dung JD tuyển dụng tại đây..."
                  value={customJdText}
                  onChange={(e) => setCustomJdText(e.target.value)}
                />
              </label>
            </div>

            <div className="cv-variant-modal-footer">
              <button
                type="button"
                className="cv-variant-modal-cancel-btn"
                onClick={() => setShowPasteJdModal(false)}
                disabled={savingCustomJd}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="cv-variant-modal-submit-btn"
                onClick={() => void handleSaveCustomJd()}
                disabled={savingCustomJd || !customJdTitle.trim() || !customJdText.trim()}
              >
                {savingCustomJd ? 'Đang lưu JD...' : 'Xác nhận & Lưu JD'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
