-- Stage 177.5.2 — Location inventory counts for suggest ranking (Wave E).
-- Replaces full ACTIVE listing pull in location-inventory-cache.js.
-- Phuket district rollup + E2E exclusion mirror JS (isExcludedFromPublicCatalog / PHUKET_DISTRICTS_CANON).
-- Call only via service_role.

BEGIN;

CREATE OR REPLACE FUNCTION public.listings_location_inventory_counts_v1(
  p_phuket_districts text[] DEFAULT NULL
)
RETURNS TABLE (
  level text,
  code text,
  listing_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH phuket AS (
    SELECT CASE
      WHEN p_phuket_districts IS NULL OR cardinality(p_phuket_districts) = 0 THEN ARRAY[
        'Rawai',
        'Chalong',
        'Kata',
        'Karon',
        'Patong',
        'Kamala',
        'Surin',
        'Bang Tao',
        'Nai Harn',
        'Panwa',
        'Mai Khao',
        'Nai Yang',
        'Phuket Town',
        'Cherngtalay',
        'Thalang'
      ]::text[]
      ELSE p_phuket_districts
    END AS names
  ),
  eligible AS (
    SELECT
      l.id,
      NULLIF(btrim(l.country_code), '') AS country_code,
      NULLIF(btrim(l.region_code), '') AS region_code,
      NULLIF(btrim(l.city_code), '') AS city_code,
      NULLIF(btrim(l.district), '') AS district
    FROM public.listings AS l
    WHERE l.status = 'ACTIVE'
      AND coalesce(l.title, '') NOT ILIKE '%[E2E_TEST_DATA]%'
      AND coalesce(l.description, '') NOT ILIKE '%[E2E_TEST_DATA]%'
      AND coalesce(l.metadata->>'test_data_tag', '') <> '[E2E_TEST_DATA]'
      AND coalesce(l.metadata->>'e2e_tag', '') <> '[E2E_TEST_DATA]'
  ),
  country_ids AS (
    SELECT e.id, e.country_code AS code
    FROM eligible AS e
    WHERE e.country_code IS NOT NULL
    UNION
    SELECT e.id, 'TH'::text
    FROM eligible AS e
    CROSS JOIN phuket AS p
    WHERE e.district IS NOT NULL
      AND e.district = ANY (p.names)
  ),
  region_ids AS (
    SELECT e.id, e.region_code AS code
    FROM eligible AS e
    WHERE e.region_code IS NOT NULL
    UNION
    SELECT e.id, 'TH-PHK'::text
    FROM eligible AS e
    CROSS JOIN phuket AS p
    WHERE e.district IS NOT NULL
      AND e.district = ANY (p.names)
  ),
  city_ids AS (
    SELECT e.id, e.city_code AS code
    FROM eligible AS e
    WHERE e.city_code IS NOT NULL
    UNION
    SELECT e.id, 'phuket-city'::text
    FROM eligible AS e
    CROSS JOIN phuket AS p
    WHERE e.district IS NOT NULL
      AND e.district = ANY (p.names)
  ),
  district_ids AS (
    SELECT e.id, e.district AS code
    FROM eligible AS e
    WHERE e.district IS NOT NULL
  )
  SELECT 'country'::text AS level, c.code, COUNT(DISTINCT c.id)::bigint AS listing_count
  FROM country_ids AS c
  GROUP BY c.code
  UNION ALL
  SELECT 'region'::text, r.code, COUNT(DISTINCT r.id)::bigint
  FROM region_ids AS r
  GROUP BY r.code
  UNION ALL
  SELECT 'city'::text, ci.code, COUNT(DISTINCT ci.id)::bigint
  FROM city_ids AS ci
  GROUP BY ci.code
  UNION ALL
  SELECT 'district'::text, d.code, COUNT(DISTINCT d.id)::bigint
  FROM district_ids AS d
  GROUP BY d.code;
$$;

COMMENT ON FUNCTION public.listings_location_inventory_counts_v1(text[]) IS
  'Stage 177.5.2 — ACTIVE listing location inventory counts (country/region/city/district) with Phuket rollup; service_role only.';

REVOKE ALL ON FUNCTION public.listings_location_inventory_counts_v1(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listings_location_inventory_counts_v1(text[]) FROM anon;
REVOKE ALL ON FUNCTION public.listings_location_inventory_counts_v1(text[]) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.listings_location_inventory_counts_v1(text[]) TO service_role;

-- Partial indexes for ACTIVE inventory GROUP BY (IF NOT EXISTS; cheap if already covered).
CREATE INDEX IF NOT EXISTS idx_listings_active_country_code
  ON public.listings (country_code)
  WHERE status = 'ACTIVE' AND country_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_active_region_code
  ON public.listings (region_code)
  WHERE status = 'ACTIVE' AND region_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_active_city_code
  ON public.listings (city_code)
  WHERE status = 'ACTIVE' AND city_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_active_district
  ON public.listings (district)
  WHERE status = 'ACTIVE' AND district IS NOT NULL;

COMMIT;
