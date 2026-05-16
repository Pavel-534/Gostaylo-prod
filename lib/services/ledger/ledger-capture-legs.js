/**
 * Booking payment capture leg computation (legacy + v2 split).
 * @see database/migrations/053_financial_model_v2.sql
 */

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

/**
 * @param {object} booking
 * @returns {boolean}
 */
export function isLedgerCaptureV2(booking) {
  const snap = booking?.pricing_snapshot
  return Boolean(snap && typeof snap === 'object' && snap.v === 2 && snap.final_breakdown)
}

/**
 * @param {object} booking
 */
function readFinalBreakdown(booking) {
  const snap = booking?.pricing_snapshot && typeof booking.pricing_snapshot === 'object' ? booking.pricing_snapshot : {}
  const fb = snap.final_breakdown && typeof snap.final_breakdown === 'object' ? snap.final_breakdown : {}
  const fs = snap.fee_split_v2 && typeof snap.fee_split_v2 === 'object' ? snap.fee_split_v2 : {}
  return { snap, fb, fs }
}

/**
 * Guest total for payment capture — SSOT from v2 snapshot or booking columns.
 * @param {object} booking
 * @param {object} [ctx]
 */
export function resolveCaptureGuestTotalThb(booking, ctx = null) {
  const { fb, fs } = ctx || readFinalBreakdown(booking)

  let guestTotalThb = round2(fb.total_guest_payable_rounded_thb ?? fs.guest_payable_rounded_thb ?? 0)
  if (!guestTotalThb) {
    const ex = Number(booking?.exchange_rate)
    const pp = Number(booking?.price_paid)
    if (Number.isFinite(ex) && ex > 0 && Number.isFinite(pp) && pp > 0) {
      guestTotalThb = round2(pp * ex)
    }
  }
  if (!guestTotalThb) {
    const gross = round2(booking?.price_thb ?? 0)
    const guestSvc = round2(fs.guest_service_fee_thb ?? booking?.commission_thb ?? 0)
    const roundingThb = round2(
      fb.rounding_pot_thb ??
        fb.rounding_diff_pot_thb ??
        fs.rounding_pot_thb ??
        fs.rounding_diff_pot_thb ??
        booking?.rounding_diff_pot ??
        0,
    )
    guestTotalThb = round2(gross + guestSvc + roundingThb)
  }
  return guestTotalThb
}

/**
 * @param {object} booking
 */
export function computeBookingPaymentLedgerLegs(booking) {
  if (isLedgerCaptureV2(booking)) {
    return computeBookingPaymentLedgerLegsV2(booking)
  }
  return computeBookingPaymentLedgerLegsLegacy(booking)
}

/**
 * @param {object} booking
 */
export function computeBookingPaymentLedgerLegsLegacy(booking) {
  const snap = booking?.pricing_snapshot && typeof booking.pricing_snapshot === 'object' ? booking.pricing_snapshot : {}
  const fs = snap.fee_split_v2 && typeof snap.fee_split_v2 === 'object' ? snap.fee_split_v2 : {}

  const roundingThb = round2(
    fs.rounding_diff_pot_thb ?? fs.rounding_pot_thb ?? booking?.rounding_diff_pot ?? 0,
  )
  const partnerThb = round2(booking?.partner_earnings_thb ?? 0)

  const guestSvc = round2(fs.guest_service_fee_thb ?? booking?.commission_thb ?? 0)
  const gross = round2(booking?.price_thb ?? 0)
  const hostComm = round2(
    fs.host_commission_thb ??
      Math.round(gross * ((Number(booking?.commission_rate) || 0) / 100) * 100) / 100,
  )
  const platformGross = round2(fs.platform_gross_revenue_thb ?? guestSvc + hostComm)
  let insuranceThb = round2(fs.insurance_reserve_thb ?? 0)
  if (!Number.isFinite(insuranceThb) || insuranceThb < 0) {
    const st = snap.settlement_v3?.insurance_reserve_amount
    insuranceThb = round2(st?.thb ?? 0)
  }

  let guestTotalThb = resolveCaptureGuestTotalThb(booking)

  let platformFeeThb = round2(platformGross - insuranceThb)
  if (!Number.isFinite(platformFeeThb)) platformFeeThb = 0

  let sumCr = round2(partnerThb + platformFeeThb + insuranceThb + roundingThb)
  const drift = round2(guestTotalThb - sumCr)
  if (Math.abs(drift) > 0.02) {
    platformFeeThb = round2(platformFeeThb + drift)
  }

  return {
    ledgerV2: false,
    guestTotalThb,
    partnerThb,
    platformFeeThb: Math.max(0, platformFeeThb),
    insuranceThb: Math.max(0, insuranceThb),
    roundingThb: Math.max(0, roundingThb),
  }
}

/**
 * @param {object} booking
 */
