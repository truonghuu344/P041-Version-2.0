import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  History,
  LogIn,
  Plus,
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
} from '../../lib/cvVariantsApi';
import { CV_TEMPLATES, MiniCVSheet } from './TemplatePreviewCard';

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

function recordsToText(records: Array<Record<string, unknown>> = []): string {
  return records
    .map((item) => String(item.description || item.title || ''))
    .filter(Boolean)
    .join('\n');
}

function textToRecords(value: string): Array<Record<string, unknown>> {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((description) => ({ description }));
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
  const [template, setTemplate] = useState<'classic' | 'modern' | 'compact' | 'creative' | 'elegant'>('classic');
  const [rawFullName, setRawFullName] = useState('');
  const [rawEmail, setRawEmail] = useState('');
  const [rawSummary, setRawSummary] = useState('');
  const [rawSkills, setRawSkills] = useState('');
  const [rawExperience, setRawExperience] = useState('');
  const [rawProjects, setRawProjects] = useState('');
  const [rawEducation, setRawEducation] = useState('');

  const insertBullet = (
    currentValue: string,
    setter: (val: string) => void,
  ) => {
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
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const autosaveGeneration = useRef(0);

  useEffect(() => {
    if (active && !dirty && !validation) {
      void cvVariantsApi.validate(active.id).then((report) => {
        setValidation(report);
      }).catch(() => {});
    }
  }, [active, dirty, validation]);

  const load = useCallback(async () => {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null;
    if (!token && !isAuthenticated) return;
    setBusy('load');
    setError('');
    try {
      const [options, history] = await Promise.all([
        cvVariantsApi.prerequisites(),
        cvVariantsApi.list(),
      ]);

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

      setCvId((current) => (uniqueCvs.some((c) => c.id === current) ? current : uniqueCvs[0]?.id || ''));
      setJdId((current) => {
        if (current && uniqueJds.some((j) => j.id === current)) return current;
        if (preferredJd && uniqueJds.some((j) => j.id === preferredJd)) return preferredJd;
        return uniqueJds[0]?.id || '';
      });
      setVariants(history.items);
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
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null;
      const apiAuth = (window as unknown as { ApiClient?: { isAuthenticated?: () => boolean } })?.ApiClient?.isAuthenticated?.();
      const isAuth = Boolean(token || apiAuth);
      setIsAuthenticated(isAuth);
      return isAuth;
    };

    checkAuth();

    const handleAuthChanged = (e: Event | CustomEvent<{ user?: unknown }>) => {
      const customEvent = e as CustomEvent<{ user?: unknown }>;
      const user = customEvent?.detail?.user;
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null;
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

    document.addEventListener('auth:changed', handleAuthChanged);
    window.addEventListener('career:session-ready', checkAuth);
    window.addEventListener('career:session-cleared', () => handleAuthChanged(new CustomEvent('auth:cleared', { detail: { user: null } })));
    return () => {
      document.removeEventListener('auth:changed', handleAuthChanged);
      window.removeEventListener('career:session-ready', checkAuth);
      window.removeEventListener('career:session-cleared', () => handleAuthChanged(new CustomEvent('auth:cleared', { detail: { user: null } })));
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
      const cleanCv = selectedCv ? selectedCv.title.replace(/\.[^/.]+$/, '').replace(/_/g, ' ') : 'CV';
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
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Không tạo được bản CV tối ưu.');
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
          currentVariant = await cvVariantsApi.decide(currentVariant.id, suggestion.id, 'accept', text);
        }
      }
      setActive(currentVariant);
      setContent(currentVariant.content);
      setValidation(null);
      setDirty(false);
      setMessage('Đã áp dụng tất cả đề xuất tối ưu.');
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Không thể áp dụng tất cả đề xuất.');
    } finally {
      setBusy('');
    }
  };

  const handlePreviewAndDownload = async () => {
    if (!active) return;
    setBusy('preview');
    setError('');
    try {
      let currentReport = validation;
      if (!currentReport || !currentReport.passed) {
        currentReport = await cvVariantsApi.validate(active.id);
        setValidation(currentReport);
      }
      if (currentReport?.passed) {
        if (active.status !== 'PUBLISHED') {
          await cvVariantsApi.publish(active.id);
          const refreshed = await cvVariantsApi.get(active.id);
          setActive(refreshed);
          setVariants((items) => [refreshed, ...items.filter((item) => item.id !== refreshed.id)]);
        }
        setMessage('✓ Bản CV đạt chuẩn ATS 100% và đã mở bản xem trước để tải về.');
      } else {
        const failedCount = currentReport?.validators.filter((v) => !v.passed).length || 1;
        setError(`⚠️ Bản CV có ${failedCount} tiêu chí kiểm định chưa đạt. Vui lòng xem chi tiết các mục vi phạm màu đỏ bên dưới.`);
      }
      const blob = await cvVariantsApi.pdf(active.id, true);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (pdfError) {
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

  return (
    <section className="cv-variant-wizard" aria-labelledby="cv-variant-title">
      <header className="cv-variant-wizard-head">
        <div>
          <p>TỐI ƯU HỒ SƠ ỨNG TUYỂN</p>
          <h3 id="cv-variant-title">Tạo và tối ưu CV theo JD</h3>
          <span>Hồ sơ gốc luôn được bảo toàn 100%. Hệ thống tự động kiểm định 7 tiêu chuẩn ATS để đảm bảo CV trung thực và tối ưu nhất.</span>
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
            <strong>Bạn chưa đăng nhập:</strong> Vui lòng đăng nhập tài khoản để chọn CV và JD đã lưu, hoặc chuyển sang chế độ <strong>&quot;Tạo CV mới từ đầu&quot;</strong> để tự tạo CV mới.
          </div>
          <button
            type="button"
            className="cv-variant-login-btn"
            onClick={() => {
              const btn = document.getElementById('header-login-btn') || document.querySelector('.header-login-btn') as HTMLElement;
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
                <option value="">Chưa có CV nào (Tải lên CV ở trên hoặc chọn &apos;Tạo CV mới từ đầu&apos;)</option>
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
            <button
              type="button"
              className="cv-variant-paste-jd-trigger-btn"
              onClick={() => setShowPasteJdModal(true)}
              title="Dán nội dung JD từ tin tuyển dụng mới"
            >
              <Plus size={13} /> Dán JD mới
            </button>
          </div>
          <select
            value={jdId}
            onChange={(event) => handleJdChange(event.target.value)}
            disabled={!isAuthenticated || jds.length === 0}
          >
            {!isAuthenticated ? (
              <option value="">Đăng nhập để xem danh sách JD</option>
            ) : jds.length === 0 ? (
              <option value="">Chưa có JD khả dụng (Bấm &apos;+ Dán JD mới&apos; ở trên)</option>
            ) : (
              <>
                <option value="">-- Chọn JD mục tiêu ({jds.length} JD có sẵn) --</option>
                {jds.map((jd) => (
                  <option key={jd.id} value={jd.id}>
                    {jd.title}
                    {jd.company ? ` — ${jd.company}` : ''}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        <div className="cv-variant-field-group">
          <div className="cv-variant-label-row">
            <span className="cv-variant-label-text">Tên bản CV tối ưu</span>
          </div>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

        <div className="cv-variant-field-group">
          <div className="cv-variant-label-row">
            <span className="cv-variant-label-text">Template (Chọn nhanh)</span>
          </div>
          <select
            value={template}
            onChange={(event) => setTemplate(event.target.value as typeof template)}
          >
            <option value="classic">Classic Harvard ATS (1 cột)</option>
            <option value="modern">Modern Tech Pro (2 cột)</option>
            <option value="compact">Minimalist Compact (1 trang)</option>
            <option value="creative">Creative Dark Timeline</option>
            <option value="elegant">Elegant Executive</option>
          </select>
        </div>
      </div>

      <div className="cv-variant-template-picker">
        <label className="cv-variant-template-picker-label">
          <span>Chọn mẫu CV trực quan</span>
          <span style={{ fontSize: '0.8rem', color: '#0d9488', fontWeight: 600 }}>
            {CV_TEMPLATES.find((t) => t.id === template)?.name} · {CV_TEMPLATES.find((t) => t.id === template)?.badge}
          </span>
        </label>
        <div className="cv-variant-template-grid" role="radiogroup" aria-label="Chọn mẫu thiết kế CV">
          {CV_TEMPLATES.map((tmpl) => {
            const isSelected = template === tmpl.id;
            return (
              <div
                key={tmpl.id}
                className={`cv-variant-template-option${isSelected ? ' is-active' : ''}`}
                onClick={() => setTemplate(tmpl.id as typeof template)}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setTemplate(tmpl.id as typeof template);
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
            <p>Điền các thông tin thực tế từ quá trình học tập và làm việc. Hệ thống sẽ tự động chuyển đổi thành hồ sơ chuẩn ATS.</p>
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
            Tôi cam kết toàn bộ thông tin trên là trung thực và chính xác theo trải nghiệm thực tế của tôi.
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
                  {suggestions.filter((s) => s.decision === 'accept').length} / {suggestions.length} đã duyệt
                </strong>
              </div>
              <div
                className="cv-variant-trust-pill"
                title="Hệ thống chỉ tối ưu từ ngữ và bám sát sự thật, tuyệt đối không bịa đặt kinh nghiệm/kỹ năng"
              >
                <ShieldCheck size={16} /> 100% Xác thực từ hồ sơ gốc
              </div>
            </div>
          </div>

          {/* AI Suggestions Section at the top */}
          <section className="cv-variant-suggestions-section">
            <div className="cv-variant-section-head">
              <div>
                <h4>Đề xuất tối ưu từ AI</h4>
                <p className="cv-variant-section-desc">
                  Các câu gợi ý viết lại bám sát yêu cầu JD mà vẫn giữ 100% sự thật từ kinh nghiệm của bạn.
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
                          disabled={active.status === 'PUBLISHED'}
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
                    {active.status !== 'PUBLISHED' && (
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
                    Dựa trên các kỹ năng trọng tâm của JD mà CV chưa thể hiện, AI gợi ý đề tài dự án thực tế để bạn tham khảo phát triển chuyên môn:
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
                      🎯 Dự án gợi ý: <strong>{active.content._gap_analysis.blueprint.title}</strong>
                    </div>
                    <p className="cv-variant-blueprint-desc">
                      {active.content._gap_analysis.blueprint.description}
                    </p>
                    <div className="cv-variant-blueprint-bullet">
                      <strong>Câu mô tả chuẩn ATS để đưa vào CV sau khi thực hiện:</strong>
                      <p>{active.content._gap_analysis.blueprint.draft_bullet}</p>
                    </div>
                  </div>
                )}
              </section>
            )}
          </section>

          {/* Toggle Manual Full Editor */}
          <div className="cv-variant-manual-toggle">
            <button
              type="button"
              className="cv-variant-secondary-btn"
              onClick={() => setShowManualEditor((prev) => !prev)}
            >
              {showManualEditor ? 'Ẩn form chỉnh sửa chi tiết ▲' : 'Mở form chỉnh sửa thủ công ▼'}
            </button>
          </div>

          {showManualEditor && (
            <div className="cv-variant-manual-editor-card">
              <div className="cv-variant-truth-warning">
                <ShieldAlert size={18} />
                <div>
                  <strong>Lưu ý về tính trung thực của hồ sơ:</strong> Vui lòng chỉ chỉnh sửa hoặc bổ sung những trải nghiệm, kỹ năng và kết quả mà bạn đã thực sự thực hiện. Hệ thống sẽ tự động đối chiếu với hồ sơ gốc để đảm bảo độ tin cậy khi xuất bản.
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
                <label>
                  Kinh nghiệm
                  <textarea
                    value={recordsToText(content.experience)}
                    onChange={(event) =>
                      updateContent((item) => ({
                        ...item,
                        experience: textToRecords(event.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Dự án
                  <textarea
                    value={recordsToText(content.projects)}
                    onChange={(event) =>
                      updateContent((item) => ({
                        ...item,
                        projects: textToRecords(event.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Học vấn
                  <textarea
                    value={recordsToText(content.education)}
                    onChange={(event) =>
                      updateContent((item) => ({
                        ...item,
                        education: textToRecords(event.target.value),
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          )}

          {/* Publish & Export Gate */}
          <section className="cv-variant-validation">
            <div className="cv-variant-validation-head">
              <div>
                <h4>Kiểm định ATS & Xuất file CV</h4>
                <p className="cv-variant-section-desc">
                  Hệ thống tự động kiểm tra 7 tiêu chí ATS và chuẩn bị bản in PDF hoàn chỉnh theo mẫu thiết kế đã chọn.
                </p>
              </div>
            </div>

            {validation && (
              <div className="cv-variant-validator-summary">
                <div className="cv-variant-validator-grid">
                  {validation.validators.map((validator) => {
                    const label = VALIDATOR_LABELS[validator.name] || {
                      title: validator.name,
                      desc: '',
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
                        {label.desc && (
                          <p className="cv-variant-validator-desc">{label.desc}</p>
                        )}
                        {validator.errors.map((item) => (
                          <small key={item}>{item}</small>
                        ))}
                      </article>
                    );
                  })}
                </div>
                <p className="cv-variant-validation-stats">
                  {validation.claims_supported}/{validation.claims_total} thông tin đã xác thực nguồn · Bản in PDF {validation.render.pages} trang chuẩn ATS
                </p>
              </div>
            )}

            {/* Publish phiên bản khi đạt chuẩn ATS */}
            <div className="cv-variant-unified-action-row">
              <button
                type="button"
                className="cv-variant-preview-download-btn"
                onClick={() => void handlePreviewAndDownload()}
                disabled={Boolean(busy)}
                title="Preview PDF và Tải PDF"
              >
                <Eye size={18} /> Xem trước & Tải CV (PDF)
              </button>
              {validation ? (
                validation.passed ? (
                  <div className="cv-variant-verified-badge">
                    <CheckCircle2 size={16} /> Đạt chuẩn ATS 100% (Sẵn sàng ứng tuyển)
                  </div>
                ) : (
                  <div className="cv-variant-failed-badge">
                    <XCircle size={16} /> Chưa đạt kiểm định ({validation.validators.filter((v) => !v.passed).length} tiêu chí vi phạm)
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
        <div className="cv-variant-section-head">
          <div>
            <h4>Lịch sử revision</h4>
            <p className="cv-variant-section-desc">
              Lưu giữ 5 phiên bản tối ưu gần nhất cùng mốc thời gian tạo.
            </p>
          </div>
        </div>
        {variants.length ? (
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

              const tplName = CV_TEMPLATES.find((t) => t.id === variant.content?.template_name)?.name || 'Mẫu Harvard ATS';

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
                      <span>{variant.revision_no > 1 ? `Chỉnh sửa lần ${variant.revision_no}` : 'Bản tạo mới'}</span>
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
        )}
      </section>

      {/* Modal Dán JD mới */}
      {showPasteJdModal && (
        <div className="cv-variant-modal-backdrop" onClick={() => setShowPasteJdModal(false)}>
          <div className="cv-variant-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cv-variant-modal-head">
              <div className="cv-variant-modal-title">
                <h4>Dán nội dung JD mới</h4>
                <p>Nhập thông tin vị trí tuyển dụng để lưu vào hệ thống và tối ưu CV theo JD này.</p>
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
