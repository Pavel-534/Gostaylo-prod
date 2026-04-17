-- Phase 2.0: manual bank ops — PAID / FAILED on payouts (Postgres enum payout_status).

DO $$
BEGIN
  ALTER TYPE public.payout_status ADD VALUE 'PAID';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.payout_status ADD VALUE 'FAILED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
