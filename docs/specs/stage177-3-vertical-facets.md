# Stage 177.3 — Специфичные фильтры Транспорта и Яхт (Vertical Metadata Facets)

> **Status:** E1–E4 implemented (registry, SQL executor, handler guard); docs T3.19 pending  
> **Parent spec:** [`discovery-architecture-blueprint.md`](./discovery-architecture-blueprint.md)  
> **Predecessors:** [`stage177-2b-housing-filters.md`](./stage177-2b-housing-filters.md) (E1–E3 implemented), [`stage177-2c-calendar-availability.md`](./stage177-2c-calendar-availability.md) (E1–E3 implemented)  
> **Product:** Airento  
> **Scope:** перенос transport/yacht metadata-фасетов из JS post-filter (`listing-metadata-filter.js`) в **`FILTER_REGISTRY`** + SQL-план unified discovery; симметричные vertical guards; паритет каталог ↔ карта; защита от кросс-вертикальной интерференции URL.  
> **Out of scope 177.3:** polygon draw (blueprint 177.3 polygon — отдельный трек), service/nanny facets в registry (177.4), generated STORED columns (фаза B — опциональная миграция после soak JSONB), UI новых полей `vessel_type` в визарде (если не блокирует SQL).

---

## 0. Аудит существующих наработок (не плодить дубли)

### 0.1 Что уже есть и **переиспользуем**

| Слой | Файл | Что уже сделано | Роль в 177.3 |
|------|------|-----------------|--------------|
| **Контракт (слоты vertical)** | `lib/search/discovery-filter-contract.js` | `vertical.transmission`, `fuelType`, `engineCcMin`, `cabinsMin` уже в `createEmptyDiscoveryContract()` | Расширить parse/validate + добавить `withCaptain`, `vesselType`; **не** вводить второй top-level объект |
| **URL SSOT (клиент)** | `lib/search/listings-page-url.js` | `parseExtraFiltersFromParams` / `appendExtraFiltersToParams`: `transmission`, `fuel_type`, `engine_cc_min`, `cabins_min` | Registry parse **делегирует** сюда или в общий helper |
| **Legacy JS post-filter** | `lib/search/listing-metadata-filter.js` | `buildMetadataFiltersFromSearchParams`, `listingMatchesMetadataFilters` — единственный oracle сегодня | Deprecate для unified path после SQL; оставить для `DISCOVERY_UNIFIED_PIPELINE=0` |
| **Housing guards (образец)** | `lib/search/discovery-housing-vertical-guard.js` | `HOUSING_SCOPED_REGISTRY_FILTER_KEYS`, `isHousingFilterVerticalAllowed` | Шаблон для `transport.*` / `yacht.*` guards |
| **JSONB text SQL** | `lib/api/search/discovery-jsonb-text-filter.js` | `text_eq_ci` на `metadata->>path` | `transport.transmission`, `transport.fuel_type`, `yacht.vessel_type` |
| **Executor cascade** | `lib/search/discovery-query-executor.js` | category → GiST bbox → stay.dates → scalar/jsonb → cursor → availability | Вставить transport/yacht predicates **до** cursor keyset |
| **Handler bridge** | `lib/api/run-listings-search-get.js`, `run-map-pins-get.js` | Двойной guard для availability (177.2c) | Аналогичный guard: skip `listingMatchesMetadataFilters` когда plan уже применил transport/yacht SQL |
| **UI панель** | `lib/search/search-filter-panel-kind.js`, `SearchFiltersDialog.jsx` | Панель `transport`: transmission, fuel, engine_cc, cabins (yacht); **нет** UI для crew/vessel type | 177.3 — API/контракт раньше UI; опционально T3.20 |
| **Wizard SSOT полей** | `lib/config/category-form-schema.js` | `TRANSPORT_VEHICLE_FIELDS`, `YACHT_FIELDS`, `PREMIUM_AIR_OR_SEA_FIELDS` | Канон ключей metadata при записи листинга |
| **Нормализация metadata** | `lib/partner/listing-wizard-metadata.js` | lowercase `transmission`, `fuel_type`; boolean `crew_included` | SQL предикаты опираются на нормализованные значения |
| **Категории** | `lib/listing-category-slug.js`, `category-wizard-profile-db.js` | `vehicles`, `isYachtLikeCategory`, `wizard_profile: transport \| yacht` | Vertical guard resolution |
| **Карта параметров** | `docs/SEARCH_FILTERS_QUERY_MAP.md` | transmission/fuel — только JS post | Обновить колонку «Unified registry» |
| **Blueprint** | `docs/specs/discovery-architecture-blueprint.md` §2.2 | STORED columns `transport_*`, `service_home_visit` | Фаза B после JSONB soak |

