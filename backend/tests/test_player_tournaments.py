from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.dependencies import require_admin, require_player
from app.main import app
from app.services.admin_auth import AdminPrincipal
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
        "bankQrImageUrl": "https://example.com/qr.png",
        "bankTransferCaption": "Chuyển khoản với mã {registrationCode}",
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


def _admin() -> AdminPrincipal:
    return AdminPrincipal(
        id="admin-id",
        user_id="admin-user-id",
        username="admin",
        is_super_admin=True,
    )


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


def test_my_tournament_registration_details_endpoint(
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
        "app.api.player_tournaments.list_my_tournament_registrations",
        lambda **_: [
            {
                "id": "registration-id",
                "tournamentId": "tournament-id",
                "status": "pending",
                "teamName": "Hoa Lac Warriors",
                "createdAt": "2026-06-12T08:00:00Z",
            }
        ],
    )

    response = client.get("/api/v1/player/tournaments/registrations/me/details")

    assert response.status_code == 200
    assert response.json()[0]["status"] == "pending"


def test_admin_create_tournament_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    app.dependency_overrides[require_admin] = _admin
    monkeypatch.setattr(
        "app.api.player_tournaments.create_tournament",
        lambda **_: _tournament_payload(),
    )

    response = client.post(
        "/api/v1/admin/tournaments",
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
            "bankQrImageUrl": "https://example.com/qr.png",
            "bankTransferCaption": "Chuyển khoản với mã {registrationCode}",
        },
    )

    assert response.status_code == 201
    assert response.json()["title"] == "NetUP Hoa Lac Open"


def test_admin_update_tournament_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    app.dependency_overrides[require_admin] = _admin
    monkeypatch.setattr(
        "app.api.player_tournaments.update_tournament",
        lambda **_: {**_tournament_payload(), "status": "ongoing"},
    )

    response = client.patch(
        "/api/v1/admin/tournaments/tournament-id",
        json={"status": "ongoing", "title": "NetUP Hoa Lac Open"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "ongoing"


def test_admin_delete_tournament_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    app.dependency_overrides[require_admin] = _admin
    called: dict[str, str] = {}

    def fake_delete(**kwargs: str) -> None:
        called["tournament_id"] = kwargs["tournament_id"]

    monkeypatch.setattr("app.api.player_tournaments.delete_tournament", fake_delete)

    response = client.delete("/api/v1/admin/tournaments/tournament-id")

    assert response.status_code == 204
    assert called["tournament_id"] == "tournament-id"


def test_admin_upload_tournament_qr_image_endpoint(
    client: TestClient, monkeypatch, tmp_path
) -> None:  # type: ignore[no-untyped-def]
    app.dependency_overrides[require_admin] = _admin
    monkeypatch.setenv("LOCAL_UPLOAD_STORAGE_DIR", str(tmp_path))
    monkeypatch.setenv("BACKEND_BASE_URL", "http://backend.test")

    response = client.post(
        "/api/v1/admin/tournaments/qr-images",
        files={"image": ("qr.png", b"qr-image-content", "image/png")},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["imageUrl"].startswith(
        "http://backend.test/uploads/tournament-bank-qrs/"
    )
    assert payload["storageKey"].startswith("tournament-bank-qrs/")
    assert (tmp_path / payload["storageKey"]).read_bytes() == b"qr-image-content"


def test_player_create_tournament_endpoint_removed(client: TestClient) -> None:
    response = client.post("/api/v1/player/tournaments", json={})

    assert response.status_code == 404


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
        lambda **_: {
            "id": "registration-id",
            "tournamentId": "tournament-id",
            "status": "pending",
            "teamName": "Hoa Lac Warriors",
            "registrationCode": "TREG-ABC123",
            "fee": 150_000,
            "bankQrImageUrl": "https://example.com/qr.png",
            "bankTransferCaption": "Chuyển khoản với mã {registrationCode}",
            "paymentCaption": "Chuyển khoản với mã TREG-ABC123",
            "createdAt": "2026-06-12T08:00:00Z",
            "tournament": {**_tournament_payload(), "joinedTeams": 5},
        },
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
    assert response.json()["registrationCode"] == "TREG-ABC123"
    assert response.json()["paymentCaption"] == "Chuyển khoản với mã TREG-ABC123"
    assert response.json()["tournament"]["joinedTeams"] == 5


def _admin_registration_payload() -> dict[str, object]:
    return {
        "id": "registration-id",
        "registrationCode": "TREG-ABC123",
        "status": "pending",
        "teamName": "Hoa Lac Warriors",
        "player1": "Minh Tuấn",
        "player2": "Hoàng Đức",
        "createdAt": "2026-06-12T08:00:00Z",
        "tournamentId": "tournament-id",
        "tournamentTitle": "NetUP Hoa Lac Open",
        "fee": 150_000,
        "contactPhone": "0912345678",
        "contactEmail": "player@example.com",
        "reviewedAt": None,
        "reviewNote": None,
        "profile": {
            "id": "player-id",
            "full_name": "Nguoi choi",
            "avatar_url": None,
            "city": "Ha Noi",
            "district": "Thach That",
            "visible_skill_tier": "Intermediate",
            "elo_value": 1350,
            "matches_played": 10,
            "wins": 6,
            "losses": 3,
            "draws": 1,
        },
    }


def test_admin_list_tournament_registrations_endpoint(
    client: TestClient, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    app.dependency_overrides[require_admin] = _admin
    monkeypatch.setattr(
        "app.api.player_tournaments.list_tournament_registrations_for_admin",
        lambda **_: [_admin_registration_payload()],
    )

    response = client.get("/api/v1/admin/tournaments/registrations?status=pending")

    assert response.status_code == 200
    assert response.json()[0]["registrationCode"] == "TREG-ABC123"
    assert response.json()[0]["contactPhone"] == "0912345678"
    assert response.json()[0]["profile"]["elo_value"] == 1350


def test_admin_review_tournament_registration_endpoint(
    client: TestClient, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    app.dependency_overrides[require_admin] = _admin
    monkeypatch.setattr(
        "app.api.player_tournaments.review_tournament_registration",
        lambda **_: {**_admin_registration_payload(), "status": "registered"},
    )

    response = client.patch(
        "/api/v1/admin/tournaments/registrations/registration-id",
        json={"status": "registered", "reviewNote": "Đã nhận chuyển khoản"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "registered"
