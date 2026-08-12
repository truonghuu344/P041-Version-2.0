from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND_ROOT = ROOT / "src" / "frontend"
APP_JS = (FRONTEND_ROOT / "app.js").read_text(encoding="utf-8")
PAGE_JS = (FRONTEND_ROOT / "app" / "page.tsx").read_text(encoding="utf-8")
STYLE_CSS = (FRONTEND_ROOT / "style.css").read_text(encoding="utf-8")


def test_cv_and_jd_selection_render_analysis_results_in_place():
    assert 'id="cv-analysis-cv-select"' in PAGE_JS
    assert 'id="cv-analysis-jd-select"' in PAGE_JS
    assert 'id="cv-analysis-results-card"' in PAGE_JS
    assert 'id="cv-analysis-result-content"' in PAGE_JS
    assert "ApiClient.runGapAnalysis(selectedCvId, selectedJdId)" in APP_JS
    assert "renderInlineCVAnalysis(analysis, selectedCvId, selectedJdId)" in APP_JS
    assert ".cv-analysis-results-card" in STYLE_CSS


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


def test_gap_analysis_dropdown_and_submit_contract_are_present():
    assert 'id="page-gap-select-cv"' in PAGE_JS
    assert 'id="page-gap-select-jd"' in PAGE_JS
    assert 'id="page-btn-run-gap"' in PAGE_JS
    assert "ApiClient.runGapAnalysis" in APP_JS
    assert ".gap-select-trigger" in STYLE_CSS


def test_assistant_gif_asset_exists_and_is_not_empty():
    asset = FRONTEND_ROOT / "public" / "assistant" / "idle-rotations-8dir.gif"
    assert asset.exists()
    assert asset.stat().st_size > 0
    assert 'src="/assistant/idle-rotations-8dir.gif"' in PAGE_JS
    assert '<img\n            id="ai-companion-source"' in PAGE_JS
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
    assert "enterprise: 'enterprise'" in APP_JS
    assert "admin: 'admin'" in APP_JS
    assert "function getRoleHomeView" in APP_JS
    assert "function canAccessView" in APP_JS
    assert "switchToRoleHome();" in APP_JS
    assert 'id="view-enterprise"' in PAGE_JS
    assert 'id="view-counselor"' in PAGE_JS
    assert 'id="view-admin"' in PAGE_JS
    assert "Dashboard Cố Vấn" in PAGE_JS
    assert "Dashboard Tuyển Dụng" in PAGE_JS
    assert "Quản trị hệ thống" in PAGE_JS
    assert "loadCounselorDashboard" in APP_JS
    assert "loadEnterpriseDashboard" in APP_JS


def test_menubar_matches_gate1_role_flows_without_icons():
    nav_markup = PAGE_JS.split('<nav className="nav-links"', 1)[1].split('</nav>', 1)[0]
    assert 'className="nav-icon"' not in nav_markup
    assert "const ROLE_NAV_ITEMS" in APP_JS
    assert "student: ['nav-dashboard', 'nav-cv', 'nav-find-jobs', 'nav-interview', 'nav-history']" in APP_JS
    assert "counselor: ['nav-counselor', 'nav-counselor-reports']" in APP_JS
    assert "enterprise: ['nav-enterprise', 'nav-jobs', 'nav-enterprise-applications']" in APP_JS
    assert 'Lịch sử &amp; Báo cáo' in nav_markup
    assert 'Sinh viên của tôi' in nav_markup
    assert 'Hồ sơ ứng tuyển' in nav_markup
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
    assert 'id="btn-open-template-gallery"' in PAGE_JS
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
    assert 'className="jd-select-wrap gap-select-shell cv-jd-select-shell"' in PAGE_JS
    assert "gap-select-search" in APP_JS
    assert ".cv-jd-select-shell .gap-select-menu" in STYLE_CSS
    assert 'id="cv-jd-upload-form"' in PAGE_JS
    assert 'accept=".pdf,.docx,.txt"' in PAGE_JS


def test_auth_role_dropdown_and_google_button_are_responsive_custom_controls():
    assert 'className="auth-role-select"' in PAGE_JS
    assert 'className="auth-role-native"' in PAGE_JS
    assert "function enhanceAuthRoleSelect()" in APP_JS
    assert "className = 'auth-role-trigger'" in APP_JS
    assert "className = 'auth-role-menu'" in APP_JS
    assert "theme: 'filled_black'" in APP_JS
    assert ".auth-role-option.is-selected" in STYLE_CSS
    assert ".google-signin-button iframe" in STYLE_CSS
    assert "max-height: calc(100dvh - 40px)" in STYLE_CSS


def test_enterprise_jd_supports_template_file_or_manual_text():
    assert 'id="page-download-jd-template"' in PAGE_JS
    assert 'id="page-upload-jd-form"' in PAGE_JS
    assert 'accept=".pdf,.docx,.txt"' in PAGE_JS
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
