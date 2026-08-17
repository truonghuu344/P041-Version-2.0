/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
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
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Download,
  FileBarChart,
  Gauge,
  Lightbulb,
  Trophy,
} from 'lucide-react';

export default function HistoryView() {
  const [activePage, setActivePage] = useState<'history' | 'reports'>('history');

  return (
    <section className="app-view buddy-landing" id="view-history">
      <main className="history-workspace">
        <header className="history-heading">
          <div className="history-heading-copy">
            <span className="history-eyebrow">Hành trình sự nghiệp</span>
            <h2 className="history-title">Lịch sử &amp; Báo cáo</h2>
            <p className="history-subtitle">
              Theo dõi kết quả CV, mức độ phù hợp công việc và quá trình luyện phỏng vấn.
            </p>
          </div>
          <div className="history-heading-actions">
            <button type="button" className="history-export-btn" aria-label="Xuất báo cáo PDF">
              <Download size={16} /> Xuất báo cáo
            </button>
            <div className="history-period-chip"><CalendarDays size={15} /> Cập nhật hôm nay</div>
          </div>
        </header>

        <nav className="history-page-tabs" aria-label="Chuyển trang lịch sử và báo cáo">
          <button
            type="button"
            className={`history-page-tab ${activePage === 'history' ? 'is-active' : ''}`}
            aria-current={activePage === 'history' ? 'page' : undefined}
            onClick={() => setActivePage('history')}
          >
            <Clock size={16} /> Lịch sử hoạt động
          </button>
          <button
            type="button"
            className={`history-page-tab ${activePage === 'reports' ? 'is-active' : ''}`}
            aria-current={activePage === 'reports' ? 'page' : undefined}
            onClick={() => setActivePage('reports')}
          >
            <BarChart3 size={16} /> Báo cáo tiến độ
          </button>
        </nav>

        <div hidden={activePage !== 'history'}>
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
        </div>

        <section className="career-report-page" hidden={activePage !== 'reports'} aria-label="Báo cáo tiến độ">
          <div className="report-hero-card">
            <div>
              <span className="report-overline">BÁO CÁO CÁ NHÂN · 30 NGÀY GẦN NHẤT</span>
              <h3>Hồ sơ của bạn đang đi đúng hướng</h3>
              <p>Tiếp tục ưu tiên kỹ năng còn thiếu để cải thiện cơ hội được mời phỏng vấn.</p>
            </div>
            <div className="report-score-orb" aria-label="Điểm sẵn sàng 72 trên 100"><strong>72</strong><span>/100</span><small>Sẵn sàng ứng tuyển</small></div>
          </div>

          <div className="report-stat-grid">
            <article className="report-stat-card"><span className="report-stat-icon teal"><Gauge size={20} /></span><div><span>Match trung bình</span><strong id="report-average-match">—</strong><small>Từ các JD đã phân tích</small></div></article>
            <article className="report-stat-card"><span className="report-stat-icon purple"><Trophy size={20} /></span><div><span>Điểm mạnh nổi bật</span><strong id="report-top-skill">Đang cập nhật</strong><small>Kỹ năng xuất hiện thường xuyên</small></div></article>
            <article className="report-stat-card"><span className="report-stat-icon amber"><FileBarChart size={20} /></span><div><span>Báo cáo hoàn thành</span><strong id="report-completed-count">0</strong><small>Có thể xem lại bất cứ lúc nào</small></div></article>
          </div>

          <div className="report-content-grid">
            <article className="report-panel report-trend-panel">
              <div className="report-panel-heading"><div><span className="report-label">XU HƯỚNG</span><h4>Điểm match theo thời gian</h4></div><span className="report-growth"><ArrowUpRight size={14} /> Đang theo dõi</span></div>
              <div className="report-chart" id="report-trend-chart" aria-label="Biểu đồ điểm match theo thời gian">
                <div className="report-chart-line"><i /><i /><i /><i /><i /><i /></div>
                <div className="report-chart-axis"><span>Tuần 1</span><span>Tuần 2</span><span>Tuần 3</span><span>Hôm nay</span></div>
              </div>
              <p className="report-panel-note">Dữ liệu được tổng hợp từ các lần so khớp CV và JD của bạn.</p>
            </article>
            <article className="report-panel report-action-panel">
              <div className="report-panel-heading"><div><span className="report-label">ƯU TIÊN TIẾP THEO</span><h4>3 việc giúp tăng cơ hội</h4></div><Lightbulb size={20} className="report-lightbulb" /></div>
              <ol className="report-actions-list" id="report-priority-actions">
                <li><span>01</span><div><strong>Hoàn thiện hồ sơ CV</strong><p>Thêm các kết quả có thể đo lường vào phần kinh nghiệm.</p></div></li>
                <li><span>02</span><div><strong>Luyện một phiên phỏng vấn</strong><p>Thực hành trả lời theo cấu trúc STAR cho vị trí mục tiêu.</p></div></li>
                <li><span>03</span><div><strong>So khớp với một JD mới</strong><p>Đo khoảng cách kỹ năng trước khi ứng tuyển.</p></div></li>
              </ol>
            </article>
          </div>

          <article className="report-panel report-recent-panel">
            <div className="report-panel-heading"><div><span className="report-label">BÁO CÁO GẦN ĐÂY</span><h4>Khám phá lại kết quả phân tích</h4></div><button type="button" className="report-link-btn" onClick={() => setActivePage('history')}>Xem lịch sử <ArrowUpRight size={15} /></button></div>
            <div id="report-recent-list" className="report-recent-list"><p>Những báo cáo mới nhất của bạn sẽ hiển thị tại đây.</p></div>
          </article>
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
