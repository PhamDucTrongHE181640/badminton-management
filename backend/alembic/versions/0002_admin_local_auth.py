"""admin local auth

Revision ID: 0002_admin_local_auth
Revises: 0001_initial_schema
Create Date: 2026-05-24
"""

from __future__ import annotations

from alembic import op

revision = "0002_admin_local_auth"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.admin_accounts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
          username citext NOT NULL UNIQUE,
          password_hash text NOT NULL,
          is_active boolean NOT NULL DEFAULT true,
          is_super_admin boolean NOT NULL DEFAULT false,
          last_login_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.admin_sessions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          admin_account_id uuid NOT NULL REFERENCES public.admin_accounts(id) ON DELETE CASCADE,
          refresh_token_hash text NOT NULL UNIQUE,
          ip text,
          user_agent text,
          expires_at timestamptz NOT NULL,
          revoked_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          CHECK (revoked_at IS NULL OR revoked_at >= created_at),
          CHECK (expires_at > created_at)
        );

        CREATE TABLE IF NOT EXISTS public.admin_login_audits (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          admin_account_id uuid REFERENCES public.admin_accounts(id) ON DELETE SET NULL,
          username_attempt citext NOT NULL,
          success boolean NOT NULL,
          ip text,
          user_agent text,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        DROP TRIGGER IF EXISTS trg_admin_accounts_updated_at ON public.admin_accounts;
        CREATE TRIGGER trg_admin_accounts_updated_at
        BEFORE UPDATE ON public.admin_accounts
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

        CREATE INDEX IF NOT EXISTS idx_admin_sessions_account_active
        ON public.admin_sessions(admin_account_id, expires_at)
        WHERE revoked_at IS NULL;

        CREATE INDEX IF NOT EXISTS idx_admin_login_audits_created
        ON public.admin_login_audits(created_at DESC);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE IF EXISTS public.admin_login_audits;
        DROP TABLE IF EXISTS public.admin_sessions;
        DROP TABLE IF EXISTS public.admin_accounts;
        """
    )
