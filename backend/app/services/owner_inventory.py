from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from psycopg.types.json import Jsonb
from sqlalchemy import text

from app.core.errors import AppError
from app.db.session import get_engine

ALLOWED_DURATIONS = {30, 60, 90, 120, 150, 180, 210, 240, 270, 300}
ACTIVE_SESSION_STATUSES = {"scheduled", "locked", "in_progress"}
SKILL_RANKS = {"Beginner": 1, "Intermediate": 2, "Advanced": 3}


def _complex_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "owner_user_id": str(row.owner_user_id),
        "name": str(row.name),
        "district": str(row.district),
        "address": str(row.address),
        "latitude": float(row.latitude) if row.latitude is not None else None,
        "longitude": float(row.longitude) if row.longitude is not None else None,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _court_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "complex_id": str(row.complex_id),
        "owner_user_id": str(row.owner_user_id),
        "name": str(row.name),
        "sub_court_name": str(row.sub_court_name),
        "sport": str(row.sport),
        "status": str(row.status),
        "rating": float(row.rating),
        "amenities": list(row.amenities or []),
        "base_price_vnd": int(row.base_price_vnd),
        "max_rental_duration_minutes": int(row.max_rental_duration_minutes),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "complex_name": (
            str(row.complex_name)
            if hasattr(row, "complex_name") and row.complex_name is not None
            else None
        ),
        "district": (
            str(row.district) if hasattr(row, "district") and row.district is not None else None
        ),
    }


def _session_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "court_id": str(row.court_id),
        "created_by_user_id": (
            str(row.created_by_user_id) if row.created_by_user_id is not None else None
        ),
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
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "court_name": (
            str(row.court_name)
            if hasattr(row, "court_name") and row.court_name is not None
            else None
        ),
        "complex_name": (
            str(row.complex_name)
            if hasattr(row, "complex_name") and row.complex_name is not None
            else None
        ),
    }


def _json_safe(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    return value


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
            "payload": Jsonb(_json_safe(payload or {})),
        },
    )


def _require_complex(connection: Any, *, owner_user_id: str, complex_id: str) -> Any:
    row = connection.execute(
        text(
            """
            SELECT
              id,
              owner_user_id,
              name,
              district,
              address,
              latitude,
              longitude,
              created_at,
              updated_at
            FROM public.court_complexes
            WHERE id = :complex_id AND owner_user_id = :owner_user_id
            """
        ),
        {"complex_id": complex_id, "owner_user_id": owner_user_id},
    ).first()
    if row is None:
        raise AppError(
            status_code=404,
            code="court_complex_not_found",
            message="Không tìm thấy cụm sân thuộc tài khoản này",
        )
    return row


def _require_court(connection: Any, *, owner_user_id: str, court_id: str) -> Any:
    row = connection.execute(
        text(
            """
            SELECT
              c.id,
              c.complex_id,
              c.owner_user_id,
              c.name,
              c.sub_court_name,
              c.sport::text AS sport,
              c.status::text AS status,
              c.rating,
              c.amenities,
              c.base_price_vnd,
              c.max_rental_duration_minutes,
              c.created_at,
              c.updated_at,
              cc.name AS complex_name,
              cc.district AS district
            FROM public.courts c
            JOIN public.court_complexes cc ON cc.id = c.complex_id
            WHERE c.id = :court_id AND c.owner_user_id = :owner_user_id
            """
        ),
        {"court_id": court_id, "owner_user_id": owner_user_id},
    ).first()
    if row is None:
        raise AppError(
            status_code=404,
            code="court_not_found",
            message="Không tìm thấy sân thuộc tài khoản này",
        )
    return row


