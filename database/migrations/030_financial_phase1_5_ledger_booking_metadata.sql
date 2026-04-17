-- Phase 1.5: bookings.metadata (JSONB) + double-entry ledger (accounts, journals, entries).
-- TEXT FKs aligned with production Supabase (FannyRent).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.bookings.metadata IS
  'Extensible JSON: payment refs, gateway metadata, etc.';

CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  partner_id TEXT REFERENCES public.profiles (id) ON DELETE RESTRICT,
  display_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'SYSTEM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ledger_accounts_system_code_uq
  ON public.ledger_accounts (code)
  WHERE partner_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ledger_accounts_partner_code_uq
  ON public.ledger_accounts (code, partner_id)
  WHERE partner_id IS NOT NULL;

COMMENT ON TABLE public.ledger_accounts IS
  'Chart of accounts: system pots + per-partner earnings buckets.';

CREATE TABLE IF NOT EXISTS public.ledger_journals (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES public.bookings (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ledger_journals_idempotency_key_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS ledger_journals_booking_id_idx ON public.ledger_journals (booking_id);

COMMENT ON TABLE public.ledger_journals IS
  'Balanced posting groups (e.g. one journal per booking payment capture).';

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL REFERENCES public.ledger_journals (id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES public.ledger_accounts (id) ON DELETE RESTRICT,
  side TEXT NOT NULL CHECK (side IN ('DEBIT', 'CREDIT')),
  amount_thb NUMERIC(14, 2) NOT NULL CHECK (amount_thb >= 0),
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_entries_journal_id_idx ON public.ledger_entries (journal_id);
CREATE INDEX IF NOT EXISTS ledger_entries_account_id_idx ON public.ledger_entries (account_id);

COMMENT ON TABLE public.ledger_entries IS
  'Ledger lines: DEBIT guest clearing vs CREDIT partner / platform / insurance / rounding pot.';

INSERT INTO public.ledger_accounts (id, code, partner_id, display_name, account_type)
VALUES
  ('la-sys-guest-clearing', 'GUEST_PAYMENT_CLEARING', NULL, 'Guest payment clearing (intake)', 'SYSTEM'),
  ('la-sys-platform-fee', 'PLATFORM_FEE', NULL, 'Platform fee (margin net of insurance carve-out)', 'SYSTEM'),
  ('la-sys-insurance', 'INSURANCE_FUND_RESERVE', NULL, 'Insurance fund reserve', 'SYSTEM'),
  ('la-sys-processing-pot', 'PROCESSING_POT_ROUNDING', NULL, 'Processing pot (guest rounding to 10 THB)', 'SYSTEM')
ON CONFLICT (id) DO NOTHING;
