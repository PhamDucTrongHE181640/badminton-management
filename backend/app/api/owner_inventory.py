from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel, Field

from app.core.dependencies import require_owner
from app.services.owner_inventory import (
    create_court,
    create_court_complex,
    create_session,
    delete_court,
    delete_court_complex,
    delete_session,
    list_court_complexes,
    list_courts,
    list_sessions,
    update_court,
    update_court_complex,
    update_session,
)
from app.services.user_auth import UserPrincipal

router = APIRouter(prefix="/owner", tags=["owner-inventory"])

SportType = Literal["Badminton", "Football", "Tennis"]
CourtStatus = Literal["active", "maintenance", "inactive"]
SessionPostType = Literal["pool", "rental"]
SessionStatus = Literal["scheduled", "locked", "in_progress", "completed", "cancelled"]
SkillTier = Literal["Beginner", "Intermediate", "Advanced"]


class CourtComplexCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    district: str = Field(min_length=2, max_length=120)
    address: str = Field(min_length=5, max_length=400)
    latitude: float | None = None
    longitude: float | None = None


class CourtComplexUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    district: str | None = Field(default=None, min_length=2, max_length=120)
    address: str | None = Field(default=None, min_length=5, max_length=400)
    latitude: float | None = None
    longitude: float | None = None


class CourtComplexResponse(BaseModel):
    id: str
    owner_user_id: str
    name: str
    district: str
    address: str
    latitude: float | None
    longitude: float | None
    created_at: datetime
    updated_at: datetime


class CourtCreate(BaseModel):
    complex_id: str
    name: str = Field(min_length=2, max_length=200)
    sub_court_name: str = Field(min_length=1, max_length=120)
    sport: SportType
    status: CourtStatus = "active"
    amenities: list[str] = Field(default_factory=list)
    base_price_vnd: int = Field(ge=0)
    max_rental_duration_minutes: int = Field(ge=30, le=300)


class CourtUpdate(BaseModel):
    complex_id: str | None = None
    name: str | None = Field(default=None, min_length=2, max_length=200)
    sub_court_name: str | None = Field(default=None, min_length=1, max_length=120)
    sport: SportType | None = None
    status: CourtStatus | None = None
    amenities: list[str] | None = None
    base_price_vnd: int | None = Field(default=None, ge=0)
    max_rental_duration_minutes: int | None = Field(default=None, ge=30, le=300)


class CourtResponse(BaseModel):
    id: str
    complex_id: str
    owner_user_id: str
    name: str
    sub_court_name: str
    sport: str
    status: str
    rating: float
    amenities: list[str]
    base_price_vnd: int
    max_rental_duration_minutes: int
    created_at: datetime
    updated_at: datetime
    complex_name: str | None = None
    district: str | None = None


class SessionCreate(BaseModel):
    court_id: str
    title: str = Field(min_length=2, max_length=200)
    post_type: SessionPostType = "pool"
    status: SessionStatus = "scheduled"
    starts_at: datetime
    duration_minutes: int = Field(ge=30, le=300)
    open_slots: int = Field(ge=0)
    max_slots: int = Field(gt=0)
    required_skill_min: SkillTier = "Beginner"
    required_skill_max: SkillTier = "Advanced"
    slot_price_vnd: int = Field(ge=0)
    full_court_price_vnd: int = Field(ge=0)
    is_peak_hour: bool = False
    allows_solo_join: bool = True


class SessionUpdate(BaseModel):
    court_id: str | None = None
    title: str | None = Field(default=None, min_length=2, max_length=200)
    post_type: SessionPostType | None = None
    status: SessionStatus | None = None
    starts_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=30, le=300)
    open_slots: int | None = Field(default=None, ge=0)
    max_slots: int | None = Field(default=None, gt=0)
    required_skill_min: SkillTier | None = None
    required_skill_max: SkillTier | None = None
    slot_price_vnd: int | None = Field(default=None, ge=0)
    full_court_price_vnd: int | None = Field(default=None, ge=0)
    is_peak_hour: bool | None = None
    allows_solo_join: bool | None = None


