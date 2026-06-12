from __future__ import annotations

from typing import Any

from psycopg.types.json import Jsonb
from sqlalchemy import text

from app.core.errors import AppError
from app.db.session import get_engine

CONTACT_LEAD_STATUSES = {"new", "contacted", "qualified", "closed"}


def _contact_lead_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "status": str(row.status),
        "created_at": row.created_at,
    }


def create_contact_lead(*, data: dict[str, Any]) -> dict[str, Any]:
    full_name = str(data.get("full_name") or "").strip()
    phone = str(data.get("phone") or "").strip()
    email = str(data.get("email") or "").strip()
    partner_type = str(data.get("partner_type") or "").strip()
    organization_name = str(data.get("organization_name") or "").strip()
    address = str(data.get("address") or "").strip()
    message = str(data.get("message") or "").strip() or None
    source = str(data.get("source") or "web").strip() or "web"
    metadata = data.get("metadata")

    if not full_name:
        raise AppError(status_code=422, code="contact_full_name_required", message="Vui lòng nhập họ và tên")
    if not phone:
        raise AppError(status_code=422, code="contact_phone_required", message="Vui lòng nhập số điện thoại")
    if not email or "@" not in email:
        raise AppError(status_code=422, code="contact_email_invalid", message="Email liên hệ không hợp lệ")
    if not partner_type:
        raise AppError(
            status_code=422,
            code="contact_partner_type_required",
            message="Vui lòng chọn loại hình hợp tác",
        )
    if not organization_name:
        raise AppError(
            status_code=422,
            code="contact_organization_required",
            message="Vui lòng nhập tên sân hoặc doanh nghiệp",
        )
    if not address:
        raise AppError(status_code=422, code="contact_address_required", message="Vui lòng nhập địa chỉ")

    with get_engine().begin() as connection:
        row = connection.execute(
            text(
                """
                INSERT INTO public.contact_leads (
                  full_name,
                  phone,
                  email,
                  partner_type,
                  organization_name,
                  address,
                  message,
                  source,
                  metadata
                )
                VALUES (
                  :full_name,
                  :phone,
                  :email,
                  :partner_type,
                  :organization_name,
                  :address,
                  :message,
                  :source,
                  :metadata
                )
                RETURNING id, status, created_at
                """
            ),
            {
                "full_name": full_name,
                "phone": phone,
                "email": email,
                "partner_type": partner_type,
                "organization_name": organization_name,
                "address": address,
                "message": message,
                "source": source,
                "metadata": Jsonb(metadata if isinstance(metadata, dict) else {}),
            },
        ).one()
    return _contact_lead_from_row(row)


def get_platform_stats() -> dict[str, int]:
    with get_engine().begin() as connection:
        row = connection.execute(
            text(
                """
                SELECT
                  (SELECT COUNT(*)::int FROM public.users WHERE is_active = true) AS users_total,
                  (
                    SELECT COUNT(DISTINCT user_id)::int
                    FROM public.user_role_assignments
                    WHERE role = CAST('owner' AS public.user_role)
                      AND revoked_at IS NULL
                  ) AS active_owners,
                  (
                    SELECT COUNT(*)::int
                    FROM public.courts
                    WHERE status = CAST('active' AS public.court_status)
                  ) AS active_courts,
                  (
                    SELECT COUNT(*)::int
                    FROM public.sessions
                    WHERE status IN (
                      CAST('scheduled' AS public.session_status),
                      CAST('locked' AS public.session_status)
                    )
                      AND starts_at >= now()
                  ) AS upcoming_sessions,
                  (
                    SELECT COUNT(*)::int
                    FROM public.bookings
                    WHERE status IN (
                      CAST('checked_in' AS public.booking_status),
                      CAST('completed' AS public.booking_status)
                    )
                  ) AS completed_bookings
                """
            )
        ).one()

    return {
        "users_total": int(row.users_total),
        "active_owners": int(row.active_owners),
        "active_courts": int(row.active_courts),
        "upcoming_sessions": int(row.upcoming_sessions),
        "completed_bookings": int(row.completed_bookings),
    }
