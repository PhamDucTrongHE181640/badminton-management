from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import text

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import (
    create_refresh_token,
    create_signed_token,
    decode_signed_token,
    hash_token,
    verify_password,
)
from app.db.session import get_engine


@dataclass(frozen=True)
class AdminPrincipal:
    id: str
    user_id: str
    username: str
    is_super_admin: bool


def _principal_from_row(row: Any) -> AdminPrincipal:
    return AdminPrincipal(
        id=str(row.id),
        user_id=str(row.user_id),
        username=str(row.username),
        is_super_admin=bool(row.is_super_admin),
    )


def create_admin_access_token(admin: AdminPrincipal) -> str:
    settings = get_settings()
    return create_signed_token(
        subject=admin.id,
        token_type="admin_access",
        secret_key=settings.app_secret_key,
        expires_delta=timedelta(minutes=settings.admin_access_token_minutes),
        extra={
            "user_id": admin.user_id,
            "username": admin.username,
            "is_super_admin": admin.is_super_admin,
        },
    )


def _ensure_login_not_rate_limited(
    connection: Any,
    *,
    username: str,
    ip: str | None,
    max_attempts: int,
    window_minutes: int,
    block_minutes: int,
) -> None:
    username_row = connection.execute(
        text(
            """
            SELECT
              count(*)::int AS failed_count,
              max(created_at) AS last_failed_at
            FROM public.admin_login_audits
            WHERE success = false
              AND username_attempt = :username
              AND created_at >= now() - make_interval(mins => :window_minutes)
            """
        ),
        {"username": username, "window_minutes": window_minutes},
    ).one()

    ip_row = None
    if ip:
        ip_row = connection.execute(
            text(
                """
                SELECT
                  count(*)::int AS failed_count,
                  max(created_at) AS last_failed_at
                FROM public.admin_login_audits
                WHERE success = false
                  AND ip = :ip
                  AND created_at >= now() - make_interval(mins => :window_minutes)
                """
            ),
            {"ip": ip, "window_minutes": window_minutes},
        ).one()

    username_count = int(username_row.failed_count or 0)
    ip_count = int(ip_row.failed_count or 0) if ip_row else 0
    reached_limit = max(username_count, ip_count) >= max_attempts
    if not reached_limit:
        return

    latest_failed_at = username_row.last_failed_at
    if ip_row and ip_row.last_failed_at and (
        latest_failed_at is None or ip_row.last_failed_at > latest_failed_at
    ):
        latest_failed_at = ip_row.last_failed_at

    if latest_failed_at is None:
        return

    block_until = latest_failed_at + timedelta(minutes=block_minutes)
    now_utc = datetime.now(UTC)
    if block_until <= now_utc:
        return

    retry_after_minutes = max(
        1,
        int((block_until - now_utc).total_seconds() / 60),
    )
    raise AppError(
        status_code=429,
        code="admin_login_rate_limited",
        message=(
            "Đăng nhập thất bại quá nhiều lần. "
            f"Vui lòng thử lại sau khoảng {retry_after_minutes} phút."
        ),
    )


