/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardCheck,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminCounselors from './AdminCounselors';
import AdminRecruitment from './AdminRecruitment';
import AdminSystem from './AdminSystem';
import AdminProfile from './AdminProfile';

export type AdminTab =
  | 'dashboard'
  | 'users'
  | 'counselors'
  | 'recruitment'
  | 'system'
  | 'profile';

export interface AdminViewProps {
  isActive?: boolean;
  initialTab?: AdminTab;
}

export const ADMIN_TABS: { key: AdminTab; label: string; icon: typeof Users }[] = [
  { key: 'dashboard', label: 'Tổng quan', icon: BarChart3 },
  { key: 'users', label: 'Người dùng', icon: Users },
  { key: 'counselors', label: 'Cố vấn', icon: ClipboardCheck },
  { key: 'recruitment', label: 'Tuyển dụng', icon: BriefcaseBusiness },
  { key: 'system', label: 'Hệ thống & AI', icon: Settings },
  { key: 'profile', label: 'Hồ sơ', icon: UserRound },
];

export function parseAdminRoute(pathname: string): AdminTab {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'admin' && parts[1]) {
    const raw = parts[1].toLowerCase();
    if (
      raw === 'users' ||
      raw === 'counselors' ||
      raw === 'recruitment' ||
      raw === 'system' ||
      raw === 'profile'
    ) {
      return raw as AdminTab;
    }
  }
  return 'dashboard';
}

export function adminTabUrl(tab: AdminTab): string {
  return tab === 'dashboard' ? '/admin' : `/admin/${tab}`;
}

export default function AdminView({ isActive = true, initialTab = 'dashboard' }: AdminViewProps) {
  const [tab, setTab] = useState<AdminTab>(initialTab);

  // Sync tab with initialTab when view becomes active or prop updates.
  useEffect(() => {
    if (isActive) {
      setTab(initialTab);
    }
  }, [isActive, initialTab]);

  // Browser Back/Forward support.
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
        setTab(parseAdminRoute(window.location.pathname));
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((next: AdminTab) => {
    setTab(next);
    const targetUrl = adminTabUrl(next);
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({ adminTab: next }, '', targetUrl);
    }
    if (typeof window !== 'undefined' && window.scrollTo) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  // Listen for custom navigation events dispatched from header/other components.
  useEffect(() => {
    const handleNavigateAdmin = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const next = typeof detail === 'string' ? detail : detail?.tab;
      if (
        next === 'dashboard' ||
        next === 'users' ||
        next === 'counselors' ||
        next === 'recruitment' ||
        next === 'system' ||
        next === 'profile'
      ) {
        navigate(next as AdminTab);
      }
    };
    window.addEventListener('navigate-admin', handleNavigateAdmin);
    return () => window.removeEventListener('navigate-admin', handleNavigateAdmin);
  }, [navigate]);

  const renderTab = () => {
    switch (tab) {
      case 'users':
        return <AdminUsers />;
      case 'counselors':
        return <AdminCounselors />;
      case 'recruitment':
        return <AdminRecruitment />;
      case 'system':
        return <AdminSystem />;
      case 'profile':
        return <AdminProfile />;
      default:
        return <AdminDashboard onNavigate={navigate} />;
    }
  };

  return (
    <section
      className={`app-view ${isActive ? 'active' : ''}`}
      id="view-admin"
      aria-label="Cổng quản trị hệ thống"
      style={isActive ? undefined : { display: 'none' }}
    >
      {isActive && (
        <div className="admin-shell">
          {renderTab()}

          {/* Admin System Compact Footer */}
          <footer
            role="contentinfo"
            aria-label="Admin System Footer"
            className="w-full mt-8 py-3.5 px-5 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <Image
                src="/images/image2.png"
                alt="Career Assistant"
                width={22}
                height={22}
                className="w-5.5 h-5.5 object-contain shrink-0"
              />
              <span className="font-semibold text-slate-800">&copy; {new Date().getFullYear()} Career Assistant</span>
              <span className="text-slate-300 hidden md:inline">•</span>
              <span className="text-slate-500 hidden md:inline">Cổng Quản trị Hệ thống & AI Engine</span>
            </div>
            <div className="flex items-center gap-4 text-slate-500">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></span>
                <span>Trạng thái: <strong className="text-emerald-700 font-semibold">Hoạt động bình thường</strong></span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-[11px] bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded font-medium">v1.0.0 Enterprise</span>
            </div>
          </footer>
        </div>
      )}
    </section>
  );
}
