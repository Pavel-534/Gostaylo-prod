-- Stage 44.0 — Guest reviews → denormalized listing stats (avg_rating + reviews_count).
-- Примечание: каноническая DDL таблицы `reviews` — `database/reviews_table.sql` + `database/migrations/014_reviews_photos_verified_booking_unique.sql`
-- и `migrations/upgrade_reviews_multicategory.sql`; здесь только агрегаты и триггер.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(4, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.listings.avg_rating IS 'Средний рейтинг гостевых отзывов (денормализация из public.reviews); дублирует смысл rating для каталога.';

-- Стартовый backfill: выровнять avg_rating с legacy rating, затем пересчитать из отзывов где они есть.
UPDATE public.listings l
SET avg_rating = COALESCE(l.rating, 0)::numeric(4, 2)
WHERE EXISTS (SELECT 1 FROM public.reviews r WHERE r.listing_id = l.id)
   OR (l.avg_rating = 0 AND COALESCE(l.rating, 0) <> 0);

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
    AND r.rating IS NOT NULL;

  UPDATE public.listings l
  SET
    reviews_count = COALESCE(v_cnt, 0),
    avg_rating = COALESCE(v_avg, 0),
    rating = LEAST(9.99, GREATEST(0, COALESCE(v_avg, 0)))::numeric(3, 2),
    updated_at = NOW()
  WHERE l.id = p_listing_id;
END;
$$;

COMMENT ON FUNCTION public.refresh_listing_review_stats(text) IS 'Пересчитывает reviews_count, avg_rating и rating листинга по гостевым отзывам.';

CREATE OR REPLACE FUNCTION public.trg_reviews_refresh_listing_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  lid text;
  old_lid text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    lid := OLD.listing_id;
    PERFORM public.refresh_listing_review_stats(lid);
    RETURN OLD;
  END IF;

  lid := NEW.listing_id;
  PERFORM public.refresh_listing_review_stats(lid);

  IF TG_OP = 'UPDATE' AND OLD.listing_id IS DISTINCT FROM NEW.listing_id THEN
    old_lid := OLD.listing_id;
    PERFORM public.refresh_listing_review_stats(old_lid);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_refresh_listing_stats ON public.reviews;
CREATE TRIGGER trg_reviews_refresh_listing_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_reviews_refresh_listing_stats();

-- Первичный пересчёт для всех листингов с отзывами
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT listing_id AS lid FROM public.reviews
  LOOP
    PERFORM public.refresh_listing_review_stats(r.lid);
  END LOOP;
END $$;
