# Карта query-параметров каталога (`GET /api/v2/search`, `GET /api/v2/listings/search`)

**Назначение:** онбординг и рефакторинг без «охоты по репо». Один источник: как параметр попадает в URL с клиента, где парсится на сервере, где режет SQL, где — пост-фильтр в JS.

**Ядро поиска:** `lib/api/run-listings-search-get.js` → `runListingsSearchGet`  
**Unified pipeline (Stage 177.1, flag `DISCOVERY_UNIFIED_PIPELINE=1`):** `lib/search/discovery-filter-contract.js` → `filter-registry.js` → `discovery-query-plan.js` → `discovery-query-executor.js` (+ `lib/api/search/discovery-spatial-rpc.js`)  
**Построение SQL:** `lib/api/search/query-builder.js` → `buildListingsQuery`  
**Гео / текст OR:** `lib/api/search/location-filter.js`, `lib/api/search/params.js` → `buildTextSearchOr`  
**Доступность и цена карточки с датами:** `lib/api/search/availability.js` → `filterListingsByAvailability` → `CalendarService`  
**Пост-фильтр по metadata (транспорт / няни / сервисы):** `lib/search/listing-metadata-filter.js`  
**Клиент ↔ URL (каталог `/listings`):** `lib/search/listings-page-url.js` + `app/listings/listings-catalog-client.jsx` + `lib/hooks/useListingsSearch.js`  
**Осмысленный browse-query (SSR ItemList и дефолты):** `hasMeaningfulListingsBrowseQuery` в `listings-page-url.js` (список ключей синхронизируйте при добавлении параметра)

---

## Легенда колонок таблицы

| Колонка | Смысл |
|---------|--------|
| **Клиент → URL** | Кто пишет параметр в query (и откуда) |
| **Сервер: парсинг** | Где читается из `URLSearchParams` в объект `filters` / вспомогательные структуры |
| **SQL** | Условия в `buildListingsQuery` (Supabase chain) |
| **JS пост** | Фильтрация массива листингов после выборки |
| **Availability** | Учёт в `filterListingsByAvailability` / календаре |

---

## Параметры (алфавит по каноническому имени в API)

### `amenities`

| Этап | Детали |
|------|--------|
| Клиент → URL | `appendExtraFiltersToParams` → `amenities` (CSV) из `lib/search/listings-page-url.js` |
| Сервер: парсинг | `run-listings-search-get.js` → `parseAmenitiesFromSearchParams` (`lib/api/search/params.js`); unified: `filter-registry` → `housing.amenities` |
| SQL | **Legacy:** `query-builder.js` — цикл `q.contains('metadata', { amenities: [slug] })`. **Unified (`DISCOVERY_UNIFIED_PIPELINE=1`):** один `@>` / `cs` по `metadata.amenities` (`amenitiesMode: 'unified'`) |
| JS пост | — |
| Availability | — |

### `bathrooms` / `bathrooms_min`

| Этап | Детали |
|------|--------|
| Клиент → URL | `appendExtraFiltersToParams` → `bathrooms` |
| Сервер: парсинг | `run-listings-search-get.js` → `firstIntParam(searchParams, 'bathrooms', 'bathrooms_min')` → `filters.bathroomsMin` |
| SQL | `query-builder.js` → `gte('bathrooms_count', …)` |
| JS пост | — |
| Availability | — |

### `bedrooms` / `bedrooms_min`

| Этап | Детали |
|------|--------|
| Клиент → URL | `appendExtraFiltersToParams` → `bedrooms` |
| Сервер: парсинг | `run-listings-search-get.js` → `firstIntParam(searchParams, 'bedrooms', 'bedrooms_min')` → `filters.bedroomsMin` |
| SQL | `query-builder.js` → `gte('bedrooms_count', …)` |
| JS пост | — |
| Availability | — |

### `category`

