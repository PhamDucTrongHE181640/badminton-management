from __future__ import annotations

import base64
import json
import logging
import struct
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote
from uuid import uuid4

import httpx
from psycopg.types.json import Jsonb
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.session import get_engine
from app.services.player_assessment import BASELINE_ELO, MAX_ELO, MIN_ELO, _tier_from_elo

logger = logging.getLogger(__name__)

ALLOWED_SPORTS = {"Badminton", "Football", "Tennis"}
SUPPORTED_VIDEO_MIME_TYPES = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
}
SUPPORTED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm"}
VIDEO_ASSESSMENT_ELO_ALGORITHM_VERSION = "video_assessment_gemini_v1"
VIDEO_ASSESSMENT_RATE_LIMIT_PER_HOUR = 3
LOW_CONFIDENCE_THRESHOLD = 0.35
MAX_TEXT_LENGTH = 800

GEMINI_GENERATE_CONTENT_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

ASSESSMENT_ASPECTS: dict[str, dict[str, str]] = {
    "technical": {
        "label": "Kỹ thuật",
        "description": "Kỹ thuật chính của môn, kiểm soát dụng cụ hoặc bóng/cầu.",
    },
    "movement": {
        "label": "Di chuyển và thể lực",
        "description": "Footwork, tốc độ đổi hướng, khả năng giữ nhịp vận động.",
    },
    "consistency": {
        "label": "Độ ổn định",
        "description": "Khả năng lặp lại động tác, kiểm soát lỗi và duy trì pha bóng.",
    },
    "game_reading": {
        "label": "Đọc tình huống",
        "description": "Chọn vị trí, ra quyết định và phản ứng với diễn biến chơi.",
    },
}

VIDEO_ASSESSMENT_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "sport": {"type": "string", "enum": ["Badminton", "Football", "Tennis"]},
        "technical_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "movement_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "consistency_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "game_reading_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "suggested_skill_tier": {
            "type": "string",
            "enum": ["Beginner", "Intermediate", "Advanced"],
        },
        "suggested_initial_elo": {"type": "integer", "minimum": MIN_ELO, "maximum": MAX_ELO},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "strengths": {"type": "array", "items": {"type": "string"}, "maxItems": 5},
        "improvement_areas": {"type": "array", "items": {"type": "string"}, "maxItems": 5},
        "summary": {"type": "string"},
        "aspect_evaluations": {
            "type": "array",
            "minItems": 4,
            "maxItems": 4,
            "items": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "enum": ["technical", "movement", "consistency", "game_reading"],
                    },
                    "label": {"type": "string"},
                    "score": {"type": "integer", "minimum": 0, "maximum": 100},
                    "tier": {
                        "type": "string",
                        "enum": ["Beginner", "Intermediate", "Advanced"],
                    },
                    "feedback": {"type": "string"},
                    "evidence": {"type": "string"},
                    "improvement_tip": {"type": "string"},
                },
                "required": [
                    "key",
                    "label",
                    "score",
                    "tier",
                    "feedback",
                    "evidence",
                    "improvement_tip",
                ],
            },
        },
    },
    "required": [
        "sport",
        "technical_score",
        "movement_score",
        "consistency_score",
        "game_reading_score",
        "suggested_skill_tier",
        "suggested_initial_elo",
        "confidence",
        "strengths",
        "improvement_areas",
        "summary",
        "aspect_evaluations",
    ],
}


class GeminiAssessmentError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def _audit(
    connection: Any,
    *,
    actor_user_id: str | None,
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
            "payload": Jsonb(payload or {}),
        },
    )


def _settings_limit_defaults() -> dict[str, int]:
    settings = get_settings()
    max_size_mb = max(1, min(100, int(settings.video_assessment_max_size_mb)))
    max_duration_seconds = max(
        5,
        min(300, int(settings.video_assessment_max_duration_seconds)),
    )
    return {
        "max_size_mb": max_size_mb,
        "max_size_bytes": max_size_mb * 1024 * 1024,
        "max_duration_seconds": max_duration_seconds,
    }


def get_video_assessment_limits() -> dict[str, int]:
    defaults = _settings_limit_defaults()
    with get_engine().begin() as connection:
        row = connection.execute(
            text(
                """
                SELECT
                  video_assessment_max_size_mb,
                  video_assessment_max_duration_seconds
                FROM public.admin_configs
                WHERE id = 1
                LIMIT 1
                """
            )
        ).first()

    if row is None:
        return defaults

    max_size_mb = max(1, min(100, int(row.video_assessment_max_size_mb)))
    max_duration_seconds = max(
        5,
        min(300, int(row.video_assessment_max_duration_seconds)),
    )
    return {
        "max_size_mb": max_size_mb,
        "max_size_bytes": max_size_mb * 1024 * 1024,
        "max_duration_seconds": max_duration_seconds,
    }


