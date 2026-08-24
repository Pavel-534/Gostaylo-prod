# Technical Manifesto (code-truth)

> **Version**: 13.2.243 | **Last Updated**: 2026-08-24 | **Tip of tree:** Stage **202.9** gostaylo.com → airento.ru 301 (host-only).

**Brand:** display name — **`getSiteDisplayName()`** (`NEXT_PUBLIC_SITE_NAME` / `SITE_DISPLAY_NAME`; prod **Airento**). i18n — **`{brand}`** (ADR §7a).

## Назначение и ведение

| Документ | Роль |
|----------|------|
| **Этот файл** | **Code-truth** — что сейчас в коде (контракты, SSOT-пути, флаги). Обновлять **кратко** при смене API / поведения / UX. |
| [`CONSTITUTION.md`](./CONSTITUTION.md) | Инварианты (FSM, цена, FX) — не дублировать формулы сюда |
| [`SYSTEM_MAP.md`](./SYSTEM_MAP.md) | Паспорт (таблицы, API-пути) |
| [`HISTORY.md`](./HISTORY.md) | Таблица Stage |
| [`archive/reports/TECHNICAL_MANIFESTO_STAGE_LOG.md`](./archive/reports/TECHNICAL_MANIFESTO_STAGE_LOG.md) | Полный исторический Stage-проз (бывший «хвост» манифеста) |
| [`README.md`](./README.md) | Хаб структуры доков |

**Правило:** новый Stage → одна строка в **HISTORY** + 2–5 строк сюда в § «Свежие дельты» (или правка нужного §0–13). Не возвращать километровый changelog в этот файл.

**Стек:** Next.js **14** (App Router), React, Supabase, cookie `gostaylo_session` + Supabase Auth OAuth, `prisma/schema.prisma` = schema doc only.

**Financial model:** **3.8.0** (ADR-097 + Concierge treasury + [ADR-300](./ADR/300-russia-kyrgyzstan-thailand-3.0.md) Phase 0 overlay).

---

## Свежие дельты (держать коротким — последние волны)

> Полные Stage-тексты: [`HISTORY.md`](./HISTORY.md) + [archive stage log](./archive/reports/TECHNICAL_MANIFESTO_STAGE_LOG.md).

### Stage 202.9 — Legacy domain 301 (GSC Change of Address)
- `gostaylo.com` / `www.gostaylo.com` → `https://airento.ru/:path*` (**`statusCode: 301`**, host `has` only).
- Note: `permanent: true` in Next = **308**; GSC Change of Address fails without real **301**.
- Does not touch `airento.ru` or Vercel preview hosts. Path + query preserved.
- Test: `__tests__/stage202-9-legacy-domain-301.test.js`.

### Stage 202.8 — Home «Стать партнёром» → заявка, не кабинет
- Bug: PartnerCTA linked to `/partner/dashboard`; guest/RENTER hit middleware (login bounce or redirect `/`) — «кнопка не работает».
- Fix: CTA → `/renter/profile?becomePartner=1` (+ login redirect); partners still hard-nav to cabinet; query opens application modal.
- Test: `__tests__/stage202-8-partner-cta-onboarding.test.js`.

### Stage 202.7 — YooKassa battle readiness (capture:true kept)
- Metadata: `buildMetadata` / `createPayment` pass guest `user_id` (`bookings.renter_id`) alongside booking/intent ids.
- Cron: `POST /api/cron/reconcile-yookassa-pending` polls INITIATED `MIR_RU` intents via `GET /v3/payments/{id}` (min age 2m); settle → markPaid + escrow heal; canceled → markTerminalFailure. No `capture:false`.
- Ops: cron-job.org `*/10`; Vercel daily fallback; STALE watchlist 45m.

### Stage 202.6 — Vercel serverless invocation burn (audit + minimal fixes)
- Middleware: no geo `Set-Cookie` on `/api/*` (was voiding CDN); matcher excludes sitemap/robots/static/images.
- RSC: `/u/[id]` + `/go/[vanity]` metadata call `getCachedPublicLandingMeta` (no HTTP self-fetch).
- CDN: `edgeCacheResponseHeaders` adds `Vercel-CDN-Cache-Control` for public; retail FX `s-maxage=60`; `/api/health` `s-maxage=5`.
- Test: `__tests__/stage202-6-vercel-invocation-audit.test.js`.

### Stage 202.5 — Desktop map soft-back camera (PWA parity, no PWA regression)
- Bug: PC map → popup «Подробнее» → PDP soft-back landed on world fit; PWA `#map` sheet already persisted camera via `rememberCatalogMapViewport`.
- Root: desktop `SearchMapWrapper` never wrote session camera and never received `cameraRestoreBbox` / `holdSoftBackCamera`.
- Fix: persist viewport in `CatalogSearchMapPanel` (shared); wire restore props on desktop; keep session camera when leaving to listing PDP.
- Test: `__tests__/stage202-5-desktop-map-softback.test.js`.

### Stage 202.4 — Sticky «Куда?»: keep «Пхукет» / «Чита» (not TH-PHK)
- On Home scroll, compact `UnifiedSearchBar` title-cased the geo code (`TH-PHK` → «Th Phk»); `WhereCombobox` sync preferred raw `value` when options empty.
- Fix: `resolveGuestWhereInputLabel` SSOT + `getOptionLabel` never returns raw codes; detect title-cased slug labels.
- Test: `__tests__/stage202-4-where-sticky-label.test.js`.

### Stage 202.3 — FX: kill remaining guest upstream + FX_STALE page-load spam
- `resolveThbPerUsdt` still called ExchangeRate-API when USDT row >2h (crypto/booking hot paths) → quota burn even after 202.1.
- `[FX_STALE]` fired from `getDisplayRateMap` per serverless isolate → TG spam on every refresh.
- Fix: USDT from DB/env only; stale TG only from `exchange-rates-refresh` cron.

### Stage 202.2 — Sentry Edge: no Telegram / Node `crypto`
- Vercel build failed: `sentry.edge.config` → shared `beforeSend` dynamic-imported `sentry-telegram-bridge` → `notifySystemAlert` → `crypto`.
- Shared init is Edge-safe; `[SENTRY]` TG wired only in `sentry.server.config.js`.

### Stage 202.1 — FX guest path: DB-only (stop burning ExchangeRate-API quota)
- Root cause: `getDisplayRateMap` called ExchangeRate-API whenever DB rows were older than **2h** — every catalog/home refresh / serverless isolate → 429 + TG spam; cron stayed green (`200` + `keptExisting`).
- Fix: hot path reads `exchange_rates` only; upstream refresh stays on cron (`allowUpstreamRefresh` opt-in only). Stale TG tagged `[FX_STALE]` for hourly FX guard.
- Test: `__tests__/stage202-1-fx-hotpath-no-upstream.test.js`.

### Stage 202.0 — Closed-beta observability & feedback surface
- **A:** `@sentry/nextjs` (client/server/edge); empty `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` → no-op; no Replay/Profiling; edge-safe scrub; server `[SENTRY]` → `notifySystemAlert` with 5m fingerprint cooldown; ChunkLoad/nav noise → Sentry only (no TG).
- **B:** Home footer + `/help` → `ProductFeedbackCta`; payload `currency`; optional `TELEGRAM_USER_FEEDBACK_TOPIC_ID` (fallback system-alerts). Auth unchanged (session required).
- **C:** PostHog remains ADR-169 SSOT — no Clarity / Yandex Webvisor. Tests: `__tests__/stage202-0-observability-feedback.test.js`.

### Stage 201.117c — Map popup «Подробнее» navigation
- Root cause: `listings-catalog-client` dropped `listing-hero-transition` import when polygon draw was wired → `handleMapListingOpen` threw → CTA no-op after `preventDefault`.
- Restore `navigateWithListingHeroTransition` + `prefetchListingPdp`. Test: `__tests__/stage201-117c-map-popup-open-details.test.js`.

### Stage 201.117b — Hotfix: map crash + catalog scroll thrash
- **Map «Ошибка загрузки»:** `InteractiveSearchMap` lost `catalog-map-ux-policy` imports when polygon chrome was added → `ReferenceError` on mobile map open → listings error boundary.
- **Scroll jitter:** roll back live-card `content-visibility` (201.117); keep React deferral via `CatalogDeferredCardSlot` (201.97).

### Stage 201.113 — FX cron soft-fail for cron-job.org (no auto-disable on 429)
- Root cause of week-long stale FX: ExchangeRate-API **HTTP 429** → our cron returned **429** → cron-job.org auto-disabled `exchange-rates-refresh`.
- **Fix:** when existing `exchange_rates` rows are kept, cron always responds **HTTP 200** (`keptExisting: true`); Telegram still alerts on real upstream failure (not cooldown skips).
- Shared **12h cooldown** after upstream 429 (`lib/services/fx-upstream-cooldown.js`) for cron + `getDisplayRateMap` hot-path — stops burning free-tier quota.
- Ops: re-enable job on cron-job.org; prefer schedule **`0 */6 * * *`** (free API updates ~daily). Check ExchangeRate-API dashboard quota / upgrade if needed.

### Stage 201.118 — PDP below-the-fold lazy hydrate
- Reviews: `dynamic(ReviewsSection)` + `PdpDeferredSection` (~300px; CLS skeleton). Map already deferred (171.23) — unchanged.
- Similar / Recently viewed rails: `dynamic` + viewport gate (fetch only near view). Hero / booking / description untouched.
- SSOT: `components/listing/pdp/PdpDeferredSection.jsx`. Tests: `__tests__/stage201-118-pdp-below-fold-lazy.test.js`.

### Stage 201.117 — Listing card `content-visibility`
- Grid `ListingCard` (+ skeleton / deferred slot): `content-visibility: auto` + `contain-intrinsic-size: auto 400px` via `LISTING_CARD_CONTENT_VISIBILITY_CLASS`.
- Complements **201.97** React deferral; skips solo/wizard preview. `auto` size reduces scroll jumps vs fixed-only.
- Tests: `__tests__/stage201-117-listing-card-content-visibility.test.js`.

### Stage 201.116 — Catalog search bar → UnifiedSearchBarLazy SSOT
- Catalog compact chrome: `UnifiedSearchBarCompactLazy` (`ssr: true` + compact skeleton); drop ad-hoc `ssr: false` / `loading: null`.
- Desktop `FilterBar` dynamic: `ssr: true` + `HomeSearchBarSkeleton variant="filter"`; prefetch USB + FilterBar on md+.
- SSOT: `UnifiedSearchBarFilterLazy` + filter skeleton. Tests: `__tests__/stage201-116-catalog-search-lazy.test.js`.

### Stage 178.0 — RLS InitPlan sweep
- Live FannRent: wrap `auth.role()` / `auth.uid()` / `is_admin()` / `current_profile_id()` as `(SELECT …)` in hot RLS policies (advisor `auth_rls_initplan` → **0**).
- Drop legacy favorites `auth.uid()` policies; invoices party checks → `current_profile_id()` (profiles.id SSOT).
- Migration: `migrations/stage178_0_rls_initplan_sweep.sql`. Template policies updated. Catalog/search still `service_role` (unchanged UX for anon browse).

### Stage 201.115 — Lazy SearchCalendar chunk
- **`SearchCalendarLazy`:** idle trigger until mouseenter/focus/pointer/click; then `dynamic(search-calendar, { ssr: false })` + `defaultOpen` (one gesture).
- **`wizardStep`:** mounts eagerly (sheet dates step). Prefetch: `prefetchSearchCalendarChunk`.
- **`UnifiedSearchBar`:** no static `search-calendar` / `date-fns` (Intl short labels). Tests: `__tests__/stage201-115-search-calendar-lazy.test.js`.

### Stage 179.1 — Catalog search conditional edge cache
- **`run-listings-search-get.js`:** `public, s-maxage=60, stale-while-revalidate=120` only when **anonymous** + **simple** browse + **200** (ADR-163).
- **Simple** (`isSimpleCatalogSearchForEdgeCache`): no dates, bbox/radius, `polygon`, facet metadata, `guests>1`, or `semantic`; category/where/price/sort/q OK.
- Session / filtered / errors → `private, no-store`. SSOT: `listingsSearchEdgeCacheControl` in `lib/api/public-edge-cache-control.js`. Tests: `npm run test:edge-cache`.

### Stage 201.114a — Home first-load JS (lazy search + rails)
- **SSOT:** `components/search/UnifiedSearchBarLazy.jsx` — `UnifiedSearchBarHeroLazy` / `UnifiedSearchBarCompactLazy` (`ssr: true`, `HomeSearchBarSkeleton` CLS placeholders).
- **Home:** `HomeHeroLuxe` + `PlatformHomeContent` — no static `UnifiedSearchBar`; `ForYouRail` + `ReferralVanityWelcomeHost` → `dynamic({ ssr: false })`.
- **Prefetch:** `prefetchUnifiedSearchBarChunk()` on hero mount. Tests: `__tests__/stage201-114-home-bundle-lazy.test.js`.

### Stage 179.0a / 179.2a / 171.22 — Zero-waste edge cache (conditional) + image TTL
- **Map-pins** (`run-map-pins-get.js`): `public, s-maxage=15, stale-while-revalidate=60` only when **anonymous** + **200**; logged-in → `private, no-store` (ADR-163 coord reveal). Errors 4xx/5xx never CDN-cached.
- **Categories** (`GET /api/v2/categories`): `s-maxage=300, SWR=600` only for public guest (not admin / `?all=true`); else `no-store`.
- SSOT headers: `lib/api/public-edge-cache-control.js`; tests `npm run test:edge-cache`.
- **Images:** `next.config.js` → `images.minimumCacheTTL: 86400`.

### Stage 189.38 — iOS Web Push reliability
- **Client:** `PushClientInit` re-registers on ping `Token not registered`; `shouldSyncPushOnResume` requires recent ping (5 min) + session sync; iOS Safari tab gated (`canRegisterWebPushOnThisDevice`).
- **UX:** `PushSoftPromptBanner` one-tap enable (default permission); `PushEnableSettingsCard` iOS browser → Add to Home Screen first.
- **Hygiene cron:** `push-token-hygiene` skips iOS tokens + recently pinged (`last_seen_at` < 48h); orders stale first.
- **device_info.surface:** `ios_pwa` | `web`. Tests: `__tests__/push-ios-reliability.test.js`, `push-m11-client-state.test.js`.

### Stage 177.5.2 — Location inventory SQL aggregation (suggest)
- `getLocationInventoryIndex` (`lib/locations/location-inventory-cache.js`) uses RPC **`listings_location_inventory_counts_v1`** — no full ACTIVE card pull.
- RPC returns `level/code/listing_count` (country|region|city|district) with Phuket rollup (`PHUKET_DISTRICTS_CANON` → `phuket-city` / `TH-PHK` / `TH`) and E2E exclusion (`[E2E_TEST_DATA]` in title/description/metadata tags).
- Migration: `migrations/stage177_5_2_location_inventory_counts_rpc.sql`; `service_role` only; TTL **120s** unchanged. Tests: `npm run test:location-inventory`.

### Stage 177.5.1 — Polygon draw UI (desktop lg+)
- Pencil + chip on sticky desktop map only (`SearchMapWrapper` / `lg+`); **never** on `CatalogMobileMapSheet` / `#map`.
- Geoman (`@geoman-io/leaflet-geoman-free`) + CSS loaded **on Pencil click** only (`MapPolygonDrawChrome`).
- Browser encode: `discovery-geo-polygon-browser.js` (`CompressionStream`); pure validate: `discovery-geo-polygon-core.js`; Node decode stays in `discovery-geo-polygon.js`.
- Client flag: **`NEXT_PUBLIC_DISCOVERY_POLYGON_SEARCH=1`** (+ `NEXT_PUBLIC_DISCOVERY_UNIFIED_PIPELINE=1`). Server still needs `DISCOVERY_POLYGON_SEARCH` + `DISCOVERY_UNIFIED_PIPELINE`.

### Stage 177.5.0 — Polygon search backend (Wave E1)
- Registry key **`geo.polygon`** + URL `polygon=` (gzip+base64url GeoJSON `[lng,lat]`); module `lib/search/discovery-geo-polygon.js`.
- RPC **`listings_within_polygon_v1`** (`migrations/stage177_5_polygon_search_rpc.sql`): `&&` + `ST_Intersects` on true `listings.coordinates`; `ST_MakeValid` in SQL only.
- Flags: **`DISCOVERY_POLYGON_SEARCH=1`** requires **`DISCOVERY_UNIFIED_PIPELINE=1`** (default off — zero prod load). Polygon precedence over bbox; catalog + map-pins share id-set via `discovery-spatial-rpc.js`.
- No Leaflet draw UI yet (177.5.1). Docs: `docs/SEARCH_FILTERS_QUERY_MAP.md` §`polygon`.

### Stage 131.A5.E — Referral link OG preview
- `/u/[id]/opengraph-image`: center `brand/airento-mark1.png` + word **Airento** only (no invite/subtitle keys); cache-bust `?v=20260821`.
- Messengers cannot use header SVG as `og:image` — raster only.

### Stage 131.A5.D — Guest ambassador withdraw entry UX
- `/profile/wallet`: «Партнёрский вывод» только при `isPartner` / `canAccessPartner`; deep-link `?action=payout-setup` → scroll/focus `#ru-payout-profile`.
- **Fix:** форма RU-реквизитов больше не скрывается при балансе 0 (раньше `ReferralWithdrawalWaterfall` делал `return null`).
- `/profile/referral`: вкладки (Обзор / Ссылка / …) сразу под hub-nav, sticky; QR на вкладке «Ссылка» + Telegram/WhatsApp.
- `/profile/referral` + `/profile/status`: `ReferralWithdrawEntryCta` (реквизиты / мин. порог из SSOT / запрос вывода) — без хардкода ₽2600.
- Blocker copy: банковские реквизиты РФ (БИК, счёт, ИНН); href → `?action=payout-setup`.

### Stage 131.A5.C — Link tab share declutter
- `/profile/referral` → tab **Ссылка**: один QR, `navigator.share` + копирование короткой ссылки; UTM-каналы свёрнуты в «Разметка для аналитики».
- Убраны дубль MarketingKit (второй QR, WA/TG/FB, Stories/PDF/посты) и блок «Зачем делиться?» с той же вкладки.

### Stage 131.A5.B2 — Referral calculator v2 (Variant B)
- Shared UI: `ReferralCalculatorV2` in cabinet (`/profile/referral`) and `/about/referral`.
- Simple mode = one total; detail funnel + guest cashback behind buttons; activity presets map to existing `l2ConversionRate` (alias `l1ActivityRate` on `GET /api/v2/referral/calculator`).
- Additive API fields only (`referralPoolThb`, caps, `l3MinDirectPartners`, …) — **no** split/waterfall formula change.
- L3 locked UI from `directPartnersInvited` in cabinet; public page uses generic gate copy.

### Stage 131.A1 — Ambassador 3.1 (guest pool L3, dual-mode)

Код L3 **есть**; **live начисления L3 выключены**. Policy: [`ADR/131A-ambassador-3-1-multi-level.md`](./ADR/131A-ambassador-3-1-multi-level.md).

- **A1.1** фундамент: `referral_mlm_consent_at`, `referral_program_stats`, knobs L3. JS defaults **не** cutover: **45/12/0/43**, cap **250k**, `ambassador_guest_l3_enabled=false`. Validation: L3 off → L1+L2+referee=100 и l3=0; L3 on → 42/10/5/43=100.
- **A1.2** ядро: dual-mode (flag off = ADR-131 45/12/43 + shadow L3 withhold; flag on = 42/10/5/43 + live `split_role=l3_upline`). Gate ≥10 прямых PARTNER + `referral_mlm_consent_at`. Caps L3: 500/бронь, 20k/мес UTC. Host 70/30 без L3. Тесты A1.2: **7**.
- **A1.3** surface: `POST /api/v2/referral/consent`, модалка + disclaimer `/profile/referral`, alert 80% **program cap** (не 80% от 150k), calculator L3 toggle, оферта §6, cron `referral-program-stats-quarterly`. Тесты A1.3: **5** (A1.1+A1.2+A1.3 = **17**).
- **A1.4** этот манифест / Constitution / History / owner+accounting guides.
- **Cutover** — атомарный `UPDATE system_fintech_settings` (42/10/5/43 + `l3_enabled=true` + cap 1M) **после** Legal review §6 и owner sign-off. Не делать в этом Stage.

### Stage 201.112 — FX cron: skip fresh rows, keep DB on upstream failure
- `GET|POST /api/cron/exchange-rates-refresh` still requires Bearer / `x-cron-secret` (`assertCronAuthorized`). Missing `CRON_SECRET` env → **503**; bad/missing token → **401**.
- If all display codes in `exchange_rates` were updated within **4h**, response is **200** `{ success: true, message: "Skipped, updated recently" }` — no ExchangeRate-API call.
- Upstream **429/5xx** or empty payload: **no upsert**; **HTTP 200** + `keptExisting: true` (**201.113**; was 429/502 in 201.112). Guest TTL remains **2h** (`EXCHANGE_RATES_DB_TTL_MS`).

### Stage 201.111 — Popular nearby stays; Back waits for a finished Home
- «Популярно рядом» no longer disappears when the rail and Top share the same small catalog: unique first, then skip only the first 4 Top cards, then show overlap rather than hide.
- Cold Home reserves a rail skeleton (no `return null` while loading). Restore keeps pinning the clicked card/footer link until document height stops growing — Contact Us / Top no longer commit on a short remount and land in the middle.

### Stage 201.110 — Home Top → PDP Back does not hang Home
- PDP header Back fallback is `/listings`. After a Top-grid click, `history.back()` lands on `/` but pending catalog used to replace Home with `ListingsCatalogSkeleton` forever.
- Arm the pending catalog skeleton only while the live route is Home. Soft-back from PDP without a catalog return pending `/`.

### Stage 201.109 — Back restore commits saved Y
- Do not drop the pending flag before the page is tall enough. A footer/card anchor on a short remount parked the viewport in the middle (home «Связаться с нами», catalog → PDP Back).
- When layout catches up, apply saved Y (anchor only if it is still within 12px). If the 8s budget ends, still apply Y — never finish without scrolling.

### Stage 201.108 — «Популярно рядом»: rating, featured dedupe, cold guest
- Rail title `forYouTitle` is «Популярно рядом» / Popular nearby. Compact cards show rating when `avg_rating` > 0.
- Home excludes ids already in the featured/top grid. Display min is **2** cards so a cold guest still sees regional popular; server personalization top-up stays at 6.

### Stage 201.107 — Recently viewed is PDP-only
- Home no longer mounts `RecentlyViewedRail` (`recent_home` retired). «Для вас» stays as the only discovery carousel above the featured grid. History resume stays on the listing page after similar.

### Stage 201.106 — Map rail jump debug (dev-only)
- `lib/maps/catalog-map-rail-debug.js` logs `[airento:map-rail]` only when the bottom card count jumps or one card vs several pins. Off in production unless `localStorage.airento:map-rail-debug = 1`.

### Stage 201.104 — Instant Search shell, popup close, scroll restore
- Search tab: paint catalog skeleton on Home as soon as the dock is pending (`StorefrontPendingCatalogShell`). `/listings` metadata no longer awaits catalog search; the page streams the list behind `Suspense`.
- Map listing popup close is a 44px white chip with a brand ring (Leaflet’s default × sat on the photo).
- Back-to-list / back-to-home: restore retries up to 8s and on `ResizeObserver` so a short skeleton does not eat the saved Y (list middle, home footer).

### Stage 201.103 — Stop parking Home/catalog in the shell
- Visible Home and catalog UI render **inside** their page `HydrationBoundary` again. Shell keep-alive (201.97–201.102) hid the dehydrated cache as a sibling and kept two full trees mounted — iPhone white/skeleton home, Samsung Search stuck on card skeletons.
- Home no longer idle-imports the catalog chunk. Search tab no longer `reveal`s a parked list on `/`. Catalog `router.push` is not wrapped in `startTransition`.
- Keep: mobile-first catalog (201.96), Search tab does not open the filter sheet (201.98), native card `<Link>` (201.100), instant PDP shell (201.101), no idle first-6 PDP prefetch / visible images (201.102).

### Stage 201.101 — Instant PDP chrome + history.back to parked catalog
- Catalog → PDP paints hero/title/price/Book from TanStack cache (`readPdpInstantListing`) in the **page slot** (`Suspense` fallback) while RSC bootstrap streams. Do **not** paint PDP under the list.
- Do **not** drop the listing SELECT: 404 / moderation / OG stay in the async child.
- Leaflet/calendar were already deferred (`dynamic` + viewport gate). Header Back pops `history` when the catalog URL is remembered.
- Card `router.prefetch` on touch/hover was already in `ListingCard` (**201.100** idle first-6).

### Stage 201.102 — Mobile stability: no PDP park, no idle PDP burst prefetch
- `StorefrontSearchKeepAlivePane` was a shell park of Home+catalog; **201.103** removed that park (UI is in the page again). Remaining 201.102 bits: no idle first-6 PDP prefetch, card images not `opacity-0`, map state cleared when leaving `/listings`.
- Removed idle first-screen burst prefetch of PDP route + detail JSON in catalog, and removed home-idle catalog data prefetch from `usePublicSearchFilters`; visible content keeps network priority.
- `CardImageCarousel` no longer hides media with `opacity-0` before `onLoad`; blur placeholder stays visible instead of black tiles under congestion.
- Mobile catalog map now force-closes (hash + viewport memory clear) when leaving `/listings`, preventing stale `#map` reopen loops.

### Stage 201.100 — catalog ↔ PDP: park list; do not freeze on View Transition
- Card tap no longer `preventDefault` + `startViewTransition` around `router.push` (Samsung/Chromium froze the teal ring, then an empty shell).
- Catalog/Home keep-alive is now constrained to Home ↔ list only (**201.102**). PDP returns via URL + TanStack cache, not RAM-parked trees.
- Idle first-6 PDP burst prefetch was rolled back in **201.102** due to mobile contention with visible images.

### Stage 201.99 — Home widget cache 10 min; catalog search stays lite
- For You, featured («Топ»), recently viewed: `staleTime` 10 min, `refetchOnMount: false`, `refetchOnWindowFocus: false`. Recently viewed is TanStack + localStorage placeholder.
- Catalog GET already uses `LISTINGS_SELECT_LITE` (no `description`, 3 images, picked metadata). Do not shrink to id/title/price/photo[0] — cards need rating, specs, L1 currency, geo codes, trust.

### Stage 201.98 — Search tab does not open the sheet; Home rails stay parked
- Bottom tab «Поиск» on the catalog list no longer opens the filter sheet (keep-alive was also opening it on the second Home→Search tap). Sheet stays on the summary bar / FAB.
- Home tree parks in the same storefront shell as catalog, so «Для вас» / «Вы недавно смотрели» do not remount on return.
- For You uses TanStack Query (5 min stale). Recently viewed shows localStorage rows immediately, then validates.
- Home-idle catalog data prefetch was removed in **201.102** to avoid competing with visible media/network on mobile.

### Stage 201.97 — Search tab: prewarm + keep-alive + above-fold cards
- Home idle-imports the catalog client chunk (`requestIdleCallback`; skip `saveData`). Leaflet/FilterBar stay out of that prewarm (201.96).
- Catalog React tree parks in the storefront shell (`StorefrontSearchKeepAlivePane`). Repeat Home ↔ Search shows the parked list immediately; URL still syncs via `router.push`. PDP is excluded from keep-alive in **201.102**.
- Phone list hydrates 6 cards first; the rest are skeletons until they approach the viewport. Non-LCP card images use `loading="lazy"`.
- First Search tap still needs one catalog mount. Repeat tap is the instant path. Home tree parks in **201.98**.

### Stage 201.96 — Search tab: do not hydrate desktop catalog on phone
- Phone `/listings` no longer mounts Leaflet, desktop `FilterBar`, or compact `UnifiedSearchBar` behind `hidden` CSS (`useMinWidthConfirmed`). Search/map sheets mount when opened.
- Home Search tab `router.push` stays in `startTransition`; idle `router.prefetch` uses the same query href the tab will open (bare `/listings` was a cache miss).
- First visit still pays RSC + list hydrate; this removes the 6–10s main-thread freeze from unused desktop widgets. Repeat Home ↔ Search: **201.97** keep-alive.

### Stage 201.95 — location: neighborhoods + pin snap
- Launch seed now has the Phuket areas from `PHUKET_DISTRICTS_CANON` (Kata, Kamala, …) with RU/EN/TH labels.
- `matchLaunchGeoByCoords` fills `city_code` from the pin when cascade is missing (write + catalog display). No Nominatim on catalog GET; Berlin coords still do not become Phuket.
- Guest chat/order/calendar stop dumping raw OSM `district`.

### Stage 201.94 — on-site cleaning / deposit stay in listing THB
- Guest PDP and booking widget no longer FX-convert `cleaning_fee_thb` / `security_deposit_thb` with the header currency switcher.
- Copy is the partner amount in THB (`Уборка: 1 000 THB`) — paid on site, not in the online checkout.

### Stage 201.93 — catalog location line (area, city, country)
- Guest cards no longer dump raw OSM `district` (Thai / empty / duplicated English). Lite catalog now returns `country_code` / `region_code` / `city_code`; display SSOT `formatListingLocationLineSync` uses launch-seed labels in UI lang, else English/Latin.
- `/api/v2/geo/listing-label` only when city/region code exists **and** seed city is missing (no N+1 on Phuket/Chita grids). Hide the pin row when the line is empty.

### Stage 211.3 — reports tab: one period, earned vs paid, acts archive
- `/partner/finances` Reports: lifetime portfolio moved to Overview; statements follow the period controller (dates + presets + axis).
- Header CSV label shows the selected period (`CSV · {period}`). Period pack has an earned-vs-paid callout; full acts list opens via «All acts (archive)».
- No change to export/period APIs, read-model, or escrow.

### Stage 201.92 — housing property type follows category
- Stay wizard no longer defaults `metadata.property_type` to **Villa**.
- Guest PDP «Тип объекта» uses the housing **category** (apartment/villa/…) like Airbnb/Booking; leftover Villa metadata cannot override an apartment listing.

### Stage 211.2 — partner period statement pack

- `GET /api/v2/partner/finances-period` — same booking axis/range as export; gross/fee/net from read-model; paid-out from `payouts` PAID/COMPLETED; closing acts from `listPartnerSettlementDocuments`.
- UI `/partner/finances` reports: quarter preset + period summary card. Full documents archive is behind «All acts» (Stage 211.3). PDF header/footer print the pack totals.
- Does **not** call `getPartnerBalance` / escrow.

### Stage 211.1 — partner finances export (CSV/PDF + date axis)

- Canonical `GET /api/v2/partner/finances-export` (`format=csv|pdf`, `axis=created|checkout`). Gross/fee/net from `buildBookingFinancialSnapshotFromRow`; CSV UTF-8 BOM; filename `{brand}-finances-statement-{from}-{to}.{ext}`.
- Axis `checkout` filters `bookings.check_out` (no `end_date` column). Caps: 366 days / 2000 rows. UI `/partner/finances` reports card: axis toggle; client blob CSV removed.
- Legacy `GET /api/v2/partner/finances-statement-pdf` remains a created_at PDF alias.

### Stage 201.91 — listing L1 price in Telegram / email
- Admin TG «873 RUB/день» was ledger THB labeled as listing currency.
- SSOT: `lib/listing/listing-l1-price-display.js` — L1 asset, else THB ledger labeled THB.
- Guest booking emails use `formatBookingAmountForNotify` (pay currency); partner net stays THB.

### Stage 201.90 — partner draft Publish CTA
- Same wizard quality checklist: ready draft shows **Опубликовать** on the card (not only in ⋯).
- Incomplete draft keeps **Продолжить** + `N из M`; rejected Publish only when checklist is ok.

### Stage 201.89 — map soft-back + pin ring + PDP flow hint
- Selected pin ring **1.5px** (was 3px); ignore programmatic `popupclose`; selected pin outside cluster.
- Soft-back: restore camera from session **without requiring `#map`**; re-apply hash after `router.replace` (App Router drop).
- PDP: remove above-fold `GuestBookingFlowHint` («Поиск > Запрос > …») — keep component on checkout/messages.

### Stage 201.88 — catalog vs PDP RUB price mismatch
- Home/search lite omitted `base_currency` / `base_price_asset` → cards converted THB→header with **retail**; PDP used L1 × guest fee (same-currency).
- Catalog, recommendations, map pins, favorites now send `baseCurrency` + compact `basePriceAsset`. Checkout FX unchanged (`pay ≠ base` only).

### Stage 201.87 — partner hub chrome declutter
- Listings: drop redundant «Фильтры» / «Объявления» H2; unify title to «Мои объявления»; breadcrumb = «Объявления».
- Hub SSOT: `PARTNER_HUB_PAGE_TITLE_MD_HIDE_CLASS` — page H1 hidden from md+ (AppHeader already titles).
- Same pattern: bookings (no filters H2), finances, reviews, promo, dashboard.

### Stage 201.86 — listing sync gaps (wizard ↔ PDP ↔ Concierge)
- `mapListingDetailFromApi` passes **`instantBooking`** (Instant Book CTAs / hints).
- Concierge ingest keeps **`metadata.amenities`** + writes **`country_code` / `city_code`** from geo.
- Stay wizard: **`house_rules`** field (whitelist + PDP «Good to know»).
- PDP: **`ListingGuestFeeHints`** — cleaning / deposit / fuel exclusions before date pick (amounts in listing THB, Stage **201.94**).

### Stage 201.85 — PDP section rhythm SSOT
- SSOT: `lib/listing/pdp-section-rhythm.js` + `ListingPdpSectionStack` / `ListingPdpSection`.
- One hairline (`border-slate-100`) between semantic blocks; equal `py-8` on both sides — no nested `<Separator my-8>` / double rules.
- Mobile «Выберите даты» sits between stacks (`border-y`) so `lg:hidden` does not orphan divide rules on desktop.
- Hero title→specs uses internal split (`mt-8`/`pt-8`) matching stack weight.

### Stage 201.84 — soft-back exact map camera + brand selected pins
- Soft-back stores **center+zoom+bbox** (+ selected pin); restore via `setView`; React `holdSoftBackCamera` prevents world-fit remount.
- Capture forces `#map` when viewport memory exists.
- Selected price pill: brand teal `#006666` ring (not amber). Selection no longer cleared when listing missing from current search page.

### Stage 201.83 — PDP: one divider + reviews below description
- Double rule above «Отзывы»: specs `border-b` + column `Separator` — specs now `border-t` only.
- Section order (Airbnb-like): hero → description/amenities → reviews → map/chat → similar. Empty «Пока нет отзывов» no longer sits above the story. Header star link still jumps to `#reviews`.

### Stage 201.82 — supply-first «Куда?» (no ghost destinations)
- **Problem:** empty Where drawer dumped Phuket districts + «Другое»; popular chips showed Bali/Abu Dhabi with 0 listings; recent «чита» stored as slug `chita`.
- **Policy:** discovery UI shows locations with **ACTIVE supply** first. Empty popular = only «Везде» + typed geo suggest.
- **Labels:** `lib/locations/resolve-where-display-label.js` (popular → launch geo → title-case). Recent chips re-heal raw slug labels.
- **Seed:** `getStaticLocationsSeed()` returns empty cities/districts for guest chrome; legacy Phuket dump kept as `getLegacyPhuketStaticLocationsSeed`.
- **Clear all locations:** chip «Везде» / X on Where field → `where=all` (param omitted) → catalog worldwide.

### Stage 201.81 — soft-back restores map camera (not just `#map`)
- Problem: PDP ← soft-back opened map sheet but Leaflet remounted at world fit.
- Fix: `lib/navigation/catalog-map-viewport-memory.js` stores last mobile map bbox (+ selected pin) in sessionStorage while `#map` is open; catalog remount peeks and `fitBounds` once (`cameraRestoreBbox`).
- Keeps `#map` hash approach (no search remount).

### Stage 201.80 — hide catalog keyword + «ИИ» search row (launch)
- Guest chrome: Airbnb-style What / Where / Dates / Guests only (`UnifiedSearchBar` gated by `isCatalogKeywordSearchUiEnabled()`).
- SSOT + reactivation cheat sheet: **`lib/search/catalog-keyword-search-ui.js`** (≳1000 listings). Backend `q` / embeddings / admin `semanticSearchOnSite` unchanged.
- Smart search default **off**; JSON-LD SearchAction lexical `q` while UI hidden.

