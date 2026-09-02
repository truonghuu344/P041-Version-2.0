/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FileSearch, RefreshCw } from 'lucide-react';
import {
  AdminApi,
  AdminInternshipDetail,
  AdminInternshipRow,
  AdminInternshipSummary,
} from '@/lib/api/adminApi';
import StatusBadge from '@/components/shared/StatusBadge';
import { describeDetails } from '@/lib/auditDetails';
import {
  AdminDonutChart,
  AdminErrorState,
  AdminKpiGrid,
  AdminLoading,
  AdminProgressBarChart,
  AdminToolbar,
  formatDate,
} from './adminShared';

const REPORT_LABELS: Record<string, string> = {
  submitted: 'Đã nộp báo cáo',
  reviewed: 'Đã phản hồi',
  pending: 'Chưa đến hạn',
  delayed: 'Trễ hạn',
};

const STATUS_LABELS: Record<string, string> = {
  ongoing: 'Đang thực tập',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ',
};

/** Luôn trả về nhãn tiếng Việt — không bao giờ để lộ mã trạng thái thô ra UI. */
const reportLabel = (value?: string | null): string =>
  (value ? REPORT_LABELS[value] : undefined) || 'Chưa có báo cáo';

const statusLabel = (value?: string | null): string =>
  (value ? STATUS_LABELS[value] : undefined) || 'Trạng thái khác';