def _video_row_to_dict(row: Any) -> dict[str, Any]:
    normalized_result = dict(row.normalized_result or {})
    return {
        "assessment_id": str(row.id),
        "sport": str(row.sport),
        "status": str(row.status),
        "llm_provider": str(row.llm_provider),
        "llm_model": str(row.llm_model) if row.llm_model else None,
        "file_size_bytes": int(row.file_size_bytes),
        "duration_seconds": (
            float(row.duration_seconds) if row.duration_seconds is not None else None
        ),
        "computed_skill_tier": (
            str(row.computed_skill_tier) if row.computed_skill_tier else None
        ),
        "confidence": float(row.confidence) if row.confidence is not None else None,
        "technical_score": normalized_result.get("technical_score"),
        "movement_score": normalized_result.get("movement_score"),
        "consistency_score": normalized_result.get("consistency_score"),
        "game_reading_score": normalized_result.get("game_reading_score"),
        "aspect_evaluations": normalized_result.get("aspect_evaluations") or [],
        "summary": normalized_result.get("summary"),
        "strengths": normalized_result.get("strengths") or [],
        "improvement_areas": normalized_result.get("improvement_areas") or [],
        "warning": normalized_result.get("warning"),
        "error_message": str(row.error_message) if row.error_message else None,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _normalize_filename(filename: str | None) -> str:
    clean = Path(filename or "video").name.strip()
    return clean[:180] or "video"


def _filename_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def _looks_like_mp4_or_mov(content: bytes) -> bool:
    if len(content) < 12:
        return False
    return content[4:8] == b"ftyp"


def _looks_like_webm(content: bytes) -> bool:
    return content.startswith(b"\x1a\x45\xdf\xa3")


def _extract_mp4_duration_seconds(content: bytes) -> float | None:
    search_from = 0
    while True:
        mvhd_index = content.find(b"mvhd", search_from)
        if mvhd_index < 0:
            return None

        version_offset = mvhd_index + 4
        version = content[version_offset] if version_offset < len(content) else None
        if version == 0 and mvhd_index + 24 <= len(content):
            timescale = int.from_bytes(content[mvhd_index + 16 : mvhd_index + 20], "big")
            duration = int.from_bytes(content[mvhd_index + 20 : mvhd_index + 24], "big")
        elif version == 1 and mvhd_index + 36 <= len(content):
            timescale = int.from_bytes(content[mvhd_index + 24 : mvhd_index + 28], "big")
            duration = int.from_bytes(content[mvhd_index + 28 : mvhd_index + 36], "big")
        else:
            search_from = mvhd_index + 4
            continue

        if timescale <= 0:
            return None
        return duration / timescale


def _decode_ebml_vint(content: bytes, offset: int) -> tuple[int, int] | None:
    if offset >= len(content):
        return None
    first_byte = content[offset]
    mask = 0x80
    length = 1
    while length <= 8 and not first_byte & mask:
        mask >>= 1
        length += 1
    if length > 8 or offset + length > len(content):
        return None

    value = first_byte & (mask - 1)
    for index in range(1, length):
        value = (value << 8) | content[offset + index]
    return value, length


def _extract_webm_duration_seconds(content: bytes) -> float | None:
    timecode_scale = 1_000_000
    scale_index = content.find(b"\x2a\xd7\xb1")
    if scale_index >= 0:
        size_info = _decode_ebml_vint(content, scale_index + 3)
        if size_info is not None:
            size, size_length = size_info
            value_start = scale_index + 3 + size_length
            value_end = value_start + size
            if 0 < size <= 8 and value_end <= len(content):
                timecode_scale = int.from_bytes(content[value_start:value_end], "big")

    duration_index = content.find(b"\x44\x89")
    if duration_index < 0:
        return None

    size_info = _decode_ebml_vint(content, duration_index + 2)
    if size_info is None:
        return None
    size, size_length = size_info
    value_start = duration_index + 2 + size_length
    value_end = value_start + size
    if value_end > len(content):
        return None
    if size == 4:
        duration_units = float(struct.unpack(">f", content[value_start:value_end])[0])
    elif size == 8:
        duration_units = float(struct.unpack(">d", content[value_start:value_end])[0])
    else:
        return None

    if duration_units < 0 or timecode_scale <= 0:
        return None
    return duration_units * timecode_scale / 1_000_000_000


def _extract_video_duration_seconds(content: bytes, mime_type: str) -> float | None:
    if mime_type in {"video/mp4", "video/quicktime"}:
        return _extract_mp4_duration_seconds(content)
    if mime_type == "video/webm":
        return _extract_webm_duration_seconds(content)
    return None


def _validate_video_upload(
    *,
    filename: str,
    mime_type: str,
    content: bytes,
    max_size_bytes: int,
    max_duration_seconds: int,
) -> float | None:
    if mime_type not in SUPPORTED_VIDEO_MIME_TYPES:
        raise AppError(
            status_code=422,
            code="video_assessment_mime_invalid",
            message="Video chỉ hỗ trợ mp4, mov hoặc webm",
        )
    extension = _filename_extension(filename)
    if extension not in SUPPORTED_VIDEO_EXTENSIONS:
        raise AppError(
            status_code=422,
            code="video_assessment_extension_invalid",
            message="Tên file cần có đuôi .mp4, .mov hoặc .webm",
        )
    if not content:
        raise AppError(
            status_code=422,
            code="video_assessment_file_empty",
            message="Video upload không được rỗng",
        )
    if len(content) > max_size_bytes:
        max_mb = max_size_bytes // (1024 * 1024)
        raise AppError(
            status_code=413,
            code="video_assessment_file_too_large",
            message=f"Video vượt quá giới hạn {max_mb}MB",
        )
    if mime_type == "video/webm" and not _looks_like_webm(content):
        raise AppError(
            status_code=422,
            code="video_assessment_signature_invalid",
            message="Nội dung file không đúng định dạng webm",
        )
    if mime_type in {"video/mp4", "video/quicktime"} and not _looks_like_mp4_or_mov(content):
        raise AppError(
            status_code=422,
            code="video_assessment_signature_invalid",
            message="Nội dung file không đúng định dạng mp4/mov",
        )

    duration_seconds = _extract_video_duration_seconds(content, mime_type)
    if duration_seconds is not None and duration_seconds > max_duration_seconds:
        raise AppError(
            status_code=422,
            code="video_assessment_duration_too_long",
            message=f"Video vượt quá thời lượng {max_duration_seconds} giây",
        )
    return duration_seconds


def _storage_path(storage_key: str) -> Path:
    storage_dir = Path(get_settings().video_assessment_storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir / storage_key


def create_video_assessment(
    *,
    player_user_id: str,
    sport: str,
    filename: str | None,
    content_type: str | None,
    content: bytes,
) -> dict[str, Any]:
    if sport not in ALLOWED_SPORTS:
        raise AppError(
            status_code=422,
            code="video_assessment_sport_invalid",
            message="Môn thể thao không hợp lệ",
        )

    limits = get_video_assessment_limits()
    original_filename = _normalize_filename(filename)
    mime_type = str(content_type or "").split(";")[0].strip().lower()
    duration_seconds = _validate_video_upload(
        filename=original_filename,
        mime_type=mime_type,
        content=content,
        max_size_bytes=limits["max_size_bytes"],
        max_duration_seconds=limits["max_duration_seconds"],
    )

    settings = get_settings()
    assessment_id = str(uuid4())
    storage_key = f"{assessment_id}{SUPPORTED_VIDEO_MIME_TYPES[mime_type]}"
    storage_path = _storage_path(storage_key)

    with get_engine().begin() as connection:
        connection.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:player_user_id))"),
            {"player_user_id": player_user_id},
        )
        job_timeout_seconds = max(60, int(settings.gemini_timeout_seconds) * 2)
        connection.execute(
            text(
                """
                UPDATE public.video_assessments
                SET status = 'failed',
                    error_message = 'Job đánh giá video đã quá thời gian chờ',
                    updated_at = now()
                WHERE player_user_id = :player_user_id
                  AND status IN ('uploaded', 'analyzing')
                  AND updated_at < now() - make_interval(secs => :timeout_seconds)
                """
            ),
            {
                "player_user_id": player_user_id,
                "timeout_seconds": job_timeout_seconds,
            },
        )

        active_video_assessment = connection.execute(
            text(
                """
                SELECT id
                FROM public.video_assessments
                WHERE player_user_id = :player_user_id
                  AND status IN ('uploaded', 'analyzing')
                LIMIT 1
                """
            ),
            {"player_user_id": player_user_id},
        ).first()
        if active_video_assessment is not None:
            raise AppError(
                status_code=409,
                code="video_assessment_active_exists",
                message="Tài khoản đang có job đánh giá video, vui lòng đợi job hiện tại hoàn tất",
            )

        recent_count = connection.execute(
            text(
                """
                SELECT count(*)::int
                FROM public.video_assessments
                WHERE player_user_id = :player_user_id
                  AND created_at >= now() - interval '1 hour'
                """
            ),
            {"player_user_id": player_user_id},
        ).scalar_one()
        if int(recent_count) >= VIDEO_ASSESSMENT_RATE_LIMIT_PER_HOUR:
            raise AppError(
                status_code=429,
                code="video_assessment_rate_limited",
                message="Bạn đã thử đánh giá video quá nhiều lần. Vui lòng thử lại sau",
            )

        storage_path.write_bytes(content)
        try:
            row = connection.execute(
                text(
                    """
                    INSERT INTO public.video_assessments (
                      id,
                      player_user_id,
                      sport,
                      storage_key,
                      original_filename,
                      mime_type,
                      file_size_bytes,
                      duration_seconds,
                      status,
                      llm_provider,
                      llm_model
                    )
                    VALUES (
                      CAST(:id AS uuid),
                      :player_user_id,
                      CAST(:sport AS public.sport_type),
                      :storage_key,
                      :original_filename,
                      :mime_type,
                      :file_size_bytes,
                      :duration_seconds,
                      'uploaded',
                      'gemini',
                      :llm_model
                    )
                    RETURNING
                      id,
                      sport::text AS sport,
                      status,
                      llm_provider,
                      llm_model,
                      file_size_bytes,
                      duration_seconds,
                      computed_skill_tier::text AS computed_skill_tier,
                      confidence,
                      normalized_result,
                      error_message,
                      created_at,
                      updated_at
                    """
                ),
                {
                    "id": assessment_id,
                    "player_user_id": player_user_id,
                    "sport": sport,
                    "storage_key": storage_key,
                    "original_filename": original_filename,
                    "mime_type": mime_type,
                    "file_size_bytes": len(content),
                    "duration_seconds": duration_seconds,
                    "llm_model": settings.gemini_model,
                },
            ).one()
        except IntegrityError as exc:
            storage_path.unlink(missing_ok=True)
            raise AppError(
                status_code=409,
                code="video_assessment_active_exists",
                message="Tài khoản đang có job đánh giá video, vui lòng đợi job hiện tại hoàn tất",
            ) from exc

        _audit(
            connection,
            actor_user_id=player_user_id,
            event_type="video_assessment_uploaded",
            entity_type="video_assessment",
            entity_id=assessment_id,
            payload={
                "sport": sport,
                "mime_type": mime_type,
                "file_size_bytes": len(content),
                "duration_seconds": duration_seconds,
            },
        )

    return _video_row_to_dict(row)


