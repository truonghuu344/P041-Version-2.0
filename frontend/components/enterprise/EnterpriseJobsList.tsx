/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import { EnterpriseTab } from './EnterpriseView';
import { Search, Plus } from 'lucide-react';

interface Props {
  onNavigate: (tab: EnterpriseTab) => void;
  onSelectJob: (id: string) => void;
}

export default function EnterpriseJobsList({ onNavigate, onSelectJob }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const jobs = [
    {
      id: '1',
      title: 'Backend Developer',
      location: 'Hồ Chí Minh',
      type: 'Full-time',
      status: 'Đang tuyển',
      candidates: 24,
      views: 142,
      posted: '12/08/2026',
      expire: '30/09/2026',
    },
    {
      id: '2',
      title: 'AI Engineer Intern',
      location: 'Hybrid',
      type: 'Internship',
      status: 'Đang tuyển',
      candidates: 12,
      views: 89,
      posted: '14/08/2026',
      expire: '30/08/2026',
    },
    {
      id: '3',
      title: 'Frontend Developer',
      location: 'Remote',
      type: 'Full-time',
      status: 'Bản nháp',
      candidates: 0,
      views: 0,
      posted: '—',
      expire: '—',
    },
    {
      id: '4',
      title: 'Product Manager',
      location: 'Hà Nội',
      type: 'Full-time',
      status: 'Đã đóng',
      candidates: 45,
      views: 320,
      posted: '01/07/2026',
      expire: '01/08/2026',
    },
  ];

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="enterprise-jobs-list" data-testid="enterprise-jobs-list">
      {/* Header */}
      <header className="recruiter-header">
        <div className="recruiter-title-wrap">
          <h1 className="recruiter-page-title">Tin tuyển dụng</h1>
          <p className="recruiter-page-subtitle">Quản lý các vị trí đang tuyển của doanh nghiệp.</p>
        </div>
        <button
          type="button"
          className="recruiter-btn-primary"
          onClick={() => onNavigate('create-job')}
        >
          <Plus size={16} />
          <span>Đăng tin tuyển dụng</span>
        </button>
      </header>

      {/* Main Card with Toolbar & Table */}
      <div className="recruiter-card">
        {/* Toolbar */}
        <div className="recruiter-toolbar">
          <div className="recruiter-search-wrap">
            <Search size={18} className="recruiter-search-icon" />
            <input
              type="text"
              placeholder="Tìm vị trí tuyển dụng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="recruiter-search-input"
            />
          </div>
          <select
            className="recruiter-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Đang tuyển">Đang tuyển</option>
            <option value="Bản nháp">Bản nháp</option>
            <option value="Đã đóng">Đã đóng</option>
          </select>
          <select className="recruiter-filter-select">
            <option>Hình thức: Tất cả</option>
            <option>Full-time</option>
            <option>Part-time</option>
            <option>Internship</option>
          </select>
          <select className="recruiter-filter-select">
            <option>Địa điểm: Tất cả</option>
            <option>Hồ Chí Minh</option>
            <option>Hà Nội</option>
            <option>Remote</option>
            <option>Hybrid</option>
          </select>
          <select className="recruiter-filter-select">
            <option>Sắp xếp: Mới nhất</option>
            <option>Sắp xếp: Cũ nhất</option>
          </select>
        </div>

        {/* Table */}
        <div className="recruiter-table-responsive">
          <table className="recruiter-table" aria-label="Danh sách tin tuyển dụng">
            <thead>
              <tr>
                <th scope="col" style={{ width: '32%' }}>Vị trí</th>
                <th scope="col" style={{ width: '15%' }}>Trạng thái</th>
                <th scope="col" className="align-right" style={{ width: '11%' }}>Ứng viên</th>
                <th scope="col" className="align-right" style={{ width: '11%' }}>Lượt xem</th>
                <th scope="col" style={{ width: '13%' }}>Ngày đăng</th>
                <th scope="col" style={{ width: '12%' }}>Hết hạn</th>
                <th scope="col" className="align-right" style={{ width: '6%' }}><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-secondary)' }}>
                    Không tìm thấy tin tuyển dụng nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="recruiter-table-row">
                    <td>
                      <div
                        className="recruiter-job-cell"
                        style={{ cursor: 'pointer' }}
                        onClick={() => onSelectJob(job.id)}
                      >
                        <strong className="recruiter-job-title" style={{ color: 'var(--text-primary)' }}>
                          {job.title}
                        </strong>
                        <span className="recruiter-job-meta">
                          {job.type} · {job.location}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`recruiter-badge ${job.status === 'Đang tuyển'
                            ? 'recruiter-badge-success'
                            : job.status === 'Bản nháp'
                              ? 'recruiter-badge-neutral'
                              : 'recruiter-badge-danger'
                          }`}
                      >
                        {job.status === 'Đang tuyển' ? '● Đang tuyển' : job.status}
                      </span>
                    </td>
                    <td className="align-right">
                      {job.candidates > 0 ? (
                        <strong className="recruiter-applicant-count">{job.candidates}</strong>
                      ) : (
                        <span className="recruiter-muted-text">—</span>
                      )}
                    </td>
                    <td className="align-right">
                      <span className="recruiter-muted-text">{job.views > 0 ? job.views : '—'}</span>
                    </td>
                    <td>
                      <span className="recruiter-muted-text">{job.posted}</span>
                    </td>
                    <td>
                      <span className="recruiter-muted-text">{job.expire}</span>
                    </td>
                    <td className="align-right">
                      <button
                        type="button"
                        className="recruiter-table-action-btn"
                        onClick={() => onSelectJob(job.id)}
                        aria-label={`Xem chi tiết ${job.title}`}
                      >
                        Xem →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="recruiter-pagination">
          <div>Hiển thị {filteredJobs.length} vị trí</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span>Hiển thị:</span>
            <select className="recruiter-filter-select" style={{ padding: '4px 8px', minWidth: 'auto' }}>
              <option>20 mỗi trang</option>
              <option>50 mỗi trang</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
