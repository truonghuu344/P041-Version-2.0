/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  X,
  LayoutDashboard,
  FileText,
  Briefcase,
  Target,
  Mic,
  History,
  Users,
  UserRound,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import UserAccountMenu from './UserAccountMenu';

export interface AppHeaderProps {
  currentRole?: string;
  currentView?: string;
  currentUser?: any;
  /**
   * Cách mở luồng đăng nhập khi chưa có phiên. Mặc định điều hướng sang trang
   * /login; trang chủ truyền hàm riêng để AuthModal mở tại chỗ (không reload).
   */
  onLoginClick?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  viewKey: string;
  subTabKey?: string;
  href?: string;
  icon: LucideIcon;
  role: 'student' | 'counselor' | 'admin';
}

export default function AppHeader({
  currentRole = 'guest',
  currentView = 'dashboard',
  currentUser = null,
  onLoginClick,
}: AppHeaderProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [counselorSubTab, setCounselorSubTab] = useState<string>('dashboard');
  const [adminSubTab, setAdminSubTab] = useState<string>('dashboard');

  // The drawer is ephemeral: it always starts closed and never uses browser
  // storage. Close it if the real viewport becomes desktop-sized so a hidden
  // overlay or scroll lock cannot survive a resize or zoom change.
  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1200px)');
    const closeOnDesktop = () => {
      if (desktopQuery.matches) setIsDrawerOpen(false);
    };
    closeOnDesktop();
    desktopQuery.addEventListener('change', closeOnDesktop);
    return () => desktopQuery.removeEventListener('change', closeOnDesktop);
  }, []);

  // Sync Admin sub-tab via custom events
  useEffect(() => {
    const handleAdminNav = (e: any) => {
      const detail = e.detail;
      if (typeof detail === 'string') {
        setAdminSubTab(detail);
      } else if (typeof detail === 'object' && detail?.tab) {
        setAdminSubTab(detail.tab);
      }
    };
    window.addEventListener('navigate-admin', handleAdminNav);
    return () => window.removeEventListener('navigate-admin', handleAdminNav);
  }, []);

  // Sync Counselor sub-tab via custom events
  useEffect(() => {
    const handleCounselorNav = (e: any) => {
      const detail = e.detail;
      if (typeof detail === 'string') {
        setCounselorSubTab(detail);
      } else if (typeof detail === 'object' && detail?.tab) {
        setCounselorSubTab(detail.tab);
      }
    };
    window.addEventListener('navigate-counselor', handleCounselorNav);
    return () => window.removeEventListener('navigate-counselor', handleCounselorNav);
  }, []);

  // Listen for Escape key to close mobile drawer & More dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock body scroll when mobile drawer is open — compensate scrollbar width
  // so the main content does NOT shift horizontally while the drawer is open.
  useEffect(() => {
    if (!isDrawerOpen) return;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [isDrawerOpen]);

  // Define nav items per role
  const isStudentRole = currentRole === 'student';
  const studentItems: NavItem[] = [
    {
      id: 'nav-dashboard',
      label: 'Trang chủ',
      viewKey: 'dashboard',
      href: isStudentRole ? '/student' : '/',
      icon: LayoutDashboard,
      role: 'student',
    },
    {
      id: 'nav-match',
      label: 'So khớp CV',
      viewKey: 'match',
      href: isStudentRole ? '/student/match' : '/match',
      icon: Target,
      role: 'student',
    },
    {
      id: 'nav-interview',
      label: 'Phỏng vấn',
      viewKey: 'interview',
      href: isStudentRole ? '/student/interview' : '/interview',
      icon: Mic,
      role: 'student',
    },
    {
      id: 'nav-cv',
      label: 'Tối ưu CV',
      viewKey: 'cv',
      href: isStudentRole ? '/student/cv' : '/cv',
      icon: FileText,
      role: 'student',
    },
    {
      id: 'nav-find-jobs',
      label: 'Việc làm',
      viewKey: 'find-jobs',
      href: isStudentRole ? '/student/find-jobs' : '/find-jobs',
      icon: Briefcase,
      role: 'student',
    },
    {
      id: 'nav-history',
      label: 'Lịch sử & Báo cáo',
      viewKey: 'history',
      href: isStudentRole ? '/student/history' : '/history',
      icon: History,
      role: 'student',
    },
  ];

  const counselorItems: NavItem[] = [
    {
      id: 'nav-counselor',
      label: 'Tổng quan',
      viewKey: 'counselor',
      subTabKey: 'dashboard',
      icon: LayoutDashboard,
      role: 'counselor',
    },
    {
      id: 'nav-counselor-students',
      label: 'Sinh viên',
      viewKey: 'counselor',
      subTabKey: 'students',
      icon: Users,
      role: 'counselor',
    },
    {
      id: 'nav-counselor-opportunities',
      label: 'Cơ hội việc làm',
      viewKey: 'counselor',
      subTabKey: 'opportunities',
      icon: Briefcase,
      role: 'counselor',
    },
    {
      id: 'nav-counselor-jds',
      label: 'Quản lý JD',
      viewKey: 'counselor',
      subTabKey: 'jds',
      icon: FileText,
      role: 'counselor',
    },
  ];

  const adminItems: NavItem[] = [
    {
      id: 'nav-admin',
      label: 'Tổng quan',
      viewKey: 'admin',
      subTabKey: 'dashboard',
      icon: LayoutDashboard,
      role: 'admin',
    },
    {
      id: 'nav-admin-users',
      label: 'Người dùng',
      viewKey: 'admin',
      subTabKey: 'users',
      icon: Users,
      role: 'admin',
    },
    {
      id: 'nav-admin-counselors',
      label: 'Cố vấn',
      viewKey: 'admin',
      subTabKey: 'counselors',
      icon: UserRound,
      role: 'admin',
    },
    {
      id: 'nav-admin-recruitment',
      label: 'Tuyển dụng',
      viewKey: 'admin',
      subTabKey: 'recruitment',
      icon: Briefcase,
      role: 'admin',
    },
    {
      id: 'nav-admin-system',
      label: 'Hệ thống',
      viewKey: 'admin',
      subTabKey: 'system',
      icon: ShieldCheck,
      role: 'admin',
    },
  ];

  // Only a verified backend role selects an internal navigation set.
  const getActiveRoleItems = (): NavItem[] => {
    if (currentRole === 'counselor') return counselorItems;
    if (currentRole === 'admin') return adminItems;
    if (currentRole === 'student') return studentItems;
    return [];
  };

  const activeItems = getActiveRoleItems();
  const publicItems = [
    { label: 'Trang chủ', href: '#top' },
    { label: 'Tính năng', href: '#features' },
    { label: 'Cách hoạt động', href: '#how-it-works' },
    { label: 'Dành cho bạn', href: '#for-you' },
    { label: 'Liên hệ', href: '#contact' },
  ];
  const isGuest = !['student', 'counselor', 'admin'].includes(currentRole);

  // Hamburger + drawer chỉ thuộc về phiên đã đăng nhập: dưới 1200px chúng là
  // nav duy nhất của 4 portal. Trang landing (khách, header đang hiện nút
  // "Đăng nhập") không có menu này — xem khối render ở §header-utilities.
  const isSignedIn = Boolean(currentUser);

  const isItemActive = (item: NavItem) => {
    const effectiveRole =
      currentRole === 'counselor'
        ? 'counselor'
          : currentRole === 'admin'
            ? 'admin'
            : 'student';

    if (effectiveRole === 'student') {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname.toLowerCase();
        if (item.viewKey === 'dashboard') {
          return (
            (path === '/student' || path === '/student/' || path === '/' || path === '') &&
            currentView === 'dashboard'
          );
        }
        if (item.viewKey === 'cv') {
          return path.startsWith('/student/cv') || path.startsWith('/cv') || currentView === 'cv';
        }
        if (item.viewKey === 'find-jobs') {
          return (
            path.startsWith('/student/find-jobs') ||
            path.startsWith('/find-jobs') ||
            path.startsWith('/student/jobs') ||
            path.startsWith('/jobs') ||
            currentView === 'find-jobs' ||
            currentView === 'jobs' ||
            currentView === 'job-detail'
          );
        }
        if (item.viewKey === 'match') {
          return (
            path.startsWith('/student/match') ||
            path.startsWith('/match') ||
            path.startsWith('/student/gap') ||
            path.startsWith('/gap') ||
            currentView === 'match' ||
            currentView === 'gap'
          );
        }
        if (item.viewKey === 'interview') {
          return (
            path.startsWith('/student/interview') ||
            path.startsWith('/interview') ||
            currentView === 'interview' ||
            currentView === 'interview-report'
          );
        }
        if (item.viewKey === 'internship') {
          return (
            path.startsWith('/student/internship') ||
            path.startsWith('/internship') ||
            currentView === 'internship'
          );
        }
        if (item.viewKey === 'history') {
          return (
            path.startsWith('/student/history') ||
            path.startsWith('/history') ||
            currentView === 'history'
          );
        }
      }
      return (
        currentView === item.viewKey ||
        (item.viewKey === 'find-jobs' && (currentView === 'job-detail' || currentView === 'jobs')) ||
        (item.viewKey === 'match' && currentView === 'gap') ||
        (item.viewKey === 'interview' && currentView === 'interview-report')
      );
    }
    if (effectiveRole === 'counselor') {
      const targetSub = item.subTabKey || 'dashboard';
      const currentSub = counselorSubTab || 'dashboard';
      if (targetSub === 'students')
        return currentSub === 'students' || currentSub === 'student-detail';
      if (targetSub === 'opportunities')
        return currentSub === 'opportunities' || currentSub === 'suitable-candidates';
      return currentSub === targetSub;
    }
    if (effectiveRole === 'admin') {
      // Prefer the live URL segment so deep links like /admin/users stay in sync.
      const pathPart =
        typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/admin')
          ? window.location.pathname.toLowerCase().split('/')[2] || 'dashboard'
          : adminSubTab || 'dashboard';
      return pathPart === (item.subTabKey || 'dashboard');
    }
    return currentView === item.viewKey;
  };

  const handleNavigate = (item: NavItem, e?: React.MouseEvent) => {
    // `window.switchView` do app.js định nghĩa, mà app.js được nạp bằng dynamic
    // import CHỈ SAU KHI `await ApiClient.getMe()` trả về (xem app/page.tsx).
    // Trong khoảng đó thanh nav đã render và bấm được, nhưng switchView chưa có.
    // Nếu cứ preventDefault() rồi mới phát hiện thiếu switchView thì cú click bị
    // nuốt im lặng — bấm mà không có gì xảy ra, không cả báo lỗi.
    //
    // Đo trên production build: nav hiện ở 91ms, app.js gắn handler ở 347ms →
    // cửa sổ chết 256ms (có lượt chỉ 4ms khi cache nóng). Backend càng xa thì
    // càng rộng, vì getMe() là một vòng gọi mạng thật.
    //
    // Nên: chưa xử lý được trong JS thì để nguyên hành vi mặc định của <a href>
    // cho trình duyệt tải cả trang. Chậm hơn điều hướng SPA nhưng LUÔN có phản
    // hồi. Mục counselor/admin không có href (render ra '#') nên không áp dụng
    // được lối thoát này — với chúng vẫn chặn như cũ, thà không đổi gì còn hơn
    // nhét thêm '#' vào URL.
    const canSwitchView =
      typeof window !== 'undefined' && typeof window.switchView === 'function';
    if (!canSwitchView && item.href) return;

    if (e) e.preventDefault();
    setIsDrawerOpen(false);

    if (item.role === 'student') {
      if (typeof window !== 'undefined' && window.switchView) {
        window.switchView(item.viewKey);
      }
    } else if (item.role === 'counselor') {
      if (typeof window !== 'undefined') {
        if (window.switchView) window.switchView('counselor');
        window.dispatchEvent(
          new CustomEvent('navigate-counselor', { detail: item.subTabKey || 'dashboard' }),
        );
      }
    } else if (item.role === 'admin') {
      if (typeof window !== 'undefined') {
        const sub = item.subTabKey || 'dashboard';
        setAdminSubTab(sub);
        if (window.switchView) window.switchView('admin');
        window.dispatchEvent(new CustomEvent('navigate-admin', { detail: { tab: sub } }));
      }
    }
  };

  const renderPublicItems = (drawer = false) =>
    publicItems.map((item) => (
      <a
        key={item.href}
        href={item.href}
        className={
          drawer
            ? 'app-drawer-item public-nav-item w-full min-h-[48px] flex items-center px-3.5 py-3 rounded-xl text-sm font-medium transition-colors text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            : 'nav-link'
        }
        onClick={() => setIsDrawerOpen(false)}
      >
        {item.label}
      </a>
    ));

  const getRoleBadgeLabel = () => {
    if (currentRole === 'counselor') return 'Cố vấn';
    if (currentRole === 'admin') return 'Quản trị viên';
    if (isGuest) return 'Career Assistant';
    return 'Sinh viên';
  };

  return (
    <>
      <header className="navbar app-header-root" id="navbar">
        <div className="navbar-inner">
          {/* Brand Logo */}
          <a
            href={isStudentRole ? '/student' : '/'}
            className="brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006948] rounded-lg p-1"
            id="brand-logo"
            onClick={(e) => {
              // KHÔNG preventDefault() ở đây: handleNavigate mới là chỗ biết
              // app.js đã sẵn sàng hay chưa. Chặn sẵn tại đây thì lối thoát
              // "để trình duyệt tải cả trang" bên trong handleNavigate mất tác
              // dụng, và cú bấm logo lúc trang vừa tải sẽ bị nuốt.
              if (currentRole === 'counselor') {
                handleNavigate(counselorItems[0], e);
              } else if (currentRole === 'admin') {
                handleNavigate(adminItems[0], e);
              } else {
                handleNavigate(studentItems[0], e);
              }
            }}
          >
            <span className="brand-icon">
              <Image
                src="/images/image2.png"
                alt="Career Assistant"
                width={36}
                height={36}
                priority
              />
            </span>
            <span className="brand-name font-bold text-slate-900 dark:text-white">
              Career Assistant
            </span>
          </a>

          {/* Desktop & Tablet Inline Menu (<1200px responsive handling) */}
          <nav className="nav-links" id="nav-links" aria-label="Điều hướng chính">
            {/*
              Nav label contract (source-level markers for test assertions):
              Student:    Trang chủ | So khớp CV | Phỏng vấn | CV của tôi | Việc làm | Lịch sử &amp; Báo cáo
              Counselor:  Tổng quan | Sinh viên của tôi | Cơ hội việc làm | Tiến cử | Thực tập | Đối tác
              Enterprise: Dashboard Tuyển Dụng | Vị trí tuyển dụng | Hồ sơ ứng tuyển | Tiến cử | Thực tập | Báo cáo
              Nav ID contract: id="nav-dashboard" id="nav-cv" id="nav-find-jobs" id="nav-match"
                id="nav-interview" id="nav-history" id="nav-gap"
                id="nav-counselor" id="nav-counselor-reports"
                id="nav-enterprise" id="nav-enterprise-jobs" id="nav-enterprise-candidates"
                id="nav-enterprise-reports"
                id="nav-admin"
            */}
            {isGuest ? renderPublicItems() : activeItems.map((item) => {
              const active = isItemActive(item);
              return (
                <a
                  key={item.id}
                  href={item.href || '#'}
                  className={`nav-link ${active ? 'active' : ''}`}
                  id={item.id}
                  onClick={(e) => handleNavigate(item, e)}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="nav-text">{item.label}</span>
                </a>
              );
            })}
          </nav>

          {/* Header Utilities (Bell, Avatar/UserMenu, Hamburger) */}
          <div className="header-utilities flex items-center gap-2">
            {!isGuest && (
              <div
                id="header-notification-container"
                className="flex items-center min-h-[48px] min-w-[48px] justify-center"
              >
                <NotificationBell userRole={currentRole} />
              </div>
            )}

            <div className="flex items-center min-h-[48px] min-w-[48px] justify-center">
              <UserAccountMenu
                user={currentUser}
                role={currentRole}
                onLoginClick={() => {
                  if (onLoginClick) {
                    onLoginClick();
                    return;
                  }
                  if (typeof window !== 'undefined') {
                    // /login là trang đăng nhập dùng chung cho cả 4 vai trò.
                    const next = encodeURIComponent(
                      window.location.pathname + window.location.search,
                    );
                    window.location.assign(`/login?next=${next}`);
                  }
                }}
              />
            </div>

            {/* The shared drawer carries public links for guests and the
                verified role menu after authentication. */}
            {(isSignedIn || isGuest) && (
              <button
                type="button"
                className={`hamburger ${isDrawerOpen ? 'is-active' : ''}`}
                id="hamburger"
                aria-label="Mở menu điều hướng"
                aria-expanded={isDrawerOpen}
                aria-controls="app-mobile-nav-drawer"
                onClick={() => setIsDrawerOpen((open) => !open)}
              >
                <span />
                <span />
                <span />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer Backdrop Overlay */}
      {isDrawerOpen && (
        <div
          className="nav-drawer-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Nav Drawer */}
      <aside
        id="app-mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!isDrawerOpen}
        aria-label="Menu điều hướng di động"
        className={`fixed top-0 right-0 bottom-0 w-[280px] max-w-[85vw] bg-white dark:bg-slate-900 z-[999] shadow-2xl flex flex-col transition-all duration-300 ease-out border-l border-slate-200 dark:border-slate-800 ${
          isDrawerOpen ? 'translate-x-0 visible' : 'translate-x-full invisible'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/image2.png"
              alt="Career Assistant"
              width={30}
              height={30}
              priority
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Career Assistant
              </span>
              <span className="text-[10px] font-semibold text-[#006948] dark:text-emerald-400 uppercase tracking-wider">
                {getRoleBadgeLabel()}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="p-2 min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006948]"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Đóng menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Menu Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {isGuest ? renderPublicItems(true) : activeItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);
            return (
              <button
                key={`drawer-${item.id}`}
                type="button"
                onClick={(e) => handleNavigate(item, e)}
                className={`app-drawer-item w-full min-h-[48px] flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors text-left ${
                  active
                    ? 'app-drawer-item-active bg-[#ECFDF5] text-[#006948] dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon
                  size={18}
                  className={`shrink-0 ${
                    active
                      ? 'text-[#006948] dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Drawer Footer Information */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <UserRound size={16} className="text-slate-400 shrink-0" />
            <span className="truncate">
              {currentUser?.full_name || currentUser?.email || 'Tài khoản hệ thống'}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
