-- Stage 34.0 — Flash Sale flag on promo_codes (deadline remains valid_until)
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS is_flash_sale BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN promo_codes.is_flash_sale IS 'Stage 34: urgency / FOMO; end time is always valid_until';
