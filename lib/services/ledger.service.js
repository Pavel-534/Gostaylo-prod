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

    const legs = computeBookingPaymentLedgerLegs(booking);
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
      notifyLedgerGuestPaymentClearingPosted({
        bookingId,
        guestTotalThb: legs.guestTotalThb,
        journalId,
      });
    }

    return { success: true, journalId, legs };
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
   * Ожидаемое: сумма DEBIT по clearing = сумма CREDIT по всем прочим ногам журналов (иначе Margin Leakage).
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

    let guestClearingDebitsThb = 0;
    let distributionCreditsThb = 0;

    const byJournal = new Map();
    for (const e of entries || []) {
      const amt = round2(e.amount_thb);
      const code = codeById.get(e.account_id) || '';
      if (code === 'GUEST_PAYMENT_CLEARING' && e.side === 'DEBIT') {
        guestClearingDebitsThb += amt;
      }
      if (e.side === 'CREDIT' && code !== 'GUEST_PAYMENT_CLEARING') {
        distributionCreditsThb += amt;
      }
      if (!byJournal.has(e.journal_id)) byJournal.set(e.journal_id, { dr: 0, cr: 0 });
      const j = byJournal.get(e.journal_id);
      if (e.side === 'DEBIT') j.dr += amt;
      else j.cr += amt;
    }

    let unbalancedJournals = 0;
    for (const v of byJournal.values()) {
      if (Math.abs(round2(v.dr - v.cr)) > 0.02) unbalancedJournals += 1;
    }

    const deltaThb = round2(guestClearingDebitsThb - distributionCreditsThb);
    const marginLeakage = Math.abs(deltaThb) > 0.02 || unbalancedJournals > 0;

    return {
      cashAccountLabel: 'GUEST_PAYMENT_CLEARING (MVP proxy for cash intake)',
      guestClearingDebitsThb: round2(guestClearingDebitsThb),
      distributionCreditsThb: round2(distributionCreditsThb),
      deltaThb,
      unbalancedJournals,
      marginLeakage,
    };
  }
}

export default LedgerService;
