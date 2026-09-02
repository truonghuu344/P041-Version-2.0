import {
  canRoleAccessView,
  getPortalPath,
  getRegisterMode,
  getRoleHomeView,
  getViewFromLocation,
  getViewUrl,
  isProtectedPortalPath,
  isRegisterPath,
  normalizeRole,
  resolveInitialRoute,
  resolvePostLoginTarget,
} from '@/lib/authRouting';

describe('normalizeRole', () => {
  it('accepts every backend role in any casing', () => {
    expect(normalizeRole('STUDENT')).toBe('student');
    expect(normalizeRole('Counselor')).toBe('counselor');
    expect(normalizeRole('admin')).toBe('admin');
  });

  it('rejects unknown and missing roles', () => {
    expect(normalizeRole('superuser')).toBeNull();
    expect(normalizeRole('enterprise')).toBeNull();
    expect(normalizeRole('')).toBeNull();
    expect(normalizeRole(null)).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
    expect(normalizeRole(42)).toBeNull();
  });
});

describe('getPortalPath', () => {
  it('maps each role to its own portal URL', () => {
    expect(getPortalPath('STUDENT')).toBe('/student');
    expect(getPortalPath('counselor')).toBe('/counselor');
    expect(getPortalPath('Admin')).toBe('/admin');
  });

  it('returns null for guests/unknown roles', () => {
    expect(getPortalPath(null)).toBeNull();
    expect(getPortalPath('guest')).toBeNull();
  });
});

describe('getViewFromLocation', () => {
  it('treats each role root as its portal view', () => {
    expect(getViewFromLocation('/student')).toBe('dashboard');
    expect(getViewFromLocation('/counselor')).toBe('counselor');
    expect(getViewFromLocation('/admin')).toBe('admin');
  });

  it('parses student deep links', () => {
    expect(getViewFromLocation('/student/cv')).toBe('cv');
    expect(getViewFromLocation('/student/find-jobs')).toBe('find-jobs');
    expect(getViewFromLocation('/student/jobs')).toBe('jobs');
    expect(getViewFromLocation('/student/jobs/job-123')).toBe('job-detail');
    expect(getViewFromLocation('/student/match')).toBe('match');
    expect(getViewFromLocation('/student/gap')).toBe('gap');
    expect(getViewFromLocation('/student/interview')).toBe('interview');
    expect(getViewFromLocation('/student/interview-report')).toBe('interview-report');
    expect(getViewFromLocation('/student/interview/report')).toBe('interview-report');
    expect(getViewFromLocation('/student/history')).toBe('history');
    expect(getViewFromLocation('/student/internship')).toBe('internship');
    expect(getViewFromLocation('/student/profile')).toBe('profile');
    expect(getViewFromLocation('/student/notifications')).toBe('notifications');
    expect(getViewFromLocation('/student/upgrade')).toBe('upgrade');
  });

  it('collapses nested portal deep links to the portal view', () => {
    expect(getViewFromLocation('/counselor/students/sv-01')).toBe('counselor');
    expect(getViewFromLocation('/admin/users')).toBe('admin');
  });

  it('supports legacy bare views and hashes', () => {
    expect(getViewFromLocation('/', '')).toBe('dashboard');
    expect(getViewFromLocation('/cv')).toBe('cv');
    expect(getViewFromLocation('/find-jobs')).toBe('find-jobs');
    expect(getViewFromLocation('/jobs')).toBe('jobs');
    expect(getViewFromLocation('/gap')).toBe('gap');
    expect(getViewFromLocation('/', '#match')).toBe('match');
  });
});

