from __future__ import annotations

from datetime import date, datetime
from typing import Any

from psycopg.types.json import Jsonb
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError
from app.db.session import get_engine

TOURNAMENT_STATUSES = {"upcoming", "ongoing", "completed"}
TOURNAMENT_LEVELS = {"movement", "semi_pro", "pro"}
ACTIVE_REGISTRATION_STATUSES = {"pending", "registered"}
REVIEWABLE_REGISTRATION_STATUSES = {"registered", "cancelled"}


def _display_date(value: date) -> str:
    return value.strftime("%d/%m/%Y")


def _parse_display_date(value: str, *, field: str) -> date:
    candidate = str(value or "").strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(candidate, fmt).date()
        except ValueError:
            continue
    raise AppError(
        status_code=422,
        code="tournament_date_invalid",
        message=f"{field} phải có định dạng DD/MM/YYYY hoặc YYYY-MM-DD",
    )


def _default_bracket() -> list[dict[str, Any]]:
    return [
        {
            "roundName": "Bán kết",
            "matches": [
                {"id": "semi-1", "teamA": "Chờ xác định", "teamB": "Chờ xác định"},
                {"id": "semi-2", "teamA": "Chờ xác định", "teamB": "Chờ xác định"},
            ],
        },
        {
            "roundName": "Chung kết",
            "matches": [
                {"id": "final-1", "teamA": "Thắng Bán kết 1", "teamB": "Thắng Bán kết 2"}
            ],
        },
    ]


def _player_profile_from_registration_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.player_user_id),
        "full_name": str(row.full_name),
        "avatar_url": str(row.avatar_url) if row.avatar_url else None,
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
    }


def _public_registration_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "status": str(row.status),
        "teamName": str(row.team_name),
        "player1": str(row.player1_name),
        "player2": str(row.player2_name) if row.player2_name else None,
        "createdAt": row.created_at,
        "profile": _player_profile_from_registration_row(row),
    }


def _admin_registration_from_row(row: Any) -> dict[str, Any]:
    return {
        **_public_registration_from_row(row),
        "tournamentId": str(row.tournament_id),
        "tournamentTitle": str(row.tournament_title),
        "contactPhone": str(row.contact_phone),
        "contactEmail": str(row.contact_email),
        "reviewedAt": row.reviewed_at,
        "reviewNote": str(row.review_note) if row.review_note else None,
    }


def _my_registration_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "tournamentId": str(row.tournament_id),
        "status": str(row.status),
        "teamName": str(row.team_name),
        "createdAt": row.created_at,
    }


def _tournament_from_row(row: Any) -> dict[str, Any]:
    bracket = row.bracket or []
    return {
        "id": str(row.id),
        "title": str(row.title),
        "sport": str(row.sport),
        "status": str(row.status),
        "startDate": _display_date(row.start_date),
        "endDate": _display_date(row.end_date),
        "location": str(row.location),
        "joinedTeams": int(row.joined_teams or 0),
        "maxTeams": int(row.max_teams),
        "prizeMoney": int(row.prize_money_vnd),
        "image": str(row.banner_url),
        "level": str(row.level),
        "fee": int(row.fee_vnd),
        "description": str(row.description),
        "bracket": list(bracket) if isinstance(bracket, list) else [],
        "registrations": [],
    }


def _select_tournaments(where_clause: str = "") -> str:
    return f"""
        SELECT
          t.id,
          t.title,
          t.sport,
          t.status,
          t.start_date,
          t.end_date,
          t.location,
          t.max_teams,
          t.prize_money_vnd,
          t.banner_url,
          t.level,
          t.fee_vnd,
          t.description,
          t.bracket,
          COUNT(tr.id) FILTER (WHERE tr.status IN ('pending', 'registered')) AS joined_teams
        FROM public.tournaments t
        LEFT JOIN public.tournament_registrations tr ON tr.tournament_id = t.id
        {where_clause}
        GROUP BY t.id
        ORDER BY t.start_date DESC, t.created_at DESC
    """


