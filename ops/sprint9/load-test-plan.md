# Sprint 9 Load Test Plan

## Scope
- Discovery peak (`GET /api/v1/player/discovery/sessions`)
- Booking contention under load (`POST /api/v1/player/bookings`)
- Optional chat room traffic (`/api/v1/player/chat/*` and websocket)

## Tooling
- Primary: `k6`
- Script: `ops/sprint9/loadtest/k6_peak.js`

## Preconditions
1. Services are up (`frontend`, `backend-api`, `postgres`, `redis`).
2. Seed data includes at least 1 active session with open slots.
3. Test token is prepared for a dedicated load-test user.

## Run
```bash
API_BASE=http://localhost:8000 USER_ACCESS_TOKEN=<token> k6 run ops/sprint9/loadtest/k6_peak.js
```

## Success Criteria
1. `http_req_failed < 2%`
2. `p95 < 800ms`, `p99 < 1500ms`
3. No duplicate active booking for same user/session.
4. No DB deadlock causing 500 spike.

## Post-Run Checks
1. Review `backend-api` logs for `booking_conflict` distribution.
2. Confirm no overbook (`sessions.open_slots` never below 0).
3. Compare booking counts vs payment transaction counts for consistency.
