-- Stage 118.6 — индексы для глобального поиска админки (ilike / prefix).
-- SSOT потребитель: lib/admin/admin-global-search.server.js

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Email / имя: ILIKE '%query%'
CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm
  ON public.profiles USING gin (lower(email) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_first_name_trgm
  ON public.profiles USING gin (lower(first_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_last_name_trgm
  ON public.profiles USING gin (lower(last_name) gin_trgm_ops);

-- UUID / text id: eq (PK) + prefix ILIKE 'booking-abc%'
CREATE INDEX IF NOT EXISTS idx_bookings_id_pattern
  ON public.bookings (id text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_listings_id_pattern
  ON public.listings (id text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_listings_title_trgm
  ON public.listings USING gin (lower(title) gin_trgm_ops);

-- Реферальный код профиля (точный / prefix поиск в будущем)
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code_lower
  ON public.profiles (lower(referral_code))
  WHERE referral_code IS NOT NULL AND trim(referral_code) <> '';

COMMENT ON INDEX idx_profiles_email_trgm IS 'Admin global search: ILIKE on email';
COMMENT ON INDEX idx_bookings_id_pattern IS 'Admin global search: prefix on booking id';
