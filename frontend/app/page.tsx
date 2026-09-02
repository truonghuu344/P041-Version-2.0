/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { FileText, Upload } from 'lucide-react';

type CVTemplateName = 'modern' | 'classic' | 'elegant' | 'compact' | 'creative';

import DashboardView from '@/components/candidate/DashboardView';
import CVView from '@/components/candidate/CVView';
import MatchView from '@/components/candidate/MatchView';
import FindJobsView from '@/components/candidate/FindJobsView';
import JobsView from '@/components/candidate/JobsView';
import GapView from '@/components/candidate/GapView';
import InterviewView from '@/components/candidate/InterviewView';
import InterviewReportView from '@/components/candidate/InterviewReportView';
import HistoryView from '@/components/candidate/HistoryView';
import ProfileView from '@/components/candidate/ProfileView';
import UpgradeView from '@/components/candidate/UpgradeView';
import InternshipView from '@/components/candidate/InternshipView';
import CounselorView, { parseCounselorRoute } from '@/components/counselor/CounselorView';
import AdminView from '@/components/admin/AdminView';
import JobRecommendationModal from '@/components/candidate/JobRecommendationModal';
import NotificationBell from '@/components/notifications/NotificationBell';
import NotificationsView from '@/components/notifications/NotificationsView';
import UserAccountMenu from '@/components/shared/UserAccountMenu';
import AppHeader from '@/components/shared/AppHeader';
import { MiniCVSheet } from '@/components/candidate/TemplatePreviewCard';
import { ApiClient } from '@/api-client.js';
import {
  canRoleAccessView,
  getRoleHomeView,
  isRegisterPath,
  resolveInitialRoute,
} from '@/lib/authRouting';
import AuthModal from '@/components/auth/AuthModal';

const voiceWsBaseUrl = (process.env.NEXT_PUBLIC_VOICE_WS_URL || '').replace(/\/$/, '');

