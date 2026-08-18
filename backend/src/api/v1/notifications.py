from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import get_current_user
from src.db.database import get_db
from src.db.models import User
from src.models.schemas import (
    NotificationOut,
    NotificationPreferenceOut,
    NotificationPreferenceUpdate,
    NotificationUnreadCountOut,
)
from src.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    category: Annotated[str | None, Query(description="Filter by category: all, application, job, interview, advisor, candidate, offer, message")] = "all",
    unread_only: Annotated[bool, Query(description="Only return unread notifications")] = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationOut]:
    """Lấy danh sách thông báo của người dùng hiện tại theo role và filters."""
    notifications = await NotificationService.get_user_notifications(
        db=db,
        user_id=current_user.id,
        category=category,
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )
    return [NotificationOut.model_validate(n) for n in notifications]


@router.get("/unread-count", response_model=NotificationUnreadCountOut)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationUnreadCountOut:
    """Lấy số lượng thông báo chưa đọc phục vụ Header Bell Badge."""
    unread, total = await NotificationService.get_unread_count(db=db, user_id=current_user.id)
    return NotificationUnreadCountOut(unread_count=unread, total_count=total)


@router.patch("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationOut:
    """Đánh dấu một thông báo là đã đọc."""
    notification = await NotificationService.mark_as_read(
        db=db, notification_id=notification_id, user_id=current_user.id
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thông báo không tồn tại hoặc không thuộc quyền sở hữu của bạn.",
        )
    return NotificationOut.model_validate(notification)


@router.post("/mark-all-read", response_model=dict[str, int])
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """Đánh dấu tất cả thông báo của người dùng là đã đọc."""
    count = await NotificationService.mark_all_as_read(db=db, user_id=current_user.id)
    return {"updated_count": count}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Xóa một thông báo."""
    deleted = await NotificationService.delete_notification(
        db=db, notification_id=notification_id, user_id=current_user.id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thông báo không tồn tại hoặc không thuộc quyền sở hữu của bạn.",
        )


@router.get("/preferences", response_model=NotificationPreferenceOut)
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreferenceOut:
    """Lấy cấu hình tùy chọn thông báo của người dùng."""
    pref = await NotificationService.get_or_create_preferences(db=db, user_id=current_user.id)
    return NotificationPreferenceOut.model_validate(pref)


@router.put("/preferences", response_model=NotificationPreferenceOut)
async def update_notification_preferences(
    update_data: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreferenceOut:
    """Cập nhật tùy chọn thông báo."""
    pref = await NotificationService.update_preferences(
        db=db, user_id=current_user.id, update_data=update_data
    )
    return NotificationPreferenceOut.model_validate(pref)
