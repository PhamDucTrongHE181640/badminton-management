import os
import sys
from datetime import datetime, timedelta
import zoneinfo
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

# Add the parent directory to sys.path so we can import 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import get_engine

VN_TZ = zoneinfo.ZoneInfo("Asia/Ho_Chi_Minh")

def generate_blocks():
    engine = get_engine()
    with engine.connect() as conn:
        # Get all active courts
        courts = conn.execute(text("SELECT id, owner_user_id, base_price_vnd, name FROM public.courts WHERE status = 'active'")).all()
        
        if not courts:
            print("No active courts found.")
            return

        now_vn = datetime.now(VN_TZ)
        # Start from today
        start_date = now_vn.date()
        
        total_created = 0
        total_skipped = 0

        for court in courts:
            court_id = court.id
            owner_id = court.owner_user_id
            base_price = court.base_price_vnd
            
            # 30-min block pricing (half of hourly base price)
            full_price_30m = int(base_price * 0.5)
            # Default to 4 slots max for typical courts, so slot price is 1/4 of full price
            slot_price_30m = int(full_price_30m / 4)

            # Generate for next 7 days
            for day_offset in range(7):
                current_date = start_date + timedelta(days=day_offset)
                
                # From 05:00 to 22:00 -> 17 hours -> 34 blocks of 30 mins
                # 05:00, 05:30, 06:00, ..., 21:30
                for block_idx in range(34):
                    start_hour = 5 + (block_idx // 2)
                    start_minute = (block_idx % 2) * 30
                    
                    starts_at_vn = datetime(
                        year=current_date.year,
                        month=current_date.month,
                        day=current_date.day,
                        hour=start_hour,
                        minute=start_minute,
                        tzinfo=VN_TZ
                    )
                    ends_at_vn = starts_at_vn + timedelta(minutes=30)
                    
                    # Don't create blocks in the past
                    if starts_at_vn <= now_vn:
                        continue
                        
                    title = f"Ca {starts_at_vn.strftime('%H:%M')} - {ends_at_vn.strftime('%H:%M')}"
                    
                    # Try to insert
                    try:
                        conn.execute(
                            text("""
                                INSERT INTO public.sessions (
                                    court_id, created_by_user_id, title, post_type, status,
                                    starts_at, duration_minutes, ends_at,
                                    open_slots, max_slots, 
                                    slot_price_vnd, full_court_price_vnd
                                ) VALUES (
                                    :court_id, :owner_id, :title, 'rental', 'scheduled',
                                    :starts_at, 30, :ends_at,
                                    4, 4,
                                    :slot_price_vnd, :full_court_price_vnd
                                )
                            """),
                            {
                                "court_id": court_id,
                                "owner_id": owner_id,
                                "title": title,
                                "starts_at": starts_at_vn,
                                "ends_at": ends_at_vn,
                                "slot_price_vnd": slot_price_30m,
                                "full_court_price_vnd": full_price_30m
                            }
                        )
                        conn.commit()
                        total_created += 1
                    except IntegrityError:
                        # Overlap with existing session or constraint failed
                        conn.rollback()
                        total_skipped += 1

        print(f"Generation complete. Created: {total_created}, Skipped (overlaps): {total_skipped}")

if __name__ == "__main__":
    generate_blocks()
