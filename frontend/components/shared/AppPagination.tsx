/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface AppPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  itemLabel?: string;
  className?: string;
}

export default function AppPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  onPageChange,
  onPageSizeChange,
  itemLabel = 'mục',
  className = '',
}: AppPaginationProps) {
  if (totalItems <= 0) return null;

  const validTotalPages = Math.max(1, totalPages);
  const startItem = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Generate pagination buttons with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (validTotalPages <= 7) {
      for (let i = 1; i <= validTotalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(validTotalPages);
      } else if (currentPage >= validTotalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = validTotalPages - 4; i <= validTotalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(validTotalPages);
      }
    }
    return pages;
  };

  return (
    <div
      className={`w-full flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2 text-sm text-[#475569] dark:text-slate-400 select-none ${className}`}
      aria-label="Phân trang danh sách"
    >
      {/* ── DESKTOP/TABLET LEFT: SUMMARY & PAGE SIZE SELECTOR ── */}
      <div className="flex items-center gap-3 text-xs sm:text-sm order-2 sm:order-1">
        <span>
          Hiển thị{' '}
          <strong className="font-semibold text-[#171d19] dark:text-white">
            {startItem}–{endItem}
          </strong>{' '}
          trên tổng số{' '}
          <strong className="font-semibold text-[#171d19] dark:text-white">
            {totalItems}
          </strong>{' '}
          {itemLabel}
        </span>

        {onPageSizeChange && pageSizeOptions.length > 1 && (
          <div className="hidden md:flex items-center gap-1.5 ml-2 pl-3 border-l border-[#CBD5E1] dark:border-slate-700">
            <label htmlFor="pagination-page-size" className="text-xs text-[#64748B] dark:text-slate-400">
              Số dòng:
            </label>
            <select
              id="pagination-page-size"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="py-1 px-2 text-xs bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-lg text-[#171d19] dark:text-white focus:outline-none focus:border-[#006948] focus:ring-1 focus:ring-[#006948] cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── DESKTOP & TABLET PAGINATION BUTTONS ── */}
      <div className="hidden sm:flex items-center gap-1 order-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          aria-label="Trang trước"
          className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] flex items-center justify-center border border-[#E2E8F0] dark:border-slate-800 rounded-lg text-[#475569] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 hover:text-[#006948] transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((pageItem, idx) => {
          if (pageItem === '...') {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="w-8 h-8 flex items-center justify-center text-xs text-[#94A3B8]"
              >
                …
              </span>
            );
          }

          const pageNum = Number(pageItem);
          const isActive = currentPage === pageNum;

          return (
            <button
              key={`page-${pageNum}`}
              type="button"
              onClick={() => onPageChange(pageNum)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Trang ${pageNum}`}
              className={`min-w-[34px] h-[34px] px-2 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${isActive
                  ? 'bg-[#006948] text-white shadow-xs'
                  : 'border border-transparent hover:border-[#E2E8F0] dark:hover:border-slate-700 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 text-[#475569] dark:text-slate-300'
                }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(validTotalPages, currentPage + 1))}
          disabled={currentPage === validTotalPages}
          aria-label="Trang tiếp theo"
          className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] flex items-center justify-center border border-[#E2E8F0] dark:border-slate-800 rounded-lg text-[#475569] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 hover:text-[#006948] transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── MOBILE COMPACT PAGINATION (>= 44px touch target) ── */}
      <div className="flex sm:hidden items-center justify-between w-full gap-2 order-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="min-h-[44px] px-3.5 flex items-center gap-1 bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs font-medium text-[#171d19] dark:text-white disabled:opacity-30 disabled:pointer-events-none active:bg-slate-100"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Trước</span>
        </button>

        <span className="text-xs font-semibold text-[#475569] dark:text-slate-300">
          Trang {currentPage} / {validTotalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(validTotalPages, currentPage + 1))}
          disabled={currentPage === validTotalPages}
          className="min-h-[44px] px-3.5 flex items-center gap-1 bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs font-medium text-[#171d19] dark:text-white disabled:opacity-30 disabled:pointer-events-none active:bg-slate-100"
        >
          <span>Tiếp</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
