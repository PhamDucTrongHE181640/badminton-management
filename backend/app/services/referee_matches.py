from __future__ import annotations

from typing import Any
import json
from sqlalchemy import text
from app.db.session import get_engine
from app.core.errors import AppError

def _normalize_player(player_id: str | None, player_name: str) -> dict[str, Any]:
    name = player_name.strip()
    if player_id:
        return {"id": str(player_id), "name": name, "key": f"id:{player_id}"}
    return {"id": None, "name": name, "key": f"name:{name.lower()}"}

def _make_pair_key(p1: dict[str, Any], p2: dict[str, Any] | None) -> str:
    if not p2:
        return p1["key"]
    # Sort keys to ensure uniqueness of pair
    keys = sorted([p1["key"], p2["key"]])
    return "||".join(keys)

def _make_pair_display_name(p1: dict[str, Any], p2: dict[str, Any] | None) -> str:
    if not p2:
        return p1["name"]
    # Sort names to keep display consistent
    names = sorted([p1["name"], p2["name"]])
    return " & ".join(names)

def save_referee_match(*, actor_user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    match_type = data.get("match_type", "singles")
    team_a_player1_id = data.get("team_a_player1_id")
    team_a_player1_name = str(data.get("team_a_player1_name") or "").strip()
    team_a_player2_id = data.get("team_a_player2_id")
    team_a_player2_name = str(data.get("team_a_player2_name") or "").strip() or None
    
    team_b_player1_id = data.get("team_b_player1_id")
    team_b_player1_name = str(data.get("team_b_player1_name") or "").strip()
    team_b_player2_id = data.get("team_b_player2_id")
    team_b_player2_name = str(data.get("team_b_player2_name") or "").strip() or None

    sets = data.get("sets", [])
    team_a_score = int(data.get("team_a_score", 0))
    team_b_score = int(data.get("team_b_score", 0))
    played_at = data.get("played_at")

    if not team_a_player1_name or not team_b_player1_name:
        raise AppError(
            status_code=400,
            code="invalid_players",
            message="Tên người chơi chính của mỗi đội không được trống",
        )
    if match_type == "doubles" and (not team_a_player2_name or not team_b_player2_name):
        raise AppError(
            status_code=400,
            code="invalid_doubles_players",
            message="Đấu đôi yêu cầu điền đầy đủ tên 4 người chơi",
        )

    if team_a_score > team_b_score:
        winner_team = "A"
    elif team_b_score > team_a_score:
        winner_team = "B"
    else:
        winner_team = "A" if sets[-1].get("team_a", 0) > sets[-1].get("team_b", 0) else "B"

    with get_engine().begin() as connection:
        # Check and resolve registered player IDs if names match exactly to registered members
        # to ensure stats are connected to real users if possible
        all_players = [
            (team_a_player1_name, team_a_player1_id, "team_a_player1_id"),
            (team_a_player2_name, team_a_player2_id, "team_a_player2_id"),
            (team_b_player1_name, team_b_player1_id, "team_b_player1_id"),
            (team_b_player2_name, team_b_player2_id, "team_b_player2_id"),
        ]
        
        resolved_ids = {}
        for name, pid, field in all_players:
            if name and not pid:
                row = connection.execute(
                    text("SELECT id FROM public.users WHERE LOWER(full_name) = LOWER(:name) AND is_active = true LIMIT 1"),
                    {"name": name.strip()}
                ).first()
                if row:
                    resolved_ids[field] = str(row.id)
                else:
                    resolved_ids[field] = None
            else:
                resolved_ids[field] = pid

        result = connection.execute(
            text(
                """
                INSERT INTO public.referee_matches (
                    created_by_user_id, match_type,
                    team_a_player1_id, team_a_player1_name,
                    team_a_player2_id, team_a_player2_name,
                    team_b_player1_id, team_b_player1_name,
                    team_b_player2_id, team_b_player2_name,
                    sets, team_a_score, team_b_score, winner_team, played_at
                )
                VALUES (
                    :actor_user_id, :match_type,
                    :ta_p1_id, :ta_p1_name,
                    :ta_p2_id, :ta_p2_name,
                    :tb_p1_id, :tb_p1_name,
                    :tb_p2_id, :tb_p2_name,
                    :sets, :team_a_score, :team_b_score, :winner_team, COALESCE(:played_at, now())
                )
                RETURNING id, created_at
                """
            ),
            {
                "actor_user_id": actor_user_id,
                "match_type": match_type,
                "ta_p1_id": resolved_ids.get("team_a_player1_id"),
                "ta_p1_name": team_a_player1_name,
                "ta_p2_id": resolved_ids.get("team_a_player2_id") if match_type == "doubles" else None,
                "ta_p2_name": team_a_player2_name if match_type == "doubles" else None,
                "tb_p1_id": resolved_ids.get("team_b_player1_id"),
                "tb_p1_name": team_b_player1_name,
                "tb_p2_id": resolved_ids.get("team_b_player2_id") if match_type == "doubles" else None,
                "tb_p2_name": team_b_player2_name if match_type == "doubles" else None,
                "sets": json.dumps(sets),
                "team_a_score": team_a_score,
                "team_b_score": team_b_score,
                "winner_team": winner_team,
                "played_at": played_at,
            }
        ).first()

    return {
        "id": str(result.id),
        "created_at": result.created_at,
        "winner_team": winner_team
    }

def get_player_autocomplete(*, query: str) -> list[dict[str, Any]]:
    q = f"%{query.strip()}%"
    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                """
                SELECT id, full_name, avatar_url 
                FROM public.users 
                WHERE is_active = true AND (full_name ILIKE :q OR email ILIKE :q) 
                ORDER BY full_name ASC 
                LIMIT 15
                """
            ),
            {"q": q}
        ).all()
    return [{"id": str(r.id), "full_name": str(r.full_name), "avatar_url": str(r.avatar_url) if r.avatar_url else None} for r in rows]

