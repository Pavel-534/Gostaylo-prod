-- Stage 45.1 — Safety-first hardening:
-- 1) Atomic booking insert with row lock + capacity check in single transaction.
-- 2) Numeric listing columns for bedrooms/bathrooms (backfill + sync trigger).

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS bedrooms_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bathrooms_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.listings.bedrooms_count IS
  'Numeric bedrooms count for SQL filters (Stage 45.1). Synced from listings.metadata by trigger.';
COMMENT ON COLUMN public.listings.bathrooms_count IS
  'Numeric bathrooms count for SQL filters (Stage 45.1). Synced from listings.metadata by trigger.';

UPDATE public.listings
SET
  bedrooms_count = CASE
    WHEN COALESCE(metadata->>'bedrooms', '') ~ '^\d+$'
      THEN (metadata->>'bedrooms')::integer
    ELSE COALESCE(bedrooms_count, 0)
  END,
  bathrooms_count = CASE
    WHEN COALESCE(metadata->>'bathrooms', '') ~ '^\d+$'
      THEN (metadata->>'bathrooms')::integer
    ELSE COALESCE(bathrooms_count, 0)
  END;

CREATE OR REPLACE FUNCTION public.sync_listing_counts_from_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bedrooms integer;
  v_bathrooms integer;
BEGIN
  IF NEW.metadata IS NULL OR jsonb_typeof(NEW.metadata) <> 'object' THEN
    NEW.bedrooms_count := COALESCE(NEW.bedrooms_count, 0);
    NEW.bathrooms_count := COALESCE(NEW.bathrooms_count, 0);
    RETURN NEW;
  END IF;

  v_bedrooms := CASE
    WHEN COALESCE(NEW.metadata->>'bedrooms', '') ~ '^\d+$'
      THEN (NEW.metadata->>'bedrooms')::integer
    ELSE NULL
  END;

  v_bathrooms := CASE
    WHEN COALESCE(NEW.metadata->>'bathrooms', '') ~ '^\d+$'
      THEN (NEW.metadata->>'bathrooms')::integer
    ELSE NULL
  END;

  NEW.bedrooms_count := COALESCE(v_bedrooms, NEW.bedrooms_count, 0);
  NEW.bathrooms_count := COALESCE(v_bathrooms, NEW.bathrooms_count, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_listing_counts_from_metadata ON public.listings;
CREATE TRIGGER trg_sync_listing_counts_from_metadata
  BEFORE INSERT OR UPDATE OF metadata, bedrooms_count, bathrooms_count ON public.listings
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_listing_counts_from_metadata();

CREATE INDEX IF NOT EXISTS idx_listings_bedrooms_count_active
  ON public.listings (bedrooms_count)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_listings_bathrooms_count_active
  ON public.listings (bathrooms_count)
  WHERE status = 'ACTIVE';

CREATE OR REPLACE FUNCTION public.create_booking_atomic_v1(
  p_listing_id text,
  p_renter_id text,
  p_partner_id text,
  p_status booking_status,
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_price_thb numeric,
  p_currency text,
  p_price_paid numeric,
  p_exchange_rate numeric,
  p_commission_thb numeric,
  p_commission_rate numeric,
  p_applied_commission_rate numeric,
  p_partner_earnings_thb numeric,
  p_taxable_margin_amount numeric,
  p_rounding_diff_pot numeric,
  p_net_amount_local numeric,
  p_listing_currency text,
  p_guest_name text,
  p_guest_phone text,
  p_guest_email text,
  p_special_requests text,
  p_guests_count integer,
  p_promo_code_used text,
  p_discount_amount numeric,
  p_pricing_snapshot jsonb,
  p_metadata jsonb,
  p_requested_guests integer DEFAULT 1
)
RETURNS TABLE (
  ok boolean,
  booking_id text,
  conflict_code text,
  inserted_status booking_status
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_max_capacity integer;
  v_listing_metadata jsonb;
  v_category_slug text;
  v_is_vehicle boolean;
  v_requested_units integer;
  v_has_conflict boolean;
  v_booking_id text;
  v_inserted_status booking_status;
BEGIN
  IF p_listing_id IS NULL OR p_listing_id = '' THEN
    RETURN QUERY SELECT false, NULL::text, 'LISTING_NOT_FOUND', NULL::booking_status;
    RETURN;
  END IF;

  IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_out <= p_check_in THEN
    RETURN QUERY SELECT false, NULL::text, 'INVALID_DATE_RANGE', NULL::booking_status;
    RETURN;
  END IF;

  SELECT
    GREATEST(1, COALESCE(l.max_capacity, 1)),
    l.metadata,
    LOWER(COALESCE(c.slug, ''))
  INTO
    v_max_capacity,
    v_listing_metadata,
    v_category_slug
  FROM public.listings l
  LEFT JOIN public.categories c ON c.id = l.category_id
  WHERE l.id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, 'LISTING_NOT_FOUND', NULL::booking_status;
    RETURN;
  END IF;

  IF v_category_slug = '' AND v_listing_metadata IS NOT NULL THEN
    v_category_slug := LOWER(
      COALESCE(
        v_listing_metadata->>'category_slug',
        v_listing_metadata->>'categorySlug',
        ''
      )
    );
  END IF;

  v_is_vehicle := v_category_slug = 'vehicles';
  v_requested_units := CASE
    WHEN v_is_vehicle OR v_max_capacity <= 1 THEN 1
    ELSE GREATEST(1, COALESCE(p_requested_guests, 1))
  END;

  WITH req_nights AS (
    SELECT gs::date AS night
    FROM generate_series(
      (p_check_in AT TIME ZONE 'Asia/Bangkok')::date,
      ((p_check_out AT TIME ZONE 'Asia/Bangkok')::date - 1),
      interval '1 day'
    ) AS gs
  ),
  booked_load AS (
    SELECT
      rn.night,
      COALESCE(
        SUM(
          CASE
            WHEN v_is_vehicle THEN 1
            ELSE GREATEST(1, COALESCE(b.guests_count, 1))
          END
        ),
        0
      ) AS booked_units
    FROM req_nights rn
    LEFT JOIN public.bookings b
      ON b.listing_id = p_listing_id
     AND b.status IN ('PENDING', 'CONFIRMED', 'PAID', 'PAID_ESCROW', 'CHECKED_IN')
     AND (b.check_in AT TIME ZONE 'Asia/Bangkok')::date <= rn.night
     AND (b.check_out AT TIME ZONE 'Asia/Bangkok')::date > rn.night
    GROUP BY rn.night
  ),
  blocked_load AS (
    SELECT
      rn.night,
      COALESCE(SUM(GREATEST(1, COALESCE(cb.units_blocked, 1))), 0) AS blocked_units
    FROM req_nights rn
    LEFT JOIN public.calendar_blocks cb
      ON cb.listing_id = p_listing_id
     AND cb.start_date::date <= rn.night
     AND cb.end_date::date >= rn.night
     AND (cb.expires_at IS NULL OR cb.expires_at > NOW())
    GROUP BY rn.night
  )
  SELECT EXISTS (
    SELECT 1
    FROM req_nights rn
    JOIN booked_load bl ON bl.night = rn.night
    JOIN blocked_load cl ON cl.night = rn.night
    WHERE (bl.booked_units + cl.blocked_units + v_requested_units) > v_max_capacity
  )
  INTO v_has_conflict;

  IF v_has_conflict THEN
    RETURN QUERY SELECT false, NULL::text, 'DATES_CONFLICT', NULL::booking_status;
    RETURN;
  END IF;

  INSERT INTO public.bookings (
    listing_id,
    renter_id,
    partner_id,
    status,
    check_in,
    check_out,
    price_thb,
    currency,
    price_paid,
    exchange_rate,
    commission_thb,
    commission_rate,
    applied_commission_rate,
    partner_earnings_thb,
    taxable_margin_amount,
    rounding_diff_pot,
    net_amount_local,
    listing_currency,
    guest_name,
    guest_phone,
    guest_email,
    special_requests,
    guests_count,
    promo_code_used,
    discount_amount,
    pricing_snapshot,
    metadata
  )
  VALUES (
    p_listing_id,
    p_renter_id,
    p_partner_id,
    p_status,
    p_check_in,
    p_check_out,
    p_price_thb,
    p_currency,
    p_price_paid,
    p_exchange_rate,
    p_commission_thb,
    p_commission_rate,
    p_applied_commission_rate,
    p_partner_earnings_thb,
    p_taxable_margin_amount,
    p_rounding_diff_pot,
    p_net_amount_local,
    p_listing_currency,
    p_guest_name,
    p_guest_phone,
    p_guest_email,
    p_special_requests,
    GREATEST(1, COALESCE(p_guests_count, 1)),
    p_promo_code_used,
    COALESCE(p_discount_amount, 0),
    COALESCE(p_pricing_snapshot, '{}'::jsonb),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id, status INTO v_booking_id, v_inserted_status;

  RETURN QUERY SELECT true, v_booking_id, NULL::text, v_inserted_status;
END;
$$;

COMMENT ON FUNCTION public.create_booking_atomic_v1(
  text, text, text, booking_status, timestamptz, timestamptz, numeric, text, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, text, text, text, text,
  integer, text, numeric, jsonb, jsonb, integer
) IS 'Atomic booking insert for Stage 45.1: locks listing row, checks availability and inserts booking in one transaction.';

GRANT EXECUTE ON FUNCTION public.create_booking_atomic_v1(
  text, text, text, booking_status, timestamptz, timestamptz, numeric, text, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, text, text, text, text,
  integer, text, numeric, jsonb, jsonb, integer
) TO service_role;
