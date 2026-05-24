from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from app.core.dependencies import require_player
from app.services.player_matches import (
    create_match_event,
    finalize_match_event,
    get_match_event_detail,
    list_player_match_history,
    submit_match_feedback,
)
from app.services.user_auth import UserPrincipal

router = APIRouter(prefix="/player/matches", tags=["player-matches"])

TeamSide = Literal[1, 2]
FeedbackTargetType = Literal["teammate", "opponent"]


class PlayerMatchModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class MatchParticipantCreateRequest(PlayerMatchModel):
    player_user_id: str = Field(min_length=1, max_length=64)
    team_side: TeamSide
    booking_id: str | None = Field(default=None, min_length=1, max_length=64)


class MatchCreateRequest(PlayerMatchModel):
    session_id: str = Field(min_length=1, max_length=64)
    team_a_score: int = Field(ge=0, le=99)
    team_b_score: int = Field(ge=0, le=99)
    started_at: datetime | None = None
    ended_at: datetime | None = None
    participants: list[MatchParticipantCreateRequest] | None = None


class MatchFeedbackCreateRequest(PlayerMatchModel):
    to_user_id: str = Field(min_length=1, max_length=64)
    target_type: FeedbackTargetType
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)


class MatchParticipantResponse(BaseModel):
    id: str
    match_id: str
    booking_id: str | None
    player_user_id: str
    player_full_name: str | None
    team_side: int
    result: str | None
    created_at: datetime


class MatchFeedbackResponse(BaseModel):
    id: str
    match_id: str
    from_user_id: str
    from_user_name: str | None
    to_user_id: str
    to_user_name: str | None
    target_type: str
    rating: int
    comment: str | None
    created_at: datetime


class MatchEventResponse(BaseModel):
    id: str
    session_id: str
    session_title: str
    status: str
    team_a_score: int | None
    team_b_score: int | None
    started_at: datetime | None
    ended_at: datetime | None
    finalized_at: datetime | None
    created_at: datetime
    updated_at: datetime
    participants: list[MatchParticipantResponse]
    feedback: list[MatchFeedbackResponse]


class MatchFinalizeEloUpdateResponse(BaseModel):
    player_user_id: str
    player_full_name: str
    team_side: int
    result: str
    old_elo: int
    new_elo: int
    delta: int
    skill_tier_before: str
    skill_tier_after: str
    feedback_received_count: int
    feedback_received_avg: float | None


class MatchFinalizeResponse(BaseModel):
    match: MatchEventResponse
    elo_updates: list[MatchFinalizeEloUpdateResponse]


class MatchHistoryItemResponse(BaseModel):
    match_id: str
    session_id: str
    session_title: str
    status: str
    team_a_score: int | None
    team_b_score: int | None
    finalized_at: datetime | None
    created_at: datetime
    my_team_side: int
    my_result: str | None
    feedback_given_count: int
    feedback_received_count: int
    feedback_received_avg: float | None
    elo_delta: int | None
    skill_tier_before: str | None
    skill_tier_after: str | None


@router.post("", response_model=MatchEventResponse, status_code=201)
def post_match_event(
    payload: MatchCreateRequest,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, Any]:
    return create_match_event(actor_user_id=user.id, data=payload.model_dump(exclude_none=True))


@router.get("/{match_id}", response_model=MatchEventResponse)
def get_match_detail(
    match_id: str,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, Any]:
    return get_match_event_detail(match_id=match_id, actor_user_id=user.id)


@router.post("/{match_id}/feedback", response_model=MatchFeedbackResponse, status_code=201)
def post_match_feedback(
    match_id: str,
    payload: MatchFeedbackCreateRequest,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, Any]:
    return submit_match_feedback(
        match_id=match_id,
        actor_user_id=user.id,
        data=payload.model_dump(exclude_none=True),
    )


@router.post("/{match_id}/finalize", response_model=MatchFinalizeResponse)
def post_match_finalize(
    match_id: str,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, Any]:
    return finalize_match_event(match_id=match_id, actor_user_id=user.id)


@router.get("/history/list", response_model=list[MatchHistoryItemResponse])
def get_match_history(
    user: Annotated[UserPrincipal, Depends(require_player)],
    limit: Annotated[int, Query(ge=1, le=200)] = 20,
) -> list[dict[str, Any]]:
    return list_player_match_history(player_user_id=user.id, limit=limit)
