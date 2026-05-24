# NetUp Release Checklist (Sprint 9)

## Pre-Release
- [ ] All migrations reviewed and tested in staging.
- [ ] `pytest` suite green (unit + sprint smoke).
- [ ] Static export build produced from frontend (`out/`).
- [ ] Backup/restore drill completed with evidence.
- [ ] Load test baseline recorded.

## Security
- [ ] Admin brute-force rate limit validated.
- [ ] RBAC smoke tests for player/owner/admin pass.
- [ ] Secrets rotated and no plain secrets in repo.

## Go-Live
- [ ] Deploy backend and verify health.
- [ ] Deploy frontend static artifact.
- [ ] Verify admin dashboard metrics and audit logs.
- [ ] Verify booking/payment/check-in core path.

## Post-Release (First 60 Minutes)
- [ ] Monitor API 5xx, p95 latency, DB CPU/connections.
- [ ] Monitor booking conflict rate and webhook failures.
- [ ] Communicate release status to stakeholders.
