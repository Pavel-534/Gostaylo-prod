/**
 * Stage 110.3 — shared ledger constants and capture line builders.
 * Money flow: guest DEBIT clearing → CREDIT partner / platform / insurance / pot.
 */

import { thbToRub } from '@/lib/services/ledger/ledger-capture-legs.js'

/** System ledger account ids (THB double-entry). */
export const LEDGER_ACC = {
  guestClearing: 'la-sys-guest-clearing',
  platformFee: 'la-sys-platform-fee',
  platformFeeRu: 'la-sys-platform-fee-ru',
  platformFeeKg: 'la-sys-platform-fee-kg',
  fxMarkupKg: 'la-sys-fx-markup-kg',
  insurance: 'la-sys-insurance',
  processingPot: 'la-sys-processing-pot',
  partnerPayoutsSettled: 'la-sys-partner-payouts-settled',
}

export function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

export function partnerAccountId(partnerId) {
  return `la-partner-${partnerId}`
}

/**
 * RUB reporting columns for ledger_entries (Stage 97.0.4).
 * @param {object} booking
 * @param {object} legs
 */
export async function buildRubPostingFields(booking, legs) {
  let rubToThb = null
  const payCur = String(booking?.currency || 'THB').toUpperCase()
  if (payCur === 'RUB') {
    const rate = Number(booking?.exchange_rate)
    if (Number.isFinite(rate) && rate > 0) rubToThb = rate
  }
  if (!rubToThb) {
    try {
      const { getRawRateMap } = await import('@/lib/services/pricing/pricing-fx-helpers.js')
      const map = await getRawRateMap()
      const r = Number(map?.RUB)
      if (Number.isFinite(r) && r > 0) rubToThb = r
    } catch {
      rubToThb = null
    }
  }
  if (!rubToThb) return {}

  const hostPayoutCur = String(booking?.listing_currency || 'THB').toUpperCase()
  const base = {
    amount_total_rub: thbToRub(legs.guestTotalThb, rubToThb),
    host_payout_base_currency: hostPayoutCur,
  }
  if (legs.ledgerV2) {
    return {
      ...base,
      ru_fee_income_rub: thbToRub(legs.ruFeeThb, rubToThb),
      kr_fee_income_rub: thbToRub(legs.krFeeThb, rubToThb),
      fx_markup_income_rub: thbToRub(legs.fxMarkupThb, rubToThb),
    }
  }
  return base
}

/**
 * CREDIT legs for BOOKING_PAYMENT_CAPTURED (partner, insurance, platform, pot).
 */
export function buildCaptureCreditLines(journalId, bookingId, legs, partnerAccount, partnerId, rubFields) {
  const ACC = LEDGER_ACC
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
  ]

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
      })
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
      })
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
      })
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
      })
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
    })
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
    })
  }

  return lines
}
