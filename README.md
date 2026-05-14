# Gostaylo

**Premium global marketplace for rentals and services** — one platform for accommodation, mobility, experiences, and adjacent categories. The product name shown in the UI is configurable via environment (see `lib/site-url.js`: `NEXT_PUBLIC_SITE_NAME`, `SITE_DISPLAY_NAME`).

---

## At a glance 🌍

| | |
|---|---|
| **What** | International aggregator with a hospitality-grade UX: discovery, booking, partner tools, admin, referrals, and a serious financial ledger. |
| **Where we start** | **Thailand (Phuket)** as the anchor geography and **Russia** as a major demand corridor — designed to scale to additional countries without forked codebases. |
| **How we build** | **SSOT first**: one canonical policy document, code-truth companions, and no competing “sources of truth” for money, auth errors, or category semantics. |
| **Quality bar** | World-class product engineering: typed boundaries, service-layer orchestration, security guards on sensitive routes, and documentation that stays aligned with shipped behavior. |

---

## Why SSOT matters here 🎯

Gostaylo combines **multi-currency display**, **escrow-style booking flows**, **partner payouts**, and **regional compliance**. That only stays safe at scale if rules live in **one place**.

**Canonical order (always resolve conflicts top → down):**

1. **`ARCHITECTURAL_DECISIONS.md`** — project manifesto: stack choices, golden rules, auth error contracts, category SSOT, financial policy pointers.
2. **`docs/TECHNICAL_MANIFESTO.md`** — compact “what the code does today” (API ideas, chat, currency, pushes, E2E notes, Supabase `TEXT` vs UUID caveats).
3. **`docs/ARCHITECTURAL_PASSPORT.md`** — routes, diagrams, service map, UX invariants.

Operational detail for contributors lives in **`AGENTS.md`**, **`.cursorrules`**, and **`.github/pull_request_template.md`**. Historical notes and one-off SQL live under **`docs/history/`** (indexed from **`docs/history/README.md`**).

---

## Operating context (finance & geography) 💱

The business operates in a **sanctions-sensitive** environment. Treasury and partner settlement use a **deliberate multi-entity structure** (including operations in **Kyrgyzstan**), **USDT** rails where appropriate, and **SWIFT / banking** paths for verified partner payouts where the product supports them.  

Implementation details belong in internal finance runbooks and **`ARCHITECTURAL_DECISIONS.md`** / service code — not duplicated in this README.

---

## Technology stack 🧱

| Layer | Choice |
|--------|--------|
| **Application** | **Next.js 14** (App Router), React 18 |
| **Data** | **Supabase** — PostgreSQL, Auth, Storage, Realtime (where enabled) |
| **Schema reference** | **`prisma/schema.prisma`** — **documentation and typing alignment** with the live database; **production data access uses Supabase** (`@supabase/supabase-js`, service role on the server). |
| **UI** | **Tailwind CSS**, **shadcn/ui** (Radix primitives), **Leaflet** for map surfaces |
| **Hosting** | **Vercel** (typical deployment) |
| **Push** | **Firebase Cloud Messaging** — **notifications only** (`lib/services/push.service.js`, client init, `public/firebase-messaging-sw.js`) |
| **Email** | **Resend** when `RESEND_API_KEY` is configured |

---

## Identity, sessions, and notifications 🔐

- **No mock authentication in production paths.** Users sign in with **email/password** and **Google (OAuth via Supabase Auth, PKCE)**. Additional providers (e.g. Telegram, phone) are approached as **real Supabase-linked** flows when enabled — not placeholder stubs.
- **Bridge model (Stage 79.x):** Supabase identities sync into **`profiles`** (including **`auth_user_id`**). The browser carries an application session cookie **`gostaylo_session`** (JWT issued by the app) for API access — see **`ARCHITECTURAL_DECISIONS.md`** and **`docs/TECHNICAL_MANIFESTO.md`** for the exact contract.
- **Firebase is not used for login.** It is reserved for **web push** delivery and related client wiring.

