"""player tournaments

Revision ID: 0006_tournaments
Revises: 0005_video_reassessments
Create Date: 2026-06-10
"""

from __future__ import annotations

from alembic import op

revision = "0006_tournaments"
down_revision = "0005_video_reassessments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.tournaments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
          title text NOT NULL,
          sport text NOT NULL,
          status text NOT NULL DEFAULT 'upcoming'
            CHECK (status IN ('upcoming', 'ongoing', 'completed')),
          start_date date NOT NULL,
          end_date date NOT NULL,
          location text NOT NULL,
          max_teams integer NOT NULL CHECK (max_teams > 0),
          prize_money_vnd integer NOT NULL CHECK (prize_money_vnd >= 0),
          banner_url text NOT NULL,
          level text NOT NULL DEFAULT 'movement'
            CHECK (level IN ('movement', 'semi_pro', 'pro')),
          fee_vnd integer NOT NULL DEFAULT 0 CHECK (fee_vnd >= 0),
          description text NOT NULL,
          bracket jsonb NOT NULL DEFAULT '[]'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CHECK (end_date >= start_date)
        );

        CREATE TABLE IF NOT EXISTS public.tournament_registrations (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
          player_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          team_name text NOT NULL,
          player1_name text NOT NULL,
          player2_name text,
          contact_phone text NOT NULL,
          contact_email citext NOT NULL,
          status text NOT NULL DEFAULT 'registered'
            CHECK (status IN ('registered', 'cancelled')),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_tournament_registration_player_active
        ON public.tournament_registrations(tournament_id, player_user_id)
        WHERE status = 'registered';

        CREATE INDEX IF NOT EXISTS idx_tournaments_status_start
        ON public.tournaments(status, start_date DESC);

        CREATE INDEX IF NOT EXISTS idx_tournament_registrations_player
        ON public.tournament_registrations(player_user_id, created_at DESC);

        DROP TRIGGER IF EXISTS trg_tournaments_updated_at ON public.tournaments;
        CREATE TRIGGER trg_tournaments_updated_at
        BEFORE UPDATE ON public.tournaments
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

        DROP TRIGGER IF EXISTS trg_tournament_registrations_updated_at
          ON public.tournament_registrations;
        CREATE TRIGGER trg_tournament_registrations_updated_at
        BEFORE UPDATE ON public.tournament_registrations
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

        INSERT INTO public.tournaments (
          id,
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
        VALUES
          (
            '00000000-0000-0000-0000-000000000601',
            'NetUP Hoa Lac Open 2026',
            'Cầu lông',
            'upcoming',
            DATE '2026-06-25',
            DATE '2026-07-02',
            'Nhà thi đấu ĐH FPT Hòa Lạc',
            16,
            20000000,
            'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&fit=crop&q=80',
            'movement',
            150000,
            'Giải đấu cầu lông phong trào dành cho sinh viên và cư dân công nghệ khu vực Hòa Lạc.',
            $$[
              {
                "roundName": "Bán kết",
                "matches": [
                  {
                    "id": "seed-semi-1",
                    "teamA": "Chờ xác định",
                    "teamB": "Chờ xác định",
                    "time": "30/06 - 19:00",
                    "court": "Sân 3"
                  },
                  {
                    "id": "seed-semi-2",
                    "teamA": "Chờ xác định",
                    "teamB": "Chờ xác định",
                    "time": "30/06 - 20:00",
                    "court": "Sân 4"
                  }
                ]
              },
              {
                "roundName": "Chung kết",
                "matches": [
                  {
                    "id": "seed-final-1",
                    "teamA": "Thắng Bán kết 1",
                    "teamB": "Thắng Bán kết 2",
                    "time": "02/07 - 16:00",
                    "court": "Sân 1"
                  }
                ]
              }
            ]$$::jsonb
          ),
          (
            '00000000-0000-0000-0000-000000000602',
            'Hoa Lac Badminton Cup',
            'Cầu lông',
            'ongoing',
            DATE '2026-06-08',
            DATE '2026-06-16',
            'Trung tâm TDTT Hòa Lạc',
            16,
            15000000,
            'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&fit=crop&q=80',
            'movement',
            200000,
            'Giải đấu quy tụ các đội phong trào nổi bật tại khu vực Thạch Thất.',
            $$[
              {
                "roundName": "Tứ kết",
                "matches": [
                  {
                    "id": "seed-qf-1",
                    "teamA": "Minh Tuấn & Hoàng Đức",
                    "scoreA": 2,
                    "teamB": "Duy Khánh & Anh Tú",
                    "scoreB": 1,
                    "winner": "A"
                  }
                ]
              },
              {
                "roundName": "Bán kết",
                "matches": [
                  {
                    "id": "seed-sf-1",
                    "teamA": "Minh Tuấn & Hoàng Đức",
                    "teamB": "Chờ xác định",
                    "time": "15/06 - 15:00",
                    "court": "Sân 1"
                  }
                ]
              }
            ]$$::jsonb
          ),
          (
            '00000000-0000-0000-0000-000000000603',
            'NetUP Amateur Series',
            'Cầu lông',
            'upcoming',
            DATE '2026-07-18',
            DATE '2026-07-23',
            'Trung tâm TDTT Hòa Lạc',
            16,
            12000000,
            'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&fit=crop&q=80',
            'movement',
            120000,
            'Chuỗi giải phong trào dành cho người mới chơi hoặc trình độ trung bình.',
            '[]'::jsonb
          ),
          (
            '00000000-0000-0000-0000-000000000604',
            'Spring Challenge 2026',
            'Tennis',
            'completed',
            DATE '2026-04-01',
            DATE '2026-04-07',
            'Nhà thi đấu Hòa Lạc',
            32,
            10000000,
            'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=600&fit=crop&q=80',
            'semi_pro',
            100000,
            'Giải đấu đầu xuân đã kết thúc với các trận chung kết kịch tính.',
            $$[
              {
                "roundName": "Chung kết",
                "matches": [
                  {
                    "id": "seed-final-completed",
                    "teamA": "Gia Huy & Minh Nhượng",
                    "scoreA": 21,
                    "teamB": "Minh Tuấn & Hoàng Đức",
                    "scoreB": 19,
                    "winner": "A"
                  }
                ]
              }
            ]$$::jsonb
          )
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_tournament_registrations_updated_at
          ON public.tournament_registrations;
        DROP TRIGGER IF EXISTS trg_tournaments_updated_at ON public.tournaments;
        DROP TABLE IF EXISTS public.tournament_registrations;
        DROP TABLE IF EXISTS public.tournaments;
        """
    )
