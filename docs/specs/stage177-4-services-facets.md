# Stage 177.4 — Фасеты услуг и нянь (Services & Nannies Metadata Facets)

> **Status:** draft (spec only — implementation pending)  
> **Parent spec:** [`discovery-architecture-blueprint.md`](./discovery-architecture-blueprint.md)  
> **Predecessors:** [`stage177-3-vertical-facets.md`](./stage177-3-vertical-facets.md) (E1–E4 implemented), [`stage177-2c-calendar-availability.md`](./stage177-2c-calendar-availability.md)  
> **Audit input:** технический аудит `lib/search/listing-metadata-filter.js` + `listing.metadata` (2026-06-22)  
> **Product:** Airento  
> **Scope:** перенос service/nanny metadata-фасетов из JS post-filter в **`FILTER_REGISTRY`** + SQL unified discovery; vertical guards против кросс-вертикального загрязнения; data backfill; полный deprecate JS oracle для unified path.  
> **Out of scope 177.4:** UI новых полей (`cuisine_types`, `massage_types`, `certifications` в поиске), generated STORED columns Phase B (опционально после soak), chef/massage-специфичные фасеты кроме `home_visit`, polygon draw, tours (`tour.*`).

---

## 0. Аудит существующих наработок (не плодить дубли)

### 0.1 Что уже есть и **переиспользуем**

| Слой | Файл | Что уже сделано | Роль в 177.4 |
|------|------|-----------------|--------------|
| **Контракт (слоты vertical)** | `lib/search/discovery-filter-contract.js` | `vertical.nannyLangs`, `nannyExperienceMin`, `nannySpecialization`, `serviceHomeVisitOnly` в `createEmptyDiscoveryContract()` | Wire parse/validate через registry; **не** второй top-level объект |
| **URL SSOT (клиент)** | `lib/search/listings-page-url.js` | `nanny_langs`, `nanny_experience_min`, `nanny_specialization`, `service_home_visit` | Registry parse делегирует legacy URL keys (обратная совместимость) |
| **Legacy JS oracle** | `lib/search/listing-metadata-filter.js` | Единственный runtime oracle для service facets сегодня | Deprecate для `DISCOVERY_UNIFIED_PIPELINE=1`; оставить для flag `=0` |
| **Transport guards (образец)** | `lib/search/discovery-transport-vertical-guard.js` | `isTransportFilterVerticalAllowed`, scoped key sets | Шаблон для `discovery-services-vertical-guard.js` |
| **Handler bridge (частичный)** | `lib/search/discovery-metadata-facet-page.js` | Strip transport/yacht при SQL plan | Расширить на `service.*` + полный skip service в unified |
| **JSONB SQL executor** | `lib/api/search/discovery-scalar-sql.js` | `@>`, `text_eq_ci`, `jsonb_numeric_gte` | Предикаты service facets |
| **Numeric cast** | `lib/search/discovery-jsonb-numeric-filter.js` | `metadata->>key::numeric` + `gte` | `service.experience_min` |
| **Text ilike** | `lib/api/search/discovery-jsonb-text-filter.js` | `metadata->>path` + `ilike` | `service.specialization` (с wildcards) |
| **Wizard SSOT write** | `lib/config/category-form-schema.js`, `lib/partner/listing-wizard-metadata.js` | `languages[]`, `experience_years`, `specialization`, `home_visit` | SQL читает канон после backfill |
| **UI панель** | `SearchFiltersDialog.jsx`, `search-filter-panel-kind.js` | Panel `service`: языки, опыт, специализация, выезд | Без изменений контракта URL в 177.4 |
| **Карта параметров** | `docs/SEARCH_FILTERS_QUERY_MAP.md` | nanny_* / service_home_visit — только JS post | Обновить колонку «Unified registry» |
| **Blueprint Phase B** | `discovery-architecture-blueprint.md` §2.2 | `service_home_visit` STORED, `nanny_languages` GIN | После soak JSONB Phase A |

### 0.2 Терминология задания vs фактическая схема

