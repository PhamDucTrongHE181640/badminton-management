from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.dependencies import require_admin
from app.services.admin_auth import AdminPrincipal
from app.services.owner_onboarding import (
    approve_owner_request,
    list_owner_requests,
    reject_owner_request,
)

router = APIRouter(prefix="/admin/owner-requests", tags=["admin-owner-requests"])


class OwnerRequestReview(BaseModel):
    review_note: str | None = Field(default=None, max_length=1000)


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


@router.get("", response_model=list[OwnerRequestResponse])
def list_requests(
    _admin: Annotated[AdminPrincipal, Depends(require_admin)],
    status: Annotated[
        Literal["pending", "approved", "rejected", "cancelled"] | None,
        Query(),
    ] = None,
) -> list[dict[str, object]]:
    return list_owner_requests(status=status)


@router.post("/{request_id}/approve", response_model=OwnerRequestResponse)
def approve_request(
    request_id: str,
    payload: OwnerRequestReview,
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
) -> dict[str, object]:
    return approve_owner_request(
        request_id=request_id,
        admin_user_id=admin.user_id,
        review_note=payload.review_note,
    )


@router.post("/{request_id}/reject", response_model=OwnerRequestResponse)
def reject_request(
    request_id: str,
    payload: OwnerRequestReview,
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
) -> dict[str, object]:
    return reject_owner_request(
        request_id=request_id,
        admin_user_id=admin.user_id,
        review_note=payload.review_note,
    )