### Stage 201.79 — viewport-scoped mobile map rail + dark price pills
- **Rail:** `filterCatalogRailListingsForMapViewport` — intersection of catalog search page ∩ viewport pin ids (fallback: listing coords in map bbox). Fixes “Phuket map + Chita card” when `where` unset.
- **Pins:** dark-by-design slate pills (Android force-dark already inverts white→black); selected = mint + amber ring so selection stays visible.
- Wire: `CatalogSearchMapPanel.onViewportMapData` → `CatalogMobileMapSheet` rail.

### Stage 201.78 — mobile map open without catalog remount

- Map UI mode is URL **hash** `#map` (not `?map=1`). Query changes remount TanStack catalog search → hang / «Ошибка загрузки»; hash does not.
- Soft-back still restores open map via `pathname+search+#map` in catalog-return href.
- Price pills: inline base colors + brand selected styles (Samsung force-dark).

### Catalog map data paths (scale SSOT)

- **Map pins:** `GET /api/v2/search/map-pins` — **viewport bbox only**, cap **500**, clusters when denser (`MAP_CLUSTER_THRESHOLD` 200). Not a full-table dump.
- **List:** catalog search page (`allListings`, ~100 / cursor) by search filters.
- **Mobile map rail (201.79):** intersection(search page ∩ viewport pin ids), else coords-in-bbox — not the full unloaded world dump.

### Stage 201.77 — mobile map popup / pin / soft-back SSOT

- Popup is map-level (`CatalogMapSelectedPopup`), not a child of price `Marker` — pin remounts on pan/bbox no longer blink the card.
- Price pills: default white (+ force-dark resist); **selected = brand teal** (not inverted black).
- Mobile rail tap selects pin + opens popup; PDP only via popup CTA.
- Catalog URL `?map=1` syncs mobile map sheet so soft-back returns to the open map, not the list.

### Stage 201.76 — catalog map popup blink on list hover

- Price-pill `DivIcon` no longer encodes selected/hover (Leaflet `setIcon` was remounting the open popup → ghost card).
- Highlight toggles CSS classes on the existing pill DOM; while a pin is selected, list hover is not fed to the map; popup `keepInView` off; opaque popup chrome.

### Stage 201.75 — PDP description overflow (long unbreakable tokens)

- Guest description: `break-words` + `[overflow-wrap:anywhere]` + column/main `min-w-0 overflow-x-clip` so keyboard-mash / URL tokens cannot stretch the PDP to multi-viewport width.
- Root cause example: `metadata.description_translations.ru` overrides canon `listings.description` via `getListingText` — junk i18n must not break layout.

### Stage 201.74 — map popup CTA + seamless catalog↔PDP

- Map popup CTA: brand button with forced white text (Leaflet `a` color override); open via client `router.push` + PDP prefetch (same path as list cards), not raw `<a>` hard nav.
- Open popup: freeze hover→pin icon thrash (selected pin only); clear selection on map background click (removed 5s auto-clear).
- PDP soft-back: `airento:catalog-return-href-v1` remembers `/listings?…`; `useSoftBack` `replace`s that URL instead of bare `/listings`.

### Stage 201.73 — NEW trust badge + compact map popup

- Partner tier `NEW` (no completed stays / cancel / decline / penalty signal) → soft pill «Новый» / «New» + tooltip; no second Verified companion on cards.
- Catalog map popup: slimmer card (no specs row), brand CTA; `ListingPriceMarker` Popup `autoPan` + `keepInView` so the card is not clipped at the map edge.

### Stage 201.71 — STALE_CRON root cause + catalog map UX

- Crypto heal in `reconcile-paid-intents-without-escrow` queried `payment_status IN (COMPLETED, CONFIRMED)` → enum error → ops `error` forever → hourly `[STALE_CRON]`. Now `COMPLETED` only + per-job TG de-dupe.
- Catalog map: fitBounds once per reset (cluster zoom no longer snaps back); area-search overlay buttons off by default.

### Stage 201.70 — PDP gallery lightbox + Instant Booking visibility

- `GalleryModal`: force `!h` over Dialog `sm:!h-auto`; intrinsic `next/image` (no `fill`) so overlay never opens empty.
- Wizard pricing Instant Booking: brand tint + Zap + badge; PDP pay hint is a brand chip when Instant Book is on.

### Stage 201.69 — universal branded transactional email

- Transport SSOT: `textToHtml` → `buildPremiumHtmlFromPlainText` (NotificationService / concierge / referral / disputes / plain fallbacks get lockup).
- Auth verify/reset, product feedback, owner marketing digest → `buildSimplePremiumEmailTemplate` / `premiumEmailDocument`.
- Dedicated premium templates (booking/payment/listing) unchanged; all share `emailHeaderRow` logo.

### Stage 201.68 — branded transactional email chrome (SSOT)

- Foundation: `lib/email/email-brand-assets.js` (PNG lockup path) + `premium-email-html` header logo (`getSiteDisplayName` alt) + footer site/help.
- Listing approve/reject: premium templates (`listing-moderation-email.js` → `EmailService`) + plain fallback; TG DM adds brand name. Not a second React Email stack.

### Stage 201.67 — reconcile cron vs payment_status enum

- Prod enum: `PENDING|PROCESSING|COMPLETED|FAILED|REFUNDED` (no `CONFIRMED`). Cron `.eq('status','CONFIRMED')` → every hour `error` → `[STALE_CRON] last_success=never`.
- Fix: legacy heal scans `COMPLETED`; `PaymentsV3Service.confirmPayment` writes `COMPLETED`.

### Stage 201.66 — listing moderation Telegram (admin)

- Bug: partner list called `POST /api/v2/admin/telegram` (`requireAdminStaff`) → **403**; wizard publish never notified. Approve/reject used hardcoded chat/thread `3`.
- Fix: server `notifyListingSubmittedForModeration` on PATCH → PENDING → topic **NEW_PARTNERS**; drop client admin call; moderation approve/reject via `sendToAdminTopic`.

### Stage 201.65 — draft save undeletes soft-deleted listing

- Bug: partner soft-deleted a draft (or stale id), then «Сохранить черновик» PUT-merged metadata and **kept `is_deleted`** → toast success + redirect, but list filters trash → listing invisible.
- Fix: PUT clears soft-delete when keeping `is_draft`; client strips trash keys; restore iCal pause flags when undeleting via draft save.

### Stage 201.64 — partial draft save (leave mid-wizard)

- Problem: «Сохранить черновик» required country/city (edit → `savePatchForEdit`); localStorage resume looked like a draft but not in list; category POST created empty «Черновик» ghosts.
- Fix: draft save skips provisional geo; optional ISO country only; edit drafts use same path; no server row on category (photo/calendar/Save only); resume banner explains device-local vs Save → list.

### Stage 201.63 — partner listings: drop summary KPI grid

- `/partner/listings`: remove «Сводка» 2×2 cards (total/active/views/bookings). List is primary; per-card `views` remains. Full partner analytics = separate backlog (Обзор / future Insights).

### Stage 201.62 — wizard draft save leaves to listings (no second empty draft)

- Bug: create-mode «Сохранить черновик» after category ensure POSTed a **second** listing, then `router.replace(/new?edit=…)` — felt stuck in wizard; leaving left an empty «Черновик» row.
- Fix (`useListingSave`): PUT upsert `editId || draftListingIdRef`; always `router.push('/partner/listings')`; image migrate after leave.

### Stage 201.61 — vehicle wizard: drop housing/FX noise; split draft/publish spinners

- Transport copy: calendar / Instant Book hints without Airbnb·Booking·iCal; education card already manual-only.
- Pricing: remove partner-facing FX/markup essay (`wizardBaseCurrencyFxHint`); keep one line — price currency from country.
- Bug: last-step «Сохранить черновик» set shared `lastStepBusy` → moderation button also spun. Fix: `draftBusy` vs `publishBusy` spinners.

### Stage 201.60 — Android splash plate + partner mobile chrome cleanup

- Splash (honest): Android cannot use iOS `apple-touch-startup-image`. Manifest `any` icons → `icon-splash-*` (large mark ~82% on white plate) + navy `background_color`; home stays `icon-maskable-512`.
- Partner mobile: drop `WORKSPACE_MOBILE_TOOLBAR` breadcrumbs/bell strip; bell → `PartnerCabinetMobileActionsFab` (shared `lib/layout/mobile-action-fab.js` with PDP/wizard FABs). Wizard keeps its own FAB stack (no double bell).

### Stage 201.59 — Android PWA: restore mark icon; splash without lockup plate

- Bug: Stage 201.55 put full lockup (logo+«Airento»+RENTALS) into webmanifest icons. Android Chrome splash = icon + `name` → nested white plate + tiny letters; home icon became unreadable squircle.
- Fix: `purpose:"any"` → `icon-dark-*` (large mark on `#0c1623`); `maskable` → light `icon-maskable-512` (home like iOS); remove `icon-android-splash-*`; portrait `android-splash-*` kept for native shells only.

### Stage 201.58 — wizard: drop breadcrumb toolbar noise

- Bug: desktop `WORKSPACE_TOOLBAR` (Партнёр › Объекты › Детали + wallet/name) sat under AppHeader on listing wizard — duplicated soft-back / header chrome and ate vertical space; compact step bar was offset for that toolbar.
- Fix: skip breadcrumb toolbar on wizard (keep impersonation banner); pin compact step bar under AppHeader; header shows step line under title; remove duplicate Exit ArrowLeft (soft-back SSOT).

### Stage 201.57 — wizard $0 USD + vehicle features + publish beforeunload

- Bug: publish PATCH merged stale `metadata.base_price_asset={0,USD}` over post-priceWrite L1 → partner list `$0` while ledger THB ok. Vehicle quality needed 3 amenities but UI only offered parking/AC. Submit fired browser beforeunload (dirty never cleared). Last step had no draft save.
- Fix: preserve priceWrite asset on publish; list display ignores zero USD when ledger>0; draft seed THB; vehicle amenity set (delivery/helmets/GPS/…); `markWizardCleanForLeave` before navigate; last-step «Сохранить черновик».

### Stage 201.56 — partner cabinet entry (logged-in → auth bounce)

- Bug: «Перейти в кабинет партнёра» opened `/auth/login` while UI still showed a logged-in partner. Causes: (1) `USER_MENU_PREFETCH_PATHS` prefetched `/partner/dashboard` → middleware login redirect poisoned App Router cache; (2) stale JWT role `RENTER` after DB upgrade to `PARTNER` until `/api/v2/auth/me` refreshed the cookie.
- Fix: drop `/partner` from user-menu prefetch; menu + `usePartnerDashboardNav` await `refreshUserFromServer` then `location.assign('/partner/dashboard')`; middleware uppercases JWT role.

### Stage 201.55 — Android splash lockup + wizard FAB + vehicle year

- Android/PWA: earlier attempt used lockup-as-icon (superseded by **201.59** — dark mark `any` + light maskable).
- Wizard: soft-back AppHeader SSOT; bell/save → FAB; `vehicle_year` clamp on blur only.
- Listing wizard mobile: remove slim back/title bar; soft-back → `resolvePartnerSoftBack` → AppHeader; bell+save → fixed FABs (`ListingWizardMobileActionsFab`, like PDP heart).
- `vehicle_year`: raw digits while typing; clamp 1985–2100 only on blur (fixes snap to 1985/2100).

### Stage 201.54 — renter favorites currency + spacing

- Bug: `/renter/favorites` hardcoded `currency="THB"` while header uses `useCurrency()` (₽ etc.); `ProductPageShell` `min-h-screen` + stacked py left a tall empty scroll floor.
- Fix: `useCurrency` + `useFxRatesQuery({ retail: true })`; `layout="solo"`; shell `min-h-0` + tighter container pad (renter `main` already insets header).

### Stage 201.53 — drop legacy renter copyright footer

- Removed hard-coded `© … Rentals worldwide.` from `app/(storefront)/renter/layout.js` (not on partner/other shells; marketing footer stays on home via `PlatformHomeContent` + `allRightsReserved`).
- Restored `pb-bottom-nav` on `<main>` so content clears `MobileBottomNav`.

### Stage 201.52 — field still covered by iOS keyboard

- Bug: `focusin` on Sheet root missed portal timing; scroll parent required overflow already; early-return skipped scroll before vv settled.
- Fix: document-level `focusin`/`focusout`; `[data-mobile-overlay-scrollport]` on calendar/booking/seasonal bodies; force scroll on vv resize with retries up to 700ms; target ~32% from vv top.

### Stage 201.51 — focused field above soft keyboard

- Bug: keyboard covered active inputs in calendar/seasonal/booking sheets; white gap under CTAs with `justify-end`.
- Fix: `lib/layout/keep-focused-field-visible.js` + `useKeepFocusedFieldVisible` on Sheet/Dialog — scroll nearest scrollport so field sits ~38% down visualViewport. Editors (`block`/`booking`/price) → `fit="form"`; menus (`select`/info) → `fit="action"` hug. Drop keyboard `justify-end`.

### Stage 201.50 — iOS keyboard float (industrial vv box)

- Bug: action sheets used `bottom: bottomInset` → floated above iOS form accessory; Dialog `left-50%` + max-h fought the pin.
- Fix: keyboard-open **action/form** share `buildVisualViewportBoxStyle` (`top`+`height`+`left`+`width`); action adds `justify-end`. Bottom Dialogs full-bleed on mobile. `interactiveWidget: resizes-content` on root viewport.

### Stage 201.49 — catalog map full height + booking confirm hug

- Map sat above `--app-bottom-nav-height` → dead band between card rail and (barely visible) tab bar. Now: dock lock while open, sheet `top=header` → `bottom: 0`, safe-area on rail only.
- Booking confirm `fit="form"` left empty mid-floor above sticky CTA → `fit="action"` hug.

### Stage 201.48 — overlay empty floors / keyboard gap

- Screens: calendar block/booking, seasonal price, booking confirm — dead white under CTAs; sheet floated above iOS keyboard accessory.
- Fix: `buildVisualViewportPinStyle` — no safe-area pad while keyboard open; **form** pins `top`+`bottom` to visualViewport. Calendar overlays → recipe **action** (hug). Seasonal footer drops duplicate safe pad. `BookingModal` mobile → Sheet (later hug in 201.49).

### Stage 201.47 — expired inquiry/invoice calendar holds

- Leftover June 2026 E2E/smoke `inquiry_hold` / `invoice_hold` on live villa + PCX showed in wizard as «iCal» (`source !== 'manual'`).
- Inquiry holds are **deprecated** (Stage 175.3 no-op); invoice holds still created for real chat invoices, then `expires_at` — cron now **deletes** expired rows.
- Wizard uses `partitionPartnerListingBlocks`; CalendarSyncManager «from import» uses `blocksForPartnerIcalImportSummary` (upcoming iCal only — not holds / past nights).
- `cleanup-drafts` + `cleanup-test-data` call `purgeExpiredCalendarHoldBlocks`.
- Tests: `__tests__/stage201-46-expired-calendar-holds.test.js`.

### Stage 201.46 — dock permanently hidden (Sheet/Dialog Content mount)

- Bug: `useMobileDockLock(true)` on `SheetContent` / `DialogContent` ran whenever Content was in the React tree. Radix keeps Content mounted while `open={false}` → every closed sort sheet / calendar overlay / login dialog kept the tab bar locked.
- Fix: `OverlayOpenProvider` on Sheet/Dialog Root; lock only when `open && (bottom sheet | phone dialog)`. `isMobileDockLocked()` trusts refcount only (ignore stale dataset).

### Stage 201.45 — dock false-hide on Samsung / Android chrome

- Bug: `bottomInset > 120` alone hid guest+partner tab bars with no overlay → `--app-bottom-nav-height: 0` and content flush to system nav.
- Fix: `lib/layout/is-soft-keyboard-open.js` — keyboard only if large inset **and** editable focus. Dialog dock-lock only `<md`. Calendar `form` body `flex-1` so CTA sits on the sheet bottom.
- Search sheet → recipe **action** (hug) to drop the empty mid-floor; form pin uses `border-box` + flex column so footer sits on the sheet bottom with safe-area only.

### Stage 201.44 — ADR-201 Mobile Chrome Contract

- Three recipes only: **`action`** (hug, safe-area pad), **`form`** (fill visualViewport), **`dialog`** (capped). Dock **locked** while overlay open (`mobile-dock-lock`).
- Removed `respectAppBottomNav` / padding = tab-bar height (empty floor + float). Search sheet → `form`; sort/calendar menus → `action`.
- Code: `lib/layout/mobile-chrome-contract.js`, `mobile-dock-lock.js`, Sheet `fit`, Dialog `mobileAnchor`.

### Stage 201.43 — sheet/tabbar float regression

- Regression from 201.38–201.39: hug sheets used `bottom: navHeight` → floating panels + dead gap; tab bar hid on URL-bar resize (`innerHeight − vv.height`).
- Partial fix superseded by **201.44** contract (safe-area pad + dock lock).

### Stage 201.42 — header logo baked SVG badge (no CSS layers)

- 201.41 CSS white plate still failed under Samsung forced dark (CSS bg inverted; teal `<img>` stayed dark) and stacked with AppHeader frosted Link → “layers”.
- Fix: `public/brand/airento-mark-badge.svg` (white `rect` + mark in one image); `AirentoMark tone="badge"`; strip AppHeader logo Link border/bg/shadow. Rebuild: `node scripts/build-airento-mark-badge.cjs`.

### Stage 201.41 — header logo plate (forced-dark proof)

- Problem: algorithmic dark (Samsung/Chrome) darkens header CSS but leaves dark teal SVG → invisible mark; `prefers-color-scheme` swap alone does not fix it.
- Fix attempt: CSS `.al-logo-plate` — superseded by **201.42** baked badge.

### Stage 201.40 — PDP soft-back SSOT + favorite FAB

- Listing detail back was a page-local `ListingPageNav` (duplicate of AppHeader soft-back used on marketing/legal).
- Soft-back on `/listings/:id` via `resolveStorefrontSoftBack` → AppHeader (fallback `/listings`).
- Heart becomes a fixed FAB under the header (`listing-pdp-favorite-fab`) so favorites stay reachable while scrolling; full-width sticky bar removed.

### Stage 201.39 — iOS hug: no Safari chrome double-lift

- Bug: `hug` used `bottom = visualViewport.bottomInset + nav` even when inset was browser chrome (~40–90px), not keyboard → sheets floated mid-screen on iPhone.
- Fix: only add `bottomInset` when `> KEYBOARD_VIEWPORT_SHRINK_PX`; otherwise `bottom = navReserve` only.
- `CatalogMobileSearchSheet` → same hug pin + drop `flex-1` / `92dvh` empty grow; CTA sits above bottom nav.
- Sheet bottom: drop default `env(safe-area-inset-bottom)` pad (nav height already includes it).

### Stage 201.38 — bottom Sheet thumb-zone hug (SSOT)

- Root cause: `Sheet side=bottom` always used vv `fill` → full-height panel with actions stuck at the top and empty thumb zone.
- SSOT: `buildVisualViewportPinStyle({ mode: 'hug' })` + `SheetContent fit="content"` (default) — `height: auto`, anchored above `--app-bottom-nav-height` / keyboard.
- `fit="viewport"` only for tall peeks (e.g. chat calendar). Catalog sort / listing more / calendar action / wizard preview use `content`.
- Do not add `pb` with `--app-bottom-nav-height` on hug sheets (nav already reserved by pin).

### Stage 201.37 — no dead burger on guest profile hub

- `/profile/*` is `workspace` variant (same as partner/renter), so AppHeader showed the sidebar Menu toggle — but storefront has no sidebar / no `onMenuClick` → dead control next to soft-back.
- Fix: render menu only when `typeof onMenuClick === 'function'`; `StorefrontAppShell` sets `showMenuButton={false}`.

### Stage 201.36 — brand mark mark1 as SSOT

- Compared `airento-mark.png` vs `airento-mark1.png`: same glyph (~286×223), mark1 has less canvas padding (ink ~40% vs ~29%) → reads larger/smoother in header.
- Promoted mark1 → `public/brand/airento-mark.png` (legacy kept as `airento-mark-v1-legacy.png`); regenerated PWA/favicon via `scripts/generate-pwa-icons.mjs`.
- `AirentoLogo`: mark 30/36 + `p-1` plate (was 28/34 + `p-1.5`).

### Stage 201.35 — referral hub opens at top

- `/profile/referral`: after load, `window.scrollTo(0, 0)`; tab chips use `TabsList.scrollLeft` only.
- Removed `active.scrollIntoView` — on mobile it scrolled the window and hid the page header.

### Stage 201.34 — listing health weight + jump-to-step

- Stay soft score: photos **40** / description **25** / amenities **20** / house+check-in rules **15** (was 30/20/20/30).
- Incomplete health rows + tips are tappable → wizard step (`listingHealthWizardStepForPart`: photos→3, rest→1 Basics).
- Widget: `onGoToStep` from Step Preview + sticky preview panel.
- After jump: `scrollToListingHealthAnchor` → `data-listing-health-anchor` (description / amenities / rules / pickup / photos); opens collapsed check-in `<details>` when needed.

### Stage 201.33 — renter favorites chrome + settings phone

- `/renter/favorites`: removed pink/red hero and page-owned back; `ProductPageShell` + `PageSectionHeader` + `WorkspaceEmptyState` (sans). Soft-back via renter `AppHeader` → `/profile`.
- `/renter/settings` + favorites: `resolveStorefrontSoftBack` wired in `renter/layout.js` (was defined but unused).
- Settings: contact `phone` field (PATCH `/api/v2/auth/me`); copy — not public; self + support/admins. Public profile API still omits phone.
- Tests: `__tests__/stage201-33-renter-favorites-settings.test.js`.

### Stage 201.32 — public offer claims + applicable law

- `/legal/public-offer/`: §6 liability/claims (email via publisher support, RF review terms, court venue); new §7 RF applicable law (GK, ZoZPP, 152-FZ) scoped to Operator-as-agent IT services; PDN → §8, changes → §9. EN mirror + disclaimer unchanged.
- Fallback version bump: `CURRENT_LEGAL_TERMS_VERSION` → `2026-08-14-v1`; `LEGAL_PUBLISHER_STATIC.lastUpdated` → 14 августа 2026. If prod uses admin `legal_versions`, publish matching version there.

### Stage 201.31 — marketing/legal chrome + Help/legal i18n

- **Chrome SSOT:** `components/marketing/MarketingDocChrome.jsx` — shared eyebrow pill, H1, lead, spacing for `/about`, `/terms`, `/help`, `/help/escrow-protection`, `/legal/*` (`LegalDocShell`).
- **Help FAQ:** `components/help/HelpContent.jsx` — full RU/EN (UI language ≠ `ru` → EN).
- **Legal:** RU body remains binding SSOT; non-RU → EN convenience + `LegalTranslationDisclaimer` (switch UI language to RU). Pages: `*LegalContent.jsx`.
- About founder story unchanged (no middleman %); still via `getSiteDisplayName()`.
- Tests: `__tests__/stage201-31-marketing-legal-chrome-i18n.test.js`.

### Stage 201.30 — hide public publisher line on home/help

- Removed `LegalPublisherNote` from **home** footer only. Kept under Help «Связаться с нами». Component + `getLegalPublisherDetails` remain for legal docs.

### Stage 201.29 — About founder story

- `/about` «Наша история»: four honest founder paragraphs (Phuket + Russia travel pain → owners who want fair guests → small team building `{brand}` for ourselves → stay-first TH+RU). Brand via `getSiteDisplayName()`.

### Stage 201.28 — partner-terms intro ≤ offer

- `/legal/partner-terms` intro no longer says the platform «принимает предоплату». Aligned with offer: funds via payment partner; partner share after check-in confirmed.

### Stage 201.27 — honest TrustBar

- Drop vanity **1200+** / **4.9★**. Show listings count only when `listingsCount >= 10`; hide rating tile when `avgRating` is null/0. API `GET /api/v2/public/stats` returns `avgRating: null` (no 4.9 fallback).
- Count is global — label always worldwide (`trustListingsWorldwide`), never «in {city}».
- Tests: `__tests__/stage201-27-trust-bar-honest.test.js`.

### Stage 201.26 — marketing copy ≤ public offer

- Guest copy mirrors the offer: funds are held by the **payment partner**, not a platform escrow account. Status id `PAID_ESCROW` unchanged. Canon legal URLs stay `/terms/`, `/legal/public-offer/`, `/legal/privacy/`, `/legal/refund/` (no `/legal/terms`).
- About: owners **and representatives**; stay-first TH+RU without housing-only; Phuket only in founding story. Help/checkout/home: no 24/7 SLA; refunds follow listing + offer. KYC chip: «Подтверждённый партнёр». `LegalPublisherNote` on Help contact; not on home footer.
- Tests: `__tests__/stage201-26-marketing-copy-offer.test.js`.

### Stage 201.25 — marketing chrome (no city hardcode)

- About pill was `{brand} · Phuket · Global` (hardcoded city). Now `{brand} · Super App` (i18n).
- About / Help / Terms: drop `font-serif` + amber/teal resort gradient; CTAs via `<Button variant="brand">`. Legal `/legal/*` already used `LegalDocShell` (sans + brand-surface).
- Tests: `__tests__/stage201-25-marketing-chrome.test.js`.

### Stage 201.24 — home Top listings breathing room

- `TopListingsGrid` mobile top pad `pt-2` → `pt-8` so the title sits further below recently viewed.
- Dropped the `{n} объекта/ов` subtitle (noise). Date range line stays when search dates are set.

### Stage 201.23 — post-login feel-fast

- Login already returns `user` + Set-Cookie. Success path no longer awaits `GET /me` / `refreshUserFromServer` before navigate (destination still hydrates via `/me`).
- `finishAuthNavigation`: `dispatchOptimisticNavPending` + `router.replace` — **no** `router.refresh()` on the auth page (that was the idle-button gap). Spinner stays until unmount.
- Same pattern: email form, modal `handleLogin`, phone OTP, Telegram, complete-legal, link-conflict merge.
- Tests: `__tests__/auth-redirect-booking-draft.test.js`.

### Stage 201.22 — catalog Back restore retry

- Probe: persist wrote `listings:semantic=1` (y + anchor), but Back left `y≈0` and a stale PDP query key (`listings:checkInTime=…`). Host used React `searchKey` from the listing page and bailed before `window.location` became `/listings?semantic=1`.
- Restore polls `liveRouteScrollKey()` while pending; pending flag also in `sessionStorage` (survives chunk copies). `popstate` bumps a restore generation.
- Reuse on other list pages: Constitution §5 «List scroll restore», manifesto **§5.1b**.
- Tests: `__tests__/stage201-22-catalog-scroll-restore-retry.test.js`.

### Stage 201.21 — catalog scroll SSOT

- Search `/listings?semantic=1` restore used a stale empty query key (`listings:` vs `listings:semantic=1`) and consumed the pending flag — Back jumped to top.
- SSOT persist: `persistLiveRouteScroll` from `navigateWithListingHeroTransition` (catalog cards `router.push`, not only `<a>`).
- Restore reads `liveRouteScrollKey()` from `window.location`; pending flag is not consumed until an entry exists.
- Tests: `__tests__/stage201-21-catalog-scroll-ssot.test.js`.

### Stage 201.20 — scroll memory anchor align

- Root cause of “back lands a bit lower”: raw `scrollY` restore, then images/rails above expand and shift content down under the viewport.
- Save clicked `a[href]` + `getBoundingClientRect().top`; restore re-aligns that node (retries ~2.8s). Plain Y kept as fallback.
- Tests: `__tests__/stage201-20-scroll-anchor.test.js`.

### Stage 201.19 — silent FCM ack (no Chromium default toast)

- Chromium/Yandex show «Этот сайт был обновлён в фоновом режиме» if a push handler returns without `showNotification`.
- `BADGE_UPDATE` and Premium Quiet now `acknowledgePushWithoutUserBanner` (silent tagged notify → immediate `close`).
- Quiet suppress only when a same-origin tab is **focused + visible** (unfocused tab gets a real NEW_MESSAGE banner).
- Tests: `__tests__/stage201-19-silent-push-ack.test.js`.

### Stage 201.18 — root RouteScrollMemoryHost

- Scroll memory host in `RootClientProviders` (survives storefront↔marketing layout switch).
- Restore only on history pop / soft-back (`markPendingRouteScrollRestore` in `useSoftBack`).
- Page-local `useRouteScrollMemory` removed from home + catalog (avoid forward-nav false restores).
- Tests: `__tests__/stage201-18-route-scroll-host.test.js`.

### Stage 201.17 — scroll memory persist / restore race

- Root cause: Next soft-nav resets `scrollY` to 0 before leaving page unmount → memory saved `0`.
- Fix: track `lastYRef` on scroll; capture-phase `<a>` click persist; `saveRouteScroll` ignores clobbering `0` over a real Y; restore peeks + retries until layout tall enough (~1.8s).
- Applies to home + catalog (same hook). Tests: `__tests__/stage201-17-scroll-memory-persist.test.js`.

### Stage 201.16 — home soft-back scroll memory

- `homeScrollKey()` + `useRouteScrollMemory` on `PlatformHomeContent` (same SSOT as catalog `/listings`).
- Soft back from PDP / marketing / catalog restores prior window scroll once content is ready.
- Tests: `__tests__/stage201-16-home-scroll-memory.test.js`, extended `route-scroll-memory.test.js`.

### Stage 201.15 — marketing nav resilience

- `(marketing)` i18n: register storefront-common + errors; `I18nSliceBootstrap preset="marketing"`; local `error.js`.
- `AppHeader`: `Suspense` around `ScrollProgressBar` (`useSearchParams`).
- `AppErrorBoundaryView`: Retry on ChunkLoad/Failed-to-fetch → `location.reload()`.
- Footer stays soft `Link` (hard `<a>` caused 2–3s blank home on Back — full reload).
- Tests: `__tests__/stage201-15-marketing-footer-nav.test.js`.

### Stage 201.14 — soft-back hard-exit cleanup + marketing pad

- Extended `soft-back-routes`: `/u/*`, `/go/*` → `/listings`; `/renter/reviews/*` → `/my-bookings`; partner guest-review → `/partner/bookings`. Removed page-local ArrowLeft on those screens.
- Marketing double-pad: About/Terms hero `pt-24` → `pt-6/8` (MainContent already clears header); LegalDocShell / loyalty / referral calc / escrow-help top pad tightened.
- Leave alone: PDP/favorites/ChatTopBar, checkout/auth/wizard, admin.
- Tests: `__tests__/stage201-14-soft-back-pad-cleanup.test.js`.

### Stage 201.13 — soft-back SSOT P1 (guest nested + partner More)

- Resolvers: `lib/navigation/soft-back-routes.js` (`resolveStorefrontSoftBack`, `resolvePartnerSoftBack`; marketing fallback moved here from P0).
- Wired: `StorefrontAppShell` + `partner/layout` → `AppHeader` `showSoftBack` / `softBackFallback`. Guest: wallet/referral/status/settings → `/profile`; my-bookings → `/`. Partner More: finances/settings/payouts/reviews/promo → `/partner/dashboard`.
- Removed page-local hard ArrowLeft on `/my-bookings` and `/partner/promo` (header owns back).
- P0 marketing unchanged. Leave alone: tab roots, PDP/favorites/ChatTopBar, wizard, checkout/auth, guest-review.
- Tests: `__tests__/stage201-13-soft-back-p1.test.js`.

### Stage 201.12 — soft-back SSOT P0 (marketing / iOS)

- Behavior SSOT: **`useSoftBack(fallbackHref)`** only (`hooks/use-soft-back.js`).
- UI: `AppHeader` props `showSoftBack` / `softBackFallback`; **`MarketingAppShell`** defaults `showSoftBack=true` (fallback `/`; `/help/escrow-protection` → `/help`). Covers help/legal/terms/about children of `(marketing)`.
- P1 backlog (not in this Stage): profile nested (`/profile/wallet|referral|status`, settings), partner «More» (finances/settings/payouts/referrals/reviews). → **Done in 201.13**; further hard-exit cleanup in **201.14**.
- Leave alone: PDP/favorites/ChatTopBar, tab roots, checkout/auth/wizard, admin.
- Tests: `__tests__/stage201-12-soft-back-marketing.test.js`.

### Stage 201.11 — nightly Playwright keep-list

- CI **`npm run test:e2e:nightly`**: escrow, inquiry/checkout/invoice, accountant-math, wizard/calendar, RBAC, security, stage9 API guard.
- Out of nightly (still runnable locally): stage72 cashflow, referral visual, chat-stress, seo/speed/polyglot bots, CRO, discovery-analytics, `example.spec`.
- Tests: `__tests__/stage201-11-nightly-e2e-keep-list.test.js`.

### Stage 201.10 — pre-launch leftover demo profiles + E2E tank

- Cleanup markers now catch disposable emails (`@test.com`, `@example.com`, `@demo.com`, `@funnyrent.com`, `@*.invalid`) and seed ids (`partner-test`, `partner-1`, `user-phantom-*`, `usr-stage*`). Real staff still protected by email allowlist (ADMIN role alone no longer shields test accounts).
- `isTestTankLedgerRow` matches `metadata.trigger` `e2e_*` (nightly E2E left `host_activation_reversal` / `e2e_dispute_resolved` with null `booking_id`).
- Live guests (Оксана, Pavel, early real signups) and platform promo `SAVE100` / `WELCOME10` kept.
- Tests: `__tests__/stage201-10-prelaunch-demo-profile-cleanup.test.js`.

### Stage 201.09 — test ledger / booking self-clean

- Pre-launch: test journals/entries/intents/bookings wiped; live append-only stays on.
- Nightly `/api/cron/cleanup-test-data` (Vercel `20 4 * * *`): `purge_test_ledger_rows('markers')` then E2E/smoke listings+users; never-paid (CANCELLED + unpaid past check-out) hard-delete.
- `cleanup-drafts` auto-cancels unpaid INQUIRY/PENDING/CONFIRMED/AWAITING_PAYMENT after check-out (`scope: cancel`).
- Markers RPC does **not** treat unpaid/cancelled status as test money (201.09b). `scope=all` is ops GUC only.
- Tests: `__tests__/stage201-09-test-ledger-self-clean.test.js`.

### Stage 201.08 — listing cleanup villa-id guard

- `isTestListingId` no longer matches `lst-villa-*` / `lst-yacht-*` (live partner seeds, e.g. Rawai villa).
- Cleanup still matches `[E2E_TEST_DATA]`, `lst-test*`, `lst-e2e-*`.
- Tests: `__tests__/stage201-08-test-listing-cleanup-villa-id.test.js`.

### Stage 200.137 — product feedback Phase 1

- Renter profile quick actions: **Help** → `/help`, **Report a problem** → `ProductFeedbackDialog`; logout `col-span-2`.
- `POST /api/v2/feedback` (session required) → Telegram system alert + optional email to `getSupportInboxEmail()` (`SUPPORT_INBOX_EMAIL` / `PROCESS_SUPPORT_EMAIL`); UI mailto stays `NEXT_PUBLIC_SUPPORT_EMAIL` / `getPublicSupportEmail()`.
- Hidden ops meta: `pageUrl`, UA, server `audience` (`partner` / `guest` / `staff`) from `profiles.role`.
- `/help` hero: honest early-stage SLA («обычно в течение нескольких часов»).
- Phase 2 backlog: `product_feedback` table + admin queue (see ROADMAP).

### Stage 201.07 — header wallet product groups

- Compact wallet splits **listings** (escrow from orders, always shown for partner/staff) vs **invites** (to card / for bookings).
- Partner: primary CTA → `/partner/finances`; secondary → `/profile/referral`. Renter: referral only.
- Short labels + existing i18n tooltips on `i`; no always-on midFX / approximate-prefix on money amounts.

### Stage 200.136 — wizard preview card solo layout

- Empty white under specs/price in eye-preview + step 6 was **grid stretch** (`h-full` + `flex-1` + `mt-auto`), not missing description (storefront cards never show body text).
- `ListingCard` `layout="solo"` for wizard preview; catalog keeps `layout="grid"`.
- Tests: `__tests__/stage200-136-wizard-preview-card-solo.test.js`.

### Stage 200.135 — iOS keyboard visualViewport fill pin

