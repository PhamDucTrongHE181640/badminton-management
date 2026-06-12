from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from app.core.dependencies import require_player
from app.services.player_profiles import get_player_profile, update_my_player_profile
from app.services.user_auth import UserPrincipal

router = APIRouter(prefix="/player/profiles", tags=["player-profiles"])


class PlayerProfileModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class PlayerProfileResponse(BaseModel):
    id: str
    email: str | None = None
    full_name: str
    avatar_url: str | None = None
    phone: str | None = None
    city: str | None = None
    district: str | None = None
    visible_skill_tier: str
    elo_value: int
    matches_played: int
    wins: int
    losses: int
    draws: int
    has_assessment: bool
    created_at: datetime
    updated_at: datetime


class PlayerProfileUpdateRequest(PlayerProfileModel):
    full_name: str = Field(min_length=2, max_length=200)
    avatar_url: str | None = Field(default=None, max_length=1000)
    phone: str | None = Field(default=None, max_length=40)
    city: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=120)


@router.get("/me", response_model=PlayerProfileResponse)
def get_my_profile(
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    return get_player_profile(viewer_user_id=user.id, player_user_id=user.id)


@router.put("/me", response_model=PlayerProfileResponse)
def put_my_profile(
    payload: PlayerProfileUpdateRequest,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    return update_my_player_profile(
        player_user_id=user.id,
        data=payload.model_dump(exclude_none=False),
    )


@router.get("/{player_user_id}", response_model=PlayerProfileResponse)
def get_public_player_profile(
    player_user_id: str,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    return get_player_profile(viewer_user_id=user.id, player_user_id=player_user_id)