def _require_session(connection: Any, *, owner_user_id: str, session_id: str) -> Any:
    row = connection.execute(
        text(
            """
            SELECT
              s.id,
              s.court_id,
              s.created_by_user_id,
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
              s.created_at,
              s.updated_at,
              c.name AS court_name,
              cc.name AS complex_name
            FROM public.sessions s
            JOIN public.courts c ON c.id = s.court_id
            JOIN public.court_complexes cc ON cc.id = c.complex_id
            WHERE s.id = :session_id AND c.owner_user_id = :owner_user_id
            """
        ),
        {"session_id": session_id, "owner_user_id": owner_user_id},
    ).first()
    if row is None:
        raise AppError(
            status_code=404,
            code="session_not_found",
            message="Không tìm thấy phiên sân thuộc tài khoản này",
        )
    return row


def _validate_duration(duration_minutes: int) -> None:
    if duration_minutes not in ALLOWED_DURATIONS:
        raise AppError(
            status_code=422,
            code="session_duration_invalid",
            message="Thời lượng phiên phải nằm trong các mốc 30-300 phút",
        )


def _validate_starts_at(starts_at: datetime) -> None:
    if starts_at.tzinfo is None or starts_at.tzinfo.utcoffset(starts_at) is None:
        raise AppError(
            status_code=422,
            code="session_start_timezone_required",
            message="Thời gian bắt đầu phiên phải có timezone",
        )


def _validate_skill_range(required_skill_min: str, required_skill_max: str) -> None:
    if SKILL_RANKS[required_skill_min] > SKILL_RANKS[required_skill_max]:
        raise AppError(
            status_code=422,
            code="session_skill_range_invalid",
            message="Bậc kỹ năng tối thiểu không được cao hơn bậc tối đa",
        )


def _validate_session_capacity(open_slots: int, max_slots: int) -> None:
    if open_slots > max_slots:
        raise AppError(
            status_code=422,
            code="session_slots_invalid",
            message="Số slot còn trống không được lớn hơn tổng số slot",
        )


def _validate_session_rules(
    connection: Any,
    *,
    owner_user_id: str,
    court_id: str,
    starts_at: datetime,
    duration_minutes: int,
    open_slots: int,
    max_slots: int,
    required_skill_min: str,
    required_skill_max: str,
    status: str,
    session_id: str | None = None,
) -> None:
    _validate_duration(duration_minutes)
    _validate_starts_at(starts_at)
    _validate_session_capacity(open_slots, max_slots)
    _validate_skill_range(required_skill_min, required_skill_max)

    court = _require_court(connection, owner_user_id=owner_user_id, court_id=court_id)
    if duration_minutes > int(court.max_rental_duration_minutes):
        raise AppError(
            status_code=422,
            code="session_duration_exceeds_court_limit",
            message="Thời lượng phiên vượt quá giới hạn thuê của sân",
        )

    if status not in ACTIVE_SESSION_STATUSES:
        return

    ends_at = starts_at + timedelta(minutes=duration_minutes)
    params = {"court_id": court_id, "starts_at": starts_at, "ends_at": ends_at}
    exclude_clause = ""
    if session_id:
        exclude_clause = "AND id <> :session_id"
        params["session_id"] = session_id

    overlap = connection.execute(
        text(
            f"""
            SELECT 1
            FROM public.sessions
            WHERE court_id = :court_id
              AND status IN ('scheduled', 'locked', 'in_progress')
              {exclude_clause}
              AND tstzrange(starts_at, ends_at, '[)') &&
                  tstzrange(:starts_at, :ends_at, '[)')
            LIMIT 1
            """
        ),
        params,
    ).first()
    if overlap is not None:
        raise AppError(
            status_code=409,
            code="session_time_overlap",
            message="Phiên sân bị trùng thời gian với phiên đang hoạt động",
        )


def list_court_complexes(*, owner_user_id: str) -> list[dict[str, Any]]:
    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                """
                SELECT
                  id,
                  owner_user_id,
                  name,
                  district,
                  address,
                  latitude,
                  longitude,
                  created_at,
                  updated_at
                FROM public.court_complexes
                WHERE owner_user_id = :owner_user_id
                ORDER BY created_at DESC
                """
            ),
            {"owner_user_id": owner_user_id},
        ).all()
    return [_complex_from_row(row) for row in rows]


