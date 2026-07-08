from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.dependencies import require_player
from app.services.user_auth import UserPrincipal
from app.services.referee_matches import (
    save_referee_match,
    get_player_autocomplete,
    list_referee_matches,
    get_referee_stats,
    get_h2h_stats,
    get_player_or_pair_detail,
    quick_register_user,
    list_all_players_management,
    update_player_profile,
)

router = APIRouter(prefix="/player/scorekeeper", tags=["referee-matches"])

class SetScore(BaseModel):
    team_a: int = Field(ge=0, le=35)
    team_b: int = Field(ge=0, le=35)

class RefereeMatchCreateRequest(BaseModel):
    match_type: str = Field(pattern="^(singles|doubles)$")
    team_a_player1_id: str | None = None
    team_a_player1_name: str = Field(min_length=1, max_length=150)
    team_a_player2_id: str | None = None
    team_a_player2_name: str | None = None
    
    team_b_player1_id: str | None = None
    team_b_player1_name: str = Field(min_length=1, max_length=150)
    team_b_player2_id: str | None = None
    team_b_player2_name: str | None = None
    
    sets: list[SetScore]
    team_a_score: int = Field(ge=0, le=3)
    team_b_score: int = Field(ge=0, le=3)
    played_at: datetime | None = None

class QuickRegisterPlayerRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    email: str = Field(min_length=3, max_length=150)
    phone: str | None = None

@router.post("/quick-register-player", status_code=201)
def post_quick_register_player(
    payload: QuickRegisterPlayerRequest,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, Any]:
    return quick_register_user(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
    )

@router.post("/matches", status_code=201)
def post_referee_match(
    payload: RefereeMatchCreateRequest,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, Any]:
    return save_referee_match(actor_user_id=user.id, data=payload.model_dump())

@router.get("/players")
def get_autocomplete(
    user: Annotated[UserPrincipal, Depends(require_player)],
    q: str = Query(default=""),
) -> list[dict[str, Any]]:
    return get_player_autocomplete(query=q)

@router.get("/matches")
def get_matches(
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> list[dict[str, Any]]:
    return list_referee_matches(actor_user_id=user.id)

@router.get("/stats")
def get_stats(
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, Any]:
    return get_referee_stats()

@router.get("/h2h")
def get_h2h(
    user: Annotated[UserPrincipal, Depends(require_player)],
    a: str = Query(min_length=1),
    b: str = Query(min_length=1),
) -> dict[str, Any]:
    return get_h2h_stats(entity_a_key=a, entity_b_key=b)

@router.get("/player-detail")
def get_detail(
    user: Annotated[UserPrincipal, Depends(require_player)],
    key: str = Query(min_length=1),
) -> dict[str, Any]:
    return get_player_or_pair_detail(key=key)

class UpdatePlayerProfileRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    email: str = Field(min_length=3, max_length=150)
    phone: str | None = None

@router.get("/all-players")
def get_all_players(
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> list[dict[str, Any]]:
    return list_all_players_management()

@router.put("/players/{player_id}")
def put_update_player(
    player_id: str,
    payload: UpdatePlayerProfileRequest,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, Any]:
    return update_player_profile(
        player_id=player_id,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
    )
