/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  MapPin,
  Clock,
  BookOpen,
  Users,
  Shield,
  Lock,
  Bell,
  Edit3,
  Award,
  Save,
  ExternalLink,
} from 'lucide-react';
import { CounselorTab } from './CounselorNavbar';
import CounselorToast, { ToastMessage } from './CounselorToast';

export interface CounselorProfileData {
  fullName: string;
  academicTitle: string; // TS., ThS., PGS.TS, GS.TS
  faculty: string;
  department: string;
  workEmail: string;
  phoneExt: string;
  officeLocation: string;
  roleTitle: string;
  assignedStudentsCount: number;
  activeCohorts: string[];
  specializations: string[];
  officeHours: string;
  bio: string;
  notificationPreferences: {
    emailOnNewCV: boolean;
    emailOnMatchAlert: boolean;
    emailOnInternshipReport: boolean;
    weeklySummaryDigest: boolean;
  };
}

const DEFAULT_COUNSELOR_PROFILE: CounselorProfileData = {
  fullName: 'TS. Nguyễn Trần Duy Minh',
  academicTitle: 'Tiến sĩ',
  faculty: 'Khoa Khoa học & Kỹ thuật Máy tính',
  department: 'Bộ môn Công nghệ Phần mềm',
  workEmail: 'minh.nguyen@hcmut.edu.vn',
  phoneExt: '+84 (28) 3865 4321 (Ext: 5824)',
  officeLocation: 'Phòng 304 - Tòa nhà H6, Cơ sở Dĩ An',
  roleTitle: 'Cố vấn học tập & Hướng nghiệp',
  assignedStudentsCount: 48,
  activeCohorts: ['K18 (2022-2026)', 'K19 (2023-2027)'],
  specializations: ['Kỹ thuật phần mềm', 'Kiến trúc Cloud & AI', 'Hướng nghiệp IT', 'Chuẩn bị phỏng vấn STAR'],
  officeHours: 'Thứ 3 & Thứ 5 (14:00 - 16:30)',
  bio: 'Cố vấn chuyên môn khối ngành Kỹ thuật Phần mềm với hơn 10 năm kinh nghiệm giảng dạy, nghiên cứu và kết nối doanh nghiệp công nghệ.',
  notificationPreferences: {
    emailOnNewCV: true,
    emailOnMatchAlert: true,
    emailOnInternshipReport: true,
    weeklySummaryDigest: true,
  },
};

import { CounselorApi } from '@/lib/api/counselorApi';

interface CounselorProfileProps {
  initialTab?: 'profile' | 'responsibility' | 'settings';
  onNavigate?: (tab: CounselorTab, params?: any) => void;
}

