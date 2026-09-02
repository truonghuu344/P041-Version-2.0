import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import CounselorView, { parseCounselorRoute, getCanonicalUrl } from '@/components/counselor/CounselorView';
import { CounselorApi } from '@/lib/api/counselorApi';

const MOCK_STUDENTS = [
  {
    id: 'sv01',
    name: 'Nguyễn Văn A',
    email: 'nguyenvana@student.iuh.edu.vn',
    major: 'Công nghệ thông tin',
    cohort: 'K17',
    targetRole: 'Java Backend Intern',
    initials: 'NA',
    cvStatus: 'pending' as const,
    gpa: '3.4',
    skills: ['Java', 'Spring Boot'],
    matchRate: 88,
    lastActive: 'Hôm nay',
  },
  {
    id: 'sv02',
    name: 'Trần Thị B',
    email: 'tranthib@student.iuh.edu.vn',
    major: 'Công nghệ thông tin',
    cohort: 'K17',
    targetRole: 'Frontend Intern',
    initials: 'TB',
    cvStatus: 'verified' as const,
    gpa: '3.6',
    skills: ['React', 'TypeScript'],
    matchRate: 91,
    lastActive: 'Hôm qua',
  },
];

const MOCK_OPPORTUNITIES = [
  {
    id: 'req-01',
    company: 'FPT Software',
    position: 'Java Backend Intern',
    location: 'TP.HCM',
    slots: 3,
    matchRate: 90,
    type: 'Thực tập',
    field: 'it',
    allowance: '5 triệu',
    mustHave: ['Java', 'SQL'],
    niceToHave: ['Docker'],
    desc: 'Thực tập backend cho hệ thống nội bộ.',
    isTalentRequest: true,
  },
];

const MOCK_REFERRALS = [
  {
    id: 'ref-01',
    studentId: 'sv01',
    studentName: 'Hoàng Văn E',
    studentMajor: 'Công nghệ thông tin',
    position: 'Java Backend Intern',
    company: 'FPT Software',
    matchScore: 87,
    skills: ['Java', 'SQL'],
    date: '01/08/2026',
    lastUpdated: '02/08/2026',
    stage: 'shared_enterprise' as const,
    stageLabel: 'Đã gửi sang DN',
    notes: 'Đã chuyển CV cho HR.',
  },
];

const MOCK_INTERNSHIPS = [
  {
    id: 'intern-01',
    studentId: 'sv02',
    studentName: 'Lê Văn C',
    studentMajor: 'Công nghệ thông tin',
    initials: 'LC',
    company: 'KMS Technology',
    location: 'TP.HCM',
    position: 'QA Intern',
    mentorName: 'Trần Quốc Mentor',
    mentorTitle: 'QA Lead',
    currentWeek: 4,
    totalWeeks: 12,
    lastReportStatus: 'submitted' as const,
    statusLabel: 'Đã nộp báo cáo',
    progressPercent: 33,
    weeklyReports: [],
  },
];

const MOCK_PARTNERS = [
  {
    id: 'partner-01',
    name: 'Saigon Software House',
    industry: 'Công nghệ thông tin',
    location: 'TP.HCM',
    description: 'Đối tác tiếp nhận thực tập sinh nhiều năm của khoa.',
    internsCount: 5,
    openTalentRequests: 2,
  },
];

