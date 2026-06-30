"""court operating hours

Revision ID: 0014_court_operating_hours
Revises: 0013_court_min_rental_duration
Create Date: 2026-06-30
"""

from __future__ import annotations

from alembic import op

revision = "0014_court_operating_hours"
down_revision = "0013_court_min_rental_duration"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE public.courts
          ADD COLUMN IF NOT EXISTS open_time time NOT NULL DEFAULT '05:00:00',
          ADD COLUMN IF NOT EXISTS close_time time NOT NULL DEFAULT '22:30:00';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE public.courts
          DROP COLUMN IF EXISTS close_time,
          DROP COLUMN IF EXISTS open_time;
        """
    )
