# Task Breakdown — Stage 177.1 (Unified Search Pipeline)

> **Status:** Planning (pre-implementation)  
> **Parent spec:** [`discovery-architecture-blueprint.md`](./discovery-architecture-blueprint.md)  
> **Product:** Airento  
> **Scope 177.1:** единый parse + plan для **3 фильтров** + feature flag; GiST bbox в catalog; amenities `@>` в SQL.  
> **Out of scope:** polygon, generated metadata columns, cursor pagination (177.2+).

---

## Целевая структура файлов

```
lib/search/
  discovery-filter-contract.js        # parse, validate, empty contract, types (JSDoc)
  discovery-filter-contract.types.js  # optional: @typedef-only module (если contract раздуется)
  discovery-query-plan.js             # buildDiscoveryQueryPlan, plan helpers
  discovery-query-executor.js         # executeCatalogPlan, executeMapPinsPlan (partial)
  filter-registry.js                  # FILTER_REGISTRY, ORDERED_FILTER_KEYS, registry helpers
  discovery-pipeline-flag.js          # isDiscoveryUnifiedPipelineEnabled()

lib/api/
  run-listings-search-get.js          # ветка flag → unified | legacy (минимальный diff)
  run-map-pins-get.js                 # то же

lib/api/search/
  discovery-spatial-rpc.js            # обёртки RPC bbox/radius (shared catalog + map)

migrations/
  stage177_1_gist_bbox_catalog_rpc.sql   # listings_ids_in_bbox_gist_v1 (+ category_ids)
  stage177_1_metadata_amenities_gin.sql  # GIN index amenities

tests/
  discovery-filter-contract.test.js
  filter-registry.test.js
  discovery-query-plan.test.js
  discovery-pipeline-parity.test.js      # catalog plan === map plan
  fixtures/discovery-177-1-urls.json
```

**Не трогаем в 177.1:** `listing-metadata-filter.js` (остальные vertical filters), `listings-page-url.js` (URL SSOT без изменений контракта), клиентские hooks.

---

## Граф зависимостей (эпики)

```
E0 Feature flag + types
  └─► E1 Contract skeleton (parse/validate)
        └─► E2 Registry (3 filters)
              └─► E3 Query plan builder
                    └─► E4 Spatial RPC migration
                          └─► E5 Executor (partial)
                                └─► E6 Handler integration + parity tests
```

---

## E0 — Инфраструктура и feature flag

### T0.1 — `discovery-pipeline-flag.js`

**Файл:** `lib/search/discovery-pipeline-flag.js`

```javascript
/** @returns {boolean} */
export function isDiscoveryUnifiedPipelineEnabled()

/** @returns {'unified'|'legacy'} */
export function discoveryPipelineMode()
```

**Правило:** `process.env.DISCOVERY_UNIFIED_PIPELINE === '1'`  
**Тест:** unit — `'1'`, `'0'`, unset.

**Изоляция:** без зависимостей от search handlers.

---

### T0.2 — JSDoc typedefs (скелет типов)

**Файл:** `lib/search/discovery-filter-contract.types.js` (или верх `discovery-filter-contract.js`)

```javascript
/**
 * @typedef {1} DiscoveryContractVersion
 * @typedef {'catalog'|'map'} DiscoverySurface
 *
 * @typedef {Object} DiscoveryGeoBbox
 * @property {'bbox'} mode
 * @property {number} south
 * @property {number} north
 * @property {number} west
 * @property {number} east
 * @property {boolean} [quantized]
 *
 * @typedef {DiscoveryGeoBbox} DiscoveryGeoFilter  // 177.1: только bbox; radius в legacy fallback plan
 *
 * @typedef {Object} DiscoveryFilterContract
 * @property {DiscoveryContractVersion} version
 * @property {string|null} q
 * @property {boolean} semantic
 * @property {string|null} categorySlug
 * @property {string[]|null} categoryIds
 * @property {DiscoveryGeoFilter|null} geo
 * @property {Object} stay
 * @property {Object} price
 * @property {Object} housing
 * @property {Object} vertical
 * @property {string|null} where
 * @property {Object} browse
 * @property {Object} map
 *
 * @typedef {Object} DiscoveryParseSuccess
 * @property {true} ok
 * @property {DiscoveryFilterContract} value
 *
 * @typedef {Object} DiscoveryParseFailure
 * @property {false} ok
 * @property {DiscoveryValidationIssue[]} issues
 *
 * @typedef {DiscoveryParseSuccess|DiscoveryParseFailure} DiscoveryParseResult
 *
 * @typedef {Object} DiscoveryValidationIssue
 * @property {string} code
 * @property {string} path
 * @property {string} message
 *
 * @typedef {Object} DiscoveryQueryPlan
 * @property {DiscoveryFilterContract} contract
 * @property {Object} spatial
 * @property {Object} sql
 * @property {string[]} postSteps
 * @property {Object} cache
 */
```

