/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Briefcase, Check, CloudUpload, FileText, Mic, Moon, PencilLine, Search, Sparkles, Sun, Target, Terminal, Upload, X
} from 'lucide-react';

export default function AdminView(props: any) {
  return (
    <>
        <section className="app-view" id="view-admin">
          <div className="spaceship-stage">
            <div className="section-header center-header" style={{ marginBottom: '32px' }}>
              <span className="section-tag glow-cyan">👑 QUẢN TRỊ VIÊN HỆ THỐNG</span>
              <h2 className="section-title-large">Quản Lý Người Dùng & Phân Quyền</h2>
              <p className="section-subtitle">Quản lý người dùng với một Admin hệ thống duy nhất; không hỗ trợ chuyển quyền Admin</p>
            </div>

            <div className="admin-container">
              {/* Stats row */}
              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <span className="admin-stat-num glow-cyan" id="admin-stat-total">0</span>
                  <span className="admin-stat-lbl">Tổng Người Dùng</span>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-num glow-purple" id="admin-stat-admin">0</span>
                  <span className="admin-stat-lbl">Admin Hệ Thống Duy Nhất</span>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-num glow-pink" id="admin-stat-student">0</span>
                  <span className="admin-stat-lbl">Sinh Viên / Candidate</span>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-num glow-green" id="admin-stat-enterprise">0</span>
                  <span className="admin-stat-lbl">Doanh Nghiệp & Mentor</span>
                </div>
              </div>

              <div className="admin-section-tabs" role="tablist" aria-label="Khu vực quản trị">
                <button type="button" id="admin-tab-users" className="admin-section-tab is-active" role="tab" aria-selected="true" aria-controls="admin-users-panel">👥 Người dùng</button>
                <button type="button" id="admin-tab-ai-logs" className="admin-section-tab" role="tab" aria-selected="false" aria-controls="admin-ai-logs-panel">✦ AI Logs</button>
              </div>

              <div id="admin-users-panel" role="tabpanel" aria-labelledby="admin-tab-users">
                {/* Actions & Search Header */}
                <div className="admin-toolbar">
                  <div className="admin-search-wrap">
                    <input type="text" id="admin-user-search" className="form-input" placeholder="🔍 Tìm kiếm theo Tên hoặc Email..." />
                  </div>
                  <button className="btn-primary" id="btn-admin-add-user">➕ Thêm User Mới</button>
                </div>

                {/* Users Table */}
                <div className="admin-table-wrap">
                  <table className="admin-users-table">
                    <thead>
                      <tr>
                        <th>Họ và Tên</th>
                        <th>Email</th>
                        <th>Vai Trò</th>
                        <th>Ngày Tạo</th>
                        <th style={{ textAlign: 'center' }}>Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody id="admin-users-tbody">
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '30px' }}>Đang tải danh sách người dùng...</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div id="admin-ai-logs-panel" role="tabpanel" aria-labelledby="admin-tab-ai-logs" hidden>
                <div className="ai-log-stats" aria-label="Thống kê AI log">
                  <span><strong id="ai-log-stat-total">0</strong> lượt gọi</span>
                  <span><strong id="ai-log-stat-success">0</strong> thành công</span>
                  <span><strong id="ai-log-stat-failed">0</strong> lỗi</span>
                  <span><strong id="ai-log-stat-users">0</strong> user</span>
                </div>
                <div className="admin-toolbar ai-log-toolbar">
                  <div className="admin-search-wrap">
                    <input type="search" id="admin-ai-log-search" className="form-input" placeholder="Tìm theo email, tên hoặc nội dung prompt..." />
                  </div>
                  <select id="admin-ai-log-status" className="form-input ai-log-filter" aria-label="Lọc trạng thái AI log">
                    <option value="">Tất cả trạng thái</option>
                    <option value="true">LLM thành công</option>
                    <option value="false">LLM lỗi</option>
                  </select>
                  <button type="button" id="btn-refresh-ai-logs" className="btn-outline">↻ Làm mới</button>
                </div>
                <p className="ai-log-privacy-note">🔒 Nhật ký chỉ dành cho Admin, bao gồm prompt và phản hồi để kiểm tra chất lượng, lỗi và việc sử dụng AI.</p>
                <div id="admin-ai-log-list" className="admin-ai-log-list" aria-live="polite">
                  <div className="ai-log-empty">Chọn tab AI Logs để tải nhật ký.</div>
                </div>
              </div>
            </div>
          </div>
        </section>
    </>
  );
}
