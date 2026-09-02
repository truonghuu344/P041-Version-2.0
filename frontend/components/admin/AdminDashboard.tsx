/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  Settings,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { AdminApi, AdminDashboardData } from '@/lib/api/adminApi';
import { eventLabel } from '@/lib/displayLabels';
import {
  AdminDonutChart,
  AdminErrorState,
  AdminKpiGrid,
  AdminLoading,
  AdminPanel,
  AdminPipelineFunnel,
  formatDateTime,
} from './adminShared';

export default function AdminDashboard({ onNavigate }: { onNavigate: (tab: any) => void }) {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await AdminApi.getDashboard());
    } catch (err: any) {
      setError(err?.message || 'Không thể tải tổng quan hệ thống');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <AdminLoading />;
  if (error && !data) return <AdminErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const counts = data.counts;
  const attention: Array<{ label: string; value: number; tab?: string; tone: 'warning' | 'info' | 'danger' }> = [
    { label: 'Thông báo chưa đọc toàn hệ thống', value: counts.unread_notifications ?? 0, tab: 'system', tone: 'info' },
    { label: 'Ứng tuyển từ kênh tiến cử', value: counts.referrals ?? 0, tab: 'recruitment', tone: 'info' },
  ];

  const studentsCount = counts.students || 0;
  const counselorsCount = counts.counselors || 0;
  const otherUsers = Math.max(0, (counts.users || 0) - studentsCount - counselorsCount);

  const userSegments = [
    { label: 'Sinh viên', value: studentsCount, color: '#006948' },
    { label: 'Cố vấn học tập', value: counselorsCount, color: '#0284C7' },
    { label: 'Quản trị & Khác', value: otherUsers, color: '#8B5CF6' },
  ];

  const pipelineSteps = [
    { label: 'Tin tuyển dụng', count: counts.jobs || 0, subText: 'Vị trí JD đang phát hành', color: '#006948' },
    { label: 'Hồ sơ ứng tuyển', count: counts.applications || 0, subText: 'Tổng lượt nộp hồ sơ', color: '#0284C7' },
    { label: 'Tiến cử cố vấn', count: counts.referrals || 0, subText: 'Ứng viên được bảo chứng', color: '#F59E0B' },
    { label: 'Người dùng tích cực', count: studentsCount + counselorsCount, subText: 'Sinh viên & Cố vấn', color: '#10B981' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. TOP STATS ROW */}
      <AdminKpiGrid
        items={[
          {
            label: 'Tổng người dùng',
            value: counts.users,
            hint: `${studentsCount} SV · ${counselorsCount} Cố vấn`,
            icon: Users,
            color: 'emerald',
          },
          {
            label: 'Tin tuyển dụng',
            value: counts.jobs,
            hint: 'Vị trí JD đang phát hành',
            icon: BriefcaseBusiness,
            color: 'blue',
          },
          {
            label: 'Hồ sơ ứng tuyển',
            value: counts.applications,
            hint: `${counts.referrals || 0} hồ sơ từ tiến cử`,
            icon: FileText,
            color: 'amber',
          },
          {
            label: 'Tiến cử từ cố vấn',
            value: counts.referrals || 0,
            hint: 'Bảo chứng năng lực sinh viên',
            icon: CheckCircle2,
            color: 'purple',
          },
        ]}
      />

      {/* 2. VISUAL CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <AdminDonutChart
            title="Cơ cấu Người dùng Nền tảng"
            segments={userSegments}
            centerLabel="Tài khoản"
          />
        </div>
        <div className="lg:col-span-2">
          <AdminPipelineFunnel steps={pipelineSteps} />
        </div>
      </div>

      {/* 3. ATTENTION & ACTIVITY GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminPanel
          title={
            <span className="inline-flex items-center gap-2 text-slate-900 font-bold font-['Plus_Jakarta_Sans']">
              <ShieldAlert size={18} className="text-amber-500" /> Cần chú ý
            </span>
          }
        >
          <div className="space-y-3">
            {attention.map((item) => (
              <button
                key={item.label}
                type="button"
                className="w-full p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-emerald-200 transition-all flex items-center justify-between gap-3 text-left group shadow-2xs"
                onClick={() => item.tab && onNavigate(item.tab)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-base ${
                      item.tone === 'danger'
                        ? 'bg-rose-100 text-rose-700'
                        : item.tone === 'warning'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-sky-100 text-sky-700'
                    }`}
                  >
                    {item.value}
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-[#006948] transition-colors font-['Plus_Jakarta_Sans'] block">
                      {item.label}
                    </span>
                    <span className="text-[11px] text-slate-500 font-['Inter']">
                      Bấm để chuyển đến mục quản lý
                    </span>
                  </div>
                </div>

                {item.tab && (
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0 ${
                      item.tone === 'danger'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : item.tone === 'warning'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-sky-50 text-sky-700 border border-sky-200'
                    }`}
                  >
                    Xem ngay →
                  </span>
                )}
              </button>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel
          title={
            <span className="inline-flex items-center gap-2 text-slate-900 font-bold font-['Plus_Jakarta_Sans']">
              <Activity size={18} className="text-emerald-600" /> Dòng sự kiện Hệ thống
            </span>
          }
          actions={<span className="text-xs text-slate-500 font-medium font-mono">12 sự kiện mới nhất</span>}
        >
          <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
            {data.recent_activity.length === 0 && (
              <p className="text-xs text-slate-500 py-6 text-center">Chưa có hoạt động nào được ghi nhận.</p>
            )}
            {data.recent_activity.map((event) => (
              <div
                key={event.id}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 flex items-center justify-between gap-3 text-xs transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <div className="truncate">
                    <strong className="text-slate-800 font-semibold">{eventLabel(event.event)}</strong>
                    {event.user_name && <span className="text-slate-500"> · {event.user_name}</span>}
                  </div>
                </div>
                <small className="text-slate-600 shrink-0 font-mono text-[11px]">
                  {formatDateTime(event.created_at)}
                </small>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>

      {/* 4. QUICK SHORTCUTS */}
      <AdminPanel title="Truy cập Nhanh Phân hệ">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { tab: 'users', label: 'Quản lý Người dùng', icon: Users, color: 'hover:border-emerald-300 hover:bg-emerald-50/50' },
            { tab: 'counselors', label: 'Cố vấn Học tập', icon: CheckCircle2, color: 'hover:border-sky-300 hover:bg-sky-50/50' },
            { tab: 'recruitment', label: 'Giám sát Tuyển dụng', icon: BriefcaseBusiness, color: 'hover:border-amber-300 hover:bg-amber-50/50' },
            { tab: 'system', label: 'Hệ thống & AI Engine', icon: Settings, color: 'hover:border-purple-300 hover:bg-purple-50/50' },
          ].map(({ tab: target, label, icon: Icon, color }) => (
            <button
              key={target}
              type="button"
              className={`p-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold flex items-center gap-2.5 transition-all shadow-2xs font-['Plus_Jakarta_Sans'] ${color}`}
              onClick={() => onNavigate(target)}
            >
              <Icon size={16} className="text-[#006948]" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </AdminPanel>
    </div>
  );
}