**Тест:** Typecheck через JSDoc `@type` в одном fixture-файле (без runtime).

---

## E1 — Contract skeleton (`discovery-filter-contract.js`)

### T1.1 — Пустой контракт и freeze

```javascript
/** @returns {DiscoveryFilterContract} */
export function createEmptyDiscoveryContract(options?: { surface?: DiscoverySurface, isLite?: boolean })

/** @param {DiscoveryFilterContract} contract @returns {DiscoveryFilterContract} */
export function freezeDiscoveryContract(contract)
```

**Acceptance:** `version === 1`, все nested objects присутствуют, `Object.isFrozen` после freeze.

---

### T1.2 — Парсер-оркестратор

```javascript
/**
 * @param {URLSearchParams} searchParams
 * @param {{ surface?: DiscoverySurface, isLite?: boolean, registry?: typeof FILTER_REGISTRY }} [options]
 * @returns {Promise<DiscoveryParseResult>}
 */
export async function parseDiscoveryFiltersFromSearchParams(searchParams, options)
```

**177.1 поведение:** вызывает `parseFromRegistry(searchParams, draft, registry)` если передан registry; иначе только baseline fields (`limit`, `featured`, `q`).

---

### T1.3 — Валидация

```javascript
/** @param {DiscoveryFilterContract} contract @returns {DiscoveryValidationIssue[]} */
export function collectDiscoveryValidationIssues(contract)

/** @param {DiscoveryFilterContract} contract @returns {DiscoveryParseResult} */
export function validateDiscoveryContract(contract)
```

**Правила 177.1:**

| path | code | rule |
|------|------|------|
| `geo.bbox` | `BBOX_INVALID` | south < north, west < east, finite |
| `geo.bbox` | `BBOX_TOO_LARGE` | optional max span guard |
| `housing.amenities` | `AMENITIES_INVALID` | slug regex, max count |
| `browse.limit` | `LIMIT_OUT_OF_RANGE` | 1..500 |

---

### T1.4 — Baseline parse (не из registry)

```javascript
/** @param {URLSearchParams} sp @param {DiscoveryFilterContract} draft */
export function parseDiscoveryBrowseParams(sp, draft)

/** @param {URLSearchParams} sp @param {DiscoveryFilterContract} draft */
export function parseDiscoveryTextParams(sp, draft)
```

Делегирует существующим: `firstIntParam`, `parseBooleanSearchParam`, `parseCatalogSort` — **без дублирования логики**, только import.

**Тест T1.*:** `discovery-filter-contract.test.js` — bbox valid/invalid, empty URL → default contract.

---

## E2 — Filter registry (3 фильтра)

### T2.1 — Каркас реестра

**Файл:** `lib/search/filter-registry.js`

```javascript
/** @typedef {'sql'|'rpc'|'post'|'availability'|'ranking'} FilterExecutionLayer */
/** @typedef {'all'|'housing'|'transport'|'service'} FilterVerticalScope */

/**
 * @typedef {Object} FilterDefinition
 * @property {string} key
 * @property {string[]} urlKeys
 * @property {FilterVerticalScope[]} verticals
 * @property {FilterExecutionLayer} layer
 * @property {DiscoverySurface[]} [surfaces]
 * @property {(sp: URLSearchParams, draft: DiscoveryFilterContract) => void} [parse]
 * @property {(contract: DiscoveryFilterContract) => Promise<void>} [resolve]
 * @property {(contract: DiscoveryFilterContract, plan: DiscoveryQueryPlan) => void|Promise<void>} [applyPlan]
 */

/** @type {Record<string, FilterDefinition>} */
export const FILTER_REGISTRY

/** @type {readonly string[]} */
export const ORDERED_FILTER_KEYS

/** @param {URLSearchParams} sp @param {DiscoveryFilterContract} draft */
export async function parseFromRegistry(sp, draft)

/** @param {DiscoveryFilterContract} contract @param {string} key @returns {boolean} */
export function isRegistryFilterActive(contract, key)

/** @param {DiscoveryFilterContract} contract @returns {string[]} */
export function listActiveRegistryFilterKeys(contract)
```