def create_court_complex(*, owner_user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    with get_engine().begin() as connection:
        row = connection.execute(
            text(
                """
                INSERT INTO public.court_complexes (
                  owner_user_id,
                  name,
                  district,
                  address,
                  latitude,
                  longitude
                )
                VALUES (
                  :owner_user_id,
                  :name,
                  :district,
                  :address,
                  :latitude,
                  :longitude
                )
                RETURNING
                  id,
                  owner_user_id,
                  name,
                  district,
                  address,
                  latitude,
                  longitude,
                  created_at,
                  updated_at
                """
            ),
            {"owner_user_id": owner_user_id, **data},
        ).one()
        _audit(
            connection,
            actor_user_id=owner_user_id,
            event_type="court_complex_created",
            entity_type="court_complex",
            entity_id=str(row.id),
            payload={"name": data["name"]},
        )
    return _complex_from_row(row)


def update_court_complex(
    *, owner_user_id: str, complex_id: str, data: dict[str, Any]
) -> dict[str, Any]:
    if not data:
        with get_engine().begin() as connection:
            return _complex_from_row(
                _require_complex(connection, owner_user_id=owner_user_id, complex_id=complex_id)
            )

    allowed_columns = {
        "name": "name = :name",
        "district": "district = :district",
        "address": "address = :address",
        "latitude": "latitude = :latitude",
        "longitude": "longitude = :longitude",
    }
    assignments = [allowed_columns[key] for key in data]
    with get_engine().begin() as connection:
        _require_complex(connection, owner_user_id=owner_user_id, complex_id=complex_id)
        row = connection.execute(
            text(
                f"""
                UPDATE public.court_complexes
                SET {", ".join(assignments)}
                WHERE id = :complex_id AND owner_user_id = :owner_user_id
                RETURNING
                  id,
                  owner_user_id,
                  name,
                  district,
                  address,
                  latitude,
                  longitude,
                  created_at,
                  updated_at
                """
            ),
            {"complex_id": complex_id, "owner_user_id": owner_user_id, **data},
        ).one()
        _audit(
            connection,
            actor_user_id=owner_user_id,
            event_type="court_complex_updated",
            entity_type="court_complex",
            entity_id=complex_id,
            payload=data,
        )
    return _complex_from_row(row)


def delete_court_complex(*, owner_user_id: str, complex_id: str) -> None:
    with get_engine().begin() as connection:
        _require_complex(connection, owner_user_id=owner_user_id, complex_id=complex_id)
        connection.execute(
            text(
                """
                DELETE FROM public.court_complexes
                WHERE id = :complex_id AND owner_user_id = :owner_user_id
                """
            ),
            {"complex_id": complex_id, "owner_user_id": owner_user_id},
        )
        _audit(
            connection,
            actor_user_id=owner_user_id,
            event_type="court_complex_deleted",
            entity_type="court_complex",
            entity_id=complex_id,
        )


def list_courts(*, owner_user_id: str, complex_id: str | None = None) -> list[dict[str, Any]]:
    params = {"owner_user_id": owner_user_id}
    where = "WHERE c.owner_user_id = :owner_user_id"
    if complex_id:
        where += " AND c.complex_id = :complex_id"
        params["complex_id"] = complex_id

    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                f"""
                SELECT
                  c.id,
                  c.complex_id,
                  c.owner_user_id,
                  c.name,
                  c.sub_court_name,
                  c.sport::text AS sport,
                  c.status::text AS status,
                  c.rating,
                  c.amenities,
                  c.base_price_vnd,
                  c.max_rental_duration_minutes,
                  c.created_at,
                  c.updated_at,
                  cc.name AS complex_name,
                  cc.district AS district
                FROM public.courts c
                JOIN public.court_complexes cc ON cc.id = c.complex_id
                {where}
                ORDER BY c.created_at DESC
                """
            ),
            params,
        ).all()
    return [_court_from_row(row) for row in rows]


