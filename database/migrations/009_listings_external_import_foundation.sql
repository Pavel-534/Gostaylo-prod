-- Gostaylo — foundation for external listing import (Airbnb / Booking / future PMS)
-- Idempotent: safe to run multiple times.
-- Apply: Supabase SQL Editor OR `supabase db push` if project is linked (see docs in repo).

-- ---------------------------------------------------------------------------
-- 1) sync_settings: канон импорта / синхронизации (уже мог быть добавлен ранее)
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS sync_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.listings.sync_settings IS
  'Import/sync control: platform, external ids, last sync, mapping version, flags. '
  'Suggested keys: platform, external_listing_id, external_listing_url, last_import_at, '
  'last_sync_status, field_mapping_version, raw_payload_storage_key, notes.';

-- ---------------------------------------------------------------------------
-- 2) Колонки для запросов и уникальности (metadata остаётся для богатого контента)
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS import_platform TEXT;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS import_external_id TEXT;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS import_external_url TEXT;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS last_imported_at TIMESTAMPTZ;

COMMENT ON COLUMN public.listings.import_platform IS
  'Lowercase source: airbnb, booking, manual, lodgify, etc.';

COMMENT ON COLUMN public.listings.import_external_id IS
  'Stable id from external system (string).';

COMMENT ON COLUMN public.listings.import_external_url IS
  'Human-readable URL of the source listing (audit / partner support).';

COMMENT ON COLUMN public.listings.last_imported_at IS
  'When raw external payload was last successfully mapped/applied.';

COMMENT ON COLUMN public.listings.metadata IS
  'JSONB: structured ListingMetadata (property_info, amenities, rules, category_specific) '
  'plus legacy flat keys (bedrooms, max_guests, city, lat, ...).';

-- Один объект на пару (владелец + платформа + внешний id), только если все три заданы
CREATE UNIQUE INDEX IF NOT EXISTS listings_owner_import_dedupe_uidx
  ON public.listings (owner_id, import_platform, import_external_id)
  WHERE import_platform IS NOT NULL
    AND import_external_id IS NOT NULL
    AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS listings_import_platform_idx
  ON public.listings (import_platform)
  WHERE import_platform IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) Опционально: быстрый поиск по кодам удобств внутри metadata (GIN)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS listings_metadata_gin_idx
  ON public.listings USING GIN (metadata);
