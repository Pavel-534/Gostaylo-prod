-- Stage 200.35 / ADR-200.35 — Geo foundation (additive; no rename break)
-- Extends geo_locations; adds nominatim_cache; does NOT force listings NOT NULL.

BEGIN;

-- ---------------------------------------------------------------------------
-- A) geo_locations — extend level + metadata columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.geo_locations
  DROP CONSTRAINT IF EXISTS geo_locations_level_check;

ALTER TABLE public.geo_locations
  ADD CONSTRAINT geo_locations_level_check
  CHECK (level = ANY (ARRAY['country'::text, 'region'::text, 'city'::text, 'neighborhood'::text]));

ALTER TABLE public.geo_locations
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS centroid_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS centroid_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS bbox_north NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS bbox_south NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS bbox_east NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS bbox_west NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS currency_code TEXT,
  ADD COLUMN IF NOT EXISTS osm_id TEXT,
  ADD COLUMN IF NOT EXISTS osm_type TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_auto_imported BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Align country_code with legacy iso_country
UPDATE public.geo_locations
SET country_code = COALESCE(country_code, iso_country, CASE WHEN level = 'country' THEN code ELSE NULL END)
WHERE country_code IS NULL;

COMMENT ON COLUMN public.geo_locations.country_code IS
  'ISO 3166-1 alpha-2 for fast filter; mirrors iso_country when set';
COMMENT ON COLUMN public.geo_locations.centroid_lat IS
  'Stage 200.35 — map viewport / sort center';
COMMENT ON COLUMN public.geo_locations.timezone IS
  'IANA TZ for this node (usually set on country; cities may override)';
COMMENT ON COLUMN public.geo_locations.currency_code IS
  'Listing asset currency default for this country (ADR-181)';
COMMENT ON COLUMN public.geo_locations.is_auto_imported IS
  'true = provisional node created from pin/search (not curated launch seed)';

CREATE INDEX IF NOT EXISTS idx_geo_locations_level_parent
  ON public.geo_locations (level, parent_code);

CREATE INDEX IF NOT EXISTS idx_geo_locations_country_code
  ON public.geo_locations (country_code)
  WHERE country_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_geo_locations_active
  ON public.geo_locations (is_active)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- B) nominatim_cache — service_role only (backend GeoService)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nominatim_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('search', 'reverse')),
  response_json JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uniq_nominatim_cache_query_hash UNIQUE (query_hash)
);

COMMENT ON TABLE public.nominatim_cache IS
  'Stage 200.35 — Nominatim response cache (TTL ~7d). Only GeoService may read/write.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nominatim_cache TO service_role;

ALTER TABLE public.nominatim_cache ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated → deny by default; service_role bypasses RLS.

CREATE INDEX IF NOT EXISTS idx_nominatim_cache_query_hash
  ON public.nominatim_cache (query_hash);

CREATE INDEX IF NOT EXISTS idx_nominatim_cache_expires_at
  ON public.nominatim_cache (expires_at);

-- ---------------------------------------------------------------------------
-- C) listings — document metadata keys only (no destructive NOT NULL)
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.listings.country_code IS
  'FK → geo_locations(code). App invariant: required when listing profile needs geo (Stage 200.35+ write path).';
COMMENT ON COLUMN public.listings.metadata IS
  'May include geo_source, nominatim_place_id, city_label, timezone, geo_status, unverified_location (Stage 157–200.35).';

-- Indexes already exist: idx_listings_country_code, idx_listings_city_code, GiST coordinates.

-- ---------------------------------------------------------------------------
-- D) geo_synonyms — allow neighborhood target_type (soft refs stay)
-- ---------------------------------------------------------------------------
ALTER TABLE public.geo_synonyms
  DROP CONSTRAINT IF EXISTS geo_synonyms_target_type_check;

ALTER TABLE public.geo_synonyms
  ADD CONSTRAINT geo_synonyms_target_type_check
  CHECK (target_type = ANY (ARRAY['country'::text, 'region'::text, 'city'::text, 'district'::text, 'neighborhood'::text]));

COMMIT;
