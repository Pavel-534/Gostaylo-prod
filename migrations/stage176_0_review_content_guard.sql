-- Stage 176.0.0 — Instant reviews + content guard (moderation_status + RLS + listing stats)

-- -----------------------------------------------------------------------------
-- A) moderation_status on both review tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE public.guest_reviews
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_moderation_status_check'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_moderation_status_check
      CHECK (moderation_status IN ('approved', 'flagged'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guest_reviews_moderation_status_check'
  ) THEN
    ALTER TABLE public.guest_reviews
      ADD CONSTRAINT guest_reviews_moderation_status_check
      CHECK (moderation_status IN ('approved', 'flagged'));
  END IF;
END $$;

COMMENT ON COLUMN public.reviews.moderation_status IS
  'Stage 176.0: approved = public listing reviews; flagged = hidden from anon/public SELECT (author + listing owner still see).';
COMMENT ON COLUMN public.guest_reviews.moderation_status IS
  'Stage 176.0: approved | flagged — partner/guest dyad; no public PDP exposure.';

UPDATE public.reviews SET moderation_status = 'approved' WHERE moderation_status IS NULL;
UPDATE public.guest_reviews SET moderation_status = 'approved' WHERE moderation_status IS NULL;

-- -----------------------------------------------------------------------------
-- B) booking_reviews view alias (Stage 141.3 + 176.0)
-- Postgres forbids CREATE OR REPLACE when new columns shift positions (42P16).
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.booking_reviews;

CREATE VIEW public.booking_reviews AS
SELECT
  id,
  booking_id,
  user_id AS author_id,
  listing_id,
  rating,
  comment,
  photos,
  is_verified,
  created_at,
  updated_at,
  moderation_status
FROM public.reviews
WHERE booking_id IS NOT NULL;

COMMENT ON VIEW public.booking_reviews IS
  'Stage 141.3/176.0 alias: one review per booking (SSOT: reviews); moderation_status appended.';

GRANT SELECT ON public.booking_reviews TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- C) Listing aggregates — only approved guest→listing reviews
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_listing_review_stats(p_listing_id text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cnt integer;
  v_avg numeric(4, 2);
BEGIN
  SELECT
    COUNT(*)::integer,
    COALESCE(ROUND(AVG(r.rating::numeric), 2), 0)::numeric(4, 2)
  INTO v_cnt, v_avg
  FROM public.reviews r
  WHERE r.listing_id = p_listing_id
    AND r.rating IS NOT NULL
    AND COALESCE(r.moderation_status, 'approved') = 'approved';

  UPDATE public.listings l
  SET
    reviews_count = COALESCE(v_cnt, 0),
    avg_rating = COALESCE(v_avg, 0),
    rating = LEAST(9.99, GREATEST(0, COALESCE(v_avg, 0)))::numeric(3, 2),
    updated_at = NOW()
  WHERE l.id = p_listing_id;
END;
$$;

COMMENT ON FUNCTION public.refresh_listing_review_stats(text) IS
  'Stage 176.0: recalc listing review stats from approved reviews only.';

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT listing_id AS lid FROM public.reviews
  LOOP
    PERFORM public.refresh_listing_review_stats(r.lid);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- D) RLS — reviews_select_scope: public only sees approved on ACTIVE listings
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_rev_col text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reviews') THEN
    RETURN;
  END IF;

  SELECT c.column_name INTO v_rev_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'reviews'
    AND c.column_name IN ('user_id', 'renter_id')
  ORDER BY
    CASE c.column_name
      WHEN 'user_id' THEN 1
      WHEN 'renter_id' THEN 2
    END
  LIMIT 1;

  IF v_rev_col IS NULL THEN
    RAISE EXCEPTION 'Stage 176.0: public.reviews has no reviewer column (user_id / renter_id)';
  END IF;

  ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "reviews_select_all" ON public.reviews;
  DROP POLICY IF EXISTS reviews_select_scope ON public.reviews;

  EXECUTE format($sql$
    CREATE POLICY reviews_select_scope
      ON public.reviews
      FOR SELECT
      TO public
      USING (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR %I = public.current_profile_id()
        OR EXISTS (
            SELECT 1
            FROM public.listings l
            WHERE l.id = listing_id
              AND l.owner_id = public.current_profile_id()
          )
        OR (
          COALESCE(moderation_status, 'approved') = 'approved'
          AND EXISTS (
            SELECT 1
            FROM public.listings l
            WHERE l.id = listing_id
              AND l.status = 'ACTIVE'::public.listing_status
          )
        )
      )
  $sql$, v_rev_col);
END $$;