### 0.2 Терминология задания vs фактическая схема

В задании упомянуты `with_captain` и `yacht_type`. **В репозитории этих ключей metadata нет** (grep = 0). Канон платформы на сегодня:

| Концепт (задание / продукт) | Факт в `listings.metadata` (JSONB) | Примечание |
|-----------------------------|--------------------------------------|------------|
| `transmission` | `metadata.transmission` | Wizard select: `automatic`, `manual`, `cvt`; нормализация lowercase |
| (alias коробки) | `metadata.gearbox` | Legacy alias; читается в JS oracle, **не** пишется визардом |
| `fuel_type` | `metadata.fuel_type` | Wizard: `petrol`, `diesel`, `electric`, `hybrid` |
| (alias топлива) | `metadata.fuel` | Legacy alias в JS oracle |
| `engine_cc_min` (фильтр) | `metadata.engine_cc` | Wizard number; aliases в JS: `engine_displacement`, `engine_size_cc`, `engine` |
| `cabins_min` (фильтр) | `metadata.cabins` \| `cabins_count` \| `cabin_count` | UI фильтр для yacht panel; **нет** поля в `YACHT_FIELDS` визарда — данные из импорта/ручного ввода |
| `with_captain` (задание) | **`metadata.crew_included`** (boolean) | Wizard boolean `crew_included`; также на вертолётах (`transport_helicopter`) |
| `yacht_type` (задание) | **`metadata.subcategory`** (string) | Пример seed: `Sailing Yacht`; нет отдельного slug-поля в визарде |
| (резерв типа судна) | `metadata.vessel_type` / `boat_type` | **Не в визарде**; зарезервировать в контракте для будущего SSOT |

**Таблица / представление:** единственный SSOT хранения — **`public.listings.metadata`** (JSONB). Отдельных view `v_transport.*` / `v_yacht.*` нет. Колонки `listings.category_id` + join `categories.slug` / `categories.wizard_profile` задают вертикаль.

**Правило registry:** ключи **`transport.*`** и **`yacht.*`** — не литералы URL и не плоские поля контракта без namespace (как в blueprint Appendix A).

### 0.3 Что **не** дублируем

- Второй парсер metadata-фильтров вне `discovery-filter-contract` + registry.
- Параллельный `TransportSearchService` или отдельный API route.
- JS post-filter transport/yacht **после** unified SQL для тех же ключей (риск B4 и лишний CPU).
- Хардкод slug категорий в handlers — только `listing-category-slug.js` + `category-behavior.js` / `wizard_profile`.

### 0.4 Связь с B4, cursor и 177.2c

```
Сейчас (unified + transmission):
  SQL LIMIT pageSize → JS listingMatchesMetadataFilters → возможна недозагрузка / пустая страница

Цель 177.3:
  category → bbox → dates → price → housing guards OFF → transport/yacht JSONB SQL → cursor LIMIT
  → post: availability (177.2c), calendar price — без дубля metadata JS
```

Transport/yacht facets — **SQL layer** (`layer: 'sql'`), как housing.property_type. Availability и календарная цена — без изменений контракта 177.2c.

---

## 1. Аудит схемы метаданных (Metadata Schema Audit)

### 1.1 Транспорт (`categorySlug` → `vehicles`, `helicopters`, `wizard_profile: transport | transport_helicopter`)

| URL param (legacy) | Contract path (целевой) | Registry key | Metadata path (SSOT write) | Metadata fallbacks (read oracle) | Нормализация | Wizard SSOT |
|--------------------|-------------------------|--------------|----------------------------|----------------------------------|--------------|-------------|
| `transmission` | `vertical.transmission` | `transport.transmission` | `metadata.transmission` | `metadata.gearbox` | lowercase slug; UI: `automatic` \| `manual` \| `cvt` | `category-form-schema` select |
| `fuel_type`, `fuelType` | `vertical.fuelType` | `transport.fuel_type` | `metadata.fuel_type` | `metadata.fuel` | lowercase slug | select |
| `engine_cc_min`, `engineCcMin` | `vertical.engineCcMin` | `transport.engine_cc_min` | `metadata.engine_cc` | `engine_displacement`, `engine_size_cc`, `engine` | finite number ≥ 0 | number field |

