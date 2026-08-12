/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Briefcase, Check, CloudUpload, FileText, Mic, Moon, PencilLine, Search, Sparkles, Sun, Target, Terminal, Upload, X
} from 'lucide-react';

export default function HistoryView(props: any) {
  return (
    <>
        <section className="app-view" id="view-history">
          <div className="page-container">
            <div className="page-header">
              <div className="page-badge badge-purple">DECK EPSILON // MISSION ARCHIVE VAULT</div>
              <h1 className="page-title">📜 Kho Lưu Trữ Lịch Sử Nhiệm Vụ (Mission Archive)</h1>
              <p className="page-sub">Xem lại tất cả các bản phân tích CV, phiên phỏng vấn thử STAR & báo cáo Gap Match đã thực hiện</p>
            </div>

            <div className="archive-workspace">
              <div className="archive-filters">
                <button className="archive-filter-btn active" data-filter="all">Tất cả nhiệm vụ</button>
                <button className="archive-filter-btn" data-filter="cv">📄 Phân tích CV</button>
                <button className="archive-filter-btn" data-filter="interview">🎙️ Phỏng vấn STAR</button>
                <button className="archive-filter-btn" data-filter="gap">🎯 Gap Analysis</button>
              </div>

              <div id="archive-timeline-container" className="archive-grid">
                <div className="archive-card" data-type="cv">
                  <div className="archive-card-header">
                    <span className="archive-tag tag-cv">📄 CV SCANNER</span>
                    <span className="archive-time">Hôm nay, 09:30</span>
                  </div>
                  <h3 className="archive-card-title">CV Software Engineer 2026</h3>
                  <p className="archive-card-sub">Trích xuất 14 Hard Skills • Đạt chuẩn ATS Anti-Hallucination</p>
                  <div className="archive-card-footer">
                    <span className="badge badge-ok">SUCCESS // PARSED</span>
                    <button className="archive-btn-view" id="btn-archive-view-cv">Xem Chi Tiết ➔</button>
                  </div>
                </div>

                <div className="archive-card" data-type="interview">
                  <div className="archive-card-header">
                    <span className="archive-tag tag-interview">🎙️ STAR INTERVIEW</span>
                    <span className="archive-time">Hôm qua, 15:45</span>
                  </div>
                  <h3 className="archive-card-title">Phiên Phỏng Vấn AI Engineer</h3>
                  <p className="archive-card-sub">Chấm điểm Rubric STAR: 85/100 • 5/5 Câu hỏi hoàn thành</p>
                  <div className="archive-card-footer">
                    <span className="badge badge-ok">PASSED // 85 PTS</span>
                    <button className="archive-btn-view" id="btn-archive-view-interview">Xem Báo Cáo ➔</button>
                  </div>
                </div>

                <div className="archive-card" data-type="gap">
                  <div className="archive-card-header">
                    <span className="archive-tag tag-gap">🎯 GAP MATCH</span>
                    <span className="archive-time">05/08/2026</span>
                  </div>
                  <h3 className="archive-card-title">So Khớp: CV vs Senior Fullstack JD</h3>
                  <p className="archive-card-sub">Tỷ lệ phù hợp: 92% • Thiếu 2 kỹ năng nâng cao (Docker, K8s)</p>
                  <div className="archive-card-footer">
                    <span className="badge badge-ok">MATCH RATE: 92%</span>
                    <button className="archive-btn-view" id="btn-archive-view-gap">Xem Lộ Trình ➔</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
    </>
  );
}
