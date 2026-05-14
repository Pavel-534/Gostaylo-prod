# Gostaylo

**A premium, globally minded marketplace** for short-term rentals and adjacent services — accommodation, mobility, experiences, and more. One codebase, multiple locales and currencies, built to expand beyond the launch corridor without forking the product.

The name users see is configurable: **`NEXT_PUBLIC_SITE_NAME`** / **`SITE_DISPLAY_NAME`** → **`getSiteDisplayName()`** in `lib/site-url.js`.

---

## Vision

We anchor in **Thailand (Phuket)** and serve **Russia** and the wider international demand — with infrastructure and copy aimed at **world-class** discovery, trust, and settlement. Treasury reflects a **sanctions-aware** reality: multi-entity operations (including **Kyrgyzstan**), **USDT** where appropriate, and **banking / SWIFT** for verified partners. Product detail stays in **`ARCHITECTURAL_DECISIONS.md`** and internal runbooks — not duplicated here.

---

## How we build: SSOT

At this complexity — escrow-style bookings, FX display, partner payouts, category verticals — **one canonical policy layer** is non-negotiable.

| Priority | Document |
|----------|----------|
| **1** | **`ARCHITECTURAL_DECISIONS.md`** — rules, golden constraints, auth contracts, category map |
| **2** | **`docs/TECHNICAL_MANIFESTO.md`** — what shipped code does today |
| **3** | **`docs/ARCHITECTURAL_PASSPORT.md`** — routes, services, UX invariants |

Contributor workflow: **`AGENTS.md`**, **`.cursorrules`**, **`.github/pull_request_template.md`**. Archives: **`docs/history/`** (see **`docs/history/README.md`**).

**Database schema, RLS, and table truth** live in **`migrations/`**, **`database/`**, **`prisma/schema.prisma`** (schema-as-documentation), and the docs above — **not** in this README.

---

## Stack

| Layer | Choice |
|--------|--------|
| App | **Next.js 14** (App Router), React 18 |
| Data | **Supabase** — Postgres, Auth, Storage, Realtime (where used) |
| Access | **Supabase client** on the server; **`prisma/schema.prisma`** aligns with the DB — runtime ORM queries are not the primary data path (see ADR) |
| UI | **Tailwind CSS**, **shadcn/ui**, **Leaflet** (maps) |
| Deploy | **Vercel** (typical) |
| Push | **Firebase Cloud Messaging** only — `lib/services/push.service.js`, client init, `public/firebase-messaging-sw.js` |
| Mail | **Resend** when `RESEND_API_KEY` is set |

---

## Identity & notifications

- **Supabase Auth** — email/password and **Google** (OAuth, PKCE); identity is linked into **`profiles`** (e.g. **`auth_user_id`**).
- **Application session** — HTTP-only **`gostaylo_session`** cookie (JWT issued by the app) for **`/api/v2/*`** and guarded routes. Full contract: **`ARCHITECTURAL_DECISIONS.md`** + **`docs/TECHNICAL_MANIFESTO.md`**.
- **Firebase** — **web push only**; not used for sign-in.

---

## Repository layout

```
app/                 # Next.js App Router — pages, layouts, route handlers (API under app/api/**)
components/          # UI (feature areas + components/ui — shadcn)
contexts/            # React context providers
hooks/               # Shared client hooks
lib/                 # Services, auth, currency, search, security, SEO, translations, …
public/              # Static assets, FCM service worker
prisma/              # schema.prisma — schema documentation (align with Supabase)
migrations/          # SQL stage bundles (apply in order to your Supabase project)
database/            # Additional SQL migrations, RLS helpers, historical DDL
supabase/            # Supabase project config (when used by the team)
docs/                # Passport, manifesto, runbooks, history
scripts/             # Tooling (lint helpers, verification — see package.json)
tests/               # Unit / integration
e2e/                 # Playwright specs (see also playwright/)
workers/             # Edge / auxiliary workers (e.g. Cloudflare)
emails/              # React Email templates
legacy/              # Archived paths — not SSOT for new features
backend/             # Auxiliary services / tests (non-Next primary path)
frontend/            # Legacy adjunct toolkit — do not assume primary app root
.github/             # CI and PR templates
```

---

## Setup

1. **Node.js** — LTS compatible with Next.js 14.  
2. **Install** — `npm install` (or `yarn`).  
3. **Environment** — set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, **`JWT_SECRET`**, and the rest per **`ARCHITECTURAL_DECISIONS.md`** (Golden rule §6) and your team’s env template. **`JWT_SECRET`** is mandatory in every deployed environment.  
4. **Database** — apply SQL from **`migrations/`** and **`database/migrations/`** to your Supabase Postgres in the order your team documents; validate alignment with **`prisma/schema.prisma`**.  
5. **Run** — `npm run dev` (see `package.json` for `dev:turbo`, memory flags).

**Quality scripts:** `npm run lint`, `npm run build`, `npm run verify:currency`, `npm run check:i18n`, `npx prisma validate`.

---

## API surface

Integrations should target **`/api/v2/*`**. Cron and webhooks may use separate paths and secrets (e.g. **`CRON_SECRET`**). New UI must consume **`error_code`** from auth and promo endpoints — not free-form English `error` strings.

---

## Roadmap & contribution

- Phases and completed cleanup: **`ROADMAP.md`**.  
- Shipped “stage” notes: **`docs/TECHNICAL_MANIFESTO.md`**.  
- Before substantive changes: read **`ARCHITECTURAL_DECISIONS.md`**; update manifesto + passport when you change HTTP contracts, DB behavior, or product UX (**`AGENTS.md`**).  
- No new **magic numbers** for commission or FX — **`CurrencyService`**, **`exchange_rates`**, **`system_settings`**, **`lib/services/currency-last-resort.js`**.

---

## Partners & investors

Gostaylo is engineered as a **durable platform**: multi-language UX, multi-currency display, verification and escrow-aware flows, and admin visibility into **marketplace health**. Documentation is first-class so **policy → code** stays traceable under diligence.

---

*Built with architectural discipline — premium by design.*
