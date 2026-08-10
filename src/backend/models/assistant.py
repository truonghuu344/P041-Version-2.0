from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator

from src.backend.models.common import APIModel

AssistantRole = Literal["user", "assistant"]
AssistantPage = Literal[
    "dashboard",
    "cv",
    "jobs",
    "interview",
    "gap",
    "history",
    "profile",
    "counselor",
    "enterprise",
    "admin",
]


class AssistantHistoryMessage(APIModel):
    role: AssistantRole
    content: str = Field(min_length=1, max_length=8000)


class AssistantChatRequest(APIModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[AssistantHistoryMessage] = Field(default_factory=list, max_length=12)
    current_page: AssistantPage = "dashboard"
    conversation_id: str | None = Field(default=None, min_length=32, max_length=36)

    @field_validator("message")
    @classmethod
    def reject_blank_message(cls, message: str) -> str:
        if not message.strip():
            raise ValueError("Message must not be blank")
        return message.strip()


class SuggestedAction(APIModel):
    label: str = Field(min_length=1, max_length=80)
    page: AssistantPage


class AssistantChatResponse(APIModel):
    conversation_id: str
    response: str
    suggested_actions: list[SuggestedAction] = Field(default_factory=list)
    llm_succeeded: bool
    provider: str
    model: str
    tools_used: list[str] = Field(default_factory=list)


class AssistantStatusResponse(APIModel):
    configured: bool
    provider: str
    model: str
    weather_configured: bool
    configuration_issue: str | None = None
    agent_version: str = "1.0"


class ConversationMessageResponse(APIModel):
    id: str
    role: AssistantRole
    content: str
    provider: str | None = None
    model: str | None = None
    llm_succeeded: bool | None = None
    suggested_actions: list[SuggestedAction] = Field(default_factory=list)
    created_at: datetime


class ConversationSummaryResponse(APIModel):
    id: str
    title: str
    message_count: int = Field(ge=0)
    created_at: datetime
    updated_at: datetime


class ConversationDetailResponse(APIModel):
    id: str
    title: str
    messages: list[ConversationMessageResponse]
    created_at: datetime
    updated_at: datetime
