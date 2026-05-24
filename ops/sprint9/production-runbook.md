# NetUp Production Runbook (Sprint 9)

## Release Window Checklist
1. Freeze merge vào nhánh release.
2. Verify migration: `alembic upgrade head` trên staging.
3. Run smoke APIs: health, auth, booking, payments webhook, admin config.
4. Run backup drill command trước deploy.

## Deploy Steps
1. Pull image/tag mới cho `backend-api` và `frontend`.
2. Run DB migration.
3. Deploy `backend-api` rolling update.
4. Deploy `frontend` static artifact (`out/`) lên nginx host.
5. Run post-deploy smoke checks.

## Post-Deploy Smoke Checks
1. `GET /api/v1/health/live` and `GET /api/v1/health/ready` => `200`.
2. Admin login and `GET /api/v1/admin/dashboard/metrics` => `200`.
3. Player discovery and booking create returns expected status (`201` or handled `409`).
4. Owner check-in endpoint accessible with owner token.

## Rollback
1. Roll back backend image to previous stable tag.
2. Re-deploy previous frontend static artifact.
3. If migration caused issue, restore DB from latest validated backup.
4. Announce rollback status in incident channel.

## On-Call Contacts
- Release owner: `TBD`
- DB owner: `TBD`
- Infra owner: `TBD`
