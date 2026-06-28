import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password
from app.models.user import User

logger = logging.getLogger(__name__)


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    result = await db.execute(
        select(User).where(User.email == email, User.is_active == True)  # noqa: E712
    )
    user = result.scalar_one_or_none()
    if not user:
        logger.warning("Login attempt for unknown or inactive email")
        return None
    if not await verify_password(password, user.password_hash):
        logger.warning("Login attempt with wrong password: user_id=%s", user.id)
        return None
    return user


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)  # noqa: E712
    )
    return result.scalar_one_or_none()
