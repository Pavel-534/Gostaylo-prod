# План перехода на TanStack Query (React Query v5)

**Статус:** предложение (аудит без изменений кода)  
**Дата:** 2026-06-01  
**Контекст:** Stage 127.x — Payment Core перед первым MIR; TanStack Query — отдельный трек Performance & UX, не смешивать с платёжным hardening в одном релизе.

---

## Резюме для принятия решения

TanStack Query **уже частично внедрён** (`@tanstack/react-query` ^5.90.21, `AppQueryProvider` в корневом `app/layout.js`, дефолты в `lib/query-client.js`). Покрытие узкое (~13 хуков/страниц), в то время как **бóльшая часть UI** по-прежнему на `useEffect` + `fetch` или на **параллельных слоях кэша** (`dedupeClientRequest`, `searchCache` в `useListingsFetch`).

**Максимальный бизнес-эффект** даст миграция:

1. **Публичная витрина** — главная (`usePlatformHomePage`) + каталог (`useListingsFetch` / `listings-catalog-client.jsx`): меньше дублирующих запросов к `/api/...` search, мгновенный back-navigation, согласованность с уже существующими TTL в `client-fetch-policy.js`.
2. **Партнёрский кабинет** — расширение паттерна уже мигрированных `use-partner-*` + унификация дашборда.
3. **Админка** — десятки страниц с `useEffect` + `fetch`; отдельно критична **нагрузка** Financial Intelligence / ROI (не только UX).
4. **Чат** — гибрид: RQ для HTTP-снимков + **сохранение** Realtime/optimistic UI; не «длинный staleTime».

**Более серьёзные проблемы, чем отсутствие RQ** (не заменяются миграцией на Query):

| Приоритет | Проблема | Почему важнее UX-кэша |
|-----------|----------|------------------------|
| P0 (закрыто 127.x) | Идемпотентность webhooks / `confirmPayment` | Деньги |
| P1 Ops | Внешний cron thaw/promote | Эскроу / выплаты |
| P1 Arch | Двойной платёжный путь (legacy vs intent) | Риск расхождения FSM |
| P2 Perf | `marketplace-health` и FI executive summary тянут **полный** `buildReferralRoiReport` | Таймауты Supabase, не «медленный React» |
| P2 Security | Logout чистит `dedupeClientRequest`, но **не** `queryClient` | Утечка кэша между сессиями при росте RQ |

**Рекомендация по срокам:** начать Итерацию 1 **после** стабилизации MIR + ops checklist; в Итерации 0 (до кода) — закрыть `queryClient.clear()` на logout и зафиксировать конвенцию query keys.

---

## 1. Идентификация «тяжёлых» UI-компонентов

### 1.1 Уже на TanStack Query (эталон для миграции)

| Область | Файл | Query key / заметки |
|---------|------|---------------------|
| Кошелёк | `lib/hooks/use-wallet-me.js` | `['wallet-me']`, `staleTime: 60s`, явная `invalidateWalletMeQuery` |
| Партнёр: брони, календарь, листинги, статистика | `lib/hooks/use-partner-*.js` | Паттерн `useQuery` + `credentials: 'include'` |
| Финансы партнёра | `hooks/usePartnerFinances.js` | |
| Реферал me | `lib/hooks/use-referral-me.js` | |
| Сезонные цены | `lib/hooks/use-seasonal-prices.js` | |
| Репутация | `hooks/use-partner-reputation-health.js` | |
| Renter bookings | `app/renter/bookings/page.js` | |
| Checkout payment | `app/checkout/[bookingId]/hooks/useCheckoutPayment.js` | Только **invalidate** после оплаты |

**Инфраструктура:** `components/providers/app-query-provider.jsx` → `getQueryClient()` из `lib/query-client.js` (глобально: `staleTime` 5m, `gcTime` 30m, `refetchOnWindowFocus: true`, `refetchOnMount: false`).

---

### 1.2 Высокий ROI — публичный каталог и главная

#### `hooks/home/use-platform-home-page.js`

