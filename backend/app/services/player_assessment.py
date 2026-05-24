from __future__ import annotations

from typing import Any

from psycopg.types.json import Jsonb
from sqlalchemy import text

from app.core.errors import AppError
from app.db.session import get_engine

SPORT_QUESTION_SPECS: dict[str, dict[str, tuple[float, float, float]]] = {
    "Badminton": {
        "racket_control": (1, 5, 0.22),
        "footwork": (1, 5, 0.2),
        "stamina": (1, 5, 0.14),
        "match_reading": (1, 5, 0.14),
        "weekly_sessions": (0, 14, 0.15),
        "experience_years": (0, 20, 0.15),
    },
    "Football": {
        "ball_control": (1, 5, 0.2),
        "tactical_awareness": (1, 5, 0.2),
        "team_play": (1, 5, 0.18),
        "stamina": (1, 5, 0.12),
        "weekly_sessions": (0, 14, 0.15),
        "experience_years": (0, 20, 0.15),
    },
    "Tennis": {
        "serve_consistency": (1, 5, 0.2),
        "rally_control": (1, 5, 0.2),
        "footwork": (1, 5, 0.16),
        "mental_focus": (1, 5, 0.14),
        "weekly_sessions": (0, 14, 0.15),
        "experience_years": (0, 20, 0.15),
    },
}

DEFAULT_FORM_VERSION = "v1"
ASSESSMENT_ELO_ALGORITHM_VERSION = "assessment_bootstrap_v1"
BASELINE_ELO = 1000
MIN_ELO = 900
MAX_ELO = 2000


def _tier_from_elo(elo_value: int) -> str:
    if elo_value < 1200:
        return "Beginner"
    if elo_value < 1550:
        return "Intermediate"
    return "Advanced"


def _coerce_numeric_value(*, key: str, value: Any) -> float:
    if isinstance(value, bool):
        raise AppError(
            status_code=422,
            code="assessment_answers_invalid",
            message=f"Giá trị câu hỏi {key} không hợp lệ",
        )
    if isinstance(value, int | float):
        return float(value)
    raise AppError(
        status_code=422,
        code="assessment_answers_invalid",
        message=f"Giá trị câu hỏi {key} phải là số",
    )


def _compute_assessment_result(*, sport: str, answers: dict[str, Any]) -> tuple[int, str]:
    spec = SPORT_QUESTION_SPECS.get(sport)
    if spec is None:
        raise AppError(
            status_code=422,
            code="assessment_sport_invalid",
            message="Môn thể thao không hợp lệ",
        )

    answer_keys = set(answers.keys())
    required_keys = set(spec.keys())
    missing = sorted(required_keys - answer_keys)
    extra = sorted(answer_keys - required_keys)
    if missing:
        raise AppError(
            status_code=422,
            code="assessment_answers_missing",
            message=f"Thiếu câu trả lời: {', '.join(missing)}",
        )
    if extra:
        raise AppError(
            status_code=422,
            code="assessment_answers_unknown",
            message=f"Câu trả lời không hợp lệ: {', '.join(extra)}",
        )

    weighted_total = 0.0
    total_weight = 0.0
    for key, (min_value, max_value, weight) in spec.items():
        raw_value = _coerce_numeric_value(key=key, value=answers[key])
        if raw_value < min_value or raw_value > max_value:
            raise AppError(
                status_code=422,
                code="assessment_answers_out_of_range",
                message=f"Giá trị {key} phải nằm trong [{min_value}, {max_value}]",
            )
        normalized = (raw_value - min_value) / (max_value - min_value)
        weighted_total += normalized * weight
        total_weight += weight

    if total_weight <= 0:
        raise AppError(
            status_code=500,
            code="assessment_config_invalid",
            message="Cấu hình assessment không hợp lệ",
        )

    normalized_score = weighted_total / total_weight
    computed_elo = int(round(MIN_ELO + normalized_score * (MAX_ELO - MIN_ELO)))
    computed_elo = max(100, min(5000, computed_elo))
    return computed_elo, _tier_from_elo(computed_elo)


