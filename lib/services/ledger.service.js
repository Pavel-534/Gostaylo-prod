/**
 * Double-entry ledger (THB) for booking payment capture.
 * Trigger: EscrowService.moveToEscrow → PAID_ESCROW (guest funds recognized).
 */

import { supabaseAdmin } from '@/lib/supabase';
import { isFintechTestBookingRow } from '@/lib/admin/fintech-test-data-markers.js';
import { withFintechTestDataMeta } from '@/lib/admin/fintech-test-data-meta.js';
import { notifyLedgerGuestPaymentClearingPosted } from '@/lib/services/ledger-telegram-notify';
import {
  computeBookingPaymentLedgerLegs,
  scaleLedgerLegsToGuestTotal,
  thbToRub,
} from '@/lib/services/ledger/ledger-capture-legs.js';

export { computeBookingPaymentLedgerLegs, scaleLedgerLegsToGuestTotal };

const ACC = {
  guestClearing: 'la-sys-guest-clearing',
  platformFee: 'la-sys-platform-fee',
  platformFeeRu: 'la-sys-platform-fee-ru',
  platformFeeKg: 'la-sys-platform-fee-kg',
  fxMarkupKg: 'la-sys-fx-markup-kg',
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
 * RUB reporting columns for ledger_entries (Stage 97.0.4).
 * @param {object} booking
 * @param {object} legs
 */
async function buildRubPostingFields(booking, legs) {
  let rubToThb = null;
  const payCur = String(booking?.currency || 'THB').toUpperCase();
  if (payCur === 'RUB') {
    const rate = Number(booking?.exchange_rate);
    if (Number.isFinite(rate) && rate > 0) rubToThb = rate;
  }
  if (!rubToThb) {
    try {
      const { getRawRateMap } = await import('@/lib/services/pricing/pricing-fx-helpers.js');
      const map = await getRawRateMap();
      const r = Number(map?.RUB);
      if (Number.isFinite(r) && r > 0) rubToThb = r;
    } catch {
      rubToThb = null;
    }
  }
  if (!rubToThb) return {};

  const hostPayoutCur = String(booking?.listing_currency || 'THB').toUpperCase();
  const base = {
    amount_total_rub: thbToRub(legs.guestTotalThb, rubToThb),
    host_payout_base_currency: hostPayoutCur,
  };
  if (legs.ledgerV2) {
    return {
      ...base,
      ru_fee_income_rub: thbToRub(legs.ruFeeThb, rubToThb),
      kr_fee_income_rub: thbToRub(legs.krFeeThb, rubToThb),
      fx_markup_income_rub: thbToRub(legs.fxMarkupThb, rubToThb),
    };
  }
  return base;
}

/**
 * @param {string} journalId
 * @param {string} bookingId
 * @param {object} legs
 * @param {string} partnerAccount
 * @param {string} partnerId
 * @param {object} rubFields
 */
function buildCaptureCreditLines(journalId, bookingId, legs, partnerAccount, partnerId, rubFields) {
  const lines = [
    {
      id: `le-${journalId}-cr-partner`,
      journal_id: journalId,
      account_id: partnerAccount,
      side: 'CREDIT',
      amount_thb: legs.partnerThb,
      description: 'Partner earnings',
      metadata: { booking_id: bookingId, partner_id: partnerId },
      ...rubFields,
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
  ];

  if (legs.ledgerV2) {
    if (legs.ruFeeThb > 0) {
      lines.push({
        id: `le-${journalId}-cr-platform-ru`,
        journal_id: journalId,
        account_id: ACC.platformFeeRu,
        side: 'CREDIT',
        amount_thb: legs.ruFeeThb,
        description: 'Platform fee — RU agency (internal)',
        metadata: { booking_id: bookingId, leg: 'ru_agent' },
        ru_fee_income_rub: rubFields.ru_fee_income_rub ?? null,
        amount_total_rub: rubFields.ru_fee_income_rub ?? null,
      });
    }
    if (legs.krFeeThb > 0) {
      lines.push({
        id: `le-${journalId}-cr-platform-kg`,
        journal_id: journalId,
        account_id: ACC.platformFeeKg,
        side: 'CREDIT',
        amount_thb: legs.krFeeThb,
        description: 'Platform fee — KG IT/service (not royalty)',
        metadata: {
          booking_id: bookingId,
          leg: 'kg_service',
          legal_note: 'IT services and technical support',
        },
        kr_fee_income_rub: rubFields.kr_fee_income_rub ?? null,
        amount_total_rub: rubFields.kr_fee_income_rub ?? null,
      });
    }
    if (legs.fxMarkupThb > 0) {
      lines.push({
        id: `le-${journalId}-cr-fx-kg`,
        journal_id: journalId,
        account_id: ACC.fxMarkupKg,
        side: 'CREDIT',
        amount_thb: legs.fxMarkupThb,
        description: 'FX markup revenue — KG',
        metadata: { booking_id: bookingId, leg: 'fx_markup' },
        fx_markup_income_rub: rubFields.fx_markup_income_rub ?? null,
        amount_total_rub: rubFields.fx_markup_income_rub ?? null,
      });
    }
    if (legs.platformHostFeeThb > 0) {
      lines.push({
        id: `le-${journalId}-cr-platform-host`,
        journal_id: journalId,
        account_id: ACC.platformFee,
        side: 'CREDIT',
        amount_thb: legs.platformHostFeeThb,
        description: 'Host commission (platform)',
        metadata: { booking_id: bookingId, leg: 'host_commission' },
      });
    }
  } else if (legs.platformFeeThb > 0) {
    lines.push({
      id: `le-${journalId}-cr-platform`,
      journal_id: journalId,
      account_id: ACC.platformFee,
      side: 'CREDIT',
      amount_thb: legs.platformFeeThb,
      description: 'Platform margin (net of insurance)',
      metadata: { booking_id: bookingId },
    });
  }

  if (legs.roundingThb > 0) {
    lines.push({
      id: `le-${journalId}-cr-pot`,
      journal_id: journalId,
      account_id: ACC.processingPot,
      side: 'CREDIT',
      amount_thb: legs.roundingThb,
      description: 'Rounding pot (guest payable Math.round)',
      metadata: { booking_id: bookingId },
    });
  }

  return lines;
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
      metadata: isFintechTestBookingRow(booking)
        ? withFintechTestDataMeta({ legs, status_at_post: booking.status })
        : { legs, status_at_post: booking.status },
      created_at: now,
    });
    if (jErr) {
      if (String(jErr.message || '').includes('duplicate') || jErr.code === '23505') {
        return { success: true, skipped: true };
      }
      console.error('[LedgerService] journal insert', jErr.message);
      return { success: false, error: jErr.message };
    }

    const rubFields = await buildRubPostingFields(booking, legs);
    const lineMetaBase = isFintechTestBookingRow(booking)
      ? withFintechTestDataMeta({ booking_id: bookingId, ledger_v2: Boolean(legs.ledgerV2) })
      : { booking_id: bookingId, ledger_v2: Boolean(legs.ledgerV2) };

    const lines = [
      {
        id: `le-${journalId}-dr-guest`,
        journal_id: journalId,
        account_id: ACC.guestClearing,
        side: 'DEBIT',
        amount_thb: legs.guestTotalThb,
        description: 'Guest funds received (clearing)',
        metadata: lineMetaBase,
        amount_total_rub: rubFields.amount_total_rub ?? null,
        host_payout_base_currency: rubFields.host_payout_base_currency ?? null,
      },
      ...buildCaptureCreditLines(
        journalId,
        bookingId,
        legs,
        partnerAccount,
        partnerId,
        rubFields,
      ),
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
   * Treasury batch settled: one booking line → reduce partner liability (THB).
   * Idempotent: `payout_batch_settled:{batchId}:{bookingId}`.
   */
  static async postPartnerBatchBookingPayoutSettled({ batchId, bookingId, partnerId, amountThb }) {
    const bid = String(bookingId || '')
    const batch = String(batchId || '')
    const pid = String(partnerId || '')
    const amt = round2(amountThb)
    if (!bid || !batch || !pid || !(amt > 0)) {
      return { success: false, error: 'invalid_batch_settle_args' }
    }

    const idempotencyKey = `payout_batch_settled:${batch}:${bid}`
    const { data: existing } = await supabaseAdmin
      .from('ledger_journals')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (existing?.id) {
      return { success: true, skipped: true, journalId: existing.id }
    }

    const partnerAccount = await this.ensurePartnerLedgerAccount(pid)
    if (!partnerAccount) {
      return { success: false, error: 'missing_partner_account' }
    }

    const journalId = `lj-batch-settled-${batch}-${bid}`.slice(0, 120)
    const now = new Date().toISOString()

    const { error: jErr } = await supabaseAdmin.from('ledger_journals').insert({
      id: journalId,
      booking_id: bid,
      event_type: 'PARTNER_PAYOUT_OBLIGATION_SETTLED',
      idempotency_key: idempotencyKey,
      metadata: {
        payout_batch_id: batch,
        booking_id: bid,
        partner_id: pid,
        amount_thb: amt,
        description: 'Partner liability settled (treasury batch)',
      },
      created_at: now,
    })
    if (jErr) {
      if (String(jErr.message || '').includes('duplicate') || jErr.code === '23505') {
        return { success: true, skipped: true }
      }
      return { success: false, error: jErr.message }
    }

    const lines = [
      {
        id: `le-${journalId}-dr-partner`,
        journal_id: journalId,
        account_id: partnerAccount,
        side: 'DEBIT',
        amount_thb: amt,
        description: 'Partner earnings — batch payout settled',
        metadata: { payout_batch_id: batch, booking_id: bid, partner_id: pid },
      },
      {
        id: `le-${journalId}-cr-settled`,
        journal_id: journalId,
        account_id: ACC.partnerPayoutsSettled,
        side: 'CREDIT',
        amount_thb: amt,
        description: 'Partner payouts settled (treasury batch)',
        metadata: { payout_batch_id: batch, booking_id: bid, partner_id: pid },
      },
    ]

    const { error: eErr } = await supabaseAdmin.from('ledger_entries').insert(lines)
    if (eErr) {
      await supabaseAdmin.from('ledger_journals').delete().eq('id', journalId)
      return { success: false, error: eErr.message }
    }

    return { success: true, journalId, amountThb: amt }
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
    let insDr = round2(legs0.insuranceThb * ratio);
    let potDr = round2(legs0.roundingThb * ratio);
    let platformDr = 0;
    let ruDr = 0;
    let kgDr = 0;
    let fxDr = 0;
    let hostDr = 0;

    if (legs0.ledgerV2) {
      ruDr = round2((legs0.ruFeeThb || 0) * ratio);
      kgDr = round2((legs0.krFeeThb || 0) * ratio);
      fxDr = round2((legs0.fxMarkupThb || 0) * ratio);
      hostDr = round2((legs0.platformHostFeeThb || 0) * ratio);
    } else {
      platformDr = round2(legs0.platformFeeThb * ratio);
    }

    const sum = round2(
      partnerDr +
        insDr +
        potDr +
        platformDr +
        ruDr +
        kgDr +
        fxDr +
        hostDr,
    );
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
        legs: { partnerDr, platformDr, ruDr, kgDr, fxDr, hostDr, insuranceDr: insDr, potDr },
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
        id: `le-${journalId}-dr-ins`,
        journal_id: journalId,
        account_id: ACC.insurance,
        side: 'DEBIT',
        amount_thb: insDr,
        description: 'Partial refund — insurance reserve reversal',
        metadata: { booking_id: bookingId },
      },
    ];

    if (legs0.ledgerV2) {
      if (ruDr > 0) {
        lines.push({
          id: `le-${journalId}-dr-platform-ru`,
          journal_id: journalId,
          account_id: ACC.platformFeeRu,
          side: 'DEBIT',
          amount_thb: ruDr,
          description: 'Partial refund — RU agency fee reversal',
          metadata: { booking_id: bookingId },
        });
      }
      if (kgDr > 0) {
        lines.push({
          id: `le-${journalId}-dr-platform-kg`,
          journal_id: journalId,
          account_id: ACC.platformFeeKg,
          side: 'DEBIT',
          amount_thb: kgDr,
          description: 'Partial refund — KG IT/service fee reversal',
          metadata: { booking_id: bookingId },
        });
      }
      if (fxDr > 0) {
        lines.push({
          id: `le-${journalId}-dr-fx-kg`,
          journal_id: journalId,
          account_id: ACC.fxMarkupKg,
          side: 'DEBIT',
          amount_thb: fxDr,
          description: 'Partial refund — FX markup reversal',
          metadata: { booking_id: bookingId },
        });
      }
      if (hostDr > 0) {
        lines.push({
          id: `le-${journalId}-dr-platform-host`,
          journal_id: journalId,
          account_id: ACC.platformFee,
          side: 'DEBIT',
          amount_thb: hostDr,
          description: 'Partial refund — host commission reversal',
          metadata: { booking_id: bookingId },
        });
      }
    } else if (platformDr > 0) {
      lines.push({
        id: `le-${journalId}-dr-platform`,
        journal_id: journalId,
        account_id: ACC.platformFee,
        side: 'DEBIT',
        amount_thb: platformDr,
        description: 'Partial refund — platform share reversal',
        metadata: { booking_id: bookingId },
      });
    }

    if (potDr > 0) {
      lines.push({
        id: `le-${journalId}-dr-pot`,
        journal_id: journalId,
        account_id: ACC.processingPot,
        side: 'DEBIT',
        amount_thb: potDr,
        description: 'Partial refund — rounding pot reversal',
        metadata: { booking_id: bookingId },
      });
    }

    const { error: eErr } = await supabaseAdmin.from('ledger_entries').insert(lines);
    if (eErr) {
      console.error('[LedgerService] refund entries insert', eErr.message);
      await supabaseAdmin.from('ledger_journals').delete().eq('id', journalId);
      return { success: false, error: eErr.message };
    }

    return { success: true, journalId, refundGuestThb: r };
  }

  /**
   * Sum of partner-account DEBIT lines tied to payout settlement journals (lifetime paid out, THB).
   * @param {string} partnerId
   */
  static async sumPartnerPayoutDebitsThb(partnerId) {
    const accountId = partnerAccountId(partnerId);
    if (!accountId || !supabaseAdmin) return 0;
    const { data: entries, error } = await supabaseAdmin
      .from('ledger_entries')
      .select('amount_thb, journal_id')
      .eq('account_id', accountId)
      .eq('side', 'DEBIT');
    if (error || !entries?.length) {
      if (error) console.warn('[LedgerService] sumPartnerPayoutDebitsThb entries', error.message);
      return 0;
    }
    const journalIds = [...new Set(entries.map((e) => e.journal_id).filter(Boolean))];
    const { data: journals } = await supabaseAdmin
      .from('ledger_journals')
      .select('id, event_type')
      .in('id', journalIds);
    const payoutJournal = new Set(
      (journals || [])
        .filter((j) => j.event_type === 'PARTNER_PAYOUT_OBLIGATION_SETTLED')
        .map((j) => j.id),
    );
    let sum = 0;
    for (const e of entries) {
      if (payoutJournal.has(e.journal_id)) {
        sum += round2(e.amount_thb);
      }
    }
    return round2(sum);
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
