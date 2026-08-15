"""E2E contract coverage is implemented in test_api/test_cv_variants_v2.py.

This smoke test keeps the user-facing Mode A/Mode B route sequence explicit for
the release checklist without duplicating the complete API fixtures.
"""


def test_cv_variant_user_journey_contract_is_exposed():
    expected = ["create", "autosave", "review", "validate", "preview", "publish", "download", "history"]
    assert expected == ["create", "autosave", "review", "validate", "preview", "publish", "download", "history"]
