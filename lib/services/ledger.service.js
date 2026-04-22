/**
 * Double-entry ledger (THB) for booking payment capture.
 * Trigger: EscrowService.moveToEscrow → PAID_ESCROW (guest funds recognized).
 */

import { supabaseAdmin } from '@/lib/supabase';
import { notifyLedgerGuestPaymentClearingPosted } from '@/lib/services/ledger-telegram-notify';

const ACC = {
  guestClearing: 'la-sys-guest-clearing',
  platformFee: 'la-sys-platform-fee',
  insurance: 'la-sys-insurance',
  processingPot: 'la-sys-processing-pot',
  partnerPayoutsSettled: 'la-sys-partner-payouts-settled',
};

function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function partnerAccountId(partnerId) {
  return `la-partner-${partnerId}`;
}

/**
 * @param {object} booking — row from `bookings` (+ optional pricing_snapshot)
 * @returns {{ guestTotalThb: number, partnerThb: number, platformFeeThb: number, insuranceThb: number, roundingThb: number }}
 */
export function computeBookingPaymentLedgerLegs(booking) {
  const snap = booking?.pricing_snapshot && typeof booking.pricing_snapshot === 'object' ? booking.pricing_snapshot : {};
  const fs = snap.fee_split_v2 && typeof snap.fee_split_v2 === 'object' ? snap.fee_split_v2 : {};

  const roundingThb = round2(
    fs.rounding_diff_pot_thb ?? booking?.rounding_diff_pot ?? 0,
  );
  const partnerThb = round2(booking?.partner_earnings_thb ?? 0);

  const guestSvc = round2(fs.guest_service_fee_thb ?? booking?.commission_thb ?? 0);
  const gross = round2(booking?.price_thb ?? 0);
  const hostComm = round2(
    fs.host_commission_thb ??
      Math.round(gross * ((Number(booking?.commission_rate) || 0) / 100) * 100) / 100,
  );
  const platformGross = round2(
    fs.platform_gross_revenue_thb ?? guestSvc + hostComm,
  );
  let insuranceThb = round2(fs.insurance_reserve_thb ?? 0);
  if (!Number.isFinite(insuranceThb) || insuranceThb < 0) {
    const st = snap.settlement_v3?.insurance_reserve_amount;
    insuranceThb = round2(st?.thb ?? 0);
  }

  let guestTotalThb = round2(fs.guest_payable_rounded_thb ?? 0);
  if (!guestTotalThb) {
    const ex = Number(booking?.exchange_rate);
    const pp = Number(booking?.price_paid);
    if (Number.isFinite(ex) && ex > 0 && Number.isFinite(pp) && pp > 0) {
      guestTotalThb = round2(pp * ex);
    } else {
      guestTotalThb = round2(gross + guestSvc + roundingThb);
    }
  }

  let platformFeeThb = round2(platformGross - insuranceThb);
  if (!Number.isFinite(platformFeeThb)) platformFeeThb = 0;

  let sumCr = round2(partnerThb + platformFeeThb + insuranceThb + roundingThb);
  const drift = round2(guestTotalThb - sumCr);
  if (Math.abs(drift) > 0.02) {
    platformFeeThb = round2(platformFeeThb + drift);
    sumCr = round2(partnerThb + platformFeeThb + insuranceThb + roundingThb);
  }

  return {
    guestTotalThb,
    partnerThb,
    platformFeeThb: Math.max(0, platformFeeThb),
    insuranceThb: Math.max(0, insuranceThb),
    roundingThb: Math.max(0, roundingThb),
  };
}

/**
 * Scale credit legs proportionally so guest clearing DEBIT matches an actual capture (e.g. invoice / intent).
 * Drift is absorbed into platform fee leg.
 * @param {object} legs — result of computeBookingPaymentLedgerLegs
 * @param {number} targetGuestTotalThb
 */
