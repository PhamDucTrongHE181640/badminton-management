from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, ConfigDict, Field

from app.core.dependencies import require_player
from app.services.player_chat import (
    chat_hub,
    create_chat_message,
    create_or_get_chat_room,
    get_chat_room_by_pool_post,
    join_chat_room,
    leave_chat_room,
    list_chat_messages,
    websocket_principal_from_connection,
)
from app.services.user_auth import UserPrincipal

router = APIRouter(prefix="/player/chat", tags=["player-chat"])
ws_router = APIRouter(tags=["player-chat-ws"])


class ChatModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class RoomCreateRequest(ChatModel):
    pool_post_id: str = Field(min_length=1, max_length=64)


class ChatRoomResponse(BaseModel):
    id: str
    pool_post_id: str
    session_id: str
    created_by_user_id: str
    status: str
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ChatMessageResponse(BaseModel):
    id: str
    room_id: str
    sender_user_id: str
    sender_full_name: str | None
    message_type: str
    content: str
    metadata: dict[str, Any]
    created_at: datetime


class ChatJoinResponse(BaseModel):
    room: ChatRoomResponse
    system_message: ChatMessageResponse


class ChatSendRequest(ChatModel):
    content: str = Field(min_length=1, max_length=2000)


class ChatLeaveResponse(BaseModel):
    ok: bool
    system_message: ChatMessageResponse


@router.post("/rooms", response_model=ChatRoomResponse, status_code=201)
def post_chat_room(
    payload: RoomCreateRequest,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    return create_or_get_chat_room(pool_post_id=payload.pool_post_id, actor_user_id=user.id)


@router.get("/rooms/by-pool/{pool_post_id}", response_model=ChatRoomResponse)
def get_chat_room_by_pool(
    pool_post_id: str,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    return get_chat_room_by_pool_post(pool_post_id=pool_post_id, actor_user_id=user.id)


@router.post("/rooms/{room_id}/members", response_model=ChatJoinResponse)
def post_chat_member_join(
    room_id: str,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    return join_chat_room(room_id=room_id, actor_user_id=user.id)


@router.post("/rooms/{room_id}/leave", response_model=ChatLeaveResponse)
def post_chat_member_leave(
    room_id: str,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    return leave_chat_room(room_id=room_id, actor_user_id=user.id)


@router.get("/rooms/{room_id}/messages", response_model=list[ChatMessageResponse])
def get_chat_room_messages(
    room_id: str,
    user: Annotated[UserPrincipal, Depends(require_player)],
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[dict[str, object]]:
    return list_chat_messages(room_id=room_id, actor_user_id=user.id, limit=limit)


@router.post("/rooms/{room_id}/messages", response_model=ChatMessageResponse, status_code=201)
def post_chat_message(
    room_id: str,
    payload: ChatSendRequest,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    message = create_chat_message(room_id=room_id, actor_user_id=user.id, content=payload.content)
    return message


@ws_router.websocket("/ws/chat/rooms/{room_id}")
async def chat_room_websocket(websocket: WebSocket, room_id: str) -> None:
    principal = websocket_principal_from_connection(websocket)
    if principal is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="missing_auth")
        return
    try:
        join_result = join_chat_room(room_id=room_id, actor_user_id=principal.id)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="join_forbidden")
        return

    await chat_hub.connect(room_id=room_id, websocket=websocket)
    await chat_hub.broadcast(
        room_id=room_id,
        payload={"type": "system", "message": join_result["system_message"]},
    )

    try:
        while True:
            incoming = await websocket.receive_json()
            if incoming.get("type") != "message":
                await websocket.send_json(
                    {
                        "type": "error",
                        "code": "chat_message_type_invalid",
                        "message": "Loại tin nhắn không hợp lệ",
                    }
                )
                continue
            content = str(incoming.get("content") or "")
            try:
                message = create_chat_message(
                    room_id=room_id,
                    actor_user_id=principal.id,
                    content=content,
                    metadata={"source": "websocket"},
                )
            except Exception as exc:
                await websocket.send_json(
                    {"type": "error", "code": "chat_message_create_failed", "message": str(exc)}
                )
                continue
            await chat_hub.broadcast(
                room_id=room_id, payload={"type": "message", "message": message}
            )
    except WebSocketDisconnect:
        chat_hub.disconnect(room_id=room_id, websocket=websocket)
        try:
            leave_result = leave_chat_room(room_id=room_id, actor_user_id=principal.id)
            await chat_hub.broadcast(
                room_id=room_id,
                payload={"type": "system", "message": leave_result["system_message"]},
            )
        except Exception:
            pass