**Каноничные ключи контракта/registry (финальные имена):**

- `transport.transmission` ← `vertical.transmission`
- `transport.fuel_type` ← `vertical.fuelType`
- `transport.engine_cc_min` ← `vertical.engineCcMin`

**SQL Phase A (177.3 core):** JSONB predicates на `listings.metadata` (см. §2.3).  
**SQL Phase B (опционально):** STORED `transport_transmission`, `transport_fuel_type`, `transport_engine_cc` — blueprint §2.2; миграция `stage177_1_discovery_metadata_sql_facets.sql` (ещё не в репо).

### 1.2 Яхты (`isYachtLikeCategory`, `wizard_profile: yacht`)

| URL param (целевой) | Contract path | Registry key | Metadata path (SSOT write) | Metadata fallbacks (read) | Нормализация | Wizard / данные |
|---------------------|---------------|--------------|----------------------------|---------------------------|--------------|-----------------|
| `with_captain`, `crew_included`, `withCaptain` | `vertical.withCaptain` | `yacht.with_captain` | `metadata.crew_included` | — | boolean true only активирует фильтр | `PREMIUM_AIR_OR_SEA_FIELDS` |
| `yacht_type`, `vessel_type` | `vertical.vesselType` | `yacht.vessel_type` | `metadata.subcategory` (primary) | `vessel_type`, `boat_type`, `property_type` | lowercase slug / `text_eq_ci` | **Gap:** нет select в визарде; seed использует free text |
| `cabins_min`, `cabinsMin` | `vertical.cabinsMin` | `yacht.cabins_min` | `metadata.cabins` | `cabins_count`, `cabin_count` | int ≥ 1 | демо/импорт; UI фильтр есть |

**Маппинг задания → канон:**

| Термин задания | Канон registry | Канон metadata (write) |
|----------------|--------------|------------------------|
| `vehicle.transmission` | `transport.transmission` | `transmission` |
| `vehicle.fuelType` (концепт) | `transport.fuel_type` | `fuel_type` |
| `yacht.withCaptain` | `yacht.with_captain` | `crew_included` |
| `yacht.yachtType` (концепт) | `yacht.vessel_type` | `subcategory` (+ aliases read) |

**ADR-решение (зафиксировать в PR):** URL `with_captain=1` — публичный алиас; parse пишет в `contract.vertical.withCaptain`; SQL читает `crew_included`. Не вводить дублирующий ключ `with_captain` в metadata без миграции данных.

**ADR-решение (тип судна):** до появления поля визарда `vessel_type` фильтр `yacht.vessel_type=catamaran` матчит `metadata.subcategory` и зарезервированные aliases через `text_eq_ci` **или** `ilike '%catamaran%'` только в migration oracle-тестах; в SQL Phase A — **exact slug** после нормализации (`catamaran`, `sailing_yacht`, …). Продуктовый список slug — вынести в `lib/search/yacht-vessel-type-slugs.js` (новый SSOT, без хардкода в registry).

### 1.3 Вместимость: `stay.guests` vs transport/yacht

| Вертикаль | Колонка SQL | Metadata fallback |
|-----------|-------------|-------------------|
| Housing | `listings.max_capacity` | `max_guests`, `guests` (JS only) |
| Yacht | **не** `stay.guests` при `wizard_profile=yacht` | `metadata.passengers` (wizard) |
| Vehicles | **не** `stay.guests` | `metadata.seats` (wizard) |

**177.2b defer:** при `category=vehicles` ключ `stay.guests` не активен.  
**177.3 (опционально T3.15):** `transport.seats_min` / `yacht.passengers_min` — отдельные registry keys; **не блокируют** core 177.3 если сроки жмут.

### 1.4 Семантика сравнения (важно для паритета legacy → SQL)

