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


def _tournament_payload() -> dict[str, object]:
    return {
        "id": "tournament-id",
        "title": "NetUP Hoa Lac Open",
        "sport": "Cầu lông",
        "status": "upcoming",
        "startDate": "25/06/2026",
        "endDate": "02/07/2026",
        "location": "Nhà thi đấu ĐH FPT Hòa Lạc",
        "joinedTeams": 4,
        "maxTeams": 16,
        "prizeMoney": 20_000_000,
        "image": "https://example.com/banner.jpg",
        "level": "movement",
        "fee": 150_000,
        "description": "Giải đấu phong trào",
        "bracket": [
            {
                "roundName": "Chung kết",
                "matches": [
                    {
                        "id": "final-1",
                        "teamA": "Team A",
                        "teamB": "Team B",
                        "time": "02/07 - 16:00",
                        "court": "Sân 1",
                    }
                ],
            }
        ],
    }


def test_public_tournaments_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr(
        "app.api.player_tournaments.list_tournaments",
        lambda: [_tournament_payload()],
    )

    response = client.get("/api/v1/public/tournaments")

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["id"] == "tournament-id"
    assert payload[0]["joinedTeams"] == 4
    assert payload[0]["bracket"][0]["roundName"] == "Chung kết"


def test_my_tournament_registrations_endpoint(
    client: TestClient, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    player = UserPrincipal(
        id="player-id",
        email="player@example.com",
        full_name="Nguoi choi",
        avatar_url=None,
        roles=["player"],
    )
    app.dependency_overrides[require_player] = lambda: player
    monkeypatch.setattr(
        "app.api.player_tournaments.list_my_tournament_registration_ids",
        lambda **_: ["tournament-id"],
    )

    response = client.get("/api/v1/player/tournaments/registrations/me")

    assert response.status_code == 200
    assert response.json() == ["tournament-id"]


def test_create_tournament_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    player = UserPrincipal(
        id="player-id",
        email="player@example.com",
        full_name="Nguoi choi",
        avatar_url=None,
        roles=["player"],
    )
    app.dependency_overrides[require_player] = lambda: player
    monkeypatch.setattr(
        "app.api.player_tournaments.create_tournament",
        lambda **_: _tournament_payload(),
    )

    response = client.post(
        "/api/v1/player/tournaments",
        json={
            "title": "NetUP Hoa Lac Open",
            "sport": "Cầu lông",
            "startDate": "25/06/2026",
            "endDate": "02/07/2026",
            "location": "Nhà thi đấu ĐH FPT Hòa Lạc",
            "maxTeams": 16,
            "prizeMoney": 20_000_000,
            "image": "https://example.com/banner.jpg",
            "level": "movement",
            "fee": 150_000,
            "description": "Giải đấu phong trào",
        },
    )

    assert response.status_code == 201
    assert response.json()["title"] == "NetUP Hoa Lac Open"


def test_register_tournament_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    player = UserPrincipal(
        id="player-id",
        email="player@example.com",
        full_name="Nguoi choi",
        avatar_url=None,
        roles=["player"],
    )
    app.dependency_overrides[require_player] = lambda: player
    monkeypatch.setattr(
        "app.api.player_tournaments.register_for_tournament",
        lambda **_: {**_tournament_payload(), "joinedTeams": 5},
    )

    response = client.post(
        "/api/v1/player/tournaments/tournament-id/registrations",
        json={
            "teamName": "Hoa Lac Warriors",
            "player1": "Minh Tuấn",
            "player2": "Hoàng Đức",
            "phone": "0912345678",
            "email": "player@example.com",
        },
    )

    assert response.status_code == 201
    assert response.json()["joinedTeams"] == 5
