/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect } from 'react';
import CounselorNavbar, { CounselorTab } from './CounselorNavbar';
import CounselorDashboard from './CounselorDashboard';
import CounselorStudentsList from './CounselorStudentsList';
import CounselorStudentDetail from './CounselorStudentDetail';
import CounselorOpportunities from './CounselorOpportunities';
import CounselorJobCandidates from './CounselorJobCandidates';
import CounselorReferralsList from './CounselorReferralsList';
import CounselorReferralDetail from './CounselorReferralDetail';
import CounselorInternshipsList from './CounselorInternshipsList';
import CounselorInternshipDetail from './CounselorInternshipDetail';
import CounselorPartnersList from './CounselorPartnersList';
import CounselorPartnerDetail from './CounselorPartnerDetail';
import CounselorProfile from './CounselorProfile';
import PartnerTrustStrip from './PartnerTrustStrip';
import CounselorFooter from './CounselorFooter';
import CounselorJDManager from './CounselorJDManager';
import CounselorTourGuide from './CounselorTourGuide';
// Helper to parse canonical counselor deep routes
export function parseCounselorRoute(pathOrHash: string): {
  tab: CounselorTab;
  studentId?: string;
  referralId?: string;
  internshipId?: string;
  partnerId?: string;
  jobId?: string;
  opportunitiesTab?: 'jobs' | 'requests';
} {
  const clean = pathOrHash.replace(/^[#/]+/, '').replace(/^counselor\/?/, '');
  const parts = clean.split('/').filter(Boolean);

  if (parts.length === 0 || parts[0] === 'dashboard') {
    return { tab: 'dashboard' };
  }
  if (parts[0] === 'students') {
    if (parts[1]) {
      return { tab: 'student-detail', studentId: parts[1] };
    }
    return { tab: 'students' };
  }
  if (parts[0] === 'opportunities') {
    if (parts[1] === 'jobs' && parts[2]) {
      return { tab: 'suitable-candidates', jobId: parts[2], opportunitiesTab: 'jobs' };
    }
    if (parts[1] === 'requests' && parts[2]) {
      return { tab: 'suitable-candidates', jobId: parts[2], opportunitiesTab: 'requests' };
    }
    if (parts[1]) {
      return { tab: 'suitable-candidates', jobId: parts[1] };
    }
    return { tab: 'opportunities' };
  }
  if (parts[0] === 'referrals') {
    if (parts[1]) {
      return { tab: 'referral-detail', referralId: parts[1] };
    }
    return { tab: 'referrals' };
  }
  if (parts[0] === 'internships') {
    if (parts[1]) {
      return { tab: 'internship-detail', internshipId: parts[1] };
    }
    return { tab: 'internships' };
  }
  if (parts[0] === 'partners') {
    if (parts[1]) {
      return { tab: 'partner-detail', partnerId: parts[1] };
    }
    return { tab: 'partners' };
  }
  if (parts[0] === 'jds' || parts[0] === 'jobs') {
    return { tab: 'jds' };
  }
  if (parts[0] === 'profile') {
    return { tab: 'profile' };
  }
  if (parts[0] === 'settings') {
    return { tab: 'settings' };
  }
  return { tab: 'dashboard' };
}

export function getCanonicalUrl(tab: CounselorTab, params?: any): string {
  switch (tab) {
    // Role root LÀ dashboard. `/counselor/dashboard` được next.config.mjs
    // redirect (308) về đây; parseCounselorRoute vẫn nhận cả 2 dạng.
    case 'dashboard':
      return '/counselor';
    case 'students':
      return '/counselor/students';
    case 'student-detail':
      return `/counselor/students/${params?.studentId || 'sv01'}`;
    case 'opportunities':
      return '/counselor/opportunities';
    case 'jds':
      return '/counselor/jds';
    case 'suitable-candidates':
      return `/counselor/opportunities/jobs/${params?.jobId || 'req-01'}`;
    case 'referrals':
      return '/counselor/referrals';
    case 'referral-detail':
      return `/counselor/referrals/${params?.referralId || 'ref-01'}`;
    case 'internships':
      return '/counselor/internships';
    case 'internship-detail':
      return `/counselor/internships/${params?.internshipId || 'intern-01'}`;
    case 'partners':
      return '/counselor/partners';
    case 'partner-detail':
      return `/counselor/partners/${params?.partnerId || 'partner-1'}`;
    case 'profile':
      return '/counselor/profile';
    case 'settings':
      return '/counselor/settings';
    default:
      return '/counselor';
  }
}

export default function CounselorView({ isActive = true, ...props }: any) {
  const [activeTab, setActiveTab] = useState<CounselorTab>('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('sv01');
  const [selectedJobContext, setSelectedJobContext] = useState<any>({
    jobId: 'req-01',
    position: 'Java Backend Intern',
    company: 'FPT Software',
    slots: 5,
  });
  const [selectedReferralId, setSelectedReferralId] = useState<string>('ref-01');
  const [selectedInternshipId, setSelectedInternshipId] = useState<string>('intern-01');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('partner-1');
  const [opportunitiesInitialTab, setOpportunitiesInitialTab] = useState<'jobs' | 'requests'>('requests');

  // Parse initial route on component mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentPath = window.location.pathname;
    const currentHash = window.location.hash;
    const routeCandidate = currentPath.startsWith('/counselor')
      ? currentPath
      : currentHash.startsWith('#counselor')
        ? currentHash
        : '';
    if (routeCandidate) {
      const parsed = parseCounselorRoute(routeCandidate);
      setActiveTab(parsed.tab);
      if (parsed.studentId) setSelectedStudentId(parsed.studentId);
      if (parsed.referralId) setSelectedReferralId(parsed.referralId);
      if (parsed.internshipId) setSelectedInternshipId(parsed.internshipId);
      if (parsed.partnerId) setSelectedPartnerId(parsed.partnerId);
      if (parsed.jobId) {
        setSelectedJobContext((prev: any) => ({ ...prev, jobId: parsed.jobId }));
      }
      if (parsed.opportunitiesTab) setOpportunitiesInitialTab(parsed.opportunitiesTab);
    }
  }, []);

  // Handle global custom events for counselor navigation
  useEffect(() => {
    const handleNavigateEvent = (e: any) => {
      const detail = e.detail;
      if (!detail) return;

      if (typeof detail === 'string') {
        handleNavigate(detail as CounselorTab);
      } else if (typeof detail === 'object') {
        handleNavigate(detail.tab || 'dashboard', detail);
      }
    };

    window.addEventListener('navigate-counselor', handleNavigateEvent);
    return () => window.removeEventListener('navigate-counselor', handleNavigateEvent);
  }, []);

  // Handle popstate for browser Back / Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === 'undefined') return;
      const path = window.location.pathname;
      if (path.startsWith('/counselor')) {
        const parsed = parseCounselorRoute(path);
        handleNavigate(parsed.tab, parsed, { skipHistory: true });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (tab: CounselorTab, params?: any, options?: { skipHistory?: boolean }) => {
    if (params) {
      if (params.studentId) setSelectedStudentId(params.studentId);
      if (params.referralId) setSelectedReferralId(params.referralId);
      if (params.internshipId) setSelectedInternshipId(params.internshipId);
      if (params.partnerId) setSelectedPartnerId(params.partnerId);
      if (params.tab === 'requests' || params.tab === 'jobs') {
        setOpportunitiesInitialTab(params.tab);
      }
      if (params.jobId) {
        setSelectedJobContext({
          jobId: params.jobId,
          position: params.position || 'Java Backend Intern',
          company: params.company || 'FPT Software',
          slots: params.slots || 5,
        });
      }
    }
    setActiveTab(tab);

    // Synchronize browser history / URL with canonical route
    if (!options?.skipHistory && typeof window !== 'undefined' && window.history?.pushState) {
      const targetUrl = getCanonicalUrl(tab, params);
      if (window.location.pathname !== targetUrl) {
        window.history.pushState({ role: 'counselor', tab, params }, '', targetUrl);
      }
    }

    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        // Ignore in environments without smooth scroll
      }
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <CounselorDashboard onNavigate={handleNavigate} />;

      case 'students':
        return (
          <CounselorStudentsList
            onNavigate={handleNavigate}
            onSelectStudent={(id) => setSelectedStudentId(id)}
          />
        );

      case 'student-detail':
        return (
          <CounselorStudentDetail
            studentId={selectedStudentId}
            onNavigate={handleNavigate}
            onBackToList={() => setActiveTab('students')}
          />
        );

      case 'opportunities':
        return (
          <CounselorOpportunities
            initialTab={opportunitiesInitialTab}
            onNavigate={handleNavigate}
          />
        );

      case 'jds':
        return <CounselorJDManager onNavigate={handleNavigate} />;

      case 'suitable-candidates':
        return (
          <CounselorJobCandidates
            jobId={selectedJobContext.jobId}
            position={selectedJobContext.position}
            company={selectedJobContext.company}
            slots={selectedJobContext.slots}
            onNavigate={handleNavigate}
          />
        );

      case 'referrals':
        return <CounselorReferralsList onNavigate={handleNavigate} />;

      case 'referral-detail':
        return (
          <CounselorReferralDetail
            referralId={selectedReferralId}
            onNavigate={handleNavigate}
          />
        );

      case 'internships':
        return <CounselorInternshipsList onNavigate={handleNavigate} />;

      case 'internship-detail':
        return (
          <CounselorInternshipDetail
            internshipId={selectedInternshipId}
            onNavigate={handleNavigate}
          />
        );

      case 'partners':
        return <CounselorPartnersList onNavigate={handleNavigate} />;

      case 'partner-detail':
        return (
          <CounselorPartnerDetail
            partnerId={selectedPartnerId}
            onNavigate={handleNavigate}
          />
        );

      case 'profile':
        return (
          <CounselorProfile
            initialTab="profile"
            onNavigate={handleNavigate}
          />
        );

      case 'settings':
        return (
          <CounselorProfile
            initialTab="settings"
            onNavigate={handleNavigate}
          />
        );

      default:
        return <CounselorDashboard onNavigate={handleNavigate} />;
    }
  };

  // Synchronize top navigation active state whenever activeTab changes
  useEffect(() => {
    const counselorNavMap: Record<string, string> = {
      dashboard: 'nav-counselor',
      students: 'nav-counselor-students',
      'student-detail': 'nav-counselor-students',
      opportunities: 'nav-counselor-opportunities',
      'suitable-candidates': 'nav-counselor-opportunities',
      referrals: 'nav-counselor-referrals',
      'referral-detail': 'nav-counselor-referrals',
      internships: 'nav-counselor-internships',
      'internship-detail': 'nav-counselor-internships',
      partners: 'nav-counselor-partners',
      'partner-detail': 'nav-counselor-partners',
    };

    const targetId = counselorNavMap[activeTab] || 'nav-counselor';
    const allCounselorNavIds = [
      'nav-counselor',
      'nav-counselor-students',
      'nav-counselor-opportunities',
      'nav-counselor-referrals',
      'nav-counselor-internships',
      'nav-counselor-partners',
    ];

    allCounselorNavIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        if (id === targetId) {
          el.classList.add('active');
          el.setAttribute('aria-current', 'page');
        } else {
          el.classList.remove('active');
          el.removeAttribute('aria-current');
        }
      }
    });

  }, [activeTab]);

  // Determine footer variant and partner strip display based on current active tab
  const isFullFooterTab =
    activeTab === 'dashboard' ||
    activeTab === 'partners' ||
    activeTab === 'partner-detail';

  const showPartnerStrip =
    activeTab === 'dashboard' ||
    activeTab === 'partners';

  return (
    <section
      className={`app-view counselor-workspace w-full min-h-[calc(100vh-68px)] flex flex-col bg-white ${isActive ? 'active' : ''}`}
      id="view-counselor"
      style={isActive ? undefined : { display: 'none' }}
    >
      {isActive && (
        <div className="counselor-container w-full flex-1 flex flex-col">
          {/* ── FULL-WIDTH PAGE CONTENT & FOOTER SYSTEM (NO LEFT SIDEBAR) ── */}
          <main className="flex-1 min-w-0 w-full flex flex-col justify-between">
            <div className="counselor-content-body flex-1 w-full pb-6">
              {renderContent()}
            </div>

            {/* ── PARTNER TRUST STRIP (Dashboard & Partner Directory) ── */}
            {showPartnerStrip && (
              <PartnerTrustStrip onNavigate={handleNavigate} />
            )}

            {/* ── PRODUCT FOOTER SYSTEM (Full vs Compact) ── */}
            <CounselorFooter
              variant={isFullFooterTab ? 'full' : 'compact'}
              onNavigate={handleNavigate}
            />
          </main>
          <CounselorTourGuide onNavigateTab={handleNavigate} />
        </div>
      )}
    </section>
  );
}