def submit_player_assessment(*, player_user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    sport = str(data.get("sport") or "")
    answers = data.get("answers")
    if not isinstance(answers, dict):
        raise AppError(
            status_code=422,
            code="assessment_answers_invalid",
            message="answers phải là object",
        )
    form_version = (
        str(data.get("form_version") or DEFAULT_FORM_VERSION).strip() or DEFAULT_FORM_VERSION
    )

    computed_elo, computed_tier = _compute_assessment_result(sport=sport, answers=answers)
    reason = f"assessment_onboarding:{sport}:{form_version}"

    with get_engine().begin() as connection:
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

        assessment_row = connection.execute(
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
                  :form_version,
                  :answers,
                  :computed_elo,
                  CAST(:computed_skill_tier AS public.skill_tier)
                )
                ON CONFLICT (player_user_id, sport)
                DO UPDATE SET
                  form_version = EXCLUDED.form_version,
                  answers = EXCLUDED.answers,
                  computed_elo = EXCLUDED.computed_elo,
                  computed_skill_tier = EXCLUDED.computed_skill_tier,
                  updated_at = now()
                RETURNING id, created_at, updated_at
                """
            ),
            {
                "player_user_id": player_user_id,
                "sport": sport,
                "form_version": form_version,
                "answers": Jsonb(answers),
                "computed_elo": computed_elo,
                "computed_skill_tier": computed_tier,
            },
        ).one()

        rating_row = connection.execute(
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
                RETURNING visible_skill_tier::text AS visible_skill_tier
                """
            ),
            {
                "player_user_id": player_user_id,
                "elo_value": computed_elo,
                "visible_skill_tier": computed_tier,
            },
        ).one()

        history_row = connection.execute(
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
                RETURNING id, created_at
                """
            ),
            {
                "player_user_id": player_user_id,
                "old_elo": old_elo,
                "new_elo": computed_elo,
                "delta": computed_elo - old_elo,
                "reason": reason,
                "algorithm_version": ASSESSMENT_ELO_ALGORITHM_VERSION,
            },
        ).one()

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
                  :event_type,
                  :entity_type,
                  :entity_id,
                  :payload
                )
                """
            ),
            {
                "actor_user_id": player_user_id,
                "event_type": "player_assessment_submitted",
                "entity_type": "player_assessment",
                "entity_id": str(assessment_row.id),
                "payload": Jsonb(
                    {
                        "sport": sport,
                        "form_version": form_version,
                        "computed_skill_tier": computed_tier,
                        "delta": computed_elo - old_elo,
                    }
                ),
            },
        )

    return {
        "assessment_id": str(assessment_row.id),
        "sport": sport,
        "form_version": form_version,
        "visible_skill_tier": str(rating_row.visible_skill_tier),
        "elo_delta": int(computed_elo - old_elo),
        "history_id": str(history_row.id),
        "created_at": assessment_row.created_at,
        "updated_at": assessment_row.updated_at,
        "history_created_at": history_row.created_at,
    }


def get_player_skill_tier(*, player_user_id: str) -> dict[str, Any]:
    with get_engine().begin() as connection:
        rating_row = connection.execute(
            text(
                """
                SELECT
                  visible_skill_tier::text AS visible_skill_tier,
                  matches_played,
                  wins,
                  losses,
                  draws,
                  updated_at
                FROM public.elo_ratings
                WHERE player_user_id = :player_user_id
                """
            ),
            {"player_user_id": player_user_id},
        ).first()
        last_assessment = connection.execute(
            text(
                """
                SELECT
                  sport::text AS sport,
                  form_version,
                  updated_at
                FROM public.player_assessments
                WHERE player_user_id = :player_user_id
                ORDER BY updated_at DESC
                LIMIT 1
                """
            ),
            {"player_user_id": player_user_id},
        ).first()

    if rating_row is None:
        return {
            "visible_skill_tier": "Beginner",
            "matches_played": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "updated_at": None,
            "has_assessment": False,
            "last_assessment": None,
        }

    return {
        "visible_skill_tier": str(rating_row.visible_skill_tier),
        "matches_played": int(rating_row.matches_played),
        "wins": int(rating_row.wins),
        "losses": int(rating_row.losses),
        "draws": int(rating_row.draws),
        "updated_at": rating_row.updated_at,
        "has_assessment": last_assessment is not None,
        "last_assessment": (
            {
                "sport": str(last_assessment.sport),
                "form_version": str(last_assessment.form_version),
                "updated_at": last_assessment.updated_at,
            }
            if last_assessment
            else None
        ),
    }


def list_player_elo_history(*, player_user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    capped_limit = max(1, min(limit, 200))
    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                """
                SELECT
                  id,
                  match_id,
                  old_elo,
                  new_elo,
                  delta,
                  reason,
                  algorithm_version,
                  created_at
                FROM public.elo_rating_history
                WHERE player_user_id = :player_user_id
                ORDER BY created_at DESC
                LIMIT :limit
                """
            ),
            {"player_user_id": player_user_id, "limit": capped_limit},
        ).all()

    history: list[dict[str, Any]] = []
    for row in rows:
        history.append(
            {
                "id": str(row.id),
                "match_id": str(row.match_id) if row.match_id else None,
                "delta": int(row.delta),
                "reason": str(row.reason),
                "algorithm_version": str(row.algorithm_version),
                "created_at": row.created_at,
                "skill_tier_before": _tier_from_elo(int(row.old_elo)),
                "skill_tier_after": _tier_from_elo(int(row.new_elo)),
            }
        )
    return history
