/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, Search } from 'lucide-react';

type ApplicationStatus = 'submitted' | 'shortlisted' | 'interview' | 'hired' | 'rejected';
type Props = { onNavigate: (tab: import('./EnterpriseView').EnterpriseTab) => void };
type Application = { id: string; jd_id: string; jd_title: string; candidate_name: string; candidate_email: string; cv_id: string; match_score: number; status: ApplicationStatus; shared_at: string };
type SharedCV = { title: string; raw_text?: string; parsed_json?: { summary?: string; skills?: string[] } };

const API_BASE_URL =
  typeof window !== 'undefined'
    ? window.__CAREER_API_BASE_URL__ || 'https://p041-version-2-0.onrender.com/api/v1'
    : 'https://p041-version-2-0.onrender.com/api/v1';
const STATUS_LABELS: Record<ApplicationStatus, string> = { submitted: 'Đã nhận', shortlisted: 'Sơ tuyển', interview: 'Mời phỏng vấn', hired: 'Đã tuyển', rejected: 'Không phù hợp' };

async function enterpriseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = window.localStorage.getItem('access_token');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Không thể tải dữ liệu.');
  return data as T;
}

export default function EnterpriseCandidatesList(_props: Props) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [selectedCV, setSelectedCV] = useState<{ application: Application; cv: SharedCV } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadApplications = async () => {
    setLoading(true); setError('');
    try {
      const jobs = await enterpriseRequest<{ id: string }[]>('/enterprise/jds');
      const grouped = await Promise.all(jobs.map((job) => enterpriseRequest<Application[]>(`/enterprise/jds/${job.id}/candidates`)));
      setApplications(grouped.flat());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách ứng viên.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadApplications(); }, []);

  const jobs = useMemo(() => Array.from(new Set(applications.map((item) => item.jd_title))).sort(), [applications]);
  const filteredApplications = applications.filter((application) => {
    const query = searchTerm.trim().toLowerCase();
    return (!query || application.candidate_name.toLowerCase().includes(query) || application.candidate_email.toLowerCase().includes(query) || application.jd_title.toLowerCase().includes(query))
      && (statusFilter === 'all' || application.status === statusFilter)
      && (jobFilter === 'all' || application.jd_title === jobFilter);
  });

  const openCV = async (application: Application) => {
    try { setSelectedCV({ application, cv: await enterpriseRequest<SharedCV>(`/enterprise/applications/${application.id}/cv`) }); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Không thể mở CV.'); }
  };
  const updateStatus = async (application: Application, status: ApplicationStatus) => {
    setUpdatingId(application.id); setError('');
    try {
      const updated = await enterpriseRequest<Application>(`/enterprise/applications/${application.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setApplications((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (selectedCV?.application.id === updated.id) setSelectedCV({ ...selectedCV, application: updated });
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Không thể cập nhật trạng thái.'); }
    finally { setUpdatingId(null); }
  };

  return <div className="enterprise-candidates-list" data-testid="enterprise-candidates-list">
    <header className="recruiter-header"><div className="recruiter-title-wrap"><h1 className="recruiter-page-title">Ứng viên</h1><p className="recruiter-page-subtitle">Hồ sơ sinh viên đã chủ động gửi vào các tin tuyển dụng của công ty.</p></div></header>
    <div className="recruiter-card">
      <div className="recruiter-toolbar"><div className="recruiter-search-wrap"><Search size={18} className="recruiter-search-icon" /><input className="recruiter-search-input" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm theo tên, email hoặc vị trí..." /></div>
        <select className="recruiter-filter-select" value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}><option value="all">Tất cả vị trí</option>{jobs.map((job) => <option key={job} value={job}>{job}</option>)}</select>
        <select className="recruiter-filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ApplicationStatus)}><option value="all">Tất cả trạng thái</option>{(Object.keys(STATUS_LABELS) as ApplicationStatus[]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select>
      </div>
      {error && <p role="alert" style={{ color: '#b42318', margin: '0 0 16px' }}>{error}</p>}
      <div className="recruiter-table-responsive"><table className="recruiter-table" aria-label="Danh sách ứng viên"><thead><tr><th>Ứng viên</th><th>Vị trí</th><th className="align-center">Match</th><th>Trạng thái</th><th>Ngày nộp</th><th className="align-right">Thao tác</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '36px 0' }}>Đang tải ứng viên...</td></tr>
          : filteredApplications.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-secondary)' }}>Chưa có hồ sơ ứng tuyển phù hợp.</td></tr>
          : filteredApplications.map((application) => <tr key={application.id} className="recruiter-table-row">
            <td><div className="recruiter-candidate-cell"><div className="recruiter-candidate-avatar">{application.candidate_name.charAt(0).toUpperCase()}</div><div><strong className="recruiter-candidate-name">{application.candidate_name}</strong><small className="recruiter-muted-text">{application.candidate_email}</small></div></div></td>
            <td><span className="recruiter-job-title">{application.jd_title}</span></td><td className="align-center"><span className="recruiter-match-badge">{Number(application.match_score).toFixed(0)}%</span></td>
            <td><select aria-label={`Cập nhật trạng thái ${application.candidate_name}`} className="recruiter-filter-select" disabled={updatingId === application.id} value={application.status} onChange={(event) => void updateStatus(application, event.target.value as ApplicationStatus)}>{(Object.keys(STATUS_LABELS) as ApplicationStatus[]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></td>
            <td><span className="recruiter-muted-text">{new Date(application.shared_at).toLocaleDateString('vi-VN')}</span></td><td className="align-right"><button type="button" className="recruiter-table-action-btn" onClick={() => void openCV(application)}><FileText size={14} /><span>Xem CV</span><ExternalLink size={13} /></button></td>
          </tr>)}
      </tbody></table></div>
    </div>
    {selectedCV && <section className="recruiter-card" style={{ marginTop: 20 }} aria-live="polite"><div className="recruiter-card-header"><div><h2 className="recruiter-card-title">CV đã gửi: {selectedCV.cv.title}</h2><p className="recruiter-muted-text">{selectedCV.application.candidate_name} · {selectedCV.application.jd_title}</p></div><button type="button" className="recruiter-btn-secondary" onClick={() => setSelectedCV(null)}>Đóng</button></div>{selectedCV.cv.parsed_json?.summary && <p>{selectedCV.cv.parsed_json.summary}</p>}{!!selectedCV.cv.parsed_json?.skills?.length && <p><strong>Kỹ năng: </strong>{selectedCV.cv.parsed_json.skills.join(', ')}</p>}<pre style={{ whiteSpace: 'pre-wrap', maxHeight: 460, overflow: 'auto', padding: 16, background: '#f8faf9', borderRadius: 10 }}>{selectedCV.cv.raw_text || 'CV này không có nội dung văn bản để hiển thị.'}</pre></section>}
  </div>;
}
