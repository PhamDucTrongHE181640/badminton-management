from __future__ import annotations

from typing import Any

from psycopg.types.json import Jsonb
from sqlalchemy import text

from app.core.errors import AppError
from app.db.session import get_engine


def _audit(
    connection: Any,
    *,
    actor_user_id: str,
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


def _checkin_row_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "booking_id": str(row.booking_id),
        "owner_user_id": str(row.owner_user_id),
        "checkin_method": str(row.checkin_method),
        "cash_collected_vnd": int(row.cash_collected_vnd),
        "note": str(row.note) if row.note else None,
        "checked_in_at": row.checked_in_at,
        "created_at": row.created_at,
        "booking_code": str(row.booking_code),
        "booking_status": str(row.booking_status),
        "payment_method": str(row.payment_method),
        "remaining_due_vnd": int(row.remaining_due_vnd),
        "session_title": str(row.session_title),
        "session_starts_at": row.session_starts_at,
        "complex_name": str(row.complex_name),
        "court_name": str(row.court_name),
        "sub_court_name": str(row.sub_court_name),
    }


def _checkin_select_sql(where_clause: str) -> str:
    return f"""
        SELECT
          ck.id,
          ck.booking_id,
          ck.owner_user_id,
          ck.checkin_method,
          ck.cash_collected_vnd,
          ck.note,
          ck.checked_in_at,
          ck.created_at,
          b.booking_code,
          b.status::text AS booking_status,
          b.payment_method::text AS payment_method,
          b.remaining_due_vnd,
          s.title AS session_title,
          s.starts_at AS session_starts_at,
          cc.name AS complex_name,
          c.name AS court_name,
          c.sub_court_name
        FROM public.checkins ck
        JOIN public.bookings b ON b.id = ck.booking_id
        JOIN public.sessions s ON s.id = b.session_id
        JOIN public.courts c ON c.id = b.court_id
        JOIN public.court_complexes cc ON cc.id = c.complex_id
        {where_clause}
    """


def list_owner_checkins(*, owner_user_id: str) -> list[dict[str, Any]]:
    with get_engine().begin() as connection:
        where_clause = (
            "WHERE ck.owner_user_id = :owner_user_id "
            "ORDER BY ck.checked_in_at DESC LIMIT 200"
        )
        rows = connection.execute(
            text(_checkin_select_sql(where_clause)),
            {"owner_user_id": owner_user_id},
        ).all()
    return [_checkin_row_to_dict(row) for row in rows]


def create_owner_checkin(*, owner_user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    booking_code = data.get("booking_code")
    qr_payload = data.get("qr_payload")
    if not booking_code and not qr_payload:
        raise AppError(
            status_code=422,
            code="checkin_identifier_required",
            message="Cần cung cấp booking_code hoặc qr_payload",
        )

    with get_engine().begin() as connection:
        if booking_code:
            where_clause = "b.booking_code = :booking_code"
            params: dict[str, Any] = {"booking_code": booking_code}
            checkin_method = "booking_code"
        else:
            where_clause = "b.qr_payload = :qr_payload"
            params = {"qr_payload": qr_payload}
            checkin_method = "qr"

        booking = connection.execute(
            text(
                f"""
                SELECT
                  b.id,
                  b.booking_code,
                  b.status::text AS status,
                  b.payment_method::text AS payment_method,
                  b.remaining_due_vnd,
                  b.player_user_id,
                  s.title AS session_title,
                  s.starts_at AS session_starts_at,
                  c.owner_user_id AS court_owner_user_id,
                  c.name AS court_name,
                  c.sub_court_name,
                  cc.name AS complex_name
                FROM public.bookings b
                JOIN public.sessions s ON s.id = b.session_id
                JOIN public.courts c ON c.id = b.court_id
                JOIN public.court_complexes cc ON cc.id = c.complex_id
                WHERE {where_clause}
                FOR UPDATE
                """
            ),
            params,
        ).first()
        if booking is None:
            raise AppError(
                status_code=404,
                code="booking_not_found",
                message="Không tìm thấy booking cần check-in",
            )
        if str(booking.court_owner_user_id) != owner_user_id:
            raise AppError(
                status_code=403,
                code="checkin_forbidden",
                message="Tài khoản owner không sở hữu booking này",
            )
        if booking.status not in {"deposit_paid", "confirmed"}:
            raise AppError(
                status_code=409,
                code="checkin_status_invalid",
                message="Booking chưa đủ điều kiện check-in",
            )

        if booking.payment_method == "vnpay" and int(booking.remaining_due_vnd) > 0:
            remaining_paid = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM public.payment_transactions
                    WHERE booking_id = :booking_id
                      AND kind = 'remaining'
                      AND status = 'paid'
                    LIMIT 1
                    """
                ),
                {"booking_id": str(booking.id)},
            ).first()
            if remaining_paid is None:
                raise AppError(
                    status_code=409,
                    code="remaining_payment_required",
                    message="Booking cần thanh toán phần còn lại trước khi check-in",
                )

        cash_collected = data.get("cash_collected_vnd")
        if cash_collected is None:
            if booking.payment_method == "cash":
                cash_collected = int(booking.remaining_due_vnd)
            else:
                cash_collected = 0

        inserted = connection.execute(
            text(
                """
                INSERT INTO public.checkins (
                  booking_id,
                  owner_user_id,
                  checkin_method,
                  cash_collected_vnd,
                  note
                )
                VALUES (
                  :booking_id,
                  :owner_user_id,
                  :checkin_method,
                  :cash_collected_vnd,
                  :note
                )
                RETURNING id
                """
            ),
            {
                "booking_id": str(booking.id),
                "owner_user_id": owner_user_id,
                "checkin_method": checkin_method,
                "cash_collected_vnd": int(cash_collected),
                "note": data.get("note"),
            },
        ).first()
        if inserted is None:
            raise AppError(
                status_code=500,
                code="checkin_create_failed",
                message="Không tạo được check-in",
            )

        _audit(
            connection,
            actor_user_id=owner_user_id,
            event_type="booking_checked_in",
            entity_type="booking",
            entity_id=str(booking.id),
            payload={
                "checkin_id": str(inserted.id),
                "checkin_method": checkin_method,
                "cash_collected_vnd": int(cash_collected),
            },
        )

        row = connection.execute(
            text(_checkin_select_sql("WHERE ck.id = :checkin_id LIMIT 1")),
            {"checkin_id": str(inserted.id)},
        ).first()

    if row is None:
        raise AppError(
            status_code=500,
            code="checkin_read_failed",
            message="Đã tạo check-in nhưng không đọc được dữ liệu",
        )
    return _checkin_row_to_dict(row)
