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
