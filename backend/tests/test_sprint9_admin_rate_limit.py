from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest

from app.core.errors import AppError
from app.services.admin_auth import _ensure_login_not_rate_limited


@dataclass
class FakeResult:
    failed_count: int
    last_failed_at: datetime | None


class FakeConnection:
    def __init__(self, username_result: FakeResult, ip_result: FakeResult | None = None) -> None:
        self.username_result = username_result
        self.ip_result = ip_result

    def execute(self, _query: Any, params: dict[str, Any]) -> SimpleNamespace:
        if "username" in params:
            return SimpleNamespace(one=lambda: self.username_result)
        return SimpleNamespace(one=lambda: self.ip_result)


def test_admin_login_rate_limit_allows_when_below_threshold() -> None:
    connection = FakeConnection(
        username_result=FakeResult(
            failed_count=3,
            last_failed_at=datetime.now(UTC) - timedelta(minutes=1),
        )
    )

    _ensure_login_not_rate_limited(
        connection,
        username="admin",
        ip=None,
        max_attempts=5,
        window_minutes=15,
        block_minutes=15,
    )


def test_admin_login_rate_limit_blocks_when_threshold_reached() -> None:
    connection = FakeConnection(
        username_result=FakeResult(
            failed_count=5,
            last_failed_at=datetime.now(UTC) - timedelta(minutes=2),
        )
    )

    with pytest.raises(AppError) as error:
        _ensure_login_not_rate_limited(
            connection,
            username="admin",
            ip=None,
            max_attempts=5,
            window_minutes=15,
            block_minutes=15,
        )

    assert error.value.status_code == 429
    assert error.value.code == "admin_login_rate_limited"


def test_admin_login_rate_limit_unblocks_after_block_window() -> None:
    connection = FakeConnection(
        username_result=FakeResult(
            failed_count=7,
            last_failed_at=datetime.now(UTC) - timedelta(minutes=30),
        )
    )

    _ensure_login_not_rate_limited(
        connection,
        username="admin",
        ip=None,
        max_attempts=5,
        window_minutes=15,
        block_minutes=15,
    )


def test_admin_login_rate_limit_blocks_by_ip_even_if_username_low() -> None:
    connection = FakeConnection(
        username_result=FakeResult(
            failed_count=1,
            last_failed_at=datetime.now(UTC) - timedelta(minutes=1),
        ),
        ip_result=FakeResult(
            failed_count=8,
            last_failed_at=datetime.now(UTC) - timedelta(minutes=1),
        ),
    )

    with pytest.raises(AppError) as error:
        _ensure_login_not_rate_limited(
            connection,
            username="admin",
            ip="127.0.0.1",
            max_attempts=5,
            window_minutes=15,
            block_minutes=15,
        )

    assert error.value.code == "admin_login_rate_limited"
