-- Stage 202.15 — DB Guardrails (pre-launch, file-only until ops apply)
-- а) Case-insensitive email UNIQUE on profiles
-- б) Immutable booking money columns after paid / escrow pipeline
--
-- Pre-flight (manual, before apply on prod):
--   SELECT lower(email) AS e, COUNT(*) AS c, array_agg(email) AS variants
--   FROM public.profiles
--   GROUP BY lower(email)
--   HAVING COUNT(*) > 1;
--
-- Break-glass (single transaction, service_role only):
--   SET LOCAL airento.allow_paid_price_fix = 'on';
--   UPDATE public.bookings SET ... WHERE id = '...';

-- -----------------------------------------------------------------------------
-- а) profiles_email_lower_idx — complements case-sensitive profiles_email_key
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_idx
  ON public.profiles (LOWER(email));

COMMENT ON INDEX public.profiles_email_lower_idx IS
  'Stage 202.15: one profile per email regardless of case.';

-- -----------------------------------------------------------------------------
-- б) Paid-booking money column immutability (defense in depth vs app guards)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.airento_guard_booking_paid_money_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allow_fix text;
  old_st text;
BEGIN
  allow_fix := current_setting('airento.allow_paid_price_fix', true);
  IF allow_fix = 'on' THEN
    RETURN NEW;
  END IF;

  old_st := COALESCE(UPPER(OLD.status::text), '');

  IF old_st NOT IN (
    'PAID',
    'PAID_ESCROW',
    'CHECKED_IN',
    'THAWED',
    'READY_FOR_PAYOUT',
    'COMPLETED',
    'REFUNDED'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.price_thb IS DISTINCT FROM OLD.price_thb
     OR NEW.commission_thb IS DISTINCT FROM OLD.commission_thb
     OR NEW.partner_earnings_thb IS DISTINCT FROM OLD.partner_earnings_thb
     OR NEW.rounding_diff_pot IS DISTINCT FROM OLD.rounding_diff_pot
     OR NEW.pricing_snapshot IS DISTINCT FROM OLD.pricing_snapshot
  THEN
    RAISE EXCEPTION
      'BOOKING_PAID_MONEY_IMMUTABLE: status=% money columns locked (break-glass: SET LOCAL airento.allow_paid_price_fix = ''on'')',
      old_st
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.airento_guard_booking_paid_money_columns() IS
  'Stage 202.15: block UPDATE to booking money SSOT when OLD.status is paid pipeline; GUC airento.allow_paid_price_fix=on skips guard.';

DROP TRIGGER IF EXISTS trg_bookings_guard_paid_money_columns ON public.bookings;
CREATE TRIGGER trg_bookings_guard_paid_money_columns
  BEFORE UPDATE OF price_thb, commission_thb, partner_earnings_thb, rounding_diff_pot, pricing_snapshot
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.airento_guard_booking_paid_money_columns();
