# Reward Agency Dashboard — Project Memory

## Project Overview

A financial management dashboard for **Reward Agency**, a digital advertising agency that manages ad spend on behalf of clients across Meta, Google, TikTok, Snapchat, and LinkedIn.

**Three portals:**
- **Agency portal** (`/dashboard`, `/clients`, etc.) — for admin, team, and accountant roles
- **Client portal** (`/portal/*`) — clients view their balance, ad accounts, transactions, top-up requests
- **Affiliate portal** (`/affiliate/*`) — affiliates track referrals and commissions

All UI is in **English**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router, TypeScript strict mode |
| Database | PostgreSQL via Neon serverless (`@neondatabase/serverless`, neon-http driver) |
| ORM | Drizzle ORM (`drizzle-orm/neon-http`) |
| Auth | NextAuth.js v5 beta (`next-auth@^5.0.0-beta.30`), JWT strategy, credentials provider |
| Styling | Tailwind CSS v3 + `cn()` utility (clsx + tailwind-merge) |
| Icons | lucide-react |
| Validation | Zod v4 (uses `.issues` not `.errors`) |
| Testing | Node.js built-in `node:test` + `tsx --test` |
| Deployment | Vercel (planned, Sprint 11) |

**Neon DB connection string:**
```
postgresql://neondb_owner:npg_f7G5AzjVZsDT@ep-shiny-wave-amz1mjo0-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**GitHub:** https://github.com/RewardAgency2026/reward-agency-dashboard.git

**Important:** Neon HTTP driver does NOT support multi-statement SQL transactions. Use single atomic INSERT/UPDATE operations.

---

## Database — 13 Tables

### `affiliates`
Affiliate partners who refer clients. Must be defined before `clients` (FK dependency).
- `id` uuid PK, `affiliate_code` text unique (AFF-0001), `name`, `email` unique, `company`
- `billing_address`, `billing_vat`, `commission_rate` numeric(5,2)
- `referral_link`, `password_hash` nullable (set when affiliate activates account)
- `status` text default "active" (active|inactive)

### `users`
Agency staff accounts (admin, team, accountant).
- `id` uuid PK, `email` unique, `name`, `password_hash`, `role` (admin|team|accountant)

### `clients`
Client accounts with wallet configuration.
- `id` uuid PK, `client_code` text unique (RWD-0001), `name`, `email` unique, `company`
- `balance_model` text (classic|dynamic) — **immutable after creation**
- `crypto_fee_rate` numeric(5,2) default 0
- `billing_currency` (USD|EUR), `status` (active|paused|churned)
- `affiliate_id` uuid FK → affiliates (nullable, set null on delete)
- `onboarding_source` (manual|affiliate_link)
- `notes` text nullable
- `has_setup` boolean default false
- `setup_monthly_fee` numeric(10,2) nullable — charged to client
- `setup_monthly_cost` numeric(10,2) nullable — internal cost
- `client_platform_fees` jsonb nullable — `{ meta, google, tiktok, snapchat, linkedin }` (% rates)

### `suppliers`
Ad platform suppliers/resellers.
- `id` uuid PK, `name`, `contact_email`, `status` (active|inactive)

### `supplier_platform_fees`
Per-supplier, per-platform fee rates.
- `id` uuid PK, `supplier_id` FK → suppliers (cascade), `platform`, `fee_rate` numeric(5,2)
- Unique constraint on (supplier_id, platform)

### `ad_accounts`
Ad accounts linked to a client and supplier.
- `id` uuid PK, `client_id` FK → clients (cascade), `supplier_id` FK → suppliers (restrict)
- `platform` (meta|google|tiktok|snapchat|linkedin)
- `account_id`, `account_name`, `top_up_fee_rate` numeric(5,2), `status` (active|paused|closed)

### `transactions`
All financial movements. **Wallet balance is always computed from this table.**
- `id` uuid PK, `client_id` FK → clients (restrict), `ad_account_id` FK nullable, `supplier_id` FK nullable
- `type` (payment|topup|withdraw|refund|spend_record)
- `amount` numeric(12,2), `currency` (USD|USDT|USDC|EUR), `is_crypto` boolean
- `crypto_fee_amount` numeric(12,2) default 0 — **never show to clients**
- `supplier_fee_amount` numeric(12,2) default 0 — **never show to clients**
- `supplier_fee_rate_snapshot` numeric(5,2), `top_up_fee_amount` numeric(12,2)
- `description` text, `spend_date` date, `created_by` FK → users

### `topup_requests`
Client requests to top up an ad account.
- `id` uuid PK, `client_id`, `ad_account_id`, `supplier_id`, `amount`, `currency`
- `status` (pending|approved|insufficient_funds|executed|rejected)
- `notes`, `executed_by` FK → users, `executed_at`

### `invoices`
Invoices issued to clients.
- `id` uuid PK, `client_id`, `invoice_number` unique (INV-YYYY-NNNN)
- `amount`, `currency`, `status` (draft|sent|paid|overdue), `due_date`, `notes`

### `supplier_payments`
Payments made to suppliers.
- `id` uuid PK, `supplier_id`, `amount`, `currency`
- `bank_fees`, `bank_fees_note`, `payment_method`, `reference`
- `status` (pending|paid), `paid_at`, `created_by` FK → users

### `affiliate_commissions`
Monthly commission records per affiliate.
- `id` uuid PK, `affiliate_id`, `period_year`, `period_month`
- `clients_count`, `total_topups`, `total_commissions_gross`, `total_supplier_fees`, `total_profit_net`
- `commission_rate`, `commission_amount`, `status` (preview|calculated|paid), `pdf_url`
- Unique constraint on (affiliate_id, period_year, period_month, status) — allows one preview + one calculated per period

### `settings`
Single-row agency configuration.
- `id` uuid PK, `agency_name`, `agency_crypto_fee_rate`
- `iban_usd`, `iban_eur`, `legal_mentions`, `from_email`

### `clients` — Sprint 7 addition
- `password_hash` text nullable — set via public `/api/onboarding` so clients can log in

---

## Critical Business Rules

1. **wallet_balance is NEVER stored** — always calculated from `transactions`:
   - `classic`: `SUM(payments) - SUM(topups + withdraws + refunds)`
   - `dynamic`: `SUM(payments) - SUM(spend_records)`
   - See `lib/balance.ts` — `calculateWalletBalance()` and `calculateWalletBalances()` (batch)

2. **balance_model is immutable** — the PATCH endpoint explicitly rejects changes to `balance_model` after creation

3. **Supplier fees are confidential** — never return `supplier_fee_amount`, `supplier_fee_rate_snapshot`, or `top_up_fee_amount` in client-facing or affiliate-facing API responses

4. **Crypto fees** (USDT/USDC only):
   - `fee = amount × (client.crypto_fee_rate / 100)`
   - `net_credited = amount - fee`
   - Stored as: `amount = net`, `crypto_fee_amount = fee`

5. **Atomic operations** — each financial mutation is a single DB INSERT (naturally atomic). No multi-statement transactions (Neon HTTP limitation).

6. **Duplicate email prevention** — pre-check with SELECT before INSERT in POST /api/clients (Neon errors don't expose PG error codes reliably)

7. **client_platform_fees** — JSONB `{ meta, google, tiktok, snapchat, linkedin }` storing % top-up fee rates per platform for each client

8. **Setup rental** — `has_setup=true` clients have monthly fee + cost tracked; reflected in P&L (Sprint 8)

9. **Hybrid affiliate commission flow** — commission records follow the lifecycle: `preview` → `calculated` → `paid`
   - Each top-up execution auto-creates or increments the current month's `preview` record for the client's affiliate
   - Only `preview` records are modified by top-up execution; `calculated` and `paid` records are immutable
   - Admin explicitly finalizes a `preview` record (PATCH `/api/affiliate-commissions/[id]/finalize`) to freeze it as `calculated`
   - After finalize, new top-ups for the same month create a fresh `preview` record
   - `calculated` records can be marked as `paid` (PATCH `/api/affiliate-commissions/[id]/mark-paid`); `preview` records cannot

---

## Transaction Color Coding (UI)

| Type | Color | Sign |
|------|-------|------|
| payment | green (emerald) | + |
| topup | blue | − |
| withdraw | orange | − |
| refund | red | − |
| spend_record | gray | − |

---

## Test Credentials

### Agency Portal (`/login`)
| Email | Password | Role |
|-------|----------|------|
| admin@reward-agency.com | Admin2026! | admin |
| team@reward-agency.com | Team2026! | team |
| accountant@reward-agency.com | Accountant2026! | accountant |

### Affiliate Portal (`/login`)
| Email | Password |
|-------|----------|
| affiliate@reward-agency.com | Affiliate2026! |

### Client Portal
To be added in Sprint 4.

---

## Sprint Progress

| Sprint | Status | Scope |
|--------|--------|-------|
| Sprint 1 | ✅ Done | Next.js init, 13-table schema, Drizzle migrations, NextAuth v5, seed users, GitHub push |
| Sprint 2 | ✅ Done | Agency sidebar (dark navy), all nav items, route groups (agency/client/affiliate), placeholder pages |
| Sprint 3 | ✅ Done | Clients CRUD, wallet balance, credit/withdraw/refund, setup rental, platform fees, notes, client code editable, 22+ tests |
| Sprint 4 | ✅ Done | Suppliers + Ad Accounts (parent/sub-supplier hierarchy, platform fees, KPIs, ad account status active/disabled/deleted, 21 tests) |
| Sprint 5 | ✅ Done | Top Ups module (create, execute, reject, fee breakdown preview, platform icons, modal latency fixes, sidebar badge counter, 16 tests) |
| Fee model | ✅ Done | top_up_fee_rate auto-derived from client_platform_fees; supplier_fee_rate from sub-supplier; both read-only on ad account |
| Sprint 6 | ✅ Done | Transactions page (filters+CSV), Dashboard (KPIs+charts+recharts), Settings (Agency Info/Team/Audit Log tabs), delete top-up enhanced UX, new audit actions |
| Sprint 7 | ✅ Done | Affiliates CRUD, hybrid commission system (auto-preview on execute, finalize flow), mark-paid, public onboarding page, client login, email notifications (Resend + console fallback), 14 tests |
| Sprint 8 | 🔄 Next | P&L + Invoices |
| Sprint 9 | ⏳ | Client portal (balance, ad accounts, transactions, top-up requests) |
| Sprint 10 | ⏳ | Affiliate portal (commissions, referral link, client list) |
| Sprint 11 | ⏳ | Settings + Vercel deploy |

---

## Upcoming Sprint Plans

### Sprint 6 — Transactions + Dashboard + P&L + Invoices
- Transactions page: full ledger with filters (type, date range, client), export
- Dashboard KPIs: wallet balances, commissions, margins, charts
- P&L Report: revenue (top-up fees + setup fees) vs costs (supplier fees + setup costs)
- Invoices: generate INV-YYYY-NNNN, status management (draft/sent/paid/overdue)

### Sprint 7 — Affiliates Module
- Affiliate CRUD, password setup, commission rate
- Monthly commission calculation (based on client top-ups)
- Commission statements (PDF generation)

### Sprint 8 — P&L + Invoices
- P&L dashboard: revenue (top-up fees + setup fees) vs costs (supplier fees + setup costs)
- Invoice generation for clients (INV-YYYY-NNNN)
- Invoice status management

### Sprint 9 — Client Portal
- `/portal/dashboard`: wallet balance, recent transactions
- `/portal/accounts`: view ad accounts
- `/portal/transactions`: transaction history (no supplier/fee columns)
- `/portal/topups`: submit and track top-up requests

### Sprint 10 — Affiliate Portal
- `/affiliate/dashboard`: commission overview
- `/affiliate/clients`: referred clients list
- `/affiliate/commissions`: monthly statements
- `/affiliate/link`: referral link display
- `/affiliate/profile`: update profile

### Sprint 11 — Settings + Deploy
- Settings page: agency name, crypto fee rate, IBAN details, legal mentions
- Vercel deployment with production env vars
- Domain setup

---

## Key Design Decisions

- **Single `/login` page** — detects user type (agency user vs affiliate) automatically; no separate login URLs
- **Sidebar colors**: dark navy `hsl(222, 47%, 11%)`, active link electric blue `hsl(236, 85%, 55%)`
- **No file storage** — payment proofs handled externally (Slack/Telegram); no S3/uploads in scope
- **No `wallet_balance` column** — calculated on every request from transactions (source of truth)
- **Favicon** — blue rounded "R" icon matching sidebar active color (`#3b4fd8`), served via `app/icon.tsx` (Next.js ImageResponse)
- **Route groups** are URL-transparent: `(agency)`, `(client)`, `(affiliate)` don't appear in URLs
- **Affiliate URLs** use `/affiliate/*` prefix (not a route group prefix); middleware routes on `pathname.startsWith("/affiliate/")`
- **Client codes** auto-increment: `MAX(CAST(SUBSTRING(client_code, 5) AS INTEGER)) + 1`, zero-padded to 4 digits
- **CSS**: Pure Tailwind arbitrary values (`bg-[hsl(...)]`) — no CSS custom properties on elements (causes unstyled flash)
- **Zod v4**: use `.issues` not `.errors` on `ZodError`
- **Test auth**: JWT encoded via `next-auth/jwt` `encode()` with `salt = "authjs.session-token"` + real admin UUID from DB