- **Нагрузка:** categories (`fetchCategories`), FX (`fetchExchangeRates` + event `FX_RATES_UPDATED_EVENT`), featured search (`fetchHomeFeaturedSearch`), live count (`fetchHomeListingsAvailableCount`), опционально `fetchAuthMe`.
- **Паттерн:** несколько `useEffect`, debounced refetch через `useHomeFilters`, локальный state (`listings`, `exchangeRates`, `liveCount`, loading-флаги).
- **Клиенты:** `lib/home/platform-home-api-client.js` (частично `dedupeClientRequest`, TTL in-flight из `TTL_HOME_SEARCH_INFLIGHT_MS`).
- **Эффект RQ:** один `useQuery` на «срез» поиска (query key = hash параметров фильтра), `useQuery` для categories/FX с длинным staleTime; при смене валюты — `invalidateQueries` по префиксу `home` или отдельный key segment `currency`.

#### `app/listings/listings-catalog-client.jsx` + `lib/hooks/useListingsSearch.js`

- **SSOT поиска:** `useListingsFetch` — прямой `fetch` на `LISTINGS_SEARCH_API_PATH`, **собственный** `Map` кэш (`CACHE_TTL` 5m, max 50 ключей), debounce 300ms, race через `requestIdRef`, semantic/AI ветки.
- **Дополнительно:** 16 `useEffect` в catalog client (синхронизация URL ↔ state, FX, infinite scroll через `useIntersectionObserver`).
- **Дублирование:** логика пересекается с главной (те же endpoints search, те же категории/курсы).
- **Эффект RQ:** замена `searchCache` на `queryKey: ['listings-search', serializedParams]`; `placeholderData` / `keepPreviousData` для плавных переходов фильтров; **удалить** дублирующий Map после стабилизации.

#### Карточки листингов / детальная страница

- Публичные данные часто идут через **Server Components** + клиентские доп. запросы; при миграции каталога — рассмотреть `prefetchQuery` на hover (опционально, Итерация 1b).
- `lib/api/catalog-public-client.js` — уже `dedupeClientRequest` + ключи из `CACHE_KEY` (`categories`, `site-features`, …): **не дублировать** TTL в dedupe и RQ; выбрать один слой (см. §2.3).

---

### 1.3 Высокий ROI — профиль, настройки, checkout (без ослабления attestation)

| Зона | Файлы | Паттерн сегодня |
|------|-------|-----------------|
| Профиль | `app/profile/page.js`, `app/profile/status/page.js`, `app/profile/hooks/useProfileUpdate.js` | `fetch` + local state, partner application status |
| Checkout load | `app/checkout/[bookingId]/hooks/useCheckoutLoadState.js` | Загрузка booking/invoice |
| Checkout pricing | `app/checkout/[bookingId]/hooks/useCheckoutPricing.js` | FX events + `useCommission` + **клиентский** `computeRoundedGuestTotal` из `booking-price-integrity` (только display) |
| Wallet page | `app/profile/wallet/page.js` | Смешанно: есть `useWalletMeQuery`, но и прямой `fetch` |

**Эффект RQ:** кэш booking/invoice по `bookingId` с **коротким** staleTime; после мутаций оплаты — `invalidate` (уже начато в `useCheckoutPayment`).

---

### 1.4 Средний ROI — чат и сообщения

| Слой | Файл | Особенности |
|------|------|-------------|
| Оркестратор | `app/messages/[id]/hooks/useUnifiedMessagesThread.js` | Склеивает inbox + thread |
| Inbox | `hooks/use-conversation-inbox.js` | Пагинация, Realtime (`useRealtimeConversations`, `supabase` subscribe), optimistic favorites |
| Thread | `hooks/use-chat-thread-messages.js` | |
| API | `lib/chat/conversation-api-client.js` | `dedupeClientRequest`, TTL из `client-fetch-policy.js` |

**Эффект RQ:** кэшировать **первую страницу** inbox и snapshot треда; обновлять через `queryClient.setQueryData` на Realtime INSERT/UPDATE (не полный refetch каждые N секунд). `staleTime` низкий (0–15s), `refetchOnWindowFocus: true` для inbox.

