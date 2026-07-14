-- Stage 187.8 — Whole-unit calendar for property (villa/apartment) parity with vehicles.
-- JS SSOT: lib/listing-booking-ui.js → isWholeUnitCalendarInventory().
-- Fixes double-booking when guests_count < max_capacity on exclusive listings.

CREATE OR REPLACE FUNCTION public.is_whole_unit_listing_inventory_v1(
  p_category_slug text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(
      (p_metadata->>'rent_entire_unit') IN ('true', 't', '1', 'yes'),
      (p_metadata->'rent_entire_unit')::text = 'true',
      false
    )
    AND (
      lower(coalesce(p_category_slug, '')) = 'yachts'
      OR lower(coalesce(p_category_slug, '')) LIKE '%yacht%'
      OR lower(coalesce(p_category_slug, '')) LIKE '%boat%'
    ) THEN true
    WHEN lower(coalesce(p_category_slug, '')) IN ('tours', 'yachts', 'services', 'nanny', 'service')
      OR lower(coalesce(p_category_slug, '')) LIKE '%tour%'
      OR (
        (lower(coalesce(p_category_slug, '')) LIKE '%yacht%'
          OR lower(coalesce(p_category_slug, '')) LIKE '%boat%')
        AND NOT COALESCE(
          (p_metadata->>'rent_entire_unit') IN ('true', 't', '1', 'yes'),
          (p_metadata->'rent_entire_unit')::text = 'true',
          false
        )
      ) THEN false
    WHEN lower(coalesce(p_category_slug, '')) IN ('property', 'vehicles', 'helicopter', 'helicopters')
      OR lower(coalesce(p_category_slug, '')) IN ('transport', 'vehicle', 'transportation') THEN true
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.is_whole_unit_listing_inventory_v1(text, jsonb) IS
  'Stage 187.8 — whole-unit calendar inventory (property, vehicles, whole-yacht charter). Parity with lib/listing-booking-ui.js.';

GRANT EXECUTE ON FUNCTION public.is_whole_unit_listing_inventory_v1(text, jsonb) TO service_role;


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
  p_requested_guests integer DEFAULT 1,
  p_listing_tz text DEFAULT NULL
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
  v_is_whole_unit boolean;
  v_requested_units integer;
  v_has_conflict boolean;
  v_booking_id text;
  v_inserted_status booking_status;
  v_listing_tz text;
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
  FOR UPDATE OF l;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, 'LISTING_NOT_FOUND', NULL::booking_status;
    RETURN;
  END IF;

  v_listing_tz := trim(COALESCE(p_listing_tz, ''));
  IF v_listing_tz = '' OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_listing_tz) THEN
    v_listing_tz := public.resolve_listing_timezone_v1(v_listing_metadata);
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

  v_is_whole_unit := public.is_whole_unit_listing_inventory_v1(v_category_slug, v_listing_metadata);
  v_requested_units := CASE
    WHEN v_is_whole_unit OR v_max_capacity <= 1 THEN 1
    ELSE GREATEST(1, COALESCE(p_requested_guests, 1))
  END;

  WITH req_nights AS (
    SELECT gs::date AS night
    FROM generate_series(
      timezone(v_listing_tz, p_check_in)::date,
      (timezone(v_listing_tz, p_check_out)::date - 1),
      interval '1 day'
    ) AS gs
  ),
  booked_load AS (
    SELECT
      rn.night,
      CASE
        WHEN v_is_whole_unit OR v_max_capacity <= 1 THEN
          CASE
            WHEN COUNT(b.id) FILTER (WHERE b.id IS NOT NULL) > 0 THEN v_max_capacity
            ELSE 0
          END
        ELSE
          COALESCE(
            SUM(
              CASE
                WHEN b.id IS NULL THEN 0
                ELSE GREATEST(1, COALESCE(b.guests_count, 1))
              END
            ),
            0
          )
      END AS booked_units
    FROM req_nights rn
    LEFT JOIN public.bookings b
      ON b.listing_id = p_listing_id
     AND b.status IN (
       'PENDING', 'CONFIRMED', 'AWAITING_PAYMENT',
       'PAID', 'PAID_ESCROW', 'CHECKED_IN', 'THAWED'
     )
     AND timezone(v_listing_tz, b.check_in)::date <= rn.night
     AND timezone(v_listing_tz, b.check_out)::date > rn.night
    GROUP BY rn.night
  ),
  blocked_load AS (
    SELECT
      rn.night,
      COALESCE(SUM(
        CASE
          WHEN cb.id IS NULL THEN 0
          ELSE GREATEST(1, COALESCE(cb.units_blocked, 1))
        END
      ), 0) AS blocked_units
    FROM req_nights rn
    LEFT JOIN public.calendar_blocks cb
      ON cb.listing_id = p_listing_id
     AND cb.start_date::date <= rn.night
     AND cb.end_date::date >= rn.night
     AND (cb.expires_at IS NULL OR cb.expires_at > NOW())
     AND lower(coalesce(cb.source, '')) <> 'inquiry_hold'
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
    p_currency::public.currency_type,
    p_price_paid,
    p_exchange_rate,
    p_commission_thb,
    p_commission_rate,
    p_applied_commission_rate,
    p_partner_earnings_thb,
    p_taxable_margin_amount,
    p_rounding_diff_pot,
    p_net_amount_local,
    p_listing_currency::public.currency_type,
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

COMMENT ON FUNCTION public.create_booking_atomic_v1 IS
  'Stage 187.8 — atomic booking; whole-unit property/vehicles block dates regardless of guests_count.';

GRANT EXECUTE ON FUNCTION public.create_booking_atomic_v1 TO service_role;


DROP FUNCTION IF EXISTS public.batch_check_listing_availability(text[], date, date, integer, text[]);

CREATE OR REPLACE FUNCTION public.batch_check_listing_availability(
  p_listing_ids text[],
  p_check_in date,
  p_check_out date,
  p_guests_count integer DEFAULT 1,
  p_occupying_statuses text[] DEFAULT ARRAY[
    'PENDING','CONFIRMED','AWAITING_PAYMENT','PAID','PAID_ESCROW','CHECKED_IN','THAWED'
  ]
)
RETURNS TABLE (
  listing_id text,
  available boolean,
  conflicts_count integer,
  min_remaining_spots integer,
  max_capacity integer,
  required_guests integer,
  nights integer,
  total_price numeric,
  average_per_night numeric,
  is_promo_applied boolean,
  price_grid jsonb
)
LANGUAGE sql
SET search_path = public
AS $$
WITH input_ids AS (
  SELECT DISTINCT unnest(coalesce(p_listing_ids, ARRAY[]::text[])) AS listing_id
),
nights AS (
  SELECT gs::date AS night
  FROM generate_series(p_check_in, p_check_out - INTERVAL '1 day', INTERVAL '1 day') AS gs
),
target_listings AS (
  SELECT
    i.listing_id,
    l.base_price_thb,
    COALESCE(l.metadata, '{}'::jsonb) AS metadata,
    GREATEST(1, COALESCE(l.max_capacity, 1))::int AS max_capacity,
    lower(
      COALESCE(
        c.slug,
        l.metadata->>'category_slug',
        l.metadata->>'categorySlug',
        ''
      )
    ) AS category_slug
  FROM input_ids i
  LEFT JOIN public.listings l ON l.id = i.listing_id
  LEFT JOIN public.categories c ON c.id = l.category_id
),
listing_nights AS (
  SELECT
    tl.listing_id,
    n.night,
    tl.max_capacity,
    tl.category_slug,
    tl.metadata,
    COALESCE(tl.base_price_thb, 0)::numeric AS base_price_thb,
    CASE
      WHEN public.is_whole_unit_listing_inventory_v1(tl.category_slug, tl.metadata)
        OR tl.max_capacity <= 1 THEN 1
      ELSE GREATEST(1, COALESCE(p_guests_count, 1))
    END::int AS required_guests
  FROM target_listings tl
  CROSS JOIN nights n
),
priced_listing_nights AS (
  SELECT
    ln.*,
    COALESCE(
      ROUND(NULLIF(db_season.price_daily::text, '')::numeric),
      CASE
        WHEN meta_season.season IS NOT NULL
          AND COALESCE(meta_season.season->>'priceDaily', meta_season.season->>'price_daily') IS NOT NULL
          AND COALESCE(meta_season.season->>'priceDaily', meta_season.season->>'price_daily') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN ROUND(COALESCE(meta_season.season->>'priceDaily', meta_season.season->>'price_daily')::numeric)
        WHEN meta_season.season IS NOT NULL
          AND COALESCE(meta_season.season->>'priceMultiplier', '1') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN ROUND(ln.base_price_thb * COALESCE(meta_season.season->>'priceMultiplier', '1')::numeric)
        ELSE ln.base_price_thb
      END,
      ln.base_price_thb
    )::numeric AS nightly_price
  FROM listing_nights ln
  LEFT JOIN LATERAL (
    SELECT sp.price_daily
    FROM public.seasonal_prices sp
    WHERE sp.listing_id = ln.listing_id
      AND sp.start_date::date <= ln.night
      AND sp.end_date::date >= ln.night
    ORDER BY sp.start_date ASC
    LIMIT 1
  ) db_season ON true
  LEFT JOIN LATERAL (
    SELECT season
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(ln.metadata->'seasonal_pricing') = 'array' THEN ln.metadata->'seasonal_pricing'
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS x(season, ord)
    WHERE COALESCE(season->>'startDate', season->>'start_date') <= ln.night::text
      AND COALESCE(season->>'endDate', season->>'end_date') >= ln.night::text
    ORDER BY ord ASC
    LIMIT 1
  ) meta_season ON true
),
booking_load AS (
  SELECT
    ln.listing_id,
    ln.night,
    CASE
      WHEN public.is_whole_unit_listing_inventory_v1(ln.category_slug, ln.metadata)
        OR ln.max_capacity <= 1 THEN
        CASE WHEN COUNT(b.id) FILTER (WHERE b.id IS NOT NULL) > 0 THEN ln.max_capacity ELSE 0 END
      ELSE
        COALESCE(
          SUM(
            CASE
              WHEN b.id IS NULL THEN 0
              WHEN COALESCE(NULLIF(b.guests_count::text, ''), '') ~ '^[0-9]+$'
                THEN GREATEST(1, (b.guests_count::text)::int)
              ELSE 1
            END
          ),
          0
        )
    END::int AS booked_load
  FROM priced_listing_nights ln
  LEFT JOIN public.bookings b
    ON b.listing_id = ln.listing_id
   AND timezone(public.resolve_listing_timezone_v1(ln.metadata), b.check_in)::date <= ln.night
   AND timezone(public.resolve_listing_timezone_v1(ln.metadata), b.check_out)::date > ln.night
   AND b.status::text = ANY (p_occupying_statuses)
  GROUP BY ln.listing_id, ln.night, ln.category_slug, ln.metadata, ln.max_capacity
),
block_load AS (
  SELECT
    ln.listing_id,
    ln.night,
    COALESCE(
      SUM(
        CASE
          WHEN cb.id IS NULL THEN 0
          WHEN cb.expires_at IS NOT NULL AND cb.expires_at <= now() THEN 0
          WHEN COALESCE(NULLIF(cb.units_blocked::text, ''), '') ~ '^[0-9]+$'
            THEN GREATEST(1, (cb.units_blocked::text)::int)
          ELSE 1
        END
      ),
      0
    )::int AS blocked_units
  FROM priced_listing_nights ln
  LEFT JOIN public.calendar_blocks cb
    ON cb.listing_id = ln.listing_id
   AND cb.start_date::date <= ln.night
   AND cb.end_date::date >= ln.night
   AND lower(coalesce(cb.source, '')) <> 'inquiry_hold'
  GROUP BY ln.listing_id, ln.night
),
night_rollup AS (
  SELECT
    ln.listing_id,
    ln.night,
    ln.max_capacity,
    ln.required_guests,
    ln.nightly_price,
    GREATEST(0, ln.max_capacity - COALESCE(bl.booked_load, 0) - COALESCE(kl.blocked_units, 0))::int AS remaining_spots
  FROM priced_listing_nights ln
  LEFT JOIN booking_load bl
    ON bl.listing_id = ln.listing_id
   AND bl.night = ln.night
  LEFT JOIN block_load kl
    ON kl.listing_id = ln.listing_id
   AND kl.night = ln.night
),
grouped AS (
  SELECT
    nr.listing_id,
    COUNT(*)::int AS nights,
    COALESCE(MIN(nr.remaining_spots), 0)::int AS min_remaining_spots,
    COALESCE(MAX(nr.max_capacity), 1)::int AS max_capacity,
    COALESCE(MAX(nr.required_guests), GREATEST(1, COALESCE(p_guests_count, 1)))::int AS required_guests,
    SUM(
      CASE
        WHEN nr.remaining_spots >= nr.required_guests THEN nr.nightly_price
        ELSE 0
      END
    )::numeric AS total_price,
    SUM(CASE WHEN nr.remaining_spots < nr.required_guests THEN 1 ELSE 0 END)::int AS conflicts_count,
    jsonb_agg(
      jsonb_build_object(
        'date', nr.night,
        'price', nr.nightly_price,
        'available', nr.remaining_spots >= nr.required_guests,
        'remaining_spots', nr.remaining_spots
      )
      ORDER BY nr.night
    ) AS price_grid
  FROM night_rollup nr
  GROUP BY nr.listing_id
)
SELECT
  i.listing_id,
  CASE
    WHEN p_check_in >= p_check_out THEN false
    ELSE COALESCE(g.conflicts_count, 0) = 0
  END AS available,
  COALESCE(g.conflicts_count, 0) AS conflicts_count,
  COALESCE(g.min_remaining_spots, 0) AS min_remaining_spots,
  COALESCE(g.max_capacity, 1) AS max_capacity,
  COALESCE(g.required_guests, GREATEST(1, COALESCE(p_guests_count, 1))) AS required_guests,
  COALESCE(g.nights, 0) AS nights,
  COALESCE(g.total_price, 0)::numeric AS total_price,
  CASE
    WHEN COALESCE(g.nights, 0) > 0 THEN ROUND(COALESCE(g.total_price, 0)::numeric / g.nights)
    ELSE 0
  END::numeric AS average_per_night,
  false AS is_promo_applied,
  COALESCE(g.price_grid, '[]'::jsonb) AS price_grid
FROM input_ids i
LEFT JOIN grouped g ON g.listing_id = i.listing_id;
$$;

COMMENT ON FUNCTION public.batch_check_listing_availability(text[], date, date, integer, text[]) IS
  'Stage 187.8 — batch availability; property whole-unit + TZ nights + inquiry_hold excluded from blocks.';

GRANT EXECUTE ON FUNCTION public.batch_check_listing_availability(text[], date, date, integer, text[]) TO service_role;
