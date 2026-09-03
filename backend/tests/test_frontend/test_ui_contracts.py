from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FRONTEND_ROOT = ROOT / "frontend"
APP_JS = (FRONTEND_ROOT / "app.js").read_text(encoding="utf-8")
PAGE_SOURCE = (FRONTEND_ROOT / "app" / "page.tsx").read_text(encoding="utf-8")
# The application is composed from React view components. Keep this source
# contract at the rendered-source level rather than assuming every DOM id
# remains in app/page.tsx after a component extraction.
COMPONENT_SOURCE = "\n".join(
    path.read_text(encoding="utf-8")
    for path in sorted((FRONTEND_ROOT / "components").rglob("*.tsx"))
)
PAGE_JS = f"{PAGE_SOURCE}\n{COMPONENT_SOURCE}"
STYLE_CSS = (FRONTEND_ROOT / "app" / "styles" / "legacy.css").read_text(encoding="utf-8")
MATCH_CSS = (FRONTEND_ROOT / "app" / "styles" / "match.css").read_text(encoding="utf-8")
NEXT_CONFIG = (FRONTEND_ROOT / "next.config.mjs").read_text(encoding="utf-8")


def test_next_dev_cache_is_isolated_from_production_build_output():
    assert "process.env.NODE_ENV === 'development'" in NEXT_CONFIG
    assert "distDir: isDevelopment ? 'node_modules/.cache/next-dev' : '.next'" in NEXT_CONFIG


def test_filtered_job_search_with_a_cv_keeps_evidence_evaluation_enabled():
    """Filters must narrow v2 recommendations, not downgrade them to catalogue cards."""
    assert "if (hasExplicitFilters && !activeJobSearchCV)" in APP_JS
    assert "filters must be sent to\n    // the v2 recommendation endpoint below" in APP_JS


def test_cv_and_jd_selection_open_analysis_results_in_gap_modal():
    assert 'id="cv-analysis-cv-select"' in PAGE_JS
    assert 'id="cv-analysis-jd-select"' in PAGE_JS
    assert 'id="cv-analysis-results-card"' in PAGE_JS
    assert 'id="cv-analysis-result-content"' in PAGE_JS
    assert "ApiClient.startMatch(selectedCvId, selectedJdId)" in APP_JS
    assert "waitForMatchResult(match.match_id)" in APP_JS
    assert "renderInlineCVAnalysis(analysis, selectedCvId, selectedJdId)" in APP_JS
    assert ".cv-analysis-results-card" in STYLE_CSS
    assert 'id="gap-result-overlay"' in PAGE_JS
    assert 'role="dialog"' in PAGE_JS
    assert "openGapResultModal();" in APP_JS
    assert "cvAnalysisResultsCard?.scrollIntoView" not in APP_JS
    assert ".gap-result-modal[hidden]" in MATCH_CSS
    assert "body.gap-result-modal-open #view-match.app-view.active" in MATCH_CSS
    assert "transform: none !important" in MATCH_CSS
    assert "place-items: center" in MATCH_CSS
    assert "max-height: calc(100dvh - 108px)" in MATCH_CSS
    assert 'id="p1-analysis-journey"' not in PAGE_JS
    assert "matchButton.textContent = `Đang phân tích ${progress}%`" in APP_JS


