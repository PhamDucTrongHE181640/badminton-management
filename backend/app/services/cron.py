import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import text

from app.db.session import get_engine

logger = logging.getLogger(__name__)


def generate_daily_sessions(days_ahead: int = 30) -> int:
    """
    Generates 30-minute sessions for all active courts for the next `days_ahead` days.
    Skips if a session already exists for that timeslot.
    """
    total_created = 0
    vn_tz = ZoneInfo("Asia/Ho_Chi_Minh")
    # Today in VN timezone
    today = datetime.now(vn_tz).date()
    end_date = today + timedelta(days=days_ahead)

    with get_engine().begin() as connection:
        # 1. Fetch all active courts
        courts = connection.execute(
            text(
                """
                SELECT id, owner_user_id, base_price_vnd, open_time, close_time
                FROM public.courts
                WHERE status = 'active'
                """
            )
        ).fetchall()

        if not courts:
            return 0

        for court in courts:
            court_id = court.id
            owner_user_id = court.owner_user_id
            base_price = court.base_price_vnd
            open_time = court.open_time or time(5, 0)
            close_time = court.close_time or time(22, 30)

            # 2. Fetch existing sessions to avoid duplicates and overlaps
            existing_intervals = []
            rows = connection.execute(
                text(
                    """
                    SELECT starts_at, ends_at
                    FROM public.sessions
                    WHERE court_id = :court_id
                      AND ends_at > :start_date
                      AND starts_at < :end_date
                    """
                ),
                {
                    "court_id": court_id,
                    "start_date": datetime.combine(today, time(0, 0)).replace(tzinfo=vn_tz),
                    "end_date": datetime.combine(end_date + timedelta(days=1), time(0, 0)).replace(tzinfo=vn_tz),
                },
            ).fetchall()
            for row in rows:
                start = row.starts_at.astimezone(timezone.utc) if row.starts_at.tzinfo else row.starts_at.replace(tzinfo=timezone.utc)
                end = row.ends_at.astimezone(timezone.utc) if row.ends_at.tzinfo else row.ends_at.replace(tzinfo=timezone.utc)
                existing_intervals.append((start, end))

            # 3. Generate new slots
            new_sessions = []
            current_date = today
            
            while current_date <= end_date:
                # generate times from open_time to close_time with 30-min step
                dt_current = datetime.combine(current_date, open_time).replace(tzinfo=vn_tz)
                dt_close = datetime.combine(current_date, close_time).replace(tzinfo=vn_tz)
                
                while dt_current < dt_close:
                    dt_current_utc = dt_current.astimezone(timezone.utc) if dt_current.tzinfo else dt_current.replace(tzinfo=timezone.utc)
                    dt_next_utc = dt_current_utc + timedelta(minutes=30)
                    
                    # Check overlap with any existing intervals
                    has_overlap = False
                    for ext_start, ext_end in existing_intervals:
                        if dt_current_utc < ext_end and dt_next_utc > ext_start:
                            has_overlap = True
                            break
                    
                    if not has_overlap:
                        # Prepare insert data
                        new_sessions.append(
                            {
                                "court_id": court_id,
                                "created_by_user_id": owner_user_id,
                                "title": f"Ca {dt_current.strftime('%H:%M')} - {(dt_current + timedelta(minutes=30)).strftime('%H:%M')}",
                                "description": "Tự động tạo bởi hệ thống",
                                "post_type": "rental",
                                "status": "scheduled",
                                "starts_at": dt_current,
                                "duration_minutes": 30,
                                "ends_at": dt_current + timedelta(minutes=30),
                                "open_slots": 4, # same as max_slots
                                "max_slots": 4, # arbitrary default for max people
                                "required_skill_min": "Beginner",
                                "required_skill_max": "Advanced",
                                "slot_price_vnd": 0,
                                "full_court_price_vnd": int(base_price / 60 * 30), # 30 min price
                                "is_peak_hour": dt_current.hour >= 17,
                                "allows_solo_join": False,
                            }
                        )
                    dt_current += timedelta(minutes=30)
                
                current_date += timedelta(days=1)
            
            # 4. Bulk insert
            if new_sessions:
                connection.execute(
                    text(
                        """
                        INSERT INTO public.sessions (
                          court_id,
                          created_by_user_id,
                          title,
                          description,
                          post_type,
                          status,
                          starts_at,
                          duration_minutes,
                          ends_at,
                          open_slots,
                          max_slots,
                          required_skill_min,
                          required_skill_max,
                          slot_price_vnd,
                          full_court_price_vnd,
                          is_peak_hour,
                          allows_solo_join
                        ) VALUES (
                          :court_id,
                          :created_by_user_id,
                          :title,
                          :description,
                          CAST(:post_type AS public.session_post_type),
                          CAST(:status AS public.session_status),
                          :starts_at,
                          :duration_minutes,
                          :ends_at,
                          :open_slots,
                          :max_slots,
                          CAST(:required_skill_min AS public.skill_tier),
                          CAST(:required_skill_max AS public.skill_tier),
                          :slot_price_vnd,
                          :full_court_price_vnd,
                          :is_peak_hour,
                          :allows_solo_join
                        )
                        """
                    ),
                    new_sessions,
                )
                total_created += len(new_sessions)

    return total_created
