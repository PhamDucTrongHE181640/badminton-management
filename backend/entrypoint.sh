#!/bin/sh
set -eu

echo "Running database migrations..."
alembic upgrade head

echo "Seeding development admin if enabled..."
python -m app.scripts.seed_admin

echo "Importing bulk users if enabled..."
python -m app.scripts.import_users

echo "Starting NetUp API..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  --reload-exclude 'uploads/*' \
  --reload-exclude '.pytest_cache/*' \
  --reload-exclude '.ruff_cache/*'
