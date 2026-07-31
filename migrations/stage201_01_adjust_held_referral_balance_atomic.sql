-- Stage 201.01 — Atomic adjust of user_wallets.held_referral_balance_thb (AUDIT deferred WARN).
-- Prevents lost updates on concurrent hold/unlock of referral bonuses.

CREATE OR REPLACE FUNCTION public.adjust_held_referral_balance_thb(
  p_user_id text,
  p_delta_thb numeric
)
RETURNS TABLE (
  applied boolean,
  reason text,
  held_referral_balance_thb numeric,
  previous_thb numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text;
  v_delta numeric(14, 2);
  v_prev numeric(14, 2);
  v_next numeric(14, 2);
BEGIN
  v_uid := trim(coalesce(p_user_id, ''));
  v_delta := round(coalesce(p_delta_thb, 0)::numeric, 2);

  IF v_uid = '' THEN
    RETURN QUERY SELECT false, 'USER_ID_REQUIRED', NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  IF v_delta = 0 THEN
    SELECT coalesce(uw.held_referral_balance_thb, 0)::numeric
      INTO v_prev
      FROM public.user_wallets uw
     WHERE uw.user_id = v_uid;
    RETURN QUERY SELECT true, 'ZERO_DELTA', coalesce(v_prev, 0), coalesce(v_prev, 0);
    RETURN;
  END IF;

  SELECT coalesce(uw.held_referral_balance_thb, 0)::numeric
    INTO v_prev
    FROM public.user_wallets uw
   WHERE uw.user_id = v_uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'WALLET_NOT_FOUND', NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  v_next := greatest(0::numeric, round((v_prev + v_delta)::numeric, 2));

  UPDATE public.user_wallets
     SET held_referral_balance_thb = v_next,
         updated_at = now()
   WHERE user_id = v_uid;

  RETURN QUERY SELECT true, 'OK', v_next, v_prev;
END;
$$;

COMMENT ON FUNCTION public.adjust_held_referral_balance_thb(text, numeric) IS
  'Atomic held_referral_balance_thb += delta (floored at 0). service_role / SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.adjust_held_referral_balance_thb(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_held_referral_balance_thb(text, numeric) TO service_role;
