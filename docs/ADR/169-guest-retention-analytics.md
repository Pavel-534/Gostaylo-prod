# ADR-169: Guest Retention & Discovery Analytics SSOT (Wave G — Measure & Prove)

| Field | Value |
|-------|--------|
| **Status** | **Proposed** → **Accepted** pending prod PostHog verify (Stage 169.0 code merged 2026-06-19) |
| **Stage** | **169.0** → **169.1** (Wave G start) |
| **Date** | 2026-06-19 |
| **Baseline** | v12.168.2 (Wave F Discovery closed; Security 168.2 closed) |
| **Deciders** | Product owner, Engineering |
| **Related** | ADR-167 (Discovery rails), Stage 116.0 (`product-analytics.js`), Post-Audit Wave G (2026-06-19) |
| **SSOT after adoption** | Этот ADR + **`lib/analytics/recommendation-rail-analytics.js`** (planned) + **`lib/analytics/product-analytics.js`** (event names) |

---

## 1. Context

### 1.1. Продуктовая цель

Wave F (167.0–167.2) добавила discovery-слой: similar, recently viewed, for-you, sort, price histogram, favorites SSOT. **Transactional core зрелый**, но **retention loop discovery не измеряется**:

| Gap | Impact |
|-----|--------|
| `recommendation_impression` / `recommendation_click` — только **`ForYouRail`** | Нельзя сравнить similar vs recent vs for_you |
| Нет события **`catalog_sort_change`** | Непрозрачно, меняет ли sort поведение |
| Нет cohort **D1/D7 guest retention** по использованию discovery | Нельзя доказать ROI Wave F |
| PostHog opt-in через `NEXT_PUBLIC_POSTHOG_KEY` | Без ключа — silent no-op; prod readiness не формализован |
| Guest views только localStorage до login | Cold-start personalization слабый (см. ADR-167 §7.2) |

**Wave G принцип:** *«Discovery that earns its place»* — сначала измерить, затем усиливать loops (home recent, push, mobile map). ML и price-drop alerts — после данных (167.3+).

### 1.2. As-is (код, v12.168.2)

| Контур | Поведение |
|--------|-----------|
| **`lib/analytics/product-analytics.js`** | PostHog primary; `capture_pageview: false`; init в `ProductAnalyticsInit` |
| **События** | `page_view`, `search`, `listing_view`, `booking_start`, `payment_success`, … + `recommendation_*` |
| **Discovery telemetry** | Impression/click **только** в `components/recommendations/ForYouRail.jsx` |
| **Server signals** | `listing_views` (auth), `favorites`, personalization weights — **не экспортируются** в product analytics |
| **Admin retention** | Partner host retention cron; referral team retention (ADR-133) — **не guest product** |

### 1.3. Проблема

Без единого SSOT по discovery analytics команда не может:

1. Ответить «similar listings окупаются?».
2. Приоритизировать Wave G P1 (placement, thresholds, push) данными.
3. Построить D7 retention cohort «использовал discovery vs нет».

---

## 2. Decision summary

**Stage 169** вводит **Guest Retention Analytics SSOT** с четырьмя решениями:

1. **Единый контракт discovery telemetry** — все rails и sort используют общий модуль (не копировать логику из `ForYouRail`).
2. **Фиксированный enum `surface`** — согласован с ADR-167 §2.9 (placement matrix).
3. **PostHog как primary warehouse** — dashboards + funnels + cohorts по этому ADR; server-side дублирование не строим в v1.
4. **Prod readiness checklist** — ключ PostHog, smoke на события, алерт «zero events 24h».

**Инварианты (не обсуждаются):**

- Analytics **не меняет** экономику, цены, ranking weights.
- **Не отправлять PII** в event properties (email, phone, full name) — см. `lib/logging/pii-scrub.js` spirit.
- `listing_id` в событиях — **допустим** (product analytics, не security logs).
- i18n / UI — без изменений в 169.0 (только telemetry).

---

## 3. Event catalog SSOT

### 3.1. Имена событий (`ProductAnalyticsEvents`)

