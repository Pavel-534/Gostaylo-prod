-- Stage 164 — Geo ops health: drift scan + PostGIS index probe (admin/cron).
-- Requires stage162_1 (listings.coordinates + GiST index).

BEGIN;

CREATE OR REPLACE FUNCTION public.listings_geo_drift_scan_v1(
  p_tolerance_m      double precision DEFAULT 5,
  p_sample_limit     integer DEFAULT 24
)
RETURNS TABLE (
  scanned_active           bigint,
  coord_latlng_mismatch    bigint,
  coords_null_latlng_set   bigint,
  latlng_null_coords_set   bigint,
  unverified_active        bigint,
  privacy_address_exposed  bigint,
  gist_index_present       boolean,
  sample_mismatch_ids      text[],
  sample_stale_ids         text[],
  sample_privacy_ids       text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH active AS (
    SELECT
      l.id,
      l.latitude,
      l.longitude,
      l.coordinates,
      l.address,
      l.district,
      l.metadata,
      l.category_id,
      c.slug AS category_slug,
      c.wizard_profile
    FROM public.listings AS l
    LEFT JOIN public.categories AS c ON c.id = l.category_id
    WHERE l.status = 'ACTIVE'
  ),
  classified AS (
    SELECT
      a.*,
      (
        a.latitude IS NOT NULL
        AND a.longitude IS NOT NULL
        AND a.coordinates IS NOT NULL
        AND ST_Distance(
          a.coordinates,
          ST_SetSRID(
            ST_MakePoint(a.longitude::double precision, a.latitude::double precision),
            4326
          )::geography
        ) > GREATEST(p_tolerance_m, 0.5)
      ) AS is_coord_mismatch,
      (a.coordinates IS NULL AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL) AS is_stale_coords,
      (a.coordinates IS NOT NULL AND (a.latitude IS NULL OR a.longitude IS NULL)) AS is_stale_latlng,
      (
        COALESCE(a.metadata->>'geo_status', '') = 'unverified'
        OR (
          TRIM(COALESCE(a.metadata->>'geo_status', '')) <> 'verified'
          AND TRIM(COALESCE(a.district, '')) <> ''
        )
      ) AS is_unverified,
      (
        a.address IS NOT NULL
        AND TRIM(a.address) <> ''
        AND COALESCE(a.wizard_profile, '') NOT IN ('transport', 'tour', 'yacht')
        AND COALESCE(a.category_slug, '') NOT IN (
          'yachts', 'yacht', 'boats', 'boat', 'helicopters', 'helicopter', 'jets', 'jet'
        )
      ) AS is_privacy_address_risk
    FROM active AS a
  ),
  gist AS (
    SELECT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'listings'
        AND indexname = 'idx_listings_coordinates'
    ) AS present
  )
  SELECT
    (SELECT COUNT(*)::bigint FROM classified) AS scanned_active,
    (SELECT COUNT(*)::bigint FROM classified WHERE is_coord_mismatch) AS coord_latlng_mismatch,
    (SELECT COUNT(*)::bigint FROM classified WHERE is_stale_coords) AS coords_null_latlng_set,
    (SELECT COUNT(*)::bigint FROM classified WHERE is_stale_latlng) AS latlng_null_coords_set,
    (SELECT COUNT(*)::bigint FROM classified WHERE is_unverified) AS unverified_active,
    (SELECT COUNT(*)::bigint FROM classified WHERE is_privacy_address_risk) AS privacy_address_exposed,
    (SELECT present FROM gist) AS gist_index_present,
    COALESCE((
      SELECT ARRAY_AGG(id ORDER BY id)
      FROM (SELECT id FROM classified WHERE is_coord_mismatch ORDER BY id LIMIT GREATEST(p_sample_limit, 1)) s
    ), ARRAY[]::text[]) AS sample_mismatch_ids,
    COALESCE((
      SELECT ARRAY_AGG(id ORDER BY id)
      FROM (
        SELECT id FROM classified WHERE is_stale_coords OR is_stale_latlng ORDER BY id LIMIT GREATEST(p_sample_limit, 1)
      ) s
    ), ARRAY[]::text[]) AS sample_stale_ids,
    COALESCE((
      SELECT ARRAY_AGG(id ORDER BY id)
      FROM (SELECT id FROM classified WHERE is_privacy_address_risk ORDER BY id LIMIT GREATEST(p_sample_limit, 1)) s
    ), ARRAY[]::text[]) AS sample_privacy_ids;
$$;

COMMENT ON FUNCTION public.listings_geo_drift_scan_v1 IS
  'Stage 164 — ACTIVE listings geo drift: coordinates vs lat/lng, stale rows, unverified geo, address-on-privacy-vertical heuristic.';

COMMIT;