def get_video_assessment(*, player_user_id: str, assessment_id: str) -> dict[str, Any]:
    with get_engine().begin() as connection:
        row = connection.execute(
            text(
                """
                SELECT
                  id,
                  sport::text AS sport,
                  status,
                  llm_provider,
                  llm_model,
                  file_size_bytes,
                  duration_seconds,
                  computed_skill_tier::text AS computed_skill_tier,
                  confidence,
                  normalized_result,
                  error_message,
                  created_at,
                  updated_at
                FROM public.video_assessments
                WHERE id = CAST(:assessment_id AS uuid)
                  AND player_user_id = :player_user_id
                LIMIT 1
                """
            ),
            {"assessment_id": assessment_id, "player_user_id": player_user_id},
        ).first()

    if row is None:
        raise AppError(
            status_code=404,
            code="video_assessment_not_found",
            message="Không tìm thấy job đánh giá video",
        )
    return _video_row_to_dict(row)


def _mark_video_assessment_analyzing(*, assessment_id: str) -> dict[str, Any] | None:
    with get_engine().begin() as connection:
        row = connection.execute(
            text(
                """
                SELECT
                  id,
                  player_user_id,
                  sport::text AS sport,
                  status,
                  storage_key,
                  mime_type,
                  original_filename
                FROM public.video_assessments
                WHERE id = CAST(:assessment_id AS uuid)
                FOR UPDATE
                """
            ),
            {"assessment_id": assessment_id},
        ).first()
        if row is None or str(row.status) != "uploaded":
            return None

        connection.execute(
            text(
                """
                UPDATE public.video_assessments
                SET status = 'analyzing',
                    error_message = NULL,
                    updated_at = now()
                WHERE id = CAST(:assessment_id AS uuid)
                """
            ),
            {"assessment_id": assessment_id},
        )
        return {
            "id": str(row.id),
            "player_user_id": str(row.player_user_id),
            "sport": str(row.sport),
            "storage_key": str(row.storage_key),
            "mime_type": str(row.mime_type),
            "original_filename": str(row.original_filename),
        }


