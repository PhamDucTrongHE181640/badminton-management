from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

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


def create_deposit_payment_intent(*, booking_id: str, player_user_id: str) -> dict[str, Any]:
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
        if deposit_tx.status != "paid":
            expires_at = datetime.now(UTC) + timedelta(minutes=15)
            connection.execute(
                text(
                    """
                    UPDATE public.payment_transactions
                    SET status = CAST('processing' AS public.payment_status),
                        provider = 'vnpay',
                        external_ref = COALESCE(external_ref, :external_ref),
                        requested_at = now(),
                        expires_at = :expires_at,
                        failed_at = NULL
                    WHERE id = :payment_id
                    """
                ),
                {
                    "payment_id": str(deposit_tx.id),
                    "external_ref": f"DEP-{booking.booking_code}",
                    "expires_at": expires_at,
                },
            )
            external_ref = deposit_tx.external_ref or f"DEP-{booking.booking_code}"
            status = "processing"
        else:
            external_ref = deposit_tx.external_ref or f"DEP-{booking.booking_code}"
            expires_at = deposit_tx.expires_at
            status = "paid"

        payment_url = (
            "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
            f"?vnp_TxnRef={external_ref}&vnp_Amount={int(booking.deposit_required_vnd)}"
            f"&return_url={settings.frontend_base_url}/player/bookings"
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
