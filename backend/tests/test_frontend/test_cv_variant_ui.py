from pathlib import Path

ROOT = Path(__file__).parents[3]
WIZARD = (ROOT / "frontend/components/candidate/CVVariantWizard.tsx").read_text(encoding="utf-8")
CLIENT = (ROOT / "frontend/lib/cvVariantsApi.ts").read_text(encoding="utf-8")
STYLE = (ROOT / "frontend/app/styles/cv-variants.css").read_text(encoding="utf-8")
LEGACY = (ROOT / "frontend/app.js").read_text(encoding="utf-8")


def test_cv_variant_wizard_covers_both_modes_and_full_publish_journey():
    for contract in (
        "HAS_CV",
        "NO_CV",
        "candidate_evidence_confirmed",
        "autosave",
        "Chấp nhận",
        "Từ chối",
        "Preview PDF",
        "Publish phiên bản",
        "Lịch sử revision",
        "Tải PDF",
    ):
        assert contract in WIZARD


def test_typed_v2_client_exposes_complete_api_surface_without_legacy_dom_logic():
    for endpoint in (
        "/api/v2/cv-variants",
        "/suggestions/",
        "/validate",
        "/publish",
        "/export",
    ):
        assert endpoint in CLIENT
    assert "interface CVVariant" in CLIENT
    assert "cvVariantsApi" not in LEGACY


def test_wizard_has_accessible_feedback_and_mobile_layout():
    assert 'role="alert"' in WIZARD
    assert 'aria-live="polite"' in WIZARD
    assert 'aria-label="Chọn cách tạo CV"' in WIZARD
    assert "button:focus-visible" in STYLE
    assert "@media (max-width: 760px)" in STYLE


def test_jd_picker_is_searchable_and_keyboard_accessible():
    for contract in (
        'role="combobox"',
        'role="listbox"',
        'role="option"',
        'aria-label="Tìm kiếm JD"',
        "normalizeSearchValue",
        "ArrowDown",
        "ArrowUp",
        "Escape",
        "Không tìm thấy JD",
    ):
        assert contract in WIZARD
    for class_name in (
        ".cv-jd-combobox-menu",
        ".cv-jd-combobox-search",
        ".cv-jd-combobox-option",
        ".cv-jd-combobox-empty",
    ):
        assert class_name in STYLE
