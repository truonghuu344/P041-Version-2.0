import React from 'react';
import { ArrowRight, Check, FileText, Target } from 'lucide-react';

export default function GapView() {
  return (
    <section className="app-view buddy-landing" id="view-gap">
      <div className="gap-detail-workspace">
        <header className="gap-detail-hero">
          <h2>
            Kết quả Match <span>chi tiết</span>
          </h2>
          <span id="gap-detail-context">
            Chọn một kết quả Match để xem bằng chứng, điểm mạnh và các điểm cần làm rõ.
          </span>
        </header>
        <section id="gap-detail-empty" className="gap-detail-empty">
          <Target size={28} />
          <h3>Bạn chưa có kết quả Match để xem.</h3>
          <p>Đối chiếu một CV với công việc để nhận Gap Analysis chi tiết.</p>
          <button type="button" id="gap-start-match">
            Bắt đầu Match <ArrowRight size={16} />
          </button>
        </section>
        <section id="page-gap-results-container" className="gap-detail-result" hidden>
          <div className="gap-detail-score">
            <div>
              <p>KẾT QUẢ MATCH</p>
              <h3 id="page-gap-match-score-badge">—</h3>
            </div>
            <p id="page-gap-executive-summary"></p>
          </div>
          <div className="gap-detail-columns">
            <div>
              <h3>
                <Check size={17} /> Bằng chứng phù hợp
              </h3>
              <div id="page-gap-matching-skills"></div>
            </div>
            <div>
              <h3>Điểm cần làm rõ</h3>
              <div id="page-gap-partial-skills"></div>
              <div id="page-gap-missing-skills"></div>
            </div>
          </div>
          <section>
            <h3>Việc nên ưu tiên</h3>
            <div id="page-gap-priority-actions"></div>
          </section>
          <section>
            <h3>Gợi ý diễn đạt từ bằng chứng hiện có</h3>
            <div id="page-gap-suggestions-list"></div>
          </section>
          <section className="gap-detail-optimize">
            <h3>Tối ưu CV cho công việc này</h3>
            <p>Chỉ tạo phiên bản mới từ nội dung và bằng chứng bạn đã có.</p>
            <select id="cv-optimize-pages">
              <option value="AUTO">Tự động chọn độ dài</option>
              <option value="1">1 trang</option>
              <option value="2">2 trang</option>
            </select>
            <button id="page-btn-optimize-cv" type="button">
              <FileText size={16} /> Tối ưu CV
            </button>
          </section>
          <div id="page-optimization-results" hidden>
            <h3>CV đã tối ưu</h3>
            <button id="page-btn-start-mock-interview" type="button">
              Luyện phỏng vấn
            </button>
          </div>
          <div id="page-gap-soft-skills" hidden></div>
          <div id="page-gap-score-breakdown" hidden></div>
          <div id="page-gap-learning-list" hidden></div>
          <div id="page-gap-certifications-list" hidden></div>
          <div id="page-gap-projects-list" hidden></div>
          <div id="page-gap-cv-sections-list" hidden></div>
          <div id="page-gap-guardrail-status" hidden></div>
        </section>
      </div>
    </section>
  );
}