def test_gap_modal_shows_compact_user_facing_result_and_ai_action():
    for element_id in (
        "cv-result-match-score",
        "cv-result-groups-container",
        "pill-count-matched",
        "pill-count-partial",
        "pill-count-missing",
        "pill-count-uncertain",
        "btn-optimize-cv-ai",
    ):
        assert f'id="{element_id}"' in PAGE_JS
    for obsolete_match_element_id in (
        "cv-result-requirement-evidence",
        "cv-result-score-breakdown",
        "cv-result-criteria",
        "cv-result-learning-actions",
        "cv-result-certifications",
        "cv-result-projects",
        "cv-result-priority-actions",
        "cv-result-suggestions-preview",
    ):
        assert f'id="{obsolete_match_element_id}"' not in PAGE_JS
    assert "function getJDRelevantOptimizationSuggestions(analysis)" in APP_JS
    assert "standaloneContactPattern.test(original)" in APP_JS
    assert "static async optimizeResume(analysisId, optimizationMode = 'balanced', language = 'vi')" in APP_JS
    assert "return await this.request(`/analysis/${analysisId}/optimize`" in APP_JS
    assert "ApiClient.optimizeResume(analysis.id" in APP_JS
    assert "function renderResumeOptimizationReview(result, analysis)" in APP_JS
    assert "CV cần cải thiện những gì?" in APP_JS
    assert "Kế hoạch cải thiện theo từng phần" in APP_JS
    assert "Kỹ năng JD còn thiếu" in APP_JS
    assert "Vì sao cần sửa?" in APP_JS
    assert "Bằng chứng trong CV:" in APP_JS
    assert "Liên quan trực tiếp tới yêu cầu JD:" in APP_JS
    assert "function downloadOptimizedCVBlob(blob, cvLabel = 'CV')" in APP_JS
    assert "await Promise.all(changes.map((item, index)" in APP_JS
    assert "ApiClient.downloadCV(cvId, analysis.id)" in APP_JS
    assert "downloadOptimizedCVBlob(blob, cvLabel)" in APP_JS
    assert 'class="cv-optimization-reject"' not in APP_JS
    assert 'class="cv-optimization-accept"' not in APP_JS
    assert "Từ chối</button>" not in APP_JS
    assert "Chấp nhận</button>" not in APP_JS
    assert "Tối ưu lại" in APP_JS
    assert "CV gốc vẫn được giữ nguyên" in APP_JS


def test_job_selection_modal_is_centered_against_the_viewport():
    assert 'id="job-preview-modal"' in PAGE_JS
    assert 'className="cv-modal-overlay job-preview-modal"' in PAGE_JS
    assert 'role="dialog"' in PAGE_JS
    assert "document.body.classList.add('job-preview-modal-open')" in APP_JS
    assert "document.body.classList.remove('job-preview-modal-open')" in APP_JS
    assert "body.job-preview-modal-open #view-match.app-view.active" in MATCH_CSS
    assert "#view-match .job-preview-modal" in MATCH_CSS
    assert "max-height: min(500px, calc(100dvh - 285px))" in MATCH_CSS
    assert "function buildJobPreviewSections(job)" in APP_JS
    assert 'class="job-preview-hero"' in APP_JS
    assert 'class="job-preview-meta"' in APP_JS
    assert 'class="job-preview-skills"' in APP_JS
    assert 'class="job-preview-section"' in APP_JS
    assert "sections.find(section => section.title === current.title)" in APP_JS
    assert "current.title === 'Giới thiệu công ty' && looksLikeLooseKeyword" in APP_JS


def test_saved_cv_cards_select_the_cv_for_match_directly():
    assert 'role="button" tabindex="0" aria-pressed=' in APP_JS
    assert "selectSavedCV(card.getAttribute('data-cv-id'))" in APP_JS
    assert "cvAnalysisCvSelect.value = String(cvId)" in APP_JS
    assert "cvPageFileInput.value = ''" in APP_JS
    assert "cvAnalysisCvSelect.dispatchEvent(new Event('change', { bubbles: true }))" in APP_JS


def test_match_ui_controller_does_not_reference_start_app_local_variables():
    controller = APP_JS.split("(function initP1UI()", 1)[1]
    assert "jobSearchResults?." not in controller
    assert "showToast(" not in controller
    assert "openAuthModal" not in controller
    assert "switchView(" not in controller
    assert "document.addEventListener('career:match-ui-update', updateP1UI)" in controller
    assert "document.dispatchEvent(new Event('career:match-ui-update'))" in APP_JS


