-- Stage 202.02 — Atomic partner host payout claim (AUDIT_03 C3.5).
-- Does NOT debit profiles.available_balance_thb (sync cache only).
-- Serializes requests per partner; re-checks open PENDING/PROCESSING reserve vs gross available.

CREATE OR REPLACE FUNCTION public.insert_partner_host_payout_if_available(
  p_partner_id text,
  p_gross_available_thb numeric,
  p_request_gross_thb numeric,
  p_row jsonb
)
RETURNS TABLE (
  claimed boolean,
  reason text,
  available_thb numeric,
  payout_id text,
  payout jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner text;
  v_gross numeric(14, 2);
  v_request numeric(14, 2);
  v_reserve numeric(14, 2);
  v_available numeric(14, 2);
  v_id text;
  v_row jsonb;
  v_lock_key bigint;
BEGIN
  v_partner := trim(coalesce(p_partner_id, ''));
  v_gross := round(coalesce(p_gross_available_thb, 0)::numeric, 2);
  v_request := round(coalesce(p_request_gross_thb, 0)::numeric, 2);
  v_row := coalesce(p_row, '{}'::jsonb);

  IF v_partner = '' THEN
    RETURN QUERY SELECT false, 'PARTNER_ID_REQUIRED', 0::numeric, NULL::text, NULL::jsonb;
    RETURN;
  END IF;

  IF v_request <= 0 THEN
    RETURN QUERY SELECT false, 'INVALID_AMOUNT', 0::numeric, NULL::text, NULL::jsonb;
    RETURN;
  END IF;

  v_lock_key := ('x' || substr(md5('partner_host_payout:' || v_partner), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT coalesce(sum(
           coalesce(nullif(p.gross_amount, 0), nullif(p.final_amount, 0), nullif(p.amount, 0), 0)
         ), 0)::numeric
    INTO v_reserve
    FROM public.payouts p
   WHERE p.partner_id = v_partner
     AND upper(p.status::text) IN ('PENDING', 'PROCESSING')
     AND coalesce(upper(p.payout_rail), '') <> 'REFERRAL_RUB_CARD'
     AND coalesce(lower(p.metadata->>'payout_type'), '') <> 'referral_withdrawal';

  v_available := greatest(0::numeric, round((v_gross - v_reserve)::numeric, 2));

  IF v_request > v_available THEN
    RETURN QUERY SELECT false, 'INSUFFICIENT_BALANCE', v_available, NULL::text, NULL::jsonb;
    RETURN;
  END IF;

  INSERT INTO public.payouts (
    partner_id,
    amount,
    currency,
    status,
    wallet_address,
    bank_account,
    payout_method_id,
    payout_profile_id,
    gross_amount,
    payout_fee_amount,
    final_amount,
    payout_currency,
    amount_in_payout_currency,
    metadata
  ) VALUES (
    v_partner,
    round(coalesce((v_row->>'amount')::numeric, v_request), 2),
    coalesce(nullif(v_row->>'currency', ''), 'THB')::public.currency_type,
    'PENDING'::public.payout_status,
    nullif(v_row->>'wallet_address', ''),
    nullif(v_row->>'bank_account', ''),
    nullif(v_row->>'payout_method_id', ''),
    nullif(v_row->>'payout_profile_id', ''),
    round(coalesce((v_row->>'gross_amount')::numeric, v_request), 2),
    round(coalesce((v_row->>'payout_fee_amount')::numeric, 0), 2),
    round(coalesce((v_row->>'final_amount')::numeric, v_request), 2),
    nullif(v_row->>'payout_currency', ''),
    CASE
      WHEN v_row ? 'amount_in_payout_currency'
        THEN round((v_row->>'amount_in_payout_currency')::numeric, 2)
      ELSE NULL
    END,
    coalesce(v_row->'metadata', '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN QUERY
  SELECT true,
         'OK',
         v_available - v_request,
         v_id,
         to_jsonb(p.*)
  FROM public.payouts p
  WHERE p.id = v_id;
END;
$$;

COMMENT ON FUNCTION public.insert_partner_host_payout_if_available(text, numeric, numeric, jsonb) IS
  'AUDIT_03 C3.5: advisory-lock partner host payout insert; reserve check vs gross available. service_role only.';

REVOKE ALL ON FUNCTION public.insert_partner_host_payout_if_available(text, numeric, numeric, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.insert_partner_host_payout_if_available(text, numeric, numeric, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_partner_host_payout_if_available(text, numeric, numeric, jsonb) TO service_role;