**Не мигрировать слепо:** логика `handleInboxMessageInsert`, debounce toggle favorite, bridge на active conversation — остаётся в хуках; RQ — хранилище снимка, не замена Realtime.

---

### 1.5 Высокий ROI — админка (много экранов, тяжёлые отчёты)

Почти все `app/admin/**` — `useEffect` + `fetch`. Наиболее тяжёлые:

| Экран | Файл | Риск нагрузки |
|-------|------|----------------|
| Financial Intelligence | `components/admin/finance-intelligence/FinancialIntelligenceDashboard.jsx` | `load()` на mount + period change; агрегаты escrow/GMV/referral |
| Marketing ROI | `components/admin/marketing/ReferralRoiDashboard.jsx`, `app/admin/marketing/roi/page.js` | |
| Marketplace health | `app/admin/marketplace-health/page.js` | После 127.0 — полный ROI report в одном ответе |
| FinTech console | `hooks/useAdminFinTechConsole.js` + `lib/admin/admin-fintech-api-client.js` | Bundle: dashboard, profiles, batches, treasury, cron health; свой `invalidateFintechConsoleBundleCache` |
| Marketing hub | `lib/admin/marketing-api-client.js` | Множество `dedupeClientRequest` |

**Эффект RQ:** прежде всего **сегментация запросов** (отдельные query keys для hero KPI vs drill-down), `staleTime` 1–2m, ручной refresh; для FI/ROI — **серверная** оптимизация (лёгкий summary endpoint) важнее клиентского кэша.

---

### 1.6 Низкий приоритет для первых итераций

- Одноразовые формы (login, reset-password, wizard create listing) — локальный state достаточен.
- `app/admin/test-db`, smoke UI — вне продакшен-UX.
- Server Components, которые уже делают fetch на сервере — RQ только на клиентских островах.

---

## 2. Архитектурная стыковка

### 2.1 Поток авторизации (без изменения серверного контракта)

```
Browser fetch (credentials: 'include')
    → Cookie gostaylo_session
    → API route: verifyAppSessionJwt (lib/auth/verify-app-session-jwt.js)
    → getSessionPayload() / role checks
```

**Правила для `queryFn`:**

1. Всегда `credentials: 'include'`, `cache: 'no-store'` (как в `use-wallet-me.js`).
2. Не класть JWT в query key; идентификатор сессии — **непрозрачен** для клиента (HttpOnly). Изоляция кэша — через **scope в key** (см. §3).
3. `fetchAuthMe` остаётся в `AuthProvider`; RQ-хуки для «me» опциональны и должны **инвалидироваться** при login/logout вместе с `invalidateAuthMeCache()`.

**Предлагаемая обёртка (Итерация 0):**

```js
// lib/api/query-fetch.js (концепт, не реализовано)
export async function queryFetchJson(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) {
    const err = new Error(json.error || json.message || `HTTP ${res.status}`)
    err.code = json.error_code
    err.status = res.status
    throw err
  }
  return json.data ?? json
}
```

Существующие API-клиенты (`auth-client`, `catalog-public-client`, `platform-home-api-client`, `admin-fintech-api-client`, `conversation-api-client`) постепенно становятся **тонкими** обёртками над `queryFetchJson` + экспорт **factory** `queryKey` / `queryFn` для `useQuery`.

---

### 2.2 Конфигурация QueryClient (пресеты по доменам)

Глобальные дефолты в `lib/query-client.js` оставить умеренными; **перекрывать** на уровне хука.

