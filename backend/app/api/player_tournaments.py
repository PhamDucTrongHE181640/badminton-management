from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from app.core.dependencies import require_player
from app.services.player_tournaments import (
    create_tournament,
    list_my_tournament_registration_ids,
    list_tournaments,
    register_for_tournament,
)
from app.services.user_auth import UserPrincipal

public_router = APIRouter(prefix="/public/tournaments", tags=["public-tournaments"])
player_router = APIRouter(prefix="/player/tournaments", tags=["player-tournaments"])

TournamentStatus = Literal["upcoming", "ongoing", "completed"]
TournamentLevel = Literal["movement", "semi_pro", "pro"]


class TournamentModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class TournamentMatch(BaseModel):
    id: str
    teamA: str
    teamB: str
    scoreA: int | None = None
    scoreB: int | None = None
    time: str | None = None
    court: str | None = None
    winner: Literal["A", "B"] | None = None


class TournamentBracketRound(BaseModel):
    roundName: str
    matches: list[TournamentMatch] = Field(default_factory=list)


class TournamentResponse(BaseModel):
    id: str
    title: str
    sport: str
    status: TournamentStatus
    startDate: str
    endDate: str
    location: str
    joinedTeams: int
    maxTeams: int
    prizeMoney: int
    image: str
    level: TournamentLevel
    fee: int
    description: str
    bracket: list[TournamentBracketRound] = Field(default_factory=list)


class TournamentCreateRequest(TournamentModel):
    title: str = Field(min_length=2, max_length=200)
    sport: str = Field(min_length=1, max_length=80)
    startDate: str = Field(min_length=8, max_length=20)
    endDate: str = Field(min_length=8, max_length=20)
    location: str = Field(min_length=2, max_length=300)
    maxTeams: int = Field(gt=0, le=256)
    prizeMoney: int = Field(ge=0)
    image: str | None = Field(default=None, max_length=1000)
    level: TournamentLevel = "movement"
    fee: int = Field(default=0, ge=0)
    description: str | None = Field(default=None, max_length=2000)
    bracket: list[dict[str, Any]] | None = None


class TournamentRegistrationRequest(TournamentModel):
    teamName: str = Field(min_length=1, max_length=200)
    player1: str = Field(min_length=1, max_length=200)
    player2: str | None = Field(default=None, max_length=200)
    phone: str = Field(min_length=3, max_length=40)
    email: str = Field(min_length=3, max_length=320)


@public_router.get("", response_model=list[TournamentResponse])
def get_public_tournaments() -> list[dict[str, Any]]:
    return list_tournaments()


@player_router.get("/registrations/me", response_model=list[str])
def get_my_tournament_registration_ids(
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> list[str]:
    return list_my_tournament_registration_ids(player_user_id=user.id)


@player_router.post("", response_model=TournamentResponse, status_code=201)
def post_tournament(
    payload: TournamentCreateRequest,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, Any]:
    return create_tournament(actor_user_id=user.id, data=payload.model_dump(exclude_none=True))


@player_router.post(
    "/{tournament_id}/registrations",
    response_model=TournamentResponse,
    status_code=201,
)
def post_tournament_registration(
    tournament_id: str,
    payload: TournamentRegistrationRequest,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, Any]:
    return register_for_tournament(
        tournament_id=tournament_id,
        player_user_id=user.id,
        data=payload.model_dump(exclude_none=True),
    )