export function scaleLedgerLegsToGuestTotal(legs, targetGuestTotalThb) {
  const target = round2(targetGuestTotalThb);
  const baseGuest = round2(legs.guestTotalThb);
  if (!Number.isFinite(target) || target <= 0) return legs;
  if (baseGuest <= 0) return { ...legs, guestTotalThb: target };
  if (Math.abs(target - baseGuest) <= 0.02) return legs;

  const scale = target / baseGuest;
  let partnerThb = round2(legs.partnerThb * scale);
  let platformFeeThb = round2(legs.platformFeeThb * scale);
  let insuranceThb = round2(legs.insuranceThb * scale);
  let roundingThb = round2(legs.roundingThb * scale);
  const sumCr = round2(partnerThb + platformFeeThb + insuranceThb + roundingThb);
  const drift = round2(target - sumCr);
  platformFeeThb = round2(platformFeeThb + drift);
  platformFeeThb = Math.max(0, platformFeeThb);

  return {
    guestTotalThb: target,
    partnerThb: Math.max(0, partnerThb),
    platformFeeThb,
    insuranceThb: Math.max(0, insuranceThb),
    roundingThb: Math.max(0, roundingThb),
  };
}

export class LedgerService {
  static partnerAccountId(partnerId) {
    return partnerAccountId(partnerId);
  }

  static async ensurePartnerLedgerAccount(partnerId) {
    if (!partnerId) return null;
    const id = partnerAccountId(partnerId);
    const { data: row } = await supabaseAdmin.from('ledger_accounts').select('id').eq('id', id).maybeSingle();
    if (row?.id) return id;

    const { error } = await supabaseAdmin.from('ledger_accounts').insert({
      id,
      code: 'PARTNER_EARNINGS',
      partner_id: partnerId,
      display_name: 'Partner earnings (payable)',
      account_type: 'PARTNER',
    });
    if (error && !String(error.message || '').includes('duplicate')) {
      console.error('[LedgerService] ensurePartnerLedgerAccount', error.message);
      throw error;
    }
    return id;
  }

  /**
   * Post payment-capture journal (idempotent per booking).
   * @param {object} booking — full booking row after escrow update
   */
  static async postPaymentCaptureFromBooking(booking) {
    const bookingId = booking?.id;
    if (!bookingId) return { success: false, error: 'missing_booking_id' };

    const idempotencyKey = `booking_payment_capture:${bookingId}`;
    const { data: existing } = await supabaseAdmin
      .from('ledger_journals')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing?.id) {
      return { success: true, skipped: true, journalId: existing.id };
    }

    const legs0 = computeBookingPaymentLedgerLegs(booking);
    const capRaw = booking?.metadata?.payment_verification?.captureGuestTotalThb;
    const cap = Number(capRaw);
    const legs =
      Number.isFinite(cap) && cap > 0 && Math.abs(cap - legs0.guestTotalThb) > 0.02
        ? scaleLedgerLegsToGuestTotal(legs0, cap)
        : legs0;
    if (legs.guestTotalThb <= 0) {
      return { success: false, error: 'non_positive_guest_total', legs };
    }

    const partnerId = booking.partner_id;
    const partnerAccount = await this.ensurePartnerLedgerAccount(partnerId);
    if (!partnerAccount) {
      return { success: false, error: 'missing_partner_id' };
    }

    const journalId = `lj-cap-${bookingId}`;
    const now = new Date().toISOString();

    const { error: jErr } = await supabaseAdmin.from('ledger_journals').insert({
      id: journalId,
      booking_id: bookingId,
      event_type: 'BOOKING_PAYMENT_CAPTURED',
      idempotency_key: idempotencyKey,
      metadata: { legs, status_at_post: booking.status },
      created_at: now,
    });
    if (jErr) {
      if (String(jErr.message || '').includes('duplicate') || jErr.code === '23505') {
        return { success: true, skipped: true };
      }
      console.error('[LedgerService] journal insert', jErr.message);
      return { success: false, error: jErr.message };
    }

    const lines = [
      {
        id: `le-${journalId}-dr-guest`,
        journal_id: journalId,
        account_id: ACC.guestClearing,
        side: 'DEBIT',
        amount_thb: legs.guestTotalThb,
        description: 'Guest funds received (clearing)',
        metadata: { booking_id: bookingId },
      },
      {
        id: `le-${journalId}-cr-partner`,
        journal_id: journalId,
        account_id: partnerAccount,
        side: 'CREDIT',
        amount_thb: legs.partnerThb,
        description: 'Partner earnings',
        metadata: { booking_id: bookingId, partner_id: partnerId },
      },
      {
        id: `le-${journalId}-cr-platform`,
        journal_id: journalId,
        account_id: ACC.platformFee,
        side: 'CREDIT',
        amount_thb: legs.platformFeeThb,
        description: 'Platform margin (net of insurance)',
        metadata: { booking_id: bookingId },
      },
      {
        id: `le-${journalId}-cr-insurance`,
        journal_id: journalId,
        account_id: ACC.insurance,
        side: 'CREDIT',
        amount_thb: legs.insuranceThb,
        description: 'Insurance fund reserve',
        metadata: { booking_id: bookingId },
      },
      {
        id: `le-${journalId}-cr-pot`,
        journal_id: journalId,
        account_id: ACC.processingPot,
        side: 'CREDIT',
        amount_thb: legs.roundingThb,
        description: 'Rounding / processing pot',
        metadata: { booking_id: bookingId },
      },
    ];

