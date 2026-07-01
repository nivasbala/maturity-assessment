"""
Public prospect endpoints — no authentication required.

Session token (X-Session-Token header) is a short-lived JWT (2hr) issued at
/register time. It carries prospect info and gate answers, used by
/select-pillar and /submit to validate access and select questions.
"""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_session_token
from app.schemas.public import (
    AssessmentInfoOut,
    ConfirmResearchOut,
    ConfirmResearchRequest,
    RegisterOut,
    RegisterRequest,
    ReportPublicOut,
    ResearchSummaryOut,
    SelectPillarOut,
    SelectPillarRequest,
    SubmitOut,
    SubmitRequest,
)
from app.services import public_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/public", tags=["public"])


def _get_session(x_session_token: str = Header(..., alias="X-Session-Token")) -> dict:
    """Dependency: validate X-Session-Token and return its payload."""
    return decode_session_token(x_session_token)


@router.get("/assess/{token}", response_model=AssessmentInfoOut)
async def get_assessment_info(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> AssessmentInfoOut:
    return await public_service.get_assessment_info(token, db)


@router.post("/assess/{token}/register", response_model=RegisterOut, status_code=201)
async def register_prospect(
    token: str,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterOut:
    return await public_service.register_prospect(token, body, db)


@router.get("/assess/{token}/research-summary", response_model=ResearchSummaryOut)
async def get_research_summary(
    token: str,
    session: dict = Depends(_get_session),
    db: AsyncSession = Depends(get_db),
) -> ResearchSummaryOut:
    return await public_service.get_research_summary(token, session, db)


@router.post("/assess/{token}/confirm-research", response_model=ConfirmResearchOut)
async def confirm_research(
    token: str,
    body: ConfirmResearchRequest,
    session: dict = Depends(_get_session),
    db: AsyncSession = Depends(get_db),
) -> ConfirmResearchOut:
    return await public_service.confirm_research(token, session, body, db)


@router.post("/assess/{token}/select-pillar", response_model=SelectPillarOut)
async def select_pillar(
    token: str,
    body: SelectPillarRequest,
    session: dict = Depends(_get_session),
    db: AsyncSession = Depends(get_db),
) -> SelectPillarOut:
    return await public_service.select_pillar(token, session, body.pillar_id, db)


@router.post("/assess/{token}/submit", response_model=SubmitOut)
async def submit_assessment(
    token: str,
    body: SubmitRequest,
    session: dict = Depends(_get_session),
    db: AsyncSession = Depends(get_db),
) -> SubmitOut:
    return await public_service.submit_assessment(token, session, body, db)


@router.get("/assess/{token}/report/{assessment_id}", response_model=ReportPublicOut)
async def get_report(
    token: str,
    assessment_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ReportPublicOut:
    return await public_service.get_report(token, assessment_id, db)
