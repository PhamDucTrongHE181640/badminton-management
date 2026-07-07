from __future__ import annotations

from typing import Annotated, Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.dependencies import require_player
from app.services.user_auth import UserPrincipal
from app.services.matchmaker import suggest_matchups

router = APIRouter(prefix="/player/matchmaker", tags=["matchmaker"])

class SuggestMatchupRequest(BaseModel):
    active_players: list[str] = Field(min_items=2)
    match_type: str = Field(default="doubles", pattern="^(singles|doubles)$")

@router.post("/suggest")
def post_suggest_matchup(
    payload: SuggestMatchupRequest,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, Any]:
    return suggest_matchups(active_player_keys=payload.active_players, match_type=payload.match_type)
