-- Stage 131.A4 — atomic program cap reserve (race condition fix).
--
-- PERFORM FOR UPDATE locks rows to serialize concurrent distributes.
-- Then SUM computes spend on the locked snapshot.
--
-- Called from Node via: supabaseAdmin.rpc('referral_program_cap_reserve', {...})

CREATE OR REPLACE FUNCTION public.referral_program_cap_reserve(
  p_proposed_thb numeric,
  p_utc_month_start timestamptz
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_cap_thb numeric;
  v_spent_thb numeric;
  v_remaining numeric;
BEGIN
  -- Lock rows first (FOR UPDATE cannot be combined with aggregate)
  PERFORM 1
  FROM public.referral_ledger
  WHERE referral_type = 'guest_booking'
    AND status IN ('pending', 'earned', 'earned_held')
    AND created_at >= p_utc_month_start
  FOR UPDATE;

  -- Now sum the locked rows
  SELECT COALESCE(SUM(amount_thb), 0) INTO v_spent_thb
  FROM public.referral_ledger
  WHERE referral_type = 'guest_booking'
    AND status IN ('pending', 'earned', 'earned_held')
    AND created_at >= p_utc_month_start;

  SELECT COALESCE(referral_monthly_program_cap_thb, 0) INTO v_cap_thb
  FROM public.system_fintech_settings
  WHERE id = 'global';

  IF v_cap_thb <= 0 THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', 999999999,
      'spent', v_spent_thb,
      'cap', v_cap_thb,
      'reason', 'CAP_DISABLED'
    );
  END IF;

  v_remaining := GREATEST(0, v_cap_thb - v_spent_thb);

  IF p_proposed_thb <= v_remaining + 0.01 THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', v_remaining,
      'spent', v_spent_thb,
      'cap', v_cap_thb
    );
  ELSE
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', v_remaining,
      'spent', v_spent_thb,
      'cap', v_cap_thb,
      'reason', 'MONTHLY_PROGRAM_CAP_EXCEEDED'
    );
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.referral_program_cap_reserve(numeric, timestamptz) TO service_role;
