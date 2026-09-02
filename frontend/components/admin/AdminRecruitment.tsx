/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { EyeOff, Eye, RefreshCw } from 'lucide-react';
import {
  AdminApi,
  AdminApplicationRow,
  AdminReferralRow,
  AdminRecruitmentData,
  AdminRecruitmentJob,
} from '@/lib/api/adminApi';
import AppPagination from '@/components/shared/AppPagination';
import PageTabs from '@/components/shared/PageTabs';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  AdminDonutChart,
  AdminErrorState,
  AdminKpiGrid,
  AdminLoading,
  AdminProgressBarChart,
  formatDate,
  formatDateTime,
} from './adminShared';

type RecruitmentTab = 'jobs' | 'applications' | 'referrals';

const APPLICATION_PAGE_SIZE = 15;

export default function AdminRecruitment() {
  const [data, setData] = useState<AdminRecruitmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<RecruitmentTab>('jobs');
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [appOffset, setAppOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await AdminApi.getRecruitment({ limit: 200 }));
    } catch (err: any) {
      setError(err?.message || 'Không thể tải dữ liệu tuyển dụng');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const togglePublication = async (job: AdminRecruitmentJob) => {
    setBusyJobId(job.id);
    try {
      await AdminApi.setJobPublication(job.id, !job.is_published);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Không thể đổi trạng thái đăng tin');
    } finally {
      setBusyJobId(null);
    }
  };

  if (loading && !data) return <AdminLoading />;
  if (error && !data) return <AdminErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const stats = data.stats;

  return (
    <div className="grid gap-4">
      <AdminKpiGrid
        items={[
          { label: 'Tổng tin tuyển dụng', value: stats.total_jobs, hint: `${stats.published_jobs} tin đang mở`, color: 'emerald' },
          { label: 'Đang mở tuyển', value: stats.published_jobs, hint: 'Ứng viên có thể nộp', color: 'blue' },
          { label: 'Tổng ứng tuyển', value: stats.total_applications, hint: `${stats.total_referrals} từ tiến cử`, color: 'amber' },
          { label: 'Tiến cử từ cố vấn', value: stats.total_referrals, hint: 'Bảo chứng năng lực', color: 'purple' },
        ]}
      />

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AdminDonutChart
          title="Tỷ lệ Trạng thái Tin tuyển dụng"
          segments={[
            { label: 'Đang đăng tuyển', value: stats.published_jobs, color: '#006948' },
            { label: 'Bản nháp / Ẩn', value: Math.max(0, stats.total_jobs - stats.published_jobs), color: '#94A3B8' },
          ]}
          centerLabel="Tin JD"
        />

        <AdminProgressBarChart
          title="Phân bổ Nguồn Hồ sơ Ứng tuyển"
          items={[
            { label: 'Cố vấn tiến cử trực tiếp', value: stats.total_referrals, color: '#006948' },
            { label: 'Sinh viên tự ứng tuyển', value: Math.max(0, stats.total_applications - stats.total_referrals), color: '#0284C7' },
          ]}
        />
      </div>

      {error && <AdminErrorState message={error} onRetry={load} />}

      <PageTabs
        ariaLabel="Dữ liệu tuyển dụng"
        activeTab={tab}
        onChange={(next) => setTab(next as RecruitmentTab)}
        tabs={[
          { id: 'jobs', label: `Tin tuyển dụng (${data.jobs.length})` },
          { id: 'applications', label: `Ứng tuyển (${data.applications.length})` },
          { id: 'referrals', label: `Tiến cử (${data.referrals.length})` },
        ]}
      />

      {tab === 'jobs' && (
        <div className="ui-table-wrap admin-table-panel">
          <table className="w-full border-collapse min-w-[760px]" aria-label="Tin tuyển dụng">
            <thead>
              <tr>
                <th>Vị trí</th>
                <th>Công ty / Đơn vị</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th className="text-right w-36">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((job) => (
                <tr key={job.id}>
                  <td data-label="Vị trí">
                    <span className="block font-semibold">{job.title}</span>
                    {job.company && <small className="admin-meta">{job.company}</small>}
                  </td>
                  <td data-label="Công ty / Đơn vị">{job.company || job.enterprise || '—'}</td>
                  <td data-label="Trạng thái">
                    <StatusBadge
                      status={job.is_published ? 'active' : 'draft'}
                      label={job.is_published ? 'Đang đăng' : 'Nháp / ẩn'}
                      size="sm"
                      showIcon={false}
                    />
                  </td>
                  <td data-label="Ngày tạo">{formatDate(job.created_at)}</td>
                  <td data-label="Thao tác" className="text-right">
                    <div className="admin-row-actions justify-end">
                      <button
                        type="button"
                        className="ui-btn ui-btn-sm ui-btn-secondary"
                        disabled={busyJobId === job.id}
                        onClick={() => togglePublication(job)}
                      >
                        {job.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                        {job.is_published ? 'Gỡ đăng' : 'Đăng tin'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.jobs.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-[#64748B]">Chưa có tin tuyển dụng nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'applications' && (
        <>
          <div className="ui-table-wrap admin-table-panel">
            <table className="w-full border-collapse min-w-[720px]" aria-label="Ứng tuyển">
              <thead>
                <tr>
                  <th>Sinh viên</th>
                  <th>Vị trí</th>
                  <th>Trạng thái</th>
                  <th>Nguồn</th>
                  <th>Điểm khớp</th>
                  <th>Thời điểm</th>
                </tr>
              </thead>
              <tbody>
                {data.applications.slice(appOffset, appOffset + APPLICATION_PAGE_SIZE).map((app: AdminApplicationRow) => (
                  <tr key={app.id}>
                    <td data-label="Sinh viên">{app.student}</td>
                    <td data-label="Vị trí">{app.job_title}</td>
                    <td data-label="Trạng thái"><StatusBadge status={app.status} size="sm" /></td>
                    <td data-label="Nguồn">
                      <span className={`status-badge ${app.source === 'counselor_referral' ? 'is-info-soft' : 'is-neutral'}`}>
                        {app.source === 'counselor_referral' ? 'Cố vấn tiến cử' : 'Tự ứng tuyển'}
                      </span>
                    </td>
                    <td data-label="Điểm khớp">{Math.round(app.match_score)}%</td>
                    <td data-label="Thời điểm">{formatDateTime(app.created_at)}</td>
                  </tr>
                ))}
                {data.applications.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-[#64748B]">Chưa có lượt ứng tuyển nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <AppPagination
            currentPage={Math.floor(appOffset / APPLICATION_PAGE_SIZE) + 1}
            totalPages={Math.max(1, Math.ceil(data.applications.length / APPLICATION_PAGE_SIZE))}
            totalItems={data.applications.length}
            pageSize={APPLICATION_PAGE_SIZE}
            itemLabel="lượt ứng tuyển"
            onPageChange={(page) => setAppOffset((page - 1) * APPLICATION_PAGE_SIZE)}
          />
        </>
      )}

      {tab === 'referrals' && (
        <div className="ui-table-wrap admin-table-panel">
          <table className="w-full border-collapse min-w-[760px]" aria-label="Tiến cử từ cố vấn">
            <thead>
              <tr>
                <th>Sinh viên</th>
                <th>Vị trí</th>
                <th>Cố vấn tiến cử</th>
                <th>Trạng thái</th>
                <th>Điểm khớp</th>
                <th>Thời điểm</th>
              </tr>
            </thead>
            <tbody>
              {data.referrals.map((referral: AdminReferralRow) => (
                <tr key={referral.id}>
                  <td data-label="Sinh viên">{referral.student}</td>
                  <td data-label="Vị trí">{referral.job_title}</td>
                  <td data-label="Cố vấn">{referral.counselor || '—'}</td>
                  <td data-label="Trạng thái"><StatusBadge status={referral.status} size="sm" /></td>
                  <td data-label="Điểm khớp">{Math.round(referral.match_score)}%</td>
                  <td data-label="Thời điểm">{formatDateTime(referral.created_at)}</td>
                </tr>
              ))}
              {data.referrals.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-[#64748B]">Chưa có lượt tiến cử nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" className="ui-btn" onClick={load}>
          <RefreshCw size={15} /> Làm mới dữ liệu
        </button>
      </div>
    </div>
  );
}
