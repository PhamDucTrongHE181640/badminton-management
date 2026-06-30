from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from psycopg.types.json import Jsonb
from sqlalchemy import text

from app.core.errors import AppError
from app.db.session import get_engine

ALLOWED_DURATIONS = {30, 60, 90, 120, 150, 180, 210, 240, 270, 300}
ACTIVE_SESSION_STATUSES = {"scheduled", "locked", "in_progress"}
SKILL_RANKS = {"Beginner": 1, "Intermediate": 2, "Advanced": 3}
DEFAULT_RENTAL_POST_LIMIT = 10
DEFAULT_SLOT_POST_LIMIT = 10


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
        "image_url": str(row.image_url) if row.image_url else None,
        "amenities": list(row.amenities or []),
        "base_price_vnd": int(row.base_price_vnd),
        "max_rental_duration_minutes": int(row.max_rental_duration_minutes),
        "min_rental_duration_minutes": int(getattr(row, "min_rental_duration_minutes", 60)),
        "open_time": row.open_time,
        "close_time": row.close_time,
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
        "description": str(row.description) if row.description else None,
        "post_type": str(row.post_type),
        "status": str(row.status),
        "image_url": str(row.image_url) if row.image_url else None,
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


def _quota_response_from_values(
    *,
    owner_user_id: str,
    rental_post_limit: int,
    slot_post_limit: int,
    rental_posts_used: int,
    slot_posts_used: int,
    owner_full_name: str | None = None,
    owner_email: str | None = None,
    updated_at: Any | None = None,
) -> dict[str, Any]:
    return {
        "owner_user_id": owner_user_id,
        "owner_full_name": owner_full_name,
        "owner_email": owner_email,
        "rental_post_limit": rental_post_limit,
        "slot_post_limit": slot_post_limit,
        "rental_posts_used": rental_posts_used,
        "slot_posts_used": slot_posts_used,
        "rental_posts_remaining": max(0, rental_post_limit - rental_posts_used),
        "slot_posts_remaining": max(0, slot_post_limit - slot_posts_used),
        "updated_at": updated_at,
    }


def _clean_optional_text(value: Any) -> str | None:
    cleaned = str(value or "").strip()
    return cleaned or None


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
              c.image_url,
              c.amenities,
              c.base_price_vnd,
              c.max_rental_duration_minutes,
              c.min_rental_duration_minutes,
              c.open_time,
              c.close_time,
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
              s.description,
              s.post_type::text AS post_type,
              s.status::text AS status,
              s.image_url,
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