---

## File Structure

```
reward-agency-dashboard/
├── app/
│   ├── layout.tsx                    # Root layout, metadata, SessionProvider
│   ├── icon.tsx                      # Favicon via Next.js ImageResponse (32x32 PNG)
│   ├── page.tsx                      # Root redirect → /dashboard or /login
│   ├── login/page.tsx                # Unified login for all user types
│   ├── globals.css                   # Tailwind directives, html/body bg-white
│   ├── (agency)/                     # Agency portal (admin/team/accountant)
│   │   ├── layout.tsx                # Auth check + sidebar + main wrapper
│   │   ├── dashboard/page.tsx
│   │   ├── clients/
│   │   │   ├── page.tsx              # Server component: fetch + pass to ClientsTable
│   │   │   └── [id]/page.tsx         # Server component: fetch + pass to ClientTabs
│   │   ├── ad-accounts/page.tsx      # Placeholder (Sprint 4)
│   │   ├── suppliers/page.tsx        # Placeholder (Sprint 4)
│   │   ├── topup-requests/page.tsx   # Placeholder (Sprint 5)
│   │   ├── transactions/page.tsx     # Placeholder (Sprint 6)
│   │   ├── invoices/page.tsx         # Placeholder (Sprint 8)
│   │   ├── pnl/page.tsx              # Placeholder (Sprint 8)
│   │   ├── affiliates/page.tsx       # Placeholder (Sprint 7)
│   │   └── settings/page.tsx         # Placeholder (Sprint 11)
│   ├── (client)/                     # Client portal
│   │   ├── layout.tsx
│   │   └── portal/{dashboard,accounts,transactions,topups}/page.tsx
│   ├── (affiliate)/                  # Affiliate portal
│   │   ├── layout.tsx
│   │   └── affiliate/{dashboard,clients,commissions,link,profile}/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       └── clients/
│           ├── route.ts              # GET list + POST create
│           └── [id]/
│               ├── route.ts          # GET single + PATCH update
│               ├── credit/route.ts   # POST credit wallet (payment txn)
│               └── withdraw/route.ts # POST withdraw/refund (debit txn)
├── components/
│   ├── agency-sidebar.tsx            # Fixed left sidebar, nav items, active state
│   ├── client-topnav.tsx             # Client portal top navigation
│   ├── affiliate-sidebar.tsx         # Affiliate portal sidebar
│   └── clients/
│       ├── clients-table.tsx         # Client list with search, status tabs, Setup badge
│       ├── add-client-modal.tsx      # Create client (all fields incl. setup + platform fees)
│       ├── edit-client-modal.tsx     # Update client
│       ├── credit-modal.tsx          # Credit wallet (payment, crypto fee preview)
│       ├── withdraw-modal.tsx        # Withdraw/refund (balance display, Max btn, live preview)
│       └── client-tabs.tsx           # Client detail: Overview/AdAccounts/Transactions/TopUps
├── db/
│   ├── schema.ts                     # All 13 Drizzle table definitions
│   ├── index.ts                      # Neon + Drizzle connection (neon-http driver)
│   └── seed.ts                       # Seed agency users + test affiliate
├── lib/
│   ├── balance.ts                    # calculateWalletBalance, calculateWalletBalances (batch)
│   ├── client-code.ts                # generateClientCode() → RWD-XXXX
│   └── utils.ts                      # cn() — clsx + tailwind-merge
├── tests/
│   └── sprint3.test.ts               # 22 integration tests (node:test, hits dev server)
├── auth.ts                           # NextAuth v5 config (credentials: users + affiliates)
├── middleware.ts                     # Route protection, role-based redirect
├── drizzle.config.ts                 # Drizzle Kit config (out: ./drizzle)
├── drizzle/                          # Generated SQL migrations
└── CLAUDE.md                         # This file
```

