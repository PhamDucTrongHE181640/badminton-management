"""video assessment jobs

Revision ID: 0004_video_assessments
Revises: 0003_user_sessions
Create Date: 2026-05-26
"""

from __future__ import annotations

from alembic import op

revision = "0004_video_assessments"
down_revision = "0003_user_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE public.admin_configs
        ADD COLUMN IF NOT EXISTS video_assessment_max_size_mb integer NOT NULL DEFAULT 5
          CHECK (video_assessment_max_size_mb BETWEEN 1 AND 100);

        ALTER TABLE public.admin_configs
        ADD COLUMN IF NOT EXISTS video_assessment_max_duration_seconds integer NOT NULL DEFAULT 60
          CHECK (video_assessment_max_duration_seconds BETWEEN 5 AND 300);

        CREATE TABLE IF NOT EXISTS public.video_assessments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          player_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          sport public.sport_type NOT NULL,
          storage_key text NOT NULL,
          original_filename text NOT NULL,
          mime_type text NOT NULL CHECK (
            mime_type IN ('video/mp4', 'video/quicktime', 'video/webm')
          ),
          file_size_bytes integer NOT NULL CHECK (file_size_bytes > 0),
          duration_seconds numeric(8,2) CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
          status text NOT NULL DEFAULT 'uploaded' CHECK (
            status IN ('uploaded', 'analyzing', 'completed', 'failed')
          ),
          llm_provider text NOT NULL DEFAULT 'gemini' CHECK (llm_provider = 'gemini'),
          llm_model text,
          llm_raw_response jsonb,
          normalized_result jsonb,
          computed_elo integer CHECK (computed_elo BETWEEN 100 AND 5000),
          computed_skill_tier public.skill_tier,
          confidence numeric(4,3) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
          error_message text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_video_assessments_player_active
        ON public.video_assessments(player_user_id)
        WHERE status IN ('uploaded', 'analyzing', 'completed');

        DROP TRIGGER IF EXISTS trg_video_assessments_updated_at ON public.video_assessments;
        CREATE TRIGGER trg_video_assessments_updated_at
        BEFORE UPDATE ON public.video_assessments
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

        CREATE INDEX IF NOT EXISTS idx_video_assessments_player_time
        ON public.video_assessments(player_user_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_video_assessments_status_time
        ON public.video_assessments(status, created_at DESC);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS public.idx_video_assessments_status_time;
        DROP INDEX IF EXISTS public.idx_video_assessments_player_time;
        DROP INDEX IF EXISTS public.ux_video_assessments_player_active;
        DROP TRIGGER IF EXISTS trg_video_assessments_updated_at ON public.video_assessments;
        DROP TABLE IF EXISTS public.video_assessments;
        ALTER TABLE public.admin_configs
          DROP COLUMN IF EXISTS video_assessment_max_duration_seconds;
        ALTER TABLE public.admin_configs
          DROP COLUMN IF EXISTS video_assessment_max_size_mb;
        """
    )
