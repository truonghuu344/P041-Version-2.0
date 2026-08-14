/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Briefcase, Check, CloudUpload, FileText, Mic, Moon, PencilLine, Search, Sparkles, Sun, Target, Terminal, Upload, X
} from 'lucide-react';

export default function EnterpriseView(props: any) {
  return (
    <>
        <section className="app-view" id="view-enterprise">
          <div className="page-container">
            <div className="page-header"><div className="page-badge">ENTERPRISE RECRUITMENT</div><h1 className="page-title">🏢 Dashboard Tuyển Dụng</h1><p className="page-sub">Công bố JD, xem ứng viên đã chia sẻ CV và tham khảo Match Score.</p></div>
            <div className="role-dashboard-grid">
              <section className="role-panel"><h3>JD của doanh nghiệp</h3><div id="enterprise-jd-list" className="hitl-list"></div></section>
              <section className="role-panel role-menu-target" id="enterprise-applications-panel"><h3>Hồ sơ ứng tuyển theo Match Score</h3><p className="responsible-ai-note">Match Score chỉ để tham khảo; quyết định tuyển dụng luôn do con người thực hiện.</p><div id="enterprise-candidate-list" className="hitl-list"></div></section>
            </div>
            <section id="enterprise-candidate-cv" className="role-panel shared-cv-panel" hidden aria-live="polite"></section>
          </div>
        </section>
    </>
  );
}
