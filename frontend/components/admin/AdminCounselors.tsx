/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import {
  AdminApi,
  AdminCounselor,
  AdminCounselorAssignment,
} from '@/lib/api/adminApi';
import StatusBadge from '@/components/shared/StatusBadge';
import { AdminErrorState, AdminLoading, AdminPanel, formatDate, formatDateTime } from './adminShared';

export default function AdminCounselors() {
  const [rows, setRows] = useState<AdminCounselor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignmentsFor, setAssignmentsFor] = useState<AdminCounselor | null>(null);
  const [assignments, setAssignments] = useState<AdminCounselorAssignment[] | null>(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await AdminApi.getCounselors());
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách cố vấn');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAssignments = async (counselor: AdminCounselor) => {
    setAssignmentsFor(counselor);
    setAssignments(null);
    setAssignmentsLoading(true);
    try {
      setAssignments(await AdminApi.getCounselorAssignments(counselor.id));
    } catch (err: any) {
      setError(err?.message || 'Không thể tải phân công');
      setAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  if (loading && rows.length === 0) return <AdminLoading />;
  if (error && rows.length === 0) return <AdminErrorState message={error} onRetry={load} />;

  return (
    <div className="grid gap-4">
      <div className="ui-table-wrap admin-table-panel">
        <table className="w-full border-collapse min-w-[720px]" aria-label="Danh sách cố vấn">
          <thead>
            <tr>
              <th>Cố vấn</th>
              <th>Email</th>
              <th>Chức danh</th>
              <th>Phân công đang hoạt động</th>
              <th>Ngày tạo</th>
              <th className="text-right w-44">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td data-label="Cố vấn" className="font-semibold text-slate-800">{row.name}</td>
                <td data-label="Email" className="font-mono text-xs text-slate-600">{row.email}</td>
                <td data-label="Chức danh">{row.title || '—'}</td>
                <td data-label="Phân công">
                  <span className={`status-badge ${row.active_assignments > 0 ? 'is-success' : 'is-neutral'}`}>
                    {row.active_assignments} sinh viên
                  </span>
                </td>
                <td data-label="Ngày tạo" className="text-slate-600">{formatDate(row.created_at)}</td>
                <td data-label="Thao tác" className="text-right">
                  <div className="admin-row-actions justify-end">
                    <button type="button" className="ui-btn ui-btn-sm ui-btn-secondary" onClick={() => openAssignments(row)}>
                      <ClipboardList size={14} /> Xem phân công
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[#64748B]">
                  Chưa có cố vấn nào trong hệ thống.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal phân công ── */}
      {assignmentsFor && (
        <div className="ui-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="assignment-modal-title">
          <div className="ui-modal" style={{ maxWidth: 560 }}>
            <div className="ui-modal-header">
              <div>
                <h2 id="assignment-modal-title" className="ui-modal-title">Phân công cố vấn học tập</h2>
                <p className="ui-modal-sub">{assignmentsFor.name} · {assignmentsFor.email}</p>
              </div>
              <button type="button" className="ui-modal-close" onClick={() => setAssignmentsFor(null)} aria-label="Đóng">✕</button>
            </div>
            <div className="ui-modal-body">
              {assignmentsLoading ? (
                <AdminLoading label="Đang tải phân công…" />
              ) : assignments && assignments.length > 0 ? (
                <ul className="grid gap-2.5">
                  {assignments.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] p-3">
                      <span>
                        <strong className="block text-sm text-[#0F172A]">{item.student_name}</strong>
                        <small className="text-xs text-[#64748B]">{item.student_email}</small>
                        <small className="block text-[11px] text-[#94A3B8] mt-0.5">
                          Sinh viên đồng ý lúc: {formatDateTime(item.consented_at)}
                        </small>
                      </span>
                      <StatusBadge
                        status={item.status}
                        label={item.status === 'active' ? 'Đang theo' : 'Đã thu hồi'}
                        size="sm"
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-[#64748B]">Chưa có sinh viên nào cấp quyền cho cố vấn này.</p>
              )}
            </div>
            <div className="ui-modal-footer">
              <button type="button" className="ui-btn ui-btn-secondary" onClick={() => setAssignmentsFor(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <AdminPanel title="Quy tắc phân công">
          <p className="text-sm text-[#475569] leading-relaxed">
            Sinh viên chủ động cấp quyền xem tiến độ cho cố vấn. Admin không can thiệp trực tiếp vào
            từng phân công; số liệu trên chỉ để giám sát tổng thể.
          </p>
        </AdminPanel>
      )}
    </div>
  );
}
