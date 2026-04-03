# GoStayLo — roadmap

Canonical engineering rules live in [`ARCHITECTURAL_DECISIONS.md`](./ARCHITECTURAL_DECISIONS.md).

## Phase 1 — Foundation

### 1.1 The Great Cleanup — **COMPLETED**

- **P0:** FX API keys only via env (`EXCHANGE_RATE_KEY` / `EXCHANGE_API_KEY`); no committed secrets in `forex.service.js`.
- **Currency & commission:** Central `CurrencyService` / `getDisplayRateMap` / `resolveDefaultCommissionPercent` / `resolveThbPerUsdt`; UI and routes consume APIs or SSR helpers — no scattered `35.5` / `15%` literals (emergency numeric fallbacks only inside `currency.service.js`, per ADR).
- **Repo hygiene:** Removed `.backup` files, `middleware.ts.disabled`, and `archive/`.
- **Prisma runtime:** Removed unused `lib/prisma.js`; production paths use Supabase-js.
- **Docs:** `.env.example` documents FX and commission-related optional env vars.

### Next (placeholder)

Further phases to be listed here as they are defined in `ARCHITECTURAL_DECISIONS.md` or team planning.
