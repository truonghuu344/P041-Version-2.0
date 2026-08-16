'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  User,
  Shield,
  Bot,
  Sparkles,
  Lock,
  Users,
  CheckCircle2,
  GraduationCap,
  Briefcase,
  Layers,
  Languages,
  FileText,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  Info,
  MapPin,
  Building,
  Calendar,
  Award,
  Globe,
  Link2,
  Code2,
  Phone,
  Mail,
  Sliders,
  AlertTriangle,
  ChevronRight,
  Check,
  Star,
  Search,
  X,
} from 'lucide-react';

export interface EducationItem {
  id: string;
  school: string;
  major: string;
  degree: string;
  startYear: string;
  endYear: string;
  gpa?: string;
  status: 'studying' | 'graduated';
}

export interface LanguageItem {
  id: string;
  language: string;
  proficiency: string;
}

export interface CVItem {
  id: string;
  title: string;
  type: 'original' | 'optimized' | 'ai_generated';
  typeLabel: string;
  updatedAt: string;
  isDefault?: boolean;
}

export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  location: string;
  headline: string;
  jobStatus: 'searching' | 'internship_ready' | 'not_looking';
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface CareerGoals {
  targetRole: string;
  interests: string[];
  currentLevel: 'student' | 'intern' | 'fresher' | 'junior';
  workMode: 'onsite' | 'hybrid' | 'remote';
  desiredLocations: string[];
}

export interface AIPreferences {
  priorityRole: string;
  focusTechStack: string[];
  jobType: 'internship' | 'fulltime' | 'parttime';
  allowAiProfileGrounding: boolean;
  aiPersona: 'mentor' | 'recruiter' | 'techlead';
}

const DEFAULT_POPULAR_SKILLS = [
  'Python',
  'FastAPI',
  'PostgreSQL',
  'Docker',
  'Git',
  'Machine Learning',
  'React',
  'TypeScript',
  'Node.js',
  'REST API',
  'Data Structures',
  'SQL',
  'Tailwind CSS',
  'Next.js',
  'CI/CD',
  'Problem Solving',
  'Teamwork',
];

const VIETNAM_LOCATIONS = [
  'TP. Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Cần Thơ',
  'Hải Phòng',
  'Bình Dương',
  'Đồng Nai',
  'Toàn quốc',
  'Remote (Làm từ xa)',
];

const POPULAR_DOMAINS = [
  'FinTech',
  'AI / Machine Learning',
  'E-Commerce',
  'EdTech',
  'Cloud / SaaS',
  'HealthTech',
  'Game Development',
  'Cybersecurity',
  'Logistics',
];

