-- Stage 31.0 — владелец промокода (PLATFORM | PARTNER) + partner_id.
-- Выполнить в Supabase SQL Editor после деплоя кода.
--
-- ВАЖНО: тип `profiles.id` в проектах может быть UUID (канон `002_supabase_schema.sql`)
-- или TEXT (legacy). FK `REFERENCES profiles(id)` требует **точного** совпадения типов.
-- Ниже — безопасный вариант для **любой** схемы: `partner_id` как TEXT без FK.
-- Целостность partner_id ↔ profiles проверяется в приложении (как и для других id-строк).
--
-- НЕ нужно заново накатывать весь `002_supabase_schema.sql` на прод — только этот файл.

DO $$ BEGIN
  CREATE TYPE promo_created_by_type AS ENUM ('PLATFORM', 'PARTNER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS created_by_type promo_created_by_type NOT NULL DEFAULT 'PLATFORM';

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS partner_id TEXT;

CREATE INDEX IF NOT EXISTS idx_promo_codes_partner_id ON promo_codes(partner_id);

COMMENT ON COLUMN promo_codes.created_by_type IS 'PLATFORM — на все листинги; PARTNER — только на листинги partner_id';
COMMENT ON COLUMN promo_codes.partner_id IS 'Для PARTNER — owner_id листинга (= id партнёра); NULL для PLATFORM. TEXT = совместимо с UUID и legacy TEXT в profiles.id';

-- Опционально: если у вас `profiles.id` именно UUID и вы хотите FK, выполните ПОСЛЕ проверки типов:
-- ALTER TABLE promo_codes DROP CONSTRAINT IF EXISTS promo_codes_partner_id_fkey;
-- ALTER TABLE promo_codes ALTER COLUMN partner_id TYPE uuid USING partner_id::uuid;
-- ALTER TABLE promo_codes ADD CONSTRAINT promo_codes_partner_id_fkey
--   FOREIGN KEY (partner_id) REFERENCES profiles(id) ON DELETE SET NULL;
