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

The dev container seeds a local admin account when `ADMIN_SEED_ENABLED=true`.

## User Auth Endpoints

- `GET /api/v1/auth/google/start`
- `GET /api/v1/auth/google/callback`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

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