def create_court(*, owner_user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    _validate_duration(int(data["max_rental_duration_minutes"]))
    with get_engine().begin() as connection:
        _require_complex(connection, owner_user_id=owner_user_id, complex_id=data["complex_id"])
        row = connection.execute(
            text(
                """
                INSERT INTO public.courts (
                  complex_id,
                  owner_user_id,
                  name,
                  sub_court_name,
                  sport,
                  status,
                  amenities,
                  base_price_vnd,
                  max_rental_duration_minutes
                )
                VALUES (
                  :complex_id,
                  :owner_user_id,
                  :name,
                  :sub_court_name,
                  CAST(:sport AS public.sport_type),
                  CAST(:status AS public.court_status),
                  CAST(:amenities AS text[]),
                  :base_price_vnd,
                  :max_rental_duration_minutes
                )
                RETURNING
                  id,
                  complex_id,
                  owner_user_id,
                  name,
                  sub_court_name,
                  sport::text AS sport,
                  status::text AS status,
                  rating,
                  amenities,
                  base_price_vnd,
                  max_rental_duration_minutes,
                  created_at,
                  updated_at,
                  NULL::text AS complex_name,
                  NULL::text AS district
                """
            ),
            {"owner_user_id": owner_user_id, **data},
        ).one()
        _audit(
            connection,
            actor_user_id=owner_user_id,
            event_type="court_created",
            entity_type="court",
            entity_id=str(row.id),
            payload={"name": data["name"], "sport": data["sport"]},
        )
    return _court_from_row(row)


def update_court(*, owner_user_id: str, court_id: str, data: dict[str, Any]) -> dict[str, Any]:
    if not data:
        with get_engine().begin() as connection:
            return _court_from_row(
                _require_court(connection, owner_user_id=owner_user_id, court_id=court_id)
            )
    if "max_rental_duration_minutes" in data:
        _validate_duration(int(data["max_rental_duration_minutes"]))

    if "complex_id" in data:
        with get_engine().begin() as connection:
            _require_complex(connection, owner_user_id=owner_user_id, complex_id=data["complex_id"])

    allowed_columns = {
        "complex_id": "complex_id = :complex_id",
        "name": "name = :name",
        "sub_court_name": "sub_court_name = :sub_court_name",
        "sport": "sport = CAST(:sport AS public.sport_type)",
        "status": "status = CAST(:status AS public.court_status)",
        "amenities": "amenities = CAST(:amenities AS text[])",
        "base_price_vnd": "base_price_vnd = :base_price_vnd",
        "max_rental_duration_minutes": (
            "max_rental_duration_minutes = :max_rental_duration_minutes"
        ),
    }
    assignments = [allowed_columns[key] for key in data]
    with get_engine().begin() as connection:
        _require_court(connection, owner_user_id=owner_user_id, court_id=court_id)
        row = connection.execute(
            text(
                f"""
                UPDATE public.courts
                SET {", ".join(assignments)}
                WHERE id = :court_id AND owner_user_id = :owner_user_id
                RETURNING
                  id,
                  complex_id,
                  owner_user_id,
                  name,
                  sub_court_name,
                  sport::text AS sport,
                  status::text AS status,
                  rating,
                  amenities,
                  base_price_vnd,
                  max_rental_duration_minutes,
                  created_at,
                  updated_at,
                  NULL::text AS complex_name,
                  NULL::text AS district
                """
            ),
            {"court_id": court_id, "owner_user_id": owner_user_id, **data},
        ).one()
        _audit(
            connection,
            actor_user_id=owner_user_id,
            event_type="court_updated",
            entity_type="court",
            entity_id=court_id,
            payload=data,
        )
    return _court_from_row(row)


def delete_court(*, owner_user_id: str, court_id: str) -> None:
    with get_engine().begin() as connection:
        _require_court(connection, owner_user_id=owner_user_id, court_id=court_id)
        connection.execute(
            text(
                """
                DELETE FROM public.courts
                WHERE id = :court_id AND owner_user_id = :owner_user_id
                """
            ),
            {"court_id": court_id, "owner_user_id": owner_user_id},
        )
        _audit(
            connection,
            actor_user_id=owner_user_id,
            event_type="court_deleted",
            entity_type="court",
            entity_id=court_id,
        )


def list_sessions(
    *, owner_user_id: str, court_id: str | None = None
) -> list[dict[str, Any]]:
    params = {"owner_user_id": owner_user_id}
    where = "WHERE c.owner_user_id = :owner_user_id"
    if court_id:
        where += " AND s.court_id = :court_id"
        params["court_id"] = court_id

    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                f"""
                SELECT
                  s.id,
                  s.court_id,
                  s.created_by_user_id,
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
                  s.created_at,
                  s.updated_at,
                  c.name AS court_name,
                  cc.name AS complex_name
                FROM public.sessions s
                JOIN public.courts c ON c.id = s.court_id
                JOIN public.court_complexes cc ON cc.id = c.complex_id
                {where}
                ORDER BY s.starts_at DESC
                """
            ),
            params,
        ).all()
    return [_session_from_row(row) for row in rows]


