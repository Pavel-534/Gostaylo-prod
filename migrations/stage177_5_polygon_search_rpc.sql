-- Stage 177.5.0 — Polygon search RPC for unified discovery (Wave E1 backend).
-- Filters ACTIVE listings by true listings.coordinates (geography); privacy fuzz stays on serialize (ADR-163).
-- Call only via service_role from discovery-spatial-rpc.js.

BEGIN;

CREATE OR REPLACE FUNCTION public.listings_within_polygon_v1(
  p_geojson      jsonb,
  p_limit        integer DEFAULT 10000,
  p_category_ids text[] DEFAULT NULL
)
RETURNS TABLE (listing_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH raw_geom AS (
    SELECT ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326) AS g
  ),
  fixed_geom AS (
    SELECT CASE
      WHEN ST_IsValid(g) THEN g
      ELSE ST_MakeValid(g)
    END AS g
    FROM raw_geom
  ),
  poly_parts AS (
    SELECT CASE
      WHEN ST_GeometryType(g) IN ('ST_Polygon', 'ST_MultiPolygon') THEN g
      ELSE ST_CollectionExtract(g, 3)
    END AS g
    FROM fixed_geom
  ),
  poly AS (
    SELECT g::geography AS geo
    FROM poly_parts
    WHERE g IS NOT NULL
      AND NOT ST_IsEmpty(g)
  )
  SELECT l.id AS listing_id
  FROM public.listings AS l
  CROSS JOIN poly AS p
  WHERE l.status = 'ACTIVE'
    AND l.coordinates IS NOT NULL
    AND l.coordinates && p.geo
    AND ST_Intersects(l.coordinates, p.geo)
    AND (
      p_category_ids IS NULL
      OR cardinality(p_category_ids) = 0
      OR l.category_id = ANY (p_category_ids)
    )
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10000), 10000));
$$;

COMMENT ON FUNCTION public.listings_within_polygon_v1(jsonb, integer, text[]) IS
  'Stage 177.5.0 — ACTIVE listing ids inside GeoJSON polygon (RFC 7946) via GiST && + ST_Intersects; service_role only.';

REVOKE ALL ON FUNCTION public.listings_within_polygon_v1(jsonb, integer, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listings_within_polygon_v1(jsonb, integer, text[]) FROM anon;
REVOKE ALL ON FUNCTION public.listings_within_polygon_v1(jsonb, integer, text[]) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.listings_within_polygon_v1(jsonb, integer, text[]) TO service_role;

COMMIT;