class SessionResponse(BaseModel):
    id: str
    court_id: str
    created_by_user_id: str | None
    title: str
    post_type: str
    status: str
    starts_at: datetime
    duration_minutes: int
    ends_at: datetime
    open_slots: int
    max_slots: int
    required_skill_min: str
    required_skill_max: str
    slot_price_vnd: int
    full_court_price_vnd: int
    is_peak_hour: bool
    allows_solo_join: bool
    created_at: datetime
    updated_at: datetime
    court_name: str | None = None
    complex_name: str | None = None


@router.get("/court-complexes", response_model=list[CourtComplexResponse])
def get_court_complexes(
    owner: Annotated[UserPrincipal, Depends(require_owner)],
) -> list[dict[str, object]]:
    return list_court_complexes(owner_user_id=owner.id)


@router.post("/court-complexes", response_model=CourtComplexResponse, status_code=201)
def post_court_complex(
    payload: CourtComplexCreate,
    owner: Annotated[UserPrincipal, Depends(require_owner)],
) -> dict[str, object]:
    return create_court_complex(owner_user_id=owner.id, data=payload.model_dump())


@router.patch("/court-complexes/{complex_id}", response_model=CourtComplexResponse)
def patch_court_complex(
    complex_id: str,
    payload: CourtComplexUpdate,
    owner: Annotated[UserPrincipal, Depends(require_owner)],
) -> dict[str, object]:
    return update_court_complex(
        owner_user_id=owner.id,
        complex_id=complex_id,
        data=payload.model_dump(exclude_unset=True),
    )


@router.delete("/court-complexes/{complex_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_court_complex(
    complex_id: str,
    owner: Annotated[UserPrincipal, Depends(require_owner)],
) -> Response:
    delete_court_complex(owner_user_id=owner.id, complex_id=complex_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/courts", response_model=list[CourtResponse])
def get_courts(
    owner: Annotated[UserPrincipal, Depends(require_owner)],
    complex_id: Annotated[str | None, Query()] = None,
) -> list[dict[str, object]]:
    return list_courts(owner_user_id=owner.id, complex_id=complex_id)


@router.post("/courts", response_model=CourtResponse, status_code=201)
def post_court(
    payload: CourtCreate,
    owner: Annotated[UserPrincipal, Depends(require_owner)],
) -> dict[str, object]:
    return create_court(owner_user_id=owner.id, data=payload.model_dump())


@router.patch("/courts/{court_id}", response_model=CourtResponse)
def patch_court(
    court_id: str,
    payload: CourtUpdate,
    owner: Annotated[UserPrincipal, Depends(require_owner)],
) -> dict[str, object]:
    return update_court(
        owner_user_id=owner.id,
        court_id=court_id,
        data=payload.model_dump(exclude_unset=True),
    )


@router.delete("/courts/{court_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_court(
    court_id: str,
    owner: Annotated[UserPrincipal, Depends(require_owner)],
) -> Response:
    delete_court(owner_user_id=owner.id, court_id=court_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/sessions", response_model=list[SessionResponse])
def get_sessions(
    owner: Annotated[UserPrincipal, Depends(require_owner)],
    court_id: Annotated[str | None, Query()] = None,
) -> list[dict[str, object]]:
    return list_sessions(owner_user_id=owner.id, court_id=court_id)


@router.post("/sessions", response_model=SessionResponse, status_code=201)
def post_session(
    payload: SessionCreate,
    owner: Annotated[UserPrincipal, Depends(require_owner)],
) -> dict[str, object]:
    return create_session(owner_user_id=owner.id, data=payload.model_dump())


@router.patch("/sessions/{session_id}", response_model=SessionResponse)
def patch_session(
    session_id: str,
    payload: SessionUpdate,
    owner: Annotated[UserPrincipal, Depends(require_owner)],
) -> dict[str, object]:
    return update_session(
        owner_user_id=owner.id,
        session_id=session_id,
        data=payload.model_dump(exclude_unset=True),
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_session(
    session_id: str,
    owner: Annotated[UserPrincipal, Depends(require_owner)],
) -> Response:
    delete_session(owner_user_id=owner.id, session_id=session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
