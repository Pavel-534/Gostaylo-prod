# Gostaylo

**Cross-border rentals, built like a global hospitality product.** Phuket-anchored, **Russia**- and **worldwide**-ready: discovery, trust, and settlement at a **world-class** bar — one Next.js codebase, multi-locale and multi-currency, scaling past the launch corridor without forking the product.

Treasury is **sanctions-aware** (multi-entity structure including **Kyrgyzstan**, **USDT**, **banking / SWIFT** for verified partners). Product and policy detail live in **`ARCHITECTURAL_DECISIONS.md`** and internal runbooks — not here.

**Brand in UI:** `NEXT_PUBLIC_SITE_NAME` / `SITE_DISPLAY_NAME` → `getSiteDisplayName()` in `lib/site-url.js`.

---

## SSOT — how we stay correct

Escrow-style bookings, FX, payouts, and category verticals demand **one canonical policy layer**.

| # | Document |
|---|----------|
| **1** | **`ARCHITECTURAL_DECISIONS.md`** — rules, auth contracts, categories, financial guardrails |
| **2** | **`docs/TECHNICAL_MANIFESTO.md`** — shipped behavior |
| **3** | **`docs/ARCHITECTURAL_PASSPORT.md`** — routes, services, UX invariants |

Workflow: **`AGENTS.md`**, **`.cursorrules`**, **`.github/pull_request_template.md`**. Archives: **`docs/history/`** (`docs/history/README.md`).

**Schema & RLS** — `migrations/`, `database/`, `prisma/schema.prisma`, and the docs above — never duplicated in this README.

---

## Tech stack

| Layer | Choice |
|--------|--------|
| **App** | Next.js **14** (App Router), React **18** |
| **Runtime I/O** | **Supabase** (Postgres, Auth, Storage, Realtime where used) — production reads/writes via **Supabase JS** / service role from **server** routes |
| **Schema & typing** | **`prisma/schema.prisma`** — **aligned SSOT for table shape** with the live DB + IDE reference; **not** the primary query runtime (ADR Golden rule §1) |
| **UI** | Tailwind CSS, shadcn/ui, Leaflet |
| **Deploy** | Vercel (typical) |
| **Push** | **FCM only** — `lib/services/push.service.js`, client init, `public/firebase-messaging-sw.js` |
| **Email** | Resend (`RESEND_API_KEY`) |

---

## Auth & push

**Supabase Auth** (email/password, **Google** / PKCE) links into **`profiles`**. **App session:** HTTP-only **`gostaylo_session`** (JWT) for `/api/v2/*` and guarded UI — full contract in **`ARCHITECTURAL_DECISIONS.md`** + **`docs/TECHNICAL_MANIFESTO.md`**. **Firebase** — web push only, not sign-in.

---

## Project layout

```
app/              # App Router: pages, layouts, app/api/**
components/       # UI + components/ui (shadcn)
contexts/         # Providers
hooks/            # Shared client hooks
lib/              # Services, auth, currency, search, security, i18n, SEO, …
public/           # Assets; FCM service worker
prisma/           # schema.prisma — DB shape SSOT / typing (keep in sync with Supabase)
migrations/       # SQL stage bundles (apply in team order)
database/         # Numbered SQL migrations, RLS / DDL adjuncts
supabase/         # Supabase CLI / local config when used
docs/             # Passport, manifesto, runbooks, history
scripts/          # Tooling (see package.json)
tests/            # Unit / integration
e2e/              # Playwright (config / reports may live under playwright/)
workers/          # Edge helpers (e.g. Cloudflare)
emails/           # React Email templates
legacy/           # Archive — not SSOT for new work
backend/          # Auxiliary services / tests
frontend/         # Legacy adjunct — not the app root
.github/          # CI, PR template
```

---

## Local development

1. **Node** — LTS for Next.js 14.  
2. **`npm install`**.  
3. **Env** — copy **`.env.example`** → `.env` (keys only, no secrets). **`JWT_SECRET`**: strong, unique, every environment; missing/invalid production config is a **hard failure** per ADR. Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; remainder — ADR Golden rule §6.  
4. **DB** — apply `migrations/` + `database/migrations/` in documented order; **`npx prisma validate`**.  
5. **Run** — `npm run dev` (see `package.json` for turbo / memory).

**Scripts:** `npm run lint` · `npm run build` · `npm run verify:currency` · `npm run check:i18n`

---

## API

Prefer **`/api/v2/*`**. Cron / webhooks: own routes + secrets (e.g. **`CRON_SECRET`**). UI reads **`error_code`** from auth/promo responses — not ad-hoc `error` strings.

---

## Roadmap, contributing, diligence

**`ROADMAP.md`** · **`docs/TECHNICAL_MANIFESTO.md`** (stage log). Before material changes: **`ARCHITECTURAL_DECISIONS.md`**; update manifesto + passport when APIs, DB, RLS, or UX move (**`AGENTS.md`**). No new magic **commission / FX** literals — **`CurrencyService`**, **`exchange_rates`**, **`system_settings`**, **`currency-last-resort.js`**.

**Partners & investors:** documentation-first, escrow-aware flows, admin **marketplace health** — **policy → implementation** traceable under diligence.

---

*SSOT-first. World-class bar. Premium by design.*
