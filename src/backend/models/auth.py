from datetime import datetime
from typing import Annotated

from pydantic import EmailStr, Field, StringConstraints, field_validator, model_validator

from src.backend.db.models import UserRole
from src.backend.models.common import APIModel

Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


def _normalize_email(value: EmailStr) -> str:
    return str(value).strip().lower()


def _validate_password_strength(password: str) -> str:
    if any(character.isspace() for character in password):
        raise ValueError("Password must not contain whitespace")
    if not any(character.islower() for character in password):
        raise ValueError("Password must contain a lowercase letter")
    if not any(character.isupper() for character in password):
        raise ValueError("Password must contain an uppercase letter")
    if not any(character.isdigit() for character in password):
        raise ValueError("Password must contain a number")
    return password


def _normalize_full_name(full_name: str) -> str:
    normalized = " ".join(full_name.split())
    if len(normalized) < 2:
        raise ValueError("Full name must contain at least 2 characters")
    return normalized


class LoginRequest(APIModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, email: EmailStr) -> str:
        return _normalize_email(email)


class RegisterRequest(APIModel):
    email: EmailStr
    password: Password
    full_name: str = Field(min_length=2, max_length=255)
    role: UserRole = UserRole.STUDENT

    @field_validator("email")
    @classmethod
    def normalize_email(cls, email: EmailStr) -> str:
        return _normalize_email(email)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, password: str) -> str:
        return _validate_password_strength(password)

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, full_name: str) -> str:
        return _normalize_full_name(full_name)

    @field_validator("role")
    @classmethod
    def reject_admin_self_registration(cls, role: UserRole) -> UserRole:
        if role is UserRole.ADMIN:
            raise ValueError("Admin accounts cannot be self-registered")
        return role


class GoogleAuthRequest(APIModel):
    credential: str = Field(min_length=20, max_length=8192)
    role: UserRole = UserRole.STUDENT

    @field_validator("role")
    @classmethod
    def reject_admin_google_registration(cls, role: UserRole) -> UserRole:
        if role is UserRole.ADMIN:
            raise ValueError("Admin accounts cannot be self-registered")
        return role


class UserResponse(APIModel):
    id: str = Field(min_length=32, max_length=36)
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime

    @field_validator("id", mode="before")
    @classmethod
    def stringify_id_without_normalizing_legacy_values(cls, user_id: object) -> str:
        return str(user_id)


class AuthResponse(APIModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class AdminUserCreateRequest(APIModel):
    email: EmailStr
    password: Password
    full_name: str = Field(min_length=2, max_length=255)
    role: UserRole

    @field_validator("email")
    @classmethod
    def normalize_email(cls, email: EmailStr) -> str:
        return _normalize_email(email)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, password: str) -> str:
        return _validate_password_strength(password)

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, full_name: str) -> str:
        return _normalize_full_name(full_name)


class AdminUserUpdateRequest(APIModel):
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    role: UserRole | None = None
    is_active: bool | None = None
    password: Password | None = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, email: EmailStr | None) -> str | None:
        return _normalize_email(email) if email is not None else None

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, full_name: str | None) -> str | None:
        return _normalize_full_name(full_name) if full_name is not None else None

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, password: str | None) -> str | None:
        return _validate_password_strength(password) if password is not None else None

    @model_validator(mode="after")
    def require_at_least_one_change(self) -> "AdminUserUpdateRequest":
        if all(
            value is None
            for value in (self.email, self.full_name, self.role, self.is_active, self.password)
        ):
            raise ValueError("At least one field must be supplied")
        return self
