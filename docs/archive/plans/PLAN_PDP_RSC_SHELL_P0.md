# P0: RSC shell для PDP (`/listings/[id]`) — план реализации

**Дата:** 2026-07-15  
**Статус:** **✅ P0 завершён (PR-1…PR-6, 2026-07-15)**  
**Синтез аудитов:** [RSC](AUDIT_RSC_OPTIMIZATION.md) · [Data Fetching](AUDIT_DATA_FETCHING.md) · [iOS PWA](AUDIT_IOS_PWA_PERFORMANCE.md)  
**Связанные Stage:** 171.21 (loading shell + RQ init), 171.23 (memo details column, RQ calendar), **171.24 (RSC shell closure)**

---

## 0. Цель P0 (Definition of Done)

| Критерий | Сейчас | После P0 |
|----------|--------|----------|
| `app/listings/[id]/page.js` | 100% `'use client'` | **Server Component** (shell + bootstrap) |
| Listing fetch на cold PDP (guest) | Server layout (lite) + **client** `GET /api/v2/listings/[id]` | **1× server bootstrap** + **0 refetch** на mount (RQ hydrate) |
| Catalog hover/touch prefetch | `queryKeys.listing.detail(id)` | **Тот же key** — совместимость сохранена |
| Booking / calendar / chat | Client | **Client islands** — поведение без изменений |
| E2E | `booking-flow`, `guest-inquiry-golden-path`, `discovery-analytics` | Green |
| Доки | — | Обновить `TECHNICAL_MANIFESTO` + `ARCHITECTURAL_PASSPORT` (§ PDP RSC) |

**Вне scope P0 (P0.5 / P1):** RSC static blocks (HowItWorks-style для description), `useCommission` → RQ, reviews dehydrate, layout metadata unification, route-group providers.

---

## 1. Текущая структура файлов PDP

### 1.1. Маршрут `app/listings/[id]/`

| Файл | Тип | Роль |
|------|-----|------|
| `layout.js` | **Server** | `generateMetadata` + `ListingSchema` JSON-LD |
| `page.js` | **Client (весь файл)** | Composer: view + booking + chat + gallery |
| `loading.js` | **Server** | `ListingPageSkeleton` (Stage 171.21) |
| `error.jsx` | Client | Error boundary |

### 1.2. Server data (layout, без передачи в page)

```
lib/seo/listing-layout-data.js
├── getCachedListingForGuestGate(id)     [React.cache] — ACTIVE|PENDING row, урезанный SELECT
└── getCachedActiveListingForLayout(id)  → cache hit + filter ACTIVE

app/listings/[id]/layout.js
├── generateMetadata → getCachedListingForGuestGate + OG builders
└── ListingSchema → getCachedActiveListingForLayout + getCommissionRate (guest fee % only)
```

**SELECT layout** (~15 полей) ≠ **GET API** (full join, promos, coords, seasonal, trust).

### 1.3. Client data (page)

```
hooks/useListingViewData.js
├── readListingViewCacheSnapshot(queryClient, id)  — prefetch с каталога
├── fetchListingDetail → GET /api/v2/listings/[id] → mapListingDetailFromApi
├── loadReviews → GET /api/v2/reviews?listing_id=  (raw fetch, не RQ)
├── useFxRatesQuery
├── useFavoriteState
└── local language/currency (не useI18n/useCurrency)

hooks/useListingBookingFlow.js   (~630 строк, 25+ return fields)
hooks/useListingChat.js

lib/hooks/use-listing-detail-prefetch.js  — catalog hover/touch → prefetchQuery(detail + calendar)
lib/catalog/fetch-listing-detail.js
lib/catalog/map-listing-detail-api.js
```

### 1.4. Ключевые UI-компоненты

| Комponent | Client | Зависимости |
|-----------|--------|-------------|
| `ListingPageNav` | ✓ | favorite, back |
| `ListingHeroGallery` | ✓ | gallery click, UrgencyTimer |
| `ListingPdpDetailsColumn` | ✓ (memo) | map, chat preview, rails |
| `ListingBookingSection` | ✓ | calendar, pricing, modal |
| `ListingMobileActions` | ✓ | mobile bar + inline calendar |
| `GalleryModal` | ✓ | lightbox |
| `GuestBookingFlowHint` | ✓ | usePathname |
| `ReferralCatalogFunnelStrip` | ✓ | — |

