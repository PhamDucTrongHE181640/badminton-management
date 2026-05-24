# NetUp Frontend

Next.js 15 UI shell for the NetUp web application.

## Development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

The app runs at http://localhost:3000.

## Environment

Copy local env:

```bash
cp .env.example .env
```

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

The Sprint 0 dashboard calls:

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`

Hidden admin routes:

- `/_internal/netup-admin/login`
- `/_internal/netup-admin/dashboard`

Google auth callback:

- `/auth/google/callback`

## Build

```bash
pnpm build
```

## Current Scope

Sprint 0 provides the operational dashboard and service health display. Sprint 1
adds local admin login and Google auth callback handling. Player and Owner domain
workflows remain placeholders until their API sprints are implemented.
