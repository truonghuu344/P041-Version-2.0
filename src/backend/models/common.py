from datetime import datetime

from pydantic import BaseModel, ConfigDict


class APIModel(BaseModel):
    """Shared validation and ORM serialization behavior for API contracts."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
    )


class TimestampedResponse(APIModel):
    created_at: datetime
    updated_at: datetime


class MessageResponse(APIModel):
    message: str