| Event key | PostHog name | Emitter (as-is / planned) | Stage |
|-----------|--------------|---------------------------|-------|
| `PAGE_VIEW` | `page_view` | `ProductAnalyticsInit` | 116 ✓ |
| `SEARCH` | `search` | `fetch-catalog-search.js` | 116 ✓ |
| `LISTING_VIEW` | `listing_view` | `useListingViewData` | 116 ✓ |
| `BOOKING_START` | `booking_start` | `useListingBookingFlow` | 116 ✓ |
| `PAYMENT_SUCCESS` | `payment_success` | checkout flows | 116 ✓ |
| `RECOMMENDATION_IMPRESSION` | `recommendation_impression` | All discovery rails via `recommendation-rail-analytics.js` | **169.0** ✓ |
| `RECOMMENDATION_CLICK` | `recommendation_click` | All discovery rails via `recommendation-rail-analytics.js` | **169.0** ✓ |
| `CATALOG_SORT_CHANGE` | `catalog_sort_change` | `listings-catalog-client.jsx` (user sort only) | **169.0** ✓ |
| `PWA_PROMPT_SHOWN` | `pwa_prompt_shown` | — | **169.4** |
| `PWA_PROMPT_ACCEPTED` | `pwa_prompt_accepted` | — | **169.4** |
| `PWA_PROMPT_DISMISSED` | `pwa_prompt_dismissed` | — | **169.4** |
| `GUEST_PERSONALIZATION_FOR_YOU` | `guest_personalization_for_you` | `ForYouRail` (guest cookie mode) | **169.5** |

**Запрещено:** новые ad-hoc строки событий в компонентах rails — только через `product-analytics.js` constants.

### 3.2. Properties — discovery events

#### `recommendation_impression`

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `surface` | string | **yes** | SSOT enum §3.3 |
| `count` | number | yes | Cards shown in rail |
| `listing_ids` | string[] | no | First 12 ids (cap for payload size) |
| `mode` | string | no | `personalized` \| `guest_personalized` \| `regional_popular` \| `similar_v1` \| `recent_local` \| `recent_merged` |
| `authenticated` | boolean | no | Viewer logged in |
| `guest_signals` | number | no | Count of cookie view ids (**169.5**) |
| `anchor_listing_id` | string | no | PDP anchor (similar only) |

**Impression rule:** fire **once per rail mount per surface+anchor** when ≥1 card visible (IntersectionObserver root 50%, threshold 0.5) — SSOT in `recommendation-rail-analytics.js`.

#### `recommendation_click`

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `surface` | string | **yes** | §3.3 |
| `listing_id` | string | **yes** | Clicked card |
| `position` | number | no | 0-based index in rail |
| `mode` | string | no | Same as impression |
| `anchor_listing_id` | string | no | Similar only |

#### `catalog_sort_change`

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `from_sort` | string | yes | `recommended` \| `price_asc` \| `price_desc` \| `distance` |
| `to_sort` | string | yes | Same enum |
| `where` | string | no | Catalog region slug |
| `has_bbox` | boolean | no | Map bbox active |

### 3.3. Enum `surface` (SSOT)

| Value | Page / component | ADR-167 placement |
|-------|------------------|-------------------|
| `for_you_home` | `PlatformHomeContent` → `ForYouRail` | Home, below hero |
| `for_you_catalog` | `listings-catalog-client` → `ForYouRail` | Catalog, **before results** (review in 169.1) |
| `similar_pdp` | PDP → `SimilarListingsRail` | PDP, below reviews |
| `recent_pdp` | PDP → `RecentlyViewedRail` | PDP, below similar |
| `recent_home` | Home → `RecentlyViewedRail` | **Planned 169.1** (ADR-167 §2.4) |

**Запрещено:** произвольные строки `surface` в PR без обновления этой таблицы.

---

## 4. Funnels & cohorts (PostHog)

### 4.1. Primary funnel — Discovery → Booking

```
recommendation_impression (any surface)
  → recommendation_click
  → listing_view (same listing_id within 30 min)
  → booking_start (same listing_id within 7 d)
  → payment_success (same listing_id within 14 d)
```

**Breakdown:** `surface`, `mode`, `authenticated`.

**Success metric (Wave G target):** CTR click/impression ≥ **8%** (Airbnb-class carousel benchmark; пересмотреть после 30d data).

### 4.2. Funnel — Catalog sort impact

