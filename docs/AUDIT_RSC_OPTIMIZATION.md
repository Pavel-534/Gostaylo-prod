# Аудит RSC и клиентского JS-бандла

**Дата:** 2026-07-15  
**Область:** `app/`, `components/` (+ связанные `hooks/`, `contexts/`, `lib/` по границе client/server)  
**Next.js:** App Router (целевые практики Next.js 14+)  
**Статус:** диагностика и план; **код не менялся**

---

## 1. Диагноз: текущее состояние

### 1.1. Общая картина

Платформа построена по модели **«тонкая серверная оболочка + тяжёлый клиентский остров»** для публичных витрин и **«page = client component»** для большинства кабинетов. Это осознанный trade-off (realtime-чат, интерактивные карты, TanStack Query, PWA, auth-modal), но для **mobile-first гостевого пути** (главная → каталог → PDP → checkout) JS-бандл и **waterfall запросов в браузере** заметно тяжелее, чем мог бы быть при паттерне Airbnb/Booking: **SSR/RSC shell + client islands**.

| Метрика (оценка по репозиторию) | Значение |
|---------------------------------|----------|
| Файлов с `'use client'` в `components/` | **~350+** |
| Файлов с `'use client'` в `app/` (страницы, layout, hooks, вложенные UI) | **~165** |
| `app/**/page.{js,jsx}` всего | **115** |
| `page.js` с `'use client'` на верхнем уровне | **~87 (~76%)** |
| Публичные маршруты с осмысленным RSC (данные/SEO на сервере) | **2,5 из 5** (см. §2) |

**Почему JS «слишком много»:**

1. **Глобальный client shell** в `app/layout.js`: `AuthProvider`, `I18nProvider`, `CurrencyProvider`, `GeoProvider`, `AppQueryProvider`, `ChatProvider`, `PresenceProvider`, `AppHeader`, `MobileBottomNav`, `SupabaseRealtimeAuthSync`, `PushClientInit`, `ProductAnalyticsInit`, PWA-chrome — всё монтируется на **каждой** странице, включая статичный `/help`.
2. **Shadcn/Radix UI** — практически все `components/ui/*` помечены `'use client'`; любой импорт UI тянет client boundary вверх по дереву.
3. **Ключевые гостевые страницы целиком client**: PDP (`app/listings/[id]/page.js`), checkout, inbox `/messages` — хотя часть данных уже доступна на сервере (layout/metadata, API).
4. **Дублирование загрузки данных**: PDP layout уже делает `getCachedListingForGuestGate` (Supabase admin, `React.cache`), но `page.js` снова тянет листинг через `/api/v2/listings/[id]` на клиенте.
5. **Каталог**: сервер отдаёт `generateMetadata` + `ListingsCatalogItemListSchema` (отдельный search на сервере), затем клиент выполняет **полноценный** `useListingsFetch` — потенциально **2–3 запроса** к search-движку на первом заходе.
6. **Тяжёлые библиотеки** в client-графе: `react-leaflet`, `@changey/react-leaflet-markercluster`, `embla-carousel`, `recharts` (admin/partner), `posthog-js`, `firebase/messaging` — частично с `dynamic(..., { ssr: false })`, но всё равно попадают в chunks при навигации.

### 1.2. Что уже сделано хорошо (эталоны в кодовой базе)

| Паттерн | Где | Зачем |
|---------|-----|-------|
| Server page + client island | `app/page.js` → `PlatformHomeContent` | Низкий TTFB оболочки, Suspense skeleton |
| Server metadata + JSON-LD | `app/listings/page.js`, `app/listings/[id]/layout.js` | SEO без client JS |
| `React.cache` для layout-данных | `lib/seo/listing-layout-data.js` | Нет дубля Supabase внутри одного request (metadata + schema) |
| Server RSC + props в client | `app/u/[id]/page.js` → `PublicUserProfileClient` | FX preview на сервере по geo headers |
| Server wrapper для треда | `app/messages/[id]/page.js` → `UnifiedMessagesClient` | `generateMetadata` на сервере |
| Dynamic import карт | `ListingMap.jsx`, `MapPicker.jsx`, `PartnerChatCalendarPeek` | Leaflet не в initial SSR chunk |
| API как SSOT данных | Клиент → `/api/v2/*`, не прямой `supabaseAdmin` в browser | Корректная граница безопасности |

---

## 2. Ключевые маршруты (детальный разбор)

### 2.1. Главная `/` (`app/page.js`)