| Концепт (продукт / legacy URL) | Registry key (канон 177.4) | Metadata path (SSOT write) | Legacy read fallbacks (до backfill) |
|--------------------------------|----------------------------|--------------------------|-------------------------------------|
| `nanny_langs` | `service.languages` | `metadata.languages` (`string[]` кодов `ru\|en\|th\|zh`) | `languages_spoken`, `language` (строка CSV) |
| `nanny_experience_min` | `service.experience_min` | `metadata.experience_years` (int 0–80) | `experience`, `years_experience` |
| `nanny_specialization` | `service.specialization` | `metadata.specialization` (string, nanny profile) | `specialities`, `specialty`, `skills` (только migration oracle) |
| `service_home_visit` | `service.home_visit` | `metadata.home_visit` (boolean, massage profile) | — |

**Правило registry:** ключи **`service.*`** — namespace unified discovery; **не** расширять `buildMetadataFiltersFromSearchParams` для unified parse (только legacy flag `=0`).

**ADR-решение (URL aliases):** публичные query-параметры `nanny_*` и `service_home_visit` **сохраняются**; registry `parse` мапит их в `contract.vertical.*` без переименования URL в 177.4.

**ADR-решение (семантика языков):** после backfill — **exact superset** через JSONB `@>` (AND по всем выбранным кодам). Legacy fuzzy `includes()` в JS oracle **не** переносится в SQL (сужение выдачи — осознанное; см. runbook §4).

### 0.3 Связь с B4, cursor и 177.2c / 177.3

```
Сейчас (unified + nanny_langs на category=all):
  SQL LIMIT pageSize → JS listingMatchesMetadataFilters (service) → кросс-вертикальное загрязнение + недозагрузка

Цель 177.4:
  category (services|nannies) → bbox → dates → price → housing guards OFF
  → transport/yacht guards OFF → service JSONB SQL → cursor LIMIT
  → post: availability (177.2c), calendar price — без service metadata JS
```

Service facets — **SQL layer** (`layer: 'sql'`), симметрично `transport.*` / `yacht.*` (177.3).

---

## 1. Канонический контракт и SQL-маппинг

### 1.1 Четыре ключа `FILTER_REGISTRY`

| Registry key | `contract.vertical` path | Legacy URL params | `layer` | `surfaces` |
|--------------|--------------------------|-------------------|---------|------------|
| `service.languages` | `nannyLangs: string[]` | `nanny_langs` (CSV) | `sql` | `catalog`, `map` |
| `service.experience_min` | `nannyExperienceMin: number \| null` | `nanny_experience_min`, `nannyExperienceMin` | `sql` | `catalog`, `map` |
| `service.specialization` | `nannySpecialization: string \| null` | `nanny_specialization`, `nannySpecialization` | `sql` | `catalog`, `map` |
| `service.home_visit` | `serviceHomeVisitOnly: boolean` | `service_home_visit`, `home_visit_only`, `homeVisitOnly` | `sql` | `catalog`, `map` |

**`ORDERED_FILTER_KEYS`:** вставка **после** `yacht.cabins_min`, **перед** будущими `tour.*`:

```text
… → yacht.cabins_min → service.languages → service.experience_min
  → service.specialization → service.home_visit
```

### 1.2 Parse rules (registry → contract)

| Key | Parse | Validation issue code |
|-----|-------|----------------------|
| `service.languages` | CSV `nanny_langs` → trim → lowercase → whitelist `ru\|en\|th\|zh` (SSOT: `NANNY_LANG_OPTIONS`) | `SERVICE_LANG_INVALID` (неканоничный токен — игнор или issue, см. T4.2) |
| `service.experience_min` | `parseInt` первого finite из URL keys; `≤0` → `null` (не активирует фильтр) | `SERVICE_EXPERIENCE_INVALID` |
| `service.specialization` | trim, max 200 chars URL-side | — |
| `service.home_visit` | `boolParam` === `true` only | `SERVICE_HOME_VISIT_INVALID` |

### 1.3 SQL-маппинг (PostgREST / Supabase-js)

