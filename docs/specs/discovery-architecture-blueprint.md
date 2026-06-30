# Discovery Architecture Blueprint — Stage 177.0.0

> **Status:** Design (pre-implementation)  
> **Product:** Airento (white-label Super App)  
> **Goal:** Единый поисковый движок без дублирования pipeline каталог ↔ карта  
> **SSOT после внедрения:** этот документ + `lib/search/filter-registry.js` + `lib/search/discovery-filter-contract.js`  
> **Связанные артефакты:** `docs/SEARCH_FILTERS_QUERY_MAP.md`, ADR-163 (`docs/ADR/163-coordinate-privacy-ssot.md`), PostGIS migrations `stage162_*`–`stage166_*`

---

## 0. Контекст и проблема

Аудит Stage 177 prep выявил критические bottlenecks:

| ID | Проблема | Симптом |
|----|----------|---------|
| **B1** | Нет polygon search | «Нарисовать область» невозможно |
| **B2** | Metadata filters только в Node.js | O(n) post-filter, не масштабируется |
| **B3** | Bbox каталога на B-tree lat/lng + JS `pointInBounds` | Двойная работа, GiST не задействован |
| **B4** | `fetchLimit` cap 500 + post-filters | Пустые страницы при плотной выборке |
| **B6** | Два pipeline: `runListingsSearchGet` / `runMapPinsGet` | Рассинхрон фильтров при каждом PR |

**Решение:** ввести **`DiscoveryFilterContract`** — один нормализованный объект фильтров, один реестр правил, один query planner, два thin handler'а (catalog / map-pins).

---

## 1. Архитектура унифицированного pipeline (B6)

### 1.1 Принципы

1. **Parse once** — URL → `DiscoveryFilterContract` (immutable, validated).
2. **Plan once** — contract → `DiscoveryQueryPlan` (SQL clauses, RPC calls, post-steps).
3. **Execute per surface** — catalog возвращает fat rows; map-pins — lean projection; **plan идентичен**.
4. **No vertical branching in handlers** — ветвление только в `filter-registry.js`.
5. **Privacy invariant (ADR-163)** — spatial всегда на **true** `coordinates`; fuzz только на serialize.

### 1.2 Целевая схема модулей

```
URLSearchParams
       │
       ▼
lib/search/discovery-filter-contract.js
  parseDiscoveryFiltersFromSearchParams(sp, { surface: 'catalog'|'map' })
  validateDiscoveryFilters(contract) → Result | ValidationError[]
       │
       ▼
DiscoveryFilterContract  ◄── SSOT in-memory shape
       │
       ▼
lib/search/filter-registry.js
  FILTER_REGISTRY — declarative rules per filter key
  buildDiscoveryQueryPlan(contract, ctx) → DiscoveryQueryPlan
       │
       ├──────────────────────────────┐
       ▼                              ▼
lib/search/discovery-query-executor.js   (NEW)
  executeCatalogPlan(plan)                 executeMapPinsPlan(plan)
       │                              │
       ▼                              ▼
runListingsSearchGet (thin)      runMapPinsGet (thin)
  serialize + ranking + promos       pins/clusters + fuzz coords
```

**Удаляемое дублирование (после миграции):**

- `buildMetadataFiltersFromSearchParams` → registry entries
- Дублирующий parse в `run-listings-search-get.js` и `run-map-pins-get.js` → `parseDiscoveryFiltersFromSearchParams`
- Раздельные `buildListingsQuery` / `buildMapPinsQuery` spatial ветки → `plan.spatial`

### 1.3 `DiscoveryFilterContract` — типовая схема

