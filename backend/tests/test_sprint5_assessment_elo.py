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


def test_post_player_assessment_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    app.dependency_overrides[require_player] = _player
    now = datetime(2026, 5, 25, 8, 0, tzinfo=UTC)

    monkeypatch.setattr(
        "app.api.player_assessment.submit_player_assessment",
        lambda **_: {
            "assessment_id": "assessment-id",
            "sport": "Badminton",
            "form_version": "v1",
            "visible_skill_tier": "Intermediate",
            "elo_delta": 180,
            "history_id": "history-id",
            "created_at": now,
            "updated_at": now,
            "history_created_at": now,
        },
    )

    response = client.post(
        "/api/v1/player/assessments",
        json={
            "sport": "Badminton",
            "form_version": "v1",
            "answers": {
                "racket_control": 4,
                "footwork": 4,
                "stamina": 3,
                "match_reading": 4,
                "weekly_sessions": 4,
                "experience_years": 3,
            },
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["assessment_id"] == "assessment-id"
    assert payload["visible_skill_tier"] == "Intermediate"


def test_get_skill_tier_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    app.dependency_overrides[require_player] = _player
    now = datetime(2026, 5, 25, 8, 30, tzinfo=UTC)
    monkeypatch.setattr(
        "app.api.player_assessment.get_player_skill_tier",
        lambda **_: {
            "visible_skill_tier": "Intermediate",
            "matches_played": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "updated_at": now,
            "has_assessment": True,
            "last_assessment": {
                "sport": "Badminton",
                "form_version": "v1",
                "updated_at": now,
            },
        },
    )

    response = client.get("/api/v1/player/skill-tier")

    assert response.status_code == 200
    assert response.json()["visible_skill_tier"] == "Intermediate"


def test_get_elo_history_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    app.dependency_overrides[require_player] = _player
    now = datetime(2026, 5, 25, 9, 0, tzinfo=UTC)
    monkeypatch.setattr(
        "app.api.player_assessment.list_player_elo_history",
        lambda **_: [
            {
                "id": "history-id",
                "match_id": None,
                "delta": 180,
                "reason": "assessment_onboarding:Badminton:v1",
                "algorithm_version": "assessment_bootstrap_v1",
                "created_at": now,
                "skill_tier_before": "Beginner",
                "skill_tier_after": "Intermediate",
            }
        ],
    )

    response = client.get("/api/v1/player/elo-history?limit=20")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["delta"] == 180
