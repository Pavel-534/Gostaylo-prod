# Stage 177.2 — Cursor Pagination (Discovery Unified Catalog)

> **Status:** Planning (pre-implementation)  
> **Parent spec:** [`discovery-architecture-blueprint.md`](./discovery-architecture-blueprint.md)  
> **Predecessor:** [`stage177-1-task-breakdown.md`](./stage177-1-task-breakdown.md) (implemented)  
> **Product:** Airento  
> **Scope 177.2 Step 1:** keyset cursor в **unified catalog path** (`discovery-query-executor.js`) под флагом `DISCOVERY_UNIFIED_PIPELINE`; контракт `cursor` + `next_cursor`; базовая сортировка **`created_at DESC, id DESC`**.  
> **Out of scope Step 1:** distance/price/reputation sort cursors, map-pins pagination, polygon, generated metadata columns, клиентский infinite scroll (отдельный подшаг).

---

## 0. Связь с 177.1 и ответ на риски регрессии

### 0.1 Это продолжение, а не параллельный слой

| Вопрос | Ответ |
|--------|--------|
| Ломает ли 177.1? | **Нет.** 177.1 явно отложил cursor в 177.2 (`stage177-1-task-breakdown.md`, §Out of scope). Executor остаётся точкой входа SQL; добавляется ветка keyset в plan + executor. |
| Дублируем ли уже сделанное? | **Нет отдельного catalog-cursor API сегодня.** `useListingsSearch.loadMore` — **клиентский slice** уже загруженного массива (`displayedCount`), не server offset. Referral `cursor` (`ReferralActivityFeed`) — другой домен. |
| Усложняем ли сайт? | **Инкрементально:** только при `DISCOVERY_UNIFIED_PIPELINE=1` и только catalog search; legacy path (`run-listings-search-get` без unified) **без изменений** до soak. |
| Конфликт с fix 177.1.1 (цены пинов)? | **Нет** — ортогональные read-path (цена vs пагинация). |

### 0.2 Что реально заменяем (терминология)

В `discovery-query-executor.js` **нет** классического `OFFSET` сегодня. Анти-паттерн B4 из blueprint:

```
SQL LIMIT fetchLimit (до 500) → JS post-filters → slice(filters.limit)
```

Step 1 заменяет «перегрузку одной страницы» на **keyset page** фиксированного размера в unified path:

```
SQL keyset WHERE … ORDER BY created_at DESC, id DESC LIMIT pageSize+1
→ отдать pageSize строк → next_cursor из последней
```

Полное снятие B4 (пустые страницы из-за metadata/availability post-filter) — **частично** в Step 1: cursor убирает дубликаты/пропуски при стабильном SQL-порядке; metadata-in-SQL — фаза 177.2b (blueprint §2.4).

### 0.3 Инварианты SSOT

- Parse cursor / limit — **`discovery-filter-contract.js`**
- Plan поля `sql.orderBy`, `sql.cursor`, `sql.pageSize` — **`discovery-query-plan.js`**
- Применение keyset в Supabase chain — **`discovery-query-executor.js`** (thin над `query-builder` или dedicated helper)
- Legacy `buildListingsQuery` + `applyCatalogSort` (JS) — **не трогаем** в Step 1
- URL SSOT `listings-page-url.js` — **не меняем** в Step 1 (cursor только query API, опционально в URL на Step 2 клиента)

---

## 1. Контракт данных (API Contract)

### 1.1 Query-параметры

| Параметр | Тип | Парсинг | Правила |
|----------|-----|---------|---------|
| `limit` | integer | `firstIntParam(sp, 'limit')` → `contract.browse.limit` | Page size. Unified catalog: **default 24**, **min 1**, **max 50** (отдельно от legacy `MAX_BROWSE_LIMIT=500`). При `DISCOVERY_UNIFIED_PIPELINE=0` — прежние лимиты. |
| `cursor` | opaque string | `parseDiscoveryCursor(sp)` в `discovery-filter-contract.js` | Опционально. Отсутствие = первая страница. |

**Поверхность:** только **catalog** (`surface: 'catalog'`). Map-pins (`run-map-pins-get`) cursor **не получает** — viewport + `MAP_PINS_MAX` остаются.

### 1.2 Формат `cursor` (opaque)

**Канон Step 1:** Base64URL от JSON-массива **ровно из 2 элементов**:

```json
["<sort_value_iso_or_id>", "<listing_id_text>"]
```