```typescript
/**
 * Stage 177.0 — normalized search input (not URL-shaped).
 * All handlers MUST accept only this type after parse.
 */
type DiscoveryFilterContract = {
  version: 1

  // ── Text & semantic ─────────────────────────────
  q: string | null
  semantic: boolean

  // ── Category (vertical scope) ───────────────────
  categorySlug: string | null          // normalized slug; null = all
  categoryIds: string[] | null         // resolved parent+children; filled by resolver

  // ── Geo (mutually composable with explicit precedence) ──
  geo: DiscoveryGeoFilter | null

  // ── Dates & capacity ────────────────────────────
  stay: {
    checkIn: string | null              // YYYY-MM-DD (listing TZ rules downstream)
    checkOut: string | null
    checkInTime: string | null          // HH:mm transport interval
    checkOutTime: string | null
    guests: number | null
    softAvailability: boolean
  }

  // ── Price (THB guest-facing pre-availability) ─
  price: {
    minThb: number | null
    maxThb: number | null
  }

  // ── Housing SQL facets ──────────────────────────
  housing: {
    bedroomsMin: number | null
    bathroomsMin: number | null
    amenities: string[]                 // slugs
    instantBookingOnly: boolean
  }

  // ── Vertical metadata facets (→ SQL after Stage 177.1) ──
  vertical: {
    transmission: string | null
    fuelType: string | null
    engineCcMin: number | null
    cabinsMin: number | null
    nannyLangs: string[]
    nannyExperienceMin: number | null
    nannySpecialization: string | null
    serviceHomeVisitOnly: boolean
  }

  // ── Location text (non-spatial) ─────────────────
  where: string | null                  // smart resolve → geo codes
  locationLegacy: string | null
  cityLegacy: string | null

  // ── Browse / ranking ────────────────────────────
  browse: {
    limit: number
    featured: boolean
    sort: CatalogSort
    isLite: boolean
  }

  // ── Map-only ────────────────────────────────────
  map: {
    cluster: boolean
    clusterCellM: number
  }
}

type DiscoveryGeoFilter =
  | { mode: 'none' }
  | { mode: 'where_text' }               // handled via where resolver, not coordinates
  | {
      mode: 'bbox'
      south: number
      north: number
      west: number
      east: number
      quantized: boolean                 // client sent 3-decimal quantize
    }
  | {
      mode: 'radius'
      lat: number
      lng: number
      radiusKm: number
    }
  | {
      mode: 'polygon'
      /** GeoJSON Polygon | MultiPolygon — see §3 */
      geojson: GeoJSONPolygonInput
      srid: 4326
    }

type DiscoveryQueryPlan = {
  contract: DiscoveryFilterContract
  spatial: {
    engine: 'postgis' | 'haversine_fallback' | 'none'
    rpc?: 'bbox_gist' | 'radius_knn' | 'polygon_v1'
    rpcArgs?: Record<string, unknown>
    listingIds?: string[] | null        // precomputed id filter
    distanceKmById?: Map<string, number>
  }
  sql: {
    table: 'listings'                   // service_role; never listings_public_catalog for spatial
    status: 'ACTIVE'
    categoryIds: string[] | null
    textOrClause: string | null
    whereOrClause: string | null
    jsonbPredicates: JsonbPredicate[]   // §2
    scalarPredicates: ScalarPredicate[]
    orderBy: OrderClause[]
    limit: number                       // execution limit (may differ from response limit)
    offset: number                      // NEW — cursor phase 177.2
  }
  postSteps: PostStep[]                 // ordered; minimal after SQL migration
  cache: {
    eligible: boolean
    key: string | null
  }
}
```

### 1.4 `filter-registry.js` — структура реестра

Файл: **`lib/search/filter-registry.js`** (новый SSOT).

Каждая запись описывает **один фильтр** независимо от vertical UI panel:

```javascript
/**
 * @typedef {'all'|'housing'|'transport'|'service'|'tour'} FilterVerticalScope
 * @typedef {'sql'|'rpc'|'post'|'availability'|'ranking'} FilterExecutionLayer
 */

/** @type {Record<string, FilterDefinition>} */
export const FILTER_REGISTRY = {
  'category': {
    urlKeys: ['category'],
    verticals: ['all'],
    layer: 'sql',
    parse: (sp, draft) => { /* normalizeListingCategorySlugForSearch */ },
    resolve: async (contract) => { /* resolveListingCategoryIdsForSearchScope */ },
    applySql: (q, contract) => { /* .in('category_id', ids) */ },
  },

  'geo.bbox': {
    urlKeys: ['south', 'north', 'west', 'east'],
    verticals: ['all'],
    layer: 'rpc',                        // Stage 177.1: GiST RPC primary
    parse: (sp, draft) => { /* parseMapBounds */ },
    planSpatial: (contract, plan) => { /* ST_MakeEnvelope / listings_map_pin_ids_in_bbox_gist_v1 */ },
    surfaces: ['catalog', 'map'],        // both MUST register
  },

  'geo.radius': {
    urlKeys: ['lat', 'lng', 'lon', 'radius', 'radiusKm'],
    verticals: ['all'],
    layer: 'rpc',
    parse: (sp, draft) => { /* parseSpatialRadiusFromSearchParams */ },
    planSpatial: (contract, plan) => { /* listings_ids_within_radius_v1 */ },
  },

  'geo.polygon': {
    urlKeys: ['polygon'],                // GeoJSON string or hash ref — §3
    verticals: ['all'],
    layer: 'rpc',
    parse: (sp, draft) => { /* validate GeoJSON */ },
    planSpatial: (contract, plan) => { /* listings_within_polygon_v1 */ },
    surfaces: ['catalog', 'map'],
  },

  'housing.amenities': {
    urlKeys: ['amenities'],
    verticals: ['housing', 'all'],     // all = when category=all, still allowed
    layer: 'sql',                        // migrate: single @> with array — §2
    parse: (sp, draft) => { /* CSV slugs */ },
    applySql: (q, contract) => { /* metadata @> */ },
  },

  'transport.transmission': {
    urlKeys: ['transmission'],
    verticals: ['transport'],
    layer: 'sql',                        // was 'post' — §2 migration
    metadataPaths: ['transmission', 'gearbox'],
    applySql: (q, contract) => { /* expression index / generated col */ },
  },

  // … остальные vertical filters по тому же шаблону
}
```

#### Агрегация по вертикалям (Housing / Transport / Service)

Вертикаль определяется **не хардкодом в handler**, а цепочкой SSOT:

1. `categorySlug` → `categories.wizard_profile` (DB) или `getSearchFilterPanelKind()` (UI hint only).
2. `resolveActiveFilters(contract)`:
   - Берёт все ключи из `FILTER_REGISTRY`.
   - Фильтрует по `verticals` + `isFilterActive(contract, key)`.
   - **Неактивные vertical filters игнорируются** (не ошибка) — гость не получает 400 за `transmission` при `category=housing`.
3. `buildDiscoveryQueryPlan()` применяет только активные записи в **каноническом порядке**:
   ```
   category → geo RPC (id prefilter) → where text → sql scalars → jsonb → text q → order/limit
   ```

**UI sync:** `lib/search/search-filter-panel-kind.js` остаётся presentation-layer; registry — execution-layer. Документируем mapping в `FILTER_REGISTRY.uiPanels`.

### 1.5 Единый парсер и гарантия идентичности catalog ↔ map

Файл: **`lib/search/discovery-filter-contract.js`**

```javascript
export function parseDiscoveryFiltersFromSearchParams(searchParams, options = {}) {
  const draft = emptyContract()
  for (const def of Object.values(FILTER_REGISTRY)) {
    if (options.surface === 'map' && def.surfaces && !def.surfaces.includes('map')) continue
    def.parse?.(searchParams, draft)
  }
  return validateDiscoveryFilters(draft)
}

export function buildDiscoveryQueryPlan(contract, { surface }) {
  const plan = basePlan(contract)
  for (const key of ORDERED_FILTER_KEYS) {
    const def = FILTER_REGISTRY[key]
    if (!isFilterActive(contract, key)) continue
    if (def.layer === 'rpc') def.planSpatial?.(contract, plan)
    if (def.layer === 'sql') def.applySqlPlan?.(contract, plan)
  }
  plan.postSteps = computePostSteps(contract)  // availability, price-with-dates, fuzz
  plan.cache = computeCachePolicy(contract)
  return plan
}
```

