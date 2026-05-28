from __future__ import annotations

import hashlib
import hmac
import re
from datetime import UTC, datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

from psycopg.types.json import Jsonb
from sqlalchemy import text

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.session import get_engine

BOOKING_TERMINAL_STATUSES = {"checked_in", "completed", "cancelled", "expired"}
WEBHOOK_STATUS_MAP = {
    "paid": "paid",
    "failed": "failed",
    "cancelled": "cancelled",
    "expired": "expired",
}
VNPAY_VERSION = "2.1.0"
VNPAY_COMMAND = "pay"
VNPAY_CURR_CODE = "VND"
VNPAY_PAY_DATE_FORMAT = "%Y%m%d%H%M%S"
VNPAY_TIMEZONE = timezone(timedelta(hours=7))


def _payment_reference(prefix: str, booking_code: str) -> str:
    value = f"{prefix}{booking_code}"
    return re.sub(r"[^A-Za-z0-9]", "", value)


def _vnpay_return_url(settings: Any) -> str:
    if settings.vnpay_return_url:
        return settings.vnpay_return_url
    return f"{settings.backend_base_url.rstrip('/')}/api/v1/payments/vnpay/return"


def _require_vnpay_settings(settings: Any) -> None:
    if not settings.vnpay_tmn_code or not settings.vnpay_hash_secret:
        raise AppError(
            status_code=501,
            code="vnpay_not_configured",
            message="VNPay chưa được cấu hình TMN code hoặc hash secret",
        )


def _vnpay_secure_hash(params: dict[str, str], *, hash_secret: str) -> str:
    hash_data = urlencode(sorted(params.items()))
    return hmac.new(
        hash_secret.encode("utf-8"), hash_data.encode("utf-8"), hashlib.sha512
    ).hexdigest()


def _build_vnpay_payment_url(
    *,
    settings: Any,
    external_ref: str,
    amount_vnd: int,
    order_info: str,
    client_ip: str | None,
    created_at: datetime | None = None,
    expires_at: datetime | None = None,
) -> str:
    _require_vnpay_settings(settings)
    now = created_at or datetime.now(VNPAY_TIMEZONE)
    if now.tzinfo is None:
        now = now.replace(tzinfo=VNPAY_TIMEZONE)
    expire_value = (
        expires_at.astimezone(VNPAY_TIMEZONE) if expires_at else now + timedelta(minutes=15)
    )

    params = {
        "vnp_Version": VNPAY_VERSION,
        "vnp_Command": VNPAY_COMMAND,
        "vnp_TmnCode": settings.vnpay_tmn_code,
        "vnp_Amount": str(int(amount_vnd) * 100),
        "vnp_CurrCode": VNPAY_CURR_CODE,
        "vnp_TxnRef": external_ref,
        "vnp_OrderInfo": order_info,
        "vnp_OrderType": settings.vnpay_order_type,
        "vnp_Locale": settings.vnpay_locale,
        "vnp_ReturnUrl": _vnpay_return_url(settings),
        "vnp_IpAddr": client_ip or "127.0.0.1",
        "vnp_CreateDate": now.astimezone(VNPAY_TIMEZONE).strftime(VNPAY_PAY_DATE_FORMAT),
        "vnp_ExpireDate": expire_value.strftime(VNPAY_PAY_DATE_FORMAT),
    }
    secure_hash = _vnpay_secure_hash(params, hash_secret=settings.vnpay_hash_secret)
    query = urlencode(sorted({**params, "vnp_SecureHash": secure_hash}.items()))
    return f"{settings.vnpay_payment_url}?{query}"


def _verify_vnpay_signature(payload: dict[str, Any], *, hash_secret: str) -> bool:
    secure_hash = str(payload.get("vnp_SecureHash") or "")
    if not secure_hash:
        return False
    signed_params = {
        str(key): str(value)
        for key, value in payload.items()
        if key not in {"vnp_SecureHash", "vnp_SecureHashType"} and value is not None
    }
    expected_hash = _vnpay_secure_hash(signed_params, hash_secret=hash_secret)
    return hmac.compare_digest(expected_hash.lower(), secure_hash.lower())


def _parse_vnpay_pay_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, VNPAY_PAY_DATE_FORMAT).replace(tzinfo=VNPAY_TIMEZONE)
    except ValueError:
        return None