Legacy дубликаты в `app/listings/[id]/components/`: `ListingHeader`, `ListingDescription`, `ListingGallery`, `BookingWidget` — используются из `components/listing/pdp/*`.

### 1.5. API SSOT (то, что должен вызывать server bootstrap)

`app/api/v2/listings/[id]/route.js` — GET:

- Supabase full select + categories + owner
- `resolveListingPublicGuestAccess` (session-aware)
- Parallel: seasonal_prices, reviews count, commission snapshot
- Promos, partner trust, coordinate reveal
- Response `transformed` → клиент маппит через `mapListingDetailFromApi`

**Проблема:** ~400 строк логики **только в route handler** — нельзя безопасно «переиспользовать layout row»; нужен **extract service**.

### 1.6. TanStack Query keys (SSOT)

```js
queryKeys.listing.detail(listingId)
// → ['listing', 'detail', 'public', id]

queryKeys.listing.calendar(id, { guests, days })
// prefetch: staleTime 5 min (use-listing-detail-prefetch.js)
```

**HydrationBoundary в репозитории сегодня: отсутствует.**

---

## 2. Целевая структура

### 2.1. Дерево файлов (после P0)

```
app/listings/[id]/
├── layout.js                    [Server] без изменений логики (P0.5: optional bootstrap reuse)
├── loading.js                   [Server] без изменений
├── page.js                      [Server] ★ NEW — bootstrap + dehydrate + shell
├── ListingPdpClient.jsx         [Client] ★ перенос из page.js (composer)
└── components/                  без переименования (nav, skeleton, booking widget)

lib/listing/
├── get-public-listing-detail.js      ★ extract из API GET (pure server)
└── get-cached-listing-pdp-bootstrap.js ★ React.cache wrapper + gate + map

lib/query-prefetch/
├── create-server-query-client.js     ★ QueryClient для RSC (без browser singleton)
└── prefetch-listing-pdp-queries.js     ★ prefetch + dehydrate listing.detail

components/listing/pdp/
├── ListingPdpHydrationBoundary.jsx   ★ 'use client' + HydrationBoundary
└── ListingBookingProvider.jsx        ★ optional P0 PR-4 — context для booking island

hooks/
├── useListingViewData.js             ★ useQuery вместо manual fetch; respect hydrate
└── useListingBookingFlow.js          без изменений логики (PR-4: context export)
```

### 2.2. RSC vs Client islands (целевая карта)

```
┌─────────────────────────────────────────────────────────────────┐
│ page.js (RSC)                                                    │
│  getCachedListingPdpBootstrap(id)                                │
│  prefetchListingPdpQueries → dehydratedState                     │
│  lang from getLangFromRequest                                    │
├─────────────────────────────────────────────────────────────────┤
│ IF moderation / notFound → server-render stub (no client island) │
├─────────────────────────────────────────────────────────────────┤
│ ListingPdpHydrationBoundary (client)                             │
│  └─ ListingPdpClient (client)                                    │
│       ├─ ListingPageNav                    [client]              │
│       ├─ ListingHeroGallery                [client]  ← P1: split static hero
│       ├─ ListingPdpDetailsColumn           [client]  ← P1: RSC static inner
│       ├─ ListingBookingProvider            [client]              │
│       │    ├─ ListingBookingSection                             │
│       │    └─ (mobile via mobileBelow prop)                     │
│       ├─ ListingChat (useListingChat)      [client]              │
│       └─ GalleryModal                      [client]              │
└─────────────────────────────────────────────────────────────────┘
```

| Слой | P0 | P1 (follow-up) |
|------|----|----------------|
| page.js | Server bootstrap + gate views | + streaming Suspense reviews |
| Hero title/price HTML | Client (hydrated listing) | RSC static + client lightbox |
| Description/policies | Client | RSC |
| Booking widget | Client island | + ListingBookingProvider |
| Calendar/pricing API | Client (unchanged) | commission RQ prefetch |

---

