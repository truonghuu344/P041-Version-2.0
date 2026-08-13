/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Briefcase, Check, CloudUpload, FileText, Mic, Moon, PencilLine, Search, Sparkles, Sun, Target, Terminal, Upload, X
} from 'lucide-react';

export default function FindJobsView(props: any) {
  return (
    <>
      <section className="app-view buddy-landing" id="view-find-jobs">
        <div className="buddy-hero-shell" style={{ display: 'block', padding: '40px 0', minHeight: 'auto' }}>
          
          <div className="buddy-section-heading" style={{ marginBottom: 32 }}>
            <div>
              <span className="buddy-kicker" style={{ marginBottom: 8 }}><Search size={15} /> Khám phá JD thật</span>
              <h2 id="buddy-journey-title">Tìm việc phù hợp.</h2>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#607184', fontWeight: 600 }}>98+ JD doanh nghiệp</span>
            </div>
          </div>

          <div className="buddy-template-card" style={{ padding: '32px', background: '#fff', borderRadius: '24px', marginBottom: '32px' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', color: 'var(--buddy-navy)', margin: '0 0 8px' }}>Tìm bằng từ khóa hoặc CV có sẵn</h3>
              <p style={{ fontSize: '14px', color: '#607184', margin: 0 }}>AI sẽ xếp hạng công việc dựa trên kỹ năng có trong CV của bạn.</p>
            </div>

            <form id="job-search-form" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '24px' }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <label htmlFor="job-search-input" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--buddy-navy)', display: 'block', marginBottom: '8px' }}>Tìm kiếm JD</label>
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#607184' }} />
                  <input id="job-search-input" type="search" placeholder="Ví dụ: Python, Frontend, ShopBack, Hà Nội..." autoComplete="off" style={{ width: '100%', padding: '14px 16px 14px 44px', borderRadius: '12px', border: '1px solid #dcece5', background: '#f8faf9', fontSize: '15px' }} />
                </div>
              </div>
              <button type="submit" className="buddy-primary-button" style={{ padding: '0 24px', height: '48px' }}>
                Tìm kiếm
              </button>
            </form>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '20px', background: '#f8faf9', borderRadius: '16px', border: '1px dashed #dcece5', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <label htmlFor="job-search-cv-select" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--buddy-navy)', display: 'block', marginBottom: '8px' }}>Tìm việc bằng CV</label>
                <div className="gap-select-shell" style={{ position: 'relative' }}>
                  <select id="job-search-cv-select" className="ship-input gap-select" style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #dcece5', background: '#fff', appearance: 'none' }}>
                    <option value="">Chọn CV có sẵn của bạn</option>
                  </select>
                  <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#607184' }}>⌄</span>
                </div>
              </div>
              <button type="button" id="job-match-cv-btn" className="buddy-primary-button" disabled style={{ padding: '0 20px', height: '44px', gap: '8px' }}>
                <Sparkles size={16} /> Lọc JD phù hợp với CV
              </button>
              <button type="button" id="job-search-reset-btn" className="buddy-text-button" style={{ height: '44px', padding: '0 16px', background: '#fff', border: '1px solid #dcece5' }}>
                Xóa bộ lọc
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '0 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--buddy-emerald)', display: 'inline-block' }}></span>
              <strong id="job-results-summary" style={{ fontSize: '15px', color: 'var(--buddy-navy)' }}>Đang tải danh sách việc làm...</strong>
            </div>
            <span id="job-results-mode" style={{ fontSize: '13px', fontWeight: 600, color: '#607184', padding: '6px 12px', background: '#fff', borderRadius: '12px', border: '1px solid #dcece5' }}>
              Tất cả JD
            </span>
          </div>
          
          <div id="job-search-results" className="job-search-results" aria-live="polite">
            <div className="job-search-loading" style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '24px', border: '1px solid #f3f6f4' }}>
              <span style={{ display: 'inline-block', width: 40, height: 40, borderRadius: '50%', border: '3px solid #dcece5', borderTopColor: 'var(--buddy-emerald)', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></span>
              <p style={{ margin: 0, fontSize: '15px', color: '#607184' }}>AI đang nạp dữ liệu JD doanh nghiệp...</p>
            </div>
          </div>

        </div>
      </section>
    </>
  );
}