| Этап | Детали |
|------|--------|
| Клиент → URL | `useListingsSearch.js`, `PlatformHomeContent`, и др. |
| Сервер: парсинг | `normalizeListingCategorySlugForSearch` + `resolveListingCategoryIdsForSearchScope` (`lib/api/category-search-scope.js`); unified: `filter-registry` → `category` (первый шаг каскада) |
| SQL | `query-builder.js` → `in('category_id', …)` / `eq`; unified: `categoryIds` из plan до bbox/amenities |
| JS пост | — |
| Availability | Косвенно: slug влияет на ветку цены в `calendar-query-availability.js` (`isTransportListingCategory`) |

### `checkIn` / `checkOut`

| Этап | Детали |
|------|--------|
| Клиент → URL | Календарь + `useListingsSearch` / главная |
| Сервер: парсинг | `toListingDate` в `run-listings-search-get.js` |
| SQL | Не режут строки напрямую; даты уходят в availability |
| JS пост | — |
| Availability | `filterListingsByAvailability` → batch + при необходимости single check; `_pricing` на листинге |

### `checkInTime` / `checkOutTime`

| Этап | Детали |
|------|--------|
| Клиент → URL | Транспортный интервал: `useListingsSearch.js`, `PlatformHomeContent`, `listings-catalog-client.jsx` (через `isTransportIntervalWizardProfile` / `isCatalogTransportIntervalMode`) |
| Сервер: парсинг | Пробрасываются в `filters` в `run-listings-search-get.js` |
| SQL | — (интервал обрабатывается календарём / бронями) |
| Availability | Учитываются в цепочке календаря при интервальном режиме (см. `calendar-query-availability.js` + vehicle utils) |

### `cursor` (Stage 177.2, unified catalog only)

| Этап | Детали |
|------|--------|
| Клиент → URL | `catalogSearchKeyParamsToUrlSearchParams` (`lib/catalog/build-catalog-search-params.js`) — только при **`NEXT_PUBLIC_DISCOVERY_UNIFIED_PIPELINE=1`** + **`sort=created_at`**; `loadMore` в **`useListingsFetch`** передаёт `meta.pagination.next_cursor` |
| Сервер: парсинг | `discovery-filter-contract.js` → `browse.cursor`; требует `sort=created_at` |
| SQL | Keyset в `discovery-cursor-sql.js` (`applyDiscoveryCursorToQuery`) |
| JS пост | — |
| Availability | — |
| Ответ | `meta.pagination: { mode, pageSize, next_cursor, hasMore }` |

### `city` / `location` / `where`

| Этап | Детали |
|------|--------|
| Клиент → URL | `where` основной; `location`/`city` — совместимость при гидрации из URL (`listings-catalog-client.jsx`) |
| Сервер: парсинг | `filters.where` / `location` / `city` в `run-listings-search-get.js` |
| SQL | `query-builder.js`: если `where` задан — `buildSmartWhereOrClause` (`location-filter.js`); иначе fallback по `city` / `location` |
| JS пост | Радиус: `haversineKm` в `run-listings-search-get.js`; bbox: `pointInBounds` |

### `engine_cc_min` / `engineCcMin`

| Этап | Детали |
|------|--------|
| Клиент → URL | `appendExtraFiltersToParams` |
| Сервер: парсинг | `buildMetadataFiltersFromSearchParams` (`listing-metadata-filter.js`) — поле `engineCcMin` внутри `metadataFilters` |
| SQL | — |
| JS пост | `listingMatchesMetadataFilters` — сравнение с `metadata.engine_cc` и алиасами |

### `cabins_min` / `cabinsMin`

| Этап | Детали |
|------|--------|
| Клиент → URL | `appendExtraFiltersToParams` |
| Сервер: парсинг | `buildMetadataFiltersFromSearchParams` → `cabinsMin` |
| SQL | — |
| JS пост | `listingMatchesMetadataFilters` — `metadata.cabins` / `cabins_count` / `cabin_count` |

### `featured`

| Этап | Детали |
|------|--------|
| Клиент → URL | Главная и др. |
| Сервер: парсинг | `run-listings-search-get.js` |
| SQL | `query-builder.js` → порядок `is_featured` |

### `guests`

