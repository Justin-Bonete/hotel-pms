# Hotel PMS: living checklist

Update this file at the end of every phase so nothing is forgotten. Tick things off here, not in your head.

## Built (✔) and what each phase added

| Phase | Zip | Contents |
|---|---|---|
| 1 Foundation | `phase1-step1-2` … `with-ui` | Multi-tenant database with Row Level Security, auth (rotating refresh tokens, lockout, sessions, email verify, password reset), deny-by-default RBAC with 12 system roles and scoped assignments, audit log (recorded), web shell |
| 2 Property core | `phase2-rooms` | Properties, property groups, buildings/floors, room types, rooms, room status board |
| 3a Reservations | `phase3a-reservations` | Guests, rate plans, reservations, calendar, availability, double-booking exclusion constraint |
| 3b Billing | `phase3b-billing` | Folios, taxes, payments/refunds, append-only money ledger, check-out rules, printing |
| 4 Operations | `phase4-operations` | Staff management, housekeeping, maintenance, front desk, live updates, extend stay |
| 5a Business | `phase5a-business` | Inventory (stock ledger), suppliers, purchasing (approve, receive, invoice, pay), expenses |
| 5b POS | `phase5b-pos` | POS outlets/menus/sales, room charges, voids, daily report, dashboard "Today" numbers |
| 6 Analytics | `phase6-analytics` | Revenue, Occupancy, ADR, RevPAR, trends, previous-period comparison, property comparison, 5 reports with CSV export |
| 7a Integrations | `phase7a-integrations` | API keys, public booking API (availability, book, look up), signed webhooks with retries and a delivery log, real email through resend.com |

## Still to build (in order)

### Phase 7b: provider connectors (need YOUR accounts, so they wait for you)
- [ ] Channel manager / OTA sync (availability, rates, reservations) behind a connector interface
- [ ] Payment gateway connector (card / e-wallet, for example PayMongo, Xendit, Maya) and taking a deposit at online booking
- [ ] SMS delivery (for example Semaphore or Twilio)
- [ ] Accounting export (CSV/Excel ledger of folios, payments and expenses)
- [ ] Allowed-origins per API key (so a key can be used safely from a browser widget)
- [ ] More webhook events (check-in/out detail, housekeeping, maintenance, inventory low-stock)

### Phase 8: Advanced
- [ ] Automation rules (e.g. "when a room is dirty for 2 hours, alert the supervisor")
- [ ] AI assistant / insights groundwork
- [ ] PWA / installable app, offline-friendly housekeeping
- [ ] Marketplace / extension points
- [ ] Multi-language, multi-currency display

### Cross-cutting items that are NOT done yet (do not forget)
- [ ] **Audit log viewer** screen (the log is recorded everywhere but there is no screen to read it)
- [ ] **Notifications center** and **alert center** (low stock, overdue supplier invoices, overstays, unpaid balances, failed jobs)
- [ ] **Global search** (the top bar search box is a placeholder)
- [ ] **Document and photo uploads** (needs object storage): maintenance photos, expense receipts, guest ID documents
- [ ] **Onboarding wizard** for a brand-new organization
- [ ] **Owner command center** and **dashboard customization**
- [ ] **Custom role editor** (system roles exist; editing/creating roles in the UI does not)
- [ ] **Design system package** (shared UI components extracted from the app)
- [ ] Two-factor authentication, session management screen, security settings
- [ ] Data backup/restore tooling and a production deployment guide (Docker image, environment checklist, monitoring)
- [ ] Load testing and a security review before any real hotel uses it

## Known limitations (deliberate, documented)
- Early check-in / late check-out **time of day** is not modeled (only dates).
- Analytics: **available room nights use today's room count**; a room's past out-of-service days are not tracked.
- Analytics: **discounts and adjustments** on guest bills are not deducted from revenue yet.
- Analytics: a CONFIRMED booking whose past night never became a check-in is **not counted** as sold (staff should mark it no-show).
- Analytics "revenue minus expenses" is an **operating view, not accounting profit**.
- Inventory quantities are **whole units** (use grams/millilitres for fractions).
- POS: a voided cash/card sale **does not refund money**; a room charge on an already-closed bill can't be voided from the POS.
- Purchasing: self-approval is allowed only when nobody else could approve at that property (audited).
- The reservation `PENDING` status does not count toward occupancy.
- **Webhooks are delivered at least once**: a receiver must ignore an event id it has already seen. Messages can arrive out of order after retries.
- **The booking API is for servers.** A key must never be placed in web page JavaScript. There is no browser (CORS) access to it yet.
- Online bookings start **PENDING** (they hold the room but the hotel must confirm) unless the key is set to auto-confirm. No payment is taken at booking yet.
- In development webhooks may point at localhost for testing; in production private-network addresses are refused (checked again at every connection).
- Email is plain text through resend.com only; no templates or HTML yet. Without `MAIL_PROVIDER=resend` emails print in the API console.
- Root `pnpm dev` crashes on the author's Windows machine; run `pnpm dev:api` and `pnpm dev:web` in two terminals.

## Migration names (so they are never forgotten)

| When | Name to use with `pnpm db:migrate` |
|---|---|
| Phase 4 | `phase4_operations` |
| Phase 5a | `phase5a_business` |
| Phase 5b | `phase5b_pos` |
| Phase 6 | none (no database change) |
| Phase 7a | `phase7a_integrations` |
| Applying 4 + 5a + 5b together in one go | `phase5_operations_business_pos` |

Names are lowercase with underscores. Never rename a migration that has been applied to a database that holds real data.

## Every phase: the apply checklist
1. Copy the zip over the project folder.
2. **Stop the dev servers** (Ctrl+C in both terminals): on Windows a running API locks the Prisma files and `migrate` fails with EPERM.
3. `pnpm install` then `pnpm build:packages`
4. `pnpm db:migrate` (this also regenerates the Prisma client, which fixes red errors like "Property 'apiKey' does not exist"; only when the phase says it changes the database), then `pnpm db:rls`, then `pnpm db:seed`
5. `pnpm test` and `pnpm test:int`
6. Start `pnpm dev:api` and `pnpm dev:web` again and restart the TypeScript server in VS Code (it caches old types).
7. If "Drift detected": `pnpm db:reset` (development database only; it erases local data).
8. `git add -A`, `git commit`, `git pull --rebase`, `git push`. Never `git push --force`.
