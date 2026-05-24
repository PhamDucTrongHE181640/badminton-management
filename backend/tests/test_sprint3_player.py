from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.core.dependencies import require_player
from app.main import app
from app.services.user_auth import UserPrincipal


def _clear_overrides() -> None:
    app.dependency_overrides.clear()


def setup_function() -> None:  # type: ignore[no-untyped-def]
    _clear_overrides()


def teardown_function() -> None:  # type: ignore[no-untyped-def]
    _clear_overrides()


def test_discovery_sessions_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    player = UserPrincipal(
        id="player-id",
        email="player@example.com",
        full_name="Nguoi choi",
        avatar_url=None,
        roles=["player"],
    )
    app.dependency_overrides[require_player] = lambda: player
    starts_at = datetime(2026, 5, 25, 8, 0, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.player_booking.list_discovery_sessions",
        lambda **_: [
            {
                "id": "session-id",
                "court_id": "court-id",
                "title": "Keo sang",
                "post_type": "pool",
                "status": "scheduled",
                "starts_at": starts_at,
                "duration_minutes": 60,
                "ends_at": starts_at,
                "open_slots": 4,
                "max_slots": 4,
                "required_skill_min": "Beginner",
                "required_skill_max": "Advanced",
                "slot_price_vnd": 80000,
                "full_court_price_vnd": 300000,
                "is_peak_hour": False,
                "allows_solo_join": True,
                "court_name": "San 1",
                "sub_court_name": "A",
                "sport": "Badminton",
                "amenities": [],
                "base_price_vnd": 120000,
                "complex_id": "complex-id",
                "complex_name": "NetUp Arena",
                "district": "Ha Dong",
                "address": "Ha Noi",
                "latitude": None,
                "longitude": None,
            }
        ],
    )

    response = client.get("/api/v1/player/discovery/sessions?sport=Badminton&has_open_slots=true")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == "session-id"


def test_session_detail_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    player = UserPrincipal(
        id="player-id",
        email="player@example.com",
        full_name="Nguoi choi",
        avatar_url=None,
        roles=["player"],
    )
    app.dependency_overrides[require_player] = lambda: player
    starts_at = datetime(2026, 5, 25, 9, 0, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.player_booking.get_session_detail",
        lambda **_: {
            "id": "session-id",
            "court_id": "court-id",
            "title": "Keo trua",
            "post_type": "pool",
            "status": "scheduled",
            "starts_at": starts_at,
            "duration_minutes": 90,
            "ends_at": starts_at,
            "open_slots": 2,
            "max_slots": 4,
            "required_skill_min": "Beginner",
            "required_skill_max": "Advanced",
            "slot_price_vnd": 90000,
            "full_court_price_vnd": 350000,
            "is_peak_hour": False,
            "allows_solo_join": True,
            "court_name": "San 2",
            "sub_court_name": "B",
            "sport": "Badminton",
            "amenities": [],
            "base_price_vnd": 120000,
            "complex_id": "complex-id",
            "complex_name": "NetUp Arena",
            "district": "Ha Dong",
            "address": "Ha Noi",
            "latitude": None,
            "longitude": None,
        },
    )

    response = client.get("/api/v1/player/sessions/session-id")

    assert response.status_code == 200
    assert response.json()["title"] == "Keo trua"


def test_create_booking_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    player = UserPrincipal(
        id="player-id",
        email="player@example.com",
        full_name="Nguoi choi",
        avatar_url=None,
        roles=["player"],
    )
    app.dependency_overrides[require_player] = lambda: player
    created_at = datetime(2026, 5, 25, 10, 0, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.player_booking.create_booking_safe",
        lambda **_: {
            "id": "booking-id",
            "booking_code": "BK12345678",
            "session_id": "session-id",
            "court_id": "court-id",
            "player_user_id": player.id,
            "mode": "solo",
            "seats_booked": 1,
            "status": "awaiting_deposit",
            "payment_method": "cash",
            "base_price_vnd": 80000,
            "floor_fee_vnd": 3000,
            "platform_fee_vnd": 8000,
            "total_price_vnd": 91000,
            "deposit_required_vnd": 27300,
            "remaining_due_vnd": 63700,
            "qr_payload": "NETUP:BK12345678",
            "checked_in_at": None,
            "completed_at": None,
            "cancelled_at": None,
            "cancel_reason": None,
            "created_at": created_at,
            "updated_at": created_at,
            "session_title": "Keo toi",
            "session_starts_at": created_at,
            "complex_name": "NetUp Arena",
            "district": "Ha Dong",
            "court_name": "San 3",
            "sub_court_name": "C",
            "sport": "Badminton",
        },
    )

    response = client.post(
        "/api/v1/player/bookings",
        json={
            "session_id": "session-id",
            "mode": "solo",
            "payment_method": "cash",
            "seats_booked": 1,
        },
    )

    assert response.status_code == 201
    assert response.json()["id"] == "booking-id"
    assert response.json()["status"] == "awaiting_deposit"
