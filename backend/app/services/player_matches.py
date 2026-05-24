from __future__ import annotations

from typing import Any

from psycopg.types.json import Jsonb
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError
from app.db.session import get_engine

BASELINE_ELO = 1000
ELO_K_FACTOR = 28
MAX_ABS_ELO_DELTA = 45
FEEDBACK_BONUS_MULTIPLIER = 4
MATCH_ELO_ALGORITHM_VERSION = "match_feedback_v1"
ELIGIBLE_BOOKING_STATUSES = {"deposit_paid", "confirmed", "checked_in", "completed"}


def _tier_from_elo(elo_value: int) -> str:
    if elo_value < 1200:
        return "Beginner"
    if elo_value < 1550:
        return "Intermediate"
    return "Advanced"


def _clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))


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


def _match_row_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "session_id": str(row.session_id),
        "session_title": str(row.session_title),
        "status": str(row.status),
        "team_a_score": int(row.team_a_score) if row.team_a_score is not None else None,
        "team_b_score": int(row.team_b_score) if row.team_b_score is not None else None,
        "started_at": row.started_at,
        "ended_at": row.ended_at,
        "finalized_at": row.finalized_at,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _participant_row_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "match_id": str(row.match_id),
        "booking_id": str(row.booking_id) if row.booking_id else None,
        "player_user_id": str(row.player_user_id),
        "player_full_name": str(row.player_full_name) if row.player_full_name else None,
        "team_side": int(row.team_side),
        "result": str(row.result) if row.result else None,
        "created_at": row.created_at,
    }


def _feedback_row_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "match_id": str(row.match_id),
        "from_user_id": str(row.from_user_id),
        "from_user_name": str(row.from_user_name) if row.from_user_name else None,
        "to_user_id": str(row.to_user_id),
        "to_user_name": str(row.to_user_name) if row.to_user_name else None,
        "target_type": str(row.target_type),
        "rating": int(row.rating),
        "comment": str(row.comment) if row.comment else None,
        "created_at": row.created_at,
    }


def _load_session_for_match(connection: Any, *, session_id: str) -> Any:
    row = connection.execute(
        text(
            """
            SELECT id, title, status::text AS status, starts_at, now() AS current_time
            FROM public.sessions
            WHERE id = :session_id
            LIMIT 1
            """
        ),
        {"session_id": session_id},
    ).first()
    if row is None:
        raise AppError(
            status_code=404,
            code="session_not_found",
            message="Không tìm thấy session",
        )

    status = str(row.status)
    if status == "cancelled":
        raise AppError(
            status_code=409,
            code="session_cancelled",
            message="Session đã bị huỷ, không thể tạo match",
        )

    current_time = row.current_time
    if row.starts_at > current_time and status not in {"in_progress", "completed"}:
        raise AppError(
            status_code=409,
            code="session_not_played_yet",
            message="Session chưa diễn ra, chưa thể ghi nhận match",
        )

    return row


def _require_actor_booking(connection: Any, *, session_id: str, actor_user_id: str) -> None:
    row = connection.execute(
        text(
            """
            SELECT id
            FROM public.bookings
            WHERE session_id = :session_id
              AND player_user_id = :player_user_id
              AND status::text NOT IN ('cancelled', 'expired')
            LIMIT 1
            """
        ),
        {"session_id": session_id, "player_user_id": actor_user_id},
    ).first()
    if row is None:
        raise AppError(
            status_code=403,
            code="match_actor_forbidden",
            message="Bạn không thuộc session này nên không thể ghi nhận match",
        )