def _normalize_session_payload(data: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(data)
    post_type = str(normalized.get("post_type") or "pool")
    if post_type not in {"pool", "rental"}:
        raise AppError(
            status_code=422,
            code="session_post_type_invalid",
            message="Kiểu bài đăng không hợp lệ",
        )
    normalized["post_type"] = post_type
    normalized["description"] = _clean_optional_text(normalized.get("description"))
    normalized["image_url"] = _clean_optional_text(normalized.get("image_url"))

    slot_price = int(normalized.get("slot_price_vnd") or 0)
    full_court_price = int(normalized.get("full_court_price_vnd") or 0)
    max_slots = int(normalized.get("max_slots") or 0)
    open_slots = int(normalized.get("open_slots") or 0)

    if post_type == "rental":
        if full_court_price <= 0:
            raise AppError(
                status_code=422,
                code="session_full_court_price_required",
                message="Bài thuê nguyên sân cần có giá bao sân lớn hơn 0",
            )
        if open_slots != max_slots:
            raise AppError(
                status_code=422,
                code="session_rental_slots_must_match",
                message="Bài thuê nguyên sân cần để slot trống bằng tổng slot để khách bao cả sân",
            )
        normalized["allows_solo_join"] = False
    else:
        if max_slots < 2:
            raise AppError(
                status_code=422,
                code="session_pool_slots_invalid",
                message="Bài slot cần tối thiểu 2 slot",
            )
        if slot_price <= 0:
            raise AppError(
                status_code=422,
                code="session_slot_price_required",
                message="Bài slot cần có giá mỗi slot lớn hơn 0",
            )
        normalized["allows_solo_join"] = True
    return normalized


def _owner_post_counts(
    connection: Any, *, owner_user_id: str, exclude_session_id: str | None = None
) -> dict[str, int]:
    params: dict[str, Any] = {"owner_user_id": owner_user_id}
    exclude_clause = ""
    if exclude_session_id:
        exclude_clause = "AND s.id <> :exclude_session_id"
        params["exclude_session_id"] = exclude_session_id
    row = connection.execute(
        text(
            f"""
            SELECT
              COUNT(*) FILTER (
                WHERE s.post_type = CAST('rental' AS public.session_post_type)
              ) AS rental_posts_used,
              COUNT(*) FILTER (
                WHERE s.post_type = CAST('pool' AS public.session_post_type)
              ) AS slot_posts_used
            FROM public.sessions s
            JOIN public.courts c ON c.id = s.court_id
            WHERE c.owner_user_id = :owner_user_id
              AND s.status IN (
                CAST('scheduled' AS public.session_status),
                CAST('locked' AS public.session_status),
                CAST('in_progress' AS public.session_status)
              )
              AND COALESCE(s.description, '') <> 'Tự động tạo bởi hệ thống'
              AND s.ends_at >= now()
              {exclude_clause}
            """
        ),
        params,
    ).one()
    return {
        "rental_posts_used": int(row.rental_posts_used or 0),
        "slot_posts_used": int(row.slot_posts_used or 0),
    }


def _owner_post_limits(connection: Any, *, owner_user_id: str) -> dict[str, int]:
    row = connection.execute(
        text(
            """
            SELECT rental_post_limit, slot_post_limit
            FROM public.owner_post_quotas
            WHERE owner_user_id = :owner_user_id
            LIMIT 1
            """
        ),
        {"owner_user_id": owner_user_id},
    ).first()
    return {
        "rental_post_limit": (
            int(row.rental_post_limit) if row is not None else DEFAULT_RENTAL_POST_LIMIT
        ),
        "slot_post_limit": (
            int(row.slot_post_limit) if row is not None else DEFAULT_SLOT_POST_LIMIT
        ),
    }


def _assert_owner_quota_available(
    connection: Any,
    *,
    owner_user_id: str,
    post_type: str,
    status: str,
    starts_at: datetime,
    duration_minutes: int,
    exclude_session_id: str | None = None,
) -> None:
    return


    counts = _owner_post_counts(
        connection, owner_user_id=owner_user_id, exclude_session_id=exclude_session_id
    )
    limits = _owner_post_limits(connection, owner_user_id=owner_user_id)
    if post_type == "rental":
        if counts["rental_posts_used"] + 1 > limits["rental_post_limit"]:
            raise AppError(
                status_code=409,
                code="owner_rental_post_quota_exceeded",
                message=(
                    "Bạn đã hết quota đăng bài thuê nguyên sân. "
                    "Vui lòng liên hệ admin để tăng giới hạn."
                ),
            )
    elif counts["slot_posts_used"] + 1 > limits["slot_post_limit"]:
        raise AppError(
            status_code=409,
            code="owner_slot_post_quota_exceeded",
            message="Bạn đã hết quota đăng bài slot. Vui lòng liên hệ admin để tăng giới hạn.",
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
    if status not in ACTIVE_SESSION_STATUSES:
        return

    _validate_duration(duration_minutes)
    _validate_starts_at(starts_at)
    _validate_session_capacity(open_slots, max_slots)
    _validate_skill_range(required_skill_min, required_skill_max)

    court = _require_court(connection, owner_user_id=owner_user_id, court_id=court_id)
    if duration_minutes > int(court.max_rental_duration_minutes):
        raise AppError(
            status_code=422,
            code="session_duration_exceeds_court_limit",
            message="Thời lượng phiên vượt quá giới hạn thuê tối đa của sân",
        )


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


def get_owner_post_quota(*, owner_user_id: str) -> dict[str, Any]:
    with get_engine().begin() as connection:
        limits = _owner_post_limits(connection, owner_user_id=owner_user_id)
        counts = _owner_post_counts(connection, owner_user_id=owner_user_id)
    return _quota_response_from_values(
        owner_user_id=owner_user_id,
        rental_post_limit=limits["rental_post_limit"],
        slot_post_limit=limits["slot_post_limit"],
        rental_posts_used=counts["rental_posts_used"],
        slot_posts_used=counts["slot_posts_used"],
    )


def list_owner_post_quotas_for_admin() -> list[dict[str, Any]]:
    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                """
                WITH owners AS (
                  SELECT DISTINCT user_id AS owner_user_id
                  FROM public.user_role_assignments
                  WHERE role = 'owner' AND revoked_at IS NULL

                  UNION

                  SELECT owner_user_id
                  FROM public.owner_post_quotas
                ),
                counts AS (
                  SELECT
                    c.owner_user_id,
                    COUNT(*) FILTER (
                      WHERE s.post_type = CAST('rental' AS public.session_post_type)
                    ) AS rental_posts_used,
                    COUNT(*) FILTER (
                      WHERE s.post_type = CAST('pool' AS public.session_post_type)
                    ) AS slot_posts_used
                  FROM public.sessions s
                  JOIN public.courts c ON c.id = s.court_id
                  WHERE s.status IN (
                    CAST('scheduled' AS public.session_status),
                    CAST('locked' AS public.session_status),
                    CAST('in_progress' AS public.session_status)
                  )
                    AND COALESCE(s.description, '') <> 'Tự động tạo bởi hệ thống'
                    AND s.ends_at >= now()
                  GROUP BY c.owner_user_id
                )
                SELECT
                  u.id AS owner_user_id,
                  u.full_name AS owner_full_name,
                  u.email AS owner_email,
                  COALESCE(q.rental_post_limit, :default_rental_limit) AS rental_post_limit,
                  COALESCE(q.slot_post_limit, :default_slot_limit) AS slot_post_limit,
                  COALESCE(counts.rental_posts_used, 0) AS rental_posts_used,
                  COALESCE(counts.slot_posts_used, 0) AS slot_posts_used,
                  q.updated_at
                FROM owners
                JOIN public.users u ON u.id = owners.owner_user_id
                LEFT JOIN public.owner_post_quotas q ON q.owner_user_id = u.id
                LEFT JOIN counts ON counts.owner_user_id = u.id
                ORDER BY u.full_name ASC, u.email ASC
                """
            ),
            {
                "default_rental_limit": DEFAULT_RENTAL_POST_LIMIT,
                "default_slot_limit": DEFAULT_SLOT_POST_LIMIT,
            },
        ).all()
    return [
        _quota_response_from_values(
            owner_user_id=str(row.owner_user_id),
            owner_full_name=str(row.owner_full_name),
            owner_email=str(row.owner_email),
            rental_post_limit=int(row.rental_post_limit),
            slot_post_limit=int(row.slot_post_limit),
            rental_posts_used=int(row.rental_posts_used or 0),
            slot_posts_used=int(row.slot_posts_used or 0),
            updated_at=row.updated_at,
        )
        for row in rows
    ]


