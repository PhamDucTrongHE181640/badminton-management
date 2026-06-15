from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field

from app.core.dependencies import require_admin, require_player
from app.services.admin_auth import AdminPrincipal
from app.services.player_tournaments import (
    create_tournament,
    delete_tournament,
    list_my_tournament_registration_ids,
    list_my_tournament_registrations,
    list_tournament_registrations_for_admin,
    list_tournaments,
    register_for_tournament,
    review_tournament_registration,
    update_tournament,
)
from app.services.tournament_uploads import (
    MAX_TOURNAMENT_BANK_QR_BYTES,
    save_tournament_bank_qr_image,
)
from app.services.user_auth import UserPrincipal

public_router = APIRouter(prefix="/public/tournaments", tags=["public-tournaments"])
player_router = APIRouter(prefix="/player/tournaments", tags=["player-tournaments"])
admin_router = APIRouter(prefix="/admin/tournaments", tags=["admin-tournaments"])

TournamentStatus = Literal["upcoming", "ongoing", "completed"]
TournamentLevel = Literal["movement", "semi_pro", "pro"]
TournamentRegistrationStatus = Literal["pending", "registered", "cancelled"]


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


class TournamentPlayerProfile(BaseModel):
    id: str
    full_name: str
    avatar_url: str | None = None
    city: str | None = None
    district: str | None = None
    visible_skill_tier: str
    elo_value: int
    matches_played: int
    wins: int
    losses: int
    draws: int


class TournamentPublicRegistration(BaseModel):
    id: str
    status: TournamentRegistrationStatus
    teamName: str
    player1: str
    player2: str | None = None
    createdAt: Any
    profile: TournamentPlayerProfile


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
    bankQrImageUrl: str | None = None
    bankTransferCaption: str | None = None
    bracket: list[TournamentBracketRound] = Field(default_factory=list)
    registrations: list[TournamentPublicRegistration] = Field(default_factory=list)


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
    bankQrImageUrl: str | None = Field(default=None, max_length=1000)
    bankTransferCaption: str | None = Field(default=None, max_length=2000)
    bracket: list[dict[str, Any]] | None = None