---

## Product surface (high level)

- **Guest:** home and catalog search, listing PDP, booking/checkout, chat, profile, referrals, loyalty storytelling (`/about/loyalty`).
- **Partner:** listing wizard, calendar and availability, finances and payouts, verification.
- **Admin / staff:** moderation, users, marketplace health, marketing and system settings — guarded by unified access checks (`requireAccess`, `requireAdminStaff` per ADR stages).

Vertical behavior (property vs transport vs yacht vs tour) is driven by **`categories.slug`** and **`categories.wizard_profile`** — not hard-coded “only villas” assumptions.

---

## Repository layout (orientation)

```
app/                    # Next.js App Router — pages, layouts, route handlers
  api/                  # HTTP API (prefer v2 contracts under app/api/v2/**)
components/             # React UI (feature folders + ui/)
lib/                    # Services, auth, currency, search, security, SEO, …
migrations/             # SQL migrations and stage bundles (Supabase source of truth)
prisma/                 # schema.prisma — schema documentation (see ADR Golden rule §1)
public/                 # Static assets, FCM service worker
docs/                   # Architecture passport, manifesto, runbooks, history
scripts/                # Maintenance and verification scripts (see package.json)
```

Legacy or archived experiments may live under **`legacy/`** — do not treat them as product SSOT.

---

## Local development 🛠️

**Requirements:** Node.js compatible with Next.js 14, package manager (**npm** or **yarn**).

```bash
# Install dependencies
npm install

# Development server (see package.json for memory/turbo variants)
npm run dev
```

**Useful scripts** (non-exhaustive):

| Script | Purpose |
|--------|---------|
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run verify:currency` | Price-format sanity check |
| `npm run check:i18n` | Translation duplicate guard |
| `npx prisma validate` | Validate `schema.prisma` against Prisma tooling |

**Environment:** configure secrets and public keys per **`ARCHITECTURAL_DECISIONS.md`** (Golden rule §6) and team **`.env.example`** / internal onboarding. **`JWT_SECRET`** is mandatory in every deployed environment.

**Database:** apply **`migrations/`** to your Supabase project in dependency order; never assume `prisma migrate` is the primary deployment path unless your team explicitly standardized on it.

---

## API and versioning

Public and partner integrations should target **`/api/v2/*`** routes. Older or internal paths may exist for cron (`CRON_SECRET`), webhooks, or transitional clients — the **Technical Manifesto** and **Architectural Passport** list the critical surfaces.

Auth-facing errors use **`error_code`** (machine-readable) — never rely on ad-hoc English `error` strings in new UI.

---

## Roadmap & change log

Engineering phases and completed cleanup milestones: **`ROADMAP.md`**.  

Fine-grained “stage” history of shipped behavior is maintained in **`docs/TECHNICAL_MANIFESTO.md`** (dated entries).

---

## Contributing

1. Read **`ARCHITECTURAL_DECISIONS.md`** before non-trivial work.  
2. Keep **`docs/TECHNICAL_MANIFESTO.md`** and **`docs/ARCHITECTURAL_PASSPORT.md`** in sync when you change APIs, database behavior, RLS, or user-visible product flows (**`AGENTS.md`**).  
3. Use the repository **pull request template** checklist.  
4. **Do not** introduce new magic numbers for commissions or FX — use **`CurrencyService`**, **`exchange_rates`**, **`system_settings`**, and **`lib/services/currency-last-resort.js`** as documented.

---

## For partners and investors

Gostaylo is built as a **long-horizon platform**: multi-language UX, multi-currency display, partner verification, escrow-aware booking flows, and admin telemetry aimed at **marketplace health**, not a single static catalog.  

The codebase is intentionally **documentation-heavy** so diligence and technical onboarding can trace **policy → implementation** without tribal knowledge.

---

**Gostaylo** — engineered for trust at scale.