def test_frontend_defines_shared_dom_rendering_helpers():
    assert "function formatTextToHTML(value = '')" in APP_JS
    assert "function applyDomField(id, property, value, missingIds = [])" in APP_JS


def test_gap_analysis_replaces_static_roadmap_with_compact_actionable_result():
    assert 'trajectory-roadmap-card' not in PAGE_JS
    for element_id in (
        'cv-result-match-score',
        'cv-result-groups-container',
        'pill-count-matched',
        'pill-count-missing',
        'btn-optimize-cv-ai',
    ):
        assert f'id="{element_id}"' in PAGE_JS
    assert "analysis.integrity_guardrail" in APP_JS
    assert 'id="view-gap"' in PAGE_JS
    assert 'id="view-gap"' not in PAGE_SOURCE
    assert 'id="btn-open-full-gap-result"' not in PAGE_JS


def test_counselor_dashboard_shows_actual_kpis_and_before_after_progress():
    assert 'id="counselor-kpi-overview"' in PAGE_JS
    assert "ApiClient.getProductMetrics()" in APP_JS
    assert "data.first_interview_score" in APP_JS
    assert "data.latest_interview_score" in APP_JS
    assert "data.interview_score_delta" in APP_JS
    assert "data.average_csat" in APP_JS
    assert ".counselor-progress-summary" in STYLE_CSS


def test_nova_widget_has_accessible_open_close_controls():
    assert 'id="ai-companion-avatar"' in PAGE_JS
    assert 'aria-label="Mở chat với trợ lý AI Nova"' in PAGE_JS
    assert 'id="ai-companion-close"' in PAGE_JS
    assert 'aria-label="Đóng cửa sổ chat"' in PAGE_JS
    assert "companion.hidden = isOpen" in APP_JS
    assert "panel.hidden = !isOpen" in APP_JS


def test_nova_uses_authenticated_backend_and_handles_expired_session():
    assert "requestAssistant('/assistant/chat'" in APP_JS
    assert "if (!ApiClient.isAuthenticated())" in APP_JS
    assert "if (!ApiClient.getToken())" not in APP_JS
    assert "Phiên đăng nhập đã hết hạn" in APP_JS
    assert "ApiClient.logout()" in APP_JS


def test_inline_analysis_and_interview_dropdown_contract_are_present():
    assert 'id="page-gap-select-cv"' not in PAGE_JS
    assert 'id="page-gap-select-jd"' not in PAGE_JS
    assert 'id="page-btn-run-gap"' not in PAGE_JS
    assert 'id="page-interview-select-cv"' in PAGE_JS
    assert 'id="page-interview-select-jd"' in PAGE_JS
    assert "ApiClient.runGapAnalysis" in APP_JS
    assert ".gap-select-trigger" in STYLE_CSS
    assert ".interview-select-shell .gap-select-value" in STYLE_CSS
    assert "grid-template-columns: minmax(170px, 0.42fr) minmax(0, 1.58fr);" in STYLE_CSS


def test_assistant_source_asset_exists_and_is_not_empty():
    asset = FRONTEND_ROOT / "public" / "images" / "chatbot.png"
    assert asset.exists()
    assert asset.stat().st_size > 0
    assert 'id="ai-companion-source"' in PAGE_JS
    assert ".ai-companion-source {" in STYLE_CSS
    assert "opacity: 0;" in STYLE_CSS
    assert "spriteContext.drawImage(sourceImage" in APP_JS


def test_nova_conversation_history_is_connected_to_persistent_api():
    assert 'id="ai-companion-history"' in PAGE_JS
    assert 'id="ai-companion-history-panel"' in PAGE_JS
    assert "ApiClient.listAssistantConversations" in APP_JS
    assert "ApiClient.getAssistantConversation" in APP_JS
    assert "ApiClient.deleteAssistantConversation" in APP_JS
    assert "currentConversationId = result.conversation_id" in APP_JS
    assert ".ai-chat-history-item" in STYLE_CSS


