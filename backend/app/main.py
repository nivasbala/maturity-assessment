import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.deps import require_internal_user
from app.core.logging_config import setup_logging
from app.models.user import User
from app.routers.accounts import router as accounts_router
from app.routers.admin import router as admin_router
from app.routers.assessments import router as assessments_router
from app.routers.auth import router as auth_router
from app.schemas.admin import Paginated, PillarOut
from app.seed.runner import seed_all
from app.services import admin_service

setup_logging()

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    async with AsyncSessionLocal() as db:
        try:
            await seed_all(db)
        except Exception:
            logger.error("Seed failed on startup — continuing")
    yield


app = FastAPI(title="Maturity Assessment Platform", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(accounts_router)
app.include_router(assessments_router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/pillars", response_model=Paginated[PillarOut], tags=["pillars"])
async def list_active_pillars(
    size: int = Query(50, ge=1, le=100),
    _: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> Paginated[PillarOut]:
    return await admin_service.list_pillars(db, page=1, size=size)
