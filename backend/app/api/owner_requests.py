from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.dependencies import require_user
from app.services.owner_onboarding import create_owner_request, list_my_owner_requests
from app.services.user_auth import UserPrincipal

router = APIRouter(prefix="/owner/requests", tags=["owner-requests"])


class OwnerRequestCreate(BaseModel):
    business_name: str = Field(min_length=2, max_length=200)
    contact_phone: str | None = Field(default=None, max_length=40)
    facility_overview: str | None = Field(default=None, max_length=2000)


class OwnerRequestResponse(BaseModel):
    id: str
    user_id: str
    business_name: str
    contact_phone: str | None
    facility_overview: str | None
    status: str
    submitted_at: datetime
    reviewed_at: datetime | None
    reviewed_by: str | None
    review_note: str | None
    user_email: str | None = None
    user_full_name: str | None = None


@router.post("", response_model=OwnerRequestResponse, status_code=201)
def create_request(
    payload: OwnerRequestCreate,
    user: Annotated[UserPrincipal, Depends(require_user)],
) -> dict[str, object]:
    return create_owner_request(
        user_id=user.id,
        business_name=payload.business_name,
        contact_phone=payload.contact_phone,
        facility_overview=payload.facility_overview,
    )


@router.get("/me", response_model=list[OwnerRequestResponse])
def my_requests(
    user: Annotated[UserPrincipal, Depends(require_user)],
) -> list[dict[str, object]]:
    return list_my_owner_requests(user_id=user.id)
