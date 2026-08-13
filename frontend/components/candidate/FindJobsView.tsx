import { BriefcaseBusiness, FileText, Search, Sparkles, SlidersHorizontal } from 'lucide-react';

export default function FindJobsView() {
  return (
    <section className="app-view buddy-landing jobs-workspace" id="view-find-jobs">
      <div className="jobs-shell">
        <header className="jobs-page-header">
          <span className="jobs-eyebrow"><BriefcaseBusiness size={14} /> JOB DISCOVERY</span>
          <h2>Tìm công việc đáng để bạn ứng tuyển.</h2>
          <p>Tìm theo từ khoá, hoặc dùng CV để ưu tiên những JD có kỹ năng liên quan nhất.</p>
        </header>

        <section className="jobs-search-card">
          <form id="job-search-form" className="jobs-keyword-form">
            <label htmlFor="job-search-input"><span>Tìm kiếm vị trí</span><div><Search size={18} /><input id="job-search-input" type="search" placeholder="Python, Product Designer, Hà Nội…" autoComplete="off" /></div></label>
            <button type="submit"><Search size={16} /> Tìm việc</button>
          </form>

          <div className="jobs-cv-filter">
            <div className="jobs-filter-copy"><span className="jobs-filter-icon"><SlidersHorizontal size={17} /></span><div><strong>Ưu tiên theo CV của bạn</strong><p>So sánh kỹ năng trong CV với từng JD, không thay đổi điểm Match chính thức.</p></div></div>
            <div className="jobs-filter-actions"><label><FileText size={15} /><select id="job-search-cv-select"><option value="">Chọn CV đã lưu</option></select></label><button type="button" id="job-match-cv-btn" disabled><Sparkles size={16} /> Lọc theo CV</button><button type="button" id="job-search-reset-btn">Xóa lọc</button></div>
          </div>
        </section>

        <div className="jobs-results-toolbar">
          <div><i /><strong id="job-results-summary">Đang tải danh sách việc làm…</strong></div>
          <span id="job-results-mode">Tất cả JD</span>
        </div>
        <div id="job-search-results" className="job-search-results" aria-live="polite">
          <div className="job-search-loading"><span /><p>Đang nạp kho JD doanh nghiệp…</p></div>
        </div>
        <nav id="job-pagination" className="job-pagination" aria-label="Phân trang danh sách việc làm" hidden />
      </div>
    </section>
  );
}
