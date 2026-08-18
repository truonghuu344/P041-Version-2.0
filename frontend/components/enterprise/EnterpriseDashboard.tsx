import React, { useEffect } from 'react';
import { EnterpriseTab } from './EnterpriseView';
import { Briefcase, Users, UserPlus, Clock, ArrowRight, Plus } from 'lucide-react';

interface Props {
  onNavigate: (tab: EnterpriseTab) => void;
}

export default function EnterpriseDashboard({ onNavigate }: Props) {
  // Update AI Chatbot context for Recruiter role
  useEffect(() => {
    const hint = document.getElementById('ai-companion-hint');
    const originalHintHTML = hint ? hint.innerHTML : null;

    if (hint) {
      hint.innerHTML = '<strong>Hỏi Career AI</strong><span>Hỗ trợ đăng tin và quản lý ứng viên</span>';
    }

    return () => {
      if (hint && originalHintHTML) {
        hint.innerHTML = originalHintHTML;
      }
    };
  }, []);

  // 4 KPI Cards Demo Data
  const kpis = [
    {
      id: 'active-jobs',
      label: 'Tin đang tuyển',
      value: '12',
      sub: 'Đang hoạt động',
      icon: <Briefcase size={18} />,
    },
    {
      id: 'total-candidates',
      label: 'Tổng ứng viên',
      value: '84',
      sub: 'Trên 12 vị trí',
      icon: <Users size={18} />,
    },
    {
      id: 'new-candidates',
      label: 'Ứng viên mới',
      value: '18',
      sub: '7 ngày gần đây',
      icon: <UserPlus size={18} />,
    },
    {
      id: 'expiring-jobs',
      label: 'Sắp hết hạn',
      value: '6',
      sub: 'Trong 7 ngày',
      icon: <Clock size={18} />,
    },
  ];

  // Recent Jobs Demo Data
  const recentJobs = [
    {
      id: '1',
      title: 'Backend Developer',
      type: 'Full-time',
      location: 'Hồ Chí Minh',
      status: 'Đang tuyển',
      candidates: 24,
      expire: '30/09/2026',
      actionText: 'Xem →',
      actionTab: 'jobs' as EnterpriseTab,
    },
    {
      id: '2',
      title: 'AI Engineer Intern',
      type: 'Internship',
      location: 'Hybrid',
      status: 'Đang tuyển',
      candidates: 12,
      expire: '30/08/2026',
      actionText: 'Xem →',
      actionTab: 'jobs' as EnterpriseTab,
    },
    {
      id: '3',
      title: 'Frontend Developer',
      type: 'Full-time',
      location: 'Remote',
      status: 'Bản nháp',
      candidates: null,
      expire: '—',
      actionText: 'Chỉnh sửa →',
      actionTab: 'create-job' as EnterpriseTab,
    },
  ];

  // Actionable Attention Items
  const attentionItems = [
    {
      id: 'att-1',
      count: 3,
      type: 'candidate',
      label: 'Ứng viên mới chưa xem',
      actionText: 'Xem ứng viên →',
      tab: 'candidates' as EnterpriseTab,
    },
    {
      id: 'att-2',
      count: 2,
      type: 'warning',
      label: 'Tin tuyển dụng sắp hết hạn',
      actionText: 'Kiểm tra →',
      tab: 'jobs' as EnterpriseTab,
    },
    {
      id: 'att-3',
      count: 1,
      type: 'draft',
      label: 'Tin đang ở bản nháp',
      actionText: 'Tiếp tục chỉnh sửa →',
      tab: 'create-job' as EnterpriseTab,
    },
  ];

  // Recent Candidates Demo Data (Top 5)
  const recentCandidates = [
    {
      id: 'c1',
      name: 'Nguyễn Văn A',
      appliedAt: '2 giờ trước',
      position: 'Backend Developer',
      matchScore: 82,
      status: 'Mới',
      statusType: 'info',
    },
    {
      id: 'c2',
      name: 'Trần Thị B',
      appliedAt: '5 giờ trước',
      position: 'AI Engineer Intern',
      matchScore: 76,
      status: 'Đang xem xét',
      statusType: 'warning',
    },
    {
      id: 'c3',
      name: 'Lê Hoàng Nam',
      appliedAt: '1 ngày trước',
      position: 'Backend Developer',
      matchScore: 88,
      status: 'Phỏng vấn',
      statusType: 'purple',
    },
    {
      id: 'c4',
      name: 'Phạm Minh Đức',
      appliedAt: '2 ngày trước',
      position: 'Frontend Developer',
      matchScore: 65,
      status: 'Mới',
      statusType: 'info',
    },
    {
      id: 'c5',
      name: 'Vũ Thảo Nguyên',
      appliedAt: '3 ngày trước',
      position: 'AI Engineer Intern',
      matchScore: 91,
      status: 'Đang xem xét',
      statusType: 'warning',
    },
  ];

  const getStatusBadgeClass = (statusType: string) => {
    switch (statusType) {
      case 'info':
        return 'recruiter-badge-info';
      case 'warning':
        return 'recruiter-badge-warning';
      case 'purple':
        return 'recruiter-badge-purple';
      case 'success':
        return 'recruiter-badge-success';
      default:
        return 'recruiter-badge-neutral';
    }
  };

  return (
    <div className="recruiter-dashboard" data-testid="recruiter-dashboard">
      {/* 1. Header (No hero, clean SaaS page header) */}
      <header className="recruiter-header">
        <div className="recruiter-title-wrap">
          <h1 className="recruiter-page-title">Dashboard tuyển dụng</h1>
          <p className="recruiter-page-subtitle">Tổng quan hoạt động tuyển dụng và ứng viên của bạn.</p>
        </div>
        <button
          type="button"
          className="recruiter-btn-primary"
          onClick={() => onNavigate('create-job')}
          aria-label="Đăng tin tuyển dụng"
        >
          <Plus size={16} />
          <span>Đăng tin tuyển dụng</span>
        </button>
      </header>

      {/* 2. 4 KPI Summary Cards */}
      <section className="recruiter-kpi-grid" aria-label="Tổng quan chỉ số tuyển dụng">
        {kpis.map((kpi) => (
          <article key={kpi.id} className="recruiter-kpi-card" data-testid={`kpi-${kpi.id}`}>
            <div className="recruiter-kpi-top">
              <span className="recruiter-kpi-icon">{kpi.icon}</span>
              <p className="recruiter-kpi-label">{kpi.label}</p>
            </div>
            <div className="recruiter-kpi-main">
              <h2 className="recruiter-kpi-value">{kpi.value}</h2>
              <p className="recruiter-kpi-sub">{kpi.sub}</p>
            </div>
          </article>
        ))}
      </section>

      {/* 3. Main 2-Column Layout (Left ~68%: Recent Jobs | Right ~32%: Attention Center) */}
      <div className="recruiter-main-layout">
        {/* Left Column: Tin tuyển dụng gần đây */}
        <section className="recruiter-card recruiter-jobs-card" aria-labelledby="recent-jobs-title">
          <div className="recruiter-card-header">
            <h2 id="recent-jobs-title" className="recruiter-card-title">Tin tuyển dụng gần đây</h2>
            <button
              type="button"
              className="recruiter-card-link"
              onClick={() => onNavigate('jobs')}
            >
              <span>Xem tất cả</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="recruiter-table-responsive">
            <table className="recruiter-table" aria-label="Danh sách tin tuyển dụng gần đây">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '42%' }}>Vị trí</th>
                  <th scope="col" style={{ width: '22%' }}>Trạng thái</th>
                  <th scope="col" className="align-right" style={{ width: '14%' }}>Ứng viên</th>
                  <th scope="col" style={{ width: '14%' }}>Hết hạn</th>
                  <th scope="col" className="align-right" style={{ width: '8%' }}><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id} className="recruiter-table-row">
                    <td>
                      <div className="recruiter-job-cell">
                        <strong className="recruiter-job-title">{job.title}</strong>
                        <span className="recruiter-job-meta">
                          {job.type} · {job.location}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`recruiter-badge ${
                          job.status === 'Đang tuyển' ? 'recruiter-badge-success' : 'recruiter-badge-neutral'
                        }`}
                      >
                        {job.status === 'Đang tuyển' ? '● Đang tuyển' : job.status}
                      </span>
                    </td>
                    <td className="align-right">
                      {job.candidates !== null ? (
                        <strong className="recruiter-applicant-count">{job.candidates}</strong>
                      ) : (
                        <span className="recruiter-muted-text">—</span>
                      )}
                    </td>
                    <td>
                      <span className="recruiter-muted-text">{job.expire}</span>
                    </td>
                    <td className="align-right">
                      <button
                        type="button"
                        className="recruiter-table-action-btn"
                        onClick={() => onNavigate(job.actionTab)}
                        aria-label={`${job.actionText} cho ${job.title}`}
                      >
                        {job.actionText}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right Column: Cần chú ý (Action Center) */}
        <aside className="recruiter-card recruiter-attention-card" aria-labelledby="attention-title">
          <div className="recruiter-card-header">
            <h2 id="attention-title" className="recruiter-card-title">Cần chú ý</h2>
          </div>

          <div className="recruiter-attention-list">
            {attentionItems.map((item) => (
              <div key={item.id} className="recruiter-attention-item">
                <div className="recruiter-attention-left">
                  <span className={`recruiter-attention-count is-${item.type}`}>{item.count}</span>
                  <p className="recruiter-attention-label">{item.label}</p>
                </div>
                <button
                  type="button"
                  className="recruiter-attention-action"
                  onClick={() => onNavigate(item.tab)}
                >
                  {item.actionText}
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* 4. Activity Section: Ứng viên gần đây */}
      <section className="recruiter-card recruiter-activity-section" aria-labelledby="recent-candidates-title">
        <div className="recruiter-card-header">
          <h2 id="recent-candidates-title" className="recruiter-card-title">Ứng viên gần đây</h2>
          <button
            type="button"
            className="recruiter-card-link"
            onClick={() => onNavigate('candidates')}
          >
            <span>Xem tất cả ứng viên</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="recruiter-table-responsive">
          <table className="recruiter-table" aria-label="Bảng ứng viên gần đây">
            <thead>
              <tr>
                <th scope="col" style={{ width: '28%' }}>Ứng viên</th>
                <th scope="col" style={{ width: '28%' }}>Vị trí ứng tuyển</th>
                <th scope="col" className="align-center" style={{ width: '18%' }}>Match</th>
                <th scope="col" style={{ width: '14%' }}>Trạng thái</th>
                <th scope="col" className="align-right" style={{ width: '12%' }}><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {recentCandidates.map((cand) => (
                <tr key={cand.id} className="recruiter-table-row">
                  <td>
                    <div>
                      <strong className="recruiter-candidate-name">{cand.name}</strong>
                      <div className="recruiter-candidate-meta">{cand.appliedAt}</div>
                    </div>
                  </td>
                  <td>
                    <span className="recruiter-job-title" style={{ fontSize: '14px' }}>
                      {cand.position}
                    </span>
                  </td>
                  <td className="align-center">
                    <span
                      className="recruiter-match-badge"
                      title="Mức độ phù hợp dựa trên CV đã chia sẻ và yêu cầu công việc. Chỉ dùng để tham khảo."
                    >
                      {cand.matchScore}% phù hợp
                    </span>
                  </td>
                  <td>
                    <span className={`recruiter-badge ${getStatusBadgeClass(cand.statusType)}`}>
                      {cand.status}
                    </span>
                  </td>
                  <td className="align-right">
                    <button
                      type="button"
                      className="recruiter-table-action-btn"
                      onClick={() => onNavigate('candidates')}
                      aria-label={`Xem hồ sơ của ${cand.name}`}
                    >
                      Xem hồ sơ →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="recruiter-activity-footer">
          <button
            type="button"
            className="recruiter-card-link"
            onClick={() => onNavigate('candidates')}
          >
            <span>Xem tất cả ứng viên</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </section>
    </div>
  );
}
