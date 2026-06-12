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
          COUNT(tr.id) FILTER (WHERE tr.status = 'registered') AS joined_teams
        FROM public.tournaments t
        LEFT JOIN public.tournament_registrations tr ON tr.tournament_id = t.id
        {where_clause}
        GROUP BY t.id
        ORDER BY t.start_date DESC, t.created_at DESC
    """


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
    return _tournament_from_row(row)


def list_tournaments() -> list[dict[str, Any]]:
    with get_engine().begin() as connection:
        rows = connection.execute(text(_select_tournaments())).all()
    return [_tournament_from_row(row) for row in rows]


def list_my_tournament_registration_ids(*, player_user_id: str) -> list[str]:
    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                """
                SELECT tournament_id
                FROM public.tournament_registrations
                WHERE player_user_id = :player_user_id
                  AND status = 'registered'
                ORDER BY created_at DESC
                """
            ),
            {"player_user_id": player_user_id},
        ).all()
    return [str(row.tournament_id) for row in rows]


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
                      AND status = 'registered'
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
                      contact_email
                    )
                    VALUES (
                      :tournament_id,
                      :player_user_id,
                      :team_name,
                      :player1_name,
                      :player2_name,
                      :contact_phone,
                      :contact_email
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
            message="Bạn đã đăng ký giải đấu này",
        ) from exc
