from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.session import get_engine
from app.main import app


@pytest.fixture(autouse=True)
def clear_settings_cache() -> None:
    get_settings.cache_clear()
    get_engine.cache_clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
