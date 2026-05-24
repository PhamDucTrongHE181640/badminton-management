from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.dependencies import require_admin
from app.core.errors import AppError
from app.services.admin_auth import (
    AdminPrincipal,
    authenticate_admin,
    refresh_admin_session,
    revoke_admin_session,
)

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class AdminProfile(BaseModel):
    id: str
    user_id: str
    username: str
    is_super_admin: bool


class AdminTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    admin: AdminProfile


@router.post("/login", response_model=AdminTokenResponse)
def login(payload: AdminLoginRequest, request: Request) -> dict[str, object]:
    result = authenticate_admin(
        username=payload.username,
        password=payload.password,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    if result is None:
        raise AppError(
            status_code=401,
            code="admin_login_failed",
            message="Tên đăng nhập hoặc mật khẩu không đúng",
        )

    admin = result["admin"]
    return {
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "token_type": result["token_type"],
        "expires_in": result["expires_in"],
        "admin": {
            "id": admin.id,
            "user_id": admin.user_id,
            "username": admin.username,
            "is_super_admin": admin.is_super_admin,
        },
    }


@router.post("/refresh", response_model=AdminTokenResponse)
def refresh(payload: RefreshRequest) -> dict[str, object]:
    result = refresh_admin_session(payload.refresh_token)
    if result is None:
        raise AppError(
            status_code=401,
            code="admin_refresh_failed",
            message="Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
        )

    admin = result["admin"]
    return {
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "token_type": result["token_type"],
        "expires_in": result["expires_in"],
        "admin": {
            "id": admin.id,
            "user_id": admin.user_id,
            "username": admin.username,
            "is_super_admin": admin.is_super_admin,
        },
    }


@router.post("/logout")
def logout(payload: LogoutRequest) -> dict[str, bool]:
    revoke_admin_session(payload.refresh_token)
    return {"ok": True}


@router.get("/me", response_model=AdminProfile)
def me(admin: Annotated[AdminPrincipal, Depends(require_admin)]) -> dict[str, object]:
    return {
        "id": admin.id,
        "user_id": admin.user_id,
        "username": admin.username,
        "is_super_admin": admin.is_super_admin,
    }
