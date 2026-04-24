-- Stage 37.0
-- Promo reminder deduplication storage:
-- promo_codes.metadata.last_reminder_sent_at

ALTER TABLE promo_codes
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN promo_codes.metadata IS
'Auxiliary promo metadata (e.g. last_reminder_sent_at for flash-sale reminder dedup).';