describe('CounselorView and Refactored Shell', () => {
  beforeAll(() => {
    // Mock window.scrollTo for jsdom
    window.scrollTo = jest.fn();
  });

  beforeEach(() => {
    // Role root LÀ dashboard: `/counselor` (URL cũ `/counselor/dashboard` được
    // next.config.mjs redirect 308 về đây).
    window.history.pushState(null, '', '/counselor');
    // Danh sách sinh viên / cơ hội lấy dữ liệu qua CounselorApi -> HTTP. Trong
    // jsdom không có backend nên phải stub, nếu không bảng luôn rỗng.
    jest.spyOn(CounselorApi, 'getStudents').mockResolvedValue({
      items: MOCK_STUDENTS,
      total: MOCK_STUDENTS.length,
      page: 1,
      page_size: 6,
      total_pages: 1,
    });
    jest.spyOn(CounselorApi, 'getOpportunities').mockResolvedValue(MOCK_OPPORTUNITIES);
    jest.spyOn(CounselorApi, 'getReferrals').mockResolvedValue(MOCK_REFERRALS);
    jest.spyOn(CounselorApi, 'getInternships').mockResolvedValue(MOCK_INTERNSHIPS);
    jest.spyOn(CounselorApi, 'getPartners').mockResolvedValue(MOCK_PARTNERS);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders Counselor Dashboard without any left sidebar in the DOM', () => {
    render(<CounselorView />);
    expect(screen.getByRole('heading', { name: /Tổng quan Cố vấn/i })).toBeInTheDocument();
    expect(screen.getByText(/Sinh viên đang hỗ trợ/i)).toBeInTheDocument();
    expect(screen.getByText(/CV chờ duyệt/i)).toBeInTheDocument();

    // Verify left sidebar is completely removed
    expect(screen.queryByRole('navigation', { name: /Counselor Sidebar Navigation/i })).not.toBeInTheDocument();
  });

  it('renders Partner Trust Strip and Full Product Footer on Dashboard', () => {
    render(<CounselorView />);
    // Partner Trust Strip
    expect(screen.getByRole('heading', { name: /Đơn vị liên kết/i })).toBeInTheDocument();
    expect(screen.getByText(/Đồng hành cùng sinh viên trong tuyển dụng và thực tập/i)).toBeInTheDocument();
    expect(screen.getByAltText(/Logo KMS Technology/i)).toBeInTheDocument();
    expect(screen.getByAltText(/Logo FPT Software/i)).toBeInTheDocument();

    // Full Product Footer
    const footer = screen.getByRole('contentinfo', { name: /Career Assistant.*Product Footer/i });
    expect(footer).toBeInTheDocument();
    expect(within(footer).getByText(/Khoa Công nghệ Thông tin/i)).toBeInTheDocument();
    expect(within(footer).getByText(/Trường Đại học Công nghiệp TP.HCM/i)).toBeInTheDocument();
    expect(within(footer).getByText(/12 Nguyễn Văn Bảo/i)).toBeInTheDocument();
    expect(within(footer).getByText(/fit@iuh.edu.vn/i)).toBeInTheDocument();
    expect(within(footer).getByText(/v1.0/i)).toBeInTheDocument();
  });

  it('switches to Sinh viên tab via event and renders student table with Compact Footer', async () => {
    render(<CounselorView />);
    act(() => {
      window.dispatchEvent(new CustomEvent('navigate-counselor', { detail: 'students' }));
    });

    expect(screen.getByRole('heading', { name: /Danh sách sinh viên/i })).toBeInTheDocument();
    expect(await screen.findByText(/Nguyễn Văn A/i)).toBeInTheDocument();
    expect(screen.getByText(/Trần Thị B/i)).toBeInTheDocument();

    // Compact Footer should be rendered without Partner Trust Strip
    expect(screen.queryByRole('heading', { name: /Đơn vị liên kết/i })).not.toBeInTheDocument();
    expect(screen.getByRole('contentinfo', { name: /Compact Application Footer/i })).toBeInTheDocument();
  });

  it('switches to Cơ hội việc làm tab and shows Talent Requests with Compact Footer', async () => {
    render(<CounselorView />);
    act(() => {
      window.dispatchEvent(new CustomEvent('navigate-counselor', { detail: 'opportunities' }));
    });

    expect(await screen.findByText(/Java Backend Intern/i)).toBeInTheDocument();
    // level 1 + neo 2 đầu: tránh khớp cả heading empty-state "Chưa có cơ hội việc làm..."
    expect(screen.getByRole('heading', { level: 1, name: /^Cơ hội việc làm$/i })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo', { name: /Compact Application Footer/i })).toBeInTheDocument();
  });

  it('switches to Tiến cử tab and shows Referral tracking', async () => {
    render(<CounselorView />);
    act(() => {
      window.dispatchEvent(new CustomEvent('navigate-counselor', { detail: 'referrals' }));
    });

    expect(screen.getByRole('heading', { name: /Quản lý Tiến cử/i })).toBeInTheDocument();
    expect(screen.getByText(/Tạo tiến cử mới/i)).toBeInTheDocument();
    expect(await screen.findByText(/Hoàng Văn E/i)).toBeInTheDocument();
  });

  it('switches to Thực tập tab and shows Internship list', async () => {
    render(<CounselorView />);
    act(() => {
      window.dispatchEvent(new CustomEvent('navigate-counselor', { detail: 'internships' }));
    });

    expect(screen.getByRole('heading', { name: /Giám sát Thực tập/i })).toBeInTheDocument();
    expect(await screen.findByText(/Lê Văn C/i)).toBeInTheDocument();
  });

  it('switches to Đối tác tab and shows Partner directory with Full Footer and Partner Strip', async () => {
    render(<CounselorView />);
    act(() => {
      window.dispatchEvent(new CustomEvent('navigate-counselor', { detail: 'partners' }));
    });

    expect(screen.getByRole('heading', { name: /Mạng lưới đối tác/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Đơn vị liên kết/i })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo', { name: /Career Assistant.*Product Footer/i })).toBeInTheDocument();
    expect(await screen.findByText(/Saigon Software House/i)).toBeInTheDocument();
  });

  it('navigates via Full Footer secondary links', async () => {
    render(<CounselorView />);
    const footer = screen.getByRole('contentinfo', { name: /Career Assistant.*Product Footer/i });
    const footerInternLink = within(footer).getByRole('button', { name: /Theo dõi thực tập/i });
    fireEvent.click(footerInternLink);

    expect(screen.getByRole('heading', { name: /Giám sát Thực tập/i })).toBeInTheDocument();
    expect(await screen.findByText(/Lê Văn C/i)).toBeInTheDocument();
  });

  it('opens resource modal when clicking resource guide in footer', () => {
    render(<CounselorView />);
    const footer = screen.getByRole('contentinfo', { name: /Career Assistant.*Product Footer/i });
    const helpCenterBtn = within(footer).getByRole('button', { name: /Trung tâm trợ giúp/i });
    fireEvent.click(helpCenterBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Trung tâm trợ giúp/i)).toBeInTheDocument();

    const closeBtn = within(dialog).getByRole('button', { name: /Đã hiểu/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('correctly parses canonical counselor routes', () => {
    // Role root LÀ dashboard, và dạng cũ `/counselor/dashboard` vẫn phải parse
    // được (bookmark cũ đi qua redirect 308, nhưng parser giữ tương thích ngược).
    expect(parseCounselorRoute('/counselor').tab).toBe('dashboard');
    expect(parseCounselorRoute('/counselor/').tab).toBe('dashboard');
    expect(parseCounselorRoute('/counselor/dashboard').tab).toBe('dashboard');
    expect(parseCounselorRoute('/counselor/students').tab).toBe('students');
    expect(parseCounselorRoute('/counselor/students/sv01')).toEqual({
      tab: 'student-detail',
      studentId: 'sv01',
    });
    expect(parseCounselorRoute('/counselor/opportunities').tab).toBe('opportunities');
    expect(parseCounselorRoute('/counselor/opportunities/jobs/req-01')).toEqual({
      tab: 'suitable-candidates',
      jobId: 'req-01',
      opportunitiesTab: 'jobs',
    });
    expect(parseCounselorRoute('/counselor/referrals/ref-02')).toEqual({
      tab: 'referral-detail',
      referralId: 'ref-02',
    });
    expect(parseCounselorRoute('/counselor/internships/intern-03')).toEqual({
      tab: 'internship-detail',
      internshipId: 'intern-03',
    });
    expect(parseCounselorRoute('/counselor/partners/partner-4')).toEqual({
      tab: 'partner-detail',
      partnerId: 'partner-4',
    });
    expect(parseCounselorRoute('/counselor/profile').tab).toBe('profile');
    expect(parseCounselorRoute('/counselor/settings').tab).toBe('settings');
  });

  it('builds the role root as the canonical dashboard URL', () => {
    // Dashboard chỉ còn MỘT URL chuẩn: role root, không phải `/counselor/dashboard`.
    expect(getCanonicalUrl('dashboard')).toBe('/counselor');
    expect(getCanonicalUrl('students')).toBe('/counselor/students');
    expect(getCanonicalUrl('student-detail', { studentId: 'sv09' })).toBe(
      '/counselor/students/sv09',
    );
    // Tab không xác định cũng rơi về role root.
    expect(getCanonicalUrl('khong-ton-tai' as never)).toBe('/counselor');
  });

  it('round-trips every canonical URL back to its own tab', () => {
    (
      [
        'dashboard',
        'students',
        'opportunities',
        'referrals',
        'internships',
        'partners',
        'profile',
        'settings',
      ] as const
    ).forEach((tab) => {
      expect(parseCounselorRoute(getCanonicalUrl(tab)).tab).toBe(tab);
    });
  });
});