| Поле | Смысл (Step 1) |
|------|----------------|
| `[0]` | `last_created_at` — ISO 8601 UTC string (`listings.created_at` последней строки страницы) |
| `[1]` | `last_id` — TEXT id листинга (tiebreaker, SSOT тип `listings.id`) |

**Кодирование:**

```javascript
// encode (server → meta.next_cursor)
const payload = JSON.stringify([lastCreatedAt, lastId])
const next_cursor = Buffer.from(payload, 'utf8').toString('base64url')

// decode (client → cursor query)
const raw = Buffer.from(cursor, 'base64url').toString('utf8')
const parsed = JSON.parse(raw)
// validate: Array.isArray(parsed) && parsed.length === 2 && typeof parsed[1] === 'string'
```

**Валидация parse (issues):**

| code | Условие |
|------|---------|
| `CURSOR_INVALID` | не base64url / не JSON / не массив длины 2 |
| `CURSOR_SORT_MISMATCH` | (резерв 177.2+) decoded sort key ≠ текущему `browse.sort` |
| `CURSOR_ID_INVALID` | `last_id` пустой или не string |

**Безопасность:** cursor **не подписывается** в Step 1 (read-only публичный каталог); при подмене — только невалидная страница / пустой результат, не утечка данных.

### 1.3 Расширение `DiscoveryFilterContract.browse`

```javascript
browse: {
  limit: 24,           // page size (unified)
  cursor: null,        // decoded: { sortKey: 'created_at', lastCreatedAt: string, lastId: string } | null
  cursorRaw: null,     // исходная строка из URL (для cache key)
  featured: true,
  sort: null,          // Step 1: только null | 'created_at' (явный); иное → legacy sort path / reject cursor
  isLite: true,
  surface: 'catalog',
}
```

### 1.4 Формат ответа каталога (unified path)

Добавить в `meta` ответа `runListingsSearchGet` (только unified):

```typescript
meta: {
  // … существующие поля …
  discoveryPipeline: 'unified',
  pagination: {
    mode: 'cursor',
    pageSize: number,
    next_cursor: string | null,   // null = последняя страница
    hasMore: boolean,             // = Boolean(next_cursor)
  },
}
```

**Правило `next_cursor`:**

- Запросили `pageSize` строк, SQL вернул **`pageSize + 1`** (over-fetch на 1).
- Если строк `> pageSize` → отдать первые `pageSize`, `next_cursor` из **последней отданной**.
- Иначе `next_cursor: null`.

**Backward compatibility:** при `DISCOVERY_UNIFIED_PIPELINE=0` поле `meta.pagination` **отсутствует** (или `mode: 'legacy'`).

### 1.5 Ограничение сортировки (Step 1)

| `sort` query | Cursor Step 1 |
|--------------|---------------|
| отсутствует / `recommended` | **Legacy ranking в handler** — cursor **не активируется** (fallback на текущий fetchLimit path). Либо явный reject `400 CURSOR_REQUIRES_STABLE_SORT` — **решение implementer: reject** (чище SSOT). |
| `created_at` (новый явный alias) или внутренний `stable_created_at` | **Cursor enabled** |
| `price_*`, `distance` | **400** `CURSOR_SORT_NOT_SUPPORTED` |

Документируем для продукта: Step 1 cursor работает с **стабильным SQL-порядком** `created_at DESC, id DESC`; «recommended» остаётся на legacy до 177.2c.

---

## 2. Query Plan & Executor

### 2.1 Расширение `DiscoveryQueryPlan.sql`

```javascript
sql: {
  // … существующие 177.1 поля …
  pageSize: 24,
  cursor: null | {
    sortKey: 'created_at',
    lastCreatedAt: string,  // ISO
    lastId: string,
  },
  orderBy: [
    { column: 'created_at', ascending: false },
    { column: 'id', ascending: false },
  ],
  overFetch: 1,  // LIMIT pageSize + 1
}
```

`buildDiscoveryQueryPlan(contract, ctx)`:

1. Если `contract.browse.cursor` задан и sort stable → заполнить `plan.sql.cursor`.
2. `plan.sql.pageSize = clamp(contract.browse.limit, 1, 50)`.
3. **Не** смешивать с `fetchLimit` headroom 177.1 — в cursor mode `fetchLimit` **не используется** для catalog unified (deprecated в этой ветке).

### 2.2 Keyset predicate (математика)

Сортировка: `ORDER BY created_at DESC, id DESC`.

Пусть `L = (last_created_at, last_id)` — декодированный cursor.