---

### T2.2 — `category`

```javascript
// FILTER_REGISTRY.category
parse(sp, draft)      // → normalizeListingCategorySlugForSearch
resolve(contract)     // → resolveListingCategoryIdsForSearchScope → contract.categoryIds
applyPlan(contract, plan)  // plan.sql.categoryIds = contract.categoryIds
```

**Reuse:** `lib/listing-category-slug.js`, `lib/api/category-search-scope.js`

**Тест:** slug `vehicles`, parent slug с children → `categoryIds.length > 1`.

---

### T2.3 — `geo.bbox`

```javascript
parse(sp, draft)           // parseMapBounds → draft.geo = { mode:'bbox', ... }
applyPlan(contract, plan)  // plan.spatial = { engine:'postgis', rpc:'listings_ids_in_bbox_gist_v1', rpcArgs }
```

**Reuse:** `lib/api/search/params.js` → `parseMapBounds`

**Surfaces:** `['catalog', 'map']`

**Тест:** 4 corner params → `geo.mode === 'bbox'`; missing one → geo null.

---

### T2.4 — `housing.amenities`

```javascript
parse(sp, draft)           // parseAmenitiesFromSearchParams → draft.housing.amenities
applyPlan(contract, plan)  // plan.sql.jsonbPredicates.push({ op:'@>', path:'amenities', value })
```

**Reuse:** `parseAmenitiesFromSearchParams` from `params.js`

**Тест:** `amenities=wifi,pool` → 2 slugs; plan содержит 1 merged `@>` predicate (AND).

---

### T2.5 — Registry integration hook в contract

Обновить `parseDiscoveryFiltersFromSearchParams`:

```javascript
// default options.registry = FILTER_REGISTRY
await parseFromRegistry(searchParams, draft)
const validated = validateDiscoveryContract(draft)
```

**Тест:** `filter-registry.test.js` — каждый filter изолированно + combined URL.

---

## E3 — Query plan builder

### T3.1 — `discovery-query-plan.js`

```javascript
/** @param {DiscoveryFilterContract} contract @param {{ surface: DiscoverySurface }} ctx @returns {Promise<DiscoveryQueryPlan>} */
export async function buildDiscoveryQueryPlan(contract, ctx)

/** @returns {DiscoveryQueryPlan} */
export function createEmptyDiscoveryQueryPlan(contract)

/** @param {DiscoveryQueryPlan} plan @param {FilterDefinition} def */
export async function applyFilterDefinitionToPlan(plan, def, contract)
```

**Порядок apply (177.1):** `category` → `geo.bbox` → `housing.amenities`

**`plan.sql` shape 177.1:**

```javascript
{
  categoryIds: string[] | null,
  listingIds: string[] | null,      // from spatial RPC
  jsonbPredicates: Array<{ op: '@>', key: string, value: unknown }>,
  fetchLimit: number,
  // scalarPredicates, offset — stub for 177.2
}
```

**`plan.spatial` shape:**

```javascript
{
  engine: 'postgis' | 'none',
  rpc: string | null,
  rpcArgs: object | null,
  listingIds: string[] | null,
}
```

**Тест:** plan для `?category=stays&south=…&amenities=wifi` содержит все три слоя.

---

### T3.2 — Parity helper (CI)

```javascript
/**
 * @param {DiscoveryFilterContract} contract
 * @returns {Promise<{ catalog: DiscoveryQueryPlan, map: DiscoveryQueryPlan, diff: string[]|null }>}
 */
export async function diffDiscoveryPlansForSurfaces(contract)
```

**Acceptance:** `diff === null` для fixture matrix (≥10 URL).

---

## E4 — DB / RPC (GiST bbox + amenities GIN)

### T4.1 — Migration amenities GIN

**Файл:** `migrations/stage177_1_metadata_amenities_gin.sql`