def _parse_match_row(r: Any) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "match_type": str(r.match_type),
        "team_a": {
            "player1": {"id": str(r.team_a_player1_id) if r.team_a_player1_id else None, "name": str(r.team_a_player1_name)},
            "player2": {"id": str(r.team_a_player2_id) if r.team_a_player2_id else None, "name": str(r.team_a_player2_name) if r.team_a_player2_name else None},
            "score": int(r.team_a_score)
        },
        "team_b": {
            "player1": {"id": str(r.team_b_player1_id) if r.team_b_player1_id else None, "name": str(r.team_b_player1_name)},
            "player2": {"id": str(r.team_b_player2_id) if r.team_b_player2_id else None, "name": str(r.team_b_player2_name) if r.team_b_player2_name else None},
            "score": int(r.team_b_score)
        },
        "sets": r.sets if isinstance(r.sets, list) else json.loads(r.sets),
        "winner_team": str(r.winner_team),
        "played_at": r.played_at,
        "created_at": r.created_at,
        "recorder": str(r.recorder_name) if hasattr(r, "recorder_name") and r.recorder_name else "Ẩn danh"
    }

def list_referee_matches(*, actor_user_id: str) -> list[dict[str, Any]]:
    with get_engine().begin() as connection:
        rows = connection.execute(
            text(
                """
                SELECT m.*, u.full_name as recorder_name
                FROM public.referee_matches m
                JOIN public.users u ON u.id = m.created_by_user_id
                ORDER BY m.played_at DESC, m.created_at DESC
                """
            )
        ).all()
    return [_parse_match_row(r) for r in rows]

