# ADR-167: Discovery & Recommendations SSOT (Wave F — Product Features)

| Field | Value |
|-------|--------|
| **Status** | Accepted (Stage 167.0) |
| **Stage** | 167.0 → 167.2 — Product discovery layer |
| **Date** | 2026-06-18 |
| **Deciders** | Product, Engineering |
| **Baseline** | v12.166.0 (Wave D+E closed; geo/map/perf foundation live) |
| **SSOT after adoption** | This ADR + **`lib/recommendations/`** + `docs/PRODUCT_FLOW_MAP.md` §2 (Discovery) |

**Related audit:** Stage 167 Prep — Deep Product Features Audit (2026-06-18).

**Related code today:** `lib/api/run-listings-search-get.js`, `lib/api/search/ranking.js`, `lib/search/semantic-listings.js`, `lib/hooks/use-recently-viewed.js`, `app/api/v2/favorites/route.js`, `app/api/v2/renter/favorites/route.js`, `app/listings/[id]/page.js`, `components/search/SearchMapWrapper.jsx`.

---

## 1. Context and problem

Transactional core (booking, escrow, chat, reputation) is mature. **Discovery and retention loops are under-built** vs Airbnb/Booking:

| Gap | Impact |
|-----|--------|
| No **similar listings** on PDP | Lost cross-sell conversion |
| **Recently viewed** written to localStorage, never shown | Wasted signal |
| **Favorites** — dual API paths, N+1 on PDP | SSOT drift, latency |
| **Price histogram** in search API, no UI | Dead contract |
| No explicit **sort** UX | Opaque ranking |
| No **personalization** surface | Weak return visits |

Post-Wave E we must add a **product layer** without duplicating search logic or breaking geo/privacy SSOT (ADR-163).

---

## 2. Decision (summary)

### 2.1 New domain module

All recommendation and discovery-adjacent logic lives under **`lib/recommendations/`**:

| Module | Responsibility |
|--------|----------------|
| `similar-listings.service.js` | PDP «Похожие» — geo + category + price band |
| `recently-viewed.service.js` | Server persist (optional 167.1) + merge with client cache |
| `ranking-policy.js` | **When** reputation vs distance vs price vs semantic (catalog SSOT) |
| `personalization-v1.service.js` | Home «Для вас» — recent + favorites + category affinity (167.2) |

**Forbidden:** ad-hoc similar queries in PDP hooks, parallel ranking in components.

### 2.2 API surface (canonical)

| Endpoint | Purpose | Stage |
|----------|---------|-------|
| `GET /api/v2/listings/[id]/similar` | Similar listings (lite card shape) | 167.0 |
| `GET /api/v2/favorites` | **SSOT** list/toggle (existing) | 167.0 cleanup |
| `GET /api/v2/favorites/check?listingId=` | O(1) favorite state | 167.0 |
| `POST /api/v2/listing-views` | Record view (auth optional) | 167.1 |
| `GET /api/v2/recommendations/for-you` | Home feed v1 | 167.2 |

**Deprecate:** `GET/POST /api/v2/renter/favorites` → thin proxy to SSOT or 410 after migration window.

### 2.3 Similar listings algorithm (v1 — no ML)

**Input:** `listingId`, viewer context (optional).

**Candidates (SQL / PostGIS):**

1. Same `category_id` or same `wizard_profile` family.
2. `ST_DWithin(coordinates, anchor, 15_000 m)` (configurable).
3. `base_price_thb` within ±35% of anchor (calendar-aware later).
4. `status = ACTIVE`, exclude anchor, exclude `[E2E_TEST_DATA]` on public paths.

**Rank:** distance ASC → reputation tier boost (reuse `ReputationService` aggregates) → `avg_rating` DESC.

**Limit:** 8–12 cards, **lite payload** (`LISTINGS_SELECT_LITE` shape + public coords via ADR-163).

**Not in v1:** embeddings similarity (defer to 167.3+).

### 2.4 Recently viewed