def create_session(*, owner_user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    session_status = data.get("status", "scheduled")
    _validate_duration(int(data["duration_minutes"]))
    with get_engine().begin() as connection:
        _validate_session_rules(
            connection,
            owner_user_id=owner_user_id,
            court_id=data["court_id"],
            starts_at=data["starts_at"],
            duration_minutes=int(data["duration_minutes"]),
            open_slots=int(data["open_slots"]),
            max_slots=int(data["max_slots"]),
            required_skill_min=data["required_skill_min"],
            required_skill_max=data["required_skill_max"],
            status=session_status,
        )
        row = connection.execute(
            text(
                """
                INSERT INTO public.sessions (
                  court_id,
                  created_by_user_id,
                  title,
                  post_type,
                  status,
                  starts_at,
                  duration_minutes,
                  open_slots,
                  max_slots,
                  required_skill_min,
                  required_skill_max,
                  slot_price_vnd,
                  full_court_price_vnd,
                  is_peak_hour,
                  allows_solo_join
                )
                VALUES (
                  :court_id,
                  :owner_user_id,
                  :title,
                  CAST(:post_type AS public.session_post_type),
                  CAST(:status AS public.session_status),
                  :starts_at,
                  :duration_minutes,
                  :open_slots,
                  :max_slots,
                  CAST(:required_skill_min AS public.skill_tier),
                  CAST(:required_skill_max AS public.skill_tier),
                  :slot_price_vnd,
                  :full_court_price_vnd,
                  :is_peak_hour,
                  :allows_solo_join
                )
                RETURNING
                  id,
                  court_id,
                  created_by_user_id,
                  title,
                  post_type::text AS post_type,
                  status::text AS status,
                  starts_at,
                  duration_minutes,
                  ends_at,
                  open_slots,
                  max_slots,
                  required_skill_min::text AS required_skill_min,
                  required_skill_max::text AS required_skill_max,
                  slot_price_vnd,
                  full_court_price_vnd,
                  is_peak_hour,
                  allows_solo_join,
                  created_at,
                  updated_at,
                  NULL::text AS court_name,
                  NULL::text AS complex_name
                """
            ),
            {"owner_user_id": owner_user_id, **data, "status": session_status},
        ).one()
        _audit(
            connection,
            actor_user_id=owner_user_id,
            event_type="session_created",
            entity_type="session",
            entity_id=str(row.id),
            payload={"court_id": data["court_id"], "starts_at": data["starts_at"].isoformat()},
        )
    return _session_from_row(row)


def update_session(
    *, owner_user_id: str, session_id: str, data: dict[str, Any]
) -> dict[str, Any]:
    if not data:
        with get_engine().begin() as connection:
            return _session_from_row(
                _require_session(connection, owner_user_id=owner_user_id, session_id=session_id)
            )

    allowed_columns = {
        "court_id": "court_id = :court_id",
        "title": "title = :title",
        "post_type": "post_type = CAST(:post_type AS public.session_post_type)",
        "status": "status = CAST(:status AS public.session_status)",
        "starts_at": "starts_at = :starts_at",
        "duration_minutes": "duration_minutes = :duration_minutes",
        "open_slots": "open_slots = :open_slots",
        "max_slots": "max_slots = :max_slots",
        "required_skill_min": "required_skill_min = CAST(:required_skill_min AS public.skill_tier)",
        "required_skill_max": "required_skill_max = CAST(:required_skill_max AS public.skill_tier)",
        "slot_price_vnd": "slot_price_vnd = :slot_price_vnd",
        "full_court_price_vnd": "full_court_price_vnd = :full_court_price_vnd",
        "is_peak_hour": "is_peak_hour = :is_peak_hour",
        "allows_solo_join": "allows_solo_join = :allows_solo_join",
    }
    assignments = [allowed_columns[key] for key in data]
    with get_engine().begin() as connection:
        current = _require_session(
            connection, owner_user_id=owner_user_id, session_id=session_id
        )
        next_data = {
            "court_id": str(current.court_id),
            "title": str(current.title),
            "post_type": str(current.post_type),
            "status": str(current.status),
            "starts_at": current.starts_at,
            "duration_minutes": int(current.duration_minutes),
            "open_slots": int(current.open_slots),
            "max_slots": int(current.max_slots),
            "required_skill_min": str(current.required_skill_min),
            "required_skill_max": str(current.required_skill_max),
            "slot_price_vnd": int(current.slot_price_vnd),
            "full_court_price_vnd": int(current.full_court_price_vnd),
            "is_peak_hour": bool(current.is_peak_hour),
            "allows_solo_join": bool(current.allows_solo_join),
        }
        next_data.update(data)
        _validate_session_rules(
            connection,
            owner_user_id=owner_user_id,
            court_id=next_data["court_id"],
            starts_at=next_data["starts_at"],
            duration_minutes=int(next_data["duration_minutes"]),
            open_slots=int(next_data["open_slots"]),
            max_slots=int(next_data["max_slots"]),
            required_skill_min=next_data["required_skill_min"],
            required_skill_max=next_data["required_skill_max"],
            status=next_data["status"],
            session_id=session_id,
        )
        row = connection.execute(
            text(
                f"""
                UPDATE public.sessions
                SET {", ".join(assignments)}
                WHERE id = :session_id
                RETURNING
                  id,
                  court_id,
                  created_by_user_id,
                  title,
                  post_type::text AS post_type,
                  status::text AS status,
                  starts_at,
                  duration_minutes,
                  ends_at,
                  open_slots,
                  max_slots,
                  required_skill_min::text AS required_skill_min,
                  required_skill_max::text AS required_skill_max,
                  slot_price_vnd,
                  full_court_price_vnd,
                  is_peak_hour,
                  allows_solo_join,
                  created_at,
                  updated_at,
                  NULL::text AS court_name,
                  NULL::text AS complex_name
                """
            ),
            {"session_id": session_id, **data},
        ).one()
        _audit(
            connection,
            actor_user_id=owner_user_id,
            event_type="session_updated",
            entity_type="session",
            entity_id=session_id,
            payload=data,
        )
    return _session_from_row(row)


def delete_session(*, owner_user_id: str, session_id: str) -> None:
    with get_engine().begin() as connection:
        _require_session(connection, owner_user_id=owner_user_id, session_id=session_id)
        connection.execute(
            text("DELETE FROM public.sessions WHERE id = :session_id"),
            {"session_id": session_id},
        )
        _audit(
            connection,
            actor_user_id=owner_user_id,
            event_type="session_deleted",
            entity_type="session",
            entity_id=session_id,
        )
