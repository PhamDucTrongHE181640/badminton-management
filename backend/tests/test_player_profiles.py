from __future__ import annotations

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


def _profile_payload() -> dict[str, object]:
    return {
        "id": "player-id",
        "email": "player@example.com",
        "full_name": "Nguoi choi",
        "avatar_url": None,
        "phone": "0912345678",
        "city": "Ha Noi",
        "district": "Thach That",
        "visible_skill_tier": "Intermediate",
        "elo_value": 1350,
        "matches_played": 10,
        "wins": 6,
        "losses": 3,
        "draws": 1,
        "has_assessment": True,
        "created_at": "2026-06-12T08:00:00Z",
        "updated_at": "2026-06-12T08:00:00Z",
    }


def test_get_my_player_profile(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    app.dependency_overrides[require_player] = _player
    monkeypatch.setattr("app.api.player_profiles.get_player_profile", lambda **_: _profile_payload())

    response = client.get("/api/v1/player/profiles/me")

    assert response.status_code == 200
    assert response.json()["visible_skill_tier"] == "Intermediate"


def test_update_my_player_profile(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    app.dependency_overrides[require_player] = _player
    monkeypatch.setattr(
        "app.api.player_profiles.update_my_player_profile",
        lambda **_: {**_profile_payload(), "full_name": "Nguoi choi moi"},
    )

    response = client.put(
        "/api/v1/player/profiles/me",
        json={
            "full_name": "Nguoi choi moi",
            "avatar_url": None,
            "phone": "0912345678",
            "city": "Ha Noi",
            "district": "Thach That",
        },
    )

    assert response.status_code == 200
    assert response.json()["full_name"] == "Nguoi choi moi"