| Фильтр | Legacy JS (`listingMatchesMetadataFilters`) | Целевой SQL 177.3 |
|--------|---------------------------------------------|-------------------|
| transmission | `includes()` substring на lowercase | **Exact slug** `text_eq_ci` на `transmission`, fallback chain — **только в data migration**, не в hot path |
| fuel_type | `includes()` substring | **Exact slug** `text_eq_ci` |
| engine_cc_min | `>=` на первом finite alias | `jsonb_numeric_gte` на `engine_cc` (новый predicate) или STORED column |
| cabins_min | `>=` на aliases | `jsonb_numeric_gte` на `cabins` |
| with_captain | — (не реализовано) | `metadata @> { crew_included: true }` или `eq` boolean cast |
| vessel_type | — (не реализовано) | `text_eq_ci` на `subcategory` |

**Замечание инженера:** переход с `includes()` на exact match может **сузить** выдачу для грязных legacy строк (`"Automatic transmission"`). Перед включением SQL — one-off audit query + optional normalize job (out of scope кода 177.3, in scope runbook).

---

## 2. Расширение реестра и вертикальных гардов (Registry & Guards)

### 2.1 Новые registry keys

```javascript
// ORDERED_FILTER_KEYS — вставка после housing.amenities, перед будущими service.*

'transport.transmission'   // verticals: ['transport']
'transport.fuel_type'
'transport.engine_cc_min'
'yacht.with_captain'       // verticals: ['yacht', 'transport_helicopter'] — crew на вертолёте
'yacht.vessel_type'
'yacht.cabins_min'
```

Каждая запись `FilterDefinition`:

| Поле | Значение |
|------|----------|
| `layer` | `'sql'` |
| `surfaces` | `['catalog', 'map']` |
| `parse` | URL → `contract.vertical.*` |
| `applyPlan` | `plan.sql.jsonbPredicates` и/или `scalarPredicates` |
| `verticals` | см. guards §2.2 |

### 2.2 Vertical guards (новый модуль)

**Файл:** `lib/search/discovery-transport-vertical-guard.js` (transport + yacht в одном модуле или split — на усмотрение PR, **один** SSOT export set).

```javascript
export const TRANSPORT_SCOPED_REGISTRY_FILTER_KEYS = new Set([
  'transport.transmission',
  'transport.fuel_type',
  'transport.engine_cc_min',
])

export const YACHT_SCOPED_REGISTRY_FILTER_KEYS = new Set([
  'yacht.with_captain',
  'yacht.vessel_type',
  'yacht.cabins_min',
])

/**
 * Transport facets: только явная transport-категория (НЕ category=all).
 * @param {DiscoveryFilterContract} contract
 */
export function isTransportFilterVerticalAllowed(contract) {
  const slug = contract?.categorySlug
  if (!slug) return false  // ← отличие от housing: на «все категории» transmission игнорируется
  return isTransportListingCategory(slug)
}

/**
 * Yacht facets: yacht-like slug или wizard_profile yacht.
 * Helicopter: yacht.with_captain разрешён (crew_included), vessel_type/cabins — только yacht-like.
 */
export function isYachtFilterVerticalAllowed(contract, key) { /* … */ }

export function isTransportOrYachtRegistryFilterAllowedForContract(contract, key) {
  if (TRANSPORT_SCOPED_REGISTRY_FILTER_KEYS.has(key)) {
    return isTransportFilterVerticalAllowed(contract)
  }
  if (YACHT_SCOPED_REGISTRY_FILTER_KEYS.has(key)) {
    return isYachtFilterVerticalAllowed(contract, key)
  }
  return true
}
```

**Интеграция в `isRegistryFilterActive`:**

```javascript
export function isRegistryFilterActive(contract, key) {
  if (!isHousingRegistryFilterAllowedForContract(contract, key)) return false
  if (!isTransportOrYachtRegistryFilterAllowedForContract(contract, key)) return false
  // switch по ключам…
}
```

**Матрица активации (category × filter):**

| `categorySlug` | `housing.*` | `stay.guests` | `transport.*` | `yacht.*` |
|----------------|-------------|---------------|---------------|-----------|
| *(unset / all)* | ✅ (как 177.2b) | ✅ | ❌ ignore | ❌ ignore |
| `property`, housing | ✅ | ✅ | ❌ ignore | ❌ ignore |
| `vehicles` | ❌ ignore | ❌ ignore | ✅ | ❌ ignore |
| `yachts`, `*yacht*` | ❌ ignore | ❌ ignore | ❌ ignore* | ✅ |
| `helicopters` | ❌ ignore | ❌ ignore | ✅ (transmission/fuel/engine) | `with_captain` only |