def _audit(
    connection: Any,
    *,
    actor_user_id: str | None,
    event_type: str,
    entity_type: str,
    entity_id: str,
    payload: dict[str, Any] | None = None,
) -> None:
    connection.execute(
        text(
            """
            INSERT INTO public.audit_logs (
              actor_user_id,
              event_type,
              entity_type,
              entity_id,
              payload
            )
            VALUES (:actor_user_id, :event_type, :entity_type, :entity_id, :payload)
            """
        ),
        {
            "actor_user_id": actor_user_id,
            "event_type": event_type,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "payload": Jsonb(payload or {}),
        },
    )


def _require_booking_for_player(
    connection: Any, *, booking_id: str, player_user_id: str
) -> Any:
    row = connection.execute(
        text(
            """
            SELECT
              b.id,
              b.booking_code,
              b.player_user_id,
              b.session_id,
              b.mode::text AS mode,
              b.status::text AS status,
              b.payment_method::text AS payment_method,
              b.total_price_vnd,
              b.deposit_required_vnd,
              b.remaining_due_vnd,
              b.seats_booked,
              s.status::text AS session_status,
              s.open_slots,
              s.max_slots
            FROM public.bookings b
            JOIN public.sessions s ON s.id = b.session_id
            WHERE b.id = :booking_id AND b.player_user_id = :player_user_id
            FOR UPDATE
            """
        ),
        {"booking_id": booking_id, "player_user_id": player_user_id},
    ).first()
    if row is None:
        raise AppError(
            status_code=404,
            code="booking_not_found",
            message="Không tìm thấy booking của tài khoản này",
        )
    return row


def _require_deposit_tx(connection: Any, *, booking_id: str) -> Any:
    row = connection.execute(
        text(
            """
            SELECT
              id,
              booking_id,
              kind::text AS kind,
              method::text AS method,
              provider,
              provider_transaction_id,
              external_ref,
              amount_vnd,
              status::text AS status,
              requested_at,
              paid_at,
              failed_at,
              expires_at
            FROM public.payment_transactions
            WHERE booking_id = :booking_id
              AND kind = 'deposit'
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
            """
        ),
        {"booking_id": booking_id},
    ).first()
    if row is None:
        raise AppError(
            status_code=404,
            code="deposit_transaction_not_found",
            message="Không tìm thấy giao dịch đặt cọc",
        )
    return row


def _sync_booking_status_from_payments(connection: Any, *, booking_id: str) -> str:
    booking = connection.execute(
        text(
            """
            SELECT
              id,
              status::text AS status,
              payment_method::text AS payment_method,
              remaining_due_vnd
            FROM public.bookings
            WHERE id = :booking_id
            FOR UPDATE
            """
        ),
        {"booking_id": booking_id},
    ).first()
    if booking is None:
        raise AppError(
            status_code=404,
            code="booking_not_found",
            message="Không tìm thấy booking",
        )
    if str(booking.status) in BOOKING_TERMINAL_STATUSES:
        return str(booking.status)

    payment_rows = connection.execute(
        text(
            """
            SELECT kind::text AS kind, status::text AS status
            FROM public.payment_transactions
            WHERE booking_id = :booking_id
            """
        ),
        {"booking_id": booking_id},
    ).all()

    deposit_paid = any(row.kind == "deposit" and row.status == "paid" for row in payment_rows)
    remaining_paid = any(row.kind == "remaining" and row.status == "paid" for row in payment_rows)

    if not deposit_paid:
        next_status = "awaiting_deposit"
    elif booking.payment_method == "cash" and int(booking.remaining_due_vnd) > 0:
        next_status = "deposit_paid"
    elif int(booking.remaining_due_vnd) == 0 or remaining_paid:
        next_status = "confirmed"
    else:
        next_status = "deposit_paid"

    if next_status != booking.status:
        connection.execute(
            text(
                """
                UPDATE public.bookings
                SET status = CAST(:status AS public.booking_status)
                WHERE id = :booking_id
                """
            ),
            {"status": next_status, "booking_id": booking_id},
        )
    return next_status


