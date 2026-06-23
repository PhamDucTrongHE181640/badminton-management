"""add court minimum rental duration

Revision ID: 0013_court_min_rental_duration
Revises: 0012_tournament_bank_transfer
Create Date: 2026-06-23
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
          ADD COLUMN IF NOT EXISTS min_rental_duration_minutes integer;

        UPDATE public.courts
        SET min_rental_duration_minutes = 60
        WHERE min_rental_duration_minutes IS NULL;

        ALTER TABLE public.courts
          ALTER COLUMN min_rental_duration_minutes SET DEFAULT 60,
          ALTER COLUMN min_rental_duration_minutes SET NOT NULL;

        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.courts'::regclass
              AND conname = 'courts_min_rental_duration_minutes_check'
          ) THEN
            ALTER TABLE public.courts
              ADD CONSTRAINT courts_min_rental_duration_minutes_check
              CHECK (
                min_rental_duration_minutes IN (
                  30, 60, 90, 120, 150, 180, 210, 240, 270, 300
                )
              );
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # This column is part of the current base schema. Keep downgrade as a no-op
    # so rolling back this compatibility migration does not damage fresh schemas.
    pass
