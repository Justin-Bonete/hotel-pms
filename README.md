# Hotel PMS

Multi-tenant Property Management System. Monorepo: pnpm + Turborepo.

## Quick start (Phase 1, steps 1-2)

```bash
cp .env.example .env
pnpm install
pnpm db:up                 # Postgres 16 + Redis (creates the pms_app runtime role on first start)
pnpm db:migrate            # prisma migrate dev --name init   (creates tables)
pnpm db:rls                # Row-Level Security policies + least-privilege grants
pnpm db:seed               # permissions, system roles, demo org "ABC Hospitality"
```

Re-run `pnpm db:rls` after every migration that adds tables.

## Layout

- `apps/api`: NestJS API (Prisma lives in `apps/api/prisma`)
- `apps/web`: Next.js app (arrives in step 10)
- `packages/*`: shared config, types, validation, utils, ui

## Database roles

| Role | Used for | RLS |
|---|---|---|
| `pms_owner` | migrations, seed (`DATABASE_URL`) | bypassed (table owner) |
| `pms_app` | API runtime (`APP_DATABASE_URL`) | enforced |

## Run the API (step 3)

```bash
pnpm install
pnpm dev            # builds shared packages, then starts the API on :4000
```

Check: http://localhost:4000/api/v1/health (liveness) and /api/v1/health/ready (database + Redis).

## Auth (step 4)

Endpoints under `/api/v1/auth`: `register`, `login`, `refresh`, `logout`, `me`, `sessions`, `sessions/:id` (DELETE),
`verify-email`, `resend-verification`, `forgot-password`, `reset-password`.
Emails are printed to the API console in development (no provider connected yet).
Smoke test: `powershell -File scripts/smoke-auth.ps1` while the API is running.

## Run order from a clean machine

1. `cp .env.example .env` (Windows: `Copy-Item .env.example .env`)
2. `pnpm install`
3. `pnpm db:up`
4. `pnpm db:migrate` (name it `init`)
5. `pnpm db:rls`
6. `pnpm db:seed`
7. `pnpm dev:api`

## Web app (UI)

Run the API and the web app in two terminals:

```bash
pnpm dev:api      # terminal 1  -> http://localhost:4000/api/v1/health
pnpm dev:web      # terminal 2  -> http://localhost:3000
```

Open **http://localhost:3000** (use `localhost`, not `127.0.0.1`, so the sign-in cookie is sent).
Demo login after `pnpm db:seed`: `owner@abc-hospitality.test` / the `SEED_OWNER_PASSWORD` from your `.env`.
