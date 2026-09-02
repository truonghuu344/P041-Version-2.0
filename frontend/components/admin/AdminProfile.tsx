/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  ClipboardList,
  KeyRound,
  Loader2,
  Lock,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react';
import Image from 'next/image';
import { ApiClient } from '@/api-client.js';
import { formatDate, roleLabel } from './adminShared';

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof UserRound;
  title: string;
  description?: string;
}) {
  return (
    <div className="pb-4 border-b border-[#E2E8F0]">
      <h2 className="text-base font-bold text-[#171d19] flex items-center gap-2">
        <Icon size={16} className="text-[#006948]" />
        <span>{title}</span>
      </h2>
      {description && <p className="text-xs text-[#64748B] mt-0.5">{description}</p>}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="counselor-profile-field">
      <span className="counselor-profile-label">{label}</span>
      <div className="flex h-11 items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 text-sm font-medium text-[#334155] break-all">
        {value}
      </div>
    </div>
  );
}

export default function AdminProfile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const me = await ApiClient.getMe();
      setUser(me);
      setFullName(me?.full_name || '');
    } catch (err: any) {
      setError(err?.message || 'Không thể tải hồ sơ quản trị');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fullName.trim()) {
      setNameMessage('Họ và tên không được để trống.');
      return;
    }
    setNameSaving(true);
    setNameMessage('');
    try {
      const updated = await ApiClient.updateProfile({ full_name: fullName.trim() });
      setUser(updated);
      setNameMessage('Đã cập nhật họ tên.');
    } catch (err: any) {
      setNameMessage(err?.message || 'Không thể cập nhật họ tên.');
    } finally {
      setNameSaving(false);
    }
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Xác nhận mật khẩu không khớp.');
      return;
    }
    setPasswordSaving(true);
    try {
      await ApiClient.changePassword(currentPassword, newPassword);
      setPasswordMessage('Đổi mật khẩu thành công.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err?.message || 'Không thể đổi mật khẩu.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    setError('');
    try {
      const updated = await ApiClient.uploadAvatar(file);
      setUser(updated);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải ảnh đại diện. Chỉ chấp nhận JPEG/PNG/WebP dưới 2 MB.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    setError('');
    try {
      const updated = await ApiClient.deleteAvatar();
      setUser(updated);
    } catch (err: any) {
      setError(err?.message || 'Không thể xoá ảnh đại diện.');
    } finally {
      setAvatarBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-profile counselor-profile-wrapper antialiased" role="status">
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          Đang tải hồ sơ…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-profile counselor-profile-wrapper antialiased" role="alert">
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-red-600">
          <span>{error || 'Không lấy được thông tin tài khoản.'}</span>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={loadProfile}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const initial = (user.full_name || user.email || 'A').trim().charAt(0).toUpperCase();
  const accountActive = user.is_active !== false;

  return (
    <div
      className="admin-profile counselor-profile-wrapper antialiased"
      data-testid="admin-profile"
    >
      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 flex items-center gap-2"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="counselor-profile-grid-2col grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
        {/* Cột trái: ảnh đại diện + vai trò + trạng thái */}
        <aside className="lg:col-span-4 w-full min-w-0">
          <section
            className="counselor-profile-card flex flex-col items-center gap-5 text-center h-full"
            aria-label="Ảnh đại diện và trạng thái tài khoản"
          >
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-[#E2E8F0] bg-white shadow-sm">
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.full_name || user.email}
                  fill
                  sizes="96px"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-[#006948]">
                  {initial}
                </span>
              )}
              {avatarBusy && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
                  <Loader2 size={18} className="animate-spin text-[#006948]" />
                </span>
              )}
            </div>

            <div className="w-full min-w-0 space-y-2.5">
              <p className="text-[15px] font-bold leading-snug text-[#171d19] break-words">
                {user.full_name || user.email}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-[#059669]/20 bg-[#ECFDF5] px-2.5 py-1 text-xs font-semibold text-[#059669]">
                  <UserRound size={12} />
                  {roleLabel(user.role)}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    accountActive
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      accountActive ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {accountActive ? 'Đang hoạt động' : 'Tạm khoá'}
                </span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              hidden
              onChange={handleAvatarChange}
            />

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-[#E2E8F0] w-full">
              <button
                type="button"
                className="ui-btn ui-btn-secondary"
                disabled={avatarBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={15} />
                Tải ảnh lên
              </button>
              {user.avatar_url && (
                <button
                  type="button"
                  className="ui-btn ui-btn-danger-soft"
                  disabled={avatarBusy}
                  onClick={removeAvatar}
                >
                  <Trash2 size={15} />
                  Xoá ảnh
                </button>
              )}
            </div>
            <p className="text-xs text-[#64748B]">JPEG, PNG hoặc WebP · tối đa 2 MB</p>
          </section>
        </aside>

        {/* Cột phải: chi tiết tài khoản + hồ sơ cá nhân */}
        <main className="lg:col-span-8 w-full min-w-0 flex flex-col gap-5">
          <section className="counselor-profile-card space-y-5" aria-label="Thông tin tài khoản">
            <SectionHeader
              icon={UserRound}
              title="Thông tin tài khoản"
              description="Thông tin định danh do hệ thống cấp — chỉ đọc."
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <ReadOnlyField label="Email" value={user.email} />
              <ReadOnlyField label="Ngày tạo tài khoản" value={formatDate(user.created_at)} />
            </div>
          </section>

          <section className="counselor-profile-card space-y-5" aria-label="Thông tin cá nhân">
            <SectionHeader
              icon={ClipboardList}
              title="Thông tin cá nhân"
              description="Họ tên hiển thị trong nhật ký và các trang quản trị."
            />
            <form onSubmit={saveName} className="flex max-w-md flex-col gap-5">
              <label className="counselor-profile-field">
                <span className="counselor-profile-label">Họ và tên</span>
                <input
                  type="text"
                  className="counselor-profile-input"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nguyễn Văn A"
                />
              </label>
              {nameMessage && (
                <p
                  className="text-xs font-medium text-[#64748B]"
                  role="status"
                >
                  {nameMessage}
                </p>
              )}
              <button type="submit" className="ui-btn ui-btn-primary w-fit px-5" disabled={nameSaving}>
                {nameSaving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                Lưu thay đổi
              </button>
            </form>
          </section>
        </main>
      </div>

      {/* Đổi mật khẩu */}
      <section className="counselor-profile-card space-y-5 w-full" aria-label="Đổi mật khẩu">
        <SectionHeader
          icon={Lock}
          title="Đổi mật khẩu"
          description="Sử dụng mật khẩu mạnh, tối thiểu 8 ký tự, không dùng lại mật khẩu cũ."
        />
        <form onSubmit={submitPassword} className="grid gap-5 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-end">
          <label className="counselor-profile-field">
            <span className="counselor-profile-label">Mật khẩu hiện tại</span>
            <input
              type="password"
              className="counselor-profile-input"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>
          <label className="counselor-profile-field">
            <span className="counselor-profile-label">Mật khẩu mới</span>
            <input
              type="password"
              className="counselor-profile-input"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>
          <label className="counselor-profile-field">
            <span className="counselor-profile-label">Xác nhận mật khẩu mới</span>
            <input
              type="password"
              className="counselor-profile-input"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            className="ui-btn ui-btn-secondary md:mb-0"
            disabled={passwordSaving}
          >
            {passwordSaving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <KeyRound size={15} />
            )}
            Cập nhật mật khẩu
          </button>
        </form>
        {(passwordError || passwordMessage) && (
          <div className="space-y-2">
            {passwordError && (
              <p
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                role="alert"
              >
                {passwordError}
              </p>
            )}
            {passwordMessage && (
              <p
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"
                role="status"
              >
                {passwordMessage}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
