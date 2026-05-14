# Gostaylo

**Premium marketplace** for short-term rentals and related services — accommodation, mobility, experiences, and beyond. One international codebase: multi-locale, multi-currency, ready to scale past the launch corridor without product forks.

**Brand in UI:** `NEXT_PUBLIC_SITE_NAME` / `SITE_DISPLAY_NAME` → `getSiteDisplayName()` in `lib/site-url.js`.

---

## Vision

Anchored in **Thailand (Phuket)** with strong **Russia** and global demand — **world-class** discovery, trust, and settlement. Treasury is **sanctions-aware**: multi-entity structure (including **Kyrgyzstan**), **USDT** where appropriate, **banking / SWIFT** for verified partners. Details: **`ARCHITECTURAL_DECISIONS.md`** and internal runbooks — not here.

---

## SSOT (how we stay correct)

Escrow-style bookings, FX, payouts, and vertical categories need **one policy layer**.

| # | Source |
|---|--------|
| **1** | **`ARCHITECTURAL_DECISIONS.md`** — rules, auth contracts, categories, financial guardrails |
| **2** | **`docs/TECHNICAL_MANIFESTO.md`** — shipped behavior |
| **3** | **`docs/ARCHITECTURAL_PASSPORT.md`** — routes, services, UX invariants |

Also: **`AGENTS.md`**, **`.cursorrules`**, **`.github/pull_request_template.md`**. History: **`docs/history/`** (`docs/history/README.md`).

**Schema & RLS truth** — `migrations/`, `database/`, `prisma/schema.prisma`, and those docs — **never** duplicated in this file.

---

## Tech stack

| Layer | Choice |
|--------|--------|
| **App** | Next.js **14** (App Router), React **18** |
| **Runtime data** | **Supabase** (Postgres, Auth, Storage, Realtime where used) — all production reads/writes via **Supabase JS** / service role from server routes |
| **Schema & types** | **`prisma/schema.prisma`** — **SSOT for table shape with the live DB** and **IDE / typing reference**; not the primary query runtime (see ADR Golden rule §1) |
| **UI** | Tailwind CSS, shadcn/ui, Leaflet (maps) |
| **Deploy** | Vercel (typical) |
| **Push** | **Firebase Cloud Messaging only** — `lib/services/push.service.js`, client init, `public/firebase-messaging-sw.js` |
| **Email** | Resend (`RESEND_API_KEY`) |

---

## Identity & push

**Supabase Auth** — email/password, **Google** (OAuth, PKCE); linked into **`profiles`** (e.g. **`auth_user_id`**). **Session:** HTTP-only **`gostaylo_session`** (app-issued JWT) for `/api/v2/*` and guarded routes — contract in **`ARCHITECTURAL_DECISIONS.md`** + **`docs/TECHNICAL_MANIFESTO.md`**. **Firebase:** web push only — not sign-in.

---

## Project layout

```
app/              # App Router: routes, layouts, app/api/** (HTTP handlers)
components/       # UI + components/ui (shadcn)
contexts/         # React providers
hooks/            # Shared client hooks
lib/              # Domain: services, auth, currency, search, security, i18n, SEO, …
public/           # Assets; FCM service worker
prisma/           # schema.prisma — DB shape SSOT / typing (align with Supabase)
migrations/       # SQL stage bundles → apply in documented order
database/         # Numbered SQL migrations, RLS / DDL adjuncts
supabase/         # CLI / local config when the team uses it
docs/             # Passport, manifesto, runbooks, history
scripts/          # Tooling (see package.json)
tests/            # Unit / integration
e2e/              # Playwright E2E (shared config / reports may live under playwright/)
workers/          # e.g. Cloudflare edge helpers
emails/           # React Email templates
legacy/           # Archive — not SSOT for new work
backend/          # Auxiliary services / tests (outside primary Next path)
frontend/         # Legacy adjunct — not the app root
.github/          # CI, PR template
```

---

## Local development

1. **Node** — LTS compatible with Next.js 14.  
2. **`npm install`** (or yarn).  
3. **Env** — copy **`.env.example`** → `.env` and fill values (file lists keys **without** secrets). **`JWT_SECRET`** is **non-negotiable**: a strong, unique secret in every environment; the stack treats a missing or weak production secret as a **hard failure** (see ADR). Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; full set — ADR Golden rule §6.  
4. **DB** — apply `migrations/` + `database/migrations/` to Postgres in team order; **`npx prisma validate`** checks schema file consistency.  
5. **Dev server** — `npm run dev` (`package.json`: turbo / memory variants).

**Scripts:** `npm run lint` · `npm run build` · `npm run verify:currency` · `npm run check:i18n`

---

## API

Target **`/api/v2/*`**. Cron / webhooks: separate routes + secrets (e.g. **`CRON_SECRET`**). UI: use **`error_code`** from auth/promo APIs — not ad-hoc `error` strings.

---

## Roadmap & contributing

**`ROADMAP.md`** — phases. **`docs/TECHNICAL_MANIFESTO.md`** — stage changelog. Before material work: **`ARCHITECTURAL_DECISIONS.md`**; touch manifesto + passport when APIs, DB, RLS, or UX change (**`AGENTS.md`**). No new magic **commission / FX** literals — **`CurrencyService`**, **`exchange_rates`**, **`system_settings`**, **`currency-last-resort.js`**.

---

## Partners & investors

A **durable**, documentation-first platform: multi-language, multi-currency, verification, escrow-aware money movement, admin **marketplace health** — built so diligence can follow **policy → implementation** with confidence.

---

*SSOT-first. World-class bar. Premium by design.*