| Домен | `staleTime` | `gcTime` | `refetchOnWindowFocus` | `refetchOnMount` | Комментарий |
|-------|-------------|----------|------------------------|------------------|-------------|
| Публичный каталог / search | 3–5 min | 30 min | true | false | Совпадает с `CACHE_TTL` в `useListingsFetch` и `TTL_CATEGORIES_MS` |
| Categories, site-features, locations | 10 min | 60 min | true | false | Редко меняются; align с `client-fetch-policy.js` |
| FX / commission display | 60–120 s | 15 min | true | true | Слушать `FX_RATES_UPDATED_EVENT` → `invalidateQueries(['fx'])` |
| Auth me (если в RQ) | 30 s | 5 min | true | true | Align `TTL_AUTH_ME_MS` |
| Partner bookings / calendar | 1–2 min | 20 min | true | false | Уже близко к текущим partner hooks |
| Wallet me | 60 s | 30 min | true | false | Уже в `use-wallet-me.js` |
| Chat inbox (первая страница) | 0–15 s | 10 min | true | true | Realtime — primary freshness |
| Chat thread messages | 0 | 5 min | false | true | Обновление через `setQueryData` |
| Checkout booking + invoice | **0** | 5 min | true | true | Всегда revalidate при входе; после payment — invalidate |
| Admin FI / ROI reports | 1–2 min | 15 min | false | true | Ручная кнопка «Обновить»; не полагаться только на focus |
| FinTech console bundle | 0 (после мутации) | 10 min | false | true | Сохранить явный `invalidate` после PATCH/POST |

**Устаревшее имя:** в комментариях `lib/query-client.js` — `cacheTime`; в v5 канон — `gcTime`.

---

### 2.3 Сосуществование с `dedupeClientRequest` (Stage 113)

Сегодня **два параллельных механизма**:

- TanStack Query (in-memory, keyed, gc)
- `lib/api/client-request-dedup.js` (in-flight + optional TTL)

**Стратегия (рекомендуется):**

1. **Итерации 1–2:** для доменов, переведённых на RQ, **убрать TTL** из `dedupeClientRequest` для тех же ключей; оставить dedupe только там, где RQ не используется (переходный период).
2. **Не складывать** `dedupeClientRequest(..., { ttlMs: 5m })` внутри `queryFn` с `staleTime: 5m` — двойной кэш, сложная инвалидация.
3. In-flight dedupe RQ делает сам для одинакового `queryKey` — достаточно.

`invalidateAllClientRequests()` при logout — **сохранить** и добавить симметрично:

```js
// в clearBrowserPersistedAuthState / signOut path
getQueryClient().clear() // или removeQueries + resetQueries
```

---

### 2.4 Конвенция query keys

```text
['catalog', 'search', { category, where, dates, bounds, filters, q, semantic }]
['home', 'featured', { ...filters }]
['home', 'count', { ...filters }]
['profile', 'me']                    // только при authenticated scope
['partner', 'bookings', profileId, filters]
['chat', 'inbox', profileId, tab, archived]
['chat', 'thread', conversationId, profileId]
['checkout', 'booking', bookingId]
['checkout', 'invoice', bookingId]
['admin', 'fi', period]
['admin', 'roi', window]
['admin', 'fintech', 'bundle', from, to, excludeTest]
```

**Scope segment:** `profileId` = `user?.id` из `AuthContext`; для публичных данных — сегмент `'public'` без user id. При logout — `clear()` снимает все ключи.

---

### 2.5 DevTools и тестирование

- Подключить `@tanstack/react-query-devtools` только в `NODE_ENV === 'development'`.
- E2E: не зависеть от кэша между сценариями — `clear()` в fixture logout или hard reload.
- Smoke financial **не трогать** в первых итерациях.

---

## 3. Безопасность и валидация

### 3.1 Изоляция кэша по сессии

**Риск:** QueryClient — singleton в браузере (`getQueryClient()`). Без `clear()` на logout пользователь B на том же устройстве может увидеть данные пользователя A (wallet, inbox, partner bookings).

**Текущий gap:** `lib/auth/browser-auth-cleanup.js` вызывает `invalidateAllClientRequests()`, но **не** очищает TanStack Query.

**Обязательные меры (Итерация 0, до массовой миграции):**

1. `getQueryClient().clear()` в `clearBrowserPersistedAuthState` и после успешного `signOut` в `auth-actions`.
2. Включать `user?.id` (или `'anon'`) в query keys для **всех** authenticated endpoints.
3. Не кэшировать ответы с `Cache-Control: public` в shared SW — сегодня API app routes с `no-store`; сохранять.

