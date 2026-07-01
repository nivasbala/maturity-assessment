import logging
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_settings import SystemSetting

logger = logging.getLogger(__name__)


async def get_setting(db: AsyncSession, key: str) -> SystemSetting | None:
    return (await db.execute(select(SystemSetting).where(SystemSetting.key == key))).scalar_one_or_none()


async def get_all_settings(db: AsyncSession) -> list[SystemSetting]:
    return (await db.execute(select(SystemSetting).order_by(SystemSetting.key))).scalars().all()


async def get_question_count_bounds(db: AsyncSession) -> tuple[int, int]:
    """Return (min, max) question count bounds from system_settings."""
    min_row = await get_setting(db, "question_count_min")
    max_row = await get_setting(db, "question_count_max")
    q_min = int(min_row.value) if min_row else 12
    q_max = int(max_row.value) if max_row else 25
    return q_min, q_max


async def validate_question_count(db: AsyncSession, question_count: int) -> None:
    """Raise 400 if question_count is outside the configured bounds."""
    q_min, q_max = await get_question_count_bounds(db)
    if question_count < q_min or question_count > q_max:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"question_count must be between {q_min} and {q_max} (current system bounds)",
        )


async def update_setting(db: AsyncSession, key: str, value: str) -> SystemSetting:
    row = await get_setting(db, key)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setting '{key}' not found")

    # Validate numeric settings
    if key in ("question_count_min", "question_count_max"):
        try:
            int_val = int(value)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Value for '{key}' must be an integer")
        if int_val < 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Value for '{key}' must be >= 1")

        # Enforce min <= max constraint
        if key == "question_count_min":
            max_row = await get_setting(db, "question_count_max")
            if max_row and int_val > int(max_row.value):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="question_count_min cannot exceed question_count_max")
        if key == "question_count_max":
            min_row = await get_setting(db, "question_count_min")
            if min_row and int_val < int(min_row.value):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="question_count_max cannot be less than question_count_min")

    row.value = value
    row.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(row)
    logger.info("Admin: updated system_setting key=%s", key)
    return row