## 3. Точный список изменений

### 3.1. Новые файлы

| Файл | Содержание |
|------|------------|
| `lib/listing/get-public-listing-detail.js` | `getPublicListingDetail({ listingId, viewerId, viewerRole })` — body текущего GET handler без `NextResponse`; returns `{ ok, data?, code?, httpStatus? }` |
| `lib/listing/get-cached-listing-pdp-bootstrap.js` | `cache(async (listingId) => { session; detail; mapListingDetailFromApi; moderation flags })` |
| `lib/query-prefetch/create-server-query-client.js` | `makeQueryClient()` — те же defaultOptions что `lib/query-client.js`, **новый instance per request** |
| `lib/query-prefetch/prefetch-listing-pdp-queries.js` | `prefetchListingPdpQueries(qc, { listingId, listingDto })` + `dehydrate(qc)` |
| `components/listing/pdp/ListingPdpHydrationBoundary.jsx` | `'use client'`; `HydrationBoundary` from `@tanstack/react-query` |
| `app/listings/[id]/ListingPdpClient.jsx` | Перенос `PremiumListingContent` + default export wrapper |
| `app/listings/[id]/ListingPdpGateViews.jsx` | **Server** optional: moderation/notFound UI (без hooks) — или inline в page.js |
| `components/listing/pdp/ListingBookingProvider.jsx` | PR-4: context wrapper |

### 3.2. Изменяемые файлы

| Файл | Изменение |
|------|-----------|
| `app/api/v2/listings/[id]/route.js` | GET → thin: `getPublicListingDetail` + `NextResponse.json` (контракт **не меняется**) |
| `app/listings/[id]/page.js` | Заменить на async Server Component |
| `hooks/useListingViewData.js` | `useQuery({ queryKey, queryFn: () => fetchListingDetail(id), staleTime: 5min, enabled })`; убрать duplicate `loadListing` если cache hydrated; **initialData не нужен** если dehydrate корректен |
| `lib/query-keys.js` | P1: `listing.reviews(id)`, `commission(partnerId)` — **не блокер P0** |

### 3.3. Удаляемое / не переносимое

| Что | Действие |
|-----|----------|
| `'use client'` в `page.js` | Удалить — page становится RSC |
| `Suspense` wrapper в page default export | Перенести в client или убрать (RSC + `loading.js` достаточно) |
| Duplicate manual `setQueryData` в `useListingViewData` | Заменить на единый `useQuery` path |
| Skeleton при hydrated cache | `isPending && !data` — не показывать skeleton если dehydrate заполнил cache |

### 3.4. Без изменений в P0

- `layout.js` / `listing-layout-data.js` — работают параллельно (см. §4)
- `useListingBookingFlow.js` — логика 1:1 (PR-4 только context wrapper)
- `use-listing-detail-prefetch.js` — **не трогать** keys/staleTime
- `PlatformCalendar`, `BookingModal`, payment/chat flows
- `data-testid` атрибуты (E2E)

---

## 4. Как убрать double fetch listing

### 4.1. Три слоя «дубля» (развести явно)

| # | Откуда → куда | Тип | P0 решение |
|---|---------------|-----|------------|
| A | layout lite Supabase → client full API | Server + client **разные shape** | Client refetch **убрать** через dehydrate |
| B | layout + page server (оба server) | 2 SQL в одном HTTP | **Acceptable в P0**; unify в P0.5 |
| C | Catalog prefetch → PDP mount | Client RQ cache | **Сохранить** — `readListingViewCacheSnapshot` → `useQuery` initial |

### 4.2. Канонический поток после P0

```
HTTP GET /listings/[id]
│
├─ layout (parallel in same request)
│   ├─ generateMetadata → getCachedListingForGuestGate  [cache A]
│   └─ ListingSchema    → getCachedActiveListingForLayout [cache A hit]
│
└─ page (RSC)
    └─ getCachedListingPdpBootstrap(id)  [cache B — NEW, full DTO]
         ├─ getSessionPayload()
         ├─ getPublicListingDetail()      ← тот же код что API
         ├─ mapListingDetailFromApi()
         └─ prefetchListingPdpQueries → dehydrate
              │
              └─ ListingPdpHydrationBoundary → ListingPdpClient
                   └─ useQuery(listing.detail) → CACHE HIT → no network
```