| Этап | Детали |
|------|--------|
| Клиент → URL | `GuestsPopover` / state родителя |
| Сервер: парсинг | `run-listings-search-get.js` |
| SQL | — |
| Availability | `filterListingsByAvailability`: capacity через `resolveListingGuestCapacity`; для `categories.slug === 'vehicles'` гостевой порог не применяется (см. `availability.js`) |

### `instant_booking` / `instantBooking`

| Этап | Детали |
|------|--------|
| Клиент → URL | `appendExtraFiltersToParams` → `instant_booking` |
| Сервер: парсинг | `parseBooleanSearchParam` → `filters.instantBookingOnly` |
| SQL | `query-builder.js` → `eq('instant_booking', true)` |
| JS пост | — |

### `lat` / `lon` / `radiusKm`

| Этап | Детали |
|------|--------|
| Клиент → URL | Карта / будущие клиенты |
| Сервер: парсинг | `run-listings-search-get.js` |
| SQL | bbox из радиуса: `normalizeRadiusBoundingBox` (`params.js`) |
| JS пост | Усечение по `haversineKm` |

### `limit`

| Этап | Детали |
|------|--------|
| Клиент → URL | Каталог / главная; unified cursor path — default **24** (`CATALOG_CURSOR_PAGE_LIMIT`) |
| Сервер: парсинг | `run-listings-search-get.js`; unified: max **50**; лимит listings/search см. `mergeQueryForListingsRoute` |
| SQL | `fetchLimit` с headroom, затем slice по `filters.limit` |

### `max_price` / `maxPrice` и `min_price` / `minPrice`

| Этап | Детали |
|------|--------|
| Клиент → URL | `appendExtraFiltersToParams` → snake_case |
| Сервер: парсинг | `firstFloatParam` в `run-listings-search-get.js` |
| SQL | Если задан валидный **`checkIn`/`checkOut`** — SQL **не** режет по цене (**`base_price_thb`** пропускается в **`query-builder`**). Иначе **`gte`/`lte`** по **`base_price_thb`**. |
| JS пост | При датах — после **`filterListingsByAvailability`**: **`listingMatchesSearchPriceRange`** через **`getGuestDisplayForSearchFilters`** (**`lib/pricing/guest-display-price.js`**, делегат **`lib/search/effective-unit-price-for-search.js`**) — календарная средняя + guest fee % (как **`CardPriceDisplay`**). Гистограмма в **`meta.priceHistogram`** и **`SearchFiltersDialog`** — та же единица. |

### `nanny_experience_min` / `nannyExperienceMin`, `nanny_langs`, `nanny_specialization` / `nannySpecialization`

| Этап | Детали |
|------|--------|
| Клиент → URL | `appendExtraFiltersToParams` |
| Сервер: парсинг | `buildMetadataFiltersFromSearchParams` |
| SQL | — |
| JS пост | `listingMatchesMetadataFilters` |

### `q`

| Этап | Детали |
|------|--------|
| Клиент → URL | Строка поиска |
| Сервер: парсинг | `filters.q` |
| SQL | `buildTextSearchOr` → `.or(...)` по title/description/district |
| JS пост | `matchesAllWords` (многословный запрос); при lite SELECT описание может отсутствовать в строке — см. манифесто |

### `semantic`

| Этап | Детали |
|------|--------|
| Клиент → URL | `useListingsSearch.js` / главная при умном поиске |
| Сервер: парсинг | `filters.semantic` |
| JS пост | `fetchSemanticListingMatches` + `mergeSemanticHitsIntoListingOrder`; опциональный inject по id |

### `service_home_visit` / `home_visit_only` / `homeVisitOnly`

| Этап | Детали |
|------|--------|
| Клиент → URL | `appendExtraFiltersToParams` |
| Сервер: парсинг | `buildMetadataFiltersFromSearchParams` → `serviceHomeVisitOnly` |
| SQL | — |
| JS пост | `listingMatchesMetadataFilters` |

### `softAvailability`

| Этап | Детали |
|------|--------|
| Клиент → URL | Главная (`0`) vs каталог (дефолт) |
| Сервер: парсинг | `filters.softAvailability` |
| Availability | `allowSoftMismatch` в `filterListingsByAvailability` |