| Layer | v1 (167.0) | v1.1 (167.1) |
|-------|------------|--------------|
| Client | Keep `useRecentlyViewed` localStorage | Merge server wins on login |
| Server | — | `listing_views(user_id, listing_id, viewed_at)` |
| UI | Rail on PDP + catalog footer | Same + home strip |

**SSOT display:** `components/recommendations/RecentlyViewedRail.jsx` — one component, three placements.

### 2.5 Favorites SSOT

| Rule | Detail |
|------|--------|
| Table | `public.favorites` (existing) |
| API | **`/api/v2/favorites` only** |
| PDP check | `GET .../check?listingId=` — never full list |
| Catalog | Batch `?listingIds=a,b,c` or check per card via shared hook |
| Notifications | Out of scope 167.0–167.2 (167.3 price-drop) |

### 2.6 Catalog sort & price UI

**Ranking SSOT:** `lib/recommendations/ranking-policy.js` exports:

```text
resolveCatalogSort(searchParams) → 'recommended' | 'price_asc' | 'price_desc' | 'distance'
```

- `recommended` → current reputation ranking (default).
- `distance` → only when `lat/lng` (+ radius or bbox) active; uses existing KNN map.
- `price_*` → SQL `order` when no date filter; else calendar avg from availability snapshot.

**Price histogram:** consume `meta.priceHistogram` from search response in filter drawer (no second API).

### 2.7 Map ↔ list coupling (167.1)

- Card hover/click → `selectedListingId` on map (exists) + **scroll card into view**.
- Cluster tap → zoom to cluster bounds (server returns bbox hint or client computes from cluster lat/lng + cell size).

**Does not change** map-pins privacy or cluster centroid rules (ADR-163 / Stage 163.3).

### 2.8 Personalization v1 (167.2)

**No ML.** Score = weighted sum:

| Signal | Weight |
|--------|--------|
| Recently viewed (7d) | 40% |
| Favorites category match | 30% |
| Geo centroid of views | 20% |
| Featured / reputation | 10% |

Output: 12–20 listings on home / «Для вас» when logged in; anonymous → popular in region only.

---

## 3. Stage breakdown

### Stage 167.0 — Discovery MVP (P0)

**Goal:** Close the largest conversion gaps with minimal new infra.

| Work item | Owner hint |
|-----------|------------|
| `lib/recommendations/similar-listings.service.js` | Backend |
| `GET /api/v2/listings/[id]/similar` | API |
| `SimilarListingsRail` on PDP | Frontend |
| `RecentlyViewedRail` (localStorage only) | Frontend |
| `GET /api/v2/favorites/check` | API |
| Deprecate duplicate renter favorites route (proxy) | API |
| `useFavoriteState` hook (check endpoint) | Frontend |
| Sort param `sort=` wired in catalog UI | Full-stack |
| Price histogram in filter UI | Frontend |

**Acceptance criteria (167.0):**

- [ ] PDP shows ≥4 similar ACTIVE listings when anchor has coordinates (or ≥4 same category fallback).
- [ ] Similar cards use **public coordinates** (fuzz when ADR-163 policy says so).
- [ ] Recently viewed rail visible on PDP when ≥2 items in localStorage.
- [ ] PDP favorite heart uses **check** endpoint (≤1 DB round-trip).
- [ ] Catalog sort control changes result order (`recommended` vs `price_asc` documented in URL).
- [ ] Price filter shows histogram from search `meta.priceHistogram`.
- [ ] `npm run check:brand` OK; smoke 32/32 GREEN (or documented unrelated flake tracked).
- [ ] `docs/TECHNICAL_MANIFESTO.md` + `ARCHITECTURAL_PASSPORT.md` → v12.167.0.

---

### Stage 167.1 — Persistence & Map UX (P1)

**Goal:** Cross-device signals + Airbnb-grade map/list feel.

