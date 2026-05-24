from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.health import check_database_ready

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
def live() -> dict[str, str]:
    settings = get_settings()
    return {"status": "ok", "service": "netup-api", "environment": settings.app_env}


@router.get("/ready")
def ready() -> dict[str, str]:
    if not check_database_ready():
        raise AppError(
            status_code=503,
            code="database_unavailable",
            message="Database readiness check failed",
        )

    return {"status": "ok", "database": "ready"}