| Слой | Тип | Файлы | Загрузка данных |
|------|-----|-------|-----------------|
| Page | **Server** | `app/page.js` | — |
| Контент | **Client** | `components/PlatformHomeContent.jsx`, `hooks/home/use-platform-home-page.js` | Client: categories (`usePublicCategoriesQuery`), featured (`fetchHomeFeatured`), FX (`useFxRatesQuery`), live count, auth (`useAuth`), semantic search state |

**Проблема:** hero, «Как это работает», footer — могли бы отдаваться HTML с сервера; сейчас пользователь видит skeleton (`HomePageSkeleton`), пока клиент не выполнит цепочку fetch.

**Кандидаты на Server Components без поломки UX:**

- `components/home/HowItWorks.jsx` — статичная разметка + `getUIText` (язык — из cookie/header через RSC, как в `app/layout.js` `generateMetadata`).
- Часть hero copy (заголовки из `lib/config/home-page-copy`) — server-render.
- `TrustBar` — server fetch `/api/v2/public/stats` + client-island только для `AnimatedCounter`.

### 2.2. Каталог `/listings` (`app/listings/page.js`)

| Слой | Тип | Файлы | Загрузка данных |
|------|-----|-------|-----------------|
| Page | **Server** | `app/listings/page.js` | `generateMetadata`, `ListingsCatalogItemListSchema` → `runListingsSearchGet` (lite, до 18 items) |
| Контент | **Client** | `app/listings/listings-catalog-client.jsx`, `lib/hooks/useListingsSearch.js` | Client: полный search + map pins + categories + FX + favorites batch |

**Проблема:** интерактив (карта, фильтры, URL sync, infinite scroll) оправдывает client, но **первый экран результатов** можно гидратировать из server props (как ItemList уже делает на сервере).

**Тяжёлые client-зависимости:** `SearchMapWrapper` → `InteractiveSearchMap` (Leaflet + clustering), `UnifiedSearchBar`, `FilterBar`, recommendation rails.

### 2.3. Карточка листинга `/listings/[id]`

| Слой | Тип | Файлы | Загрузка данных |
|------|-----|-------|-----------------|
| Layout | **Server** | `app/listings/[id]/layout.js`, `lib/seo/listing-layout-data.js` | Supabase admin (cached): metadata, JSON-LD |
| Page | **Client (весь файл)** | `app/listings/[id]/page.js` | Client: `useListingViewData` → `/api/v2/listings/[id]`, reviews API, favorites, booking flow, chat |

**Критическая точка №1:** layout уже загрузил listing, page **повторяет** fetch. Это главный quick win для RSC (см. §5, фаза 1).

**Client-only компоненты, которые можно «отрезать» от booking state:**

| Компонент | Сейчас | Потенциал |
|-----------|--------|-----------|
| `ListingHeroHeadline`, `ListingDescription`, amenities | `'use client'` (через `ListingPdpDetailsColumn`) | Server shell + props |
| `ListingHeroGallery` | client (gallery click, urgency timer) | Server gallery + client lightbox island |
| `ListingMap` | client + dynamic leaflet | Уже lazy — оставить island |
| `ListingBookingSection`, `ListingMobileActions` | client | **Оставить client** (календарь, цены, CTA) |
| Recommendation rails | client | client (персонализация), но ниже fold — `dynamic` |

### 2.4. Checkout `/checkout/[bookingId]`

| Слой | Тип | Файлы | Загрузка данных |
|------|-----|-------|-----------------|
| Page | **Client (весь файл)** | `app/checkout/[bookingId]/page.js`, hooks `useCheckoutPayment`, `useCheckoutLoadState` | Client: `/api/v2/bookings/[id]`, payment intent, wallet, return URL handling |

**Оправданный client:** выбор метода оплаты, wallet toggle, crypto modal, payment return (`?payment=return`), `CancelBookingDialog`.

**Можно вынести на сервер (острова статики):**

- `CheckoutAccessDeniedView`, `CheckoutUnavailableView`, `CheckoutSuccessView`, `CheckoutPaymentFailedView` — mostly presentational; server render при известном статусе после auth cookie check на сервере (осторожно: не светить чужие booking details).

**Рекомендация:** server page проверяет session + booking ownership через internal service → передаёт **sanitized DTO** в client payment island (паттерн Stripe Checkout embedding).

### 2.5. Чаты `/messages`, `/messages/[id]`

| Маршрут | Page | Client core | Данные |
|---------|------|-------------|--------|
| `/messages` | **Client page** | `useConversationInbox`, `ConversationList` | `/api/v2/chat/conversations` |
| `/messages/[id]` | **Server wrapper** | `UnifiedMessagesClient` + 6 hooks | messages API + **Supabase Realtime** |

