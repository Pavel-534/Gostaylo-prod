-- PR-#2: Partner balance columns, escrow thaw timestamp, THAWED status, payout_methods FK safety.

-- 1) booking_status: THAWED (funds released from escrow to partner-available pool; payout only on request)
DO $$
BEGIN
  ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'THAWED';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'booking_status THAWED already exists';
END $$;

-- 2) When partner may withdraw (computed in app; stored for audit / cron)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS escrow_thaw_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookings.escrow_thaw_at IS 'Listing-TZ semantics: moment after which escrow-thaw cron may set status THAWED (category rules).';

-- 3) Materialized partner balances (THB); synced from bookings by app after thaw / optional admin job
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS frozen_balance_thb NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_balance_thb NUMERIC(14, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.frozen_balance_thb IS 'Sum of partner net in PAID_ESCROW bookings (escrow).';
COMMENT ON COLUMN public.profiles.available_balance_thb IS 'Sum of partner net in THAWED bookings (withdrawable via Request Payout).';

-- 4) payout_methods FK: changing/deleting method must not break historical profiles; ledger does not reference payout_methods.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'partner_payout_profiles'
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) LIKE '%payout_methods%'
  LOOP
    EXECUTE format('ALTER TABLE public.partner_payout_profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.partner_payout_profiles
  ALTER COLUMN method_id DROP NOT NULL;

ALTER TABLE public.partner_payout_profiles
  ADD CONSTRAINT partner_payout_profiles_method_id_fkey
  FOREIGN KEY (method_id) REFERENCES public.payout_methods(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.partner_payout_profiles.method_id IS 'NULL if method row removed; partner must pick a new method. Ledger entries do not depend on this FK.';