def _attach_tournament_registrations(
    connection: Any, tournaments: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    if not tournaments:
        return tournaments

    tournament_ids = [item["id"] for item in tournaments]
    rows = connection.execute(
        text(
            """
            SELECT
              tr.id,
              tr.tournament_id,
              tr.player_user_id,
              tr.team_name,
              tr.player1_name,
              tr.player2_name,
              tr.status,
              tr.created_at,
              u.full_name,
              u.avatar_url,
              u.city,
              u.district,
              er.visible_skill_tier::text AS visible_skill_tier,
              er.elo_value,
              er.matches_played,
              er.wins,
              er.losses,
              er.draws
            FROM public.tournament_registrations tr
            JOIN public.users u ON u.id = tr.player_user_id
            LEFT JOIN public.elo_ratings er ON er.player_user_id = u.id
            WHERE tr.tournament_id = ANY(CAST(:tournament_ids AS uuid[]))
              AND tr.status IN ('pending', 'registered')
            ORDER BY tr.created_at ASC
            """
        ),
        {"tournament_ids": tournament_ids},
    ).all()
    by_tournament: dict[str, list[dict[str, Any]]] = {item["id"]: [] for item in tournaments}
    for row in rows:
        by_tournament.setdefault(str(row.tournament_id), []).append(
            _public_registration_from_row(row)
        )

    for tournament in tournaments:
        tournament["registrations"] = by_tournament.get(tournament["id"], [])
    return tournaments


def _get_tournament(connection: Any, *, tournament_id: str) -> dict[str, Any]:
    row = connection.execute(
        text(_select_tournaments("WHERE t.id = :tournament_id")),
        {"tournament_id": tournament_id},
    ).first()
    if row is None:
        raise AppError(
            status_code=404,
            code="tournament_not_found",
            message="Không tìm thấy giải đấu",
        )
    tournament = _tournament_from_row(row)
    return _attach_tournament_registrations(connection, [tournament])[0]


def list_tournaments() -> list[dict[str, Any]]:
    with get_engine().begin() as connection:
        rows = connection.execute(text(_select_tournaments())).all()
        tournaments = [_tournament_from_row(row) for row in rows]
        return _attach_tournament_registrations(connection, tournaments)


def list_my_tournament_registration_ids(*, player_user_id: str) -> list[str]:
    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                """
                SELECT tournament_id
                FROM public.tournament_registrations
                WHERE player_user_id = :player_user_id
                  AND status IN ('pending', 'registered')
                ORDER BY created_at DESC
                """
            ),
            {"player_user_id": player_user_id},
        ).all()
    return [str(row.tournament_id) for row in rows]


def list_my_tournament_registrations(*, player_user_id: str) -> list[dict[str, Any]]:
    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                """
                SELECT id, tournament_id, status, team_name, created_at
                FROM public.tournament_registrations
                WHERE player_user_id = :player_user_id
                  AND status IN ('pending', 'registered')
                ORDER BY created_at DESC
                """
            ),
            {"player_user_id": player_user_id},
        ).all()
    return [_my_registration_from_row(row) for row in rows]