def test_nova_legacy_gap_actions_open_the_current_cv_analysis_view():
    assert "action.page === 'gap' ? 'cv' : action.page" in APP_JS
    assert "button.dataset.assistantTarget = targetPage" in APP_JS


def test_admin_ai_log_view_is_admin_portal_contract():
    assert 'id="admin-tab-ai-logs"' in PAGE_JS
    assert 'id="admin-ai-log-list"' in PAGE_JS
    assert 'id="admin-ai-log-search"' in PAGE_JS
    assert "ApiClient.listAILogs" in APP_JS
    assert "ApiClient.getAILogStats" in APP_JS
    assert ".ai-log-card" in STYLE_CSS


def test_role_specific_dashboards_are_wired():
    assert "function applyRoleAccess(user)" in APP_JS
    assert "const ROLE_HOME_VIEWS" in APP_JS
    assert "student: 'dashboard'" in APP_JS
    assert "counselor: 'counselor'" in APP_JS
    assert "admin: 'admin'" in APP_JS
    assert "function getRoleHomeView" in APP_JS
    assert "function canAccessView" in APP_JS
    assert "switchToRoleHome();" in APP_JS
    assert 'id="view-counselor"' in PAGE_JS
    assert 'id="view-admin"' in PAGE_JS
    assert "Cố vấn" in PAGE_JS
    assert "loadCounselorDashboard" in APP_JS


def test_menubar_matches_gate1_role_flows_without_icons():
    nav_markup = PAGE_JS.split('<nav className="nav-links"', 1)[1].split('</nav>', 1)[0]
    assert 'className="nav-icon"' not in nav_markup
    assert "const ROLE_NAV_ITEMS" in APP_JS
    assert "student: ['nav-dashboard', 'nav-match', 'nav-interview', 'nav-cv', 'nav-find-jobs', 'nav-history', 'nav-gap']" in APP_JS
    assert "Student:    Trang chủ | So khớp CV | Phỏng vấn | CV của tôi | Việc làm | Lịch sử &amp; Báo cáo" in PAGE_JS
    assert "counselor: ['nav-counselor', 'nav-counselor-reports']" in APP_JS
    assert 'Lịch sử &amp; Báo cáo' in nav_markup
    assert 'Sinh viên của tôi' in nav_markup
    assert "font-weight: 700 !important;" in STYLE_CSS
    assert "--font: 'Quicksand'" in STYLE_CSS
    assert "@font-face" in STYLE_CSS
    assert "SOFT CYAN PALETTE" in STYLE_CSS


def test_job_search_menu_and_cv_matching_flow_are_connected():
    assert 'id="nav-find-jobs"' in PAGE_JS
    assert 'id="view-find-jobs"' in PAGE_JS
    assert 'id="job-search-form"' in PAGE_JS
    assert 'id="job-search-cv-select"' in PAGE_JS
    assert 'id="job-match-cv-btn"' in PAGE_JS
    assert "switchView('find-jobs')" in APP_JS
    assert "ApiClient.searchJobs" in APP_JS
    assert "initializeJobSearchView" in APP_JS


def test_google_signin_uses_official_button_without_programmatic_one_tap_popup():
    nginx_config = (ROOT / "infra" / "nginx" / "nginx.conf").read_text(encoding="utf-8")
    assert 'id="google-signin-button"' in PAGE_JS
    assert "window.google.accounts.id.renderButton" in APP_JS
    assert "ux_mode: 'popup'" in APP_JS
    assert "use_fedcm_for_prompt: true" in APP_JS
    assert "window.google.accounts.id.prompt" not in APP_JS
    assert "Cross-Origin-Opener-Policy same-origin-allow-popups" in nginx_config


