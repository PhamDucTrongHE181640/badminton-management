from __future__ import annotations

from collections import defaultdict
from typing import Any

from fastapi import WebSocket
from psycopg.types.json import Jsonb
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError
from app.db.session import get_engine
from app.services.user_auth import UserPrincipal, principal_from_user_access_token

CHAT_CLOSEABLE_SESSION_STATUSES = {"completed", "cancelled"}


def _audit(
    connection: Any,
    *,
    actor_user_id: str | None,
    event_type: str,
    entity_type: str,
    entity_id: str,
    payload: dict[str, Any] | None = None,
) -> None:
    connection.execute(
        text(
            """
            INSERT INTO public.audit_logs (
              actor_user_id,
              event_type,
              entity_type,
              entity_id,
              payload
            )
            VALUES (:actor_user_id, :event_type, :entity_type, :entity_id, :payload)
            """
        ),
        {
            "actor_user_id": actor_user_id,
            "event_type": event_type,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "payload": Jsonb(payload or {}),
        },
    )


def _room_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "pool_post_id": str(row.pool_post_id),
        "session_id": str(row.session_id),
        "created_by_user_id": str(row.created_by_user_id),
        "status": str(row.status),
        "closed_at": row.closed_at,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _message_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "room_id": str(row.room_id),
        "sender_user_id": str(row.sender_user_id),
        "sender_full_name": str(row.sender_full_name) if row.sender_full_name else None,
        "message_type": str(row.message_type),
        "content": str(row.content),
        "metadata": dict(row.metadata or {}),
        "created_at": row.created_at,
    }


