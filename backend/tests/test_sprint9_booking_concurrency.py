from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from typing import Any

from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError
from app.services.player_booking import create_booking_safe


def test_create_booking_safe_handles_concurrent_conflicts(  # type: ignore[no-untyped-def]
    monkeypatch,
) -> None:
    lock = Lock()
    state = {"created": False}

    def fake_create_booking(*, player_user_id: str, data: dict[str, Any]) -> dict[str, Any]:
        _ = (player_user_id, data)
        with lock:
            if not state["created"]:
                state["created"] = True
                return {"id": "booking-success"}
        raise IntegrityError("insert booking", {}, Exception("duplicate key"))

    monkeypatch.setattr("app.services.player_booking.create_booking", fake_create_booking)

    def worker() -> str:
        try:
            payload = {
                "session_id": "session-id",
                "mode": "solo",
                "payment_method": "cash",
                "seats_booked": 1,
            }
            create_booking_safe(player_user_id="player-id", data=payload)
            return "success"
        except AppError as exc:
            if exc.code == "booking_conflict":
                return "conflict"
            raise

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(lambda _: worker(), range(10)))

    assert results.count("success") == 1
    assert results.count("conflict") == 9
