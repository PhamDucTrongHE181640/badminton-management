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


def test_create_chat_room_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    app.dependency_overrides[require_player] = _player
    now = datetime(2026, 5, 26, 8, 0, tzinfo=UTC)
    monkeypatch.setattr(
        "app.api.player_chat.create_or_get_chat_room",
        lambda **_: {
            "id": "room-id",
            "pool_post_id": "pool-id",
            "session_id": "session-id",
            "created_by_user_id": "player-id",
            "status": "active",
            "closed_at": None,
            "created_at": now,
            "updated_at": now,
        },
    )

    response = client.post("/api/v1/player/chat/rooms", json={"pool_post_id": "pool-id"})

    assert response.status_code == 201
    assert response.json()["id"] == "room-id"


def test_join_chat_room_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    app.dependency_overrides[require_player] = _player
    now = datetime(2026, 5, 26, 8, 30, tzinfo=UTC)
    monkeypatch.setattr(
        "app.api.player_chat.join_chat_room",
        lambda **_: {
            "room": {
                "id": "room-id",
                "pool_post_id": "pool-id",
                "session_id": "session-id",
                "created_by_user_id": "host-id",
                "status": "active",
                "closed_at": None,
                "created_at": now,
                "updated_at": now,
            },
            "system_message": {
                "id": "msg-id",
                "room_id": "room-id",
                "sender_user_id": "player-id",
                "sender_full_name": None,
                "message_type": "system",
                "content": "Một thành viên đã tham gia room.",
                "metadata": {"event": "member_join"},
                "created_at": now,
            },
        },
    )

    response = client.post("/api/v1/player/chat/rooms/room-id/members")

    assert response.status_code == 200
    assert response.json()["room"]["status"] == "active"


def test_list_chat_messages_endpoint(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    app.dependency_overrides[require_player] = _player
    now = datetime(2026, 5, 26, 9, 0, tzinfo=UTC)
    monkeypatch.setattr(
        "app.api.player_chat.list_chat_messages",
        lambda **_: [
            {
                "id": "msg-id",
                "room_id": "room-id",
                "sender_user_id": "player-id",
                "sender_full_name": "Nguoi choi",
                "message_type": "text",
                "content": "Xin chao",
                "metadata": {},
                "created_at": now,
            }
        ],
    )

    response = client.get("/api/v1/player/chat/rooms/room-id/messages?limit=20")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["message_type"] == "text"
