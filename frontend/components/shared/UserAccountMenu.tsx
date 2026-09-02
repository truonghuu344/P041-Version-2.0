/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ApiClient } from '@/api-client.js';

export interface UserAccountMenuProps {
  user?: any;
  role?: string;
  onLoginClick?: () => void;
}

export default function UserAccountMenu({
  user: propUser,
  role: propRole,
  onLoginClick,
}: UserAccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(propUser || null);
  const [mounted, setMounted] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number }>({
    top: 70,
    right: 24,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync user state with props or ApiClient
  const refreshUser = useCallback(() => {
    try {
      if (propUser) {
        setCurrentUser(propUser);
      } else {
        const u = ApiClient.getUser();
        setCurrentUser(u || null);
      }
    } catch {
      setCurrentUser(null);
    }
  }, [propUser]);

  useEffect(() => {
    refreshUser();

    const handleAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.user !== undefined) {
        setCurrentUser(customEvent.detail.user);
      } else {
        refreshUser();
      }
    };

    window.addEventListener('auth:changed', handleAuthChange);

    return () => {
      window.removeEventListener('auth:changed', handleAuthChange);
    };
  }, [refreshUser]);

  // Recalculate dropdown position when opening or scrolling/resizing
  const updateDropdownPos = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateDropdownPos();
      window.addEventListener('resize', updateDropdownPos);
      window.addEventListener('scroll', updateDropdownPos, true);
      return () => {
        window.removeEventListener('resize', updateDropdownPos);
        window.removeEventListener('scroll', updateDropdownPos, true);
      };
    }
  }, [isOpen, updateDropdownPos]);

  // Outside click & Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) {
        return;
      }
      if (dropdownRef.current && dropdownRef.current.contains(target)) {
        return;
      }
      console.log('[DEBUG Header] Avatar outside click closing menu', target);
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[DEBUG Header] Real Logout triggered');
    setIsOpen(false);

    try {
      await ApiClient.logout();
    } catch (err) {
      console.error('[UserAccountMenu] Logout API call error:', err);
    }

    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user_info');
      localStorage.removeItem('user');
    } catch {
      // ignore
    }

    const authEvent = new CustomEvent('auth:changed', { detail: { user: null } });
    window.dispatchEvent(authEvent);
    document.dispatchEvent(authEvent);
    window.dispatchEvent(new Event('career:session-cleared'));

    // Khách đã đăng xuất không được giữ URL portal — về trang chủ công khai.
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const onPortal = ['/student', '/counselor', '/admin'].some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      );
      if (onPortal && window.history?.replaceState) {
        window.history.replaceState({ view: 'dashboard' }, '', '/');
      }
    }

    if (typeof window !== 'undefined' && window.switchView) {
      window.switchView('dashboard');
    }
  };

  const handleAction = (action: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[DEBUG Header] Avatar action clicked:', action);
    setIsOpen(false);

    if (action === 'student-profile') {
      if (typeof window !== 'undefined' && window.switchView) {
        window.switchView('profile');
      }
      if (typeof window !== 'undefined' && window.history?.pushState) {
        window.history.pushState({ view: 'profile' }, '', '/student/profile');
      }
    } else if (action === 'student-settings') {
      if (typeof window !== 'undefined' && window.switchView) {
        window.switchView('profile');
      }
      if (typeof window !== 'undefined' && window.history?.pushState) {
        window.history.pushState({ view: 'profile' }, '', '/student/profile');
      }
      setTimeout(() => {
        const settingsTab = document.querySelector('.profile-tab-btn:last-child');
        if (settingsTab) {
          (settingsTab as HTMLElement).click();
        }
      }, 100);
    } else if (action === 'counselor-profile') {
      if (typeof window !== 'undefined' && window.switchView) {
        window.switchView('counselor');
      }
      window.dispatchEvent(new CustomEvent('navigate-counselor', { detail: 'profile' }));
    } else if (action === 'counselor-settings') {
      if (typeof window !== 'undefined' && window.switchView) {
        window.switchView('counselor');
      }
      window.dispatchEvent(new CustomEvent('navigate-counselor', { detail: 'settings' }));
    } else if (action === 'counselor-help') {
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast(
          'Trung tâm trợ giúp Cố vấn: Vui lòng liên hệ ban quản trị tại support@career-assistant.edu.vn',
          'info',
        );
      }
    } else if (action === 'admin-profile') {
      if (typeof window !== 'undefined') {
        if (window.switchView) {
          window.switchView('admin');
        }
        window.dispatchEvent(new CustomEvent('navigate-admin', { detail: { tab: 'profile' } }));
      }
    } else if (action === 'admin-portal') {
      if (typeof window !== 'undefined' && window.switchView) {
        window.switchView('admin');
      }
    }
  };

  // Not logged in -> exactly ONE header CTA ("Đăng nhập"). Đăng ký nằm trong
  // cùng modal (tab Đăng nhập | Đăng ký của AuthModal) — không bao giờ hiển thị
  // hai nút song song; Cố vấn/Admin không có luồng tự đăng ký công khai.
  if (!currentUser) {
    return (
      <div
        id="auth-container"
        data-react-managed="true"
        style={{ position: 'relative', overflow: 'visible', display: 'inline-flex' }}
      >
        <button className="btn-login" id="btn-login" type="button" onClick={onLoginClick}>
          Đăng nhập
        </button>
      </div>
    );
  }

  // Active Role Resolution
  const userRole = propRole || currentUser.role || 'student';

  let roleBadgeText = 'Sinh viên';
  let roleBadgeClass = 'badge-student';

  if (userRole === 'counselor') {
    roleBadgeText = 'Cố vấn viên';
    roleBadgeClass = 'role-counselor';
  } else if (userRole === 'admin') {
    roleBadgeText = 'Quản trị viên';
    roleBadgeClass = 'role-admin';
  }

  const initial = (currentUser.full_name || currentUser.email || 'U')
    .trim()
    .charAt(0)
    .toUpperCase();
  const displayName = currentUser.full_name || currentUser.email;

  return (
    <div
      id="auth-container"
      data-react-managed="true"
      style={{ position: 'relative', overflow: 'visible', zIndex: 10500 }}
    >
      <div
        className={`candidate-account-menu ${isOpen ? 'open' : ''}`}
        id="candidate-account-menu"
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      >
        <button
          ref={triggerRef}
          className="candidate-avatar-trigger"
          id="candidate-avatar-trigger"
          type="button"
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label="Menu tài khoản"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
        >
          <span className="candidate-avatar-initial">{initial}</span>
          <span
            className="candidate-avatar-chevron"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          >
            ⌄
          </span>
        </button>

        {isOpen &&
          mounted &&
          createPortal(
            <div
              ref={dropdownRef}
              className="candidate-account-dropdown open"
              id="candidate-account-dropdown"
              style={{
                position: 'fixed',
                top: `${dropdownPos.top}px`,
                right: `${dropdownPos.right}px`,
                display: 'block',
                opacity: 1,
                visibility: 'visible',
                zIndex: 1000000,
                pointerEvents: 'auto',
              }}
            >
              <div className="candidate-dropdown-user-header">
                <div className="candidate-dropdown-user-avatar">{initial}</div>
                <div className="candidate-dropdown-user-meta">
                  <div className="candidate-dropdown-user-name" title={displayName}>
                    {displayName}
                  </div>
                  <div className="candidate-dropdown-user-email" title={currentUser.email}>
                    {currentUser.email}
                  </div>
                  <span className={`candidate-dropdown-role-pill ${roleBadgeClass}`}>
                    {roleBadgeText}
                  </span>
                </div>
              </div>

              <div className="candidate-account-divider"></div>

              <div className="candidate-account-actions">
                {userRole === 'counselor' ? (
                  <>
                    <button
                      type="button"
                      data-account-action="counselor-profile"
                      onClick={(e) => handleAction('counselor-profile', e)}
                    >
                      Hồ sơ Cố vấn
                    </button>
                    <button
                      type="button"
                      data-account-action="counselor-settings"
                      onClick={(e) => handleAction('counselor-settings', e)}
                    >
                      Cài đặt
                    </button>
                    <button
                      type="button"
                      data-account-action="counselor-help"
                      onClick={(e) => handleAction('counselor-help', e)}
                    >
                      Trợ giúp
                    </button>
                  </>
                ) : userRole === 'admin' ? (
                  <>
                    <button
                      type="button"
                      data-account-action="admin-portal"
                      onClick={(e) => handleAction('admin-portal', e)}
                    >
                      Quản trị hệ thống
                    </button>
                    <button
                      type="button"
                      data-account-action="admin-profile"
                      onClick={(e) => handleAction('admin-profile', e)}
                    >
                      Hồ sơ quản trị
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      data-account-action="student-profile"
                      onClick={(e) => handleAction('student-profile', e)}
                    >
                      Hồ sơ cá nhân
                    </button>
                    <button
                      type="button"
                      data-account-action="student-settings"
                      onClick={(e) => handleAction('student-settings', e)}
                    >
                      Cài đặt bảo mật
                    </button>
                  </>
                )}
              </div>

              <div className="candidate-account-divider"></div>

              <button
                type="button"
                className="candidate-logout"
                id="btn-logout"
                onClick={handleLogout}
              >
                Đăng xuất
              </button>
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