export default function ProfileView() {
  const [activeTab, setActiveTab] = useState<'profile' | 'career' | 'security'>('profile');
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [saveToast, setSaveToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null,
  );

  // 1. Personal Info
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    fullName: 'Ứng viên Sinh viên',
    email: 'user@example.com',
    phone: '',
    dob: '',
    location: 'TP. Hồ Chí Minh',
    headline: 'Software Engineer Student',
    jobStatus: 'searching',
    linkedin: '',
    github: '',
    portfolio: '',
  });

  // 2. Education
  const [educationList, setEducationList] = useState<EducationItem[]>([
    {
      id: 'edu-1',
      school: 'Đại học Công nghệ Thông tin - ĐHQG-HCM',
      major: 'Kỹ thuật Phần mềm',
      degree: 'Cử nhân',
      startYear: '2023',
      endYear: '2027',
      gpa: '3.6 / 4.0',
      status: 'studying',
    },
  ]);
  const [eduModalOpen, setEduModalOpen] = useState(false);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [eduForm, setEduForm] = useState<Omit<EducationItem, 'id'>>({
    school: '',
    major: '',
    degree: 'Cử nhân',
    startYear: '',
    endYear: '',
    gpa: '',
    status: 'studying',
  });

  // 3. Career Goals
  const [careerGoals, setCareerGoals] = useState<CareerGoals>({
    targetRole: 'Backend Developer',
    interests: ['AI / Machine Learning', 'FinTech', 'Cloud / SaaS'],
    currentLevel: 'student',
    workMode: 'hybrid',
    desiredLocations: ['TP. Hồ Chí Minh', 'Remote (Làm từ xa)'],
  });
  const [locationSearchInput, setLocationSearchInput] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  // 4. Skills
  const [skills, setSkills] = useState<string[]>([
    'Python',
    'FastAPI',
    'PostgreSQL',
    'Docker',
    'Git',
    'Machine Learning',
  ]);
  const [skillInput, setSkillInput] = useState('');

  // 5. Languages
  const [languages, setLanguages] = useState<LanguageItem[]>([
    { id: 'lang-1', language: 'Tiếng Việt', proficiency: 'Bản ngữ' },
    { id: 'lang-2', language: 'Tiếng Anh', proficiency: 'Intermediate (B2)' },
  ]);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [langForm, setLangForm] = useState({ language: '', proficiency: 'Intermediate (B2)' });

  // 6. CVs
  const [cvList, setCvList] = useState<CVItem[]>([
    {
      id: 'cv-1',
      title: 'Software Engineer CV',
      type: 'optimized',
      typeLabel: 'CV đã tối ưu theo JD',
      updatedAt: '15/08/2026',
      isDefault: true,
    },
    {
      id: 'cv-2',
      title: 'General IT CV',
      type: 'original',
      typeLabel: 'CV gốc',
      updatedAt: '10/08/2026',
      isDefault: false,
    },
  ]);

  // 7. AI Preferences
  const [aiPreferences, setAiPreferences] = useState<AIPreferences>({
    priorityRole: 'Backend Developer / AI Engineer',
    focusTechStack: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'],
    jobType: 'internship',
    allowAiProfileGrounding: true,
    aiPersona: 'mentor',
  });

  // 8. Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [counselorEmail, setCounselorEmail] = useState('');
  const [counselors, setCounselors] = useState<{ id: string; email: string }[]>([]);

  // Load Initial Data from localStorage & API if available
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user_info');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        setPersonalInfo((prev) => ({
          ...prev,
          fullName: u.full_name || prev.fullName,
          email: u.email || prev.email,
        }));
      }

      const storedPersona = localStorage.getItem('ai_persona');
      if (storedPersona && ['mentor', 'recruiter', 'techlead'].includes(storedPersona)) {
        setAiPreferences((prev) => ({ ...prev, aiPersona: storedPersona as any }));
      }

      const storedTargetRole = localStorage.getItem('crew_target_role');
      if (storedTargetRole) {
        setCareerGoals((prev) => ({ ...prev, targetRole: storedTargetRole }));
        setAiPreferences((prev) => ({ ...prev, priorityRole: storedTargetRole }));
      }

      const storedProfile = localStorage.getItem('candidate_profile_data');
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        if (parsed.personalInfo) setPersonalInfo((prev) => ({ ...prev, ...parsed.personalInfo }));
        if (parsed.educationList) setEducationList(parsed.educationList);
        if (parsed.careerGoals) setCareerGoals((prev) => ({ ...prev, ...parsed.careerGoals }));
        if (parsed.skills) setSkills(parsed.skills);
        if (parsed.languages) setLanguages(parsed.languages);
        if (parsed.aiPreferences)
          setAiPreferences((prev) => ({ ...prev, ...parsed.aiPreferences }));
      }

      // Fetch CVs from ApiClient if in browser
      if (typeof window !== 'undefined' && (window as any).ApiClient) {
        (window as any).ApiClient.listCVs()
          .then((res: any[]) => {
            if (Array.isArray(res) && res.length > 0) {
              const mapped: CVItem[] = res.map((item, idx) => ({
                id: item.id,
                title: item.title || `CV ${idx + 1}`,
                type: item.is_optimized ? 'optimized' : item.raw_text ? 'original' : 'ai_generated',
                typeLabel:
                  item.status_label || (item.is_optimized ? 'CV đã tối ưu theo JD' : 'CV gốc'),
                updatedAt: item.updated_at
                  ? new Date(item.updated_at).toLocaleDateString('vi-VN')
                  : 'Gần đây',
                isDefault: idx === 0,
              }));
              setCvList(mapped);
            }
          })
          .catch(() => {});
      }
    } catch {
      // Graceful fallback to initial mock state
    }
  }, []);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setSaveToast({ message, type });
    setTimeout(() => setSaveToast(null), 3500);
  };

  // Persist Profile state to localStorage
  const saveAllToLocal = useCallback(() => {
    try {
      const payload = {
        personalInfo,
        educationList,
        careerGoals,
        skills,
        languages,
        aiPreferences,
      };
      localStorage.setItem('candidate_profile_data', JSON.stringify(payload));
      localStorage.setItem('crew_target_role', careerGoals.targetRole);
      localStorage.setItem('ai_persona', aiPreferences.aiPersona);
    } catch {
      // ignore
    }
  }, [personalInfo, educationList, careerGoals, skills, languages, aiPreferences]);

  // Profile Completion Calculation
  const { completionPercentage, missingItems } = useMemo(() => {
    let score = 0;
    const missing: { title: string; tab: 'profile' | 'career' | 'security'; hint: string }[] = [];

    // 1. Personal info (20%)
    const hasBasicInfo = Boolean(
      personalInfo.fullName.trim() && personalInfo.phone.trim() && personalInfo.location.trim(),
    );
    if (hasBasicInfo) {
      score += 20;
    } else {
      missing.push({
        title: 'Thông tin cá nhân',
        tab: 'profile',
        hint: 'Bổ sung số điện thoại và tỉnh/thành phố',
      });
    }

    // 2. Education (20%)
    if (educationList.length > 0 && educationList[0].school.trim()) {
      score += 20;
    } else {
      missing.push({
        title: 'Học vấn',
        tab: 'profile',
        hint: 'Thêm trường đại học và chuyên ngành đang học',
      });
    }

    // 3. Career Orientation (20%)
    const hasCareer = Boolean(
      careerGoals.targetRole.trim() && careerGoals.desiredLocations.length > 0,
    );
    if (hasCareer) {
      score += 20;
    } else {
      missing.push({
        title: 'Định hướng nghề nghiệp',
        tab: 'career',
        hint: 'Xác định vị trí mục tiêu và địa điểm mong muốn',
      });
    }

    // 4. Skills (20%)
    if (skills.length >= 3) {
      score += 20;
    } else {
      missing.push({
        title: 'Kỹ năng chuyên môn',
        tab: 'career',
        hint: `Cần tối thiểu 3 kỹ năng (hiện có ${skills.length})`,
      });
    }

    // 5. Languages (10%)
    if (languages.length >= 1) {
      score += 10;
    } else {
      missing.push({
        title: 'Ngôn ngữ',
        tab: 'career',
        hint: 'Khai báo ít nhất 1 ngoại ngữ hoặc tiếng mẹ đẻ',
      });
    }

    // 6. CV Saved (10%)
    if (cvList.length >= 1) {
      score += 10;
    } else {
      missing.push({
        title: 'CV của tôi',
        tab: 'profile',
        hint: 'Tạo hoặc tải lên ít nhất một bản CV',
      });
    }

    return {
      completionPercentage: Math.min(100, score),
      missingItems: missing,
    };
  }, [personalInfo, educationList, careerGoals, skills, languages, cvList]);

  // Handler: Save Personal Info Form
  const handleSavePersonalInfo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    saveAllToLocal();

    // Call API updateProfile if available
    try {
      if (typeof window !== 'undefined' && (window as any).ApiClient) {
        await (window as any).ApiClient.request('/auth/me', {
          method: 'PUT',
          body: JSON.stringify({ full_name: personalInfo.fullName.trim() }),
        });
      }
    } catch {
      // continue
    }

    triggerToast('Đã lưu thông tin cá nhân thành công!');
    setIsEditingHeader(false);
  };

  // Handler: Add / Edit Education
  const handleOpenAddEdu = () => {
    setEditingEduId(null);
    setEduForm({
      school: '',
      major: '',
      degree: 'Cử nhân',
      startYear: '2023',
      endYear: '2027',
      gpa: '',
      status: 'studying',
    });
    setEduModalOpen(true);
  };

  const handleOpenEditEdu = (item: EducationItem) => {
    setEditingEduId(item.id);
    setEduForm({
      school: item.school,
      major: item.major,
      degree: item.degree,
      startYear: item.startYear,
      endYear: item.endYear,
      gpa: item.gpa || '',
      status: item.status,
    });
    setEduModalOpen(true);
  };

  const handleSaveEdu = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eduForm.school.trim() || !eduForm.major.trim()) {
      triggerToast('Vui lòng nhập tên trường và chuyên ngành.', 'error');
      return;
    }

    if (editingEduId) {
      setEducationList((prev) =>
        prev.map((item) => (item.id === editingEduId ? { ...item, ...eduForm } : item)),
      );
      triggerToast('Đã cập nhật mục học vấn.');
    } else {
      const newItem: EducationItem = {
        id: `edu-${Date.now()}`,
        ...eduForm,
      };
      setEducationList((prev) => [newItem, ...prev]);
      triggerToast('Đã thêm mục học vấn mới.');
    }
    setEduModalOpen(false);
    setTimeout(saveAllToLocal, 100);
  };

  const handleDeleteEdu = (id: string) => {
    setEducationList((prev) => prev.filter((item) => item.id !== id));
    triggerToast('Đã xóa mục học vấn.');
    setTimeout(saveAllToLocal, 100);
  };

  // Handler: Skills Tag Manager
  const handleAddSkill = (skillToAdd: string) => {
    const trimmed = skillToAdd.trim();
    if (!trimmed) return;
    if (skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      triggerToast(`Kỹ năng "${trimmed}" đã tồn tại.`, 'error');
      return;
    }
    const updated = [...skills, trimmed];
    setSkills(updated);
    setSkillInput('');
    triggerToast(`Đã thêm kỹ năng: ${trimmed}`);
    setTimeout(saveAllToLocal, 100);
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updated = skills.filter((s) => s !== skillToRemove);
    setSkills(updated);
    setTimeout(saveAllToLocal, 100);
  };

  // Handler: Languages Manager
  const handleSaveLanguage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!langForm.language.trim()) {
      triggerToast('Vui lòng nhập tên ngôn ngữ.', 'error');
      return;
    }
    const newItem: LanguageItem = {
      id: `lang-${Date.now()}`,
      language: langForm.language.trim(),
      proficiency: langForm.proficiency,
    };
    setLanguages((prev) => [...prev, newItem]);
    setLangForm({ language: '', proficiency: 'Intermediate (B2)' });
    setLangModalOpen(false);
    triggerToast(`Đã thêm ngôn ngữ: ${newItem.language}`);
    setTimeout(saveAllToLocal, 100);
  };

  const handleDeleteLanguage = (id: string) => {
    setLanguages((prev) => prev.filter((item) => item.id !== id));
    triggerToast('Đã xóa ngôn ngữ.');
    setTimeout(saveAllToLocal, 100);
  };

  // Handler: Desired Location Chips
  const handleAddLocation = (loc: string) => {
    if (!loc.trim()) return;
    if (!careerGoals.desiredLocations.includes(loc.trim())) {
      setCareerGoals((prev) => ({
        ...prev,
        desiredLocations: [...prev.desiredLocations, loc.trim()],
      }));
    }
    setLocationSearchInput('');
    setShowLocationDropdown(false);
    setTimeout(saveAllToLocal, 100);
  };

  const handleRemoveLocation = (loc: string) => {
    setCareerGoals((prev) => ({
      ...prev,
      desiredLocations: prev.desiredLocations.filter((l) => l !== loc),
    }));
    setTimeout(saveAllToLocal, 100);
  };

  // Handler: CV default selection
  const handleSetDefaultCV = (cvId: string) => {
    setCvList((prev) =>
      prev.map((c) => ({
        ...c,
        isDefault: c.id === cvId,
      })),
    );
    const chosen = cvList.find((c) => c.id === cvId);
    triggerToast(`Đã đặt "${chosen?.title || 'CV'}" làm CV mặc định cho AI!`);
  };

  // Handler: Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      triggerToast('Vui lòng nhập mật khẩu hiện tại.', 'error');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      triggerToast('Mật khẩu mới phải có tối thiểu 6 ký tự.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      triggerToast('Mật khẩu xác nhận không khớp.', 'error');
      return;
    }

    try {
      if (typeof window !== 'undefined' && (window as any).ApiClient) {
        await (window as any).ApiClient.request('/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        });
      }
      triggerToast('Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      triggerToast(err?.message || 'Không thể đổi mật khẩu. Hãy kiểm tra lại.', 'error');
    }
  };

  // Handler: Grant Counselor
  const handleGrantCounselor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!counselorEmail.trim()) return;
    setCounselors((prev) => [...prev, { id: `c-${Date.now()}`, email: counselorEmail.trim() }]);
    setCounselorEmail('');
    triggerToast('Đã cấp quyền chia sẻ hồ sơ cho cố vấn.');
  };

  const handleRevokeCounselor = (id: string) => {
    setCounselors((prev) => prev.filter((c) => c.id !== id));
    triggerToast('Đã thu hồi quyền truy cập của cố vấn.');
  };

  // Navigation switch helper
  const goTo = (viewName: string) => {
    if (typeof window !== 'undefined' && (window as any).switchView) {
      (window as any).switchView(viewName);
    }
  };

  // Job Search Status labels & colors
  const jobStatusConfig = {
    searching: { label: 'Đang tìm việc', class: 'status-searching', icon: '🟢' },
    internship_ready: { label: 'Sẵn sàng thực tập', class: 'status-intern', icon: '🟡' },
    not_looking: { label: 'Chưa có nhu cầu', class: 'status-closed', icon: '⚪' },
  };

  return (
    <section className="app-view" id="view-profile">
      {/* ===== FLOATING TOAST NOTIFICATION ===== */}
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

      <div className="profile-workspace-container">
        {/* ============================================================
            1. PROFILE HEADER
        ============================================================ */}
        <header className="profile-header-card" aria-label="Thông tin hồ sơ sinh viên">
          <div className="profile-header-main">
            {/* Avatar with dynamic initials */}
            <div className="profile-avatar" id="profile-avatar-large" aria-hidden="true">
              {personalInfo.fullName
                ? personalInfo.fullName
                    .split(' ')
                    .filter(Boolean)
                    .slice(-2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                : 'SV'}
            </div>

            {/* Core Info */}
            <div className="profile-header-info">
              <div className="profile-name-row">
                <h1 className="profile-display-name" id="profile-display-name">
                  {personalInfo.fullName || 'Họ và tên ứng viên'}
                </h1>

                {/* Job Search Status Dropdown / Badge */}
                <div className="profile-status-wrapper">
                  <select
                    className={`profile-status-select ${jobStatusConfig[personalInfo.jobStatus].class}`}
                    value={personalInfo.jobStatus}
                    onChange={(e) => {
                      const newStatus = e.target.value as PersonalInfo['jobStatus'];
                      setPersonalInfo((prev) => ({ ...prev, jobStatus: newStatus }));
                      triggerToast(
                        `Đã đổi trạng thái tìm việc: ${jobStatusConfig[newStatus].label}`,
                      );
                      setTimeout(saveAllToLocal, 100);
                    }}
                    aria-label="Trạng thái tìm việc"
                  >
                    <option value="searching">🟢 Đang tìm việc</option>
                    <option value="internship_ready">🟡 Sẵn sàng thực tập</option>
                    <option value="not_looking">⚪ Chưa có nhu cầu</option>
                  </select>
                </div>
              </div>

              {/* Professional Headline */}
              <p className="profile-headline">
                {personalInfo.headline || 'Software Engineer Student'}
              </p>

              {/* School & Location Meta */}
              <div className="profile-meta-row">
                <span className="profile-meta-item">
                  <GraduationCap size={15} />
                  <span>{educationList[0]?.school || 'Chưa cập nhật trường học'}</span>
                </span>
                <span className="profile-meta-item">
                  <MapPin size={15} />
                  <span>{personalInfo.location || 'Việt Nam'}</span>
                </span>
                <span className="profile-meta-item">
                  <Mail size={15} />
                  <span id="profile-display-email">{personalInfo.email}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Header Action Button */}
          <div className="profile-header-actions">
            <button
              type="button"
              className="profile-btn-outline"
              onClick={() => {
                setActiveTab('profile');
                setIsEditingHeader(!isEditingHeader);
              }}
            >
              <Edit3 size={15} />
              {isEditingHeader ? 'Đóng chỉnh sửa' : 'Chỉnh sửa hồ sơ'}
            </button>
          </div>
        </header>

        {/* ============================================================
            NAVIGATION TABS (DESKTOP / TABLET)
        ============================================================ */}
        <nav className="profile-tabs-nav" aria-label="Phân mục hồ sơ">
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={16} />
            <span>Hồ sơ &amp; Học vấn</span>
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'career' ? 'active' : ''}`}
            onClick={() => setActiveTab('career')}
          >
            <Briefcase size={16} />
            <span>Định hướng &amp; Kỹ năng</span>
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Shield size={16} />
            <span>Tài khoản &amp; Bảo mật</span>
          </button>
        </nav>

        {/* ============================================================
            TWO-COLUMN WORKSPACE: LEFT 30% | RIGHT 70%
        ============================================================ */}
        <div className="profile-layout-grid">
          {/* ==========================================================
              LEFT COLUMN: SIDEBAR (~30%)
          ========================================================== */}
          <aside className="profile-sidebar-column">
            {/* 2. PROFILE COMPLETION CARD */}
            <div className="profile-completion-card" aria-labelledby="completion-title">
              <div className="completion-header">
                <div className="completion-title-wrap">
                  <Award size={18} className="completion-icon" />
                  <h2 id="completion-title" className="completion-title">
                    Mức độ hoàn thiện
                  </h2>
                </div>
                <span className="completion-badge">{completionPercentage}%</span>
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

              {/* Smart AI Context Tip */}
              <p className="completion-tip">
                {completionPercentage >= 90 ? (
                  <>
                    <Sparkles size={14} className="inline-sparkle" />
                    <strong>Hồ sơ hoàn hảo!</strong> AI đã có đầy đủ dữ liệu nền để gợi ý việc làm,
                    tối ưu CV và tạo câu hỏi phỏng vấn chuẩn xác nhất.
                  </>
                ) : (
                  <>
                    <Info size={14} className="inline-sparkle" />
                    Bổ sung kỹ năng và định hướng nghề nghiệp để AI đưa ra gợi ý việc làm và câu hỏi
                    phỏng vấn chính xác hơn.
                  </>
                )}
              </p>

              {/* Missing Items Checklist (Only true missing items) */}
              {missingItems.length > 0 ? (
                <div className="completion-missing-list">
                  <span className="missing-list-label">Các mục cần bổ sung:</span>
                  {missingItems.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="missing-item-btn"
                      onClick={() => setActiveTab(item.tab)}
                      title={`Bấm để chuyển tới ${item.title}`}
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
                  <CheckCircle2 size={16} /> Tất cả mục cốt lõi đã hoàn tất!
                </div>
              )}
            </div>

            {/* AI Grounding Transparency Notice */}
            <div className="profile-grounding-notice">
              <div className="grounding-notice-header">
                <Bot size={18} className="notice-icon" />
                <h3 className="notice-title">Dữ liệu nền cho AI</h3>
              </div>
              <p className="notice-text">
                Profile là <strong>nguồn dữ liệu nền của bạn</strong>, không phải một bản CV thứ
                hai. AI tuyệt đối <strong>không tự thêm</strong> kỹ năng, kinh nghiệm hoặc bằng cấp
                không tồn tại trong hồ sơ của bạn.
              </p>
              <div className="grounding-flow-pill">
                <span>Profile (Nền)</span> → <span>CV (Bằng chứng)</span> →{' '}
                <span>JD (Yêu cầu)</span>
              </div>
            </div>

            {/* Quick Navigation Shortcuts */}
            <div className="profile-sidebar-shortcuts">
              <span className="shortcuts-label">Lối tắt tác vụ AI</span>
              <div className="shortcuts-list">
                <button type="button" className="sidebar-shortcut-btn" onClick={() => goTo('cv')}>
                  <FileText size={16} />
                  <span>Tối ưu hóa CV với AI</span>
                </button>
                <button
                  type="button"
                  className="sidebar-shortcut-btn"
                  onClick={() => goTo('match')}
                >
                  <Sparkles size={16} />
                  <span>So khớp CV với JD</span>
                </button>
                <button
                  type="button"
                  className="sidebar-shortcut-btn"
                  onClick={() => goTo('interview')}
                >
                  <Bot size={16} />
                  <span>Luyện phỏng vấn Voice</span>
                </button>
              </div>
            </div>
          </aside>

          {/* ==========================================================
              RIGHT COLUMN: MAIN CONTENT (~70%)
          ========================================================== */}
          <main className="profile-main-column">
            {/* --------------------------------------------------------
                TAB 1: HỒ SƠ & HỌC VẤN
            -------------------------------------------------------- */}
            {activeTab === 'profile' && (
              <div className="profile-tab-pane">
                {/* 3. THÔNG TIN CÁ NHÂN */}
                <section className="profile-card" aria-labelledby="personal-info-title">
                  <div className="profile-card-header">
                    <div className="profile-card-icon">
                      <User size={18} />
                    </div>
                    <div>
                      <h2 id="personal-info-title" className="profile-card-title">
                        Thông Tin Cá Nhân
                      </h2>
                      <p className="profile-card-subtitle">
                        Thông tin định danh và phương thức liên hệ cơ bản
                      </p>
                    </div>
                  </div>

                  <form id="profile-info-form" onSubmit={handleSavePersonalInfo}>
                    <div className="profile-form-grid">
                      {/* Full Name */}
                      <div className="profile-form-group">
                        <label className="profile-form-label" htmlFor="profile-full-name">
                          Họ và tên <span className="req-star">*</span>
                        </label>
                        <input
                          type="text"
                          id="profile-full-name"
                          className="profile-form-input"
                          value={personalInfo.fullName}
                          onChange={(e) =>
                            setPersonalInfo((prev) => ({ ...prev, fullName: e.target.value }))
                          }
                          placeholder="Ví dụ: Nguyễn Văn A"
                          required
                        />
                      </div>

                      {/* Email (Readonly) */}
                      <div className="profile-form-group">
                        <label className="profile-form-label" htmlFor="profile-email-readonly">
                          Email tài khoản <span className="readonly-tag">Readonly</span>
                        </label>
                        <input
                          type="email"
                          id="profile-email-readonly"
                          className="profile-form-input readonly"
                          value={personalInfo.email}
                          disabled
                          readOnly
                        />
                        <span className="profile-form-hint">
                          Được bảo vệ bởi hệ thống xác thực đăng nhập
                        </span>
                      </div>

                      {/* Phone */}
                      <div className="profile-form-group">
                        <label className="profile-form-label" htmlFor="profile-phone">
                          Số điện thoại
                        </label>
                        <div className="input-with-icon">
                          <Phone size={16} className="field-icon" />
                          <input
                            type="tel"
                            id="profile-phone"
                            className="profile-form-input with-icon"
                            value={personalInfo.phone}
                            onChange={(e) =>
                              setPersonalInfo((prev) => ({ ...prev, phone: e.target.value }))
                            }
                            placeholder="0912 345 678"
                          />
                        </div>
                      </div>

                      {/* Date of Birth */}
                      <div className="profile-form-group">
                        <label className="profile-form-label" htmlFor="profile-dob">
                          Ngày sinh <span className="optional-tag">Tùy chọn</span>
                        </label>
                        <div className="input-with-icon">
                          <Calendar size={16} className="field-icon" />
                          <input
                            type="date"
                            id="profile-dob"
                            className="profile-form-input with-icon"
                            value={personalInfo.dob}
                            onChange={(e) =>
                              setPersonalInfo((prev) => ({ ...prev, dob: e.target.value }))
                            }
                          />
                        </div>
                      </div>

                      {/* Location */}
                      <div className="profile-form-group">
                        <label className="profile-form-label" htmlFor="profile-location">
                          Tỉnh / Thành phố hiện tại
                        </label>
                        <div className="input-with-icon">
                          <MapPin size={16} className="field-icon" />
                          <input
                            type="text"
                            id="profile-location"
                            className="profile-form-input with-icon"
                            value={personalInfo.location}
                            onChange={(e) =>
                              setPersonalInfo((prev) => ({ ...prev, location: e.target.value }))
                            }
                            placeholder="Ví dụ: TP. Hồ Chí Minh"
                          />
                        </div>
                      </div>

                      {/* Professional Headline */}
                      <div className="profile-form-group">
                        <label className="profile-form-label" htmlFor="profile-headline-input">
                          Headline nghề nghiệp
                        </label>
                        <input
                          type="text"
                          id="profile-headline-input"
                          className="profile-form-input"
                          value={personalInfo.headline}
                          onChange={(e) =>
                            setPersonalInfo((prev) => ({ ...prev, headline: e.target.value }))
                          }
                          placeholder="Ví dụ: Software Engineer Student, Frontend Intern"
                        />
                      </div>
                    </div>

                    {/* Social & Portfolio Links */}
                    <div className="profile-social-divider">
                      <span className="divider-label">Liên kết chuyên nghiệp &amp; Portfolio</span>
                    </div>

                    <div className="profile-form-grid">
                      <div className="profile-form-group">
                        <label className="profile-form-label" htmlFor="profile-linkedin">
                          LinkedIn URL
                        </label>
                        <div className="input-with-icon">
                          <Link2 size={16} className="field-icon" />
                          <input
                            type="url"
                            id="profile-linkedin"
                            className="profile-form-input with-icon"
                            value={personalInfo.linkedin}
                            onChange={(e) =>
                              setPersonalInfo((prev) => ({ ...prev, linkedin: e.target.value }))
                            }
                            placeholder="https://linkedin.com/in/username"
                          />
                        </div>
                      </div>

                      <div className="profile-form-group">
                        <label className="profile-form-label" htmlFor="profile-github">
                          GitHub URL
                        </label>
                        <div className="input-with-icon">
                          <Code2 size={16} className="field-icon" />
                          <input
                            type="url"
                            id="profile-github"
                            className="profile-form-input with-icon"
                            value={personalInfo.github}
                            onChange={(e) =>
                              setPersonalInfo((prev) => ({ ...prev, github: e.target.value }))
                            }
                            placeholder="https://github.com/username"
                          />
                        </div>
                      </div>

                      <div className="profile-form-group full-width">
                        <label className="profile-form-label" htmlFor="profile-portfolio">
                          Portfolio / Website cá nhân
                        </label>
                        <div className="input-with-icon">
                          <Globe size={16} className="field-icon" />
                          <input
                            type="url"
                            id="profile-portfolio"
                            className="profile-form-input with-icon"
                            value={personalInfo.portfolio}
                            onChange={(e) =>
                              setPersonalInfo((prev) => ({ ...prev, portfolio: e.target.value }))
                            }
                            placeholder="https://myportfolio.dev"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="profile-form-actions">
                      <button type="submit" className="profile-btn-primary" id="btn-save-profile">
                        <CheckCircle2 size={16} /> Lưu Thông Tin Cá Nhân
                      </button>
                    </div>
                  </form>
                </section>

                {/* 4. HỌC VẤN (EDUCATION) */}
                <section className="profile-card" aria-labelledby="education-title">
                  <div className="profile-card-header flex-between">
                    <div className="flex-align-center gap-12">
                      <div className="profile-card-icon">
                        <GraduationCap size={18} />
                      </div>
                      <div>
                        <h2 id="education-title" className="profile-card-title">
                          Học Vấn &amp; Bằng Cấp
                        </h2>
                        <p className="profile-card-subtitle">
                          Trường đại học, chuyên ngành và lộ trình học tập của bạn
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="profile-btn-secondary btn-sm"
                      onClick={handleOpenAddEdu}
                    >
                      <Plus size={15} /> Thêm Học Vấn
                    </button>
                  </div>

                  {/* Education List */}
                  <div className="education-list-container">
                    {educationList.length === 0 ? (
                      <div className="empty-state-box">
                        <GraduationCap size={32} className="empty-icon" />
                        <p>Chưa có thông tin học vấn nào được thêm.</p>
                        <button
                          type="button"
                          className="profile-btn-primary btn-sm"
                          onClick={handleOpenAddEdu}
                        >
                          <Plus size={14} /> Thêm trường học đầu tiên
                        </button>
                      </div>
                    ) : (
                      educationList.map((item) => (
                        <div key={item.id} className="education-item-card">
                          <div className="edu-card-left">
                            <div className="edu-icon-wrap">
                              <Building size={18} />
                            </div>
                            <div className="edu-details">
                              <h3 className="edu-school-name">{item.school}</h3>
                              <p className="edu-major-degree">
                                <strong>{item.major}</strong> &bull; {item.degree}
                              </p>
                              <div className="edu-meta-row">
                                <span className="edu-years">
                                  {item.startYear} – {item.endYear || 'Hiện tại'}
                                </span>
                                {item.gpa && <span className="edu-gpa">GPA: {item.gpa}</span>}
                                <span
                                  className={`edu-status-badge ${item.status === 'studying' ? 'status-studying' : 'status-graduated'}`}
                                >
                                  {item.status === 'studying' ? 'Đang học' : 'Đã tốt nghiệp'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="edu-card-actions">
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => handleOpenEditEdu(item)}
                              aria-label="Chỉnh sửa học vấn"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon btn-danger-icon"
                              onClick={() => handleDeleteEdu(item.id)}
                              aria-label="Xóa mục học vấn"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* 8. CV CỦA TÔI (MY CVS) */}
                <section className="profile-card" aria-labelledby="my-cvs-title">
                  <div className="profile-card-header flex-between">
                    <div className="flex-align-center gap-12">
                      <div className="profile-card-icon">
                        <FileText size={18} />
                      </div>
                      <div>
                        <h2 id="my-cvs-title" className="profile-card-title">
                          CV Của Tôi
                        </h2>
                        <p className="profile-card-subtitle">
                          Danh sách hồ sơ đã lưu để AI làm bằng chứng kinh nghiệm cụ thể
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="profile-btn-secondary btn-sm"
                      onClick={() => goTo('cv')}
                    >
                      <ExternalLink size={14} /> Đi Tới Quản Lý CV
                    </button>
                  </div>

                  <div className="cv-summary-list">
                    {cvList.map((cv) => (
                      <div
                        key={cv.id}
                        className={`cv-summary-card ${cv.isDefault ? 'is-default' : ''}`}
                      >
                        <div className="cv-summary-left">
                          <div className="cv-icon-wrap">
                            <FileText size={20} />
                          </div>
                          <div>
                            <div className="cv-title-row">
                              <h3 className="cv-title">{cv.title}</h3>
                              {cv.isDefault && (
                                <span className="cv-default-badge">
                                  <Star size={11} fill="currentColor" /> Mặc định
                                </span>
                              )}
                            </div>
                            <div className="cv-meta-row">
                              <span className={`cv-type-badge type-${cv.type}`}>
                                {cv.typeLabel}
                              </span>
                              <span className="cv-date">Cập nhật {cv.updatedAt}</span>
                            </div>
                          </div>
                        </div>

                        <div className="cv-summary-actions">
                          {!cv.isDefault && (
                            <button
                              type="button"
                              className="btn-set-default"
                              onClick={() => handleSetDefaultCV(cv.id)}
                            >
                              Đặt làm mặc định
                            </button>
                          )}
                          <button type="button" className="btn-view-cv" onClick={() => goTo('cv')}>
                            Xem CV
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* --------------------------------------------------------
                TAB 2: ĐỊNH HƯỚNG & KỸ NĂNG
            -------------------------------------------------------- */}
            {activeTab === 'career' && (
              <div className="profile-tab-pane">
                {/* 5. ĐỊNH HƯỚNG NGHỀ NGHIỆP */}
                <section className="profile-card" aria-labelledby="career-orientation-title">
                  <div className="profile-card-header">
                    <div className="profile-card-icon">
                      <Briefcase size={18} />
                    </div>
                    <div>
                      <h2 id="career-orientation-title" className="profile-card-title">
                        Định Hướng Nghề Nghiệp
                      </h2>
                      <p className="profile-card-subtitle">
                        Mục tiêu then chốt để AI hiểu và đề xuất cơ hội việc làm phù hợp
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveAllToLocal();
                      triggerToast('Đã lưu định hướng nghề nghiệp thành công!');
                    }}
                  >
                    <div className="profile-form-grid">
                      {/* Desired Target Role */}
                      <div className="profile-form-group full-width">
                        <label className="profile-form-label" htmlFor="profile-target-role">
                          Vị trí mong muốn <span className="req-star">*</span>
                        </label>
                        <input
                          type="text"
                          id="profile-target-role"
                          className="profile-form-input"
                          value={careerGoals.targetRole}
                          onChange={(e) =>
                            setCareerGoals((prev) => ({ ...prev, targetRole: e.target.value }))
                          }
                          placeholder="Ví dụ: Backend Developer, AI Engineer, Fullstack Web..."
                          required
                        />
                        <span className="profile-form-hint">
                          Trợ lý AI sẽ dùng vị trí này để tối ưu hóa gợi ý việc làm và câu hỏi phỏng
                          vấn
                        </span>
                      </div>

                      {/* Current Career Level */}
                      <div className="profile-form-group">
                        <label className="profile-form-label" htmlFor="career-level-select">
                          Cấp độ hiện tại
                        </label>
                        <select
                          id="career-level-select"
                          className="profile-form-input select-input"
                          value={careerGoals.currentLevel}
                          onChange={(e) =>
                            setCareerGoals((prev) => ({
                              ...prev,
                              currentLevel: e.target.value as CareerGoals['currentLevel'],
                            }))
                          }
                        >
                          <option value="student">🎓 Student (Sinh viên đang học)</option>
                          <option value="intern">🌱 Intern (Thực tập sinh)</option>
                          <option value="fresher">🚀 Fresher (Mới tốt nghiệp &lt; 1 năm)</option>
                          <option value="junior">⚡ Junior (1 – 2 năm kinh nghiệm)</option>
                        </select>
                      </div>

                      {/* Work Mode */}
                      <div className="profile-form-group">
                        <label className="profile-form-label" htmlFor="career-workmode-select">
                          Hình thức làm việc
                        </label>
                        <select
                          id="career-workmode-select"
                          className="profile-form-input select-input"
                          value={careerGoals.workMode}
                          onChange={(e) =>
                            setCareerGoals((prev) => ({
                              ...prev,
                              workMode: e.target.value as CareerGoals['workMode'],
                            }))
                          }
                        >
                          <option value="onsite">🏢 On-site (Tại văn phòng)</option>
                          <option value="hybrid">🔄 Hybrid (Linh hoạt kết hợp)</option>
                          <option value="remote">🌐 Remote (Từ xa hoàn toàn)</option>
                        </select>
                      </div>
                    </div>

                    {/* Desired Locations (Searchable Combobox) */}
                    <div className="profile-form-group full-width mt-12">
                      <label className="profile-form-label" htmlFor="location-combobox-input">
                        Địa điểm mong muốn làm việc
                      </label>
                      <div className="location-combobox-wrap">
                        <div className="selected-locations-row">
                          {careerGoals.desiredLocations.map((loc) => (
                            <span key={loc} className="location-chip">
                              <MapPin size={12} />
                              {loc}
                              <button
                                type="button"
                                onClick={() => handleRemoveLocation(loc)}
                                aria-label={`Xóa địa điểm ${loc}`}
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>

                        <div className="location-input-container">
                          <input
                            type="text"
                            id="location-combobox-input"
                            className="profile-form-input"
                            placeholder="Gõ hoặc chọn tỉnh/thành phố..."
                            value={locationSearchInput}
                            onFocus={() => setShowLocationDropdown(true)}
                            onChange={(e) => {
                              setLocationSearchInput(e.target.value);
                              setShowLocationDropdown(true);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && locationSearchInput.trim()) {
                                e.preventDefault();
                                handleAddLocation(locationSearchInput.trim());
                              }
                            }}
                          />
                          {locationSearchInput && (
                            <button
                              type="button"
                              className="btn-add-inline"
                              onClick={() => handleAddLocation(locationSearchInput)}
                            >
                              Thêm
                            </button>
                          )}
                        </div>

                        {/* Searchable Dropdown Suggestions */}
                        {showLocationDropdown && (
                          <div className="location-dropdown-menu">
                            <span className="dropdown-title">Gợi ý địa điểm phổ biến:</span>
                            <div className="dropdown-options-grid">
                              {VIETNAM_LOCATIONS.filter(
                                (loc) =>
                                  loc.toLowerCase().includes(locationSearchInput.toLowerCase()) &&
                                  !careerGoals.desiredLocations.includes(loc),
                              ).map((loc) => (
                                <button
                                  key={loc}
                                  type="button"
                                  className="dropdown-option-btn"
                                  onClick={() => handleAddLocation(loc)}
                                >
                                  <MapPin size={12} /> {loc}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="dropdown-close-btn"
                              onClick={() => setShowLocationDropdown(false)}
                            >
                              Đóng gợi ý
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Domains / Interests */}
                    <div className="profile-form-group full-width mt-12">
                      <label className="profile-form-label">
                        Lĩnh vực quan tâm (Industry / Domain)
                      </label>
                      <div className="domain-chips-grid">
                        {POPULAR_DOMAINS.map((domain) => {
                          const isSelected = careerGoals.interests.includes(domain);
                          return (
                            <button
                              key={domain}
                              type="button"
                              className={`domain-selectable-chip ${isSelected ? 'selected' : ''}`}
                              onClick={() => {
                                setCareerGoals((prev) => ({
                                  ...prev,
                                  interests: isSelected
                                    ? prev.interests.filter((i) => i !== domain)
                                    : [...prev.interests, domain],
                                }));
                                setTimeout(saveAllToLocal, 100);
                              }}
                            >
                              {isSelected && <Check size={12} />}
                              {domain}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="profile-form-actions">
                      <button type="submit" className="profile-btn-primary">
                        <CheckCircle2 size={16} /> Lưu Định Hướng Nghề Nghiệp
                      </button>
                    </div>
                  </form>
                </section>

                {/* 6. KỸ NĂNG (SKILLS) */}
                <section className="profile-card" aria-labelledby="skills-title">
                  <div className="profile-card-header flex-between">
                    <div className="flex-align-center gap-12">
                      <div className="profile-card-icon">
                        <Layers size={18} />
                      </div>
                      <div>
                        <h2 id="skills-title" className="profile-card-title">
                          Kỹ Năng Chuyên Môn
                        </h2>
                        <p className="profile-card-subtitle">
                          Kỹ năng kỹ thuật và công cụ dưới dạng Tag Chips (không tự chấm điểm %)
                        </p>
                      </div>
                    </div>
                    <span className="skills-counter-badge">{skills.length} kỹ năng</span>
                  </div>

                  {/* Add Skill Input Form */}
                  <div className="skill-input-row">
                    <div className="skill-input-wrapper">
                      <Search size={16} className="skill-input-icon" />
                      <input
                        type="text"
                        className="profile-form-input with-icon"
                        placeholder="Nhập tên kỹ năng (ví dụ: Docker, React, PyTorch) rồi nhấn Enter..."
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSkill(skillInput);
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="profile-btn-primary"
                      onClick={() => handleAddSkill(skillInput)}
                    >
                      <Plus size={16} /> Thêm
                    </button>
                  </div>

                  {/* Current Active Skill Chips */}
                  <div className="skills-chips-cloud" aria-label="Danh sách kỹ năng hiện tại">
                    {skills.length === 0 ? (
                      <p className="no-skills-text">
                        Chưa có kỹ năng nào. Hãy nhập kỹ năng hoặc chọn nhanh từ danh mục dưới đây.
                      </p>
                    ) : (
                      skills.map((skill) => (
                        <span key={skill} className="skill-tag-chip">
                          <span className="skill-chip-text">{skill}</span>
                          <button
                            type="button"
                            className="skill-chip-remove"
                            onClick={() => handleRemoveSkill(skill)}
                            aria-label={`Xóa kỹ năng ${skill}`}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Popular Suggested Skills Catalog */}
                  <div className="suggested-skills-panel">
                    <span className="suggested-title">
                      Gợi ý kỹ năng phổ biến cho sinh viên IT:
                    </span>
                    <div className="suggested-chips-wrap">
                      {DEFAULT_POPULAR_SKILLS.filter(
                        (s) => !skills.some((curr) => curr.toLowerCase() === s.toLowerCase()),
                      ).map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="suggested-chip-btn"
                          onClick={() => handleAddSkill(s)}
                        >
                          <Plus size={12} /> {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* 7. NGÔN NGỮ (LANGUAGES) */}
                <section className="profile-card" aria-labelledby="languages-title">
                  <div className="profile-card-header flex-between">
                    <div className="flex-align-center gap-12">
                      <div className="profile-card-icon">
                        <Languages size={18} />
                      </div>
                      <div>
                        <h2 id="languages-title" className="profile-card-title">
                          Ngôn Ngữ
                        </h2>
                        <p className="profile-card-subtitle">
                          Khai báo ngoại ngữ và trình độ giao tiếp thực tế
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="profile-btn-secondary btn-sm"
                      onClick={() => setLangModalOpen(true)}
                    >
                      <Plus size={14} /> Thêm Ngôn Ngữ
                    </button>
                  </div>

                  <div className="languages-list-grid">
                    {languages.map((item) => (
                      <div key={item.id} className="language-badge-card">
                        <div className="lang-info">
                          <strong className="lang-name">{item.language}</strong>
                          <span className="lang-level">{item.proficiency}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-icon btn-danger-icon"
                          onClick={() => handleDeleteLanguage(item.id)}
                          aria-label={`Xóa ngôn ngữ ${item.language}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 9. AI CAREER PREFERENCES */}
                <section className="profile-card" aria-labelledby="ai-prefs-title">
                  <div className="profile-card-header">
                    <div className="profile-card-icon">
                      <Sliders size={18} />
                    </div>
                    <div>
                      <h2 id="ai-prefs-title" className="profile-card-title">
                        Kiểm Soát AI (AI Career Preferences)
                      </h2>
                      <p className="profile-card-subtitle">
                        Thiết lập cách Trợ lý AI đồng hành và hỗ trợ sự nghiệp của bạn
                      </p>
                    </div>
                  </div>

                  <div className="ai-preferences-content">
                    {/* Consent Grounding Switch */}
                    <div className="ai-consent-toggle-card">
                      <div className="consent-toggle-info">
                        <div className="consent-title-row">
                          <Bot size={18} className="consent-icon" />
                          <strong>Sử dụng Profile làm dữ liệu nền tảng cho AI</strong>
                        </div>
                        <p className="consent-desc">
                          Cho phép AI đọc thông tin học vấn, kỹ năng và định hướng ở trên để tự động
                          cá nhân hóa câu hỏi phỏng vấn và gợi ý công việc.
                        </p>
                      </div>
                      <label className="switch-toggle" aria-label="Bật/tắt dữ liệu nền AI">
                        <input
                          type="checkbox"
                          checked={aiPreferences.allowAiProfileGrounding}
                          onChange={(e) => {
                            setAiPreferences((prev) => ({
                              ...prev,
                              allowAiProfileGrounding: e.target.checked,
                            }));
                            triggerToast(
                              e.target.checked
                                ? 'Đã bật dữ liệu nền Profile cho AI.'
                                : 'Đã tắt dữ liệu nền Profile cho AI.',
                            );
                            setTimeout(saveAllToLocal, 100);
                          }}
                        />
                        <span className="slider-round" />
                      </label>
                    </div>

                    {/* AI Persona Selector */}
                    <div className="ai-persona-section">
                      <label className="profile-form-label">
                        Phong cách Trợ lý AI (AI Persona)
                      </label>
                      <div className="profile-persona-list">
                        <button
                          type="button"
                          className={`profile-persona-option persona-btn ${aiPreferences.aiPersona === 'mentor' ? 'active' : ''}`}
                          data-persona="mentor"
                          onClick={() => {
                            setAiPreferences((prev) => ({ ...prev, aiPersona: 'mentor' }));
                            localStorage.setItem('ai_persona', 'mentor');
                            triggerToast('Đã chọn phong cách: Friendly Mentor 🎓');
                            setTimeout(saveAllToLocal, 100);
                          }}
                        >
                          <div className="profile-persona-icon-wrap">🎓</div>
                          <div className="profile-persona-body">
                            <div className="profile-persona-title">
                              <span>Friendly Mentor</span>
                              {aiPreferences.aiPersona === 'mentor' && (
                                <span className="profile-persona-active-tag">Đang dùng</span>
                              )}
                            </div>
                            <p className="profile-persona-desc">
                              Tư vấn ân cần, giải thích cặn kẽ từng bước và liên tục khích lệ sự tự
                              tin của sinh viên.
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          className={`profile-persona-option persona-btn ${aiPreferences.aiPersona === 'recruiter' ? 'active' : ''}`}
                          data-persona="recruiter"
                          onClick={() => {
                            setAiPreferences((prev) => ({ ...prev, aiPersona: 'recruiter' }));
                            localStorage.setItem('ai_persona', 'recruiter');
                            triggerToast('Đã chọn phong cách: Strict Recruiter 🤖');
                            setTimeout(saveAllToLocal, 100);
                          }}
                        >
                          <div className="profile-persona-icon-wrap">🤖</div>
                          <div className="profile-persona-body">
                            <div className="profile-persona-title">
                              <span>Strict Recruiter</span>
                              {aiPreferences.aiPersona === 'recruiter' && (
                                <span className="profile-persona-active-tag">Đang dùng</span>
                              )}
                            </div>
                            <p className="profile-persona-desc">
                              Đánh giá theo chuẩn ATS quốc tế khắt khe, tập trung vào từ khóa và
                              bằng chứng định lượng.
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          className={`profile-persona-option persona-btn ${aiPreferences.aiPersona === 'techlead' ? 'active' : ''}`}
                          data-persona="techlead"
                          onClick={() => {
                            setAiPreferences((prev) => ({ ...prev, aiPersona: 'techlead' }));
                            localStorage.setItem('ai_persona', 'techlead');
                            triggerToast('Đã chọn phong cách: Technical Lead ⚡');
                            setTimeout(saveAllToLocal, 100);
                          }}
                        >
                          <div className="profile-persona-icon-wrap">⚡</div>
                          <div className="profile-persona-body">
                            <div className="profile-persona-title">
                              <span>Technical Lead</span>
                              {aiPreferences.aiPersona === 'techlead' && (
                                <span className="profile-persona-active-tag">Đang dùng</span>
                              )}
                            </div>
                            <p className="profile-persona-desc">
                              Phỏng vấn sâu kiến trúc kỹ thuật, tư duy giải quyết vấn đề và chất
                              lượng mã nguồn.
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* --------------------------------------------------------
                TAB 3: TÀI KHOẢN & BẢO MẬT
            -------------------------------------------------------- */}
            {activeTab === 'security' && (
              <div className="profile-tab-pane">
                {/* 10. ACCOUNT & SECURITY */}
                <section className="profile-card" aria-labelledby="security-title">
                  <div className="profile-card-header">
                    <div className="profile-card-icon">
                      <Lock size={18} />
                    </div>
                    <div>
                      <h2 id="security-title" className="profile-card-title">
                        Bảo Mật &amp; Đổi Mật Khẩu
                      </h2>
                      <p className="profile-card-subtitle">
                        Bảo vệ an toàn cho tài khoản và dữ liệu cá nhân của bạn
                      </p>
                    </div>
                  </div>

                  <form id="profile-password-form" onSubmit={handleChangePassword}>
                    <div className="profile-form-grid">
                      <div className="profile-form-group">
                        <label className="profile-form-label" htmlFor="profile-current-password">
                          Mật khẩu hiện tại <span className="req-star">*</span>
                        </label>
                        <input
                          type="password"
                          id="profile-current-password"
                          className="profile-form-input"
                          placeholder="••••••••"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          autoComplete="current-password"
                          required
                        />
                      </div>

                      <div className="profile-form-group">
                        <label className="profile-form-label" htmlFor="profile-new-password">
                          Mật khẩu mới <span className="req-star">*</span>
                        </label>
                        <input
                          type="password"
                          id="profile-new-password"
                          className="profile-form-input"
                          placeholder="Tối thiểu 6 ký tự"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                          required
                        />
                      </div>

                      <div className="profile-form-group">
                        <label className="profile-form-label" htmlFor="profile-confirm-password">
                          Xác nhận mật khẩu mới <span className="req-star">*</span>
                        </label>
                        <input
                          type="password"
                          id="profile-confirm-password"
                          className="profile-form-input"
                          placeholder="Nhập lại mật khẩu mới"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          required
                        />
                      </div>
                    </div>

                    <div className="profile-form-actions">
                      <button
                        type="submit"
                        className="profile-btn-primary"
                        id="btn-change-password"
                      >
                        <Shield size={16} /> Đổi Mật Khẩu
                      </button>
                    </div>
                  </form>
                </section>

                {/* COUNSELOR ACCESS CONSENT */}
                <section
                  className="profile-card"
                  id="student-counselor-consent-panel"
                  aria-labelledby="counselor-title"
                >
                  <div className="profile-card-header">
                    <div className="profile-card-icon">
                      <Users size={18} />
                    </div>
                    <div>
                      <h2 id="counselor-title" className="profile-card-title">
                        Cố Vấn Đồng Hành (University Counselor)
                      </h2>
                      <p className="profile-card-subtitle">
                        Cho phép Cố vấn chuyên môn của trường xem hồ sơ và tiến độ phỏng vấn để nhận
                        góp ý
                      </p>
                    </div>
                  </div>

                  <div id="student-counselor-consent-list" className="profile-counselor-list">
                    {counselors.length === 0 ? (
                      <p className="profile-form-hint">Bạn chưa cấp quyền cho cố vấn nào.</p>
                    ) : (
                      counselors.map((c) => (
                        <div key={c.id} className="profile-counselor-item">
                          <div className="profile-counselor-info">
                            <span className="profile-counselor-name">Cố vấn đại học</span>
                            <span className="profile-counselor-email">{c.email}</span>
                          </div>
                          <button
                            type="button"
                            className="profile-btn-revoke"
                            onClick={() => handleRevokeCounselor(c.id)}
                          >
                            Thu hồi
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <form id="student-counselor-consent-form" onSubmit={handleGrantCounselor}>
                    <label className="profile-form-label" htmlFor="student-counselor-email">
                      Cấp quyền cho Cố vấn mới
                    </label>
                    <div className="counselor-add-row">
                      <input
                        type="email"
                        id="student-counselor-email"
                        className="profile-form-input"
                        placeholder="email.covan@truong.edu.vn"
                        value={counselorEmail}
                        onChange={(e) => setCounselorEmail(e.target.value)}
                        required
                      />
                      <button type="submit" className="profile-btn-primary whitespace-nowrap">
                        Cấp Quyền
                      </button>
                    </div>
                  </form>
                </section>

                {/* DANGER ZONE */}
                <section className="profile-card danger-zone-card" aria-labelledby="danger-title">
                  <div className="profile-card-header">
                    <div className="profile-card-icon danger-icon">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <h2 id="danger-title" className="profile-card-title danger-text">
                        Vùng Nguy Hiểm (Danger Zone)
                      </h2>
                      <p className="profile-card-subtitle">
                        Các hành động không thể hoàn tác với tài khoản và dữ liệu của bạn
                      </p>
                    </div>
                  </div>

                  <div className="danger-zone-actions">
                    <div className="danger-action-item">
                      <div>
                        <strong>Xóa toàn bộ dữ liệu Profile</strong>
                        <p className="danger-sub">
                          Đặt lại toàn bộ học vấn, kỹ năng, định hướng nghề nghiệp về mặc định.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-danger-outline"
                        onClick={() => {
                          if (
                            window.confirm(
                              'Bạn có chắc chắn muốn xóa toàn bộ thông tin Profile đã lưu không?',
                            )
                          ) {
                            localStorage.removeItem('candidate_profile_data');
                            setSkills([]);
                            setLanguages([]);
                            triggerToast('Đã làm mới dữ liệu Profile.');
                          }
                        }}
                      >
                        Xóa dữ liệu
                      </button>
                    </div>

                    <div className="danger-action-item">
                      <div>
                        <strong>Đăng xuất tài khoản</strong>
                        <p className="danger-sub">
                          Kết thúc phiên làm việc hiện tại trên thiết bị này.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="profile-btn-secondary"
                        onClick={() => {
                          if (typeof window !== 'undefined' && (window as any).ApiClient) {
                            (window as any).ApiClient.logout();
                          }
                          window.location.reload();
                        }}
                      >
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ============================================================
          MODAL: THÊM / CHỈNH SỬA HỌC VẤN
      ============================================================ */}
      {eduModalOpen && (
        <div
          className="profile-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edu-modal-title"
        >
          <div className="profile-modal-card">
            <div className="profile-modal-header">
              <h3 id="edu-modal-title">
                {editingEduId ? 'Chỉnh Sửa Học Vấn' : 'Thêm Trường Học / Bằng Cấp'}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEduModalOpen(false)}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdu}>
              <div className="profile-modal-body">
                <div className="profile-form-group">
                  <label className="profile-form-label" htmlFor="modal-edu-school">
                    Tên trường đại học / học viện <span className="req-star">*</span>
                  </label>
                  <input
                    type="text"
                    id="modal-edu-school"
                    className="profile-form-input"
                    placeholder="Ví dụ: Đại học Công nghệ Thông tin - ĐHQG-HCM"
                    value={eduForm.school}
                    onChange={(e) => setEduForm((prev) => ({ ...prev, school: e.target.value }))}
                    required
                  />
                </div>

                <div className="profile-form-grid">
                  <div className="profile-form-group">
                    <label className="profile-form-label" htmlFor="modal-edu-major">
                      Chuyên ngành đào tạo <span className="req-star">*</span>
                    </label>
                    <input
                      type="text"
                      id="modal-edu-major"
                      className="profile-form-input"
                      placeholder="Ví dụ: Kỹ thuật Phần mềm, CNTT"
                      value={eduForm.major}
                      onChange={(e) => setEduForm((prev) => ({ ...prev, major: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="profile-form-group">
                    <label className="profile-form-label" htmlFor="modal-edu-degree">
                      Bằng cấp
                    </label>
                    <select
                      id="modal-edu-degree"
                      className="profile-form-input select-input"
                      value={eduForm.degree}
                      onChange={(e) => setEduForm((prev) => ({ ...prev, degree: e.target.value }))}
                    >
                      <option value="Cử nhân">Cử nhân (Bachelor)</option>
                      <option value="Kỹ sư">Kỹ sư (Engineer)</option>
                      <option value="Thạc sĩ">Thạc sĩ (Master)</option>
                      <option value="Cao đẳng">Cao đẳng (Associate)</option>
                      <option value="Chứng chỉ">Chứng chỉ chuyên nghiệp</option>
                    </select>
                  </div>

                  <div className="profile-form-group">
                    <label className="profile-form-label" htmlFor="modal-edu-start">
                      Năm bắt đầu
                    </label>
                    <input
                      type="number"
                      id="modal-edu-start"
                      className="profile-form-input"
                      placeholder="2023"
                      value={eduForm.startYear}
                      onChange={(e) =>
                        setEduForm((prev) => ({ ...prev, startYear: e.target.value }))
                      }
                    />
                  </div>

                  <div className="profile-form-group">
                    <label className="profile-form-label" htmlFor="modal-edu-end">
                      Năm tốt nghiệp (dự kiến)
                    </label>
                    <input
                      type="number"
                      id="modal-edu-end"
                      className="profile-form-input"
                      placeholder="2027"
                      value={eduForm.endYear}
                      onChange={(e) => setEduForm((prev) => ({ ...prev, endYear: e.target.value }))}
                    />
                  </div>

                  <div className="profile-form-group">
                    <label className="profile-form-label" htmlFor="modal-edu-gpa">
                      GPA <span className="optional-tag">Tùy chọn</span>
                    </label>
                    <input
                      type="text"
                      id="modal-edu-gpa"
                      className="profile-form-input"
                      placeholder="Ví dụ: 3.6 / 4.0 hoặc 8.5 / 10"
                      value={eduForm.gpa}
                      onChange={(e) => setEduForm((prev) => ({ ...prev, gpa: e.target.value }))}
                    />
                  </div>

                  <div className="profile-form-group">
                    <label className="profile-form-label" htmlFor="modal-edu-status">
                      Trạng thái
                    </label>
                    <select
                      id="modal-edu-status"
                      className="profile-form-input select-input"
                      value={eduForm.status}
                      onChange={(e) =>
                        setEduForm((prev) => ({
                          ...prev,
                          status: e.target.value as EducationItem['status'],
                        }))
                      }
                    >
                      <option value="studying">Đang học</option>
                      <option value="graduated">Đã tốt nghiệp</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="profile-modal-footer">
                <button
                  type="button"
                  className="profile-btn-secondary"
                  onClick={() => setEduModalOpen(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="profile-btn-primary">
                  <CheckCircle2 size={16} /> Lưu Học Vấn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: THÊM NGÔN NGỮ
      ============================================================ */}
      {langModalOpen && (
        <div
          className="profile-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lang-modal-title"
        >
          <div className="profile-modal-card">
            <div className="profile-modal-header">
              <h3 id="lang-modal-title">Thêm Ngôn Ngữ Mới</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setLangModalOpen(false)}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLanguage}>
              <div className="profile-modal-body">
                <div className="profile-form-group">
                  <label className="profile-form-label" htmlFor="modal-lang-name">
                    Tên ngôn ngữ <span className="req-star">*</span>
                  </label>
                  <input
                    type="text"
                    id="modal-lang-name"
                    className="profile-form-input"
                    placeholder="Ví dụ: Tiếng Anh, Tiếng Nhật, Tiếng Hàn..."
                    value={langForm.language}
                    onChange={(e) => setLangForm((prev) => ({ ...prev, language: e.target.value }))}
                    required
                  />
                </div>

                <div className="profile-form-group">
                  <label className="profile-form-label" htmlFor="modal-lang-prof">
                    Trình độ thông thạo
                  </label>
                  <select
                    id="modal-lang-prof"
                    className="profile-form-input select-input"
                    value={langForm.proficiency}
                    onChange={(e) =>
                      setLangForm((prev) => ({ ...prev, proficiency: e.target.value }))
                    }
                  >
                    <option value="Bản ngữ">Bản ngữ (Native)</option>
                    <option value="Thành thạo (C1 - C2)">Thành thạo (C1 - C2)</option>
                    <option value="Intermediate (B2)">Trung cấp (Intermediate / B2)</option>
                    <option value="Sơ cấp (A1 - A2)">Sơ cấp (Basic / A1 - A2)</option>
                    <option value="Giao tiếp cơ bản">Giao tiếp công việc cơ bản</option>
                  </select>
                </div>
              </div>

              <div className="profile-modal-footer">
                <button
                  type="button"
                  className="profile-btn-secondary"
                  onClick={() => setLangModalOpen(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="profile-btn-primary">
                  <CheckCircle2 size={16} /> Thêm Ngôn Ngữ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
