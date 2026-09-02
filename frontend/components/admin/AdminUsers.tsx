/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { PencilLine, PlusCircle, Search, Trash2 } from 'lucide-react';
import { AdminApi, AdminUser } from '@/lib/api/adminApi';
import AppConfirmDialog from '@/components/shared/AppConfirmDialog';
import AppPagination from '@/components/shared/AppPagination';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  AdminEmptyRow,
  AdminErrorState,
  AdminLoading,
  AdminToolbar,
  formatDate,
  roleLabel,
} from './adminShared';

const PAGE_SIZE = 20;

interface UserFormState {
  id?: string;
  email: string;
  password: string;
  full_name: string;
  role: 'student' | 'counselor';
}

const EMPTY_FORM: UserFormState = { email: '', password: '', full_name: '', role: 'student' };

export default function AdminUsers() {
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const page = await AdminApi.getUsersPage({ search: search || undefined, role: roleFilter || undefined, limit: PAGE_SIZE, offset });
      setRows(page.items);
      setTotal(page.total);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setForm({ id: user.id, email: user.email, password: '', full_name: user.full_name, role: user.role as UserFormState['role'] });
    setFormError('');
    setFormOpen(true);
  };

  const saveForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormSaving(true);
    setFormError('');
    try {
      if (form.id) {
        await AdminApi.updateUser(form.id, {
          full_name: form.full_name,
          ...(form.email ? { email: form.email } : {}),
          ...(form.password ? { password: form.password } : {}),
        });
      } else {
        await AdminApi.createUser({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
        });
      }
      setFormOpen(false);
      await load();
    } catch (err: any) {
      setFormError(err?.message || 'Không thể lưu tài khoản');
    } finally {
      setFormSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await AdminApi.deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Không thể xoá tài khoản');
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <AdminToolbar>
        <form className="ui-search" onSubmit={submitSearch} role="search">
          <Search size={18} className="ui-search-icon" />
          <input
            type="search"
            className="ui-search-input"
            placeholder="Tìm theo tên hoặc email…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Tìm kiếm người dùng"
          />
        </form>
        <select
          className="ui-select"
          value={roleFilter}
          onChange={(event) => {
            setOffset(0);
            setRoleFilter(event.target.value);
          }}
          aria-label="Lọc theo vai trò"
        >
          <option value="">Tất cả vai trò</option>
          <option value="student">Sinh viên</option>
          <option value="counselor">Cố vấn</option>
          <option value="admin">Quản trị viên</option>
        </select>
        <button type="button" className="ui-btn ui-btn-secondary" onClick={() => { setOffset(0); setSearch(''); setSearchInput(''); setRoleFilter(''); }}>
          Đặt lại
        </button>
        <div className="ui-toolbar-actions">
          <button type="button" className="ui-btn ui-btn-primary" onClick={openCreate}>
            <PlusCircle size={16} /> Thêm tài khoản
          </button>
        </div>
      </AdminToolbar>

      {loading && rows.length === 0 ? (
        <AdminLoading />
      ) : error && rows.length === 0 ? (
        <AdminErrorState message={error} onRetry={load} />
      ) : (
        <div className="ui-table-wrap admin-table-panel">
          <table className="w-full border-collapse min-w-[760px]" aria-label="Danh sách người dùng">
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Ngày tạo</th>
                <th className="text-right w-48 min-w-[160px]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id}>
                  <td data-label="Họ và tên" className="font-semibold text-slate-800">{user.full_name}</td>
                  <td data-label="Email" className="font-mono text-xs text-slate-600">{user.email}</td>
                  <td data-label="Vai trò">
                    <StatusBadge status={user.role} label={roleLabel(user.role)} showIcon={false} size="sm" />
                  </td>
                  <td data-label="Ngày tạo" className="text-slate-600">{formatDate(user.created_at)}</td>
                  <td data-label="Thao tác" className="text-right whitespace-nowrap min-w-[160px]">
                    <div className="admin-row-actions flex-row flex-nowrap items-center justify-end gap-2">
                      <button type="button" className="ui-btn ui-btn-sm ui-btn-secondary" onClick={() => openEdit(user)}>
                        <PencilLine size={14} /> Sửa
                      </button>
                      {user.role !== 'admin' && (
                        <button type="button" className="ui-btn ui-btn-sm ui-btn-danger-soft" onClick={() => setDeleteTarget(user)}>
                          <Trash2 size={14} /> Xoá
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <AdminEmptyRow colSpan={5} message="Không tìm thấy tài khoản nào phù hợp." />}
            </tbody>
          </table>
        </div>
      )}

      <AppPagination
        currentPage={Math.floor(offset / PAGE_SIZE) + 1}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        totalItems={total}
        pageSize={PAGE_SIZE}
        itemLabel="tài khoản"
        onPageChange={(page) => setOffset((page - 1) * PAGE_SIZE)}
      />

      {/* ── Modal thêm/sửa tài khoản ── */}
      {formOpen && (
        <div className="ui-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-user-modal-title">
          <div className="ui-modal" style={{ maxWidth: 480 }}>
            <div className="ui-modal-header">
              <div>
                <h2 id="admin-user-modal-title" className="ui-modal-title">
                  {form.id ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}
                </h2>
                <p className="ui-modal-sub">Hệ thống chỉ có một Admin; vai trò Admin không thể cấp thêm.</p>
              </div>
              <button type="button" className="ui-modal-close" onClick={() => setFormOpen(false)} aria-label="Đóng">
                ✕
              </button>
            </div>
            <form onSubmit={saveForm} className="contents">
              <div className="ui-modal-body grid gap-4">
                <label className="grid gap-1.5 text-xs font-semibold text-[#475569]">
                  Họ và tên
                  <input
                    type="text"
                    required
                    minLength={2}
                    className="ui-search-input !pl-3.5"
                    value={form.full_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-[#475569]">
                  Email
                  <input
                    type="email"
                    required
                    className="ui-search-input !pl-3.5"
                    value={form.email}
                    disabled={Boolean(form.id)}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </label>
                {!form.id && (
                  <>
                    <label className="grid gap-1.5 text-xs font-semibold text-[#475569]">
                      Mật khẩu khởi tạo (tối thiểu 6 ký tự)
                      <input
                        type="password"
                        required
                        minLength={6}
                        className="ui-search-input !pl-3.5"
                        value={form.password}
                        onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-[#475569]">
                      Vai trò
                      <select
                        className="ui-select"
                        value={form.role}
                        onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserFormState['role'] }))}
                      >
                        <option value="student">Sinh viên</option>
                        <option value="counselor">Cố vấn</option>
                                    </select>
                    </label>
                  </>
                )}
                {form.id && (
                  <label className="grid gap-1.5 text-xs font-semibold text-[#475569]">
                    Mật khẩu mới (bỏ trống nếu giữ nguyên)
                    <input
                      type="password"
                      minLength={6}
                      className="ui-search-input !pl-3.5"
                      value={form.password}
                      onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    />
                  </label>
                )}
                {formError && <p className="text-xs text-rose-600 font-medium">{formError}</p>}
              </div>
              <div className="ui-modal-footer">
                <button type="button" className="ui-btn ui-btn-secondary" onClick={() => setFormOpen(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="ui-btn ui-btn-primary" disabled={formSaving}>
                  {form.id ? 'Lưu thay đổi' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AppConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        isLoading={deleteBusy}
        variant="danger"
        title="Xoá tài khoản?"
        description={
          deleteTarget
            ? `Tài khoản ${deleteTarget.email} sẽ bị xoá vĩnh viễn cùng toàn bộ dữ liệu liên quan (CV, ứng tuyển, thực tập). Hành động này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Xoá vĩnh viễn"
      />
    </div>
  );
}