\*Transmission UI показывается в transport panel и для yacht (`search-filter-panel-kind` → `transport`); **registry** не применяет `transport.transmission` к yacht-listings без категории vehicles — иначе ложные отсечения (у яхты нет коробки).

**Поведение при cross-vertical URL (blueprint §1.4):** параметр в URL **не даёт 400** — ключ просто не попадает в `registryFiltersApplied` / plan.

### 2.3 `applyPlan` + SQL predicates

#### Text facets — `discovery-jsonb-text-filter.js`

```javascript
// transport.transmission
plan.sql.jsonbPredicates.push(
  buildDiscoveryJsonbTextEqCiPredicate('transmission', contract.vertical.transmission)
)

// transport.fuel_type
buildDiscoveryJsonbTextEqCiPredicate('fuel_type', contract.vertical.fuelType)

// yacht.vessel_type — primary path subcategory
buildDiscoveryJsonbTextEqCiPredicate('subcategory', contract.vertical.vesselType)
```

**Замечание:** fallback read (`gearbox`, `fuel`, `vessel_type`) в SQL Phase A **не** chain-ятся (слишком дорого для PostgREST). Data backfill нормализует ключи; Phase B STORED columns с COALESCE в generated expression.

#### Numeric facets — новый helper `discovery-jsonb-numeric-filter.js`

```javascript
/**
 * @returns {{ op: 'jsonb_numeric_gte', path: string, value: number }}
 */
export function buildDiscoveryJsonbNumericGtePredicate(path, value) { /* … */ }
```

**Executor:** в `applyDiscoveryJsonbPredicate` — ветка `jsonb_numeric_gte`:

- PostgREST: filter на cast `(metadata->>path)::numeric` **если** поддерживается chain;
- Иначе: RPC wrapper / raw filter fragment (зафиксировать в T3.9 spike).

**Boolean facet `yacht.with_captain`:**

```javascript
plan.sql.jsonbPredicates.push({
  op: '@>',
  path: 'crew_included',  // contains single key
  value: true,
})
```

Использовать существующую ветку `@>` в `discovery-scalar-sql.js` (`query.contains('metadata', { crew_included: true })`).

### 2.4 Cascade order (обновлённый)

```
category
→ geo.bbox
→ stay.dates
→ price.range
→ housing.bedrooms | bathrooms | property_type | instant_booking | amenities  (guarded)
→ stay.guests  (housing guard)
→ transport.transmission | fuel_type | engine_cc_min  (transport guard)
→ yacht.with_captain | vessel_type | cabins_min  (yacht guard)
→ cursor / fetchLimit
→ availability post-step (177.2c)
```

### 2.5 `buildDiscoveryQueryPlan` / headroom / parity

1. **Headroom `fetchLimit`:** считать «тяжёлым» запрос с любым активным ключом из `{ transport.*, yacht.* }` (как housing).
2. **`discoveryPlanParitySnapshot`:** добавить `verticalTransmission`, `verticalFuelType`, `engineCcMin`, `withCaptain`, `vesselType`, `cabinsMin`, `jsonbPredicates` count.
3. **`diffDiscoveryPlansForSurfaces`:** catalog vs map — идентичные transport/yacht predicates.

### 2.6 Handler guard (deprecate double filter)

В `run-listings-search-get.js` / `run-map-pins-get.js`:

```javascript
function discoveryPlanHasMetadataFacetStep(plan) {
  return (plan?.registryFiltersApplied || []).some((k) =>
    k.startsWith('transport.') || k.startsWith('yacht.')
  )
}

// unified path:
if (discoveryPlanHasMetadataFacetStep(plan)) {
  // skip listingMatchesMetadataFilters for overlapping keys
}
```

Пересечение ключей — явный allowlist, не blind skip всех metadata filters (service nanny — ещё JS до 177.4).

---

## 3. Пошаговый Task Breakdown (T3.1–T3.X)

### E1 — Contract & parse

