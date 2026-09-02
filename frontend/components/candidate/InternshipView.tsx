'use client';

import { useEffect, useState } from 'react';

interface WeeklyReport {
  week?: number;
  title?: string;
  work_done?: string;
  challenges?: string;
  next_plan?: string;
  mentor_feedback?: string;
  score?: number;
  reviewed_at?: string;
}

interface CounselorFeedbackItem {
  id: string;
  kind?: string;
  content: string;
  created_at?: string | null;
}

interface Internship {
  id: string;
  company_name: string;
  position: string;
  location?: string;
  mentor_name?: string | null;
  mentor_title?: string | null;
  counselor_name?: string | null;
  started_at?: string | null;
  current_week?: number;
  total_weeks?: number;
  progress_percent?: number;
  last_report_status?: string;
  status_label?: string;
  status?: string;
  weekly_reports?: WeeklyReport[];
  mentor_feedback?: WeeklyReport[];
  counselor_feedback?: CounselorFeedbackItem[];
  final_evaluation?: Record<string, unknown> | null;
}

interface ApiClientGlobal {
  request: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
}

const api = <T = unknown>(path: string, options?: RequestInit): Promise<T> => {
  const globalClient = (window as unknown as { ApiClient?: ApiClientGlobal }).ApiClient;
  if (!globalClient) {
    return Promise.reject(new Error('ApiClient not available'));
  }
  return globalClient.request<T>(path, options);
};

export default function InternshipView({ isActive = false }: { isActive?: boolean }) {
  const [items, setItems] = useState<Internship[]>([]);
  const [active, setActive] = useState('overview');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [form, setForm] = useState({ title: '', work_done: '', challenges: '', next_plan: '' });
  const [message, setMessage] = useState('');
  const intern = items[0];
  const load = async () => {
    try {
      setItems(await api<Internship[]>('/candidates/internships'));
    } catch {
      // Compatibility while an already-running backend is being restarted.
      try {
        const legacy = await api<Internship | null>('/candidates/internship');
        setItems(legacy ? [{ ...legacy, weekly_reports: [], mentor_feedback: [], counselor_feedback: [] }] : []);
        setMessage(legacy ? 'Dữ liệu chi tiết sẽ đầy đủ sau khi backend được cập nhật.' : 'Bạn chưa có chương trình thực tập đang được ghi nhận.');
      } catch {
        setMessage('Không thể tải dữ liệu thực tập.');
      }
    }
  };
  useEffect(() => { if (isActive) void load(); }, [isActive]);
  useEffect(() => {
    if (!intern) return;
    const report = intern.weekly_reports?.find((r) => r.week === selectedWeek);
    setForm(report ? { title: report.title || '', work_done: report.work_done || '', challenges: report.challenges || '', next_plan: report.next_plan || '' } : { title: `Báo cáo tuần ${selectedWeek}`, work_done: '', challenges: '', next_plan: '' });
  }, [intern, selectedWeek]);
  if (!isActive) return null;
  if (!intern) return <section className="max-w-5xl mx-auto p-6"><h1 className="text-2xl font-bold">Thực tập</h1><p className="mt-3 text-slate-600">{message || 'Bạn chưa có chương trình thực tập đang được ghi nhận.'}</p></section>;
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage('');
    try { await api(`/candidates/internships/${intern.id}/reports/${selectedWeek}`, { method: 'PUT', body: JSON.stringify(form) }); setMessage('Đã nộp báo cáo tuần.'); await load(); }
    catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Không thể nộp báo cáo.';
      setMessage(errorMsg);
    }
  };
  const tabs = [['overview','Tổng quan'],['reports','Báo cáo tuần'],['mentor','Nhận xét Mentor'],['advisor','Đánh giá Cố vấn']];
  return <section className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
    <header className="bg-white border rounded-2xl p-5"><p className="text-sm text-emerald-700 font-semibold">CHƯƠNG TRÌNH THỰC TẬP</p><h1 className="text-2xl font-bold mt-1">{intern.position}</h1><p className="text-slate-600">{intern.company_name} · {intern.location}</p><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm"><div>Mentor<br/><b>{intern.mentor_name || 'Chưa cập nhật'}</b></div><div>Cố vấn<br/><b>{intern.counselor_name || 'Chưa phân công'}</b></div><div>Tiến độ<br/><b>{intern.progress_percent}%</b></div><div>Tuần hiện tại<br/><b>{intern.current_week}/{intern.total_weeks}</b></div></div></header>
    <nav className="flex gap-2 overflow-x-auto border-b">{tabs.map(([id,label]) => <button key={id} onClick={() => setActive(id)} className={`px-3 py-2 text-sm whitespace-nowrap ${active===id?'border-b-2 border-emerald-600 text-emerald-700 font-semibold':'text-slate-600'}`}>{label}</button>)}</nav>
    {active === 'overview' && <div className="bg-white border rounded-2xl p-5"><p>Trạng thái: <b>{intern.status_label}</b></p><p className="mt-2">Thời gian bắt đầu: {intern.started_at ? new Date(intern.started_at).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</p></div>}
    {active === 'reports' && <form onSubmit={save} className="bg-white border rounded-2xl p-5 space-y-3"><select value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))} className="border rounded p-2">{Array.from({length: intern.total_weeks || 12},(_,i)=><option key={i+1} value={i+1}>Tuần {i+1}</option>)}</select>{(['title','work_done','challenges','next_plan'] as const).map(k => <textarea key={k} required={k==='title'||k==='work_done'} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={k.replace('_',' ')} className="w-full border rounded p-3 min-h-20" />)}<button className="bg-emerald-600 text-white rounded px-4 py-2">Nộp / cập nhật báo cáo</button></form>}
    {active === 'mentor' && <div className="space-y-3">{intern.mentor_feedback?.length ? intern.mentor_feedback.map((x) => <article key={x.week} className="bg-white border rounded-xl p-4"><b>Tuần {x.week}</b><p>{x.mentor_feedback}</p></article>) : <p>Chưa có nhận xét từ Mentor.</p>}</div>}
    {active === 'advisor' && <div className="space-y-3">{intern.counselor_feedback?.length ? intern.counselor_feedback.map((x) => <article key={x.id} className="bg-white border rounded-xl p-4"><p>{x.content}</p></article>) : <p>Chưa có đánh giá từ Cố vấn.</p>}</div>}
    {message && <p className="text-sm text-slate-700">{message}</p>}
  </section>;
}
