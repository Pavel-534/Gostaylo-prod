-- Stage 84.0
-- Atomic contract: payment confirmed -> PAID_ESCROW -> ledger journal/entries in one DB transaction.

CREATE OR REPLACE FUNCTION public.move_to_escrow_and_post_ledger_v1(
  p_booking_id text,
  p_tx_id text DEFAULT NULL,
  p_gateway_ref text DEFAULT NULL,
  p_source text DEFAULT 'payment_confirm',
  p_capture_guest_total_thb numeric DEFAULT NULL,
  p_commission_thb numeric DEFAULT 0,
  p_partner_earnings_thb numeric DEFAULT 0,
  p_commission_rate_applied numeric DEFAULT 0,
  p_listing_category_slug text DEFAULT NULL,
  p_escrow_thaw_at timestamptz DEFAULT NULL,
  p_payment_verification jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  success boolean,
  already_escrowed boolean,
  booking_id text,
  journal_id text,
  error_code text
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_now timestamptz := now();
  v_partner_account_id text;
  v_journal_id text;
  v_idempotency_key text;
  v_guest_total numeric(14,2);
  v_partner numeric(14,2);
  v_platform numeric(14,2);
  v_insurance numeric(14,2) := 0;
  v_rounding numeric(14,2) := 0;
  v_debit_sum numeric(14,2);
  v_credit_sum numeric(14,2);
BEGIN
  IF p_booking_id IS NULL OR trim(p_booking_id) = '' THEN
    RETURN QUERY SELECT false, false, NULL::text, NULL::text, 'booking_required';
    RETURN;
  END IF;

  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, p_booking_id, NULL::text, 'booking_not_found';
    RETURN;
  END IF;

  IF v_booking.status = 'PAID_ESCROW' THEN
    v_idempotency_key := 'booking_payment_capture:' || p_booking_id;
    SELECT id INTO v_journal_id
    FROM public.ledger_journals
    WHERE idempotency_key = v_idempotency_key
    LIMIT 1;
    RETURN QUERY SELECT true, true, p_booking_id, v_journal_id, NULL::text;
    RETURN;
  END IF;

  IF v_booking.status NOT IN ('PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'PAID') THEN
    RETURN QUERY SELECT false, false, p_booking_id, NULL::text, 'invalid_status_transition';
    RETURN;
  END IF;

  v_guest_total := round(GREATEST(coalesce(p_capture_guest_total_thb, 0), 0)::numeric, 2);
  IF v_guest_total <= 0 THEN
    v_guest_total := round(GREATEST(coalesce(v_booking.price_thb, 0), 0)::numeric, 2);
  END IF;
  v_partner := round(GREATEST(coalesce(p_partner_earnings_thb, 0), 0)::numeric, 2);
  v_rounding := round(GREATEST(coalesce(v_booking.rounding_diff_pot, 0), 0)::numeric, 2);
  v_platform := round(
    GREATEST(v_guest_total - v_partner - v_rounding - v_insurance, 0)::numeric,
    2
  );

  UPDATE public.bookings
  SET
    status = 'PAID_ESCROW',
    commission_thb = round(GREATEST(coalesce(p_commission_thb, 0), 0)::numeric, 2),
    partner_earnings_thb = v_partner,
    escrow_thaw_at = COALESCE(p_escrow_thaw_at, v_booking.escrow_thaw_at),
    metadata = COALESCE(v_booking.metadata, '{}'::jsonb) || jsonb_build_object(
      'escrow_started', v_now,
      'listing_category_slug', NULLIF(trim(COALESCE(p_listing_category_slug, '')), ''),
      'commission_rate_applied', coalesce(p_commission_rate_applied, 0),
      'payment_verification',
        COALESCE(
          COALESCE(v_booking.metadata, '{}'::jsonb)->'payment_verification',
          '{}'::jsonb
        ) || COALESCE(p_payment_verification, '{}'::jsonb) || jsonb_build_object(
          'txId', p_tx_id,
          'gatewayRef', p_gateway_ref,
          'source', p_source,
          'captureGuestTotalThb', v_guest_total
        )
    )
  WHERE id = p_booking_id;

  v_partner_account_id := 'la-partner-' || coalesce(v_booking.partner_id, '');
  INSERT INTO public.ledger_accounts (id, code, partner_id, display_name, account_type)
  VALUES (
    v_partner_account_id,
    'PARTNER_EARNINGS',
    v_booking.partner_id,
    'Partner earnings (payable)',
    'PARTNER'
  )
  ON CONFLICT (id) DO NOTHING;

  v_idempotency_key := 'booking_payment_capture:' || p_booking_id;
  SELECT id INTO v_journal_id
  FROM public.ledger_journals
  WHERE idempotency_key = v_idempotency_key
  LIMIT 1;

  IF v_journal_id IS NULL THEN
    v_journal_id := 'lj-cap-' || p_booking_id;
    INSERT INTO public.ledger_journals (
      id, booking_id, event_type, idempotency_key, metadata, created_at
    ) VALUES (
      v_journal_id,
      p_booking_id,
      'BOOKING_PAYMENT_CAPTURED',
      v_idempotency_key,
      jsonb_build_object(
        'status_at_post', 'PAID_ESCROW',
        'source', p_source,
        'txId', p_tx_id,
        'gatewayRef', p_gateway_ref
      ),
      v_now
    );

    INSERT INTO public.ledger_entries (id, journal_id, account_id, side, amount_thb, description, metadata)
    VALUES
      ('le-' || v_journal_id || '-dr-guest', v_journal_id, 'la-sys-guest-clearing', 'DEBIT', v_guest_total, 'Guest funds received (clearing)', jsonb_build_object('booking_id', p_booking_id)),
      ('le-' || v_journal_id || '-cr-partner', v_journal_id, v_partner_account_id, 'CREDIT', v_partner, 'Partner earnings', jsonb_build_object('booking_id', p_booking_id, 'partner_id', v_booking.partner_id)),
      ('le-' || v_journal_id || '-cr-platform', v_journal_id, 'la-sys-platform-fee', 'CREDIT', v_platform, 'Platform margin (net of insurance)', jsonb_build_object('booking_id', p_booking_id)),
      ('le-' || v_journal_id || '-cr-insurance', v_journal_id, 'la-sys-insurance', 'CREDIT', v_insurance, 'Insurance fund reserve', jsonb_build_object('booking_id', p_booking_id)),
      ('le-' || v_journal_id || '-cr-pot', v_journal_id, 'la-sys-processing-pot', 'CREDIT', v_rounding, 'Rounding / processing pot', jsonb_build_object('booking_id', p_booking_id));
  END IF;

  SELECT COALESCE(sum(amount_thb), 0)::numeric(14,2)
  INTO v_debit_sum
  FROM public.ledger_entries
  WHERE journal_id = v_journal_id
    AND side = 'DEBIT';

  SELECT COALESCE(sum(amount_thb), 0)::numeric(14,2)
  INTO v_credit_sum
  FROM public.ledger_entries
  WHERE journal_id = v_journal_id
    AND side = 'CREDIT';

  IF abs(v_debit_sum - v_credit_sum) > 0.02 THEN
    RAISE EXCEPTION 'ledger_unbalanced: % (dr=%, cr=%)', v_journal_id, v_debit_sum, v_credit_sum;
  END IF;

  RETURN QUERY SELECT true, false, p_booking_id, v_journal_id, NULL::text;
END;
$$;
