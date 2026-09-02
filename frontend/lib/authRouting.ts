/**
 * Shared, framework-agnostic auth routing contract.
 *
 * Single source of truth for:
 *   - role normalization (backend returns lowercase: student | counselor | admin)
 *   - role → portal URL mapping (/student · /counselor · /admin)
 *   - strict per-role view whitelists (route guards)
 *   - initial route resolution from URL + cached/verified session
 *
 * Consumed by app/page.tsx (React bootstrap) and kept in sync with the legacy
 * controller's ROLE_ALLOWED_VIEWS in app.js (plain script — cannot import TS).
 */

export type AppRole = 'student' | 'counselor' | 'admin';
export type SessionRole = AppRole | 'guest';

export const PORTAL_PATHS: Readonly<Record<AppRole, string>> = Object.freeze({
  student: '/student',
  counselor: '/counselor',
  admin: '/admin',
});

const ROLE_PORTAL_PREFIXES = ['/student', '/counselor', '/admin'] as const;

/**
 * Public registration surfaces. Only Student may self-register;
 * Counselors are provisioned by Admin and Admin is never publicly creatable.
 */
export type RegisterMode = 'entry' | 'student' | 'counselor';

/** True when the path points at one of the public /register surfaces. */
export function isRegisterPath(pathname: string): boolean {
  const path = (pathname || '').toLowerCase();
  return path === '/register' || path.startsWith('/register/');
}

/** Which registration surface the path addresses (unknown sub-paths → entry). */
export function getRegisterMode(pathname: string): RegisterMode {
  if (!isRegisterPath(pathname)) return 'entry';
  const rest = (pathname || '').toLowerCase().replace(/^\/register\/?/, '');
  if (rest.startsWith('student')) return 'student';
  if (rest.startsWith('counselor')) return 'counselor';
  return 'entry';
}

/** Backend roles arrive lowercase; accept any casing defensively. */
export function normalizeRole(raw: unknown): AppRole | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  if (value === 'student' || value === 'counselor' || value === 'admin') {
    return value;
  }
  return null;
}

/** Canonical portal URL for a backend role; null for unknown/guest. */
export function getPortalPath(role: unknown): string | null {
  const normalized = normalizeRole(role);
  return normalized ? PORTAL_PATHS[normalized] : null;
}

/**
 * Map a URL path (or legacy hash) to the SPA view it addresses.
 * Role roots are that role's dashboard; nested deep links collapse to the
 * portal root view here — the per-portal parsers in CounselorView
 * own sub-tab detail afterwards.
 */