def _prompt_for_video_assessment(*, sport: str) -> str:
    sport_focus = {
        "Badminton": (
            "Kỹ thuật gồm cầm vợt, clear/drop/smash/net shot và kiểm soát cầu. "
            "Di chuyển gồm split step, bước chéo, phục hồi vị trí. "
            "Độ ổn định gồm giữ rally, hạn chế lỗi dễ, điểm tiếp xúc cầu. "
            "Đọc tình huống gồm chọn vị trí, dự đoán hướng cầu và quyết định đánh."
        ),
        "Football": (
            "Kỹ thuật gồm chạm bóng bước một, rê/chuyền/sút và kiểm soát bóng. "
            "Di chuyển gồm tốc độ, đổi hướng, thể lực và di chuyển không bóng. "
            "Độ ổn định gồm độ chính xác chuyền, xử lý dưới áp lực và nhịp động tác. "
            "Đọc tình huống gồm quan sát khoảng trống, chọn phương án và phối hợp đội."
        ),
        "Tennis": (
            "Kỹ thuật gồm forehand/backhand/serve/volley và kiểm soát mặt vợt. "
            "Di chuyển gồm footwork, tiếp cận bóng, phục hồi vị trí. "
            "Độ ổn định gồm duy trì rally, điểm tiếp xúc và kiểm soát lỗi. "
            "Đọc tình huống gồm chọn hướng đánh, vị trí đứng và phản ứng với bóng."
        ),
    }.get(sport, "")
    return (
        "Bạn là chuyên gia huấn luyện thể thao đang đánh giá video ngắn để khởi tạo "
        "level matchmaking nội bộ cho NetUp. Chỉ đánh giá người chơi chính trong video. "
        f"Môn thể thao người dùng chọn là {sport}. "
        "Trả về JSON thuần, không markdown, không giải thích ngoài JSON. "
        "Các điểm số nằm trong 0..100. Elo đề xuất nằm trong 900..2000. "
        "Bắt buộc đánh giá 4 khía cạnh: technical, movement, consistency, game_reading. "
        "Mỗi khía cạnh phải có score, tier, feedback, evidence quan sát từ video, "
        "và improvement_tip cụ thể để người chơi cải thiện. "
        f"Định nghĩa khía cạnh theo môn: {sport_focus} "
        "Beginner tương ứng người mới hoặc kỹ thuật chưa ổn định; Intermediate tương ứng "
        "người chơi phong trào kiểm soát tốt; Advanced tương ứng người có kỹ thuật và "
        "di chuyển thi đấu rõ ràng. Nếu video mờ, thiếu người chơi chính hoặc không đủ "
        "thông tin, confidence phải thấp và improvement_areas cần yêu cầu upload video rõ hơn."
    )