```
search
  → catalog_sort_change (to_sort != recommended)
  → listing_view (within session)
  → booking_start
```

**Hypothesis:** explicit sort increases conversion vs default `recommended` for price-sensitive verticals.

### 4.3. Cohort — D7 guest retention

**Definition A — Discovery engaged:**

Users with ≥1 `recommendation_click` OR ≥2 `listing_view` from different sessions in first 7 days.

**Definition B — Control:**

Users with `page_view` on `/listings` but **no** `recommendation_impression` in first session.

**Metric:** % users with `page_view` on day 7 (return visit).

**Dashboard:** Retention chart, breakdown by `surface` of first click.

### 4.4. Operational health

| Alert | Condition |
|-------|-----------|
| Analytics silent | Zero `page_view` prod 24h |
| Discovery blind | Zero `recommendation_impression` 48h while `listing_view` > 100 |
| PostHog misconfig | Staging: `NEXT_PUBLIC_POSTHOG_KEY` unset in CI smoke note |

---

## 5. PostHog implementation notes

### 5.1. Environment

| Env var | Role |
|---------|------|
| `NEXT_PUBLIC_POSTHOG_KEY` | Required for prod analytics |
| `NEXT_PUBLIC_POSTHOG_HOST` | Default `https://us.i.posthog.com` |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | `false` disables all capture |

**Pre-launch checklist item:** ключ задан на production; verify via Live Events.

### 5.2. Suggested dashboards (manual setup in PostHog UI)

1. **Discovery Overview** — trends: impression, click, CTR by `surface`.
2. **PDP Cross-sell** — funnel similar_pdp → listing_view → booking_start.
3. **For You modes** — compare `mode=personalized` vs `regional_popular`.
4. **Sort experiment** — catalog_sort_change volume + downstream booking_start.
5. **Guest D7** — retention cohort §4.3.

### 5.3. Example HogQL snippets

**CTR by surface (7d):**

```sql
SELECT
  properties.surface AS surface,
  countIf(event = 'recommendation_impression') AS impressions,
  countIf(event = 'recommendation_click') AS clicks,
  clicks / impressions AS ctr
FROM events
WHERE timestamp > now() - INTERVAL 7 DAY
  AND event IN ('recommendation_impression', 'recommendation_click')
GROUP BY surface
ORDER BY impressions DESC
```

**Similar → book (30d, simplified):**

```sql
SELECT
  count(DISTINCT e.person_id) AS users_clicked_similar,
  count(DISTINCT b.person_id) AS users_booked_after_click
FROM events e
LEFT JOIN events b ON e.person_id = b.person_id
  AND b.event = 'booking_start'
  AND b.timestamp > e.timestamp
  AND b.timestamp < e.timestamp + INTERVAL 7 DAY
  AND b.properties.listing_id = e.properties.listing_id
WHERE e.event = 'recommendation_click'
  AND e.properties.surface = 'similar_pdp'
  AND e.timestamp > now() - INTERVAL 30 DAY
```

*(Adjust property paths to match PostHog project schema after first events land.)*

### 5.4. Identity

- PostHog `identify()` on login — **planned 169.1** (link anonymous → auth for merge).
- Until then: session-level funnels only; server `listing_views` not joined to PostHog in v1.

---

## 6. Planned code SSOT (169.0 — not implemented yet)

```
lib/analytics/recommendation-rail-analytics.js   ← NEW (Wave G P0)
  useRecommendationRailAnalytics({ surface, listings, meta, anchorListingId })
  trackRecommendationClick({ surface, listingId, position, meta, anchorListingId })

components/recommendations/SimilarListingsRail.jsx   ← wire hook
components/recommendations/RecentlyViewedRail.jsx    ← wire hook
components/recommendations/ForYouRail.jsx            ← migrate to hook (dedupe)
components/search/CatalogSortSelect.jsx              ← catalog_sort_change
```

**Forbidden:** duplicate impression ref logic in each rail component after 169.0.

---

## 7. Stage breakdown

### Stage 169.0 — Discovery telemetry (P0)

