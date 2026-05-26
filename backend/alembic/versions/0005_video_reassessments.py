"""allow repeated completed video assessments

Revision ID: 0005_video_reassessments
Revises: 0004_video_assessments
Create Date: 2026-05-26
"""

from __future__ import annotations

from alembic import op

revision = "0005_video_reassessments"
down_revision = "0004_video_assessments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS public.ux_video_assessments_player_active;

        CREATE UNIQUE INDEX IF NOT EXISTS ux_video_assessments_player_active
        ON public.video_assessments(player_user_id)
        WHERE status IN ('uploaded', 'analyzing');
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS public.ux_video_assessments_player_active;

        CREATE UNIQUE INDEX IF NOT EXISTS ux_video_assessments_player_active
        ON public.video_assessments(player_user_id)
        WHERE status IN ('uploaded', 'analyzing', 'completed');
        """
    )