Исполнитель: `applyDiscoveryJsonbPredicate` / `applyDiscoveryJsonbNumericGteToQuery` в `lib/api/search/discovery-scalar-sql.js`.

#### `service.experience_min`

**Семантика:** listing experience **≥** filter (не равенство, не диапазон) — parity с legacy `listingMatchesMetadataFilters`.

**Predicate:**

```javascript
{
  op: 'jsonb_numeric_gte',
  path: 'experience_years',
  value: contract.vertical.nannyExperienceMin,
}
```

**PostgREST column (канон):**

```sql
(metadata->>'experience_years')::numeric >= :value
```

Реализация: `discoveryMetadataNumericCastColumn('experience_years')` + `.filter(column, 'gte', value)` (`discovery-jsonb-numeric-filter.js`).

**Ограничение:** активируется только при `value >= 1` (UI «1+»…«10+»). Значение `0` / отсутствие — фильтр не в plan.

**Pre-backfill:** runbook §4 консолидирует `experience` / `years_experience` → `experience_years`. До backfill SQL **не** читает aliases (только канон).

#### `service.languages`

**Семантика:** **AND** — листинг должен содержать **все** выбранные коды (после backfill exact match).

**Predicate (на каждый код или один superset):**

```javascript
// Рекомендуемый вариант — один @> с полным массивом требуемых кодов:
{
  op: '@>',
  path: 'languages',
  value: ['en', 'ru'], // отсортированный unique contract.vertical.nannyLangs
}
```

**PostgREST / SQL эквивалент:**

```sql
metadata @> '{"languages": ["en"]}'::jsonb
-- для нескольких языков (AND):
metadata @> '{"languages": ["en", "ru"]}'::jsonb
```

Реализация executor: `query.contains('metadata', { languages: [...codes] })` — как `yacht.with_captain` / amenities.

**Канон write:** `string[]` кодов (`lib/partner/listing-wizard-metadata.js` → `normalizeLanguages`). Массив объектов **не** поддерживается.

#### `service.specialization`

**Семантика:** case-insensitive substring по полю `metadata.specialization` (после backfill — **только** канон; legacy `specialities` / `skills` — runbook).

**Predicate:**

```javascript
{
  op: 'text_ilike_contains',
  path: 'specialization',
  value: normalizedKeyword, // trim, lowercased для сравнения; SQL — %keyword%
}
```

**PostgREST:**

```sql
metadata->>'specialization' ILIKE '%' || :keyword || '%'
```

**Реализация:** расширить `discovery-jsonb-text-filter.js` функцией `applyDiscoveryJsonbTextIlikeContainsToQuery` (wildcards **только** на SQL стороне; URL без `%`). Либо predicate `op: 'text_ilike_contains'` в `DiscoveryJsonbPredicate` union type.

**Не** склеивать `specialities` / `skills` в SQL Phase A — только `specialization` после backfill.

#### `service.home_visit`

**Семантика:** strict boolean `true` (parity legacy: только `true` / `'true'` в metadata).

**Predicate:**

```javascript
{
  op: '@>',
  path: 'home_visit',
  value: true,
}
```

**PostgREST / SQL:**

```sql
metadata @> '{"home_visit": true}'::jsonb
```

Реализация: `query.contains('metadata', { home_visit: true })`.

**Продуктовое замечание:** поле пишется визардом для `wizard_profile=massage`, но фильтр доступен в UI panel `service` для всех service-категорий — SQL guard ограничивает категорией (§2).

### 1.4 Plan snapshot parity (catalog ↔ map)

Поля `discovery-query-plan.js` snapshot (как 177.3):

```javascript
serviceLanguages: contract.vertical?.nannyLangs ?? [],
serviceExperienceMin: contract.vertical?.nannyExperienceMin ?? null,
serviceSpecialization: contract.vertical?.nannySpecialization ?? null,
serviceHomeVisit: contract.vertical?.serviceHomeVisitOnly === true,
```

`registryFiltersApplied` содержит активные `service.*` keys.

### 1.5 Матрица паритета legacy JS → SQL

