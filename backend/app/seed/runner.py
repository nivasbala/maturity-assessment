import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.models.pillar import Pillar
from app.models.question import AnswerOption, Question, QuestionPersona
from app.models.user import User
from app.seed.seed_data import PILLARS

logger = logging.getLogger(__name__)


async def _seed_admin(db: AsyncSession) -> None:
    result = await db.execute(select(User).where(User.email == settings.admin_email))
    if result.scalar_one_or_none():
        logger.info("Admin user already exists, skipping")
        return
    user = User(
        name=settings.admin_name,
        email=settings.admin_email,
        password_hash=await hash_password(settings.admin_password),
        role="admin",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    logger.info("Admin user created: email masked for security")


async def _seed_pillar(db: AsyncSession, pillar_data: dict) -> None:
    name = pillar_data["name"]
    result = await db.execute(select(Pillar).where(Pillar.name == name))
    if result.scalar_one_or_none():
        logger.info("Pillar already exists, skipping: %s", name)
        return

    pillar = Pillar(
        name=name,
        description=pillar_data["description"],
        overall_weight=pillar_data["overall_weight"],
        display_order=pillar_data["display_order"],
        is_active=pillar_data.get("is_active", True),
        is_gated=pillar_data["is_gated"],
        gate_question=pillar_data["gate_question"],
    )
    db.add(pillar)
    await db.flush()

    for q_data in pillar_data["questions"]:
        question = Question(
            pillar_id=pillar.id,
            text=q_data["text"],
            question_weight=q_data["weight"],
            is_general=q_data["general"],
            display_order=q_data["display_order"],
            context_tags=q_data.get("context_tags", []),
        )
        db.add(question)
        await db.flush()

        for maturity_level, option_text in q_data["options"]:
            db.add(AnswerOption(
                question_id=question.id,
                text=option_text,
                maturity_level=maturity_level,
                display_order=maturity_level,
            ))

        for persona, persona_weight in q_data["personas"]:
            db.add(QuestionPersona(
                question_id=question.id,
                persona=persona,
                persona_weight=persona_weight,
            ))

    await db.flush()
    logger.info("Seeded pillar: %s", pillar.name)


async def seed_all(db: AsyncSession) -> None:
    await _seed_admin(db)
    for pillar_data in PILLARS:
        await _seed_pillar(db, pillar_data)
    await db.commit()
