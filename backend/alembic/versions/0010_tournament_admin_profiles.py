"""tournament admin registrations and player profiles

Revision ID: 0010_tournament_admin_profiles
Revises: 0009_refresh_discovery_demo_data
Create Date: 2026-06-12
"""

from __future__ import annotations

from alembic import op

revision = "0010_tournament_admin_profiles"
down_revision = "0009_refresh_discovery_demo_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE public.tournament_registrations
          ADD COLUMN IF NOT EXISTS reviewed_by_user_id uuid
            REFERENCES public.users(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
          ADD COLUMN IF NOT EXISTS review_note text;

        DO $$
        DECLARE
          constraint_name text;
        BEGIN
          SELECT conname
          INTO constraint_name
          FROM pg_constraint
          WHERE conrelid = 'public.tournament_registrations'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%status%'
            AND pg_get_constraintdef(oid) LIKE '%registered%'
            AND pg_get_constraintdef(oid) LIKE '%cancelled%'
          LIMIT 1;

          IF constraint_name IS NOT NULL THEN
            EXECUTE format(
              'ALTER TABLE public.tournament_registrations DROP CONSTRAINT %I',
              constraint_name
            );
          END IF;
        END;
        $$;

        ALTER TABLE public.tournament_registrations
          ADD CONSTRAINT tournament_registrations_status_check
          CHECK (status IN ('pending', 'registered', 'cancelled'));

        ALTER TABLE public.tournament_registrations
          ALTER COLUMN status SET DEFAULT 'pending';

        DROP INDEX IF EXISTS public.ux_tournament_registration_player_active;
        CREATE UNIQUE INDEX IF NOT EXISTS ux_tournament_registration_player_active
          ON public.tournament_registrations(tournament_id, player_user_id)
          WHERE status IN ('pending', 'registered');

        CREATE INDEX IF NOT EXISTS idx_tournament_registrations_status_created
          ON public.tournament_registrations(status, created_at DESC);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE public.tournament_registrations
        SET status = 'registered'
        WHERE status = 'pending';

        DROP INDEX IF EXISTS public.idx_tournament_registrations_status_created;
        DROP INDEX IF EXISTS public.ux_tournament_registration_player_active;
        CREATE UNIQUE INDEX IF NOT EXISTS ux_tournament_registration_player_active
          ON public.tournament_registrations(tournament_id, player_user_id)
          WHERE status = 'registered';

        ALTER TABLE public.tournament_registrations
          ALTER COLUMN status SET DEFAULT 'registered';

        ALTER TABLE public.tournament_registrations
          DROP CONSTRAINT IF EXISTS tournament_registrations_status_check;

        ALTER TABLE public.tournament_registrations
          ADD CONSTRAINT tournament_registrations_status_check
          CHECK (status IN ('registered', 'cancelled'));

        ALTER TABLE public.tournament_registrations
          DROP COLUMN IF EXISTS review_note,
          DROP COLUMN IF EXISTS reviewed_at,
          DROP COLUMN IF EXISTS reviewed_by_user_id;
        """
    )
