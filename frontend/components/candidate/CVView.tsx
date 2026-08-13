/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { PencilLine, Plus, Search, Sparkles, Upload } from 'lucide-react';

export default function CVView({ selectedCVTemplate, setIsTemplateGalleryOpen }: any) {
  return <section className="app-view buddy-landing" id="view-cv">
    <div className="career-portfolio-workspace" id="career-portfolio-workspace">
      <header className="career-table-header">
        <div><p className="career-portfolio-eyebrow"><Sparkles size={13} /> MY CV</p><h2>Quản lý CV của bạn</h2><p>Lưu, tìm kiếm và chọn nhanh phiên bản CV phù hợp cho từng công việc.</p></div>
        <div className="career-table-actions"><button type="button" className="career-create-button" onClick={() => setIsTemplateGalleryOpen(true)}><Plus size={17} /> Tạo CV mới</button><label className="career-upload-button"><Upload size={15} /> Tải CV lên<input id="portfolio-cv-upload-input" type="file" accept=".pdf,.docx" hidden /></label></div>
      </header>
      <div id="career-portfolio-snapshot" className="career-snapshot" hidden aria-label="Tổng quan CV"></div>
      <section className="career-table-section" id="career-versions-section" hidden><div className="career-section-heading career-versions-heading"><div><h3>Danh sách CV</h3><p>Các phiên bản CV đã lưu trong tài khoản của bạn.</p></div><label className="career-search"><Search size={15} /><input id="career-cv-search" type="search" placeholder="Tìm CV..." aria-label="Tìm CV" /></label></div><div className="career-table-wrap"><table className="career-cv-table"><thead><tr><th>CV</th><th>Cập nhật</th><th>Kỹ năng</th><th>Trạng thái</th><th aria-label="Thao tác"></th></tr></thead><tbody id="career-cv-table-body"></tbody></table></div></section>
      <section id="career-portfolio-empty" className="career-empty-state" hidden><div className="career-empty-sheets" aria-hidden="true"><i></i><i></i><i><Sparkles size={18} /></i></div><h3>Hồ sơ đầu tiên của bạn bắt đầu từ đây.</h3><p>Tạo CV để bắt đầu xây dựng hồ sơ nghề nghiệp. Bạn có thể đối chiếu với công việc bất cứ khi nào muốn.</p><button type="button" className="career-create-button" onClick={() => setIsTemplateGalleryOpen(true)}><Sparkles size={16} /> Tạo CV đầu tiên</button><label className="career-upload-link">hoặc tải CV hiện có<input id="portfolio-cv-upload-empty-input" type="file" accept=".pdf,.docx" hidden /></label></section>
      <aside id="career-buddy-insight" className="career-buddy-insight" hidden><div><Sparkles size={16} /></div><p><strong>Career Buddy</strong><span>Chọn một CV để đối chiếu với công việc bạn quan tâm khi bạn đã sẵn sàng.</span></p><button type="button" data-career-start-match>Chọn CV để phân tích</button></aside>

      <div className="manual-cv-workspace" id="manual-cv-card" hidden={!selectedCVTemplate}>
        <div className="manual-cv-title"><PencilLine size={18} /><div><h3>Tạo CV mới từ template đã chọn</h3><p>Chỉ nhập thông tin có thật. Bạn không cần chọn công việc để lưu CV.</p></div></div>
        <form id="manual-cv-form" className="manual-cv-form"><input type="hidden" id="manual-cv-template" value={selectedCVTemplate || 'classic'} readOnly />
          <label>Tên CV *<input id="manual-cv-title" placeholder="CV Frontend Developer 2026" required /></label><label>Họ và tên *<input id="manual-cv-name" required /></label><label>Email<input id="manual-cv-email" type="email" /></label><label>Số điện thoại<input id="manual-cv-phone" /></label>
          <label className="manual-cv-wide">Giới thiệu ngắn<textarea id="manual-cv-summary" placeholder="Mục tiêu nghề nghiệp và thế mạnh nổi bật" /></label><label className="manual-cv-wide">Kỹ năng<input id="manual-cv-skills" placeholder="Python, React, SQL" /></label><label>Học vấn<textarea id="manual-cv-education" placeholder="Mỗi nội dung một dòng" /></label><label>Kinh nghiệm<textarea id="manual-cv-experience" placeholder="Mỗi nội dung một dòng" /></label><label className="manual-cv-wide">Dự án<textarea id="manual-cv-projects" placeholder="Mỗi dự án một dòng" /></label><button type="submit" className="career-create-button manual-cv-submit">Lưu CV</button>
        </form>
      </div>
    </div>
  </section>;
}