def _normalize_model_name(model: str) -> str:
    clean = model.strip() or "gemini-3.5-flash"
    return clean.removeprefix("models/")


def _extract_gemini_text(response_payload: dict[str, Any]) -> str:
    candidates = response_payload.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise GeminiAssessmentError("Gemini không trả kết quả đánh giá")
    content = candidates[0].get("content") if isinstance(candidates[0], dict) else None
    parts = content.get("parts") if isinstance(content, dict) else None
    if not isinstance(parts, list):
        raise GeminiAssessmentError("Gemini trả phản hồi không đúng định dạng")
    text_parts = [
        str(part.get("text"))
        for part in parts
        if isinstance(part, dict) and part.get("text")
    ]
    if not text_parts:
        raise GeminiAssessmentError("Gemini không trả JSON đánh giá")
    return "\n".join(text_parts).strip()


def _call_gemini_video_assessment(
    *,
    sport: str,
    mime_type: str,
    video_content: bytes,
) -> tuple[dict[str, Any], dict[str, Any]]:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise GeminiAssessmentError("Gemini API key chưa được cấu hình")

    model_name = _normalize_model_name(settings.gemini_model)
    url = GEMINI_GENERATE_CONTENT_URL.format(model=quote(model_name, safe=""))
    request_payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": base64.b64encode(video_content).decode("ascii"),
                        }
                    },
                    {"text": _prompt_for_video_assessment(sport=sport)},
                ],
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": VIDEO_ASSESSMENT_RESPONSE_SCHEMA,
            "temperature": 0.2,
            "maxOutputTokens": 1200,
        },
    }

    timeout_seconds = max(5, int(settings.gemini_timeout_seconds))
    last_error: str | None = None
    for attempt in range(2):
        try:
            with httpx.Client(timeout=timeout_seconds) as client:
                response = client.post(
                    url,
                    headers={
                        "x-goog-api-key": settings.gemini_api_key,
                        "Content-Type": "application/json",
                    },
                    json=request_payload,
                )
        except httpx.TimeoutException as exc:
            last_error = "Gemini xử lý quá thời gian chờ. Vui lòng thử lại sau"
            if attempt == 0:
                time.sleep(0.5)
                continue
            raise GeminiAssessmentError(last_error) from exc
        except httpx.HTTPError as exc:
            raise GeminiAssessmentError("Không kết nối được Gemini. Vui lòng thử lại sau") from exc

        if response.status_code == 429:
            raise GeminiAssessmentError(
                "Gemini đang hết quota hoặc bị rate limit. Vui lòng thử lại sau"
            )
        if response.status_code in {500, 502, 503, 504} and attempt == 0:
            last_error = "Gemini đang tạm thời lỗi. Đang thử lại"
            time.sleep(0.5)
            continue
        if response.status_code >= 400:
            raise GeminiAssessmentError("Gemini từ chối xử lý video. Vui lòng thử lại sau")

        response_payload = response.json()
        text_payload = _extract_gemini_text(response_payload)
        try:
            return json.loads(text_payload), response_payload
        except json.JSONDecodeError as exc:
            raise GeminiAssessmentError("Gemini trả JSON không hợp lệ") from exc

    raise GeminiAssessmentError(last_error or "Gemini không xử lý được video")


