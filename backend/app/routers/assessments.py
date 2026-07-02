import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_internal_user
from app.models.user import User
from app.schemas.internal import AssessmentAnswersOut, AssessmentDetailOut, ReportOut
from app.services import account_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


@router.get("/{assessment_id}", response_model=AssessmentDetailOut)
async def get_assessment(
    assessment_id: UUID,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentDetailOut:
    return await account_service.get_assessment_detail(db, assessment_id, current_user)


@router.get("/{assessment_id}/answers", response_model=AssessmentAnswersOut)
async def get_assessment_answers(
    assessment_id: UUID,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentAnswersOut:
    return await account_service.get_assessment_answers(db, assessment_id, current_user)


@router.get("/{assessment_id}/report", response_model=ReportOut)
async def get_assessment_report(
    assessment_id: UUID,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> ReportOut:
    return await account_service.get_assessment_report(db, assessment_id, current_user)


@router.post("/{assessment_id}/reset", status_code=204)
async def reset_assessment(
    assessment_id: UUID,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await account_service.reset_assessment(db, assessment_id, current_user)
    return Response(status_code=204)