export default function AdminInternships() {
  const [rows, setRows] = useState<AdminInternshipRow[]>([]);
  const [summary, setSummary] = useState<AdminInternshipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportFilter, setReportFilter] = useState('');
  const [detail, setDetail] = useState<AdminInternshipDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, summaryData] = await Promise.all([
        AdminApi.getInternships(),
        AdminApi.getInternshipSummary().catch(() => null),
      ]);
      setRows(list);
      setSummary(summaryData);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải dữ liệu thực tập');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (row: AdminInternshipRow) => {
    setDetailLoading(true);
    try {
      setDetail(await AdminApi.getInternshipDetail(row.id));
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading && rows.length === 0) return <AdminLoading />;
  if (error && rows.length === 0) return <AdminErrorState message={error} onRetry={load} />;

  const filtered = reportFilter
    ? rows.filter((row) => row.last_report_status === reportFilter)
    : rows;

  // Đánh giá cuối kỳ được doanh nghiệp gửi dưới dạng dữ liệu thô; đổi sang
  // các dòng "nhãn – giá trị" tiếng Việt để admin đọc trực tiếp trên modal.
  const evaluationLines = describeDetails(detail?.final_evaluation, { maxLength: 400 });

  const reportSegments = summary ? [
    { label: 'Đã nộp báo cáo', value: summary.reports_by_status?.submitted ?? 0, color: '#006948' },
    { label: 'Đã phản hồi', value: summary.reports_by_status?.reviewed ?? 0, color: '#0284C7' },
    { label: 'Chưa đến hạn', value: summary.reports_by_status?.pending ?? 0, color: '#94A3B8' },
    { label: 'Trễ hạn', value: summary.reports_by_status?.delayed ?? 0, color: '#F43F5E' },
  ] : [];

  return (
    <div className="grid gap-4">
      {summary && (
        <>
          <AdminKpiGrid
            items={[
              { label: 'Kỳ thực tập', value: summary.total, hint: 'Hồ sơ sinh viên', color: 'emerald' },
              { label: 'Đang thực tập', value: summary.by_status?.ongoing ?? 0, hint: 'Đang làm việc tại DN', color: 'blue' },
              { label: 'Báo cáo trễ hạn', value: summary.reports_by_status?.delayed ?? 0, hint: 'Cần nhắc nhở sinh viên', color: 'rose' },
              { label: 'Đã có đánh giá cuối', value: summary.evaluated, hint: 'Doanh nghiệp đã chấm', color: 'purple' },
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminDonutChart
              title="Phân bổ Trạng thái Báo cáo Thực tập"
              segments={reportSegments}
              centerLabel="Báo cáo"
            />
            <AdminProgressBarChart
              title="Tiến độ Hoàn thành Đánh giá Thực tập"
              items={[
                { label: 'Đã có đánh giá cuối kỳ', value: summary.evaluated, max: Math.max(1, summary.total), color: '#006948' },
                { label: 'Đang trong tiến trình', value: Math.max(0, summary.total - summary.evaluated), max: Math.max(1, summary.total), color: '#0284C7' },
              ]}
            />
          </div>
        </>
      )}

      <AdminToolbar>
        <select
          className="ui-select"
          value={reportFilter}
          onChange={(event) => setReportFilter(event.target.value)}
          aria-label="Lọc trạng thái báo cáo"
        >
          <option value="">Mọi trạng thái báo cáo</option>
          <option value="pending">Chưa đến hạn</option>
          <option value="submitted">Đã nộp báo cáo</option>
          <option value="reviewed">Đã phản hồi</option>
          <option value="delayed">Trễ hạn</option>
        </select>
        <div className="ui-toolbar-actions">
          <button type="button" className="ui-btn" onClick={load}>
            <RefreshCw size={15} /> Làm mới
          </button>
        </div>
      </AdminToolbar>

      <div className="ui-table-wrap admin-table-panel">
        <table className="w-full border-collapse min-w-[820px]" aria-label="Danh sách kỳ thực tập">
          <thead>
            <tr>
              <th>Sinh viên / Vị trí</th>
              <th>Doanh nghiệp</th>
              <th>Tiến độ</th>
              <th>Báo cáo tuần</th>
              <th>Trạng thái</th>
              <th>Cập nhật</th>
              <th style={{ textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td data-label="Sinh viên">
                  <span className="block font-semibold">{row.student}</span>
                  <small className="admin-meta">{row.position}</small>
                </td>
                <td data-label="Doanh nghiệp">{row.company}</td>
                <td data-label="Tiến độ">
                  <div className="admin-progress">
                    <div className="admin-progress-bar">
                      <span style={{ width: `${Math.min(100, Math.max(0, row.progress_percent))}%` }} />
                    </div>
                    <small>{row.progress_percent}%</small>
                  </div>
                </td>
                <td data-label="Báo cáo tuần">
                  <StatusBadge
                    status={row.last_report_status}
                    label={reportLabel(row.last_report_status)}
                    size="sm"
                    showIcon={false}
                  />
                </td>
                <td data-label="Trạng thái">
                  <StatusBadge
                    status={row.status}
                    label={statusLabel(row.status)}
                    size="sm"
                    showIcon={false}
                  />
                </td>
                <td data-label="Cập nhật">{formatDate(row.updated_at)}</td>
                <td>
                  <div className="admin-row-actions">
                    <button type="button" className="ui-btn ui-btn-sm ui-btn-secondary" onClick={() => openDetail(row)}>
                      <FileSearch size={14} /> Chi tiết
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="py-10 text-center text-[#64748B]">Không có kỳ thực tập nào phù hợp bộ lọc.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal chi tiết kỳ thực tập ── */}
      {(detailLoading || detail) && (
        <div className="ui-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="internship-detail-title">
          <div className="ui-modal" style={{ maxWidth: 600 }}>
            <div className="ui-modal-header">
              <div>
                <h2 id="internship-detail-title" className="ui-modal-title">
                  {detail ? `${detail.student} · ${detail.position}` : 'Chi tiết kỳ thực tập'}
                </h2>
                {detail && (
                  <p className="ui-modal-sub">
                    {detail.company} · Tuần {detail.current_week}/{detail.total_weeks}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="ui-modal-close"
                onClick={() => setDetail(null)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>
            <div className="ui-modal-body">
              {detailLoading && <AdminLoading label="Đang tải chi tiết…" />}
              {detail && (
                <>
                  <dl className="admin-detail-grid">
                    <div><dt>Email sinh viên</dt><dd>{detail.student_email}</dd></div>
                    <div><dt>Địa điểm</dt><dd>{detail.location}</dd></div>
                    <div><dt>Người hướng dẫn</dt><dd>{detail.mentor_name}</dd></div>
                    <div><dt>Email người hướng dẫn</dt><dd>{detail.mentor_email || '—'}</dd></div>
                    <div><dt>Tiến độ</dt><dd>{detail.progress_percent}%</dd></div>
                    <div><dt>Báo cáo gần nhất</dt><dd>{reportLabel(detail.last_report_status)}</dd></div>
                  </dl>

                  <h3 className="text-xs font-bold uppercase tracking-wide text-[#64748B] mt-5 mb-2">Đánh giá cuối kỳ</h3>
                  {evaluationLines.length > 0 ? (
                    <dl className="admin-detail-grid">
                      {evaluationLines.map((line) => (
                        <div key={line.label}>
                          <dt>{line.label}</dt>
                          <dd>{line.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-[#64748B]">Doanh nghiệp chưa gửi đánh giá cuối kỳ.</p>
                  )}
                </>
              )}
            </div>
            <div className="ui-modal-footer">
              <button type="button" className="ui-btn ui-btn-secondary" onClick={() => setDetail(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
