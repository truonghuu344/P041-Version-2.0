/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { AdminAILogRow, AdminAILogStats, AdminApi } from '@/lib/api/adminApi';
import { appAreaLabel, formatResponseTime } from '@/lib/displayLabels';
import AppPagination from '@/components/shared/AppPagination';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  AdminDonutChart,
  AdminErrorState,
  AdminKpiGrid,
  AdminLoading,
  AdminProgressBarChart,
  AdminToolbar,
  formatDateTime,
} from './adminShared';

const PAGE_SIZE = 20;

type ResultFilter = '' | 'success' | 'failed';

/**
 * Theo dõi mức độ sử dụng và độ ổn định của trợ lý AI.
 *
 * Có chủ đích KHÔNG hiển thị nội dung câu hỏi / câu trả lời, nhà cung cấp,
 * tên mô hình hay mã lỗi kỹ thuật: đó là dữ liệu riêng tư của người dùng và
 * thông tin chỉ có ý nghĩa với đội kỹ thuật. Màn hình này trả lời đúng ba câu
 * hỏi mà người quản trị cần: dùng nhiều hay ít, có lỗi hay không, nhanh hay chậm.
 */
export default function AdminAiUsage() {
  const [stats, setStats] = useState<AdminAILogStats | null>(null);
  const [rows, setRows] = useState<AdminAILogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsData, page] = await Promise.all([
        AdminApi.getAiLogStats().catch(() => null),
        AdminApi.getAiLogs({
          search: search || undefined,
          success: resultFilter === '' ? undefined : resultFilter === 'success',
          limit: PAGE_SIZE,
          offset,
        }),
      ]);
      setStats(statsData);
      setRows(page.items);
      setTotal(page.total);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải dữ liệu sử dụng trợ lý AI');
    } finally {
      setLoading(false);
    }
  }, [search, resultFilter, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const successRate =
    stats && stats.total_requests > 0
      ? Math.round((stats.successful_requests / stats.total_requests) * 100)
      : null;

  if (loading && rows.length === 0 && !stats) return <AdminLoading />;
  if (error && rows.length === 0) return <AdminErrorState message={error} onRetry={load} />;

  return (
    <div id="admin-tab-ai-logs" className="grid gap-4">
      {stats && (
        <>
          <AdminKpiGrid
            items={[
              { label: 'Lượt hỏi trợ lý AI', value: stats.total_requests, hint: 'Gemini Engine', color: 'emerald' },
              { label: 'Trả lời thành công', value: stats.successful_requests, hint: 'Thành công tốt', color: 'blue' },
              { label: 'Lượt gặp lỗi', value: stats.failed_requests, hint: 'Lỗi mạng / quota', color: 'rose' },
              {
                label: 'Tỷ lệ thành công',
                value: successRate === null ? '—' : `${successRate}%`,
                hint: successRate !== null && successRate < 90 ? 'Cần kiểm tra lại' : undefined,
                color: 'purple',
              },
              { label: 'Người dùng đã dùng AI', value: stats.unique_users, hint: 'Tài khoản hoạt động', color: 'emerald' },
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminDonutChart
              title="Tỷ lệ Độ tin cậy Phản hồi AI"
              segments={[
                { label: 'Thành công', value: stats.successful_requests, color: '#006948' },
                { label: 'Gặp lỗi', value: stats.failed_requests, color: '#F43F5E' },
              ]}
              centerLabel="Lượt gọi"
            />

            <AdminProgressBarChart
              title="Hiệu suất Trợ lý AI"
              items={[
                { label: 'Tỷ lệ thành công mục tiêu', value: stats.successful_requests, max: Math.max(1, stats.total_requests), color: '#006948' },
                { label: 'Tỷ lệ người dùng tương tác', value: stats.unique_users, max: Math.max(1, stats.total_requests), color: '#0284C7' },
              ]}
            />
          </div>
        </>
      )}

      {error && <AdminErrorState message={error} onRetry={load} />}

      <AdminToolbar>
        <form
          className="ui-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setOffset(0);
            setSearch(searchInput.trim());
          }}
        >
          <Search size={18} className="ui-search-icon" />
          <input
            id="admin-ai-log-search"
            type="search"
            className="ui-search-input"
            placeholder="Tìm theo tên hoặc email người dùng…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Tìm người dùng đã sử dụng trợ lý AI"
          />
        </form>
        <select
          className="ui-select max-w-[220px]"
          value={resultFilter}
          onChange={(event) => {
            setOffset(0);
            setResultFilter(event.target.value as ResultFilter);
          }}
          aria-label="Lọc theo kết quả trả lời"
        >
          <option value="">Mọi kết quả</option>
          <option value="success">Chỉ lượt thành công</option>
          <option value="failed">Chỉ lượt gặp lỗi</option>
        </select>
        <div className="ui-toolbar-actions">
          <button type="button" className="ui-btn" onClick={load}>
            <RefreshCw size={15} /> Làm mới
          </button>
        </div>
      </AdminToolbar>

      {loading && rows.length === 0 ? (
        <AdminLoading />
      ) : (
        <div id="admin-ai-log-list" className="ui-table-wrap admin-table-panel">
          <table className="w-full border-collapse min-w-[760px]" aria-label="Lượt sử dụng trợ lý AI">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Khu vực sử dụng</th>
                <th>Kết quả</th>
                <th>Thời gian phản hồi</th>
                <th>Thời điểm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Người dùng">
                    <span className="block font-semibold">{row.user_full_name || 'Người dùng chưa đặt tên'}</span>
                    <small className="admin-meta">{row.user_email}</small>
                  </td>
                  <td data-label="Khu vực sử dụng">{appAreaLabel(row.current_page)}</td>
                  <td data-label="Kết quả">
                    <StatusBadge
                      status={row.llm_succeeded ? 'completed' : 'failed'}
                      label={row.llm_succeeded ? 'Trả lời thành công' : 'Không trả lời được'}
                      size="sm"
                      showIcon={false}
                    />
                  </td>
                  <td data-label="Thời gian phản hồi">{formatResponseTime(row.latency_ms)}</td>
                  <td data-label="Thời điểm">{formatDateTime(row.created_at)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#64748B]">
                    Chưa có lượt sử dụng trợ lý AI nào phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AppPagination
        currentPage={Math.floor(offset / PAGE_SIZE) + 1}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        totalItems={total}
        pageSize={PAGE_SIZE}
        itemLabel="lượt hỏi"
        onPageChange={(page) => setOffset((page - 1) * PAGE_SIZE)}
      />

      <p className="text-xs text-[#64748B]">
        Nội dung trao đổi giữa người dùng và trợ lý AI không được hiển thị tại đây để bảo mật thông tin cá nhân.
      </p>
    </div>
  );
}