Строка `row` попадает на следующую страницу iff:

```
(row.created_at < L.created_at)
OR (row.created_at = L.created_at AND row.id < L.id)
```

(При `DESC`; для `ASC` инвертировать операторы в 177.2+.)

### 2.3 Supabase / PostgREST (query-builder helper)

PostgREST `.or()` для keyset (DESC):

```javascript
// Псевдокод — вынести в lib/api/search/discovery-cursor-sql.js
if (cursor) {
  const ts = cursor.lastCreatedAt
  const id = cursor.lastId
  q = q.or(`created_at.lt.${ts},and(created_at.eq.${ts},id.lt.${id})`)
}
q = q
  .order('created_at', { ascending: false })
  .order('id', { ascending: false })
  .limit(pageSize + 1)
```

**Индекс:** использовать существующий `(status, created_at)` или добавить миграцию `idx_listings_active_created_id` — **T1.8** (если explain показывает seq scan).

**Совместимость с 177.1 cascade:**

```
category → bbox GiST ids → amenities @>
→ keyset cursor predicate
→ ORDER BY created_at, id
→ LIMIT pageSize+1
```

`is_featured` **не** входит в keyset Step 1 (иначе нестабильный порядок при смене featured).

### 2.4 `executeDiscoverySqlPlan` (изменения)

```javascript
export async function executeDiscoverySqlPlan(plan, options) {
  const spatialIds = await resolveSpatialListingIdsFromPlan(plan)
  // …
  const useCursor = Boolean(plan.sql?.cursor) || plan.sql?.paginationMode === 'cursor'

  if (useCursor) {
    const { rows, error } = await buildListingsQueryWithCursor({ ... })
    const { pageRows, nextCursor } = slicePageAndBuildNextCursor(rows, plan.sql.pageSize)
    return { data: pageRows, error, plan, nextCursor }
  }

  // существующий fetchLimit path (177.1) — для non-cursor unified
}
```

`run-listings-search-get.js` (unified branch):

- Прочитать `nextCursor` из executor.
- Положить в `meta.pagination.next_cursor`.
- **Post-steps** (availability, metadata JS, `applyCatalogSort`) — в Step 1 **только на странице** `pageRows`; при stable sort **не вызывать** `applyCatalogSort` если cursor active.

### 2.5 Map-pins executor

`executeMapPinsDiscoverySqlPlan` — **без изменений** в Step 1.

---

## 3. Task Breakdown (Step 1)

### E1 — Contract & codec

| ID | Задача | Файл | Acceptance |
|----|--------|------|------------|
| T1.1 | `encodeDiscoveryCursor({ lastCreatedAt, lastId })` / `decodeDiscoveryCursor(raw)` | `lib/search/discovery-cursor-codec.js` | round-trip unit tests |
| T1.2 | `parseDiscoveryBrowseParams`: читать `cursor`, decode → `browse.cursor` | `discovery-filter-contract.js` | invalid → `CURSOR_INVALID` |
| T1.3 | Unified page size: clamp `limit` 1..50 когда flag on | `discovery-filter-contract.js` | validation issue `LIMIT_OUT_OF_RANGE` обновить сообщение |
| T1.4 | Guard: cursor + non-stable `sort` → validation issue | `discovery-filter-contract.js` | `CURSOR_SORT_NOT_SUPPORTED` |

### E2 — Query plan

| ID | Задача | Файл | Acceptance |
|----|--------|------|------------|
| T1.5 | `plan.sql.cursor`, `pageSize`, `orderBy`, `paginationMode` | `discovery-query-plan.js` | plan snapshot tests |
| T1.6 | `buildDiscoveryQueryPlan`: cursor только при stable sort | `discovery-query-plan.js` | parity catalog/map не ломается (map без cursor) |

### E3 — SQL / executor

| ID | Задача | Файл | Acceptance |
|----|--------|------|------------|
| T1.7 | `applyDiscoveryCursorToQuery(q, cursor, orderBy)` | `lib/api/search/discovery-cursor-sql.js` | SQL integration test / mocked supabase |
| T1.8 | (опционально) индекс `(status, created_at DESC, id DESC)` partial ACTIVE | `migrations/stage177_2_cursor_pagination_index.sql` | explain < 50ms staging |
| T1.9 | `executeDiscoverySqlPlan` cursor branch + `nextCursor` | `discovery-query-executor.js` | возвращает ровно pageSize строк |
| T1.10 | Wire `meta.pagination` в unified handler | `run-listings-search-get.js` | JSON contract test |

