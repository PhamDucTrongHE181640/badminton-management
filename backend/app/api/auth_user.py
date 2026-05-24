from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.dependencies import require_user
from app.core.errors import AppError
from app.services.user_auth import (
    UserPrincipal,
    refresh_user_session,
    revoke_user_session,
)

router = APIRouter(prefix="/auth", tags=["user-auth"])


class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str
    avatar_url: str | None
    roles: list[str]


class RefreshRequest(BaseModel):
    refresh_token: str | None = Field(default=None)


class LogoutRequest(BaseModel):
    refresh_token: str | None = Field(default=None)


def _profile(user: UserPrincipal) -> dict[str, object]:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
        "roles": user.roles,
    }


@router.get("/me", response_model=UserProfile)
def me(user: Annotated[UserPrincipal, Depends(require_user)]) -> dict[str, object]:
    return _profile(user)


@router.post("/refresh")
def refresh(
    response: Response,
    payload: RefreshRequest,
    netup_user_refresh_token: Annotated[str | None, Cookie()] = None,
) -> dict[str, object]:
    settings = get_settings()
    refresh_token = payload.refresh_token or netup_user_refresh_token
    if not refresh_token:
        raise AppError(
            status_code=401,
            code="user_refresh_missing",
            message="Thiếu refresh token người dùng",
        )

    result = refresh_user_session(refresh_token)
    if result is None:
        raise AppError(
            status_code=401,
            code="user_refresh_failed",
            message="Phiên đăng nhập người dùng không hợp lệ hoặc đã hết hạn",
        )

    response.set_cookie(
        "netup_user_access_token",
        result["access_token"],
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        max_age=int(result["expires_in"]),
    )
    response.set_cookie(
        "netup_user_refresh_token",
        result["refresh_token"],
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        max_age=settings.user_refresh_token_days * 24 * 60 * 60,
    )
    return {
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "token_type": result["token_type"],
        "expires_in": result["expires_in"],
        "user": _profile(result["user"]),
    }


@router.post("/logout")
def logout(
    response: Response,
    payload: LogoutRequest,
    netup_user_refresh_token: Annotated[str | None, Cookie()] = None,
) -> dict[str, bool]:
    refresh_token = payload.refresh_token or netup_user_refresh_token
    if refresh_token:
        revoke_user_session(refresh_token)
    response.delete_cookie("netup_user_access_token")
    response.delete_cookie("netup_user_refresh_token")
    return {"ok": True}
