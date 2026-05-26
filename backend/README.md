# NetUp Backend

FastAPI backend foundation for NetUp.

## Development

```bash
python -m pip install -e ".[dev]"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Environment

Copy local env:

```bash
cp .env.example .env
```

```bash
APP_ENV=development
DATABASE_URL=postgresql+psycopg://netup:netup@localhost:5432/netup
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:3000
FRONTEND_BASE_URL=http://localhost:3000
APP_SECRET_KEY=dev-only-change-me
ADMIN_SEED_ENABLED=true
ADMIN_SEED_USERNAME=admin
ADMIN_SEED_PASSWORD=admin12345
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback
ADMIN_LOGIN_MAX_ATTEMPTS=5
ADMIN_LOGIN_WINDOW_MINUTES=15
ADMIN_LOGIN_BLOCK_MINUTES=15
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_TIMEOUT_SECONDS=45
VIDEO_ASSESSMENT_MAX_SIZE_MB=5
VIDEO_ASSESSMENT_MAX_DURATION_SECONDS=60
```

## Migrations

The initial Alembic migration executes `database/schema.sql`.

```bash
alembic upgrade head
```

## Checks

```bash
python -m ruff check .
python -m pytest
```

## Health Endpoints

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`

## Admin Auth Endpoints

- `POST /api/v1/admin/auth/login`
- `POST /api/v1/admin/auth/refresh`
- `POST /api/v1/admin/auth/logout`
- `GET /api/v1/admin/auth/me`

## Admin Operations Endpoints

- `GET /api/v1/admin/config`
- `PUT /api/v1/admin/config`
- `GET /api/v1/admin/dashboard/metrics`
- `GET /api/v1/admin/audit-logs`

The dev container seeds a local admin account when `ADMIN_SEED_ENABLED=true`.
Admin login brute-force protection applies per username/IP window and returns
`429 admin_login_rate_limited` when the threshold is exceeded.

## User Auth Endpoints

- `GET /api/v1/auth/google/start`
- `GET /api/v1/auth/google/callback`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

## Owner Onboarding Endpoints

- `POST /api/v1/owner/requests`
- `GET /api/v1/owner/requests/me`
- `GET /api/v1/admin/owner-requests`
- `POST /api/v1/admin/owner-requests/{id}/approve`
- `POST /api/v1/admin/owner-requests/{id}/reject`

## Owner Inventory Endpoints

- `GET/POST/PATCH/DELETE /api/v1/owner/court-complexes`
- `GET/POST/PATCH/DELETE /api/v1/owner/courts`
- `GET/POST/PATCH/DELETE /api/v1/owner/sessions`

Session creation and updates validate owner ownership, duration limits, skill
range, open slot capacity, and active-session time overlap before writing to
Postgres.

## Player Discovery and Booking Endpoints

- `GET /api/v1/player/discovery/sessions`
- `GET /api/v1/player/sessions/{id}`
- `POST /api/v1/player/bookings`
- `GET /api/v1/player/bookings`
- `GET /api/v1/player/bookings/{id}`
- `POST /api/v1/player/bookings/{id}/deposit-payment`
- `POST /api/v1/payments/vnpay/webhook`

Booking creation enforces slot limits (`solo` and `full_court`), creates payment
plan transactions (`deposit` + `remaining`), and locks session slots in one
transaction.

## Owner Check-in Endpoints

- `GET /api/v1/owner/checkins`
- `POST /api/v1/owner/checkins`

## Match and Feedback Endpoints

- `POST /api/v1/player/video-assessments`
- `GET /api/v1/player/video-assessments/{assessment_id}`
- `POST /api/v1/player/matches`
- `GET /api/v1/player/matches/{match_id}`
- `POST /api/v1/player/matches/{match_id}/feedback`
- `POST /api/v1/player/matches/{match_id}/finalize`
- `GET /api/v1/player/matches/history/list`

API errors use:

```json
{
  "error": {
    "code": "database_unavailable",
    "message": "Database readiness check failed",
    "request_id": "..."
  }
}
```
