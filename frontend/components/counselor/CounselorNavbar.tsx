/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Send,
  GraduationCap,
  Building2,
  HelpCircle,
  Settings,
  LogOut,
  FileCheck,
  Sparkles,
} from 'lucide-react';
import CounselorToast, { ToastMessage } from './CounselorToast';

export type CounselorTab =
  | 'dashboard'
  | 'students'
  | 'student-detail'
  | 'opportunities'
  | 'jds'
  | 'suitable-candidates'
  | 'referrals'
  | 'referral-detail'
  | 'internships'
  | 'internship-detail'
  | 'partners'
  | 'partner-detail'
  | 'profile'
  | 'settings';

interface CounselorNavbarProps {
  activeTab: CounselorTab;
  onSelectTab: (tab: CounselorTab) => void;
}

export default function CounselorNavbar({
  activeTab,
  onSelectTab,
}: CounselorNavbarProps) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Normalize sub-views to parent tab for highlighting
  const getParentTab = (tab: CounselorTab): CounselorTab => {
    if (tab === 'student-detail') return 'students';
    if (tab === 'suitable-candidates') return 'opportunities';
    if (tab === 'referral-detail') return 'referrals';
    if (tab === 'internship-detail') return 'internships';
    if (tab === 'partner-detail') return 'partners';
    return tab;
  };

  const currentParent = getParentTab(activeTab);

  const navItems = [
    { id: 'dashboard' as CounselorTab, label: 'Tổng quan', icon: LayoutDashboard, testId: 'counselor-nav-dashboard' },
    { id: 'students' as CounselorTab, label: 'Sinh viên', icon: Users, testId: 'counselor-nav-students' },
    { id: 'jds' as CounselorTab, label: 'Quản lý JD', icon: FileCheck, testId: 'counselor-nav-jds' },
    { id: 'opportunities' as CounselorTab, label: 'Cơ hội việc làm', icon: Briefcase, testId: 'counselor-nav-opportunities' },
    { id: 'referrals' as CounselorTab, label: 'Tiến cử', icon: Send, testId: 'counselor-nav-referrals' },
    { id: 'internships' as CounselorTab, label: 'Thực tập', icon: GraduationCap, testId: 'counselor-nav-internships' },
    { id: 'partners' as CounselorTab, label: 'Đối tác', icon: Building2, testId: 'counselor-nav-partners' },
  ];

  const handleRestartTour = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('counselor-restart-tour'));
    }
  };

  const handleHelp = () => {
    setToast({
      message: 'Trung tâm trợ giúp Cố vấn: Vui lòng liên hệ ban quản trị tại support@career-assistant.edu.vn',
      type: 'info',
    });
  };

  const handleSettings = () => {
    onSelectTab('settings');
  };

  const handleProfile = () => {
    onSelectTab('profile');
  };

  const handleLogout = () => {
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.click();
    } else if (typeof window !== 'undefined' && (window as any).ApiClient?.logout) {
      (window as any).ApiClient.logout().then(() => {
        window.location.reload();
      });
    }
  };

  return (
    <>
      <nav
        className="w-full bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-3 shadow-xs flex flex-col justify-between"
        aria-label="Counselor Sidebar Navigation"
      >
        {/* Main Navigation Group */}
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentParent === item.id;
            return (
              <button
                key={item.id}
                id={item.testId}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full h-10 flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors text-left focus-visible:ring-2 focus-visible:ring-[#006948] focus-visible:outline-none ${
                  isActive
                    ? 'bg-[#ECFDF5] text-[#006948] dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold border border-[#006948]/20 shadow-xs'
                    : 'text-[#64748B] dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 hover:text-[#171d19] dark:hover:text-white font-medium border border-transparent'
                }`}
              >
                <Icon
                  size={17}
                  className={`shrink-0 transition-colors ${
                    isActive
                      ? 'text-[#006948] dark:text-emerald-400'
                      : 'text-[#64748B] dark:text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Bottom Section */}
        <div className="pt-3 mt-4 border-t border-[#E2E8F0] dark:border-slate-800 space-y-1">
          <button
            type="button"
            onClick={handleRestartTour}
            className="w-full h-10 flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-[#006948] dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 font-semibold transition-colors text-left border border-emerald-200/50 dark:border-emerald-800/40 focus-visible:ring-2 focus-visible:ring-[#006948] focus-visible:outline-none"
            title="Bật lại hướng dẫn giao diện"
          >
            <Sparkles size={16} className="shrink-0 text-[#006948] dark:text-emerald-400" />
            <span className="truncate">Hướng dẫn tính năng</span>
          </button>

          <button
            type="button"
            onClick={handleProfile}
            className={`w-full h-10 flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors text-left border focus-visible:ring-2 focus-visible:ring-[#006948] focus-visible:outline-none ${
              activeTab === 'profile'
                ? 'bg-[#ECFDF5] text-[#006948] dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold border-[#006948]/20'
                : 'text-[#64748B] dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 hover:text-[#171d19] dark:hover:text-white font-medium border-transparent'
            }`}
          >
            <Users size={17} className="shrink-0 text-[#64748B] dark:text-slate-400" />
            <span className="truncate">Hồ sơ Cố vấn</span>
          </button>

          <button
            type="button"
            onClick={handleHelp}
            className="w-full h-10 flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-[#64748B] dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 hover:text-[#171d19] dark:hover:text-white font-medium transition-colors text-left border border-transparent focus-visible:ring-2 focus-visible:ring-[#006948] focus-visible:outline-none"
          >
            <HelpCircle size={17} className="shrink-0 text-[#64748B] dark:text-slate-400" />
            <span className="truncate">Trợ giúp</span>
          </button>

          <button
            type="button"
            onClick={handleSettings}
            className={`w-full h-10 flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors text-left border focus-visible:ring-2 focus-visible:ring-[#006948] focus-visible:outline-none ${
              activeTab === 'settings'
                ? 'bg-[#ECFDF5] text-[#006948] dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold border-[#006948]/20'
                : 'text-[#64748B] dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 hover:text-[#171d19] dark:hover:text-white font-medium border-transparent'
            }`}
          >
            <Settings size={17} className="shrink-0 text-[#64748B] dark:text-slate-400" />
            <span className="truncate">Cài đặt</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full h-10 flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-[#64748B] dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 font-medium transition-colors text-left border border-transparent focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
          >
            <LogOut size={17} className="shrink-0 text-[#64748B] dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400" />
            <span className="truncate">Đăng xuất</span>
          </button>
        </div>
      </nav>

      {toast && <CounselorToast toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}