### E4 — Tests

| ID | Задача | Файл |
|----|--------|------|
| T1.11 | Codec + contract parse matrix | `__tests__/discovery-cursor-codec.test.js` |
| T1.12 | Plan + executor page boundary | `__tests__/discovery-cursor-pagination.test.js` |
| T1.13 | Расширить parity: cursor не влияет на map plan | `__tests__/discovery-pipeline-parity.test.js` |

**npm scripts (предложение):**

```json
"test:discovery-cursor": "node --import ./scripts/node-test-alias-register.mjs --test __tests__/discovery-cursor-codec.test.js __tests__/discovery-cursor-pagination.test.js"
```

### E5 — Docs

| ID | Задача |
|----|--------|
| T1.14 | `docs/SEARCH_FILTERS_QUERY_MAP.md` — строки `cursor`, `meta.pagination` |
| T1.15 | `docs/TECHNICAL_MANIFESTO.md` + passport version bump |

---

## 4. Тестовая матрица (граничные состояния)

| # | Сценарий | Request | Ожидание |
|---|----------|---------|----------|
| M1 | Первая страница | `limit=24`, без cursor | 24 items (если есть), `next_cursor` set iff в БД ≥25 подходящих |
| M2 | Вторая страница | `cursor` из M1 | 0 дубликатов id с M1; все id «старше» keyset |
| M3 | Последняя страница | cursor когда осталось <24 | `next_cursor: null`, `hasMore: false` |
| M4 | Пустой результат | фильтр без матчей | `data: []`, `next_cursor: null` |
| M5 | Невалидный cursor | `cursor=!!!` | `400 DISCOVERY_FILTER_INVALID`, `CURSOR_INVALID` |
| M6 | Cursor + `sort=distance` | | `400 CURSOR_SORT_NOT_SUPPORTED` |
| M7 | Flag off | `DISCOVERY_UNIFIED_PIPELINE=0` | прежнее поведение, нет `meta.pagination` |
| M8 | Cursor + bbox + category | unified cascade | порядок фильтров 177.1 сохранён, cursor после amenities |
| M9 | Стабильность | 3 последовательных cursor | множества id дизъюнктны, объединение = без дубликатов |

---

## 5. Scope / Out-of-scope

### In scope (177.2 Step 1)

- Keyset cursor `created_at DESC, id DESC` + `id` tiebreaker
- Контракт `cursor` / `next_cursor`
- Unified catalog executor + handler meta
- Unit/integration tests M1–M9
- Feature flag gating

### Out of scope (явно)

| Item | Куда |
|------|------|
| Сортировка по **distance** (pin / radius / KNN) | 177.2 Step 2 или 177.3 |
| Сортировка по **price** asc/desc | 177.2 Step 2 |
| **recommended** / reputation / featured SQL order | 177.2c (ranking в SQL или отдельный cursor sort key) |
| Клиент `useListingsSearch` server-side `loadMore` + URL `cursor` | 177.2 Step 2 (клиент) |
| Map-pins cursor / cluster pagination | не планируется |
| Polygon search | 177.3 |
| Generated metadata columns (B2) | 177.2b |
| Удаление legacy fetchLimit path | после soak unified + cursor |
| Подпись cursor (HMAC) | при необходимости 177.4 |

---

## 6. Rollout & rollback

1. Deploy с `DISCOVERY_UNIFIED_PIPELINE=0` — **нулевой риск**.
2. Staging: flag on, тесты M1–M9, сравнение с legacy count на фикстурах.
3. Prod: flag on для canary; мониторинг `meta.pagination.hasMore` distribution.
4. Rollback: flag off → мгновенный возврат к fetchLimit + slice.

---

## 7. Замечания архитектора

1. **Не плодить второй cursor codec** — один модуль `discovery-cursor-codec.js`; referral/chat cursors не переиспользуют формат (разные домены).
2. **Thin wrapper** над `buildListingsQuery`, не копия chain — SSOT из `.cursorrules` (Stage 18.0).
3. Step 1 **намеренно узкий**: стабильный SQL sort важнее «универсального cursor для recommended».
4. Исправление цен пинов (177.1.1) и cursor pagination **ортогональны** — можно мержить независимо.
5. Полное закрытие B4 потребует metadata-in-SQL (blueprint §2.4) — cursor alone не гарантирует 0 пустых страниц при тяжёлых JS post-filters.

---

*Document version: 177.2-plan-step1 | Last updated: 2026-06-22*
