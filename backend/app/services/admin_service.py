import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import hash_password
from app.models.account import Account
from app.models.assessment import Assessment
from app.models.pillar import Pillar
from app.models.question import AnswerOption, Question, QuestionPersona
from app.models.user import User, UserRole
from app.schemas.admin import (
    AccountOut,
    AssessmentOut,
    Paginated,
    PillarCreate,
    PillarOut,
    PillarUpdate,
    QuestionCreate,
    QuestionOut,
    QuestionUpdate,
    UserCreate,
    UserOut,
    UserUpdate,
)

logger = logging.getLogger(__name__)


def _paginate(items: list, total: int, page: int, size: int) -> dict:
    return {"items": items, "total": total, "page": page, "size": size}


# ── Users ────────────────────────────────────────────────────────────────────


async def list_users(db: AsyncSession, page: int = 1, size: int = 25) -> Paginated[UserOut]:
    offset = (page - 1) * size
    total = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    rows = (await db.execute(select(User).order_by(User.created_at.desc()).offset(offset).limit(size))).scalars().all()
    logger.info("Admin: listed users count=%d page=%d", total, page)
    return Paginated(items=[UserOut.model_validate(u) for u in rows], total=total, page=page, size=size)


async def get_user(db: AsyncSession, user_id: UUID) -> UserOut | None:
    row = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    return UserOut.model_validate(row) if row else None


