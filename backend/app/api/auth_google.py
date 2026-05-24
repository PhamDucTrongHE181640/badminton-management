from __future__ import annotations

from datetime import timedelta
from urllib.parse import urlencode

from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import create_signed_token, decode_signed_token
from app.services.user_auth import authenticate_google_code

router = APIRouter(prefix="/auth/google", tags=["google-auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"


@router.get("/start")
def google_start() -> RedirectResponse:
    settings = get_settings()
    if not settings.google_client_id:
        raise AppError(
            status_code=501,
            code="google_oauth_not_configured",
            message="Google OAuth chưa được cấu hình",
        )

    state = create_signed_token(
        subject="google-oauth",
        token_type="google_oauth_state",
        secret_key=settings.app_secret_key,
        expires_delta=timedelta(minutes=10),
        extra={},
    )
    query = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
    )
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{query}")


@router.get("/callback")
def google_callback(
    request: Request, code: str | None = None, state: str | None = None
) -> RedirectResponse:
    settings = get_settings()
    if not code or not state:
        raise AppError(
            status_code=400,
            code="google_oauth_invalid_callback",
            message="Callback Google OAuth thiếu code hoặc state",
        )
    if decode_signed_token(
        state, secret_key=settings.app_secret_key, expected_type="google_oauth_state"
    ) is None:
        raise AppError(
            status_code=400,
            code="google_oauth_invalid_state",
            message="State Google OAuth không hợp lệ hoặc đã hết hạn",
        )

    result = authenticate_google_code(
        code=code,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    redirect = RedirectResponse(f"{settings.frontend_base_url}/auth/google/callback?status=success")
    redirect.set_cookie(
        "netup_user_access_token",
        result["access_token"],
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        max_age=settings.user_access_token_minutes * 60,
    )
    redirect.set_cookie(
        "netup_user_refresh_token",
        result["refresh_token"],
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        max_age=settings.user_refresh_token_days * 24 * 60 * 60,
    )
    return redirect
