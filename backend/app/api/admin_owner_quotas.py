from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.dependencies import require_admin
from app.services.admin_auth import AdminPrincipal
from app.services.owner_inventory import (
    list_owner_post_quotas_for_admin,
    update_owner_post_quota_for_admin,
)

router = APIRouter(prefix="/admin/owner-post-quotas", tags=["admin-owner-post-quotas"])


class OwnerPostQuotaUpdate(BaseModel):
    rental_post_limit: int = Field(ge=0, le=1000)
    slot_post_limit: int = Field(ge=0, le=1000)


class OwnerPostQuotaResponse(BaseModel):
    owner_user_id: str
    owner_full_name: str | None = None
    owner_email: str | None = None
    rental_post_limit: int
    slot_post_limit: int
    rental_posts_used: int
    slot_posts_used: int
    rental_posts_remaining: int
    slot_posts_remaining: int
    updated_at: datetime | None = None


@router.get("", response_model=list[OwnerPostQuotaResponse])
def list_owner_post_quotas(
    _admin: Annotated[AdminPrincipal, Depends(require_admin)],
) -> list[dict[str, object]]:
    return list_owner_post_quotas_for_admin()


@router.put("/{owner_user_id}", response_model=OwnerPostQuotaResponse)
def update_owner_post_quota(
    owner_user_id: str,
    payload: OwnerPostQuotaUpdate,
    admin: Annotated[AdminPrincipal, Depends(require_admin)],
) -> dict[str, object]:
    return update_owner_post_quota_for_admin(
        actor_user_id=admin.user_id,
        owner_user_id=owner_user_id,
        rental_post_limit=payload.rental_post_limit,
        slot_post_limit=payload.slot_post_limit,
    )
