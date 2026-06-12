from __future__ import annotations

from typing import Any

from sqlalchemy import text

from app.core.errors import AppError
from app.db.session import get_engine


def _profile_from_row(row: Any, *, include_private: bool) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "email": str(row.email) if include_private else None,
        "full_name": str(row.full_name),
        "avatar_url": str(row.avatar_url) if row.avatar_url else None,
        "phone": str(row.phone) if include_private and row.phone else None,
        "city": str(row.city) if row.city else None,
        "district": str(row.district) if row.district else None,
        "visible_skill_tier": str(row.visible_skill_tier)
        if row.visible_skill_tier
        else "Beginner",
        "elo_value": int(row.elo_value) if row.elo_value is not None else 1000,
        "matches_played": int(row.matches_played or 0),
        "wins": int(row.wins or 0),
        "losses": int(row.losses or 0),
        "draws": int(row.draws or 0),
        "has_assessment": bool(row.has_assessment),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _profile_query(where_clause: str) -> str:
    return f"""
        SELECT
          u.id,
          u.email,
          u.full_name,
          u.avatar_url,
          u.phone,
          u.city,
          u.district,
          u.created_at,
          u.updated_at,
          er.visible_skill_tier::text AS visible_skill_tier,
          er.elo_value,
          er.matches_played,
          er.wins,
          er.losses,
          er.draws,
          EXISTS (
            SELECT 1
            FROM public.player_assessments pa
            WHERE pa.player_user_id = u.id
          ) AS has_assessment
        FROM public.users u
        LEFT JOIN public.elo_ratings er ON er.player_user_id = u.id
        {where_clause}
    """


def get_player_profile(*, viewer_user_id: str, player_user_id: str) -> dict[str, Any]:
    include_private = viewer_user_id == player_user_id
    with get_engine().begin() as connection:
        row = connection.execute(
            text(
                _profile_query(
                    """
                    WHERE u.id = :player_user_id
                      AND u.is_active = true
                    LIMIT 1
                    """
                )
            ),
            {"player_user_id": player_user_id},
        ).first()

    if row is None:
        raise AppError(
            status_code=404,
            code="player_profile_not_found",
            message="Không tìm thấy hồ sơ người chơi",
        )
    return _profile_from_row(row, include_private=include_private)


def update_my_player_profile(*, player_user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    full_name = str(data.get("full_name") or "").strip()
    phone = str(data.get("phone") or "").strip() or None
    city = str(data.get("city") or "").strip() or None
    district = str(data.get("district") or "").strip() or None
    avatar_url = str(data.get("avatar_url") or "").strip() or None

    if not full_name or len(full_name) < 2:
        raise AppError(
            status_code=422,
            code="profile_full_name_invalid",
            message="Họ tên người chơi quá ngắn",
        )
    if phone and len(phone) > 40:
        raise AppError(
            status_code=422,
            code="profile_phone_invalid",
            message="Số điện thoại quá dài",
        )

    with get_engine().begin() as connection:
        row = connection.execute(
            text(
                """
                UPDATE public.users
                SET full_name = :full_name,
                    phone = :phone,
                    city = :city,
                    district = :district,
                    avatar_url = :avatar_url,
                    updated_at = now()
                WHERE id = :player_user_id
                  AND is_active = true
                RETURNING id
                """
            ),
            {
                "player_user_id": player_user_id,
                "full_name": full_name,
                "phone": phone,
                "city": city,
                "district": district,
                "avatar_url": avatar_url,
            },
        ).first()
        if row is None:
            raise AppError(
                status_code=404,
                code="player_profile_not_found",
                message="Không tìm thấy hồ sơ người chơi",
            )

        profile_row = connection.execute(
            text(
                _profile_query(
                    """
                    WHERE u.id = :player_user_id
                    LIMIT 1
                    """
                )
            ),
            {"player_user_id": player_user_id},
        ).one()

    return _profile_from_row(profile_row, include_private=True)
