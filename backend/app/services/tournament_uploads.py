from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import uuid4

from app.core.config import get_settings
from app.core.errors import AppError

MAX_TOURNAMENT_BANK_QR_BYTES = 5 * 1024 * 1024
SUPPORTED_TOURNAMENT_BANK_QR_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _upload_url(storage_key: str) -> str:
    base_url = get_settings().backend_base_url.rstrip("/")
    return f"{base_url}/uploads/{storage_key}"


def save_tournament_bank_qr_image(
    *, filename: str | None, content_type: str | None, content: bytes
) -> dict[str, Any]:
    mime_type = str(content_type or "").split(";", 1)[0].strip().lower()
    if mime_type not in SUPPORTED_TOURNAMENT_BANK_QR_MIME_TYPES:
        raise AppError(
            status_code=422,
            code="tournament_bank_qr_mime_invalid",
            message="Ảnh QR chỉ hỗ trợ PNG, JPG hoặc WEBP",
        )

    if not content:
        raise AppError(
            status_code=422,
            code="tournament_bank_qr_empty",
            message="Ảnh QR không được rỗng",
        )
    if len(content) > MAX_TOURNAMENT_BANK_QR_BYTES:
        raise AppError(
            status_code=413,
            code="tournament_bank_qr_too_large",
            message="Ảnh QR vượt quá giới hạn 5MB",
        )

    original_extension = Path(filename or "").suffix.lower()
    if original_extension and original_extension not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise AppError(
            status_code=422,
            code="tournament_bank_qr_extension_invalid",
            message="Tên file QR cần có đuôi .png, .jpg, .jpeg hoặc .webp",
        )

    extension = SUPPORTED_TOURNAMENT_BANK_QR_MIME_TYPES[mime_type]
    storage_key = f"tournament-bank-qrs/{uuid4().hex}{extension}"
    storage_path = Path(get_settings().local_upload_storage_dir) / storage_key
    storage_path.parent.mkdir(parents=True, exist_ok=True)
    storage_path.write_bytes(content)

    return {
        "imageUrl": _upload_url(storage_key),
        "storageKey": storage_key,
    }