**Handler contract (thin wrappers):**

```javascript
// run-listings-search-get.js (after migration)
const contract = parseDiscoveryFiltersFromSearchParams(searchParams, { surface: 'catalog' })
if (!contract.ok) return 400 validation error
const plan = await buildDiscoveryQueryPlan(contract.value, { surface: 'catalog' })
const rows = await executeCatalogPlan(plan)
return serializeCatalogResponse(rows, plan)

// run-map-pins-get.js
const contract = parseDiscoveryFiltersFromSearchParams(searchParams, { surface: 'map' })
// MUST reject only map-specific rules (e.g. missing geo), not filter mismatch
const plan = await buildDiscoveryQueryPlan(contract.value, { surface: 'map' })
assertGeoRequired(plan)  // bbox | radius | polygon
const payload = await executeMapPinsPlan(plan)
```

**Тестовая гарантия (CI):**

- Fixture matrix: N URL queries × 2 surfaces.
- Assert `buildDiscoveryQueryPlan(catalog)` и `buildDiscoveryQueryPlan(map)` имеют **идентичные** `spatial`, `sql.jsonbPredicates`, `sql.categoryIds`, `stay`, `price`.
- Diff только в `plan.sql.select`, `plan.browse.limit`, `plan.map.*`.

### 1.6 Post-steps, которые остаются в Node (осознанно)

| Step | Layer | Причина |
|------|-------|---------|
| `availability` | post | Calendar RPC, dynamic pricing |
| `effectivePriceRange` | post | Price depends on dates |
| `semanticReorder` | post | pgvector ordering |
| `serializePublicCoordinates` | post | ADR-163 fuzz |
| `contactLeakPenalty` | post | Business ranking |
| E2E catalog exclusion | post | Test data hygiene |

Цель Stage 177.1 — **убрать `listingMatchesMetadataFilters` из post-steps**.

---

## 2. Миграция metadata в SQL (B2, B4, B8)

### 2.1 Стратегия

**Фаза A (177.1):** JSONB operators в Supabase query chain — без generated columns.  
**Фаза B (177.2):** Generated columns + B-tree / GIN для hot facets.  
**Фаза C (177.3):** Materialized facet table (опционально, >500k listings).

#### Принцип SSOT путей metadata

Сейчас `listing-metadata-filter.js` проверяет алиасы (`gearbox`, `fuel`, `engine_cc`). В SQL вводим **нормализующие expression**, дублируя логику **один раз** в migration + unit tests против JS oracle (deprecate JS).

### 2.2 Шаблоны SQL (Supabase / PostgREST)

#### Amenities (housing) — containment

```sql
-- Один amenity slug (текущий код: loop .contains per slug)
metadata @> '{"amenities": ["wifi"]}'::jsonb

-- Несколько amenities (AND — все должны присутствовать)
metadata @> '{"amenities": ["wifi", "pool"]}'::jsonb

-- Индекс
CREATE INDEX IF NOT EXISTS idx_listings_metadata_amenities_gin
  ON public.listings
  USING GIN ((metadata -> 'amenities') jsonb_path_ops)
  WHERE status = 'ACTIVE';
```

PostgREST: `.filter('metadata', 'cs', '{"amenities":["wifi"]}')` или raw `.contains('metadata', { amenities: ['wifi'] })` — **один вызов** вместо N.

#### Transmission (transport) — equality / ILIKE на нормализованном поле

```sql
-- Expression index path (Phase B)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS transport_transmission text
  GENERATED ALWAYS AS (
    lower(coalesce(metadata->>'transmission', metadata->>'gearbox', ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_listings_transport_transmission
  ON public.listings (transport_transmission)
  WHERE status = 'ACTIVE' AND transport_transmission <> '';

-- Query
WHERE transport_transmission = lower(:transmission)
   OR transport_transmission LIKE lower(:transmission) || '%'
```

#### Fuel type

```sql
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS transport_fuel_type text
  GENERATED ALWAYS AS (
    lower(coalesce(metadata->>'fuel_type', metadata->>'fuel', ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_listings_transport_fuel
  ON public.listings (transport_fuel_type)
  WHERE status = 'ACTIVE';
```