### 4.3. Extract service (обязательный шаг PR-1)

Псевдокод контракта:

```javascript
// lib/listing/get-public-listing-detail.js
export async function getPublicListingDetail({ listingId, viewerId, viewerRole }) {
  // Move from route.js GET:
  // - supabase select
  // - resolveListingPublicGuestAccess
  // - parallel seasonal / reviews / commission
  // - promos, trust, coords
  // - increment views (non-blocking) — только здесь, не дублировать в bootstrap второй раз
  return { ok: true, data: transformed }
  // or { ok: false, code: 'LISTING_UNDER_MODERATION', httpStatus: 403 }
}
```

```javascript
// lib/listing/get-cached-listing-pdp-bootstrap.js
import { cache } from 'react'
import { getSessionPayload } from '@/lib/services/session-service'
import { getPublicListingDetail } from './get-public-listing-detail'
import { mapListingDetailFromApi } from '@/lib/catalog/map-listing-detail-api'

export const getCachedListingPdpBootstrap = cache(async (listingId) => {
  const id = String(listingId || '').trim()
  if (!id) return { kind: 'not_found' }

  const session = await getSessionPayload()
  const result = await getPublicListingDetail({
    listingId: id,
    viewerId: session?.userId ?? null,
    viewerRole: session?.role ?? null,
  })

  if (!result.ok && result.code === 'LISTING_UNDER_MODERATION') {
    return { kind: 'moderation' }
  }
  if (!result.ok) return { kind: 'not_found' }

  const listing = mapListingDetailFromApi(result.data)
  return { kind: 'ok', listing, raw: result.data }
})
```

### 4.4. P0.5 (optional follow-up PR): unify layout + page server fetch

- Расширить bootstrap или shared `getCachedListingRowForSeo` чтобы `layout.js` **не делал** отдельный Supabase select.
- JSON-LD может брать subset из `bootstrap.raw`.
- **Не блокирует P0** — экономия 1 lite SQL vs устранение client RTT.

### 4.5. Views increment

Сегодня increment в API GET. После extract:

- Server bootstrap вызывает тот же service → **1 increment per full page view** (OK).
- Client **не** вызывает GET на mount → нет double increment.

---

## 5. HydrationBoundary + dehydrate (TanStack Query v5)

### 5.1. Server prefetch helper

```javascript
// lib/query-prefetch/prefetch-listing-pdp-queries.js
import { dehydrate } from '@tanstack/react-query'
import { createServerQueryClient } from './create-server-query-client'
import { queryKeys } from '@/lib/query-keys'

export const LISTING_DETAIL_STALE_MS = 5 * 60 * 1000 // = use-listing-detail-prefetch.js

export async function buildListingPdpDehydratedState(listingId, listingDto) {
  const qc = createServerQueryClient()
  const id = String(listingId)

  if (listingDto) {
    await qc.prefetchQuery({
      queryKey: queryKeys.listing.detail(id),
      queryFn: () => Promise.resolve(listingDto),
      staleTime: LISTING_DETAIL_STALE_MS,
    })
  }

  return dehydrate(qc)
}
```

**Критично:** `queryFn` на server возвращает **уже mapped DTO** (тот же object shape что `fetchListingDetail`).

### 5.2. Client boundary

```javascript
// components/listing/pdp/ListingPdpHydrationBoundary.jsx
'use client'
import { HydrationBoundary } from '@tanstack/react-query'
import { ListingPdpClient } from '@/app/listings/[id]/ListingPdpClient'

export function ListingPdpHydrationBoundary({ state, ...props }) {
  return (
    <HydrationBoundary state={state}>
      <ListingPdpClient {...props} />
    </HydrationBoundary>
  )
}
```

### 5.3. Server page