| ID | Задача | Файл | Acceptance |
|----|--------|------|------------|
| T3.1 | Parse URL → `contract.vertical`: `withCaptain`, `vesselType`; wire существующие поля через registry parse | `filter-registry.js`, опционально thin delegate в `listing-metadata-filter.js` | matrix parse tests |
| T3.2 | Validation: `TRANSMISSION_INVALID`, `FUEL_TYPE_INVALID`, `VESSEL_TYPE_INVALID`, `ENGINE_CC_INVALID` | `discovery-filter-contract.js` | invalid slug → issue; не блокирует другие фильтры |
| T3.3 | `freezeDiscoveryContract` — strip `_*Invalid` flags для vertical | `discovery-filter-contract.js` | snapshot stable |

### E2 — Vertical guards & registry

| ID | Задача | Файл | Acceptance |
|----|--------|------|------------|
| T3.4 | `discovery-transport-vertical-guard.js` + wire в `isRegistryFilterActive` | new + `filter-registry.js` | C-INT-3 matrix |
| T3.5 | Registry keys: `transport.transmission`, `transport.fuel_type`, `transport.engine_cc_min` | `filter-registry.js` | plan.jsonbPredicates / numeric |
| T3.6 | Registry keys: `yacht.with_captain`, `yacht.vessel_type`, `yacht.cabins_min` | `filter-registry.js` | catamaran + captain combo |
| T3.7 | Обновить `ORDERED_FILTER_KEYS`, `listActiveRegistryFilterKeys` switch cases | `filter-registry.js` | parity order test |

### E3 — SQL predicates & executor

| ID | Задача | Файл | Acceptance |
|----|--------|------|------------|
| T3.8 | `discovery-jsonb-numeric-filter.js` + ветка в `applyDiscoveryJsonbPredicate` | new + `discovery-scalar-sql.js` | engine_cc_min, cabins_min |
| T3.9 | Spike: PostgREST numeric cast на `metadata->>engine_cc` (document fallback) | spike note в PR | go/no-go для pure JSONB |
| T3.10 | Wire predicates в `executeDiscoverySqlPlan` / map pins | `discovery-query-executor.js` | executor integration test |
| T3.11 | Headroom + parity snapshot fields | `discovery-query-plan.js` | `test:discovery-pipeline` green |

### E4 — Handler bridge & legacy

| ID | Задача | Файл | Acceptance |
|----|--------|------|------------|
| T3.12 | Skip duplicate `listingMatchesMetadataFilters` when plan applied transport/yacht | `run-listings-search-get.js` | no double filter |
| T3.13 | То же для map pins | `run-map-pins-get.js` | map pin count parity |
| T3.14 | `sqlMetadataFiltersActive` — учитывать registry transport/yacht keys | `lib/api/search/params.js` | deprecated alias consistent |

### E5 — Tests & docs

| ID | Задача | Файл |
|----|--------|------|
| T3.15 | Contract parse matrix transport + yacht | `__tests__/discovery-transport-contract.test.js` (new) |
| T3.16 | Plan snapshot + guard matrix | `__tests__/discovery-transport-plan.test.js` (new) |
| T3.17 | Executor mocked chain | `__tests__/discovery-transport-executor.test.js` (new) |
| T3.18 | Расширить `discovery-pipeline-parity.test.js` | fixtures vehicles + yachts |
| T3.19 | `SEARCH_FILTERS_QUERY_MAP.md`, `TECHNICAL_MANIFESTO.md`, passport version | docs |

**npm script (предложение):**

```json
"test:discovery-transport": "node --import ./scripts/node-test-alias-register.mjs --test __tests__/discovery-transport-contract.test.js __tests__/discovery-transport-plan.test.js __tests__/discovery-transport-executor.test.js"
```

### E6 — Опционально (не блокирует core)

| ID | Задача | Примечание |
|----|--------|------------|
| T3.20 | UI: `with_captain` checkbox + `vessel_type` select в `SearchFiltersDialog` (yacht panel) | продукт; API готов раньше |
| T3.21 | Wizard field `vessel_type` select → пишет canonical `subcategory` slug | закрывает SSOT gap §1.2 |
| T3.22 | Миграция STORED columns + indexes (blueprint §2.2) | после JSONB soak metrics |
| T3.23 | `transport.seats_min` / `yacht.passengers_min` registry | вместимость transport/yacht |
| T3.24 | Data normalize job: `gearbox` → `transmission`, free-text subcategory → slug | runbook |

