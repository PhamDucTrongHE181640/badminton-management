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


def _player() -> UserPrincipal:
    return UserPrincipal(
        id="player-id",
        email="player@example.com",
        full_name="Nguoi choi",
        avatar_url=None,
        roles=["player"],
    )


def test_create_match_event_endpoint(  # type: ignore[no-untyped-def]
    client: TestClient, monkeypatch
) -> None:
    app.dependency_overrides[require_player] = _player
    now = datetime(2026, 5, 27, 8, 0, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.player_matches.create_match_event",
        lambda **_: {
            "id": "match-id",
            "session_id": "session-id",
            "session_title": "Keo toi",
            "status": "pending",
            "team_a_score": 21,
            "team_b_score": 19,
            "started_at": now,
            "ended_at": now,
            "finalized_at": None,
            "created_at": now,
            "updated_at": now,
            "participants": [
                {
                    "id": "participant-id",
                    "match_id": "match-id",
                    "booking_id": "booking-id",
                    "player_user_id": "player-id",
                    "player_full_name": "Nguoi choi",
                    "team_side": 1,
                    "result": None,
                    "created_at": now,
                }
            ],
            "feedback": [],
        },
    )

    response = client.post(
        "/api/v1/player/matches",
        json={
            "session_id": "session-id",
            "team_a_score": 21,
            "team_b_score": 19,
            "participants": [{"player_user_id": "player-id", "team_side": 1}],
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["id"] == "match-id"
    assert payload["status"] == "pending"


def test_get_match_detail_endpoint(  # type: ignore[no-untyped-def]
    client: TestClient, monkeypatch
) -> None:
    app.dependency_overrides[require_player] = _player
    now = datetime(2026, 5, 27, 8, 30, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.player_matches.get_match_event_detail",
        lambda **_: {
            "id": "match-id",
            "session_id": "session-id",
            "session_title": "Keo toi",
            "status": "pending",
            "team_a_score": 21,
            "team_b_score": 19,
            "started_at": now,
            "ended_at": now,
            "finalized_at": None,
            "created_at": now,
            "updated_at": now,
            "participants": [],
            "feedback": [],
        },
    )

    response = client.get("/api/v1/player/matches/match-id")

    assert response.status_code == 200
    assert response.json()["session_id"] == "session-id"


def test_submit_feedback_endpoint(  # type: ignore[no-untyped-def]
    client: TestClient, monkeypatch
) -> None:
    app.dependency_overrides[require_player] = _player
    now = datetime(2026, 5, 27, 9, 0, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.player_matches.submit_match_feedback",
        lambda **_: {
            "id": "feedback-id",
            "match_id": "match-id",
            "from_user_id": "player-id",
            "from_user_name": "Nguoi choi",
            "to_user_id": "opponent-id",
            "to_user_name": "Doi thu",
            "target_type": "opponent",
            "rating": 5,
            "comment": "Choi rat fair",
            "created_at": now,
        },
    )

    response = client.post(
        "/api/v1/player/matches/match-id/feedback",
        json={
            "to_user_id": "opponent-id",
            "target_type": "opponent",
            "rating": 5,
            "comment": "Choi rat fair",
        },
    )

    assert response.status_code == 201
    assert response.json()["target_type"] == "opponent"


def test_finalize_match_endpoint(  # type: ignore[no-untyped-def]
    client: TestClient, monkeypatch
) -> None:
    app.dependency_overrides[require_player] = _player
    now = datetime(2026, 5, 27, 9, 30, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.player_matches.finalize_match_event",
        lambda **_: {
            "match": {
                "id": "match-id",
                "session_id": "session-id",
                "session_title": "Keo toi",
                "status": "finalized",
                "team_a_score": 21,
                "team_b_score": 19,
                "started_at": now,
                "ended_at": now,
                "finalized_at": now,
                "created_at": now,
                "updated_at": now,
                "participants": [],
                "feedback": [],
            },
            "elo_updates": [
                {
                    "player_user_id": "player-id",
                    "player_full_name": "Nguoi choi",
                    "team_side": 1,
                    "result": "win",
                    "old_elo": 1200,
                    "new_elo": 1214,
                    "delta": 14,
                    "skill_tier_before": "Intermediate",
                    "skill_tier_after": "Intermediate",
                    "feedback_received_count": 1,
                    "feedback_received_avg": 5.0,
                }
            ],
        },
    )

    response = client.post("/api/v1/player/matches/match-id/finalize")

    assert response.status_code == 200
    payload = response.json()
    assert payload["match"]["status"] == "finalized"
    assert payload["elo_updates"][0]["delta"] == 14


def test_match_history_endpoint(  # type: ignore[no-untyped-def]
    client: TestClient, monkeypatch
) -> None:
    app.dependency_overrides[require_player] = _player
    now = datetime(2026, 5, 27, 10, 0, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.player_matches.list_player_match_history",
        lambda **_: [
            {
                "match_id": "match-id",
                "session_id": "session-id",
                "session_title": "Keo toi",
                "status": "finalized",
                "team_a_score": 21,
                "team_b_score": 19,
                "finalized_at": now,
                "created_at": now,
                "my_team_side": 1,
                "my_result": "win",
                "feedback_given_count": 1,
                "feedback_received_count": 1,
                "feedback_received_avg": 5.0,
                "elo_delta": 14,
                "skill_tier_before": "Intermediate",
                "skill_tier_after": "Intermediate",
            }
        ],
    )

    response = client.get("/api/v1/player/matches/history/list?limit=20")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["my_result"] == "win"
