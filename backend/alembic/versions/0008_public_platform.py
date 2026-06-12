"""public platform stats and contact leads

Revision ID: 0008_public_platform
Revises: 0007_tournament_demo_data
Create Date: 2026-06-10
"""

from __future__ import annotations

from alembic import op

revision = "0008_public_platform"
down_revision = "0007_tournament_demo_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.contact_leads (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          full_name text NOT NULL,
          phone text NOT NULL,
          email citext NOT NULL,
          partner_type text NOT NULL,
          organization_name text NOT NULL,
          address text NOT NULL,
          message text,
          source text NOT NULL DEFAULT 'web',
          status text NOT NULL DEFAULT 'new'
            CHECK (status IN ('new', 'contacted', 'qualified', 'closed')),
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        DROP TRIGGER IF EXISTS trg_contact_leads_updated_at ON public.contact_leads;
        CREATE TRIGGER trg_contact_leads_updated_at
        BEFORE UPDATE ON public.contact_leads
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

        CREATE INDEX IF NOT EXISTS idx_contact_leads_status_created
        ON public.contact_leads(status, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_contact_leads_email_created
        ON public.contact_leads(email, created_at DESC);

        UPDATE public.tournaments
        SET
          title = 'NetUP Hòa Lạc Open 2026',
          start_date = DATE '2026-06-25',
          end_date = DATE '2026-07-02',
          description = 'Giải cầu lông phong trào dành cho sinh viên và cư dân công nghệ Hòa Lạc.',
          bracket = $$[
            {
              "roundName": "Bán kết",
              "matches": [
                {
                  "id": "m-1",
                  "teamA": "Chờ xác định",
                  "teamB": "Chờ xác định",
                  "time": "30/06 - 19:00",
                  "court": "Sân 3"
                },
                {
                  "id": "m-2",
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
                  "id": "m-3",
                  "teamA": "Thắng Bán kết 1",
                  "teamB": "Thắng Bán kết 2",
                  "time": "02/07 - 16:00",
                  "court": "Sân 1"
                }
              ]
            }
          ]$$::jsonb
        WHERE id = '00000000-0000-0000-0000-000000000701';

        UPDATE public.tournaments
        SET
          title = 'Hòa Lạc Badminton Cup 2026',
          start_date = DATE '2026-06-08',
          end_date = DATE '2026-06-16',
          description = 'Giải đấu đang diễn ra, quy tụ các vợt thủ phong trào nổi bật tại Thạch Thất.',
          bracket = $$[
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
                  "time": "14/06 - 15:00",
                  "court": "Sân 1"
                }
              ]
            }
          ]$$::jsonb
        WHERE id = '00000000-0000-0000-0000-000000000702';

        UPDATE public.tournaments
        SET
          title = 'Spring Challenge 2026',
          start_date = DATE '2026-04-01',
          end_date = DATE '2026-04-07',
          description = 'Giải đấu chào xuân với hơn 32 đội tham gia tranh tài.',
          bracket = $$[
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
        WHERE id = '00000000-0000-0000-0000-000000000703';

        UPDATE public.tournaments
        SET
          title = 'Hòa Lạc Double League 2026',
          start_date = DATE '2026-07-05',
          end_date = DATE '2026-07-15',
          description = 'Giải đôi nâng cao dành cho các tuyển thủ trình độ bán chuyên.'
        WHERE id = '00000000-0000-0000-0000-000000000704';

        UPDATE public.tournaments
        SET
          title = 'NetUP Amateur Series 2026',
          start_date = DATE '2026-07-18',
          end_date = DATE '2026-07-23',
          description = 'Chuỗi giải phong trào dành cho người mới chơi và trình độ trung bình.'
        WHERE id = '00000000-0000-0000-0000-000000000705';

        UPDATE public.tournaments
        SET
          title = 'New Year Championship 2026',
          start_date = DATE '2026-01-05',
          end_date = DATE '2026-01-14',
          description = 'Giải chuyên nghiệp mở màn năm 2026 với các tay vợt ELO từ 1600+.'
        WHERE id = '00000000-0000-0000-0000-000000000706';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TRIGGER IF EXISTS trg_contact_leads_updated_at ON public.contact_leads;
        DROP TABLE IF EXISTS public.contact_leads;
        """
    )
