import uuid
from datetime import datetime
from typing import Annotated

from pydantic import EmailStr, Field, StringConstraints, field_validator, model_validator

from src.backend.db.models import UserRole
from src.backend.models.common import APIModel

Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class LoginRequest(APIModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RegisterRequest(APIModel):
    email: EmailStr
    password: Password
    full_name: str = Field(min_length=2, max_length=255)
    role: UserRole = UserRole.STUDENT

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
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime


class AuthResponse(APIModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class AdminUserCreateRequest(APIModel):
    email: EmailStr
    password: Password
    full_name: str = Field(min_length=2, max_length=255)
    role: UserRole


class AdminUserUpdateRequest(APIModel):
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    role: UserRole | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def require_at_least_one_change(self) -> "AdminUserUpdateRequest":
        if all(value is None for value in (self.email, self.full_name, self.role, self.is_active)):
            raise ValueError("At least one field must be supplied")
        return self