- Root cause of mid-form / number-pad regression: `bottom: bottomInset` breaks when Safari shifts `visualViewport.offsetTop`.
- SSOT: `buildVisualViewportPinStyle({ mode: 'fill' })` → `top: offsetTop` + `height: vv.height` (Dialog `mobileAnchor="bottom"`; Sheet `fit="viewport"`).
- Bottom action menus use Sheet `fit="content"` / mode `hug` (Stage 201.38) — not fill.
- Focus sync + `scrollIntoView` inside dialog; form dialogs (withdraw, support, cancel, invoice, …) use `mobileAnchor="bottom"`.
- Constitution §5 row **Mobile keyboard / overlays**. Tests: `__tests__/stage200-135-ios-keyboard-vv-pin.test.js`.

### Stage 201.06 — partner finance clarity

- Overview «В обработке / эскроу» = frozen + thaw hold (no PAID_ESCROW double-count via `pendingPayouts`).
- Header «Сводка по балансу»: partner CTA → `/partner/finances`; escrow label without «хостинг».
- `PARTNER_PENDING_PAYMENT_BOOKING_STATUSES` SSOT for stats + finances (`PENDING` / `CONFIRMED` / `AWAITING_PAYMENT`).

### Stage 200.134 — dialog visualViewport / iOS keyboard gap

- `DialogContent` pins to `visualViewport` (`offsetTop` + `bottomInset`); `mobileAnchor="bottom"` for form sheets.
- Seasonal price editor: bottom sheet + sticky footer (no fixed `100vh` height fighting the keyboard).
- Hook SSOT: `hooks/use-visual-viewport-frame.js`. Tests: `__tests__/stage200-134-dialog-visual-viewport.test.js`.

### Stage 200.133 — referral UX plain copy / mobile pad

- Tabs on `/profile/referral`: `justify-start` + horizontal `scrollLeft` (not `scrollIntoView` — see 201.35).
- Wallet: more space between display-currency control and «Статус выплат».
- Hide payout blocker machine codes (`BELOW_MIN_*`); localized tier names (Новичок / …).
- User copy: no mid-market / rate lock / витринная наценка / storefront markup in referral (and partner midFx hint).
- Tests: `__tests__/stage200-133-referral-ux-plain-copy.test.js`.

### Stage 200.132 — renter profile auth hang / false logout

- `/renter/profile` listened to `auth-change` and re-called `refreshUserFromServer` → infinite `/api/v2/auth/me` storm → spinner then session wipe.
- Fix: hydrate from AuthProvider; apply `auth-change` detail only; one soft refresh per user id.
- `getCurrentUser`: null only on 401/403; throw on network/5xx. Session sync keeps cached user on transient failure.
- Tests: `__tests__/stage200-132-renter-profile-auth-loop.test.js`.

### Stage 201.05 — ledger RUB locked-rate guard

- `buildRubPostingFields` no longer fills RUB columns from live `getRawRateMap` / `exchange_rates`.
- Locked only: `bookings.exchange_rate` or snapshot `fx_*`; missing → omit RUB fields + log `LEDGER_RUB_LOCKED_RATE_MISSING`. Guest charge still snapshot/`price_paid`.

### Stage 201.04 — ADR-300 RF–KR–TH 3.0 (docs only)

- Policy overlay: [`docs/ADR/300-russia-kyrgyzstan-thailand-3.0.md`](./ADR/300-russia-kyrgyzstan-thailand-3.0.md) — scheme 3.0 ↔ existing code SSOT; Phase 0 = manual treasury from RF.
- Runtime unchanged (no PricingEngine / ledger / escrow / payout execution / migrations).
- Private treasurer checklist: `docs/private/*.example.md` only in git.

### Stage 200.131 — partner hub soft-card pad SSOT

- `PARTNER_HUB_SOFT_CARD_PAD_*` in `lib/ui/partner-section-rhythm.js` — restores `max-sm:p-3` when soft surface + `MOBILE_FLAT_*` (`max-sm:p-0`).
- Applied: listings сводка, dashboard metrics/balances, finances strip/math/stats/portfolio/docs/history, reviews, calendar education; ≈ amounts use `gap-x-1`.
- Payout math: no-profile copy once (no duplicate body).
- Tests: `__tests__/stage200-131-partner-hub-soft-card-pad.test.js`.

### Stage 200.130 — partner listings trash stats + filter chip

- Dual TanStack queries: live list always for сводка / resume-drafts banner; `filter=deleted` only for trash rows.
- Resume banner hidden on «Удалённые» (soft-deleted drafts still have `is_draft`).
- Filter chips `scrollIntoView({ inline: 'center' })` when `listFilter` changes.
- Tests: `__tests__/stage200-130-partner-listings-trash-stats.test.js`.

### Stage 200.129 — season price sheet fit + date pickers

- `PartnerDateRangeFields`: `autoOpenEnd` default **false** (start closes; end only on tap) — master calendar, wizard seasons, availability blocks.
- `CalendarActionOverlay` / price modal: `min-w-0` + `overflow-x-hidden`, token borders; listing Select truncates (fixes mobile left clip).
- Tests: `__tests__/stage200-129-partner-season-price-sheet.test.js`.

### Stage 200.128 — Listing Restore & trash UX

- `POST /api/v2/partner/listings/[id]/restore` + `lib/listing/listing-soft-delete-restore.js` (status from `previous_status`; ACTIVE without re-moderation).
- Soft DELETE stores `sync_settings.auto_sync_before_soft_delete`; restore resumes only if `paused_by_soft_delete`.
- GET listings `filter=deleted`; partner UI chip «Удалённые» + `partnerListings_undelete*` (not hide/unhide).
- Tests: `__tests__/stage200-128-listing-restore.test.js`.

### Stage 200.127 — listing soft-delete filter SSOT

- SSOT: `lib/listing/listing-soft-delete.js` (`metadata.is_deleted`).
- Partner calendar / stats / listings GET + iCal cron exclude soft-deleted; DELETE pauses `sync_settings.auto_sync`.
- Honest delete dialog copy (not “data wiped”). Restore shipped in **200.128**.
- Tests: `__tests__/stage200-127-listing-soft-delete-filter.test.js`.

### Stage 200.126 — Partner sidebar footer compact

- Shorter sidebar labels: `partnerNav_switchToGuestMode` → «Режим гостя»; `partnerNav_partnerTerms` (legal footer copy unchanged).
- Removed sidebar logout (still in header UserMenu); slightly denser nav/footer `py-1` (touch `min-h-11`).
- Tests: `__tests__/stage200-126-partner-sidebar-footer-compact.test.js`.

### Stage 200.125 — season-type browser-safe (build fix)

- Client wizard/`SeasonalPriceManager` imported `normalizeSeasonType` from `listing-seasonal-price-canon` → pulled FX/`currency.service` → `node:crypto` (webpack fail).
- Pure helpers → `lib/listing/season-type.js`; canon re-exports for server.
- Tests: `__tests__/stage200-125-season-type-browser-safe.test.js`.

### Stage 200.124 — payment-window browser-safe (build fix)

- Removed `createRequire` / `node:module` from `payment-window-policy.js` (was breaking Next client bundle via `CheckoutHoldTimer` → `checkout-hold-policy`).
- Invoice system copy → `lib/booking/payment-window-system-message.js` (server chat invoice path).
- Tests: `__tests__/stage200-124-payment-window-browser-safe.test.js`.

### Stage 200.123 — Partner mobile sidebar dock inset

- `.app-workspace-sidebar`: mobile `bottom: var(--app-bottom-nav-height)` (no `100dvh−header` under dock / home indicator).
- Partner drawer: slightly denser rows (`py-1.5`, still `min-h-11`); backdrop clears dock.
- Bottom dock: `partnerNav_bookingsShort` («Брони») to avoid «Бронирова…».
- Tests: `__tests__/stage200-123-partner-sidebar-dock-inset.test.js`.

### Stage 200.122 — PDP UX SSOT polish

- Mobile planner: pass `listingCategorySlug` + `listingMetadata` into breakdown (exclusion hints); drop nested `bg-white` under flat card; ask-partner touch ≥ 44px.
- Trust cancel: neutral «правила отмены» for moderate/strict; flexible soft copy; anchor `#listing-cancellation-policy`.
- Breakdown: show rounding pot line when `roundingDiffPot` &gt; 0 (display-only; no PricingEngine/ledger change).
- Tests: `__tests__/stage200-122-pdp-ux-ssot.test.js`.

### Stage 200.121 — Checkout FX UX + hold gate

- Checkout CARD/MIR: issuer conversion-fee disclaimer under pay CTA (`checkout_issuerFeeDisclaimer`).
- Cancel preview/dialog: refund estimate in locked guest pay currency via `estimateRefundInGuestPaymentCurrency` / `readGuestPaymentDisplay` (ledger still THB).
- `POST …/payment/initiate`: fail-closed on `isCheckoutHoldExpired` → `CHECKOUT_HOLD_EXPIRED` (410); toast `checkout_toast_holdExpired`.
- No PricingEngine / ledger formula change.
- Tests: `__tests__/stage200-121-fx-ux-hold-gate.test.js`.

### Stage 200.120 — Master calendar date SSOT (Wave E)

- `/partner/calendar` ActionModals: block / booking / seasonal price periods use `PartnerDateRangeFields` (no native `type="date"`).
- `lockStart` for cell-anchored start; YMD helpers in `lib/ui/partner-date-ymd.js`. Overlay popovers `z-[400]`.
- No calendar mutate API / FSM change.
- Tests: `__tests__/stage200-119-120-partner-calendar-copy-and-modals.test.js`.

### Stage 200.119 — Wizard calendar OTA copy (Wave D)

- `wizardSection_calendarSync` / step hint: Airbnb & Booking wording (ru/en/zh/th); drop OTA jargon in partner-facing titles.
- iCal still named inside sync manager body. No API change.

### Stage 200.118 — AvailabilityCalendar i18n (Wave C)

- Wizard block-dates UI: all labels/toasts/empty via `getUIText` (`partnerAvail_*` + existing `partnerCal_toast_*`).
- Locales: ru/en/zh/th in `partner-calendar-modals.js`. No calendar/iCal API change.
- Tests: `__tests__/stage200-118-availability-calendar-i18n.test.js`.

### Stage 200.117 — PartnerDateRangeFields SSOT (Wave B)

- New `components/partner/PartnerDateRangeFields.jsx` — Popover + `ui/calendar`, controlled close, auto-open end; overlay `z-[400]`.
- Wizard **blocks** + **seasonal** modal use the same two-row start/end UX; seasonal drops inline DayPicker + `react-day-picker/dist/style.css`.
- Seasonal modal field order: name/type → dates → prices. Locale helper: `lib/ui/partner-date-fns-locale.js`.
- No iCal / discovery / storefront SearchCalendar change.
- Tests: `__tests__/stage200-117-partner-date-range-ssot.test.js`.

### Stage 200.116 — Partner calendar picker Wave A hotfix

- Seasonal modal: `SelectContent z-[400]` above Dialog `z-[220]` (dead season-type Select).
- `normalizeSeasonType` SSOT in `listing-seasonal-price-canon.js` (load/edit/save + wizard map).
- Master calendar price modal adds `NORMAL`; Availability block popovers controlled (close on pick + open end).
- Calendar locale from `useI18n` on block date pickers. No iCal/discovery API change.
- Tests: `__tests__/stage200-116-partner-calendar-picker-hotfix.test.js`.

### Stage 200.114 — Guest catalog rhythm polish (`/listings`)

- Empty CTA → i18n `catalogShowAllListings` (all locales; no ru/en hardcode).
- Skeleton CLS: `LISTING_CARD_BODY_PAD` + `LISTING_CARD_MEDIA_ASPECT` + `.gsl-shimmer`.
- AI pending banner → brand tokens (no violet / emoji); load-more CTA `min-h-[44px]`.
- No discovery API / filter FSM / map / `PARTNER_*` mint on guest UI.
- Tests: `__tests__/stage200-114-guest-catalog-rhythm.test.js`.

### Stage 200.113 — Partner WorkspaceEmptyState adoption

- Listings / reviews / promo empty (and listings filter-empty) use existing `WorkspaceEmptyState` + hub surface class — no new `PartnerEmptyState`.
- Reviews loading uses `LoadingPageShell`; listing/review/promo APIs unchanged.
- Tests: `__tests__/stage200-113-partner-empty-states.test.js`.

### Stage 200.112 — Partner guest-review / toast i18n

- Guest-review page: all UI/toasts via `getUIText` (`partnerGuestReview_*`); POST `/api/v2/partner/guest-reviews` unchanged.
- Promo Flash extend toasts + settings save-error fallback use i18n keys.
- Tests: `__tests__/stage200-112-partner-i18n-sweep.test.js`.

### Stage 200.111 — Partner listings list hub rhythm

- `/partner/listings`: Filters / Stats / List sections with `PARTNER_SECTION_TITLE` + `PartnerSectionDivider`; stats + empty states use hub mint; cards keep `PARTNER_LISTING_CARD_SURFACE_CLASS`.
- No change to `usePartnerListings` / patch / delete / publish paths.
- Tests: `__tests__/stage200-111-partner-listings-rhythm.test.js`.

### Stage 200.110 — Partner promo hub rhythm

- `/partner/promo`: Create / List (/ Flash) sections with `PARTNER_SECTION_TITLE` + `PartnerSectionDivider` + `PARTNER_FIELD_LABEL`; cards use hub mint surface.
- Hardcoded RU list/flash copy moved to i18n; promo create/list/extend API paths unchanged.
- Tests: `__tests__/stage200-110-partner-promo-rhythm.test.js`.

### Stage 200.109 — Partner master calendar hub rhythm

- `/partner/calendar`: Context / Controls / Board sections with `PARTNER_SECTION_TITLE` + `PartnerSectionDivider`; education card uses `PARTNER_HUB_LIST_CARD_SURFACE_CLASS`.
- No change to calendar query, block/booking/price mutate, or iCal sync handlers.
- Tests: `__tests__/stage200-109-partner-calendar-rhythm.test.js`.

### Stage 200.108 — Partner reviews hub rhythm

- `/partner/reviews`: Stats / List sections with `PARTNER_SECTION_TITLE` + `PartnerSectionDivider`; cards use `PARTNER_HUB_LIST_CARD_SURFACE_CLASS`.
- Guest-review form: section title + `PARTNER_FIELD_LABEL` + hub surface; star touch ≥44px.
- No change to `/api/v2/reviews` reply or `/api/v2/partner/guest-reviews` submit payloads.
- Tests: `__tests__/stage200-108-partner-reviews-rhythm.test.js`.

### Stage 200.107 — Wizard Calendar section rhythm

- Wizard step 5 (`StepCalendarSection`): `PARTNER_SECTION_TITLE` + helpers + `PartnerSectionDivider` for OTA sync / availability / seasonal prices.
- Widgets accept `embedInPartnerSection` (sr-only or demoted CardTitle) — no change to iCal/block/seasonal fetch or save paths.
- Tests: `__tests__/stage200-107-wizard-calendar-rhythm.test.js`.

### Stage 200.106 — Partner settings hub rhythm

- `/partner/settings`: sections Profile / Security / Notifications / Integrations (+ legal) with `PARTNER_SECTION_TITLE` + `PartnerSectionDivider`; field labels via `PARTNER_FIELD_LABEL_CLASS`.
- Cards: `MOBILE_FLAT_*` + `PARTNER_HUB_LIST_CARD_SURFACE_CLASS`; touch CTAs ≥44px.
- No change to save handlers, avatar upload, KYC attach, notification preference payload, or auth/me fetch.
- Tests: `__tests__/stage200-106-partner-settings-rhythm.test.js`.

### Stage 200.105 — Partner finances hub rhythm

- `/partner/finances` overview/ledger/reports: `PARTNER_SECTION_TITLE` + `PartnerSectionDivider` for Balance / Withdraw / Transactions / Reports.
- Balance tiles + payout math / history / portfolio cards: `MOBILE_FLAT_*` + `PARTNER_HUB_LIST_CARD_SURFACE_CLASS`.
- `/partner/payout-profiles`: settings vs requisites sections with same rhythm + hub surface.
- No change to ledger hooks, withdraw eligibility, payout-profiles API payloads, or transaction status mapping.
- Tests: `__tests__/stage200-105-partner-finances-rhythm.test.js`.

### Stage 200.104 — Partner dashboard hub rhythm

- `/partner/dashboard`: sections Alerts / Quick actions / Metrics / Upcoming with `PARTNER_SECTION_TITLE` + `PartnerSectionDivider`.
- Metric tiles + money/pending cards: `MOBILE_FLAT_*` + `PARTNER_HUB_LIST_CARD_SURFACE_CLASS`; upcoming rows use hub surface.
- No change to `usePartnerDashboardPage` / money / booking action hooks or API payloads.
- Tests: `__tests__/stage200-104-partner-dashboard-rhythm.test.js`.

### Stage 200.103 — Partner bookings hub rhythm

- `/partner/bookings`: `PARTNER_SECTION_TITLE` + `PartnerSectionDivider` for filters vs list; list groups by status buckets when tab=`all` (presentation only).
- `PartnerBookingCard`: `MOBILE_FLAT_CARD` + `PARTNER_HUB_LIST_CARD_SURFACE_CLASS` (alias of listing mint surface); touch CTAs ≥44px.
- No change to FSM, pricing, `buildPartnerUnifiedOrder`, tab filter SSOT, or mutate handlers.
- Tests: `__tests__/stage200-103-partner-bookings-rhythm.test.js`.

### Stage 200.102 — Dark Mode Input borders via tokens

- **Root cause:** `.dark --input` / `--border` matched muted (~17.5% L) → fields blended into `bg` (~5% L).
- **Fix:** raise dark `--input` (~36% L) and `--border` (~26% L) in `app/globals.css`; `Input` / `Textarea` / `SelectTrigger` use `border-input`, hover `border-ring/45`, focus `border-brand-mint` + `ring-brand-mint/40` (no `border-slate-*`, no hex).
- Wizard forms inherit via shared `components/ui/*` — no step logic change.
- Tests: `__tests__/stage200-102-input-dark-tokens.test.js`.

### Stage 200.101 — Photos + Preview on partner section rhythm

- **Photos / Preview** aligned with Basics/Location/Pricing: `PARTNER_SECTION_TITLE_CLASS`, `PARTNER_FIELD_LABEL_CLASS`, `PartnerSectionDivider`, short helpers; mobile flat (no heavy nested chrome).
- Upload / DnD / sort / live `pricingPreview` L1 (200.96) unchanged; no `target="_blank"` on preview.
- Tests: `__tests__/stage200-101-photos-preview-rhythm.test.js`.

### Stage 200.100 — Safe polish (plurals, trust, cancellation title)

- PDP specs: `pluralizeBedrooms` / `pluralizeBathrooms` / `formatUpToGuestsLabel` (`lib/i18n/pluralize.js`) — «1 спальня», не «1 спален».
- Pricing: cancellation uses `PARTNER_SECTION_TITLE_CLASS`.
- PDP sticky trust compact: `text-xs leading-relaxed` (was `text-[10px]`).
- Geo helpers (RU/EN): slightly shorter one-liners.
- Tests: `__tests__/stage200-100-safe-polish.test.js`.

### Stage 200.99 — Stay check-in/out times + soft flexibility (no money / no calendar)

- **Why:** partners had no UI for arrival hours; PDP already read `metadata.check_in_time` / `check_out_time`.
- **Wizard (stay only):** `WizardStayArrivalHours` — times + «early/late on request» switches (chat signal only).
- **PDP:** `getListingGoodToKnow` + `ListingStayPolicies` show flexibility note; **no** price/ledger/calendar change.
- Whitelist: `METADATA_KEYS_ALWAYS_ALLOWED` adds arrival keys.
- Tests: `__tests__/stage200-99-stay-arrival-hours.test.js`.

### Stage 200.98 — Wizard action bar vertical balance

- Bug: `py-3` + `.safe-area-pb` — class sets `padding-bottom: env(...)` and zeroes bottom pad when inset is 0 → CTAs stuck to bottom edge of sticky bar.
- Fix: `WIZARD_MOBILE_ACTION_BAR_INNER_CLASS` — `pt-3` + `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` (equal rhythm; safe-area additive).

### Stage 200.97 — Tighter wizard void + clearer mint dividers

- **Void:** removed scrollport `padding-bottom` (it stacked with content pb); content clearance = `5rem+0.5rem` only; step root `space-y-4` on mobile.
- **Dividers SSOT:** `h-0.5` (2px) + `bg-brand-mint/40` / dark `/55`; wrap `py-3 sm:py-4` (was faint `/20` + `py-5`).
- Tests: `__tests__/stage200-97-wizard-rhythm-tighten.test.js`.

### Stage 200.96 — Live wizard preview price + in-app «view on site»

- **Eye preview bug:** card used stale `metadata.base_price_asset` (e.g. 5400×1.15=6210) over live form L1 (5700). Fix: `readBasePriceAssetFromListing` prefers top-level `basePriceAsset`; wizard preview payloads sync `metadata.base_price_asset` from `formData.basePriceThb`.
- **View on site:** drop `target="_blank"` on partner listings overflow Link (PWA stays in-app).
- **PDP hero:** `HeroPriceHeadline` uses `formatSameCurrencyGuestDisplay` for per-night when UI currency === listing base (avoids retail FX ₽6882-style drift).
- Tests: `__tests__/stage200-96-wizard-preview-price.test.js`.

### Stage 200.95 — Wizard scroll clearance + Basics/Pricing rhythm

- **P0 root cause:** Tailwind dropped `pb-[…env(safe-area-inset-bottom,0px)]` because `,` splits arbitrary classes — fixed (no comma) + bumped action clearance to `6.5rem+1.25rem`.
- **Scrollport:** `data-listing-wizard-scroll` on partner `WORKSPACE_SCROLL` + `scroll-padding-*` (Tailwind + `globals.css` fallback).
- **SSOT apply:** `PartnerSectionDivider` + `PARTNER_SECTION_TITLE` / `PARTNER_FIELD_LABEL` on Basics + Pricing; helpers under controls; RU genitive via `formatWizardAddDetailsLine`.
- Tests: `__tests__/stage200-95-wizard-section-rhythm.test.js`.

### Stage 200.94 — Partner section rhythm (wizard + listings pilot)

- **P1 padding:** `listing-wizard-layout.js` — chrome `5.75rem` + `0.75rem` gap; action bar clearance (superseded heights in **200.95**).
- **P2:** `PartnerSectionDivider` + `lib/ui/partner-section-rhythm.js` (mint hairline ~20%, inset `mx-4/6`); pilot on Location + Calendar; section title `text-base font-semibold` vs field `text-sm font-medium`; helpers under inputs.
- **P3:** `/partner/listings` — soft surface + left mint accent (`PARTNER_LISTING_CARD_SURFACE_CLASS`), keep `space-y-3`.
- Tests: `__tests__/stage200-94-partner-section-rhythm.test.js`.

### Stage 200.93 — Calendar step auto-ensures draft

- Entering step 5 calls `ensureCalendarListingReady`: create draft if needed (`updateUrl: false` — no form wipe) + soft `GET` → `setServerListing`.
- UI: preparing shimmer, then sync/blocks/seasons; needs-draft only if category missing.

### Stage 200.92 — Wizard = 6 steps (Calendar dedicated)

- **IA:** 1 Basics → 2 Location → 3 Photos → 4 Pricing → **5 Calendar** → **6 Preview** (`LISTING_WIZARD_STEP_COUNT = 6`).
- **Why:** edit mode mounted `StepCalendarSection` under every step; Pricing also had DayPicker seasons → duplicate UX. Seasons SSOT = `SeasonalPriceManager` on step 5 only.
- Pricing keeps a pointer to step 5; calendar optional (no Next blockers); `?highlight=calendar` / `?step=calendar` → step 5.
- Tests: `__tests__/stage200-92-wizard-six-steps.test.js`.

### Stage 200.91 — Partner list price updates immediately after wizard save

- **Why stale:** global RQ defaults `staleTime` 5m + `refetchOnMount: false`; wizard `invalidateQueries` only refetched **active** queries — list page was unmounted, so cache stayed old until ~5m / focus.
- **Fix:** `refreshPartnerListingsAfterSave` seeds L1 `basePriceAsset` + `invalidateQueries({ refetchType: 'all' })`; `usePartnerListings` sets `refetchOnMount: true`, `staleTime: 60s` (override shared defaults for this query only).
- Street input: `autoComplete="off"` — Samsung/Chrome address autofill was showing unrelated saved places (e.g. Thaweewong) over our typeahead.

### Stage 200.90 — Clear street without house number bleed

- **Bug:** empty `metadata.street` was treated as absent → street input fell back to `address` which after clear was only `"12"` (house).
- **Fix:** `lib/geo/wizard-street-house-display.js` — respect explicit empty street/house; `address` never composed as house-only; atomic `syncStreetHouse` via `setFormData`.
- Tests: `__tests__/stage200-90-street-clear-house-bleed.test.js`.

### Stage 200.89 — Wizard street + house one row; suggest while typing

- Layout: street + house always one row (street wide, house ~5rem); suggestions under the row (no mobile `flex-col` stack under the street field).
- **Why empty suggest for «Славянска»:** search needle appended already-typed house (`Славянска, 12`) — Nominatim often returns nothing mid-name. Street typing now searches **street-only**; house field searches `street, house`.
- House blur / CTA auto-picks top geocode hit so partner need not tap the list twice.
- Tests: `__tests__/stage200-89-street-house-row.test.js`.

### Stage 200.115 — Currency / FX SSOT (display vs checkout)

- **Doc:** [`docs/CURRENCY_FX_SSOT.md`](./CURRENCY_FX_SSOT.md) — listing base vs UI vs payment; retail vs `fx_markup_pct`; Berlin/MIR/invoice scenarios.
- **Helpers:** `lib/pricing/fx-policy.js` (+ tests). No ledger / PricingEngine math change.
- **UX:** partner wizard always shows FX hint (not only when currency unlocked); copy clarifies header ≠ payment.
- Pointers: `lib/pricing/PRICING_SERVICES.md`, ADR-181 invariants, Constitution §3.

### Stage 200.88 — FX markup when guest pays THB for non-THB listing

- **Gap:** `computeFinalBreakdown` / `getCheckoutRateToThb` skipped FX when `pay=THB` even if `base≠THB` (RF listing + THB pay had `fx_markup_thb=0`).
- **Fix:** markup whenever `payment_currency ≠ listing_base_currency`. THB pay → integer surcharge in `total_guest_brutto` + `fx_markup_thb`; mid payable / partner netto unchanged. Intent (`expectedPaymentIntentAmountThbFromBooking`), capture (`resolveCaptureGuestTotalThb`), `price_paid` / attestation use brutto THB when above mid.
- Helpers: `lib/pricing-engine/guest-fx-charge.js`. Tests: `__tests__/stage200-88-fx-markup-cross-currency.test.js`.

### Stage 200.87 — Wizard edit save: price list refresh, street/house persist, redirect

- Partner list RQ: `staleTime` 5m + `refetchOnMount: false` hid price updates after save — invalidate `partnerListingsKeys` on save/publish.
- `normalizePartnerListingMetadata` whitelist dropped `street` / `house_number` — added to `METADATA_KEYS_ALWAYS_ALLOWED`.
- Edit save (floppy) → `/partner/listings` after success; omit null lat/lng so draft saves do not clear pin.

### Stage 200.86 — Listing price currency UX (draft / same-currency / admin)

- **Root cause of «100 THB»:** category draft seeded `Math.max(100)` + `THB`; draft PATCH with `latitude: null` failed `GEO_COORDS_REQUIRED` before price write (pin missing after city select — street text alone was not the gate).
- **Fix:** draft price may be `0`; currency from country; PATCH `requireCoords` only when publishing or body has real coords; wizard currency Select locked to country map; guest/preview same listing currency = L1 × (1+guestFee) without retail FX (`same-currency-guest-display.js`, `CardPriceDisplay`); admin moderation shows L1 asset (not hardcoded ฿).
- Tests: `__tests__/stage200-86-listing-price-currency-ux.test.js`.

### Stage 200.84 — Wizard geo language + street/house → pin

- Nominatim reverse/search: UI `lang` (`Accept-Language` + cache key); catalog city/region labels by UI lang (not hard `label_en`).
- Suggest: optional `viewbox`+`bounded` around city centroid; street+house fields compose query → pin; short `listings.address` line from OSM road/house.
- Partner MapPicker: `partnerPlaceHints` (exact place copy, not guest privacy); seed `RU-IRK`/`irkutsk`.
- SSOT unchanged: codes + lat/lng for search; labels display-only (`lib/geo/nominatim-lang.js`).

### Stage 200.83 — Wizard location UX (professional address flow)

- Region is **derived** (city catalog / pin reverse) — no Select of unrelated launch hubs (IMG_0014: Krasnodar while city=Чита).
- Street field: `WizardStreetTypeahead` → suggest + place pin; district optional (auto from reverse suburb); MapPicker lock UI only after pin.
- Seed: `RU-ZAB` + `chita` (+ synonyms); ops: `node --env-file=.env.local scripts/seed-geo-locations.mjs`.

### Stage 210.71 — Concierge Supply Slice 7.1 (UX polish)