#### Engine CC min (numeric)

```sql
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS transport_engine_cc integer
  GENERATED ALWAYS AS (
    NULLIF(regexp_replace(
      coalesce(
        metadata->>'engine_cc',
        metadata->>'engine_displacement',
        metadata->>'engine_size_cc',
        metadata->>'engine',
        ''
      ),
      '[^0-9]', '', 'g'
    ), '')::integer
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_listings_transport_engine_cc
  ON public.listings (transport_engine_cc)
  WHERE status = 'ACTIVE' AND transport_engine_cc IS NOT NULL;

-- Query
WHERE transport_engine_cc >= :engine_cc_min
```

#### Service home visit

```sql
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS service_home_visit boolean
  GENERATED ALWAYS AS (
    CASE
      WHEN metadata->>'home_visit' IN ('true', '1') THEN true
      WHEN metadata->>'home_visit' = 'false' THEN false
      ELSE (metadata->'home_visit')::boolean
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_listings_service_home_visit
  ON public.listings (service_home_visit)
  WHERE status = 'ACTIVE' AND service_home_visit = true;
```

#### Nanny languages (array overlap)

```sql
-- Normalized text[] column (Phase B)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS nanny_languages text[]
  GENERATED ALWAYS AS (
    /* parse metadata->languages | languages_spoken | language into lower text[] */
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_listings_nanny_languages_gin
  ON public.listings
  USING GIN (nanny_languages)
  WHERE status = 'ACTIVE';

-- Query: каждый требуемый язык ∈ массиве
WHERE nanny_languages @> ARRAY[:lang1, :lang2]::text[]
```

### 2.3 Индексная матрица (рекомендуемая)

| Filter | Index type | Column / expression |
|--------|------------|-------------------|
| amenities | GIN `jsonb_path_ops` | `(metadata -> 'amenities')` |
| instant_booking | B-tree (exists) | `instant_booking` |
| bedrooms/bathrooms | B-tree (exists) | `bedrooms_count`, `bathrooms_count` |
| transmission | B-tree | `transport_transmission` STORED |
| fuel_type | B-tree | `transport_fuel_type` STORED |
| engine_cc_min | B-tree | `transport_engine_cc` STORED |
| cabins_min | B-tree | `transport_cabins` STORED |
| service_home_visit | Partial B-tree | `service_home_visit` |
| nanny_languages | GIN | `nanny_languages` |
| category + geo | Composite partial | `(category_id)` + existing GiST `coordinates` |

**Миграция:** `migrations/stage177_1_discovery_metadata_sql_facets.sql` — generated columns + indexes + COMMENT.

### 2.4 Как это снимает лимит 500 (B4)

**Сейчас:**

```
SQL LIMIT 500 → JS metadata filter → JS availability → slice(limit)
         ↑ теряем строки, которые прошли бы SQL, но отсечены post-filter
```

**После:**

```
Geo RPC → listing_ids (ordered, capped at MAX_SPATIAL_IDS e.g. 10_000)
       → SQL WHERE id = ANY($ids) AND jsonb facets AND category …
       → ORDER BY … LIMIT $pageSize OFFSET $cursor
       → availability only on page (batch 24–50)
```

Ключевые изменения:

1. **Spatial prefilter сначала** — GiST/radius/polygon сужает id set **в БД**.
2. **Metadata в SQL** — `LIMIT` применяется после всех facet predicates.
3. **Pagination contract (177.2):**
   - `cursor` + `limit` (opaque base64: `{sortKey, id}`).
   - `fetchLimit` deprecated; default page 24, max 50 catalog / 500 map-pins.
4. **Availability last** — только на финальной странице (уже так задумано, но перестаём «прожигать» 500 слотов).

**Оценка:** при 100k listings и 5 metadata filters переход с ~15% полезной выдачи на странице до **>95%** без увеличения Node CPU.

---

## 3. Контракт Polygon Search (B1)

### 3.1 UX → API