**Оправданный client:** realtime, typing, voice, invoice composer, optimistic send, mobile viewport shell.

**Оптимизация (низкий приоритет):** server auth gate (redirect до mount тяжёлого клиента); inbox list SSR для первых N conversations — сложно из-за realtime invalidation.

**Глобальная нагрузка:** `SupabaseRealtimeAuthSync`, `ChatProvider`, `PresenceProvider` в root layout — для не-chat страниц это лишний baseline JS (defer по route group).

---

## 3. «Критические точки»: безболезненные Server Components

Приоритет — **максимум HTML на первом байте**, **минимум изменений контрактов API**.

| # | Комponent / модуль | Действие | Риск | Выигрыш |
|---|-------------------|----------|------|---------|
| 1 | `app/listings/[id]/page.js` | Разбить: `page.js` (RSC) + `ListingPdpClient.jsx` | Средний | Высокий — убрать double fetch, LCP |
| 2 | `lib/supabase.js` | Split: `supabase-browser.js` / `supabase-server.js` | Низкий | Средний — чище bundle, SSOT |
| 3 | `components/home/HowItWorks.jsx` | Убрать `'use client'` | Низкий | Низкий–средний |
| 4 | `app/listings/listings-catalog-client.jsx` | Server prefetch первой страницы → `initialListings` prop | Средний | Высокий на `/listings` |
| 5 | `components/product/GuestBookingFlowHint.jsx` | Принимать `pathname` с server layout / middleware | Низкий | Малый, но уменьшает client fan-out |
| 6 | `app/checkout/[bookingId]/page.js` | RSC gate + client `CheckoutPaymentIsland` | Средний–высокий | Средний |
| 7 | Root providers | Route groups: `(public)`, `(app)`, `(chat)` layouts | Средний | Высокий baseline JS |
| 8 | `components/ui/*` | Server-safe primitives (`Button` static variants) — долгосрочно | Высокий | Средний |

---

## 4. Анализ утечки секретов и границы client/server

### 4.1. Итог: критических утечек SERVICE_ROLE в browser **не обнаружено**

- Прямой `supabaseAdmin` / `SUPABASE_SERVICE_ROLE_KEY` в `app/` и `components/` **отсутствует** (кроме server-only файлов в `app/api`, `lib/seo`, migrations).
- Клиентские компоненты ходят в БД через **`fetch('/api/v2/...')`** — правильный паттерн.

### 4.2. Зона внимания (не утечка, но архитектурный риск)

| Риск | Детали | Рекомендация |
|------|--------|--------------|
| **Монолит `lib/supabase.js`** | Экспортирует и `supabase` (anon), и `supabaseAdmin` (service). Импортируется из client: `components/supabase-realtime-auth-sync.jsx`, `components/chat/RealtimeDiagOverlay.jsx` | Разделить модули; client импортирует **только** browser client. Next.js не инлайнит non-`NEXT_PUBLIC_*` env в client, но **код создания admin-клиента** всё равно попадает в граф сборки |
| **`getSupabaseStatus()`** | Отладочный helper рядом с admin client | Держать только в server-модуле |
| **`RealtimeDiagOverlay`** | Dev/diag UI + прямой `supabase` | Убедиться, что не попадает в production bundle (tree-shake / `process.env.NODE_ENV`) |
| **Публичные ключи** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — ожидаемо в browser | OK; RLS обязан держать границу |
| **Admin pages (`app/admin/*`)** | ~100% client pages | Acceptable для internal console; не приоритет mobile guest bundle |

### 4.3. Checklist перед каждым новым `'use client'`

1. Нужны ли hooks / browser APIs / realtime?
2. Можно ли импортировать только server-safe util (без transitively pulling `lib/supabase.js` admin)?
3. Нет ли в файле `process.env.*` кроме `NEXT_PUBLIC_*`?
4. Не дублируется ли fetch, который layout/page RSC уже делает через `cache()`?

---

## 5. Сводная таблица: страницы, тяжесть, потенциал ускорения