def _expire_booking_and_release_slot(
    connection: Any, *, booking_id: str, reason: str
) -> str:
    row = connection.execute(
        text(
            """
            SELECT
              b.id,
              b.status::text AS booking_status,
              b.seats_booked,
              b.session_id,
              s.status::text AS session_status,
              s.open_slots,
              s.max_slots
            FROM public.bookings b
            JOIN public.sessions s ON s.id = b.session_id
            WHERE b.id = :booking_id
            FOR UPDATE
            """
        ),
        {"booking_id": booking_id},
    ).first()
    if row is None:
        raise AppError(
            status_code=404,
            code="booking_not_found",
            message="Không tìm thấy booking",
        )
    if row.booking_status in {"cancelled", "expired"}:
        return str(row.booking_status)
    if row.booking_status in {"checked_in", "completed"}:
        return str(row.booking_status)

    connection.execute(
        text(
            """
            UPDATE public.bookings
            SET status = CAST('expired' AS public.booking_status),
                cancelled_at = now(),
                cancel_reason = :reason
            WHERE id = :booking_id
            """
        ),
        {"booking_id": booking_id, "reason": reason},
    )

    next_open_slots = min(int(row.max_slots), int(row.open_slots) + int(row.seats_booked))
    if str(row.session_status) == "locked" and next_open_slots > 0:
        next_session_status = "scheduled"
    else:
        next_session_status = str(row.session_status)
    connection.execute(
        text(
            """
            UPDATE public.sessions
            SET open_slots = :open_slots,
                status = CAST(:status AS public.session_status)
            WHERE id = :session_id
            """
        ),
        {
            "open_slots": next_open_slots,
            "status": next_session_status,
            "session_id": str(row.session_id),
        },
    )
    return "expired"


def create_deposit_payment_intent(
    *, booking_id: str, player_user_id: str, client_ip: str | None = None
) -> dict[str, Any]:
    settings = get_settings()
    with get_engine().begin() as connection:
        booking = _require_booking_for_player(
            connection, booking_id=booking_id, player_user_id=player_user_id
        )
        if booking.status in BOOKING_TERMINAL_STATUSES:
            raise AppError(
                status_code=409,
                code="booking_terminal_status",
                message="Booking đã kết thúc, không thể tạo giao dịch cọc",
            )

        deposit_tx = _require_deposit_tx(connection, booking_id=booking_id)
        external_ref = _payment_reference("DEP", str(booking.booking_code))
        if deposit_tx.status != "paid":
            expires_at = datetime.now(UTC) + timedelta(minutes=15)
            connection.execute(
                text(
                    """
                    UPDATE public.payment_transactions
                    SET status = CAST('processing' AS public.payment_status),
                        provider = 'vnpay',
                        external_ref = :external_ref,
                        requested_at = now(),
                        expires_at = :expires_at,
                        failed_at = NULL
                    WHERE id = :payment_id
                    """
                ),
                {
                    "payment_id": str(deposit_tx.id),
                    "external_ref": external_ref,
                    "expires_at": expires_at,
                },
            )
            status = "processing"
        else:
            external_ref = deposit_tx.external_ref or external_ref
            expires_at = deposit_tx.expires_at
            status = "paid"

        payment_url = _build_vnpay_payment_url(
            settings=settings,
            external_ref=external_ref,
            amount_vnd=int(booking.deposit_required_vnd),
            order_info=f"NetUp deposit {booking.booking_code}",
            client_ip=client_ip,
            expires_at=expires_at,
        )

        _audit(
            connection,
            actor_user_id=player_user_id,
            event_type="booking_deposit_intent_created",
            entity_type="booking",
            entity_id=str(booking.id),
            payload={
                "payment_transaction_id": str(deposit_tx.id),
                "external_ref": external_ref,
            },
        )

    return {
        "booking_id": str(booking.id),
        "booking_code": str(booking.booking_code),
        "payment_transaction_id": str(deposit_tx.id),
        "external_ref": external_ref,
        "amount_vnd": int(booking.deposit_required_vnd),
        "status": status,
        "expires_at": expires_at,
        "payment_url": payment_url,
    }


