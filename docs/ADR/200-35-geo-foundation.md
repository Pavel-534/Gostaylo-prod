# ADR-200.35 — Geo foundation (corrected from draft TZ)

**Status:** Accepted (Stage 200.35)  
**Date:** 2026-08-05  
**Brand:** Airento (`getSiteDisplayName()`)

## Context

Draft TZ proposed a greenfield reshape of `geo_locations` (`name_*`, `parent_id`, `code` as PK), bulk Nominatim seed, `listings` NOT NULL coords/country, and recreate `geo_synonyms`. Live prod (FannRent) already has:

- `geo_locations` with `id` SERIAL PK, **`code` UNIQUE**, `parent_code`, **`label_en/ru/zh/th`**, `iso_country`, level CHECK `country|region|city`
- FKs `listings.country_code|region_code|city_code` → `geo_locations(code)`
- `geo_synonyms` with soft `target_code` (district names **not** always in `geo_locations`)
- PostGIS `coordinates` + indexes already present
- Dual SSOT: JS `country-presets.js` ↔ thin DB mirror (~26 nodes)

## Decision — what we adopt vs reject

| Draft TZ item | Verdict | Why |
|---------------|---------|-----|
| Rename `label_*` → `name_*` | **Reject** | Breaks all readers; keep `label_*` as SSOT display names |
| Rename `parent_code` → `parent_id` | **Reject** | Value is a **code**, not serial id; keep `parent_code` |
| Make `code` the table PK | **Reject** | Would rewrite FKs/`id`; keep `uniq_geo_locations_code` |
| Add centroid/bbox/tz/currency/osm/flags | **Accept** | Additive — enables map-first + GeoService |
| Level `neighborhood` | **Accept** | Extend CHECK; optional micro-locations |
| `nominatim_cache` | **Accept** | service_role only; TTL 7d; OSM ToS |
| Recreate `geo_synonyms` + hard FK | **Reject** | District aliases target free-text; keep soft refs |
| Bulk Nominatim seed loop | **Reject** | Violates [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) (no bulk dataset building) |
| Static curated seed | **Accept** | Correct for launch markets |
| `listings.lat/lng` NOT NULL | **Reject (now)** | 12 rows NULL; tours/services may omit pin |
| `listings.country_code` NOT NULL | **Reject (now)** | 31 rows NULL; enforce in GeoService write path + future backfill |
| `base_currency` → TEXT | **Reject** | Keep `currency_type` enum (ADR-181) |
| GeoService as SSOT for Nominatim | **Accept** | Routes must not call OSM directly |
| Delete `country-presets.js` in same PR | **Defer → Done (200.38)** | Phase 3: deleted; sync seed index + GeoService |

## Consequences

**Better / more modern:** one DB graph with viewport metadata; Nominatim behind cache; clear path to map-first without silent Moscow coerce (follow-up).  
**Safe:** additive schema; existing search/wizard keep working.  
**Phase 3 (Stage 200.38):** `country-presets.js` removed. Offline sync helpers use `LAUNCH_GEO_SEED` / `launch-geo-index.js`; runtime SSOT is `geo_locations` + GeoService.

## Invariants

1. Lat/lng on `listings` remain coordinate SSOT (never delete).
2. Nominatim HTTP only from `lib/services/geo/*`.
3. New city codes must exist in `geo_locations` before listing FK write.
4. Provisional places: `is_auto_imported=true`, `geo_status` in listing metadata.