def authenticate_admin(
    *, username: str, password: str, ip: str | None, user_agent: str | None
) -> dict[str, Any] | None:
    settings = get_settings()
    engine = get_engine()
    refresh_token = create_refresh_token()
    refresh_token_hash = hash_token(refresh_token)
    expires_at = datetime.now(UTC) + timedelta(days=settings.admin_refresh_token_days)

    with engine.begin() as connection:
        _ensure_login_not_rate_limited(
            connection,
            username=username,
            ip=ip,
            max_attempts=max(1, settings.admin_login_max_attempts),
            window_minutes=max(1, settings.admin_login_window_minutes),
            block_minutes=max(1, settings.admin_login_block_minutes),
        )

        row = connection.execute(
            text(
                """
                SELECT id, user_id, username, password_hash, is_super_admin
                FROM public.admin_accounts
                WHERE username = :username AND is_active = true
                """
            ),
            {"username": username},
        ).first()

        success = row is not None and verify_password(password, row.password_hash)
        connection.execute(
            text(
                """
                INSERT INTO public.admin_login_audits
                  (admin_account_id, username_attempt, success, ip, user_agent)
                VALUES (:admin_account_id, :username_attempt, :success, :ip, :user_agent)
                """
            ),
            {
                "admin_account_id": row.id if row else None,
                "username_attempt": username,
                "success": success,
                "ip": ip,
                "user_agent": user_agent,
            },
        )

        if not success:
            return None

        connection.execute(
            text(
                """
                UPDATE public.admin_accounts
                SET last_login_at = now()
                WHERE id = :id
                """
            ),
            {"id": row.id},
        )
        session_row = connection.execute(
            text(
                """
                INSERT INTO public.admin_sessions
                  (admin_account_id, refresh_token_hash, ip, user_agent, expires_at)
                VALUES (:admin_account_id, :refresh_token_hash, :ip, :user_agent, :expires_at)
                RETURNING id
                """
            ),
            {
                "admin_account_id": row.id,
                "refresh_token_hash": refresh_token_hash,
                "ip": ip,
                "user_agent": user_agent,
                "expires_at": expires_at,
            },
        ).one()

    admin = _principal_from_row(row)
    return {
        "access_token": create_admin_access_token(admin),
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.admin_access_token_minutes * 60,
        "session_id": str(session_row.id),
        "admin": admin,
    }


def refresh_admin_session(refresh_token: str) -> dict[str, Any] | None:
    settings = get_settings()
    engine = get_engine()
    current_hash = hash_token(refresh_token)
    next_refresh_token = create_refresh_token()
    next_hash = hash_token(next_refresh_token)
    expires_at = datetime.now(UTC) + timedelta(days=settings.admin_refresh_token_days)

    with engine.begin() as connection:
        row = connection.execute(
            text(
                """
                SELECT
                  s.id AS session_id,
                  a.id,
                  a.user_id,
                  a.username,
                  a.is_super_admin
                FROM public.admin_sessions s
                JOIN public.admin_accounts a ON a.id = s.admin_account_id
                WHERE s.refresh_token_hash = :refresh_token_hash
                  AND s.revoked_at IS NULL
                  AND s.expires_at > now()
                  AND a.is_active = true
                """
            ),
            {"refresh_token_hash": current_hash},
        ).first()

        if row is None:
            return None

        connection.execute(
            text(
                """
                UPDATE public.admin_sessions
                SET refresh_token_hash = :next_hash, expires_at = :expires_at
                WHERE id = :session_id
                """
            ),
            {"next_hash": next_hash, "expires_at": expires_at, "session_id": row.session_id},
        )

    admin = _principal_from_row(row)
    return {
        "access_token": create_admin_access_token(admin),
        "refresh_token": next_refresh_token,
        "token_type": "bearer",
        "expires_in": settings.admin_access_token_minutes * 60,
        "admin": admin,
    }


def revoke_admin_session(refresh_token: str) -> bool:
    engine = get_engine()
    with engine.begin() as connection:
        result = connection.execute(
            text(
                """
                UPDATE public.admin_sessions
                SET revoked_at = now()
                WHERE refresh_token_hash = :refresh_token_hash
                  AND revoked_at IS NULL
                """
            ),
            {"refresh_token_hash": hash_token(refresh_token)},
        )
        return result.rowcount > 0


def principal_from_access_token(access_token: str) -> AdminPrincipal | None:
    settings = get_settings()
    payload = decode_signed_token(
        access_token, secret_key=settings.app_secret_key, expected_type="admin_access"
    )
    if payload is None:
        return None

    return AdminPrincipal(
        id=str(payload["sub"]),
        user_id=str(payload["user_id"]),
        username=str(payload["username"]),
        is_super_admin=bool(payload["is_super_admin"]),
    )
