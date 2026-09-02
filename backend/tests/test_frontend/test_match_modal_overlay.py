from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
APP_JS = (ROOT / "frontend" / "app.js").read_text(encoding="utf-8")
MATCH_CSS = (ROOT / "frontend" / "app" / "styles" / "match.css").read_text(encoding="utf-8")


def test_match_modal_covers_viewport_and_locks_background_scroll():
    assert "width: 100vw" in MATCH_CSS
    assert "height: 100dvh" in MATCH_CSS
    assert "html.match-modal-open" in MATCH_CSS
    assert "position: fixed;" in MATCH_CSS
    assert "overflow-y: auto" in MATCH_CSS
    assert "document.documentElement.classList.add('match-modal-open')" in APP_JS
    assert "document.documentElement.classList.remove('match-modal-open')" in APP_JS
