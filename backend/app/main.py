import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.logging_config import setup_logging
from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.seed.runner import seed_all

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


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