describe('getViewUrl', () => {
  it('generates canonical student URLs', () => {
    expect(getViewUrl('dashboard', 'student')).toBe('/student');
    expect(getViewUrl('cv', 'student')).toBe('/student/cv');
    expect(getViewUrl('find-jobs', 'student')).toBe('/student/find-jobs');
    expect(getViewUrl('jobs', 'student')).toBe('/student/jobs');
    expect(getViewUrl('job-detail', 'student', { jobId: 'jd-99' })).toBe('/student/jobs/jd-99');
    expect(getViewUrl('match', 'student')).toBe('/student/match');
    expect(getViewUrl('gap', 'student')).toBe('/student/gap');
    expect(getViewUrl('interview', 'student')).toBe('/student/interview');
    expect(getViewUrl('interview-report', 'student')).toBe('/student/interview/report');
    expect(getViewUrl('internship', 'student')).toBe('/student/internship');
    expect(getViewUrl('history', 'student')).toBe('/student/history');
    expect(getViewUrl('profile', 'student')).toBe('/student/profile');
    expect(getViewUrl('notifications', 'student')).toBe('/student/notifications');
    expect(getViewUrl('upgrade', 'student')).toBe('/student/upgrade');
  });

  it('generates guest and portal URLs', () => {
    expect(getViewUrl('dashboard', 'guest')).toBe('/');
    expect(getViewUrl('cv', 'guest')).toBe('/cv');
    expect(getViewUrl('counselor', 'counselor')).toBe('/counselor');
    expect(getViewUrl('admin', 'admin')).toBe('/admin');
  });
});

describe('isProtectedPortalPath', () => {
  it('flags portal roots and nested paths', () => {
    expect(isProtectedPortalPath('/student')).toBe(true);
    expect(isProtectedPortalPath('/counselor/students')).toBe(true);
    expect(isProtectedPortalPath('/ADMIN/users')).toBe(true);
  });

  it('does not flag public paths or lookalikes', () => {
    expect(isProtectedPortalPath('/')).toBe(false);
    expect(isProtectedPortalPath('/login')).toBe(false);
    expect(isProtectedPortalPath('/students-club')).toBe(false);
    expect(isProtectedPortalPath('/cv')).toBe(false);
  });
});

describe('canRoleAccessView — strict per-role guards', () => {
  it('student may only open student views', () => {
    ['dashboard', 'cv', 'match', 'interview', 'profile'].forEach((view) =>
      expect(canRoleAccessView('student', view)).toBe(true),
    );
    ['counselor', 'admin'].forEach((view) =>
      expect(canRoleAccessView('student', view)).toBe(false),
    );
  });

  it('counselor may only open the counselor portal (+notifications)', () => {
    expect(canRoleAccessView('counselor', 'counselor')).toBe(true);
    expect(canRoleAccessView('counselor', 'notifications')).toBe(true);
    ['dashboard', 'cv', 'admin', 'profile'].forEach((view) =>
      expect(canRoleAccessView('counselor', view)).toBe(false),
    );
  });

  it('admin may only open the admin portal (+notifications)', () => {
    expect(canRoleAccessView('admin', 'admin')).toBe(true);
    expect(canRoleAccessView('admin', 'notifications')).toBe(true);
    ['dashboard', 'cv', 'match', 'counselor', 'profile'].forEach((view) =>
      expect(canRoleAccessView('admin', view)).toBe(false),
    );
  });

  it('guest keeps public/demo views but never a portal', () => {
    ['dashboard', 'cv', 'jobs', 'match'].forEach((view) =>
      expect(canRoleAccessView('guest', view)).toBe(true),
    );
    ['counselor', 'admin'].forEach((view) =>
      expect(canRoleAccessView('guest', view)).toBe(false),
    );
  });
});

describe('getRoleHomeView', () => {
  it.each([
    ['STUDENT', 'dashboard'],
    ['COUNSELOR', 'counselor'],
    ['ADMIN', 'admin'],
    [null, 'dashboard'],
  ])('%s → %s', (role, home) => {
    expect(getRoleHomeView(role)).toBe(home);
  });
});

describe('isRegisterPath / getRegisterMode — public registration surfaces', () => {
  it('detects register paths in every form', () => {
    expect(isRegisterPath('/register')).toBe(true);
    expect(isRegisterPath('/register/student')).toBe(true);
    expect(isRegisterPath('/REGISTER/Student')).toBe(true);
    expect(isRegisterPath('/login')).toBe(false);
    expect(isRegisterPath('/student')).toBe(false);
    expect(isRegisterPath('/register-legacy')).toBe(false);
  });

  it('maps sub-paths to their registration mode', () => {
    expect(getRegisterMode('/register')).toBe('entry');
    expect(getRegisterMode('/register/student')).toBe('student');
    expect(getRegisterMode('/register/counselor')).toBe('counselor');
  });

  it('keeps guests on any register surface (no redirect)', () => {
    (['/register', '/register/student'] as const).forEach((path) => {
      const result = resolveInitialRoute({ pathname: path, user: null });
      expect(result.role).toBe('guest');
      expect(result.redirect).toBeNull();
    });
  });

  it('never shows a registration surface to an authenticated role', () => {
    (
      [
        ['/register', 'student', '/student'],
        ['/register/student', 'counselor', '/counselor'],
        ['/register/student', 'admin', '/admin'],
        ['/register', 'ADMIN', '/admin'],
      ] as const
    ).forEach(([path, role, portal]) => {
      const result = resolveInitialRoute({ pathname: path, user: { role } });
      expect(result.redirect).toBe(portal);
    });
  });
});

