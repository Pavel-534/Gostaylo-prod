-- Stage 33.0 — scoped promo: restrict code to specific listings (uuid[]).
-- NULL or empty array = no listing-level restriction (existing PARTNER/PLATFORM behavior).

ALTER TABLE promo_codes
ADD COLUMN IF NOT EXISTS allowed_listing_ids UUID[] DEFAULT NULL;

COMMENT ON COLUMN promo_codes.allowed_listing_ids IS
  'Stage 33: non-empty = promo valid only for these listing IDs at checkout; NULL/empty = not restricted by listing allowlist (PARTNER still requires owner match; PLATFORM global when empty).';