class TournamentUpdateRequest(TournamentModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    sport: str | None = Field(default=None, min_length=1, max_length=80)
    status: TournamentStatus | None = None
    startDate: str | None = Field(default=None, min_length=8, max_length=20)
    endDate: str | None = Field(default=None, min_length=8, max_length=20)
    location: str | None = Field(default=None, min_length=2, max_length=300)
    maxTeams: int | None = Field(default=None, gt=0, le=256)
    prizeMoney: int | None = Field(default=None, ge=0)
    image: str | None = Field(default=None, max_length=1000)
    level: TournamentLevel | None = None
    fee: int | None = Field(default=None, ge=0)
    description: str | None = Field(default=None, max_length=2000)
    bankQrImageUrl: str | None = Field(default=None, max_length=1000)
    bankTransferCaption: str | None = Field(default=None, max_length=2000)
    bracket: list[dict[str, Any]] | None = None


class TournamentRegistrationRequest(TournamentModel):
    teamName: str = Field(min_length=1, max_length=200)
    player1: str = Field(min_length=1, max_length=200)
    player2: str | None = Field(default=None, max_length=200)
    phone: str = Field(min_length=3, max_length=40)
    email: str = Field(min_length=3, max_length=320)


class MyTournamentRegistrationResponse(BaseModel):
    id: str
    tournamentId: str
    status: TournamentRegistrationStatus
    teamName: str
    registrationCode: str | None = None
    fee: int | None = None
    bankQrImageUrl: str | None = None
    bankTransferCaption: str | None = None
    paymentCaption: str | None = None
    createdAt: Any


class TournamentRegistrationCreatedResponse(BaseModel):
    id: str
    tournamentId: str
    status: TournamentRegistrationStatus
    teamName: str
    registrationCode: str
    fee: int
    bankQrImageUrl: str | None = None
    bankTransferCaption: str | None = None
    paymentCaption: str
    createdAt: Any
    tournament: TournamentResponse


class AdminTournamentRegistrationResponse(TournamentPublicRegistration):
    registrationCode: str
    tournamentId: str
    tournamentTitle: str
    fee: int
    contactPhone: str
    contactEmail: str
    reviewedAt: Any | None = None
    reviewNote: str | None = None


class AdminTournamentRegistrationReviewRequest(TournamentModel):
    status: Literal["registered", "cancelled"]
    reviewNote: str | None = Field(default=None, max_length=1000)


class TournamentQrImageUploadResponse(BaseModel):
    imageUrl: str
    storageKey: str


@public_router.get("", response_model=list[TournamentResponse])
def get_public_tournaments() -> list[dict[str, Any]]:
    return list_tournaments()


@player_router.get("/registrations/me", response_model=list[str])
def get_my_tournament_registration_ids(
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> list[str]:
    return list_my_tournament_registration_ids(player_user_id=user.id)


@player_router.get(
    "/registrations/me/details",
    response_model=list[MyTournamentRegistrationResponse],
)
def get_my_tournament_registrations(
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> list[dict[str, Any]]:
    return list_my_tournament_registrations(player_user_id=user.id)


@player_router.post(
    "/{tournament_id}/registrations",
    response_model=TournamentRegistrationCreatedResponse,
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


@admin_router.get("", response_model=list[TournamentResponse])
def get_admin_tournaments(
    _admin: Annotated[AdminPrincipal, Depends(require_admin)],
) -> list[dict[str, Any]]:
    return list_tournaments()


@admin_router.post("", response_model=TournamentResponse, status_code=201)
def post_admin_tournament(
    payload: TournamentCreateRequest,
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
) -> dict[str, Any]:
    return create_tournament(
        actor_user_id=admin.user_id,
        data=payload.model_dump(exclude_none=True),
    )


@admin_router.post(
    "/qr-images",
    response_model=TournamentQrImageUploadResponse,
    status_code=201,
)
async def post_admin_tournament_qr_image(
    image: Annotated[UploadFile, File()],
    _admin: Annotated[AdminPrincipal, Depends(require_admin)],
) -> dict[str, Any]:
    content = await image.read(MAX_TOURNAMENT_BANK_QR_BYTES + 1)
    await image.close()
    return save_tournament_bank_qr_image(
        filename=image.filename,
        content_type=image.content_type,
        content=content,
    )


@admin_router.patch("/{tournament_id}", response_model=TournamentResponse)
def patch_admin_tournament(
    tournament_id: str,
    payload: TournamentUpdateRequest,
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
) -> dict[str, Any]:
    return update_tournament(
        actor_user_id=admin.user_id,
        tournament_id=tournament_id,
        data=payload.model_dump(exclude_unset=True),
    )


@admin_router.delete("/{tournament_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_tournament(
    tournament_id: str,
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
) -> Response:
    delete_tournament(actor_user_id=admin.user_id, tournament_id=tournament_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@admin_router.get("/registrations", response_model=list[AdminTournamentRegistrationResponse])
def get_admin_tournament_registrations(
    _admin: Annotated[AdminPrincipal, Depends(require_admin)],
    status: TournamentRegistrationStatus | None = None,
    tournament_id: str | None = None,
) -> list[dict[str, Any]]:
    return list_tournament_registrations_for_admin(
        status=status,
        tournament_id=tournament_id,
    )


@admin_router.patch(
    "/registrations/{registration_id}",
    response_model=AdminTournamentRegistrationResponse,
)
def patch_admin_tournament_registration(
    registration_id: str,
    payload: AdminTournamentRegistrationReviewRequest,
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
) -> dict[str, Any]:
    return review_tournament_registration(
        actor_user_id=admin.user_id,
        registration_id=registration_id,
        status=payload.status,
        review_note=payload.reviewNote,
    )
