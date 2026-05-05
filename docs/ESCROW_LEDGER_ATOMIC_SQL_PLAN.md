# Escrow + Ledger Atomic SQL Plan (Phase 1)

## Goal

Eliminate split-brain states where booking is already `PAID_ESCROW` but ledger capture failed or was delayed.

## Current Gap

- `EscrowService.moveToEscrow()` updates `bookings`.
- `schedulePostPaymentLedgerCapture()` posts ledger asynchronously.
- If process crashes between these steps, financial truth diverges.

## Proposed DB-Level SSOT

Introduce a single Postgres function:

- `public.move_to_escrow_and_post_ledger_v1(...)`
- Called by server route/service once per payment confirmation.
- Performs booking transition + ledger journal/entries in one SQL transaction.

## Draft SQL Skeleton

```sql
-- Draft only. Not applied.
create or replace function public.move_to_escrow_and_post_ledger_v1(
  p_booking_id text,
  p_payment_verification jsonb,
  p_capture_guest_total_thb numeric,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_booking record;
  v_partner_account_id text;
  v_journal_id text;
  v_now timestamptz := now();
  v_exists_journal text;
  v_guest_total numeric;
  v_partner numeric;
  v_platform numeric;
  v_insurance numeric;
  v_rounding numeric;
begin
  -- 1) Lock booking row to avoid concurrent confirms
  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found';
  end if;

  -- 2) Idempotency short-circuit by journal key
  select id
  into v_exists_journal
  from public.ledger_journals
  where idempotency_key = p_idempotency_key
  limit 1;

  if v_exists_journal is not null then
    return jsonb_build_object(
      'success', true,
      'alreadyProcessed', true,
      'journalId', v_exists_journal,
      'bookingId', p_booking_id
    );
  end if;

  -- 3) Validate status transition eligibility
  if v_booking.status not in ('PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'PAID') then
    raise exception 'invalid_booking_status_transition: %', v_booking.status;
  end if;

  -- 4) Compute split legs (from pricing snapshot / booking columns)
  -- NOTE: final formulas to be mirrored from LedgerService.computeBookingPaymentLedgerLegs.
  -- v_guest_total := ...
  -- v_partner := ...
  -- v_platform := ...
  -- v_insurance := ...
  -- v_rounding := ...

  -- 5) Transition booking to PAID_ESCROW
  update public.bookings
  set
    status = 'PAID_ESCROW',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'escrow_started', v_now,
      'payment_verification', coalesce(p_payment_verification, '{}'::jsonb)
    ),
    updated_at = v_now
  where id = p_booking_id;

  -- 6) Ensure partner ledger account exists (or use helper SQL function)
  v_partner_account_id := 'la-partner-' || coalesce(v_booking.partner_id, '');
  -- insert account on missing with on conflict do nothing

  -- 7) Insert ledger journal
  v_journal_id := 'lj-cap-' || p_booking_id;
  insert into public.ledger_journals(
    id, booking_id, event_type, idempotency_key, metadata, created_at
  ) values (
    v_journal_id,
    p_booking_id,
    'BOOKING_PAYMENT_CAPTURED',
    p_idempotency_key,
    jsonb_build_object('captureGuestTotalThb', p_capture_guest_total_thb),
    v_now
  );

  -- 8) Insert balanced ledger entries
  insert into public.ledger_entries(id, journal_id, account_id, side, amount_thb, description, metadata) values
    ('le-' || v_journal_id || '-dr-guest', v_journal_id, 'la-sys-guest-clearing', 'DEBIT',  v_guest_total, 'Guest funds received', jsonb_build_object('booking_id', p_booking_id)),
    ('le-' || v_journal_id || '-cr-partner', v_journal_id, v_partner_account_id,    'CREDIT', v_partner,    'Partner earnings',      jsonb_build_object('booking_id', p_booking_id)),
    ('le-' || v_journal_id || '-cr-platform',v_journal_id, 'la-sys-platform-fee',   'CREDIT', v_platform,   'Platform fee',          jsonb_build_object('booking_id', p_booking_id)),
    ('le-' || v_journal_id || '-cr-ins',     v_journal_id, 'la-sys-insurance',      'CREDIT', v_insurance,  'Insurance reserve',     jsonb_build_object('booking_id', p_booking_id)),
    ('le-' || v_journal_id || '-cr-pot',     v_journal_id, 'la-sys-processing-pot', 'CREDIT', v_rounding,   'Rounding pot',          jsonb_build_object('booking_id', p_booking_id));

  -- 9) Defensive balancing check before commit
  if abs(
    (select coalesce(sum(case when side='DEBIT' then amount_thb else 0 end),0) from public.ledger_entries where journal_id=v_journal_id)
    -
    (select coalesce(sum(case when side='CREDIT' then amount_thb else 0 end),0) from public.ledger_entries where journal_id=v_journal_id)
  ) > 0.02 then
    raise exception 'unbalanced_journal: %', v_journal_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'bookingId', p_booking_id,
    'journalId', v_journal_id
  );
end;
$$;
```

## Integration Steps (No code change yet)

1. Add migration with function + grants (service role only).
2. Add server wrapper method in escrow service to call this RPC.
3. Behind feature flag (`system_settings.general.escrowAtomicLedgerV1`):
   - on: RPC path
   - off: current async path
4. Run dual reconciliation report for 1-2 weeks.
5. Remove async ledger capture scheduler after stable cutover.
