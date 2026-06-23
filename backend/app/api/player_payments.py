from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, ConfigDict, Field

from app.core.config import get_settings
from app.core.dependencies import require_player
from app.services.player_payments import (
    create_deposit_payment_intent,
    handle_vnpay_return,
    handle_vnpay_webhook,
)
from app.services.user_auth import UserPrincipal

router = APIRouter(tags=["player-payments"])


class PaymentModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class DepositPaymentIntentResponse(BaseModel):
    booking_id: str
    booking_code: str
    payment_transaction_id: str
    external_ref: str
    amount_vnd: int
    status: str
    expires_at: datetime | None
    payment_url: str


class VnpayWebhookPayload(PaymentModel):
    external_ref: str = Field(min_length=3, max_length=200)
    provider_transaction_id: str = Field(min_length=3, max_length=200)
    status: Literal["paid", "failed", "cancelled", "expired"]
    amount_vnd: int | None = Field(default=None, gt=0)
    paid_at: datetime | None = None
    metadata: dict[str, Any] | None = None


class VnpayWebhookResponse(BaseModel):
    ok: bool
    ignored: bool | None = None
    idempotent: bool | None = None
    reason: str | None = None
    booking_id: str | None = None
    payment_transaction_id: str | None = None
    payment_status: str | None = None
    booking_status: str | None = None


@router.post(
    "/player/bookings/{booking_id}/deposit-payment",
    response_model=DepositPaymentIntentResponse,
)
def post_deposit_payment_intent(
    booking_id: str,
    player: Annotated[UserPrincipal, Depends(require_player)],
    request: Request,
) -> dict[str, object]:
    return create_deposit_payment_intent(
        booking_id=booking_id,
        player_user_id=player.id,
        client_ip=request.client.host if request.client else None,
    )


@router.post("/payments/vnpay/webhook", response_model=VnpayWebhookResponse)
def post_vnpay_webhook(
    payload: VnpayWebhookPayload,
) -> dict[str, object]:
    return handle_vnpay_webhook(payload=payload.model_dump(exclude_none=True))


@router.get("/payments/vnpay/return")
def get_vnpay_return(request: Request) -> RedirectResponse:
    result = handle_vnpay_return(payload=dict(request.query_params))
    settings = get_settings()
    status_param = "success" if result.get("status") == "paid" else "failed"
    return RedirectResponse(
        f"{settings.frontend_base_url}/player/booking?status={status_param}&bookingId={result.get('booking_id') or ''}"
    )
