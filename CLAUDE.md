# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Buymium consists of four independent applications (no npm workspaces/turborepo — just sibling folders, each with its own `package.json` and lockfile) connecting to the same MySQL database:

- `admin/backend` — Express.js API on port 5001 (management, analytics, Google Sheets sync, social auto-posting)
- `admin/frontend` — Vite + React 19 SPA on port 5173 (admin dashboard)
- `user/backend` — Express.js API on port 5000 (storefront, payments, Google OAuth)
- `user/frontend` — Next.js 16 app on port 3000 (customer-facing store, Indonesian language)

Both backends use the same `DATABASE_URL` (same MySQL server) but each has its **own separate `prisma/schema.prisma`** for client generation/type narrowing — they are not shared for that purpose. The admin schema is a superset covering more domain models (`Customer`, `Source`, `Account`, `Accsmarket`, `Sale`/`SaleLine`, `AutopostingPost`/`AutopostingSchedule`, `ProductSection`) alongside the common models. The user schema only has the core storefront models (`Role`, `User`, `Product`, `Order`, `BankAccount`, `Stock`, `Channel`, `Testimonial`, `OtpToken`, `AccountAccessLog`).

### Migrations are centralized in `db/`

`db/schema.prisma` is the **single canonical schema** (union of every model from both apps) and `db/migrations/` is the **single shared migration history** for the whole database. This exists because both backends used to run `prisma migrate dev/deploy` independently against the same MySQL database — since Prisma tracks applied migrations in one `_prisma_migrations` table per database (not per schema file), the two independent histories collided and produced stuck/failed migrations (duplicate-column errors) that blocked further deploys.

**Never run `prisma migrate dev/deploy` from `admin/backend` or `user/backend`** — `db/` is its own small npm project (`db/package.json`, own `node_modules`, own `.env` with `DATABASE_URL`) and is the only place migrations run:
```bash
cd db
npm run migrate          # prisma migrate dev
npm run migrate:deploy   # prisma migrate deploy (non-interactive/CI)
npm run migrate:status   # prisma migrate status
npm run generate         # prisma generate (for db/'s own client, rarely needed directly)
npm run studio           # prisma studio
```

Workflow for changing a shared model (e.g. `Product`, `Order`, `Stock`):
1. Edit `db/schema.prisma` (the canonical model definition).
2. `cd db && npm run migrate` to create+apply the migration into `db/migrations`.
3. Manually mirror the relevant fields into `admin/backend/prisma/schema.prisma` and/or `user/backend/prisma/schema.prisma` (each app only keeps the subset/shape it actually needs — e.g. `Account`/`Accsmarket` are read-only narrow projections on the user side).
4. Run `npm run prisma:generate` (admin) / regenerate the client in user backend so each app's typed client matches its own local schema.

`admin/backend`'s `prisma:push` script and `user/backend`'s `db:reset` script were removed — both bypassed the shared migration history (`db push`) or could drop/recreate every table in the database including the other app's models (`migrate reset --force`), which is too destructive now that the DB is shared across one migration lineage.

Note: the expense-tracking feature (`ExpenseCategory`/`Expense` models, `management/finance/expenses` controllers/routes/page) was removed — finance now only covers sales/analytics. Don't resurrect references to it.

## Commands

Each app is run independently from its own directory.

### Admin Backend (`admin/backend/`)
```bash
npm run dev          # tsx watch src/index.ts
npm run build        # tsc
npm run lint          # eslint src/
npm run test:run     # vitest run — single pass (no DB needed — Prisma is mocked)
npm run test         # vitest watch mode
npm run test:coverage
npx vitest run src/tests/routes/auth.test.ts  # run a single test file
npm run prisma:generate  # prisma generate (regenerate client after schema changes)
npm run seed         # tsx prisma/seed.ts
```

Note: `admin/backend` has no `typecheck` script — type errors surface via `npm run build` (`tsc`). It also has `test:smoke` and `test:load:*` (k6) scripts.

### Admin Frontend (`admin/frontend/`)
```bash
npm run dev          # vite
npm run build        # tsc -b && vite build
npm run lint
npm run typecheck    # tsc --noEmit
```

### User Backend (`user/backend/`)
```bash
npm run dev          # tsx watch src/index.ts
npm run build        # tsc
npm run test:run     # vitest run — single pass
npm run test         # vitest watch mode
npm run db:seed      # tsx prisma/seed.ts
npm run db:studio    # prisma studio
```
Note: `user/backend` has no `lint` or `typecheck` script — type errors surface via `npm run build`.

### User Frontend (`user/frontend/`)
```bash
npm run dev          # next dev --turbopack
npm run build        # next build
npm run lint
npm run typecheck    # tsc --noEmit
npm run test         # vitest run
```

## Architecture

### Auth Flow
Both backends use JWT Bearer tokens with a refresh token, but access-token lifetime differs per app: `admin/backend` issues a 7-day access token (`admin/backend/src/middleware/auth.ts`); `user/backend` issues a 1-hour access token (`user/backend/src/middleware/auth.ts` — shorter by design, not a bug). Both issue a 14-day refresh token. Tokens carry `{ userId, email, roleName, roleId }`.

The admin frontend stores tokens in localStorage and uses an Axios interceptor to auto-refresh on 401. The user frontend also stores tokens in localStorage (not cookies, despite the app being SSR-capable) via `contexts/auth-context.tsx`, which persists both the access and refresh token and exposes an `authFetch()` helper that transparently refreshes on a 401 and retries once before forcing logout — always use `authFetch` from `useAuth()` for authenticated calls in `user/frontend` rather than raw `fetch` with a manually attached `Authorization` header, or the 1-hour expiry will force users to re-login constantly.

