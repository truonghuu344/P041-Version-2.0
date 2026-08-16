'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EnterpriseTab } from './EnterpriseView';
import {
  Building2,
  Globe,
  MapPin,
  Users,
  Edit3,
  Eye,
  Award,
  Sparkles,
  Info,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Image as ImageIcon,
  Shield,
  Briefcase,
  Layers,
  Lock,
  ExternalLink,
  Mail,
  Check,
  FileText,
  KeyRound,
  Sparkle,
} from 'lucide-react';

export interface CompanyInfo {
  // Basic Identity
  name: string;
  logo: string;
  legalName: string;
  taxId: string;

  // Overview
  industry: string;
  companySize: string;
  foundedYear: string;
  companyType: string;

  // Locations
  headquarters: string;
  otherOffices: string[];

  // Online Presence
  website: string;
  linkedin: string;
  facebook: string;
  careerPage: string;

  // Introduction & Story
  description: string;
  mission: string;
  productsServices: string[];
}

export interface EmployerBrand {
  // Culture & Values
  workEnvironment: string;
  coreValues: string[];

  // Benefits
  benefits: string[];

  // Workplace Model
  workplaceModels: string[]; // ['On-site', 'Hybrid', 'Remote']

  // Media
  workplacePhotos: string[]; // max 6 images

  // Why Join Us
  whyJoinUs: string;

  // Hiring Process
  hiringSteps: string[];

  // Public Contact
  recruitingEmail: string;
  recruitingWebsite: string;
}

export interface RecruiterAccount {
  fullName: string;
  loginEmail: string;
  title: string;
  isOAuth: boolean;
}

const DEFAULT_INDUSTRIES = [
  'Công nghệ thông tin',
  'Phần mềm',
  'FinTech',
  'E-commerce',
  'Giáo dục',
  'Ngân hàng',
  'Marketing',
  'Manufacturing',
  'Consulting',
  'Y tế / Sức khỏe',
  'Logistics',
  'Khác',
];

const COMPANY_SIZES = [
  '1–10 nhân viên',
  '11–50 nhân viên',
  '51–200 nhân viên',
  '201–500 nhân viên',
  '501–1.000 nhân viên',
  '1.001–5.000 nhân viên',
  '5.001–10.000 nhân viên',
  '10.000+ nhân viên',
];

const COMPANY_TYPES = [
  'Startup',
  'SME',
  'Corporation',
  'Multinational',
  'Agency',
  'Non-profit',
  'Khác',
];

const POPULAR_BENEFITS = [
  'Bảo hiểm sức khỏe cao cấp',
  'Thưởng hiệu suất & Lương tháng 13',
  'Flexible working hours',
  'Chính sách Remote / Hybrid linh hoạt',
  'Ngân sách đào tạo & Chứng chỉ quốc tế',
  'Cấp mới Laptop / Thiết bị xịn',
  'Team building & Du lịch hàng năm',
  'Khám sức khỏe định kỳ',
  'Phụ cấp ăn trưa & gửi xe',
  'Nghỉ phép năm lên đến 15–18 ngày',
  'Khu vực Relax, Pantry & Coffee miễn phí',
];

const POPULAR_CORE_VALUES = [
  'Innovation (Đổi mới)',
  'Ownership (Trách nhiệm)',
  'Learning (Học hỏi liên tục)',
  'Transparency (Minh bạch)',
  'Customer First (Khách hàng là trọng tâm)',
  'Teamwork & Respect',
  'Excellence',
  'Integrity (Chính trực)',
];

interface Props {
  onNavigate?: (tab: EnterpriseTab) => void;
  initialTab?: 'company' | 'brand' | 'account';
}