def handle_vnpay_webhook(*, payload: dict[str, Any]) -> dict[str, Any]:
    external_ref = str(payload["external_ref"])
    incoming_status = str(payload["status"])
    mapped_status = WEBHOOK_STATUS_MAP[incoming_status]
    provider_transaction_id = str(payload["provider_transaction_id"])
    amount_vnd = int(payload.get("amount_vnd")) if payload.get("amount_vnd") is not None else None
    paid_at = payload.get("paid_at")

    with get_engine().begin() as connection:
        tx = connection.execute(
            text(
                """
                SELECT
                  id,
                  booking_id,
                  kind::text AS kind,
                  amount_vnd,
                  status::text AS status,
                  provider_transaction_id
                FROM public.payment_transactions
                WHERE provider = 'vnpay'
                  AND external_ref = :external_ref
                ORDER BY created_at DESC
                LIMIT 1
                FOR UPDATE
                """
            ),
            {"external_ref": external_ref},
        ).first()
        if tx is None:
            return {"ok": True, "ignored": True, "reason": "transaction_not_found"}

        if tx.status == "paid":
            return {"ok": True, "idempotent": True, "booking_id": str(tx.booking_id)}

        if amount_vnd is not None and int(tx.amount_vnd) != amount_vnd:
            raise AppError(
                status_code=409,
                code="webhook_amount_mismatch",
                message="Số tiền webhook không khớp giao dịch",
            )

        if tx.provider_transaction_id and tx.provider_transaction_id == provider_transaction_id:
            if tx.status == mapped_status:
                return {"ok": True, "idempotent": True, "booking_id": str(tx.booking_id)}

        update_params = {
            "payment_id": str(tx.id),
            "status": mapped_status,
            "provider_transaction_id": provider_transaction_id,
            "metadata": Jsonb(payload.get("metadata") or {}),
        }
        if mapped_status == "paid":
            paid_value = paid_at or datetime.now(UTC)
            connection.execute(
                text(
                    """
                    UPDATE public.payment_transactions
                    SET status = CAST(:status AS public.payment_status),
                        provider_transaction_id = :provider_transaction_id,
                        metadata = metadata || :metadata,
                        paid_at = :paid_at,
                        failed_at = NULL
                    WHERE id = :payment_id
                    """
                ),
                {**update_params, "paid_at": paid_value},
            )
            next_booking_status = _sync_booking_status_from_payments(
                connection, booking_id=str(tx.booking_id)
            )
        elif mapped_status == "expired":
            connection.execute(
                text(
                    """
                    UPDATE public.payment_transactions
                    SET status = CAST(:status AS public.payment_status),
                        provider_transaction_id = :provider_transaction_id,
                        metadata = metadata || :metadata,
                        expires_at = now()
                    WHERE id = :payment_id
                    """
                ),
                update_params,
            )
            if tx.kind == "deposit":
                next_booking_status = _expire_booking_and_release_slot(
                    connection,
                    booking_id=str(tx.booking_id),
                    reason="Deposit payment expired",
                )
            else:
                next_booking_status = _sync_booking_status_from_payments(
                    connection, booking_id=str(tx.booking_id)
                )
        else:
            connection.execute(
                text(
                    """
                    UPDATE public.payment_transactions
                    SET status = CAST(:status AS public.payment_status),
                        provider_transaction_id = :provider_transaction_id,
                        metadata = metadata || :metadata,
                        failed_at = now()
                    WHERE id = :payment_id
                    """
                ),
                update_params,
            )
            next_booking_status = _sync_booking_status_from_payments(
                connection, booking_id=str(tx.booking_id)
            )

        _audit(
            connection,
            actor_user_id=None,
            event_type="payment_webhook_processed",
            entity_type="payment_transaction",
            entity_id=str(tx.id),
            payload={
                "booking_id": str(tx.booking_id),
                "status": mapped_status,
                "external_ref": external_ref,
            },
        )

    return {
        "ok": True,
        "idempotent": False,
        "booking_id": str(tx.booking_id),
        "payment_transaction_id": str(tx.id),
        "payment_status": mapped_status,
        "booking_status": next_booking_status,
    }


def handle_vnpay_return(*, payload: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    _require_vnpay_settings(settings)
    if not _verify_vnpay_signature(payload, hash_secret=settings.vnpay_hash_secret):
        return {"ok": False, "status": "invalid_signature"}

    response_code = str(payload.get("vnp_ResponseCode") or "")
    transaction_status = str(payload.get("vnp_TransactionStatus") or "")
    if response_code == "00" and transaction_status == "00":
        status = "paid"
    elif response_code == "24":
        status = "cancelled"
    else:
        status = "failed"

    amount_text = payload.get("vnp_Amount")
    amount_vnd = int(amount_text) // 100 if amount_text is not None else None
    provider_transaction_id = (
        str(payload.get("vnp_TransactionNo") or "")
        or str(payload.get("vnp_BankTranNo") or "")
        or f"vnpay-{payload.get('vnp_TxnRef')}-{response_code}"
    )
    result = handle_vnpay_webhook(
        payload={
            "external_ref": str(payload.get("vnp_TxnRef") or ""),
            "provider_transaction_id": provider_transaction_id,
            "status": status,
            "amount_vnd": amount_vnd,
            "paid_at": _parse_vnpay_pay_date(str(payload.get("vnp_PayDate") or "")),
            "metadata": payload,
        }
    )
    return {"ok": True, "status": status, **result}