Гость рисует полигон на Leaflet (`leaflet-draw` или аналог). Фронт:

1. Замыкает кольцо (первая точка = последняя).
2. Валидирует: ≤ 500 vertices, bbox area < max (например 50 km² product rule).
3. Отправляет в search URL.

### 3.2 Формат данных (HTTP)

**Канонический query param:** `polygon`

| Вариант | Когда | Формат |
|---------|-------|--------|
| **A (recommended)** | < 4 KB | `polygon=base64url(gzip(GeoJSON))` |
| **B (fallback)** | большие полигоны | `POST /api/v2/search/geo` body `{ geojson }` → `{ searchToken }` + `polygonToken=…` в URL |
| **C (dev)** | отладка | Raw GeoJSON в POST only (не в GET logs) |

**GeoJSON schema (строгий):**

```typescript
type GeoJSONPolygonInput = {
  type: 'Polygon'
  coordinates: [number, number][][]  // [ring][vertex][lng, lat] — RFC 7946
}

// MultiPolygon — Phase 177.4 (optional)
```

**Validation rules (`validatePolygonGeoJson`):**

- `type === 'Polygon'`
- Первое кольцо — outer ring; min 4 points, closed.
- WGS84 only: lng ∈ [-180,180], lat ∈ [-90,90].
- No self-intersection (или auto-repair через `ST_MakeValid` server-side с telemetry).
- Max vertices: 500.
- Max area: configurable (`DISCOVERY_POLYGON_MAX_AREA_KM2`, default 50).
- Antimeridian: split rings или reject с понятной ошибкой.

**Взаимодействие с bbox/radius:**

| Приоритет | Правило |
|-----------|---------|
| 1 | `polygon` если присутствует — **игнорирует** bbox corners |
| 2 | иначе `south/north/west/east` |
| 3 | иначе `lat/lng/radius` |
| — | `where` text **AND** с spatial (пересечение) |

### 3.3 RPC: `listings_within_polygon_v1`

**Миграция:** `migrations/stage177_0_postgis_polygon_search.sql`

```sql
CREATE OR REPLACE FUNCTION public.listings_within_polygon_v1(
  p_geojson     jsonb,
  p_limit       integer DEFAULT 10000,
  p_category_ids text[] DEFAULT NULL
)
RETURNS TABLE (
  listing_id       text,
  distance_meters  double precision  -- distance to polygon centroid (optional sort key)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH poly AS (
    SELECT ST_SetSRID(
      ST_GeomFromGeoJSON(p_geojson::text),
      4326
    )::geography AS geo
  ),
  poly_geom AS (
    SELECT CASE
      WHEN ST_IsValid(g::geometry) THEN g
      ELSE ST_MakeValid(g::geometry)::geography
    END AS geo
    FROM poly AS p(g)
  )
  SELECT
    l.id AS listing_id,
    ST_Distance(l.coordinates, ST_Centroid(pg.geo::geometry)::geography)::double precision AS distance_meters
  FROM public.listings AS l
  CROSS JOIN poly_geom AS pg
  WHERE l.status = 'ACTIVE'
    AND l.coordinates IS NOT NULL
    AND ST_Intersects(l.coordinates, pg.geo)
    AND (
      p_category_ids IS NULL
      OR cardinality(p_category_ids) = 0
      OR l.category_id = ANY (p_category_ids)
    )
  ORDER BY l.coordinates <-> ST_Centroid(pg.geo::geometry)::geography
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10000), 10000));
$$;

REVOKE ALL ON FUNCTION public.listings_within_polygon_v1(jsonb, integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listings_within_polygon_v1(jsonb, integer, text[]) TO service_role;
```

**Почему `ST_Intersects` а не `ST_Contains`:**

- `ST_Contains(polygon, point)` — точка строго внутри; на границе — false.
- `ST_Intersects` — industry default для map draw (включая границу).
- Product copy: «в выбранной области» → Intersects.

