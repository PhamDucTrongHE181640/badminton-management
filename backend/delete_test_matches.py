import sys
from pathlib import Path

sys.path.append("/app")

from app.db.session import get_engine
from sqlalchemy import text

def delete_recent():
    print("=== DANG LAY DANH SACH TRAN GAN DAY DE XOA ===")
    with get_engine().begin() as conn:
        # Lay cac tran dau trong 2 gio qua
        rows = conn.execute(text("""
            SELECT m.id, m.match_type, m.team_a_score, m.team_b_score, m.played_at,
                   m.team_a_player1_name, m.team_b_player1_name, u.full_name as recorder
            FROM public.referee_matches m
            JOIN public.users u ON u.id = m.created_by_user_id
            WHERE m.played_at >= NOW() - INTERVAL '2 hours'
            ORDER BY m.played_at DESC
        """)).all()
        
        if not rows:
            print("Khong tim thay tran dau nao duoc tao trong 2 gio qua.")
            return
            
        print(f"Tim thay {len(rows)} tran dau duoc tao gan day:")
        for r in rows:
            print(f"- [ID: {r.id}] {r.team_a_player1_name} vs {r.team_b_player1_name} (Ti so: {r.team_a_score}-{r.team_b_score}) luc {r.played_at} boi {r.recorder}")
            
        print("\nDang tien hanh xoa de khoi phuc lai trang thai cho nguoi dung...")
        conn.execute(text("DELETE FROM public.referee_matches WHERE played_at >= NOW() - INTERVAL '2 hours'"))
        print("=== DA XOA THANH CONG GAN DAY ===")

if __name__ == "__main__":
    delete_recent()