export default function EnterpriseCompanyProfile({ onNavigate, initialTab = 'company' }: Props) {
  const [activeTab, setActiveTab] = useState<'company' | 'brand' | 'account'>(initialTab);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [saveToast, setSaveToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    const handleSetTab = (e: any) => {
      const tab = e.detail;
      if (tab === 'company' || tab === 'brand' || tab === 'account') {
        setActiveTab(tab);
      }
    };
    window.addEventListener('set-company-profile-tab', handleSetTab);
    return () => window.removeEventListener('set-company-profile-tab', handleSetTab);
  }, []);

  // Tab 1: Company Info
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: 'FPT Software',
    logo: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=150&auto=format&fit=crop&q=80',
    legalName: 'Công ty TNHH Phần mềm FPT',
    taxId: '0101234567',
    industry: 'Công nghệ thông tin',
    companySize: '10.000+ nhân viên',
    foundedYear: '1999',
    companyType: 'Corporation',
    headquarters: 'Hồ Chí Minh, Việt Nam',
    otherOffices: ['Hà Nội, Việt Nam', 'Đà Nẵng, Việt Nam', 'Tokyo, Nhật Bản'],
    website: 'https://fptsoftware.com',
    linkedin: 'https://linkedin.com/company/fpt-software',
    facebook: 'https://facebook.com/fptsoftware.official',
    careerPage: 'https://careers.fpt-software.com',
    description:
      'FPT Software là công ty công nghệ và cung cấp dịch vụ CNTT hàng đầu khu vực Châu Á - Thái Bình Dương, với hơn 30.000 chuyên gia tại 30 quốc gia trên toàn cầu. Chúng tôi đồng hành cùng các tập đoàn Fortune 500 trong hành trình chuyển đổi số toàn diện và ứng dụng AI vào vận hành.',
    mission: 'Xây dựng các giải pháp công nghệ tiên tiến giúp doanh nghiệp trên toàn cầu chuyển đổi số thành công và bền vững.',
    productsServices: ['AI Solutions', 'Cloud Transformation', 'Software Engineering', 'Digital Healthcare', 'Automotive Software'],
  });

  // Tab 2: Employer Branding
  const [employerBrand, setEmployerBrand] = useState<EmployerBrand>({
    workEnvironment:
      'Môi trường làm việc cởi mở, khuyến khích sáng tạo và trao quyền cho từng cá nhân. Chúng tôi tôn trọng sự đa dạng, đề cao tinh thần tự chủ (ownership) và không ngừng tạo điều kiện cho các tài năng trẻ bứt phá trong sự nghiệp.',
    coreValues: ['Innovation (Đổi mới)', 'Ownership (Trách nhiệm)', 'Learning (Học hỏi liên tục)', 'Customer First (Khách hàng là trọng tâm)'],
    benefits: [
      'Bảo hiểm sức khỏe cao cấp',
      'Thưởng hiệu suất & Lương tháng 13',
      'Chính sách Remote / Hybrid linh hoạt',
      'Ngân sách đào tạo & Chứng chỉ quốc tế',
      'Cấp mới Laptop / Thiết bị xịn',
      'Team building & Du lịch hàng năm',
    ],
    workplaceModels: ['On-site', 'Hybrid'],
    workplacePhotos: [
      'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80',
    ],
    whyJoinUs:
      'Cơ hội làm việc trực tiếp với các khách hàng Fortune 500, tiếp cận các công nghệ AI/Cloud mới nhất cùng lộ trình phát triển nghề nghiệp rõ ràng và môi trường quốc tế năng động.',
    hiringSteps: [
      '1. Sàng lọc hồ sơ ứng viên (1-2 ngày)',
      '2. Phỏng vấn chuyên môn & Live Coding',
      '3. Phỏng vấn Văn hóa & Định hướng',
      '4. Nhận Offer & Chào đón Onboarding',
    ],
    recruitingEmail: 'careers@fpt-software.com',
    recruitingWebsite: 'https://careers.fpt-software.com',
  });

  // Tab 3: Recruiter Account
  const [accountInfo, setAccountInfo] = useState<RecruiterAccount>({
    fullName: 'Trần Tuyển Dụng',
    loginEmail: 'recruiter@fpt.com',
    title: 'Senior Talent Acquisition Specialist',
    isOAuth: true,
  });

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Input states for chips / tags
  const [officeInput, setOfficeInput] = useState('');
  const [productInput, setProductInput] = useState('');
  const [customValueInput, setCustomValueInput] = useState('');
  const [customBenefitInput, setCustomBenefitInput] = useState('');
  const [newStepInput, setNewStepInput] = useState('');

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('enterprise_company_profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.companyInfo) setCompanyInfo(parsed.companyInfo);
        if (parsed.employerBrand) setEmployerBrand(parsed.employerBrand);
        if (parsed.accountInfo) setAccountInfo(parsed.accountInfo);
      } else {
        const userStr = localStorage.getItem('user_info');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.email) setAccountInfo((prev) => ({ ...prev, loginEmail: user.email }));
          if (user.full_name) setAccountInfo((prev) => ({ ...prev, fullName: user.full_name }));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setSaveToast({ message, type });
    setTimeout(() => setSaveToast(null), 3000);
  };

  const saveToLocal = (updatedCompany = companyInfo, updatedBrand = employerBrand, updatedAccount = accountInfo) => {
    try {
      localStorage.setItem(
        'enterprise_company_profile',
        JSON.stringify({
          companyInfo: updatedCompany,
          employerBrand: updatedBrand,
          accountInfo: updatedAccount,
          updatedAt: new Date().toISOString(),
        })
      );
      triggerToast('Đã lưu thông tin hồ sơ doanh nghiệp thành công!');
    } catch (err: any) {
      triggerToast(err?.message || 'Không thể lưu hồ sơ.', 'error');
    }
  };

  // -------------------------------------------------------------
  // WEIGHTED PROFILE COMPLETION CALCULATION
  // Priority:
  // - Identity (Name, Logo): high (20 pts)
  // - Description & Mission: high (20 pts)
  // - Industry / Size / HQ: high (25 pts)
  // - Culture / Values / Benefits: medium (20 pts)
  // - Social & Links: low (10 pts)
  // - Media: low (5 pts)
  // -------------------------------------------------------------
  const { completionPercentage, missingItems } = useMemo(() => {
    let score = 0;
    const missing: { title: string; hint: string; tab: 'company' | 'brand' | 'account' }[] = [];

    // 1. Identity (20%)
    if (companyInfo.name.trim()) score += 10;
    else missing.push({ title: 'Tên doanh nghiệp', hint: 'Tên thương hiệu hiển thị với ứng viên', tab: 'company' });

    if (companyInfo.logo.trim()) score += 10;
    else missing.push({ title: 'Logo doanh nghiệp', hint: 'Tải lên logo vuông để tăng độ nhận diện', tab: 'company' });

    // 2. Core attributes (25%)
    if (companyInfo.industry.trim()) score += 10;
    else missing.push({ title: 'Ngành nghề hoạt động', hint: 'Giúp ứng viên tìm kiếm theo lĩnh vực', tab: 'company' });

    if (companyInfo.companySize.trim()) score += 8;
    else missing.push({ title: 'Quy mô công ty', hint: 'Số lượng nhân sự ước tính', tab: 'company' });

    if (companyInfo.headquarters.trim()) score += 7;
    else missing.push({ title: 'Trụ sở chính', hint: 'Địa điểm làm việc chính', tab: 'company' });

    // 3. Description (20%)
    if (companyInfo.description.trim().length >= 100) score += 15;
    else missing.push({ title: 'Mô tả doanh nghiệp', hint: 'Giới thiệu ngắn từ 300–1000 ký tự', tab: 'company' });

    if (companyInfo.mission.trim()) score += 5;

    // 4. Culture & Benefits (20%)
    if (employerBrand.benefits.length >= 3) score += 10;
    else missing.push({ title: 'Quyền lợi nhân viên', hint: 'Chọn ít nhất 3 quyền lợi tiêu biểu', tab: 'brand' });

    if (employerBrand.coreValues.length >= 2 || employerBrand.workEnvironment.trim()) score += 10;
    else missing.push({ title: 'Văn hóa & Giá trị', hint: 'Chia sẻ môi trường và giá trị cốt lõi', tab: 'brand' });

    // 5. Website & Links (10%)
    if (companyInfo.website.trim()) score += 7;
    else missing.push({ title: 'Website chính thức', hint: 'Link trang chủ doanh nghiệp', tab: 'company' });

    if (companyInfo.linkedin.trim() || companyInfo.careerPage.trim()) score += 3;

    // 6. Media (5%)
    if (employerBrand.workplacePhotos.length > 0) score += 5;
    else missing.push({ title: 'Hình ảnh môi trường', hint: 'Đăng tải 1–3 ảnh văn phòng/đội ngũ', tab: 'brand' });

    return {
      completionPercentage: Math.min(100, score),
      missingItems: missing,
    };
  }, [companyInfo, employerBrand]);

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const updated = { ...companyInfo, logo: url };
      setCompanyInfo(updated);
      saveToLocal(updated, employerBrand, accountInfo);
    };
    reader.readAsDataURL(file);
  };

  // Handle Photo Upload (max 6)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remainingSlots = 6 - employerBrand.workplacePhotos.length;
    if (remainingSlots <= 0) {
      triggerToast('Đã đạt giới hạn tối đa 6 hình ảnh văn phòng.', 'error');
      return;
    }

    const filesToRead = Array.from(files).slice(0, remainingSlots);
    filesToRead.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setEmployerBrand((prev) => {
          if (prev.workplacePhotos.length < 6) {
            const nextPhotos = [...prev.workplacePhotos, url];
            const nextBrand = { ...prev, workplacePhotos: nextPhotos };
            saveToLocal(companyInfo, nextBrand, accountInfo);
            return nextBrand;
          }
          return prev;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    const nextPhotos = employerBrand.workplacePhotos.filter((_, idx) => idx !== index);
    const nextBrand = { ...employerBrand, workplacePhotos: nextPhotos };
    setEmployerBrand(nextBrand);
    saveToLocal(companyInfo, nextBrand, accountInfo);
  };

  // Active Job Listings Demo in Preview
  const previewJobs = [
    { id: '1', title: 'Backend Developer (Python/FastAPI)', level: 'Middle - Senior', location: 'Hồ Chí Minh', salary: '25 - 40 triệu' },
    { id: '2', title: 'AI/ML Engineer Intern', level: 'Intern / Fresher', location: 'Hồ Chí Minh / Hybrid', salary: '8 - 12 triệu' },
    { id: '3', title: 'Frontend Developer (React/Next.js)', level: 'Junior - Middle', location: 'Hà Nội / Remote', salary: '18 - 30 triệu' },
  ];

  return (
    <div className="company-profile-workspace" id="view-company-profile">
      {/* Toast Notification */}
      {saveToast && (
        <div
          className={`profile-toast ${saveToast.type === 'error' ? 'toast-error' : 'toast-success'}`}
          role="status"
          aria-live="polite"
        >
          {saveToast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{saveToast.message}</span>
        </div>
      )}

      {/* ============================================================
          1. HEADER COMPANY PROFILE
      ============================================================ */}
      <header className="profile-header-card company-header-card" aria-label="Hồ sơ doanh nghiệp">
        <div className="company-header-main">
          {/* Logo container */}
          <div className="company-logo-badge">
            {companyInfo.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={companyInfo.logo} alt={companyInfo.name} className="company-logo-img" />
            ) : (
              <div className="company-logo-placeholder">
                <Building2 size={32} />
              </div>
            )}
          </div>

          {/* Core Info */}
          <div className="company-header-info">
            <div className="company-title-row">
              <h1 className="company-display-name">{companyInfo.name || 'Tên doanh nghiệp'}</h1>
              <span className="company-verified-tag">
                <CheckCircle2 size={13} /> Đã xác thực nhà tuyển dụng
              </span>
            </div>

            <div className="company-meta-pills">
              <span className="company-meta-pill">
                <Briefcase size={14} />
                <span>{companyInfo.industry || 'Ngành nghề chưa cập nhật'}</span>
              </span>
              <span className="company-meta-divider">·</span>
              <span className="company-meta-pill">
                <Users size={14} />
                <span>{companyInfo.companySize || 'Quy mô chưa cập nhật'}</span>
              </span>
            </div>

            <div className="company-meta-subrow">
              <span className="company-subitem">
                <MapPin size={14} />
                <span>{companyInfo.headquarters || 'Chưa cập nhật trụ sở'}</span>
              </span>
              {companyInfo.website && (
                <a
                  href={companyInfo.website}
                  target="_blank"
                  rel="noreferrer"
                  className="company-subitem company-link"
                >
                  <Globe size={14} />
                  <span>Website</span>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="company-header-actions">
          <button
            type="button"
            className="btn-outline-emerald"
            onClick={() => setActiveTab('company')}
          >
            <Edit3 size={15} />
            Chỉnh sửa hồ sơ
          </button>
          <button
            type="button"
            className="btn-primary-emerald"
            onClick={() => setIsPreviewOpen(true)}
          >
            <Eye size={15} />
            Xem như ứng viên →
          </button>
        </div>
      </header>

      {/* ============================================================
          NAVIGATION TABS (3 TABS)
      ============================================================ */}
      <nav className="profile-tabs-nav company-tabs-nav" aria-label="Phân mục hồ sơ doanh nghiệp">
        <button
          type="button"
          className={`profile-tab-btn ${activeTab === 'company' ? 'active' : ''}`}
          onClick={() => setActiveTab('company')}
        >
          <Building2 size={16} />
          <span>Thông tin doanh nghiệp</span>
        </button>
        <button
          type="button"
          className={`profile-tab-btn ${activeTab === 'brand' ? 'active' : ''}`}
          onClick={() => setActiveTab('brand')}
        >
          <Sparkles size={16} />
          <span>Thương hiệu tuyển dụng</span>
        </button>
        <button
          type="button"
          className={`profile-tab-btn ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
        >
          <Shield size={16} />
          <span>Tài khoản &amp; Bảo mật</span>
        </button>
      </nav>

      {/* ============================================================
          MAIN WORKSPACE LAYOUT: LEFT 30% | RIGHT 70%
      ============================================================ */}
      <div className="profile-layout-grid">
        {/* ==========================================================
            LEFT COLUMN (30%): COMPLETION & ACTIONS
        ========================================================== */}
        <aside className="profile-sidebar-column">
          {/* Completion Card */}
          <div className="profile-completion-card" aria-labelledby="company-completion-title">
            <div className="completion-header">
              <div className="completion-title-wrap">
                <Award size={18} className="completion-icon" />
                <h2 id="company-completion-title" className="completion-title">
                  Hồ sơ doanh nghiệp
                </h2>
              </div>
              <span className="completion-badge">{completionPercentage}% hoàn thiện</span>
            </div>

            {/* Progress Bar */}
            <div
              className="completion-progress-track"
              role="progressbar"
              aria-valuenow={completionPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="completion-progress-fill"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>

            {/* Suggestion */}
            <p className="completion-tip">
              {completionPercentage >= 85 ? (
                <>
                  <Sparkle size={14} className="inline-sparkle" />
                  <strong>Hồ sơ xuất sắc!</strong> Thông tin doanh nghiệp đã rất đầy đủ, giúp ứng viên tin tưởng và tăng tỷ lệ nộp CV lên đến 2.5x.
                </>
              ) : (
                <>
                  <Info size={14} className="inline-sparkle" />
                  Bổ sung mô tả và quyền lợi để giúp ứng viên hiểu rõ hơn về văn hóa và cơ hội phát triển tại doanh nghiệp.
                </>
              )}
            </p>

            {/* Missing Checklist */}
            {missingItems.length > 0 ? (
              <div className="completion-missing-list">
                <span className="missing-list-label">Nên bổ sung thêm:</span>
                {missingItems.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="missing-item-btn"
                    onClick={() => setActiveTab(item.tab)}
                  >
                    <div className="missing-item-left">
                      <div className="missing-dot" />
                      <div>
                        <strong className="missing-item-name">{item.title}</strong>
                        <span className="missing-item-hint">{item.hint}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="completion-all-done">
                <CheckCircle2 size={16} />
                <span>Hồ sơ đã đạt tiêu chuẩn tuyển dụng tối ưu!</span>
              </div>
            )}
          </div>

          {/* Quick Preview Card */}
          <div className="company-sidebar-action-card">
            <div className="sidebar-action-header">
              <Eye size={18} className="sidebar-action-icon" />
              <div>
                <h3 className="sidebar-action-title">Xem như ứng viên</h3>
                <p className="sidebar-action-desc">
                  Kiểm tra giao diện trang công ty mà ứng viên sẽ nhìn thấy khi xem tin tuyển dụng.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-outline-full"
              onClick={() => setIsPreviewOpen(true)}
            >
              Mở bản xem trước →
            </button>
          </div>

          {/* Reusable Data Note */}
          <div className="company-reuse-note-card">
            <h4 className="reuse-note-title">
              <Sparkles size={14} /> Tái sử dụng thông tin
            </h4>
            <p className="reuse-note-text">
              Dữ liệu bạn cấu hình ở đây sẽ tự động hiển thị trên Dashboard, các Tin tuyển dụng đã đăng và trang Chi tiết doanh nghiệp mà không cần nhập lại.
            </p>
          </div>
        </aside>

        {/* ==========================================================
            RIGHT COLUMN (70%): TABS CONTENT
        ========================================================== */}
        <main className="profile-main-column">
          {/* ========================================================
              TAB 1: THÔNG TIN DOANH NGHIỆP
          ======================================================== */}
          {activeTab === 'company' && (
            <div className="profile-tab-pane">
              {/* Section 1: Nhận diện doanh nghiệp */}
              <section className="profile-section-card">
                <div className="section-card-header">
                  <div className="section-card-title-wrap">
                    <Building2 size={20} className="section-icon" />
                    <div>
                      <h2 className="section-card-title">Thông tin cơ bản</h2>
                      <p className="section-card-sub">Nhận diện thương hiệu công ty hiển thị công khai với ứng viên.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-save-sm"
                    onClick={() => saveToLocal()}
                  >
                    <Check size={14} /> Lưu thay đổi
                  </button>
                </div>

                <div className="profile-form-grid">
                  {/* Tên doanh nghiệp * */}
                  <div className="form-group col-span-2">
                    <label className="form-label" htmlFor="company-name">
                      Tên doanh nghiệp <span className="text-red">*</span>
                    </label>
                    <input
                      id="company-name"
                      type="text"
                      className="form-input font-bold"
                      placeholder="Ví dụ: FPT Software"
                      value={companyInfo.name}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                    />
                    <span className="form-hint">Đây là tên công khai hiển thị trên thẻ Job và trang Chi tiết công ty.</span>
                  </div>

                  {/* Logo Upload * */}
                  <div className="form-group col-span-2">
                    <label className="form-label">
                      Logo doanh nghiệp <span className="text-red">*</span>
                    </label>
                    <div className="company-logo-upload-row">
                      <div className="company-logo-preview-box">
                        {companyInfo.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={companyInfo.logo} alt="Logo" className="logo-preview-img" />
                        ) : (
                          <ImageIcon size={30} className="text-muted" />
                        )}
                      </div>
                      <div className="logo-upload-controls">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png, image/jpeg, image/webp"
                          className="hidden-file-input"
                          onChange={handleLogoUpload}
                          style={{ display: 'none' }}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-upload-action"
                            onClick={() => logoInputRef.current?.click()}
                          >
                            <UploadCloud size={15} /> Tải logo mới
                          </button>
                          {companyInfo.logo && (
                            <button
                              type="button"
                              className="btn-remove-action"
                              onClick={() => {
                                const next = { ...companyInfo, logo: '' };
                                setCompanyInfo(next);
                                saveToLocal(next, employerBrand, accountInfo);
                              }}
                            >
                              Gỡ bỏ
                            </button>
                          )}
                        </div>
                        <span className="form-hint">Hỗ trợ PNG, JPG, WebP. Khuyên dùng định dạng hình vuông (tỷ lệ 1:1, tối thiểu 200x200px).</span>
                      </div>
                    </div>
                  </div>

                  {/* Tên pháp lý */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="company-legal-name">
                      Tên pháp lý
                    </label>
                    <input
                      id="company-legal-name"
                      type="text"
                      className="form-input"
                      placeholder="Ví dụ: Công ty TNHH Phần mềm FPT"
                      value={companyInfo.legalName}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, legalName: e.target.value })}
                    />
                    <span className="form-hint">Dùng cho mục đích xác thực hoặc hợp đồng, không làm nổi bật ở góc nhìn ứng viên.</span>
                  </div>

                  {/* Mã số thuế */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="company-tax-id">
                      Mã số thuế
                    </label>
                    <input
                      id="company-tax-id"
                      type="text"
                      className="form-input"
                      placeholder="Ví dụ: 0101234567"
                      value={companyInfo.taxId}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, taxId: e.target.value })}
                    />
                    <span className="form-hint">Thông tin bảo mật nội bộ, không hiển thị công khai với ứng viên.</span>
                  </div>
                </div>
              </section>

              {/* Section 2: Chi tiết doanh nghiệp */}
              <section className="profile-section-card">
                <div className="section-card-header">
                  <div className="section-card-title-wrap">
                    <Briefcase size={20} className="section-icon" />
                    <div>
                      <h2 className="section-card-title">Thông tin doanh nghiệp</h2>
                      <p className="section-card-sub">Ngành nghề, quy mô và phân loại tổ chức.</p>
                    </div>
                  </div>
                </div>

                <div className="profile-form-grid">
                  {/* Ngành nghề * */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="company-industry">
                      Ngành nghề chính <span className="text-red">*</span>
                    </label>
                    <select
                      id="company-industry"
                      className="form-select"
                      value={companyInfo.industry}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, industry: e.target.value })}
                    >
                      <option value="">-- Chọn ngành nghề --</option>
                      {DEFAULT_INDUSTRIES.map((ind) => (
                        <option key={ind} value={ind}>
                          {ind}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quy mô công ty * */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="company-size">
                      Quy mô nhân sự <span className="text-red">*</span>
                    </label>
                    <select
                      id="company-size"
                      className="form-select"
                      value={companyInfo.companySize}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, companySize: e.target.value })}
                    >
                      <option value="">-- Chọn quy mô --</option>
                      {COMPANY_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Năm thành lập */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="company-founded">
                      Năm thành lập
                    </label>
                    <input
                      id="company-founded"
                      type="text"
                      className="form-input"
                      placeholder="Ví dụ: 1999"
                      value={companyInfo.foundedYear}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, foundedYear: e.target.value })}
                    />
                  </div>

                  {/* Loại hình doanh nghiệp */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="company-type">
                      Loại hình tổ chức
                    </label>
                    <select
                      id="company-type"
                      className="form-select"
                      value={companyInfo.companyType}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, companyType: e.target.value })}
                    >
                      <option value="">-- Chọn loại hình --</option>
                      {COMPANY_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              {/* Section 3: Địa điểm */}
              <section className="profile-section-card">
                <div className="section-card-header">
                  <div className="section-card-title-wrap">
                    <MapPin size={20} className="section-icon" />
                    <div>
                      <h2 className="section-card-title">Địa điểm làm việc</h2>
                      <p className="section-card-sub">Trụ sở chính và các chi nhánh, văn phòng đại diện.</p>
                    </div>
                  </div>
                </div>

                <div className="profile-form-grid">
                  {/* Trụ sở chính * */}
                  <div className="form-group col-span-2">
                    <label className="form-label" htmlFor="company-hq">
                      Trụ sở chính <span className="text-red">*</span>
                    </label>
                    <input
                      id="company-hq"
                      type="text"
                      className="form-input"
                      placeholder="Ví dụ: Hồ Chí Minh, Việt Nam"
                      value={companyInfo.headquarters}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, headquarters: e.target.value })}
                    />
                    <span className="form-hint">Thành phố/Quốc gia chính để ứng viên định vị nơi làm việc.</span>
                  </div>

                  {/* Văn phòng khác */}
                  <div className="form-group col-span-2">
                    <label className="form-label">Văn phòng &amp; Chi nhánh khác</label>
                    <div className="company-offices-list">
                      {companyInfo.otherOffices.map((office, idx) => (
                        <div key={idx} className="office-chip">
                          <MapPin size={13} className="text-emerald" />
                          <span>{office}</span>
                          <button
                            type="button"
                            className="office-chip-remove"
                            onClick={() => {
                              const next = companyInfo.otherOffices.filter((_, i) => i !== idx);
                              setCompanyInfo({ ...companyInfo, otherOffices: next });
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="add-office-row">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Thêm văn phòng (Ví dụ: Hà Nội, Singapore...)"
                        value={officeInput}
                        onChange={(e) => setOfficeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && officeInput.trim()) {
                            e.preventDefault();
                            if (!companyInfo.otherOffices.includes(officeInput.trim())) {
                              setCompanyInfo({
                                ...companyInfo,
                                otherOffices: [...companyInfo.otherOffices, officeInput.trim()],
                              });
                            }
                            setOfficeInput('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn-add-tag"
                        onClick={() => {
                          if (officeInput.trim() && !companyInfo.otherOffices.includes(officeInput.trim())) {
                            setCompanyInfo({
                              ...companyInfo,
                              otherOffices: [...companyInfo.otherOffices, officeInput.trim()],
                            });
                            setOfficeInput('');
                          }
                        }}
                      >
                        <Plus size={15} /> Thêm địa điểm
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Website & Liên kết */}
              <section className="profile-section-card">
                <div className="section-card-header">
                  <div className="section-card-title-wrap">
                    <Globe size={20} className="section-icon" />
                    <div>
                      <h2 className="section-card-title">Website &amp; Liên kết</h2>
                      <p className="section-card-sub">Kênh truyền thông trực tuyến và mạng xã hội.</p>
                    </div>
                  </div>
                </div>

                <div className="profile-form-grid">
                  {/* Website * */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="company-website">
                      Website công ty <span className="text-red">*</span>
                    </label>
                    <input
                      id="company-website"
                      type="url"
                      className="form-input"
                      placeholder="https://company.com"
                      value={companyInfo.website}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, website: e.target.value })}
                    />
                  </div>

                  {/* Career Page */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="company-career-page">
                      Trang tuyển dụng (Career Page)
                    </label>
                    <input
                      id="company-career-page"
                      type="url"
                      className="form-input"
                      placeholder="https://careers.company.com"
                      value={companyInfo.careerPage}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, careerPage: e.target.value })}
                    />
                  </div>

                  {/* LinkedIn */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="company-linkedin">
                      LinkedIn Page
                    </label>
                    <input
                      id="company-linkedin"
                      type="url"
                      className="form-input"
                      placeholder="https://linkedin.com/company/your-company"
                      value={companyInfo.linkedin}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, linkedin: e.target.value })}
                    />
                  </div>

                  {/* Facebook */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="company-facebook">
                      Facebook Page
                    </label>
                    <input
                      id="company-facebook"
                      type="url"
                      className="form-input"
                      placeholder="https://facebook.com/your-company"
                      value={companyInfo.facebook}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, facebook: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              {/* Section 5: Giới thiệu & Sứ mệnh */}
              <section className="profile-section-card">
                <div className="section-card-header">
                  <div className="section-card-title-wrap">
                    <FileText size={20} className="section-icon" />
                    <div>
                      <h2 className="section-card-title">Giới thiệu doanh nghiệp</h2>
                      <p className="section-card-sub">Tóm tắt ngắn gọn để ứng viên hiểu rõ lĩnh vực, sản phẩm và sứ mệnh.</p>
                    </div>
                  </div>
                </div>

                <div className="profile-form-grid">
                  {/* Giới thiệu */}
                  <div className="form-group col-span-2">
                    <div className="flex justify-between items-center mb-1">
                      <label className="form-label mb-0" htmlFor="company-desc">
                        Giới thiệu ngắn <span className="text-red">*</span>
                      </label>
                      <span className={`text-xs ${companyInfo.description.length > 1000 ? 'text-red font-bold' : 'text-muted'}`}>
                        {companyInfo.description.length} / 1000 ký tự
                      </span>
                    </div>
                    <textarea
                      id="company-desc"
                      rows={4}
                      className="form-textarea"
                      placeholder="Giới thiệu ngắn về doanh nghiệp, sản phẩm chính và thị trường hoạt động..."
                      value={companyInfo.description}
                      maxLength={1000}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, description: e.target.value })}
                    />
                    <span className="form-hint">Nên viết súc tích (300–1.000 ký tự), nêu bật công ty làm gì và giải quyết bài toán nào.</span>
                  </div>

                  {/* Sứ mệnh */}
                  <div className="form-group col-span-2">
                    <div className="flex justify-between items-center mb-1">
                      <label className="form-label mb-0" htmlFor="company-mission">
                        Sứ mệnh &amp; Tầm nhìn
                      </label>
                      <span className="text-xs text-muted">
                        {companyInfo.mission.length} / 300 ký tự
                      </span>
                    </div>
                    <textarea
                      id="company-mission"
                      rows={2}
                      className="form-textarea"
                      placeholder="Ví dụ: Xây dựng các giải pháp công nghệ giúp doanh nghiệp chuyển đổi số hiệu quả hơn."
                      value={companyInfo.mission}
                      maxLength={300}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, mission: e.target.value })}
                    />
                  </div>

                  {/* Sản phẩm & Dịch vụ */}
                  <div className="form-group col-span-2">
                    <label className="form-label">Sản phẩm &amp; Dịch vụ tiêu biểu</label>
                    <div className="company-products-list">
                      {companyInfo.productsServices.map((prod, idx) => (
                        <div key={idx} className="product-tag">
                          <span>{prod}</span>
                          <button
                            type="button"
                            className="product-tag-remove"
                            onClick={() => {
                              const next = companyInfo.productsServices.filter((_, i) => i !== idx);
                              setCompanyInfo({ ...companyInfo, productsServices: next });
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="add-product-row">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Thêm sản phẩm / dịch vụ (Ví dụ: AI Platform, Cloud ERP...)"
                        value={productInput}
                        onChange={(e) => setProductInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && productInput.trim()) {
                            e.preventDefault();
                            if (!companyInfo.productsServices.includes(productInput.trim())) {
                              setCompanyInfo({
                                ...companyInfo,
                                productsServices: [...companyInfo.productsServices, productInput.trim()],
                              });
                            }
                            setProductInput('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn-add-tag"
                        onClick={() => {
                          if (productInput.trim() && !companyInfo.productsServices.includes(productInput.trim())) {
                            setCompanyInfo({
                              ...companyInfo,
                              productsServices: [...companyInfo.productsServices, productInput.trim()],
                            });
                            setProductInput('');
                          }
                        }}
                      >
                        <Plus size={15} /> Thêm mục
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Bottom Action */}
              <div className="tab-bottom-actions">
                <button
                  type="button"
                  className="btn-save-main"
                  onClick={() => saveToLocal()}
                >
                  <CheckCircle2 size={16} /> Lưu tất cả thay đổi
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 2: THƯƠNG HIỆU TUYỂN DỤNG
          ======================================================== */}
          {activeTab === 'brand' && (
            <div className="profile-tab-pane">
              {/* Section 1: Văn hóa & Giá trị */}
              <section className="profile-section-card">
                <div className="section-card-header">
                  <div className="section-card-title-wrap">
                    <Sparkles size={20} className="section-icon" />
                    <div>
                      <h2 className="section-card-title">Văn hóa &amp; Giá trị cốt lõi</h2>
                      <p className="section-card-sub">Giúp ứng viên hình dung môi trường và cách đội ngũ cộng tác hàng ngày.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-save-sm"
                    onClick={() => saveToLocal()}
                  >
                    <Check size={14} /> Lưu thay đổi
                  </button>
                </div>

                <div className="profile-form-grid">
                  {/* Môi trường làm việc */}
                  <div className="form-group col-span-2">
                    <label className="form-label" htmlFor="work-environment">
                      Môi trường làm việc &amp; Phong cách làm việc
                    </label>
                    <textarea
                      id="work-environment"
                      rows={3}
                      className="form-textarea"
                      placeholder="Điều gì mô tả chính xác nhất cách đội ngũ của bạn làm việc và cộng tác?"
                      value={employerBrand.workEnvironment}
                      onChange={(e) => setEmployerBrand({ ...employerBrand, workEnvironment: e.target.value })}
                    />
                  </div>

                  {/* Giá trị cốt lõi */}
                  <div className="form-group col-span-2">
                    <label className="form-label">Giá trị cốt lõi (Core Values)</label>
                    <div className="core-values-cloud">
                      {employerBrand.coreValues.map((val, idx) => (
                        <div key={idx} className="core-value-badge active">
                          <Sparkle size={12} className="text-emerald" />
                          <span>{val}</span>
                          <button
                            type="button"
                            className="badge-remove"
                            onClick={() => {
                              const next = employerBrand.coreValues.filter((_, i) => i !== idx);
                              setEmployerBrand({ ...employerBrand, coreValues: next });
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Quick suggestion values */}
                    <div className="values-quick-suggestions">
                      <span className="text-xs text-muted font-bold">Gợi ý nhanh:</span>
                      {POPULAR_CORE_VALUES.filter((v) => !employerBrand.coreValues.includes(v)).map((v) => (
                        <button
                          key={v}
                          type="button"
                          className="suggestion-tag"
                          onClick={() => {
                            setEmployerBrand({
                              ...employerBrand,
                              coreValues: [...employerBrand.coreValues, v],
                            });
                          }}
                        >
                          + {v}
                        </button>
                      ))}
                    </div>

                    {/* Custom Add */}
                    <div className="add-custom-tag-row">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Nhập giá trị tùy chỉnh..."
                        value={customValueInput}
                        onChange={(e) => setCustomValueInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customValueInput.trim()) {
                            e.preventDefault();
                            if (!employerBrand.coreValues.includes(customValueInput.trim())) {
                              setEmployerBrand({
                                ...employerBrand,
                                coreValues: [...employerBrand.coreValues, customValueInput.trim()],
                              });
                            }
                            setCustomValueInput('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn-add-tag"
                        onClick={() => {
                          if (customValueInput.trim() && !employerBrand.coreValues.includes(customValueInput.trim())) {
                            setEmployerBrand({
                              ...employerBrand,
                              coreValues: [...employerBrand.coreValues, customValueInput.trim()],
                            });
                            setCustomValueInput('');
                          }
                        }}
                      >
                        <Plus size={15} /> Thêm giá trị
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: Quyền lợi chung */}
              <section className="profile-section-card">
                <div className="section-card-header">
                  <div className="section-card-title-wrap">
                    <Award size={20} className="section-icon" />
                    <div>
                      <h2 className="section-card-title">Quyền lợi nhân viên (Company Benefits)</h2>
                      <p className="section-card-sub">Chính sách đãi ngộ chung cấp doanh nghiệp (từng Job cụ thể có thể bổ sung riêng).</p>
                    </div>
                  </div>
                </div>

                <div className="profile-form-grid">
                  <div className="form-group col-span-2">
                    <div className="benefits-tags-grid">
                      {POPULAR_BENEFITS.map((benefit) => {
                        const isSelected = employerBrand.benefits.includes(benefit);
                        return (
                          <button
                            key={benefit}
                            type="button"
                            className={`benefit-toggle-btn ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              if (isSelected) {
                                setEmployerBrand({
                                  ...employerBrand,
                                  benefits: employerBrand.benefits.filter((b) => b !== benefit),
                                });
                              } else {
                                setEmployerBrand({
                                  ...employerBrand,
                                  benefits: [...employerBrand.benefits, benefit],
                                });
                              }
                            }}
                          >
                            <span className="benefit-checkbox">
                              {isSelected && <Check size={12} />}
                            </span>
                            <span className="benefit-label">{benefit}</span>
                          </button>
                        );
                      })}

                      {/* Custom Benefits */}
                      {employerBrand.benefits
                        .filter((b) => !POPULAR_BENEFITS.includes(b))
                        .map((customB) => (
                          <div key={customB} className="benefit-toggle-btn selected custom-benefit">
                            <span className="benefit-checkbox">
                              <Check size={12} />
                            </span>
                            <span className="benefit-label">{customB}</span>
                            <button
                              type="button"
                              className="custom-benefit-del"
                              onClick={() => {
                                setEmployerBrand({
                                  ...employerBrand,
                                  benefits: employerBrand.benefits.filter((b) => b !== customB),
                                });
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                    </div>

                    {/* Add Custom Benefit */}
                    <div className="add-custom-tag-row mt-3">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Thêm quyền lợi tùy chỉnh..."
                        value={customBenefitInput}
                        onChange={(e) => setCustomBenefitInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customBenefitInput.trim()) {
                            e.preventDefault();
                            if (!employerBrand.benefits.includes(customBenefitInput.trim())) {
                              setEmployerBrand({
                                ...employerBrand,
                                benefits: [...employerBrand.benefits, customBenefitInput.trim()],
                              });
                            }
                            setCustomBenefitInput('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn-add-tag"
                        onClick={() => {
                          if (customBenefitInput.trim() && !employerBrand.benefits.includes(customBenefitInput.trim())) {
                            setEmployerBrand({
                              ...employerBrand,
                              benefits: [...employerBrand.benefits, customBenefitInput.trim()],
                            });
                            setCustomBenefitInput('');
                          }
                        }}
                      >
                        <Plus size={15} /> Thêm quyền lợi
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 3: Chính sách làm việc */}
              <section className="profile-section-card">
                <div className="section-card-header">
                  <div className="section-card-title-wrap">
                    <Layers size={20} className="section-icon" />
                    <div>
                      <h2 className="section-card-title">Chính sách hình thức làm việc</h2>
                      <p className="section-card-sub">Mô hình làm việc tổng thể mà công ty đang áp dụng.</p>
                    </div>
                  </div>
                </div>

                <div className="workplace-models-row">
                  {['On-site', 'Hybrid', 'Remote'].map((model) => {
                    const checked = employerBrand.workplaceModels.includes(model);
                    return (
                      <label key={model} className={`workplace-model-card ${checked ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEmployerBrand({
                                ...employerBrand,
                                workplaceModels: [...employerBrand.workplaceModels, model],
                              });
                            } else {
                              setEmployerBrand({
                                ...employerBrand,
                                workplaceModels: employerBrand.workplaceModels.filter((m) => m !== model),
                              });
                            }
                          }}
                        />
                        <div className="model-card-content">
                          <strong className="model-name">{model}</strong>
                          <span className="model-desc">
                            {model === 'On-site' && 'Làm việc trực tiếp tại văn phòng'}
                            {model === 'Hybrid' && 'Kết hợp linh hoạt giữa văn phòng và tại nhà'}
                            {model === 'Remote' && 'Làm việc từ xa 100%'}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>

              {/* Section 4: Media Gallery */}
              <section className="profile-section-card">
                <div className="section-card-header">
                  <div className="section-card-title-wrap">
                    <ImageIcon size={20} className="section-icon" />
                    <div>
                      <h2 className="section-card-title">Hình ảnh môi trường làm việc</h2>
                      <p className="section-card-sub">Ảnh không gian văn phòng, hoạt động team building và sự kiện (Tối đa 6 ảnh).</p>
                    </div>
                  </div>
                </div>

                <div className="workplace-photos-grid">
                  {employerBrand.workplacePhotos.map((photo, idx) => (
                    <div key={idx} className="photo-grid-item">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt={`Workspace ${idx + 1}`} className="workplace-img" />
                      <button
                        type="button"
                        className="photo-remove-btn"
                        onClick={() => removePhoto(idx)}
                        title="Xóa hình ảnh"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  {employerBrand.workplacePhotos.length < 6 && (
                    <div
                      className="photo-upload-slot"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden-file-input"
                        onChange={handlePhotoUpload}
                        style={{ display: 'none' }}
                      />
                      <UploadCloud size={24} className="text-emerald" />
                      <span className="slot-title">+ Thêm hình ảnh</span>
                      <span className="slot-hint">PNG, JPG tối đa 5MB</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Section 5: Vì sao gia nhập & Tuyển dụng */}
              <section className="profile-section-card">
                <div className="section-card-header">
                  <div className="section-card-title-wrap">
                    <Sparkles size={20} className="section-icon" />
                    <div>
                      <h2 className="section-card-title">Điểm khác biệt &amp; Quy trình tuyển dụng</h2>
                      <p className="section-card-sub">Lý do ứng viên nên chọn doanh nghiệp và các vòng phỏng vấn dự kiến.</p>
                    </div>
                  </div>
                </div>

                <div className="profile-form-grid">
                  {/* Vì sao gia nhập */}
                  <div className="form-group col-span-2">
                    <div className="flex justify-between items-center mb-1">
                      <label className="form-label mb-0" htmlFor="why-join-us">
                        Điều gì khiến doanh nghiệp của bạn khác biệt?
                      </label>
                      <span className="text-xs text-muted">
                        {employerBrand.whyJoinUs.length} / 500 ký tự
                      </span>
                    </div>
                    <textarea
                      id="why-join-us"
                      rows={3}
                      className="form-textarea"
                      placeholder="Chia sẻ ngắn gọn điều ứng viên có thể mong đợi khi gia nhập đội ngũ..."
                      value={employerBrand.whyJoinUs}
                      maxLength={500}
                      onChange={(e) => setEmployerBrand({ ...employerBrand, whyJoinUs: e.target.value })}
                    />
                  </div>

                  {/* Quy trình tuyển dụng */}
                  <div className="form-group col-span-2">
                    <label className="form-label">Quy trình tuyển dụng mặc định</label>
                    <div className="hiring-steps-list">
                      {employerBrand.hiringSteps.map((step, idx) => (
                        <div key={idx} className="hiring-step-row">
                          <div className="step-number-badge">{idx + 1}</div>
                          <input
                            type="text"
                            className="form-input flex-1"
                            value={step}
                            onChange={(e) => {
                              const next = [...employerBrand.hiringSteps];
                              next[idx] = e.target.value;
                              setEmployerBrand({ ...employerBrand, hiringSteps: next });
                            }}
                          />
                          <button
                            type="button"
                            className="step-del-btn"
                            onClick={() => {
                              const next = employerBrand.hiringSteps.filter((_, i) => i !== idx);
                              setEmployerBrand({ ...employerBrand, hiringSteps: next });
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="add-step-row mt-2">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Thêm bước tuyển dụng mới..."
                        value={newStepInput}
                        onChange={(e) => setNewStepInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newStepInput.trim()) {
                            e.preventDefault();
                            setEmployerBrand({
                              ...employerBrand,
                              hiringSteps: [...employerBrand.hiringSteps, newStepInput.trim()],
                            });
                            setNewStepInput('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn-add-tag"
                        onClick={() => {
                          if (newStepInput.trim()) {
                            setEmployerBrand({
                              ...employerBrand,
                              hiringSteps: [...employerBrand.hiringSteps, newStepInput.trim()],
                            });
                            setNewStepInput('');
                          }
                        }}
                      >
                        <Plus size={15} /> Thêm bước
                      </button>
                    </div>
                  </div>

                  {/* Liên hệ tuyển dụng */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="recruiting-email">
                      Email tiếp nhận hồ sơ tuyển dụng
                    </label>
                    <input
                      id="recruiting-email"
                      type="email"
                      className="form-input"
                      placeholder="careers@company.com"
                      value={employerBrand.recruitingEmail}
                      onChange={(e) => setEmployerBrand({ ...employerBrand, recruitingEmail: e.target.value })}
                    />
                    <span className="form-hint">Email công khai cho ứng viên liên hệ, tách biệt với email đăng nhập cá nhân.</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="recruiting-site">
                      Portal / Trang tuyển dụng riêng
                    </label>
                    <input
                      id="recruiting-site"
                      type="url"
                      className="form-input"
                      placeholder="https://company.com/careers"
                      value={employerBrand.recruitingWebsite}
                      onChange={(e) => setEmployerBrand({ ...employerBrand, recruitingWebsite: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              {/* Bottom Action */}
              <div className="tab-bottom-actions">
                <button
                  type="button"
                  className="btn-save-main"
                  onClick={() => saveToLocal()}
                >
                  <CheckCircle2 size={16} /> Lưu tất cả thay đổi
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: TÀI KHOẢN & BẢO MẬT
          ======================================================== */}
          {activeTab === 'account' && (
            <div className="profile-tab-pane">
              {/* Section 1: Tài khoản recruiter */}
              <section className="profile-section-card">
                <div className="section-card-header">
                  <div className="section-card-title-wrap">
                    <Shield size={20} className="section-icon" />
                    <div>
                      <h2 className="section-card-title">Tài khoản của tôi</h2>
                      <p className="section-card-sub">Thông tin cá nhân của người quản trị tài khoản Recruiter (không chia sẻ công khai).</p>
                    </div>
                  </div>
                </div>

                <div className="profile-form-grid">
                  {/* Họ tên */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="recruiter-fullname">
                      Họ và tên chuyên viên tuyển dụng
                    </label>
                    <input
                      id="recruiter-fullname"
                      type="text"
                      className="form-input"
                      value={accountInfo.fullName}
                      onChange={(e) => setAccountInfo({ ...accountInfo, fullName: e.target.value })}
                    />
                  </div>

                  {/* Chức danh */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="recruiter-title">
                      Chức danh nội bộ
                    </label>
                    <input
                      id="recruiter-title"
                      type="text"
                      className="form-input"
                      placeholder="Ví dụ: Talent Acquisition Specialist"
                      value={accountInfo.title}
                      onChange={(e) => setAccountInfo({ ...accountInfo, title: e.target.value })}
                    />
                  </div>

                  {/* Email đăng nhập (Readonly) */}
                  <div className="form-group col-span-2">
                    <label className="form-label" htmlFor="recruiter-email">
                      Email đăng nhập
                    </label>
                    <div className="readonly-input-wrap">
                      <input
                        id="recruiter-email"
                        type="email"
                        className="form-input bg-gray-50 text-muted"
                        value={accountInfo.loginEmail}
                        readOnly
                      />
                      <span className="readonly-badge">
                        <Lock size={12} /> Được quản lý bởi hệ thống Auth
                      </span>
                    </div>
                    <span className="form-hint">Email dùng để đăng nhập và nhận thông báo hệ thống nội bộ.</span>
                  </div>
                </div>
              </section>

              {/* Section 2: Đổi mật khẩu */}
              <section className="profile-section-card">
                <div className="section-card-header">
                  <div className="section-card-title-wrap">
                    <KeyRound size={20} className="section-icon" />
                    <div>
                      <h2 className="section-card-title">Bảo mật &amp; Mật khẩu</h2>
                      <p className="section-card-sub">Quản lý mật khẩu và các phiên đăng nhập an toàn.</p>
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newPassword || newPassword !== confirmPassword) {
                      triggerToast('Mật khẩu mới không khớp hoặc chưa điền!', 'error');
                      return;
                    }
                    triggerToast('Đổi mật khẩu thành công!');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="profile-form-grid"
                >
                  <div className="form-group col-span-2">
                    <label className="form-label" htmlFor="current-pass">
                      Mật khẩu hiện tại
                    </label>
                    <input
                      id="current-pass"
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="new-pass">
                      Mật khẩu mới
                    </label>
                    <input
                      id="new-pass"
                      type="password"
                      className="form-input"
                      placeholder="Ít nhất 8 ký tự"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="confirm-pass">
                      Xác nhận mật khẩu mới
                    </label>
                    <input
                      id="confirm-pass"
                      type="password"
                      className="form-input"
                      placeholder="Nhập lại mật khẩu mới"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>

                  <div className="form-group col-span-2">
                    <button type="submit" className="btn-outline-emerald">
                      Cập nhật mật khẩu
                    </button>
                  </div>
                </form>

                {/* Connected Services */}
                <div className="connected-services-box mt-4">
                  <div className="service-row">
                    <div className="service-info">
                      <div className="service-icon-google">G</div>
                      <div>
                        <strong className="service-name">Google Account</strong>
                        <span className="service-status text-emerald">Đã liên kết đăng nhập nhanh</span>
                      </div>
                    </div>
                    <span className="badge-active">Hoạt động</span>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* ============================================================
          CANDIDATE-FACING PREVIEW MODAL ("XEM NHƯ ỨNG VIÊN")
      ============================================================ */}
      {isPreviewOpen && (
        <div
          className="modal-overlay open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
        >
          <div className="modal-card company-preview-modal-card">
            {/* Modal Top Bar */}
            <div className="company-preview-top-bar">
              <div className="preview-indicator">
                <Eye size={16} />
                <span>Bản xem trước: Góc nhìn ứng viên (Candidate View)</span>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsPreviewOpen(false)}
                aria-label="Đóng bản xem trước"
              >
                ×
              </button>
            </div>

            {/* Candidate-facing Company Detail Body */}
            <div className="company-preview-content">
              {/* Header Hero */}
              <div className="candidate-company-hero">
                <div className="hero-logo-box">
                  {companyInfo.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={companyInfo.logo} alt={companyInfo.name} className="hero-logo-img" />
                  ) : (
                    <Building2 size={36} />
                  )}
                </div>
                <div className="hero-company-info">
                  <h2 id="preview-modal-title" className="hero-company-title">
                    {companyInfo.name || 'Tên doanh nghiệp'}
                  </h2>
                  <div className="hero-tags-row">
                    <span className="hero-tag">{companyInfo.industry}</span>
                    <span className="hero-tag">{companyInfo.companySize}</span>
                    <span className="hero-tag">📍 {companyInfo.headquarters}</span>
                  </div>
                </div>
                {companyInfo.website && (
                  <a
                    href={companyInfo.website}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-preview-website"
                  >
                    <Globe size={15} />
                    <span>Website công ty</span>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>

              {/* 2-Column Preview Body */}
              <div className="candidate-preview-grid">
                {/* Left Preview Column: Main Info */}
                <div className="candidate-preview-main">
                  {/* Giới thiệu */}
                  <div className="preview-card-block">
                    <h3 className="preview-block-title">Giới thiệu doanh nghiệp</h3>
                    <p className="preview-block-text">{companyInfo.description || 'Chưa có mô tả.'}</p>

                    {companyInfo.mission && (
                      <div className="preview-mission-quote">
                        <strong>Sứ mệnh:</strong> &ldquo;{companyInfo.mission}&rdquo;
                      </div>
                    )}

                    {companyInfo.productsServices.length > 0 && (
                      <div className="preview-products-wrap">
                        <span className="preview-sub-label">Sản phẩm &amp; Dịch vụ:</span>
                        <div className="preview-chips-row">
                          {companyInfo.productsServices.map((p, i) => (
                            <span key={i} className="preview-chip">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Văn hóa & Môi trường */}
                  <div className="preview-card-block">
                    <h3 className="preview-block-title">Văn hóa &amp; Giá trị cốt lõi</h3>
                    {employerBrand.workEnvironment && (
                      <p className="preview-block-text mb-3">{employerBrand.workEnvironment}</p>
                    )}
                    <div className="preview-chips-row">
                      {employerBrand.coreValues.map((v, i) => (
                        <span key={i} className="preview-value-tag">
                          ✨ {v}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Quyền lợi */}
                  <div className="preview-card-block">
                    <h3 className="preview-block-title">Quyền lợi dành cho nhân viên</h3>
                    <div className="preview-benefits-grid">
                      {employerBrand.benefits.map((b, i) => (
                        <div key={i} className="preview-benefit-item">
                          <CheckCircle2 size={16} className="text-emerald shrink-0" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hình ảnh văn phòng */}
                  {employerBrand.workplacePhotos.length > 0 && (
                    <div className="preview-card-block">
                      <h3 className="preview-block-title">Môi trường làm việc thực tế</h3>
                      <div className="preview-photos-gallery">
                        {employerBrand.workplacePhotos.map((photo, i) => (
                          <div key={i} className="preview-photo-wrap">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo} alt={`Office ${i + 1}`} className="preview-gallery-img" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quy trình tuyển dụng */}
                  {employerBrand.hiringSteps.length > 0 && (
                    <div className="preview-card-block">
                      <h3 className="preview-block-title">Quy trình tuyển dụng</h3>
                      <div className="preview-timeline">
                        {employerBrand.hiringSteps.map((step, i) => (
                          <div key={i} className="timeline-step-item">
                            <div className="timeline-dot">{i + 1}</div>
                            <div className="timeline-content">{step}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Preview Column: Active Jobs & Contact */}
                <div className="candidate-preview-sidebar">
                  {/* Active Jobs Box */}
                  <div className="preview-jobs-card">
                    <div className="preview-jobs-header">
                      <h3 className="preview-jobs-title">Vị trí đang tuyển ({previewJobs.length})</h3>
                      <span className="text-xs text-muted">Đang hoạt động</span>
                    </div>

                    <div className="preview-jobs-list">
                      {previewJobs.map((job) => (
                        <div key={job.id} className="preview-job-item">
                          <div>
                            <h4 className="preview-job-name">{job.title}</h4>
                            <div className="preview-job-meta">
                              <span>{job.level}</span> · <span>{job.location}</span>
                            </div>
                            <span className="preview-job-salary">{job.salary}</span>
                          </div>
                          <button
                            type="button"
                            className="btn-view-job-arrow"
                            onClick={() => {
                              setIsPreviewOpen(false);
                              if (onNavigate) onNavigate('jobs');
                            }}
                          >
                            Xem →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Contact Info Box */}
                  <div className="preview-contact-card">
                    <h3 className="preview-contact-title">Liên hệ tuyển dụng</h3>
                    <div className="preview-contact-list">
                      {employerBrand.recruitingEmail && (
                        <div className="contact-item">
                          <Mail size={14} className="text-emerald" />
                          <span className="contact-val">{employerBrand.recruitingEmail}</span>
                        </div>
                      )}
                      {employerBrand.recruitingWebsite && (
                        <div className="contact-item">
                          <Globe size={14} className="text-emerald" />
                          <a
                            href={employerBrand.recruitingWebsite}
                            target="_blank"
                            rel="noreferrer"
                            className="contact-link"
                          >
                            {employerBrand.recruitingWebsite}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