def _insert_system_message(
    connection: Any,
    *,
    room_id: str,
    actor_user_id: str,
    content: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    row = connection.execute(
        text(
            """
            INSERT INTO public.chat_messages (
              room_id,
              sender_user_id,
              message_type,
              content,
              metadata
            )
            VALUES (
              :room_id,
              :sender_user_id,
              CAST('system' AS public.chat_message_type),
              :content,
              :metadata
            )
            RETURNING
              id,
              room_id,
              sender_user_id,
              message_type::text AS message_type,
              content,
              metadata,
              created_at
            """
        ),
        {
            "room_id": room_id,
            "sender_user_id": actor_user_id,
            "content": content,
            "metadata": Jsonb(metadata or {}),
        },
    ).one()
    return {
        "id": str(row.id),
        "room_id": str(row.room_id),
        "sender_user_id": str(row.sender_user_id),
        "sender_full_name": None,
        "message_type": str(row.message_type),
        "content": str(row.content),
        "metadata": dict(row.metadata or {}),
        "created_at": row.created_at,
    }


def _close_room_if_session_ended(
    connection: Any, *, room_id: str
) -> tuple[dict[str, Any] | None, bool]:
    room_row = connection.execute(
        text(
            """
            SELECT r.*, s.status::text AS session_status
            FROM public.chat_rooms r
            JOIN public.sessions s ON s.id = r.session_id
            WHERE r.id = :room_id
            FOR UPDATE
            """
        ),
        {"room_id": room_id},
    ).first()
    if room_row is None:
        raise AppError(
            status_code=404, code="chat_room_not_found", message="Không tìm thấy chat room"
        )

    should_close = (
        str(room_row.status) == "active"
        and str(room_row.session_status) in CHAT_CLOSEABLE_SESSION_STATUSES
    )
    if not should_close:
        return _room_from_row(room_row), False

    closed_room = connection.execute(
        text(
            """
            UPDATE public.chat_rooms
            SET status = CAST('closed' AS public.chat_room_status),
                closed_at = now(),
                updated_at = now()
            WHERE id = :room_id
            RETURNING
              id,
              pool_post_id,
              session_id,
              created_by_user_id,
              status::text AS status,
              closed_at,
              created_at,
              updated_at
            """
        ),
        {"room_id": room_id},
    ).one()
    return _room_from_row(closed_room), True


def _require_member(connection: Any, *, room_id: str, user_id: str) -> None:
    row = connection.execute(
        text(
            """
            SELECT 1
            FROM public.chat_room_members
            WHERE room_id = :room_id
              AND user_id = :user_id
              AND left_at IS NULL
            LIMIT 1
            """
        ),
        {"room_id": room_id, "user_id": user_id},
    ).first()
    if row is None:
        raise AppError(
            status_code=403,
            code="chat_member_forbidden",
            message="Tài khoản chưa là thành viên của room chat",
        )


def create_or_get_chat_room(*, pool_post_id: str, actor_user_id: str) -> dict[str, Any]:
    with get_engine().begin() as connection:
        existing = connection.execute(
            text(
                """
                SELECT
                  id,
                  pool_post_id,
                  session_id,
                  created_by_user_id,
                  status::text AS status,
                  closed_at,
                  created_at,
                  updated_at
                FROM public.chat_rooms
                WHERE pool_post_id = :pool_post_id
                LIMIT 1
                """
            ),
            {"pool_post_id": pool_post_id},
        ).first()
        if existing is not None:
            return _room_from_row(existing)

        pool_row = connection.execute(
            text(
                """
                SELECT id, session_id, host_user_id
                FROM public.pool_posts
                WHERE id = :pool_post_id
                LIMIT 1
                """
            ),
            {"pool_post_id": pool_post_id},
        ).first()
        if pool_row is None:
            raise AppError(
                status_code=404, code="pool_post_not_found", message="Không tìm thấy pool post"
            )

        room = connection.execute(
            text(
                """
                INSERT INTO public.chat_rooms (
                  pool_post_id,
                  session_id,
                  created_by_user_id
                )
                VALUES (:pool_post_id, :session_id, :created_by_user_id)
                RETURNING
                  id,
                  pool_post_id,
                  session_id,
                  created_by_user_id,
                  status::text AS status,
                  closed_at,
                  created_at,
                  updated_at
                """
            ),
            {
                "pool_post_id": pool_post_id,
                "session_id": str(pool_row.session_id),
                "created_by_user_id": str(pool_row.host_user_id),
            },
        ).one()

        connection.execute(
            text(
                """
                INSERT INTO public.chat_room_members (room_id, user_id, role)
                VALUES (
                  :room_id,
                  :user_id,
                  CAST('host' AS public.chat_member_role)
                )
                ON CONFLICT (room_id, user_id)
                DO UPDATE SET
                  role = CAST('host' AS public.chat_member_role),
                  left_at = NULL
                """
            ),
            {"room_id": str(room.id), "user_id": actor_user_id},
        )

        _insert_system_message(
            connection,
            room_id=str(room.id),
            actor_user_id=actor_user_id,
            content="Room chat đã được tạo.",
            metadata={"event": "room_created"},
        )
        _audit(
            connection,
            actor_user_id=actor_user_id,
            event_type="chat_room_created",
            entity_type="chat_room",
            entity_id=str(room.id),
            payload={"pool_post_id": pool_post_id},
        )
        return _room_from_row(room)


def get_chat_room_by_pool_post(*, pool_post_id: str, actor_user_id: str) -> dict[str, Any]:
    with get_engine().begin() as connection:
        row = connection.execute(
            text(
                """
                SELECT
                  id,
                  pool_post_id,
                  session_id,
                  created_by_user_id,
                  status::text AS status,
                  closed_at,
                  created_at,
                  updated_at
                FROM public.chat_rooms
                WHERE pool_post_id = :pool_post_id
                LIMIT 1
                """
            ),
            {"pool_post_id": pool_post_id},
        ).first()
        if row is None:
            raise AppError(
                status_code=404,
                code="chat_room_not_found",
                message="Pool post chưa có room chat",
            )
        room, room_closed = _close_room_if_session_ended(connection, room_id=str(row.id))
        if room is None:
            raise AppError(
                status_code=404, code="chat_room_not_found", message="Không tìm thấy chat room"
            )
        if room_closed:
            _insert_system_message(
                connection,
                room_id=room["id"],
                actor_user_id=actor_user_id,
                content="Room chat tự động đóng vì session đã kết thúc.",
                metadata={"event": "room_auto_closed"},
            )
        return room


def join_chat_room(*, room_id: str, actor_user_id: str) -> dict[str, Any]:
    with get_engine().begin() as connection:
        room, room_closed = _close_room_if_session_ended(connection, room_id=room_id)
        if room is None:
            raise AppError(
                status_code=404, code="chat_room_not_found", message="Không tìm thấy chat room"
            )
        if room_closed:
            _insert_system_message(
                connection,
                room_id=room_id,
                actor_user_id=actor_user_id,
                content="Room chat tự động đóng vì session đã kết thúc.",
                metadata={"event": "room_auto_closed"},
            )
        if room["status"] != "active":
            raise AppError(status_code=409, code="chat_room_closed", message="Room chat đã đóng")

        pool_row = connection.execute(
            text(
                """
                SELECT host_user_id
                FROM public.pool_posts
                WHERE id = :pool_post_id
                LIMIT 1
                """
            ),
            {"pool_post_id": room["pool_post_id"]},
        ).first()
        role = "host" if pool_row and str(pool_row.host_user_id) == actor_user_id else "member"
        try:
            connection.execute(
                text(
                    """
                    INSERT INTO public.chat_room_members (room_id, user_id, role)
                    VALUES (
                      :room_id,
                      :user_id,
                      CAST(:role AS public.chat_member_role)
                    )
                    ON CONFLICT (room_id, user_id)
                    DO UPDATE SET
                      role = CAST(:role AS public.chat_member_role),
                      left_at = NULL
                    """
                ),
                {"room_id": room_id, "user_id": actor_user_id, "role": role},
            )
        except IntegrityError as exc:
            raise AppError(
                status_code=403,
                code="chat_member_forbidden",
                message="User không đủ điều kiện join room (cần là host hoặc có booking hợp lệ)",
            ) from exc

        connection.execute(
            text(
                """
                UPDATE public.chat_room_members
                SET joined_at = now()
                WHERE room_id = :room_id
                  AND user_id = :user_id
                """
            ),
            {"room_id": room_id, "user_id": actor_user_id},
        )
        message = _insert_system_message(
            connection,
            room_id=room_id,
            actor_user_id=actor_user_id,
            content="Một thành viên đã tham gia room.",
            metadata={"event": "member_join"},
        )
        _audit(
            connection,
            actor_user_id=actor_user_id,
            event_type="chat_member_joined",
            entity_type="chat_room",
            entity_id=room_id,
        )
        return {"room": room, "system_message": message}


def leave_chat_room(*, room_id: str, actor_user_id: str) -> dict[str, Any]:
    with get_engine().begin() as connection:
        row = connection.execute(
            text(
                """
                UPDATE public.chat_room_members
                SET left_at = now()
                WHERE room_id = :room_id
                  AND user_id = :user_id
                  AND left_at IS NULL
                RETURNING id
                """
            ),
            {"room_id": room_id, "user_id": actor_user_id},
        ).first()
        if row is None:
            raise AppError(
                status_code=404, code="chat_member_not_found", message="Bạn chưa tham gia room"
            )
        message = _insert_system_message(
            connection,
            room_id=room_id,
            actor_user_id=actor_user_id,
            content="Một thành viên đã rời room.",
            metadata={"event": "member_leave"},
        )
        _audit(
            connection,
            actor_user_id=actor_user_id,
            event_type="chat_member_left",
            entity_type="chat_room",
            entity_id=room_id,
        )
    return {"ok": True, "system_message": message}


def list_chat_messages(
    *, room_id: str, actor_user_id: str, limit: int = 100
) -> list[dict[str, Any]]:
    capped_limit = max(1, min(limit, 200))
    with get_engine().begin() as connection:
        room, room_closed = _close_room_if_session_ended(connection, room_id=room_id)
        if room is None:
            raise AppError(
                status_code=404, code="chat_room_not_found", message="Không tìm thấy chat room"
            )
        if room_closed:
            _insert_system_message(
                connection,
                room_id=room_id,
                actor_user_id=actor_user_id,
                content="Room chat tự động đóng vì session đã kết thúc.",
                metadata={"event": "room_auto_closed"},
            )
        _require_member(connection, room_id=room_id, user_id=actor_user_id)
        rows = connection.execute(
            text(
                """
                SELECT
                  m.id,
                  m.room_id,
                  m.sender_user_id,
                  u.full_name AS sender_full_name,
                  m.message_type::text AS message_type,
                  m.content,
                  m.metadata,
                  m.created_at
                FROM public.chat_messages m
                JOIN public.users u ON u.id = m.sender_user_id
                WHERE m.room_id = :room_id
                  AND m.deleted_at IS NULL
                ORDER BY m.created_at DESC
                LIMIT :limit
                """
            ),
            {"room_id": room_id, "limit": capped_limit},
        ).all()
    return [_message_from_row(row) for row in reversed(rows)]


def create_chat_message(
    *,
    room_id: str,
    actor_user_id: str,
    content: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    text_content = content.strip()
    if not text_content:
        raise AppError(
            status_code=422, code="chat_message_invalid", message="Nội dung tin nhắn bị trống"
        )

    with get_engine().begin() as connection:
        room, room_closed = _close_room_if_session_ended(connection, room_id=room_id)
        if room is None:
            raise AppError(
                status_code=404, code="chat_room_not_found", message="Không tìm thấy chat room"
            )
        if room_closed:
            _insert_system_message(
                connection,
                room_id=room_id,
                actor_user_id=actor_user_id,
                content="Room chat tự động đóng vì session đã kết thúc.",
                metadata={"event": "room_auto_closed"},
            )
        if room["status"] != "active":
            raise AppError(status_code=409, code="chat_room_closed", message="Room chat đã đóng")
        _require_member(connection, room_id=room_id, user_id=actor_user_id)
        row = connection.execute(
            text(
                """
                INSERT INTO public.chat_messages (
                  room_id,
                  sender_user_id,
                  message_type,
                  content,
                  metadata
                )
                VALUES (
                  :room_id,
                  :sender_user_id,
                  CAST('text' AS public.chat_message_type),
                  :content,
                  :metadata
                )
                RETURNING
                  id,
                  room_id,
                  sender_user_id,
                  message_type::text AS message_type,
                  content,
                  metadata,
                  created_at
                """
            ),
            {
                "room_id": room_id,
                "sender_user_id": actor_user_id,
                "content": text_content,
                "metadata": Jsonb(metadata or {}),
            },
        ).one()
        sender = connection.execute(
            text("SELECT full_name FROM public.users WHERE id = :user_id"),
            {"user_id": actor_user_id},
        ).first()
        _audit(
            connection,
            actor_user_id=actor_user_id,
            event_type="chat_message_created",
            entity_type="chat_room",
            entity_id=room_id,
            payload={"message_id": str(row.id)},
        )
    return {
        "id": str(row.id),
        "room_id": str(row.room_id),
        "sender_user_id": str(row.sender_user_id),
        "sender_full_name": str(sender.full_name) if sender else None,
        "message_type": str(row.message_type),
        "content": str(row.content),
        "metadata": dict(row.metadata or {}),
        "created_at": row.created_at,
    }


class ChatRoomConnectionHub:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, *, room_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._rooms[room_id].add(websocket)

    def disconnect(self, *, room_id: str, websocket: WebSocket) -> None:
        if room_id not in self._rooms:
            return
        self._rooms[room_id].discard(websocket)
        if not self._rooms[room_id]:
            self._rooms.pop(room_id, None)

    async def broadcast(self, *, room_id: str, payload: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for socket in self._rooms.get(room_id, set()):
            try:
                await socket.send_json(payload)
            except Exception:
                dead.append(socket)
        for socket in dead:
            self.disconnect(room_id=room_id, websocket=socket)


chat_hub = ChatRoomConnectionHub()


def websocket_principal_from_connection(websocket: WebSocket) -> UserPrincipal | None:
    access_token = websocket.cookies.get("netup_user_access_token")
    if not access_token:
        return None
    return principal_from_user_access_token(access_token)