**Privacy:** RPC использует **true** `coordinates`; fuzz на serialize (ADR-163). Cluster centroids для polygon mode — grid внутри polygon bbox (reuse `listings_map_clusters_grid_v1` + polygon clip в 177.4).

### 3.4 Frontend contract

```javascript
// lib/search/discovery-geo-polygon.js (future)
export function polygonToSearchParam(geojson) { /* gzip + base64url */ }
export function parsePolygonFromSearchParams(sp) { /* inverse */ }

// URL example
// /listings?category=vehicles&polygon=eyJ0eXBlIjoi...&checkIn=2026-07-01
```

**Leaflet:** хранить draw layer state отдельно от URL; debounce 300ms перед pushState.

---

## 4. Интеграция GiST в каталог (B3)

### 4.1 Текущее vs целевое

| | Сейчас (`query-builder.js`) | Цель (177.1) |
|---|------------------------------|--------------|
| Bbox | `gte/lte latitude/longitude` | RPC `listings_map_pin_ids_in_bbox_gist_v1` или inline `coordinates && envelope` |
| Post-JS | `pointInBounds` на каждой строке | **Удалить** |
| Index | B-tree `(latitude, longitude)` | GiST `coordinates` (уже есть) |
| Anti-meridian | broken на lng wrap | PostGIS envelope handles |

### 4.2 План интеграции

**Шаг 1.** Расширить RPC `listings_map_pin_ids_in_bbox_gist_v1`:

```sql
-- Add optional category filter + higher limit for catalog prefilter
CREATE OR REPLACE FUNCTION public.listings_ids_in_bbox_gist_v1(
  p_south double precision,
  p_west  double precision,
  p_north double precision,
  p_east  double precision,
  p_category_ids text[] DEFAULT NULL,
  p_limit integer DEFAULT 10000
)
RETURNS TABLE (listing_id text)
...
```

**Шаг 2.** В `buildDiscoveryQueryPlan` при `geo.mode === 'bbox'`:

```javascript
plan.spatial = {
  engine: 'postgis',
  rpc: 'listings_ids_in_bbox_gist_v1',
  rpcArgs: { south, west, north, east, categoryIds, limit: MAX_SPATIAL_IDS },
}
plan.sql.listingIds = await callRpc(...)
// query-builder: .in('id', plan.sql.listingIds)
```

**Шаг 3.** Удалить из `query-builder.js`:

```javascript
// REMOVE
q = q.gte('latitude', dbBbox.south).lte('latitude', dbBbox.north)...
// REMOVE post-filter pointInBounds in run-listings-search-get.js
```

**Шаг 4.** Fallback если `coordinates IS NULL` (legacy rows):

```sql
-- OR branch in RPC (match stage163_0 pattern)
AND (
  (l.coordinates IS NOT NULL AND ST_Intersects(l.coordinates, env))
  OR (
    l.coordinates IS NULL
    AND l.latitude BETWEEN p_south AND p_north
    AND l.longitude BETWEEN p_west AND p_east
  )
)
```

**Шаг 5.** Telemetry: `spatialEngine: 'gist_bbox'` в `meta` ответа; slow query trace reuse `traceSpatialQuery`.

### 4.3 Согласование с map-pins

Один RPC `listings_ids_in_bbox_gist_v1` — **shared** между catalog plan и map-pins plan. Map-pins при count > 200 переключается на `listings_map_clusters_grid_v1` (без изменений).

### 4.4 Quantized bbox

Клиент продолжает `lib/geo/quantize-map-bbox.js` (3 decimals). Parser помечает `geo.quantized = true` для analytics only; RPC использует raw float64 из URL.

---

## 5. Rollout plan

| Stage | Scope | Deliverables |
|-------|-------|--------------|
| **177.0** | Design | Этот blueprint; review ADR-177 |
| **177.1** | Unified parse + GiST bbox + registry skeleton | `discovery-filter-contract.js`, `filter-registry.js`, thin handlers, SQL amenities GIN |
| **177.2** | Metadata generated columns + pagination cursor | Migration facets; remove JS metadata filter |
| **177.3** | Polygon RPC + draw UI | `listings_within_polygon_v1`, Leaflet draw |
| **177.4** | Facet counts API + polygon clusters | `GET /api/v2/search/facets` |
| **177.5** | Docs sync | `SEARCH_FILTERS_QUERY_MAP.md`, passport §Discovery |