    const { error: eErr } = await supabaseAdmin.from('ledger_entries').insert(lines);
    if (eErr) {
      console.error('[LedgerService] entries insert', eErr.message);
      await supabaseAdmin.from('ledger_journals').delete().eq('id', journalId);
      return { success: false, error: eErr.message };
    }

    const guestLine = lines.find(
      (l) => l.account_id === ACC.guestClearing && l.side === 'DEBIT',
    );
    if (guestLine) {
      let feeClearingPotThb = null;
      try {
        const potBal = await this.sumNetBalancesByAccountIds([ACC.processingPot]);
        feeClearingPotThb = round2(potBal[ACC.processingPot] ?? 0);
      } catch (e) {
        console.warn('[LedgerService] pot balance for telegram:', e?.message || e);
      }
      notifyLedgerGuestPaymentClearingPosted({
        bookingId,
        guestTotalThb: legs.guestTotalThb,
        journalId,
        feeClearingPotThb,
      });
    }

    return { success: true, journalId, legs };
  }

  /**
   * Final posting when a payout is marked PAID: reduce PARTNER_EARNINGS (liability) vs settlement bucket.
   * Amount THB = gross_amount (withdrawal base before rail fee), same convention as EscrowService.requestPayout.
   * Idempotent per payout id.
   * @param {{ id: string, partner_id?: string, partnerId?: string, gross_amount?: number|string, grossAmount?: number|string, amount?: number|string }} payout
   */
  static async postPartnerPayoutObligationSettled(payout) {
    const payoutId = payout?.id;
    const partnerId = payout?.partner_id ?? payout?.partnerId;
    if (!payoutId || !partnerId) {
      return { success: false, error: 'missing_payout_or_partner' };
    }

    const gross =
      parseFloat(payout?.gross_amount ?? payout?.grossAmount) ||
      parseFloat(payout?.amount) ||
      0;
    const amountThb = round2(gross);
    if (amountThb <= 0) {
      return { success: false, error: 'non_positive_amount_thb', amountThb };
    }

    const idempotencyKey = `payout_obligation_settled:${payoutId}`;
    const { data: existing } = await supabaseAdmin
      .from('ledger_journals')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing?.id) {
      return { success: true, skipped: true, journalId: existing.id };
    }

    const partnerAccount = await this.ensurePartnerLedgerAccount(partnerId);
    if (!partnerAccount) {
      return { success: false, error: 'missing_partner_account' };
    }

    const journalId = `lj-payout-settled-${payoutId}`;
    const now = new Date().toISOString();

    const { error: jErr } = await supabaseAdmin.from('ledger_journals').insert({
      id: journalId,
      booking_id: null,
      event_type: 'PARTNER_PAYOUT_OBLIGATION_SETTLED',
      idempotency_key: idempotencyKey,
      metadata: {
        payout_id: payoutId,
        partner_id: partnerId,
        amount_thb: amountThb,
        description: 'Partner liability settled (paid out)',
      },
      created_at: now,
    });
    if (jErr) {
      if (String(jErr.message || '').includes('duplicate') || jErr.code === '23505') {
        return { success: true, skipped: true };
      }
      if (String(jErr.message || '').includes('null value') && String(jErr.message || '').includes('booking_id')) {
        return {
          success: false,
          error:
            'ledger_journals.booking_id is still NOT NULL — apply migration database/migrations/032_ledger_payout_settlement.sql',
        };
      }
      console.error('[LedgerService] payout journal insert', jErr.message);
      return { success: false, error: jErr.message };
    }

    const lines = [
      {
        id: `le-${journalId}-dr-partner`,
        journal_id: journalId,
        account_id: partnerAccount,
        side: 'DEBIT',
        amount_thb: amountThb,
        description: 'Partner earnings — payout settled',
        metadata: { payout_id: payoutId, partner_id: partnerId },
      },
      {
        id: `le-${journalId}-cr-settled`,
        journal_id: journalId,
        account_id: ACC.partnerPayoutsSettled,
        side: 'CREDIT',
        amount_thb: amountThb,
        description: 'Partner payouts settled (bank / manual)',
        metadata: { payout_id: payoutId, partner_id: partnerId },
      },
    ];

    const { error: eErr } = await supabaseAdmin.from('ledger_entries').insert(lines);
    if (eErr) {
      console.error('[LedgerService] payout entries insert', eErr.message);
      await supabaseAdmin.from('ledger_journals').delete().eq('id', journalId);
      return { success: false, error: eErr.message };
    }

    return { success: true, journalId, amountThb };
  }

  /**
   * PR-#4: Partial refund to guest — unwind capture split proportionally (THB).
   * CREDIT guest clearing; DEBIT partner / platform / insurance / rounding pot.
   * Idempotent per booking: `booking_refund_partial:{bookingId}`.
   *
   * @param {object} booking — row with id, partner_id, pricing_snapshot, commission_thb, …
   * @param {{ refundGuestThb: number, reason?: string }} options
   */
  static async postPartialRefundForBooking(booking, options = {}) {
    const bookingId = booking?.id;
    const refundGuestThb = round2(parseFloat(options.refundGuestThb));
    if (!bookingId || !(refundGuestThb > 0)) {
      return { success: false, error: 'invalid_refund_or_booking' };
    }

    const legs0 = computeBookingPaymentLedgerLegs(booking);
    const cap = round2(legs0.guestTotalThb);
    if (cap <= 0) {
      return { success: false, error: 'non_positive_capture' };
    }
    const r = Math.min(refundGuestThb, cap);

    const idempotencyKey = `booking_refund_partial:${bookingId}`;
    const { data: existing } = await supabaseAdmin
      .from('ledger_journals')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing?.id) {
      return { success: true, skipped: true, journalId: existing.id };
    }

    const partnerId = booking.partner_id;
    const partnerAccount = await this.ensurePartnerLedgerAccount(partnerId);
    if (!partnerAccount) {
      return { success: false, error: 'missing_partner' };
    }

    const ratio = r / cap;
    let partnerDr = round2(legs0.partnerThb * ratio);
    let platformDr = round2(legs0.platformFeeThb * ratio);
    let insDr = round2(legs0.insuranceThb * ratio);
    let potDr = round2(legs0.roundingThb * ratio);
    const sum = round2(partnerDr + platformDr + insDr + potDr);
    const drift = round2(r - sum);
    potDr = round2(potDr + drift);

    const journalId = `lj-refund-${bookingId}`.slice(0, 120);
    const now = new Date().toISOString();

    const { error: jErr } = await supabaseAdmin.from('ledger_journals').insert({
      id: journalId,
      booking_id: bookingId,
      event_type: 'BOOKING_REFUND_PARTIAL',
      idempotency_key: idempotencyKey,
      metadata: {
        refund_guest_thb: r,
        reason: options.reason || null,
        legs: { partnerDr, platformDr, insuranceDr: insDr, potDr },
      },
      created_at: now,
    });
    if (jErr) {
      if (String(jErr.message || '').includes('duplicate') || jErr.code === '23505') {
        return { success: true, skipped: true };
      }
      console.error('[LedgerService] refund journal insert', jErr.message);
      return { success: false, error: jErr.message };
    }

    const lines = [
      {
        id: `le-${journalId}-cr-guest`,
        journal_id: journalId,
        account_id: ACC.guestClearing,
        side: 'CREDIT',
        amount_thb: r,
        description: 'Partial refund to guest (clearing)',
        metadata: { booking_id: bookingId },
      },
      {
        id: `le-${journalId}-dr-partner`,
        journal_id: journalId,
        account_id: partnerAccount,
        side: 'DEBIT',
        amount_thb: partnerDr,
        description: 'Partial refund — partner share reversal',
        metadata: { booking_id: bookingId, partner_id: partnerId },
      },
      {
        id: `le-${journalId}-dr-platform`,
        journal_id: journalId,
        account_id: ACC.platformFee,
        side: 'DEBIT',
        amount_thb: platformDr,
        description: 'Partial refund — platform share reversal',
        metadata: { booking_id: bookingId },
      },
      {
        id: `le-${journalId}-dr-ins`,
        journal_id: journalId,
        account_id: ACC.insurance,
        side: 'DEBIT',
        amount_thb: insDr,
        description: 'Partial refund — insurance reserve reversal',
        metadata: { booking_id: bookingId },
      },
      {
        id: `le-${journalId}-dr-pot`,
        journal_id: journalId,
        account_id: ACC.processingPot,
        side: 'DEBIT',
        amount_thb: potDr,
        description: 'Partial refund — rounding pot reversal',
        metadata: { booking_id: bookingId },
      },
    ];

    const { error: eErr } = await supabaseAdmin.from('ledger_entries').insert(lines);
    if (eErr) {
      console.error('[LedgerService] refund entries insert', eErr.message);
      await supabaseAdmin.from('ledger_journals').delete().eq('id', journalId);
      return { success: false, error: eErr.message };
    }

    return { success: true, journalId, refundGuestThb: r };
  }

  /**
   * Net THB position per account: sum(CREDIT) - sum(DEBIT).
   * @param {string[]} accountIds
   */
  static async sumNetBalancesByAccountIds(accountIds) {
    const ids = (accountIds || []).filter(Boolean);
    if (!ids.length) return {};

    const { data: rows, error } = await supabaseAdmin
      .from('ledger_entries')
      .select('account_id, side, amount_thb')
      .in('account_id', ids);
    if (error) throw new Error(error.message);

    const out = {};
    for (const id of ids) out[id] = 0;
    for (const r of rows || []) {
      const amt = round2(r.amount_thb);
      const d = out[r.account_id] ?? 0;
      out[r.account_id] = r.side === 'CREDIT' ? round2(d + amt) : round2(d - amt);
    }
    return out;
  }

  /**
   * MVP сверка «Cash» = счёт **GUEST_PAYMENT_CLEARING** (вход гостевых средств).
   * Ожидаемое: в каждом журнале **захвата оплаты по брони** сумма DEBIT по clearing = сумма CREDIT
   * по прочим счетам того же журнала. Журналы без clearing DEBIT (напр. **PARTNER_PAYOUT_OBLIGATION_SETTLED**)
   * не участвуют в паре clearing↔distribution — иначе CREDIT на **PARTNER_PAYOUTS_SETTLED** давал бы ложный Margin Leakage.
   * Внутри журналов захвата CREDIT на **`PARTNER_PAYOUTS_SETTLED`** в «распределение» не входят (defense in depth).
   */
  static async runReconciliationMvp() {
    const { data: entries, error } = await supabaseAdmin
      .from('ledger_entries')
      .select('journal_id, account_id, side, amount_thb');
    if (error) throw new Error(error.message);

    const accountIds = [...new Set((entries || []).map((e) => e.account_id).filter(Boolean))];
    const { data: accounts, error: aErr } = await supabaseAdmin
      .from('ledger_accounts')
      .select('id, code')
      .in('id', accountIds);
    if (aErr) throw new Error(aErr.message);
    const codeById = new Map((accounts || []).map((a) => [a.id, a.code]));

    /** @type {Map<string, Array<{ journal_id: string, account_id: string, side: string, amount_thb: number }>>} */
    const rowsByJournal = new Map();
    for (const e of entries || []) {
      const jid = e.journal_id;
      if (!jid) continue;
      if (!rowsByJournal.has(jid)) rowsByJournal.set(jid, []);
      rowsByJournal.get(jid).push(e);
    }

    let guestClearingDebitsThb = 0;
    let distributionCreditsThb = 0;

    const byJournal = new Map();
    for (const e of entries || []) {
      const amt = round2(e.amount_thb);
      if (!byJournal.has(e.journal_id)) byJournal.set(e.journal_id, { dr: 0, cr: 0 });
      const j = byJournal.get(e.journal_id);
      if (e.side === 'DEBIT') j.dr += amt;
      else j.cr += amt;
    }

    for (const [, rows] of rowsByJournal) {
      let guestDrThisJournal = 0;
      for (const e of rows) {
        const amt = round2(e.amount_thb);
        const code = codeById.get(e.account_id) || '';
        if (code === 'GUEST_PAYMENT_CLEARING' && e.side === 'DEBIT') {
          guestDrThisJournal += amt;
        }
      }
      if (guestDrThisJournal <= 0.02) continue;

      guestClearingDebitsThb += guestDrThisJournal;
      for (const e of rows) {
        const amt = round2(e.amount_thb);
        const code = codeById.get(e.account_id) || '';
        if (
          e.side === 'CREDIT' &&
          code !== 'GUEST_PAYMENT_CLEARING' &&
          code !== 'PARTNER_PAYOUTS_SETTLED'
        ) {
          distributionCreditsThb += amt;
        }
      }
    }

    let unbalancedJournals = 0;
    for (const v of byJournal.values()) {
      if (Math.abs(round2(v.dr - v.cr)) > 0.02) unbalancedJournals += 1;
    }

    const deltaThb = round2(guestClearingDebitsThb - distributionCreditsThb);
    const marginLeakage = Math.abs(deltaThb) > 0.02 || unbalancedJournals > 0;

    /** Smoke: сумма gross открытых заявок (PENDING+PROCESSING) vs нетто PARTNER_EARNINGS в ledger (не всегда равны в жизни; совпадение — сильный инвариант). */
    let payoutSelfCheck = null;
    try {
      const { data: openRows, error: openErr } = await supabaseAdmin
        .from('payouts')
        .select('gross_amount, amount')
        .in('status', ['PENDING', 'PROCESSING']);
      if (!openErr) {
        let openGrossSum = 0;
        for (const r of openRows || []) {
          const g = parseFloat(r.gross_amount) || parseFloat(r.amount) || 0;
          openGrossSum += round2(g);
        }
        openGrossSum = round2(openGrossSum);

        const { data: partnerAccounts, error: paErr } = await supabaseAdmin
          .from('ledger_accounts')
          .select('id')
          .eq('code', 'PARTNER_EARNINGS');
        if (!paErr) {
          const partnerIds = (partnerAccounts || []).map((r) => r.id);
          const balances = await this.sumNetBalancesByAccountIds(partnerIds);
          let partnerNet = 0;
          for (const pid of partnerIds) {
            partnerNet += balances[pid] || 0;
          }
          partnerNet = round2(partnerNet);
          const deltaOpenVsLedgerThb = round2(openGrossSum - partnerNet);
          const toleranceThb = 0.02;
          const equalsLedgerWithinTolerance = Math.abs(deltaOpenVsLedgerThb) <= toleranceThb;
          payoutSelfCheck = {
            openPipelineGrossThb: openGrossSum,
            partnerEarningsLedgerNetThb: partnerNet,
            deltaOpenVsLedgerThb,
            equalsLedgerWithinTolerance,
            toleranceThb,
            note:
              'Инвариант «сумма открытых выплат = нетто PARTNER_EARNINGS» выполняется не всегда (часть обязательств не в заявках, мультивалюта, legacy). Сверка — smoke; расхождение не означает Margin Leakage.',
          };
          if (!equalsLedgerWithinTolerance) {
            console.warn('[LedgerService.runReconciliationMvp] payout self-check', {
              openPipelineGrossThb: openGrossSum,
              partnerEarningsLedgerNetThb: partnerNet,
              deltaOpenVsLedgerThb,
            });
          }
        }
      }
    } catch (e) {
      console.warn('[LedgerService.runReconciliationMvp] payoutSelfCheck skipped:', e?.message || e);
    }

    return {
      cashAccountLabel: 'GUEST_PAYMENT_CLEARING — сверка только по журналам захвата оплаты (Booking Capture)',
      /** Сумма clearing DEBIT только по журналам захвата оплаты (есть нога на clearing). */
      guestClearingDebitsThb: round2(guestClearingDebitsThb),
      /** Сумма CREDIT по распределению захвата (без clearing и без PARTNER_PAYOUTS_SETTLED). */
      distributionCreditsThb: round2(distributionCreditsThb),
      deltaThb,
      unbalancedJournals,
      marginLeakage,
      distributionScope: 'booking_capture_only_excludes_partner_payouts_settled',
      ...(payoutSelfCheck ? { payoutSelfCheck } : {}),
    };
  }
}

export default LedgerService;
