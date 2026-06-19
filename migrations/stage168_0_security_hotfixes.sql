-- Stage 168.0 — Security hotfixes P0-2: public listings catalog view + RLS tighten.
-- Closes anon PostgREST read of listings.address / true latitude / longitude.
-- API service_role paths unchanged; fuzz in view matches lib/geo/listing-public-coordinates.js (ADR-163).

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- Deterministic fuzz (SSOT parity with listing-public-coordinates.js obfuscateCoordinates)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listing_public_fuzz_coordinates(
  p_listing_id text,
  p_lat double precision,
  p_lng double precision,
  p_radius_min_m double precision DEFAULT 150,
  p_radius_max_m double precision DEFAULT 300
)
RETURNS TABLE(fuzzed_lat double precision, fuzzed_lng double precision, is_approximate boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  salt text := coalesce(nullif(trim(current_setting('app.coord_privacy_salt', true)), ''), 'coord-privacy-v1');
  d bytea;
  digest_len int;
  off0 int;
  off4 int;
  unit0 double precision;
  unit4 double precision;
  bearing_deg double precision;
  span double precision;
  radius_m double precision;
  r_m double precision := 6371000;
  brng double precision;
  lat1 double precision;
  lon1 double precision;
  dist double precision;
  sin_lat1 double precision;
  cos_lat1 double precision;
  sin_d double precision;
  cos_d double precision;
  lat2 double precision;
  lon2 double precision;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL OR p_listing_id IS NULL OR trim(p_listing_id) = '' THEN
    RETURN QUERY SELECT NULL::double precision, NULL::double precision, true;
    RETURN;
  END IF;

  d := extensions.digest(convert_to(trim(p_listing_id) || ':' || salt, 'UTF8'), 'sha256');
  digest_len := octet_length(d);
  off0 := 0 % greatest(1, digest_len - 3);
  off4 := 4 % greatest(1, digest_len - 3);

  unit0 := (
    (get_byte(d, off0)::bigint << 24)
    + (get_byte(d, off0 + 1)::bigint << 16)
    + (get_byte(d, off0 + 2)::bigint << 8)
    + get_byte(d, off0 + 3)::bigint
  )::double precision / 4294967296.0;

  unit4 := (
    (get_byte(d, off4)::bigint << 24)
    + (get_byte(d, off4 + 1)::bigint << 16)
    + (get_byte(d, off4 + 2)::bigint << 8)
    + get_byte(d, off4 + 3)::bigint
  )::double precision / 4294967296.0;

  bearing_deg := unit0 * 360.0;
  span := greatest(0, p_radius_max_m - p_radius_min_m);
  radius_m := p_radius_min_m + unit4 * span;

  brng := radians(bearing_deg);
  lat1 := radians(p_lat);
  lon1 := radians(p_lng);
  dist := radius_m / r_m;

  sin_lat1 := sin(lat1);
  cos_lat1 := cos(lat1);
  sin_d := sin(dist);
  cos_d := cos(dist);

  lat2 := asin(sin_lat1 * cos_d + cos_lat1 * sin_d * cos(brng));
  lon2 := lon1 + atan2(sin(brng) * sin_d * cos_lat1, cos_d - sin_lat1 * sin(lat2));

  RETURN QUERY SELECT (degrees(lat2))::double precision, (degrees(lon2))::double precision, true;
END;
$$;

COMMENT ON FUNCTION public.listing_public_fuzz_coordinates(text, double precision, double precision, double precision, double precision) IS
  'Stage 168.0 — deterministic public coord fuzz for listings_public_catalog (ADR-163).';

REVOKE ALL ON FUNCTION public.listing_public_fuzz_coordinates(text, double precision, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listing_public_fuzz_coordinates(text, double precision, double precision, double precision, double precision) TO service_role;

-- -----------------------------------------------------------------------------
-- Public catalog view (whitelist — no address, fuzzed coords only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.listings_public_catalog
WITH (security_barrier = true)
AS
SELECT
  l.id,
  l.owner_id,
  l.category_id,
  l.status,
  l.title,
  l.description,
  l.district,
  l.metadata,
  f.fuzzed_lat AS latitude,
  f.fuzzed_lng AS longitude,
  f.is_approximate AS is_location_approximate,
  l.base_price_thb,
  l.base_currency,
  l.commission_rate,
  l.images,
  l.cover_image,
  l.available,
  l.is_featured,
  l.min_booking_days,
  l.max_booking_days,
  l.cancellation_policy,
  l.max_capacity,
  l.bedrooms_count,
  l.bathrooms_count,
  l.instant_booking,
  l.rating,
  l.avg_rating,
  l.reviews_count,
  l.bookings_count,
  l.views,
  l.created_at,
  l.country_code,
  l.region_code,
  l.city_code
FROM public.listings l
CROSS JOIN LATERAL public.listing_public_fuzz_coordinates(l.id, l.latitude, l.longitude) f
WHERE l.status = 'ACTIVE';

COMMENT ON VIEW public.listings_public_catalog IS
  'Stage 168.0 — anon/authenticated catalog read-path. No address; fuzzed coordinates only.';

GRANT SELECT ON public.listings_public_catalog TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- listings RLS — remove public ACTIVE full-row SELECT (use view instead)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS listings_select_catalog_or_owner ON public.listings;

CREATE POLICY listings_select_owner_admin_service ON public.listings
  FOR SELECT TO public
  USING (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR owner_id::text = public.current_profile_id()
  );

-- Anon must not read base table (only view)
REVOKE ALL ON TABLE public.listings FROM anon;
GRANT SELECT ON TABLE public.listings TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.listings TO authenticated, service_role;
