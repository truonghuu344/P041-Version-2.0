from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User


def canonicalize_email(value: str) -> str:
    """Chuẩn hóa email; Gmail bỏ dấu chấm, plus alias và googlemail alias."""
    normalized = value.strip().casefold()
    local, separator, domain = normalized.rpartition("@")
    if not separator:
        return normalized
    if domain in {"gmail.com", "googlemail.com"}:
        local = local.split("+", 1)[0].replace(".", "")
        domain = "gmail.com"
    return f"{local}@{domain}"


async def find_user_by_email(
    db: AsyncSession,
    email: str,
    *,
    exclude_user_id: str | None = None,
) -> User | None:
    canonical = canonicalize_email(email)
    conditions = [User.email == canonical]
    if canonical.endswith("@gmail.com"):
        conditions.extend(
            [
                User.email.ilike("%@gmail.com"),
                User.email.ilike("%@googlemail.com"),
            ]
        )
    statement = select(User).where(or_(*conditions))
    if exclude_user_id:
        statement = statement.where(User.id != exclude_user_id)
    users = (await db.execute(statement)).scalars().all()
    return next(
        (user for user in users if canonicalize_email(user.email) == canonical),
        None,
    )
