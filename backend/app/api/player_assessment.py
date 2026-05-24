from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from app.core.dependencies import require_player
from app.services.player_assessment import (
    get_player_skill_tier,
    list_player_elo_history,
    submit_player_assessment,
)
from app.services.user_auth import UserPrincipal

router = APIRouter(prefix="/player", tags=["player-assessment"])

SportType = Literal["Badminton", "Football", "Tennis"]


class PlayerAssessmentModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class AssessmentSubmitRequest(PlayerAssessmentModel):
    sport: SportType
    form_version: str = Field(default="v1", min_length=1, max_length=32)
    answers: dict[str, float | int]


class AssessmentSubmitResponse(BaseModel):
    assessment_id: str
    sport: str
    form_version: str
    visible_skill_tier: str
    elo_delta: int
    history_id: str
    created_at: datetime
    updated_at: datetime
    history_created_at: datetime


class LastAssessmentResponse(BaseModel):
    sport: str
    form_version: str
    updated_at: datetime


class PlayerSkillTierResponse(BaseModel):
    visible_skill_tier: str
    matches_played: int
    wins: int
    losses: int
    draws: int
    updated_at: datetime | None
    has_assessment: bool
    last_assessment: LastAssessmentResponse | None = None


class EloHistoryItemResponse(BaseModel):
    id: str
    match_id: str | None
    delta: int
    reason: str
    algorithm_version: str
    created_at: datetime
    skill_tier_before: str
    skill_tier_after: str


@router.post("/assessments", response_model=AssessmentSubmitResponse, status_code=201)
def post_player_assessment(
    payload: AssessmentSubmitRequest,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    return submit_player_assessment(player_user_id=user.id, data=payload.model_dump())


@router.get("/skill-tier", response_model=PlayerSkillTierResponse)
def get_player_skill_tier_endpoint(
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    return get_player_skill_tier(player_user_id=user.id)


@router.get("/elo-history", response_model=list[EloHistoryItemResponse])
def get_player_elo_history(
    user: Annotated[UserPrincipal, Depends(require_player)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[dict[str, object]]:
    return list_player_elo_history(player_user_id=user.id, limit=limit)