```javascript
// app/listings/[id]/page.js (RSC)
import { cookies, headers } from 'next/headers'
import { getLangFromRequest } from '@/lib/translations'
import { getCachedListingPdpBootstrap } from '@/lib/listing/get-cached-listing-pdp-bootstrap'
import { buildListingPdpDehydratedState } from '@/lib/query-prefetch/prefetch-listing-pdp-queries'
import { ListingPdpHydrationBoundary } from '@/components/listing/pdp/ListingPdpHydrationBoundary'
import { ListingPdpModerationView, ListingPdpNotFoundView } from './ListingPdpGateViews'

export default async function ListingDetailPage({ params }) {
  const { id } = await params
  const cookieStore = await cookies()
  const headersList = await headers()
  const lang = getLangFromRequest(cookieStore, headersList)

  const bootstrap = await getCachedListingPdpBootstrap(id)

  if (bootstrap.kind === 'moderation') {
    return <ListingPdpModerationView lang={lang} />
  }
  if (bootstrap.kind === 'not_found') {
    return <ListingPdpNotFoundView lang={lang} />
  }

  const dehydratedState = await buildListingPdpDehydratedState(id, bootstrap.listing)

  return (
    <ListingPdpHydrationBoundary
      state={dehydratedState}
      listingId={id}
      lang={lang}
    />
  )
}
```

### 5.4. Refactor `useListingViewData`

```javascript
// hooks/useListingViewData.js — ключевые изменения
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchListingDetail } from '@/lib/catalog/fetch-listing-detail'
import { LISTING_DETAIL_STALE_MS } from '@/lib/query-prefetch/prefetch-listing-pdp-queries'

const listingQuery = useQuery({
  queryKey: queryKeys.listing.detail(listingId),
  queryFn: () => fetchListingDetail(listingId),
  staleTime: LISTING_DETAIL_STALE_MS,
  enabled: !!listingId,
})

const listing = listingQuery.data?.moderationPending
  ? null
  : (listingQuery.data ?? null)
const moderationPending = Boolean(listingQuery.data?.moderationPending)
const loading = listingQuery.isPending && !listingQuery.data
```

**Prefetch с каталога:** тот же `queryKey` + `staleTime` → при navigation cache hit **до** server HTML; после full page load — dehydrate rehydrate без refetch (`refetchOnMount: false` globally).

### 5.5. Что **не** dehydrate в P0

| Data | P0 | P1 |
|------|----|----|
| Listing detail | ✅ | — |
| Reviews | Client fetch (как сейчас) | RQ `listing.reviews` |
| FX rates | Client `useFxRatesQuery` | optional inline |
| Commission | Client `useCommission` | RQ + server prefetch |
| Calendar | Client RQ / catalog prefetch | unchanged |

---

## 6. Booking flow — client island + ListingBookingProvider

### 6.1. Принцип

**Не** поднимать booking state в RSC или root layout. Booking остаётся client-only: calendar, availability debounce, modal, POST `/api/v2/bookings`.

### 6.2. Минимальный `ListingBookingProvider` (PR-4)

Цель: убрать prop drill `ListingPdpClient` → `ListingBookingSection` / `ListingMobileActions` (~25 props × 2).

```javascript
// components/listing/pdp/ListingBookingProvider.jsx
'use client'
import { createContext, useContext } from 'react'
import { useListingBookingFlow } from '@/hooks/useListingBookingFlow'

const ListingBookingContext = createContext(null)

export function ListingBookingProvider({ listing, user, openLoginModal, language, currency, exchangeRates, children }) {
  const booking = useListingBookingFlow({ listing, user, openLoginModal, language, currency, exchangeRates })
  return (
    <ListingBookingContext.Provider value={booking}>
      {children}
    </ListingBookingContext.Provider>
  )
}

export function useListingBooking() {
  const ctx = useContext(ListingBookingContext)
  if (!ctx) throw new Error('useListingBooking outside provider')
  return ctx
}
```

**Обёртка в `ListingPdpClient`:**

```jsx
<ListingBookingProvider listing={listing} user={user} ...>
  <div className="grid ...">
    <ListingPdpDetailsColumn mobileBelow={<ListingMobileActions />} ... />
    <ListingBookingSection />  {/* reads useListingBooking() */}
  </div>
</ListingBookingProvider>
```

`useListingChat` остаётся **сibling** — принимает `dateRange`/`guests` из `useListingBooking()` внутри client tree (не через page composer).

