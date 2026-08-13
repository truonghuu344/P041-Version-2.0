/* ============================================================
     MULTI-LANGUAGE (i18n) ENGINE - 2 Languages
     - vi: Tiếng Việt (Default)
     - en: English
     ============================================================ */
  const LANG_DATA = {
    vi: { code: 'VI', name: 'Tiếng Việt' },
    en: { code: 'EN', name: 'English' },
  };

  export const TRANSLATIONS = {
    vi: {
      'nav-dashboard': 'Tổng quan',
      'nav-cv': 'CV của tôi',
      'nav-find-jobs': 'Việc phù hợp',
      'nav-jobs': 'Danh sách JD',
      'nav-interview': 'Luyện phỏng vấn',
      'nav-history': 'Tiến độ',
      'nav-gap': 'Gap Analysis',
      'btn-login': 'Đăng nhập',
      'btn-logout': 'Đăng xuất',
      'hero-title': 'Nâng cấp CV và phỏng vấn, <span class="hero-title-accent">Agent của bạn đang đợi.</span>',
      'hero-sub': 'Công cụ AI hướng nghiệp tối ưu CV theo JD (Anti-Hallucination) & luyện phỏng vấn thử theo Rubric STAR.',
      'btn-try-free': 'THỬ PHỎNG VẤN NGAY',
      'btn-consult': 'Tối ưu CV với AI',
      'user-name-guest': 'Chưa đăng nhập',
      'user-role-default': 'Hệ thống Trợ Lý Nghề Nghiệp X',
      'tab-overview': 'Overview',
      'tab-interviews': 'Interviews',
      'tab-history': 'History',
      'summary-title': 'TÌNH TRẠNG HỒ SƠ',
      'label-cv-upload': 'Đã Upload CV',
      'badge-cv-status': 'Sẵn sàng',
      'label-interview-skills': 'Kỹ năng Phỏng vấn',
      'badge-interview-status': 'STAR Rubric',
      'label-ai-match': 'AI Match Score',
      'badge-match-score': 'Anti-Hallucination',
      'gauge-cv-label': 'Match Score (85%)',
      'gauge-interview-label': 'STAR Score (82/100)',
      'gauge-direction-label': 'Tiến Độ Tối Ưu',
      'chart-title': 'Lịch sử đánh giá phỏng vấn & tối ưu hồ sơ',
      'agent-title': 'Agent AI – Trí Tuệ<br />Nhân Tạo hỗ trợ',
      'feat-opt-name': 'Phân tích CV',
      'feat-opt-desc': 'Tối ưu theo JD',
      'feat-int-name': 'Phòng phỏng vấn',
      'feat-int-desc': 'STAR Rubric',
      'feat-match-name': 'Danh sách JD',
      'feat-match-desc': 'Việc làm phù hợp',
      'quick-access-badge': '✨ TRUY CẬP NHANH CÁC TÍNH NĂNG CỐT LÕI',
      'icon-label-cv': '📄 CV Scanner',
      'icon-label-jd': '💼 Thư viện JD',
      'icon-label-interview': '🎙️ Phỏng vấn STAR',
      'icon-label-gap': '🎯 Gap Analysis',
      'title-cv-btn': 'Upload & Quản lý CV',
      'title-jd-btn': 'Thư viện Job Descriptions (JD)',
      'title-int-btn': 'Phòng phỏng vấn thử STAR',
      'title-gap-btn': 'Chạy Gap Analysis (CV vs JD)',
      'pricing-tag': '⚡ NÂNG CẤP SỨC MẠNH AI',
      'pricing-title': 'Các Gói Dịch Vụ & Nâng Cấp',
      'pricing-sub': 'Lựa chọn gói phù hợp để làm chủ hành trình chinh phục mọi nhà tuyển dụng',
      'plan-basic-name': 'Gói Cơ Bản',
      'plan-basic-desc': 'Trải nghiệm các tính năng cốt lõi cho ứng viên mới bắt đầu',
      'plan-basic-price': '0đ',
      'plan-free-forever': '/ Trọn đời',
      'feat-b1': 'Tối ưu 3 CV cơ bản',
      'feat-b2': 'Luyện phỏng vấn STAR 5 lượt/tháng',
      'feat-b3': 'Tra cứu Thư viện JD mẫu hệ thống',
      'feat-b4': 'Anti-Hallucination chuyên sâu',
      'feat-b5': 'Tạo Custom Job Description',
      'btn-plan-basic': 'Bắt Đầu Miễn Phí',
      'badge-popular': '🔥 PHỔ BIẾN NHẤT',
      'plan-pro-name': 'Gói Pro Copilot',
      'plan-pro-desc': 'Tăng 300% cơ hội nhận Offer với sự trợ giúp toàn diện của AI Agent',
      'plan-pro-price': '199.000đ',
      'plan-period-month': '/ Tháng',
      'feat-p1': 'Không giới hạn tối ưu CV theo JD',
      'feat-p2': 'Luyện phỏng vấn STAR AI toàn diện & gợi mở follow-up',
      'feat-p3': 'Thuật toán Anti-Hallucination bảo toàn 100% độ thật',
      'feat-p4': 'Phân tích Gap Analysis & Đề xuất từ khóa ATS',
      'feat-p5': 'Xuất báo cáo đánh giá kỹ năng phỏng vấn PDF',
      'btn-plan-pro': 'Nâng Cấp Pro Ngay',
      'plan-ent-name': 'Gói Enterprise / Mentor',
      'plan-ent-desc': 'Giải pháp chuyên sâu cho Nhà tuyển dụng, HR & Chuyên gia Hướng nghiệp',
      'plan-ent-price': '499.000đ',
      'feat-e1': 'Tất cả đặc quyền của Gói Pro',
      'feat-e2': 'Tạo Custom Job Description không giới hạn',
      'feat-e3': 'Thiết lập bộ Rubric STAR phỏng vấn riêng',
      'feat-e4': 'Quản lý kho ứng viên & Phân tích khớp hồ sơ hàng loạt',
      'feat-e5': 'Hỗ trợ kỹ thuật 24/7 & API Integration',
      'btn-plan-enterprise': 'Liên Hệ Tư Vấn Enterprise',
      'stat-cv-label': 'CV Tối Ưu Thành Công',
      'stat-pass-label': 'Tỷ Lệ Vượt Qua Phỏng Vấn',
      'stat-rating-label': 'Đánh Giá Từ 5,000+ Ứng Viên',
      'stat-speed-label': 'Thời Gian Phân Tích Match Score',
      'testi-tag': '💬 CÂU CHUYỆN THÀNH CÔNG',
      'testi-title': 'Ứng Viên Nói Gì Về CV Assistant?',
      'testi-sub': 'Hàng ngàn ứng viên đã chinh phục được công việc mơ ước nhờ sự đồng hành của AI Agent',
      'testi-user1-text': '"Nhờ Gap Analysis mà tôi biết chính xác CV mình thiếu những từ khóa ATS nào đối với vị trí Senior Frontend. AI còn tự động tối ưu câu từ vô cùng chân thật!"',
      'testi-user1-role': 'Senior Frontend Engineer @ Top Tech Corp',
      'testi-user2-text': '"Luyện phỏng vấn STAR với AI Agent giúp tôi rèn luyện phản xạ tuyệt vời. Khi bước vào phỏng vấn thực tế với HR, tôi hoàn toàn tự tin trả lời gãy gọn mạch lạc!"',
      'testi-user2-role': 'Product Manager @ Fintech Startup',
      'testi-user3-text': '"Tính năng Anti-Hallucination là cứu cánh của tôi! CV không hề bị AI \'bốc phét\' thêm kinh nghiệm ảo, nhà tuyển dụng đánh giá rất cao độ trung thực."',
      'testi-user3-role': 'AI Research Specialist @ Global Hub'
    },
    en: {
      'nav-dashboard': 'Overview',
      'nav-cv': 'My CV',
      'nav-find-jobs': 'Matched jobs',
      'nav-jobs': 'JD List',
      'nav-interview': 'Interview practice',
      'nav-history': 'Progress',
      'nav-gap': 'Gap Analysis',
      'btn-login': 'Log in',
      'btn-logout': 'Log out',
      'hero-title': 'Improve your CV and interview skills. <span class="hero-title-accent">Your agent is waiting.</span>',
      'hero-sub': 'AI-powered career guidance tool to optimize your CV based on job descriptions (Anti-Hallucination) and practice mock interviews using the Rubric STAR method.',
      'btn-try-free': 'TRY INTERVIEWING NOW',
      'btn-consult': 'Optimize your CV with AI.',
      'user-name-guest': 'Not logged in',
      'user-role-default': 'Career Assistant System X',
      'tab-overview': 'Overview',
      'tab-interviews': 'Interviews',
      'tab-history': 'Association',
      'summary-title': 'APPLICATION STATUS',
      'label-cv-upload': 'CV has been uploaded.',
      'badge-cv-status': 'Ready',
      'label-interview-skills': 'Interview Skills',
      'badge-interview-status': 'STAR Rubric',
      'label-ai-match': 'AI Match Score',
      'badge-match-score': 'Anti-Hallucination',
      'gauge-cv-label': 'Match Score (85%)',
      'gauge-interview-label': 'STAR Score (82/100)',
      'gauge-direction-label': 'Optimal Progress',
      'chart-title': 'Interview evaluation history & resume optimization',
      'agent-title': 'AI Agent – Powered by<br />Artificial Intelligence',
      'feat-opt-name': 'CV Analysis',
      'feat-opt-desc': 'Optimize for JD',
      'feat-int-name': 'Interview Room',
      'feat-int-desc': 'STAR Rubric',
      'feat-match-name': 'JD List',
      'feat-match-desc': 'Matching jobs',
      'quick-access-badge': '✨ QUICK ACCESS TO CORE FEATURES',
      'icon-label-cv': '📄 CV Scanner',
      'icon-label-jd': '💼 JD Library',
      'icon-label-interview': '🎙️ STAR Interview',
      'icon-label-gap': '🎯 Gap Analysis',
      'title-cv-btn': 'Upload & Manage CV',
      'title-jd-btn': 'Job Descriptions Library',
      'title-int-btn': 'STAR Mock Interview Room',
      'title-gap-btn': 'Run Gap Analysis (CV vs JD)',
      'pricing-tag': '⚡ UPGRADE YOUR AI POWER',
      'pricing-title': 'Pricing Plans & Upgrades',
      'pricing-sub': 'Choose the right plan to master your job hunt with AI Copilot',
      'plan-basic-name': 'Basic Plan',
      'plan-basic-desc': 'Experience core AI features for beginners',
      'plan-basic-price': '$0',
      'plan-free-forever': '/ Free forever',
      'feat-b1': 'Optimize up to 3 basic CVs',
      'feat-b2': '5 STAR interview sessions / month',
      'feat-b3': 'Access system sample JDs library',
      'feat-b4': 'Deep Anti-Hallucination check',
      'feat-b5': 'Create Custom Job Descriptions',
      'btn-plan-basic': 'Start Free',
      'badge-popular': '🔥 MOST POPULAR',
      'plan-pro-name': 'Pro Copilot Plan',
      'plan-pro-desc': 'Boost your offer rate by 300% with full AI Agent support',
      'plan-pro-price': '$9.99',
      'plan-period-month': '/ Month',
      'feat-p1': 'Unlimited JD-targeted CV optimizations',
      'feat-p2': 'Comprehensive STAR AI mock interviews with follow-ups',
      'feat-p3': 'Anti-Hallucination algorithm ensures 100% truthfulness',
      'feat-p4': 'Deep Gap Analysis & ATS keyword recommendations',
      'feat-p5': 'Export interview evaluation reports to PDF',
      'btn-plan-pro': 'Upgrade to Pro',
      'plan-ent-name': 'Enterprise / Mentor Plan',
      'plan-ent-desc': 'Tailored solution for Recruiters, HRs & Career Coaches',
      'plan-ent-price': '$24.99',
      'feat-e1': 'All Pro Plan privileges included',
      'feat-e2': 'Unlimited Custom Job Descriptions',
      'feat-e3': 'Custom STAR interview rubric setup',
      'feat-e4': 'Candidate pool management & bulk resume matching',
      'feat-e5': '24/7 dedicated support & API integration',
      'btn-plan-enterprise': 'Contact Enterprise',
      'stat-cv-label': 'CVs Successfully Optimized',
      'stat-pass-label': 'Interview Pass Rate',
      'stat-rating-label': 'Rating from 5,000+ Candidates',
      'stat-speed-label': 'Match Score Analysis Time',
      'testi-tag': '💬 SUCCESS STORIES',
      'testi-title': 'What Candidates Say About CV Assistant',
      'testi-sub': 'Thousands of candidates landed their dream job with AI Agent assistance',
      'testi-user1-text': '"Thanks to Gap Analysis, I knew exactly which ATS keywords my CV was missing for the Senior Frontend role. AI rewrote it authentically without fluff!"',
      'testi-user1-role': 'Senior Frontend Engineer @ Top Tech Corp',
      'testi-user2-text': '"Practicing STAR interviews with AI Agent built my reflexes. When interviewing with HR, I answered confidently and structured every answer crisp!"',
      'testi-user2-role': 'Product Manager @ Fintech Startup',
      'testi-user3-text': '"Anti-Hallucination is a lifesaver! AI did not invent fake experiences on my CV. Recruiters praised my resume for its genuine transparency."',
      'testi-user3-role': 'AI Research Specialist @ Global Hub'
    }
  };

  export function initI18n() {
    const langSwitcher = document.getElementById('lang-switcher');
    const langBtn = document.getElementById('lang-btn');
    const currentCode = document.getElementById('lang-current-code');

    let currentLang = localStorage.getItem('career_copilot_lang') || 'vi';

    function applyLanguage(lang) {
      if (!LANG_DATA[lang]) lang = 'vi';
      currentLang = lang;
      localStorage.setItem('career_copilot_lang', lang);
      document.documentElement.lang = lang;

      if (currentCode) currentCode.textContent = LANG_DATA[lang].code;

      document.querySelectorAll('.lang-option').forEach(opt => {
        if (opt.dataset.lang === lang) {
          opt.classList.add('active');
        } else {
          opt.classList.remove('active');
        }
      });

      const dict = TRANSLATIONS[lang] || {};
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key] !== undefined) {
          if (el.getAttribute('data-i18n-html') === 'true') {
            el.innerHTML = dict[key];
          } else {
            el.textContent = dict[key];
          }
        } else if (process.env.NODE_ENV !== 'production') {
          console.warn(`[i18n] Missing translation for "${key}" in locale "${lang}".`);
        }
      });

      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key] !== undefined) {
          el.placeholder = dict[key];
        }
      });

      document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (dict[key] !== undefined) {
          el.title = dict[key];
        }
      });
    }

    if (langBtn && langSwitcher) {
      langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = langSwitcher.classList.contains('open');
        langSwitcher.classList.toggle('open', !isOpen);
        langBtn.setAttribute('aria-expanded', !isOpen);
      });

      document.addEventListener('click', (e) => {
        if (!langSwitcher.contains(e.target)) {
          langSwitcher.classList.remove('open');
          langBtn.setAttribute('aria-expanded', 'false');
        }
      });

      document.querySelectorAll('.lang-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const selectedLang = opt.dataset.lang;
          applyLanguage(selectedLang);
          langSwitcher.classList.remove('open');
          langBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }

    applyLanguage(currentLang);
  }