export function computeBookingPaymentLedgerLegsV2(booking) {
  const { fb, fs } = readFinalBreakdown(booking)

  const partnerThb = round2(booking?.partner_earnings_thb ?? fb.total_partner_netto_thb ?? 0)
  const insuranceThb = round2(fb.insurance_reserve_thb ?? fs.insurance_reserve_thb ?? 0)
  const roundingThb = round2(
    fb.rounding_pot_thb ??
      fb.rounding_diff_pot_thb ??
      fs.rounding_pot_thb ??
      fs.rounding_diff_pot_thb ??
      booking?.rounding_diff_pot ??
      0,
  )

  let ruFeeThb = round2(fb.ru_fee_thb ?? fs.ru_fee_thb ?? 0)
  let krFeeThb = round2(fb.kr_fee_thb ?? fs.kr_fee_thb ?? 0)
  let fxMarkupThb = round2(fb.fx_markup_thb ?? fs.fx_markup_thb ?? 0)
  const taxThb = round2(fb.tax_amount_thb ?? 0)
  let platformHostFeeThb = round2((fb.host_commission_thb ?? fs.host_commission_thb ?? 0) + taxThb)

  let guestTotalThb = resolveCaptureGuestTotalThb(booking)

  let sumCr = round2(
    partnerThb + insuranceThb + roundingThb + ruFeeThb + krFeeThb + fxMarkupThb + platformHostFeeThb,
  )
  let drift = round2(guestTotalThb - sumCr)
  if (Math.abs(drift) > 0.02) {
    platformHostFeeThb = round2(Math.max(0, platformHostFeeThb + drift))
    sumCr = round2(
      partnerThb + insuranceThb + roundingThb + ruFeeThb + krFeeThb + fxMarkupThb + platformHostFeeThb,
    )
    drift = round2(guestTotalThb - sumCr)
    if (Math.abs(drift) > 0.02) {
      krFeeThb = round2(Math.max(0, krFeeThb + drift))
    }
  }

  return {
    ledgerV2: true,
    guestTotalThb,
    partnerThb: Math.max(0, partnerThb),
    insuranceThb: Math.max(0, insuranceThb),
    roundingThb,
    ruFeeThb: Math.max(0, ruFeeThb),
    krFeeThb: Math.max(0, krFeeThb),
    fxMarkupThb: Math.max(0, fxMarkupThb),
    platformHostFeeThb: Math.max(0, platformHostFeeThb),
    platformFeeThb: 0,
  }
}

/**
 * @param {object} legs
 * @param {number} targetGuestTotalThb
 */
export function scaleLedgerLegsToGuestTotal(legs, targetGuestTotalThb) {
  const target = round2(targetGuestTotalThb)
  const baseGuest = round2(legs.guestTotalThb)
  if (!Number.isFinite(target) || target <= 0) return legs
  if (baseGuest <= 0) return { ...legs, guestTotalThb: target }
  if (Math.abs(target - baseGuest) <= 0.02) return legs

  const scale = target / baseGuest
  const scaled = { ...legs, guestTotalThb: target }

  if (legs.ledgerV2) {
    scaled.partnerThb = round2(legs.partnerThb * scale)
    scaled.insuranceThb = round2(legs.insuranceThb * scale)
    scaled.roundingThb = round2(legs.roundingThb * scale)
    scaled.ruFeeThb = round2(legs.ruFeeThb * scale)
    scaled.krFeeThb = round2(legs.krFeeThb * scale)
    scaled.fxMarkupThb = round2(legs.fxMarkupThb * scale)
    scaled.platformHostFeeThb = round2(legs.platformHostFeeThb * scale)
    const sumCr = round2(
      scaled.partnerThb +
        scaled.insuranceThb +
        scaled.roundingThb +
        scaled.ruFeeThb +
        scaled.krFeeThb +
        scaled.fxMarkupThb +
        scaled.platformHostFeeThb,
    )
    const drift = round2(target - sumCr)
    scaled.platformHostFeeThb = round2(Math.max(0, scaled.platformHostFeeThb + drift))
    return scaled
  }

  let partnerThb = round2(legs.partnerThb * scale)
  let platformFeeThb = round2(legs.platformFeeThb * scale)
  let insuranceThb = round2(legs.insuranceThb * scale)
  let roundingThb = round2(legs.roundingThb * scale)
  const sumCr = round2(partnerThb + platformFeeThb + insuranceThb + roundingThb)
  const drift = round2(target - sumCr)
  platformFeeThb = round2(platformFeeThb + drift)
  return {
    ...legs,
    guestTotalThb: target,
    partnerThb: Math.max(0, partnerThb),
    platformFeeThb: Math.max(0, platformFeeThb),
    insuranceThb: Math.max(0, insuranceThb),
    roundingThb: Math.max(0, roundingThb),
  }
}

/**
 * @param {number} amountThb
 * @param {number | null | undefined} rubToThb
 */
export function thbToRub(amountThb, rubToThb) {
  const thb = round2(amountThb)
  const rate = Number(rubToThb)
  if (!Number.isFinite(rate) || rate <= 0) return null
  return round2(thb / rate)
}
