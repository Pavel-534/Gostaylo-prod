-- Stage 202.01 — Crypto txid uniqueness (AUDIT_03 C3.2).
-- Prevents replaying one on-chain tx across multiple bookings.
-- Idempotency key in app: crypto_payment:{txid}:{booking_id}

CREATE UNIQUE INDEX IF NOT EXISTS payments_tx_id_unique
  ON public.payments (tx_id)
  WHERE tx_id IS NOT NULL AND btrim(tx_id::text) <> '';

COMMENT ON INDEX public.payments_tx_id_unique IS
  'AUDIT_03 C3.2: one crypto tx_id may settle at most one payments row';