---

## 4. Матрица сквозных UX-тестов

### 4.1 Каталог (`/listings?category=vehicles`)

| # | Сценарий | URL (фрагмент) | Ожидание выдачи | Ожидание plan / meta |
|---|----------|----------------|-----------------|----------------------|
| UX-1 | **Автомат отсекает механику** | `category=vehicles&transmission=automatic` | Только листинги с `metadata.transmission=automatic` (или нормализованный эквивалент); **нет** manual/CVT-only | `registryFiltersApplied` содержит `transport.transmission`; JS post-filter не вызывается |
| UX-2 | Комбо fuel + engine | `fuel_type=diesel&engine_cc_min=1500` | Дизель + cc ≥ 1500 | два transport ключа в plan |
| UX-3 | Cursor стабильность | UX-1 + `cursor=…` | Следующая страница без дубликатов; refill (177.2c) не ломается от transport SQL | `next_cursor` из accepted rows |

### 4.2 Яхты (`/listings?category=yachts`)

| # | Сценарий | URL (фрагмент) | Ожидание | Plan |
|---|----------|----------------|----------|------|
| UX-4 | **Катамаран с капитаном** | `category=yachts&vessel_type=catamaran&with_captain=1` | Пересечение: `subcategory` (или slug) catamaran + `crew_included=true` | `yacht.vessel_type` + `yacht.with_captain` |
| UX-5 | Каюты минимум | `cabins_min=3` | `cabins` ≥ 3 | `yacht.cabins_min` |
| UX-6 | Без капитана не режет | `with_captain` absent | Все яхты, включая без `crew_included` | ключ не active |

### 4.3 Защита от интерференции (cross-vertical)

| # | Сценарий | URL | Ожидание |
|---|----------|-----|----------|
| UX-7 | **transmission на виллах** | `category=property&transmission=automatic` | Выдача **идентична** `category=property` без transmission; виллы с случайным `metadata.transmission` **не** отсекаются | `transport.transmission` **не** в `registryFiltersApplied`; HTTP 200 |
| UX-8 | bedrooms на транспорте | `category=vehicles&bedrooms=3` | Как 177.2b: bedrooms ignored | housing keys inactive |
| UX-9 | cabins на vehicles | `category=vehicles&cabins_min=2` | Ignored (не yacht category) | yacht key inactive |
| UX-10 | category=all + transmission | `transmission=automatic` (без category) | Ignored — гость не в transport vertical | нет transport в plan |

### 4.4 Карта (паритет)

| # | Сценарий | Ожидание |
|---|----------|----------|
| UX-11 | Те же params на `/api/v2/listings/map-pins` | `diffDiscoveryPlansForSurfaces` = 0; pin count ≤ catalog total; те же transport/yacht predicates |
| UX-12 | Bbox + transmission | GiST ids ∩ JSONB transmission; без второго metadata JS pass |

### 4.5 Регрессия unified pipeline

| # | Команда | Ожидание |
|---|---------|----------|
| UX-13 | `npm run test:discovery-housing` | green (guards не сломали housing) |
| UX-14 | `npm run test:discovery-calendar` | green |
| UX-15 | `npm run test:discovery-pipeline` | green + новые fixtures |
| UX-16 | `npm run test:discovery-transport` | green (новый пакет) |

---

## 5. Масштабируемость на другие категории и соответствие SSOT

### 5.1 Паттерн «вертикаль × registry namespace»

Архитектура 177.x **масштабируется** на услуги (массаж, экскурсии, доставка еды) по тому же шаблону:

| Будущая вертикаль | `wizard_profile` | Registry prefix | Metadata (уже в legacy JS) | Guard |
|-------------------|------------------|-----------------|---------------------------|-------|
| Nanny / services | `nanny`, `service_generic` | `service.*` | `languages`, `experience_years`, `specialization` | `isServiceFilterVerticalAllowed` |
| Massage | `massage` | `service.*` | `home_visit`, `massage_types` | + chef/massage slug |
| Tours | `tour` | `tour.*` | `duration` | `isTourListingCategory` |
| Food delivery | *новый profile* | `delivery.*` | TBD | новый guard + wizard fields |

