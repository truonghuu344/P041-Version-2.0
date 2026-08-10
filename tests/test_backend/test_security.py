import uuid
from datetime import UTC, datetime

import bcrypt
import pytest

from src.backend.core.security import (
    InvalidAccessTokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from src.backend.db.models import UserRole


def test_password_hash_is_salted_and_verifiable() -> None:
    first_hash = hash_password("Strong-password1")
    second_hash = hash_password("Strong-password1")

    assert first_hash != second_hash
    assert "Strong-password1" not in first_hash
    assert verify_password("Strong-password1", first_hash) is True
    assert verify_password("Wrong-password1", first_hash) is False
    assert verify_password("Strong-password1", "not-a-valid-hash") is False


def test_legacy_bcrypt_password_is_still_verifiable() -> None:
    legacy_hash = bcrypt.hashpw(b"Legacy-password1", bcrypt.gensalt()).decode("ascii")

    assert verify_password("Legacy-password1", legacy_hash) is True
    assert verify_password("Wrong-password1", legacy_hash) is False


def test_access_token_contains_valid_user_claims() -> None:
    user_id = uuid.uuid4()
    token = create_access_token(user_id, UserRole.STUDENT)

    payload = decode_access_token(token)

    assert payload["sub"] == str(user_id)
    assert payload["role"] == UserRole.STUDENT.value
    assert payload["type"] == "access"


def test_expired_access_token_is_rejected() -> None:
    token = create_access_token(
        uuid.uuid4(),
        UserRole.STUDENT,
        now=datetime(2000, 1, 1, tzinfo=UTC),
    )

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(token)
