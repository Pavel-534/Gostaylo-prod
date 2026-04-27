-- Stage 71.3 — Marketing promo tank (global pot) + transactional adjust helper.

CREATE TABLE IF NOT EXISTS public.marketing_promo_tank_ledger (
  id TEXT PRIMARY KEY,
  booking_id TEXT REFERENCES public.bookings (id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (
    entry_type IN ('organic_topup', 'referral_boost_debit', 'manual_topup', 'manual_debit')
  ),
  amount_thb NUMERIC(14, 2) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_promo_tank_ledger_created
  ON public.marketing_promo_tank_ledger (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_promo_tank_ledger_booking
  ON public.marketing_promo_tank_ledger (booking_id)
  WHERE booking_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_promo_tank_ledger_booking_type
  ON public.marketing_promo_tank_ledger (booking_id, entry_type)
  WHERE booking_id IS NOT NULL;

COMMENT ON TABLE public.marketing_promo_tank_ledger IS
  'Ledger for marketing promo pot movements (topups/debits).';

-- Ensure defaults exist in system_settings.general payload.
UPDATE public.system_settings
SET value =
  coalesce(value, '{}'::jsonb)
  || jsonb_build_object(
    'marketing_promo_pot',
      coalesce((value ->> 'marketing_promo_pot')::numeric, 0),
    'promo_boost_per_booking',
      coalesce((value ->> 'promo_boost_per_booking')::numeric, 0),
    'promo_turbo_mode_enabled',
      coalesce((value ->> 'promo_turbo_mode_enabled')::boolean, false),
    'organic_to_promo_pot_percent',
      coalesce((value ->> 'organic_to_promo_pot_percent')::numeric, 0)
  ),
  updated_at = now()
WHERE key = 'general';

CREATE OR REPLACE FUNCTION public.adjust_marketing_promo_pot(
  p_delta_thb numeric,
  p_entry_type text,
  p_booking_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (new_balance_thb numeric, applied boolean, reason text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_setting_id text;
  v_value jsonb;
  v_current numeric(14, 2);
  v_next numeric(14, 2);
  v_exists boolean;
  v_delta numeric(14, 2);
BEGIN
  v_delta := round(coalesce(p_delta_thb, 0)::numeric, 2);
  IF v_delta = 0 THEN
    RETURN QUERY SELECT 0::numeric, false, 'ZERO_DELTA';
    RETURN;
  END IF;

  SELECT id, value
    INTO v_setting_id, v_value
  FROM public.system_settings
  WHERE key = 'general'
  FOR UPDATE;

  IF v_setting_id IS NULL THEN
    v_setting_id := 'setting-' || substring(md5(random()::text || clock_timestamp()::text), 1, 16);
    v_value := '{}'::jsonb;
    INSERT INTO public.system_settings (id, key, value, updated_at)
    VALUES (v_setting_id, 'general', v_value, now());
  END IF;

  v_current := round(coalesce((v_value ->> 'marketing_promo_pot')::numeric, 0)::numeric, 2);

  IF p_booking_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.marketing_promo_tank_ledger
      WHERE booking_id = p_booking_id
        AND entry_type = p_entry_type
    )
      INTO v_exists;
    IF v_exists THEN
      RETURN QUERY SELECT v_current, false, 'ALREADY_APPLIED';
      RETURN;
    END IF;
  END IF;

  IF v_delta < 0 AND (v_current + v_delta) < 0 THEN
    RETURN QUERY SELECT v_current, false, 'INSUFFICIENT_BALANCE';
    RETURN;
  END IF;

  v_next := round((v_current + v_delta)::numeric, 2);

  UPDATE public.system_settings
  SET value = jsonb_set(coalesce(value, '{}'::jsonb), '{marketing_promo_pot}', to_jsonb(v_next), true),
      updated_at = now()
  WHERE key = 'general';

  INSERT INTO public.marketing_promo_tank_ledger (id, booking_id, entry_type, amount_thb, metadata)
  VALUES (
    'mpt-' || substring(md5(random()::text || clock_timestamp()::text), 1, 18),
    p_booking_id,
    p_entry_type,
    v_delta,
    coalesce(p_metadata, '{}'::jsonb)
  );

  RETURN QUERY SELECT v_next, true, 'APPLIED';
END;
$$;