| Work item | Owner hint |
|-----------|------------|
| Migration `listing_views` (GRANT + RLS) | DB |
| `POST /api/v2/listing-views`, merge on login | API |
| Server-backed recently viewed | Backend + hook |
| Map cluster drill-down (zoom) | Frontend |
| List ↔ map scroll-into-view | Frontend |
| `ranking-policy.js` extracted from `run-listings-search-get` | Refactor |

**Acceptance criteria (167.1):**

- [ ] Authenticated view recorded on PDP (`listing_views` upsert).
- [ ] After login, recent rail merges local + server (dedupe by `listing_id`, max 10).
- [ ] Cluster marker tap zooms map to sensible bounds.
- [ ] Selecting sidebar card scrolls list + highlights pin.
- [ ] Ranking policy documented in ADR-167 §2.6; no duplicate sort matrices in components.
- [ ] Docs v12.167.1.

---

### Stage 167.2 — Personalization & Home (P1)

**Goal:** Return-visit loop («Для вас»).

| Work item | Owner hint |
|-----------|------------|
| `personalization-v1.service.js` | Backend |
| `GET /api/v2/recommendations/for-you` | API |
| Home / catalog «Для вас» strip | Frontend |
| `PRODUCT_FLOW_MAP.md` §2 Discovery rows | Docs |
| Analytics: `RECOMMENDATION_IMPRESSION` / `CLICK` | Telemetry |

**Acceptance criteria (167.2):**

- [ ] Logged-in home shows personalized strip (≥6 listings when enough signal).
- [ ] Anonymous users see regional popular (no PII).
- [ ] Impression/click events in `product-analytics` with `surface=for_you|similar|recent`.
- [ ] ADR-167 status → **Accepted**; Wave F (Product Features) declared in manifesto.
- [ ] Docs v12.167.2.

---

### Stage 167.3+ (backlog — not in 167.0–167.2 scope)

- Favorite price-drop / availability alerts (email + push).
- Semantic similar (embedding nearest neighbors).
- PDP RSC shell + OG metadata SSR.
- Collaborative filtering / A-B ranking experiments.

---

## 4. Non-goals (167.0–167.2)

- Replacing PostGIS search SSOT (`run-listings-search-get`, `map-pins`).
- Changing coordinate privacy rules (ADR-163).
- New payment/booking flows.
- ML training pipeline.

---

## 5. Technical risks

| Risk | Mitigation |
|------|------------|
| Similar query slow on large catalog | GiST + category partial index; limit 50 candidates before rank |
| Favorites migration breaks clients | Proxy `renter/favorites` one release; grep + deprecation log |
| Ranking refactor breaks search | Golden tests on sort orders; smoke catalog E2E |
| `listing_views` RLS | Template `migrations/_template_new_public_table.sql` |
| Privacy leak in similar | Mandatory `serializePublicCoordinates` on all rails |

---

## 6. SSOT checklist (for every PR in 167.x)

- [ ] New logic in `lib/recommendations/`, not in page components.
- [ ] Public coords via `lib/geo/listing-public-coordinates.js`.
- [ ] Lite card shape aligned with `LISTINGS_SELECT_LITE` / `UnifiedOrderCard` patterns.
- [ ] i18n: `{brand}` placeholder, no product literal.
- [ ] `SEARCH_FILTERS_QUERY_MAP.md` updated if new query params (`sort`, etc.).
- [ ] Manifesto + passport version bump in same PR.

---

## 7. Open questions (for product decision)

1. **Similar radius default:** 15 km vs 25 km for Phuket-only launch?
2. **Recently viewed:** guest cookie merge before login, or only after auth?
3. **Sort default:** keep reputation-only or switch to distance when map bbox locked?
4. **Deprecate `renter/favorites`:** immediate proxy vs 2-release sunset?

---

## 8. References

- `docs/SEARCH_FILTERS_QUERY_MAP.md` — catalog query SSOT
- `docs/ADR/163-coordinate-privacy-ssot.md` — public coords
- `lib/services/reputation.service.js` — partner trust aggregates
- `lib/config/category-behavior.js` — vertical policy
- `docs/PRODUCT_FLOW_MAP.md` — update §2 after 167.2
