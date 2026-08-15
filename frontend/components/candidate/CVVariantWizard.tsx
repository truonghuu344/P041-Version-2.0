'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, Eye, FileCheck2, History, Save, ShieldAlert, Sparkles, XCircle } from 'lucide-react';

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
  return records.map((item) => String(item.description || item.title || '')).filter(Boolean).join('\n');
}

function textToRecords(value: string): Array<Record<string, unknown>> {
  return value.split('\n').map((item) => item.trim()).filter(Boolean).map((description) => ({ description }));
}

function statusLabel(status: CVVariant['status']): string {
  return ({ DRAFT: 'Bản nháp', DRAFT_BLOCKED: 'Đang bị chặn', VALIDATED: 'Đã kiểm định', PUBLISHED: 'Đã xuất bản' })[status];
}

export default function CVVariantWizard() {
  const [mode, setMode] = useState<VariantMode>('HAS_CV');
  const [cvs, setCvs] = useState<CVSummary[]>([]);
  const [jds, setJds] = useState<JDSummary[]>([]);
  const [variants, setVariants] = useState<CVVariant[]>([]);
  const [cvId, setCvId] = useState('');
  const [jdId, setJdId] = useState('');
  const [title, setTitle] = useState('CV tối ưu theo JD');
  const [template, setTemplate] = useState<'classic' | 'modern' | 'compact'>('classic');
  const [content, setContent] = useState<VariantContent>(emptyContent);
  const [active, setActive] = useState<CVVariant | null>(null);
  const [validation, setValidation] = useState<VariantValidation | null>(null);
  const [sourceConfirmed, setSourceConfirmed] = useState(false);
  const [confirmedClaim, setConfirmedClaim] = useState('');
  const [confirmClaimChecked, setConfirmClaimChecked] = useState(false);
  const [suggestionEdits, setSuggestionEdits] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const autosaveGeneration = useRef(0);

  const load = useCallback(async () => {
    setBusy('load');
    setError('');
    try {
      const [options, history] = await Promise.all([cvVariantsApi.prerequisites(), cvVariantsApi.list()]);
      setCvs(options.cvs);
      setJds(options.jds);
      setCvId((current) => current || options.cvs[0]?.id || '');
      setJdId((current) => current || options.jds[0]?.id || '');
      setVariants(history.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu CV Variant.');
    } finally {
      setBusy('');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!active || !dirty || active.status === 'PUBLISHED') return;
    const generation = ++autosaveGeneration.current;
    const timeout = window.setTimeout(async () => {
      setBusy('autosave');
      try {
        const confirmations = confirmClaimChecked && confirmedClaim.trim() ? [confirmedClaim.trim()] : [];
        const saved = await cvVariantsApi.autosave(active.id, content, confirmations);
        if (generation === autosaveGeneration.current) {
          setActive(saved);
          setValidation(null);
          setDirty(false);
          setMessage(`Đã tự động lưu revision ${saved.revision_no}.`);
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
  const canCreate = Boolean(jdId && (mode === 'HAS_CV' ? cvId : sourceConfirmed));

  const updateContent = (update: (previous: VariantContent) => VariantContent) => {
    setContent(update);
    setDirty(true);
    setMessage('Đang chờ autosave…');
  };

  const create = async () => {
    if (!canCreate) return;
    setBusy('create');
    setError('');
    try {
      const variant = await cvVariantsApi.create({
        mode,
        cv_id: mode === 'HAS_CV' ? cvId : null,
        jd_id: jdId,
        template_name: template,
        title,
        content: mode === 'NO_CV' ? { ...content, template_name: template } : null,
        candidate_evidence_confirmed: mode === 'NO_CV' ? sourceConfirmed : false,
        language: 'vi',
        optimization_mode: 'balanced',
      }, crypto.randomUUID());
      setActive(variant);
      setContent(variant.content);
      setValidation(variant.validator_result);
      setDirty(false);
      setSuggestionEdits(Object.fromEntries((variant.content._suggestions || []).map((item) => [item.id, item.proposed])));
      setVariants((items) => [variant, ...items.filter((item) => item.id !== variant.id)]);
      setMessage(`Đã tạo variant revision ${variant.revision_no}; CV gốc không bị thay đổi.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Không tạo được CV Variant.');
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
      setSuggestionEdits(Object.fromEntries((variant.content._suggestions || []).map((item) => [item.id, item.final_text || item.proposed])));
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
      const resolvedDecision = decision === 'accept' && text !== suggestion.proposed ? 'edit' : decision;
      const variant = await cvVariantsApi.decide(active.id, suggestion.id, resolvedDecision, text);
      setActive(variant);
      setContent(variant.content);
      setValidation(null);
      setDirty(false);
      setMessage(`Đã ${resolvedDecision === 'reject' ? 'từ chối' : 'áp dụng'} đề xuất và lưu revision ${variant.revision_no}.`);
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Không lưu được quyết định.');
    } finally {
      setBusy('');
    }
  };

  const runValidation = async () => {
    if (!active || dirty) {
      setError('Hãy chờ autosave hoàn tất trước khi kiểm định.');
      return;
    }
    setBusy('validate');
    setError('');
    try {
      const report = await cvVariantsApi.validate(active.id);
      setValidation(report);
      setActive((current) => current ? { ...current, status: report.status, validator_result: report } : current);
      setMessage(report.passed ? 'Đã vượt qua đủ 7 hard validators.' : 'Publish đang bị chặn; xem lỗi theo từng validator.');
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Không chạy được validator.');
    } finally {
      setBusy('');
    }
  };

  const openPdf = async (preview: boolean) => {
    if (!active) return;
    setBusy(preview ? 'preview' : 'download');
    setError('');
    try {
      const blob = await cvVariantsApi.pdf(active.id, preview);
      const url = URL.createObjectURL(blob);
      if (preview) window.open(url, '_blank', 'noopener,noreferrer');
      else {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${active.title.replace(/[^a-zA-Z0-9-_ ]/g, '') || 'cv-variant'}.pdf`;
        anchor.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (pdfError) {
      setError(pdfError instanceof Error ? pdfError.message : 'Không mở được PDF.');
    } finally {
      setBusy('');
    }
  };

  const publish = async () => {
    if (!active || !validation?.passed) return;
    setBusy('publish');
    setError('');
    try {
      const result = await cvVariantsApi.publish(active.id);
      const refreshed = await cvVariantsApi.get(active.id);
      setActive(refreshed);
      setContent(refreshed.content);
      setVariants((items) => [refreshed, ...items.filter((item) => item.id !== refreshed.id)]);
      setMessage(`Đã publish. SHA-256: ${result.checksum}`);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Publish thất bại.');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="cv-variant-wizard" aria-labelledby="cv-variant-title">
      <header className="cv-variant-wizard-head">
        <div><p>CV VARIANT V2</p><h3 id="cv-variant-title">Tạo và tối ưu CV theo JD</h3><span>CV gốc luôn bất biến. Chỉ bản vượt đủ 7 validator mới được publish.</span></div>
        <button type="button" onClick={() => void load()} disabled={Boolean(busy)}><History size={16} /> Làm mới</button>
      </header>

      {error && <div className="cv-variant-alert error" role="alert"><ShieldAlert size={17} /> {error}</div>}
      {message && <div className="cv-variant-alert success" aria-live="polite"><CheckCircle2 size={17} /> {message}</div>}

      <div className="cv-variant-mode" role="group" aria-label="Chọn cách tạo CV">
        <button type="button" className={mode === 'HAS_CV' ? 'active' : ''} onClick={() => setMode('HAS_CV')}>Có CV + JD</button>
        <button type="button" className={mode === 'NO_CV' ? 'active' : ''} onClick={() => setMode('NO_CV')}>Chưa có CV + JD</button>
      </div>

      <div className="cv-variant-create-grid">
        {mode === 'HAS_CV' && <label>CV nguồn<select value={cvId} onChange={(event) => setCvId(event.target.value)}><option value="">Chọn CV</option>{cvs.map((cv) => <option key={cv.id} value={cv.id}>{cv.title}</option>)}</select></label>}
        <label>JD mục tiêu<select value={jdId} onChange={(event) => setJdId(event.target.value)}><option value="">Chọn JD</option>{jds.map((jd) => <option key={jd.id} value={jd.id}>{jd.title}{jd.company ? ` — ${jd.company}` : ''}</option>)}</select></label>
        <label>Tên variant<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Template<select value={template} onChange={(event) => setTemplate(event.target.value as typeof template)}><option value="classic">Classic ATS</option><option value="modern">Modern</option><option value="compact">Compact</option></select></label>
      </div>

      {mode === 'NO_CV' && <div className="cv-variant-guided-form">
        <h4>Candidate Evidence do bạn nhập</h4>
        <label>Họ tên<input value={content.personal_info.full_name || ''} onChange={(event) => setContent((item) => ({ ...item, personal_info: { ...item.personal_info, full_name: event.target.value } }))} /></label>
        <label>Email<input type="email" value={content.personal_info.email || ''} onChange={(event) => setContent((item) => ({ ...item, personal_info: { ...item.personal_info, email: event.target.value } }))} /></label>
        <label className="wide">Tóm tắt<textarea value={content.summary} onChange={(event) => setContent((item) => ({ ...item, summary: event.target.value }))} /></label>
        <label className="wide">Kỹ năng, phân cách bằng dấu phẩy<input value={content.skills.join(', ')} onChange={(event) => setContent((item) => ({ ...item, skills: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) }))} /></label>
        <label>Kinh nghiệm, mỗi dòng một mục<textarea value={recordsToText(content.experience)} onChange={(event) => setContent((item) => ({ ...item, experience: textToRecords(event.target.value) }))} /></label>
        <label>Dự án, mỗi dòng một mục<textarea value={recordsToText(content.projects)} onChange={(event) => setContent((item) => ({ ...item, projects: textToRecords(event.target.value) }))} /></label>
        <label>Học vấn, mỗi dòng một mục<textarea value={recordsToText(content.education)} onChange={(event) => setContent((item) => ({ ...item, education: textToRecords(event.target.value) }))} /></label>
        <label className="cv-variant-confirm wide"><input type="checkbox" checked={sourceConfirmed} onChange={(event) => setSourceConfirmed(event.target.checked)} /> Tôi xác nhận toàn bộ thông tin trên là sự thật và cho phép tạo Candidate Evidence snapshot bất biến.</label>
      </div>}

      <button className="cv-variant-primary" type="button" disabled={!canCreate || Boolean(busy)} onClick={() => void create()}><Sparkles size={16} /> {busy === 'create' ? 'Đang tạo…' : 'Tạo CV Variant'}</button>

      {active && <div className="cv-variant-editor">
        <div className="cv-variant-status-row"><div><strong>{active.title}</strong><span className={`status-${active.status.toLowerCase()}`}>{statusLabel(active.status)}</span></div><small>Revision {active.revision_no} · {busy === 'autosave' ? 'Đang autosave…' : dirty ? 'Chưa lưu' : 'Đã lưu'}</small></div>
        <div className="cv-variant-score-row"><span>Match trước: <b>{content._match_scores?.before ?? 0}%</b></span><span>Preview sau tối ưu: <b>{content._match_scores?.after_preview ?? 0}%</b></span><span>AI: <b>{active.ai_metadata.provider || 'fallback'}</b></span></div>

        <section><h4>Chỉnh nội dung theo từng section</h4><div className="cv-variant-edit-grid">
          <label className="wide">Tóm tắt<textarea value={content.summary || ''} disabled={active.status === 'PUBLISHED'} onChange={(event) => updateContent((item) => ({ ...item, summary: event.target.value }))} /></label>
          <label className="wide">Kỹ năng<input value={(content.skills || []).join(', ')} disabled={active.status === 'PUBLISHED'} onChange={(event) => updateContent((item) => ({ ...item, skills: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) }))} /></label>
          <label>Kinh nghiệm<textarea value={recordsToText(content.experience)} disabled={active.status === 'PUBLISHED'} onChange={(event) => updateContent((item) => ({ ...item, experience: textToRecords(event.target.value) }))} /></label>
          <label>Dự án<textarea value={recordsToText(content.projects)} disabled={active.status === 'PUBLISHED'} onChange={(event) => updateContent((item) => ({ ...item, projects: textToRecords(event.target.value) }))} /></label>
          <label>Học vấn<textarea value={recordsToText(content.education)} disabled={active.status === 'PUBLISHED'} onChange={(event) => updateContent((item) => ({ ...item, education: textToRecords(event.target.value) }))} /></label>
        </div></section>

        {active.status !== 'PUBLISHED' && <section className="cv-variant-writeback"><h4>Xác nhận fact mới do bạn tự nhập</h4><p>AI không thể xác nhận thay bạn. Dán đúng một câu mới và đánh dấu xác nhận trước autosave.</p><textarea value={confirmedClaim} onChange={(event) => setConfirmedClaim(event.target.value)} placeholder="Ví dụ: Đạt chứng chỉ AWS Cloud Practitioner tháng 6/2026" /><label><input type="checkbox" checked={confirmClaimChecked} onChange={(event) => setConfirmClaimChecked(event.target.checked)} /> Tôi xác nhận câu này là sự thật.</label></section>}

        <section><h4>Đề xuất AI — review từng thay đổi</h4>{suggestions.length ? <div className="cv-variant-suggestions">{suggestions.map((suggestion) => <article key={suggestion.id}>
          <header><strong>{suggestion.section || 'Nội dung CV'}</strong><span>{suggestion.validator_status}</span></header>
          <div className="cv-variant-diff"><div><b>Gốc</b><p>{suggestion.original}</p></div><label><b>Đề xuất / chỉnh sửa</b><textarea disabled={active.status === 'PUBLISHED' || suggestion.decision === 'reject'} value={suggestionEdits[suggestion.id] ?? suggestion.final_text ?? suggestion.proposed} onChange={(event) => setSuggestionEdits((items) => ({ ...items, [suggestion.id]: event.target.value }))} /></label></div>
          <p><b>Lý do:</b> {suggestion.reason}</p><p><b>Evidence:</b> {suggestion.source_spans?.map((span) => span.text).join(' · ') || 'Không có'}</p>
          <div className="cv-variant-suggestion-actions"><button type="button" disabled={Boolean(busy) || active.status === 'PUBLISHED'} onClick={() => void decide(suggestion, 'accept')}><CheckCircle2 size={15} /> Chấp nhận</button><button type="button" disabled={Boolean(busy) || active.status === 'PUBLISHED'} onClick={() => void decide(suggestion, 'reject')}><XCircle size={15} /> Từ chối</button></div>
        </article>)}</div> : <p>Không có rewrite nào đủ evidence để đề xuất.</p>}</section>

        <section className="cv-variant-validation"><div className="cv-variant-validation-head"><h4>Publish gate</h4><button type="button" onClick={() => void runValidation()} disabled={Boolean(busy) || dirty || active.status === 'PUBLISHED'}><FileCheck2 size={16} /> Chạy 7 validators</button></div>
          {validation && <><div className="cv-variant-validator-grid">{validation.validators.map((validator) => <article key={validator.name} className={validator.passed ? 'passed' : 'failed'}><strong>{validator.passed ? '✓' : '✕'} {validator.name}</strong>{validator.errors.map((item) => <small key={item}>{item}</small>)}</article>)}</div><p>{validation.claims_supported}/{validation.claims_total} claims có evidence · PDF {validation.render.pages} trang</p></>}
          <div className="cv-variant-publish-actions"><button type="button" onClick={() => void openPdf(true)} disabled={!validation?.passed || Boolean(busy)}><Eye size={16} /> Preview PDF</button><button type="button" className="cv-variant-primary" onClick={() => void publish()} disabled={!validation?.passed || Boolean(busy) || active.status === 'PUBLISHED'}><Save size={16} /> Publish phiên bản</button>{active.status === 'PUBLISHED' && <button type="button" onClick={() => void openPdf(false)} disabled={Boolean(busy)}><Download size={16} /> Tải PDF</button>}</div>
        </section>

        <section><h4>Lịch sử revision</h4><ol className="cv-variant-revisions">{active.revisions.map((revision) => <li key={revision.revision_no}><strong>Revision {revision.revision_no}</strong><span>{revision.editor_type} · {revision.change_summary}</span></li>)}</ol></section>
      </div>}

      <section className="cv-variant-history"><h4>CV Variant của bạn</h4>{variants.length ? variants.map((variant) => <button type="button" key={variant.id} onClick={() => void openVariant(variant.id)}><span><strong>{variant.title}</strong><small>{statusLabel(variant.status)} · revision {variant.revision_no}</small></span><span>Mở →</span></button>) : <p>Chưa có variant nào.</p>}</section>
    </section>
  );
}