**Уже готово в legacy:** `listing-metadata-filter.js` парсит `nanny_*`, `service_home_visit` — **не в registry**. Stage **177.4** — перенос service facets по копипасте guards + `discovery-jsonb-*` без изменения handler shape.

### 5.2 SSOT compliance checklist

| Принцип | Соответствие 177.3 | Замечание |
|---------|-------------------|-----------|
| Один контракт parse | ✅ `discovery-filter-contract` + registry | Не расширять `buildMetadataFiltersFromSearchParams` для unified |
| Один query plan | ✅ `buildDiscoveryQueryPlan` | Catalog/map diff |
| Категория / вертикаль | ✅ `listing-category-slug` + `wizard_profile` | Не хардкодить `vehicles` в executor |
| Metadata write keys | ✅ `category-form-schema` | Gap: `vessel_type` / `cabins` в визарде — T3.21 |
| URL карта | ✅ `SEARCH_FILTERS_QUERY_MAP.md` | Обновить в T3.19 |
| No handler branching | ✅ guards только в registry | Handlers — guard skip JS |
| Performance | ✅ SQL до LIMIT | Phase B indexes по метрикам |

### 5.3 Идеи и риски (для ревью)

1. **Gap `yacht_type`:** продуктовое имя фильтра «тип судна» должно писать **slug** в `subcategory` или новое поле `vessel_type`; до T3.21 фильтр работает только на уже заполненных листингах.
2. **`includes()` → exact match:** возможное сужение выдачи; нужен data audit перед prod flag.
3. **JSONB numeric cast:** без индекса на больших объёмах — следить за `EXPLAIN`; Phase B STORED columns — правильный путь при >100k transport listings.
4. **category=all + transport panel UI:** модалка показывает transmission при `panel=transport`, но поиск без `category` **не** применяет фильтр — UX может сбивать; рассмотреть auto-set `category=vehicles` при применении transport filters (продукт, out of scope 177.3).
5. **Еда / delivery:** потребует новый `wizard_profile` и escrow bucket в `category-behavior.js` — registry pattern готов, данные нет.

---

## 6. Производительность и экономия запросов к Supabase

| Принцип | Реализация |
|---------|------------|
| Один SQL page fetch | Все transport/yacht predicates в том же `buildListingsQuery`, что housing |
| Нет double metadata JS | Handler guard §2.6 |
| GiST сначала | Без изменений: bbox RPC сужает id set до JSONB filters |
| Нет лишнего availability RPC | 177.2c guard сохраняется; transport filters не триггерят второй batch |
| Индексы | Phase A: существующий GIN amenities + seq scan на JSONB text (приемлемо на pageSize 24–50 после category+bbox); Phase B: partial B-tree на STORED |
| Кэш ответа | `getCacheKey` в `params.js` — **добавить** transport/yacht params в ключ кэша при включении unified |

---

## 7. Feature flag и rollout

| Flag | Поведение |
|------|-----------|
| `DISCOVERY_UNIFIED_PIPELINE=0` | Legacy JS `listingMatchesMetadataFilters` без изменений |
| `DISCOVERY_UNIFIED_PIPELINE=1` | Registry SQL + handler guard |
| `DISCOVERY_SQL_METADATA_FACETS=1` (blueprint) | Optional kill-switch для A/B JSONB vs JS; default **on** после soak |

**Rollout:** staging → `test:discovery-transport` + manual UX matrix §4 → prod 10% → 100%.

---

## 8. Definition of Done (Stage 177.3)

1. Все ключи `transport.*` и `yacht.*` в `FILTER_REGISTRY` с parse, `applyPlan`, vertical guards.
2. Catalog и map pins — идентичный plan snapshot для transport/yacht facets.
3. Unified path не вызывает `listingMatchesMetadataFilters` для перенесённых ключей.
4. Cross-vertical URL не даёт 400 и не меняет выдачу (UX-7, UX-10).
5. Тест-пакет `test:discovery-transport` + регрессия housing/calendar/pipeline green.
6. `SEARCH_FILTERS_QUERY_MAP.md`, manifesto, passport обновлены.

---

*Document version: 177.3.0-draft | Author: Platform Architecture | Last updated: 2026-06-22*