**Публичный каталог:** ключи без `userId` допустимы (одинаковые данные для всех); не включать в публичный key PII из optional auth headers.

---

### 3.2 `booking-price-integrity.js` и чекаут

**SSOT цены — сервер:** snapshot в booking, attestation при submit payment, `getExpectedUsdtForBooking` на сервере (Stage 127.x). Клиентский `computeRoundedGuestTotal` в `useCheckoutPricing` — **только отображение** и сверка с уже загруженным snapshot.

**Правила при кэшировании в RQ:**

| Данные | Можно кэшировать? | staleTime |
|--------|-------------------|-----------|
| GET booking / invoice для UI | Да, с оговоркой | 0; invalidate после promo, wallet apply, method change |
| Расчёт «what-if» промокода | Отдельный mutation / query | 0 |
| Итог к оплате перед submit | **Не** доверять только кэшу | Перед `confirmPayment` — refetch booking или полагаться на ответ API оплаты |
| FX rates | Да | 60–120s + event invalidate |

**Запрещено:** кэшировать как «истину» результат устаревшего клиентского пересчёта без повторного GET booking после изменения промокода/метода оплаты/кошелька.

**Связь с Stage 127:** USDT expected amount — только server; RQ не должен подменять `getExpectedUsdtForBooking`.

---

### 3.3 Админские и финансовые данные

- Admin routes уже защищены `verifyAppSessionJwt` + `is_admin`; кэш в браузере админа — приемлемый риск при logout `clear()`.
- Не использовать `persistQueryClient` (localStorage) для wallet/bookings/chat/admin **без шифрования** — не внедрять на первых этапах.

---

### 3.4 Supabase из браузера

`use-conversation-inbox.js` импортирует `supabase` для Realtime — это **не** замена HTTP API и не конфликтует с RQ, если RLS корректен. RQ кэширует REST-снимки; Realtime патчит cache. Прямые `.from()` в новых фичах без RLS review — вне scope, но остаётся архитектурным риском.

---

## 4. Поэтапный роадмап внедрения

### Итерация 0 — Фундамент (1–2 PR, низкий UX-риск)

**Цель:** безопасность и конвенции до массовой миграции.

- [ ] `queryClient.clear()` на logout / session expiry (вместе с `invalidateAllClientRequests`).
- [ ] Документировать query key factory в `lib/query-keys.js` (или по доменам).
- [ ] `queryFetchJson` + единый mapper ошибок (`error_code`).
- [ ] React Query Devtools (dev only).
- [ ] Чеклист PR: «новый authenticated fetch → RQ + scoped key».

**Не делать:** массовый рефактор страниц.

---

### Итерация 1 — Публичный каталог и главная (высокий UX, низкий security risk)

**Цель:** снизить дубли search/categories/FX; убрать `searchCache` Map.

1. `useQuery` для `fetchCategories`, `fetchExchangeRates` (shared с catalog).
2. `usePlatformHomePage` → разбить на:
   - `useHomeCategoriesQuery`
   - `useHomeFeaturedQuery(filtersKey)`
   - `useHomeLiveCountQuery(filtersKey)` (опционально `enabled: false` до стабильных фильтров)
3. `useListingsFetch` → `useListingsSearchQuery` с `placeholderData: keepPreviousData`, debounce через `useDebouncedValue` + `queryKey` от debounced params.
4. Удалить module-level `searchCache` после метрик (Network: duplicate search ↓).
5. Согласовать с `catalog-public-client` — один RQ key для categories.

**Критерий готовности:** back navigation catalog ↔ listing ↔ catalog без лишнего skeleton; Supabase/API search QPS ↓ на типичном сценарии фильтрации.

---

### Итерация 2 — Профили, настройки, partner/renter dashboards

**Цель:** согласовать с уже мигрированными partner hooks.

- `app/profile/page.js` → `useProfileMeQuery`, `usePartnerApplicationStatusQuery`.
- Расширить паттерн `use-partner-bookings` на страницы с остаточным `useEffect` (`app/partner/bookings/page.js`, dashboard).
- `app/profile/wallet/page.js` — только `useWalletMeQuery`, убрать дублирующий fetch.
- `fetchAuthMe`: либо оставить dedupe в AuthProvider, либо один `useAuthMeQuery` с синхронизацией в context (осторожно с циклами).

