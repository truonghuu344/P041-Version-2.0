/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Briefcase, Check, CloudUpload, FileText, Mic, Moon, PencilLine, Search, Sparkles, Sun, Target, Terminal, Upload, X
} from 'lucide-react';

export default function CounselorView(props: any) {
  return (
    <>
        <section className="app-view" id="view-counselor">
          <div className="page-container">
            <div className="page-header"><div className="page-badge">HUMAN-IN-THE-LOOP</div><h1 className="page-title">🎓 Dashboard Cố Vấn</h1><p className="page-sub">Chỉ hiển thị sinh viên đã chủ động cấp quyền.</p></div>
            <div className="role-dashboard-grid">
              <section id="counselor-kpi-overview" className="counselor-progress-summary" aria-label="Tổng quan tiến độ"><p className="gap-empty">Chọn sinh viên để xem tiến độ trước và sau phỏng vấn.</p></section>
              <section className="role-panel"><h3>Sinh viên được phân công</h3><div id="counselor-student-list" className="hitl-list"></div></section>
              <section className="role-panel role-menu-target" id="counselor-student-detail"><h3>Báo cáo tiến độ sinh viên</h3><p className="gap-empty">Chọn một sinh viên để xem CV, Gap Analysis và lịch sử STAR.</p></section>
            </div>
            <form id="counselor-feedback-form" className="role-panel" hidden>
              <input type="hidden" id="counselor-feedback-student-id" />
              <select id="counselor-feedback-kind" className="form-input"><option value="comment">Nhận xét</option><option value="task">Bài tập</option><option value="star_note">Ghi chú STAR</option></select>
              <textarea id="counselor-feedback-content" className="form-input" placeholder="Nội dung phản hồi" required></textarea>
              <button className="btn-primary" type="submit">Gửi phản hồi</button>
            </form>
          </div>
        </section>
    </>
  );
}
