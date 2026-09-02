/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Eye, Megaphone, Search, X } from 'lucide-react';
import {
  AdminApi,
  AdminAuditLog,
  AdminNotificationRow,
  AdminSystemData,
} from '@/lib/api/adminApi';
import { describeAuditDetails } from '@/lib/auditDetails';
import { AUDIT_EVENT_OPTIONS, eventLabel } from '@/lib/displayLabels';
import AppConfirmDialog from '@/components/shared/AppConfirmDialog';
import AppPagination from '@/components/shared/AppPagination';
import PageTabs from '@/components/shared/PageTabs';
import StatusBadge from '@/components/shared/StatusBadge';
import AdminAiUsage from './AdminAiUsage';
import {
  AdminDonutChart,
  AdminErrorState,
  AdminKpiGrid,
  AdminLoading,
  AdminProgressBarChart,
  AdminToolbar,
  formatDateTime,
  roleLabel,
} from './adminShared';

type SystemTab = 'audit' | 'notifications' | 'broadcast' | 'ai';

const AUDIT_PAGE_SIZE = 20;
const NOTIFICATION_PAGE_SIZE = 20;

const CATEGORY_LABELS: Record<string, string> = {
  application: 'Ứng tuyển',
  job: 'Việc làm',
  interview: 'Phỏng vấn',
  advisor: 'Cố vấn',
  candidate: 'Ứng viên',
  message: 'Tin nhắn',
  offer: 'Offer',
  system: 'Hệ thống',
};

/** Luôn trả về nhãn tiếng Việt, không in mã danh mục thô ra UI. */
const categoryLabel = (value?: string | null): string =>
  (value ? CATEGORY_LABELS[value] : undefined) || 'Danh mục khác';

