import sys
from pathlib import Path

# Add backend directory to path
sys.path.append("/app")

from app.services.referee_matches import save_referee_match, get_referee_stats, get_h2h_stats, get_player_or_pair_detail
from app.db.session import get_engine
from sqlalchemy import text

def test_flow():
    print("=== BAT DAU KIEM THU REFEREE MATCHES API ===")
    
    # 1. Clear previous test data in referee_matches if any
    with get_engine().begin() as conn:
        conn.execute(text("DELETE FROM public.referee_matches"))
        # Get a real user ID to use as creator
        user_row = conn.execute(text("SELECT id, full_name FROM public.users WHERE is_active = true LIMIT 2")).all()
        if len(user_row) < 1:
            print("Loi: Phai co it nhat 1 user trong db de test")
            return
        creator_id = str(user_row[0].id)
        user2_id = str(user_row[1].id) if len(user_row) > 1 else None
        user2_name = str(user_row[1].full_name) if len(user_row) > 1 else "User 2"
        print(f"Lay duoc Creator ID: {creator_id}, User 2 ID: {user2_id}")

    # 2. Save a Doubles Match
    match1 = save_referee_match(
        actor_user_id=creator_id,
        data={
            "match_type": "doubles",
            "team_a_player1_id": creator_id,
            "team_a_player1_name": user_row[0].full_name,
            "team_a_player2_id": user2_id,
            "team_a_player2_name": user2_name,
            "team_b_player1_id": None,
            "team_b_player1_name": "Tuan Anh",
            "team_b_player2_id": None,
            "team_b_player2_name": "Hoang Nam",
            "sets": [{"team_a": 21, "team_b": 15}, {"team_a": 19, "team_b": 21}, {"team_a": 21, "team_b": 18}],
            "team_a_score": 2,
            "team_b_score": 1
        }
    )
    print(f"Luu match 1 thanh cong: {match1}")

    # 3. Save a Singles Match
    match2 = save_referee_match(
        actor_user_id=creator_id,
        data={
            "match_type": "singles",
            "team_a_player1_id": creator_id,
            "team_a_player1_name": user_row[0].full_name,
            "team_b_player1_id": None,
            "team_b_player1_name": "Tuan Anh",
            "sets": [{"team_a": 15, "team_b": 21}, {"team_a": 12, "team_b": 21}],
            "team_a_score": 0,
            "team_b_score": 2
        }
    )
    print(f"Luu match 2 thanh cong: {match2}")

    # 4. Fetch Stats
    stats = get_referee_stats()
    print("\n--- LEADERBOARD NGUOI CHOI ---")
    for idx, p in enumerate(stats["players"]):
        print(f"{idx+1}. {p['name']} - Chơi: {p['played']}, Thắng: {p['wins']}, Thua: {p['losses']}, WR: {p['win_rate']}%")

    print("\n--- LEADERBOARD CAP DAU ---")
    for idx, pair in enumerate(stats["pairs"]):
        print(f"{idx+1}. {pair['name']} - Chơi: {pair['played']}, Thắng: {pair['wins']}, Thua: {pair['losses']}, WR: {pair['win_rate']}%")

    # 5. Test H2H
    # Tuan Anh vs Creator
    creator_key = f"id:{creator_id}"
    tuan_anh_key = "name:tuan anh"
    h2h = get_h2h_stats(creator_key, tuan_anh_key)
    print(f"\n--- DOI DAU H2H: {user_row[0].full_name} vs Tuan Anh ---")
    print(f"Tong so tran: {h2h['total_played']}, A thang: {h2h['a_wins']}, B thang: {h2h['b_wins']}")

    # 6. Test Details
    detail = get_player_or_pair_detail(creator_key)
    print(f"\n--- CHI TIET CA NHAN: {detail['name']} ---")
    print(f"Tong so tran: {detail['total_played']}, Thang: {detail['wins']}, Thua: {detail['losses']}, WR: {detail['win_rate']}%")
    print("Doi thu ky ro nhat:")
    for o in detail["opponents"]:
        print(f" - {o['name']}: {o['played']} tran, {o['win_rate']}% WR cho minh")

    print("\n=== HOAN THANH KIEM THU THANH CONG ===")

if __name__ == "__main__":
    test_flow()