def _resolve_participants(
    connection: Any,
    *,
    session_id: str,
    participants: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    if participants:
        normalized: list[dict[str, Any]] = []
        seen_users: set[str] = set()
        for item in participants:
            player_user_id = str(item.get("player_user_id") or "").strip()
            booking_id = str(item.get("booking_id") or "").strip() or None
            team_side_raw = item.get("team_side")
            team_side = (
                team_side_raw
                if isinstance(team_side_raw, int) and not isinstance(team_side_raw, bool)
                else None
            )
            if not player_user_id or team_side not in {1, 2}:
                raise AppError(
                    status_code=422,
                    code="match_participants_invalid",
                    message="participants phải có player_user_id và team_side hợp lệ",
                )
            if player_user_id in seen_users:
                raise AppError(
                    status_code=422,
                    code="match_participants_duplicate",
                    message="participants bị trùng player_user_id",
                )
            seen_users.add(player_user_id)

            if booking_id:
                booking_row = connection.execute(
                    text(
                        """
                        SELECT id, player_user_id, status::text AS status
                        FROM public.bookings
                        WHERE id = :booking_id
                          AND session_id = :session_id
                        LIMIT 1
                        """
                    ),
                    {"booking_id": booking_id, "session_id": session_id},
                ).first()
            else:
                booking_row = connection.execute(
                    text(
                        """
                        SELECT id, player_user_id, status::text AS status
                        FROM public.bookings
                        WHERE session_id = :session_id
                          AND player_user_id = :player_user_id
                          AND status::text NOT IN ('cancelled', 'expired')
                        ORDER BY checked_in_at DESC NULLS LAST, created_at DESC
                        LIMIT 1
                        """
                    ),
                    {"session_id": session_id, "player_user_id": player_user_id},
                ).first()

            if booking_row is None:
                raise AppError(
                    status_code=422,
                    code="match_participant_booking_missing",
                    message="Không tìm thấy booking hợp lệ cho participant",
                )
            if str(booking_row.player_user_id) != player_user_id:
                raise AppError(
                    status_code=422,
                    code="match_participant_booking_owner_mismatch",
                    message="booking_id không thuộc về participant",
                )
            if str(booking_row.status) not in ELIGIBLE_BOOKING_STATUSES:
                raise AppError(
                    status_code=422,
                    code="match_participant_booking_status_invalid",
                    message="Participant cần booking đã thanh toán hoặc đã check-in",
                )

            normalized.append(
                {
                    "player_user_id": player_user_id,
                    "booking_id": str(booking_row.id),
                    "team_side": team_side,
                }
            )
    else:
        rows = connection.execute(
            text(
                """
                SELECT id, player_user_id
                FROM public.bookings
                WHERE session_id = :session_id
                  AND status::text IN ('deposit_paid', 'confirmed', 'checked_in', 'completed')
                ORDER BY checked_in_at DESC NULLS LAST, created_at ASC
                """
            ),
            {"session_id": session_id},
        ).all()
        normalized = []
        for index, row in enumerate(rows):
            normalized.append(
                {
                    "player_user_id": str(row.player_user_id),
                    "booking_id": str(row.id),
                    "team_side": 1 if index % 2 == 0 else 2,
                }
            )

    if len(normalized) < 2:
        raise AppError(
            status_code=422,
            code="match_participants_not_enough",
            message="Cần ít nhất 2 participant để tạo match",
        )

    teams = {item["team_side"] for item in normalized}
    if teams != {1, 2}:
        raise AppError(
            status_code=422,
            code="match_participants_team_invalid",
            message="Danh sách participant phải có đủ team 1 và team 2",
        )

    return normalized


def _list_participants(connection: Any, *, match_id: str) -> list[dict[str, Any]]:
    rows = connection.execute(
        text(
            """
            SELECT
              p.id,
              p.match_id,
              p.booking_id,
              p.player_user_id,
              u.full_name AS player_full_name,
              p.team_side,
              p.result::text AS result,
              p.created_at
            FROM public.match_participants p
            JOIN public.users u ON u.id = p.player_user_id
            WHERE p.match_id = :match_id
            ORDER BY p.team_side, p.created_at ASC
            """
        ),
        {"match_id": match_id},
    ).all()
    return [_participant_row_to_dict(row) for row in rows]


def _list_feedback(connection: Any, *, match_id: str) -> list[dict[str, Any]]:
    rows = connection.execute(
        text(
            """
            SELECT
              f.id,
              f.match_id,
              f.from_user_id,
              uf.full_name AS from_user_name,
              f.to_user_id,
              ut.full_name AS to_user_name,
              f.target_type::text AS target_type,
              f.rating,
              f.comment,
              f.created_at
            FROM public.match_feedback f
            JOIN public.users uf ON uf.id = f.from_user_id
            JOIN public.users ut ON ut.id = f.to_user_id
            WHERE f.match_id = :match_id
            ORDER BY f.created_at ASC
            """
        ),
        {"match_id": match_id},
    ).all()
    return [_feedback_row_to_dict(row) for row in rows]


def _get_match_header(connection: Any, *, match_id: str) -> dict[str, Any]:
    row = connection.execute(
        text(
            """
            SELECT
              m.id,
              m.session_id,
              s.title AS session_title,
              m.status::text AS status,
              m.team_a_score,
              m.team_b_score,
              m.started_at,
              m.ended_at,
              m.finalized_at,
              m.created_at,
              m.updated_at
            FROM public.match_events m
            JOIN public.sessions s ON s.id = m.session_id
            WHERE m.id = :match_id
            LIMIT 1
            """
        ),
        {"match_id": match_id},
    ).first()
    if row is None:
        raise AppError(
            status_code=404,
            code="match_not_found",
            message="Không tìm thấy match",
        )
    return _match_row_to_dict(row)


def _ensure_match_member(connection: Any, *, match_id: str, actor_user_id: str) -> None:
    row = connection.execute(
        text(
            """
            SELECT 1
            FROM public.match_participants
            WHERE match_id = :match_id
              AND player_user_id = :player_user_id
            LIMIT 1
            """
        ),
        {"match_id": match_id, "player_user_id": actor_user_id},
    ).first()
    if row is None:
        raise AppError(
            status_code=403,
            code="match_member_forbidden",
            message="Bạn không phải participant của match này",
        )


def create_match_event(*, actor_user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    session_id = str(data.get("session_id") or "").strip()
    if not session_id:
        raise AppError(
            status_code=422,
            code="match_session_required",
            message="session_id là bắt buộc",
        )

    team_a_score = data.get("team_a_score")
    team_b_score = data.get("team_b_score")
    if not isinstance(team_a_score, int) or not isinstance(team_b_score, int):
        raise AppError(
            status_code=422,
            code="match_scores_invalid",
            message="team_a_score và team_b_score phải là số nguyên >= 0",
        )
    if team_a_score < 0 or team_b_score < 0:
        raise AppError(
            status_code=422,
            code="match_scores_negative",
            message="Điểm số không được âm",
        )

    raw_participants = data.get("participants")
    if raw_participants is not None and not isinstance(raw_participants, list):
        raise AppError(
            status_code=422,
            code="match_participants_invalid",
            message="participants phải là mảng nếu được gửi lên",
        )
    participants_input = raw_participants if isinstance(raw_participants, list) else None

    with get_engine().begin() as connection:
        _load_session_for_match(connection, session_id=session_id)
        _require_actor_booking(connection, session_id=session_id, actor_user_id=actor_user_id)

        exists = connection.execute(
            text(
                """
                SELECT id
                FROM public.match_events
                WHERE session_id = :session_id
                LIMIT 1
                """
            ),
            {"session_id": session_id},
        ).first()
        if exists is not None:
            raise AppError(
                status_code=409,
                code="match_event_exists",
                message="Session này đã có match event",
            )

        resolved_participants = _resolve_participants(
            connection,
            session_id=session_id,
            participants=participants_input,
        )
        participant_user_ids = {
            participant["player_user_id"] for participant in resolved_participants
        }
        if actor_user_id not in participant_user_ids:
            raise AppError(
                status_code=403,
                code="match_actor_not_participant",
                message="Người ghi nhận match phải nằm trong danh sách participant",
            )

        match_row = connection.execute(
            text(
                """
                INSERT INTO public.match_events (
                  session_id,
                  status,
                  recorded_by_user_id,
                  team_a_score,
                  team_b_score,
                  started_at,
                  ended_at
                )
                VALUES (
                  :session_id,
                  CAST('pending' AS public.match_status),
                  :recorded_by_user_id,
                  :team_a_score,
                  :team_b_score,
                  :started_at,
                  :ended_at
                )
                RETURNING id
                """
            ),
            {
                "session_id": session_id,
                "recorded_by_user_id": actor_user_id,
                "team_a_score": team_a_score,
                "team_b_score": team_b_score,
                "started_at": data.get("started_at"),
                "ended_at": data.get("ended_at"),
            },
        ).one()

        for participant in resolved_participants:
            connection.execute(
                text(
                    """
                    INSERT INTO public.match_participants (
                      match_id,
                      booking_id,
                      player_user_id,
                      team_side
                    )
                    VALUES (
                      :match_id,
                      :booking_id,
                      :player_user_id,
                      :team_side
                    )
                    """
                ),
                {
                    "match_id": str(match_row.id),
                    "booking_id": participant["booking_id"],
                    "player_user_id": participant["player_user_id"],
                    "team_side": participant["team_side"],
                },
            )

        _audit(
            connection,
            actor_user_id=actor_user_id,
            event_type="match_event_created",
            entity_type="match_event",
            entity_id=str(match_row.id),
            payload={"session_id": session_id, "participants": len(resolved_participants)},
        )

        match_data = _get_match_header(connection, match_id=str(match_row.id))
        match_data["participants"] = _list_participants(connection, match_id=str(match_row.id))
        match_data["feedback"] = []
        return match_data


def get_match_event_detail(*, match_id: str, actor_user_id: str) -> dict[str, Any]:
    with get_engine().begin() as connection:
        match_data = _get_match_header(connection, match_id=match_id)
        _ensure_match_member(connection, match_id=match_id, actor_user_id=actor_user_id)
        match_data["participants"] = _list_participants(connection, match_id=match_id)
        match_data["feedback"] = _list_feedback(connection, match_id=match_id)
        return match_data


def submit_match_feedback(
    *, match_id: str, actor_user_id: str, data: dict[str, Any]
) -> dict[str, Any]:
    to_user_id = str(data.get("to_user_id") or "").strip()
    target_type = str(data.get("target_type") or "").strip()
    rating = data.get("rating")
    comment = data.get("comment")

    if not to_user_id:
        raise AppError(
            status_code=422,
            code="feedback_target_required",
            message="to_user_id là bắt buộc",
        )
    if target_type not in {"teammate", "opponent"}:
        raise AppError(
            status_code=422,
            code="feedback_target_type_invalid",
            message="target_type chỉ nhận teammate hoặc opponent",
        )
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        raise AppError(
            status_code=422,
            code="feedback_rating_invalid",
            message="rating phải nằm trong khoảng 1..5",
        )

    with get_engine().begin() as connection:
        match_status_row = connection.execute(
            text(
                """
                SELECT status::text AS status
                FROM public.match_events
                WHERE id = :match_id
                LIMIT 1
                """
            ),
            {"match_id": match_id},
        ).first()
        if match_status_row is None:
            raise AppError(
                status_code=404,
                code="match_not_found",
                message="Không tìm thấy match",
            )
        if str(match_status_row.status) == "void":
            raise AppError(
                status_code=409,
                code="match_void",
                message="Match đã bị huỷ, không thể feedback",
            )

        _ensure_match_member(connection, match_id=match_id, actor_user_id=actor_user_id)

        target_member = connection.execute(
            text(
                """
                SELECT 1
                FROM public.match_participants
                WHERE match_id = :match_id
                  AND player_user_id = :to_user_id
                LIMIT 1
                """
            ),
            {"match_id": match_id, "to_user_id": to_user_id},
        ).first()
        if target_member is None:
            raise AppError(
                status_code=422,
                code="feedback_target_not_participant",
                message="Người nhận feedback phải là participant của match",
            )

        try:
            row = connection.execute(
                text(
                    """
                    INSERT INTO public.match_feedback (
                      match_id,
                      from_user_id,
                      to_user_id,
                      target_type,
                      rating,
                      comment
                    )
                    VALUES (
                      :match_id,
                      :from_user_id,
                      :to_user_id,
                      CAST(:target_type AS public.feedback_target_type),
                      :rating,
                      :comment
                    )
                    RETURNING
                      id,
                      match_id,
                      from_user_id,
                      to_user_id,
                      target_type::text AS target_type,
                      rating,
                      comment,
                      created_at
                    """
                ),
                {
                    "match_id": match_id,
                    "from_user_id": actor_user_id,
                    "to_user_id": to_user_id,
                    "target_type": target_type,
                    "rating": rating,
                    "comment": (
                        str(comment).strip()
                        if isinstance(comment, str) and comment.strip()
                        else None
                    ),
                },
            ).one()
        except IntegrityError as exc:
            detail = str(exc.orig).lower() if exc.orig else ""
            if "match_id, from_user_id, to_user_id" in detail:
                raise AppError(
                    status_code=409,
                    code="feedback_duplicate",
                    message="Bạn đã feedback người này trong match hiện tại",
                ) from exc
            if "teammate feedback requires same team_side" in detail:
                raise AppError(
                    status_code=422,
                    code="feedback_target_team_mismatch",
                    message="Feedback teammate yêu cầu cùng team",
                ) from exc
            if "opponent feedback requires different team_side" in detail:
                raise AppError(
                    status_code=422,
                    code="feedback_target_team_mismatch",
                    message="Feedback opponent yêu cầu khác team",
                ) from exc
            if "cannot feedback to self" in detail:
                raise AppError(
                    status_code=422,
                    code="feedback_self_forbidden",
                    message="Không thể feedback chính mình",
                ) from exc
            raise AppError(
                status_code=422,
                code="feedback_invalid",
                message="Feedback không hợp lệ",
            ) from exc

        _audit(
            connection,
            actor_user_id=actor_user_id,
            event_type="match_feedback_submitted",
            entity_type="match_feedback",
            entity_id=str(row.id),
            payload={"match_id": match_id, "target_type": target_type, "rating": rating},
        )

        user_names = connection.execute(
            text(
                """
                SELECT id, full_name
                FROM public.users
                WHERE id IN (:from_user_id, :to_user_id)
                """
            ),
            {"from_user_id": actor_user_id, "to_user_id": to_user_id},
        ).all()
        full_name_by_id = {str(item.id): str(item.full_name) for item in user_names}

        return {
            "id": str(row.id),
            "match_id": str(row.match_id),
            "from_user_id": str(row.from_user_id),
            "from_user_name": full_name_by_id.get(str(row.from_user_id)),
            "to_user_id": str(row.to_user_id),
            "to_user_name": full_name_by_id.get(str(row.to_user_id)),
            "target_type": str(row.target_type),
            "rating": int(row.rating),
            "comment": str(row.comment) if row.comment else None,
            "created_at": row.created_at,
        }


def finalize_match_event(*, match_id: str, actor_user_id: str) -> dict[str, Any]:
    with get_engine().begin() as connection:
        match_row = connection.execute(
            text(
                """
                SELECT
                  id,
                  status::text AS status,
                  team_a_score,
                  team_b_score
                FROM public.match_events
                WHERE id = :match_id
                FOR UPDATE
                """
            ),
            {"match_id": match_id},
        ).first()
        if match_row is None:
            raise AppError(
                status_code=404,
                code="match_not_found",
                message="Không tìm thấy match",
            )
        if str(match_row.status) == "finalized":
            raise AppError(
                status_code=409,
                code="match_already_finalized",
                message="Match đã finalize",
            )
        if match_row.team_a_score is None or match_row.team_b_score is None:
            raise AppError(
                status_code=422,
                code="match_scores_missing",
                message="Match chưa có điểm số để finalize",
            )

        _ensure_match_member(connection, match_id=match_id, actor_user_id=actor_user_id)

        participant_rows = connection.execute(
            text(
                """
                SELECT
                  p.id,
                  p.player_user_id,
                  p.team_side,
                  u.full_name
                FROM public.match_participants p
                JOIN public.users u ON u.id = p.player_user_id
                WHERE p.match_id = :match_id
                ORDER BY p.team_side, p.created_at ASC
                """
            ),
            {"match_id": match_id},
        ).all()

        if len(participant_rows) < 2:
            raise AppError(
                status_code=422,
                code="match_participants_not_enough",
                message="Match cần tối thiểu 2 participant để finalize",
            )

        team_to_players: dict[int, list[str]] = {1: [], 2: []}
        for row in participant_rows:
            team_to_players[int(row.team_side)].append(str(row.player_user_id))
        if not team_to_players[1] or not team_to_players[2]:
            raise AppError(
                status_code=422,
                code="match_participants_team_invalid",
                message="Match cần đủ participant ở cả team 1 và team 2",
            )

        team_a_score = int(match_row.team_a_score)
        team_b_score = int(match_row.team_b_score)
        if team_a_score > team_b_score:
            team_result = {1: "win", 2: "loss"}
            actual_a = 1.0
        elif team_a_score < team_b_score:
            team_result = {1: "loss", 2: "win"}
            actual_a = 0.0
        else:
            team_result = {1: "draw", 2: "draw"}
            actual_a = 0.5

        feedback_rows = connection.execute(
            text(
                """
                SELECT
                  to_user_id,
                  count(*)::int AS feedback_count,
                  avg(rating)::float AS feedback_avg
                FROM public.match_feedback
                WHERE match_id = :match_id
                GROUP BY to_user_id
                """
            ),
            {"match_id": match_id},
        ).all()
        feedback_summary: dict[str, tuple[int, float]] = {}
        for row in feedback_rows:
            feedback_summary[str(row.to_user_id)] = (
                int(row.feedback_count),
                float(row.feedback_avg),
            )

        player_ids = [str(row.player_user_id) for row in participant_rows]
        rating_rows = connection.execute(
            text(
                """
                SELECT
                  player_user_id,
                  elo_value,
                  matches_played,
                  wins,
                  losses,
                  draws
                FROM public.elo_ratings
                WHERE player_user_id = ANY(CAST(:player_ids AS uuid[]))
                """
            ),
            {"player_ids": player_ids},
        ).all()
        existing_rating_map = {
            str(row.player_user_id): {
                "elo": int(row.elo_value),
                "matches_played": int(row.matches_played),
                "wins": int(row.wins),
                "losses": int(row.losses),
                "draws": int(row.draws),
            }
            for row in rating_rows
        }

        old_elo_map: dict[str, int] = {}
        for participant in participant_rows:
            player_id = str(participant.player_user_id)
            old_elo_map[player_id] = existing_rating_map.get(player_id, {}).get("elo", BASELINE_ELO)

        team_a_avg_elo = sum(old_elo_map[player] for player in team_to_players[1]) / len(
            team_to_players[1]
        )
        team_b_avg_elo = sum(old_elo_map[player] for player in team_to_players[2]) / len(
            team_to_players[2]
        )

        expected_a = 1.0 / (1.0 + (10 ** ((team_b_avg_elo - team_a_avg_elo) / 400.0)))
        expected_b = 1.0 - expected_a
        actual_b = 1.0 - actual_a

        team_delta = {
            1: int(round(ELO_K_FACTOR * (actual_a - expected_a))),
            2: int(round(ELO_K_FACTOR * (actual_b - expected_b))),
        }

        elo_updates: list[dict[str, Any]] = []
        for participant in participant_rows:
            player_id = str(participant.player_user_id)
            team_side = int(participant.team_side)
            result = team_result[team_side]
            old_elo = old_elo_map[player_id]
            feedback_count, feedback_avg = feedback_summary.get(player_id, (0, 0.0))
            feedback_bonus = 0
            if feedback_count > 0:
                feedback_bonus = int(round((feedback_avg - 3.0) * FEEDBACK_BONUS_MULTIPLIER))

            raw_delta = team_delta[team_side] + feedback_bonus
            elo_delta = _clamp(raw_delta, -MAX_ABS_ELO_DELTA, MAX_ABS_ELO_DELTA)
            new_elo = _clamp(old_elo + elo_delta, 100, 5000)

            previous_stats = existing_rating_map.get(
                player_id,
                {
                    "matches_played": 0,
                    "wins": 0,
                    "losses": 0,
                    "draws": 0,
                },
            )
            next_matches = int(previous_stats["matches_played"]) + 1
            next_wins = int(previous_stats["wins"]) + (1 if result == "win" else 0)
            next_losses = int(previous_stats["losses"]) + (1 if result == "loss" else 0)
            next_draws = int(previous_stats["draws"]) + (1 if result == "draw" else 0)

            next_tier = _tier_from_elo(new_elo)

            connection.execute(
                text(
                    """
                    INSERT INTO public.elo_ratings (
                      player_user_id,
                      elo_value,
                      visible_skill_tier,
                      matches_played,
                      wins,
                      losses,
                      draws
                    )
                    VALUES (
                      :player_user_id,
                      :elo_value,
                      CAST(:visible_skill_tier AS public.skill_tier),
                      :matches_played,
                      :wins,
                      :losses,
                      :draws
                    )
                    ON CONFLICT (player_user_id)
                    DO UPDATE SET
                      elo_value = EXCLUDED.elo_value,
                      visible_skill_tier = EXCLUDED.visible_skill_tier,
                      matches_played = EXCLUDED.matches_played,
                      wins = EXCLUDED.wins,
                      losses = EXCLUDED.losses,
                      draws = EXCLUDED.draws,
                      updated_at = now()
                    """
                ),
                {
                    "player_user_id": player_id,
                    "elo_value": new_elo,
                    "visible_skill_tier": next_tier,
                    "matches_played": next_matches,
                    "wins": next_wins,
                    "losses": next_losses,
                    "draws": next_draws,
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
                      :match_id,
                      :old_elo,
                      :new_elo,
                      :delta,
                      :reason,
                      :algorithm_version
                    )
                    """
                ),
                {
                    "player_user_id": player_id,
                    "match_id": match_id,
                    "old_elo": old_elo,
                    "new_elo": new_elo,
                    "delta": new_elo - old_elo,
                    "reason": f"match_finalize:{match_id}:{team_a_score}-{team_b_score}",
                    "algorithm_version": MATCH_ELO_ALGORITHM_VERSION,
                },
            )

            elo_updates.append(
                {
                    "player_user_id": player_id,
                    "player_full_name": str(participant.full_name),
                    "team_side": team_side,
                    "result": result,
                    "old_elo": old_elo,
                    "new_elo": new_elo,
                    "delta": new_elo - old_elo,
                    "skill_tier_before": _tier_from_elo(old_elo),
                    "skill_tier_after": next_tier,
                    "feedback_received_count": feedback_count,
                    "feedback_received_avg": round(feedback_avg, 2) if feedback_count > 0 else None,
                }
            )

        for participant in participant_rows:
            player_id = str(participant.player_user_id)
            connection.execute(
                text(
                    """
                    UPDATE public.match_participants
                    SET result = CAST(:result AS public.match_result)
                    WHERE id = :id
                    """
                ),
                {
                    "id": str(participant.id),
                    "result": team_result[int(participant.team_side)],
                },
            )

        connection.execute(
            text(
                """
                UPDATE public.match_events
                SET status = CAST('finalized' AS public.match_status),
                    finalized_at = now(),
                    ended_at = COALESCE(ended_at, now()),
                    recorded_by_user_id = :recorded_by_user_id,
                    updated_at = now()
                WHERE id = :match_id
                """
            ),
            {"match_id": match_id, "recorded_by_user_id": actor_user_id},
        )

        _audit(
            connection,
            actor_user_id=actor_user_id,
            event_type="match_event_finalized",
            entity_type="match_event",
            entity_id=match_id,
            payload={"team_a_score": team_a_score, "team_b_score": team_b_score},
        )

        match_data = _get_match_header(connection, match_id=match_id)
        match_data["participants"] = _list_participants(connection, match_id=match_id)
        match_data["feedback"] = _list_feedback(connection, match_id=match_id)
        return {"match": match_data, "elo_updates": elo_updates}


def list_player_match_history(*, player_user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    capped_limit = max(1, min(limit, 200))
    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                """
                SELECT
                  m.id AS match_id,
                  m.session_id,
                  s.title AS session_title,
                  m.status::text AS status,
                  m.team_a_score,
                  m.team_b_score,
                  m.finalized_at,
                  m.created_at,
                  mp.team_side,
                  mp.result::text AS my_result,
                  COALESCE(fg.feedback_given_count, 0) AS feedback_given_count,
                  COALESCE(fr.feedback_received_count, 0) AS feedback_received_count,
                  fr.feedback_received_avg,
                  eh.old_elo,
                  eh.new_elo,
                  eh.delta
                FROM public.match_participants mp
                JOIN public.match_events m ON m.id = mp.match_id
                JOIN public.sessions s ON s.id = m.session_id
                LEFT JOIN LATERAL (
                  SELECT count(*)::int AS feedback_given_count
                  FROM public.match_feedback f
                  WHERE f.match_id = m.id
                    AND f.from_user_id = :player_user_id
                ) fg ON TRUE
                LEFT JOIN LATERAL (
                  SELECT
                    count(*)::int AS feedback_received_count,
                    avg(rating)::float AS feedback_received_avg
                  FROM public.match_feedback f
                  WHERE f.match_id = m.id
                    AND f.to_user_id = :player_user_id
                ) fr ON TRUE
                LEFT JOIN LATERAL (
                  SELECT old_elo, new_elo, delta
                  FROM public.elo_rating_history eh
                  WHERE eh.match_id = m.id
                    AND eh.player_user_id = :player_user_id
                  ORDER BY eh.created_at DESC
                  LIMIT 1
                ) eh ON TRUE
                WHERE mp.player_user_id = :player_user_id
                ORDER BY COALESCE(m.finalized_at, m.created_at) DESC
                LIMIT :limit
                """
            ),
            {"player_user_id": player_user_id, "limit": capped_limit},
        ).all()

    history: list[dict[str, Any]] = []
    for row in rows:
        old_elo = int(row.old_elo) if row.old_elo is not None else None
        new_elo = int(row.new_elo) if row.new_elo is not None else None
        history.append(
            {
                "match_id": str(row.match_id),
                "session_id": str(row.session_id),
                "session_title": str(row.session_title),
                "status": str(row.status),
                "team_a_score": int(row.team_a_score) if row.team_a_score is not None else None,
                "team_b_score": int(row.team_b_score) if row.team_b_score is not None else None,
                "finalized_at": row.finalized_at,
                "created_at": row.created_at,
                "my_team_side": int(row.team_side),
                "my_result": str(row.my_result) if row.my_result else None,
                "feedback_given_count": int(row.feedback_given_count),
                "feedback_received_count": int(row.feedback_received_count),
                "feedback_received_avg": (
                    round(float(row.feedback_received_avg), 2)
                    if row.feedback_received_avg is not None
                    else None
                ),
                "elo_delta": int(row.delta) if row.delta is not None else None,
                "skill_tier_before": _tier_from_elo(old_elo) if old_elo is not None else None,
                "skill_tier_after": _tier_from_elo(new_elo) if new_elo is not None else None,
            }
        )
    return history
