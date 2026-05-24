from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import httpx
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import get_engine
from app.services.user_auth import UserPrincipal, create_user_access_token

API_BASE = "http://127.0.0.1:8000/api/v1"


def log(step: str, detail: str) -> None:
    now = datetime.now(UTC).isoformat()
    print(f"[{now}] {step}: {detail}")


def api_request(
    client: httpx.Client,
    method: str,
    path: str,
    *,
    token: str | None = None,
    json_payload: dict | None = None,
    expected_status: int | tuple[int, ...] = 200,
):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    response = client.request(
        method,
        f"{API_BASE}{path}",
        headers=headers,
        json=json_payload,
        timeout=20,
    )

    expected_tuple = (
        expected_status
        if isinstance(expected_status, tuple)
        else (expected_status,)
    )
    if response.status_code not in expected_tuple:
        try:
            payload = response.json()
        except Exception:  # noqa: BLE001
            payload = response.text
        raise RuntimeError(
            f"API {method} {path} expected {expected_tuple}, got {response.status_code}: {payload}"
        )

    if response.status_code == 204:
        return None
    return response.json()


def create_user_with_player_role(*, email: str, full_name: str) -> str:
    with get_engine().begin() as connection:
        user_row = connection.execute(
            text(
                """
                INSERT INTO public.users (email, full_name, is_active)
                VALUES (:email, :full_name, true)
                RETURNING id
                """
            ),
            {"email": email, "full_name": full_name},
        ).one()
        user_id = str(user_row.id)
        connection.execute(
            text(
                """
                INSERT INTO public.user_role_assignments (user_id, role, reason)
                VALUES (:user_id, CAST('player' AS public.user_role), 'integration probe seed')
                ON CONFLICT DO NOTHING
                """
            ),
            {"user_id": user_id},
        )
    return user_id


def scalar(sql: str, params: dict | None = None):
    with get_engine().begin() as connection:
        return connection.execute(text(sql), params or {}).scalar_one()


def one(sql: str, params: dict | None = None):
    with get_engine().begin() as connection:
        return connection.execute(text(sql), params or {}).one()