### `south` / `north` / `west` / `east`

| Этап | Детали |
|------|--------|
| Клиент → URL | `bboxToSearchParams` + `useListingsSearch` |
| Сервер: парсинг | `parseMapBounds` → `filters.mapBounds`; unified: `filter-registry` → `geo.bbox` |
| SQL | **Legacy:** `query-builder.js` — прямоугольник по lat/lon. **Unified:** RPC `listings_ids_in_bbox_gist_v1` (GiST) → `.in('id', ids)`; `categoryIds` передаются в RPC |
| JS пост | **Legacy:** доп. `pointInBounds`. **Unified:** JS bbox skip когда GiST ids применены (`discoveryPlanUsedGistBbox`) |
| **Цена на пине** | `mapPinRowToPayload` → `getGuestDisplayPerNight` с `guestServiceFeePercent` (как каталог) + `_pricing`; в UI сайдбар-пин берёт цену из объекта listing (`InteractiveSearchMap`) |

### `transmission`, `fuel_type` / `fuelType`

| Этап | Детали |
|------|--------|
| Клиент → URL | `appendExtraFiltersToParams` |
| Сервер: парсинг | `buildMetadataFiltersFromSearchParams` |
| SQL | — |
| JS пост | `listingMatchesMetadataFilters` |

---

## UI: какой блок шлёт параметры

| UI | Файл | Примечание |
|----|------|------------|
| Строка What/Where/When/Who + текст | `components/search/UnifiedSearchBar.jsx` | Категория, where, даты, гости, время интервала для transport wizard |
| Модалка «Все фильтры» | `components/search/SearchFiltersDialog.jsx` | Цена + панель `housing` \| `transport` \| `service` через `getSearchFilterPanelKind` (`lib/search/search-filter-panel-kind.js`) |
| Синхронизация URL | `app/listings/listings-catalog-client.jsx` | `router.replace` + `parseExtraFiltersFromParams` / `parseBBoxFromParams` |
| Запрос к API | `lib/hooks/useListingsSearch.js` | `LISTINGS_SEARCH_API_PATH`, `appendExtraFiltersToParams`, bbox, semantic |

---

## Кэш и «тяжёлый» fetch

- In-memory кэш ответа в `run-listings-search-get.js` (TTL 60s) — ключ **`getCacheKey`** в `lib/api/search/params.js` (учитывает lite/full, semantic, и т.д.).
- Клиентский кэш в `useListingsSearch.js` (5 мин) — только если нет дат, bbox и активных extra filters.

---

## При добавлении нового фильтра (чеклист)

1. Добавить ключ в **`MEANINGFUL_LISTINGS_BROWSE_KEYS`** (`listings-page-url.js`), если влияет на «пустой browse» / SSR.
2. **`defaultExtraFilters`**, **`parseExtraFiltersFromParams`**, **`appendExtraFiltersToParams`**, **`hasActiveExtraFilters`** — если параметр идёт через модалку.
3. **`buildMetadataFiltersFromSearchParams`** + **`metadataFiltersActive`** + **`listingMatchesMetadataFilters`** — если только пост-фильтр по JSON metadata.
4. **`run-listings-search-get.js`** — чтение в `filters` и (при необходимости) в **`sqlMetadataFiltersActive`** (`params.js`).
5. **`query-builder.js`** — если нужен индекс-friendly SQL по колонке или `metadata @>` .
6. Документ: **обновить эту карту** и при смене контракта — **`docs/TECHNICAL_MANIFESTO.md`** / **`docs/ARCHITECTURAL_PASSPORT.md`**.

---

## Связанные SSOT (категории и цена в UI)

- Вертикаль и slug: `lib/listing-category-slug.js`, `lib/config/category-wizard-profile-db.js`, `lib/config/category-hierarchy.js`
- Подпись «ночь / сутки» у цены в карточке: `lib/listing-booking-ui.js` → `getListingRentalPeriodMode`
- Календарная цена: `lib/services/calendar/calendar-query-availability.js`
