from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from secrets import token_hex
from typing import Any

from psycopg.types.json import Jsonb
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError
from app.db.session import get_engine

SESSION_DISCOVERY_STATUSES = {"scheduled", "locked"}


def _round_money(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _session_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "court_id": str(row.court_id),
        "title": str(row.title),
        "post_type": str(row.post_type),
        "status": str(row.status),
        "starts_at": row.starts_at,
        "duration_minutes": int(row.duration_minutes),
        "ends_at": row.ends_at,
        "open_slots": int(row.open_slots),
        "max_slots": int(row.max_slots),
        "required_skill_min": str(row.required_skill_min),
        "required_skill_max": str(row.required_skill_max),
        "slot_price_vnd": int(row.slot_price_vnd),
        "full_court_price_vnd": int(row.full_court_price_vnd),
        "is_peak_hour": bool(row.is_peak_hour),
        "allows_solo_join": bool(row.allows_solo_join),
        "court_name": str(row.court_name),
        "sub_court_name": str(row.sub_court_name),
        "sport": str(row.sport),
        "amenities": list(row.amenities or []),
        "base_price_vnd": int(row.base_price_vnd),
        "complex_id": str(row.complex_id),
        "complex_name": str(row.complex_name),
        "district": str(row.district),
        "address": str(row.address),
        "latitude": float(row.latitude) if row.latitude is not None else None,
        "longitude": float(row.longitude) if row.longitude is not None else None,
    }


def _booking_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "booking_code": str(row.booking_code),
        "session_id": str(row.session_id),
        "court_id": str(row.court_id),
        "player_user_id": str(row.player_user_id),
        "mode": str(row.mode),
        "seats_booked": int(row.seats_booked),
        "status": str(row.status),
        "payment_method": str(row.payment_method),
        "base_price_vnd": int(row.base_price_vnd),
        "floor_fee_vnd": int(row.floor_fee_vnd),
        "platform_fee_vnd": int(row.platform_fee_vnd),
        "total_price_vnd": int(row.total_price_vnd),
        "deposit_required_vnd": int(row.deposit_required_vnd),
        "remaining_due_vnd": int(row.remaining_due_vnd),
        "qr_payload": str(row.qr_payload),
        "checked_in_at": row.checked_in_at,
        "completed_at": row.completed_at,
        "cancelled_at": row.cancelled_at,
        "cancel_reason": str(row.cancel_reason) if row.cancel_reason else None,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "session_title": str(row.session_title) if row.session_title else None,
        "session_starts_at": row.session_starts_at if hasattr(row, "session_starts_at") else None,
        "complex_name": str(row.complex_name) if row.complex_name else None,
        "district": str(row.district) if row.district else None,
        "court_name": str(row.court_name) if row.court_name else None,
        "sub_court_name": str(row.sub_court_name) if row.sub_court_name else None,
        "sport": str(row.sport) if row.sport else None,
    }


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


def _session_select_sql(where_clause: str) -> str:
    return f"""
        SELECT
          s.id,
          s.court_id,
          s.title,
          s.post_type::text AS post_type,
          s.status::text AS status,
          s.starts_at,
          s.duration_minutes,
          s.ends_at,
          s.open_slots,
          s.max_slots,
          s.required_skill_min::text AS required_skill_min,
          s.required_skill_max::text AS required_skill_max,
          s.slot_price_vnd,
          s.full_court_price_vnd,
          s.is_peak_hour,
          s.allows_solo_join,
          c.name AS court_name,
          c.sub_court_name,
          c.sport::text AS sport,
          c.amenities,
          c.base_price_vnd,
          cc.id AS complex_id,
          cc.name AS complex_name,
          cc.district,
          cc.address,
          cc.latitude,
          cc.longitude
        FROM public.sessions s
        JOIN public.courts c ON c.id = s.court_id
        JOIN public.court_complexes cc ON cc.id = c.complex_id
        {where_clause}
    """


