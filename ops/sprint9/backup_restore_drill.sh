#!/usr/bin/env bash
set -euo pipefail

# Sprint 9 backup/restore drill for local Docker Compose environment.
# Requires running services: postgres, backend-api.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/ops/sprint9/artifacts"
mkdir -p "${BACKUP_DIR}"

STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="${BACKUP_DIR}/netup-${STAMP}.dump"
RESTORE_DB="netup_restore_drill"

cd "${ROOT_DIR}"

echo "[1/6] Creating pg_dump -> ${DUMP_FILE}"
docker compose exec -T postgres pg_dump \
  -U netup \
  -d netup \
  -F c \
  -f /tmp/netup.dump

docker compose cp postgres:/tmp/netup.dump "${DUMP_FILE}"

echo "[2/6] Creating restore database ${RESTORE_DB}"
docker compose exec -T postgres psql -U netup -d postgres -c "DROP DATABASE IF EXISTS ${RESTORE_DB};"
docker compose exec -T postgres psql -U netup -d postgres -c "CREATE DATABASE ${RESTORE_DB};"

echo "[3/6] Uploading dump file into postgres container"
docker compose cp "${DUMP_FILE}" postgres:/tmp/netup-restore.dump

echo "[4/6] Restoring backup into ${RESTORE_DB}"
docker compose exec -T postgres pg_restore \
  -U netup \
  -d "${RESTORE_DB}" \
  --clean --if-exists \
  /tmp/netup-restore.dump

echo "[5/6] Verifying core table counts"
docker compose exec -T postgres psql -U netup -d "${RESTORE_DB}" -c "SELECT 'users' AS table_name, count(*) FROM public.users;"
docker compose exec -T postgres psql -U netup -d "${RESTORE_DB}" -c "SELECT 'bookings' AS table_name, count(*) FROM public.bookings;"
docker compose exec -T postgres psql -U netup -d "${RESTORE_DB}" -c "SELECT 'payment_transactions' AS table_name, count(*) FROM public.payment_transactions;"

echo "[6/6] Cleanup temp files in container"
docker compose exec -T postgres rm -f /tmp/netup.dump /tmp/netup-restore.dump

echo "Backup/restore drill completed successfully. Artifact: ${DUMP_FILE}"