| Фильтр | Legacy JS | SQL 177.4 | Изменение выдачи |
|--------|-----------|-----------|------------------|
| Языки | fuzzy bidirectional `includes()` | `@>` exact codes | Возможное сужение — **требует backfill** |
| Опыт | `>=` на aliases | `>=` на `experience_years` only | Сужение без backfill |
| Специализация | haystack из 4 полей | `ilike` на `specialization` | Сужение без backfill |
| Выезд | `home_visit === true` | `@>` boolean | Parity |

---

## 2. Спецификация Vertical Guards

### 2.1 Модуль `lib/search/discovery-services-vertical-guard.js`

**Экспорт:**

```javascript
export const SERVICE_SCOPED_REGISTRY_FILTER_KEYS = new Set([
  'service.languages',
  'service.experience_min',
  'service.specialization',
  'service.home_visit',
])

export function isServiceScopedRegistryFilterKey(key) {
  return SERVICE_SCOPED_REGISTRY_FILTER_KEYS.has(key)
}

/**
 * Service facets apply only on explicit service marketplace category slugs.
 * Never on category missing / category=all / housing / transport.
 */
export function isServiceFilterVerticalAllowed(contract) {
  const slug = String(contract?.categorySlug || '').toLowerCase().trim()
  if (!slug) return false
  return SERVICE_FILTER_ALLOWED_CATEGORY_SLUGS.has(slug)
}

export function isServiceRegistryFilterAllowedForContract(contract, key) {
  if (!isServiceScopedRegistryFilterKey(key)) return true
  return isServiceFilterVerticalAllowed(contract)
}
```

### 2.2 Разрешённые slug категорий

**Канонический SSOT (продуктовое решение 177.4):**

```javascript
export const SERVICE_FILTER_ALLOWED_CATEGORY_SLUGS = new Set([
  'services',
  'nannies',
])
```

| `contract.categorySlug` | `service.*` в plan | Поведение |
|-------------------------|-------------------|-----------|
| `services` | ✅ если params активны | Нормальный поиск услуг |
| `nannies` | ✅ | Нормальный поиск нянь |
| `all` / `null` / `property` / `vehicles` / … | ❌ **глушится** | Parse может заполнить `vertical.*`, но `applyPlan` **no-op**; `isRegistryFilterActive` → `false` |
| Дочерние slug (`nanny`, `chef`, `massage`, …) | ❌ в v1 guard | **Не** применять фильтр (предотвращение silent cross-filter). Продукт: выбирать родительскую категорию `nannies` / `services` в URL. *Расширение guard — отдельный ADR при появлении стабильных child slugs в проде.* |

**Цель:** устранить legacy-баг, когда `?nanny_langs=ru` на `category=all` или `category=apartments` режет выдачу в Node.js post-filter.

### 2.3 Wire points

| Точка | Изменение |
|-------|-----------|
| `filter-registry.js` → `isRegistryFilterActive` | Вызов `isServiceRegistryFilterAllowedForContract` **до** switch |
| `FILTER_REGISTRY[*].applyPlan` | Early return если `!isServiceFilterVerticalAllowed(contract)` |
| `discovery-filter-contract.js` → `validateDiscoveryContract` | Service invalid flags → issues (не 500) |
| `buildDiscoveryQueryPlan` | Не включать `service.*` в `registryFiltersApplied` при guard off |

### 2.4 Cross-vertical matrix (acceptance)

| URL | Category | Ожидание |
|-----|----------|----------|
| `nanny_langs=ru` | `all` | Выдача **без** service predicate (guard) |
| `nanny_langs=ru` | `property` | То же |
| `nanny_langs=ru` | `nannies` | SQL `@>` languages |
| `service_home_visit=1` | `services` | SQL `@>` home_visit |
| `nanny_experience_min=3` | `vehicles` | Guard off, no SQL |

---

## 3. Стратегия миграции данных (Data Backfill Runbook)

### 3.1 Когда выполнять

**Обязательно до** включения `DISCOVERY_UNIFIED_PIPELINE=1` с service SQL на prod **или** сразу после deploy кода с dual-read audit window.