def update_owner_post_quota_for_admin(
    *,
    actor_user_id: str,
    owner_user_id: str,
    rental_post_limit: int,
    slot_post_limit: int,
) -> dict[str, Any]:
    if rental_post_limit < 0 or slot_post_limit < 0:
        raise AppError(
            status_code=422,
            code="owner_post_quota_invalid",
            message="Quota bài đăng không được âm",
        )

    with get_engine().begin() as connection:
        owner = connection.execute(
            text(
                """
                SELECT u.id, u.full_name, u.email
                FROM public.users u
                JOIN public.user_role_assignments r ON r.user_id = u.id
                WHERE u.id = :owner_user_id
                  AND r.role = 'owner'
                  AND r.revoked_at IS NULL
                LIMIT 1
                """
            ),
            {"owner_user_id": owner_user_id},
        ).first()
        if owner is None:
            raise AppError(
                status_code=404,
                code="owner_user_not_found",
                message="Không tìm thấy owner đang hoạt động",
            )

        row = connection.execute(
            text(
                """
                INSERT INTO public.owner_post_quotas (
                  owner_user_id,
                  rental_post_limit,
                  slot_post_limit,
                  updated_by_user_id
                )
                VALUES (
                  :owner_user_id,
                  :rental_post_limit,
                  :slot_post_limit,
                  :updated_by_user_id
                )
                ON CONFLICT (owner_user_id) DO UPDATE
                SET rental_post_limit = EXCLUDED.rental_post_limit,
                    slot_post_limit = EXCLUDED.slot_post_limit,
                    updated_by_user_id = EXCLUDED.updated_by_user_id
                RETURNING rental_post_limit, slot_post_limit, updated_at
                """
            ),
            {
                "owner_user_id": owner_user_id,
                "rental_post_limit": rental_post_limit,
                "slot_post_limit": slot_post_limit,
                "updated_by_user_id": actor_user_id,
            },
        ).one()
        counts = _owner_post_counts(connection, owner_user_id=owner_user_id)
        _audit(
            connection,
            actor_user_id=actor_user_id,
            event_type="owner_post_quota_updated",
            entity_type="owner_post_quota",
            entity_id=owner_user_id,
            payload={
                "rental_post_limit": rental_post_limit,
                "slot_post_limit": slot_post_limit,
            },
        )
    return _quota_response_from_values(
        owner_user_id=owner_user_id,
        owner_full_name=str(owner.full_name),
        owner_email=str(owner.email),
        rental_post_limit=int(row.rental_post_limit),
        slot_post_limit=int(row.slot_post_limit),
        rental_posts_used=counts["rental_posts_used"],
        slot_posts_used=counts["slot_posts_used"],
        updated_at=row.updated_at,
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
    assignments = [assignment for key, assignment in allowed_columns.items() if key in data]
    if not assignments:
        with get_engine().begin() as connection:
            return _complex_from_row(
                _require_complex(connection, owner_user_id=owner_user_id, complex_id=complex_id)
            )

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
                  c.image_url,
                  c.amenities,
                  c.base_price_vnd,
                  c.max_rental_duration_minutes,
                  c.min_rental_duration_minutes,
                  c.open_time,
                  c.close_time,
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
    _validate_duration(int(data.get("min_rental_duration_minutes", 60)))
    if int(data.get("min_rental_duration_minutes", 60)) > int(data["max_rental_duration_minutes"]):
        raise AppError(
            status_code=422,
            code="court_rental_duration_range_invalid",
            message="Thời lượng thuê tối thiểu không được lớn hơn tối đa",
        )
    if data.get("open_time") and data.get("close_time") and data["open_time"] >= data["close_time"]:
        raise AppError(
            status_code=422,
            code="court_operating_hours_invalid",
            message="Giờ mở cửa phải nhỏ hơn giờ đóng cửa",
        )
    data = {**data, "image_url": _clean_optional_text(data.get("image_url"))}
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
                  image_url,
                  amenities,
                  base_price_vnd,
                  max_rental_duration_minutes,
                  min_rental_duration_minutes,
                  open_time,
                  close_time
                )
                VALUES (
                  :complex_id,
                  :owner_user_id,
                  :name,
                  :sub_court_name,
                  CAST(:sport AS public.sport_type),
                  CAST(:status AS public.court_status),
                  :image_url,
                  CAST(:amenities AS text[]),
                  :base_price_vnd,
                  :max_rental_duration_minutes,
                  :min_rental_duration_minutes,
                  :open_time,
                  :close_time
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
                  image_url,
                  amenities,
                  base_price_vnd,
                  max_rental_duration_minutes,
                  min_rental_duration_minutes,
                  open_time,
                  close_time,
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
    try:
        from app.services.cron import generate_daily_sessions
        generate_daily_sessions(30)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to generate daily sessions: {e}")
    return _court_from_row(row)


def update_court(*, owner_user_id: str, court_id: str, data: dict[str, Any]) -> dict[str, Any]:
    if not data:
        with get_engine().begin() as connection:
            return _court_from_row(
                _require_court(connection, owner_user_id=owner_user_id, court_id=court_id)
            )
    if "max_rental_duration_minutes" in data:
        _validate_duration(int(data["max_rental_duration_minutes"]))
    if "min_rental_duration_minutes" in data:
        _validate_duration(int(data["min_rental_duration_minutes"]))

    if "complex_id" in data:
        with get_engine().begin() as connection:
            _require_complex(connection, owner_user_id=owner_user_id, complex_id=data["complex_id"])
    if "image_url" in data:
        data["image_url"] = _clean_optional_text(data.get("image_url"))

    allowed_columns = {
        "complex_id": "complex_id = :complex_id",
        "name": "name = :name",
        "sub_court_name": "sub_court_name = :sub_court_name",
        "sport": "sport = CAST(:sport AS public.sport_type)",
        "status": "status = CAST(:status AS public.court_status)",
        "image_url": "image_url = :image_url",
        "amenities": "amenities = CAST(:amenities AS text[])",
        "base_price_vnd": "base_price_vnd = :base_price_vnd",
        "max_rental_duration_minutes": (
            "max_rental_duration_minutes = :max_rental_duration_minutes"
        ),
        "min_rental_duration_minutes": (
            "min_rental_duration_minutes = :min_rental_duration_minutes"
        ),
        "open_time": "open_time = :open_time",
        "close_time": "close_time = :close_time",
    }
    assignments = [allowed_columns[key] for key in data]
    with get_engine().begin() as connection:
        current = _require_court(connection, owner_user_id=owner_user_id, court_id=court_id)
        next_min_duration = int(
            data.get("min_rental_duration_minutes", current.min_rental_duration_minutes)
        )
        next_max_duration = int(
            data.get("max_rental_duration_minutes", current.max_rental_duration_minutes)
        )
        if next_min_duration > next_max_duration:
            raise AppError(
                status_code=422,
                code="court_rental_duration_range_invalid",
                message="Thời lượng thuê tối thiểu không được lớn hơn tối đa",
            )

        next_open_time = data.get("open_time", current.open_time)
        next_close_time = data.get("close_time", current.close_time)
        if next_open_time >= next_close_time:
            raise AppError(
                status_code=422,
                code="court_operating_hours_invalid",
                message="Giờ mở cửa phải nhỏ hơn giờ đóng cửa",
            )
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
                  image_url,
                  amenities,
                  base_price_vnd,
                  max_rental_duration_minutes,
                  min_rental_duration_minutes,
                  open_time,
                  close_time,
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
    *, owner_user_id: str, court_id: str | None = None, target_date: date | None = None
) -> list[dict[str, Any]]:
    params = {"owner_user_id": owner_user_id}
    where = "WHERE c.owner_user_id = :owner_user_id"
    if court_id:
        where += " AND s.court_id = :court_id"
        params["court_id"] = court_id
    if target_date:
        where += " AND DATE(s.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = :target_date"
        params["target_date"] = target_date

    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                f"""
                SELECT
                  s.id,
                  s.court_id,
                  s.created_by_user_id,
                  s.title,
                  s.description,
                  s.post_type::text AS post_type,
                  s.status::text AS status,
                  s.image_url,
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
    data = _normalize_session_payload(data)
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
        _assert_owner_quota_available(
            connection,
            owner_user_id=owner_user_id,
            post_type=data["post_type"],
            status=session_status,
            starts_at=data["starts_at"],
            duration_minutes=int(data["duration_minutes"]),
        )
        row = connection.execute(
            text(
                """
                INSERT INTO public.sessions (
                  court_id,
                  created_by_user_id,
                  title,
                  description,
                  post_type,
                  status,
                  image_url,
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
                  :description,
                  CAST(:post_type AS public.session_post_type),
                  CAST(:status AS public.session_status),
                  :image_url,
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
                  description,
                  post_type::text AS post_type,
                  status::text AS status,
                  image_url,
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
        if str(row.post_type) == "pool":
            connection.execute(
                text(
                    """
                    INSERT INTO public.pool_posts (
                      session_id,
                      host_user_id,
                      status,
                      total_slots,
                      host_slots,
                      description
                    )
                    VALUES (
                      :session_id,
                      :host_user_id,
                      CAST('open' AS public.pool_post_status),
                      :total_slots,
                      :host_slots,
                      :description
                    )
                    ON CONFLICT (session_id) DO NOTHING
                    """
                ),
                {
                    "session_id": str(row.id),
                    "host_user_id": owner_user_id,
                    "total_slots": int(row.max_slots),
                    "host_slots": 1,
                    "description": data.get("description") or f"Pool cho session {row.title}",
                },
            )
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
        "description": "description = :description",
        "post_type": "post_type = CAST(:post_type AS public.session_post_type)",
        "status": "status = CAST(:status AS public.session_status)",
        "image_url": "image_url = :image_url",
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
            "description": str(current.description) if current.description else None,
            "post_type": str(current.post_type),
            "status": str(current.status),
            "image_url": str(current.image_url) if current.image_url else None,
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
        next_data = _normalize_session_payload(next_data)
        if "description" in data:
            data["description"] = next_data["description"]
        if "image_url" in data:
            data["image_url"] = next_data["image_url"]
        if "post_type" in data or "allows_solo_join" in data:
            data["allows_solo_join"] = next_data["allows_solo_join"]
        assignments = [allowed_columns[key] for key in data]
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
        _assert_owner_quota_available(
            connection,
            owner_user_id=owner_user_id,
            post_type=next_data["post_type"],
            status=next_data["status"],
            starts_at=next_data["starts_at"],
            duration_minutes=int(next_data["duration_minutes"]),
            exclude_session_id=session_id,
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
                  description,
                  post_type::text AS post_type,
                  status::text AS status,
                  image_url,
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
        if next_data["post_type"] == "pool":
            connection.execute(
                text(
                    """
                    INSERT INTO public.pool_posts (
                      session_id,
                      host_user_id,
                      status,
                      total_slots,
                      host_slots,
                      description
                    )
                    VALUES (
                      :session_id,
                      :host_user_id,
                      CAST('open' AS public.pool_post_status),
                      :total_slots,
                      :host_slots,
                      :description
                    )
                    ON CONFLICT (session_id) DO UPDATE
                    SET total_slots = EXCLUDED.total_slots,
                        description = EXCLUDED.description
                    """
                ),
                {
                    "session_id": session_id,
                    "host_user_id": owner_user_id,
                    "total_slots": int(next_data["max_slots"]),
                    "host_slots": 1,
                    "description": next_data.get("description") or f"Pool cho session {row.title}",
                },
            )
        else:
            connection.execute(
                text("DELETE FROM public.pool_posts WHERE session_id = :session_id"),
                {"session_id": session_id},
            )
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
