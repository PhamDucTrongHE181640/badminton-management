"""create session expenses tables

Revision ID: 0014_session_expenses
Revises: 0013_court_min_rental_duration
Create Date: 2026-07-05
"""

from __future__ import annotations

from alembic import op

revision = "0014_session_expenses"
down_revision = "0013_court_min_rental_duration"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.session_expenses (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
          title text NOT NULL,
          expense_date date NOT NULL,
          created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
          total_amount_vnd integer NOT NULL DEFAULT 0 CHECK (total_amount_vnd >= 0),
          split_amount_vnd integer NOT NULL DEFAULT 0 CHECK (split_amount_vnd >= 0),
          notes text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.session_expense_participants (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          expense_id uuid NOT NULL REFERENCES public.session_expenses(id) ON DELETE CASCADE,
          user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
          display_name text NOT NULL,
          is_guest boolean NOT NULL DEFAULT false,
          amount_paid_vnd integer NOT NULL DEFAULT 0 CHECK (amount_paid_vnd >= 0),
          amount_owed_vnd integer NOT NULL DEFAULT 0 CHECK (amount_owed_vnd >= 0),
          balance_vnd integer NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.session_expense_items (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          expense_id uuid NOT NULL REFERENCES public.session_expenses(id) ON DELETE CASCADE,
          name text NOT NULL,
          amount_vnd integer NOT NULL CHECK (amount_vnd >= 0),
          paid_by_participant_id uuid NOT NULL REFERENCES public.session_expense_participants(id) ON DELETE CASCADE,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS public.session_expense_payments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          expense_id uuid NOT NULL REFERENCES public.session_expenses(id) ON DELETE CASCADE,
          sender_participant_id uuid NOT NULL REFERENCES public.session_expense_participants(id) ON DELETE CASCADE,
          receiver_participant_id uuid NOT NULL REFERENCES public.session_expense_participants(id) ON DELETE CASCADE,
          amount_vnd integer NOT NULL CHECK (amount_vnd > 0),
          status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
          settled_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_session_expenses_session_id ON public.session_expenses(session_id);
        CREATE INDEX IF NOT EXISTS idx_session_expenses_date ON public.session_expenses(expense_date);
        CREATE INDEX IF NOT EXISTS idx_session_expense_participants_expense_id ON public.session_expense_participants(expense_id);
        CREATE INDEX IF NOT EXISTS idx_session_expense_items_expense_id ON public.session_expense_items(expense_id);
        CREATE INDEX IF NOT EXISTS idx_session_expense_payments_expense_id ON public.session_expense_payments(expense_id);

        DROP TRIGGER IF EXISTS set_session_expenses_updated_at ON public.session_expenses;
        CREATE TRIGGER set_session_expenses_updated_at
          BEFORE UPDATE ON public.session_expenses
          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

        DROP TRIGGER IF EXISTS set_session_expense_participants_updated_at ON public.session_expense_participants;
        CREATE TRIGGER set_session_expense_participants_updated_at
          BEFORE UPDATE ON public.session_expense_participants
          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TRIGGER IF EXISTS set_session_expense_participants_updated_at ON public.session_expense_participants;
        DROP TRIGGER IF EXISTS set_session_expenses_updated_at ON public.session_expenses;

        DROP TABLE IF EXISTS public.session_expense_payments;
        DROP TABLE IF EXISTS public.session_expense_items;
        DROP TABLE IF EXISTS public.session_expense_participants;
        DROP TABLE IF EXISTS public.session_expenses;
        """
    )
