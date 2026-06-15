"""owner post quotas, images, and tournament soft delete

Revision ID: 0011_owner_posts_tournament_crud
Revises: 0010_tournament_admin_profiles
Create Date: 2026-06-13
"""

from __future__ import annotations

from alembic import op

revision = "0011_owner_posts_tournament_crud"
down_revision = "0010_tournament_admin_profiles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE public.tournaments
          ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

        CREATE INDEX IF NOT EXISTS idx_tournaments_visible_status_start
          ON public.tournaments(status, start_date DESC)
          WHERE deleted_at IS NULL;

        ALTER TABLE public.courts
          ADD COLUMN IF NOT EXISTS image_url text;

        ALTER TABLE public.sessions
          ADD COLUMN IF NOT EXISTS image_url text,
          ADD COLUMN IF NOT EXISTS description text;

        CREATE TABLE IF NOT EXISTS public.owner_post_quotas (
          owner_user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
          rental_post_limit integer NOT NULL DEFAULT 10 CHECK (rental_post_limit >= 0),
          slot_post_limit integer NOT NULL DEFAULT 10 CHECK (slot_post_limit >= 0),
          updated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        DROP TRIGGER IF EXISTS trg_owner_post_quotas_updated_at ON public.owner_post_quotas;
        CREATE TRIGGER trg_owner_post_quotas_updated_at
        BEFORE UPDATE ON public.owner_post_quotas
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

        CREATE INDEX IF NOT EXISTS idx_owner_post_quotas_limits
          ON public.owner_post_quotas(rental_post_limit, slot_post_limit);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS public.idx_owner_post_quotas_limits;
        DROP TRIGGER IF EXISTS trg_owner_post_quotas_updated_at ON public.owner_post_quotas;
        DROP TABLE IF EXISTS public.owner_post_quotas;

        ALTER TABLE public.sessions
          DROP COLUMN IF EXISTS description,
          DROP COLUMN IF EXISTS image_url;

        ALTER TABLE public.courts
          DROP COLUMN IF EXISTS image_url;

        DROP INDEX IF EXISTS public.idx_tournaments_visible_status_start;

        ALTER TABLE public.tournaments
          DROP COLUMN IF EXISTS deleted_at;
        """
    )