| Work item | Owner hint |
|-----------|------------|
| `recommendation-rail-analytics.js` | Frontend |
| Wire similar + recent rails | Frontend |
| Refactor `ForYouRail` to shared hook | Frontend |
| `catalog_sort_change` in `CatalogSortSelect` / catalog client | Frontend |
| `CATALOG_SORT_CHANGE` in `product-analytics.js` | Frontend |
| PostHog dashboards (manual) | Product |
| E2E: events fire in dev (`console.debug` fallback) | QA |

**Acceptance criteria (169.0):**

- [x] All five `surface` values emit impression+click when rail visible (169.1: `recent_home` on home).
- [ ] Impression deduped per mount (no double-count on re-render).
- [ ] `catalog_sort_change` on user-initiated sort change only (not URL hydrate).
- [ ] ADR-167 §3 acceptance item «Impression/click … similar|recent» satisfied.
- [ ] PR plan `docs/proposals/WAVE_G_P0_DISCOVERY_ANALYTICS_PR_PLAN.md` executed.

### Stage 169.1 — Retention loops + identity (P1)

| Work item | Notes |
|-----------|-------|
| `RecentlyViewedRail` on home (`recent_home`) | ADR-167 §2.4 | **169.1** ✓ |
| Lower `PERSONALIZATION_MIN_RESULTS` or fallback UX | Product decision |
| ForYou catalog placement after results | Product decision |
| PostHog `identify` on auth | `auth-context` |
| `favorite_toggle` event | Optional |
| Guest view cookie merge | ADR-167 §2.8 | **169.5** ✓ |

### Stage 169.5 — Guest cookie personalization (P2)

| Work item | Notes |
|-----------|-------|
| `lib/guest/guest-signals.js` | Cookie SSOT, max 40 / 30d |
| For You `guest_personalized` | `personalization-v1.service.js` |
| Similar category boost | `similar-listings.service.js` |
| Login merge → `listing_views` | `useRecentlyViewed` |
| Event `guest_personalization_for_you` | `ForYouRail` |

### Stage 169.4 — Smart PWA install (P2)

| Work item | Notes |
|-----------|-------|
| `PwaInstallPrompt` + `use-pwa-install` | Mobile ≤768px only; engagement + 10d snooze |
| Events `pwa_prompt_*` | `product-analytics.js` |
| iOS A2HS instructions | No `beforeinstallprompt` |
| Android `beforeinstallprompt` | Requires SW fetch on `firebase-messaging-sw.js` |

**Eligibility (OR):** ≥2 unique visit days · ≥2 PDP views · ≥1 catalog map open. Not on first visit alone.

### Stage 169.2 — Prove & optimize (P1)

| Work item | Notes |
|-----------|-------|
| 30-day dashboard review | Product |
| A/B placement (similar above fold) | If CTR < target |
| Batch favorites check | ADR-167 §2.5 | **169.2** ✓ |
| Mobile map full-screen sheet | ADR-167 §2.7 | **169.3** ✓ |
| PWA install prompt | Wave G P2 | **169.4** ✓ |

---

## 8. Non-goals (169.0–169.1)

- Server-side event warehouse / BigQuery pipeline.
- ML ranking experiments.
- Marketing email/push retention (167.3) — separate stage.
- Changing discovery algorithms (similar radius, weights).

---

## 9. Privacy & compliance

- Event properties: **no** email, phone, guest name, message body.
- `user_id` in PostHog identify — internal profile id only after explicit identify (169.1).
- EU users: PostHog region / consent banner — **product decision** (out of 169.0 scope; track in privacy backlog).

---

## 10. Open questions (for product decision)

1. **PostHog project:** single prod project or staging separate key?
2. **Identify on login:** immediate 169.1 or wait for cookie consent UX?
3. **CTR target 8%:** accept as working hypothesis or set lower for early catalog?
4. **ForYou on catalog:** move below results in 169.1 without A/B, or A/B first?

---

## 11. References

- `docs/ADR/167-discovery-recommendations-ssot.md` — discovery features + §2.9 placement
- `docs/proposals/WAVE_G_P0_DISCOVERY_ANALYTICS_PR_PLAN.md` — implementation PR sequence
- `lib/analytics/product-analytics.js` — event name SSOT
- `components/recommendations/ForYouRail.jsx` — reference implementation (partial)
- Post-Audit Wave G (2026-06-19) — product audit baseline v12.168.2