export default function Page() {
  // DOM ownership is delegated to child views. These identifiers document the
  // stable page-level integration contract used by the legacy controller:
  // id="job-search-form" · id="job-search-cv-select" · id="job-match-cv-btn"
  // The CV view owns the opener: onClick={() => setIsTemplateGalleryOpen(true)}

  const [isMounted, setIsMounted] = useState(false);
  const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState(false);
  const [selectedCVTemplate, setSelectedCVTemplate] = useState<CVTemplateName | null>(null);
  const [templateFilter, setTemplateFilter] = useState<
    'all' | 'ats' | 'tech' | 'creative' | 'compact' | 'business'
  >('all');
  const [resolvedState, setResolvedState] = useState<{
    role: string;
    view: string;
    user: any;
    isReady: boolean;
  }>({
    role: 'guest',
    view: 'dashboard',
    user: null,
    isReady: false,
  });

  useEffect(() => {
    let cancelled = false;

    const readCachedUser = (): any => {
      try {
        const raw = localStorage.getItem('user_info');
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    };

    /**
     * Bootstrap is intentionally two-phase:
     *   1. provisional pass with the cached user (fast hint),
     *   2. verified pass against POST-verified /auth/me session.
     * The neutral bootstrap loader stays on screen until phase 2 finishes, so
     * no portal layout is ever rendered while auth/role is unresolved and a
     * stale/expired cache can never flash the wrong portal.
     */
    const commitRoute = (user: any) => {
      const route = resolveInitialRoute({
        pathname: window.location.pathname,
        hash: window.location.hash,
        user,
      });
      if (route.redirect) {
        // Hard navigation keeps Next's route state consistent with the URL bar
        // (portals are rewrites of `/`), and guarantees no other portal paints.
        window.location.replace(route.redirect);
        return;
      }

      document.body.classList.remove(
        'role-student',
        'role-counselor',
        'role-admin',
      );
      const path = window.location.pathname.toLowerCase();
      // Guests keep the student theming on public/demo views (legacy visual
      // contract); /login stays fully neutral until a role is known.
      const bodyRole =
        route.role !== 'guest' ? route.role : path.startsWith('/login') ? null : 'student';
      if (bodyRole) {
        document.body.classList.add(`role-${bodyRole}`);
      }

      setResolvedState({
        role: route.role,
        view: route.view,
        user,
        isReady: true,
      });
      setIsMounted(true);
    };

    const cachedUser = readCachedUser();

    (async () => {
      let verifiedUser: any = null;
      try {
        // Authoritative session check (HttpOnly cookie). getMe() clears the
        // stale localStorage cache itself when the cookie has expired (401).
        verifiedUser = await ApiClient.getMe();
      } catch (err) {
        // Backend unreachable — fall back to the cached profile so an outage
        // does not log visibly-active users out client-side.
        verifiedUser = cachedUser;
      }
      if (cancelled) return;
      if (verifiedUser) {
        void ApiClient.checkHealthOnce();
      }
      commitRoute(verifiedUser ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // `app.js` owns the existing Student job interactions. Keep React's route
  // state in sync with it so navigations and browser back/forward are reflected in React renders.
  useEffect(() => {
    const handleLegacyViewChange = (event: Event) => {
      const view = (event as CustomEvent<{ view?: string }>).detail?.view;
      if (!view) return;
      setResolvedState((previous) =>
        previous.view === view ? previous : { ...previous, view },
      );
    };
    const handlePopState = () => {
      const user = resolvedState.user;
      const route = resolveInitialRoute({
        pathname: window.location.pathname,
        hash: window.location.hash,
        user,
      });
      if (route.view) {
        setResolvedState((previous) =>
          previous.view === route.view ? previous : { ...previous, view: route.view },
        );
      }
    };
    window.addEventListener('career:view-change', handleLegacyViewChange);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('career:view-change', handleLegacyViewChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [resolvedState.user]);

  useEffect(() => {
    if (!isMounted || !resolvedState.isReady) return;
    // WebSocket upgrades cannot use Vercel's HTTP rewrite reliably. Keep the
    // public backend URL separate from REST requests, which remain same-origin.
    if (voiceWsBaseUrl) {
      window.__CAREER_VOICE_WS_BASE_URL__ = voiceWsBaseUrl;
    }
    // The legacy controller needs the complete client-rendered DOM before it binds events.
    // @ts-expect-error dynamically imported non-module script
    void import('@/app.js');

    const bindRoleNav = () => {
      const handleCounselorNav = (id: string, tab: string) => {
        const el = document.getElementById(id);
        if (el) {
          el.onclick = (e) => {
            e.preventDefault();
            if (window.switchView) window.switchView('counselor');
            window.dispatchEvent(new CustomEvent('navigate-counselor', { detail: tab }));
          };
        }
      };

      handleCounselorNav('nav-counselor', 'dashboard');
      handleCounselorNav('nav-counselor-students', 'students');
      handleCounselorNav('nav-counselor-opportunities', 'opportunities');
      handleCounselorNav('nav-counselor-jds', 'jds');

      // KHÔNG bind hamburger ở đây.
      // AppHeader (React) đã sở hữu hoàn toàn nút #hamburger + drawer
      // #app-mobile-nav-drawer qua state `isDrawerOpen`. Handler cũ dùng
      // `hamburger.onclick` chạy SONG SONG với onClick của React và toggle
      // class `.nav-links-open` (không tồn tại trong CSS) cùng `.is-active`,
      // khiến class bị lệch pha mỗi lần React re-render. Ngoài ra bindRoleNav
      // còn chạy lại sau 300ms → nhân đôi listener.
    };
    bindRoleNav();
    setTimeout(bindRoleNav, 300);

    // Initial URL sync khi reload / mở deep-link trực tiếp.
    // Dùng parser của portal Cố vấn để giữ đúng deep-link lồng nhau.
    // thay vì tự tách path: cách tách tay cũ hiểu sai route lồng nhau, ví dụ
    // `/counselor/opportunities/jobs/req-01` → {tab:'opportunities', jobId:'jobs'}
    // thay vì {tab:'suitable-candidates', jobId:'req-01'}, và vì effect này chạy
    // SAU khi CounselorView mount nên nó ghi đè kết quả parse đúng bằng giá trị sai.
    if (typeof window !== 'undefined') {
      const rawPath = window.location.pathname;
      const rawHash = window.location.hash;
      const path = rawPath.toLowerCase();
      const hash = rawHash.toLowerCase();

      if (path.startsWith('/counselor') || hash.startsWith('#counselor')) {
        const source = path.startsWith('/counselor') ? rawPath : rawHash;
        window.dispatchEvent(
          new CustomEvent('navigate-counselor', { detail: parseCounselorRoute(source) }),
        );
      }
    }

    const handleAuthChanged = (e: any) => {
      const u = e.detail?.user;
      const nextRole = u?.role || 'guest';
      setResolvedState((prev) => {
        // Route guard on every auth transition: a role change can never leave
        // the user staring at a portal their role may not open.
        let view = prev.view;
        if (!canRoleAccessView(nextRole, view)) {
          view = getRoleHomeView(nextRole);
        }
        if (nextRole === 'guest') {
          const currentPath = window.location.pathname.toLowerCase();
          if (
            currentPath !== '/' &&
            !currentPath.startsWith('/login') &&
            !isRegisterPath(currentPath)
          ) {
            window.history.replaceState({ view }, '', '/');
          }
        }
        return {
          ...prev,
          role: nextRole,
          user: u ?? null,
          view,
        };
      });
    };
    document.addEventListener('auth:changed', handleAuthChanged);
    return () => document.removeEventListener('auth:changed', handleAuthChanged);
  }, [isMounted, resolvedState.isReady]);

  const selectCVTemplate = (templateName: CVTemplateName) => {
    setSelectedCVTemplate(templateName);
    setIsTemplateGalleryOpen(false);
    const manualForm = document.getElementById('manual-cv-form');
    window.requestAnimationFrame(() =>
      manualForm?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  };

  // While resolving initial role and view, render clean loading placeholder (never flash Student UI)
  if (!isMounted || !resolvedState.isReady) {
    return (
      <div
        id="app-bootstrap-loader"
        className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F8FAFC]"
      >
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <Image src="/images/image2.png" alt="Career Assistant" width={44} height={44} priority />
          <div className="h-1 w-24 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div className="h-full bg-[#006948] rounded-full w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  const { role: currentRole, view: currentView, user: currentUser } = resolvedState;

  return (
    <>
      <AppHeader
        currentRole={currentRole}
        currentView={currentView}
        currentUser={currentUser}
        onLoginClick={() => {
          const next =
            typeof window !== 'undefined'
              ? window.location.pathname + window.location.search
              : null;
          document.dispatchEvent(new CustomEvent('authx:open', { detail: { next } }));
        }}
      />

      {/*
        Không còn bottom-nav cho mobile: dưới 1200px drawer trong AppHeader là
        nav duy nhất (xem header comment của app/styles/navbar.css). Bottom nav
        cũ đã bị vô hiệu hoá bằng CSS và mất toàn bộ layout khi hệ breakpoint
        được chuẩn hoá về 768/1200, nên phần render mồ côi được xoá hẳn.
      */}

      {/* ===== SPACESHIP CORRIDOR TRANSITION SWEEP ===== */}
      <div id="spaceship-corridor-sweep" className="spaceship-corridor-sweep" aria-hidden="true">
        <div className="sweep-beam"></div>
        <div className="hatch-door left"></div>
        <div className="hatch-door right"></div>
      </div>

      <main>
        <DashboardView isActive={currentView === 'dashboard'} />
        <CVView
          selectedCVTemplate={selectedCVTemplate}
          isTemplateGalleryOpen={isTemplateGalleryOpen}
          setIsTemplateGalleryOpen={setIsTemplateGalleryOpen}
          selectCVTemplate={selectCVTemplate}
        />
        <FindJobsView />
        <JobsView />
        <JobRecommendationModal isActive={currentView === 'job-detail'} />
        <MatchView />
        <GapView />
        <InterviewView />
        <InterviewReportView />
        <HistoryView />
        <InternshipView isActive={currentView === 'internship'} />
        <ProfileView />
        <CounselorView isActive={currentView === 'counselor'} />
        <AdminView isActive={currentView === 'admin'} />
        <UpgradeView />
        <NotificationsView />
      </main>

      {/* Bề mặt đăng nhập / đăng ký DÙNG NHẤT (tab Đăng nhập | Đăng ký). */}
      <AuthModal />

      <div
        id="cv-template-modal-overlay"
        className={`modal-overlay${isTemplateGalleryOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cv-template-gallery-title"
        hidden={!isTemplateGalleryOpen}
      >
        <div className="modal-card cv-template-gallery-card">
          <button
            type="button"
            className="modal-close"
            aria-label="Đóng"
            onClick={() => setIsTemplateGalleryOpen(false)}
          >
            ×
          </button>
          <div className="cv-template-gallery-header">
            <h2 id="cv-template-gallery-title" className="modal-title">
              <FileText size={22} style={{ color: '#059669' }} /> Chọn{' '}
              <span>Mẫu CV Chuyên Nghiệp</span>
            </h2>
            <p className="modal-sub">
              Tất cả mẫu đều chuẩn ATS, tương thích với hệ thống quét tự động. Hãy chọn mẫu phù hợp
              nhất với ngành nghề của bạn.
            </p>
          </div>

          <div className="template-category-tabs" role="tablist" aria-label="Bộ lọc mẫu CV">
            {[
              { id: 'all', label: 'Tất cả mẫu' },
              { id: 'ats', label: '🎯 Chuẩn Harvard ATS' },
              { id: 'tech', label: '💻 Công nghệ & IT' },
              { id: 'creative', label: '🎨 Sáng tạo & UI/UX' },
              { id: 'compact', label: '⚡ 1 Trang Tinh gọn' },
              { id: 'business', label: '📊 Finance & Quản trị' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`template-tab-btn${templateFilter === tab.id ? ' active' : ''}`}
                onClick={() => setTemplateFilter(tab.id as typeof templateFilter)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="template-gallery-grid">
            {(templateFilter === 'all' || templateFilter === 'ats') && (
              <article
                className="template-preview template-preview-classic"
                data-selected={selectedCVTemplate === 'classic'}
              >
                <div
                  className="template-preview-viewport"
                  onClick={() => selectCVTemplate('classic')}
                >
                  <span className="template-card-badge badge-ats">ATS 100% TIÊU CHUẨN</span>
                  <MiniCVSheet templateId="classic" />
                </div>
                <div className="template-card-info">
                  <div>
                    <h3>Classic ATS</h3>
                    <div className="template-card-role">
                      <FileText size={13} /> Mọi ngành nghề, IT, Quản lý, Tài chính
                    </div>
                    <p>
                      Chuẩn Harvard 1 cột, đơn giản và đạt điểm quét cao nhất với mọi hệ thống ATS.
                    </p>
                  </div>
                  <div className="template-preview-actions">
                    <button
                      type="button"
                      className="template-select-btn"
                      onClick={() => selectCVTemplate('classic')}
                    >
                      {selectedCVTemplate === 'classic' ? 'Đang chọn' : 'Dùng mẫu này'}
                    </button>
                    <a
                      className="template-download-btn"
                      href="/api/v1/cvs/templates/classic"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Tải PDF mẫu
                    </a>
                  </div>
                </div>
              </article>
            )}

            {(templateFilter === 'all' || templateFilter === 'tech') && (
              <article
                className="template-preview template-preview-modern"
                data-selected={selectedCVTemplate === 'modern'}
              >
                <div
                  className="template-preview-viewport"
                  onClick={() => selectCVTemplate('modern')}
                >
                  <span className="template-card-badge badge-popular">PHỔ BIẾN NHẤT</span>
                  <MiniCVSheet templateId="modern" />
                </div>
                <div className="template-card-info">
                  <div>
                    <h3>Modern Tech</h3>
                    <div className="template-card-role">
                      <FileText size={13} /> Developer, Data, AI, DevOps
                    </div>
                    <p>
                      Bố cục 2 cột hiện đại, sidebar chuyên nghiệp dành cho Developer &amp; Data.
                    </p>
                  </div>
                  <div className="template-preview-actions">
                    <button
                      type="button"
                      className="template-select-btn"
                      onClick={() => selectCVTemplate('modern')}
                    >
                      {selectedCVTemplate === 'modern' ? 'Đang chọn' : 'Dùng mẫu này'}
                    </button>
                    <a
                      className="template-download-btn"
                      href="/api/v1/cvs/templates/modern"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Tải PDF mẫu
                    </a>
                  </div>
                </div>
              </article>
            )}

            {(templateFilter === 'all' || templateFilter === 'creative') && (
              <article
                className="template-preview template-preview-creative"
                data-selected={selectedCVTemplate === 'creative'}
              >
                <div
                  className="template-preview-viewport"
                  onClick={() => selectCVTemplate('creative')}
                >
                  <span className="template-card-badge badge-creative">DARK CREATIVE</span>
                  <MiniCVSheet templateId="creative" />
                </div>
                <div className="template-card-info">
                  <div>
                    <h3>Creative Dark</h3>
                    <div className="template-card-role">
                      <FileText size={13} /> UI/UX, Product, Creative Tech
                    </div>
                    <p>Header tối màu cá tính, timeline đồ họa cho UI/UX &amp; Creative Tech.</p>
                  </div>
                  <div className="template-preview-actions">
                    <button
                      type="button"
                      className="template-select-btn"
                      onClick={() => selectCVTemplate('creative')}
                    >
                      {selectedCVTemplate === 'creative' ? 'Đang chọn' : 'Dùng mẫu này'}
                    </button>
                    <a
                      className="template-download-btn"
                      href="/api/v1/cvs/templates/creative"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Tải PDF mẫu
                    </a>
                  </div>
                </div>
              </article>
            )}

            {(templateFilter === 'all' || templateFilter === 'compact') && (
              <article
                className="template-preview template-preview-compact"
                data-selected={selectedCVTemplate === 'compact'}
              >
                <div
                  className="template-preview-viewport"
                  onClick={() => selectCVTemplate('compact')}
                >
                  <span className="template-card-badge badge-compact">1 TRANG TINH GỌN</span>
                  <MiniCVSheet templateId="compact" />
                </div>
                <div className="template-card-info">
                  <div>
                    <h3>Minimalist Compact</h3>
                    <div className="template-card-role">
                      <FileText size={13} /> Senior, Tech Lead, Manager
                    </div>
                    <p>
                      Tối ưu hóa mật độ thông tin gói gọn trong 1 trang duy nhất, căn chỉnh lề sắc
                      nét.
                    </p>
                  </div>
                  <div className="template-preview-actions">
                    <button
                      type="button"
                      className="template-select-btn"
                      onClick={() => selectCVTemplate('compact')}
                    >
                      {selectedCVTemplate === 'compact' ? 'Đang chọn' : 'Dùng mẫu này'}
                    </button>
                  </div>
                </div>
              </article>
            )}

            {(templateFilter === 'all' || templateFilter === 'business') && (
              <article
                className="template-preview template-preview-elegant"
                data-selected={selectedCVTemplate === 'elegant'}
              >
                <div
                  className="template-preview-viewport"
                  onClick={() => selectCVTemplate('elegant')}
                >
                  <span className="template-card-badge badge-elegant">SANG TRỌNG</span>
                  <MiniCVSheet templateId="elegant" />
                </div>
                <div className="template-card-info">
                  <div>
                    <h3>Elegant Executive</h3>
                    <div className="template-card-role">
                      <FileText size={13} /> Finance, Banking, BA, Legal
                    </div>
                    <p>
                      Phong cách trang nhã với phân cách tinh tế, đường viền thanh lịch và phân cấp
                      rõ ràng.
                    </p>
                  </div>
                  <div className="template-preview-actions">
                    <button
                      type="button"
                      className="template-select-btn"
                      onClick={() => selectCVTemplate('elegant')}
                    >
                      {selectedCVTemplate === 'elegant' ? 'Đang chọn' : 'Dùng mẫu này'}
                    </button>
                  </div>
                </div>
              </article>
            )}
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="modal-cv-overlay">
        <div className="modal-card" style={{ maxWidth: '640px' }}>
          <button className="modal-close" id="modal-cv-close">
            &times;
          </button>
          <div className="modal-header">
            <h2
              className="modal-title"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FileText size={24} color="var(--primary)" /> Upload & Quản Lý CV
            </h2>
            <p className="modal-sub">Trích xuất kỹ năng, kinh nghiệm & dự án tự động bằng AI</p>
          </div>
          <div className="modal-body">
            <form id="cv-upload-form" style={{ marginBottom: '20px' }}>
              <div className="form-group">
                <label className="form-label">Tên CV (Tùy chọn)</label>
                <input
                  type="text"
                  id="cv-title-input"
                  className="form-input"
                  placeholder="Ví dụ: CV Backend Developer 2026"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Chọn CV (PDF, DOCX hoặc ảnh, tối đa 20 MB)</label>
                <input
                  type="file"
                  id="cv-file-input"
                  className="form-input"
                  accept=".pdf,.docx,.jpg,.jpeg,.png"
                  required
                />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                Tải Lên & Parse CV
              </button>
            </form>
            <h3 style={{ fontSize: '14px', color: 'var(--text-dim)', marginBottom: '10px' }}>
              Danh sách CV đã lưu của bạn:
            </h3>
            <div
              id="cv-list-container"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            ></div>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="modal-jd-overlay">
        <div className="modal-card" style={{ maxWidth: '680px' }}>
          <button className="modal-close" id="modal-jd-close">
            &times;
          </button>
          <div className="modal-header">
            <h2 className="modal-title">💼 Thư Viện Job Descriptions (JD)</h2>
            <p className="modal-sub">Chọn JD mẫu từ hệ thống hoặc dán JD công ty bên ngoài</p>
          </div>
          <div className="modal-body">
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button id="btn-tab-system-jds" className="tab active" style={{ flex: 1 }}>
                JD Mẫu Hệ Thống
              </button>
              <button id="btn-tab-custom-jd" className="tab" style={{ flex: 1 }}>
                Dán JD Tùy Chỉnh
              </button>
            </div>
            <div id="section-system-jds">
              <div
                id="jd-list-container"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              ></div>
            </div>
            <div id="section-custom-jd" style={{ display: 'none' }}>
              <div className="jd-modal-upload">
                <div className="jd-create-heading">
                  <div className="jd-create-icon">
                    <FileText size={32} />
                  </div>
                  <div>
                    <h3>Tải file JD theo mẫu</h3>
                    <p>PDF, DOCX, TXT, JPG, JPEG hoặc PNG — tối đa 20 MB.</p>
                  </div>
                </div>
                <button type="button" id="download-jd-template" className="jd-template-button">
                  ⬇ Tải mẫu JD (.txt)
                </button>
                <form id="upload-jd-form">
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">
                        Tên vị trí <span className="field-note">(tùy chọn)</span>
                      </label>
                      <input
                        type="text"
                        id="upload-jd-title"
                        className="form-input"
                        placeholder="Tự lấy từ tên file"
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Tên công ty</label>
                      <input
                        type="text"
                        id="upload-jd-company"
                        className="form-input"
                        placeholder="Tech Company"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Địa điểm</label>
                    <input
                      type="text"
                      id="upload-jd-location"
                      className="form-input"
                      placeholder="Hà Nội / Remote"
                    />
                  </div>
                  <label className="jd-file-drop compact" htmlFor="upload-jd-file">
                    <div
                      className="jd-file-drop-icon"
                      style={{ color: 'var(--accent)', marginBottom: '15px' }}
                    >
                      <Upload size={48} />
                    </div>
                    <strong>Chọn file JD</strong>
                    <span id="upload-jd-file-name">PDF, DOCX, TXT hoặc ảnh</span>
                  </label>
                  <input
                    type="file"
                    id="upload-jd-file"
                    className="visually-hidden-file"
                    accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
                    required
                  />
                  <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                    Tải lên &amp; lưu JD
                  </button>
                </form>
              </div>
              <div className="jd-section-divider">
                <span>HOẶC TỰ ĐIỀN NỘI DUNG</span>
              </div>
              <form id="custom-jd-form">
                <div className="form-group">
                  <label className="form-label">Tên vị trí công việc</label>
                  <input
                    type="text"
                    id="custom-jd-title"
                    className="form-input"
                    placeholder="Ví dụ: AI Engineer"
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Tên công ty</label>
                    <input
                      type="text"
                      id="custom-jd-company"
                      className="form-input"
                      placeholder="Tech Company"
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Địa điểm</label>
                    <input
                      type="text"
                      id="custom-jd-location"
                      className="form-input"
                      placeholder="Hà Nội"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Nội dung Yêu cầu Công việc (Requirements Text)
                  </label>
                  <textarea
                    id="custom-jd-requirements"
                    className="form-input"
                    style={{ height: '110px' }}
                    required
                  ></textarea>
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                  Lưu Job Description Tùy Chỉnh
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="modal-gap-overlay">
        <div className="modal-card" style={{ maxWidth: '720px' }}>
          <button className="modal-close" id="modal-gap-close">
            &times;
          </button>
          <div className="modal-header">
            <h2 className="modal-title">Phân Tích Match Score & Gap Analysis</h2>
            <p className="modal-sub">
              So khớp CV với JD & đề xuất tối ưu câu từ Chân Thật (Anti-Hallucination)
            </p>
          </div>
          <div className="modal-body">
            <div className="form-row gap-selection-grid" style={{ marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Chọn CV:</label>
                <div className="gap-select-shell">
                  <select
                    id="gap-select-cv"
                    className="form-input gap-select"
                    aria-label="Chọn CV để phân tích"
                  ></select>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Chọn JD Mục Tiêu:</label>
                <div className="gap-select-shell">
                  <select
                    id="gap-select-jd"
                    className="form-input gap-select"
                    aria-label="Chọn JD mục tiêu"
                  ></select>
                </div>
              </div>
            </div>
            <button
              id="btn-run-gap-analysis"
              className="btn-primary gap-analysis-submit"
              style={{ width: '100%', marginBottom: '16px' }}
            >
              <span>Phân Tích Khớp CV - JD</span>
            </button>

            <div
              id="gap-results-container"
              style={{
                display: 'none',
                background: 'rgba(255,255,255,0.03)',
                padding: '16px',
                borderRadius: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <span>Match Score:</span>
                <span id="gap-match-score-badge" className="badge badge-ok">
                  0%
                </span>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', color: 'var(--status-success-on-dark-fg)' }}>
                  Matching Skills:
                </p>
                <div
                  id="gap-matching-skills"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
                ></div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', color: 'var(--status-danger-on-dark-fg)' }}>
                  Missing Skills:
                </p>
                <div
                  id="gap-missing-skills"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
                ></div>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--status-info-on-dark-fg)' }}>
                  Đề xuất tối ưu ATS:
                </p>
                <div
                  id="gap-suggestions-list"
                  style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="modal-interview-overlay">
        <div
          className="modal-card"
          style={{ maxWidth: '760px', height: '85vh', display: 'flex', flexDirection: 'column' }}
        >
          <button className="modal-close" id="modal-interview-close">
            &times;
          </button>
          <div className="modal-header">
            <h2 className="modal-title">🎙️ Phòng Phỏng Vấn Thử (STAR Rubric)</h2>
            <p className="modal-sub">
              Đóng vai nhà tuyển dụng hỏi đáp chuyên sâu & tự động gợi mở follow-up
            </p>
          </div>
          <div
            id="interview-setup-section"
            style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}
          >
            <div
              className="interview-selection-grid"
              style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}
            >
              <div style={{ flex: 1 }}>
                <label className="form-label">Chọn CV Phỏng Vấn:</label>
                <div className="gap-select-shell interview-select-shell interview-select-cv">
                  <select
                    id="interview-select-cv"
                    className="form-input gap-select interview-select"
                    aria-label="Chọn CV phỏng vấn"
                  ></select>
                  <span className="gap-select-chevron" aria-hidden="true">
                    ⌄
                  </span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Chọn JD Ứng Tuyển:</label>
                <div className="gap-select-shell interview-select-shell interview-select-jd">
                  <select
                    id="interview-select-jd"
                    className="form-input gap-select interview-select"
                    aria-label="Chọn vị trí ứng tuyển"
                  ></select>
                  <span className="gap-select-chevron" aria-hidden="true">
                    ⌄
                  </span>
                </div>
              </div>
            </div>
            <button
              id="btn-start-interview-session"
              className="btn-primary"
              style={{ width: '100%' }}
            >
              Bắt Đầu Phiên Phỏng Vấn
            </button>
          </div>

          <div
            id="interview-chat-section"
            style={{ display: 'none', flex: 1, flexDirection: 'column', minHeight: 0 }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span
                id="interview-progress-text"
                style={{ fontSize: '12px', color: 'var(--text-dim)' }}
              >
                Câu hỏi 1 / 5
              </span>
              <span className="badge badge-ok">Đang diễn ra</span>
            </div>
            <div
              id="interview-chat-history"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            ></div>
            <form id="interview-answer-form" style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                id="interview-answer-input"
                className="form-input"
                placeholder="Nhập câu trả lời của bạn..."
                style={{ flex: 1 }}
                required
              />
              <button type="submit" className="btn-primary" id="btn-send-answer">
                Gửi
              </button>
            </form>
          </div>

          <div
            id="interview-report-section"
            style={{
              display: 'none',
              flex: 1,
              overflowY: 'auto',
              background: 'rgba(255,255,255,0.03)',
              padding: '16px',
              borderRadius: '12px',
            }}
          >
            <h3 style={{ fontSize: '16px', color: '#00e676' }}>
              📊 Báo Cáo Chấm Điểm Phỏng Vấn (STAR Rubric)
            </h3>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}
            >
              <span>Điểm Tổng Kết:</span>
              <span id="report-total-score" className="badge badge-ok" style={{ fontSize: '18px' }}>
                85/100
              </span>
            </div>
            <div
              id="report-star-breakdown"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            ></div>
            <div>
              <p style={{ fontSize: '12px', color: '#00e676' }}>💪 Điểm Mạnh:</p>
              <ul
                id="report-strengths-list"
                style={{ fontSize: '12px', color: 'var(--text-dim)' }}
              ></ul>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#ff8c42' }}>🛠️ Cần Cải Thiện:</p>
              <ul
                id="report-improvements-list"
                style={{ fontSize: '12px', color: 'var(--text-dim)' }}
              ></ul>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#b084fc' }}>🚀 Khuyên Luyện Tập:</p>
              <ul
                id="report-recommendations-list"
                style={{ fontSize: '12px', color: 'var(--text-dim)' }}
              ></ul>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Admin User Add/Edit Modal (Redesigned) ═══ */}
      <div className="modal-overlay" id="modal-admin-user-overlay">
        <div className="modal-card admin-user-modal-card">
          <button className="modal-close" id="modal-admin-user-close">
            &times;
          </button>

          {/* Header with avatar icon */}
          <div className="admin-modal-hero">
            <div className="admin-modal-avatar" id="admin-modal-avatar-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <h2 className="modal-title" id="admin-user-modal-title">
              Thêm Người Dùng Mới
            </h2>
            <p className="modal-sub" id="admin-user-modal-sub">
              Tạo tài khoản Student hoặc Counselor
            </p>
          </div>

          <form id="admin-user-form" className="admin-user-form">
            <input type="hidden" id="admin-edit-user-id" value="" />

            {/* Họ và tên */}
            <div className="form-group admin-form-group">
              <label className="form-label">Họ và tên</label>
              <div className="admin-input-wrap">
                <span className="admin-input-icon">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  type="text"
                  id="admin-input-fullname"
                  className="form-input admin-form-input"
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="form-group admin-form-group">
              <label className="form-label">Email</label>
              <div className="admin-input-wrap">
                <span className="admin-input-icon">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </span>
                <input
                  type="email"
                  id="admin-input-email"
                  className="form-input admin-form-input"
                  placeholder="user@example.com"
                  required
                />
              </div>
            </div>

            {/* Vai trò */}
            <div className="form-group admin-form-group">
              <label className="form-label">Vai trò</label>
              <div className="admin-input-wrap">
                <span className="admin-input-icon">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </span>
                <select
                  id="admin-input-role"
                  className="form-input admin-form-input admin-form-select"
                >
                  <option value="student">Sinh viên (Student)</option>
                  <option value="counselor">Cố vấn (Counselor)</option>
                </select>
              </div>
              <p className="admin-role-policy">
                🔒 Hệ thống chỉ có một Admin. Không thể cấp hoặc chuyển quyền Admin cho user khác.
              </p>
            </div>

            {/* Mật khẩu */}
            <div className="form-group admin-form-group">
              <label className="form-label" id="admin-label-password">
                Mật khẩu (Tối thiểu 6 ký tự)
              </label>
              <div className="admin-input-wrap">
                <span className="admin-input-icon">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type="password"
                  id="admin-input-password"
                  className="form-input admin-form-input"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" className="btn-primary admin-btn-save" id="btn-admin-save-user">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span id="admin-btn-save-text">Lưu Thông Tin Người Dùng</span>
            </button>
          </form>
        </div>
      </div>

      {/* ═══ Fixed Gemini Career Chatbot (Chỉ hiển thị sau khi Sinh viên ĐÃ ĐĂNG NHẬP) ═══ */}
      {resolvedState.role === 'student' && Boolean(resolvedState.user) && (
        <>
          <div id="ai-companion" className="ai-companion" aria-label="Chatbot AI Nova">
            <div id="ai-companion-hint" className="ai-companion-hint">
              <strong>Hỏi Nova</strong>
              <span>Hỗ trợ CV, JD và phỏng vấn</span>
            </div>
            <button
              type="button"
              id="ai-companion-avatar"
              className="ai-companion-avatar"
              aria-label="Mở chat với trợ lý AI Nova"
              aria-expanded="false"
              aria-controls="ai-companion-chat"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                id="ai-companion-source"
                className="ai-companion-source is-fallback"
                src="/assistant/idle-rotations-8dir.gif"
                alt="Nova - trợ lý nghề nghiệp AI"
                width={64}
                height={64}
                draggable={false}
              />
              <canvas
                id="ai-companion-canvas"
                className="ai-companion-canvas is-hidden"
                width="64"
                height="64"
                aria-hidden="true"
              ></canvas>
              <span className="ai-companion-launcher-copy">
                <strong>Hỏi Nova</strong>
                <small>Trợ lý nghề nghiệp</small>
              </span>
              <span
                id="ai-companion-status-dot"
                className="ai-companion-status-dot"
                aria-hidden="true"
              ></span>
            </button>
          </div>

          <aside id="ai-companion-chat" className="ai-companion-chat" aria-hidden="true" hidden>
            <header className="ai-chat-header">
              <div className="ai-chat-identity">
                <span className="ai-chat-orb" aria-hidden="true">
                  <Image
                    src="/images/chatbot.png"
                    alt=""
                    width={38}
                    height={38}
                    className="ai-chat-orb-image"
                  />
                </span>
                <div>
                  <strong>Nova · Trợ lý nghề nghiệp</strong>
                  <span id="ai-companion-status-text">Đang chuẩn bị hỗ trợ bạn</span>
                </div>
              </div>
              <div className="ai-chat-header-actions">
                <button
                  type="button"
                  id="ai-companion-history"
                  className="ai-chat-header-btn"
                  aria-label="Xem lịch sử hội thoại"
                  aria-expanded="false"
                  title="Lịch sử hội thoại"
                >
                  ☰
                </button>
                <button
                  type="button"
                  id="ai-companion-new-chat"
                  className="ai-chat-header-btn"
                  aria-label="Tạo cuộc hội thoại mới"
                  title="Cuộc trò chuyện mới"
                >
                  ＋
                </button>
                <button
                  type="button"
                  id="ai-companion-close"
                  className="ai-chat-close"
                  aria-label="Đóng cửa sổ chat"
                >
                  ×
                </button>
              </div>
            </header>
            <section
              id="ai-companion-history-panel"
              className="ai-chat-history-panel"
              aria-label="Lịch sử hội thoại"
              hidden
            >
              <div className="ai-chat-history-heading">
                <strong>Lịch sử hội thoại</strong>
                <span>Chỉ bạn có thể xem các cuộc trò chuyện này</span>
              </div>
              <div id="ai-companion-history-list" className="ai-chat-history-list"></div>
            </section>
            <div id="ai-companion-messages" className="ai-chat-messages" aria-live="polite">
              <div className="ai-chat-message assistant">
                <span className="ai-chat-message-name">Nova</span>
                <p>
                  Chào bạn. Hãy chọn một gợi ý bên dưới hoặc mô tả mục tiêu của bạn; Nova sẽ hướng dẫn
                  theo CV và JD bạn đang có.
                </p>
              </div>
            </div>
            <div className="ai-chat-quick-prompts" aria-label="Câu hỏi gợi ý">
              <button type="button" data-assistant-prompt="Tôi nên cải thiện CV từ đâu?">
                Cải thiện CV
              </button>
              <button
                type="button"
                data-assistant-prompt="Hãy hướng dẫn tôi phân tích khoảng cách với JD."
              >
                So khớp JD
              </button>
              <button type="button" data-assistant-prompt="Hãy giúp tôi luyện phỏng vấn STAR.">
                Luyện STAR
              </button>
            </div>
            <form id="ai-companion-form" className="ai-chat-form">
              <textarea
                id="ai-companion-input"
                rows={1}
                maxLength={4000}
                placeholder="Nhắn cho Nova…"
                aria-label="Tin nhắn gửi trợ lý AI"
              ></textarea>
              <button type="submit" id="ai-companion-send" aria-label="Gửi tin nhắn">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 2L11 13" />
                  <path d="M22 2l-7 20-4-9-9-4z" />
                </svg>
              </button>
            </form>
            <p className="ai-chat-privacy">
              Nova là trợ lý AI và có thể mắc sai sót. Hãy kiểm tra lại thông tin quan trọng.
            </p>
          </aside>
        </>
      )}

      {/* ═══ Delete Confirmation Modal ═══ */}
      <div className="modal-overlay" id="modal-delete-confirm-overlay">
        <div className="modal-card delete-confirm-card">
          <div className="delete-confirm-icon">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
          <h3 className="delete-confirm-title" id="delete-confirm-title">
            Xác Nhận Xóa Người Dùng
          </h3>
          <p className="delete-confirm-desc" id="delete-confirm-desc">
            Bạn có chắc chắn muốn xóa người dùng này?
          </p>
          <p className="delete-confirm-warning" id="delete-confirm-warning">
            ⚠️ Thao tác này không thể hoàn tác.
          </p>
          <div className="delete-confirm-actions">
            <button className="delete-confirm-btn-cancel" id="delete-confirm-cancel">
              Hủy bỏ
            </button>
            <button className="delete-confirm-btn-delete" id="delete-confirm-ok">
              Xóa Người Dùng
            </button>
          </div>
        </div>
      </div>
      {/* ═══ Global Job Preview Modal (dùng cho cả find-jobs & match) ═══
           Portaled vào <body> để luôn nằm trên mọi view và thoát khỏi mọi
           ngữ cảnh stacking/overflow của phần tử cha. Gate bằng isMounted để
           khớp SSR/hydration và bảo đảm node đã tồn tại trước khi app.js
           (import sau khi mount) truy vấn/gắn sự kiện qua id. */}
      {isMounted &&
        createPortal(
          <div
            id="job-preview-modal"
            className="cv-modal-overlay job-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết tin tuyển dụng"
            style={{ display: 'none' }}
          >
            <div className="cv-modal-card job-preview-modal-card">
              <button
                type="button"
                className="cv-modal-close"
                id="job-modal-close-btn"
                aria-label="Đóng chi tiết công việc"
              >
                ×
              </button>
              <div className="cv-modal-body job-preview-modal-content" id="job-modal-content" />
              <div className="cv-modal-footer">
                <a
                  id="job-modal-source-link"
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cv-modal-source-link"
                  style={{ display: 'none' }}
                >
                  Mở tin tuyển dụng gốc ↗
                </a>
                <button type="button" className="cv-modal-cancel" id="job-modal-cancel-btn">
                  Hủy
                </button>
                <button type="button" className="cv-modal-select" id="job-modal-select-btn">
                  Chọn Job này
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