def list_discovery_sessions(
    *,
    sport: str | None = None,
    district: str | None = None,
    starts_from: datetime | None = None,
    starts_to: datetime | None = None,
    has_open_slots: bool | None = None,
    post_type: str | None = None,
) -> list[dict[str, Any]]:
    now = datetime.now(UTC)
    params: dict[str, Any] = {
        "status_scheduled": "scheduled",
        "status_locked": "locked",
        "starts_from": starts_from or now,
    }
    where_parts = [
        (
            "s.status IN ("
            "CAST(:status_scheduled AS public.session_status), "
            "CAST(:status_locked AS public.session_status)"
            ")"
        ),
        "s.starts_at >= :starts_from",
        "c.status = 'active'",
    ]
    if sport:
        where_parts.append("c.sport = CAST(:sport AS public.sport_type)")
        params["sport"] = sport
    if district:
        where_parts.append("cc.district ILIKE :district")
        params["district"] = f"%{district}%"
    if starts_to:
        where_parts.append("s.starts_at <= :starts_to")
        params["starts_to"] = starts_to
    if has_open_slots is True:
        where_parts.append("s.open_slots > 0")
    if has_open_slots is False:
        where_parts.append("s.open_slots = 0")
    if post_type:
        where_parts.append("s.post_type = CAST(:post_type AS public.session_post_type)")
        params["post_type"] = post_type

    where_clause = f"WHERE {' AND '.join(where_parts)} ORDER BY s.starts_at ASC LIMIT 200"
    query = _session_select_sql(where_clause)
    with get_engine().begin() as connection:
        rows = connection.execute(text(query), params).all()
    return [_session_from_row(row) for row in rows]


def get_session_detail(*, session_id: str) -> dict[str, Any]:
    query = _session_select_sql(
        """
        WHERE s.id = :session_id
        LIMIT 1
        """
    )
    with get_engine().begin() as connection:
        row = connection.execute(text(query), {"session_id": session_id}).first()
    if row is None:
        raise AppError(
            status_code=404,
            code="session_not_found",
            message="Không tìm thấy phiên sân",
        )
    return _session_from_row(row)


def _load_admin_config(connection: Any) -> dict[str, Any]:
    row = connection.execute(
        text(
            """
            SELECT platform_fee_rate, floor_fee_vnd, deposit_percent, auto_release_minutes
            FROM public.admin_configs
            WHERE id = 1
            LIMIT 1
            """
        )
    ).first()
    if row is None:
        raise AppError(
            status_code=503,
            code="admin_config_missing",
            message="Cấu hình hệ thống chưa sẵn sàng",
        )
    return {
        "platform_fee_rate": Decimal(row.platform_fee_rate),
        "floor_fee_vnd": int(row.floor_fee_vnd),
        "deposit_percent": Decimal(row.deposit_percent),
        "auto_release_minutes": int(row.auto_release_minutes),
    }


def _booking_detail_query() -> str:
    return """
        SELECT
          b.id,
          b.booking_code,
          b.session_id,
          b.court_id,
          b.player_user_id,
          b.mode::text AS mode,
          b.seats_booked,
          b.status::text AS status,
          b.payment_method::text AS payment_method,
          b.base_price_vnd,
          b.floor_fee_vnd,
          b.platform_fee_vnd,
          b.total_price_vnd,
          b.deposit_required_vnd,
          b.remaining_due_vnd,
          b.qr_payload,
          b.checked_in_at,
          b.completed_at,
          b.cancelled_at,
          b.cancel_reason,
          b.created_at,
          b.updated_at,
          s.title AS session_title,
          s.starts_at AS session_starts_at,
          cc.name AS complex_name,
          cc.district,
          c.name AS court_name,
          c.sub_court_name,
          c.sport::text AS sport
        FROM public.bookings b
        JOIN public.sessions s ON s.id = b.session_id
        JOIN public.courts c ON c.id = b.court_id
        JOIN public.court_complexes cc ON cc.id = c.complex_id
    """


def list_my_bookings(*, player_user_id: str) -> list[dict[str, Any]]:
    query = f"""
        {_booking_detail_query()}
        WHERE b.player_user_id = :player_user_id
        ORDER BY b.created_at DESC
        LIMIT 200
    """
    with get_engine().begin() as connection:
        rows = connection.execute(text(query), {"player_user_id": player_user_id}).all()
    return [_booking_from_row(row) for row in rows]


def get_my_booking(*, player_user_id: str, booking_id: str) -> dict[str, Any]:
    query = f"""
        {_booking_detail_query()}
        WHERE b.id = :booking_id AND b.player_user_id = :player_user_id
        LIMIT 1
    """
    with get_engine().begin() as connection:
        row = connection.execute(
            text(query), {"booking_id": booking_id, "player_user_id": player_user_id}
        ).first()
    if row is None:
        raise AppError(
            status_code=404,
            code="booking_not_found",
            message="Không tìm thấy booking của tài khoản này",
        )
    return _booking_from_row(row)


