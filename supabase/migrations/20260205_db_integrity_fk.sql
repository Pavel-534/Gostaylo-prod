-- =====================================================================
-- Migration: DB Integrity — Foreign Keys для geo-иерархии
-- Date: 2026-02-05
-- Sprint: Conversion Polish & Code Health
--
-- Цель: гарантировать целостность listings.country_code / region_code / city_code
--       через FK на geo_locations(code). После миграции невозможно записать
--       листинг с несуществующим кодом страны/региона/города.
--
-- Apply: Supabase Dashboard → SQL Editor → paste & Run.
--
-- Idempotent: все операции используют IF NOT EXISTS / DO $$ guards.
-- Safe: ON DELETE SET NULL — удаление записи из справочника не ломает листинги.
-- =====================================================================

BEGIN;

-- 1) UNIQUE constraint на geo_locations(code) -----------------------
-- Требуется для FK referencing. Текущий UNIQUE (level, code) — не подходит:
-- PostgreSQL требует чтобы referenced column имел свой UNIQUE или PK.
-- Проверено: все коды в seed данных уникальны в пределах всего справочника
-- (country='TH', region='TH-PHK', city='phuket-city' — все разные слаги).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uniq_geo_locations_code' AND conrelid = 'public.geo_locations'::regclass
  ) THEN
    ALTER TABLE public.geo_locations
      ADD CONSTRAINT uniq_geo_locations_code UNIQUE (code);
  END IF;
END $$;

-- 2) Валидация перед FK -----------------------------------------------
-- Обнуляем «висячие» ссылки — country_code / region_code / city_code
-- на значения, которых нет в geo_locations. Это безопасно: после миграции
-- `applySmartWhereFilter` использует legacy district fallback.
UPDATE public.listings l
   SET country_code = NULL
 WHERE country_code IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.geo_locations g WHERE g.code = l.country_code);

UPDATE public.listings l
   SET region_code = NULL
 WHERE region_code IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.geo_locations g WHERE g.code = l.region_code);

UPDATE public.listings l
   SET city_code = NULL
 WHERE city_code IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.geo_locations g WHERE g.code = l.city_code);

-- 3) Foreign Keys -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_listings_country_code' AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT fk_listings_country_code
        FOREIGN KEY (country_code)
        REFERENCES public.geo_locations(code)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_listings_region_code' AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT fk_listings_region_code
        FOREIGN KEY (region_code)
        REFERENCES public.geo_locations(code)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_listings_city_code' AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT fk_listings_city_code
        FOREIGN KEY (city_code)
        REFERENCES public.geo_locations(code)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
  END IF;
END $$;

-- 4) Optional: CHECK constraint для семантической валидности level ----
-- country_code должен ссылаться на level='country', region_code на 'region' и т.д.
-- Но PostgreSQL CHECK не может иметь подзапрос — эту проверку делаем через trigger.
-- Оставляем как TODO: trigger function validate_listings_geo_levels().
-- Для MVP FK (уникальность кодов) достаточно.

COMMIT;

-- =====================================================================
-- Verification (run after COMMIT):
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.listings'::regclass AND contype = 'f';
--
-- Должно вернуть 3 строки: fk_listings_country_code / region_code / city_code
-- =====================================================================
