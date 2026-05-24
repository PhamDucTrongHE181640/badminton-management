"""initial NetUp schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-24
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema_path = Path(__file__).resolve().parents[2] / "database" / "schema.sql"
    op.execute(schema_path.read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute(
        """
        DROP SCHEMA IF EXISTS public CASCADE;
        CREATE SCHEMA public;
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
        CREATE EXTENSION IF NOT EXISTS btree_gist;
        CREATE EXTENSION IF NOT EXISTS citext;
        """
    )