def get_referee_stats() -> dict[str, Any]:
    with get_engine().begin() as connection:
        rows = connection.execute(
            text("SELECT m.*, u.full_name as recorder_name FROM public.referee_matches m JOIN public.users u ON u.id = m.created_by_user_id")
        ).all()
    
    matches = [_parse_match_row(r) for r in rows]
    
    players_stats = {}
    pairs_stats = {}
    
    # helper to update stat dict
    def update_stat(stats_dict, key, is_win, name, avatar_url=None):
        if key not in stats_dict:
            stats_dict[key] = {
                "key": key,
                "name": name,
                "avatar_url": avatar_url,
                "played": 0,
                "wins": 0,
                "losses": 0,
                "win_rate": 0.0
            }
        stats_dict[key]["played"] += 1
        if is_win:
            stats_dict[key]["wins"] += 1
        else:
            stats_dict[key]["losses"] += 1

    # Fetch avatar maps for registered users
    user_avatars = {}
    with get_engine().begin() as connection:
        avatars = connection.execute(text("SELECT id, avatar_url FROM public.users WHERE is_active = true")).all()
        for a in avatars:
            user_avatars[str(a.id)] = str(a.avatar_url) if a.avatar_url else None

    for m in matches:
        # Determine winning sides
        team_a_won = m["winner_team"] == "A"
        
        # Team A players
        ta_p1 = _normalize_player(m["team_a"]["player1"]["id"], m["team_a"]["player1"]["name"])
        ta_p2 = _normalize_player(m["team_a"]["player2"]["id"], m["team_a"]["player2"]["name"]) if m["team_a"]["player2"]["name"] else None
        
        # Team B players
        tb_p1 = _normalize_player(m["team_b"]["player1"]["id"], m["team_b"]["player1"]["name"])
        tb_p2 = _normalize_player(m["team_b"]["player2"]["id"], m["team_b"]["player2"]["name"]) if m["team_b"]["player2"]["name"] else None
        
        # Update individual stats
        update_stat(players_stats, ta_p1["key"], team_a_won, ta_p1["name"], user_avatars.get(ta_p1["id"]) if ta_p1["id"] else None)
        if ta_p2:
            update_stat(players_stats, ta_p2["key"], team_a_won, ta_p2["name"], user_avatars.get(ta_p2["id"]) if ta_p2["id"] else None)
            
        update_stat(players_stats, tb_p1["key"], not team_a_won, tb_p1["name"], user_avatars.get(tb_p1["id"]) if tb_p1["id"] else None)
        if tb_p2:
            update_stat(players_stats, tb_p2["key"], not team_a_won, tb_p2["name"], user_avatars.get(tb_p2["id"]) if tb_p2["id"] else None)
            
        # Update pair stats
        ta_pair_key = _make_pair_key(ta_p1, ta_p2)
        ta_pair_name = _make_pair_display_name(ta_p1, ta_p2)
        update_stat(pairs_stats, ta_pair_key, team_a_won, ta_pair_name)
        
        tb_pair_key = _make_pair_key(tb_p1, tb_p2)
        tb_pair_name = _make_pair_display_name(tb_p1, tb_p2)
        update_stat(pairs_stats, tb_pair_key, not team_a_won, tb_pair_name)
        
    # Calculate rates
    for p in players_stats.values():
        p["win_rate"] = round((p["wins"] / p["played"]) * 100, 1) if p["played"] > 0 else 0.0
    for p in pairs_stats.values():
        p["win_rate"] = round((p["wins"] / p["played"]) * 100, 1) if p["played"] > 0 else 0.0
        
    # Sort leaderboards
    player_leaderboard = sorted(players_stats.values(), key=lambda x: (x["win_rate"], x["played"]), reverse=True)
    pair_leaderboard = sorted(pairs_stats.values(), key=lambda x: (x["win_rate"], x["played"]), reverse=True)
    
    return {
        "players": player_leaderboard,
        "pairs": pair_leaderboard
    }

