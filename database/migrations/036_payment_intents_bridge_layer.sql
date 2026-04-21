-- Stage 2: Payment Intent bridge layer (Invoice <-> Checkout <-> Escrow/Ledger)
-- TEXT FKs aligned with production schema.

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES public.bookings (id) ON DELETE CASCADE,
  invoice_id TEXT NULL REFERENCES public.invoices (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'CREATED'
    CHECK (status IN ('CREATED', 'INITIATED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED')),
  amount_thb NUMERIC(14, 2) NOT NULL CHECK (amount_thb >= 0),
  display_amount NUMERIC(14, 2) NOT NULL CHECK (display_amount >= 0),
  display_currency TEXT NOT NULL DEFAULT 'THB',
  preferred_method TEXT NOT NULL DEFAULT 'CARD'
    CHECK (preferred_method IN ('CARD', 'MIR', 'CRYPTO')),
  allowed_methods JSONB NOT NULL DEFAULT '["CARD","MIR","CRYPTO"]'::jsonb,
  provider TEXT NULL,
  external_ref TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NULL,
  initiated_at TIMESTAMPTZ NULL,
  confirmed_at TIMESTAMPTZ NULL,
  created_by TEXT NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_intents_booking_status_idx
  ON public.payment_intents (booking_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_intents_invoice_status_idx
  ON public.payment_intents (invoice_id, status, created_at DESC)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_intents_status_idx
  ON public.payment_intents (status, created_at DESC);

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.payment_intents IS
  'Unified payment bridge: binds checkout session to booking/invoice and provider metadata.';

COMMENT ON COLUMN public.payment_intents.allowed_methods IS
  'JSON array of allowed methods: CARD|MIR|CRYPTO.';

