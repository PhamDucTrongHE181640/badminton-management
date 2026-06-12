"""refresh tournament demo data for new UI

Revision ID: 0007_tournament_demo_data
Revises: 0006_tournaments
Create Date: 2026-06-10
"""

from __future__ import annotations

from alembic import op

revision = "0007_tournament_demo_data"
down_revision = "0006_tournaments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM public.tournaments
        WHERE id IN (
          '00000000-0000-0000-0000-000000000601',
          '00000000-0000-0000-0000-000000000602',
          '00000000-0000-0000-0000-000000000603',
          '00000000-0000-0000-0000-000000000604',
          '00000000-0000-0000-0000-000000000701',
          '00000000-0000-0000-0000-000000000702',
          '00000000-0000-0000-0000-000000000703',
          '00000000-0000-0000-0000-000000000704',
          '00000000-0000-0000-0000-000000000705',
          '00000000-0000-0000-0000-000000000706'
        );

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
            '00000000-0000-0000-0000-000000000701',
            'NetUP Hòa Lạc Open 2024',
            'Cầu lông',
            'upcoming',
            DATE '2024-05-25',
            DATE '2024-06-02',
            'Nhà thi đấu ĐH FPT Hòa Lạc',
            16,
            20000000,
            'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&fit=crop&q=80',
            'movement',
            150000,
            'Giải cầu lông phong trào dành cho sinh viên và cư dân công nghệ Hòa Lạc.',
            $$[
              {
                "roundName": "Bán kết",
                "matches": [
                  {
                    "id": "m-1",
                    "teamA": "Minh Tuấn & Hoàng Đức",
                    "scoreA": 21,
                    "teamB": "Quang Huy & Đức Anh",
                    "scoreB": 15,
                    "time": "16/05 - 19:00",
                    "court": "Sân 3",
                    "winner": "A"
                  },
                  {
                    "id": "m-2",
                    "teamA": "Quốc Anh & Tiến Đạt",
                    "scoreA": 18,
                    "teamB": "Thành Long & Sơn Hải",
                    "scoreB": 21,
                    "time": "16/05 - 20:00",
                    "court": "Sân 4",
                    "winner": "B"
                  }
                ]
              },
              {
                "roundName": "Chung kết",
                "matches": [
                  {
                    "id": "m-3",
                    "teamA": "Minh Tuấn & Hoàng Đức",
                    "teamB": "Thành Long & Sơn Hải",
                    "time": "18/05 - 16:00",
                    "court": "Sân 1"
                  }
                ]
              }
            ]$$::jsonb
          ),
          (
            '00000000-0000-0000-0000-000000000702',
            'Hòa Lạc Badminton Cup',
            'Cầu lông',
            'ongoing',
            DATE '2024-05-10',
            DATE '2024-05-19',
            'Trung tâm TDTT Hòa Lạc',
            16,
            15000000,
            'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&fit=crop&q=80',
            'movement',
            200000,
            'Giải đấu quy tụ các vợt thủ phong trào nổi bật tại Thạch Thất.',
            $$[
              {
                "roundName": "Tứ kết",
                "matches": [
                  {
                    "id": "tk-1",
                    "teamA": "Minh Tuấn & Hoàng Đức",
                    "scoreA": 2,
                    "teamB": "Duy Khánh & Anh Tú",
                    "scoreB": 1,
                    "winner": "A"
                  },
                  {
                    "id": "tk-2",
                    "teamA": "Bảo Lâm & Trường Giang",
                    "scoreA": 0,
                    "teamB": "Tiến Dũng & Văn Nam",
                    "scoreB": 2,
                    "winner": "B"
                  }
                ]
              },
              {
                "roundName": "Bán kết",
                "matches": [
                  {
                    "id": "bk-1",
                    "teamA": "Minh Tuấn & Hoàng Đức",
                    "teamB": "Tiến Dũng & Văn Nam",
                    "time": "16/05 - 15:00",
                    "court": "Sân 1"
                  }
                ]
              }
            ]$$::jsonb
          ),
          (
            '00000000-0000-0000-0000-000000000703',
            'Spring Challenge 2024',
            'Cầu lông',
            'completed',
            DATE '2024-04-01',
            DATE '2024-04-07',
            'Nhà thi đấu Hòa Lạc',
            32,
            10000000,
            'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=600&fit=crop&q=80',
            'movement',
            100000,
            'Giải đấu chào xuân với hơn 32 đội tham gia tranh tài.',
            $$[
              {
                "roundName": "Chung kết",
                "matches": [
                  {
                    "id": "ck-1",
                    "teamA": "Gia Huy & Minh Nhượng",
                    "scoreA": 21,
                    "teamB": "Minh Tuấn & Hoàng Đức",
                    "scoreB": 19,
                    "winner": "A"
                  }
                ]
              }
            ]$$::jsonb
          ),
          (
            '00000000-0000-0000-0000-000000000704',
            'Hòa Lạc Double League',
            'Cầu lông',
            'upcoming',
            DATE '2024-06-05',
            DATE '2024-06-15',
            'Nhà thi đấu ĐH FPT Hòa Lạc',
            16,
            8000000,
            'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&fit=crop&q=80',
            'semi_pro',
            250000,
            'Giải đôi nâng cao dành cho các tuyển thủ trình độ bán chuyên.',
            '[]'::jsonb
          ),
          (
            '00000000-0000-0000-0000-000000000705',
            'NetUP Amateur Series',
            'Cầu lông',
            'upcoming',
            DATE '2024-06-18',
            DATE '2024-06-23',
            'Trung tâm TDTT Hòa Lạc',
            16,
            12000000,
            'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&fit=crop&q=80',
            'movement',
            120000,
            'Chuỗi giải phong trào dành cho người mới chơi và trình độ trung bình.',
            '[]'::jsonb
          ),
          (
            '00000000-0000-0000-0000-000000000706',
            'New Year Championship 2024',
            'Cầu lông',
            'completed',
            DATE '2024-01-05',
            DATE '2024-01-14',
            'Nhà thi đấu Hòa Lạc',
            16,
            18000000,
            'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&fit=crop&q=80',
            'pro',
            300000,
            'Giải chuyên nghiệp mở màn năm 2024 với các tay vợt ELO từ 1600+.',
            $$[
              {
                "roundName": "Chung kết",
                "matches": [
                  {
                    "id": "ck-new-1",
                    "teamA": "Tuấn Đức & Hồng Nam",
                    "scoreA": 21,
                    "teamB": "Quang Huy & Quốc Khánh",
                    "scoreB": 17,
                    "winner": "A"
                  }
                ]
              }
            ]$$::jsonb
          );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM public.tournaments
        WHERE id IN (
          '00000000-0000-0000-0000-000000000701',
          '00000000-0000-0000-0000-000000000702',
          '00000000-0000-0000-0000-000000000703',
          '00000000-0000-0000-0000-000000000704',
          '00000000-0000-0000-0000-000000000705',
          '00000000-0000-0000-0000-000000000706'
        );
        """
    )
