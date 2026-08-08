from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP_JS = (ROOT / "frontend" / "app.js").read_text(encoding="utf-8")
PAGE_JS = (ROOT / "frontend" / "app" / "page.js").read_text(encoding="utf-8")
STYLE_CSS = (ROOT / "frontend" / "style.css").read_text(encoding="utf-8")


def test_cv_bulk_delete_controls_and_api_are_wired():
    assert 'id="btn-delete-selected-cvs"' in PAGE_JS
    assert 'id="cv-select-all"' in PAGE_JS
    assert "ApiClient.bulkDeleteCVs" in APP_JS
    assert "selectedCVIds" in APP_JS
    assert ".cv-bulk-delete" in STYLE_CSS


def test_nova_widget_has_accessible_open_close_controls():
    assert 'id="ai-companion-avatar"' in PAGE_JS
    assert 'aria-label="Mở chat với trợ lý AI Nova"' in PAGE_JS
    assert 'id="ai-companion-close"' in PAGE_JS
    assert 'aria-label="Đóng cửa sổ chat"' in PAGE_JS
    assert "companion.hidden = isOpen" in APP_JS
    assert "panel.hidden = !isOpen" in APP_JS


def test_nova_uses_authenticated_backend_and_handles_expired_session():
    assert "requestAssistant('/assistant/chat'" in APP_JS
    assert "Phiên đăng nhập đã hết hạn" in APP_JS
    assert "ApiClient.logout()" in APP_JS


def test_gap_analysis_dropdown_and_submit_contract_are_present():
    assert 'id="page-gap-select-cv"' in PAGE_JS
    assert 'id="page-gap-select-jd"' in PAGE_JS
    assert 'id="page-btn-run-gap"' in PAGE_JS
    assert "ApiClient.runGapAnalysis" in APP_JS
    assert ".gap-select-trigger" in STYLE_CSS


def test_assistant_gif_asset_exists_and_is_not_empty():
    asset = ROOT / "frontend" / "public" / "assistant" / "idle-rotations-8dir.gif"
    assert asset.exists()
    assert asset.stat().st_size > 0


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


def test_enterprise_role_keeps_all_student_features_visible():
    assert "function applyRoleAccess(user)" in APP_JS
    assert "user?.role === 'enterprise'" not in APP_JS
    assert "targetViewName !== 'jobs'" not in APP_JS
    assert "body.role-enterprise .ai-companion-chat" not in STYLE_CSS


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