def test_google_quicksand_is_self_hosted_and_used_as_the_shared_font():
    layout = (FRONTEND_ROOT / "app" / "layout.tsx").read_text(encoding="utf-8")
    assert "next/font/google" not in layout
    assert '<html lang="vi" suppressHydrationWarning>' in layout
    assert "font-family: 'Quicksand'" in STYLE_CSS
    assert "--font: 'Quicksand'" in STYLE_CSS
    for font_file in (
        "quicksand-vietnamese.woff2",
        "quicksand-latin-ext.woff2",
        "quicksand-latin.woff2",
    ):
        assert f"/fonts/{font_file}" in STYLE_CSS
        assert (FRONTEND_ROOT / "public" / "fonts" / font_file).is_file()


def test_create_cv_gallery_offers_three_distinct_downloadable_templates():
    assert 'id="cv-template-modal-overlay"' in PAGE_JS
    assert "onClick={() => setIsTemplateGalleryOpen(true)}" in PAGE_JS
    assert "className={`modal-overlay${isTemplateGalleryOpen ? ' open' : ''}`}" in PAGE_JS
    assert "const selectCVTemplate" in PAGE_JS
    assert "setSelectedCVTemplate(templateName)" in PAGE_JS
    assert 'hidden={!selectedCVTemplate}' in PAGE_JS
    assert PAGE_JS.count('className="template-download-btn"') == 3
    assert PAGE_JS.count('href="/api/v1/cvs/templates/') == 3
    assert 'className="template-preview template-preview-modern"' in PAGE_JS
    assert 'className="template-preview template-preview-classic"' in PAGE_JS
    assert 'className="template-preview template-preview-creative"' in PAGE_JS
    assert ".template-gallery-grid" in STYLE_CSS


def test_cv_target_jd_supports_data_catalog_or_file_upload():
    assert "ApiClient.searchJobs('', '', 100)" in APP_JS
    assert "ApiClient.selectCatalogJD(sourceId)" in APP_JS
    assert "JD DOANH NGHIỆP TRONG DATA/JDS" in APP_JS
    assert 'id="p1-job-explore-panel"' in PAGE_JS
    assert 'id="p1-job-search"' in PAGE_JS
    assert 'id="p1-job-grid"' in PAGE_JS
    assert "gap-select-search" in APP_JS
    assert ".cv-jd-select-shell .gap-select-menu" in STYLE_CSS
    assert 'id="cv-jd-upload-form"' in PAGE_JS
    assert 'accept=".pdf,.docx,.txt,image/*"' in PAGE_JS


def test_auth_role_dropdown_and_google_button_are_responsive_custom_controls():
    """Role onboarding contract: /login never picks a role."""
    # 1. No client-side role selection anywhere in the shared auth UI.
    assert 'className="auth-role-select"' not in PAGE_JS
    assert 'className="auth-role-native"' not in PAGE_JS
    assert "function enhanceAuthRoleSelect()" not in APP_JS
    assert 'id="form-role-group"' not in PAGE_JS

    # 2. Admin provisioning keeps its own role select.
    assert 'id="admin-input-role"' in PAGE_JS

    # 3. Official Google button stays on both the login modal and the student surface.
    assert "theme: 'filled_black'" in APP_JS
    assert ".google-signin-button iframe" in STYLE_CSS
    assert "max-height: calc(100dvh - 40px)" in STYLE_CSS


def test_enterprise_jd_supports_template_file_or_manual_text():
    assert 'id="page-download-jd-template"' in PAGE_JS
    assert 'id="page-upload-jd-form"' in PAGE_JS
    assert 'accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"' in PAGE_JS
    assert 'id="page-custom-jd-form"' in PAGE_JS
    assert "ApiClient.uploadJD" in APP_JS
    assert "JD_TEMPLATE_CONTENT" in APP_JS
    assert ".jd-create-grid" in STYLE_CSS