```sql
CREATE INDEX IF NOT EXISTS idx_listings_metadata_amenities_gin
  ON public.listings USING GIN ((metadata -> 'amenities') jsonb_path_ops)
  WHERE status = 'ACTIVE';
```

**Тест:** `EXPLAIN` на staging — Index Scan / Bitmap Index Scan при `@>`.

---

### T4.2 — Migration catalog bbox RPC

**Файл:** `migrations/stage177_1_gist_bbox_catalog_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION public.listings_ids_in_bbox_gist_v1(
  p_south double precision,
  p_west  double precision,
  p_north double precision,
  p_east  double precision,
  p_category_ids text[] DEFAULT NULL,
  p_limit integer DEFAULT 10000
) RETURNS TABLE (listing_id text) ...
```

**Grant:** `service_role` only (как `listings_map_pin_ids_in_bbox_gist_v1`).

---

### T4.3 — `discovery-spatial-rpc.js`

```javascript
/** @param {{ south, west, north, east, categoryIds?, limit? }} args @returns {Promise<string[]>} */
export async function fetchListingIdsInBboxGist(args)

/** @param {DiscoveryQueryPlan} plan @returns {Promise<string[]|null>} */
export async function resolveSpatialListingIdsFromPlan(plan)
```

**Reuse:** `supabaseAdmin.rpc`, `getPostgisSpatialState`, `traceSpatialQuery`, spatial cache keys.

**Тест:** integration (staging) — bbox Phuket → ids non-empty; с `categoryIds` — subset.

---

## E5 — Executor (partial, 177.1)

### T5.1 — `discovery-query-executor.js`

```javascript
/**
 * Выполняет SQL-часть unified plan; post-steps (availability, fuzz) — делегат legacy.
 * @param {DiscoveryQueryPlan} plan
 * @param {{ listingsSelect: string }} options
 * @returns {Promise<{ rows: object[], plan: DiscoveryQueryPlan }>}
 */
export async function executeDiscoverySqlPlan(plan, options)

/**
 * @param {DiscoveryQueryPlan} plan
 * @returns {Promise<{ listingIds: string[] }>}
 */
export async function executeDiscoverySpatialPrefilter(plan)
```

**Внутри `executeDiscoverySqlPlan`:**

1. `resolveSpatialListingIdsFromPlan` → `plan.sql.listingIds`
2. Вызов адаптера к `buildListingsQuery` **или** thin wrapper:

```javascript
/** @param {DiscoveryQueryPlan} plan @returns {Promise<{ data, error }>} */
export async function buildListingsQueryFromPlan(plan)
```

**Amenities SQL (177.1):** один `.filter('metadata', 'cs', JSON.stringify({ amenities: [...] }))` или эквивалент — **не** N× loop.

**Тест:** mock supabase — plan с amenities + categoryIds → ожидаемые chain calls.

---

### T5.2 — Map pins executor slice

```javascript
/**
 * Unified spatial + category + amenities → listing ids; далее lean select как сейчас.
 * @param {DiscoveryQueryPlan} plan
 * @returns {Promise<{ mode: 'pins', listingIds: string[] }>}
 */
export async function executeMapPinsDiscoveryPlan(plan)
```

**177.1:** clustering logic **остаётся в legacy** `runMapPinsGet` после получения ids; unified plan только для **prefilter parity**.

---

## E6 — Handler integration + feature flag

### T6.1 — Catalog branch

**Файл:** `lib/api/run-listings-search-get.js`

```javascript
// Pseudocode branch at top of runListingsSearchGet:
if (isDiscoveryUnifiedPipelineEnabled()) {
  return runListingsSearchGetUnified(request, options)
}

/** @private Stage 177.1 */
async function runListingsSearchGetUnified(request, options = {})
```

**177.1 scope unified path:**

- Filters: **category, geo.bbox, housing.amenities** via plan
- Всё остальное: **fallback** — legacy parse для одного request (bridge), TODO 177.2

**Рекомендуемый bridge (меньше регрессий):**

```javascript
const unified = await parseDiscoveryFiltersFromSearchParams(sp, { surface:'catalog', isLite })
if (!unified.ok) return 400
const plan = await buildDiscoveryQueryPlan(unified.value, { surface:'catalog' })
const { rows } = await executeDiscoverySqlPlan(plan, { listingsSelect })
// затем существующий pipeline: availability, metadata (legacy), ranking, serialize
```

