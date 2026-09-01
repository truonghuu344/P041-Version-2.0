/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import EnterpriseDashboard from './EnterpriseDashboard';

const EnterpriseJobsList = dynamic(() => import('./EnterpriseJobsList'));
const EnterpriseCreateJob = dynamic(() => import('./EnterpriseCreateJob'));
const EnterpriseJobDetail = dynamic(() => import('./EnterpriseJobDetail'));
const EnterpriseCandidatesList = dynamic(() => import('./EnterpriseCandidatesList'));
const EnterpriseReports = dynamic(() => import('./EnterpriseReports'));
const EnterpriseCompanyProfile = dynamic(() => import('./EnterpriseCompanyProfile'));

export type EnterpriseTab =
  | 'dashboard'
  | 'jobs'
  | 'create-job'
  | 'job-detail'
  | 'candidates'
  | 'reports'
  | 'profile';

export default function EnterpriseView(props: any) {
  const [activeTab, setActiveTab] = useState<EnterpriseTab>('dashboard');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [profileSubTab, setProfileSubTab] = useState<'company' | 'brand' | 'account'>('company');

  useEffect(() => {
    const handleNavigate = (e: any) => {
      const tab = e.detail;
      if (tab) {
        if (tab === 'company-profile' || tab === 'company') {
          setProfileSubTab('company');
          setActiveTab('profile');
        } else if (tab === 'account' || tab === 'settings') {
          setProfileSubTab('account');
          setActiveTab('profile');
        } else if (tab === 'brand') {
          setProfileSubTab('brand');
          setActiveTab('profile');
        } else if (tab === 'profile') {
          setProfileSubTab('company');
          setActiveTab('profile');
        } else {
          setActiveTab(tab as EnterpriseTab);
        }
        if (tab !== 'job-detail') {
          setActiveJobId(null);
        }
      }
    };

    // Listen to custom event from global navbar
    window.addEventListener('navigate-enterprise', handleNavigate);
    return () => window.removeEventListener('navigate-enterprise', handleNavigate);
  }, []);

  // Synchronize active classes on global navbar
  useEffect(() => {
    const navMap: Record<EnterpriseTab, string> = {
      dashboard: 'nav-enterprise',
      jobs: 'nav-enterprise-jobs',
      'create-job': 'btn-enterprise-create-job',
      'job-detail': 'nav-enterprise-jobs',
      candidates: 'nav-enterprise-candidates',
      reports: 'nav-enterprise-reports',
      profile: '',
    };

    const targetNavId = navMap[activeTab];
    [
      'nav-enterprise',
      'nav-enterprise-jobs',
      'nav-enterprise-candidates',
      'nav-enterprise-reports',
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        if (id === targetNavId) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      }
    });
  }, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <EnterpriseDashboard onNavigate={setActiveTab} />;
      case 'jobs':
        return (
          <EnterpriseJobsList
            onNavigate={setActiveTab}
            onSelectJob={(id) => {
              setActiveJobId(id);
              setActiveTab('job-detail');
            }}
          />
        );
      case 'create-job':
        return <EnterpriseCreateJob onNavigate={setActiveTab} />;
      case 'job-detail':
        return <EnterpriseJobDetail jobId={activeJobId} onNavigate={setActiveTab} />;
      case 'candidates':
        return <EnterpriseCandidatesList onNavigate={setActiveTab} />;
      case 'reports':
        return <EnterpriseReports />;
      case 'profile':
        return <EnterpriseCompanyProfile onNavigate={setActiveTab} initialTab={profileSubTab} />;
      default:
        return <EnterpriseDashboard onNavigate={setActiveTab} />;
    }
  };

  return (
    <section className="app-view recruiter-app-view" id="view-enterprise">
      <div className="recruiter-workspace">{renderContent()}</div>
    </section>
  );
}