- Admin import: strip LLM \`\`\`json fences; mapping profile dropdown; Drive playbook hint on image warnings.
- Partner: 3-step Concierge checklist; existing-partner ingest → email + `metadata.concierge_welcome_pending` → login redirect `?concierge_welcome=true`; ack clears flag.
- SSOT: `strip-json-fences.js`, `concierge-partner-notify.service.js`.

### Stage 210.7 — Concierge Supply Slice 7 (admin Concierge UI)

- `/admin/concierge` (ADMIN): tabs «Импорт объектов» + «Журнал батчей»; copy LLM prompt; JSON paste → debounced `validate-payload`; preview cards; shadow+claim vs existing partner ingest.
- APIs: `GET …/batches`, `GET …/batches/[id]`, `GET …/partner-search`, `GET …/prompt`; validate response includes normalized `listings`.
- Claim URL in journal: re-issue invite (token not stored); existing partners never get claim (ADR-210).

### Stage 210.6 — Concierge Supply Slice 6 (mapping profiles + validate)

- Registry `lib/services/concierge/mapping-profiles/` — `generic_concierge_v1`, `show_property_v1` (high-season required); seasons/geo/amenities/currency via explicit `rateToThb`.
- `POST|GET /api/v2/admin/concierge/validate-payload` — ADMIN dry-run (no DB); image HEAD probe → warnings; `{ valid, summary }`.
- Ops: [`runbooks/CONCIERGE_AI_EXTRACTOR_PROMPT.md`](./runbooks/CONCIERGE_AI_EXTRACTOR_PROMPT.md) — LLM → ingest JSON.

### Stage 210.5 — Concierge Supply Slice 5 (partner review UX)

- `/partner/listings?concierge_welcome=true` — welcome banner with Concierge draft count; badge `Concierge`; primary CTA «Проверить и опубликовать» → edit.
- Edit wizard: Concierge draft guidance strip; publish still uses listing quality gates (`INACTIVE`+draft → `PENDING`); `metadata.concierge_stage=submitted` on submit.
- API list/detail expose `importPlatform`; SSOT detect: `lib/partner/concierge-listing-ui.js`.

### Stage 210.4 — Concierge Supply Slice 4 (media rehost + Drive playbook)

- `POST /api/v2/admin/concierge/rehost-media` — ADMIN; `{ listingId? | batchId?, force? }`; HTTPS jpeg/png/webp → `listing-images/concierge/{listingId}/{hash}.{ext}`; per-URL errors keep original URL.
- Ingest: `autoRehostMedia` default **true**; Drive folder/view URLs skipped → `batch.metadata.media_warnings`.
- SSOT: `lib/services/concierge/concierge-media.service.js` (+ `uploadExternalImageToStorage` `pathMode: 'concierge'`). Ops: [`runbooks/CONCIERGE_DRIVE_MEDIA_PLAYBOOK.md`](./runbooks/CONCIERGE_DRIVE_MEDIA_PLAYBOOK.md).

### Stage 210.3 — Concierge Supply Slice 3 (claim invites + activation)

- `POST /api/v2/admin/concierge/claim-invites` — ADMIN-only; requires `is_shadow`; stores SHA-256 `token_hash` only; Resend via `sendResendEmail` (+ transport guard); returns `claimUrl` (`/claim?token=`).
- `POST /api/v2/auth/claim-partner` — public; password policy SSOT; RU (`isRussia`) requires phone OTP (`phone` + code, optional `phoneChallengeId`); sets `is_shadow=false` + `shadow_claimed_at`; **does not** set `is_verified`; issues `gostaylo_session`; redirect `/partner/listings?concierge_welcome=true`.
- UI: `/claim` (password + RU OTP; no OAuth). Login allows re-entry for PARTNER with `shadow_claimed_at` while `is_verified` stays false (payout KYC separate).
- SSOT: `lib/services/concierge/concierge-claim.service.js`. Existing verified partners: **ingest only** (no claim invite).

### Stage 210.2 — Concierge Supply Slice 2 (shadow provision + ingest APIs)

- `POST /api/v2/admin/concierge/partners` — ADMIN-only shadow `PARTNER` (`is_shadow=true`); idempotent on existing shadow email; 409 if real account.
- `POST /api/v2/admin/concierge/ingest` — batch + upsert listings (`INACTIVE` + `is_draft` / `concierge_protected` / `imported_draft`), seasons, HTTPS images, optional iCal `sync_settings`; compensating cancel on failure.
- SSOT: `lib/services/concierge/concierge-supply.service.js`; RBAC prefix `/api/v2/admin/concierge` ADMIN-only. No guest UI; no fee/FX mutation; no `listing_status` enum change.

### Stage 210.1 — Concierge Supply Slice 1 (schema + draft GC guard)

- Migration `database/migrations/057_concierge_supply_slice1.sql`: `profiles.is_shadow` / `shadow_claimed_at`; tables `concierge_import_batches`, `partner_claim_invites` (GRANT service_role + RLS admin SELECT / service_role write); `listings.concierge_batch_id`. No `listing_status` enum change.
- Draft GC: `isConciergeProtectedDraft` in `lib/partner/draft-cleanup-policy.js` — skip when `metadata.concierge_protected` or `import_platform` starts with `concierge`; cron selects `import_platform`.
- Policy: ADR-210 Proposed (remaining slices); pointer in `ARCHITECTURAL_DECISIONS.md`.

### Stage 200.82 — M1.1 Push after login (storefront + partner)

- `PushClientInit` mounted in `StorefrontAppShell` + partner layout (chat keeps mount for direct `/messages` entry); idempotent register for same uid+token.
- Permission: `granted` → getToken/register; `denied` → no-op; `default` → **no** auto `requestPermission` — Soft CTA `PushEnableSettingsCard` (settings) + `gostaylo:push-enable` event.
- Logout: `unregisterCurrentWebPushToken` before cookie clear; API `action: unregister` (current device only); clear `gostaylo_fcm_*` storage.
- Soft CTA: `PushEnableSettingsCard` on renter settings + profile + partner settings (gesture-first; no mount auto-prompt).

### Stage 200.81 — PWA install UX (soft snooze + settings + platform buckets)

- Auto banner + sheet share never/snooze/session gates; «Не сейчас» = **5d**; «Не напоминать месяц» = soft **30d** (not forever).
- Manual entry: `PwaInstallSettingsCard` on renter settings + profile **and** partner settings (`openManualPrompt` bypasses auto gates); partner shell mounts `PwaInstallProvider` + chrome.
- Buckets: `android_native` / `android_manual` / `ios_safari` / `ios_other` — sheet copy/steps; standalone shows «Приложение установлено» (Stage 189.36 copy).
- Home banner: CLS-safe `pending` reserve (`md:hidden`); dismiss = short snooze; respects long-snooze.
- Storage keys: canonical **`airento_pwa_*`** with one-shot migrate from legacy **`gostaylo_pwa_*`**.
- Single auto-sheet scheduler in `use-pwa-install` (no double timer).

### Stage 189.37 — Push resume sync after OS permission flip

- **Needed:** 189.36 updated profile UI on focus, but FCM subscribe lived only on Soft CTA / mount — returning from system settings on home (or without re-prompt) could leave `granted` without token.
- `PushClientInit`: `focus` + `visibilitychange` → `shouldSyncPushOnResume` (8s throttle; only if `permission === granted` and no session token) → existing `run({ forceRefresh: true })`. Never re-prompts when `denied`.
- Profile card keeps UI refresh + `PUSH_ENABLE_EVENT` on denied→granted (189.36).

### Stage 189.36 — Profile PWA copy + push settings CTA

- Standalone card (`PwaInstallSettingsCard` via `isStandalone`): «Приложение установлено» / «Вы можете открывать {brand} с домашнего экрана» (no «вкладка» / «открыто как»).
- `PushEnableSettingsCard`: default / granted / denied copy aligned (app closed, not tab); denied → **Открыть настройки** (`lib/push/open-notification-settings.js` Android intent best-effort + platform guide); refresh permission on focus.

### Stage 189.35 — Digital Asset Links for TWA

- `public/.well-known/assetlinks.json`: primary statement **`ru.airento.app`** with historical SHA-256 restored from pre-`9ca405ba`; second statement **`app.airento.shell`** placeholder for future Cap.
- Owner must confirm fingerprint vs upload keystore / Play App Signing (`mobile/android-twa/RELEASE.md` §1 / §7).

### Stage 189.34 — Mobile platforms audit + 2–4w plan (docs only)

- Audit: [`docs/AUDIT_MOBILE_PLATFORMS.md`](./AUDIT_MOBILE_PLATFORMS.md) → archive PWA/TWA/Cap fact pass (DAL SSOT break for TWA; Cap scaffold-only; Stage 189 smoke still WAITING).
- Plan: [`docs/MOBILE_PLATFORMS_PLAN.md`](./MOBILE_PLATFORMS_PLAN.md) — P0 smoke+DAL+AAB; P1 push scope; P2 Cap gated. **No product code in this stage.**

### Stage 189.31 — PWA iOS polish (Home Screen name + tab bar)

- Document / Share / A2HS title: **`getPublicBrandDisplayName()`** → **Airento** (`app/layout.js`, home `generateMetadata`, `app/manifest.js`). Tagline stays in **description** / OG (`Airento — Аренда`), not in `<title>`, so iOS Share no longer shows bare «аренда по всему миру».
- Tab bar: class **`.mobile-bottom-nav-safe`** — full `env(safe-area-inset-bottom)` by default; **iOS standalone only** (`display-mode: standalone` + `-webkit-touch-callout`) trims **16px** (189.33; was 10px in 189.32, 6px in 189.31). Touch targets stay `min-h-12` (≥44px). Android unchanged. Measured `--app-bottom-nav-height` follows ResizeObserver (no double safe-area in shell).
- Listing card EN titles when UI is RU: partner-authored single `listings.title` — no auto-i18n; out of scope for this polish.

### Stage 200.80 — PENDING partner-response SLA (calm deadline copy)

- SSOT: `lib/booking/partner-response-sla.js` (`PARTNER_RESPONSE_SLA_HOURS=24`, `expires_at = created_at + 24h`); cron `cleanup-drafts` imports the same constant.
- Guest next-steps (`PENDING`/`INQUIRY`): calm line — «usually within 24h» + localised «expected by {deadline}» (no live HH:MM:SS ticker); expired copy when past deadline.
- Deadline label formatted after client mount (no TZ hydration mismatch). `UrgencyTimer` remains for short checkout holds only.

### Stage 200.79 — Instant×iCal hybrid guard + checkout trust + soft-hold audit

- Instant Book without enabled iCal requires metadata `exclusive_manual_calendar` ack (wizard checkbox); save gated.
- Cron `ical-sync`: partner feed errors → `instant_booking=false` + partner TG; platform write errors → system alert. Policy helpers: `lib/ical/instant-booking-ical-policy.js`; breaker: `instant-booking-ical-guard.js`. Audit: `docs/runbooks/SOFT_HOLD_TIMER_AUDIT.md`.
- Checkout: `CheckoutTrustBlock` above payment methods (escrow / receipt / refund link).

### Stage 200.78 — P0 booking funnel UX (no payment-core change)

- Guest next-steps: `CONFIRMED` → `showPay: true` + my-bookings allowlist; OrderCard hides duplicate Pay when next-steps owns it.
- Partner listing wizard Step Pricing: Instant Book toggle → `instant_booking` (default false).
- `BOOKING_CONFIRMED`: guest FCM `link=/checkout/{id}` + TG inline Pay button when `isBookingPayable`.
- Checkout UI default selected method **MIR**; options order MIR → CARD → CRYPTO (groups unchanged RU-first).

### Stage 200.77 — Invoice checkout honesty + payable/notify hardening

- Invoice checkout lines: `buildInvoiceGuestBreakdown` — SSOT total = `invoice.amount`; nights/description context; cleaning/deposit only if present on invoice and sum cleanly; **no** platform fee line; **no** invented nightly rate.
- PDP post-inquiry Pay CTA: `isBookingPayable` (`CONFIRMED` | `AWAITING_PAYMENT`), same as chat/my-bookings.
- `PAYMENT_RECEIVED`: claim → dispatch → `payment_received_at`; clear claim on hard fail so reconcile can retry.

### Stage 200.76 — Checkout payment UX (crypto SSOT + return/TXID poll)

- Crypto modal: display amount from initiate `metadata.amount_usdt` (not live FX); wallet from `metadata.wallet_address`; copy amount + safer clipboard.
- Acquirer return (`?payment=return`): Strict Mode–safe poll; window ~2 min (`MAX_POLLS=48`).
- After submit-TXID: client polls booking until `PAID_ESCROW` then success screen.

### Stage 200.75 — Pre-launch hardening (crypto wallet, shells, acquiring timeouts)

- Crypto receive wallet: `getCryptoReceiveWallet()` / `assertCryptoReceiveWalletConfigured()` — no hardcoded prod fallback; boot check in `instrumentation.js`; `payment-intent` CRYPTO payload uses same SSOT.
- Root UI: `app/not-found.js`, `app/error.js`, `app/global-error.js`, `app/(storefront)/checkout/error.js` — no stack traces to users.
- Acquiring: YooKassa / Mandarin / CARD_INTL create-session `AbortSignal.timeout(10000)` with timeout/network error codes.

### Stage 200.74 — Notification registry hygiene & email HTML escaping

- Registry: wire `USER_WELCOME`, `PARTNER_VERIFIED`/`PARTNER_REJECTED`, `CHECK_IN_CONFIRMED`, `PAYMENT_SUBMITTED`, `DRAFT_DIGEST_REMINDER`; mark `PAYMENT_SUCCESS`/`PAYMENT_CONFIRMED`/`PAYOUT_REJECTED` as `intentionallyDead`.
- Plain→HTML: `textToHtml` escapes every line; auth forgot-password / register HTML escape brand + name; chat message TG HTML escaped.
- Outbox: `NOTIFICATION_OUTBOX=1` → JSON-serializable enqueue (`notification_outbox`) + sync fallback; drain restores `correlation_id` via `process-notification-outbox.js`.

### Stage 200.73 — Guest i18n SSOT (checkout credits + PDP booking)

- Checkout platform credits: `checkout_credits*` keys (not crypto `checkout_wallet*`); no mixed RU/EN hardcode in `CheckoutSummary`.
- Ask-in-chat: `listingDetail_askPartnerChat` + `{provider*}` via `getGuestBookingLabelPlaceholders` (EN/ZH/TH templates fixed); continue chat → `listingDetail_continueChat`; unavailable dates use same ask key (no «хозяин» hardcode).
- Booking widgets: RU/EN ternaries → `getUIText` (availability, spots, duration discount, chat preview, reviews empty/count, yacht/tour titles).
- `applyGuestBookingLabelPlaceholders` also runs when only `wizardProfile` is set.

### Stage 200.72 — Resend guard & check-in / emergency honesty

- Auth register / forgot-password and admin partners email: only `EmailService.sendEmail` (resend-transport-guard); no raw `api.resend.com` fetch.
- Emergency SMS: `sendEmergencySMS` → `dispatchSms`; returns `smsSent` / `ops_fallback` (push + admin Telegram); never claims SMS sent on miss/unconfigured.
- Check-in confirm: `fundsReleased: false`, `escrowHeld: true`; CHECK_IN_CONFIRMED email/TG/admin copy — funds remain in escrow (thaw notify stays on PARTNER_FUNDS_THAWED).

### Stage 200.71 — SEO soft-404 & apex canonical

- PDP `bootstrap.kind === 'not_found'` → `notFound()` (HTTP 404); `buildListingNotFoundOgMetadata` → `robots: { index: false, follow: false }` (moderation stub unchanged; no `notFound` on moderation / PENDING+crawler).
- Canonical apex via `getPublicSiteUrl()`: home `generateMetadata` on `app/(storefront)/page.js` only; PDP `alternates.canonical` in `buildListingDetailOgMetadata`.
- `app/sitemap.ts` / `app/robots.ts`: origin only `getPublicSiteUrl()`; robots disallow adds `/auth`, `/my-bookings` (plus existing private zones).

### Stage 200.70 — Acquiring fail-closed & Mandarin parity

- `verifyWebhookPaidAmount`: paid path fail-closed on missing amount (`AMOUNT_MISSING` → HTTP 400); no `{ skipped: true }` by default.
- CARD_INTL webhook: `getMandarinPayment` + metadata/amount verify before `markPaid` (`lib/payments/mandarin.js`); smoke `smoke-md-*`; mock bypass when unconfigured + `allowMockAcquiringSessions`; rollback `MANDARIN_PAYMENT_VERIFY=0`.
- Mandarin createSession: stable Idempotency-Key `pi-{intentId}` persisted as `metadata.mandarin_idempotency_key` (no `randomUUID` per attempt).

### Stage 200.69 — Crypto settle SSOT & idempotency

- SSOT: `lib/payment/settle-crypto-payment.js` — PENDING/CONFIRMED heal + intent `markPaid` → `moveToEscrow` (ledger RPC unchanged).
- `POST /api/v2/payments/verify-tron`: amount via `getExpectedUsdtForBooking` when `bookingId` present (ignore client USDT); intent-primary settle (no `no_pending_payment` dead-end); same-booking replay → 200 + `idempotent`.
- `POST /api/webhooks/crypto/confirm`: booking escrowed check before replay; same-booking heal → 2xx; cross-booking txid → still 409; prod secret **header-only** (`isProductionPaymentEnvironment`).

### Stage 200.68 — PWA edge micro-fixes

- Chat send haptic: `success` / `afterOutbound` only when `sendMessageText` returns a message; `error` on `null`/throw.
- `/messages` PTR: `enabled: isMobile && Boolean(inboxScrollEl)` — no document/window touch bind before list scroller mounts.

### Stage 200.67 — PWA native haptic + pull-to-refresh

- Hooks (SSR-safe): `hooks/use-haptic.js` (`navigator.vibrate` presets light/medium/success/error), `hooks/use-pull-to-refresh.js` (mobile `<sm` only; threshold 70px; window or scroll container).
- Haptic: admin moderation approve/reject; partner booking approve/decline; checkout pay initiate + confirm success/fail; chat text send.
- Pull-to-refresh: `/my-bookings`, `/messages` (inbox list scroller), `/admin/moderation` — silent reload, no desktop layout impact (`sm:hidden` indicator).

### Stage 200.65 — Storefront redirect debt (Wave 6)

- Paths: `/dashboard` (role router → `/admin` | `/partner/dashboard` | `/renter/dashboard` | login; `LoadingPageShell` while resolving `/api/v2/auth/me`), `/dashboard/renter` → server `redirect('/renter/dashboard')`.
- No auth/API contract changes — polish loaders + inventory close-out.
- Inventory: [`PRODUCT_UI_INVENTORY.md`](./PRODUCT_UI_INVENTORY.md) v1.13.0 — **116/116 (100% Finished)**.

### Stage 200.64 — Admin Wave 5F mobile-flat (system / security / compliance)

- Paths: `/admin/system` (+ ai / ical / ical/logs), `/admin/ai-usage`, `/admin/security`, `/admin/health`, `/admin/marketplace-health`, `/admin/audit`, `/admin/audit-export`, `/admin/privacy/erasure`, `/admin/settings`, `/admin/settings/legal`. Exclude `/admin/test-db`.
- SSOT: `MOBILE_FLAT_*`; iCal logs / security violators / cities / audit / erasure / legal consents: mobile cards + desktop tables; touch `min-h-[44px]` on Sync / Export / Erasure / Save / ban·strike / publish.
- Layout/Tailwind only — no iCal sync, AI telemetry, security ban, GDPR, or fee/settlement/FX body changes.
- Inventory: [`PRODUCT_UI_INVENTORY.md`](./PRODUCT_UI_INVENTORY.md) v1.12.0. Admin panel mobile-flat waves **closed** (5A–5F).

### Stage 200.63 — Admin Wave 5E-2 mobile-flat (marketing admin remainder)

- Paths: `/admin/marketing/analytics`, `/budget`, `/referral-payouts` (+ `/payouts` redirect), `/fraud-queue`, `/roi` (+ `[campaignSlug]`), `/audit`, `/wallet-audit`.
- SSOT: `MOBILE_FLAT_*`; fraud/payout/audit/wallet/analytics/ROI tables: mobile cards + desktop tables; touch `min-h-[44px]`; fraud labels Одобр./Блок/Флаг.
- Layout/Tailwind only — no marketing API, fetch, PATCH, payout/fraud/wallet math changes.
- Inventory: [`PRODUCT_UI_INVENTORY.md`](./PRODUCT_UI_INVENTORY.md) v1.11.0. Next → Admin Wave **5F** (§4.4).

### Stage 200.62 — Admin Wave 5E-1 mobile-flat (marketing admin core)

- Paths: `/admin/marketing`, `/promos`, `/campaigns` (+ `[slug]`), `/rules`, `/reward-rules`, `/settings`, `/attribution` (+ shared marketing layout/SubNav).
- SSOT: `MOBILE_FLAT_*`; campaigns/rules/attribution/detail tabs: mobile cards + desktop tables; touch `min-h-[44px]`.
- Layout/Tailwind only — no marketing API, fetch, PATCH, validation, or ROI math changes.
- Inventory: [`PRODUCT_UI_INVENTORY.md`](./PRODUCT_UI_INVENTORY.md) v1.10.0. Next → Admin Wave **5E-2** (analytics/budget/payouts/fraud/roi/audit) or system.

### Stage 200.61 — Admin Wave 5D mobile-flat (content & support ops)

- Paths: `/admin/categories`, `/admin/locations/suggestions`, `/admin/messages`, `/admin/messages/[id]`.
- SSOT: `MOBILE_FLAT_*`; locations table↔cards; category tree soft-flat on `&lt;sm`; staff chat sidebar/composer touch + safe-area (lg+ chrome kept).
- No category / geo / chat API or handler changes.
- Inventory: [`PRODUCT_UI_INVENTORY.md`](./PRODUCT_UI_INVENTORY.md) v1.9.0. Next → Admin marketing / system.

### Stage 200.60 — Admin Wave 5C mobile-flat (FinTech, escrow & payouts)

- Paths: `/admin/finances`, `/admin/financial-health`, `/admin/finance/intelligence` (+ booking P&L), `/admin/payout-methods`, `/admin/payout-verification`, `/admin/settings/finances` (batches panel).
- Aliases: no `/admin/payout-batches` or `/admin/escrow` pages — batches = FinTech `pools` tab; escrow aging = Intelligence widgets.
- SSOT: `MOBILE_FLAT_*`; verification + P&L referral/ledger: mobile cards + desktop tables; touch `min-h-[44px]`.
- No payment/ledger/escrow/batch settle API or formula changes.
- Inventory: [`PRODUCT_UI_INVENTORY.md`](./PRODUCT_UI_INVENTORY.md) v1.8.0. Next → Admin marketing / categories / system.

### Stage 200.59 — Admin Wave 5B mobile-flat (people & cases)

- Paths: `/admin/users`, `/admin/users/[id]`, `/admin/partners`, `/admin/partners/[id]`, `/admin/disputes`, `/admin/reviews`, `/admin/waitlist`.
- Disputes / waitlist / reviews: mobile card stack + desktop table (`sm` breakpoint). Touch `min-h-[44px]`; partner Approve/Reject full-width on max-sm.
- No role/KYC/escrow/moderation API logic changes. Deferred: categories, locations, messages thread.
- Inventory: [`PRODUCT_UI_INVENTORY.md`](./PRODUCT_UI_INVENTORY.md) v1.7.0. Next → Admin 5C or FinTech.

### Stage 200.58 — Admin Wave 5A mobile-flat (core ops)

- Paths: `/admin`, `/admin/dashboard`, `/admin/moderation` (listings alias — no `/admin/listings`), `/admin/bookings`, `/admin/bookings/[id]`.
- SSOT: `MOBILE_FLAT_*` (+ bundle alias `MOBILE_FLAT_CANVAS`); max-sm flat cards; **sm+** dense chrome/tables kept.
- Bookings detail: emergency events — mobile card stack + desktop `Table`. Touch `min-h-[44px]`; Approve/Reject full-width on queue.
- No admin API / moderation / emergency-action logic changes.
- Inventory: [`PRODUCT_UI_INVENTORY.md`](./PRODUCT_UI_INVENTORY.md) v1.6.0. Next → Admin 5B (users/partners/…).

### Stage 200.57 — Auth Wave 4 mobile-flat

- Paths: `/auth/*`, `/reset-password`, marketing `/about*`, `/help*`, `/terms`, `/legal/*` (+ `/login` redirect).
- SSOT: `AuthPageShell` + `LegalDocShell` + page-local `MOBILE_FLAT_*` — max-sm flat canvas; **sm+** elevated cards unchanged.
- Nested soft-flat: legal consent insets, link-conflict OTP panel, loyalty/referral/help FAQ shells.
- **No** auth/session/API contract changes. Demo `/demo/price-breakdown`, `/test-db` excluded.
- Inventory: [`PRODUCT_UI_INVENTORY.md`](./PRODUCT_UI_INVENTORY.md) v1.5.0. Next → Admin.

### Stage 200.56 — Chat Wave 3 mobile-flat

- Paths: `/messages`, `/messages/archived`, `/messages/[id]` (+ `/chat/[id]` redirect).
- SSOT: `MOBILE_FLAT_SHELL_CARD` / `MOBILE_FLAT_CARD_*` — hall edge-to-edge on `&lt;sm`; `sm+` card chrome; **lg+** two-column in `ChatThreadChrome` unchanged.
- Soften sticky/header glass shadows on max-sm; `DealDetailsCard` flat in mobile sheet nesting.
- **Kept:** bubbles, composer capsules, VoiceRecorder/QuickReplies, `ThreadDealDetailsSheet`, `CHAT_COMPOSER_SHELL_CLASS` / `pb-safe-chat-composer`. No API/transport changes.
- Inventory: [`PRODUCT_UI_INVENTORY.md`](./PRODUCT_UI_INVENTORY.md) v1.4.0. Next → Auth & marketing.

### Stage 200.53.3 — Partner calendar bulk SoT (read path)

- New SSOT raw loader: `lib/services/calendar/partner-calendar-bulk-load.js` → `loadPartnerCalendarRaw` — **3 DB queries** for N listings (bookings / calendar_blocks / seasonal_prices), Maps by `listing_id`.
- `GET /api/v2/partner/calendar`: listings + promos as before → bulk raw → in-memory `buildCalendar` + `mapPartnerCalendarGridRow`. Response DTO unchanged. `maxDuration=60`. No `getCalendarForDateRange` in this route.
- Guest/public single-listing still uses `getCalendarForDateRange` (unchanged).
- **Backlog (not this Stage):** light heatmap DTO for overview, HTTP/CDN cache by partner+range, force `listingId` / page when N large.

### Stage 200.53.2 — Partner calendar performance quick wins

- **API** `GET /api/v2/partner/calendar`: `maxDuration=60`; parallel `CalendarService` builds (`runWithConcurrency` ×5); pass `listingRow` + category slug (skip re-fetch); range-filter `seasonal_prices`.
- **Client**: mobile `daysToShow` init 10 (no 30→10 double fetch); soft retry (no stack on 504); month prefetch after near; month/overview `rangePending` cell skeleton while cached `dates` don’t cover requested window.
- **Next (200.53.3+ / bulk SoT):** one bulk bookings+blocks+seasonal query for all listing IDs; light heatmap DTO for overview; progressive per-listing hydrate; HTTP cache keyed by partner+range; cap/page listings on mobile month when N large.

### Stage 200.55 — Guest Wave 2B mobile-flat (Guest Secondary)

- Paths: `/renter/favorites`, `/renter/dashboard|profile|settings`, `/renter/reviews/new`, `/profile` (+ wallet/status/referral), `/settings`, `/u/[id]`, `/partner-application-success`.
- Redirects (no visual): `/bookings/[id]`, `/go/[vanity]`, `/renter`.
- SSOT: `MOBILE_FLAT_*` — nesting ≤1 on `&lt;sm`; `sm+` unchanged; no API/business logic.
- **Kept isolation:** `ListingCard` on favorites, sticky withdraw, `ReferralMarketingKit` export canvases, ReviewModal, review list tiles on `/u`.
- Inventory: [`PRODUCT_UI_INVENTORY.md`](./PRODUCT_UI_INVENTORY.md) v1.3.0. Next wave → Chat (`/messages*`).

### Stage 200.54 — Guest Wave 2A mobile-flat (Core Guest Path)

- Paths: `/`, `/listings`, `/listings/[id]`, `/checkout/[bookingId]`, `/my-bookings` (+ `/renter/bookings` redirect).
- SSOT: `MOBILE_FLAT_*` — nesting ≤1 on `&lt;sm`; `sm+` unchanged.
- Flattened: home/catalog banners, PDP host/reviews/policies/mobile date card, checkout PaymentMethods/Summary/StateViews, my-bookings login + shared `StorefrontStateView` / `WorkspaceEmptyState`.
- **Kept isolation:** `listing-card` / rails, sticky booking + pay bars, checkout price summary, escrow alerts, `UnifiedOrderCard`.
- Inventory: [`PRODUCT_UI_INVENTORY.md`](./PRODUCT_UI_INVENTORY.md).

### Stage 200.53.1 — Partner calendar: month/overview without full-page reload

- Root cause: pane switch changed date range → new React Query key → `isLoading` true → entire page replaced by `LoadingPageShell` (felt like “кнопка не работает”). Not caused by mobile-flat CSS.
- Fix: `keepPreviousData` in `usePartnerCalendar`; full-page spinner only on `isInitialLoading`; sync `startDate` in pane handler (one fetch); subtle inline refresh while `isFetching`.

### Stage 200.53 — Partner Hub mobile-flat (Wave 1) — **accepted**

- Inventory: all **14** Partner Hub routes Finished (2 redirects + 10 visual + 2 wizard from 200.52) — [`PRODUCT_UI_INVENTORY.md`](./PRODUCT_UI_INVENTORY.md).
- SSOT: `lib/ui/mobile-flat-canvas.js` — canonical **`MOBILE_FLAT_*`** (aliases `WIZARD_MOBILE_FLAT_*`).
- Surfaces: dashboard, listings, calendar (+ education `calendar-page`, mobile panes), bookings (+ OrdersSummary / rows), reviews, finances (+ tab cards / ledger rows), payout-profiles, promo, settings, guest-review.
- Rule: nesting ≤1 on `&lt;sm`; `sm+` cards preserved; isolation OK for alerts, map/day cells, sheets; no API/business logic.

### Stage 200.52 — Wizard mobile flat canvas (Phase 1 + 1.5 + 2) — **accepted**

- Design brief: nesting depth ≤1 on `&lt;sm`; Option B clean canvas; section numbers kept.
- SSOT tokens: `lib/ui/mobile-flat-canvas.js` (re-exported from `wizard-step-layout.js`).
- **Phase 1:** `ListingWizardPageInner` shell + `StepGeneralInfo`.
- **Phase 1.5:** step-1 tail — `StepCalendarSection`, `CalendarSyncManager`, `AvailabilityCalendar`, `SeasonalPriceManager`.
- **Phase 2:** steps 2–5 — `StepLocation`, `StepPricing`, `StepPhotos`, `StepPreview` + wizard helpers. Kept as single isolation: pin-conflict, map, earnings calculator, upload zone, moderation/checklist. `sm+` cards unchanged.

### Stage 200.51 — Wizard geo cascade: camera follows, pin is intentional

- **SSOT** `lib/geo/wizard-geo-cascade-reset.js` — same path for **create and edit** (`StepLocation` only).
- Country / region / city change: clear dependents (city/district/address) + **clear listing pin**; never auto-write capital/city centroid as `lat/lng`.
- UI `mapCenter` flies to country/city centroid separately (viewport only).
- Partner places pin on map after cascade → `handleMapSelect` / `wizard-geo-from-pin` (anti-coerce).
- Tests: `__tests__/stage200-51-wizard-geo-cascade-reset.test.js`.

### Stage 200.50 — Wizard mobile layout (Location / action bar)

- Mobile bottom bar: icon-only Back + Preview (44×44), full **Next** label — no mid-word truncate (`Наз…` / `Посмотре…`).
- Blockers tip moved into step card (`ListingWizardMobileBlockers`); fixed bar height stays `4.5rem`.
- Pin↔country conflict: full-width stacked CTAs (incl. dismiss as outline button); icon+text row then actions — no Alert `pl-7` offset that left-shifted buttons.

### Stage 200.49 — Wizard preview: L1 asset → THB before guest FX

- Bug: form `basePriceThb` holds L1 asset (EUR/RUB/USD/…); preview treated it as THB → header RUB e.g. ₽4.4k for €1500 or ₽12.4k for ₽4200 (`asset × retail as if THB`).
- Partner list L1 (asset) was already correct; DB `base_price_thb` canon OK — only guest **preview** path was wrong for **all** non-THB L1.
- Fix: `computeWizardStorefrontPricePreview` converts asset→THB via **mid** rateMap, then guest fee; card uses that THB + **retail** header FX.
- Wizard loads mid + retail (`useListingWizardState`); StepPricing Select = full `LISTING_BASE_CURRENCIES`; load prefers `base_price_asset.currency`.
- Test: `__tests__/wizard-storefront-price-preview.test.js` (EUR + RUB + USD).

### Stage 200.41 — Partner calendar 3-month overview

- Mobile pane **3 мес.**: occupancy heatmap (free/booked/blocked), no prices; open month (44px) → Month editor.
- One listing at a time in overview; arrows shift the 3-month window.

### Stage 200.40 — Partner mobile calendar UX

- Modes: **Near term** (10-day agenda) vs real **Month grid** (`CalendarMobileMonthGrid`); month nav + jump via `<input type="month">`.
- Options sheet: `pr-16` clearance for close; Block label wraps (no truncate).
- Agenda promo: compact badge + detail sheet (no tall box per day).

### Stage 200.39 — Geo UX polish (catalog seamlessness)

- Catalog map: on where change pan to geo centroid first, then fit new pins (no stale-viewport stick).
- «Search this area» / clear bounds → `commitToUrl` bbox params (share/refresh).
- Listing/order/partner location labels: sync seed + `GET /api/v2/geo/listing-label` enrich; no raw `city_code` on cards.
- SEO place strings + legacy titlesRu/En: worldwide / `{where}` (no Phuket default).
- Legacy infer: Phuket force only with district canon (not bbox alone).

### Stage 200.38 — Delete country-presets SSOT

- Removed `lib/geo/country-presets.js`. Sync helpers use `LAUNCH_GEO_SEED` / `lib/geo/launch-geo-index.js`; runtime SSOT = `geo_locations` + GeoService.
- Write snapshot (`resolve-listing-geo-snapshot`) rewritten without presets; fiscal currency stays in `listing-asset-currency` + `COUNTRY_CURRENCY_TZ`.
- Suggest alias index / synonyms targets / merge validation / partner location line — no presets.
- Removed empty `DISTRICTS_BY_CITY`; `COUNTRY_MAP_CENTERS` already gone (200.37).

### Stage 200.37 — Catalog search / map / display → geo_locations SSOT

- `resolveWhereTarget` + `buildSmartWhereOrClause`: synonyms → labels → codes; umbrella via `geo_locations.parent_code` (no `DISTRICTS_BY_CITY`).
- Suggest: `location-suggest` / alias merge = `geo_locations` + `geo_synonyms` (presets not seeded into suggest index).
- Catalog map: `useWhereGeoViewport` → `GET /api/v2/geo/resolve-where` centroids; default `[20,100]`; no hardcoded Phuket / `COUNTRY_MAP_CENTERS`.
- Display/SEO/TrustBar: `geo-display-label` + resolve-where labels; guest cards no invented Phuket.
- Write path: `resolve-listing-geo-snapshot` pass-through codes (seed fill parents); fiscal/env separate from geo.

### Stage 200.48 — Wizard Location geo e2e (plan Stage 6)

- Playwright project `wizard-geo-location` → `tests/e2e/wizard-geo-location.spec.ts` (partner auth).
- DE: create `[E2E_TEST_DATA]` draft → Location typeahead country/city/district + map pin → assert EUR + save fields.
- TH/RU FX strip regression; mobile typeahead touch ≥44px (JP→JPY).
- UI hooks: `wizard-country-typeahead`, `wizard-city-typeahead`, `wizard-geo-fx-strip`, `wizard-district-input`.
- Optimistic country select (no wait on `ensure-country`); `getCountryMapViewportCentroid` for non-seed map re-center.
- GET `/api/v2/partner/listings/[id]` + wizard load include `country/region/city` codes (round-trip FX).
- Wiring unit: `__tests__/stage200-48-wizard-geo-e2e-wiring.test.js`. Run: `npx playwright test --project=wizard-geo-location`.

### Stage 200.47 — Non-launch L1 currency + provisional visibility

- **Currency map:** `COUNTRY_LISTING_BASE_CURRENCY` (DE→EUR, GB→GBP, CN→CNY, JP→JPY, …); unknown ISO → **USD** (was THB). Allowlist `LISTING_BASE_CURRENCIES` expanded for those L1 codes (ledger still THB mid).
- Mirrors: `COUNTRY_CURRENCY_TZ`, `COUNTRY_TZ_MAP` defaults; `GeoService.getCurrencyAndTimezone` uses map + USD.
- **Provisional:** `upsertProvisionalLocation` always writes centroid when lat/lng; TZ via `resolveListingPlaceTimezone`; reuse path backfills centroid/TZ. Labels normalized en+ru.
- **Display:** `geo-display-label` uses `getIsoCountryLabel` when launch seed missing (no Phuket invent).
- **Part C audit:** `resolve-where` / locations read filter `is_active` only — **do not** exclude `is_auto_imported` (provisional cities already searchable by code/label). Soft non-launch banner unchanged.
- Tests: `__tests__/stage200-47-non-launch-currency-provisional.test.js`.

### Stage 200.46 — Pin ↔ country conflict + city blur commit

- Detect: `lib/geo/wizard-pin-country-conflict.js` (`detectPinCountryConflict`, `clearWizardFormPin`); policy `warn_block_next`.
- `StepLocation`: amber banner + 3 CTAs (keep country/clear pin, update from map, dismiss); Next blocked via `wizardBlocker_pinCountryConflict`.
- `WizardCityTypeahead`: blur / Enter commits manual city (or exact suggest match); empty blur clears via `onClear`.
- Pin merge stores `metadata.geo_pin_country`; paste/suggest pass `regionCode` / `cityCode` into `mergeWizardFormGeoFromPin`.
- Tests: `__tests__/stage200-46-pin-country-conflict.test.js`.

### Stage 200.45 — Wizard country/city typeahead (ISO + suggest)

- Country: ISO-3166 typeahead (`i18n-iso-countries` + DB country rows) via `WizardCountryTypeahead`; select calls `POST /api/v2/partner/geo/ensure-country` so `assertListingGeoCodes` FK passes for non-seed markets.
- City: `WizardCityTypeahead` → `GET /api/v2/geocode/suggest?country=XX`; manual label → provisional on save; `normalizeGeoPlaceName` / `normalizeGeoPlaceKey` reduce duplicates.
- Soft non-launch banner kept; optional region Select only when catalog children exist.
- Place TZ / country currency (200.44) + `mergeWizardFormGeoFromPin` unchanged as write SSOT.
- Tests: `__tests__/stage200-45-wizard-geo-typeahead.test.js`.

### Stage 200.44 — Listing place timezone + country currency (wizard write)

- **Currency** remains **country-scoped** (ADR-181 / `getDefaultListingBaseCurrency`).
- **IANA TZ** write path: **pin lat/lon** (offline `tz-lookup` via `guessIanaTimezoneFromLatLon`) → catalog city/region TZ → country default. Country-row TZ from reverse must not override a pin.
- SSOT helpers: `lib/geo/listing-timezone-guess.js` (`resolveListingPlaceTimezone`), wired in `wizard-geo-from-pin.js` + `StepLocation` country/city handlers and FX strip.
- Chose `tz-lookup` over `geo-tz` v8 (mis-maps Thailand hubs to `Asia/Jakarta`).
- Runtime read SSOT unchanged: `listings.metadata.timezone` → `resolveListingTimeZoneFromMetadata` (calendar / bookings).
- Tests: `__tests__/stage200-44-listing-place-timezone.test.js`.

### Stage 200.43 — Location step cascade-first UX

- Wizard `StepLocation` layout: **Country → Region → City → District → Address** first; optional paste-address suggest (collapsed); MapPicker last to refine pin.
- Geo APIs / anti-coerce / provisional city / currency-TZ readonly unchanged (Stage 200.36). **TZ/currency write priority updated in 200.44.**

### Stage 200.36 — Map-first Location step (anti-coerce)

- Wizard `StepLocation`: address suggest (`/api/v2/geocode/suggest` → GeoService catalog + Nominatim) + MapPicker + cascade from `GET /api/v2/geo/locations`; no `country-presets` as primary; map default `[20,100]` / geo centroids. **UX order updated in 200.43** (cascade primary).
- Anti-coerce: unknown city → empty `city_code` + `city_label` + provisional upsert on save (`POST /api/v2/partner/geo/provisional`); never `regions[0]` / Moscow.
- Partner listing POST/PATCH: `assertListingGeoCodes` — `country_code` must exist in `geo_locations`; publish requires lat/lng.

### Stage 200.35 — Geo foundation (ADR-200.35)

- Additive `geo_locations` columns: centroid/bbox, timezone, currency_code, country_code, osm_*, is_active, is_auto_imported; level += `neighborhood`.
- `nominatim_cache` (service_role, RLS, TTL 7d). Geocode routes → **`GeoService`** only (no direct Nominatim).
- Static launch seed (`lib/geo/launch-markets-seed-data.js` + `scripts/seed-geo-locations.mjs`) — **not** Nominatim bulk (OSM ToS).
- Rejected from draft TZ: rename label→name / parent_id, listings lat/country NOT NULL (legacy nulls), recreate geo_synonyms FK, delete presets in same PR.
- Docs: `docs/ADR/200-35-geo-foundation.md`. Tests: `__tests__/stage200-35-geo-foundation.test.js`.

### Stage 200.34 — Wizard: remove Airbnb quick-import UI

- Removed «Быстрый старт: импорт с Airbnb» from Step 1 (`PartnerListingImportBlock` + wizard merge wiring).
- Apify preview API (`/api/v2/partner/listings/import/airbnb-preview`) left dormant for cleanup; not linked from UI.
- Location cascade: DB `geo_locations` via wizard APIs (Stage 200.36+); presets removed in 200.38.

### Stage 200.33 — Seasonal prices L1 asset → THB (ADR-181 Wave 5.2)

- Partner enters seasonal `priceDaily` / `priceMonthly` in listing **base_currency**; `upsertPartnerSeasonalPrice` converts mid → `seasonal_prices.price_*` THB ledger.
- Snapshot in `seasonal_prices.metadata.price_daily_asset` (migration `stage200_33_seasonal_price_asset_metadata.sql`); GET/wizard load returns asset amounts for edit.
- Calendar/Pricing unchanged (still read THB nights).
- Tests: `__tests__/listing-seasonal-price-canon.test.js`.

### Stage 200.32 — Partner L1 currency display (ADR-181)

- Partner list normalize kept dropping `baseCurrency` / `basePriceAsset` → UI always labeled ledger THB as primary.
- Card primary = **asset amount + listing currency** (`metadata.base_price_asset`); secondary ≈ header mid FX from THB ledger only when currencies differ.
- Wizard seasonal labels: `{{unit}}` (no hardcoded `฿`); DayPicker mobile width fix.
- Partner calendar API returns `baseCurrency` + `basePriceAsset`.
- Tests: `__tests__/stage200-32-partner-listing-currency-display.test.js`.

### Stage 200.31 — Map pan/zoom UX (wizard + PDP)

- Pin **lock** no longer disables map pan/pinch/wheel — only click-to-place and marker drag.
- `MapGestureSync` calls Leaflet `enable()`/`disable()` (MapContainer props alone do not update after mount).
- Wizard `cooperativeTouch="auto"` (coarse pointers only); desktop gets gestures immediately.
- Tests: `__tests__/stage200-31-map-gestures.test.js`.

### Stage 200.30 — Wizard pin → country / TZ / asset currency SSOT

- Map pin and address geocode update **country → region → city**, IANA timezone, and `baseCurrency` (ADR-181) via `lib/geo/wizard-geo-from-pin.js`.
- Reverse geocode returns `countryCode` + `address`; MapPicker passes them to the wizard.
- Header UI language/currency stays independent of listing geo (storefront preference ≠ asset geo).
- Quiet-hours / fair SLA (`AvailabilityService.resolveListingIanaTimezone`) uses the same **`resolveListingTimeZoneFromMetadata`** as calendar (not env-only fallback).
- Soft-heal: opening location step with a pin that disagrees with country cascade re-syncs geo.
- Tests: `__tests__/wizard-geo-from-pin.test.js`.

### Stage 200.29 — Wizard field highlight + 1 photo

- Full publish photos = soft **1** (was briefly 2).
- Required empty fields: red ring + inline tip; Next click when blocked → toast + scroll to first `data-wizard-field`.
- Tests: `__tests__/stage200-28-wizard-quality-ux.test.js` (200.29 asserts).

### Stage 200.28 — Wizard quality UX (vertical health + step hints)
- Listing health score is **profile-aware**: transport → vehicle features + pickup (no «house rules» / stay amenities).
- Disabled Next shows amber **step blockers** (`computeWizardStepBlockers` + `WizardStepBlockersHint`).
- Checklist metadata fields use human labels (`fieldVehicleYear`, …); coordinates copy is universal.
- Tests: `__tests__/stage200-28-wizard-quality-ux.test.js`, updated `__tests__/listing-health-score.test.js`.

### Stage 200.27 — Wizard currency labels + map viewport

- Price step labels: no hardcoded `฿`/THB — `getCurrencySymbol(baseCurrency)` + i18n `{{unit}}` / `{{currency}}` (`lib/currency.js` SSOT).
- MapPicker: restore fixed **px** map height (wrapper `%` collapsed Leaflet); country default centers; country→timezone via `defaultTimezoneForCountryCode`; RU pin → `Europe/Moscow`.
- Tests: `__tests__/stage200-27-wizard-currency-map.test.js`.

### Stage 200.26 — Moderation edit + wizard step scroll

- PATCH `/api/admin/moderation` `action: 'update'` (PENDING only): title, description, district, `basePriceThb` without status change; same fields also applied on approve.
- Moderation detail: «Править объявление» + «Сохранить правки»; photos still partner-side.
- Listing wizard: on `currentStep` change scroll workspace `[data-workspace-scroll]` (+ window) to top.
- Tests: `__tests__/stage200-26-admin-moderation-edit-wizard-scroll.test.js`.

### Stage 200.25 — Admin UX P2 (RU shell)

- Admin menu EN leftovers → RU (`Dashboard`→`Обзор`, Waitlist, Marketplace Health, System Health, Audit, Advanced…).
- Dashboard hub + chrome labels RU; moderation category labels via `resolveCategoryDisplayName`.
- Tests: `__tests__/stage200-25-admin-ux-p2.test.js`.

### Stage 200.24 — Admin UX P0/P1 (moderation + mobile nav)

- Mobile sidebar: backdrop **inside** `WORKSPACE_FRAME` + `max-lg:backdrop-blur-none` (partner pattern) — fixes blurred burger menu.
- Moderation detail: `sm:max-w-4xl`, scrollable body + sticky footer CTAs; RU labels (Одобрить / Отклонить / На проверке); edit-text hint (saves on approve).
- Tests: `__tests__/stage200-24-admin-ux-p0.test.js`.

### Stage 200.23 — Listing wizard P2 (soft publish + AI translate)

- Soft publish: `validateListingSoftPublishQuality` (1 photo / desc≥40 / price / district); PATCH `softPublish` → **PENDING** + `quality_incomplete`; wizard secondary CTA when soft OK && !full.
- Step Next uses soft minima; full checklist still gates primary Publish.
- Explicit **Translate (AI)** CTA → `generate-description` `mode: 'translate'`.
- Partner list: Incomplete badge for soft/PENDING.
- Tests: `__tests__/stage200-22-23-listing-wizard-p2.test.js`.

### Stage 200.22 — Draft cleanup tiered TTL

- SSOT `lib/partner/draft-cleanup-policy.js`: empty wizard orphans **7d** (`DRAFT_CLEANUP_EMPTY_DAYS`); contentful drafts **30d** (`DRAFT_CLEANUP_DAYS`); `is_draft` true|`'true'`.
- Cron `/api/cron/cleanup-drafts` uses `shouldDeleteExpiredDraft` + candidate cutoff = empty TTL.

### Stage 200.21 — Listing wizard P1a (Draft hygiene & category i18n)

- **Resume in wizard:** compact Continue vs Create-new banner (`WizardResumeDraftBanner`) when localStorage draft exists; Create-new clears draft + form (prevents orphan proliferation).
- Category picker strings via **`getUIText`** (`partnerWizard_category*`).
- Category PATCH failure → user toast (`partnerWizard_categoryUpdateFailed`).
- Also: localStorage draft v2 + `listingId`; list Continue CTA / resume banner; draft POST → `INACTIVE`.
- Tests: `__tests__/stage200-21-listing-wizard-p1.test.js`.

### Stage 200.20 — Listing wizard P0 UX polish

- **Draft after category:** `setCategoryId` → `resolveOrCreateWizardDraft` / `ensureWizardDraftListing` (create mode; id in `draftListingIdRef`, URL `?edit=` deferred so form is not wiped); photo upload coalesces on the same in-flight Promise (`ensuringDraftRef`).
- **No silent copy-fill:** `mergeDescriptionTranslationsForSave` writes only the active UI locale (+ existing AI slots); storefront falls back via `getListingText`.
- **Brand + touch:** AI CTA `variant="brand"`; wizard chrome / service-type radios / category back ≥44px.
- Tests: `__tests__/stage200-20-listing-wizard-p0.test.js`.

### Stage 203 — AUDIT_LEDGER_01 first-posting blockers + Phase 1 shadow

- Seed **`la-sys-dispute-hold`** / `DISPUTE_HOLD_RESERVE` (`stage203_01`)
- Journals FK: booking delete → **`ON DELETE SET NULL`** + **`deleted_booking_id`** stamp (`stage203_02`); entries stay CASCADE from journal
- Append-only triggers on journals/entries + GRANT SELECT/INSERT only + RLS re-assert (`stage203_03`); detach booking_id allowed
- JS: no compensating journal DELETE — heal empty journals (`lib/services/ledger/ledger-append-only.js`); E2E cleanup skips money bookings / ledger DELETE
- Staging smoke: **`npm run smoke:ledger-first-posting`** (`lib/smoke/ledger-first-posting-smoke.js`) — PENDING→CONFIRMED→capture journal + §8.1–8.3 + dispute hold
- **ADR-203 Accepted: Transition to A** — Phase 1 shadow only (`getPartnerBalanceFromLedger`, `GET /api/v2/admin/partner-ledger-shadow`, daily `POST /api/cron/ledger-shadow-reconcile` → `ops_job_runs.ledger_shadow_reconcile`, alert `[LEDGER_DRIFT]`). **Hard gate:** 30 consecutive days `stats.zeroDrift: true` before Phase 2/3 flip. **`getPartnerBalance` unchanged.** Shadow available/frozen mirror status buckets (capture − refund by booking status); `accountNetThb` tracks true PARTNER_EARNINGS after settlements/holds. Dry run: **`npm run smoke:ledger-shadow-dry-run`**.
- Order: **`migrations/README.md`** Stage 203. RPC fee-split unchanged until Phase 3 design.
- **AUDIT_MONEY_FLOW_04 remediations (2026-08-01):** Telegram partner approve/decline → `transitionBookingStatus` (+ `TELEGRAM_BOOKING_FSM_FAIL`); smoke status writes → `lib/smoke/smoke-booking-status.js` (FSM; force only `negative_test:*`); **`getFrozenBookingIdSet` fail-closed** (`FREEZE_FAIL` + Set all ids / `queryFailed` → thaw/promote/batch/settle abort); **reconcile heal intents** — same cron `reconcile-confirmed-payments` also heals `payment_intents.PAID` + CRYPTO+txid (≥5m) via `moveToEscrow` (`HEAL_SKIP` / `HEAL_ERROR`); **batch settle two-phase** — `settling_at` metadata → ledger → COMPLETED catch-up; `SETTLE_STUCK` / `SETTLE_ORPHAN` in financial-health; **ops soft-fail ≠ success** — escrow-thaw / payout-batch-pools / ledger-shadow / reconcile map DB·freeze·compare failures to `ops_job_runs.status=error` (empty work stays success); **`runStaleCronMonitor`** — last **success** age >2h (hourly: thaw / promote / reconcile) or >26h (daily: `ledger_shadow_reconcile`) → TG `[STALE_CRON] {name}` + `critical_signal_events` (`STALE_CRON`); hooked from financial-health + hourly thaw/reconcile; **P2** — thaw eligibility `PAID_ESCROW`∪`CHECKED_IN` (+ FSM `CHECKED_IN→THAWED`); partner frozen balance / ledger shadow buckets include `CHECKED_IN`; treasury conversions idempotent via `buildTreasuryConversionIds` (client / ext / same-day fingerprint).

### Wave J / optimistic chrome (200.13–200.19)

- Pending dock/header paint: `hooks/use-optimistic-nav-href.js`, `airento:nav-pending`, docks `MobileBottomNav` / `PartnerMobileBottomNav`
- Soft back + catalog scroll memory: `hooks/use-soft-back.js`, `lib/navigation/route-scroll-memory.js`, `lib/navigation/soft-back-routes.js`; **201.12–201.14** AppHeader leading (marketing, nested guest/partner, public profile/go, review flows) + marketing top-pad fix
- Catalog → PDP prefetch + hero transition pending; exclusive Search-tab pending on Home→catalog
- PDP map: cooperative overlay clipped so it cannot cover `MobileBookingBar`

### Wave I (198–199.x) — price truth & pre-live

- Stay payable SSOT: `lib/pricing/price-truth.js`; checkout charge `resolveCheckoutChargeTotalThb`
- Guest fee label without % on cards; FX display retail on PDP/checkout (`useFxRatesQuery({ retail: true })`)
- Webhook idempotency + guest pay errors + Controlled Live; owner checklist in `docs/runbooks/OWNER_CHECKLIST_GO_LIVE.md`
- Listing health / host SLA / calendar freshness; sticky pay + resume unpaid

### Ops reliability (200)

- Cron registry `lib/cron/cron-registry.js`; hourly money via cron-job.org — [`runbooks/CRON_EXTERNAL_FINANCIAL.md`](./runbooks/CRON_EXTERNAL_FINANCIAL.md)
- All `/api/cron/*` → `assertCronAuthorized`

### Auth / listings money (189 / 181 / 183)

- Immersive `/auth/*`, phone OTP, Telegram Login (geo), account linking — see manifesto §4 + ADR
- Listing asset currency L1/L2/L3: `lib/listing/listing-base-price-canon.js`, financial lock — ADR-181
- Fee policy launch: guest **15%** / host **0%** via `pricing-fee-policy` / `platform-split-fee-defaults.js` — ADR-182/183

### Client data (128.x)

- TanStack Query: `lib/query-keys.js`, `AppQueryProvider`; public catalog/home/FX/categories; chat/checkout capture **not** fully on RQ (paused post-MIR except hotfix) — ADR-128

### Audit 01 remediations (2026-07-31)

- Partner booking PUT: fail-closed `503` if no `supabaseAdmin` (no fake `success`); load via service_role; `DECLINED` → `CANCELLED`
- Removed anon-key fallback on partner stats/calendar + admin settings (service_role / `supabaseAdmin` only)
- Constitution §2.3 identity: `userTotal − partnerPayout = platformMargin + pot [+ tax]`

### Audit 02 (2026-07-31) — analysis only

- Report: **`docs/archive/audits/AUDIT_REPORT_02.md`** (stub `docs/AUDIT_REPORT_02.md`)
- Scope: referral L2/MLM, payout-batch/Concierge settle, chat invoice vs charge, PricingEngine v2 vs pot10
- CRITICAL open (not fixed yet): bank-package `request` bug; settle SETTLED on ledger fail; SKIPPED permanent exclude; invoice stale `final_breakdown`; referral alreadyEarned/unlock under-credit
- WARN_01 backlog listed in AUDIT_02 § Backlog

### Audit 02 P0 remediations (2026-07-31)

- Bank-package ZIP: `GET(request)` binding fixed (`app/api/admin/finances/payout-batches/[id]/bank-package`)
- Settle fail-closed: no batch `SETTLED` while ledger errors; per-item SETTLED only after ledger OK; COMPLETED only after ledger; repair re-entry when already SETTLED; API `422` + `ledger_errors`
- Chat invoice: `calculateCommissionFromGuestPayable` (fee on lodging, not on gross quote); sync clears `final_breakdown`, zeros `rounding_diff_pot`; `guestPayableRoundedThbFromBooking` prefers `chat_invoice_quote`

### Audit 02 P1 remediations (2026-07-31)

- SKIPPED payout items may re-enter pools (`getBookingIdsBlockedFromNewPayoutPools` ignores SKIPPED)
- Referral distribute: no blanket `ALREADY_EARNED` when pending siblings / missing L2 remain; campaign spend only on newly earned rows
- Unlock: per-row flip + immediate atomic credit + heal; reconciliation credits `earned` without wallet
- Constitution §2.3: integer (v2) vs pot10 (legacy) dual-mode documented; referral SSOT row

### Audit WARN remediations (2026-07-31)

- PriceBreakdown fallback total includes fee; demo commission = 15%; admin copy without hardcoded 15%
- Ledger balances: ADMIN-only; crypto wallet via `NEXT_PUBLIC_CRYPTO_RECEIVE_WALLET` / `CRYPTO_RECEIVE_WALLET`
- Checkout fee fallback → `PLATFORM_SPLIT_FEE_DEFAULTS`; FinTech settle/lock sends Idempotency-Key
- Lock CAS on DRAFT; CSV export blocked for DRAFT; settle SETTLED update CAS; DealDetails host no price_thb fallback
- SYSTEM_MAP + FINANCIAL_FLOW_MAP Concierge; `getEffectiveRate` deprecated

### Audit WARN deferred pass (2026-07-31)

- Fintech `??` fallbacks → `FINTECH_JS_DEFAULTS` (policy / payout / calculator / landing / withdrawal)
- Held balance: RPC `adjust_held_referral_balance_thb` + CAS (`referral-hold.service.js`, migration `stage201_01`)
- Program cap proposal includes L2 share; search/calendar rounding via `getServerGuestRoundingMode`
- Guides: `REFERRAL_ACCOUNTING` / FINANCIAL_FLOW_MAP → atomic credit path

### Concierge settle single-flight (201.02 / 201.03)

- Concurrent `markBatchSettled`: Postgres CAS on `payout_batches.metadata` (`try_claim` / `refresh` / `release`), TTL **1800s** + heartbeat ~45s
- Typical settle wall-clock mid-pool: ledger loop + PDF acts ≈ **2–5 min**; serverless route caps often 60–300s — TTL+heartbeat > expected X
- `finally` always releases by token; process crash → TTL reclaim (no separate lock table / no unbounded row growth)
- Apply order: `stage201_01` → `stage201_02` → `stage201_03` (`migrations/README.md`)
- Regression: `npm run smoke:audit02` · CI `.github/workflows/audit02-regression-smoke.yml` · `docs/runbooks/AUDIT_02_REGRESSION_E2E.md`
- **AUDIT_02 closed** (tag `v1.0.1-audit02`) — remaining WARN backlog only

---

## Указатель «куда смотреть» (быстрый)

| Тема | SSOT в коде / доке |
|------|-------------------|
| FSM броней | `lib/booking/status-transitions.js` · Constitution |
| Цена stay / fee | `lib/pricing/price-truth.js`, `pricing-fee-policy` · Constitution |
| FX retail vs mid | CurrencyService + Constitution § FX |
| Unified order UI | `lib/models/unified-order.js`, `UnifiedOrderCard` |
| Escrow / ledger | `lib/services/escrow/*`, RPC · Financial flow map |
| Push / FCM | `lib/services/push.service.js`, `POST /api/v2/push` |
| Resend mock | `lib/email/resend-transport-guard.js` |
| Categories | `categories.slug` + `wizard_profile` |
| List scroll restore (Back) | `lib/navigation/route-scroll-memory.js` · Constitution §5 · manifesto §5.1b |

---

## 0. Supabase / Postgres — канон типов идентификаторов (прод: FannyRent)

**Источник истины по колонкам:** **`docs/SYSTEM_MAP.md`** (§2) + архив **`docs/archive/ARCHITECTURAL_PASSPORT_ARCHIVE.md`** (§2 detail) и фактическая схема проекта в Supabase Dashboard (**Table Editor** / SQL `\d имя_таблицы`).

### 0.1 Почти все «продуктовые» PK/FK — **TEXT**, не UUID

В прод-базе **Supabase (FannyRent / FannRent)** идентификаторы пользователей и основных сущностей заданы как **TEXT** (строковые ключи вроде `lst-…`, `b-…`, UUID-строки в тексте):

| Колонка / роль | Тип в проде |
|----------------|-------------|
| **`profiles.id`** | **TEXT** (PK) |
| **`listings.id`**, **`bookings.id`**, **`conversations.id`**, **`messages.id`** и поля **`…_id`**, ссылающиеся на них | **TEXT** |

**Правило для любых новых SQL-миграций** (`migrations/*.sql`, ручной запуск в SQL Editor):

- Столбцы **`user_id`**, **`owner_id`**, **`renter_id`**, **`partner_id`**, **`listing_id`**, **`booking_id`**, **`conversation_id`** и т.п., если FK ведёт на **`profiles` / `listings` / `bookings` / `conversations`**, объявлять как **`TEXT`**, пока явно не проверено иное в живой БД.
- Тип **`uuid`** для таких FK допустим **только** если в Supabase у родительской колонки реально **`uuid`** (иначе Postgres вернёт **ERROR 42804** — несовместимые типы ключей).

**Prisma:** в **`prisma/schema.prisma`** и старых черновиках миграций встречаются **`UUID`** — это **не** автоматический ориентир для SQL под Supabase. Перед написанием FK сверяйтесь с **`docs/CONSTITUTION.md`** / **`docs/SYSTEM_MAP.md`** (и архивом паспорта §2) и с реальной таблицей в Supabase.

**Пример:** таблица **`user_push_tokens`**: **`user_id text not null references public.profiles(id)`** — см. **`migrations/create_user_push_tokens_table.sql`**. Комментарий-пояснение также в **`prisma/migrations/003_ai_usage_logs.sql`** (про TEXT для `profiles.id` в этом проекте).

---

## 1. Деньги и валюта (CurrencyService)

### 1.1 Источники данных

| Что | Где живёт | Модуль / API |
|-----|-----------|----------------|
| Суммы в БД и расчётах | **THB** | `base_price_thb`, брони, `bookings.pricing_snapshot` |
| Курсы для витрины (карточки, каталог, карта) | Таблица **`exchange_rates`** (`rate_to_thb` = THB за **1** единицу валюты), затем **розничный множитель** `general.chatInvoiceRateMultiplier` (деление `rate_to_thb` на множитель) | **`lib/services/currency.service.js`** → **`getDisplayRateMap`**, TTL **6 ч** (`EXCHANGE_RATES_DB_TTL_MS`), при необходимости ExchangeRate-API v6 + upsert в БД |
| Курсы при создании брони (`price_paid` / `exchange_rate`) | Тот же канон, что витрина | **`PricingService.getExchangeRates()`** → **`CurrencyService.getDisplayRateMap`** (не «сырой» обходной SELECT без TTL/API) |
| Публичный API курсов | — | **`GET /api/v2/exchange-rates`** → `rateMap`, `retailMode`, `retailMarkupMultiplier`; default **`retail=1`** (витрина); **`retail=0`** — mid; SSOT парсинг — **`lib/pricing/fx-display.js`** |
| Клиентский кеш | localStorage v3 (TTL 2h) + TanStack Query на мигрированных экранах | **`lib/client-data.js`** — **`fetchExchangeRates`**; UI SSOT — **`useFxRatesQuery`** (`lib/hooks/use-fx-rates-query.js`) |
| USDT (платежи, уведомления) | `exchange_rates` → API → env / settings | **`resolveThbPerUsdt()`**, аварии — **`lib/services/currency-last-resort.js`** |
| Комиссия платформы | `system_settings` / env | **`resolveDefaultCommissionPercent()`** |
| Множитель курса для счетов в чате THB↔USDT | админка **`/admin/settings`** / env | **`getEffectiveRate`** + **`resolveChatInvoiceRateMultiplier`** |
| Базовая валюта листинга (канон FX-логики) | `listings.base_currency` | **`BookingService`** + **`PricingService.getCheckoutRateToThb`** (совпала валюта оплаты и base_currency → наценка FX = 0%) |
| Split Fee policy | `system_settings.general` | `guestServiceFeePercent`, `hostCommissionPercent`, `insuranceFundPercent` |
| Payout rails dictionary | `payout_methods`, `partner_payout_profiles` | `PayoutRailsService`, `/api/v2/admin/payout-methods`, `/api/v2/partner/payout-profiles` |

- **Админ CRUD справочника выплат** (`GET` / `POST` / `PUT` / `DELETE` **`/api/v2/admin/payout-methods`**): **`PUT`** по **`body.id`**, которого уже нет в **`payout_methods`** (например после удаления), → **404** и понятное сообщение вместо ошибки парсинга **`.single()`**. UI **`/admin/payout-methods`**: при исчезновении редактируемого метода из списка форма сбрасывается в режим «Добавить».

В **`currency.service.js`** не вводить захардкоженные курсы (например **35.5**). Множитель **1.02** как дефолт — только в **`currency-last-resort.js`** / админке (`chatInvoiceRateMultiplier`); он применяется к **витринной** карте в **`getDisplayRateMap`** и к чат-счетам USDT (**`getEffectiveRate`**).

### 1.2 UI: откуда берутся цифры на экране

- **`formatPrice(amountThb, currency, exchangeRates, language)`** в **`lib/currency.js`** — для валюты ≠ THB **делит** сумму в THB на **`exchangeRates[currency]`**, **только если** в переданной карте есть конечный положительный курс. Иначе отображается число в THB с символом выбранной валюты (без выдуманного кросса). Четвёртый аргумент — язык UI для **`toLocaleString`** (группировка разрядов). **Таблицы курсов в `lib/currency.js` нет** (удалены неиспользуемые конвертеры с литералами).
- E2E: **`priceRawForTest(amountThb, currency, exchangeRates)`** — «голое» число для **`data-test-*`** (USD — **2** знака; прочие витринные валюты кроме JPY — целые после конвертации).
- Витрина (главная, каталог, PDP, checkout preview): **`useFxRatesQuery({ retail: true })`** — обёртка над **`fetchExchangeRates`** + RQ-кэш; legacy paths — прямой **`fetchExchangeRates`** или **`hooks/use-currency.js`**; формат цены — **`lib/pricing/fx-display.js`**.
- Реферальный хаб (баланс, цель месяца, share pitch): **`useAmbassadorDisplayFx`** → **`useMidMarketDisplayFx`** / **`useFxRatesQuery({ retail: false })`** (mid-market, parity с payout / ADR-134); не использовать retail на обязательствах.
- Партнёрский финкабинет (баланс, эскроу, портфель, история): **`usePartnerHostDisplayFx`** → mid + server payout preview; витрина **`retail: true`** не применяется.
- Выбор валюты UI (**`CurrencyProvider`**, `contexts/currency-context.jsx`) — отдельно от rate map; не дублирует серверный канон курсов.
- **`fetchExchangeRatesMid`** (`lib/api/partner-finances-client.js`) — mid map для legacy fetch; в UI предпочтительно **`useFxRatesQuery({ retail: false })`**.
- Значение по умолчанию **`{ THB: 1 }`** у пропа `exchangeRates` — это **нейтральный множитель для THB**, не курс «доллара».
- Гео-подсказка валюты: **`GET /api/v2/geo`** использует **`getDisplayRateMap`** (тот же канон, без отдельного Forex-модуля).

### 1.2b Client data layer — TanStack Query (Stage 128.x)

| Что | SSOT | Примечание |
|-----|------|------------|
| Query client + logout | **`lib/query-client.js`** — `getQueryClient`, **`clearClientQueryCache`** | вызывается из **`lib/auth/browser-auth-cleanup.js`** |
| Key factories | **`lib/query-keys.js`** — `PUBLIC_SCOPE`, `queryScopeId`, `queryKeys.*` | scoped auth keys включают profile id |
| Browser `queryFn` | **`lib/api/query-fetch.js`** — **`queryFetchJson`** | cookie-сессия; не заменяет server fetch |
| Публичные категории | **`usePublicCategoriesQuery`** | ключ **`queryKeys.public.categories()`**, stale 5m |
| Каталог search | **`lib/hooks/useListingsSearch.js`** | **`queryKeys.catalog.search`**, **`keepPreviousData`**; без **`searchCache`** |
| FX display (UI) | **`useFxRatesQuery`** | обёртка **`fetchExchangeRates`**; не второй источник курсов |
| Featured / live count | **`use-platform-home-page.js`**, **`use-home-live-count-query.js`** | **`queryKeys.home.featured`**, **`queryKeys.home.liveCount`** |
| PDP prefetch | **`use-listing-detail-prefetch.js`**, **`fetch-listing-detail.js`** | debounce 120ms; **`queryKeys.listing.detail`** |
| Профиль | **`use-profile-queries.js`** | **`useProfileMeQuery`** → **`fetchAuthMe`**; partner status scoped key |

Legacy **`dedupeClientRequest`** (**Stage 113.0**) остаётся на чате, FinTech и прочих не мигрированных путях. **128.4:** RQ roadmap **PAUSED** до MIR — **`docs/proposals/TANSTACK_QUERY_MIGRATION_PLAN.md`**.

### 1.3 Удалено (не возвращать)

- **`lib/services/forex.service.js`**, **`GET /api/v2/forex`** — удалены; второго FX-движка нет.
- **`lib/services/currency-helper.js`** — удалён (реэкспорт без потребителей); импортировать **`currency.service.js`** напрямую.
- Скрытая наценка **3.5%** (FunnyRate) — снята; новая «витринная» наценка — только через **`system_settings` / env** по тому же принципу, что чат-счета.

### 1.4 Finance & Currency — формулы `price_thb` и сезоны

**Канон расчёта:** **`PricingService.calculateBookingPrice`** (`lib/services/pricing.service.js`) из **`BookingService.createBooking` / `createInquiryBooking`** (`lib/services/booking.service.js`).

1. **Период:** даты приводятся к дню листинга (**`toListingDate`**). Цикл по каждой **ночи** от `check_in` до `check_out` (день за днём, пока `night < checkOutStr`); **`nights`** = число итераций.
2. **Ставка за ночь/сутки:** для каждой даты **`calculateDailyPrice`**: сначала окна **`seasonal_prices`** (БД, первое совпадение диапазона), иначе **`listings.metadata.seasonal_pricing`** — абсолют **`priceDaily` / `price_daily`** или **`base_price_thb × priceMultiplier`**.
3. **Субтотал:** `subtotalBeforeDuration` = сумма дневных ставок за период.
4. **Скидка за длительность:** **`applyDurationDiscountToSubtotal`** по **`metadata.discounts`** (пороги в ночах, см. комментарии в **`pricing.service.js`**). **`totalPrice`** до промо = `discountedPrice`.
5. **Промокод:** в **`BookingService`** — после шага 4, снимается с THB; итог пишется в **`bookings.price_thb`**.
6. **Снимок:** **`buildBookingPricingSnapshot`** → **`bookings.pricing_snapshot`** (ночи, субтотал до лестницы, скидка, промо).

**По категориям (код = истина):**

| Категория | Смысл `base_price_thb` в продукте | Фактическая формула в коде |
|-----------|-----------------------------------|----------------------------|
| **Properties (жильё)** | За ночь | **Σ(ставка за каждую ночь с учётом сезонов)**; при плоской ставке без сезонов и без лестницы скидок эквивалентно **base × nights**. |
| **Vehicles (транспорт)** | За сутки | Тот же цикл по ночам между датами → число суток = обычно **checkout − checkin** в днях; сезоны — как у жилья. |
| **Tours (туры)** | За человека / билет | Базовый расчёт периода (сезоны + скидка длительности) затем **множитель по группе**: **`totalPrice = discountedPrice × guestsCount`**. `guestsCount` для туров валидируется как минимум **1** (0 недопустим). |

### 1.4a Защита цены при создании брони (client attestation)

- Клиент передаёт **`clientQuotedSubtotalThb`** (THB, до промокода), витрина считает ту же сумму через **`PricingService.calculatePrice`** / **`calculateBookingPriceSync`** (в т.ч. тур × **`guestsCount`**).
- **`BookingService.createBooking`** и **`createInquiryBooking`** (кроме **`privateTrip`** / **`negotiationRequest`**) сверяют **`Math.round(clientQuotedSubtotalThb)`** с **`Math.round(PricingService.calculateBookingPrice(…).totalPrice)`** до применения промокода. Расхождение → отказ (**`code: 'PRICE_MISMATCH'`**), Telegram алерт **`[PRICE_TAMPERING]`** + метка **«ATTEMPTED PRICE MANIPULATION»**.
- Схема тела: **`lib/validations/booking.js`**; публичный вход — **`POST /api/v2/bookings`**.
- **Финальный POST с клиента** (кнопка «Забронировать»): заголовки **`Cache-Control: no-cache`** и **`Pragma: no-cache`**, чтобы промежуточный HTTP-кэш (в т.ч. после **`private` TTL календаря**) не подставил устаревшую картину занятости; сервер всё равно делает **повторную проверку доступности** в **`BookingService`** непосредственно перед INSERT.
- **Конфликт дат после кэша:** ответ **`code: 'DATES_CONFLICT'`** → пользователю **`getBookingApiUserMessage`** / **`bookingErr_datesConflict`** (локализовано в **`lib/translations/errors.js`**).
- **Server-side Integrity (ценовая броня):** после промокода **`BookingService.createBooking` / `createInquiryBooking`** отклоняют бронь, если субтотал **&lt; 0** или **итог к оплате гостем** (с учетом `rounding_diff_pot` до ближайших 10 THB) **&lt; `MIN_BOOKING_GUEST_TOTAL_THB` (100)** — код **`BOOKING_MIN_TOTAL_THB`**, Telegram **`[SECURITY_ALERT]`**. Опционально тело **`clientQuotedGuestTotalThb`** (THB): при расхождении с серверным итогом — **`PRICE_MISMATCH`** + Telegram **`[PRICE_TAMPERING]`** / **`[FRAUD_DETECTION]`** (как у **`clientQuotedSubtotalThb`**). Константы и формулы: **`lib/booking-price-integrity.js`**.

### 1.4b Deep links (мобильные уведомления / внешние приложения)

Канонические экраны: **`/messages/[id]`** (чат), **`/checkout/[bookingId]`** (оплата). Для коротких URL в push / Telegram / будущем нативном shell:

| Алиас | Редирект |
|-------|-----------|
| **`/chat/[id]`** | **`/messages/[id]`** — **`app/chat/[id]/page.js`** |
| **`/bookings/[id]`** | **`/checkout/[id]`** — **`app/bookings/[id]/page.js`** |

При появлении нативного приложения те же пути можно зарегистрировать как **universal links** / **app links** без смены серверных маршрутов.

### 1.4c Критические сигналы (Telegram system topic)

- Повторяющиеся **`PRICE_MISMATCH`**: **`lib/critical-telemetry.js`** (`recordCriticalSignal`) — при превышении порога за окно времени дополнительное сообщение в системный топик с префиксом **`[FRAUD_DETECTION]`** (дополняет поштучные **`notifySystemAlert`** из **`booking.service.js`**). При наличии **`banUserId`** в опциях — в сообщение добавляется **inline URL-кнопка** «Забанить пользователя …» (**`buildFraudBanReplyMarkup`**, **`lib/services/fraud-telegram-ban-button.js`**).
- E2E **Accountant Bot** при расхождениях витринной математики (&gt; **0.01**): **`POST /api/v2/internal/e2e/financial-error-alert`** → **`recordCriticalSignal('FINANCIAL_ERROR', { tag: '[FINANCIAL_ERROR]', threshold: 1, … })`** (см. §11.2).
- Тексты манипуляции ценой в алертах также помечены **`[FRAUD_DETECTION]`**; мгновенная кнопка бана дублируется и на поштучном **`notifySystemAlert`** из **`booking.service.js`**, если известен **`renter_id`**.

### 1.4d LQIP карточек листинга

- Плейсхолдер **`next/image`**: по умолчанию нейтральный blur (**`LISTING_CARD_BLUR_DATA_URL`**). Если в **`listings.metadata`** задано **`card_blur_data_url`** или **`blur_data_url`** (data URL крошечного превью), используется **`getListingCardBlurDataURL`** (**`lib/listing-image-blur.js`**) в **`CardImageCarousel`** / контекст-карточке.

### 1.5 Витринные курсы, снимок брони, оплата

- **Единый источник курсов для витрины и полей `price_paid` / `exchange_rate` при создании брони:** **`CurrencyService.getDisplayRateMap()`**. Конвертация в список для поиска по коду — **`PricingService.getExchangeRates()`** (динамический импорт **`currency.service.js`**).
- **При INSERT в `bookings`:** `exchange_rate` = **`rateToThb`** выбранной валюты запроса (THB за 1 единицу); `price_thb` = subtotal после скидок/промо; `commission_thb` = guest service fee; `rounding_diff_pot` = округление вверх до ближайших 10 THB; **`price_paid`** = **`(price_thb + commission_thb + rounding_diff_pot) / exchange_rate`**. Для **`currency === 'THB'`** курс **1**. Налоговая база агрегатора фиксируется в **`taxable_margin_amount = guest_paid_thb - partner_earnings_thb`**.
- **Phase 1.1 (валютный контур):** `currency` в `POST /api/v2/bookings` валидируется по канону **`THB | USD | RUB | CNY | USDT`** (`lib/validations/booking.js`), а `baseCurrency` листинга — по **`THB | RUB | USD | USDT`**.
- **Пересчёта при переходе в PAID нет:** **`BookingService.updateStatus`** и **`PUT /api/v2/partner/bookings/[id]`** меняют только **`status`** и временные метки (**`checked_in_at`** для PAID в partner flow), не трогая **`price_thb`**, **`exchange_rate`**, **`commission_*`**. Тело **PUT** парсится через **`request.text()`** + **`JSON.parse`**; пустое или невалидное JSON → **400**, не **500**.
- **USDT в момент оплаты:** **`resolveThbPerUsdt()`** (цепочка **`exchange_rates` → API → env / `system_settings`**) используется в **`payment/initiate`**, **`payments-v3.service`**, верификации Tron — это **операционный курс оплаты**, не обязано совпадать с **`bookings.exchange_rate`** (который фиксирует валюту **запроса** гостя USD/RUB/CNY и берётся из витринной логики). Счета в чате THB↔USDT — **`getEffectiveRate`** (сырой USDT × **`resolveChatInvoiceRateMultiplier`**).
- **Скан на «магические» курсы:** литералов **1.035 / 0.965** в финансовом ядре нет. Дефолт множителя **1.02** — **`currency-last-resort.js`** / админка; он **умножает спред** на витрине (через деление `rate_to_thb` в **`getDisplayRateMap`**) и в чат-счетах. **`GET /api/v2/partner/stats`:** доход партнёра из **`partner_earnings_thb`**, иначе **`price_thb − commission_thb`**, иначе **`price_thb × (1 − commission_rate/100)`** — без фиксированного **0.85**. В ответ добавлен блок **`financialV2`**: **`moneyInTransitThb`** — сумма **`partner_earnings_thb`** (с тем же фолбэком) по броням **`PAID_ESCROW`**; **`incomeByMonth`** — последние 6 месяцев, сумма по **`payouts`** со статусами **`PAID`** и **`COMPLETED`**, ведро по **`processed_at`** (иначе **`created_at`**), сумма **`gross_amount`** → **`final_amount`** → **`amount`**.

### 1.6 Admin Health Alerts (дисплей-FX)

- **Когда:** при загрузке карты курсов для витрины **`CurrencyService.getDisplayRateMap`** оценивает «свежесть» строк **`exchange_rates`** (в т.ч. USDT с **`updated_at`**). Если для любой из ожидаемых валют в карте **нет** `updated_at` или возраст **`updated_at` &gt; 24 ч** (`DISPLAY_FX_STALE_ALERT_MS`), состояние считается **stale**.
- **Лог + Telegram:** **`maybeAlertStaleDisplayRates`** пишет **`console.warn`**, затем **`notifySystemAlert`** → топик **`TELEGRAM_SYSTEM_ALERTS_TOPIC_ID`** (fallback — **`sendToAdmin`**: личка или топик FINANCE). Текст вида **«КРИТИЧНО: Курсы валют устарели»** (Bangkok TZ). Повтор не чаще **1 ч** (`DISPLAY_FX_STALE_ALERT_COOLDOWN_MS`).
- **Дашборд админа:** **`GET /api/v2/admin/exchange-rates-health`** (JWT **ADMIN**, cookie `gostaylo_session`) отдаёт **`{ stale, staleCodes, lastUpdateLabel, oldestStaleIso }`** из **`getDisplayFxStaleHealthFromDb`** без вызова внешнего FX API. Клиент **`app/admin/dashboard/page.js`** поднимает **красный баннер** при **`stale === true`** (`data-testid="admin-fx-stale-banner"`).

### 1.7 Traceability: листинг → карточка в чате

1. **`listings.base_price_thb`** (+ **`seasonal_prices`** + **`metadata.seasonal_pricing`** + **`metadata.discounts`**).
2. **`PricingService.calculateBookingPrice`** → **`PricingService.calculateFeeSplit`** → **`BookingService.createBooking`** → **`bookings`** (`price_thb` subtotal, `commission_thb` guest fee, `rounding_diff_pot`, `taxable_margin_amount`, `commission_rate` host %, `partner_earnings_thb`, `exchange_rate`, `price_paid`, `pricing_snapshot.fee_split_v2` + `settlement_v3.taxable_margin_amount`).
3. **`ensureBookingConversation`** / **`ensureInquiryConversation`** → первая **`messages`**: system с **`metadata.price_thb`**, **`pricing_snapshot`**, **`booking_id`**.
4. Обычный UI: **`ChatMilestoneCard`** — итог **THB** из **`metadata.price_thb`** (и даты из metadata).
5. **`BookingRequestCard`** + **`lib/chat-booking-totals.js`** (`resolveChatBookingBreakdown`): только сообщения типа **`BOOKING_REQUEST`** в staff-треде; разбивка **× дней / × гостей** зависит от **`metadata.totalPrice` / `basePrice` / `days` / `group_size`** — не отдельный дубль сервера для стандартного **`booking_created`**.

---

## 2. Календари и доступность

- **Истина:** **`calendar_blocks`** + **`lib/services/calendar.service.js`**.
- **Транспорт (`categories.slug === 'vehicles'`):** базовый календарь остаётся day-slot (по дням), но в **`checkAvailability`** включается режим **interval** при явном времени в `check_in/check_out` (`T`/`HH:mm`): конфликт определяется по пересечению интервалов (условие `existing.check_in < request.check_out` и `existing.check_out > request.check_in`) через `findVehicleIntervalConflicts`, а не по сравнению `guests_count` c `remaining_spots`.
- **Transport binary-mode unified (Stage 2 patch):** для `vehicles` во всех точках (`/api/v2/bookings`, partner manual booking, search availability loop) `guestsCount` для проверки занятости принудительно `1`, а фильтры по `max_capacity`/`guests > spots` не переводят транспорт в inquiry-flow.
- **Day-only protection:** если у `vehicles` не передано время, интервал автоматически нормализуется как защищённый full-day (`00:00` → `23:59:59.999`, Bangkok) через `lib/services/vehicle-conflict-utils.js`, чтобы не пропускать скрытые нахлёсты из-за пустых time fields.
- **Partner confirm + транспорт:** **`verifyInventoryBeforePartnerConfirm`** подгружает **`listings.category_id`** / fallback **`metadata.category_slug`**, и для **`vehicles`** передаёт в **`CalendarService.checkAvailability`**: **`guestsCount: 1`**, **`listingCategorySlugOverride: 'vehicles'`**, **`occupyingStatusesCsv: 'CONFIRMED,PAID,PAID_ESCROW,CHECKED_IN'`**. Это убирает зависимость от размера компании и отсекает только реально занятые интервалы (без `PENDING`/`INQUIRY`) при финальном подтверждении; текущая заявка исключается через `excludeBookingId`.
- **Search/widget + транспорт (interval):** `listings-catalog-client` + `UnifiedSearchBar` передают `checkIn/checkOut` с временем (`checkInTime/checkOutTime`, ISO `+07:00`) для категории `vehicles`; `useListingsSearch` и `run-listings-search-get` проверяют доступность с `listingCategorySlugOverride` (по slug листинга), чтобы фильтр каталога не откатывался в day-only при наличии времени.
- **Карточка листинга + API availability:** страница `/listings/[id]` отправляет `startDateTime/endDateTime` в `GET /api/v2/listings/[id]/availability`, а `POST /api/v2/bookings` для `vehicles` принимает и валидирует datetime (`YYYY-MM-DD` или ISO), сохраняя посуточное ценообразование и интервал-занятость как независимые слои.
- **UI выбора времени (transport):** вместо нативного `input[type=time]` в поиске/виджете/модалке используется единый электронный селект `TimeSelect` (24h, шаг 30 мин) — это убирает нестабильное поведение мобильных «круглых» пикеров и фиксирует корректную установку выбранного времени.
- **iCal → блоки:** **`lib/services/ical-calendar-blocks-sync.js`**. Вызовы: **`/api/cron/ical-sync`**, **`/api/ical/sync`**, **`/api/v2/admin/ical`**. Логи: **`ical_sync_logs`**. Экспорт `.ics`: **`/api/v2/listings/[id]/ical`**.
- **Надёжность импорта:** при ошибке **fetch/parse/insert** существующие блоки источника **не затираются** (вставка новых строк выполняется до удаления старых; при сбое удаления — откат вставленных id). Ошибки синхронизации в cron агрегируются и уходят в **системный Telegram** (**`notifySystemAlert`** в **`app/api/cron/ical-sync/route.js`** при **`errors > 0`**).
- **День листинга:** **`Asia/Bangkok`** — **`lib/listing-date.js`**. All-day iCal: **`lib/ical-all-day-range.js`**.
- **Не использовать** для прод-записи партнёрами: **`availability_blocks`**.
- **Race-condition guard (DB):** миграция **`database/migrations/037_vehicle_booking_overlap_guard.sql`** добавляет trigger на `bookings` (`BEFORE INSERT/UPDATE`) и блокирует пересечение интервалов для `vehicles` по half-open диапазону (`[)`), возвращая `VEHICLE_INTERVAL_CONFLICT` при конкурентном дубле.

---

## 3. Категории листингов: жильё, транспорт, туры

### 3.1 Слуги и UX

- Slug категории из БД — **`lib/listing-category-slug.js`**, **`lib/listing-booking-ui.js`** (`getListingBookingUiMode`, `getListingRentalPeriodMode`, exclusive/shared инвентарь).
- **Подписи периода в виджете** (`components/listing/BookingWidget.jsx`): режим **`night`** или **`day`** задаётся **`getListingRentalPeriodMode`** — **`day`** для **`vehicles`**, яхт/лодок (yacht/boat в slug), **туров** (`tours` / `tour` в slug).

### 3.2 Канон: единица брони и колонки `min_booking_days` / `max_booking_days`

| Категория (продукт) | EN | Что считаем | Колонки min/max дней в БД | `POST /api/v2/bookings` |
|---------------------|-----|-------------|---------------------------|-------------------------|
| **Жильё и аналоги** | Properties | **Ночи** | Реальные лимиты партнёра | Длина периода в ночах ≥ `min_booking_days` (и max при наличии) |
| **Транспорт** | Vehicles | **Сутки (24h)** в копирайте и ценообразовании | Реальные лимиты аренды по дням | Сравнение длины периода **в днях** с min/max колонок (как для «ночей» по датам, см. сервер) |
| **Туры** | Tours | **Люди / билеты** — лимит гостей | **Фиксировано 1 / 730** из партнёрского UI — колонки **не** выражают размер группы и **не** должны отсекать тур по длительности | Для `categories.slug === 'tours'`: проверка **`guestsCount`** vs **`metadata.group_size_min` / `group_size_max`** (+ `max_capacity` при необходимости). Реализация: **`app/api/v2/bookings/route.js`**. |

### 3.3 Туры: миграция из старых колонок в metadata

1. Исторически партнёрский UI записывал «мин/макс группы» в **`min_booking_days` / `max_booking_days`** — семантически неверно.
2. **Сейчас:** **`listings.metadata.group_size_min`** и **`group_size_max`** — единственный смысловой источник для лимита гостей; при сохранении нормализует **`normalizePartnerListingMetadata`** (**`lib/partner/listing-wizard-metadata.js`**). **Stage 64.0:** allow-list ключей metadata по категории — **`getAllowedWizardMetadataKeys`** в **`lib/config/category-form-schema.js`** (рендер полей — **`WizardSchemaFields`**); лишние ключи отбрасываются в конце **`normalizePartnerListingMetadata`** (опционально передаётся **`categoryName`** для legacy transport по названию категории). **Stage 65.0:** маркетплейс услуг — профили **`service_generic`**, **`chef`**, **`massage`**, расширенная **`nanny`** (база: **`languages`**, **`experience_years`**, **`certifications`** + специфика в схеме); UI визарда — **`getWizardSpecsSectionFields`** + **`languages_multi`** в **`WizardSchemaFields`**.
3. **При открытии формы:** если в metadata ещё нет `group_size_*`, один раз подставляются значения из колонок функцией **`mergeTourGroupMetadataFromListingColumns`** (тот же файл). Вызовы: **`app/partner/listings/new/page.js`**, **`app/partner/listings/[id]/page.js`**. После сохранения листинга источником истины остаётся metadata.
4. Партнёр при сохранении туров отправляет **`minBookingDays: 1`**, **`maxBookingDays: 730`** — осознанная фиксация в БД, чтобы общий пайплайн «дней» не блокировал туры, пока логика — по гостям.

### 3.4 Карточка «запрос брони» в чате (отображение суммы)

- **Обычный поток:** системное сообщение о брони → **`ChatMilestoneCard`** показывает **`metadata.price_thb`** (= **`bookings.price_thb`** на момент создания).
- **Staff / тип `BOOKING_REQUEST`:** **`lib/chat-booking-totals.js`** → **`resolveChatBookingBreakdown`**: для туров (slug `tours` / подстрока `tour`) итог из metadata = **цена × размер группы**; для жилья/транспорта — **субтотал периода** или **ставка × `days`** из **`totalPrice` / `basePrice`**. Комиссия в **`PriceBreakdown`** — от **`metadata.commissionRate`** или хука **`useCommission`**.

---

## 4. Авторизация: 100% cookie + сервер (единый стандарт)

- **Сессия:** HttpOnly **`gostaylo_session`** (JWT), выставляется только API логина/рефреша. Клиентский **`localStorage.gostaylo_user`** — кеш для UI и быстрого старта **`AuthProvider`**, **не** источник решения о доступе к закрытым зонам.
- **Партнёрская заявка (KYC, Phase 1.8):** **`PATCH /api/v2/partner/applications`** с **`{ verificationDocUrl }`** — прикрепить/обновить документ для существующей заявки **`PENDING`** (в т.ч. legacy без файла); Telegram **NEW_PARTNERS** — короткое уведомление. **`GET /api/v2/partner/application-status`** возвращает **`hasVerificationDoc`** (без URL). Канонический **`POST /api/v2/partner/applications`** (и зеркальный **`POST /api/v2/partner/apply`** на тот же handler) — тело: **`phone`**, **`experience`**, опционально **`socialLink`**, **`portfolio`**, обязательно **`verificationDocUrl`** (публичный или прокси URL после **`POST /api/v2/upload`**, бакет **`verification_documents`**). Пользователь определяется **только из JWT**; при несовпадении с **`userId` в теле** — **403**. Запись в **`partner_applications.verification_doc_url`**, синхронизация **`profiles.phone`**, Telegram топик **NEW_PARTNERS** через **`sendToTopic`** (**`lib/telegram.js`**). UI: **`components/kyc-uploader.jsx`**, экраны **`/renter/profile`** и **`/profile`**. Одобрение по-прежнему **`POST /api/v2/admin/partners`** → **`profiles.role = PARTNER`**.
- **Connectivity (Phase 1.9):** **`GET /api/v2/debug/test-telegram`** — только **ADMIN** и (нон-прод **или** **`ENABLE_DEBUG_TELEGRAM=1`**); шлёт **«Test OK»** в админ-группу (**`sendToAdminGroup`**) и возвращает JSON **`runbook`** (чеклист E2E). После успешной вставки **`ledger_entries`** для проводки **`BOOKING_PAYMENT_CAPTURED`** (DEBIT на **`la-sys-guest-clearing`** / **GUEST_PAYMENT_CLEARING**) — fire-and-forget сообщение в Telegram топик **FINANCE** (**`lib/services/ledger-telegram-notify.js`**) с строкой **«Накоплено в котле … THB»** по балансу **`la-sys-processing-pot`** (FEE_CLEARING / PROCESSING_POT_ROUNDING), после этой проводки. Просмотр KYC в админке: **`GET /api/v2/admin/verification-doc?path=…`** → редирект на **signed URL** (см. **`lib/verification-doc-admin-url.js`**). Runbook: **`docs/runbooks/PARTNER_KYC_LIFECYCLE_E2E.md`**.
- **Edge:** **`middleware.ts`** проверяет JWT и роль для префиксов **`/admin`**, **`/partner`**, **`/renter`**, **`/messages`**. Нет валидной сессии → редирект на **`/login?redirect=<path>`** (страница **`app/login/page.js`** кладёт `redirect` в `sessionStorage` и открывает вход через **`/profile?login=true`**).
- **Админ-лейаут:** **`app/admin/layout.js`** после middleware дополнительно запрашивает **`GET /api/v2/auth/me`** (роль из БД). Без сессии → **`/login`**, не ADMIN/MODERATOR → **`/`**. Режим «войти как» (только при реальной роли ADMIN в JWT): UI берётся из **`localStorage`** при **`isImpersonated`**, подделка без ADMIN-сессии невозможна.
- **Выход из админки:** **`POST /api/v2/auth/logout`** + очистка локальных ключей impersonation.

## 5. Чат как транзакционный центр (Command Center)

- **Канон отправки из UI:** **`POST /api/v2/chat/messages`** — **`getSessionPayload`** + участие в беседе (**`lib/services/chat/access.js`**). Поля **`sender_id` / `sender_role` / `sender_name` из тела запроса игнорируются**; в БД пишутся роль и имя из **`profiles`** текущей сессии.
- **Политика анти-обхода комиссии (контакты в чате):** целевая реализация зафиксирована в **`docs/ANTI_DISINTERMEDIATION_POLICY.md`** (server-first фильтр в `POST /api/v2/chat/messages`, phased rollout `warn_only → redact → block`, telemetry через `critical_signal_events`).
- **Safety trigger (текущий baseline):** `POST /api/v2/chat/messages` использует server-side детектор (`lib/chat/contact-safety-detection.js`) для phone/email/messenger-link/handle признаков. При срабатывании сообщение записывается с **`messages.has_safety_trigger = true`** (миграция **`database/migrations/024_messages_has_safety_trigger.sql`**), в `metadata` добавляется `safety_trigger_types`, а в **`critical_signal_events`** пишется **`CONTACT_LEAK_ATTEMPT`** (`conversationId`, `senderId`, `matchTypes`).
- **Safety UI (i18n):** тексты предупреждения и модалки — ключи **`chatSafety_*`** / **`escrowProtection_*`** в **`lib/translations/ui.js`**, язык из **`I18nProvider`** (`language` в **`MessageBubble`**); публичная справка по эскроу — **`/help/escrow-protection`**.
- **Contact safety (v2.2–2.3):** ENV **`CONTACT_SAFETY_MODE`** = **`ADVISORY`** | **`REDACT`** | **`BLOCK`** (`lib/contact-safety-mode.js`). Телеметрия **`CONTACT_LEAK_ATTEMPT`** + страйки **`profiles.contact_leak_strikes`** (RPC **`increment_contact_leak_strikes`**, миграция **`025_…`**); инкремент **не** для **ADMIN/MODERATOR**. **`BLOCK`** — **403** `CONTACT_SAFETY_BLOCKED`; **`REDACT`** — **`maskContactInfo`**. В **`critical_signal_events.detail`** — **`triggerTextSample`** (обрезанный исходный текст). Дашборд утечек: **`GET /api/v2/admin/contact-leak-dashboard`** (**`summary`**, **`recentEvents`** на violator, SSOT **`lib/admin/contact-leak-violators.js`**), UI **`/admin/security`** (+ **`POST /api/v2/admin/users/ban`**); оценка риска в **THB**
- **Stage 117.4 (marketing/referral cleanup):** `cleanup:test-data:execute` удаляет тестовые строки **`referral_ledger`**, **`marketing_promo_tank_ledger`** (в т.ч. orphan `booking_id=null` с `metadata.trigger=e2e_completed` / `user-s72-*`), **`wallet_transactions`**; SSOT **`lib/e2e/test-marketing-referral-markers.js`**, **`cleanup-test-marketing-referral.service.js`**; лог «Удалено M записей из referral ledger / marketing budget».
- **Stage 117.3 (test-user cleanup):** агрессивная очистка smoke/E2E профилей — SSOT **`lib/e2e/test-user-markers.js`**, каскад **`lib/e2e/cleanup-test-users.service.js`** (profiles, ledger_accounts, bookings, listings, auth по `auth_user_id` UUID); встроено в **`npm run cleanup:test-data`** / **`:execute`** (сначала пользователи, затем листинги); лог «Удалено N тестовых пользователей». Маркеры: `user-smoke-*`, `@smoke.invalid`, `@test.gostaylo.invalid`, `Smoke*`, `UserA`–`UserE`, защита `PROTECTED_TEST_CLEANUP_EMAILS`.
- **Stage 117.2 (pre-launch polish):** **`OwnerLaunchReadinessCard`** — кнопки «Запустить smoke» (`postFintechSmokeFinancialRun`), «Подготовить к паузе» (`postFintechPreparePause`), модерация/нарушители; подсказка про ЮKassa+кассу; admin long-tail → `brand`.
- **Stage 117.1 (final launch polish):** **`OwnerLaunchReadinessCard`** — быстрые ссылки (модерация, нарушители, FinTech, рефералка), простые формулировки в **`owner-launch-readiness.js`**; brand-токены на каталоге/чате/partner listings; PDP missing-listing OG fallback.
- **Stage 117.0 (pre-launch polish):** единый publish UX на **`/partner/listings`** = quality gates SSOT + **`PartnerListingPublishQualityModal`**; **`/admin`** — **`OwnerPlatformStatusCard`** (`platformStatus` в stats); OG SSOT **`lib/seo/resolve-og-image.js`**, fallback **`/og-image.jpg`**, PDP/каталог/корень.
- **Stage 116.4 (launch polish):** **`GET /api/v2/admin/stats`** → **`launchReadiness`** (SSOT **`lib/admin/owner-launch-readiness.js`**, UI **`OwnerLaunchReadinessCard`** на **`/admin`**). Модерация: список с inline Approve/Reject, **`revalidatePath`** каталога при approve. Security: таблица нарушителей (страйки / события / объявления).
- **Stage 116.3 (admin owner ops):** **`GET /api/v2/admin/stats`** → **`ownerOps`** (pending moderation, active violators ≥ **`strikeThreshold`**, leaks/week). **`GET /api/admin/moderation`** — query-фильтры + **`lib/admin/moderation-queue.js`**. UI: **`/admin`** (карточки P0), **`/admin/moderation`** (фильтры, координаты, approve→ACTIVE), **`/admin/security`** (последние нарушения, ban). (**`general.chatSafety.estimatedBookingValueThb`** или ENV **`CONTACT_LEAK_ESTIMATED_BOOKING_THB`**) × комиссия; конвертация **USD/RUB** — **`getDisplayRateMap({ applyRetailMarkup: false })`** + **`convertAmountThbToCurrency`** (**`exchange_rates`**). **`general.chatSafety`**: **`autoShadowbanEnabled`**, **`strikeThreshold`** — при включённом авто-shadowban и страйках ≥ порога сообщения с триггером получают **`metadata.hidden_from_recipient`** и скрываются у получателя (**`GET /api/v2/chat/messages`**, Realtime **`use-chat-thread-messages`**). Настройки: **`/admin/settings`** + **`lib/chat-safety-settings.js`**.
- **Системные сообщения:** тип **`system`** — по умолчанию только **ADMIN/MODERATOR**; у партнёра — узкий whitelist **`metadata.system_key`** (`passport_request`, `booking_confirmed`, `booking_declined`) при участии в диалоге. Renter/USER не могут эмулировать «Систему» или чужую роль через API.
- **Транзакционные события (бронь, счёт, статусы):** серверные вставки в **`messages`** из **`lib/services/booking.service.js`**, **`lib/booking-status-chat-sync.js`**, **`app/api/v2/chat/support/join/route.js`** и т.д. — обходят HTTP-роут там, где нужна атомарность с бизнес-операцией; клиентский путь остаётся единым для пользовательского текста/медиа/счетов из кабинета.
- **Уведомления после сообщения:** **`PushService.sendToUser`** (FCM) для контрагента в диалоге; в **`app/api/v2/chat/messages/route.js`** отправка вынесена в фон через `dispatchBackgroundTask` + `waitUntil` (`@vercel/functions`), чтобы serverless не обрывал push после HTTP-ответа. Для deep-link в payload передаётся **`conversationId`** + **`/messages/{id}`**. **Premium Quiet Policy (v3 / 201.19):** **`public/sw.js`** (импортирует **`push-visibility-policy.js`** + **`firebase-messaging-sw.js`**) — для **`NEW_MESSAGE`** не показываем OS-баннер, если есть вкладка **того же origin** с **`visibilityState === 'visible'`** и **`focused`**. Тихие выходы (**`BADGE_UPDATE`**, quiet) вызывают **`acknowledgePushWithoutUserBanner`** (silent `showNotification` + сразу `close`) — иначе Chromium/Yandex подставляют «сайт обновлён в фоне». **`postMessage`** при quiet не шлётся — UI через **Realtime**.
- **Web Push pipeline (FCM):** клиентский bootstrap **`components/push-client-init.jsx`** регистрирует **`/sw.js`** (SSOT **`registerAppServiceWorker`**), получает FCM token (Firebase Web SDK) и отправляет в **`POST /api/v2/push`** (`action=register`) только для пользователя из cookie-сессии. Сервер хранит токены в **`user_push_tokens`** (multi-device, one row per token). Service Worker маршрутизирует data-payload в открытые вкладки (`postMessage`), когда баннер **не** подавлен Premium Quiet, и открывает нужный URL по `notificationclick`. **`PushService.sendPush`** (не silent): в теле FCM есть **`notification` + `webpush.notification` + `data`**, **`android.priority: high`**, **`android.ttl: 2419200s`**, APNS **`apns-push-type: alert`**, **`sound: default`**. Диагностика в Vercel: логи **`[FCM Debug]`**; полный JSON исходящего сообщения — env **`FCM_VERBOSE_LOG=1`**. Если в логах **`FIREBASE_PRIVATE_KEY is missing`** — на Vercel не задан сервисный ключ (раньше давало `Cannot read properties of undefined (reading 'replace')`). Строка **`FIREBASE_PRIVATE_KEY`** перед подписью нормализуется в **`push.service.js`** (`normalizeFirebasePrivateKey`: снятие BOM/кавычек, `\\n` → перевод строки); при **`Invalid character`** проверьте, что в PEM нет лишних символов вне base64-блока.
- **Token sync hardening:** в **`push-client-init.jsx`** token-sync выполняется только после **`navigator.serviceWorker.ready`** (лог браузера: **`[Push Debug] Service Worker READY. Starting token sync…`**). Если токен из Firebase отличается от `localStorage`, регистрация идёт с **`update: true`**; при ошибке `POST /api/v2/push` есть повторная попытка через **5 секунд**.
- **Push traceability (Vercel):** добавлены стабильные сервисные маркеры **`[PUSH_FLOW]`** (queue/start/result/no-token/exception) и **`[PUSH_SENT] To: {userId}, Status: {FCM_Response}, Token_Snippet: {first_10_chars}`**. По этим строкам видно, дошёл ли запрос до FCM или остановился раньше.
- **FCM 404 hygiene:** HTTP **404** от FCM трактуется как stale-token и ведёт к немедленному удалению из **`user_push_tokens`** (+ cleanup legacy mirror, если есть) через `deleteInvalidPushToken`.
- **Legacy `profiles.fcm_token` compatibility:** чтение legacy-колонки переведено на безопасный helper (`fetchLegacyProfileToken`) — отсутствие колонки больше не валит `sendToUser`.

### Delayed Mobile Push Strategy (Smart Delivery) + Premium Quiet Policy (v3)

- **Цель:** не дублировать назойливый пуш, если пользователь уже смотрит на вкладку сайта (**focused + visible**); если сообщение уже прочитано — FCM **не** вызывать. Тихий push без баннера обязан `acknowledgePushWithoutUserBanner`, иначе Chromium показывает «сайт обновлён в фоне» (Stage **201.19**).
- **`user_push_tokens.last_seen_at`:** обновляется при **`register`** и лёгком **`ping`** (интервал на клиенте ~30 с). В **`device_info`** для браузера задаётся **`surface: 'web'`** (см. **`push-client-init.jsx`**). Хелперы **`isWebSurface` / `isWebActiveRecently`** в **`push.service.js`** зарезервированы под метрики и будущие ветки; **мгновенной** отправки `NEW_MESSAGE` по «hot» больше нет.
- **Правило для `NEW_MESSAGE` с `messageId` в payload (сервер):** для всех токенов (кроме **`FCM_INSTANT_PUSH_DEBUG=1`**) отправка идёт **только** через отложенный канал: **`PREMIUM_CHAT_PUSH_DELAY_MS` ≈ 40 с** (окно 30–45 с), **`mergeOrInsertDelayedChatBatch`** / **`scheduleSimpleDelayedPush`**. Перед FCM вызывается **`shouldStillSendNewMessagePush`** (**`messages.is_read`** для актуального `messageId` в пачке). Если **`is_read: true`** (или строка не найдена) — пуш **не** шлётся.
- **Надёжность на serverless:** фоновая задержка обёрнута в **`waitUntil`** из **`@vercel/functions`** (если доступно); локально/`next start` тот же **`setTimeout`** выполняется в процессе Node.
- **Гигиена токенов:** ответы FCM **`UNREGISTERED` / registration-token-not-registered / Requested entity was not found`** → строка удаляется из **`user_push_tokens`** (**`PushService.deleteInvalidPushToken`**).
- **Миграция колонки:** **`migrations/add_last_seen_at_user_push_tokens.sql`**. Без неё Smart Delivery деградирует (запрос токенов может ошибиться — тогда см. логи Supabase).
- **Anti-spam batching (отложенный канал):** в **одном** ~40-секундном окне для пары (**получатель**, **`senderId`**) несколько сообщений объединяются в **`chat_push_delivery_batch`** (PK `recipient_id` + `sender_id`). Перед отправкой проверяется **`is_read`** у **последнего** `message_id` в пачке; при **>1** сообщении текст пуша: **«У вас новых сообщений от {имя}»** / **«You have new messages from {name}»**. В payload FCM обязателен **`senderId`** (роуты **`chat/messages`**, **`conversations`**, **`from-profile`**). Миграция: **`migrations/create_chat_push_delivery_batch.sql`**; без таблицы — прежняя одиночная отложенная отправка.
- **Тихий час (Silent hours) для `NEW_MESSAGE` (Stage 21.0):** сервер — **`resolveSilentForPushDelivery`** (**`lib/services/push/push-quiet-policy.js`**, вызывается из **`PushService`**) → **`AvailabilityService.resolvePartnerQuietContext`**: TZ листинга (**`listings.metadata.timezone`** при валидном IANA, иначе **`getListingDateTimeZone()`**), окно **23:00–08:00** или персональные **`profiles.quiet_*`** при **`quiet_mode_enabled`**. **`device_info.timezone`** остаётся в токенах для метрик/клиента, но не определяет silent для чат-пуша. **Экстренный контакт:** шаблон **`RENTER_EMERGENCY_CONTACT`** с **`emergencyBypass: true`** всегда с высоким приоритетом FCM.
- **Экстренный контакт — Stage 22.0 (trust & safety):** **`POST /api/v2/bookings/[id]/emergency-contact`** принимает JSON **`checklist`** (три булева, хотя бы один **`true`**), пишет событие в **`bookings.metadata.emergency_contact_events`** с итогом пуша; лимит **1 / 24 ч / бронь** (**`lib/emergency-contact-protocol.js`**, ответ **429** + **`EMERGENCY_RATE_LIMIT`**). Админ: **`/admin/bookings/[id]`** (логи + **Mark as abuse** + exempt), **`GET /api/v2/admin/health`** → **`trustSafety.emergencyContacts24h`**.
- **Stage 23.0 (инцидент-реакция):** успешный **`emergency-contact`** → Telegram в HQ (**`lib/emergency-contact-admin-notify.js`**) + при health/safety — заглушка **`sendEmergencySMS`** (**`lib/services/emergency-contact-protocol.js`**). При **429** арендатор вызывает **`POST .../emergency-support-ticket`** → скрытое от партнёра системное сообщение (**`emergency_rate_limit_context`**) + staff FCM/Telegram; health отдаёт **`trustSafety.emergencyRecentBookings`** со ссылками на аудит брони.
- **Stage 24.0 (Super-App + умная экстренная кнопка):** **`.cursorrules`** — терминология Super-App; жизненный цикл экстренного контакта — **`lib/emergency-contact-eligibility.js`**; тихий час «сейчас» — **`AvailabilityService.isPartnerInQuietHoursNow`**; клиентский контекст — **`GET /api/v2/bookings/[id]/emergency-context`** (см. **Stage 25.0** — поле **`emergencyServiceKind`**); **`UnifiedOrderCard`** показывает красную кнопку только в тихом окне партнёра, иначе ведёт в чат; на стейджинге **`NEXT_PUBLIC_EMERGENCY_ALWAYS_VISIBLE=true`** принудительно показывает кнопку с подписью Debug. В тихом окне в payload добавляется **`silent: '1'`**, FCM **`webpush.headers.Urgency: very-low`**, **`android.priority: normal`**, в **`firebase-messaging-sw.js`** — **`showNotification({ silent: true })`**.
- **Stage 25.0 (категория + единый язык коммуникаций):** **`resolveEmergencyServiceKindFromListing`** / **`resolveEmergencyServiceKindFromCategorySlug`** в **`lib/emergency-contact-protocol.js`**; второй пункт чеклиста экстренного модального окна в **`UnifiedOrderCard`** зависит от **`stay` / `transport` / `service`** (туры **`tour`** — дефолтный текст доступа). Пуш **`RENTER_EMERGENCY_CONTACT`** — тег **`emergency_partner_contact`**; премиум-письма и **`lib/email/booking-email-i18n.js`** — нейтральная терминология партнёра/листинга (RU/EN/ZH/TH где покрыто).
- **Антизависание batched push (Sweeper):** **`POST/GET /api/cron/push-sweeper`** (Bearer **`CRON_SECRET`**) раз в час поднимает «зависшие» строки **`chat_push_delivery_batch`** (дедлайн старше 10 минут), форсирует доставку и очищает таблицу. **`PushService.runStaleChatPushSweeper`** не бросает наружу: битая строка логируется (`console.error` + опционально **`rowErrors`** в JSON), остальные строки обрабатываются; ошибка выборки → **`{ ok: false, error }`** без 500 от необработанного throw. GitHub Actions: **`.github/workflows/push-sweeper.yml`**.
- **Hardening cron-auth (strict):** все роуты в **`/app/api/cron/*`** работают только при строгом совпадении заголовка (`Authorization: Bearer <CRON_SECRET>` или `x-cron-secret`) с env **`CRON_SECRET`**. Если **`CRON_SECRET`** не задан — доступ закрыт (**401**) без fallback-паролей.
- **Ежедневная гигиена FCM:** **`POST/GET /api/cron/push-token-hygiene`** (Bearer **`CRON_SECRET`**) — тихий **`sendSilentBadgeUpdate(token, 0)`** по выборке токенов; ответ **UNREGISTERED** → удаление строки (**`PushService.deleteInvalidPushToken`**). GitHub Actions: **`.github/workflows/fcm-token-hygiene.yml`**.
- **Аудит подмены цены:** каждый вызов **`recordCriticalSignal('PRICE_TAMPERING')`** дополнительно пишет строку в **`critical_signal_events`** (**`migrations/create_critical_signal_events.sql`**) для nightly-сводки в **`scripts/send-e2e-report.mjs`**.
- **Badge + звук (UX):** для `NEW_MESSAGE` и `badge_update` событие прокидывается в **`ChatContext`** (`window` event `gostaylo:push-message`) → `refresh()` списка бесед (при Premium Quiet на видимой вкладке **`postMessage` из SW не приходит** — обновление от **Realtime**). Звук воспроизводится **только** при `document.visibilityState === 'visible'` и **вне** открытого треда.
- **Realtime (Supabase) — единая стратегия переподключения:** модуль **`lib/chat/realtime-subscribe-with-backoff.js`** (`subscribeRealtimeWithBackoff`, опционально **`channelLabel`**, **`minBackoffDelayMs`** — для треда чата не ниже **2 с** между попытками). Любой Realtime-канал чата пересоздаётся при статусах **`CHANNEL_ERROR`**, **`TIMED_OUT`**, **`CLOSED`** с задержкой **`max(minBackoffDelayMs, min(30s, 1000 × 2^min(attempt,5)))`**. В **development** при этих статусах вызывается **`lib/chat/realtime-dev-warn.js`** (проба **`GET /api/v2/auth/realtime-token`**, подсказка про **`SUPABASE_JWT_SECRET`** / RLS / publication). Имена каналов для postgres_changes включают **`attempt`** (в треде — ещё поколение **`g{n}`** при принудительном resubscribe). Потребители: **`lib/context/ChatContext.jsx`** (`conversations` + `messages`: события по RLS; гонка со списком снята — синхронное обновление **`conversationIdsRef`** при **`refresh()`**, без отбрасывания INSERT по ref, при отсутствии строки в state — **`fetchOneConversation`**), **`hooks/use-realtime-chat.js`** (`useRealtimeMessages`: INSERT/UPDATE **`messages` без server-side `filter` — отбор по **`conversation_id`** в JS, **`rowMatchesConversation`**; **heartbeat:** при **≥45 с** без активности (INSERT/UPDATE/SUBSCRIBED) на **видимой** вкладке — пересоздание подписки; **`onResync`** из **`hooks/use-chat-thread-messages.js`** после reconnect — **`GET /api/v2/chat/messages`** и merge по `id`; при **`visibilitychange` → visible** — тот же resync; логи: **`localStorage.setItem('GOSTAYLO_RT_DEBUG','1')`** + **`lib/chat/realtime-debug-log.js`**; **`lib/chat/realtime-messages-filter.js`** зарезервирован под будущий server-side filter), **`lib/context/PresenceContext.jsx`**. Источник истины для текста сообщений — **POST** в API; при длительном офлайне список/тред догружаются через **`GET /api/v2/chat/conversations`** (`enrich=1`) и **`GET /api/v2/chat/messages`**. Очереди исходящих в браузере нет (кроме optimistic UI в отдельных хуках).
- **Realtime JWT (`applyRealtimeSessionJwt`):** **`lib/chat/realtime-session-jwt.js`** — один параллельный `fetch` к **`/api/v2/auth/realtime-token`**, повторный `setAuth` с эквивалентным токеном подавляется (защита от лавины запросов и рекурсии в `removeChannel` при backoff). Сброс кэша — **`resetRealtimeSessionJwtCache`** в cleanup **`components/supabase-realtime-auth-sync.jsx`**; установка токена централизована через **`applyRealtimeAccessTokenToClient`**.
- **Realtime JWT hardening:** если JWT ещё валиден, `applyRealtimeSessionJwt` не делает лишний fetch, но повторно прокидывает токен в `supabase.realtime.setAuth(...)` (восстановление после reconnect сокета без перезагрузки страницы). В **`components/supabase-realtime-auth-sync.jsx`** добавлен forced `sync()` на `focus` + `visibilitychange`, чтобы канал чата восстанавливался при возврате во вкладку.
- **Backoff hardening:** в `subscribeRealtimeWithBackoff` удаление канала вынесено из sync callback (через отложенный шаг) + anti-duplicate guard, чтобы исключить рекурсивный `removeChannel/unsubscribe` (`Maximum call stack size exceeded`).
- **Persisted Presence + Last Seen:** миграция **`migrations/add_profiles_last_seen_at.sql`** добавляет **`profiles.last_seen_at`**. Клиентский **`PresenceProvider`** при `visibilitychange(hidden)` / `pagehide` / `beforeunload` отправляет **`POST /api/v2/presence/last-seen`** (session-only) и пишет timestamp в профиль; UI использует persisted last-seen в хедере и списке диалогов как «Был(а) в сети …».
- **Typing (Broadcast v2.1.9):** единый ref-counted канал **`typing:global:v1`** — **`lib/chat/typing-global-channel.js`**. **`lib/context/ChatContext.jsx`** подписан для агрегации в списке (**`ConversationList`**); **`hooks/use-chat-typing.js`** удерживает тот же канал для отправки **`typing_start`** / **`typing_stop`** (throttle ≈400ms при вводе в композере). В открытом треде подпись «`{name} печатает…`» в **`StickyChatHeader`** строится из **`typingByConversation`** в **`UnifiedMessagesClient`** (тот же поток событий, без второй подписки на другой topic).
- **Inquiry: время и формулировка «сколько человек» в чате/письмах:** для категорий с детальным временем якорь **полуночи UTC** при отображении пересчитывается в начало календарного дня в TZ листинга (**`anchorUtcMidnightToListingDayStartIso`** в **`lib/listing-date.js`**, использование в **`formatInquiryInstantForChat`** в **`lib/services/booking/inquiry.service.js`** и в email через **`lib/email/booking-email-i18n.js`**), чтобы не показывать ложное локальное **07:00** вместо **00:00** по месту объекта. Строка про число участников: **`formatInquiryPartyLineRu` / `formatInquiryPartyLineEn`** — для **vehicles** / **yachts** нейтральные «участники поездки» / **Party size**, для остальных категорий — «гости» / **Guests**.
- **Тред `/messages/[id]` (хост, мобилка) — Stage 6.1:** логика в **`app/messages/[id]/UnifiedMessagesClient.jsx`**; UI-куски — **`app/messages/[id]/components/`** (см. **`docs/ARCHITECTURAL_PASSPORT.md` §0.0i**). При **PENDING** / **INQUIRY** кнопки **Подтвердить / Отклонить** на узком экране дублируются под **`ChatMilestoneCard`** (системные ключи inquiry и **`booking_created`**); **`ChatHeaderActions`** — только **`lg+`** (**`hidden lg:flex`**). **`ChatActionBar`** + **`suppressMobileHostBar`**, если в ленту передан **`partnerInquiryActions`**. Композер хоста: **`PartnerChatComposer`** (динамический импорт), оболочка гостя — **`CHAT_COMPOSER_SHELL_CLASS`**, поле — **`ChatGrowingTextarea`**.
- **Milestone copy по ролям после confirm:** `ChatMilestoneCard` для `system_key=booking_confirmed` показывает разный текст: гостю — шаг оплаты, партнёру — шаг выставления счёта. Это UI-слой поверх общего system payload.
- **Read receipts (галочки):** `POST /api/v2/chat/read` обновляет пер-сторонние колонки (`read_at_renter` / `read_at_partner`) и синхронно ставит **`is_read=true`** для входящих, что гарантирует корректные single/double ticks в **`MessageBubble`**.
- **E2E-фикстуры чата (Playwright):** при **`E2E_FIXTURE_SECRET`** в env приложения и в окружении запуска тестов — **`POST /api/v2/internal/e2e/pending-chat-booking`** (заголовок **`x-e2e-fixture-secret`**) создаёт **PENDING**-бронь и беседу через **`BookingService.createBooking`** (**`lib/e2e/create-pending-chat-booking-fixture.js`**). **`POST /api/v2/internal/e2e/promote-booking-paid-escrow`** — существующая E2E-бронь → **`PAID_ESCROW`** (`EscrowService.moveToEscrow`). Playwright **`guest-inquiry-golden-path.spec.ts`** (проект **`guest-inquiry-golden-path`**): PDP inquiry → next steps → my-bookings → partner confirm → promote. **`E2E_TEST_RUN=1`** в Playwright `webServer` env → Resend mock. Без секрета роут отвечает **404**. Профили партнёра/рентера — **`E2E_PARTNER_EMAIL` / `E2E_RENTER_EMAIL`** (как в **`tests/auth.setup.ts`**); у партнёра должен быть хотя бы один листинг.
- **Stage 133 visual (Playwright):** **`npm run test:visual-referral`** — проект **`referral-dashboard-visual`**, фикстура **`POST /api/v2/internal/e2e/referral-dashboard-visual`** (**`lib/e2e/referral-dashboard-visual-fixture.js`**) сидит амбассадора + команду (фиксированные KPI **400.5 THB**), логин через **`/api/v2/auth/login`**, снимки вкладки «Команда» desktop **1280×800** / mobile **360×640** (**`tests/e2e/referral-dashboard-visual.spec.js-snapshots/`**).
- **E2E тур: математика × гости:** **`POST /api/v2/internal/e2e/tour-booking-math`** (тот же секрет) — **`lib/e2e/create-tour-booking-math-fixture.js`**. Фикстура перебирает даты и оставляет только окна, где итог тура совпадает с **`round(base_price_thb × guests_count)`**, затем создаёт бронь и проверяет **`price_thb === PricingService.total`**. В **`tests/e2e/mobile-chat.spec.ts`** — для **3** гостей: **`price_thb === round(base_price_thb × 3)`** (и совпадение с **`expectedTotalThb`** из ответа).
- **Transport conflict tests:** **`e2e/vehicle-conflict-checker.spec.ts`** проверяет минимальный набор для interval helpers (`day-only protected bounds`, overlap/non-overlap границы, invalid range).
- **Мобильный тактильный отклик кнопок чата:** панель **`components/chat-action-bar.jsx`** — на **`pointerdown`** (и CSS **`active:`**) кратко **`opacity: 0.7`** и **`scale: 0.98`**, атрибут **`data-pressing="true|false"`** для проверок в **`tests/e2e/mobile-chat.spec.ts`**. Не дублировать скрытые процентные наценки вне **`CurrencyService` / комиссии платформы**.
- **CTA «Счёт» в чате после confirm:** вместо крупной плашки в мобильной action bar используется компактная кнопка (`h-9`, inline), чтобы не перекрывать область сообщений; диалог `SendInvoiceDialog` автофокусирует поле суммы и не предзаполняет `0` как «залипшее» значение.
- **Invoice prefill + checkout linkage:** `GET /api/v2/chat/conversations?enrich=1` возвращает `booking.price_thb/currency/guests_count` для корректного префилла суммы счёта; `GET /api/v2/chat/invoice?id=` поддерживает адресный fetch одного счёта (с авторизацией участника диалога), а checkout подтягивает этот счёт по `invoiceId` и выставляет предпочтительный `payment_method`. **AUDIT_03 C3.9:** `syncBookingForPayableChatInvoice` не переписывает amounts при статусах escrow/COMPLETED или при активном `payment_intents` (`CREATED`/`INITIATED`/…) — **409 `BOOKING_ALREADY_PAID`**.
- **Payment Intent bridge (Stage 3 adapters):** `PaymentIntentService.initiate` использует adapter registry (`lib/services/payment-adapters`) и привязку method → adapter key: `CARD -> CARD_INTL`, `MIR -> MIR_RU`, `CRYPTO -> crypto-tron`. Для card/MIR создан live+mock scaffold: `card-intl.adapter.js` (под Mandarin env) и `mir-ru.adapter.js` (под YooKassa env), с сохранением `provider_payload`, `external_ref`, выбранного метода и `allowed_methods` прямо в `payment_intents`.
- **Intent prefetch для Checkout UI:** новый endpoint `GET /api/v2/bookings/[id]/payment-intent` резолвит/создаёт intent до нажатия CTA оплаты; checkout рендерит только методы из `intent.allowedMethods` (и авто-нормализует текущий выбор), чтобы UI и backend-контракт не расходились.
- **Webhook compatibility с intent (primary path):** `POST /api/webhooks/payments/confirm` принимает `payment_intent_id`/`paymentIntentId` из metadata/body как приоритет, затем fallback на `paymentId`/active intent по booking. После `PaymentIntentService.markPaid` запускается единый контур `EscrowService.moveToEscrow` + `applyInvoicePostPaymentEffects`. **Stage 125.1:** если `bookings.status` ∈ `PAYMENT_ACQUIRING_WEBHOOK_IDEMPOTENT_BOOKING_STATUSES` (`isPaymentAcquiringWebhookIdempotentBookingStatus`) — сразу **`{ success: true, idempotent: true, alreadyProcessed: true }`** (SSOT — статус брони, не `payment_intents`); без повторного escrow и без `recordTreasuryWebhookError` 502.
- **Stage 3.1 hardening (signature + status normalization):** в webhook для карт используется adapter-specific signature verification (`MANDARIN_WEBHOOK_SECRET` и `YOOKASSA_WEBHOOK_SECRET`, с fallback на `PAYMENT_ACQUIRING_WEBHOOK_SECRET`) через `lib/services/payment-adapters/webhook-signature.js`; статус провайдера приводится к внутреннему `payment_intents.status` через normalization map (`lib/services/payment-adapters/status-normalizer.js`: `CREATED/INITIATED/PAID/FAILED/CANCELLED/EXPIRED`).
- **Adapter readiness health-check (admin):** `GET /api/v2/admin/payment-adapters/health` (только ADMIN) возвращает готовность env по каждому адаптеру (`CARD_INTL`, `MIR_RU`) и `global`-блок по общим секретам; используется для операционного контроля перед включением live PSP.
- **Admin health UI:** страница `/admin/health` читает `GET /api/v2/admin/payment-adapters/health` и показывает mini-widget «светофор» (green/red) по global/adapters с явным списком missing env.

### 5.1 Mobile Design System (Premium Unified)

- **Скругления 16px:** ключевые блоки чата и связанный UI используют **`rounded-2xl`** (Tailwind = **16px**): лента (`ChatMessageList`), карточки вех/запроса (`ChatMilestoneCard`, **`BookingRequestCard`**), **`ChatActionBar`**, **`ChatSearchBar`** (внутренний контейнер поиска), композеры, статусные бейджи в инбоксе (**`ConversationList`** / `StatusBadge`). Глобально кнопки shadcn — **`rounded-lg`** = **`var(--radius)`** (**`1rem`**) в **`app/globals.css`**.
- **Палитра:** нейтральная база **`bg-white`**; акцент **teal** для primary CTA.
- **Горизонтальные отступы:** минимум **`px-4`** (16px) у оболочек чата, поиска, списка диалогов; лента — **`px-4` / `sm:px-5`**; нижний safe-area — **`CHAT_COMPOSER_SHELL_CLASS`**.
- **Ширина мобильных CTA:** **`w-full`** на мобиле, **`sm:w-auto`** на больших экранах.

### 5.1b List scroll restore (soft-back) — reuse

Канон: **`lib/navigation/route-scroll-memory.js`**. Хост уже в корне: **`RouteScrollMemoryHost`** (`RootClientProviders`). Не вешать page-local **`useRouteScrollMemory`**.

Сейчас в allowlist: **`/`** (`home`), **`/listings`** (ключ с live `?query`), **`/my-bookings`** / **`/renter/bookings`**.

Чтобы тот же сценарий (список → деталь → Back на ту же карточку) заработал на **новой** странице:

1. Добавить pathname → ключ в **`routeScrollKeyFromLocation`** и префикс в **`isScrollMemoryRouteKey`**. Если фильтры в query — ключ строить из **`window.location.search`**, не из React `searchParams` (иначе Back попадёт в чужой ключ, как каталог `semantic=1` vs PDP `checkInTime`).
2. Уход со списка: обычный **`<Link>` / `<a>`** (host сам persist на click) **или** перед **`router.push`** вызвать **`persistLiveRouteScroll({ anchorHref })`**.
3. На детали Back только через **`useSoftBack`** / `AppHeader showSoftBack` (`markPendingRouteScrollRestore`). Restore идёт только на pop/soft-back, не на forward.
4. Persist в момент клика (Next часто обнуляет `scrollY` до unmount). Пока страница ещё растёт (Home widgets / catalog cards), хост **пиннит якорь** (`anchorHref` + `anchorTop`) и коммитит только когда высота документа стабильна (**201.111**). Raw Y — запасной путь (`readWindowScrollY` / `scrollingElement`).

### 5.2 Telegram: продуктовые события и личка админа

- **`NotificationService.dispatch`** — брони, оплаты, письма партнёрам/гостям, топики форума (**`sendToAdminTopic`**).
- **`sendToAdmin`** — личка (`TELEGRAM_ADMIN_DM_CHAT_ID` / `ADMIN_TELEGRAM_ID`) или fallback топик FINANCE.

### 5.3 Системные алерты (топик `TELEGRAM_SYSTEM_ALERTS_TOPIC_ID`)

Единая точка: **`NotificationService.sendSystemAlert`** и обёртка **`notifySystemAlert`** (`lib/services/system-alert-notify.js`). При отсутствии или неверном `TELEGRAM_SYSTEM_ALERTS_TOPIC_ID` — fallback на **`sendToAdmin`**.

| Категория | Примеры условий |
|-----------|-----------------|
| **FX / витрина** | Устаревшие дисплей-курсы (`CurrencyService.maybeAlertStaleDisplayRates`) |
| **Бронирования** | Ошибка INSERT; бронь без чата; необработанное исключение `POST /api/v2/bookings`; ручное бронирование календаря — ошибка БД |
| **Гонка дат** | Повторная **`checkAvailability`** непосредственно перед INSERT в **`BookingService.createBooking`**; при конфликте — **`code: 'DATES_CONFLICT'`**, HTTP **409** из API (полная атомарность возможна только constraint/lock в Postgres) |
| **Чат** | Сбой записи сообщения или инвойса (`POST /api/v2/chat/messages`) |
| **Платежи** | Initiate; **`POST /api/v2/bookings/[id]/payment/confirm`** → **`BookingService.attachSettlementSnapshotForBooking`** → **`EscrowService.moveToEscrow`** → **`PAID_ESCROW`** + ledger; **`PaymentsV3Service.confirmPayment`** (крипто/карта с строкой в **`payments`**) — тот же **`moveToEscrow`**; **AUDIT_03 C3.4:** mid-flight `CONFIRMED`∧¬escrow — reconcile cron; **W3.1:** inquiry без attestation → checkout только после invoice/regate; **W3.5:** пустой `allowed_methods` → **422 `NO_PAYMENT_METHODS_AVAILABLE`** (fail-closed); **W3.11:** crypto FX lock `metadata.usdt_rate_thb` at initiate |
| **Crypto webhook** | `POST /api/webhooks/crypto/confirm` — секрет **`CRYPTO_WEBHOOK_SHARED_SECRET`**; **AUDIT_03 C3.1:** сумма USDT только из **`getExpectedUsdtForBooking`** / **`payment_intents.amount`** (body **`expectedAmount` игнорируется**); **C3.3:** **`verifyTronTransaction`** fail-closed при unresolved/`0` amount (`AMOUNT_UNRESOLVED`); **125.4:** idempotent **2xx** на post-escrow (`bookings.status` SSOT); иначе verify → **`confirmPayment`** / intent + **`moveToEscrow`** |
| **Resend** | Ошибки HTTP/исключения в `NotificationService.sendEmail`, `EmailService`, `admin/partners` |
| **Cron** | Гибрид Vercel + **cron-job.org** (Hobby daily fallback). SSOT: **`lib/cron/cron-registry.js`**, **`docs/runbooks/CRON_EXTERNAL_FINANCIAL.md`** (thaw SLO ≤59m hourly / ≤23h59m daily; duplicate-run = idempotent). Money hourly: **`escrow-thaw`**, **`reconcile-confirmed-payments`**, **`promote-ready-for-payout`**. **M3.6:** **`/api/cron/cleanup-critical-signals`** (90d). Auth: **`timingSafeEqual`** на `CRON_SECRET`. Host: **`https://airento.ru`**. |
| **Webhooks** | `POST /api/webhooks/supabase/booking-status` (JSON, валидация, исключения); crypto — см. строку **Crypto webhook** выше |

**Чат — «тупики» UI:** при **`CANCELLED` / `REFUNDED` / `PAID` / `COMPLETED` / `PAID_ESCROW`** гость не видит панель оплаты (**`ChatActionBar`**, **`payNowHref`** в **`UnifiedMessagesClient`**). Карточка **`BookingRequestCard`**: кнопки партнёра только при **`PENDING`**; бейдж статуса синхронизирован с **`bookingStatus`**.

**Оптимистичный UI (тактильный отклик):** **`Подтвердить` / `Отклонить`** — мгновенное обновление **`booking.status`** в **`UnifiedMessagesClient`** с откатом при ошибке API; панель хоста исчезает без спиннеров. **`Оплатить`** — по клику скрываются **`ChatActionBar`** и десктопная кнопка в **`ChatHeaderActions`** (**`payBarSuppressed`** + **`onPayNowClick`**).

### 5.4 Playwright (локальная среда)

- В **`playwright.config.ts`**: **`loadEnvConfig`** подхватывает **`.env.local`** и **`.env`** (как Next).
- **`globalSetup`:** **`tests/global-setup.ts`** печатает **`[Playwright] E2E_FIXTURE_SECRET: LOADED | MISSING`**; при **LOADED** вызывается **`tests/e2e/seed-e2e-tour.ts`** — при отсутствии листинга **tours** у **`E2E_PARTNER_EMAIL`** создаётся один сид (лог **`E2E tours listing: seeded | already present`**), чтобы сценарии туров и RBAC не скипались.
- **`use.baseURL`:** по умолчанию **`http://localhost:3000`**; переопределение: **`PLAYWRIGHT_BASE_URL`** или **`BASE_URL`**.

### 5.5 Notification Integrity (email + Telegram)

- **Booking confirmed email** строится в **`EmailService.prepareBookingConfirmedGuestEmail`** (и отправляется через `sendBookingConfirmedGuest`):  
  - прямой deep-link в чат: **`/messages/{conversationId}/`** при наличии беседы;
  - календарные кнопки: **Google + Outlook + .ics**;
  - подписанный URL `.ics`: **`/api/calendar/stay?t=...`**;
  - вложение `.ics` (`gostaylo-stay.ics`) в payload Resend (`attachments` base64).
- **Deep-link fallback:** при отсутствии беседы используется **`/messages/`** (NotificationService, helper `buildGuestChatUrlForBooking`).
- **i18n email UX:** для **zh** в `booking-email-i18n.js` акцент на `.ics` (Google может быть недоступен).
- **Telemetry email-failure:** `EmailService.sendEmail` на отказах/исключениях вызывает **`recordCriticalSignal('EMAIL_FAILURE', { tag: '[EMAIL_FAILURE]' ... })`**.
- **Integrity smoke API (e2e):** **`POST /api/v2/test/notifications/integrity`** (под `x-e2e-fixture-secret`) проверяет deep-link, наличие `.ics` attachment и валидность токена кнопки бана Telegram.

### 5.6 E2E Hygiene: маркировка, фильтрация, очистка

- Единый маркер тест-данных: **`[E2E_TEST_DATA]`** (`lib/e2e/test-data-tag.js`).
- **Обязательность:** любые автоматические тесты и серверные фикстуры **обязаны** помечать создаваемые брони (и иные сущности по канону проекта) этим флагом — как минимум в **`bookings.special_requests`** и/или **`bookings.guest_name`** (у листингов: **`title` / `description` / `metadata`**). Скрипт **`scripts/clean-e2e-garbage.mjs`** и **`tests/global-teardown.ts`** удаляют **только** строки с этим маркером; всё без метки **не** считается тестовым мусором и **не** удаляется.
- Фикстуры и сиды (`create-pending-chat-booking-fixture`, `create-tour-booking-math-fixture`, `seed-e2e-tour`) проставляют маркер в `special_requests` / `guest_name` (брони) и в `title` / `metadata` (листинги у сида тура).
- Глобальная фильтрация тест-объектов в «общих» выборках:
  - поиск листингов: `lib/api/run-listings-search-get.js`;
  - SSR листингов: `lib/server-data.js`;
  - `BookingService.getBookings` и chat inbox `GET /api/v2/chat/conversations`.
- **Playwright global teardown:** `tests/global-teardown.ts` — **снайперская** уборка: только брони с **`[E2E_TEST_DATA]`** в `special_requests` / `guest_name`, затем сообщения и беседы с **`conversations.booking_id`** из этого набора (плюс связанные `payments` / `invoices` / `telegram_chat_reply_map` при наличии). **`profiles`** и **`listings`** **не** удаляются. На прод-smoke (`RUN_PRODUCTION_SMOKE=1`) teardown отключён. Подробнее: **§10**.
- **Скрипт после nightly:** `scripts/clean-e2e-garbage.mjs` — та же политика, что и teardown; пишет итог в **`ops_job_runs`** (`job_name`: **`clean-e2e-garbage`**). Флаг **`--dry-run`** — только счётчики в stdout, без удалений и без записи в **`ops_job_runs`**.

---

## 6. План масштабирования базы данных и запросов

### 6.1 Индексы (рекомендуемые SQL, когда объёмы &gt; ~1000 строк и растут)

**`messages`** — история по треду: каноническая миграция **`database/migrations/019_messages_thread_and_listings_map_indexes.sql`** (составной **`conversation_id`, `created_at DESC`**). Для больших таблиц в проде при отдельном окне обслуживания допустима замена на **`CREATE INDEX CONCURRENTLY`**.

**`listings`** — каталог + гео-фильтры:

- Уже полезны: **`district`**, **`status`**, **`available`**, **`category_id`** (см. `prisma/schema.prisma`).
- **Карта:** в той же миграции **019** — частичный B-tree **`(latitude, longitude) WHERE … IS NOT NULL`**; для «точки в полигоне» без PostGIS остаётся фильтр в приложении; при переходе на **PostGIS** — **`GIST`** по **`geography(point)`** / **`ST_MakePoint(longitude, latitude)`**.
- Полнотекст / вектор: см. миграции embedding (**`004_listings_embedding.sql`**); для поиска по названию — **`GIN`** по `to_tsvector` при росте нагрузки.

**`bookings`** — календарь и анти-овербукинг на уровне БД (долгосрочно): уникальность пересечений для **`listing_id` с max_capacity = 1** задаётся через **EXCLUDE** / триггеры или сериализуемые транзакции — вынести в отдельную миграцию после продуктового решения.

### 6.2 N+1 и тяжёлые циклы в `lib/services/`

- **`EscrowService.processAllPayoutsForToday`**: код остаётся для ручного/отладочного вызова; **плановый cron** автоматических банковских выплат **отключён** (см. **`vercel.json`**). Разморозка эскроу — отдельно **`processDueEscrowThaws`** (**`/api/cron/escrow-thaw`**). При включении пула: **`mapWithConcurrency`**, **`PAYOUT_CRON_CONCURRENCY = 5`**, шаг **`processPayout(bookingId)`**.
- **`app/api/cron/ical-sync`**: вложенные циклы листинги × источники — ожидаемо; оптимизация — батчить листинги с одинаковым интервалом, кэшировать HTTP iCal.
- **`CalendarService.getCalendar`**: один проход по датам после загрузки блоков/броней — не N+1 к БД внутри цикла по дням; держать окно **`getCalendar(listingId, 365, …)`** осознанным.

### 6.3 Наблюдения по предыдущим этапам (кратко)

- Системные алерты завязаны на env; на staging проверить **`TELEGRAM_SYSTEM_ALERTS_TOPIC_ID`** и лимиты Telegram.
- Финальная **`checkAvailability`** перед INSERT снижает, но не устраняет гонку — зафиксировано выше.
- **Zero skip (бронь / RBAC / туры):** **`E2E_FIXTURE_SECRET`**, **`SUPABASE_SERVICE_ROLE_KEY`** и **`NEXT_PUBLIC_SUPABASE_URL`** должны быть доступны процессу Playwright (те же **`.env.local` / `.env`**, что подхватывает **`loadEnvConfig`** в **`globalSetup`**), иначе сид тура не выполнится. Профили **`E2E_PARTNER_EMAIL` / `E2E_RENTER_EMAIL`** (дефолт партнёра совпадает с **`tests/auth.setup.ts`**). Строка **`[Playwright] E2E_FIXTURE_SECRET: LOADED`** и лог **`E2E tours listing: seeded | already present`** подтверждают готовность; при **MISSING** секрета или без service role часть сценариев остаётся **skipped**.

---

## 7. Указатель на ядро (файлы)

| Область | Файл(ы) |
|--------|---------|
| FX / комиссия / чат-курс | `lib/services/currency.service.js`, `lib/services/currency-last-resort.js` |
| Admin: здоровье дисплей-курсов | `GET /api/v2/admin/exchange-rates-health`, `app/admin/dashboard/page.js` |
| Отображение символов валют | `lib/currency.js` (`CURRENCIES`, `formatPrice`) |
| Календарь + бронь | `lib/services/calendar.service.js`, `lib/services/booking.service.js` |
| Цены по датам | `lib/services/pricing.service.js` |
| iCal → блоки | `lib/services/ical-calendar-blocks-sync.js` |
| Категории / UI брони | `lib/listing-booking-ui.js`, `lib/listing-category-slug.js` |
| Туры: metadata группы + миграция | `lib/partner/listing-wizard-metadata.js` |
| Сумма в карточке запроса в чате (туры × гости, жильё × ночи) | `lib/chat-booking-totals.js` (`resolveChatBookingBreakdown`) |
| E2E: PENDING + чат для mobile-chat | `lib/e2e/create-pending-chat-booking-fixture.js`, `app/api/v2/internal/e2e/pending-chat-booking/route.js` |
| E2E: Stage 133 referral team visual | `lib/e2e/referral-dashboard-visual-fixture.js`, `app/api/v2/internal/e2e/referral-dashboard-visual/route.js`, `tests/e2e/referral-dashboard-visual.spec.js` |
| E2E: тур × гости (mobile-chat) | `lib/e2e/create-tour-booking-math-fixture.js`, `app/api/v2/internal/e2e/tour-booking-math/route.js` |
| E2E: integrity уведомлений | `app/api/v2/test/notifications/integrity/route.js`, `e2e/notifications-integrity.spec.ts` |
| Чат + статусы брони | `app/api/v2/chat/messages/route.js`, `lib/services/chat/access.js`, `lib/booking-status-chat-sync.js` |
| Auth edge + login | `middleware.ts`, `app/login/page.js`, `app/admin/layout.js` |
| Realtime чат (backoff) | `lib/chat/realtime-subscribe-with-backoff.js`, `hooks/use-realtime-chat.js`, `lib/context/ChatContext.jsx` |
| Платежи / эскроу | `lib/services/payments-v3.service.js`, `lib/services/escrow.service.js`, `app/api/cron/escrow-thaw`, `lib/escrow-thaw-rules.js` |
| Политика задержки выплат | `system_settings.general.settlementPayoutDelayDays`, `system_settings.general.settlementPayoutHourLocal` |
| Admin presets для fee/payout policy | `app/admin/settings/page.js`, `app/api/admin/settings/route.js` |
| Системные TG-алерты | `lib/services/system-alert-notify.js`, `NotificationService.sendSystemAlert`, `lib/critical-telemetry.js`, `lib/services/fraud-telegram-ban-button.js` |
| Admin: бан пользователя (TG link + API) | `POST/GET /api/v2/admin/users/ban`, `lib/auth/telegram-ban-link.js` |
| E2E hygiene helper / cleanup | `lib/e2e/test-data-tag.js`, `tests/global-teardown.ts`, `scripts/clean-e2e-garbage.mjs` |
| Security Bot №27 (RBAC гость /admin) | `tests/e2e/security-bot.spec.ts`, проект **`security-bot`** |
| Speed Bot №28 (LCP + `[PERFORMANCE_LOW]`) | `tests/e2e/speed-bot.spec.ts`, `app/api/v2/internal/e2e/performance-low-alert/route.js`, проект **`speed-bot`** |
| SEO Spy Bot №25 + TG алерт | `tests/e2e/seo-spy-bot.spec.ts`, `app/api/v2/internal/e2e/seo-spy-alert/route.js` |
| Accountant Bot (Deep Financial Math) + TG `recordCriticalSignal` | `tests/e2e/bots/accountant-math.spec.ts`, `app/api/v2/internal/e2e/financial-error-alert/route.js`, `lib/currency.js` (`priceRawForTest`) |
| Polyglot UX Bot (TH/ZH) | `tests/e2e/bots/polyglot-ux.spec.ts`, проект **`polyglot-bot`**, `data-testid` языка и CTA |
| Серверная броня цены | `lib/booking-price-integrity.js`, `lib/services/booking.service.js`, `POST /api/v2/bookings` |
| List scroll restore (Back) | `lib/navigation/route-scroll-memory.js`, `components/navigation/RouteScrollMemoryHost.jsx`, `hooks/use-soft-back.js`; allowlist `routeScrollKeyFromLocation` |
| i18n UI | `lib/translations/index.js`, `getUIText`, `app/listings/[id]/layout.js` (metadata + цена) |
| Playwright env + лог секрета + сид tours | `playwright.config.ts`, `tests/global-setup.ts`, `tests/e2e/seed-e2e-tour.ts` |

---

## 8. Security & Admin Controls

### 8.1 Мгновенное реагирование через Telegram

- Системные алерты (**`notifySystemAlert`** → **`NotificationService.sendSystemAlert`**) уходят в топик **`TELEGRAM_SYSTEM_ALERTS_TOPIC_ID`** (или fallback **`sendToAdmin`**). Для сценариев **`[FRAUD_DETECTION]`** с известным пользователем в алерте добавляется **inline keyboard** со ссылкой на **`GET /api/v2/admin/users/ban?t=…`**: токен подписан HMAC (**`lib/auth/telegram-ban-link.js`**, секрет **`TELEGRAM_ADMIN_BAN_SECRET`** или fallback **`JWT_SECRET`**).
- **`POST /api/v2/admin/users/ban`** принимает JSON **`{ userId, banToken? }`**: либо сессия **ADMIN** (`gostaylo_session`), либо валидный **`banToken`** для того же **`userId`**. Действие: **`profiles.is_banned = true`** (миграция **`database/migrations/020_profiles_is_banned.sql`**) и **`supabase.auth.admin.updateUserById(…, { ban_duration })`** — аннулирование сессий Supabase Auth; параллельно **middleware** (`middleware.ts`) при каждом заходе в защищённые зоны опрашивает **`profiles.is_banned`** через REST (service role), при **`true`** сбрасывает cookie и отправляет на логин. Логин и **`GET /api/v2/auth/me`** отклоняют забаненных.

### 8.2 Critical Telemetry (архитектура)

- **`lib/critical-telemetry.js`** — скользящие окна и пороги по ключам сигналов (например **`PRICE_MISMATCH`**), анти-спам между алертами; единая точка вызова **`notifySystemAlert`** с опциональным **`reply_markup`**.
- Тяжёлые вызывающие модули импортируют только **`system-alert-notify.js`** / **`recordCriticalSignal`**, не дублируя Telegram-транспорт.

### 8.3 Интернационализация (i18n)

- Пользовательский текст в зонах **рентера и партнёра** выводится через **`getUIText`** и слои в **`lib/translations/`** (в т.ч. **`ui.js`**, **`renter-reviews-flow.js`**, публичные строки листингов). Хардкод по **`language === 'ru'`** в этих кабинетах убран в пользу ключей словаря; язык UI синхронизируется с **`gostaylo_language`** (localStorage + cookie) и контекстом **`useI18n`**; серверные **`generateMetadata`** / каталог — **`getLangFromRequest`** (см. Stage 3.1).
- **Stage 42.1/42.2/42.3:** список языков и **`resolveUserLocale`** — **`lib/i18n/locale-resolver.js`**; **`supportedLanguages`** в **`lib/translations/index.js`** из того же модуля. Сессия: **`GET/PATCH /api/v2/auth/me`** отдаёт/принимает **`preferred_language`**; **`PATCH /api/v2/profile/me`** поддерживает `preferred_language` (а с Stage 43.0 также `instant_booking`). **`I18nProvider`** подтягивает локаль из **`/api/v2/auth/me`** при загрузке и пишет в БД debounced при **`setLanguage`**; после подтверждённого `401` ставит `authStatus='unauthenticated'` и больше не шлёт PATCH локали. Поиск с датами: batch-RPC **`batch_check_listing_availability`** (миграция **`010_stage42_batch_availability_check.sql`**) через **`CalendarService.checkBatchAvailability`** заменяет N+1 проверки в **`run-listings-search-get.js`**. Stage 42.3: RPC отдаёт сезонную **`price_grid`**, но точный guest-payable итог поиска считает **PricingService SSOT** (сезоны, duration discount, promo, service fee, pot rounding); **`pricing.totalPrice`** в поиске = rounded guest payable за выбранный диапазон, **`is_promo_applied`** прокинут в ответ. SSOT валидации профиля: **`lib/validation/profile-schema.js`** используется в `/api/v2/auth/me` и `/api/v2/profile/me`.
- **Stage 43.0 (Search SQL-first filters, 2026-04):** каталог переведён с JS-постфильтрации на SQL-предикаты для **`amenities`** (JSONB `.contains`), **`metadata->bedrooms`**, **`metadata->bathrooms`** и **`instant_booking`**. Добавлен словарь SSOT **`lib/constants/amenities-dictionary.js`** (используется в визарде и в поиске), миграция **`011_stage43_search_sql_filters.sql`** (колонка `listings.instant_booking` + GIN индекс по `metadata->'amenities'`), а гео в поиске унифицировано только по колонкам **`latitude`/`longitude`**. Синхронизация instant booking: профиль обновляет «наследуемые» листинги, а явное сохранение листинга имеет приоритет и синхронизирует профиль.

**Stage 44.0 (Trust + review aggregates + amenity icons, 2026-04):** миграция **`012_stage44_listing_review_aggregates.sql`** — **`listings.avg_rating`**, триггер на **`reviews`** для синхронизации **`reviews_count`**, **`avg_rating`**, **`rating`**. **`runListingsSearchGet`** и **`GET /api/v2/listings/[id]`** отдают **`ownerVerified`**, **`avgRating`** / **`average_rating`**, счётчики отзывов. Словарь удобств: поле **`iconName`** + **`AmenityLucideIcon`**; фильтр поиска показывает иконки. Семантический слой: **`fetchSemanticListingMatches`** → RPC **`match_listings`** (только `embedding` + `status`); **`mergeSemanticHitsIntoListingOrder`** поднимает совпадения вверх среди уже отфильтрованного SQL-набора; при пустой выдаче — optional inject по id из семантики (с **`category_id`** если задан). Roadmap: расширить **`match_listings`** опциональными предикатами (цена, категория, `listing_ids` из первого прохода) или двухфазный «SQL ids → vector rerank» для строгого соответствия всем фильтрам.

**Stage 45.1 (Stability & Safety Overhaul, 2026-04):** финальный insert в `createBooking` переведён на БД-RPC **`create_booking_atomic_v1`** (миграция **`013_stage45_atomic_booking_numeric_filters.sql`**): в одной транзакции блокируется строка листинга (`FOR UPDATE`), проверяется занятость по **`bookings`** + **`calendar_blocks`**, затем выполняется `INSERT` (на конфликте — **`DATES_CONFLICT`**; API возвращает **409**). Это закрывает race-window «checkAvailability → insert» для non-vehicle inventory. В `POST /api/v2/bookings` добавлен enforce `instant_booking`: если `listings.instant_booking = true` и нет `privateTrip/negotiationRequest`, создаётся стандартная бронь сразу со статусом **`CONFIRMED`** (без inquiry/pending). Поиск: фильтры спален/ванных больше не сравнивают JSON-строки — введены integer-колонки **`bedrooms_count`** / **`bathrooms_count`** (backfill + trigger sync from metadata + индексы для ACTIVE), `runListingsSearchGet` фильтрует по колонкам.

**Stage 45.2 (Global TZ SSOT + financial read model, 2026-04):** добавлен единый резолвер TZ листинга в JS **`lib/geo/listing-timezone-ssot.js`** (приоритет `metadata.timezone` IANA → country fallback → env default), и SQL-эквивалент **`resolve_listing_timezone_v1`** (миграция **`014_stage45_timezone_ssot.sql`**). `CalendarService` считает `rangeStart`, календарные даты бронирований/блоков и `today` в timezone листинга; атомарная RPC **`create_booking_atomic_v1`** принимает `p_listing_tz` и больше не использует хардкод `Asia/Bangkok` для night-window. Для финансового SSOT чтения добавлен сервис **`readBookingFinancialSnapshot(bookingId)`** (`lib/services/booking-financial-read-model.service.js`) с единым output по subtotal / service fee / host commission / taxable margin / partner payout; `GET /api/v2/bookings/[id]` возвращает его как **`financial_snapshot_read_model`**. PDP блок владельца (`components/listing/ListingInfo.jsx`) показывает тот же бейдж доверия, что каталог: **`listingCard_verifiedPartner`**.

**Stage 45.3 (Partner finance SSOT + map adapter, 2026-04):** read-model дополняет партнёрские **`gross` / `fee` / `net`** (THB). **`GET /api/v2/partner/bookings`** отдаёт **`financial_snapshot`** на элемент; **`GET /api/v2/partner/finances-summary`** — корзины Pending/Escrow/Available/Total paid, **`portfolio`**, **`reconciliation`** с **`LedgerService`** (**`sumPartnerPayoutDebitsThb`**). UI **`/partner/finances`** не считает комиссии в браузере. **`lib/maps/map-provider-adapter.js`** — слой над Leaflet для price-pill и гео-хелперов; поисковая карта импортирует адаптер.

**Stage 46.0 (Partner financial transparency + PDF, 2026-04):** **`GET /api/v2/partner/bookings/[id]`** включает тот же **`financial_snapshot`**, что и список (**`buildBookingFinancialSnapshotFromRow`** + **`transformPartnerBookingToClient`**). UI: **`PartnerFinancialSnapshotDialog`** + кнопка в **`UnifiedOrderCard`** (роль partner). **`GET /api/v2/partner/finances-statement-pdf`** (`from`/`to` **YYYY-MM-DD**, UTC по **`created_at`**) — PDF-выписка из read-model (**`renderPartnerFinancialStatementPdf`**). **`GET /api/v2/partner/stats`** и дашборд показывают **net** из снимка (**`partnerNetThb`** на pending/upcoming). **`/partner/finances`** — блок скачивания PDF + CSV как раньше.

**Stage 46.1 (Partner calendar SSOT + THAWED occupancy, 2026-04):** **`GET /api/v2/partner/calendar`** делегирует в **`CalendarService.getCalendarForDateRange`** + **`mapPartnerCalendarGridRow`** (без дублирования ночей/промо). **`OCCUPYING_BOOKING_STATUSES`** + **`THAWED`**. Календарь партнёра: **`CalendarGrid`** / **`CalendarMobileAgenda`** на **`getUIText`** (`partner-calendar-modals.js`). Финансы: разбор по строке + PDF month presets.

**Stage 47.0 (Notifications + chat→finance + PDF Unicode, 2026-04):** **`handleNewBookingRequest`**: **`PushService.sendToUser`** (**`BOOKING_REQUEST`** / **`BOOKING_INSTANT_PARTNER`**), email instant vs request. **`thawBookingToThawed`**: **`PARTNER_FUNDS_THAWED_AVAILABLE`** + **`sendPartnerFundsThawedEmail`** (отзыв партнёра — **47.2**, не при thaw). **`PartnerChatCalendarPeek`**, PDF Noto, PDP, демо календаря.

**Stage 47.1 (Push zh/th + payout stub, 2026-04):** **`PushService`**: **`normalizePushUiLang`**, **`pickLocalizedTemplateStrings`**; zh/th на **`BOOKING_INSTANT_PARTNER`**, **`FUNDS_THAWED_PARTNER`**; **`NEW_MESSAGE`** defaults. **`POST /api/v2/partner/payouts/request`** — stub. **`/partner/finances`**: withdraw modal. Опциональное лого PDF.

**Stage 47.2 (Thaw vs review + client wording + PDF title, 2026-04):** **`FUNDS_THAWED_PARTNER`** сразу при **`THAWED`**; **`PARTNER_GUEST_REVIEW_INVITE`** только после **`check_out`** (крон **`/api/cron/partner-client-review-invite`**, **`partner-client-review-invite-cron.service.js`**, dedup **`metadata.partner_client_review_invite_at`**). Пуш **`PARTNER_GUEST_REVIEW`**: плейсхолдер **`{client}`**, копирайт по категории в **`getPartnerGuestReviewPromptCopy`**. PDF: **`Financial Statement — ${getSiteDisplayName()}`** (**`lib/site-url.js`**; см. **49.0** — fallback **`Platform`**).

**Stage 47.3 (Listing category SSOT map, 2026-04):** только документация + **`ARCHITECTURAL_DECISIONS.md`** §**10** — карта файлов (**`resolveListingCategorySlug`**, **`metadata.listing_category_slug`**, **`listing-category-slug.js`**, **`escrow-thaw-rules.js`** vs **`listing-service-type.js`**, ветка **tour** vs thaw-bucket **`service`**, чеклист новой **`categories.slug`**). Кодовые пути эскроу/thaw/уведомлений **не менялись**.

**Stage 48.0 (Payout KYC + financial_snapshot.category_slug + cron hygiene, 2026-04):** **`profiles.is_verified`** обязателен для **`POST /api/v2/partner/payouts/request`** и **`POST /api/v2/partner/payouts`** (**`lib/partner/partner-payout-kyc.js`**, ответ **403** `PROFILE_NOT_VERIFIED`). **`buildBookingFinancialSnapshotFromRow`**: поле **`category_slug`**. Блокировка вывода до KYC + i18n на **`/partner/finances`**. Убран **`console.log`** из **`notifyUpcomingThaw`** (**`thaw.service.js`**).

**Stage 49.0 (Taxonomy doc + tour income badge + brand + cron SSOT, 2026-04):** паспорт — **«Category SSOT & Business Logic Mapping»** (slug → **3 thaw-buckets** vs **4 UI-типа**). Бейдж **Тур** на финансах (**`MapPin`**). **`getSiteDisplayName()`**: **`NEXT_PUBLIC_SITE_NAME`** / **`SITE_DISPLAY_NAME`** или **`Platform`** (без hostname); premium-email шапка/футер; пуши **`{siteName}`**; subject письма о разморозке. Кроны: **`lib/cron/verify-cron-secret.js`** (**`assertCronAuthorized`**). Удалён **`docs/CALENDAR_AUDIT_REPORT.md`**.

**Stage 50.0 (White-label emails + partner CSV category + PDF header, 2026-04):** **`lib/services/email.service.js`** — welcome / bookingRequested / partnerApproved и имя вложения **`.ics`** без хардкода бренда; **`lib/email/booking-email-i18n.js`** — **`{brand}`** в эскроу, pre-calendar line, alt fallback; **`lib/email/calendar-links.js`**, **`lib/calendar/stay-ics.js`**, **`lib/email/premium-email-html.js`** (alt карточки). **`lib/services/notification.service.js`** — fallback plain-text письма и **`escrowCheckInSecurityMessageRu()`**; **`lib/services/notifications/email.service.js`** — футер **`textToHtml`**. **`lib/services/push.service.js`** — fallback **`sender`** для чат-пуша = **`getSiteDisplayName()`**. **`/partner/finances`** CSV — колонка **`financial_snapshot.category_slug`** (**`partnerFinances_csvCategory`**). PDF: **`partner-finances-pdf.service.js`** — меньше **`moveDown`** под заголовком.

---

## 9. Environment Variables & Secrets (критичные для продакшена)

Кратко о переменных, без полного каталога всех ключей.

### 9.1 Server-side Integrity (не секрет, но канон среды)

- **Минимальный итог к оплате гостю (THB):** **`MIN_BOOKING_GUEST_TOTAL_THB = 100`** в **`lib/booking-price-integrity.js`** — проверяется в **`BookingService`** при **`POST /api/v2/bookings`** (не обходится клиентом). Нарушения и попытки подмены цены сопровождаются **`notifySystemAlert`** с префиксом **`[SECURITY_ALERT]`**; для price tampering используется префикс **`[PRICE_TAMPERING]`** (дополнительно **`[FRAUD_DETECTION]`** / **`recordCriticalSignal`**).
- **Аттестация итога:** фронт листинга передаёт **`clientQuotedGuestTotalThb`** (округлённый **`finalTotal`**) вместе с **`clientQuotedSubtotalThb`**; расхождение с сервером → **`PRICE_MISMATCH`**.

| Переменная | Назначение |
|------------|------------|
| **`NEXT_PUBLIC_SITE_NAME`** (и **`SITE_DISPLAY_NAME`**) | Короткое имя для PDF, premium-email, плейсхолдера **`{siteName}`** в пушах (**`getSiteDisplayName()`** в **`lib/site-url.js`**). Если не задано — **`Platform`** (white-label SSOT). |
| **`CALENDAR_STAY_LINK_SECRET`** | HMAC-секрет для подписи токенов ссылки **`GET /api/calendar/stay?t=…`** (кнопки «добавить в календарь» и вложение `.ics` в письмах). В **production** обязателен: без него модуль **`lib/calendar/calendar-stay-token.js`** бросает ошибку. В dev при отсутствии — предупреждение и fallback (только для локальной разработки). |
| **`TELEGRAM_ADMIN_BAN_SECRET`** | Отдельный секрет для подписи одноразовых ссылок бана из Telegram (**`lib/auth/telegram-ban-link.js`** → **`GET /api/v2/admin/users/ban?t=…`**). Если не задан, используется fallback **`JWT_SECRET`** (менее изолированно). Рекомендуется выделенный секрет в проде. |
| **`TELEGRAM_SYSTEM_ALERTS_TOPIC_ID`** | ID **топика** (forum thread) в админской Telegram-группе для **системных алертов** (**`NotificationService.sendSystemAlert`** / **`notifySystemAlert`**): FX stale, сбои брони/чата/платежей, cron, webhooks, **`[SENTRY]`** (Stage 202.0) и т.д. При отсутствии или неверном значении — fallback **`sendToAdmin`** (личка / топик FINANCE). См. §1.6 и §5.3. |
| **`TELEGRAM_USER_FEEDBACK_TOPIC_ID`** | Опциональный топик для product feedback (Stage **202.0**). Если не задан — fallback на **`TELEGRAM_SYSTEM_ALERTS_TOPIC_ID`**. |
| **`SENTRY_DSN`** / **`NEXT_PUBLIC_SENTRY_DSN`** | Opt-in Sentry (Stage **202.0**). Пусто → полный no-op (CI/Preview). Нет Session Replay / Profiling. |

---

## 10. E2E Hygiene System (правила и обязательность)

0. **Nightly CI:** GitHub Actions **`.github/workflows/playwright.yml`** — **03:00 UTC**, **`npm run test:e2e:nightly`** (keep-list: escrow/inquiry/checkout/RBAC/wizard/calendar/accountant/security — Stage **201.11**). Не входит: stage72, visual referral, chat-stress, seo/speed/polyglot, CRO, discovery. Затем Telegram-сводка + **`cleanup-test-data.mjs --execute`**. Полный набор — локально / staging: **`npx playwright test`**.

1. **Маркер данных (обязательно для автотестов):** любые автоматические тесты и фикстуры **обязаны** метить создаваемые данные флагом **`[E2E_TEST_DATA]`** (константа **`lib/e2e/test-data-tag.js`**). Система очистки (**`global-teardown`**, **`clean-e2e-garbage.mjs`**) **игнорирует** всё, что **не** содержит этот маркер в разрешённых полях (для броней: **`special_requests`**, **`guest_name`**), чтобы не затронуть ручные брони пользователей.
2. **Фильтрация в коде:** поиск листингов, SSR, `BookingService.getBookings`, **`GET /api/v2/chat/conversations`** (для не-staff) исключают помеченные записи; для Playwright при заголовке **`x-e2e-test-mode`** фильтр можно обходить (см. роут conversations).
3. **`globalTeardown` + скрипт:** в **`playwright.config.ts`** указан **`tests/global-teardown.ts`** — после локального/CI прогона снайперское удаление только помеченных броней и связанных **`messages` / `conversations`** (без **`profiles`** и **`listings`**). Вручную или после nightly: **`node scripts/clean-e2e-garbage.mjs`** (**`--dry-run`** — без удалений и без **`ops_job_runs`**).
4. **Production smoke:** проекты **`setup-production-smoke`** + **`production-smoke`** включаются только при **`RUN_PRODUCTION_SMOKE=1`**; базовый URL — **`PRODUCTION_SMOKE_URL`** (по умолчанию **`https://gostaylo.com`**). Сценарии **не** вызывают internal fixture API (нет лишних броней и уведомлений реальным хостам); используются учётные данные **`E2E_PARTNER_EMAIL`** / **`E2E_PASSWORD`**. При **`RUN_PRODUCTION_SMOKE=1`** teardown **не выполняется** (защита прод-БД из `.env`). Опционально: **`E2E_PRODUCTION_LISTING_ID`** для стабильной карточки листинга.

---

## 11. Bots & monitoring (активные патрули)

### 11.1 SEO Spy Bot (сценарий №25) — **активен**

- Реализация: Playwright **`tests/e2e/seo-spy-bot.spec.ts`**, проект **`seo-spy-bot`** в **`playwright.config.ts`**.
- Логика: **3–4** случайных **ACTIVE** листинга из **`GET /api/v2/search`** (`data.listings`; тестовые объекты с **`[E2E_TEST_DATA]`** отфильтрованы на стороне API).
- Проверки: непустые **`title`**, **`meta[name="description"]`**, **`og:title`**, **`og:description`**, **`og:image`**; при **`basePriceThb` &gt; 0** — строка цены с витрины (**`data-testid="listing-hero-price"`** в **`components/listing/BookingWidget.jsx`**) должна встречаться в объединённом тексте title/description/og (согласованность с **`generateMetadata`** в **`app/listings/[id]/layout.js`**).
- Алерт при провале: **`POST /api/v2/internal/e2e/seo-spy-alert`** с заголовком **`x-e2e-fixture-secret`** (**`E2E_FIXTURE_SECRET`**) → **`notifySystemAlert`** → топик **`TELEGRAM_SYSTEM_ALERTS_TOPIC_ID`**, префикс **`[SEO_FAILURE]`** и URL страницы (детали причины во второй строке HTML).

### 11.2 Accountant Bot (Deep Financial Math) — **активен**

- Реализация: Playwright **`tests/e2e/bots/accountant-math.spec.ts`**, проект **`accountant-bot`** в **`playwright.config.ts`**.
- Витрина (листинг, **vehicles**, **3 суток**): **`Итог ≈ Субтотал + Сервисный сбор`** в **THB / RUB / USD**; атрибуты **`data-test-subtotal-value`**, **`data-test-subtotal-thb`**, **`data-test-fee-value`**, **`data-test-fee-thb`** (**`booking-breakdown-service-fee`**), **`data-test-raw-value`** / **`data-test-total-thb`** на итоге, **`data-test-payout-value`** + **`data-test-payout-thb`** (скрытый) — выплата партнёра; строгая идентичность **субтотал − выплата = сбор** проверяется в **THB** (канон), чтобы избежать дрейфа округления FX по строкам.
- **Распределение дохода (Split Fee v3.5.0):** **User Total** (гость) = **`price_thb + commission_thb + rounding_diff_pot`**, где `commission_thb` = **guest service fee**; **Host commission** считается отдельно (`commission_rate`, `applied_commission_rate`) и влияет на **`partner_earnings_thb`**; **Platform gross margin** = guest fee + host commission; **`settlement_v3.insurance_reserve_amount`** = доля от platform margin по `insuranceFundPercent`; **`taxable_margin_amount`** фиксирует базу налога агрегатора: `guest_paid_thb - partner_earnings_thb`.
- **Ledger (double-entry, THB):** миграция **`database/migrations/030_financial_phase1_5_ledger_booking_metadata.sql`** — таблицы **`ledger_accounts`**, **`ledger_journals`**, **`ledger_entries`** и колонка **`bookings.metadata`**. Проводка **после фактического зачисления** при переходе брони в **`PAID_ESCROW`** внутри **`EscrowService.moveToEscrow`** (вызов из **`PaymentsV3Service.confirmPayment`**): **DEBIT** `GUEST_PAYMENT_CLEARING` на полную сумму гостя; **CREDIT** партнёрский счёт (`PARTNER_EARNINGS` + `partner_id`), **PLATFORM_FEE** (маржа минус страховой резерв), **INSURANCE_FUND_RESERVE**, **PROCESSING_POT_ROUNDING** (`rounding_diff_pot`). Идемпотентность: **`ledger_journals.idempotency_key = booking_payment_capture:{booking_id}`**. Реализация: **`lib/services/ledger.service.js`**. Админ: **`GET /api/v2/admin/ledger-balances`**, **`GET /api/v2/admin/ledger-reconciliation`** (MVP **Booking Capture**: **DEBIT** clearing vs **CREDIT** только в таких журналах; **CREDIT** на **`PARTNER_PAYOUTS_SETTLED`** в распределение не входят; **`distributionScope`**, smoke **`payoutSelfCheck`**, при расхождении smoke — **`console.warn`**), UI **`/admin/financial-health`** (подтверждение **PAID/FAILED** через **AlertDialog**). Миграции **`031_payout_status_paid_failed.sql`** (enum **`payout_status`**: **PAID**, **FAILED**) и **`032_ledger_payout_settlement.sql`** (**`ledger_journals.booking_id`** nullable + счёт **`PARTNER_PAYOUTS_SETTLED`**). Ручная выплата: **`LedgerService.postPartnerPayoutObligationSettled`**, idempotency **`payout_obligation_settled:{payout_id}`**.  
  *Примечание:* статус **`CONFIRMED`** у брони в продукте — чаще **подтверждение партнёра до оплаты**; бухгалтерское признание выручки завязано на **`PAID_ESCROW`** (оплата подтверждена и эскроу создан).
- **PR-#2 эскроу и баланс партнёра:** миграция **`database/migrations/033_pr2_escrow_thaw_partner_balance_payout_fk.sql`** — enum **`booking_status`**: **`THAWED`**; **`bookings.escrow_thaw_at`**; **`profiles.frozen_balance_thb`**, **`profiles.available_balance_thb`** (синхронизация из **`EscrowService.syncPartnerBalanceColumns`**); **`partner_payout_profiles.method_id`** → FK на **`payout_methods`** с **`ON DELETE SET NULL`** (смена/удаление метода не ломает ledger). Разморозка: **`PAID_ESCROW`** → **`THAWED`** когда **`now() ≥ escrow_thaw_at`** (правила в **`lib/escrow-thaw-rules.js`**). Кабинет: **`GET /api/v2/partner/balance-breakdown`** — итоги frozen/available, **`byCategory`** (slug категории листинга), **`recentLedgerTransactions`** (последние проводки партнёра из **`ledger_entries`**). UI: **`/partner/finances`**.
- **PR-#3 точные правила `escrow_thaw_at`:** **`computeEscrowThawAt({ checkInRaw, categorySlug, escrowAtIso })`** — для **housing** сохраняется **следующий календарный день после `check_in` @ 18:00** (листинг-TZ); для **transport / yachts** — **ISO-время старта** из **`bookings.check_in`** (**`bookingStartUtcIsoFromRaw`**); для **service** — **старт + 2 часа**. Миграция **`034_guest_reviews.sql`**, API pending/guest-reviews; **`PARTNER_GUEST_REVIEW_INVITE`** — **после `check_out`** (крон **47.2**), не при thaw. Список броней: **`guestRatingAverage`** / **`guestReviewCount`** / **`canSubmitGuestReview`**.
- **PR-#4 даты брони и отмены:** миграция **`database/migrations/035_pr4_bookings_timestamptz_cancellation_policy.sql`** — **`bookings.check_in` / `check_out`** как **TIMESTAMPTZ** (наследие DATE → полночь **Asia/Bangkok**); **`listings.cancellation_policy`** (**`cancellation_policy`** enum). Частичный рефанд: **`LedgerService.postPartialRefundForBooking`** обратимыми ногами относительно захвата (**`computeBookingPaymentLedgerLegs`**), дрейф в **pot**. Рейтинг гостя по отзывам партнёра — **AVG on read** (без колонки в **`profiles`**).
- **PR-#5 отмена и калькулятор:** **`computeRefundEstimateForBooking`** (**`lib/services/booking-refund-calculator.service.js`**) — доля гостю от **`guestTotalThb`** (ноги ledger) по **`cancellation-refund-rules`**. **`GET /api/v2/bookings/[id]/cancel-preview`** — превью возврата для рентера; **`POST /api/v2/bookings/[id]/cancel`** — сценарии без оплаты в эскроу (только **`CANCELLED`** в БД) vs с оплатой (**`PAID_ESCROW`**, **`CHECKED_IN`**, **`THAWED`**) с проводкой **`BOOKING_REFUND_PARTIAL`** при **`refundGuestThb` > 0**. UI: **`/renter/bookings`**, **`/checkout/[bookingId]`** (модальное подтверждение).
- **PR-#7 Smart Extension Cockpit (этап 1):** **`POST /api/v2/chat/invoice`** принимает опционально **`intent: "extension"`** и **`new_check_out`** (валидация: позже текущего **`bookings.check_out`**). **`/checkout/[bookingId]`** передаёт **`invoiceId`** в **`POST /api/v2/bookings/[id]/payment/confirm`**. На confirm: **`applyInvoicePostPaymentEffects`** (файл **`lib/services/invoice-extension.service.js`**) помечает invoice как paid и при extension обновляет **`bookings.check_out`** идемпотентно через **`bookings.metadata.appliedExtensionInvoiceIds`**; в чат пишется system message **`booking_extension_confirmed`**; мягкий hold по счёту закрывается досрочно (**`calendar_blocks.source=invoice_hold`**, **`expires_at=now`**) чтобы не было двойной блокировки после успешной оплаты.
- **Чекаут и заезд:** экран **`/checkout/[bookingId]`** после успешной оплаты **не** вызывает **`POST /api/v2/bookings/[id]/check-in/confirm`**; переход в **`CHECKED_IN`** — отдельный UX (чат, пуш, будущие правила по категории), не привязанный к завершению оплаты.
- **T-Bank payout registry (CSV):** **`POST /api/v2/admin/payouts/tbank-registry`** (ADMIN) — тело опционально **`{ "encoding": "utf-8" | "windows-1251" }`**. При **`windows-1251`** ответ содержит **`csvBase64`** (бинарная CP1251 без UTF-BOM), иначе поле **`csv`** (UTF-8). Кодирование: **`encodeTbankCsvForDownload`** в **`lib/services/tbank-payout-registry.service.js`** (**`iconv-lite`**). Выборка **`payouts.status = PENDING`**, метод **`pm-bank-ru`** (или **BANK+RUB**), профиль **`partner_payout_profiles.is_verified = true`**, реквизиты в **`data`**: `accountNumber`, `bik`, `inn`, ФИО — `recipientName` / `fullName` / ФИО из **`profiles`**. CSV: **`ФИО;Номер счета;БИК;ИНН;Назначение платежа;Сумма`**, UTF-8 BOM, разделитель **`;`**. После успешного включения строки в файл — **`payouts.status → PROCESSING`**, в **`metadata.tbank_registry_exported_at`** — ISO timestamp. Кнопка на **`/admin/financial-health`**. Неверифицированные / неполные профили **не попадают** в выгрузку (см. **`skippedUnverified`**). Без банковского API: **`PATCH /api/v2/admin/payouts/[id]`** с **`{ "status": "PAID" }`** (из **PENDING** или **PROCESSING**) — ledger **`PARTNER_PAYOUT_OBLIGATION_SETTLED`** затем статус **PAID**; **`{ "status": "FAILED" }`** — только из **PROCESSING**. Плейсхолдеры эквайринга Т-Банка в **`.env.example`**: **`TBANK_TERMINAL_KEY`**, **`TBANK_SECRET_KEY`** (аналоги **TerminalKey** / **SecretKey** в ЛК).
- **Верификация реквизитов (admin):** **`GET /api/v2/admin/partner-payout-profiles`** — список **`partner_payout_profiles`** с **`is_verified = false`** (+ партнёр, метод). **`PATCH /api/v2/admin/partner-payout-profiles/[id]`** с **`{ "action": "verify" }`** → **`is_verified: true`**. UI: **`/admin/payout-verification`**.
- **История выплат (partner):** **`GET /api/v2/partner/payouts`** — только выплаты **текущей сессии** (`partner_id` берётся из JWT/cookie, параметр **`partnerId` в query** не может указывать на чужого пользователя). Таблица на **`/partner/finances`**. Админ: **`GET /api/v2/admin/payouts`** — выплаты (ADMIN); фильтр **`?status=PROCESSING`**; псевдонимы **`?status=FINAL`**, **`SUCCESS`**, **`PAID_OR_COMPLETED`** → **PAID** + **COMPLETED**; в теле ответа **`isFinalSuccess`** для каждой строки. **`PATCH .../payouts/[id]`**: при наличии ключа **`adminNote`** — запись в **metadata** и для **PAID** (**`admin_marked_paid_note`**), и для **FAILED**.
- **Ledger reporting (admin UI):** **`GET /api/v2/admin/ledger-balances`** расширен блоком **`ledgerReporting`**: **`roundingPotLedgerThb`** / **`insuranceFundLedgerThb`** и алиасы **`RESERVES`** → **`INSURANCE_FUND_RESERVE`**, **`FEE_CLEARING`** → **`PROCESSING_POT_ROUNDING`** для ярких карточек на **`/admin/financial-health`**.
- **Acquiring webhook (карты / PSP):** **`POST /api/webhooks/payments/confirm`** — обязателен **`PAYMENT_ACQUIRING_WEBHOOK_SECRET`**: заголовок **`X-Webhook-Signature`** = **hex(HMAC-SHA256(rawBody, secret))**. Поддерживаются плоское JSON (`bookingId`, `paymentId?`, `paymentIntentId?`, `amount`, `currency`, `paid`) и форма **YooKassa** (`event`, `object.amount`, `object.metadata.booking_id` / `payment_id` / `payment_intent_id`). При **`currency=THB`** сверяется сумма с ожидаемым итогом; подтверждение идёт через Payment Intent (primary), legacy `payments` остаётся как fallback.
- **Acquiring webhook (карты / PSP):** **`POST /api/webhooks/payments/confirm`** поддерживает adapter-specific подписи: для Mandarin — `x-mandarin-signature` + `MANDARIN_WEBHOOK_SECRET`, для YooKassa — `x-yookassa-signature` + `YOOKASSA_WEBHOOK_SECRET`; общий `x-webhook-signature` + `PAYMENT_ACQUIRING_WEBHOOK_SECRET` остаётся fallback. До финансовой цепочки статус провайдера обязательно нормализуется во внутренний `payment_intents` status map.
- Минимальная проверка: итог **≥ 100 THB** (**`data-test-total-thb`**).
- Алерт при провале: **`POST /api/v2/internal/e2e/financial-error-alert`** + **`x-e2e-fixture-secret`** → **`recordCriticalSignal('FINANCIAL_ERROR', …)`**, текст вида **`Mismatch: Expected …, Got …`**.

### 11.3 Localization UX Bot (Polyglot) — **активен**

- Реализация: Playwright **`tests/e2e/bots/polyglot-ux.spec.ts`**, проект **`polyglot-bot`** (**`storageState`**: рентер из **`tests/auth.setup.ts`**).
- Сценарии: листинг **vehicles** (выбор дат) — языки **th** / **zh**, проверка **`listing-book-now`** (кликабельность, без горизонтального overflow); чекаут — существующая бронь рентера в статусе **PENDING / AWAITING_PAYMENT / CONFIRMED**, языки **th** / **zh**, **`checkout-pay-submit`**.
- Контроль «сырых» ключей: в **`main`** не должно встречаться **`.not_found`** / **`translation.`** (эвристика под отсутствующие строки i18n).

### 11.4 Security Bot (сценарий №27) — **активен**

- Реализация: Playwright **`tests/e2e/security-bot.spec.ts`**, проект **`security-bot`** (**`storageState`**: пустой, гость).
- Проверки: переход на **`/admin`** и **`/admin/dashboard`** без cookie-сессии → ожидается URL с **`/login`** (клиентский guard в **`app/admin/layout.js`** после **`GET /api/v2/auth/me`**).

### 11.5 Speed Bot (сценарий №28, патруль производительности) — **активен**

- Реализация: Playwright **`tests/e2e/speed-bot.spec.ts`**, проект **`speed-bot`** (таймаут до **180 s** из‑за ожидания LCP).
- Замеры: **LCP** (Performance Observer, **`largest-contentful-paint`**) для **`/`** и **`/listings`** — до **трёх** последовательных заходов на страницу; прокси **TTFB** — время до **`domcontentloaded`** после `page.goto`.
- Алерт: **`POST /api/v2/internal/e2e/performance-low-alert`** с **`x-e2e-fixture-secret`** (**`E2E_FIXTURE_SECRET`**). Сервер накапливает **streak**: три подряд замера с **LCP &gt; 3500 мс** (настраивается **`thresholdMs`**) и вне **тихого окна 6 ч** с последнего **`notifySystemAlert`** → Telegram **`[PERFORMANCE_LOW]`** на **русском** (URL, LCP, TTFB, рекомендация: тяжёлые изображения vs медленный ответ API при **TTFB &gt; 800 мс**). Повторные алерты чаще чем раз в **6 ч** подавляются (**`suppressed: true`** в JSON).
- Самопроверка API: второй тест в файле с искусственно низким порогом и уникальным **`pageKey`** (может отправить одно реальное уведомление при наличии секрета).

### 11.6 Глобальные уведомления в мобильном таб-баре

- Компонент **`components/mobile-bottom-nav.jsx`**: пункт **«Сообщения»** связан с **`useChatContext().totalUnread`** — сумма **`unreadCount`** по беседам из **`GET /api/v2/chat/conversations?archived=all&enrich=1&limit=100`** (на сервере непрочитанные считаются по **`read_at_renter` / `read_at_partner` / `is_read`** для входящих от собеседника, см. **`enrichConversationRows`** в **`app/api/v2/chat/conversations/route.js`**).
- Индикация: при **`totalUnread === 1`** — красная точка; при **`totalUnread &gt; 1`** — красный бейдж с числом (до **99+**). Обновление списка и счётчиков — **Smart Realtime** в **`lib/context/ChatContext.jsx`** (INSERT в **`messages`**) плюс начальная **`refresh()`**; для мгновенной доставки событий в браузере нужен **`SUPABASE_JWT_SECRET`** и **`GET /api/v2/auth/realtime-token`** → **`supabase.realtime.setAuth`** (**`components/supabase-realtime-auth-sync.jsx`** в **`app/layout.js`**).
- **Presence «В сети»** на любой странице: глобальный **`PresenceProvider`** в **`app/layout.js`** (модуль **`lib/context/PresenceContext.jsx`**) держит единый канал **`gostaylo-site-presence:v1`** и heartbeat. Треды/инбокс читают онлайн-статус через **`usePresenceContext()`**, поэтому индикатор не зависит от открытия конкретного чата.

### 11.7 Планируется

- **E2E Data Sentinel** — nightly: поиск утечек **`[E2E_TEST_DATA]`** в публичных API/SSR и алерт.
- **Bot #26: Notification Contract Diff** — сравнение HTML/email с baseline (deep links, календарь, вложения, i18n).
- **Calendar Link Guard** — TTL/валидность **`/api/calendar/stay`**, наличие **`CALENDAR_STAY_LINK_SECRET`** в окружениях.
- **Telegram Action Security** — синтетика lifecycle ban-token (подпись, TTL, replay).

### 11.8 Push Reliability Patrol — **активен**

- Почасовой sweeper: **`.github/workflows/push-sweeper.yml`** → **`POST /api/cron/push-sweeper`**.
- Серверный sweeper в **`PushService.runStaleChatPushSweeper`**: stale окно **10+ мин**, форсированная доставка батча, удаление строк из **`chat_push_delivery_batch`**.
- Nightly сводка Telegram (`send-e2e-report.mjs`) содержит **System Hygiene**: `FCM Cleaned`, `Sweeper Status`, `DB Health`.

## 12. AI Collaboration (.cursorrules)

- **Конституция для Cursor/агентов:** файл **`/.cursorrules`** в корне репозитория. Роль **старшего архитектора платформы**; **перед любой задачей** — **`docs/TECHNICAL_MANIFESTO.md`** + **`docs/CONSTITUTION.md`**. В ответах и новых doc-строках — **`getSiteDisplayName()`** / **Airento**, не устаревшее имя бренда. После изменений **API, БД или дизайна** — обновлять **манифест** и **`docs/CONSTITUTION.md`** / **`docs/SYSTEM_MAP.md`**; канон политики — **`ARCHITECTURAL_DECISIONS.md`** (при расхождении верен только он).
- **UI/E2E:** скругления чата — **`rounded-2xl` (16px)** (§5.1); тестовые сущности помечать **`[E2E_TEST_DATA]`** там, где принято в проекте.
- **Расширенный nightly-отчёт:** **`scripts/send-e2e-report.mjs`** при **`NEXT_PUBLIC_SUPABASE_URL`** + **`SUPABASE_SERVICE_ROLE_KEY`** в env шага (**секреты GitHub Actions**, см. **`playwright.yml`**) добавляет в Telegram: число строк **`user_push_tokens`**, проверку REST Supabase, счётчик **`PRICE_TAMPERING`** за 24 ч из **`critical_signal_events`**.
- **System Hygiene в nightly-отчёте:** секция включает **`FCM Cleaned`** (за 24ч из **`critical_signal_events`**, ключ **`FCM_TOKEN_CLEANED`**, либо env `FCM_CLEANED_COUNT`), **`Sweeper Status`** (по stale строкам **`chat_push_delivery_batch`** старше 10 минут) и **`DB Health`** (`OK/DEGRADED` по REST-check `profiles`).
- **Autonomic Ops Log:** таблица **`ops_job_runs`** фиксирует критичные cron-прогоны (`push-sweeper`, `push-token-hygiene`, `ical-sync`, **`escrow-thaw`**, и т.д.) со статусом, длительностью и JSON-метриками. Nightly Telegram (`send-e2e-report.mjs`) агрегирует за 24ч именно из **`ops_job_runs`**.

## 13. Admin Tooling

- **Health Dashboard:** страница **`/admin/health`** (`app/admin/health/page.jsx`) — визуализация за **7 дней** из **`ops_job_runs`** (iCal sync, Push Sweeper, FCM token hygiene, **`partner-sla-telegram-nudge`** со статами **`sent`/`scanned`/`skipped`/`errors`**) и блок **`slaNudge`** (агрегаты **`partner_sla_nudge_events`**, «покрытие» = **`opsSent7d` / `events7d`**); плюс счётчик/лента **`PRICE_TAMPERING`** из **`critical_signal_events`**. Обновление по кнопке «Обновить» (**`GET /api/v2/admin/health`**).
- **Доступ:** роль **`ADMIN`** в **`profiles`** (проверка по cookie-сессии и сервисному чтению профиля) **или** email пользователя в **`ADMIN_HEALTH_EMAILS`** (список через запятую); реализация **`lib/admin-health-access.js`**. Модераторы без allowlist и без роли ADMIN к API не допускаются (**403**).
- **Навигация:** пункт «Здоровье» в **`app/admin/layout.js`** (виден и модераторам в меню; фактический доступ к данным определяет API).

---

**Версия манифеста:** 13.0.0 (2026-07-31) — Stage-changelog вынесен в `archive/reports/TECHNICAL_MANIFESTO_STAGE_LOG.md`; здесь только code-truth + свежие дельты.