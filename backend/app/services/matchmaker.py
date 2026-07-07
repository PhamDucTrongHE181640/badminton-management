from __future__ import annotations

from datetime import date
from typing import Any, Dict, List
from sqlalchemy import text
from app.db.session import get_engine
from app.core.errors import AppError

def get_player_session_status(active_player_keys: List[str]) -> List[Dict[str, Any]]:
    """
    Trả về số trận đấu trong ngày hôm nay và chỉ số sức mạnh ước lượng của danh sách người chơi.
    """
    if not active_player_keys:
        return []

    # 1. Lấy tất cả các trận đấu của ngày hôm nay để đếm lượt chơi
    # 2. Lấy tất cả trận đấu trong lịch sử để tính tỷ lệ thắng ước lượng
    with get_engine().begin() as connection:
        # Lấy thông tin user có ELO
        user_rows = connection.execute(
            text(
                """
                SELECT u.id, u.full_name, er.elo_value
                FROM public.users u
                LEFT JOIN public.elo_ratings er ON er.player_user_id = u.id
                WHERE u.is_active = true
                """
            )
        ).all()
        
        # Lấy tất cả các trận đấu trọng tài
        match_rows = connection.execute(
            text(
                """
                SELECT id, match_type, 
                       team_a_player1_id, team_a_player1_name,
                       team_a_player2_id, team_a_player2_name,
                       team_b_player1_id, team_b_player1_name,
                       team_b_player2_id, team_b_player2_name,
                       team_a_score, team_b_score, played_at
                FROM public.referee_matches
                """
            )
        ).all()

    # Tạo map tra cứu nhanh thông tin user
    # Key: "id:[uuid]", Value: { name, elo }
    users_map = {}
    for r in user_rows:
        users_map[f"id:{r.id}"] = {
            "name": str(r.full_name),
            "elo": int(r.elo_value) if r.elo_value is not None else 1000
        }

    # Tính toán lượt đấu hôm nay và lịch sử thắng thua từ trận đấu trọng tài
    today_date_str = date.today().isoformat()
    
    # Thống kê tổng số trận (chơi hôm nay)
    play_count_today = {k: 0 for k in active_player_keys}
    
    # Thống kê lịch sử để tính Win Rate
    history_played = {k: 0 for k in active_player_keys}
    history_won = {k: 0 for k in active_player_keys}

    for m in match_rows:
        played_at_str = m.played_at.date().isoformat()
        is_today = (played_at_str == today_date_str)
        
        # Xác định danh tính của các đấu thủ trong trận m
        p_ta1 = f"id:{m.team_a_player1_id}" if m.team_a_player1_id else f"name:{m.team_a_player1_name}"
        p_ta2 = f"id:{m.team_a_player2_id}" if m.team_a_player2_id else (f"name:{m.team_a_player2_name}" if m.team_a_player2_name else None)
        
        p_tb1 = f"id:{m.team_b_player1_id}" if m.team_b_player1_id else f"name:{m.team_b_player1_name}"
        p_tb2 = f"id:{m.team_b_player2_id}" if m.team_b_player2_id else (f"name:{m.team_b_player2_name}" if m.team_b_player2_name else None)
        
        match_players = [p for p in [p_ta1, p_ta2, p_tb1, p_tb2] if p]
        
        # Đội thắng
        team_a_won = m.team_a_score > m.team_b_score
        
        for k in active_player_keys:
            if k in match_players:
                # Đếm trận hôm nay
                if is_today:
                    play_count_today[k] += 1
                
                # Đếm lịch sử để tính tỷ lệ thắng
                history_played[k] += 1
                is_on_team_a = (k == p_ta1 or k == p_ta2)
                if (is_on_team_a and team_a_won) or (not is_on_team_a and not team_a_won):
                    history_won[k] += 1

    # Tạo kết quả chi tiết cho từng người chơi
    player_stats = []
    for k in active_player_keys:
        # Xác định tên hiển thị
        if k.startswith("id:") and k in users_map:
            name = users_map[k]["name"]
            elo = users_map[k]["elo"]
        else:
            name = k.split(":", 1)[1]
            elo = None
            
        # Tính tỷ lệ thắng
        played = history_played[k]
        won = history_won[k]
        win_rate = (won / played * 100) if played > 0 else 50.0
        
        # Tính chỉ số sức mạnh ước lượng (Chỉ số cân bằng ELO)
        if elo is not None:
            strength = elo
        else:
            # Ước lượng sức mạnh dựa trên tỷ lệ thắng
            strength = 1000 + int((win_rate - 50.0) * 8.0)
            # Clamp strength trong khoảng [800, 1500]
            strength = max(800, min(1500, strength))
            
        player_stats.append({
            "key": k,
            "name": name,
            "today_played": play_count_today[k],
            "win_rate": round(win_rate, 1),
            "strength": strength,
            "is_user": k.startswith("id:")
        })
        
    return player_stats