---

## API Routes (Sprint 3 — implemented)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/clients | Any | List clients with wallet_balance, search/status/model filters |
| POST | /api/clients | Any | Create client (duplicate email → 400) |
| GET | /api/clients/[id] | Any | Single client + wallet_balance + transactions + ad_accounts |
| PATCH | /api/clients/[id] | Any | Update client (balance_model change → 400) |
| POST | /api/clients/[id]/credit | admin/team | Credit wallet (payment txn, crypto fee deduction) |
| POST | /api/clients/[id]/withdraw | admin/team | Withdraw/refund (debit txn, returns updated balance) |

---

## Rules for Claude Code

- **Always commit and push** after each completed feature or fix
- **Always run tests** before reporting a sprint done (`npm run test:sprint3`)
- **Never store `wallet_balance`** as a DB column — always calculate
- **Never expose** `supplier_fee_amount`, `supplier_fee_rate_snapshot`, `top_up_fee_amount`, or `crypto_fee_amount` in client/affiliate API responses
- **TypeScript strict** — no `any` types; use proper interfaces
- **Zod validation** on all API route handlers; return 400 on validation failure
- **New API routes** follow the pattern: auth check → role check → parse body → Zod validate → DB operation → return JSON
- **Migrations**: update `db/schema.ts` → `npm run db:generate` → `npm run db:migrate`
- **Tests**: integration tests hit the running dev server at `http://localhost:3000`; use `next-auth/jwt` `encode()` with `salt = "authjs.session-token"` for test tokens
- **No CSS custom properties** on HTML elements — use Tailwind arbitrary values (`bg-[hsl(...)]`) to avoid unstyled flash on navigation
- **No `loading.tsx` files** — they cause grey flash during navigation
- **Always manually check for duplicate headings, buttons, or UI elements after building new pages** — page server components own the header (title + action button); table/tab client components must not repeat them
- **Never modify `tailwind.config.ts` or `globals.css`** without verifying the sidebar still renders correctly (dark navy `hsl(222,47%,11%)` background). CSS breakage is caused by stale `.next` cache — fix with `rm -rf .next && npm run dev`
- **CSS breaks after cache goes stale** — if sidebar shows as unstyled text, run `pkill -f "next dev" && rm -rf .next && npm run dev`. The Tailwind config and sidebar component are correct; the issue is always a stale webpack cache
- **Email notifications** — `lib/email.ts` uses Resend if `RESEND_API_KEY` is set; falls back to `console.log` if not. Add `RESEND_API_KEY=` and `NEXT_PUBLIC_APP_URL=http://localhost:3000` to `.env.local`
- **Public routes** — `/onboarding` is fully public (no auth required). Middleware allows it without login. API `/api/onboarding` also has no auth check
- **Client login** — clients can log in via `/login` using email + password set during onboarding (password stored in `clients.password_hash`)