def create_tournament(*, actor_user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    title = str(data.get("title") or "").strip()
    sport = str(data.get("sport") or "").strip()
    location = str(data.get("location") or "").strip()
    description = str(data.get("description") or "").strip()
    image = str(data.get("image") or "").strip()
    level = str(data.get("level") or "movement").strip()
    start_date = _parse_display_date(str(data.get("startDate") or ""), field="startDate")
    end_date = _parse_display_date(str(data.get("endDate") or ""), field="endDate")

    if not title or len(title) < 2:
        raise AppError(
            status_code=422,
            code="tournament_title_invalid",
            message="Tên giải đấu quá ngắn",
        )
    if not sport:
        raise AppError(
            status_code=422,
            code="tournament_sport_required",
            message="Thiếu môn thể thao",
        )
    if not location:
        raise AppError(
            status_code=422,
            code="tournament_location_required",
            message="Thiếu địa điểm",
        )
    if end_date < start_date:
        raise AppError(
            status_code=422,
            code="tournament_date_range_invalid",
            message="Ngày kết thúc không được trước ngày bắt đầu",
        )
    if level not in TOURNAMENT_LEVELS:
        raise AppError(
            status_code=422,
            code="tournament_level_invalid",
            message="Cấp độ giải không hợp lệ",
        )

    max_teams = int(data.get("maxTeams") or 0)
    prize_money = int(data.get("prizeMoney") or 0)
    fee = int(data.get("fee") or 0)
    if max_teams <= 0:
        raise AppError(
            status_code=422,
            code="tournament_max_teams_invalid",
            message="Số đội tối đa không hợp lệ",
        )
    if prize_money < 0 or fee < 0:
        raise AppError(
            status_code=422,
            code="tournament_money_invalid",
            message="Số tiền không hợp lệ",
        )
    if not image:
        image = "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&fit=crop&q=80"
    if not description:
        description = f"Giải đấu giao lưu môn {sport} trên NetUp."

    bracket = data.get("bracket")
    if not isinstance(bracket, list) or not bracket:
        bracket = _default_bracket()

    with get_engine().begin() as connection:
        row = connection.execute(
            text(
                """
                INSERT INTO public.tournaments (
                  created_by_user_id,
                  title,
                  sport,
                  status,
                  start_date,
                  end_date,
                  location,
                  max_teams,
                  prize_money_vnd,
                  banner_url,
                  level,
                  fee_vnd,
                  description,
                  bracket
                )
                VALUES (
                  :created_by_user_id,
                  :title,
                  :sport,
                  'upcoming',
                  :start_date,
                  :end_date,
                  :location,
                  :max_teams,
                  :prize_money_vnd,
                  :banner_url,
                  :level,
                  :fee_vnd,
                  :description,
                  :bracket
                )
                RETURNING id
                """
            ),
            {
                "created_by_user_id": actor_user_id,
                "title": title,
                "sport": sport,
                "start_date": start_date,
                "end_date": end_date,
                "location": location,
                "max_teams": max_teams,
                "prize_money_vnd": prize_money,
                "banner_url": image,
                "level": level,
                "fee_vnd": fee,
                "description": description,
                "bracket": Jsonb(bracket),
            },
        ).first()
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
                VALUES (
                  :actor_user_id,
                  'tournament_created',
                  'tournament',
                  :entity_id,
                  :payload
                )
                """
            ),
            {
                "actor_user_id": actor_user_id,
                "entity_id": str(row.id),
                "payload": Jsonb({"title": title, "sport": sport, "max_teams": max_teams}),
            },
        )
        return _get_tournament(connection, tournament_id=str(row.id))


def register_for_tournament(
    *, tournament_id: str, player_user_id: str, data: dict[str, Any]
) -> dict[str, Any]:
    team_name = str(data.get("teamName") or "").strip()
    player1 = str(data.get("player1") or "").strip()
    player2 = str(data.get("player2") or "").strip() or None
    phone = str(data.get("phone") or "").strip()
    email = str(data.get("email") or "").strip()

    if not team_name:
        raise AppError(status_code=422, code="team_name_required", message="Vui lòng nhập tên đội")
    if not player1:
        raise AppError(
            status_code=422,
            code="player1_required",
            message="Vui lòng nhập thành viên 1",
        )
    if not phone:
        raise AppError(
            status_code=422,
            code="phone_required",
            message="Vui lòng nhập số điện thoại",
        )
    if not email:
        raise AppError(status_code=422, code="email_required", message="Vui lòng nhập email")

    try:
        with get_engine().begin() as connection:
            row = connection.execute(
                text(
                    """
                    SELECT
                      t.id,
                      t.status,
                      t.max_teams
                    FROM public.tournaments t
                    WHERE t.id = :tournament_id
                    FOR UPDATE OF t
                    """
                ),
                {"tournament_id": tournament_id},
            ).first()
            if row is None:
                raise AppError(
                    status_code=404,
                    code="tournament_not_found",
                    message="Không tìm thấy giải đấu",
                )
            if str(row.status) != "upcoming":
                raise AppError(
                    status_code=409,
                    code="tournament_registration_closed",
                    message="Giải đấu đã đóng đăng ký",
                )
            joined_row = connection.execute(
                text(
                    """
                    SELECT COUNT(*) AS joined_teams
                    FROM public.tournament_registrations
                    WHERE tournament_id = :tournament_id
                      AND status IN ('pending', 'registered')
                    """
                ),
                {"tournament_id": tournament_id},
            ).first()
            joined_teams = int(joined_row.joined_teams if joined_row else 0)
            if joined_teams >= int(row.max_teams):
                raise AppError(
                    status_code=409,
                    code="tournament_full",
                    message="Giải đấu đã đủ số đội",
                )

            connection.execute(
                text(
                    """
                    INSERT INTO public.tournament_registrations (
                      tournament_id,
                      player_user_id,
                      team_name,
                      player1_name,
                      player2_name,
                      contact_phone,
                      contact_email,
                      status
                    )
                    VALUES (
                      :tournament_id,
                      :player_user_id,
                      :team_name,
                      :player1_name,
                      :player2_name,
                      :contact_phone,
                      :contact_email,
                      'pending'
                    )
                    """
                ),
                {
                    "tournament_id": tournament_id,
                    "player_user_id": player_user_id,
                    "team_name": team_name,
                    "player1_name": player1,
                    "player2_name": player2,
                    "contact_phone": phone,
                    "contact_email": email,
                },
            )
            return _get_tournament(connection, tournament_id=tournament_id)
    except IntegrityError as exc:
        raise AppError(
            status_code=409,
            code="tournament_already_registered",
            message="Bạn đã gửi đơn đăng ký giải đấu này",
        ) from exc


def list_tournament_registrations_for_admin(
    *, status: str | None = None, tournament_id: str | None = None
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {}
    where_parts: list[str] = []
    if status:
        if status not in {"pending", "registered", "cancelled"}:
            raise AppError(
                status_code=422,
                code="tournament_registration_status_invalid",
                message="Trạng thái đơn đăng ký không hợp lệ",
            )
        where_parts.append("tr.status = :status")
        params["status"] = status
    if tournament_id:
        where_parts.append("tr.tournament_id = :tournament_id")
        params["tournament_id"] = tournament_id

    where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                f"""
                SELECT
                  tr.id,
                  tr.tournament_id,
                  tr.player_user_id,
                  tr.team_name,
                  tr.player1_name,
                  tr.player2_name,
                  tr.contact_phone,
                  tr.contact_email,
                  tr.status,
                  tr.created_at,
                  tr.reviewed_at,
                  tr.review_note,
                  t.title AS tournament_title,
                  u.full_name,
                  u.avatar_url,
                  u.city,
                  u.district,
                  er.visible_skill_tier::text AS visible_skill_tier,
                  er.elo_value,
                  er.matches_played,
                  er.wins,
                  er.losses,
                  er.draws
                FROM public.tournament_registrations tr
                JOIN public.tournaments t ON t.id = tr.tournament_id
                JOIN public.users u ON u.id = tr.player_user_id
                LEFT JOIN public.elo_ratings er ON er.player_user_id = u.id
                {where_clause}
                ORDER BY
                  CASE tr.status
                    WHEN 'pending' THEN 0
                    WHEN 'registered' THEN 1
                    ELSE 2
                  END,
                  tr.created_at DESC
                LIMIT 500
                """
            ),
            params,
        ).all()
    return [_admin_registration_from_row(row) for row in rows]


def review_tournament_registration(
    *,
    actor_user_id: str,
    registration_id: str,
    status: str,
    review_note: str | None = None,
) -> dict[str, Any]:
    if status not in REVIEWABLE_REGISTRATION_STATUSES:
        raise AppError(
            status_code=422,
            code="tournament_registration_review_status_invalid",
            message="Admin chỉ có thể duyệt hoặc hủy đơn đăng ký",
        )

    note = str(review_note or "").strip() or None
    with get_engine().begin() as connection:
        current = connection.execute(
            text(
                """
                SELECT
                  tr.id,
                  tr.tournament_id,
                  tr.status,
                  t.max_teams
                FROM public.tournament_registrations tr
                JOIN public.tournaments t ON t.id = tr.tournament_id
                WHERE tr.id = :registration_id
                FOR UPDATE OF tr
                """
            ),
            {"registration_id": registration_id},
        ).first()
        if current is None:
            raise AppError(
                status_code=404,
                code="tournament_registration_not_found",
                message="Không tìm thấy đơn đăng ký giải đấu",
            )

        if status == "registered":
            active_row = connection.execute(
                text(
                    """
                    SELECT COUNT(*) AS active_teams
                    FROM public.tournament_registrations
                    WHERE tournament_id = :tournament_id
                      AND status IN ('pending', 'registered')
                    """
                ),
                {"tournament_id": str(current.tournament_id)},
            ).first()
            active_teams = int(active_row.active_teams if active_row else 0)
            current_is_active = str(current.status) in ACTIVE_REGISTRATION_STATUSES
            would_exceed_capacity = (
                active_teams > int(current.max_teams)
                if current_is_active
                else active_teams >= int(current.max_teams)
            )
            if would_exceed_capacity:
                raise AppError(
                    status_code=409,
                    code="tournament_full",
                    message="Giải đấu đã đủ số đội tối đa",
                )

        connection.execute(
            text(
                """
                UPDATE public.tournament_registrations
                SET status = :status,
                    reviewed_by_user_id = :reviewed_by_user_id,
                    reviewed_at = now(),
                    review_note = :review_note
                WHERE id = :registration_id
                """
            ),
            {
                "registration_id": registration_id,
                "status": status,
                "reviewed_by_user_id": actor_user_id,
                "review_note": note,
            },
        )
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
                VALUES (
                  :actor_user_id,
                  'tournament_registration_reviewed',
                  'tournament_registration',
                  :entity_id,
                  :payload
                )
                """
            ),
            {
                "actor_user_id": actor_user_id,
                "entity_id": registration_id,
                "payload": Jsonb(
                    {
                        "status": status,
                        "previous_status": str(current.status),
                        "tournament_id": str(current.tournament_id),
                    }
                ),
            },
        )
        row = connection.execute(
            text(
                """
                SELECT
                  tr.id,
                  tr.tournament_id,
                  tr.player_user_id,
                  tr.team_name,
                  tr.player1_name,
                  tr.player2_name,
                  tr.contact_phone,
                  tr.contact_email,
                  tr.status,
                  tr.created_at,
                  tr.reviewed_at,
                  tr.review_note,
                  t.title AS tournament_title,
                  u.full_name,
                  u.avatar_url,
                  u.city,
                  u.district,
                  er.visible_skill_tier::text AS visible_skill_tier,
                  er.elo_value,
                  er.matches_played,
                  er.wins,
                  er.losses,
                  er.draws
                FROM public.tournament_registrations tr
                JOIN public.tournaments t ON t.id = tr.tournament_id
                JOIN public.users u ON u.id = tr.player_user_id
                LEFT JOIN public.elo_ratings er ON er.player_user_id = u.id
                WHERE tr.id = :registration_id
                """
            ),
            {"registration_id": registration_id},
        ).one()
    return _admin_registration_from_row(row)
