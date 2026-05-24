from __future__ import annotations

from datetime import timedelta

from app.core.security import (
    create_signed_token,
    decode_signed_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip() -> None:
    password_hash = hash_password("mat-khau-manh")

    assert verify_password("mat-khau-manh", password_hash)
    assert not verify_password("sai-mat-khau", password_hash)


def test_signed_token_roundtrip() -> None:
    token = create_signed_token(
        subject="admin-id",
        token_type="admin_access",
        secret_key="secret",
        expires_delta=timedelta(minutes=5),
        extra={"username": "admin"},
    )

    payload = decode_signed_token(token, secret_key="secret", expected_type="admin_access")

    assert payload is not None
    assert payload["sub"] == "admin-id"
    assert payload["username"] == "admin"


def test_signed_token_rejects_wrong_secret() -> None:
    token = create_signed_token(
        subject="admin-id",
        token_type="admin_access",
        secret_key="secret",
        expires_delta=timedelta(minutes=5),
        extra={},
    )

    assert decode_signed_token(token, secret_key="other", expected_type="admin_access") is None