### 6.3. Реактивность (сохранить)

- `ListingPdpDetailsColumn` **memo** — не ререндерить при calendar clicks (Stage 171.23).
- Provider value → **memoize** `{ ...booking }` или split contexts (dates vs modal) **только если** profiling покажет проблему — в P0 достаточно одного context.
- `PlatformCalendar` + `useListingPublicCalendarQuery` — без изменений.
- `useListingAvailabilityQuery` debounce 420ms — без изменений.

### 6.4. Dynamic import (P1, не блокер)

```javascript
const BookingModal = dynamic(() => import('@/components/listing/BookingModal'), { ssr: false })
```

---

## 7. Риски и минимизация

### 7.1. Матрица рисков

| Риск | Вероятность | Impact | Mitigation |
|------|-------------|--------|------------|
| DTO mismatch server vs `mapListingDetailFromApi` | Средняя | Pricing/calendar break | SSOT: один `getPublicListingDetail` + unit test snapshot |
| Hydrate mismatch (React #418) | Средняя | White screen | Dehydrate only serializable DTO; no Date objects without ISO strings |
| Session/guest-gate расходится RSC vs API | Низкая | 403 vs 200 | Same `resolveListingPublicGuestAccess` in service |
| Double view increment | Низкая | Analytics | Single service path; no client GET on mount |
| Catalog prefetch stale vs server fresh | Низкая | Stale price 5min | Acceptable (same as today); `staleTime` aligned |
| E2E timing — skeleton never clears | Средняя | CI red | Keep `data-testid="platform-calendar-trigger"`; `domcontentloaded` + visible title |
| Auth resume / booking modal (Stage 150.2) | Средняя | Login flow break | **Do not touch** `useListingBookingFlow` sessionStorage logic in P0 |
| iOS SW caching RSC payload | Низкая | Stale HTML | SW must not cache document (MANIFESTO §171.16) — verify unchanged |
| Owner/staff sees extra PII | Низкая | Privacy | Pass viewerId/Role into service (same as API) |

### 7.2. E2E checklist (must pass before merge)

| Spec | Critical assertions |
|------|---------------------|
| `e2e/booking-flow.spec.ts` | calendar `days=180`, exchange-rates, price USD recalc |
| `tests/e2e/guest-inquiry-golden-path.spec.ts` | `platform-calendar-trigger`, `booking-modal-confirm`, `guest-booking-next-steps`, stay on PDP URL |
| `tests/e2e/discovery-analytics.spec.ts` | Similar rail visible on PDP |
| Manual | Direct URL PDP (no prefetch), moderation listing, favorite toggle, gallery open |

### 7.3. Rollback strategy

- PR-1 (service extract) **без UI change** — low risk, revert route thin wrapper.
- PR-3 (RSC page) — feature flag env `PDP_RSC_SHELL=0` → re-export old client page (optional, 1 file).

### 7.4. Security

- `getPublicListingDetail` — **server-only** module (no `'use client'` imports).
- RSC gate views — **no booking amounts** on access-denied (checkout pattern later).
- Crawler OG — unchanged in layout (existing guest-gate).

---

## 8. Пошаговый план (маленькие PR)

### PR-1: Extract listing detail service (no UX change)

**Scope:** refactor only  
**Files:** `lib/listing/get-public-listing-detail.js`, `app/api/v2/listings/[id]/route.js`  
**Tests:** existing API consumers; optional `node --test` unit test for gate codes  
**Verify:** `curl GET /api/v2/listings/:id` identical JSON before/after  

### PR-2: Bootstrap cache + dehydrate helpers (no UX change)

**Scope:** new lib modules, no route switch yet  
**Files:** `get-cached-listing-pdp-bootstrap.js`, `create-server-query-client.js`, `prefetch-listing-pdp-queries.js`, `ListingPdpHydrationBoundary.jsx`  
**Verify:** temporary dev-only route or script logs bootstrap + dehydrated keys  

### PR-3: `useListingViewData` → `useQuery` (still client page)

**Scope:** migrate hook; **page.js still client**  
**Files:** `hooks/useListingViewData.js`  
**Why separate:** isolate RQ behavior + catalog prefetch compatibility before RSC switch  
**Verify:** catalog → PDP no skeleton; direct PDP 1× listing API (unchanged until PR-4)  

### PR-4: RSC `page.js` + `ListingPdpClient` (P0 core)

**Scope:** flip page to Server Component  
**Files:** `app/listings/[id]/page.js`, `ListingPdpClient.jsx`, `ListingPdpGateViews.jsx`  
**Verify:**
- Network: **0** `GET /api/v2/listings/[id]` before calendar on cold load
- HTML source contains listing `title` in RSC payload / early flush
- `loading.js` still works  

### PR-5: `ListingBookingProvider` (prop drill cleanup)

**Scope:** refactor composer props only  
**Files:** `ListingBookingProvider.jsx`, `ListingBookingSection.jsx`, `ListingMobileActions.jsx`, `ListingPdpClient.jsx`  
**Verify:** E2E golden path + booking-flow  

### PR-6: Docs + metrics snapshot

**Files:** `docs/TECHNICAL_MANIFESTO.md`, `docs/ARCHITECTURAL_PASSPORT.md`  
**Record:** LCP, First Load JS, # API calls (before/after table)  

### Dependency graph

```
PR-1 ──→ PR-2 ──→ PR-4
          ↘ PR-3 ↗
PR-4 ──→ PR-5
PR-4 ──→ PR-6
```

**Parallel:** PR-3 can start after PR-2; PR-5 after PR-4.

---

## 9. Ожидаемый эффект

### 9.1. Network (guest, cold direct URL)

| Metric | Before | After P0 |
|--------|--------|----------|
| `GET /api/v2/listings/[id]` on mount | **1** | **0** |
| Server SQL (full detail) | 0 (client API) | **1** (RSC bootstrap) |
| Server SQL (layout lite) | 1 | 1 (P0.5 → merge) |
| Reviews / FX / calendar / commission | 4 parallel client | **unchanged** |
| **Total client API before interactive hero** | ~5 | **~4** (−listing) |

### 9.2. Web Vitals (оценка из [iOS PWA audit](AUDIT_IOS_PWA_PERFORMANCE.md))

| Metric | Before | Target P0 | Notes |
|--------|--------|-----------|-------|
| **LCP** | Hero after JS + listing API | **Hero in first RSC stream** | −0.5…1.0s mobile 4G (audit estimate) |
| **FCP** | Skeleton → content | Skeleton → **faster content** (no client listing wait) | `loading.js` still for slow bootstrap |
| **TTI** | Parse 557 KB + waterfalls | Slightly better (1 less await) | Major TTI win = P1 providers split |
| **First Load JS** | **557 KB** route | **~540–555 KB** | Small delta; composer still client |
| **CLS** | Stage 171.23 baseline | **No regression** | Keep hero layout constants |

### 9.3. Catalog → PDP (prefetch path)

| Metric | Before | After |
|--------|--------|-------|
| Skeleton flash | Often none (RQ cache) | **Same or better** (dehydrate + cache) |
| Listing API | 0 if prefetched | 0 |
| Double fetch | Prefetch + mount refetch possible | **No refetch** (`staleTime` + dehydrate) |

### 9.4. Как измерить (PR-6 checklist)

1. Chrome DevTools → Network (Disable cache, Slow 4G): count requests until `h1` visible.
2. `npm run build` → route size `/.next/server/app/listings/[id]/page.js` + client chunk for `ListingPdpClient`.
3. Lighthouse mobile ×3 median on staging PDP.
4. Playwright: `booking-flow` + `guest-inquiry-golden-path`.

---

## 10. Связь с другими P0 из аудитов (не смешивать в один PR)

| Item | Audit | Relation to PDP P0 |
|------|-------|-------------------|
| Catalog server bootstrap | Data Fetching P0.2 | **Independent** — reuse `prefetch-*` pattern later |
| Route-group Chat providers | RSC §5, iOS P0-02 | **Parallel track** — bigger JS win than PDP shell |
| SW precache trim | iOS P0-01 | Independent |
| `useCommission` → RQ | Data Fetching P1 | **After** PDP P0; optional in PR-5+ |

---

## 11. Чеклист перед стартом PR-1

- [ ] Прочитать `app/api/v2/listings/[id]/route.js` GET целиком — отметить side effects (views increment)
- [ ] Confirm `@tanstack/react-query` ≥5.90 (`HydrationBoundary` export)
- [ ] Confirm `refetchOnMount: false` in `lib/query-client.js` (already set)
- [ ] Align `LISTING_DETAIL_STALE_MS` constant — export from one module
- [ ] Agree PR order with reviewer (6 small PRs)

---

*После merge PR-4+PR-6 обновить Stage-запись в `docs/TECHNICAL_MANIFESTO.md` (новый Stage, напр. 171.24 — PDP RSC shell + RQ dehydrate) и `docs/ARCHITECTURAL_PASSPORT.md` (маршрут `/listings/[id]`, data flow diagram).*

---

## 12. P0 closure — measured metrics & outcomes (PR-6, 2026-07-15)

### 12.1. Bundle (`npm run build`, production)

| Metric | Before (audit 2026-07) | After P0 (measured) | Δ |
|--------|--------------------------|---------------------|---|
| Route page JS `/listings/[id]` | 47.6 kB | **51.1 kB** | +3.5 kB (RSC bridge + provider) |
| **First Load JS** `/listings/[id]` | **557 kB** | **561 kB** | +4 kB (HydrationBoundary path; composer still client) |
| Shared First Load JS | ~89 kB | **89 kB** | — |

> **Вывод:** P0 win — **network / LCP**, не уменьшение JS bundle. Крупный TTI gain — отдельный трек (route groups, §10).

### 12.2. Network (guest, cold direct URL, Disable cache)

| Request | Before | After P0 |
|---------|--------|----------|
| `GET /api/v2/listings/[id]` on mount | **1** | **0** |
| Server full listing SQL (bootstrap) | 0 (via client API) | **1** (RSC) |
| Server layout lite SQL | 1 | 1 (P0.5 merge — backlog) |
| Reviews / FX / calendar / availability / favorites | ~4 parallel client | **unchanged** |
| **Client APIs before interactive hero** | ~5 | **~4** |

### 12.3. Web Vitals (estimate — staging Lighthouse recommended)

| Metric | Before | After P0 (model) | Notes |
|--------|--------|------------------|-------|
| **LCP** | Hero after JS + listing RTT | Hero after hydrate (no listing RTT) | **−0.5…1.0 s** on Slow 4G (audit model) |
| **FCP** | Skeleton → wait API | Skeleton → faster content | `loading.js` unchanged |
| **TTI** | Parse 557 KB + waterfalls | Parse 561 KB, −1 await | Major TTI = route groups (P1) |
| **CLS** | 171.23 baseline | No regression expected | Keep `pdp-hero-layout.js` |

### 12.4. PR deliverables (all merged)

| PR | Deliverable |
|----|-------------|
| PR-1 | `get-public-listing-detail.js`, thin API route |
| PR-2 | Bootstrap cache, server QueryClient, dehydrate, HydrationBoundary |
| PR-3 | `useListingViewData` → `useQuery` |
| PR-4 | RSC `page.js`, `ListingPdpClient`, gate views |
| PR-5 | `ListingBookingProvider`, context in booking sections |
| PR-6 | Docs + metrics (this section) |

### 12.5. Risks accepted / P1 backlog

| Item | Status |
|------|--------|
| Layout lite + page full = 2 server SELECTs | **P0.5** — unify bootstrap + OG |
| Reviews not dehydrated | **P1** — RQ `listing.reviews` |
| First Load JS still ~561 kB | **P1** — route groups `(storefront)` vs chat |
| Catalog still client-only bootstrap | **P1** — reuse prefetch pattern |
| SW precache scope | **P1** — trim / PDP shell chunks |

### 12.6. Verification checklist (release)

- [ ] Chrome Network: cold PDP → **0** listing GET
- [ ] Catalog → PDP: prefetch, no skeleton flash
- [ ] `npx playwright test e2e/booking-flow.spec.ts`
- [ ] `npx playwright test tests/e2e/guest-inquiry-golden-path.spec.ts`
- [ ] `npm run build` green