describe('resolveInitialRoute — direct URL & hard refresh contract', () => {
  it('keeps each role on its own portal after refresh', () => {
    expect(resolveInitialRoute({ pathname: '/student', user: { role: 'student' } })).toEqual({
      role: 'student',
      view: 'dashboard',
      redirect: null,
    });
    expect(resolveInitialRoute({ pathname: '/counselor', user: { role: 'COUNSELOR' } })).toEqual({
      role: 'counselor',
      view: 'counselor',
      redirect: null,
    });
    expect(resolveInitialRoute({ pathname: '/admin/users', user: { role: 'admin' } })).toEqual({
      role: 'admin',
      view: 'admin',
      redirect: null,
    });
  });

  it('never lets a wrong role keep a foreign portal view without redirect', () => {
    (
      [
        ['/admin/users', 'student'],
        ['/counselor', 'admin'],
      ] as const
    ).forEach(([path, role]) => {
      const result = resolveInitialRoute({ pathname: path, user: { role } });
      expect(result.redirect).not.toBeNull();
      expect(result.view).toBe(getRoleHomeView(role));
    });
  });

  it('bounces unauthenticated users from portals to /login with ?next=', () => {
    const result = resolveInitialRoute({ pathname: '/counselor/students', user: null });
    expect(result.role).toBe('guest');
    expect(result.redirect).toBe('/login?next=%2Fcounselor%2Fstudents');
  });

  it('sends authenticated users away from /login into their portal', () => {
    (
      [
        [{ role: 'student' }, '/student'],
        [{ role: 'counselor' }, '/counselor'],
        [{ role: 'ADMIN' }, '/admin'],
      ] as const
    ).forEach(([user, expected]) => {
      const result = resolveInitialRoute({ pathname: '/login', user });
      expect(result.redirect).toBe(expected);
    });
  });

  it('keeps guests on /login (no redirect) over a neutral dashboard backdrop', () => {
    const result = resolveInitialRoute({ pathname: '/login', user: null });
    expect(result).toEqual({ role: 'guest', view: 'dashboard', redirect: null });
  });

  it('lands authenticated roles on their own home when roaming the landing page', () => {
    expect(resolveInitialRoute({ pathname: '/', user: { role: 'admin' } }).redirect).toBe('/admin');
    expect(resolveInitialRoute({ pathname: '/', user: { role: 'student' } }).redirect).toBeNull();
  });
});

describe('resolvePostLoginTarget — backend role decides destination', () => {
  it('maps backend roles to their portal URLs', () => {
    expect(resolvePostLoginTarget('STUDENT')).toBe('/student');
    expect(resolvePostLoginTarget('counselor')).toBe('/counselor');
    expect(resolvePostLoginTarget('ADMIN')).toBe('/admin');
  });

  it('falls back to landing when no role is available', () => {
    expect(resolvePostLoginTarget(null)).toBe('/');
    expect(resolvePostLoginTarget(undefined, '/student')).toBe('/');
  });

  it('honors ?next= only inside the resulting role own portal', () => {
    expect(resolvePostLoginTarget('counselor', '/counselor/students')).toBe('/counselor/students');
    expect(resolvePostLoginTarget('admin', '/admin/users')).toBe('/admin/users');
    // Wrong-role next is refused → own portal home.
    expect(resolvePostLoginTarget('student', '/admin/users')).toBe('/student');
  });

  it('ignores non-path next values (open-redirect guard)', () => {
    expect(resolvePostLoginTarget('student', 'https://evil.example.com')).toBe('/student');
    expect(resolvePostLoginTarget('admin', '//evil.example.com')).toBe('/admin');
  });
});
