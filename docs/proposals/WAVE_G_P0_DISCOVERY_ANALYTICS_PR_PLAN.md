# Wave G P0 — Discovery Analytics PR Plan

**Status:** Proposed (docs only — no code yet)  
**Date:** 2026-06-19  
**Baseline:** v12.168.2  
**Normative SSOT:** `docs/ADR/169-guest-retention-analytics.md`  
**Related:** `docs/ADR/167-discovery-recommendations-ssot.md` §2.9–2.10

---

## Goal

Close the **measurement gap** from Wave F: all discovery surfaces emit `recommendation_impression` / `recommendation_click`; catalog emits `catalog_sort_change`. No algorithm or UX changes in P0 (telemetry only).

**Exit criteria:** PostHog Live Events show all surfaces within 24h of prod deploy; ADR-167 §3 (167.2) analytics checkbox satisfied.

---

## PR sequence (4 small PRs)

Recommended order minimizes conflict and allows incremental review.

| PR | Title | Scope | Est. |
|----|-------|-------|------|
| **G-1** | `feat(analytics): recommendation-rail SSOT hook` | New module + unit-less smoke | S |
| **G-2** | `feat(analytics): wire similar + recent rails` | 2 components | S |
| **G-3** | `refactor(analytics): ForYouRail uses shared hook` | Dedupe existing telemetry | S |
| **G-4** | `feat(analytics): catalog_sort_change event` | Sort select + catalog client | S |

Optional follow-up (**G-5**, P1): E2E Playwright assert `console.debug` or PostHog mock in test env.

---

## PR G-1 — Shared hook module

### Files to create

| File | Purpose |
|------|---------|
| `lib/analytics/recommendation-rail-analytics.js` | SSOT: impression (IO), click helper, dedupe ref |

### Files to read (pattern)

| File | Why |
|------|-----|
| `components/recommendations/ForYouRail.jsx` | Current impression/click logic to extract |
| `lib/analytics/product-analytics.js` | `trackProductEvent`, event constants |

### API sketch (implementation guide)

```javascript
// lib/analytics/recommendation-rail-analytics.js

/**
 * @param {object} opts
 * @param {string} opts.surface — ADR-169 §3.3 enum
 * @param {object[]} opts.listings — cards rendered
 * @param {object} [opts.meta] — mode, authenticated, etc.
 * @param {string} [opts.anchorListingId] — similar_pdp only
 * @param {React.RefObject<HTMLElement>} [opts.containerRef] — IO root target
 */
export function useRecommendationRailAnalytics(opts) { … }

export function trackRecommendationClick({ surface, listingId, position, meta, anchorListingId }) { … }
```

### Behavior spec

1. **Impression:** fire when container ≥50% visible and `listings.length >= minVisible` (pass per rail: similar 4, for_you 6, recent 1).
2. **Dedupe:** one impression per `{surface, anchorListingId?, pathname}` per session (sessionStorage key `gsl_rec_imp_${surface}_…`).
3. **Click:** synchronous before navigation; include `position` from map index.
4. **Dev fallback:** rely on existing `console.debug` in `trackProductEvent` when PostHog absent.

### Acceptance

- [ ] No imports from rails into product-analytics duplicated logic
- [ ] `npm run lint` clean
- [ ] Manual: mount empty rail → no impression

---

## PR G-2 — Similar + Recent rails

### Files to modify

| File | Change |
|------|--------|
| `components/recommendations/SimilarListingsRail.jsx` | `surface="similar_pdp"`, hook, click handler, `mode: 'similar_v1'`, `anchor_listing_id` |
| `components/recommendations/RecentlyViewedRail.jsx` | `surface="recent_pdp"`, hook, click handler, `mode: recent_local` or `recent_merged` if user logged in |

### Properties matrix

| Rail | surface | mode | anchor_listing_id |
|------|---------|------|-------------------|
| Similar | `similar_pdp` | `similar_v1` | listingId prop |
| Recent | `recent_pdp` | `recent_local` / `recent_merged` | — |

### Pass `authenticated`

Recent rail: accept optional `userId` prop from PDP page (or read `useAuth` inside rail — prefer prop from page to keep rail dumb).

### Acceptance

- [ ] DevTools: impression after scroll similar block into view
- [ ] Click logs `listing_id` + `position`
- [ ] No impression when similar hidden (`< SIMILAR_MIN_RESULTS`)

---

## PR G-3 — ForYouRail refactor

