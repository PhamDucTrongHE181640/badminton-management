from __future__ import annotations

from typing import Any

from psycopg.types.json import Jsonb
from sqlalchemy import text

from app.core.errors import AppError
from app.db.session import get_engine


def _request_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "user_id": str(row.user_id),
        "business_name": str(row.business_name),
        "contact_phone": str(row.contact_phone) if row.contact_phone else None,
        "facility_overview": str(row.facility_overview) if row.facility_overview else None,
        "status": str(row.status),
        "submitted_at": row.submitted_at,
        "reviewed_at": row.reviewed_at,
        "reviewed_by": str(row.reviewed_by) if row.reviewed_by else None,
        "review_note": str(row.review_note) if row.review_note else None,
        "user_email": (
            str(row.user_email) if hasattr(row, "user_email") and row.user_email else None
        ),
        "user_full_name": (
            str(row.user_full_name)
            if hasattr(row, "user_full_name") and row.user_full_name
            else None
        ),
    }


def create_owner_request(
    *,
    user_id: str,
    business_name: str,
    contact_phone: str | None,
    facility_overview: str | None,
) -> dict[str, Any]:
    with get_engine().begin() as connection:
        active_owner = connection.execute(
            text(
                """
                SELECT 1
                FROM public.user_role_assignments
                WHERE user_id = :user_id
                  AND role = 'owner'
                  AND revoked_at IS NULL
                LIMIT 1
                """
            ),
            {"user_id": user_id},
        ).first()
        if active_owner is not None:
            raise AppError(
                status_code=409,
                code="owner_already_active",
                message="Tài khoản đã có quyền chủ sân",
            )

        pending_request = connection.execute(
            text(
                """
                SELECT 1
                FROM public.owner_service_requests
                WHERE user_id = :user_id AND status = 'pending'
                LIMIT 1
                """
            ),
            {"user_id": user_id},
        ).first()
        if pending_request is not None:
            raise AppError(
                status_code=409,
                code="owner_request_pending",
                message="Tài khoản đã có yêu cầu chủ sân đang chờ duyệt",
            )

        row = connection.execute(
            text(
                """
                INSERT INTO public.owner_service_requests (
                  user_id,
                  business_name,
                  contact_phone,
                  facility_overview
                )
                VALUES (:user_id, :business_name, :contact_phone, :facility_overview)
                RETURNING
                  id,
                  user_id,
                  business_name,
                  contact_phone,
                  facility_overview,
                  status::text AS status,
                  submitted_at,
                  reviewed_at,
                  reviewed_by,
                  review_note
                """
            ),
            {
                "user_id": user_id,
                "business_name": business_name,
                "contact_phone": contact_phone,
                "facility_overview": facility_overview,
            },
        ).one()

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
                VALUES (
                  :actor_user_id,
                  'owner_request_submitted',
                  'owner_service_request',
                  :entity_id,
                  :payload
                )
                """
            ),
            {
                "actor_user_id": user_id,
                "entity_id": str(row.id),
                "payload": Jsonb({"business_name": business_name}),
            },
        )

    return _request_from_row(row)


def list_my_owner_requests(*, user_id: str) -> list[dict[str, Any]]:
    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                """
                SELECT
                  id,
                  user_id,
                  business_name,
                  contact_phone,
                  facility_overview,
                  status::text AS status,
                  submitted_at,
                  reviewed_at,
                  reviewed_by,
                  review_note
                FROM public.owner_service_requests
                WHERE user_id = :user_id
                ORDER BY submitted_at DESC
                """
            ),
            {"user_id": user_id},
        ).all()
    return [_request_from_row(row) for row in rows]


def list_owner_requests(*, status: str | None = None) -> list[dict[str, Any]]:
    where_clause = ""
    params: dict[str, Any] = {}
    if status:
        where_clause = "WHERE r.status = CAST(:status AS public.owner_request_status)"
        params["status"] = status

    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                f"""
                SELECT
                  r.id,
                  r.user_id,
                  r.business_name,
                  r.contact_phone,
                  r.facility_overview,
                  r.status::text AS status,
                  r.submitted_at,
                  r.reviewed_at,
                  r.reviewed_by,
                  r.review_note,
                  u.email AS user_email,
                  u.full_name AS user_full_name
                FROM public.owner_service_requests r
                JOIN public.users u ON u.id = r.user_id
                {where_clause}
                ORDER BY r.submitted_at DESC
                """
            ),
            params,
        ).all()
    return [_request_from_row(row) for row in rows]


def _review_owner_request(
    *, request_id: str, admin_user_id: str, status: str, review_note: str | None
) -> dict[str, Any]:
    event_type = "owner_request_approved" if status == "approved" else "owner_request_rejected"
    with get_engine().begin() as connection:
        row = connection.execute(
            text(
                """
                SELECT
                  id,
                  user_id,
                  business_name,
                  contact_phone,
                  facility_overview,
                  status::text AS status,
                  submitted_at,
                  reviewed_at,
                  reviewed_by,
                  review_note
                FROM public.owner_service_requests
                WHERE id = :request_id
                FOR UPDATE
                """
            ),
            {"request_id": request_id},
        ).first()

        if row is None:
            raise AppError(
                status_code=404,
                code="owner_request_not_found",
                message="Không tìm thấy yêu cầu chủ sân",
            )
        if row.status != "pending":
            raise AppError(
                status_code=409,
                code="owner_request_not_pending",
                message="Chỉ có thể duyệt hoặc từ chối yêu cầu đang chờ",
            )

        updated = connection.execute(
            text(
                """
                UPDATE public.owner_service_requests
                SET status = CAST(:status AS public.owner_request_status),
                    reviewed_at = now(),
                    reviewed_by = :admin_user_id,
                    review_note = :review_note
                WHERE id = :request_id
                RETURNING
                  id,
                  user_id,
                  business_name,
                  contact_phone,
                  facility_overview,
                  status::text AS status,
                  submitted_at,
                  reviewed_at,
                  reviewed_by,
                  review_note
                """
            ),
            {
                "request_id": request_id,
                "status": status,
                "admin_user_id": admin_user_id,
                "review_note": review_note,
            },
        ).one()

        if status == "approved":
            connection.execute(
                text(
                    """
                    INSERT INTO public.user_role_assignments (
                      user_id,
                      role,
                      granted_by,
                      reason
                    )
                    VALUES (
                      :user_id,
                      'owner',
                      :granted_by,
                      'owner request approved'
                    )
                    ON CONFLICT DO NOTHING
                    """
                ),
                {"user_id": row.user_id, "granted_by": admin_user_id},
            )

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
                VALUES (:actor_user_id, :event_type, 'owner_service_request', :entity_id, :payload)
                """
            ),
            {
                "actor_user_id": admin_user_id,
                "event_type": event_type,
                "entity_id": request_id,
                "payload": Jsonb({"status": status, "review_note": review_note}),
            },
        )

    return _request_from_row(updated)


def approve_owner_request(
    *, request_id: str, admin_user_id: str, review_note: str | None
) -> dict[str, Any]:
    return _review_owner_request(
        request_id=request_id,
        admin_user_id=admin_user_id,
        status="approved",
        review_note=review_note,
    )


def reject_owner_request(
    *, request_id: str, admin_user_id: str, review_note: str | None
) -> dict[str, Any]:
    return _review_owner_request(
        request_id=request_id,
        admin_user_id=admin_user_id,
        status="rejected",
        review_note=review_note,
    )