**Feature flags:**

- `DISCOVERY_UNIFIED_PIPELINE=1`
- `DISCOVERY_POLYGON_SEARCH=0|1`
- `DISCOVERY_SQL_METADATA_FACETS=0|1`

**Rollback:** handlers сохраняют legacy path за flag до 177.2 soak.

---

## 6. Non-goals (Stage 177)

- Elasticsearch / Typesense (semantic остаётся pgvector).
- Замена Leaflet на Mapbox GL.
- Real-time inventory websocket на карте.
- Полигоны с holes (inner rings) — Phase 177.4+.

---

## 7. Acceptance criteria

1. Один и тот же URL (без map-only keys) даёт **идентичный id set** в catalog и map-pins до serialize.
2. Metadata filters transport/service **не выполняются** в Node при `DISCOVERY_SQL_METADATA_FACETS=1`.
3. Bbox catalog **не вызывает** `pointInBounds` в JS.
4. Polygon search возвращает результаты < 200ms p95 на 50k ACTIVE listings (GiST + category prefilter).
5. `docs/SEARCH_FILTERS_QUERY_MAP.md` обновлён с `polygon`, `polygonToken`, unified parse.
6. Privacy: ни один public response не содержит true coords для fuzz verticals (ADR-163 regression suite).

---

## 8. Замечания архитектора

1. **Не плодить третий pipeline** для facets — `buildDiscoveryQueryPlan` + `COUNT` variant.
2. **Generated columns** предпочтительнее чистого `metadata->>` в hot path — стабильные планы Postgres.
3. **Polygon token store** (если POST fallback) — Redis / `search_geo_tokens` table с TTL 15 min, не session cookie.
4. **SSOT vertical behavior** — registry ссылается на `category-behavior.js`, не дублирует `mapLocationDisplayMode`.
5. Паспорт §2.1 listings — дополнить geo columns в том же PR что 177.1 code.

---

## Appendix A — URL param crosswalk (target)

| Param | Contract path | Registry key | SQL/RPC |
|-------|---------------|--------------|---------|
| `category` | `categorySlug` | `category` | `category_id IN` |
| `south…east` | `geo.bbox` | `geo.bbox` | `listings_ids_in_bbox_gist_v1` |
| `lat`, `radiusKm` | `geo.radius` | `geo.radius` | `listings_ids_within_radius_v1` |
| `polygon` | `geo.polygon` | `geo.polygon` | `listings_within_polygon_v1` |
| `where` | `where` | `where.text` | `buildSmartWhereOrClause` |
| `amenities` | `housing.amenities` | `housing.amenities` | `metadata @>` |
| `transmission` | `vertical.transmission` | `transport.transmission` | `transport_transmission` |
| `checkIn/Out` | `stay.*` | `stay.dates` | availability post |
| `sort=distance` | `browse.sort` | `ranking.distance` | RPC order preserved |

---

## Appendix B — File map (to create)

```
lib/search/
  discovery-filter-contract.js    # parse + validate + types (JSDoc)
  filter-registry.js              # FILTER_REGISTRY + ORDERED_FILTER_KEYS
  discovery-query-plan.js         # buildDiscoveryQueryPlan
  discovery-query-executor.js     # executeCatalogPlan / executeMapPinsPlan
  discovery-geo-polygon.js        # GeoJSON validate + encode (177.3)

migrations/
  stage177_0_postgis_polygon_search.sql
  stage177_1_discovery_metadata_sql_facets.sql
  stage177_1_gist_bbox_catalog_rpc.sql

docs/
  ADR/177-discovery-filter-contract.md   # normative ADR (follow-up)
  SEARCH_FILTERS_QUERY_MAP.md            # update in 177.5
```

---

*Document version: 177.0.0-draft | Author: Platform Architecture | Last updated: 2026-06-22*
