from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from app.core.dependencies import require_player
from app.services.player_booking import (
    create_booking_safe,
    get_my_booking,
    get_session_detail,
    list_discovery_sessions,
    list_my_bookings,
)
from app.services.user_auth import UserPrincipal

router = APIRouter(prefix="/player", tags=["player-booking"])

SportType = Literal["Badminton", "Football", "Tennis"]
SessionPostType = Literal["pool", "rental"]
BookingMode = Literal["solo", "full_court"]
PaymentMethod = Literal["vnpay", "cash"]
BookingStatus = Literal[
    "awaiting_deposit",
    "deposit_paid",
    "confirmed",
    "checked_in",
    "completed",
    "cancelled",
    "expired",
]


class PlayerModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class DiscoverySessionResponse(BaseModel):
    id: str
    court_id: str
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
    court_name: str
    sub_court_name: str
    sport: str
    amenities: list[str]
    base_price_vnd: int
    complex_id: str
    complex_name: str
    district: str
    address: str
    latitude: float | None = None
    longitude: float | None = None
    pool_post_id: str | None = None
    player_skill_tier: str | None = None
    recommendation_score: int | None = None
    recommendation_label: str | None = None
    distance_bucket: str | None = None
    slot_fit_score: int | None = None


class BookingCreate(PlayerModel):
    session_id: str
    mode: BookingMode
    payment_method: PaymentMethod
    seats_booked: int | None = Field(default=None, ge=1, le=2)


class BookingResponse(BaseModel):
    id: str
    booking_code: str
    session_id: str
    court_id: str
    player_user_id: str
    mode: str
    seats_booked: int
    status: BookingStatus
    payment_method: PaymentMethod
    base_price_vnd: int
    floor_fee_vnd: int
    platform_fee_vnd: int
    total_price_vnd: int
    deposit_required_vnd: int
    remaining_due_vnd: int
    qr_payload: str
    checked_in_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    cancel_reason: str | None
    created_at: datetime
    updated_at: datetime
    session_title: str | None = None
    session_starts_at: datetime | None = None
    complex_name: str | None = None
    district: str | None = None
    court_name: str | None = None
    sub_court_name: str | None = None
    sport: str | None = None


@router.get("/discovery/sessions", response_model=list[DiscoverySessionResponse])
def get_discovery_sessions(
    user: Annotated[UserPrincipal, Depends(require_player)],
    sport: Annotated[SportType | None, Query()] = None,
    district: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    starts_from: Annotated[datetime | None, Query()] = None,
    starts_to: Annotated[datetime | None, Query()] = None,
    has_open_slots: Annotated[bool | None, Query()] = None,
    post_type: Annotated[SessionPostType | None, Query()] = None,
) -> list[dict[str, object]]:
    return list_discovery_sessions(
        player_user_id=user.id,
        sport=sport,
        district=district,
        starts_from=starts_from,
        starts_to=starts_to,
        has_open_slots=has_open_slots,
        post_type=post_type,
    )


@router.get("/sessions/{session_id}", response_model=DiscoverySessionResponse)
def get_player_session_detail(
    session_id: str,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    _ = user
    return get_session_detail(session_id=session_id)


@router.post("/bookings", response_model=BookingResponse, status_code=201)
def post_booking(
    payload: BookingCreate,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    return create_booking_safe(player_user_id=user.id, data=payload.model_dump(exclude_unset=True))


@router.get("/bookings", response_model=list[BookingResponse])
def get_bookings(
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> list[dict[str, object]]:
    return list_my_bookings(player_user_id=user.id)


@router.get("/bookings/{booking_id}", response_model=BookingResponse)
def get_booking_detail(
    booking_id: str,
    user: Annotated[UserPrincipal, Depends(require_player)],
) -> dict[str, object]:
    return get_my_booking(player_user_id=user.id, booking_id=booking_id)
