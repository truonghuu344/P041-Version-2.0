/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { BarChart3, LineChart, TrendingUp, Users, Briefcase } from 'lucide-react';

export default function EnterpriseReports() {
  const kpis = [
    {
      id: 'total-jobs',
      label: 'Tổng Job đã đăng',
      value: '45',
      sub: 'Từ khi tạo tài khoản',
      icon: <Briefcase size={18} />,
      type: 'info',
    },
    {
      id: 'active-jobs',
      label: 'Job đang tuyển',
      value: '12',
      sub: 'Đang mở nhận hồ sơ',
      icon: <TrendingUp size={18} />,
      type: 'success',
    },
    {
      id: 'total-applicants',
      label: 'Tổng ứng viên',
      value: '384',
      sub: '+24 ứng viên tháng này',
      icon: <Users size={18} />,
      type: 'warning',
    },
  ];

  return (
    <div className="enterprise-reports" data-testid="enterprise-reports">
      {/* Header */}
      <header className="recruiter-header">
        <div className="recruiter-title-wrap">
          <h1 className="recruiter-page-title">Báo cáo tuyển dụng</h1>
          <p className="recruiter-page-subtitle">Tổng quan hiệu quả tuyển dụng của doanh nghiệp.</p>
        </div>
      </header>

      {/* 3 KPI Cards */}
      <section className="recruiter-kpi-grid cols-3" aria-label="Chỉ số báo cáo tuyển dụng">
        {kpis.map((kpi) => (
          <article key={kpi.id} className="recruiter-kpi-card">
            <div className="recruiter-kpi-top">
              <span className={`recruiter-kpi-icon is-${kpi.type}`}>{kpi.icon}</span>
              <p className="recruiter-kpi-label">{kpi.label}</p>
            </div>
            <div className="recruiter-kpi-main">
              <h2 className="recruiter-kpi-value">{kpi.value}</h2>
              <p className="recruiter-kpi-sub">{kpi.sub}</p>
            </div>
          </article>
        ))}
      </section>

      {/* 2 Chart Cards */}
      <div className="recruiter-chart-grid">
        {/* Chart 1 */}
        <section className="recruiter-chart-card">
          <div className="recruiter-card-header">
            <h2 className="recruiter-card-title">Ứng viên theo thời gian</h2>
          </div>
          <div className="recruiter-chart-placeholder">
            <div>
              <LineChart size={40} style={{ opacity: 0.4, marginBottom: '10px' }} />
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                Biểu đồ số lượng ứng viên theo tháng
              </p>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Tăng trưởng +18% so với quý trước
              </span>
            </div>
          </div>
        </section>

        {/* Chart 2 */}
        <section className="recruiter-chart-card">
          <div className="recruiter-card-header">
            <h2 className="recruiter-card-title">Ứng viên theo Job</h2>
          </div>
          <div className="recruiter-chart-placeholder">
            <div>
              <BarChart3 size={40} style={{ opacity: 0.4, marginBottom: '10px' }} />
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                Top 5 Job có lượng ứng viên cao nhất
              </p>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Backend Developer dẫn đầu với 84 ứng viên
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