Порядок:

1. Deploy backfill migration (идемпотентная).
2. Verify audit queries (§3.3).
3. Deploy 177.4 application code.
4. Soak 48h → optional Phase B STORED columns (`discovery-architecture-blueprint.md` §2.2).

### 3.2 SQL-скрипт нормализации

**Файл (новый):** `migrations/stage177_4_service_metadata_backfill.sql`

```sql
-- Stage 177.4 — normalize service/nanny metadata for SQL facets
-- Idempotent; safe to re-run

BEGIN;

-- 1) experience_years: consolidate legacy numeric fields
UPDATE public.listings l
SET metadata = jsonb_set(
  COALESCE(l.metadata, '{}'::jsonb),
  '{experience_years}',
  to_jsonb(
    GREATEST(0, LEAST(80,
      COALESCE(
        NULLIF(regexp_replace(COALESCE(l.metadata->>'experience_years', ''), '[^0-9]', '', 'g'), '')::int,
        NULLIF(regexp_replace(COALESCE(l.metadata->>'experience', ''), '[^0-9]', '', 'g'), '')::int,
        NULLIF(regexp_replace(COALESCE(l.metadata->>'years_experience', ''), '[^0-9]', '', 'g'), '')::int
      )
    ))
  ),
  true
)
WHERE l.status = 'ACTIVE'
  AND (
    l.metadata ? 'experience'
    OR l.metadata ? 'years_experience'
    OR (l.metadata->>'experience_years') IS NULL
  )
  AND COALESCE(
    NULLIF(regexp_replace(COALESCE(l.metadata->>'experience_years', ''), '[^0-9]', '', 'g'), '')::int,
    NULLIF(regexp_replace(COALESCE(l.metadata->>'experience', ''), '[^0-9]', '', 'g'), '')::int,
    NULLIF(regexp_replace(COALESCE(l.metadata->>'years_experience', ''), '[^0-9]', '', 'g'), '')::int
  ) IS NOT NULL;

-- 2) languages: string CSV / legacy keys → canonical string[]
UPDATE public.listings l
SET metadata = jsonb_set(
  COALESCE(l.metadata, '{}'::jsonb),
  '{languages}',
  (
    SELECT COALESCE(jsonb_agg(DISTINCT code ORDER BY code), '[]'::jsonb)
    FROM (
      SELECT lower(trim(x)) AS code
      FROM unnest(
        string_to_array(
          COALESCE(
            NULLIF(l.metadata->>'languages', ''),
            NULLIF(l.metadata->>'languages_spoken', ''),
            NULLIF(l.metadata->>'language', '')
          ),
          ',;'
        )
      ) AS t(x)
      WHERE lower(trim(x)) IN ('ru', 'en', 'th', 'zh')
    ) s
  ),
  true
)
WHERE l.status = 'ACTIVE'
  AND jsonb_typeof(l.metadata->'languages') IS DISTINCT FROM 'array'
  AND (
    l.metadata ? 'languages'
    OR l.metadata ? 'languages_spoken'
    OR l.metadata ? 'language'
  );

-- 3) home_visit: normalize string 'true' → boolean true
UPDATE public.listings l
SET metadata = jsonb_set(
  COALESCE(l.metadata, '{}'::jsonb),
  '{home_visit}',
  'true'::jsonb,
  true
)
WHERE l.status = 'ACTIVE'
  AND (
    l.metadata->>'home_visit' IN ('true', '1')
    OR l.metadata->'home_visit' = 'true'::jsonb
  );

-- 4) Optional: drop legacy keys after verify (separate migration / manual)
-- ALTER ... NOT in 177.4 core — keep read fallbacks in legacy flag=0 only

COMMIT;
```

### 3.3 Audit queries (pre/post)

