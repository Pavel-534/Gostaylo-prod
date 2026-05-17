-- Migration 054: booking_status READY_FOR_PAYOUT (Stage 100.1)
-- Fixes: invalid input value for enum booking_status: "READY_FOR_PAYOUT"
-- (compliance export, payout pools, admin FinTech dashboard)

DO $$
BEGIN
  ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'READY_FOR_PAYOUT';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'booking_status value READY_FOR_PAYOUT already exists';
END $$;