def get_h2h_stats(entity_a_key: str, entity_b_key: str) -> dict[str, Any]:
    with get_engine().begin() as connection:
        rows = connection.execute(
            text("SELECT m.*, u.full_name as recorder_name FROM public.referee_matches m JOIN public.users u ON u.id = m.created_by_user_id")
        ).all()
    matches = [_parse_match_row(r) for r in rows]
    
    h2h_matches = []
    a_wins = 0
    b_wins = 0
    
    for m in matches:
        ta_p1 = _normalize_player(m["team_a"]["player1"]["id"], m["team_a"]["player1"]["name"])
        ta_p2 = _normalize_player(m["team_a"]["player2"]["id"], m["team_a"]["player2"]["name"]) if m["team_a"]["player2"]["name"] else None
        
        tb_p1 = _normalize_player(m["team_b"]["player1"]["id"], m["team_b"]["player1"]["name"])
        tb_p2 = _normalize_player(m["team_b"]["player2"]["id"], m["team_b"]["player2"]["name"]) if m["team_b"]["player2"]["name"] else None
        
        ta_pair = _make_pair_key(ta_p1, ta_p2)
        tb_pair = _make_pair_key(tb_p1, tb_p2)
        
        # Check if they faced each other
        side_a = None # 'A' or 'B' representing where entity_a was
        
        # We check both individual keys and pair keys
        # E.g. entity_a_key can be "id:user_uuid" or "name:bob" or "id:user_uuid||id:other_uuid"
        is_ta_a = (ta_pair == entity_a_key or ta_p1["key"] == entity_a_key or (ta_p2 and ta_p2["key"] == entity_a_key))
        is_tb_a = (tb_pair == entity_a_key or tb_p1["key"] == entity_a_key or (tb_p2 and tb_p2["key"] == entity_a_key))
        
        is_ta_b = (ta_pair == entity_b_key or ta_p1["key"] == entity_b_key or (ta_p2 and ta_p2["key"] == entity_b_key))
        is_tb_b = (tb_pair == entity_b_key or tb_p1["key"] == entity_b_key or (tb_p2 and tb_p2["key"] == entity_b_key))
        
        if is_ta_a and is_tb_b:
            side_a = "A"
        elif is_tb_a and is_ta_b:
            side_a = "B"
            
        if side_a:
            h2h_matches.append(m)
            team_a_won = m["winner_team"] == "A"
            if (side_a == "A" and team_a_won) or (side_a == "B" and not team_a_won):
                a_wins += 1
            else:
                b_wins += 1
                
    total = len(h2h_matches)
    return {
        "total_played": total,
        "a_wins": a_wins,
        "b_wins": b_wins,
        "a_win_rate": round((a_wins / total) * 100, 1) if total > 0 else 0.0,
        "b_win_rate": round((b_wins / total) * 100, 1) if total > 0 else 0.0,
        "matches": h2h_matches
    }

