from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from app.core.dependencies import require_player
from app.services.player_assessment import (
    get_player_skill_tier,
    list_player_elo_history,
    submit_player_assessment,
)
from app.services.player_video_assessment import (
    analyze_video_assessment_job,
    create_video_assessment,
    get_video_assessment,
    get_video_assessment_limits,
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


class VideoAssessmentResponse(BaseModel):
    assessment_id: str
    sport: str
    status: str
    llm_provider: str
    llm_model: str | None
    file_size_bytes: int
    duration_seconds: float | None
    computed_skill_tier: str | None
    confidence: float | None
    summary: str | None
    strengths: list[str]
    improvement_areas: list[str]
    warning: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


@router.post("/assessments", response_model=AssessmentSubmitResponse, status_code=201)
def post_player_assessment(
    payload: AssessmentSubmitRequest,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    return submit_player_assessment(player_user_id=user.id, data=payload.model_dump())


@router.post("/video-assessments", response_model=VideoAssessmentResponse, status_code=201)
async def post_player_video_assessment(
    background_tasks: BackgroundTasks,
    sport: Annotated[SportType, Form()],
    video: Annotated[UploadFile, File()],
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    limits = get_video_assessment_limits()
    content = await video.read(limits["max_size_bytes"] + 1)
    await video.close()

    assessment = create_video_assessment(
        player_user_id=user.id,
        sport=sport,
        filename=video.filename,
        content_type=video.content_type,
        content=content,
    )
    background_tasks.add_task(
        analyze_video_assessment_job,
        assessment_id=str(assessment["assessment_id"]),
    )
    return assessment


@router.get("/video-assessments/{assessment_id}", response_model=VideoAssessmentResponse)
def get_player_video_assessment(
    assessment_id: str,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    return get_video_assessment(player_user_id=user.id, assessment_id=assessment_id)


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