def _clamp_number(value: Any, *, minimum: float, maximum: float, default: float) -> float:
    if isinstance(value, bool):
        return default
    if isinstance(value, int | float):
        return max(minimum, min(maximum, float(value)))
    try:
        return max(minimum, min(maximum, float(str(value))))
    except (TypeError, ValueError):
        return default


def _clamp_int(value: Any, *, minimum: int, maximum: int, default: int) -> int:
    return int(round(_clamp_number(value, minimum=minimum, maximum=maximum, default=default)))


def _clean_text(value: Any, *, fallback: str = "") -> str:
    if not isinstance(value, str):
        return fallback
    return value.strip()[:MAX_TEXT_LENGTH]


def _clean_text_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned: list[str] = []
    for item in value:
        text_value = _clean_text(item)
        if text_value:
            cleaned.append(text_value[:240])
        if len(cleaned) >= 5:
            break
    return cleaned


def _aspect_tier_from_score(score: int) -> str:
    if score < 45:
        return "Beginner"
    if score < 75:
        return "Intermediate"
    return "Advanced"


def _aspect_score_key(aspect_key: str) -> str:
    return f"{aspect_key}_score" if aspect_key != "technical" else "technical_score"


def _fallback_aspect_feedback(*, aspect_key: str, score: int) -> str:
    label = ASSESSMENT_ASPECTS[aspect_key]["label"].lower()
    if score < 45:
        return (
            f"{label.capitalize()} còn ở mức nền tảng, "
            "cần video rõ hơn hoặc thêm luyện tập cơ bản."
        )
    if score < 75:
        return (
            f"{label.capitalize()} ở mức ổn cho phong trào, "
            "vẫn cần cải thiện độ chính xác và nhịp xử lý."
        )
    return f"{label.capitalize()} thể hiện tốt, có dấu hiệu kiểm soát và vận động ổn định."


def _normalize_aspect_evaluations(llm_result: dict[str, Any]) -> list[dict[str, Any]]:
    raw_items = llm_result.get("aspect_evaluations")
    raw_by_key: dict[str, dict[str, Any]] = {}
    if isinstance(raw_items, list):
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            key = str(item.get("key") or "").strip()
            if key in ASSESSMENT_ASPECTS:
                raw_by_key[key] = item

    normalized: list[dict[str, Any]] = []
    for aspect_key, spec in ASSESSMENT_ASPECTS.items():
        raw_item = raw_by_key.get(aspect_key, {})
        fallback_score = _clamp_int(
            llm_result.get(_aspect_score_key(aspect_key)),
            minimum=0,
            maximum=100,
            default=0,
        )
        score = _clamp_int(
            raw_item.get("score"),
            minimum=0,
            maximum=100,
            default=fallback_score,
        )
        tier = str(raw_item.get("tier") or "").strip()
        if tier not in {"Beginner", "Intermediate", "Advanced"}:
            tier = _aspect_tier_from_score(score)

        feedback = _clean_text(
            raw_item.get("feedback"),
            fallback=_fallback_aspect_feedback(aspect_key=aspect_key, score=score),
        )
        evidence = _clean_text(
            raw_item.get("evidence"),
            fallback="Chưa có bằng chứng đủ rõ từ video.",
        )
        improvement_tip = _clean_text(
            raw_item.get("improvement_tip"),
            fallback=spec["description"],
        )

        normalized.append(
            {
                "key": aspect_key,
                "label": _clean_text(raw_item.get("label"), fallback=spec["label"]),
                "score": score,
                "tier": tier,
                "feedback": feedback,
                "evidence": evidence,
                "improvement_tip": improvement_tip,
            }
        )
    return normalized


