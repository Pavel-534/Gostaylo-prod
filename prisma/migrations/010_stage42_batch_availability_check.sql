-- Stage 42.2/42.3 — batch availability RPC for search (single DB call per listing set).
-- Pricing note: RPC returns a seasonal-aware nightly grid/subtotal for observability.
-- Exact guest-payable totals (duration discount, promo, fee, pot rounding) stay in PricingService SSOT.

DROP FUNCTION IF EXISTS public.batch_check_listing_availability(text[], date, date, integer, text[]);

CREATE OR REPLACE FUNCTION public.batch_check_listing_availability(
  p_listing_ids text[],
  p_check_in date,
  p_check_out date,
  p_guests_count integer DEFAULT 1,
  p_occupying_statuses text[] DEFAULT ARRAY['PENDING','CONFIRMED','PAID','PAID_ESCROW','CHECKED_IN']
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
      WHEN tl.category_slug = 'vehicles' OR tl.max_capacity <= 1 THEN 1
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
      WHEN ln.category_slug = 'vehicles' THEN
        CASE WHEN COUNT(b.id) > 0 THEN ln.max_capacity ELSE 0 END
      ELSE
        COALESCE(
          SUM(
            CASE
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
   AND b.check_in::date <= ln.night
   AND b.check_out::date > ln.night
   -- bookings.status = enum booking_status; p_occupying_statuses = text[] (PostgREST / JS)
   AND b.status::text = ANY (p_occupying_statuses)
  GROUP BY ln.listing_id, ln.night, ln.category_slug, ln.max_capacity
),
block_load AS (
  SELECT
    ln.listing_id,
    ln.night,
    COALESCE(
      SUM(
        CASE
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
  'Stage 42.3: batch availability check for search; returns per-listing availability + seasonal price grid. Exact promo/fees are applied in PricingService SSOT.';

GRANT EXECUTE ON FUNCTION public.batch_check_listing_availability(text[], date, date, integer, text[]) TO service_role;
