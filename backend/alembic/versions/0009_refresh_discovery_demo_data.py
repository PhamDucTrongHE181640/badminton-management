"""refresh discovery demo data

Revision ID: 0009_refresh_discovery_demo_data
Revises: 0008_public_platform
Create Date: 2026-06-10
"""

from __future__ import annotations

from alembic import op

revision = "0009_refresh_discovery_demo_data"
down_revision = "0008_public_platform"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO public.users (id, email, full_name, avatar_url, city, district)
        VALUES
          (
            '00000000-0000-0000-0000-000000000901',
            'demo-owner@netup.local',
            'Demo Owner NetUP',
            NULL,
            'Hà Nội',
            'Thạch Thất'
          ),
          (
            '00000000-0000-0000-0000-000000000902',
            'demo-player-1@netup.local',
            'Minh Tuấn Demo',
            NULL,
            'Hà Nội',
            'Thạch Thất'
          ),
          (
            '00000000-0000-0000-0000-000000000903',
            'demo-player-2@netup.local',
            'Khánh Duy Demo',
            NULL,
            'Hà Nội',
            'Cầu Giấy'
          ),
          (
            '00000000-0000-0000-0000-000000000904',
            'demo-player-3@netup.local',
            'An Nhiên Demo',
            NULL,
            'Hà Nội',
            'Nam Từ Liêm'
          )
        ON CONFLICT (id) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            avatar_url = EXCLUDED.avatar_url,
            city = EXCLUDED.city,
            district = EXCLUDED.district;

        INSERT INTO public.user_role_assignments (user_id, role, reason)
        SELECT role_seed.user_id, CAST(role_seed.role AS public.user_role), 'demo discovery seed'
        FROM (
          VALUES
            ('00000000-0000-0000-0000-000000000901'::uuid, 'owner'),
            ('00000000-0000-0000-0000-000000000902'::uuid, 'player'),
            ('00000000-0000-0000-0000-000000000903'::uuid, 'player'),
            ('00000000-0000-0000-0000-000000000904'::uuid, 'player')
        ) AS role_seed(user_id, role)
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.user_role_assignments existing
          WHERE existing.user_id = role_seed.user_id
            AND existing.role = CAST(role_seed.role AS public.user_role)
            AND existing.revoked_at IS NULL
        );

        INSERT INTO public.court_complexes (
          id,
          owner_user_id,
          name,
          district,
          address,
          latitude,
          longitude
        )
        VALUES
          (
            '00000000-0000-0000-0000-000000000911',
            '00000000-0000-0000-0000-000000000901',
            'NetUP Hòa Lạc Sports Hub',
            'Thạch Thất',
            'Khu CNC Hòa Lạc, Thạch Thất, Hà Nội',
            21.0124,
            105.5255
          ),
          (
            '00000000-0000-0000-0000-000000000912',
            '00000000-0000-0000-0000-000000000901',
            'NetUP Cầu Giấy Arena',
            'Cầu Giấy',
            'Dịch Vọng, Cầu Giấy, Hà Nội',
            21.0362,
            105.7906
          )
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            district = EXCLUDED.district,
            address = EXCLUDED.address,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude;

        INSERT INTO public.courts (
          id,
          complex_id,
          owner_user_id,
          name,
          sub_court_name,
          sport,
          status,
          amenities,
          base_price_vnd,
          max_rental_duration_minutes
        )
        VALUES
          (
            '00000000-0000-0000-0000-000000000921',
            '00000000-0000-0000-0000-000000000911',
            '00000000-0000-0000-0000-000000000901',
            'Sân cầu lông',
            'HL-01',
            CAST('Badminton' AS public.sport_type),
            CAST('active' AS public.court_status),
            ARRAY['parking', 'indoor', 'shower']::text[],
            120000,
            180
          ),
          (
            '00000000-0000-0000-0000-000000000922',
            '00000000-0000-0000-0000-000000000911',
            '00000000-0000-0000-0000-000000000901',
            'Sân tennis',
            'HL-02',
            CAST('Tennis' AS public.sport_type),
            CAST('active' AS public.court_status),
            ARRAY['parking', 'outdoor', 'lighting']::text[],
            250000,
            180
          ),
          (
            '00000000-0000-0000-0000-000000000923',
            '00000000-0000-0000-0000-000000000912',
            '00000000-0000-0000-0000-000000000901',
            'Sân cầu lông',
            'CG-01',
            CAST('Badminton' AS public.sport_type),
            CAST('active' AS public.court_status),
            ARRAY['parking', 'indoor']::text[],
            140000,
            180
          )
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            sub_court_name = EXCLUDED.sub_court_name,
            sport = EXCLUDED.sport,
            status = EXCLUDED.status,
            amenities = EXCLUDED.amenities,
            base_price_vnd = EXCLUDED.base_price_vnd,
            max_rental_duration_minutes = EXCLUDED.max_rental_duration_minutes;

        INSERT INTO public.sessions (
          id,
          court_id,
          created_by_user_id,
          title,
          post_type,
          status,
          starts_at,
          duration_minutes,
          open_slots,
          max_slots,
          required_skill_min,
          required_skill_max,
          slot_price_vnd,
          full_court_price_vnd,
          is_peak_hour,
          allows_solo_join
        )
        VALUES
          (
            '00000000-0000-0000-0000-000000000931',
            '00000000-0000-0000-0000-000000000921',
            '00000000-0000-0000-0000-000000000901',
            'Kèo cầu lông tối Hòa Lạc',
            CAST('pool' AS public.session_post_type),
            CAST('scheduled' AS public.session_status),
            TIMESTAMPTZ '2026-06-12 12:00:00+00',
            120,
            3,
            4,
            CAST('Beginner' AS public.skill_tier),
            CAST('Intermediate' AS public.skill_tier),
            90000,
            320000,
            true,
            true
          ),
          (
            '00000000-0000-0000-0000-000000000932',
            '00000000-0000-0000-0000-000000000923',
            '00000000-0000-0000-0000-000000000901',
            'Kèo cầu lông Cầu Giấy',
            CAST('pool' AS public.session_post_type),
            CAST('scheduled' AS public.session_status),
            TIMESTAMPTZ '2026-06-13 11:00:00+00',
            120,
            2,
            4,
            CAST('Intermediate' AS public.skill_tier),
            CAST('Advanced' AS public.skill_tier),
            110000,
            380000,
            true,
            true
          ),
          (
            '00000000-0000-0000-0000-000000000933',
            '00000000-0000-0000-0000-000000000922',
            '00000000-0000-0000-0000-000000000901',
            'Thuê sân tennis cuối tuần',
            CAST('rental' AS public.session_post_type),
            CAST('scheduled' AS public.session_status),
            TIMESTAMPTZ '2026-06-14 08:00:00+00',
            90,
            1,
            1,
            CAST('Beginner' AS public.skill_tier),
            CAST('Advanced' AS public.skill_tier),
            250000,
            350000,
            false,
            false
          ),
          (
            '00000000-0000-0000-0000-000000000934',
            '00000000-0000-0000-0000-000000000921',
            '00000000-0000-0000-0000-000000000901',
            'Kèo cầu lông nâng cao',
            CAST('pool' AS public.session_post_type),
            CAST('scheduled' AS public.session_status),
            TIMESTAMPTZ '2026-06-15 13:30:00+00',
            90,
            1,
            4,
            CAST('Advanced' AS public.skill_tier),
            CAST('Advanced' AS public.skill_tier),
            120000,
            360000,
            true,
            true
          )
        ON CONFLICT (id) DO UPDATE
        SET title = EXCLUDED.title,
            post_type = EXCLUDED.post_type,
            status = EXCLUDED.status,
            starts_at = EXCLUDED.starts_at,
            duration_minutes = EXCLUDED.duration_minutes,
            open_slots = EXCLUDED.open_slots,
            max_slots = EXCLUDED.max_slots,
            required_skill_min = EXCLUDED.required_skill_min,
            required_skill_max = EXCLUDED.required_skill_max,
            slot_price_vnd = EXCLUDED.slot_price_vnd,
            full_court_price_vnd = EXCLUDED.full_court_price_vnd,
            is_peak_hour = EXCLUDED.is_peak_hour,
            allows_solo_join = EXCLUDED.allows_solo_join;

        INSERT INTO public.pool_posts (
          id,
          session_id,
          host_user_id,
          status,
          total_slots,
          host_slots,
          description
        )
        VALUES
          (
            '00000000-0000-0000-0000-000000000941',
            '00000000-0000-0000-0000-000000000931',
            '00000000-0000-0000-0000-000000000902',
            CAST('open' AS public.pool_post_status),
            4,
            1,
            'Kèo demo từ dữ liệu backend'
          ),
          (
            '00000000-0000-0000-0000-000000000942',
            '00000000-0000-0000-0000-000000000932',
            '00000000-0000-0000-0000-000000000903',
            CAST('open' AS public.pool_post_status),
            4,
            1,
            'Kèo demo từ dữ liệu backend'
          ),
          (
            '00000000-0000-0000-0000-000000000943',
            '00000000-0000-0000-0000-000000000934',
            '00000000-0000-0000-0000-000000000904',
            CAST('open' AS public.pool_post_status),
            4,
            1,
            'Kèo demo từ dữ liệu backend'
          )
        ON CONFLICT (session_id) DO UPDATE
        SET host_user_id = EXCLUDED.host_user_id,
            status = EXCLUDED.status,
            total_slots = EXCLUDED.total_slots,
            host_slots = EXCLUDED.host_slots,
            description = EXCLUDED.description;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM public.pool_posts
        WHERE id IN (
          '00000000-0000-0000-0000-000000000941',
          '00000000-0000-0000-0000-000000000942',
          '00000000-0000-0000-0000-000000000943'
        );

        DELETE FROM public.sessions
        WHERE id IN (
          '00000000-0000-0000-0000-000000000931',
          '00000000-0000-0000-0000-000000000932',
          '00000000-0000-0000-0000-000000000933',
          '00000000-0000-0000-0000-000000000934'
        );

        DELETE FROM public.courts
        WHERE id IN (
          '00000000-0000-0000-0000-000000000921',
          '00000000-0000-0000-0000-000000000922',
          '00000000-0000-0000-0000-000000000923'
        );

        DELETE FROM public.court_complexes
        WHERE id IN (
          '00000000-0000-0000-0000-000000000911',
          '00000000-0000-0000-0000-000000000912'
        );

        DELETE FROM public.user_role_assignments
        WHERE user_id IN (
          '00000000-0000-0000-0000-000000000901',
          '00000000-0000-0000-0000-000000000902',
          '00000000-0000-0000-0000-000000000903',
          '00000000-0000-0000-0000-000000000904'
        )
          AND reason = 'demo discovery seed';

        DELETE FROM public.users
        WHERE id IN (
          '00000000-0000-0000-0000-000000000901',
          '00000000-0000-0000-0000-000000000902',
          '00000000-0000-0000-0000-000000000903',
          '00000000-0000-0000-0000-000000000904'
        );
        """
    )
