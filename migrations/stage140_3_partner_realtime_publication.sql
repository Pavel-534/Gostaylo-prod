-- Stage 140.3 — Partner dashboard Realtime: bookings + wallet_transactions
-- Idempotent: safe to re-run. RLS already allows partner SELECT via current_profile_id().
-- Prerequisite for hooks/usePartnerRealtime.js postgres_changes subscriptions.

DO $$
BEGIN
  IF to_regclass('public.bookings') IS NOT NULL THEN
    ALTER TABLE public.bookings REPLICA IDENTITY FULL;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'bookings'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.wallet_transactions') IS NOT NULL THEN
    ALTER TABLE public.wallet_transactions REPLICA IDENTITY FULL;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'wallet_transactions'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
    END IF;
  END IF;
END $$;
