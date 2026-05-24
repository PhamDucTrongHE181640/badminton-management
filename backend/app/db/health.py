from __future__ import annotations

import logging

from sqlalchemy import text

from app.db.session import get_engine

logger = logging.getLogger(__name__)


def check_database_ready() -> bool:
    engine = get_engine()

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        logger.exception("database_readiness_failed")
        return False