| Маршрут | Client heaviness | Основные client chunks / причины | Server сегодня | Потенциал ускорения | Приоритет |
|---------|------------------|-----------------------------------|----------------|---------------------|-----------|
| `/` | **Высокий** | PlatformHome, search bar, rails, auth, FX, categories | Metadata only (layout) | SSR featured + static sections; defer rails | **P1** |
| `/listings` | **Очень высокий** | Catalog client, Leaflet map, filters, infinite query | Metadata + ItemList JSON-LD search | SSR first page + hydrate; map lazy | **P1** |
| `/listings/[id]` | **Очень высокий** | Full PDP client, booking widget, calendar, chat preview | Layout metadata + schema (listing fetch) | **RSC shell + reuse layout data** | **P0** |
| `/checkout/[id]` | **Высокий** | Payment flows, wallet, return handling | — | RSC auth gate + static outcome views | **P2** |
| `/messages` | **Высокий** | Inbox, tabs, archive | — | Route-group providers; optional SSR list | **P3** |
| `/messages/[id]` | **Очень высокий** | Realtime, composer, voice, invoices | Metadata | Defer non-chat providers; keep client core | **P3** |
| `/my-bookings` | Высокий | Orders, actions, dialogs | — | SSR list skeleton + client actions | P2 |
| `/partner/*` | Высокий | Dashboard, calendar, wizard | Thin wrappers редко | Mobile PWA OK; dynamic уже частично | P4 |
| `/admin/*` | Очень высокий | recharts, fintech consoles | Почти нет | Низкий приоритет для guest perf | P5 |
| `/help`, legal | **Низкий** | — (server pages) | Full static RSC | Эталон; header/nav — client baseline | OK |

**Шкала Client heaviness:** Very High = entire page client + heavy libs + multiple waterfalls.

---

## 6. Пошаговый план лечения (без поломки логики и E2E)

### Фаза 0 — Замеры (1–2 дня)

- [ ] `@next/bundle-analyzer` на production build: baseline chunks для `/`, `/listings`, `/listings/[id]`, `/checkout/[id]`, `/messages/[id]`.
- [ ] Lighthouse + Web Vitals (mobile 4G): LCP/FCP/TTI на PDP и каталоге.
- [ ] Зафиксировать waterfall (DevTools): число API round-trips до interactive.
- [ ] Сохранить скриншоты/метрики в PR-шаблон для регрессии.

### Фаза 1 — PDP RSC shell (P0, ~3–5 дней)

**Цель:** один server fetch listing на request; booking/chat — client islands.

1. Создать `app/listings/[id]/ListingPdpClient.jsx` (`'use client'`) — перенести текущее содержимое `page.js`.
2. Новый `app/listings/[id]/page.js` (Server):
   - `getCachedListingForGuestGate(id)` + `resolveListingPublicGuestAccess` (те же правила, что layout).
   - Prefetch reviews server-side (optional, через existing API helper или supabase admin в server module).
   - Передать `initialListing`, `initialReviews`, `lang`, `moderationState` props.
3. Адаптировать `useListingViewData`: если props совпадают с cache key — **не refetch** на mount (hydrate React Query).
4. Вынести статичные блоки в RSC-children:
   - `ListingHeroHeadline`, description, amenities grid (server).
5. **E2E:** `e2e/booking-flow.spec.ts` — сохранить селекторы календаря/CTA; проверить `waitUntil: 'domcontentloaded'` + появление title/price.

**Не трогать:** `ListingBookingSection`, `BookingModal`, payment/chat hooks.

### Фаза 2 — Каталог: server-first page (~3–5 дней)

1. В `app/listings/page.js`: вызвать `runListingsSearchGet` с теми же params, что URL (limit = `ITEMS_PER_PAGE`).
2. Передать `initialSearchResult`, `initialCategories` (server fetch categories — уже есть public API).
3. `listings-catalog-client.jsx`: seed TanStack Query `initialData` / `placeholderData`.
4. Карта: mount только после `showMap` или intersection (уже частично) — проверить, что Leaflet chunk не в main catalog bundle.
5. **E2E:** search/filter specs — URL query sync должен остаться SSOT (`docs/SEARCH_FILTERS_QUERY_MAP.md`).

### Фаза 3 — Главная: статика + featured SSR (~2–3 дня)

1. RSC-секции: `HowItWorks`, часть hero (copy from server with lang cookie).
2. Server `fetchHomeFeatured` в `app/page.js` → prop в `PlatformHomeContent`.
3. `TrustBar`: server stats + client counter island.
4. Recommendation rails — оставить client below-fold + `dynamic`.

### Фаза 4 — Checkout server gate (~3–4 дня)

1. Server `page.js`: read session cookie → internal fetch booking summary.
2. Если unauthenticated / wrong renter → server-render `CheckoutAccessDeniedView` (без payment hooks).
3. Client island только для payable state.
4. **E2E / smoke:** financial smoke paths — не менять API contracts (`/api/v2/bookings/[id]/payment/*`).

