/**
 * Stage 110.3 — shared ledger constants and capture line builders.
 * Money flow: guest DEBIT clearing → CREDIT partner / platform / insurance / pot.
 */

import { thbToRub } from '@/lib/services/ledger/ledger-capture-legs.js'
import { logStructured } from '@/lib/critical-telemetry.js'

/** Ledger / reporting RUB derive — locked booking rate only (Stage 201.05). Never live `exchange_rates`. */
export const LEDGER_RUB_LOCKED_RATE_MISSING = 'LEDGER_RUB_LOCKED_RATE_MISSING'

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
  /** Stage 203.01 / AUDIT_LEDGER_01 C-L2 */
  disputeHold: 'la-sys-dispute-hold',
}

export function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

export function partnerAccountId(partnerId) {
  return `la-partner-${partnerId}`
}

function readSnapshotFxBundle(booking) {
  const snap = booking?.pricing_snapshot && typeof booking.pricing_snapshot === 'object' ? booking.pricing_snapshot : {}
  const fb = snap.final_breakdown && typeof snap.final_breakdown === 'object' ? snap.final_breakdown : {}
  return { snap, fb }
}

function isRubReportingContext(booking) {
  const { snap, fb } = readSnapshotFxBundle(booking)
  const payCur = String(booking?.currency || '').toUpperCase()
  const bruttoCur = String(fb.total_guest_brutto?.currency || snap.total_guest_brutto?.currency || '').toUpperCase()
  return payCur === 'RUB' || bruttoCur === 'RUB'
}

function firstPositiveRate(...candidates) {
  for (const raw of candidates) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

/**
 * Locked THB-per-1-RUB for ledger RUB columns (Stage 201.05).
 * SSOT: `bookings.exchange_rate` and/or snapshot `fx_raw_rate_to_thb` / `fx_customer_rate_to_thb`.
 * Does **not** read live `exchange_rates` / `getRawRateMap`.
 * @param {object | null | undefined} booking
 * @returns {number | null}
 */
export function resolveLockedRubToThbRate(booking) {
  if (!isRubReportingContext(booking)) return null
  const { snap, fb } = readSnapshotFxBundle(booking)
  return firstPositiveRate(
    booking?.exchange_rate,
    fb.fx_raw_rate_to_thb,
    snap.fx_raw_rate_to_thb,
    fb.fx_customer_rate_to_thb,
    snap.fx_customer_rate_to_thb,
  )
}

/**
 * RUB reporting columns for ledger_entries (Stage 97.0.4).
 * Fail-closed: missing locked rate → omit RUB fields (THB legs still post). Never live mid.
 * @param {object} booking
 * @param {object} legs
 */
export async function buildRubPostingFields(booking, legs) {
  const rubToThb = resolveLockedRubToThbRate(booking)
  if (!rubToThb) {
    if (isRubReportingContext(booking)) {
      logStructured({
        module: 'ledger-rub-fields',
        stage: 'locked_rate_missing',
        code: LEDGER_RUB_LOCKED_RATE_MISSING,
        bookingId: booking?.id || null,
        currency: booking?.currency || null,
      })
    }
    return {}
  }

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