def normalize_llm_assessment_result(
    *, sport: str, llm_result: dict[str, Any]
) -> dict[str, Any]:
    if not isinstance(llm_result, dict):
        raise GeminiAssessmentError("Gemini trả kết quả không phải JSON object")

    confidence = _clamp_number(
        llm_result.get("confidence"),
        minimum=0.0,
        maximum=1.0,
        default=0.0,
    )
    suggested_elo = _clamp_int(
        llm_result.get("suggested_initial_elo"),
        minimum=MIN_ELO,
        maximum=MAX_ELO,
        default=BASELINE_ELO,
    )
    warning: str | None = None
    if confidence < LOW_CONFIDENCE_THRESHOLD:
        suggested_elo = BASELINE_ELO
        warning = "Độ tin cậy thấp, NetUp tạm xếp Beginner và khuyến nghị upload video rõ hơn."

    computed_tier = _tier_from_elo(suggested_elo)
    strengths = _clean_text_list(llm_result.get("strengths"))
    improvement_areas = _clean_text_list(llm_result.get("improvement_areas"))
    if warning and warning not in improvement_areas:
        improvement_areas = [warning, *improvement_areas[:4]]

    aspect_evaluations = _normalize_aspect_evaluations(llm_result)
    aspect_score_by_key = {
        str(item["key"]): int(item["score"])
        for item in aspect_evaluations
    }

    return {
        "sport": sport,
        "technical_score": aspect_score_by_key["technical"],
        "movement_score": aspect_score_by_key["movement"],
        "consistency_score": aspect_score_by_key["consistency"],
        "game_reading_score": aspect_score_by_key["game_reading"],
        "aspect_evaluations": aspect_evaluations,
        "suggested_skill_tier": computed_tier,
        "suggested_initial_elo": suggested_elo,
        "confidence": round(confidence, 3),
        "strengths": strengths,
        "improvement_areas": improvement_areas,
        "summary": _clean_text(
            llm_result.get("summary"),
            fallback="NetUp đã khởi tạo level từ video của bạn.",
        ),
        "warning": warning,
    }


def _complete_video_assessment(
    *,
    assessment_id: str,
    llm_raw_response: dict[str, Any],
    normalized_result: dict[str, Any],
) -> None:
    sport = str(normalized_result["sport"])
    computed_elo = int(normalized_result["suggested_initial_elo"])
    computed_tier = str(normalized_result["suggested_skill_tier"])
    confidence = float(normalized_result["confidence"])

    with get_engine().begin() as connection:
        row = connection.execute(
            text(
                """
                SELECT id, player_user_id, status
                FROM public.video_assessments
                WHERE id = CAST(:assessment_id AS uuid)
                FOR UPDATE
                """
            ),
            {"assessment_id": assessment_id},
        ).first()
        if row is None:
            return
        player_user_id = str(row.player_user_id)

        connection.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:player_user_id))"),
            {"player_user_id": player_user_id},
        )

        existing_assessment = connection.execute(
            text(
                """
                SELECT id
                FROM public.player_assessments
                WHERE player_user_id = :player_user_id
                ORDER BY created_at ASC
                LIMIT 1
                """
            ),
            {"player_user_id": player_user_id},
        ).first()
        is_initial_assessment = existing_assessment is None
        reason_prefix = (
            "video_assessment_initial" if is_initial_assessment else "video_reassessment"
        )
        reason = f"{reason_prefix}:{sport}:{assessment_id}"

        previous_elo_row = connection.execute(
            text(
                """
                SELECT elo_value
                FROM public.elo_ratings
                WHERE player_user_id = :player_user_id
                FOR UPDATE
                """
            ),
            {"player_user_id": player_user_id},
        ).first()
        old_elo = int(previous_elo_row.elo_value) if previous_elo_row else BASELINE_ELO

        player_assessment_id = assessment_id
        if is_initial_assessment:
            try:
                player_assessment_row = connection.execute(
                    text(
                        """
                        INSERT INTO public.player_assessments (
                          player_user_id,
                          sport,
                          form_version,
                          answers,
                          computed_elo,
                          computed_skill_tier
                        )
                        VALUES (
                          :player_user_id,
                          CAST(:sport AS public.sport_type),
                          'video:v1',
                          :answers,
                          :computed_elo,
                          CAST(:computed_skill_tier AS public.skill_tier)
                        )
                        RETURNING id
                        """
                    ),
                    {
                        "player_user_id": player_user_id,
                        "sport": sport,
                        "answers": Jsonb(
                            {
                                "source": "video_assessment",
                                "video_assessment_id": assessment_id,
                                "normalized_result": normalized_result,
                            }
                        ),
                        "computed_elo": computed_elo,
                        "computed_skill_tier": computed_tier,
                    },
                ).one()
                player_assessment_id = str(player_assessment_row.id)
            except IntegrityError as exc:
                raise GeminiAssessmentError("Tài khoản đã có Elo ban đầu") from exc

        connection.execute(
            text(
                """
                INSERT INTO public.elo_ratings (
                  player_user_id,
                  elo_value,
                  visible_skill_tier
                )
                VALUES (
                  :player_user_id,
                  :elo_value,
                  CAST(:visible_skill_tier AS public.skill_tier)
                )
                ON CONFLICT (player_user_id)
                DO UPDATE SET
                  elo_value = EXCLUDED.elo_value,
                  visible_skill_tier = EXCLUDED.visible_skill_tier,
                  updated_at = now()
                """
            ),
            {
                "player_user_id": player_user_id,
                "elo_value": computed_elo,
                "visible_skill_tier": computed_tier,
            },
        )

        connection.execute(
            text(
                """
                INSERT INTO public.elo_rating_history (
                  player_user_id,
                  match_id,
                  old_elo,
                  new_elo,
                  delta,
                  reason,
                  algorithm_version
                )
                VALUES (
                  :player_user_id,
                  NULL,
                  :old_elo,
                  :new_elo,
                  :delta,
                  :reason,
                  :algorithm_version
                )
                """
            ),
            {
                "player_user_id": player_user_id,
                "old_elo": old_elo,
                "new_elo": computed_elo,
                "delta": computed_elo - old_elo,
                "reason": reason,
                "algorithm_version": VIDEO_ASSESSMENT_ELO_ALGORITHM_VERSION,
            },
        )

        connection.execute(
            text(
                """
                UPDATE public.video_assessments
                SET status = 'completed',
                    llm_raw_response = :llm_raw_response,
                    normalized_result = :normalized_result,
                    computed_elo = :computed_elo,
                    computed_skill_tier = CAST(:computed_skill_tier AS public.skill_tier),
                    confidence = :confidence,
                    error_message = NULL,
                    updated_at = now()
                WHERE id = CAST(:assessment_id AS uuid)
                """
            ),
            {
                "assessment_id": assessment_id,
                "llm_raw_response": Jsonb(llm_raw_response),
                "normalized_result": Jsonb(normalized_result),
                "computed_elo": computed_elo,
                "computed_skill_tier": computed_tier,
                "confidence": confidence,
            },
        )

        _audit(
            connection,
            actor_user_id=player_user_id,
            event_type="video_assessment_analyzed",
            entity_type="video_assessment",
            entity_id=assessment_id,
            payload={
                "sport": sport,
                "computed_skill_tier": computed_tier,
                "confidence": confidence,
            },
        )
        _audit(
            connection,
            actor_user_id=player_user_id,
            event_type=(
                "elo_initialized_from_video"
                if is_initial_assessment
                else "elo_reassessed_from_video"
            ),
            entity_type="player_assessment" if is_initial_assessment else "video_assessment",
            entity_id=player_assessment_id if is_initial_assessment else assessment_id,
            payload={
                "video_assessment_id": assessment_id,
                "sport": sport,
                "computed_skill_tier": computed_tier,
                "delta": computed_elo - old_elo,
                "reason": reason,
            },
        )