def main() -> None:
    settings = get_settings()
    probe_id = uuid4().hex[:8]
    log("INIT", f"probe_id={probe_id}")

    player_user_id = create_user_with_player_role(
        email=f"probe-player-{probe_id}@example.com",
        full_name=f"Probe Player {probe_id}",
    )
    owner_candidate_user_id = create_user_with_player_role(
        email=f"probe-owner-{probe_id}@example.com",
        full_name=f"Probe Owner {probe_id}",
    )
    opponent_user_id = create_user_with_player_role(
        email=f"probe-opponent-{probe_id}@example.com",
        full_name=f"Probe Opponent {probe_id}",
    )

    player_token = create_user_access_token(
        UserPrincipal(
            id=player_user_id,
            email=f"probe-player-{probe_id}@example.com",
            full_name=f"Probe Player {probe_id}",
            avatar_url=None,
            roles=["player"],
        )
    )
    owner_candidate_token = create_user_access_token(
        UserPrincipal(
            id=owner_candidate_user_id,
            email=f"probe-owner-{probe_id}@example.com",
            full_name=f"Probe Owner {probe_id}",
            avatar_url=None,
            roles=["player"],
        )
    )
    opponent_token = create_user_access_token(
        UserPrincipal(
            id=opponent_user_id,
            email=f"probe-opponent-{probe_id}@example.com",
            full_name=f"Probe Opponent {probe_id}",
            avatar_url=None,
            roles=["player"],
        )
    )

    with httpx.Client() as client:
        log("AUTH", "admin login")
        admin_login = api_request(
            client,
            "POST",
            "/admin/auth/login",
            json_payload={
                "username": settings.admin_seed_username,
                "password": settings.admin_seed_password,
            },
            expected_status=(200, 401, 429),
        )
        if isinstance(admin_login, dict) and admin_login.get("error"):
            raise RuntimeError(f"Admin login failed: {admin_login}")
        admin_token = admin_login["access_token"]

        log("UC-OW-01", "owner candidate submits owner request")
        owner_request = api_request(
            client,
            "POST",
            "/owner/requests",
            token=owner_candidate_token,
            json_payload={
                "business_name": f"Probe Arena {probe_id}",
                "contact_phone": "0900000000",
                "facility_overview": "Probe owner onboarding flow",
            },
            expected_status=201,
        )
        owner_request_id = owner_request["id"]

        log("UC-OW-02", "admin approves owner request")
        approve = api_request(
            client,
            "POST",
            f"/admin/owner-requests/{owner_request_id}/approve",
            token=admin_token,
            json_payload={"review_note": "probe approve"},
            expected_status=200,
        )
        assert approve["status"] == "approved"

        owner_role_count = scalar(
            """
            SELECT count(*)
            FROM public.user_role_assignments
            WHERE user_id = :user_id
              AND role = CAST('owner' AS public.user_role)
              AND revoked_at IS NULL
            """,
            {"user_id": owner_candidate_user_id},
        )
        assert int(owner_role_count) >= 1

        log("UC-OW-03", "owner creates complex/court/session")
        complex_payload = api_request(
            client,
            "POST",
            "/owner/court-complexes",
            token=owner_candidate_token,
            json_payload={
                "name": f"Probe Complex {probe_id}",
                "district": "Ha Dong",
                "address": f"{probe_id} Integration Street",
                "latitude": 21.0,
                "longitude": 105.8,
            },
            expected_status=201,
        )
        complex_id = complex_payload["id"]

        court_payload = api_request(
            client,
            "POST",
            "/owner/courts",
            token=owner_candidate_token,
            json_payload={
                "complex_id": complex_id,
                "name": "San Probe",
                "sub_court_name": "A",
                "sport": "Badminton",
                "status": "active",
                "amenities": ["parking", "shower"],
                "base_price_vnd": 120000,
                "max_rental_duration_minutes": 120,
            },
            expected_status=201,
        )
        court_id = court_payload["id"]

        starts_at = (datetime.now(UTC) + timedelta(hours=2)).isoformat()
        session_payload = api_request(
            client,
            "POST",
            "/owner/sessions",
            token=owner_candidate_token,
            json_payload={
                "court_id": court_id,
                "title": f"Probe Session {probe_id}",
                "post_type": "pool",
                "status": "scheduled",
                "starts_at": starts_at,
                "duration_minutes": 60,
                "open_slots": 4,
                "max_slots": 4,
                "required_skill_min": "Beginner",
                "required_skill_max": "Advanced",
                "slot_price_vnd": 90000,
                "full_court_price_vnd": 360000,
                "is_peak_hour": False,
                "allows_solo_join": True,
            },
            expected_status=201,
        )
        session_id = session_payload["id"]

        log("UC-PL-03", "player discovery sees created session")
        discovery = api_request(
            client,
            "GET",
            "/player/discovery/sessions?sport=Badminton&district=Ha%20Dong&has_open_slots=true",
            token=player_token,
            expected_status=200,
        )
        assert any(item["id"] == session_id for item in discovery)

        log("UC-PL-05/06/07", "player and opponent create bookings + deposit payment")
        player_booking = api_request(
            client,
            "POST",
            "/player/bookings",
            token=player_token,
            json_payload={
                "session_id": session_id,
                "mode": "solo",
                "payment_method": "cash",
                "seats_booked": 1,
            },
            expected_status=201,
        )
        opponent_booking = api_request(
            client,
            "POST",
            "/player/bookings",
            token=opponent_token,
            json_payload={
                "session_id": session_id,
                "mode": "solo",
                "payment_method": "cash",
                "seats_booked": 1,
            },
            expected_status=201,
        )

        player_deposit_intent = api_request(
            client,
            "POST",
            f"/player/bookings/{player_booking['id']}/deposit-payment",
            token=player_token,
            expected_status=200,
        )
        opponent_deposit_intent = api_request(
            client,
            "POST",
            f"/player/bookings/{opponent_booking['id']}/deposit-payment",
            token=opponent_token,
            expected_status=200,
        )

        api_request(
            client,
            "POST",
            "/payments/vnpay/webhook",
            json_payload={
                "external_ref": player_deposit_intent["external_ref"],
                "provider_transaction_id": f"probe-txn-{probe_id}-1",
                "status": "paid",
                "amount_vnd": player_deposit_intent["amount_vnd"],
            },
            expected_status=200,
        )
        api_request(
            client,
            "POST",
            "/payments/vnpay/webhook",
            json_payload={
                "external_ref": opponent_deposit_intent["external_ref"],
                "provider_transaction_id": f"probe-txn-{probe_id}-2",
                "status": "paid",
                "amount_vnd": opponent_deposit_intent["amount_vnd"],
            },
            expected_status=200,
        )

        booking_status_row = one(
            """
            SELECT
              b1.status::text AS player_status,
              b2.status::text AS opponent_status
            FROM public.bookings b1
            JOIN public.bookings b2 ON b2.id = :opponent_booking_id
            WHERE b1.id = :player_booking_id
            """,
            {
                "player_booking_id": player_booking["id"],
                "opponent_booking_id": opponent_booking["id"],
            },
        )
        assert booking_status_row.player_status == "deposit_paid"
        assert booking_status_row.opponent_status == "deposit_paid"

        log("UC-OW-05", "owner checks in player booking")
        checkin = api_request(
            client,
            "POST",
            "/owner/checkins",
            token=owner_candidate_token,
            json_payload={
                "booking_code": player_booking["booking_code"],
                "cash_collected_vnd": player_booking["remaining_due_vnd"],
                "note": "probe checkin",
            },
            expected_status=201,
        )
        assert checkin["booking_status"] == "checked_in"

        remaining_cash_paid = scalar(
            """
            SELECT count(*)
            FROM public.payment_transactions
            WHERE booking_id = :booking_id
              AND kind = CAST('remaining' AS public.payment_transaction_kind)
              AND method = CAST('cash' AS public.payment_method)
              AND status = CAST('paid' AS public.payment_status)
            """,
            {"booking_id": player_booking["id"]},
        )
        assert int(remaining_cash_paid) >= 1

        log("UC-PL-02", "player submits assessment and checks skill tier/history")
        assessment = api_request(
            client,
            "POST",
            "/player/assessments",
            token=player_token,
            json_payload={
                "sport": "Badminton",
                "form_version": "v1",
                "answers": {
                    "racket_control": 4,
                    "footwork": 4,
                    "stamina": 3,
                    "match_reading": 4,
                    "weekly_sessions": 4,
                    "experience_years": 3,
                },
            },
            expected_status=201,
        )
        assert assessment["visible_skill_tier"] in {"Beginner", "Intermediate", "Advanced"}

        skill_tier = api_request(
            client,
            "GET",
            "/player/skill-tier",
            token=player_token,
            expected_status=200,
        )
        assert skill_tier["has_assessment"] is True

        elo_history = api_request(
            client,
            "GET",
            "/player/elo-history?limit=10",
            token=player_token,
            expected_status=200,
        )
        assert len(elo_history) >= 1

        log("UC-PL-09", "prepare session time then create/finalize match with feedback")
        with get_engine().begin() as connection:
            connection.execute(
                text(
                    """
                    UPDATE public.sessions
                    SET starts_at = now() - interval '2 hours',
                        ends_at = now() - interval '1 hours'
                    WHERE id = :session_id
                    """
                ),
                {"session_id": session_id},
            )

        match = api_request(
            client,
            "POST",
            "/player/matches",
            token=player_token,
            json_payload={
                "session_id": session_id,
                "team_a_score": 21,
                "team_b_score": 19,
            },
            expected_status=201,
        )
        match_id = match["id"]

        player_to_opponent_feedback = api_request(
            client,
            "POST",
            f"/player/matches/{match_id}/feedback",
            token=player_token,
            json_payload={
                "to_user_id": opponent_user_id,
                "target_type": "opponent",
                "rating": 5,
                "comment": "Probe fair match",
            },
            expected_status=201,
        )
        assert player_to_opponent_feedback["rating"] == 5

        opponent_to_player_feedback = api_request(
            client,
            "POST",
            f"/player/matches/{match_id}/feedback",
            token=opponent_token,
            json_payload={
                "to_user_id": player_user_id,
                "target_type": "opponent",
                "rating": 4,
                "comment": "Good rally",
            },
            expected_status=201,
        )
        assert opponent_to_player_feedback["rating"] == 4

        finalized = api_request(
            client,
            "POST",
            f"/player/matches/{match_id}/finalize",
            token=player_token,
            expected_status=200,
        )
        assert finalized["match"]["status"] == "finalized"
        assert len(finalized["elo_updates"]) >= 2

        player_match_history = api_request(
            client,
            "GET",
            "/player/matches/history/list?limit=20",
            token=player_token,
            expected_status=200,
        )
        assert any(item["match_id"] == match_id for item in player_match_history)

        elo_rows_for_match = scalar(
            """
            SELECT count(*)
            FROM public.elo_rating_history
            WHERE match_id = :match_id
            """,
            {"match_id": match_id},
        )
        assert int(elo_rows_for_match) >= 2

        log("UC-CH-01/02/03", "insert pool post then exercise chat room APIs")
        with get_engine().begin() as connection:
            pool_post_row = connection.execute(
                text(
                    """
                    INSERT INTO public.pool_posts (
                      session_id,
                      host_user_id,
                      status,
                      total_slots,
                      host_slots,
                      description
                    )
                    VALUES (
                      :session_id,
                      :host_user_id,
                      CAST('open' AS public.pool_post_status),
                      4,
                      1,
                      :description
                    )
                    ON CONFLICT (session_id)
                    DO UPDATE SET
                      host_user_id = EXCLUDED.host_user_id,
                      status = EXCLUDED.status,
                      total_slots = EXCLUDED.total_slots,
                      host_slots = EXCLUDED.host_slots,
                      description = EXCLUDED.description,
                      updated_at = now()
                    RETURNING id
                    """
                ),
                {
                    "session_id": session_id,
                    "host_user_id": owner_candidate_user_id,
                    "description": f"Probe pool post {probe_id}",
                },
            ).one()
        pool_post_id = str(pool_post_row.id)

        room = api_request(
            client,
            "POST",
            "/player/chat/rooms",
            token=owner_candidate_token,
            json_payload={"pool_post_id": pool_post_id},
            expected_status=201,
        )
        room_id = room["id"]

        join = api_request(
            client,
            "POST",
            f"/player/chat/rooms/{room_id}/members",
            token=player_token,
            expected_status=200,
        )
        assert join["room"]["id"] == room_id

        chat_message = api_request(
            client,
            "POST",
            f"/player/chat/rooms/{room_id}/messages",
            token=player_token,
            json_payload={"content": f"Probe chat message {probe_id}"},
            expected_status=201,
        )
        assert chat_message["content"].startswith("Probe chat message")

        history = api_request(
            client,
            "GET",
            f"/player/chat/rooms/{room_id}/messages?limit=20",
            token=player_token,
            expected_status=200,
        )
        assert len(history) >= 1

        log("UC-AD-01/02", "admin config update + metrics + audit")
        admin_config = api_request(
            client,
            "GET",
            "/admin/config",
            token=admin_token,
            expected_status=200,
        )

        base_deposit = Decimal(str(admin_config["deposit_percent"]))
        if base_deposit <= Decimal("79"):
            changed_deposit = base_deposit + Decimal("1")
        else:
            changed_deposit = base_deposit - Decimal("1")

        updated_config = api_request(
            client,
            "PUT",
            "/admin/config",
            token=admin_token,
            json_payload={
                "change_reason": f"probe config tune {probe_id}",
                "deposit_percent": float(changed_deposit),
            },
            expected_status=200,
        )
        assert Decimal(str(updated_config["deposit_percent"])) == changed_deposit

        _ = api_request(
            client,
            "PUT",
            "/admin/config",
            token=admin_token,
            json_payload={
                "change_reason": f"probe rollback {probe_id}",
                "deposit_percent": float(base_deposit),
            },
            expected_status=200,
        )

        dashboard_metrics = api_request(
            client,
            "GET",
            "/admin/dashboard/metrics",
            token=admin_token,
            expected_status=200,
        )
        assert "bookings" in dashboard_metrics
        assert "payments" in dashboard_metrics

        audit_logs = api_request(
            client,
            "GET",
            "/admin/audit-logs?event_type=admin_config_updated&limit=20",
            token=admin_token,
            expected_status=200,
        )
        assert any(
            isinstance(item.get("payload"), dict)
            and str(item["payload"].get("reason", "")).startswith("probe")
            for item in audit_logs
        )

    log("DB-CHECK", "run final SQL validations")
    final_row = one(
        """
        SELECT
          s.open_slots,
          s.max_slots,
          count(DISTINCT b.id) AS booking_count,
          count(DISTINCT ck.id) AS checkin_count,
          count(DISTINCT me.id) AS match_count,
          count(DISTINCT cr.id) AS chat_room_count
        FROM public.sessions s
        LEFT JOIN public.bookings b ON b.session_id = s.id
        LEFT JOIN public.checkins ck ON ck.booking_id = b.id
        LEFT JOIN public.match_events me ON me.session_id = s.id
        LEFT JOIN public.chat_rooms cr ON cr.session_id = s.id
        WHERE s.id = :session_id
        GROUP BY s.open_slots, s.max_slots
        """,
        {"session_id": session_id},
    )
    assert int(final_row.booking_count) >= 2
    assert int(final_row.checkin_count) >= 1
    assert int(final_row.match_count) >= 1
    assert int(final_row.chat_room_count) >= 1

    log(
        "DONE",
        (
            "integration probe succeeded "
            f"(session_id={session_id}, open_slots={final_row.open_slots}/{final_row.max_slots})"
        ),
    )


if __name__ == "__main__":
    main()
