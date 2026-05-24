#!/bin/sh
set -eu

echo "Running database migrations..."
alembic upgrade head

echo "Seeding development admin if enabled..."
python -m app.scripts.seed_admin

echo "Starting NetUp API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
