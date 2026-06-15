"""tournament bank transfer instructions

Revision ID: 0012_tournament_bank_transfer
Revises: 0011_owner_posts_tournament_crud
Create Date: 2026-06-14
"""

from __future__ import annotations

from alembic import op

revision = "0012_tournament_bank_transfer"
down_revision = "0011_owner_posts_tournament_crud"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE public.tournaments
          ADD COLUMN IF NOT EXISTS bank_qr_image_url text,
          ADD COLUMN IF NOT EXISTS bank_transfer_caption text;

        ALTER TABLE public.tournament_registrations
          ADD COLUMN IF NOT EXISTS registration_code text;

        UPDATE public.tournament_registrations
        SET registration_code = 'TREG-' || upper(substr(replace(id::text, '-', ''), 1, 12))
        WHERE registration_code IS NULL OR btrim(registration_code) = '';

        ALTER TABLE public.tournament_registrations
          ALTER COLUMN registration_code SET NOT NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS ux_tournament_registrations_registration_code
          ON public.tournament_registrations(registration_code);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS public.ux_tournament_registrations_registration_code;

        ALTER TABLE public.tournament_registrations
          DROP COLUMN IF EXISTS registration_code;

        ALTER TABLE public.tournaments
          DROP COLUMN IF EXISTS bank_transfer_caption,
          DROP COLUMN IF EXISTS bank_qr_image_url;
        """
    )