def test_nova_is_global_and_preserved_when_switching_views():
    assert 'id="ai-companion"' in PAGE_JS
    assert 'id="ai-companion-chat"' in PAGE_JS
    assert "Nova nằm ngoài các app-view và luôn khả dụng trên mọi trang/role" in APP_JS
    assert "novaCompanion.hidden = false" in APP_JS
    assert ".ai-companion-chat" in STYLE_CSS
    assert "position: fixed" in STYLE_CSS


def test_logout_clears_forms_text_fields_and_session_ui():
    assert "function resetUIAfterLogout()" in APP_JS
    assert "document.querySelectorAll('form').forEach(form => form.reset())" in APP_JS
    assert "document.querySelectorAll('input, textarea')" in APP_JS
    assert "window.dispatchEvent(new Event('career:session-cleared'))" in APP_JS
    assert "performLogout();" in APP_JS


def test_resume_optimizer_uses_long_running_proxy_and_reports_zero_safe_patches():
    optimize_route = (
        FRONTEND_ROOT / "app" / "api" / "v1" / "analysis" / "[analysisId]" / "optimize" / "route.ts"
    ).read_text(encoding="utf-8")
    assert "export const maxDuration = 180" in optimize_route
    assert "cache: 'no-store'" in optimize_route
    assert "await request.arrayBuffer()" in optimize_route
    assert "Vì sao các nội dung không được áp dụng?" in APP_JS
    assert "AI đã kiểm tra nhưng chưa có thay đổi nào đủ bằng chứng để áp dụng" in APP_JS
    assert "throw new Error('Không có nội dung nào đủ bằng chứng" not in APP_JS


def test_interview_timeout_ends_session_instead_of_submitting_empty_answer():
    """Hết 10 phút phải kết thúc phiên và ra báo cáo STAR, không được treo.

    Bản cũ gửi 'submit_answer' rồi dừng đồng hồ. Nếu ứng viên chưa kịp nói gì thì
    text rỗng, backend trả "Không nhận được câu trả lời." rồi tiếp tục chờ —
    phiên treo vĩnh viễn ở 10:00 và không bao giờ có báo cáo. Đồng hồ đã dừng nên
    cũng không thử lại lần nào nữa. Quan sát được trên giao diện thật.
    """
    timeout_block = APP_JS.split("elapsed >= MAX_INTERVIEW_MS")[1][:800]
    assert "'end_session'" in timeout_block, "hết giờ phải gửi end_session"
    # Câu đang dở vẫn phải được gửi trước khi kết thúc, nếu không là mất câu cuối.
    assert "pendingAnswer" in timeout_block
    assert "stopVoiceTimer();" in timeout_block


def test_jd_list_inflight_is_declared_before_jobs_tab_bootstrap():
    """Khai báo `let` phải đứng TRƯỚC chỗ gọi, nếu không vào /student/jobs là sập.

    Khối bootstrap ở cuối app.js gọi renderStudentJobsTab() ngay lúc khởi tạo
    module khi pathname là /student/jobs. Chuỗi gọi dẫn tới loadPageJDList(),
    hàm này đọc `loadPageJDListInFlight`.

    `function` được hoisted, `let` thì không. Có lúc khai báo nằm SAU chỗ gọi 21
    dòng, nên trang ném ReferenceError (temporal dead zone) và cắt đứt toàn bộ
    phần khởi tạo còn lại của app.js — URL bật về /student, giao diện kẹt ở hero
    mờ, không có thông báo lỗi nào cho người dùng.
    """
    declaration = APP_JS.find("let loadPageJDListInFlight")
    bootstrap = APP_JS.find("window.location.pathname === '/student/jobs'")

    assert declaration != -1, "không tìm thấy khai báo loadPageJDListInFlight"
    assert bootstrap != -1, "không tìm thấy khối bootstrap của tab việc làm"
    assert declaration < bootstrap, (
        "khai báo `let loadPageJDListInFlight` phải đứng trước khối bootstrap "
        "/student/jobs, nếu không trang sẽ ném ReferenceError lúc khởi tạo"
    )
