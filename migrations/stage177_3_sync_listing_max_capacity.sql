-- Stage 177.3 — sync listings.max_capacity from metadata/bedrooms (SSOT: lib/listing-guest-capacity.js)
-- Extends Stage 45.1 trigger; backfills stale max_capacity=1 on multi-bedroom stays.

CREATE OR REPLACE FUNCTION public.sync_listing_counts_from_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bedrooms integer;
  v_bathrooms integer;
  v_category_slug text;
  v_meta_guests integer;
  v_meta_guests_alt integer;
  v_seats integer;
  v_from_beds integer;
  v_cap integer;
BEGIN
  IF NEW.metadata IS NULL OR jsonb_typeof(NEW.metadata) <> 'object' THEN
    NEW.bedrooms_count := COALESCE(NEW.bedrooms_count, 0);
    NEW.bathrooms_count := COALESCE(NEW.bathrooms_count, 0);
    NEW.max_capacity := GREATEST(1, COALESCE(NEW.max_capacity, 1));
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

  SELECT LOWER(COALESCE(c.slug, ''))
  INTO v_category_slug
  FROM public.categories c
  WHERE c.id = NEW.category_id;

  v_meta_guests := CASE
    WHEN COALESCE(NEW.metadata->>'max_guests', '') ~ '^\d+$'
      THEN (NEW.metadata->>'max_guests')::integer
    ELSE 0
  END;
  v_meta_guests_alt := CASE
    WHEN COALESCE(NEW.metadata->>'guests', '') ~ '^\d+$'
      THEN (NEW.metadata->>'guests')::integer
    ELSE 0
  END;
  v_seats := CASE
    WHEN COALESCE(NEW.metadata->>'seats', '') ~ '^\d+$'
      THEN (NEW.metadata->>'seats')::integer
    ELSE 0
  END;

  v_cap := GREATEST(1, COALESCE(NEW.max_capacity, 1));

  IF v_category_slug = 'vehicles'
    OR v_category_slug IN ('helicopter', 'helicopters') THEN
    IF v_seats > 0 THEN
      v_cap := v_seats;
    ELSE
      v_cap := GREATEST(v_cap, GREATEST(v_meta_guests, v_meta_guests_alt, 2));
    END IF;
  ELSIF v_category_slug LIKE '%tour%'
    OR v_category_slug LIKE '%yacht%'
    OR v_category_slug LIKE '%boat%' THEN
    v_cap := GREATEST(v_cap, v_meta_guests, v_meta_guests_alt);
    IF v_cap <= 1 THEN
      v_cap := GREATEST(v_cap, 2);
    END IF;
  ELSE
    v_cap := GREATEST(v_cap, v_meta_guests, v_meta_guests_alt);
    IF NEW.bedrooms_count > 0 THEN
      v_from_beds := GREATEST(NEW.bedrooms_count * 2, NEW.bedrooms_count + 1);
      IF v_cap <= 1 OR v_cap < v_from_beds THEN
        v_cap := GREATEST(v_cap, v_from_beds);
      END IF;
    END IF;
    IF v_cap <= 1 THEN
      v_cap := 4;
    END IF;
  END IF;

  NEW.max_capacity := GREATEST(1, v_cap);

  IF v_meta_guests < NEW.max_capacity THEN
    NEW.metadata := jsonb_set(
      COALESCE(NEW.metadata, '{}'::jsonb),
      '{max_guests}',
      to_jsonb(NEW.max_capacity),
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_listing_counts_from_metadata ON public.listings;
CREATE TRIGGER trg_sync_listing_counts_from_metadata
  BEFORE INSERT OR UPDATE OF metadata, bedrooms_count, bathrooms_count, max_capacity, category_id ON public.listings
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_listing_counts_from_metadata();

-- One-time backfill: touch metadata so trigger recomputes max_capacity for all rows.
UPDATE public.listings
SET metadata = COALESCE(metadata, '{}'::jsonb);