def get_player_or_pair_detail(key: str) -> dict[str, Any]:
    with get_engine().begin() as connection:
        rows = connection.execute(
            text("SELECT m.*, u.full_name as recorder_name FROM public.referee_matches m JOIN public.users u ON u.id = m.created_by_user_id")
        ).all()
    matches = [_parse_match_row(r) for r in rows]
    
    played_matches = []
    wins = 0
    losses = 0
    
    partners = {}
    opponents = {}
    
    for m in matches:
        ta_p1 = _normalize_player(m["team_a"]["player1"]["id"], m["team_a"]["player1"]["name"])
        ta_p2 = _normalize_player(m["team_a"]["player2"]["id"], m["team_a"]["player2"]["name"]) if m["team_a"]["player2"]["name"] else None
        tb_p1 = _normalize_player(m["team_b"]["player1"]["id"], m["team_b"]["player1"]["name"])
        tb_p2 = _normalize_player(m["team_b"]["player2"]["id"], m["team_b"]["player2"]["name"]) if m["team_b"]["player2"]["name"] else None
        
        ta_pair = _make_pair_key(ta_p1, ta_p2)
        tb_pair = _make_pair_key(tb_p1, tb_p2)
        
        my_side = None
        my_team_players = []
        opp_team_players = []
        
        # Check if match contains key
        if ta_pair == key or ta_p1["key"] == key or (ta_p2 and ta_p2["key"] == key):
            my_side = "A"
            my_team_players = [ta_p1, ta_p2] if ta_p2 else [ta_p1]
            opp_team_players = [tb_p1, tb_p2] if tb_p2 else [tb_p1]
        elif tb_pair == key or tb_p1["key"] == key or (tb_p2 and tb_p2["key"] == key):
            my_side = "B"
            my_team_players = [tb_p1, tb_p2] if tb_p2 else [tb_p1]
            opp_team_players = [ta_p1, ta_p2] if ta_p2 else [ta_p1]
            
        if my_side:
            played_matches.append(m)
            team_a_won = m["winner_team"] == "A"
            is_win = (my_side == "A" and team_a_won) or (my_side == "B" and not team_a_won)
            if is_win:
                wins += 1
            else:
                losses += 1
                
            # Count partners (excluding myself)
            for p in my_team_players:
                if p and p["key"] != key:
                    p_key = p["key"]
                    if p_key not in partners:
                        partners[p_key] = {"name": p["name"], "played": 0, "wins": 0}
                    partners[p_key]["played"] += 1
                    if is_win:
                        partners[p_key]["wins"] += 1
                        
            # Count opponents
            for p in opp_team_players:
                if p:
                    o_key = p["key"]
                    if o_key not in opponents:
                        opponents[o_key] = {"name": p["name"], "played": 0, "wins": 0}
                    opponents[o_key]["played"] += 1
                    if is_win:
                        opponents[o_key]["wins"] += 1
                        
    total = len(played_matches)
    
    # Format partners list
    partners_list = []
    for k, v in partners.items():
        v["win_rate"] = round((v["wins"] / v["played"]) * 100, 1)
        partners_list.append(v)
    partners_list = sorted(partners_list, key=lambda x: (x["win_rate"], x["played"]), reverse=True)
    
    # Format opponents list
    opponents_list = []
    for k, v in opponents.items():
        v["win_rate"] = round((v["wins"] / v["played"]) * 100, 1)
        opponents_list.append(v)
    opponents_list = sorted(opponents_list, key=lambda x: (x["win_rate"], x["played"]), reverse=True)
    
    # Determine display name
    display_name = key.split(":")[-1]
    if key.startswith("id:"):
        with get_engine().begin() as connection:
            row = connection.execute(text("SELECT full_name FROM public.users WHERE id = :id"), {"id": display_name}).first()
            if row:
                display_name = str(row.full_name)
    elif "||" in key:
        parts = key.split("||")
        display_name = " & ".join([p.split(":")[-1] for p in parts])
        
    return {
        "key": key,
        "name": display_name,
        "total_played": total,
        "wins": wins,
        "losses": losses,
        "win_rate": round((wins / total) * 100, 1) if total > 0 else 0.0,
        "partners": partners_list[:5],
        "opponents": opponents_list[:5],
        "matches": played_matches
    }

def quick_register_user(*, full_name: str, email: str, phone: str | None = None) -> dict[str, Any]:
    cleaned_name = full_name.strip()
    cleaned_email = email.strip().lower()
    cleaned_phone = phone.strip() if phone else None
    
    if not cleaned_name:
        raise AppError(status_code=422, code="name_required", message="Tên người dùng không được để trống")
    if not cleaned_email or "@" not in cleaned_email:
        raise AppError(status_code=422, code="email_invalid", message="Email không hợp lệ")

    with get_engine().begin() as connection:
        # Check if email exists
        existing = connection.execute(
            text("SELECT id FROM public.users WHERE email = :email"),
            {"email": cleaned_email}
        ).first()
        if existing:
            raise AppError(status_code=400, code="email_exists", message="Email này đã tồn tại trong hệ thống")
            
        new_row = connection.execute(
            text(
                """
                INSERT INTO public.users (full_name, email, phone, is_active)
                VALUES (:full_name, :email, :phone, true)
                RETURNING id, full_name, email, phone
                """
            ),
            {"full_name": cleaned_name, "email": cleaned_email, "phone": cleaned_phone}
        ).first()
        
        return {
            "id": str(new_row.id),
            "full_name": str(new_row.full_name),
            "email": str(new_row.email),
            "phone": str(new_row.phone) if new_row.phone else None,
        }