export function getViewFromLocation(pathname: string, hash = ''): string {
  const path = (pathname || '').toLowerCase();
  const fragment = (hash || '').toLowerCase();
  const source = path && path !== '/' ? path : fragment;

  if (source.startsWith('/counselor') || source.startsWith('#counselor')) return 'counselor';
  if (source.startsWith('/admin') || source.startsWith('#admin')) return 'admin';
  if (source.startsWith('/student')) {
    if (source.startsWith('/student/cv') || source === '/student/cv') return 'cv';
    if (/\/student\/jobs\/[^/]+/.test(source)) return 'job-detail';
    if (source.startsWith('/student/find-jobs') || source === '/student/find-jobs') return 'find-jobs';
    if (source.startsWith('/student/jobs') || source === '/student/jobs') return 'jobs';
    if (source.startsWith('/student/match') || source === '/student/match') return 'match';
    if (source.startsWith('/student/gap') || source === '/student/gap') return 'gap';
    if (
      source.startsWith('/student/interview-report') ||
      source.startsWith('/student/interview/report') ||
      source === '/student/interview-report'
    )
      return 'interview-report';
    if (source.startsWith('/student/interview') || source === '/student/interview') return 'interview';
    if (source.startsWith('/student/history') || source === '/student/history') return 'history';
    if (source.startsWith('/student/internship') || source === '/student/internship') return 'internship';
    if (source.startsWith('/student/profile') || source === '/student/profile') return 'profile';
    if (source.startsWith('/student/notifications') || source === '/student/notifications') return 'notifications';
    if (source.startsWith('/student/upgrade') || source === '/student/upgrade') return 'upgrade';
    // Fallback for sub-path fragments
    if (source.includes('/cv')) return 'cv';
    if (source.includes('/find-jobs')) return 'find-jobs';
    if (source.includes('/jobs')) return 'jobs';
    if (source.includes('/match')) return 'match';
    if (source.includes('/gap')) return 'gap';
    if (source.includes('/interview-report') || source.includes('/interview/report')) return 'interview-report';
    if (source.includes('/interview')) return 'interview';
    if (source.includes('/history')) return 'history';
    if (source.includes('/internship')) return 'internship';
    if (source.includes('/profile')) return 'profile';
    if (source.includes('/notifications')) return 'notifications';
    if (source.includes('/upgrade')) return 'upgrade';
    return 'dashboard';
  }
  // Legacy bare student views (/cv, /match, …) and hash variants.
  if (source.startsWith('/cv') || source.startsWith('#cv')) return 'cv';
  if (source.startsWith('/find-jobs') || source.startsWith('#find-jobs')) return 'find-jobs';
  if (source.startsWith('/match') || source.startsWith('#match')) return 'match';
  if (source.startsWith('/gap') || source.startsWith('#gap')) return 'gap';
  if (
    source.startsWith('/interview-report') ||
    source.startsWith('#interview-report') ||
    source.startsWith('/interview/report')
  )
    return 'interview-report';
  if (source.startsWith('/interview') || source.startsWith('#interview')) return 'interview';
  if (source.startsWith('/history') || source.startsWith('#history')) return 'history';
  if (source.startsWith('/internship') || source.startsWith('#internship')) return 'internship';
  if (source.startsWith('/profile') || source.startsWith('#profile')) return 'profile';
  if (source.startsWith('/jobs') || source.startsWith('#jobs')) return 'jobs';
  if (source.startsWith('/notifications') || source.startsWith('#notifications'))
    return 'notifications';
  if (source.startsWith('/upgrade') || source.startsWith('#upgrade')) return 'upgrade';
  return 'dashboard';
}

/** Get the canonical URL path for a given view and role. */
export function getViewUrl(view: string, role = 'student', options?: { jobId?: string }): string {
  const isStudent = role === 'student';
  if (role === 'counselor') return '/counselor';
  if (role === 'admin') return '/admin';

  switch (view) {
    case 'dashboard':
      return isStudent ? '/student' : '/';
    case 'cv':
      return isStudent ? '/student/cv' : '/cv';
    case 'find-jobs':
      return isStudent ? '/student/find-jobs' : '/find-jobs';
    case 'jobs':
      return isStudent ? '/student/jobs' : '/jobs';
    case 'job-detail':
      return options?.jobId
        ? isStudent
          ? `/student/jobs/${encodeURIComponent(options.jobId)}`
          : `/jobs/${encodeURIComponent(options.jobId)}`
        : isStudent
          ? '/student/jobs'
          : '/jobs';
    case 'match':
      return isStudent ? '/student/match' : '/match';
    case 'gap':
      return isStudent ? '/student/gap' : '/gap';
    case 'interview':
      return isStudent ? '/student/interview' : '/interview';
    case 'interview-report':
      return isStudent ? '/student/interview/report' : '/interview-report';
    case 'internship':
      return isStudent ? '/student/internship' : '/internship';
    case 'history':
      return isStudent ? '/student/history' : '/history';
    case 'profile':
      return isStudent ? '/student/profile' : '/profile';
    case 'notifications':
      return isStudent ? '/student/notifications' : '/notifications';
    case 'upgrade':
      return isStudent ? '/student/upgrade' : '/upgrade';
    default:
      return isStudent ? '/student' : '/';
  }
}

