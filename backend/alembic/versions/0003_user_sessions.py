"""user app sessions

Revision ID: 0003_user_sessions
Revises: 0002_admin_local_auth
Create Date: 2026-05-24
"""

from __future__ import annotations

from alembic import op

revision = "0003_user_sessions"
down_revision = "0002_admin_local_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.user_sessions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          refresh_token_hash text NOT NULL UNIQUE,
          ip text,
          user_agent text,
          expires_at timestamptz NOT NULL,
          revoked_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          CHECK (revoked_at IS NULL OR revoked_at >= created_at),
          CHECK (expires_at > created_at)
        );

        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
        ON public.user_sessions(user_id, expires_at)
        WHERE revoked_at IS NULL;
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.user_sessions;")