Admin middleware: `requireAuth` checks any valid JWT; `requireAdmin` enforces `roleName === 'admin'`; `requireSuperAdmin` is currently an alias for `requireAdmin` (in `admin/backend/src/middleware/auth.ts`).

### Testing
Both backends mock Prisma via `vi.mock('@prisma/client')` — no real database connection needed. The mock instance is configured in `src/tests/setup.ts`. Use helpers from `src/tests/helpers.ts` to generate JWT tokens: `makeAdminToken()`, `makeSuperAdminToken()`, `makeUserToken()`, `makeExpiredToken()`. Tests run in a single fork (sequential) to avoid port conflicts. Test files are organized under `src/tests/routes/`, `src/tests/services/`, and `src/tests/lib/`.

The admin backend also has k6 load test scripts (`.js`) under `src/tests/load/` — these are run separately with the k6 CLI, not vitest.

### API Structure

**Admin backend** (`/api/`):
- `auth` — login, refresh, logout
- `management` — dashboard, customers, sources, finance (sales, analytics), stock (accounts, accsmarket), users
- `ecommerce` — orders, products, users, testimonials, sections, stats
- `autoposting` — social media scheduling
- `roles` — role management (note: there's both a top-level `routes/roles.ts` and `routes/management/roles.ts` — check which is mounted before adding to either)
- Swagger docs at `/api/docs`

**User backend** (`/api/`):
- `auth` — login, Google OAuth, registration, password reset
- `products`, `orders`, `stocks`, `bank-accounts`, `testimonials`, `sitemap`, `admin`
- Static file serving at `/api/uploads`
- Payment is manual bank transfer / QRIS only (buyer uploads proof, admin confirms) — no payment gateway integration.

### Frontend Routing

**Admin frontend** (React Router):
- `/management/*` — dashboard, finance, customers, sources, stock (accounts, accsmarket)
- `/autoposting/*` — social media content
- `/ecommerce/*` — orders, inventory, products

**User frontend** (Next.js App Router, Indonesian URLs):
- `/produk`, `/produk/[id]`, `/katalog` — product pages
- `/masuk` — login; `/auth/callback` — Google OAuth
- `/dashboard/pesanan`, `/dashboard/produk`, `/dashboard/profil` — user dashboard
- `/lupa-password`, `/reset-password` — password reset
- `/links`, `/kontak`, `/syarat`, `/faq`, `/refund` — link-in-bio page, contact, terms & conditions, FAQ, refund policy (legal pages share `components/legal-nav.tsx` and `components/legal-section.tsx`)


### User Backend Structure
Unlike the admin backend (controllers + services), the user backend uses a flat `models/` + `routes/` pattern with no separate service layer. Business logic lives directly in route handlers under `user/backend/src/routes/`. Additional directories: `validators/` for request validation schemas, `config/` for app configuration, `utils/` for shared helpers.

### Background Services (Admin Backend)
- `src/services/scheduler.ts` — cron job running at midnight: syncs Google Sheets → DB for all sources, scans follower counts via RapidAPI queue
- `src/services/cleanup.ts` — periodic cleanup of stale data
- `src/services/socialbu.ts` — social media auto-posting via Socialbu API
- `src/utils/rapidApiQueue.ts` — rate-limited queue for RapidAPI calls (follower scanning)
- `src/utils/encrypt.ts` — AES-256-GCM encryption/decryption using `ENCRYPTION_KEY` env var (used for storing sensitive account credentials)
- `src/utils/securityLogger.ts` — structured logging for auth failures and suspicious requests
- `src/utils/paginate.ts` — shared pagination helper used across management controllers

### State Management
- Admin: Zustand (with localStorage persistence) for auth/alerts; React Query for server state
- User: Redux Toolkit for global state; Next.js built-in caching for server state

### Database
Prisma 5 with MySQL, two independent schemas (see note above). Common models across both: `User`, `Role`, `Product`, `Order`, `Stock`, `BankAccount`, `Channel`, `Testimonial`. Admin-only models: `Customer`, `Source`, `Account`, `Accsmarket`, `Sale`/`SaleLine`, `AutopostingPost`/`AutopostingSchedule`, `ProductSection`.

The `db/` directory contains raw SQL scripts (schema, production data, fix scripts) used outside Prisma migrations.

## Repo Root

- `openapi.yaml` — documents the external SocialBu API (used by `admin/backend/src/services/socialbu.ts`), not Buymium's own API. Admin backend's own API is documented via Swagger at `/api/docs`.
- Admin frontend uses `@` as a path alias for `./src` (e.g. `@/lib/api`, `@/components/ui/button`).

## Environment Setup

Both backends require a `.env` file. Critical variables:
- `DATABASE_URL` — same MySQL connection string for both backends
- `JWT_SECRET` — minimum 32 characters, must match across both backends
- `ENCRYPTION_KEY` — 64-char hex (AES-256-GCM), must match across both backends
- `RESEND_API_KEY` — shared email service key
- Admin backend also needs `OPENAI_API_KEY`, `GOOGLE_SHEETS_CREDENTIALS` path, and Google Sheets service account JSON in `admin/backend/credentials/`
- User backend needs `GOOGLE_CLIENT_ID` for OAuth (see `admin/backend/.env.example` for the admin-side variable list)