def suggest_matchups(active_player_keys: List[str], match_type: str = "doubles") -> Dict[str, Any]:
    """
    Đề xuất trận đấu tiếp theo dựa trên số lượt chơi thấp nhất và tổ hợp đội cân bằng nhất.
    """
    if not active_player_keys:
        return {"suggested": None, "players_status": []}

    player_stats = get_player_session_status(active_player_keys)
    
    # Sắp xếp người chơi theo số trận chơi hôm nay tăng dần
    # Nếu bằng nhau thì sắp xếp ngẫu nhiên để tránh trùng lập liên tục
    import random
    random.seed()
    
    sorted_players = sorted(player_stats, key=lambda x: (x["today_played"], random.random()))
    
    num_required = 4 if match_type == "doubles" else 2
    if len(sorted_players) < num_required:
        raise AppError(
            status_code=400,
            code="not_enough_players",
            message=f"Cần tối thiểu {num_required} người chơi hoạt động để chia đội"
        )
        
    # Chọn ra top các ứng viên có số trận chơi thấp nhất
    # Để thuật toán đa dạng, ta lấy nhóm ứng viên có số trận chơi nhỏ nhất
    # Ví dụ: nếu cần 4 người, ta có thể lấy nhóm 6 người ít trận nhất để tổ hợp tìm cặp đấu cân bằng nhất
    candidate_pool_size = min(len(sorted_players), num_required + 2)
    candidates = sorted_players[:candidate_pool_size]
    
    best_diff = 999999
    best_matchup = None
    
    if match_type == "doubles":
        # Tìm tổ hợp chọn 4 người từ pool ứng viên
        from itertools import combinations
        best_candidates = []
        
        # Ta duyệt qua tất cả tổ hợp chọn 4 người
        for combo in combinations(candidates, 4):
            combo_list = list(combo)
            p1, p2, p3, p4 = combo_list
            
            # Tính tổng số trận của combo này để ưu tiên combo có tổng lượt chơi thấp nhất
            total_played = sum(p["today_played"] for p in combo_list)
            
            # Với mỗi combo 4 người, có 3 cách chia đội:
            # Cách 1: (p1, p2) vs (p3, p4)
            diff1 = abs((p1["strength"] + p2["strength"]) - (p3["strength"] + p4["strength"]))
            # Cách 2: (p1, p3) vs (p2, p4)
            diff2 = abs((p1["strength"] + p3["strength"]) - (p2["strength"] + p4["strength"]))
            # Cách 3: (p1, p4) vs (p2, p3)
            diff3 = abs((p1["strength"] + p4["strength"]) - (p2["strength"] + p3["strength"]))
            
            # Chọn cách chia cân bằng nhất cho combo này
            pairings = [
                {"ta": [p1, p2], "tb": [p3, p4], "diff": diff1},
                {"ta": [p1, p3], "tb": [p2, p4], "diff": diff2},
                {"ta": [p1, p4], "tb": [p2, p3], "diff": diff3},
            ]
            best_pair = min(pairings, key=lambda x: x["diff"])
            
            # Đánh giá độ ưu tiên của tổ hợp này
            # Tiêu chí:
            # 1. Tổng lượt chơi thấp nhất (để ưu tiên người chơi ít được chơi nhất)
            # 2. Độ chênh lệch sức mạnh nhỏ nhất
            best_candidates.append({
                "matchup": best_pair,
                "total_played": total_played,
                "diff": best_pair["diff"]
            })
            
        # Sắp xếp các tổ hợp tìm kiếm:
        # Sắp xếp theo tổng lượt chơi trước (tăng dần), sau đó đến độ lệch sức mạnh (tăng dần)
        best_candidates.sort(key=lambda x: (x["total_played"], x["diff"]))
        
        if best_candidates:
            top_option = best_candidates[0]
            best_matchup = {
                "team_a": top_option["matchup"]["ta"],
                "team_b": top_option["matchup"]["tb"],
                "strength_diff": top_option["diff"]
            }
    else:
        # Đấu đơn: Chọn 2 người chơi ít lượt nhất
        p1, p2 = sorted_players[0], sorted_players[1]
        best_matchup = {
            "team_a": [p1],
            "team_b": [p2],
            "strength_diff": abs(p1["strength"] - p2["strength"])
        }
        
    return {
        "suggested": best_matchup,
        "players_status": player_stats
    }