export default function AdminSystem() {
  const [tab, setTab] = useState<SystemTab>('audit');
  const [systemData, setSystemData] = useState<AdminSystemData | null>(null);
  const [error, setError] = useState('');

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditEvent, setAuditEvent] = useState('');
  const [auditSearchInput, setAuditSearchInput] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  // Notifications
  const [notifications, setNotifications] = useState<AdminNotificationRow[]>([]);
  const [notificationTotal, setNotificationTotal] = useState(0);
  const [notificationOffset, setNotificationOffset] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [notifLoading, setNotifLoading] = useState(false);

  // Broadcast
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastRoles, setBroadcastRoles] = useState<Array<'student' | 'counselor'>>(['student']);
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState('');
  const [confirmBroadcast, setConfirmBroadcast] = useState(false);

  useEffect(() => {
    AdminApi.getSystem()
      .then(setSystemData)
      .catch((err: any) => setError(err?.message || 'Không thể tải số liệu hệ thống'));
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const page = await AdminApi.getAuditLogs({
        event: auditEvent || undefined,
        search: auditSearch || undefined,
        limit: AUDIT_PAGE_SIZE,
        offset: auditOffset,
      });
      setAuditLogs(page.items);
      setAuditTotal(page.total);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải nhật ký hệ thống');
    } finally {
      setAuditLoading(false);
    }
  }, [auditEvent, auditSearch, auditOffset]);

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const page = await AdminApi.getNotifications({
        category: categoryFilter || undefined,
        role: roleFilter || undefined,
        limit: NOTIFICATION_PAGE_SIZE,
        offset: notificationOffset,
      });
      setNotifications(page.items);
      setNotificationTotal(page.total);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải thông báo');
    } finally {
      setNotifLoading(false);
    }
  }, [categoryFilter, roleFilter, notificationOffset]);

  useEffect(() => {
    if (tab === 'audit') loadAudit();
    if (tab === 'notifications') loadNotifications();
  }, [tab, loadAudit, loadNotifications]);

  const sendBroadcast = async () => {
    setBroadcastBusy(true);
    setError('');
    try {
      const result = await AdminApi.broadcast({
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        target_roles: broadcastRoles,
        priority: 'normal',
      });
      setBroadcastResult(`Đã gửi tới ${result.delivered} tài khoản.`);
      setBroadcastOpen(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
      setConfirmBroadcast(false);
      await loadNotifications();
    } catch (err: any) {
      setError(err?.message || 'Không thể gửi thông báo');
    } finally {
      setBroadcastBusy(false);
    }
  };

  const toggleRole = (role: 'student' | 'counselor') => {
    setBroadcastRoles((prev) =>
      prev.includes(role)
        ? prev.length > 1
          ? prev.filter((r) => r !== role)
          : prev
        : [...prev, role],
    );
  };

  return (
    <div className="space-y-6">
      {systemData && (
        <>
          {/* 1. TOP BALANCED ROW: SYSTEM HEALTH & OPERATIONS VOLUME */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* System Health Diagnostics (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs h-full min-h-[220px] flex flex-col justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-slate-900">
                        Tình trạng Hạ tầng & Giám sát Kỹ thuật
                      </h3>
                      <span className="text-[11px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                        Ổn định 100%
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-['Inter'] mt-0.5">
                      API Gateway, AI Engine và Database đang vận hành bình thường
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-mono shrink-0 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                  <span>Latency: <strong className="text-emerald-700 font-semibold">&lt; 120ms</strong></span>
                  <span>•</span>
                  <span>Region: <strong className="text-slate-700">ap-southeast-1</strong></span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70 hover:bg-slate-50 transition-all flex flex-col justify-between h-[68px]">
                  <span className="text-slate-500 block text-[11px]">API Gateway</span>
                  <strong className="text-emerald-700 font-semibold flex items-center gap-1.5 mt-1 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 200 OK
                  </strong>
                </div>
                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70 hover:bg-slate-50 transition-all flex flex-col justify-between h-[68px]">
                  <span className="text-slate-500 block text-[11px]">AI Model Core</span>
                  <strong className="text-emerald-700 font-semibold flex items-center gap-1.5 mt-1 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Gemini 2.5
                  </strong>
                </div>
                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70 hover:bg-slate-50 transition-all flex flex-col justify-between h-[68px]">
                  <span className="text-slate-500 block text-[11px]">PostgreSQL DB</span>
                  <strong className="text-emerald-700 font-semibold flex items-center gap-1.5 mt-1 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Synced
                  </strong>
                </div>
                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70 hover:bg-slate-50 transition-all flex flex-col justify-between h-[68px]">
                  <span className="text-slate-500 block text-[11px]">Bảo mật & Phiên</span>
                  <strong className="text-emerald-700 font-semibold flex items-center gap-1.5 mt-1 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> JWT Active
                  </strong>
                </div>
              </div>
            </div>

            {/* Operations Volume Breakdown (5 cols) */}
            <div className="lg:col-span-5 h-full">
              <AdminProgressBarChart
                title="Khối lượng Vận hành Hệ thống"
                className="h-full min-h-[220px]"
                items={[
                  { label: 'Nhật ký sự kiện (Audit Logs)', value: systemData.usage_event_count, color: '#006948' },
                  { label: 'Thông báo phát đi', value: systemData.notification_count, color: '#0284C7' },
                  { label: 'Lượt tương tác AI Agent', value: systemData.ai_log_count, color: '#8B5CF6' },
                ]}
              />
            </div>
          </div>

          {/* 2. CORE KPIS ROW */}
          <AdminKpiGrid
            items={[
              { label: 'Sự kiện hệ thống', value: systemData.usage_event_count, hint: 'Tổng audit actions', color: 'emerald' },
              { label: 'Thông báo đã phát', value: systemData.notification_count, hint: `${systemData.unread_notification_count} chưa đọc`, color: 'blue' },
              { label: 'Chưa đọc toàn hệ thống', value: systemData.unread_notification_count, hint: 'Tỷ lệ tương tác', color: 'amber' },
              { label: 'Lượt gọi AI Engine', value: systemData.ai_log_count, hint: 'Gemini 2.5 Flash', color: 'purple' },
            ]}
          />
        </>
      )}

      {error && <AdminErrorState message={error} onRetry={() => setError('')} />}

      {/* 3. FUNCTION TABS */}
      <PageTabs
        ariaLabel="Công cụ hệ thống"
        activeTab={tab}
        onChange={(next) => setTab(next as SystemTab)}
        tabs={[
          { id: 'audit', label: 'Nhật ký hoạt động' },
          { id: 'notifications', label: 'Thông báo toàn hệ thống' },
          { id: 'broadcast', label: 'Gửi thông báo' },
          { id: 'ai', label: 'Sử dụng trợ lý AI' },
        ]}
      />

      {tab === 'audit' && (
        <>
          <AdminToolbar>
            <form
              className="ui-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                setAuditOffset(0);
                setAuditSearch(auditSearchInput.trim());
              }}
            >
              <Search size={18} className="ui-search-icon" />
              <input
                type="search"
                className="ui-search-input"
                placeholder="Tìm theo sự kiện hoặc người dùng…"
                value={auditSearchInput}
                onChange={(event) => setAuditSearchInput(event.target.value)}
                aria-label="Tìm nhật ký"
              />
            </form>
            <select
              className="ui-select max-w-[260px]"
              value={auditEvent}
              onChange={(event) => {
                setAuditOffset(0);
                setAuditEvent(event.target.value);
              }}
              aria-label="Lọc theo loại hoạt động"
            >
              <option value="">Mọi loại hoạt động</option>
              {AUDIT_EVENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </AdminToolbar>

          {auditLoading && auditLogs.length === 0 ? (
            <AdminLoading />
          ) : (
            <div className="ui-table-wrap admin-table-panel">
              <table className="w-full border-collapse min-w-[760px]" aria-label="Nhật ký hoạt động">
                <thead>
                  <tr>
                    <th>Sự kiện</th>
                    <th>Người dùng</th>
                    <th>Thời gian</th>
                    <th>Chi tiết</th>
                    <th className="text-right w-32">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => {
                    const detailLines = describeAuditDetails(log.metadata_json);
                    return (
                      <tr
                        key={log.id}
                        className="cursor-pointer hover:bg-slate-50/80 transition-colors group"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td data-label="Sự kiện">
                          <span
                            className={`status-badge ${log.event_name.includes('fail') ? 'is-warning' : 'is-neutral'}`}
                          >
                            {eventLabel(log.event_name)}
                          </span>
                        </td>
                        <td data-label="Người dùng" className="font-semibold text-slate-800">
                          {log.user_name || 'Khách / hệ thống'}
                        </td>
                        <td data-label="Thời gian" className="text-slate-600 font-mono text-xs">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td data-label="Chi tiết" className="max-w-[340px] !align-top">
                          {detailLines.length > 0 ? (
                            <ul className="ui-audit-details">
                              {detailLines.slice(0, 2).map((line) => (
                                <li key={line.label}>
                                  <span>{line.label}:</span> <strong>{line.value}</strong>
                                </li>
                              ))}
                              {detailLines.length > 2 && (
                                <li className="text-[11px] text-emerald-700 font-medium">
                                  +{detailLines.length - 2} thông số khác…
                                </li>
                              )}
                            </ul>
                          ) : log.duration_ms ? (
                            <span className="text-[12px] text-[#475569]">Thời lượng xử lý: {log.duration_ms} ms</span>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>
                        <td data-label="Thao tác" className="text-right">
                          <button
                            type="button"
                            className="ui-btn ui-btn-sm ui-btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                          >
                            <Eye size={14} /> Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {auditLogs.length === 0 && (
                    <tr><td colSpan={5} className="py-10 text-center text-[#64748B]">Chưa có sự kiện nào được ghi nhận.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <AppPagination
            currentPage={Math.floor(auditOffset / AUDIT_PAGE_SIZE) + 1}
            totalPages={Math.max(1, Math.ceil(auditTotal / AUDIT_PAGE_SIZE))}
            totalItems={auditTotal}
            pageSize={AUDIT_PAGE_SIZE}
            itemLabel="sự kiện"
            onPageChange={(page) => setAuditOffset((page - 1) * AUDIT_PAGE_SIZE)}
          />
        </>
      )}

      {tab === 'notifications' && (
        <>
          {systemData && (
            <div className="space-y-4 mb-2">
              <AdminDonutChart
                title="Phân bổ Danh mục Thông báo Toàn Hệ thống"
                segments={
                  Object.keys(systemData.notification_categories).length > 0
                    ? Object.entries(systemData.notification_categories).map(([k, v], idx) => ({
                        label: categoryLabel(k),
                        value: Number(v),
                        color: ['#006948', '#0284C7', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981'][idx % 6],
                      }))
                    : [{ label: 'Thông báo hệ thống', value: systemData.notification_count, color: '#006948' }]
                }
                centerLabel="Thông báo"
              />

              {Object.keys(systemData.notification_categories).length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#64748B] mr-1">
                    Lọc nhanh theo danh mục:
                  </span>
                  <button
                    type="button"
                    className={`status-badge cursor-pointer transition-colors ${!categoryFilter ? 'is-active bg-emerald-50 text-emerald-800 border-emerald-300' : 'is-neutral hover:border-[#006948]'}`}
                    onClick={() => {
                      setCategoryFilter('');
                      setNotificationOffset(0);
                    }}
                  >
                    Tất cả · {systemData.notification_count}
                  </button>
                  {Object.entries(systemData.notification_categories).map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      className={`status-badge cursor-pointer transition-colors ${categoryFilter === key ? 'is-active bg-emerald-50 text-emerald-800 border-emerald-300' : 'is-neutral hover:border-[#006948]'}`}
                      onClick={() => {
                        setCategoryFilter(key);
                        setNotificationOffset(0);
                      }}
                      title="Nhấn để lọc thông báo theo danh mục"
                    >
                      {categoryLabel(key)} · {value}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <AdminToolbar>
            <select
              className="ui-select"
              value={categoryFilter}
              onChange={(event) => {
                setNotificationOffset(0);
                setCategoryFilter(event.target.value);
              }}
              aria-label="Lọc danh mục"
            >
              <option value="">Mọi danh mục</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              className="ui-select"
              value={roleFilter}
              onChange={(event) => {
                setNotificationOffset(0);
                setRoleFilter(event.target.value);
              }}
              aria-label="Lọc vai trò nhận"
            >
              <option value="">Mọi vai trò</option>
              <option value="student">Sinh viên</option>
              <option value="counselor">Cố vấn</option>
              <option value="admin">Quản trị viên</option>
            </select>
            <div className="ui-toolbar-actions">
              <button type="button" className="ui-btn ui-btn-primary" onClick={() => setBroadcastOpen(true)}>
                <Megaphone size={16} /> Gửi thông báo mới
              </button>
            </div>
          </AdminToolbar>

          {notifLoading && notifications.length === 0 ? (
            <AdminLoading />
          ) : (
            <div className="ui-table-wrap admin-table-panel">
              <table className="w-full border-collapse min-w-[820px]" aria-label="Thông báo toàn hệ thống">
                <thead>
                  <tr>
                    <th>Tiêu đề</th>
                    <th>Người nhận</th>
                    <th>Danh mục</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Tiêu đề">
                        <span className="block font-semibold">{item.title}</span>
                        <small className="admin-meta">{item.message.length > 90 ? `${item.message.slice(0, 90)}…` : item.message}</small>
                      </td>
                      <td data-label="Người nhận">
                        <span className="block">{item.recipient_name || 'Người dùng không còn tồn tại'}</span>
                        <small className="admin-meta">{roleLabel(item.recipient_role)}</small>
                      </td>
                      <td data-label="Danh mục">{categoryLabel(item.category)}</td>
                      <td data-label="Trạng thái">
                        <StatusBadge
                          status={item.is_read ? 'reviewed' : 'submitted'}
                          label={item.is_read ? 'Đã đọc' : 'Chưa đọc'}
                          size="sm"
                          showIcon={false}
                        />
                      </td>
                      <td data-label="Thời gian">{formatDateTime(item.created_at)}</td>
                    </tr>
                  ))}
                  {notifications.length === 0 && (
                    <tr><td colSpan={5} className="py-10 text-center text-[#64748B]">Chưa có thông báo nào phù hợp bộ lọc.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <AppPagination
            currentPage={Math.floor(notificationOffset / NOTIFICATION_PAGE_SIZE) + 1}
            totalPages={Math.max(1, Math.ceil(notificationTotal / NOTIFICATION_PAGE_SIZE))}
            totalItems={notificationTotal}
            pageSize={NOTIFICATION_PAGE_SIZE}
            itemLabel="thông báo"
            onPageChange={(page) => setNotificationOffset((page - 1) * NOTIFICATION_PAGE_SIZE)}
          />
        </>
      )}

      {tab === 'ai' && <AdminAiUsage />}

      {tab === 'broadcast' && (
        <section className="admin-panel" style={{ maxWidth: 640 }}>
          <div className="admin-panel-title">
            <h2>Gửi thông báo nền tảng</h2>
          </div>
          <p className="text-sm text-[#475569] mb-4">
            Thông báo sẽ xuất hiện trong hộp thư của mọi tài khoản thuộc các vai trò được chọn.
          </p>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setConfirmBroadcast(true);
            }}
          >
            <label className="grid gap-1.5 text-xs font-semibold text-[#475569]">
              Tiêu đề
              <input
                type="text"
                required
                minLength={4}
                maxLength={255}
                className="ui-search-input !pl-3.5"
                value={broadcastTitle}
                onChange={(event) => setBroadcastTitle(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-[#475569]">
              Nội dung
              <textarea
                required
                minLength={4}
                maxLength={4000}
                rows={4}
                className="ui-search-input !pl-3.5 !py-2.5 h-auto"
                value={broadcastMessage}
                onChange={(event) => setBroadcastMessage(event.target.value)}
              />
            </label>
            <fieldset className="grid gap-2">
              <legend className="text-xs font-semibold text-[#475569] mb-1">Gửi tới</legend>
              {([
                { key: 'student', label: 'Sinh viên' },
                { key: 'counselor', label: 'Cố vấn' },
              ] as const).map(({ key, label }) => (
                <label key={key} className="inline-flex items-center gap-2 text-sm text-[#0F172A]">
                  <input
                    type="checkbox"
                    checked={broadcastRoles.includes(key)}
                    onChange={(event) =>
                      setBroadcastRoles((prev) =>
                        event.target.checked ? [...prev, key] : prev.filter((role) => role !== key),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                className="ui-btn ui-btn-secondary"
                onClick={() => {
                  setBroadcastTitle('');
                  setBroadcastMessage('');
                  setBroadcastRoles(['student']);
                  setBroadcastResult('');
                }}
              >
                Nháp lại
              </button>
              <button type="submit" className="ui-btn ui-btn-primary" disabled={broadcastRoles.length === 0}>
                <Megaphone size={16} /> Gửi thông báo
              </button>
            </div>
            {broadcastResult && (
              <p className="rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] p-3 text-sm font-medium text-[#047857]">
                {broadcastResult}
              </p>
            )}
          </form>
        </section>
      )}

      {/* ── Modal soạn thông báo nhanh (từ tab thông báo) ── */}
      {broadcastOpen && tab === 'notifications' && (
        <div className="ui-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="quick-broadcast-title">
          <div className="ui-modal" style={{ maxWidth: 480 }}>
            <div className="ui-modal-header">
              <h2 id="quick-broadcast-title" className="ui-modal-title">Gửi thông báo nền tảng</h2>
              <button type="button" className="ui-modal-close" onClick={() => setBroadcastOpen(false)} aria-label="Đóng">✕</button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setConfirmBroadcast(true);
              }}
            >
              <div className="ui-modal-body grid gap-4">
                <label className="grid gap-1.5 text-xs font-semibold text-[#475569]">
                  Tiêu đề
                  <input
                    type="text"
                    required
                    minLength={4}
                    className="ui-search-input !pl-3.5"
                    value={broadcastTitle}
                    onChange={(event) => setBroadcastTitle(event.target.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-[#475569]">
                  Nội dung
                  <textarea
                    required
                    minLength={4}
                    rows={3}
                    className="ui-search-input !pl-3.5 !py-2.5 h-auto"
                    value={broadcastMessage}
                    onChange={(event) => setBroadcastMessage(event.target.value)}
                  />
                </label>
                <fieldset className="grid gap-2">
                  <legend className="text-xs font-semibold text-[#475569] mb-1">Gửi tới</legend>
                  {([
                    { key: 'student', label: 'Sinh viên' },
                    { key: 'counselor', label: 'Cố vấn' },
                      ] as const).map(({ key, label }) => (
                    <label key={key} className="inline-flex items-center gap-2 text-sm text-[#0F172A] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={broadcastRoles.includes(key)}
                        onChange={() => toggleRole(key)}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
              </div>
              <div className="ui-modal-footer">
                <button type="button" className="ui-btn ui-btn-secondary" onClick={() => setBroadcastOpen(false)}>Hủy bỏ</button>
                <button type="submit" className="ui-btn ui-btn-primary" disabled={broadcastRoles.length === 0}>Tiếp tục</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal xem chi tiết nhật ký Audit Log ── */}
      {selectedLog && (
        <div
          className="ui-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-detail-title"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="ui-modal"
            style={{ maxWidth: 580 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ui-modal-header">
              <div className="flex items-center gap-2">
                <span
                  className={`status-badge ${selectedLog.event_name.includes('fail') ? 'is-warning' : 'is-neutral'}`}
                >
                  {eventLabel(selectedLog.event_name)}
                </span>
                <h2 id="audit-detail-title" className="ui-modal-title text-base">
                  Chi tiết Nhật ký Sự kiện
                </h2>
              </div>
              <button
                type="button"
                className="ui-modal-close"
                onClick={() => setSelectedLog(null)}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="ui-modal-body space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Người thực hiện:</span>
                  <strong className="text-slate-800 text-sm font-semibold">
                    {selectedLog.user_name || 'Khách / Hệ thống'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Thời điểm ghi nhận:</span>
                  <strong className="text-slate-800 font-mono">
                    {formatDateTime(selectedLog.created_at)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Mã sự kiện:</span>
                  <code className="text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px] font-mono">
                    {selectedLog.event_name}
                  </code>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Thời lượng xử lý:</span>
                  <strong className="text-emerald-700 font-mono">
                    {selectedLog.duration_ms ? `${selectedLog.duration_ms} ms` : '—'}
                  </strong>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-['Plus_Jakarta_Sans']">
                  Thông số chi tiết đã phân tích
                </h4>
                {describeAuditDetails(selectedLog.metadata_json).length > 0 ? (
                  <div className="rounded-xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden text-xs">
                    {describeAuditDetails(selectedLog.metadata_json).map((line, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-3 bg-white hover:bg-slate-50">
                        <span className="text-slate-500 font-medium">{line.label}</span>
                        <strong className="text-slate-800 text-right">{line.value}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-2">Không có thêm tham số metadata.</p>
                )}
              </div>

              {selectedLog.metadata_json && Object.keys(selectedLog.metadata_json).length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                      Dữ liệu JSON thô (Raw Payload)
                    </h4>
                    <button
                      type="button"
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(selectedLog.metadata_json, null, 2));
                      }}
                    >
                      <Copy size={12} /> Sao chép JSON
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono max-h-44 overflow-y-auto leading-relaxed">
                    {JSON.stringify(selectedLog.metadata_json, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="ui-modal-footer">
              <button
                type="button"
                className="ui-btn ui-btn-primary"
                onClick={() => setSelectedLog(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      <AppConfirmDialog
        isOpen={confirmBroadcast && Boolean(broadcastTitle) && Boolean(broadcastMessage)}
        onClose={() => setConfirmBroadcast(false)}
        onConfirm={sendBroadcast}
        isLoading={broadcastBusy}
        title="Gửi thông báo này?"
        description={`Thông báo "${broadcastTitle}" sẽ được gửi tới ${broadcastRoles.map((role) => roleLabel(role)).join(', ')}.`}
        confirmLabel="Gửi ngay"
      />
    </div>
  );
}
