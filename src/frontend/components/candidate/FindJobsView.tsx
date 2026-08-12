/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Briefcase, Check, CloudUpload, FileText, Mic, Moon, PencilLine, Search, Sparkles, Sun, Target, Terminal, Upload, X
} from 'lucide-react';

export default function FindJobsView(props: any) {
  return (
    <>
        <section className="app-view" id="view-find-jobs">
          <div className="page-container job-search-page">
            <div className="page-header job-search-heading">
              <div className="page-badge">AI JOB DISCOVERY // ENTERPRISE CATALOG</div>
              <h1 className="page-title ux-page-title"><Search aria-hidden="true" /> Tìm việc phù hợp</h1>
              <p className="page-sub">Khám phá JD thật từ doanh nghiệp và để AI xếp hạng công việc theo CV của bạn.</p>
            </div>

            <section className="job-search-console" aria-labelledby="job-search-console-title">
              <div className="job-search-console-copy">
                <span className="job-search-kicker">98+ JD DOANH NGHIỆP</span>
                <h2 id="job-search-console-title">Tìm bằng từ khóa hoặc CV có sẵn</h2>
                <p>AI chỉ dùng nội dung và kỹ năng có trong CV để xếp hạng, không tự thêm kinh nghiệm.</p>
              </div>
              <form id="job-search-form" className="job-search-form">
                <label className="job-search-field" htmlFor="job-search-input">
                  <span>Tìm kiếm JD</span>
                  <span className="job-search-input-wrap">
                    <Search size={18} aria-hidden="true" />
                    <input id="job-search-input" type="search" placeholder="Ví dụ: Python, Frontend, ShopBack, Hà Nội..." autoComplete="off" />
                  </span>
                </label>
                <button type="submit" className="job-search-primary">Tìm kiếm</button>
              </form>
              <div className="job-cv-match-row">
                <label htmlFor="job-search-cv-select">
                  <span>Tìm việc bằng CV</span>
                  <select id="job-search-cv-select" className="form-input">
                    <option value="">Chọn CV có sẵn của bạn</option>
                  </select>
                </label>
                <button type="button" id="job-match-cv-btn" className="job-match-cv-btn" disabled>
                  <Sparkles size={16} aria-hidden="true" /> Lọc JD phù hợp với CV
                </button>
                <button type="button" id="job-search-reset-btn" className="job-search-reset">Xóa bộ lọc</button>
              </div>
            </section>

            <div className="job-results-toolbar">
              <div>
                <span className="pulse-dot green"></span>
                <strong id="job-results-summary">Đang tải danh sách việc làm...</strong>
              </div>
              <span id="job-results-mode" className="job-results-mode">Tất cả JD</span>
            </div>
            <div id="job-search-results" className="job-search-results" aria-live="polite">
              <div className="job-search-loading"><span></span><p>AI đang nạp dữ liệu JD doanh nghiệp...</p></div>
            </div>
          </div>
        </section>
    </>
  );
}