async def create_user(db: AsyncSession, data: UserCreate) -> UserOut:
    user = User(
        name=data.name,
        email=data.email,
        password_hash=await hash_password(data.password),
        role=UserRole.INTERNAL_USER,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("Admin: created user role=internal_user")
    return UserOut.model_validate(user)


async def update_user(db: AsyncSession, user_id: UUID, data: UserUpdate) -> UserOut | None:
    row = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not row:
        return None
    if data.name is not None:
        row.name = data.name
    if data.email is not None:
        row.email = data.email
    if data.is_active is not None:
        row.is_active = data.is_active
    await db.commit()
    await db.refresh(row)
    logger.info("Admin: updated user id=%s", user_id)
    return UserOut.model_validate(row)


async def deactivate_user(db: AsyncSession, user_id: UUID) -> UserOut | None:
    row = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not row:
        return None
    row.is_active = False
    await db.commit()
    await db.refresh(row)
    logger.info("Admin: deactivated user id=%s", user_id)
    return UserOut.model_validate(row)


# ── Pillars ──────────────────────────────────────────────────────────────────


async def _pillar_with_count(db: AsyncSession, pillar: Pillar) -> PillarOut:
    count = (
        await db.execute(
            select(func.count()).select_from(Question).where(
                Question.pillar_id == pillar.id, Question.is_active == True  # noqa: E712
            )
        )
    ).scalar_one()
    data = PillarOut.model_validate(pillar)
    data.question_count = count
    return data


async def list_pillars(db: AsyncSession, page: int = 1, size: int = 25) -> Paginated[PillarOut]:
    offset = (page - 1) * size
    total = (await db.execute(select(func.count()).select_from(Pillar))).scalar_one()
    rows = (
        await db.execute(select(Pillar).order_by(Pillar.display_order).offset(offset).limit(size))
    ).scalars().all()
    items = [await _pillar_with_count(db, p) for p in rows]
    logger.info("Admin: listed pillars count=%d", total)
    return Paginated(items=items, total=total, page=page, size=size)


async def get_pillar(db: AsyncSession, pillar_id: UUID) -> PillarOut | None:
    row = (await db.execute(select(Pillar).where(Pillar.id == pillar_id))).scalar_one_or_none()
    return await _pillar_with_count(db, row) if row else None


async def create_pillar(db: AsyncSession, data: PillarCreate) -> PillarOut:
    pillar = Pillar(
        name=data.name,
        description=data.description,
        overall_weight=data.overall_weight,
        display_order=data.display_order,
        is_gated=data.is_gated,
        gate_question=data.gate_question,
    )
    db.add(pillar)
    await db.commit()
    await db.refresh(pillar)
    logger.info("Admin: created pillar name=%s", data.name)
    return await _pillar_with_count(db, pillar)


async def update_pillar(db: AsyncSession, pillar_id: UUID, data: PillarUpdate) -> PillarOut | None:
    row = (await db.execute(select(Pillar).where(Pillar.id == pillar_id))).scalar_one_or_none()
    if not row:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    logger.info("Admin: updated pillar id=%s", pillar_id)
    return await _pillar_with_count(db, row)


async def deactivate_pillar(db: AsyncSession, pillar_id: UUID) -> PillarOut | None:
    row = (await db.execute(select(Pillar).where(Pillar.id == pillar_id))).scalar_one_or_none()
    if not row:
        return None
    row.is_active = False
    await db.commit()
    await db.refresh(row)
    logger.info("Admin: deactivated pillar id=%s", pillar_id)
    return await _pillar_with_count(db, row)


# ── Questions ─────────────────────────────────────────────────────────────────


async def _load_question(db: AsyncSession, question_id: UUID) -> Question | None:
    result = await db.execute(
        select(Question)
        .where(Question.id == question_id)
        .options(selectinload(Question.answer_options), selectinload(Question.personas))
    )
    return result.scalar_one_or_none()


async def list_questions(db: AsyncSession, pillar_id: UUID, page: int = 1, size: int = 25) -> Paginated[QuestionOut]:
    offset = (page - 1) * size
    total = (
        await db.execute(select(func.count()).select_from(Question).where(Question.pillar_id == pillar_id))
    ).scalar_one()
    rows = (
        await db.execute(
            select(Question)
            .where(Question.pillar_id == pillar_id)
            .options(selectinload(Question.answer_options), selectinload(Question.personas))
            .order_by(Question.display_order)
            .offset(offset)
            .limit(size)
        )
    ).scalars().all()
    logger.info("Admin: listed questions pillar=%s count=%d", pillar_id, total)
    return Paginated(items=[QuestionOut.model_validate(q) for q in rows], total=total, page=page, size=size)


async def get_question(db: AsyncSession, question_id: UUID) -> QuestionOut | None:
    row = await _load_question(db, question_id)
    return QuestionOut.model_validate(row) if row else None


async def create_question(db: AsyncSession, pillar_id: UUID, data: QuestionCreate) -> QuestionOut:
    next_order = (
        await db.execute(
            select(func.count()).select_from(Question).where(Question.pillar_id == pillar_id)
        )
    ).scalar_one() + 1

    question = Question(
        pillar_id=pillar_id,
        text=data.text,
        question_weight=data.question_weight,
        is_general=data.is_general,
        is_active=data.is_active,
        context_tags=data.context_tags,
        display_order=next_order,
    )
    db.add(question)
    await db.flush()

    for opt in data.answer_options:
        db.add(AnswerOption(
            question_id=question.id,
            text=opt.text,
            maturity_level=opt.maturity_level,
            display_order=opt.maturity_level,
        ))

    for p in data.personas:
        db.add(QuestionPersona(
            question_id=question.id,
            persona=p.persona,
            persona_weight=p.persona_weight,
        ))

    await db.commit()
    loaded = await _load_question(db, question.id)
    logger.info("Admin: created question pillar=%s display_order=%d", pillar_id, next_order)
    return QuestionOut.model_validate(loaded)


async def update_question(db: AsyncSession, question_id: UUID, data: QuestionUpdate) -> QuestionOut | None:
    row = await _load_question(db, question_id)
    if not row:
        return None

    if data.text is not None:
        row.text = data.text
    if data.question_weight is not None:
        row.question_weight = data.question_weight
    if data.is_general is not None:
        row.is_general = data.is_general
    if data.is_active is not None:
        row.is_active = data.is_active
    if data.context_tags is not None:
        row.context_tags = data.context_tags

    if data.answer_options is not None:
        existing_opts = {opt.maturity_level: opt for opt in row.answer_options}
        for opt_data in data.answer_options:
            if opt_data.maturity_level in existing_opts:
                existing_opts[opt_data.maturity_level].text = opt_data.text
            else:
                db.add(AnswerOption(
                    question_id=row.id,
                    text=opt_data.text,
                    maturity_level=opt_data.maturity_level,
                    display_order=opt_data.maturity_level,
                ))

    if data.personas is not None:
        for p in list(row.personas):
            await db.delete(p)
        await db.flush()
        for p in data.personas:
            db.add(QuestionPersona(
                question_id=row.id,
                persona=p.persona,
                persona_weight=p.persona_weight,
            ))

    await db.commit()
    loaded = await _load_question(db, question_id)
    logger.info("Admin: updated question id=%s", question_id)
    return QuestionOut.model_validate(loaded)


async def deactivate_question(db: AsyncSession, question_id: UUID) -> QuestionOut | None:
    row = await _load_question(db, question_id)
    if not row:
        return None
    row.is_active = False
    await db.commit()
    loaded = await _load_question(db, question_id)
    logger.info("Admin: deactivated question id=%s", question_id)
    return QuestionOut.model_validate(loaded)


# ── Admin read-only views ─────────────────────────────────────────────────────


async def list_accounts(db: AsyncSession, page: int = 1, size: int = 25) -> Paginated[AccountOut]:
    offset = (page - 1) * size
    total = (await db.execute(select(func.count()).select_from(Account))).scalar_one()
    rows = (
        await db.execute(select(Account).order_by(Account.created_at.desc()).offset(offset).limit(size))
    ).scalars().all()
    logger.info("Admin: listed accounts count=%d", total)
    return Paginated(items=[AccountOut.model_validate(a) for a in rows], total=total, page=page, size=size)


async def list_assessments(db: AsyncSession, page: int = 1, size: int = 25) -> Paginated[AssessmentOut]:
    offset = (page - 1) * size
    total = (await db.execute(select(func.count()).select_from(Assessment))).scalar_one()
    rows = (
        await db.execute(select(Assessment).order_by(Assessment.created_at.desc()).offset(offset).limit(size))
    ).scalars().all()
    logger.info("Admin: listed assessments count=%d", total)
    return Paginated(items=[AssessmentOut.model_validate(a) for a in rows], total=total, page=page, size=size)