```sql
-- Listings with experience legacy but missing experience_years
SELECT id, metadata->>'experience', metadata->>'years_experience', metadata->>'experience_years'
FROM listings
WHERE status = 'ACTIVE'
  AND (metadata ? 'experience' OR metadata ? 'years_experience')
  AND (metadata->>'experience_years') IS NULL
LIMIT 50;

-- languages not array
SELECT id, jsonb_typeof(metadata->'languages') AS t, metadata->'languages'
FROM listings
WHERE status = 'ACTIVE' AND metadata ? 'languages' AND jsonb_typeof(metadata->'languages') <> 'array'
LIMIT 50;

-- home_visit string vs bool
SELECT id, metadata->'home_visit'
FROM listings
WHERE status = 'ACTIVE' AND metadata ? 'home_visit'
LIMIT 50;
```

### 3.4 Rollback

- Backfill **не** удаляет legacy keys в 177.4 — rollback приложения на flag `DISCOVERY_UNIFIED_PIPELINE=0` восстанавливает JS oracle с fallbacks.
- Удаление `experience` / `years_experience` — отдельная миграция после 30d soak.

---

## 4. План депрекации Legacy (Epic E4)

### 4.1 Цель

При `DISCOVERY_UNIFIED_PIPELINE=1` **никогда** не вызывать `listingMatchesMetadataFilters` для service/nanny ключей на Node.js — только SQL plan.

### 4.2 Изменения `lib/search/discovery-metadata-facet-page.js`

**Расширить `discoveryPlanHasMetadataFacetStep`:**

```javascript
export function discoveryPlanHasMetadataFacetStep(plan) {
  return (plan?.registryFiltersApplied || []).some(
    (key) =>
      key.startsWith('transport.') ||
      key.startsWith('yacht.') ||
      key.startsWith('service.'),
  )
}
```

**Новая функция strip service keys (аналог transport/yacht):**

```javascript
export function stripServiceMetadataFieldsForJs(metadataFilters) {
  if (!metadataFilters) return null
  const stripped = {
    ...metadataFilters,
    nannyLangs: [],
    nannyExperienceMin: null,
    nannySpecialization: null,
    serviceHomeVisitOnly: false,
  }
  return metadataFiltersActive(stripped) ? stripped : null
}

export function stripRegistryMetadataFieldsForJs(metadataFilters) {
  // existing transport/yacht strip …
  let next = { /* transmission, fuel, … nulled */ }
  next = stripServiceMetadataFieldsForJs(next) ?? next
  // if only service was active, return null
  return metadataFiltersActive(next) ? next : null
}
```

**`metadataFiltersForJsPostFilter` (финальное поведение unified):**

```javascript
export function metadataFiltersForJsPostFilter(metadataFilters, plan, unifiedPipeline) {
  if (!metadataFiltersActive(metadataFilters)) return null

  if (unifiedPipeline) {
    // 1) Если plan уже применил registry metadata (transport/yacht/service) — strip пересекающиеся ключи
    if (discoveryPlanHasMetadataFacetStep(plan)) {
      const stripped = stripRegistryMetadataFieldsForJs(metadataFilters)
      return stripped // null если не осталось JS-only metadata (ожидаемо для чистого service search)
    }
    // 2) Unified без plan step, но service keys в URL — strip service anyway (SQL должен был применить; defense in depth)
    const serviceOnly = stripServiceMetadataFieldsForJs(metadataFilters)
    if (!serviceOnly && hadServiceMetadataActive(metadataFilters)) {
      return null // полностью ликвидируем JS service path
    }
    return stripRegistryMetadataFieldsForJs(metadataFilters)
  }

  return metadataFilters
}
```

**Инвариант:** при unified + active `service.*` in plan → `jsMetadataFilters` **не** содержит nanny/service полей → `listingMatchesMetadataFilters` не выполняет service ветки.

### 4.3 `sqlMetadataFiltersActive` / cache key

`lib/api/search/params.js` — учитывать активные `service.*` registry keys в `sqlMetadataFiltersActive` и `getCacheKey` (как transport/yacht, 177.3 T3.14).

### 4.4 Legacy path (`DISCOVERY_UNIFIED_PIPELINE=0`)

`listing-metadata-filter.js` **без изменений семантики** — полный oracle для rollback и staging A/B.

---

