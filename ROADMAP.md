# GoStayLo — roadmap

Canonical engineering rules live in [`ARCHITECTURAL_DECISIONS.md`](./ARCHITECTURAL_DECISIONS.md).

## Phase 1 — Foundation

### 1.1 The Great Cleanup — **COMPLETED**

- **P0:** FX API keys only via env (`EXCHANGE_RATE_KEY` / `EXCHANGE_API_KEY`); no committed secrets in `forex.service.js`.
- **Currency & commission:** Central `CurrencyService` / `getDisplayRateMap` / `resolveDefaultCommissionPercent` / `resolveThbPerUsdt`; UI and routes consume APIs or SSR helpers — no scattered literals; аварии через `currency-last-resort.js` + env / `system_settings` (см. ADR).
- **Repo hygiene:** Removed `.backup` files, `middleware.ts.disabled`, and `archive/`.
- **Prisma runtime:** Removed unused `lib/prisma.js`; production paths use Supabase-js.
- **Docs:** `.env.example` documents FX and commission-related optional env vars.

### 1.2 Reviews & privacy alignment — **COMPLETED** (sub-step)

- **Name privacy:** Shared **`lib/utils/name-formatter.js`**; reviews API, chat routes, invoice/escalate/support-join, and messages client use **first name + last initial** consistently.
- **Reviews DB:** Migration **`014_reviews_photos_verified_booking_unique.sql`** — `photos text[]`, `is_verified`, partial unique index on `booking_id`.
- **Review photos:** Uploads via **`image-upload.service.js`** → bucket **`review-images`** (create in Supabase Storage, public read); **`POST /api/v2/reviews`** persists `photos`; listing/partner/reviews UI shows a thumbnail gallery.

### Next (placeholder)

Further phases to be listed here as they are defined in `ARCHITECTURAL_DECISIONS.md` or team planning.