### Фаза 5 — Route groups & provider splitting (~4–6 дней)

```
app/
  (marketing)/     → minimal providers (i18n, currency)
  (storefront)/    → + query, analytics
  (chat)/          → + chat, presence, realtime sync
  (partner)/       → + partner notifications
```

- Перенести `ChatProvider`, `PresenceProvider`, `SupabaseRealtimeAuthSync` из root в `(chat)` layout.
- `PushClientInit` — после idle / user gesture (уже частично PWA-aware).

### Фаза 6 — SSOT hardening

- [ ] `lib/supabase/browser.js` + `lib/supabase/server.js`; codemod imports.
- [ ] ESLint rule (custom): запрет `supabaseAdmin` import from files under `components/`, `hooks/` with `'use client'`.
- [ ] Документировать в `docs/TECHNICAL_MANIFESTO.md` + `docs/ARCHITECTURAL_PASSPORT.md` после реализации фаз 1–2.

---

## 7. Совместимость с E2E и продуктовыми инвариантами

| Область | Инвариант | Как не сломать |
|---------|-----------|----------------|
| Booking flow | Calendar date cells, CTA | Client islands сохраняют DOM/`data-*` attrs |
| Search | URL = SSOT фильтров | Server prefetch должен использовать **те же** parsers (`lib/search/listings-page-url.js`) |
| Auth | HttpOnly cookie, login modal | RSC redirect vs client modal — не менять auth-context contract |
| Chat realtime | RLS + realtime JWT | Realtime остаётся client-only |
| i18n | `{brand}`, vertical labels | Server: `getLangFromRequest`; client: existing providers |
| SW / PWA | Bypass RSC payloads (`TECHNICAL_MANIFESTO` §171.16) | Не кэшировать HTML/RSC в SW |
| Prefetch PDP | `use-listing-detail-prefetch` | Align cache keys с server-hydrated Query data |

---

## 8. Идеи уровня «рынок / Airbnb» (beyond quick wins)

1. **Streaming PDP:** RSC shell (gallery + title + price snapshot) flush first; booking widget stream later — как Airbnb listing header до load calendar.
2. **Partial Prerendering (PPR, Next 14+canary/experimental):** static marketing + dynamic auth badge — если команда готова к experimental flags.
3. **Catalog map off by default on mobile** (уже близко): карта — opt-in sheet; экономия ~200–400 KB gzip leaflet cluster.
4. **React Query SSR dehydration** глобально для storefront route group — один паттерн для home/catalog/PDP.
5. **Component budget CI:** fail PR if guest route main chunk > N KB (bundle analyzer artifact).

---

## 9. Файлы-индикаторы для ревью (client + heavy fetch)

| Файл | `'use client'` | Тяжёлые client fetch / libs |
|------|----------------|------------------------------|
| `components/PlatformHomeContent.jsx` | да | categories, featured, FX, search state |
| `app/listings/listings-catalog-client.jsx` | да | catalog search, map, favorites |
| `app/listings/[id]/page.js` | **да (весь page)** | listing, reviews, booking, chat |
| `app/listings/[id]/layout.js` | нет | Supabase listing (cached) — **дублируется client page** |
| `app/checkout/[bookingId]/page.js` | да | booking, payment, wallet |
| `app/messages/page.js` | да | conversations inbox |
| `app/messages/[id]/UnifiedMessagesClient.jsx` | да | messages + realtime |
| `hooks/useListingViewData.js` | да | `/api/v2/listings`, reviews |
| `lib/hooks/useListingsSearch.js` | нет directive, но client-only | catalog TanStack Query |
| `components/supabase-realtime-auth-sync.jsx` | да | imports `@/lib/supabase` monolith |
| `app/layout.js` | нет | wraps all client providers |

---

## 10. Резюме для PR-дискуссии

**Главный диагноз:** SSR используется mainly для **SEO/metadata**, а не для **guest UX performance**. Самый дорогой antipattern — **PDP page = client при server layout уже загрузил listing**.

**Top-3 действия по ROI:**

1. RSC shell для `/listings/[id]` с reuse `getCachedListingForGuestGate`.
2. Server prefetch первой страницы каталога + hydrate Query.
3. Split `lib/supabase` + route-group providers для снижения global client baseline.

**Безопасность:** прямых утечек service role в browser нет; рекомендуется split supabase module для предотвращения регрессий.

---

*Временный документ аудита. После выполнения фаз 1–2 обновить `docs/TECHNICAL_MANIFESTO.md` и `docs/ARCHITECTURAL_PASSPORT.md` (§ Server RSC / storefront).*