**Acceptance:** при `DISCOVERY_UNIFIED_PIPELINE=0` — byte-identical behavior (snapshot tests).

---

### T6.2 — Map pins branch

**Файл:** `lib/api/run-map-pins-get.js`

```javascript
async function runMapPinsGetUnified(request)
```

**Flow:**

1. parse (`surface: 'map'`)
2. assert `geo.bbox` present (как сейчас `MAP_BOUNDS_REQUIRED`)
3. `buildDiscoveryQueryPlan` → spatial ids
4. Передать ids в существующий lean fetch / cluster branch

**Acceptance:** same pins count для bbox URL при flag on/off (±ordering).

---

### T6.3 — Response meta (observability)

Добавить в `data.meta` (оба handlers, unified only):

```javascript
{
  discoveryPipeline: 'unified' | 'legacy',
  discoveryPlanVersion: 1,
  spatialEngine: 'postgis' | 'none',
  registryFiltersApplied: ['category', 'geo.bbox', 'housing.amenities'],
}
```

**Тест:** e2e smoke — meta присутствует при flag=1.

---

## E7 — Тестовая матрица (изолированная)

| ID | Тип | Что проверяет |
|----|-----|----------------|
| UT-1 | unit | `createEmptyDiscoveryContract` |
| UT-2 | unit | bbox validation errors |
| UT-3 | unit | registry parse category / bbox / amenities |
| UT-4 | unit | `buildDiscoveryQueryPlan` order + predicates |
| UT-5 | unit | `diffDiscoveryPlansForSurfaces` === null |
| UT-6 | unit | flag helper |
| IT-1 | integration | RPC `listings_ids_in_bbox_gist_v1` |
| IT-2 | integration | unified catalog `amenities=wifi` uses GIN |
| IT-3 | parity | 10 URLs: catalog ids ⊆ map ids (same bbox+category+amenities) |
| RG-1 | regression | flag off → legacy snapshots unchanged |

**Fixture file:** `tests/fixtures/discovery-177-1-urls.json`

---

## Порядок выполнения (рекомендуемый sprint)

| День | Tasks | Критерий готовности |
|------|-------|---------------------|
| 1 | T0.1, T0.2, T1.1–T1.4 | unit tests green, flag работает |
| 2 | T2.1–T2.5, T3.1–T3.2 | plan parity tests green |
| 3 | T4.1–T4.3 | RPC на staging, spatial rpc wrapper |
| 4 | T5.1–T5.2 | SQL executor + amenities GIN |
| 5 | T6.1–T6.3, E7 | flag on staging, meta, regression off |

---

## Вне scope 177.1 (явно отложить)

| Item | Stage |
|------|-------|
| `geo.radius`, `geo.polygon` в registry | 177.2 / 177.3 |
| `vertical.*` metadata → SQL | 177.2 |
| Удаление `pointInBounds` JS | 177.1 только если bbox **всегда** через RPC в unified path |
| `discovery-query-executor` full post-steps | 177.2 |
| `listings-page-url.js` changes | не нужно |
| Cursor pagination | 177.2 |

---

## Документация (финальный PR 177.1)

- [`discovery-architecture-blueprint.md`](./discovery-architecture-blueprint.md) — статус 177.1 implemented (чеклист)
- `docs/SEARCH_FILTERS_QUERY_MAP.md` — секция «Unified pipeline (flag)»
- `docs/TECHNICAL_MANIFESTO.md` + `docs/ARCHITECTURAL_PASSPORT.md` — env `DISCOVERY_UNIFIED_PIPELINE`, новые модули

---

## Замечания архитектора

1. **Bridge dual-parse** в T6.1 безопаснее big-bang: unified покрывает 3 фильтра, legacy добирает dates/price/metadata до 177.2.
2. **`buildListingsQueryFromPlan`** лучше thin wrapper над `buildListingsQuery`, чем копия — SSOT SQL chain один.
3. **Parity test UT-5** — обязательный gate перед включением flag на staging.
4. Не включать flag в prod до IT-3 + RG-1; default `DISCOVERY_UNIFIED_PIPELINE=0`.

---

*Document version: 177.1-plan | Last updated: 2026-06-22*
