# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Buymium consists of four independent applications (no npm workspaces/turborepo — just sibling folders, each with its own `package.json` and lockfile) connecting to the same MySQL database:

- `admin/backend` — Express.js API on port 5001 (management, analytics, Google Sheets sync, social auto-posting)
- `admin/frontend` — Vite + React 19 SPA on port 5173 (admin dashboard)
- `user/backend` — Express.js API on port 5000 (storefront, payments, Google OAuth)
- `user/frontend` — Next.js 16 app on port 3000 (customer-facing store, Indonesian language)

Both backends use the same `DATABASE_URL` (same MySQL server) but each has its **own separate `prisma/schema.prisma`** — they are not shared. The admin schema is a superset covering more domain models (`Customer`, `Source`, `Account`, `Accsmarket`, `Sale`/`SaleLine`, `AutopostingPost`/`AutopostingSchedule`, `ProductSection`) alongside the common models. The user schema only has the core storefront models (`Role`, `User`, `Product`, `Order`, `BankAccount`, `Stock`, `Channel`, `Testimonial`). When changing a shared model (e.g. `Product`, `Order`, `Stock`), update and migrate both schemas.

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
npx prisma migrate dev
npx prisma studio
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
npx prisma migrate dev  # db:migrate
npm run db:seed
npm run db:studio
npm run db:reset     # prisma migrate reset --force && seed
```
Note: `user/backend` has no `lint` or `typecheck` script — type errors surface via `npm run build`.

### User Frontend (`user/frontend/`)
```bash
npm run dev          # next dev --turbopack
npm run build        # next build
npm run lint
npm run typecheck    # tsc --noEmit
```
Note: `user/frontend` has no test script/suite.

## Architecture

### Auth Flow
Both backends use JWT Bearer tokens (7-day access, 14-day refresh). Tokens carry `{ userId, email, roleName, roleId }`. The admin frontend stores tokens in localStorage and uses an Axios interceptor to auto-refresh on 401. The user frontend stores tokens in cookies (SSR-friendly).

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
- `/links`, `/kontak`, `/syarat` — link-in-bio page, contact, terms & conditions


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
- User backend needs `GOOGLE_CLIENT_ID` for OAuth and `MIDTRANS_*` keys for payments
