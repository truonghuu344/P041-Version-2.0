/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  FileCheck,
  Mic,
  Sparkles,
  TrendingUp,
  Search,
  ArrowUpDown,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export default function HistoryView() {
  return (
    <section className="app-view buddy-landing" id="view-history">
      <main className="history-workspace">
        {/* 1. Header */}
        <header className="history-heading">
          <div>
            <h2 className="history-title">Lịch sử &amp; Báo cáo</h2>
            <p className="history-subtitle">
              Theo dõi kết quả CV, mức độ phù hợp công việc và quá trình luyện phỏng vấn.
            </p>
          </div>
        </header>

        {/* 2. KPI Summary (4 Compact Cards) */}
        <section className="history-kpi-row" aria-label="Tổng quan số liệu">
          <article className="history-kpi-card is-match">
            <span className="history-kpi-icon">
              <FileCheck size={20} />
            </span>
            <div className="history-kpi-data">
              <strong id="archive-match-count" className="history-kpi-value">0</strong>
              <span className="history-kpi-label">Lần so khớp CV</span>
            </div>
          </article>

          <article className="history-kpi-card is-optimized">
            <span className="history-kpi-icon">
              <Sparkles size={20} />
            </span>
            <div className="history-kpi-data">
              <strong id="archive-optimized-count" className="history-kpi-value">0</strong>
              <span className="history-kpi-label">CV đã tối ưu</span>
            </div>
          </article>

          <article className="history-kpi-card is-interview">
            <span className="history-kpi-icon">
              <Mic size={20} />
            </span>
            <div className="history-kpi-data">
              <strong id="archive-interview-count" className="history-kpi-value">0</strong>
              <span className="history-kpi-label">Phiên phỏng vấn</span>
            </div>
          </article>

          <article className="history-kpi-card is-best-match">
            <span className="history-kpi-icon">
              <TrendingUp size={20} />
            </span>
            <div className="history-kpi-data">
              <strong id="archive-best-match" className="history-kpi-value">0%</strong>
              <span className="history-kpi-label">Match cao nhất</span>
            </div>
          </article>
        </section>

        {/* 3. Analytics (2/3 Progress Line Chart + 1/3 Activity Donut Chart) */}
        <section className="history-analytics-section" id="history-analytics-section" aria-label="Phân tích tiến độ">
          <div className="analytics-card progress-card">
            <div className="analytics-card-header">
              <div className="analytics-card-title-wrap">
                <h3 className="analytics-card-title">Tiến bộ theo thời gian</h3>
                <span className="analytics-card-caption">Theo dõi điểm số qua các lần đánh giá gần nhất</span>
              </div>
              <div className="analytics-metric-switch" role="tablist" aria-label="Chọn loại chỉ số">
                <button
                  type="button"
                  id="metric-tab-match"
                  className="metric-switch-btn active"
                  data-metric="match"
                  role="tab"
                  aria-selected="true"
                >
                  Match CV
                </button>
                <button
                  type="button"
                  id="metric-tab-interview"
                  className="metric-switch-btn"
                  data-metric="interview"
                  role="tab"
                  aria-selected="false"
                >
                  Phỏng vấn
                </button>
              </div>
            </div>
            <div className="analytics-chart-wrap" id="history-progress-chart-container">
              {/* Dynamic SVG / Canvas Chart rendered via JS */}
              <div className="chart-placeholder-loading" id="progress-chart-loading">
                <span>Đang tạo biểu đồ tiến độ...</span>
              </div>
            </div>
          </div>

          <div className="analytics-card distribution-card">
            <div className="analytics-card-header">
              <div className="analytics-card-title-wrap">
                <h3 className="analytics-card-title">Hoạt động của bạn</h3>
                <span className="analytics-card-caption">Tỷ lệ các loại nhiệm vụ</span>
              </div>
            </div>
            <div className="donut-chart-wrap" id="history-donut-chart-container">
              {/* Dynamic Donut Chart rendered via JS */}
              <div className="chart-placeholder-loading" id="donut-chart-loading">
                <span>Đang tải phân bổ...</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Activity History Main Section */}
        <section className="history-main-card" aria-label="Lịch sử hoạt động">
          <div className="history-section-header">
            <h3 className="history-section-title">Lịch sử hoạt động</h3>
            <span id="archive-result-count" className="history-total-count" aria-live="polite">
              0 kết quả
            </span>
          </div>

          {/* Clean Toolbar: Search & Multi-Filters */}
          <div className="history-toolbar">
            <div className="history-search-wrap">
              <Search size={16} className="history-search-icon" aria-hidden="true" />
              <input
                type="search"
                id="history-search-input"
                className="history-search-input"
                placeholder="Tìm CV, công việc hoặc công ty..."
                aria-label="Tìm kiếm lịch sử"
              />
            </div>

            <div className="history-filter-controls">
              {/* Activity Type Filter */}
              <div className="filter-select-wrap">
                <select id="filter-activity-type" className="history-filter-select" aria-label="Lọc theo loại hoạt động">
                  <option value="all">Loại hoạt động: Tất cả</option>
                  <option value="match">Match CV &amp; JD</option>
                  <option value="optimized">CV đã tối ưu</option>
                  <option value="interview">Phỏng vấn</option>
                </select>
              </div>

              {/* Time Filter */}
              <div className="filter-select-wrap">
                <select id="filter-time-range" className="history-filter-select" aria-label="Lọc theo khoảng thời gian">
                  <option value="all">Thời gian: Tất cả</option>
                  <option value="7days">7 ngày qua</option>
                  <option value="30days">30 ngày qua</option>
                  <option value="3months">3 tháng qua</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="filter-select-wrap">
                <select id="filter-status" className="history-filter-select" aria-label="Lọc theo trạng thái">
                  <option value="all">Trạng thái: Tất cả</option>
                  <option value="completed">Hoàn thành</option>
                  <option value="inprogress">Đang thực hiện</option>
                  <option value="failed">Lỗi</option>
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="filter-select-wrap">
                <select id="history-sort-by" className="history-filter-select sort-select" aria-label="Sắp xếp danh sách">
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                  <option value="match_high">Match cao nhất</option>
                  <option value="match_low">Match thấp nhất</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filter Chips Bar */}
          <div id="history-active-chips" className="history-active-chips" hidden aria-live="polite">
            {/* Populated dynamically */}
          </div>

          {/* 5. Data Table (Desktop) & Compact List (Mobile) */}
          <div className="history-table-container">
            <table className="history-data-table" id="history-data-table" aria-label="Danh sách lịch sử hoạt động">
              <thead>
                <tr>
                  <th scope="col" className="col-type">Hoạt động</th>
                  <th scope="col" className="col-cv">CV</th>
                  <th scope="col" className="col-job">Công việc / JD</th>
                  <th scope="col" className="col-result sortable-col" id="col-sort-result" data-sort="score">
                    <span>Kết quả</span>
                    <ArrowUpDown size={13} className="sort-icon" />
                  </th>
                  <th scope="col" className="col-status">Trạng thái</th>
                  <th scope="col" className="col-date sortable-col" id="col-sort-date" data-sort="date">
                    <span>Ngày</span>
                    <ArrowUpDown size={13} className="sort-icon" />
                  </th>
                  <th scope="col" className="col-action text-right">Hành động</th>
                </tr>
              </thead>
              <tbody id="history-table-body">
                {/* Dynamically populated rows */}
              </tbody>
            </table>

            {/* Mobile list view container */}
            <div id="history-mobile-list" className="history-mobile-list" aria-live="polite">
              {/* Dynamically populated cards */}
            </div>

            {/* Empty state container */}
            <div id="history-empty-state" className="history-empty-state" hidden>
              {/* Dynamic empty state depending on no data vs no filter match */}
            </div>
          </div>

          {/* 11. Pagination Bar */}
          <footer className="history-pagination-bar" id="history-pagination-bar">
            <div className="pagination-info" id="pagination-info">
              Hiển thị 1–20 / 0 kết quả
            </div>
            <nav className="pagination-nav" id="pagination-nav" aria-label="Phân trang">
              <button type="button" className="pagination-btn prev-btn" id="pagination-prev-btn" aria-label="Trang trước" disabled>
                <ChevronLeft size={16} />
              </button>
              <div className="pagination-pages" id="pagination-pages">
                {/* Page buttons */}
              </div>
              <button type="button" className="pagination-btn next-btn" id="pagination-next-btn" aria-label="Trang sau" disabled>
                <ChevronRight size={16} />
              </button>
            </nav>
            <div className="pagination-page-size">
              <select id="pagination-size-select" className="page-size-select" aria-label="Số bản ghi mỗi trang">
                <option value="10">10 / trang</option>
                <option value="20">20 / trang</option>
                <option value="50">50 / trang</option>
                <option value="100">100 / trang</option>
              </select>
            </div>
          </footer>
        </section>

        {/* 7. Right-Side Detail Drawer */}
        <div id="history-drawer-overlay" className="history-drawer-overlay" aria-hidden="true" />
        <aside
          id="history-detail-drawer"
          className="history-detail-drawer"
          aria-label="Bảng chi tiết hoạt động"
          aria-hidden="true"
          tabIndex={-1}
        >
          <div className="drawer-header">
            <div className="drawer-header-info">
              <span id="drawer-activity-badge" className="drawer-type-badge">Match CV</span>
              <h3 id="drawer-item-title" className="drawer-title">Chi tiết hoạt động</h3>
            </div>
            <button
              type="button"
              id="btn-close-history-drawer"
              className="drawer-close-btn"
              aria-label="Đóng chi tiết"
            >
              <X size={20} />
            </button>
          </div>

          <div className="drawer-body" id="drawer-body-content">
            {/* Populated dynamically */}
          </div>

          <div className="drawer-footer" id="drawer-footer-actions">
            {/* Populated dynamically with primary action, secondary action and options */}
          </div>
        </aside>
      </main>
    </section>
  );
}