export default function CounselorProfile({
  initialTab = 'profile',
  onNavigate,
}: CounselorProfileProps) {
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'responsibility' | 'settings'>(initialTab);
  const [profile, setProfile] = useState<CounselorProfileData>(DEFAULT_COUNSELOR_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const data = await CounselorApi.getProfile();
        if (data && isMounted) {
          setProfile(data);
        }
      } catch (e) {
        console.error('Không thể nạp dữ liệu hồ sơ cố vấn từ API:', e);
      } finally {
        // Defaults remain available when the profile API cannot be reached.
      }
    };
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setActiveSubTab(initialTab);
  }, [initialTab]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await CounselorApi.updateProfile({
        full_name: profile.fullName,
        academic_title: profile.academicTitle,
        faculty: profile.faculty,
        department: profile.department,
        phone_ext: profile.phoneExt,
        office_location: profile.officeLocation,
        role_title: profile.roleTitle,
        active_cohorts: profile.activeCohorts,
        specializations: profile.specializations,
        office_hours: profile.officeHours,
        bio: profile.bio,
        notification_preferences: profile.notificationPreferences,
      });
      setProfile(updated);
      setIsEditing(false);
      setToast({
        message: 'Đã lưu thông tin hồ sơ cố vấn thành công vào hệ thống!',
        type: 'success',
      });
      setTimeout(() => setToast(null), 3500);
    } catch {
      setToast({
        message: 'Có lỗi xảy ra khi lưu thông tin.',
        type: 'error',
      });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setToast({ message: 'Vui lòng nhập mật khẩu hiện tại.', type: 'error' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setToast({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ message: 'Mật khẩu xác nhận không trùng khớp.', type: 'error' });
      return;
    }

    setIsChangingPassword(true);
    try {
      if (typeof window !== 'undefined' && (window as any).ApiClient?.request) {
        await (window as any).ApiClient.request('/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        });
      }
      setToast({ message: 'Đổi mật khẩu thành công!', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setToast({ message: err.message || 'Không thể đổi mật khẩu.', type: 'error' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="counselor-profile-wrapper antialiased" data-testid="counselor-profile">
      {/* ── HEADER / HERO CARD ── */}
      <header className="counselor-profile-card">
        <div className="counselor-profile-header-row">
          {/* Core Info */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl font-bold text-[#171d19] dark:text-white truncate">
                {profile.fullName}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#059669] dark:bg-emerald-950/50 dark:text-emerald-400 border border-[#059669]/20 shrink-0">
                <Award size={13} /> {profile.roleTitle}
              </span>
            </div>

            <p className="text-xs sm:text-sm font-medium text-[#475569] dark:text-slate-400 flex flex-wrap items-center gap-2">
              <span>{profile.academicTitle}</span>
              <span>•</span>
              <span>{profile.faculty}</span>
              <span>•</span>
              <span className="text-[#006948] dark:text-emerald-400 font-semibold">{profile.department}</span>
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748B] dark:text-slate-400 pt-0.5">
              <span className="flex items-center gap-1.5">
                <Mail size={13} /> {profile.workEmail}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={13} /> {profile.officeLocation}
              </span>
            </div>
          </div>

          {/* Header Actions */}
          <div className="counselor-profile-header-actions shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`w-full sm:w-auto h-11 px-5 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                isEditing
                  ? 'bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-slate-300 hover:bg-slate-200 border border-[#CBD5E1]'
                  : 'bg-[#006948] text-white hover:bg-[#047857] shadow-xs'
              }`}
            >
              <Edit3 size={15} />
              <span>{isEditing ? 'Hủy chỉnh sửa' : 'Chỉnh sửa hồ sơ'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── NAVIGATION TABS ── */}
      <nav
        className="counselor-profile-tabs"
        aria-label="Phân mục Hồ sơ Cố vấn"
      >
        <button
          type="button"
          onClick={() => setActiveSubTab('profile')}
          className={`counselor-profile-tab ${activeSubTab === 'profile' ? 'active' : ''}`}
        >
          <User size={16} />
          <span>Thông tin cá nhân &amp; Nghiệp vụ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('responsibility')}
          className={`counselor-profile-tab ${activeSubTab === 'responsibility' ? 'active' : ''}`}
        >
          <Users size={16} />
          <span>Phân công &amp; Sinh viên ({profile.assignedStudentsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('settings')}
          className={`counselor-profile-tab ${activeSubTab === 'settings' ? 'active' : ''}`}
        >
          <Shield size={16} />
          <span>Cài đặt &amp; Bảo mật</span>
        </button>
      </nav>

      {/* ── TAB 1: THÔNG TIN CÁ NHÂN & NGHIỆP VỤ ── */}
      {activeSubTab === 'profile' && (
        <div className="counselor-profile-grid-2col grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
          {/* Left Column: Quick Stats & Office Hours */}
          <aside className="lg:col-span-4 space-y-6 w-full">
            <div className="counselor-profile-card space-y-4">
              <h2 className="text-sm font-bold text-[#171d19] dark:text-white flex items-center gap-2">
                <Clock size={16} className="text-[#006948] dark:text-emerald-400" />
                <span>Lịch tiếp sinh viên</span>
              </h2>
              <div className="p-4 bg-[#F8FAFC] dark:bg-slate-800/60 rounded-lg border border-[#E2E8F0] dark:border-slate-700/60 text-xs text-[#475569] dark:text-slate-300 space-y-2">
                <p className="font-semibold text-[#171d19] dark:text-white text-sm">{profile.officeHours}</p>
                <p className="text-[#64748B] dark:text-slate-400">Địa điểm: {profile.officeLocation}</p>
                <p className="text-[#006948] dark:text-emerald-400 font-medium">Số máy nội bộ: {profile.phoneExt}</p>
              </div>
            </div>

            <div className="counselor-profile-card space-y-4">
              <h2 className="text-sm font-bold text-[#171d19] dark:text-white flex items-center gap-2">
                <BookOpen size={16} className="text-[#006948] dark:text-emerald-400" />
                <span>Lĩnh vực chuyên môn</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.specializations.map((spec, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F1F5F9] dark:bg-slate-800 text-[#334155] dark:text-slate-300 border border-[#CBD5E1]/60 dark:border-slate-700"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          </aside>

          {/* Right Column: Detailed Form */}
          <main className="lg:col-span-8 w-full">
            <form onSubmit={handleSaveProfile} className="counselor-profile-card space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E2E8F0] dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-[#171d19] dark:text-white">
                    Thông tin công tác Cố vấn
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                    Thông tin phục vụ công tác hướng nghiệp và phân công quản lý sinh viên.
                  </p>
                </div>
                {isEditing && (
                  <button
                    type="submit"
                    className="h-11 px-5 bg-[#006948] text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#047857] transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer shrink-0"
                  >
                    <Save size={15} />
                    <span>Lưu thay đổi</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="counselor-profile-field">
                  <label className="counselor-profile-label">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={profile.fullName}
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    className="counselor-profile-input"
                  />
                </div>

                <div className="counselor-profile-field">
                  <label className="counselor-profile-label">
                    Học hàm / Học vị
                  </label>
                  <select
                    disabled={!isEditing}
                    value={profile.academicTitle}
                    onChange={(e) => setProfile({ ...profile, academicTitle: e.target.value })}
                    className="counselor-profile-select"
                  >
                    <option value="Cử nhân">Cử nhân / Kỹ sư</option>
                    <option value="Thạc sĩ">Thạc sĩ</option>
                    <option value="Tiến sĩ">Tiến sĩ</option>
                    <option value="Phó Giáo sư, Tiến sĩ">Phó Giáo sư, Tiến sĩ</option>
                    <option value="Giáo sư, Tiến sĩ">Giáo sư, Tiến sĩ</option>
                  </select>
                </div>

                <div className="counselor-profile-field">
                  <label className="counselor-profile-label">
                    Khoa / Đơn vị
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={profile.faculty}
                    onChange={(e) => setProfile({ ...profile, faculty: e.target.value })}
                    className="counselor-profile-input"
                  />
                </div>

                <div className="counselor-profile-field">
                  <label className="counselor-profile-label">
                    Bộ môn
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={profile.department}
                    onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                    className="counselor-profile-input"
                  />
                </div>

                <div className="counselor-profile-field">
                  <label className="counselor-profile-label">
                    Email công việc
                  </label>
                  <input
                    type="email"
                    disabled={!isEditing}
                    value={profile.workEmail}
                    onChange={(e) => setProfile({ ...profile, workEmail: e.target.value })}
                    className="counselor-profile-input"
                  />
                </div>

                <div className="counselor-profile-field">
                  <label className="counselor-profile-label">
                    Số máy nội bộ / Điện thoại
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={profile.phoneExt}
                    onChange={(e) => setProfile({ ...profile, phoneExt: e.target.value })}
                    className="counselor-profile-input"
                  />
                </div>

                <div className="md:col-span-2 counselor-profile-field">
                  <label className="counselor-profile-label">
                    Văn phòng làm việc
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={profile.officeLocation}
                    onChange={(e) => setProfile({ ...profile, officeLocation: e.target.value })}
                    className="counselor-profile-input"
                  />
                </div>

                <div className="md:col-span-2 counselor-profile-field">
                  <label className="counselor-profile-label">
                    Giờ tiếp sinh viên
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={profile.officeHours}
                    onChange={(e) => setProfile({ ...profile, officeHours: e.target.value })}
                    className="counselor-profile-input"
                  />
                </div>

                <div className="md:col-span-2 counselor-profile-field">
                  <label className="counselor-profile-label">
                    Giới thiệu / Lời nhắn tới sinh viên
                  </label>
                  <textarea
                    rows={3}
                    disabled={!isEditing}
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="counselor-profile-textarea"
                  />
                </div>
              </div>
            </form>
          </main>
        </div>
      )}

      {/* ── TAB 2: PHÂN CÔNG & SINH VIÊN ── */}
      {activeSubTab === 'responsibility' && (
        <div className="counselor-profile-card space-y-6 w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0] dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-[#171d19] dark:text-white">
                Danh sách Khóa &amp; Sinh viên phụ trách
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                Tổng cộng <strong>{profile.assignedStudentsCount}</strong> sinh viên thuộc phân công hướng nghiệp năm học 2025-2026.
              </p>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('students')}
                className="h-11 px-5 bg-[#006948] text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#047857] transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <span>Xem danh sách sinh viên</span>
                <ExternalLink size={14} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {profile.activeCohorts.map((cohort, i) => (
              <div
                key={i}
                className="p-5 rounded-xl border border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/40 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#171d19] dark:text-white">{cohort}</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full">
                    24 SV
                  </span>
                </div>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Chuyên ngành: Kỹ thuật phần mềm, CNTT
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: CÀI ĐẶT & BẢO MẬT ── */}
      {activeSubTab === 'settings' && (
        <div className="counselor-profile-grid-2col grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
          {/* Change Password Card */}
          <div className="counselor-profile-card space-y-5 w-full">
            <div className="pb-4 border-b border-[#E2E8F0] dark:border-slate-800">
              <h2 className="text-base font-bold text-[#171d19] dark:text-white flex items-center gap-2">
                <Lock size={16} className="text-[#006948] dark:text-emerald-400" />
                <span>Đổi mật khẩu</span>
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                Bảo vệ tài khoản Cố vấn viên với mật khẩu mạnh.
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 text-sm">
              <div className="counselor-profile-field">
                <label className="counselor-profile-label">
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  className="counselor-profile-input"
                />
              </div>

              <div className="counselor-profile-field">
                <label className="counselor-profile-label">
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="counselor-profile-input"
                />
              </div>

              <div className="counselor-profile-field">
                <label className="counselor-profile-label">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="counselor-profile-input"
                />
              </div>

              <button
                type="submit"
                disabled={isChangingPassword}
                className="w-full h-11 bg-[#006948] text-white font-semibold rounded-lg text-sm hover:bg-[#047857] transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-xs"
              >
                {isChangingPassword ? 'Đang xử lý…' : 'Cập nhật mật khẩu'}
              </button>
            </form>
          </div>

          {/* Notification Preferences Card */}
          <div className="counselor-profile-card space-y-5 w-full">
            <div className="pb-4 border-b border-[#E2E8F0] dark:border-slate-800">
              <h2 className="text-base font-bold text-[#171d19] dark:text-white flex items-center gap-2">
                <Bell size={16} className="text-[#006948] dark:text-emerald-400" />
                <span>Tùy chọn thông báo</span>
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                Nhận email cập nhật tiến độ sinh viên và cảnh báo tuyển dụng.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  key: 'emailOnNewCV',
                  label: 'Thông báo khi sinh viên cập nhật CV mới',
                  desc: 'Gửi email khi sinh viên hoàn thành bản CV cần đánh giá.',
                },
                {
                  key: 'emailOnMatchAlert',
                  label: 'Cảnh báo cơ hội việc làm & tiến cử',
                  desc: 'Thông báo khi có vị trí tuyển dụng phù hợp với sinh viên phụ trách.',
                },
                {
                  key: 'emailOnInternshipReport',
                  label: 'Báo cáo thực tập định kỳ',
                  desc: 'Nhận thông báo khi sinh viên nộp báo cáo tuần thực tập.',
                },
                {
                  key: 'weeklySummaryDigest',
                  label: 'Bản tin tổng hợp hàng tuần',
                  desc: 'Tổng hợp số liệu sinh viên có việc và tình trạng tiến cử.',
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-3.5 p-3.5 rounded-lg border border-[#E2E8F0] dark:border-slate-800 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={(profile.notificationPreferences as any)[item.key]}
                    onChange={(e) => {
                      const updated = {
                        ...profile.notificationPreferences,
                        [item.key]: e.target.checked,
                      };
                      setProfile({ ...profile, notificationPreferences: updated });
                      setToast({ message: 'Đã cập nhật tùy chọn thông báo.', type: 'info' });
                    }}
                    className="mt-0.5 w-4 h-4 text-[#006948] rounded border-slate-300 focus:ring-[#006948] cursor-pointer shrink-0"
                  />
                  <div>
                    <strong className="block text-xs sm:text-sm font-semibold text-[#171d19] dark:text-white">
                      {item.label}
                    </strong>
                    <span className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5 block">{item.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && <CounselorToast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
