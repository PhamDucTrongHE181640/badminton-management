from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.dependencies import require_owner
from app.services.owner_checkins import create_owner_checkin, list_owner_checkins
from app.services.user_auth import UserPrincipal

router = APIRouter(prefix="/owner/checkins", tags=["owner-checkins"])


class CheckinModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class OwnerCheckinCreate(CheckinModel):
    booking_code: str | None = Field(default=None, min_length=3, max_length=64)
    qr_payload: str | None = Field(default=None, min_length=5, max_length=255)
    cash_collected_vnd: int | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_identifier(self) -> OwnerCheckinCreate:
        if not self.booking_code and not self.qr_payload:
            raise ValueError("booking_code or qr_payload is required")
        return self


class OwnerCheckinResponse(BaseModel):
    id: str
    booking_id: str
    owner_user_id: str
    checkin_method: str
    cash_collected_vnd: int
    note: str | None = None
    checked_in_at: datetime
    created_at: datetime
    booking_code: str
    booking_status: str
    payment_method: str
    remaining_due_vnd: int
    session_title: str
    session_starts_at: datetime
    complex_name: str
    court_name: str
    sub_court_name: str


@router.get("", response_model=list[OwnerCheckinResponse])
def get_owner_checkins(
    owner: Annotated[UserPrincipal, Depends(require_owner)],
) -> list[dict[str, object]]:
    return list_owner_checkins(owner_user_id=owner.id)


@router.post("", response_model=OwnerCheckinResponse, status_code=201)
def post_owner_checkin(
    payload: OwnerCheckinCreate,
    owner: Annotated[UserPrincipal, Depends(require_owner)],
) -> dict[str, object]:
    return create_owner_checkin(owner_user_id=owner.id, data=payload.model_dump(exclude_none=True))
