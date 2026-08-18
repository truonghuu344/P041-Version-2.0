/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import { EnterpriseTab } from './EnterpriseView';
import { Users, UserPlus, Clock, Search, ArrowLeft, Edit, CheckCircle2, FileText } from 'lucide-react';

interface Props {
  jobId: string | null;
  onNavigate: (tab: EnterpriseTab) => void;
}

export default function EnterpriseJobDetail({ jobId, onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'candidates' | 'info'>('overview');

  const candidates = [
    { id: '1', name: 'Nguyễn Văn A', match: 82, status: 'Mới', statusType: 'info', date: '16/08/2026', cv: 'Backend_CV.pdf' },
    { id: '2', name: 'Trần Thị B', match: 74, status: 'Đang xem xét', statusType: 'warning', date: '15/08/2026', cv: 'SoftwareEngineer.pdf' },
    { id: '3', name: 'Lê Hoàng Nam', match: 88, status: 'Phỏng vấn', statusType: 'purple', date: '14/08/2026', cv: 'Nam_Backend.pdf' },
  ];

  const getStatusBadgeClass = (statusType: string) => {
    switch (statusType) {
      case 'info': return 'recruiter-badge-info';
      case 'warning': return 'recruiter-badge-warning';
      case 'purple': return 'recruiter-badge-purple';
      default: return 'recruiter-badge-neutral';
    }
  };

  return (
    <div className="enterprise-job-detail" data-testid="enterprise-job-detail">
      {/* Header */}
      <header className="recruiter-header">
        <div className="recruiter-title-wrap">
          <button
            type="button"
            className="recruiter-back-btn"
            onClick={() => onNavigate('jobs')}
          >
            <ArrowLeft size={14} />
            <span>Quay lại danh sách tin tuyển dụng</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className="recruiter-page-title">Backend Developer</h1>
            <span className="recruiter-badge recruiter-badge-success">● Đang tuyển</span>
          </div>
          <p className="recruiter-page-subtitle">ABC Technology · Hồ Chí Minh · Hybrid · Full-time · Hạn nộp: 30/09/2026</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="recruiter-btn-secondary"
            onClick={() => onNavigate('create-job')}
          >
            <Edit size={16} />
            <span>Chỉnh sửa</span>
          </button>
          <button
            type="button"
            className="recruiter-btn-primary"
            onClick={() => onNavigate('candidates')}
          >
            <Users size={16} />
            <span>Xem ứng viên</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="recruiter-tabs-nav">
        <button
          type="button"
          className={`recruiter-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Tổng quan
        </button>
        <button
          type="button"
          className={`recruiter-tab-btn ${activeTab === 'candidates' ? 'active' : ''}`}
          onClick={() => setActiveTab('candidates')}
        >
          Ứng viên (24)
        </button>
        <button
          type="button"
          className={`recruiter-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          Thông tin chi tiết Job
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <div className="recruiter-kpi-grid">
            <div className="recruiter-kpi-card">
              <div className="recruiter-kpi-top">
                <span className="recruiter-kpi-icon"><Users size={18} /></span>
                <p className="recruiter-kpi-label">Tổng ứng viên</p>
              </div>
              <div className="recruiter-kpi-main">
                <h2 className="recruiter-kpi-value">24</h2>
                <p className="recruiter-kpi-sub">Hồ sơ đã tiếp nhận</p>
              </div>
            </div>
            <div className="recruiter-kpi-card">
              <div className="recruiter-kpi-top">
                <span className="recruiter-kpi-icon is-info"><UserPlus size={18} /></span>
                <p className="recruiter-kpi-label">Ứng viên mới</p>
              </div>
              <div className="recruiter-kpi-main">
                <h2 className="recruiter-kpi-value">6</h2>
                <p className="recruiter-kpi-sub">Chưa xem xét</p>
              </div>
            </div>
            <div className="recruiter-kpi-card">
              <div className="recruiter-kpi-top">
                <span className="recruiter-kpi-icon is-warning"><Clock size={18} /></span>
                <p className="recruiter-kpi-label">Đang xem xét</p>
              </div>
              <div className="recruiter-kpi-main">
                <h2 className="recruiter-kpi-value">8</h2>
                <p className="recruiter-kpi-sub">Đang lọc hồ sơ</p>
              </div>
            </div>
            <div className="recruiter-kpi-card">
              <div className="recruiter-kpi-top">
                <span className="recruiter-kpi-icon is-success"><CheckCircle2 size={18} /></span>
                <p className="recruiter-kpi-label">Phỏng vấn</p>
              </div>
              <div className="recruiter-kpi-main">
                <h2 className="recruiter-kpi-value">3</h2>
                <p className="recruiter-kpi-sub">Đã lên lịch</p>
              </div>
            </div>
          </div>

          <section className="recruiter-card">
            <div className="recruiter-card-header">
              <h2 className="recruiter-card-title">Ứng viên nộp gần đây</h2>
              <button
                type="button"
                className="recruiter-card-link"
                onClick={() => setActiveTab('candidates')}
              >
                <span>Xem tất cả ứng viên →</span>
              </button>
            </div>

            <div className="recruiter-table-responsive">
              <table className="recruiter-table" aria-label="Ứng viên nộp gần đây">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '36%' }}>Ứng viên</th>
                    <th scope="col" className="align-center" style={{ width: '18%' }}>Match</th>
                    <th scope="col" style={{ width: '18%' }}>Trạng thái</th>
                    <th scope="col" style={{ width: '16%' }}>Ngày nộp</th>
                    <th scope="col" className="align-right" style={{ width: '12%' }}><span className="sr-only">Thao tác</span></th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => (
                    <tr key={c.id} className="recruiter-table-row">
                      <td>
                        <div className="recruiter-candidate-cell">
                          <div className="recruiter-candidate-avatar">{c.name.charAt(0)}</div>
                          <div>
                            <strong className="recruiter-candidate-name">{c.name}</strong>
                            <div style={{ marginTop: '2px' }}>
                              <a href="#" className="recruiter-candidate-cv-link">
                                <FileText size={12} />
                                <span>{c.cv}</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="align-center">
                        <span className="recruiter-match-badge">{c.match}% phù hợp</span>
                      </td>
                      <td>
                        <span className={`recruiter-badge ${getStatusBadgeClass(c.statusType)}`}>{c.status}</span>
                      </td>
                      <td>
                        <span className="recruiter-muted-text">{c.date}</span>
                      </td>
                      <td className="align-right">
                        <button type="button" className="recruiter-table-action-btn">
                          Xem hồ sơ →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Candidates Tab */}
      {activeTab === 'candidates' && (
        <div className="recruiter-card">
          <div className="recruiter-toolbar">
            <div className="recruiter-search-wrap">
              <Search size={18} className="recruiter-search-icon" />
              <input type="text" placeholder="Tìm ứng viên..." className="recruiter-search-input" />
            </div>
            <select className="recruiter-filter-select">
              <option>Tất cả trạng thái</option>
              <option>Mới</option>
              <option>Đang xem xét</option>
              <option>Phỏng vấn</option>
            </select>
          </div>

          <div className="recruiter-table-responsive">
            <table className="recruiter-table" aria-label="Toàn bộ ứng viên của vị trí">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '36%' }}>Ứng viên</th>
                  <th scope="col" className="align-center" style={{ width: '18%' }}>Match</th>
                  <th scope="col" style={{ width: '18%' }}>Trạng thái</th>
                  <th scope="col" style={{ width: '16%' }}>Ngày nộp</th>
                  <th scope="col" className="align-right" style={{ width: '12%' }}><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="recruiter-table-row">
                    <td>
                      <div className="recruiter-candidate-cell">
                        <div className="recruiter-candidate-avatar">{c.name.charAt(0)}</div>
                        <div>
                          <strong className="recruiter-candidate-name">{c.name}</strong>
                          <div style={{ marginTop: '2px' }}>
                            <a href="#" className="recruiter-candidate-cv-link">
                              <FileText size={12} />
                              <span>{c.cv}</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="align-center">
                      <span className="recruiter-match-badge">{c.match}% phù hợp</span>
                    </td>
                    <td>
                      <span className={`recruiter-badge ${getStatusBadgeClass(c.statusType)}`}>{c.status}</span>
                    </td>
                    <td>
                      <span className="recruiter-muted-text">{c.date}</span>
                    </td>
                    <td className="align-right">
                      <button type="button" className="recruiter-table-action-btn">
                        Xem hồ sơ →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="recruiter-card">
          <h2 className="recruiter-card-title" style={{ marginBottom: '16px' }}>Yêu cầu & Kỹ năng bắt buộc</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker', 'Microservices'].map((tag) => (
              <span key={tag} className="recruiter-tag-pill">{tag}</span>
            ))}
          </div>

          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>Mô tả công việc</h3>
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Tham gia thiết kế và xây dựng các dịch vụ backend hiệu năng cao, chịu tải lớn cho hệ thống Career Assistant.
          </p>

          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>Quyền lợi ứng viên</h3>
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>
            Lương thưởng cạnh tranh, tháng 13, bảo hiểm sức khỏe cao cấp và trang bị laptop MacBook Pro.
          </p>
        </div>
      )}
    </div>
  );
}