def create_booking(*, player_user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    mode = str(data["mode"])
    payment_method = str(data["payment_method"])
    if mode not in {"solo", "full_court"}:
        raise AppError(
            status_code=422,
            code="booking_mode_invalid",
            message="Mode booking không hợp lệ",
        )
    if payment_method not in {"vnpay", "cash"}:
        raise AppError(
            status_code=422,
            code="booking_payment_method_invalid",
            message="Phương thức thanh toán không hợp lệ",
        )

    with get_engine().begin() as connection:
        session = connection.execute(
            text(
                """
                SELECT
                  s.id,
                  s.court_id,
                  s.title,
                  s.status::text AS status,
                  s.starts_at,
                  s.open_slots,
                  s.max_slots,
                  s.slot_price_vnd,
                  s.full_court_price_vnd,
                  s.allows_solo_join
                FROM public.sessions s
                WHERE s.id = :session_id
                FOR UPDATE
                """
            ),
            {"session_id": data["session_id"]},
        ).first()
        if session is None:
            raise AppError(
                status_code=404,
                code="session_not_found",
                message="Không tìm thấy phiên sân",
            )
        if str(session.status) not in SESSION_DISCOVERY_STATUSES:
            raise AppError(
                status_code=409,
                code="session_not_bookable",
                message="Phiên sân không còn nhận booking",
            )
        if session.starts_at <= datetime.now(UTC):
            raise AppError(
                status_code=409,
                code="session_already_started",
                message="Phiên sân đã bắt đầu hoặc đã qua giờ nhận booking",
            )

        active_booking = connection.execute(
            text(
                """
                SELECT id
                FROM public.bookings
                WHERE session_id = :session_id
                  AND player_user_id = :player_user_id
                  AND status NOT IN ('cancelled', 'expired')
                LIMIT 1
                """
            ),
            {"session_id": data["session_id"], "player_user_id": player_user_id},
        ).first()
        if active_booking is not None:
            raise AppError(
                status_code=409,
                code="booking_already_exists",
                message="Tài khoản đã có booking còn hiệu lực cho phiên này",
            )

        if mode == "full_court":
            seats_booked = int(session.max_slots)
        else:
            if not bool(session.allows_solo_join):
                raise AppError(
                    status_code=409,
                    code="session_solo_not_allowed",
                    message="Phiên sân hiện không cho phép đặt slot solo",
                )
            seats_booked = int(data.get("seats_booked") or 1)
            if seats_booked < 1 or seats_booked > 2:
                raise AppError(
                    status_code=422,
                    code="booking_seats_invalid",
                    message="Booking solo chỉ hỗ trợ 1 hoặc 2 slot",
                )

        open_slots = int(session.open_slots)
        if open_slots < seats_booked:
            raise AppError(
                status_code=409,
                code="session_slots_unavailable",
                message="Số slot còn trống không đủ cho booking",
            )

        config = _load_admin_config(connection)
        if mode == "full_court":
            base_price_vnd = int(session.full_court_price_vnd)
        else:
            base_price_vnd = int(session.slot_price_vnd) * seats_booked
        platform_fee_vnd = _round_money(
            Decimal(base_price_vnd) * Decimal(config["platform_fee_rate"])
        )
        floor_fee_vnd = int(config["floor_fee_vnd"])
        total_price_vnd = base_price_vnd + platform_fee_vnd + floor_fee_vnd
        deposit_required_vnd = _round_money(
            Decimal(total_price_vnd) * Decimal(config["deposit_percent"]) / Decimal(100)
        )
        deposit_required_vnd = max(deposit_required_vnd, 1)
        remaining_due_vnd = total_price_vnd - deposit_required_vnd

        booking_code = f"BK{token_hex(4).upper()}"
        qr_payload = f"NETUP:{booking_code}"
        booking = connection.execute(
            text(
                """
                INSERT INTO public.bookings (
                  booking_code,
                  session_id,
                  court_id,
                  player_user_id,
                  mode,
                  seats_booked,
                  status,
                  payment_method,
                  base_price_vnd,
                  floor_fee_vnd,
                  platform_fee_vnd,
                  total_price_vnd,
                  deposit_required_vnd,
                  remaining_due_vnd,
                  qr_payload
                )
                VALUES (
                  :booking_code,
                  :session_id,
                  :court_id,
                  :player_user_id,
                  CAST(:mode AS public.booking_mode),
                  :seats_booked,
                  CAST('awaiting_deposit' AS public.booking_status),
                  CAST(:payment_method AS public.payment_method),
                  :base_price_vnd,
                  :floor_fee_vnd,
                  :platform_fee_vnd,
                  :total_price_vnd,
                  :deposit_required_vnd,
                  :remaining_due_vnd,
                  :qr_payload
                )
                RETURNING id
                """
            ),
            {
                "booking_code": booking_code,
                "session_id": str(session.id),
                "court_id": str(session.court_id),
                "player_user_id": player_user_id,
                "mode": mode,
                "seats_booked": seats_booked,
                "payment_method": payment_method,
                "base_price_vnd": base_price_vnd,
                "floor_fee_vnd": floor_fee_vnd,
                "platform_fee_vnd": platform_fee_vnd,
                "total_price_vnd": total_price_vnd,
                "deposit_required_vnd": deposit_required_vnd,
                "remaining_due_vnd": remaining_due_vnd,
                "qr_payload": qr_payload,
            },
        ).first()
        if booking is None:
            raise AppError(
                status_code=500,
                code="booking_create_failed",
                message="Không tạo được booking",
            )

        connection.execute(
            text(
                """
                UPDATE public.sessions
                SET open_slots = :next_open_slots,
                    status = CASE
                      WHEN :next_open_slots = 0 THEN CAST('locked' AS public.session_status)
                      ELSE status
                    END
                WHERE id = :session_id
                """
            ),
            {
                "next_open_slots": open_slots - seats_booked,
                "session_id": str(session.id),
            },
        )

        expires_at = datetime.now(UTC) + timedelta(minutes=int(config["auto_release_minutes"]))
        connection.execute(
            text(
                """
                INSERT INTO public.payment_transactions (
                  booking_id,
                  kind,
                  method,
                  provider,
                  external_ref,
                  amount_vnd,
                  status,
                  metadata,
                  expires_at
                )
                VALUES (
                  :booking_id,
                  CAST('deposit' AS public.payment_transaction_kind),
                  CAST('vnpay' AS public.payment_method),
                  'vnpay',
                  :external_ref,
                  :amount_vnd,
                  CAST('pending' AS public.payment_status),
                  :metadata,
                  :expires_at
                )
                """
            ),
            {
                "booking_id": str(booking.id),
                "external_ref": f"DEP-{booking_code}",
                "amount_vnd": deposit_required_vnd,
                "metadata": Jsonb({"source": "booking_create"}),
                "expires_at": expires_at,
            },
        )

        if remaining_due_vnd > 0:
            remaining_provider = "vnpay" if payment_method == "vnpay" else None
            connection.execute(
                text(
                    """
                    INSERT INTO public.payment_transactions (
                      booking_id,
                      kind,
                      method,
                      provider,
                      external_ref,
                      amount_vnd,
                      status,
                      metadata
                    )
                    VALUES (
                      :booking_id,
                      CAST('remaining' AS public.payment_transaction_kind),
                      CAST(:method AS public.payment_method),
                      :provider,
                      :external_ref,
                      :amount_vnd,
                      CAST('pending' AS public.payment_status),
                      :metadata
                    )
                    """
                ),
                {
                    "booking_id": str(booking.id),
                    "method": payment_method,
                    "provider": remaining_provider,
                    "external_ref": f"REM-{booking_code}",
                    "amount_vnd": remaining_due_vnd,
                    "metadata": Jsonb(
                        {
                            "source": "booking_create",
                            "collect_at_venue": payment_method == "cash",
                        }
                    ),
                },
            )

        _audit(
            connection,
            actor_user_id=player_user_id,
            event_type="booking_created",
            entity_type="booking",
            entity_id=str(booking.id),
            payload={
                "session_id": str(session.id),
                "mode": mode,
                "seats_booked": seats_booked,
                "payment_method": payment_method,
            },
        )

        detail_row = connection.execute(
            text(
                f"""
                {_booking_detail_query()}
                WHERE b.id = :booking_id
                LIMIT 1
                """
            ),
            {"booking_id": str(booking.id)},
        ).first()

    if detail_row is None:
        raise AppError(
            status_code=500,
            code="booking_created_but_not_readable",
            message="Booking đã tạo nhưng không đọc được dữ liệu trả về",
        )
    return _booking_from_row(detail_row)


def create_booking_safe(*, player_user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    try:
        return create_booking(player_user_id=player_user_id, data=data)
    except IntegrityError as exc:
        raise AppError(
            status_code=409,
            code="booking_conflict",
            message="Booking không hợp lệ do dữ liệu xung đột hoặc đã được người khác giữ chỗ",
        ) from exc
