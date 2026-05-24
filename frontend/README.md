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
- `/_internal/netup-admin/owner-requests`

Owner routes:

- `/owner/dashboard`
- `/owner/courts`
- `/owner/check-in`

Player routes:

- `/player/discovery`
- `/player/booking/[sessionId]`
- `/player/bookings`

Google auth callback:

- `/auth/google/callback`

## Build

```bash
pnpm build
```

## Troubleshooting

- If you hit runtime errors like `Cannot find module './979.js'`, clear the Next.js build cache:

```bash
rm -rf .next
pnpm dev
```

## Current Scope

Sprint 0 provides the operational dashboard and service health display. Sprint 1
adds local admin login and Google auth callback handling. Sprint 2 adds owner
onboarding, admin owner approval, and owner court/session inventory screens
connected to the FastAPI backend. Sprint 3 adds player discovery and booking
flows connected to live APIs.