## 5. Пошаговый Task Breakdown (T4.1–T4.X)

### E1 — Contract & parse

| ID | Задача | Файл | Acceptance |
|----|--------|------|------------|
| T4.1 | Registry parse: 4× `service.*` → `contract.vertical.*`; whitelist языков | `filter-registry.js` | unit: URL matrix → frozen contract |
| T4.2 | Validation issues: `SERVICE_LANG_INVALID`, `SERVICE_EXPERIENCE_INVALID`, `SERVICE_HOME_VISIT_INVALID` | `discovery-filter-contract.js` | invalid → issue, не ломает остальные фильтры |
| T4.3 | `freezeDiscoveryContract` — strip `vertical._*Invalid` | `discovery-filter-contract.js` | snapshot stable |
| T4.4 | **Не** дублировать parse в `buildMetadataFiltersFromSearchParams` для unified | `listing-metadata-filter.js` | comment + legacy-only |

### E2 — Vertical guards & registry

| ID | Задача | Файл | Acceptance |
|----|--------|------|------------|
| T4.5 | `discovery-services-vertical-guard.js` + `SERVICE_FILTER_ALLOWED_CATEGORY_SLUGS` | new | export set + tests |
| T4.6 | Wire guard в `isRegistryFilterActive` + `applyPlan` early return | `filter-registry.js` | cross-vertical matrix §2.4 |
| T4.7 | `ORDERED_FILTER_KEYS` + switch cases `isRegistryFilterActive` | `filter-registry.js` | order parity test |
| T4.8 | `verticals: ['service']` на всех 4 keys | `filter-registry.js` | registry metadata |

### E3 — SQL predicates & executor

| ID | Задача | Файл | Acceptance |
|----|--------|------|------------|
| T4.9 | `text_ilike_contains` op + `applyDiscoveryJsonbTextIlikeContainsToQuery` | `discovery-jsonb-text-filter.js`, `discovery-scalar-sql.js` | specialization keyword |
| T4.10 | `service.experience_min` → `jsonb_numeric_gte` path `experience_years` | `filter-registry.js` | gte parity tests |
| T4.11 | `service.languages` → `@>` contains array; `service.home_visit` → `@>` boolean | `filter-registry.js` | multi-lang AND |
| T4.12 | Wire в `executeDiscoverySqlPlan` / map pins | `discovery-query-executor.js` | catalog/map integration |
| T4.13 | Plan snapshot fields service* | `discovery-query-plan.js` | pipeline parity test |
| T4.14 | Relax `buildDiscoveryJsonbNumericGtePredicate` для `value >= 1` only (document) | `discovery-jsonb-numeric-filter.js` | experience_min edge |

### E4 — Handler bridge & legacy cleanup

| ID | Задача | Файл | Acceptance |
|----|--------|------|------------|
| T4.15 | Extend `discoveryPlanHasMetadataFacetStep` + `stripServiceMetadataFieldsForJs` | `discovery-metadata-facet-page.js` | unified never double-filters service |
| T4.16 | `metadataFiltersForJsPostFilter` — полный service strip (§4.2) | `discovery-metadata-facet-page.js` | handler unit test |
| T4.17 | `run-listings-search-get.js` / `run-map-pins-get.js` — verify no service JS when plan applied | handlers | E2E fixture |
| T4.18 | `sqlMetadataFiltersActive` + cache key | `lib/api/search/params.js` | cache includes nanny_langs |

### E5 — Data & migrations

| ID | Задача | Файл | Acceptance |
|----|--------|------|------------|
| T4.19 | Migration `stage177_4_service_metadata_backfill.sql` | `migrations/` | audit §3.3 green on staging |
| T4.20 | Optional Phase B: `service_home_visit` STORED + GIN `nanny_languages` | blueprint migration | EXPLAIN improvement (out of core DoD) |

### E6 — Tests & docs

