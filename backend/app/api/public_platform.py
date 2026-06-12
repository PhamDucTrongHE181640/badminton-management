from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from app.services.public_platform import create_contact_lead, get_platform_stats

router = APIRouter(prefix="/public", tags=["public-platform"])


class PublicModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)


class ContactLeadCreate(PublicModel):
    full_name: str = Field(alias="fullName", min_length=1, max_length=200)
    phone: str = Field(min_length=3, max_length=40)
    email: str = Field(min_length=3, max_length=320)
    partner_type: str = Field(alias="partnerType", min_length=1, max_length=80)
    organization_name: str = Field(alias="organizationName", min_length=1, max_length=240)
    address: str = Field(min_length=2, max_length=500)
    message: str | None = Field(default=None, max_length=2000)
    source: str = Field(default="web", max_length=80)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ContactLeadResponse(BaseModel):
    id: str
    status: str
    created_at: datetime


class PlatformStatsResponse(BaseModel):
    users_total: int
    active_owners: int
    active_courts: int
    upcoming_sessions: int
    completed_bookings: int


@router.get("/platform-stats", response_model=PlatformStatsResponse)
def get_public_platform_stats() -> dict[str, int]:
    return get_platform_stats()


@router.post("/contact-leads", response_model=ContactLeadResponse, status_code=201)
def post_contact_lead(payload: ContactLeadCreate) -> dict[str, object]:
    return create_contact_lead(data=payload.model_dump(exclude_none=True))