/** True when the path points into a role portal (protected area). */
export function isProtectedPortalPath(pathname: string): boolean {
  const path = (pathname || '').toLowerCase();
  return ROLE_PORTAL_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Strict per-role access matrix. Each authenticated role may only open its own
 * portal (+ shared notification center). Guests keep the public landing/demo
 * views but never a role portal — those require authentication via /login.
 */
export const ROLE_ALLOWED_VIEWS: Readonly<Record<SessionRole, ReadonlySet<string>>> = Object.freeze(
  {
    guest: new Set([
      'dashboard',
      'cv',
      'find-jobs',
      'jobs',
      'job-detail',
      'match',
      'gap',
      'interview',
      'history',
      'internship',
      'profile',
      'notifications',
    ]),
    student: new Set([
      'dashboard',
      'cv',
      'find-jobs',
      'jobs',
      'job-detail',
      'match',
      'gap',
      'interview',
      'history',
      'profile',
      'notifications',
      'upgrade',
    ]),
    counselor: new Set(['counselor', 'notifications']),
    admin: new Set(['admin', 'notifications']),
  },
);

export function canRoleAccessView(role: unknown, view: string): boolean {
  const normalized = normalizeRole(role) ?? 'guest';
  return ROLE_ALLOWED_VIEWS[normalized].has(view);
}

export function getRoleHomeView(role: unknown): string {
  switch (normalizeRole(role)) {
    case 'counselor':
      return 'counselor';
    case 'admin':
      return 'admin';
    default:
      return 'dashboard';
  }
}

export interface AuthUserLike {
  role?: string | null;
}

export interface ResolvedRoute {
  /** Verified/cached session role ('guest' when unauthenticated). */
  role: SessionRole;
  /** SPA view the user should land on after guard enforcement. */
  view: string;
  /**
   * When set, the client must hard-navigate here before revealing any UI
   * (e.g. guest → /login?next=…, wrong-role portal → role home).
   */
  redirect: string | null;
}

export interface ResolveInitialRouteInput {
  pathname: string;
  hash?: string;
  /** Backend-verified or last-known-cached user; null/absent ⇒ guest. */
  user?: AuthUserLike | null;
}

/**
 * Pure decision used at bootstrap. Never returns another role's portal: either
 * the requested view is allowed, or it is replaced by the role home / a
 * redirect target.
 */
export function resolveInitialRoute({
  pathname,
  hash = '',
  user,
}: ResolveInitialRouteInput): ResolvedRoute {
  const role: SessionRole = normalizeRole(user?.role) ?? 'guest';
  let view = getViewFromLocation(pathname, hash);
  let redirect: string | null = null;

  const path = (pathname || '').toLowerCase();

  if (isRegisterPath(pathname)) {
    // Registration surfaces are guest-only: an authenticated user already has
    // an account, so every role is bounced to its own portal home.
    if (role !== 'guest') {
      return { role, view: getRoleHomeView(role), redirect: PORTAL_PATHS[role as AppRole] };
    }
    view = 'dashboard';
    return { role, view, redirect: null };
  }

  if (path === '/login' || path.startsWith('/login/')) {
    // Shared login surface. Authenticated users belong in their portal;
    // guests stay to authenticate over the neutral landing backdrop.
    if (role !== 'guest') {
      redirect = PORTAL_PATHS[role];
    }
    view = 'dashboard';
    return { role, view, redirect };
  }

  if (isProtectedPortalPath(pathname)) {
    if (role === 'guest') {
      redirect = `/login?next=${encodeURIComponent(pathname)}`;
      return { role, view, redirect };
    }
    if (!canRoleAccessView(role, view)) {
      view = getRoleHomeView(role);
      redirect = PORTAL_PATHS[role as AppRole];
    }
    return { role, view, redirect };
  }

  if (role !== 'guest' && !canRoleAccessView(role, view)) {
    // Authenticated role roaming outside its own portal (incl. landing '/').
    view = getRoleHomeView(role);
    redirect = PORTAL_PATHS[role as AppRole];
  }

  return { role, view, redirect };
}

/**
 * Post-login destination derived from the backend-returned role. Honors an
 * optional ?next= hint only when the resulting role is actually allowed to
 * open it (prevents wrong-role hops and open redirects).
 */
export function resolvePostLoginTarget(backendRole: unknown, nextPath?: string | null): string {
  const normalized = normalizeRole(backendRole);
  const home = normalized ? PORTAL_PATHS[normalized] : '/';
  if (!nextPath || typeof nextPath !== 'string') return home;
  // Open-redirect guard: only root-relative single-slash paths qualify.
  if (!nextPath.startsWith('/') || nextPath.startsWith('//')) return home;
  const next = nextPath;
  // Only honor ?next= when the resulting role may actually open the target —
  // prevents wrong-role hops and keeps every role inside its own portal.
  if (normalized && canRoleAccessView(normalized, getViewFromLocation(next))) {
    return next;
  }
  return home;
}
