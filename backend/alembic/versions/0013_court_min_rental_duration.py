"""court minimum rental duration

Revision ID: 0013_court_min_rental_duration
Revises: 0012_tournament_bank_transfer
Create Date: 2026-06-30
"""

from __future__ import annotations

from alembic import op

revision = "0013_court_min_rental_duration"
down_revision = "0012_tournament_bank_transfer"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE public.courts
          ADD COLUMN IF NOT EXISTS min_rental_duration_minutes integer
            NOT NULL DEFAULT 60;

        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'courts_min_rental_duration_minutes_check'
              AND conrelid = 'public.courts'::regclass
          ) THEN
            ALTER TABLE public.courts
              ADD CONSTRAINT courts_min_rental_duration_minutes_check
              CHECK (
                min_rental_duration_minutes IN (
                  30, 60, 90, 120, 150, 180, 210, 240, 270, 300
                )
              );
          END IF;
        END;
        $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE public.courts
          DROP CONSTRAINT IF EXISTS courts_min_rental_duration_minutes_check;

        ALTER TABLE public.courts
          DROP COLUMN IF EXISTS min_rental_duration_minutes;
        """
    )