def _fail_video_assessment(*, assessment_id: str, error_message: str) -> None:
    with get_engine().begin() as connection:
        row = connection.execute(
            text(
                """
                UPDATE public.video_assessments
                SET status = 'failed',
                    error_message = :error_message,
                    updated_at = now()
                WHERE id = CAST(:assessment_id AS uuid)
                RETURNING player_user_id
                """
            ),
            {"assessment_id": assessment_id, "error_message": error_message[:500]},
        ).first()
        if row is None:
            return
        _audit(
            connection,
            actor_user_id=str(row.player_user_id),
            event_type="video_assessment_failed",
            entity_type="video_assessment",
            entity_id=assessment_id,
            payload={"error_message": error_message[:240]},
        )


def analyze_video_assessment_job(*, assessment_id: str) -> None:
    job = _mark_video_assessment_analyzing(assessment_id=assessment_id)
    if job is None:
        return

    storage_path = _storage_path(str(job["storage_key"]))
    try:
        video_content = storage_path.read_bytes()
        llm_result, raw_response = _call_gemini_video_assessment(
            sport=str(job["sport"]),
            mime_type=str(job["mime_type"]),
            video_content=video_content,
        )
        normalized = normalize_llm_assessment_result(
            sport=str(job["sport"]),
            llm_result=llm_result,
        )
        _complete_video_assessment(
            assessment_id=assessment_id,
            llm_raw_response=raw_response,
            normalized_result=normalized,
        )
    except GeminiAssessmentError as exc:
        _fail_video_assessment(assessment_id=assessment_id, error_message=exc.message)
    except Exception:  # noqa: BLE001
        logger.exception("video_assessment_job_failed", extra={"assessment_id": assessment_id})
        _fail_video_assessment(
            assessment_id=assessment_id,
            error_message="Không phân tích được video. Vui lòng thử lại sau",
        )
    finally:
        storage_path.unlink(missing_ok=True)