| ID | Задача | Файл | Acceptance |
|----|--------|------|------------|
| T4.21 | `__tests__/discovery-service-contract.test.js` — parse/validate matrix | new | npm script |
| T4.22 | `__tests__/discovery-service-executor.test.js` — SQL predicate wiring | new | green |
| T4.23 | `__tests__/discovery-service-guard.test.js` — cross-vertical | new | all/property/vehicles |
| T4.24 | `npm run test:discovery-service` package script | `package.json` | CI |
| T4.25 | Регрессия: `test:discovery-housing`, `test:discovery-transport`, `test:discovery-pipeline` | — | green |
| T4.26 | `SEARCH_FILTERS_QUERY_MAP.md` — колонка Unified registry для nanny_* / service_home_visit | docs | |
| T4.27 | `TECHNICAL_MANIFESTO.md`, `ARCHITECTURAL_PASSPORT.md` — Stage 177.4 | docs | |

### UX acceptance (manual)

| ID | Сценарий | Ожидание |
|----|----------|----------|
| UX-1 | `/listings?category=nannies&nanny_langs=ru,en` | Только няни с обоими языками |
| UX-2 | `/listings?category=all&nanny_langs=ru` | Guard: язык **не** режет жильё |
| UX-3 | `/listings?category=services&service_home_visit=1` | Только listings с `home_visit: true` |
| UX-4 | `/listings?category=nannies&nanny_experience_min=5` | `experience_years >= 5` |
| UX-5 | Map pins с теми же params | Count parity catalog vs map (±cursor) |

---

## 6. Производительность

| Принцип | Реализация |
|---------|------------|
| SQL до LIMIT | Service predicates в `buildListingsQuery` / map pins |
| Нет double JS | E4 handler guard |
| Category first | Guard требует `services` / `nannies` — сужает scan |
| Индексы Phase A | JSONB `@>` / cast numeric на `metadata` после category filter |
| Индексы Phase B | `service_home_visit` partial B-tree, `nanny_languages` GIN — blueprint §2.2 |

---

## 7. Feature flag и rollout

| Flag | Поведение |
|------|-----------|
| `DISCOVERY_UNIFIED_PIPELINE=0` | Legacy `listingMatchesMetadataFilters` (включая service) |
| `DISCOVERY_UNIFIED_PIPELINE=1` | Registry SQL + E4 JS strip |
| `DISCOVERY_SQL_METADATA_FACETS=1` | Default on после soak |

**Rollout:** staging backfill → `test:discovery-service` → manual UX §5 → prod 10% → 100%.

---

## 8. Definition of Done (Stage 177.4)

1. Все 4 ключа `service.*` в `FILTER_REGISTRY` с `parse`, `applyPlan`, vertical guards (`services`, `nannies` only).
2. Catalog и map pins — идентичный plan snapshot для service facets.
3. Unified path **не** вызывает `listingMatchesMetadataFilters` для service/nanny ключей.
4. Cross-vertical URL (`category=all` + `nanny_langs`) **не** меняет выдачу (UX-2).
5. Backfill migration выполнена на staging/prod до или вместе с rollout.
6. Тест-пакет `test:discovery-service` + регрессия housing/transport/calendar/pipeline green.
7. `SEARCH_FILTERS_QUERY_MAP.md`, manifesto, passport обновлены.

---

## 9. Связанные документы паритета

| Документ | Связь |
|----------|-------|
| [`discovery-architecture-blueprint.md`](./discovery-architecture-blueprint.md) §2.2 | STORED columns Phase B |
| [`stage177-3-vertical-facets.md`](./stage177-3-vertical-facets.md) §2.2, §3, §8 | Паттерн guards + E4 |
| [`SEARCH_FILTERS_QUERY_MAP.md`](../SEARCH_FILTERS_QUERY_MAP.md) | URL → registry mapping |
| [`docs/TECHNICAL_MANIFESTO.md`](../TECHNICAL_MANIFESTO.md) §Stage 65–67 | Wizard service profiles |
| `lib/config/category-form-schema.js` | Metadata write SSOT |
| `lib/partner/listing-wizard-metadata.js` | Normalize on save |

---

*Document version: 177.4.0-draft | Author: Platform Architecture | Last updated: 2026-06-22*
