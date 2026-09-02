'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { ApiClient } from '@/api-client.js';
import { resolvePostLoginTarget, type RegisterMode } from '@/lib/authRouting';
import { loadGoogleIdentityServices, getGoogleId } from '@/lib/googleIdentity';
import '@/app/styles/auth-modal.css';

type AuthTab = 'login' | 'register';
type AuthPane = 'auth' | 'forgot';
type AuthRegisterView = RegisterMode;

interface Feedback {
  kind: 'error' | 'success' | 'info';
  message: string;
}

const OTP_TTL_SECONDS = 600;


function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Bề mặt đăng nhập / đăng ký DÙNG NHẤT của app — một modal duy nhất với hai
 * tab (Đăng nhập | Đăng ký). Toàn bộ API đi qua ApiClient; role sau đăng nhập
 * luôn do backend trả về và quyết định điểm đến (resolvePostLoginTarget).
 * Mọi điểm mở form (header, login gate, chatbot…) chỉ cần dispatch sự kiện
 * `authx:open` — component tự lắng nghe và mở tại chỗ, không reload.
 */
export default function AuthModal() {
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<AuthPane>('auth');
  const [tab, setTab] = useState<AuthTab>('login');
  const [registerView, setRegisterView] = useState<AuthRegisterView>('entry');
  /* Hướng chuyển cảnh của vùng panel (auth-modal.css §4):
       'tab'  đổi tab       → mờ dần + trượt dọc
       'fwd'  chọn vai trò  → trượt ngang vào từ phải
       'back' quay lại      → trượt ngang vào từ trái */
  const [viewDir, setViewDir] = useState<'tab' | 'fwd' | 'back'>('tab');

  // ── Login state ──
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);

  // ── Register state ──
  const [fullName, setFullName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registerBusy, setRegisterBusy] = useState(false);

  // ── Forgot-password state (3 bước trong cùng modal) ──
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1);
  const [resetSecondsLeft, setResetSecondsLeft] = useState(OTP_TTL_SECONDS);
  const [resetBusy, setResetBusy] = useState(false);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const nextPathRef = useRef<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const googleHostRef = useRef<HTMLDivElement>(null);
  const googleInitRef = useRef(false);

  /* ── Open/close plumbing ─────────────────────────────────────── */

  useEffect(() => {
    document.body.setAttribute('data-authx-mounted', 'true');
    return () => {
      document.body.removeAttribute('data-authx-mounted');
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setFeedback(null);
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      if (
        path === '/login' ||
        path.startsWith('/login/') ||
        path === '/register' ||
        path.startsWith('/register/')
      ) {
        window.history.replaceState({ view: 'dashboard' }, '', '/');
      }
    }
  }, []);

  const openFor = useCallback(
    (options?: { tab?: AuthTab; mode?: RegisterMode; next?: string | null }) => {
      nextPathRef.current =
        typeof options?.next === 'string' &&
          options.next.startsWith('/') &&
          !options.next.startsWith('//')
          ? options.next
          : null;
      setPane('auth');
      setTab(options?.tab === 'register' ? 'register' : 'login');
      setRegisterView(options?.mode ?? 'entry');
      setViewDir('tab');
      setFeedback(null);
      setOpen(true);
    },
    [],
  );

  // Deep-link: /login?next=… và /register[/student|/enterprise] mở đúng tab/bước.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname.toLowerCase();
    if (path === '/login' || path.startsWith('/login/')) {
      const next = new URLSearchParams(window.location.search).get('next');
      openFor({ tab: 'login', next });
    } else if (path === '/register' || path.startsWith('/register/')) {
      const rest = path.replace(/^\/register\/?/, '');
      const mode: RegisterMode = rest.startsWith('student')
        ? 'student'
        : rest.startsWith('counselor')
          ? 'counselor'
          : 'entry';
      openFor({ tab: 'register', mode });
    }
  }, [openFor]);

  // Bridge cho mọi caller legacy (app.js gates, Nova chatbot, header…).
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      openFor({
        tab: detail.tab === 'register' ? 'register' : 'login',
        mode: typeof detail.mode === 'string' ? detail.mode : undefined,
        next: typeof detail.next === 'string' ? detail.next : null,
      });
    };
    document.addEventListener('authx:open', handler);
    return () => document.removeEventListener('authx:open', handler);
  }, [openFor]);

  // Body scroll lock (bù scrollbar để layout không nhảy ngang).
  useEffect(() => {
    if (!open) return;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  // Escape đóng + focus trap cơ bản trong dialog.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== 'Tab' || !cardRef.current) return;
      const focusables = cardRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !cardRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, close]);

  // Đưa focus vào input đầu tiên mỗi lần đổi pane/tab/bước.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const card = cardRef.current;
      if (!card) return;
      const input = card.querySelector<HTMLElement>('input:not([type="hidden"])');
      if (input) {
        input.focus();
        return;
      }
      // Panel không có input (chọn vai trò, kích hoạt Cố vấn): thẻ vừa bấm đã
      // bị thay thế nên focus rơi về <body> và Tab thoát ra trang phía sau.
      // Đưa focus vào chính panel — không focus nút để tránh nhấp nháy viền.
      card.querySelector<HTMLElement>('.authx-panel')?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, pane, tab, registerView, resetStep]);

  /* ── Post-login routing: role backend quyết định đích đến ────── */

  const finishWithUser = useCallback((user: any) => {
    window.location.replace(resolvePostLoginTarget(user?.role ?? null, nextPathRef.current));
  }, []);

  const handleGoogleCredential = useCallback(
    async (response: any) => {
      if (!response?.credential) {
        setFeedback({ kind: 'error', message: 'Google không trả về thông tin đăng nhập.' });
        return;
      }
      try {
        // Google chỉ phục vụ tài khoản Sinh viên; backend luôn gán STUDENT cho
        // tài khoản Google mới bất kể payload gửi kèm.
        await ApiClient.googleAuth(response.credential, 'student');
        finishWithUser(ApiClient.getUser());
      } catch (err: any) {
        setFeedback({
          kind: 'error',
          message: err?.message || 'Không thể đăng nhập bằng Google.',
        });
      }
    },
    [finishWithUser],
  );

  /* ── Google (chỉ tài khoản Sinh viên — đúng luật hiện hành) ──── */

  const setupGoogleButton = useCallback(async () => {
    const host = googleHostRef.current;
    if (!host || !host.isConnected) return;
    try {
      await loadGoogleIdentityServices();
      const googleId = getGoogleId();
      if (!googleId || !host.isConnected) return;
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || '';
      if (!clientId) {
        host.innerHTML =
          '<span class="authx-google-loading">Google OAuth chưa được cấu hình.</span>';
        return;
      }
      if (!googleInitRef.current) {
        googleId.initialize({
          client_id: clientId,
          callback: (response: any) => void handleGoogleCredential(response),
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
          itp_support: true,
        });
        googleInitRef.current = true;
      }
      host.innerHTML = '';
      googleId.renderButton(host, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: tab === 'login' ? 'continue_with' : 'signup_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        // GIS chỉ nhận width trong dải 200–400px; truyền quá 400 sẽ bị nó tự
        // chốt lại nên nhãn bị dựng theo một chiều rộng khác khung host. Đưa
        // đúng chiều rộng host (đã trừ viền qua clientWidth) rồi kẹp vào dải
        // hợp lệ — phần dôi ra do CSS kéo `width: 100%` lo.
        width: Math.min(Math.max(host.clientWidth || 320, 200), 400),
        locale: 'vi',
      });
    } catch (err: any) {
      if (!host.isConnected) return;
      host.innerHTML =
        '<button type="button" class="authx-google-retry">Tải lại nút Google</button>';
      host.querySelector('.authx-google-retry')?.addEventListener('click', () => {
        void setupGoogleButton();
      });
      setFeedback({
        kind: 'info',
        message: err?.message || 'Không tải được Google. Bạn vẫn có thể tiếp tục bằng Email.',
      });
    }
  }, [handleGoogleCredential, tab]);

  useEffect(() => {
    if (!open || pane === 'forgot') return;
    const wantGoogle = tab === 'login' || (tab === 'register' && registerView === 'student');
    if (!wantGoogle) return;
    let cancelled = false;
    // Chờ layout xong để đo đúng chiều rộng host cho nút Google.
    const raf = requestAnimationFrame(() => {
      if (!cancelled) void setupGoogleButton();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [open, pane, tab, registerView, setupGoogleButton]);

  /* ── Login submit ────────────────────────────────────────────── */

  const handleLoginSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const email = loginEmail.trim();
      setFieldErrors({});
      if (!email || !loginPassword) {
        setFieldErrors({
          ...(!email ? { loginEmail: 'Vui lòng nhập địa chỉ email.' } : {}),
          ...(!loginPassword ? { loginPassword: 'Vui lòng nhập mật khẩu.' } : {}),
        });
        setFeedback({ kind: 'error', message: 'Vui lòng điền đầy đủ Email và Mật khẩu.' });
        return;
      }
      setLoginBusy(true);
      setFeedback(null);
      try {
        await ApiClient.login(email, loginPassword);
        finishWithUser(ApiClient.getUser());
      } catch (err: any) {
        setFeedback({
          kind: 'error',
          message: err?.message || 'Đăng nhập thất bại. Vui lòng thử lại.',
        });
      } finally {
        setLoginBusy(false);
      }
    },
    [finishWithUser, loginEmail, loginPassword],
  );

  /* ── Register submit ─────────────────────────────────────────── */

  const handleRegisterSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const mode: 'student' | 'counselor' =
        registerView === 'counselor' ? 'counselor' : 'student';
      const trimmedName = fullName.trim();
      const trimmedEmail = registerEmail.trim();

      setFieldErrors({});

      if (!trimmedName || !trimmedEmail || registerPassword.length < 6) {
        setFieldErrors({
          ...(!trimmedName ? { fullName: 'Vui lòng nhập họ và tên.' } : {}),
          ...(!trimmedEmail ? { registerEmail: 'Vui lòng nhập địa chỉ email.' } : {}),
          ...(registerPassword.length < 6
            ? { registerPassword: 'Mật khẩu cần có ít nhất 6 ký tự.' }
            : {}),
        });
        setFeedback({
          kind: 'error',
          message: 'Vui lòng điền đầy đủ thông tin (mật khẩu tối thiểu 6 ký tự).',
        });
        return;
      }
      setRegisterBusy(true);
      setFeedback(null);
      try {
        await (ApiClient as any).register(
          trimmedEmail,
          registerPassword,
          trimmedName,
          mode,
        );
        await ApiClient.login(trimmedEmail, registerPassword);
        finishWithUser(ApiClient.getUser());
      } catch (err: any) {
        setFeedback({
          kind: 'error',
          message: err?.message || 'Không thể hoàn tất đăng ký. Vui lòng thử lại.',
        });
      } finally {
        setRegisterBusy(false);
      }
    },
    [finishWithUser, fullName, registerEmail, registerPassword, registerView],
  );

  /* ── Forgot password (3 bước, cùng modal) ────────────────────── */

  const openForgotPane = useCallback(() => {
    setResetEmail(loginEmail.trim());
    setResetStep(1);
    setResetOtp('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetSecondsLeft(OTP_TTL_SECONDS);
    setFeedback(null);
    setPane('forgot');
  }, [loginEmail]);

  const backToLogin = useCallback(() => {
    setPane('auth');
    setTab('login');
    setFeedback(null);
  }, []);

  useEffect(() => {
    if (pane !== 'forgot' || resetStep !== 2) return;
    setResetSecondsLeft(OTP_TTL_SECONDS);
    const interval = window.setInterval(() => {
      setResetSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [pane, resetStep]);

  const handleForgotSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const email = resetEmail.trim();

      if (resetStep === 1) {
        if (!email) {
          setFeedback({ kind: 'error', message: 'Vui lòng nhập địa chỉ Email.' });
          return;
        }
        setResetBusy(true);
        setFeedback(null);
        try {
          await ApiClient.requestPasswordReset(email);
          setResetStep(2);
          setFeedback({
            kind: 'success',
            message: `Mã xác thực 6 số đã được gửi đến ${email}. Kiểm tra hộp thư Gmail nhé.`,
          });
        } catch (err: any) {
          setFeedback({
            kind: 'error',
            message: err?.message || 'Không gửi được mã xác thực. Vui lòng thử lại.',
          });
        } finally {
          setResetBusy(false);
        }
        return;
      }

      if (resetStep === 2) {
        if (!/^\d{6}$/.test(resetOtp.trim())) {
          setFeedback({ kind: 'error', message: 'Vui lòng nhập mã OTP gồm 6 số.' });
          return;
        }
        setResetStep(3);
        setFeedback(null);
        return;
      }

      if (!resetNewPassword || resetNewPassword.length < 8) {
        setFeedback({ kind: 'error', message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
        return;
      }
      if (resetNewPassword !== resetConfirmPassword) {
        setFeedback({ kind: 'error', message: 'Mật khẩu xác nhận không khớp.' });
        return;
      }
      setResetBusy(true);
      setFeedback(null);
      try {
        const result = await ApiClient.confirmPasswordReset(
          email,
          resetOtp.trim(),
          resetNewPassword,
        );
        setFeedback({
          kind: 'success',
          message: result?.message || 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay.',
        });
        setLoginEmail(email);
        setLoginPassword('');
        window.setTimeout(backToLogin, 900);
      } catch (err: any) {
        const message = err?.message || 'Không đặt lại được mật khẩu. Vui lòng thử lại.';
        setFeedback({ kind: 'error', message });
        if (/otp|mã/i.test(message)) {
          setResetStep(2);
        }
      } finally {
        setResetBusy(false);
      }
    },
    [backToLogin, resetConfirmPassword, resetEmail, resetNewPassword, resetOtp, resetStep],
  );

  /* ── Derived UI flags ────────────────────────────────────────── */

  const isStudentRegister = registerView === 'student';
  const isCounselorRegister = registerView === 'counselor';
  const showGoogleOnRegister = tab === 'register' && isStudentRegister;
  const showGoogleOnLogin = tab === 'login';
  const otpExpired = resetStep === 2 && resetSecondsLeft <= 0;

  const feedbackClass =
    feedback?.kind === 'error'
      ? 'authx-feedback authx-feedback-error'
      : feedback?.kind === 'success'
        ? 'authx-feedback authx-feedback-success'
        : 'authx-feedback authx-feedback-info';

  const switchTab = (nextTab: AuthTab) => {
    if (nextTab === tab) return;
    setPane('auth');
    setTab(nextTab);
    setRegisterView('entry');
    setViewDir('tab');
    setFeedback(null);
    setFieldErrors({});
    if (nextTab === 'register' && !registerEmail) setRegisterEmail(loginEmail);
    if (nextTab === 'login' && !loginEmail) setLoginEmail(registerEmail);
  };

  // Chọn vai trò: thay nội dung TẠI CHỖ (cùng vùng panel), trượt vào từ phải.
  const pickRole = (next: Exclude<AuthRegisterView, 'entry'>) => {
    setViewDir('fwd');
    setRegisterView(next);
    setFeedback(null);
  };

  // Quay lại bộ chọn loại tài khoản — thay thế nội dung tại chỗ, không thêm hàng link.
  const backToChoices = () => {
    setViewDir('back');
    setRegisterView('entry');
    setFeedback(null);
    setFieldErrors({});
  };

  /* Khoá chuyển cảnh: đổi khoá ⇒ panel unmount/mount ⇒ animation chạy lại.
     Không đặt trên `.authx-panel-host` để hộp giữ chiều cao không bị dựng lại,
     nhờ vậy kích thước modal đứng yên trong lúc nội dung đổi. */
  const viewKey = tab === 'login' ? 'login' : `register:${registerView}`;

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div
      id="register-overlay"
      className={`authx-overlay${open ? ' is-open' : ''}`}
      aria-hidden={!open}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={cardRef}
        className="authx-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="authx-title"
      >
        <button type="button" className="authx-close" aria-label="Đóng" onClick={close}>
          <X size={18} />
        </button>

        {/* Đầu thẻ cố định: logo + đúng MỘT thanh tab 2 cột */}
        <div className="authx-head">
          <div className="authx-brand">
            <Image src="/images/image2.png" alt="" width={28} height={28} priority />
            <span>Career Assistant</span>
          </div>

          {pane === 'auth' && (
            <div className="authx-tabs" role="tablist" aria-label="Đăng nhập hoặc đăng ký">
              <button
                type="button"
                role="tab"
                id="authx-tab-login"
                aria-selected={tab === 'login'}
                aria-controls="authx-panel-login"
                className={`authx-tab${tab === 'login' ? ' is-active' : ''}`}
                data-testid="auth-tab-login"
                onClick={() => switchTab('login')}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                role="tab"
                id="authx-tab-register"
                aria-selected={tab === 'register'}
                aria-controls="authx-panel-register"
                className={`authx-tab${tab === 'register' ? ' is-active' : ''}`}
                data-testid="auth-tab-register"
                onClick={() => switchTab('register')}
              >
                Đăng ký
              </button>
            </div>
          )}
        </div>

        <div className="authx-body ui-scroll-thin">
          {pane === 'forgot' ? (
            <form className="authx-pane" onSubmit={handleForgotSubmit} noValidate key="forgot">
              <h2 className="authx-title" id="authx-title">
                {resetStep === 1
                  ? 'Quên mật khẩu?'
                  : resetStep === 2
                    ? 'Nhập mã xác thực'
                    : 'Tạo mật khẩu mới'}
              </h2>
              <p className="authx-subtitle">
                {resetStep === 1
                  ? 'Nhập email đã đăng ký để nhận mã xác thực OTP.'
                  : resetStep === 2
                    ? `Mã OTP 6 chữ số đã được gửi đến ${resetEmail.trim()}.`
                    : 'Mật khẩu mới phải có tối thiểu 8 ký tự.'}
              </p>

              {resetStep === 1 && (
                <div className="authx-field">
                  <label className="authx-label" htmlFor="authx-reset-email">
                    Địa chỉ Email
                  </label>
                  <div className="authx-input-wrap">
                    <Mail size={17} className="authx-input-icon" aria-hidden="true" />
                    <input
                      id="authx-reset-email"
                      type="email"
                      className="authx-input has-icon"
                      placeholder="you@example.com"
                      autoComplete="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {resetStep === 2 && (
                <>
                  <div className="authx-field">
                    <label className="authx-label" htmlFor="authx-reset-otp">
                      Mã xác thực OTP
                    </label>
                    <input
                      id="authx-reset-otp"
                      type="text"
                      className="authx-input authx-otp"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="••••••"
                      autoComplete="one-time-code"
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <p className={`authx-otp-timer${otpExpired ? ' is-expired' : ''}`} role="status">
                    {otpExpired
                      ? 'Mã OTP đã hết hạn.'
                      : `Mã hết hạn trong: ${formatCountdown(resetSecondsLeft)}`}
                  </p>
                </>
              )}

              {resetStep === 3 && (
                <>
                  <div className="authx-field">
                    <label className="authx-label" htmlFor="authx-reset-new">
                      Mật khẩu mới
                    </label>
                    <div className="authx-input-wrap">
                      <Lock size={17} className="authx-input-icon" aria-hidden="true" />
                      <input
                        id="authx-reset-new"
                        name="new_password"
                        type={showResetPassword ? 'text' : 'password'}
                        className="authx-input has-icon has-trailing"
                        placeholder="Tối thiểu 8 ký tự"
                        autoComplete="new-password"
                        minLength={8}
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="authx-toggle-password"
                        onClick={() => setShowResetPassword((v) => !v)}
                        aria-label={showResetPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showResetPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>
                  <div className="authx-field">
                    <label className="authx-label" htmlFor="authx-reset-confirm">
                      Xác nhận mật khẩu mới
                    </label>
                    <div className="authx-input-wrap">
                      <Lock size={17} className="authx-input-icon" aria-hidden="true" />
                      <input
                        id="authx-reset-confirm"
                        name="confirm_password"
                        type={showResetPassword ? 'text' : 'password'}
                        className="authx-input has-icon has-trailing"
                        placeholder="Nhập lại mật khẩu mới"
                        autoComplete="new-password"
                        minLength={8}
                        value={resetConfirmPassword}
                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <p className={feedbackClass} role="alert" aria-live="polite" hidden={!feedback}>
                {feedback?.message}
              </p>

              <button type="submit" className="authx-submit" disabled={resetBusy}>
                {resetBusy
                  ? 'Đang xử lý…'
                  : resetStep === 1
                    ? 'Gửi mã xác thực'
                    : resetStep === 2
                      ? 'Xác thực mã OTP'
                      : 'Lưu mật khẩu mới'}
              </button>

              <button type="button" className="authx-text-link" onClick={backToLogin}>
                <ArrowLeft size={13} /> Quay lại đăng nhập
              </button>
            </form>
          ) : (
            /* Hộp giữ kích thước ổn định; class hướng quyết định kiểu trượt */
            <div className={`authx-panel-host is-${viewDir}`}>
              {tab === 'login' ? (
                <section
                  key={viewKey}
                  id="authx-panel-login"
                  role="tabpanel"
                  aria-labelledby="authx-tab-login"
                  className="authx-panel"
                  tabIndex={-1}
                >
                  <h2 className="authx-title" id="authx-title">
                    Chào mừng trở lại
                  </h2>

                  <div className="authx-google-zone" data-testid="login-google-zone">
                    <div
                      id="google-signin-button"
                      ref={showGoogleOnLogin ? googleHostRef : undefined}
                      className="authx-google-host"
                      aria-live="polite"
                    >
                      {showGoogleOnLogin && (
                        <span className="authx-google-loading">Đang tải nút Google…</span>
                      )}
                    </div>
                    <div className="authx-divider">
                      <span>hoặc dùng Email</span>
                    </div>
                  </div>

                  <form onSubmit={handleLoginSubmit} noValidate data-testid="login-form">
                    <div className="authx-field">
                      <label className="authx-label" htmlFor="authx-login-email">
                        Email
                      </label>
                      <div className="authx-input-wrap">
                        <Mail size={17} className="authx-input-icon" aria-hidden="true" />
                        <input
                          id="authx-login-email"
                          type="email"
                          className="authx-input has-icon"
                          placeholder="you@example.com"
                          autoComplete="email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                        />
                      </div>
                      {fieldErrors.loginEmail && (
                        <p className="authx-field-error">{fieldErrors.loginEmail}</p>
                      )}
                    </div>

                    <div className="authx-field">
                      {/* `Mật khẩu` + `Quên mật khẩu?` cùng một hàng, link là chữ xanh thuần */}
                      <div className="authx-label-row">
                        <label className="authx-label" htmlFor="authx-login-password">
                          Mật khẩu
                        </label>
                        <button
                          type="button"
                          className="authx-inline-link"
                          data-testid="forgot-password-link"
                          onClick={openForgotPane}
                        >
                          Quên mật khẩu?
                        </button>
                      </div>
                      <div className="authx-input-wrap">
                        <Lock size={17} className="authx-input-icon" aria-hidden="true" />
                        <input
                          id="authx-login-password"
                          type={showLoginPassword ? 'text' : 'password'}
                          className="authx-input has-icon has-trailing"
                          placeholder="Nhập mật khẩu của bạn"
                          autoComplete="current-password"
                          minLength={6}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="authx-toggle-password"
                          onClick={() => setShowLoginPassword((v) => !v)}
                          aria-label={showLoginPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showLoginPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                      {fieldErrors.loginPassword && (
                        <p className="authx-field-error">{fieldErrors.loginPassword}</p>
                      )}
                    </div>

                    <p
                      className={feedbackClass}
                      role="alert"
                      aria-live="polite"
                      hidden={!feedback}
                    >
                      {feedback?.message}
                    </p>

                    <button type="submit" className="authx-submit" disabled={loginBusy}>
                      {loginBusy ? (
                        'Đang đăng nhập…'
                      ) : (
                        <>
                          <LogIn size={16} /> Đăng nhập
                        </>
                      )}
                    </button>

                    {/* Dòng gợi ý duy nhất dưới CTA — chỉ chữ, chuyển sang tab Đăng ký
                        tại chỗ (không mở modal khác, không thêm CTA thứ hai). */}
                    <p className="authx-helper">
                      Chưa có tài khoản?{' '}
                      <button
                        type="button"
                        className="authx-helper-link"
                        data-testid="login-to-register-link"
                        onClick={() => switchTab('register')}
                      >
                        Đăng ký ngay
                      </button>
                    </p>
                  </form>
                </section>
              ) : registerView === 'entry' ? (
                <section
                  key={viewKey}
                  id="authx-panel-register"
                  role="tabpanel"
                  aria-labelledby="authx-tab-register"
                  className="authx-panel"
                  data-testid="register-role-choices"
                  tabIndex={-1}
                >
                  <h2 className="authx-title" id="authx-title">
                    Bạn đăng ký với vai trò nào?
                  </h2>

                  {/* 3 lựa chọn gọn trên một hàng; chọn xong thay luôn nội dung
                      vùng này. Điều kiện của từng vai trò ghi ngay trên card —
                      không dồn cả ba vào một câu ở dưới. */}
                  <div className="authx-choice-list">
                    <button
                      type="button"
                      className="authx-choice-card"
                      data-testid="register-choice-student"
                      onClick={() => pickRole('student')}
                    >
                      <span className="authx-choice-icon is-student">
                        <GraduationCap size={20} />
                      </span>
                      <span className="authx-choice-text">
                        <span className="authx-choice-label">Sinh viên</span>
                        <span className="authx-choice-desc">Tự đăng ký miễn phí</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="authx-choice-card"
                      data-testid="register-counselor-activation"
                      onClick={() => pickRole('counselor')}
                    >
                      <span className="authx-choice-icon is-counselor">
                        <ShieldCheck size={20} />
                      </span>
                      <span className="authx-choice-text">
                        <span className="authx-choice-label">Cố vấn</span>
                        <span data-testid="register-counselor-note" className="authx-choice-desc">Cần lời mời</span>
                      </span>
                    </button>

                    <Link href="/register/student" tabIndex={-1} hidden aria-hidden="true">Đăng ký Sinh viên</Link>
                  </div>
                </section>
              ) : registerView === 'counselor' ? (
                <section
                  key={viewKey}
                  id="authx-panel-register"
                  role="tabpanel"
                  aria-labelledby="authx-tab-register"
                  className="authx-panel authx-activation-panel"
                  data-testid="register-counselor-activation"
                  tabIndex={-1}
                >
                  <div className="authx-pane-head">
                    <button
                      type="button"
                      className="authx-back"
                      aria-label="Chọn lại loại tài khoản"
                      onClick={backToChoices}
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <h2 className="authx-title" id="authx-title">
                      Kích hoạt tài khoản Cố vấn
                    </h2>
                  </div>

                  <div className="authx-note-stack">
                    <p className="authx-note">
                      <ShieldCheck size={14} aria-hidden="true" />
                      <span>
                        Tài khoản Cố vấn được tạo qua lời mời. Hãy mở email mời để đặt mật khẩu và
                        kích hoạt tài khoản.
                      </span>
                    </p>
                    <p className="authx-note">
                      <Mail size={14} aria-hidden="true" />
                      <span>
                        Chưa nhận được lời mời? Liên hệ quản trị viên hoặc đơn vị đào tạo của bạn.
                      </span>
                    </p>
                  </div>
                </section>
              ) : (
                <section
                  key={viewKey}
                  id="authx-panel-register"
                  role="tabpanel"
                  aria-labelledby="authx-tab-register"
                  className="authx-panel"
                  data-testid="register-form-view"
                  tabIndex={-1}
                >
                  <div className="authx-pane-head">
                    <button
                      type="button"
                      className="authx-back"
                      aria-label="Chọn lại loại tài khoản"
                      onClick={backToChoices}
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <h2 className="authx-title" id="authx-title">
                      {isCounselorRegister ? 'Tài khoản Cố vấn' : 'Tài khoản Sinh viên'}
                    </h2>
                  </div>

                  {showGoogleOnRegister && (
                    <div className="authx-google-zone" data-testid="register-google-button">
                      <div ref={googleHostRef} className="authx-google-host" aria-live="polite">
                        <span className="authx-google-loading">Đang tải nút Google…</span>
                      </div>
                      <div className="authx-divider">
                        <span>hoặc dùng Email</span>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleRegisterSubmit} noValidate data-testid="register-form">
                    <div className="authx-field">
                      <label className="authx-label" htmlFor="authx-register-fullname">
                        Họ và tên
                      </label>
                      <div className="authx-input-wrap">
                        <UserRound size={17} className="authx-input-icon" aria-hidden="true" />
                        <input
                          id="authx-register-fullname"
                          type="text"
                          className="authx-input has-icon"
                          placeholder="Nguyễn Văn A"
                          autoComplete="name"
                          minLength={2}
                          maxLength={255}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                        />
                      </div>
                      {fieldErrors.fullName && (
                        <p className="authx-field-error">{fieldErrors.fullName}</p>
                      )}
                    </div>

                    <div className="authx-field">
                      <label className="authx-label" htmlFor="authx-register-email">
                        Email
                      </label>
                      <div className="authx-input-wrap">
                        <Mail size={17} className="authx-input-icon" aria-hidden="true" />
                        <input
                          id="authx-register-email"
                          type="email"
                          className="authx-input has-icon"
                          placeholder="you@example.com"
                          autoComplete="email"
                          value={registerEmail}
                          onChange={(e) => setRegisterEmail(e.target.value)}
                          required
                        />
                      </div>
                      {fieldErrors.registerEmail && (
                        <p className="authx-field-error">{fieldErrors.registerEmail}</p>
                      )}
                    </div>

                    <div className="authx-field">
                      <label className="authx-label" htmlFor="authx-register-password">
                        Mật khẩu
                      </label>
                      <div className="authx-input-wrap">
                        <Lock size={17} className="authx-input-icon" aria-hidden="true" />
                        <input
                          id="authx-register-password"
                          type={showRegisterPassword ? 'text' : 'password'}
                          className="authx-input has-icon has-trailing"
                          placeholder="Tối thiểu 6 ký tự"
                          autoComplete="new-password"
                          minLength={6}
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="authx-toggle-password"
                          onClick={() => setShowRegisterPassword((v) => !v)}
                          aria-label={showRegisterPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showRegisterPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                      {fieldErrors.registerPassword && (
                        <p className="authx-field-error">{fieldErrors.registerPassword}</p>
                      )}
                    </div>

                    <p
                      className={feedbackClass}
                      role="alert"
                      aria-live="polite"
                      hidden={!feedback}
                      data-testid="register-feedback"
                    >
                      {feedback?.message}
                    </p>

                    <button type="submit" className="authx-submit" disabled={registerBusy}>
                      {registerBusy
                        ? 'Đang tạo tài khoản…'
                        : isCounselorRegister
                          ? 'Đăng ký Cố vấn'
                          : 'Đăng ký Sinh viên'}
                    </button>
                  </form>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