### Files to modify

| File | Change |
|------|--------|
| `components/recommendations/ForYouRail.jsx` | Remove inline `impressionSentRef` + duplicate track calls; use shared hook |

### Preserve

- Existing `surface` prop values: `for_you_home`, `for_you_catalog`
- `meta.mode`, `meta.authenticated` passthrough

### Acceptance

- [ ] Behavior parity with pre-refactor (same events, same properties)
- [ ] No double impression on `where` change remount (new session dedupe key includes `where`)

---

## PR G-4 — Catalog sort change

### Files to modify

| File | Change |
|------|--------|
| `lib/analytics/product-analytics.js` | Add `CATALOG_SORT_CHANGE: 'catalog_sort_change'` |
| `components/search/CatalogSortSelect.jsx` | Optional `onSortChangeAnalytics(from, to)` callback **or** track inside parent only |
| `app/listings/listings-catalog-client.jsx` | On user sort change: `trackProductEvent(CATALOG_SORT_CHANGE, { from_sort, to_sort, where, has_bbox })` |

### Important: skip URL hydrate

Fire only when user selects new value in `Select`, **not** on initial `parseCatalogSortFromParams` sync.

Suggested pattern:

```javascript
const handleCatalogSortChange = (next) => {
  const prev = catalogSort
  if (prev !== next) {
    void trackProductEvent(ProductAnalyticsEvents.CATALOG_SORT_CHANGE, {
      from_sort: prev,
      to_sort: next,
      where: debouncedWhere !== 'all' ? debouncedWhere : undefined,
      has_bbox: Boolean(appliedBbox),
    })
  }
  setCatalogSort(next)
}
```

### Acceptance

- [ ] Page load with `?sort=price_asc` → no event
- [ ] User changes sort → exactly one event

---

## PR G-5 (optional) — E2E smoke

### Files to create/modify

| File | Change |
|------|--------|
| `tests/e2e/discovery-analytics.spec.ts` | Visit PDP with fixture listing; intercept or listen console for `[analytics] recommendation_impression` |
| `lib/e2e/…` | Reuse existing listing fixture if available |

### Scope

Minimal: one test per surface type (similar on PDP). Full matrix deferred.

---

## Docs updates (same PR as G-1 or final G-4)

| Document | Update |
|----------|--------|
| `docs/ADR/169-guest-retention-analytics.md` | Status → Accepted when G-1..G-4 merged |
| `docs/ADR/167-discovery-recommendations-ssot.md` | §3 checkboxes analytics `[x]` |
| `docs/TECHNICAL_MANIFESTO.md` | Stage 169.0 entry |
| `docs/ARCHITECTURAL_PASSPORT.md` | Version bump + analytics SSOT row |

---

## Post-merge checklist (Product / Ops)

1. Confirm `NEXT_PUBLIC_POSTHOG_KEY` on production Vercel env.
2. Open PostHog → Live Events → filter `recommendation_impression`.
3. Manual walkthrough:
   - Home → scroll For You → impression
   - Catalog → change sort → `catalog_sort_change`
   - PDP → similar + recent → impression + click
4. Create dashboards per ADR-169 §5.2.
5. Schedule 30-day review (ADR-169 §7 Stage 169.2).

---

## Out of scope (Wave G P1 — separate PRs)

| Item | ADR reference |
|------|---------------|
| `RecentlyViewedRail` on home | ADR-167 §2.4, ADR-169 §7 169.1 |
| Lower personalization min results | Product decision |
| Move ForYou below catalog results | Product decision |
| `GET /api/v2/favorites/check?listingIds=` | ADR-167 §2.5 |
| PostHog `identify` on login | ADR-169 §5.4 |
| PWA install prompt | Wave G mobile track |

---

## Risk register

| Risk | Mitigation |
|------|------------|
| IO not firing on fast scroll mobile | Threshold 0.25 fallback + fire on mount if already visible |
| Session dedupe too aggressive | Key includes `listing_ids` hash for PDP remount |
| PostHog bundle size | Dynamic import already in `product-analytics.js` |
| PR G-3 regression | Manual parity check before merge |

---

## Reviewer checklist

- [ ] Event names match `ProductAnalyticsEvents` only
- [ ] `surface` values match ADR-169 §3.3
- [ ] No PII in properties
- [ ] No ranking/favorite/booking logic changed
- [ ] Brand check: `npm run check:brand` if UI strings touched (G-2..G-4 should not)