**Критерий готовности:** logout не оставляет profile/wallet в кэше; partner sees fresh bookings after action via `invalidateQueries`.

---

### Итерация 3 — Чат и инвойсы (фоновое revalidating)

**Цель:** меньше polling, сохранить Realtime UX.

- Inbox: `useInfiniteQuery` или пагинация с `fetchNextPage`.
- Realtime handlers → `queryClient.setQueryData` для inbox/thread.
- Checkout: `useCheckoutLoadState` → queries с `staleTime: 0`; связать с `useCheckoutPayment` invalidate chain (booking, invoice, wallet-me).
- Invoice list в admin messages — по аналогии.

**Не делать в 3:** полная перепись `useUnifiedMessagesThread` — только замена источника truth для начального HTTP load.

---

### Итерация 4 — Админка и FinTech (perf + UX)

**Цель:** снизить повторные тяжёлые fetch; **параллельно** серверные оптимизации.

1. FI dashboard: разделить на `useFiSummaryQuery(period)` и lazy tabs.
2. ROI / marketplace-health: **лёгкий** summary endpoint (P2 из аудита 124.21) — RQ не спасёт 30s report.
3. `useAdminFinTechConsole` → `useFintechBundleQuery` + mutations с `onSuccess: invalidateQueries`.
4. Marketing API clients → query factories.

**Критерий готовности:** переключение period в FI не блокирует UI > 1s при cache hit; cold load улучшен сервером.

---

## 5. Проблемы важнее «профессионального вида» (для roadmap продукта)

1. **Payment / MIR (127.x)** — не смешивать с RQ в одном релизе; regression risk.
2. **ROI в marketplace-health** — полный отчёт в page load (127.0 унификация SSOT) — оптимизировать API, не только клиент.
3. **Financial Intelligence executive path** — тот же класс проблем.
4. **Двойной кэш** (dedupe + Map + RQ) — технический долг; Итерация 1 должна **убирать**, а не добавлять третий слой.
5. **Logout / cache clear** — security P2, блокер перед Итерацией 2.
6. **Bundle size** — следить, чтобы server-only модули (`currency.service`, полный `booking-price-integrity` server path) не попали в client query modules (паттерн `webpackIgnore` из 127.x).

---

## 6. Метрики успеха

| Метрика | Как измерить |
|---------|----------------|
| Duplicate API calls | DevTools Network, React Query Devtools (deduped fetches) |
| Time to interactive on catalog filter change | Lighthouse / RUM |
| Supabase/API load | Логи route handlers search, admin FI |
| Session isolation | Manual: login A → logout → login B, wallet/inbox empty |
| Checkout correctness | Smoke `smoke:full-financial` + manual promo/FX change before pay |

---

## 7. Связанные документы

- `ARCHITECTURAL_DECISIONS.md` — SSOT политики
- `docs/TECHNICAL_MANIFESTO.md` — API, auth cookie, типы
- `docs/ARCHITECTURAL_PASSPORT.md` — маршруты и экраны
- `lib/api/client-fetch-policy.js` — TTL dedupe (Stage 113)
- `docs/PRE_REAL_PAYMENTS_CHECKLIST.md` — не конкурировать с MIR workstream

---

## 8. Итоговая рекомендация

**Да, переход на TanStack Query оправдан** — инфраструктура уже есть, узкое покрытие создаёт непоследовательный UX и тройное кэширование. **Но** приоритет №1 перед масштабированием RQ — `queryClient.clear()` на logout и серверная лёгкость FI/ROI. Первый заметный UX-выигрыш — **Итерация 1 (главная + каталог)** без touch payment paths.

Оценка трудозатрат (грубо): Итерация 0 — 0.5–1 дн.; 1 — 2–4 дн.; 2 — 3–5 дн.; 3 — 4–6 дн.; 4 — 5–10 дн. + backend для admin perf.
