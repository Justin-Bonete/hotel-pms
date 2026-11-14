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

## Permissions (step 5)

- Catalog and system roles: `packages/types/src/permissions.ts` (one source for API, seed and web).
- **Deny by default:** every route must be `@Public()`, `@Authenticated()` or `@RequirePermission('x.y')`.
- Role scope: ORGANIZATION (everywhere), GROUP (a group's properties) or PROPERTY. Organization-level permissions
  (create property, manage roles...) only count at ORGANIZATION scope.
- Property switcher: send `X-Property-Id: <uuid>` (or `ALL`). The API verifies you may see that property.
- Endpoints: `GET /rbac/me`, `GET /rbac/roles`, `GET /rbac/permissions`.
- Tests: `pnpm test` (unit, no database) and `pnpm test:int` (tenant isolation against Docker Postgres).

## Rooms (Phase 2) and property management (step 6)

Apply after pulling these changes (in this order):

```bash
pnpm install
pnpm build:packages
pnpm db:migrate     # name it: phase2_rooms
pnpm db:rls         # adds row-level security + unique indexes for the new tables
pnpm db:seed        # refreshes role permissions and adds demo rooms (only to properties with none)
```

Then `pnpm test`, `pnpm test:int`, `pnpm dev:api`, `pnpm dev:web`.

New API routes (all permission-checked and audit-logged): `/properties` (create, edit, archive), `/property-groups`,
`/properties/:id/structure|buildings|room-types|rooms`, `/room-types/:id`, `/rooms/:id`, `/rooms/:id/status`.

## Guests, rates, reservations, calendar (Phase 3a)

```bash
pnpm install
pnpm build:packages
pnpm db:migrate     # name it: phase3a_reservations
pnpm db:rls         # security rules + the database-level double-booking guard (exclusion constraint)
pnpm db:seed        # demo guests, a default rate plan per property, and reservations around today
pnpm test && pnpm test:int
```

If `db:migrate` reports **"Drift detected"** (Prisma notices the extra constraints/indexes that `db:rls` adds), it is a
development database: run `pnpm db:reset` (drops, re-migrates, re-applies the rules, re-seeds). Never do this in production.

Rules enforced by the API (and, for double-booking, by PostgreSQL itself):
- Stays are dates; the departure day is free again (same-day turnover works). Money is whole centavos.
- Every night of a stay needs a free room of the booked type; bookings for the same room type take turns (advisory lock).
- A room can never hold two active stays that overlap (exclusion constraint), even if application code is bypassed.
- Check-in needs a clean room (Available or Inspected); check-out marks the room Dirty so housekeeping sees it at once.
- Housekeeping, maintenance and cashier roles cannot see guests, reservations or rates.

## Billing: folios, taxes, payments, refunds (Phase 3b)

```bash
pnpm install
pnpm build:packages
pnpm db:migrate     # name it: phase3b_billing
pnpm db:rls         # adds the billing tables to row-level security and makes the money ledger APPEND-ONLY
pnpm db:seed        # demo taxes (VAT, service charge), folios for in-house/past stays, deposits
pnpm test && pnpm test:int
```

If `db:migrate` says "Drift detected", run `pnpm db:reset` (development database only).

How money works (the rules the code enforces):
- Amounts are whole centavos, never decimals. Taxes are percentages in basis points (1200 = 12%), rounded half-up per line.
- **Append-only ledger.** The application can add folio lines, payments and refunds but the database role it uses cannot
  update or delete them. A mistake is fixed by a reversing line (a "void"), and a line can be voided only once.
- Room nights (and their taxes) are posted automatically at check-in at the price quoted at booking. Extras are posted by
  front desk while the guest is in-house. Discounts/adjustments and voids need `folio.adjust` (managers).
- **Check-out requires a settled folio.** Only a manager with `folio.override_checkout` can check a guest out with a
  balance due or a credit; the override is written to the audit log with the amount.
- Payments and refunds accept an `Idempotency-Key` header: replaying the same request never posts twice.
  Refunds can never exceed what was paid (and concurrent refunds take turns).
- Tax and rate changes apply to future charges only; existing folios are never rewritten. Prices are tax-exclusive.
- Folios print through the browser (Print button; choose "Save as PDF" for a receipt).

## Operations: staff, housekeeping, maintenance, front desk, live updates (Phase 4)

```bash
pnpm install
pnpm build:packages
pnpm db:migrate     # name it: phase4_operations   (adds the CLEAN room status, housekeeping tasks, maintenance tickets)
pnpm db:rls
pnpm db:seed        # demo staff, tasks and tickets (see logins below)
pnpm test && pnpm test:int
```

If `db:migrate` says "Drift detected", run `pnpm db:reset` (development database only).

Demo logins (password is your `SEED_OWNER_PASSWORD`, `ChangeMe!12345` by default), all `@abc-hospitality.test`:
`owner@`, `manager@`, `frontdesk@`, `supervisor@`, `housekeeper1@`, `housekeeper2@`, `maintenance@`.
Sign in as `housekeeper1@` on a phone-sized window to see "My tasks".

How it works:
- **Room flow:** Dirty -> Cleaning -> Clean (to inspect) -> Available. The housekeeper starts and finishes; a supervisor passes or fails the inspection. A stayover never changes the room.
- **Check-out automatically creates a cleaning task** (HIGH priority if another guest arrives in that room today) and marks the room Dirty. A partial unique index guarantees one open task per room and kind.
- **Maintenance:** a ticket can take a room out of service; resolving it returns the room as Dirty and creates a cleaning task. A room with a guest in it can't be taken out of service.
- **Staff:** you can only give a role you could exercise yourself, at a scope you cover. Managers cannot touch owners, nobody can change their own access, and the last owner can never be removed or disabled. Disabling signs the person out everywhere at once.
- **Live updates:** Server-Sent Events over Redis. Events carry ids only and are sent after the database commit; screens refetch through the normal permission-checked API. If the stream drops, screens still refresh on timers.
- **Extend stay:** an in-house guest's departure can be moved later if the room is free; the added nights and taxes are billed to the folio.

## Inventory, purchasing and expenses (Phase 5a)

```bash
pnpm install
pnpm build:packages
pnpm db:migrate     # name it: phase5a_business
pnpm db:rls         # RLS, the append-only stock ledger, and the money/stock constraints
pnpm db:seed        # demo suppliers, 12 items with stock (some low/out), purchase orders in every state, expenses
pnpm test && pnpm test:int
```

If `db:migrate` says "Drift detected", run `pnpm db:reset` (development database only).

The rules the code enforces:
- **Stock is a ledger.** Every change is a permanent movement the application can add but never edit or delete (enforced by database permissions). On-hand stock is the sum of a property's movements. Stock can never go below zero, and changes to the same stock take turns (advisory lock).
- **Transfers** move stock between two properties atomically and need inventory access at both.
- **Purchasing:** request -> approve -> receive -> invoice -> pay. You cannot approve your own request, unless nobody else could approve it there (a one-manager hotel; the audit log records it). Goods can never be received beyond what was ordered. A line total never changes after the request.
- **Invoice matching:** an invoice is compared with the value of goods actually received; any difference is flagged on screen and in the audit log. It is never silently accepted.
- **Paying a supplier invoice** marks it paid and records the expense in one step, exactly once.
- **Expenses** are never deleted; a wrong entry is voided with a reason. Voided entries don't count in totals.
- Receipt/photo attachments are "coming soon" (they need document storage).

## Point of sale and the dashboard (Phase 5b)

```bash
pnpm install
pnpm build:packages
pnpm db:migrate     # name it: phase5b_pos
pnpm db:rls
pnpm db:seed        # demo outlets (Grand Café, Skyline Bar, Room Service), menus, three sales today
pnpm test && pnpm test:int
```

If `db:migrate` says "Drift detected", run `pnpm db:reset` (development database only).

Try it as `owner@abc-hospitality.test` (or `frontdesk@...`, who can sell but not void): open **POS**, tap items, then either **Pay now** or **Charge to room** (pick a guest who is checked in; check one in first from Reservations if none are).

The rules the code enforces:
- **The till never sets prices.** It sends only what was sold and how many; the server uses the menu price and the property's taxes at that moment. Changing a menu price never changes past sales.
- **A sale is immutable.** Its lines can never be changed or deleted (database permissions). The only change allowed is a **void** with a reason, by someone with `pos.void` (managers); voids are never deleted either.
- **Room charge** posts to the guest's bill in the same transaction, only for a guest who is checked in and whose bill is still open. The receipt total always equals what lands on the bill (same per-line tax rounding).
- **Voiding a room charge** appends reversal lines to the bill (nothing is erased) and puts used stock back. If the bill is already closed, the void is refused with a clear message. A voided cash/card sale does not refund money: hand it back yourself.
- **Stock-tracked items** (e.g. bottled water) use up stock on each sale and are **refused when there isn't enough**, using the same lock as the Inventory screens, so two tills can't both sell the last bottle.
- **Pressing twice or retrying** never creates a second sale (request key).
- **Daily report** uses the property's own day (its time zone, including daylight saving), counts voided sales separately and never inside sales.
- **Dashboard:** Arrivals, Departures, In house, Occupancy and Dirty rooms are live. Occupancy = guests in house ÷ rooms that can be sold. Revenue, ADR and RevPAR come with analytics (they need date ranges and every revenue source).
