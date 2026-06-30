from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.api.player_booking import DiscoverySessionResponse
from app.services.player_booking import list_discovery_sessions

router = APIRouter(prefix="/public", tags=["public-discovery"])

SportType = Literal["Badminton", "Football", "Tennis"]
SessionPostType = Literal["pool", "rental"]


@router.get("/discovery/sessions", response_model=list[DiscoverySessionResponse])
def get_public_discovery_sessions(
    sport: Annotated[SportType | None, Query()] = None,
    district: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    starts_from: Annotated[datetime | None, Query()] = None,
    starts_to: Annotated[datetime | None, Query()] = None,
    has_open_slots: Annotated[bool | None, Query()] = None,
    post_type: Annotated[SessionPostType | None, Query()] = None,
) -> list[dict[str, object]]:
    return list_discovery_sessions(
        player_user_id=None,
        sport=sport,
        district=district,
        starts_from=starts_from,
        starts_to=starts_to,
        has_open_slots=has_open_slots,
        post_type=post_type,
    )
