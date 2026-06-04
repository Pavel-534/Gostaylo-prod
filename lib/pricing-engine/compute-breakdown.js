/**
 * Pure breakdown math — percents come from PricingProfile row only (no literals).
 * Guest total: Math.round to 1 THB; remainder → rounding_pot_thb (platform revenue).
 */

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

function round0(n) {
  return Math.round(Number(n) || 0)
}

/**
 * @param {import('./types').ComputeFinalBreakdownInput} input
 * @returns {import('./types').FinalBreakdown}
 */
export function computeFinalBreakdown(input) {
  const profile = input.profile
  if (!profile?.id) {
    throw new Error('[PricingEngine] profile required')
  }

  const subtotal = Math.max(0, round0(input.subtotal_thb))
  const guestPct = Number(profile.guest_fee_pct)
  const hostPct = Number(profile.host_fee_pct)
  const ruPct = Number(profile.ru_agent_share_pct)
  const krPct = Number(profile.kr_service_share_pct)
  const insPct = Number(profile.insurance_fund_pct)
  const taxPct = Number(profile.tax_rate_pct)
  const fxMarkupPct = Number(profile.fx_markup_pct)

  for (const [label, v] of [
    ['guest_fee_pct', guestPct],
    ['host_fee_pct', hostPct],
    ['ru_agent_share_pct', ruPct],
    ['kr_service_share_pct', krPct],
  ]) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(`[PricingEngine] invalid ${label}`)
    }
  }

  if (Math.abs(ruPct + krPct - guestPct) >= 0.01) {
    throw new Error(
      `[PricingEngine] profile ${profile.id}: ru_agent_share_pct + kr_service_share_pct must equal guest_fee_pct`,
    )
  }

  const taxAmountThb = round0(subtotal * (taxPct / 100))
  const guestServiceFeeThb = round0(subtotal * (guestPct / 100))
  const hostCommissionThb = round0(subtotal * (hostPct / 100))
  const ruFeeThb = round0(subtotal * (ruPct / 100))
  const krFeeThb = round0(subtotal * (krPct / 100))
  const partnerNettoThb = Math.max(0, subtotal - hostCommissionThb)

  const platformGrossThb = guestServiceFeeThb + hostCommissionThb
  const insuranceReserveThb = round0(platformGrossThb * (insPct / 100))
  const platformMarginPoolThb = Math.max(0, platformGrossThb - insuranceReserveThb)

  const guestPayableExact = subtotal + taxAmountThb + guestServiceFeeThb
  const guestPayableRoundedThb = Math.round(guestPayableExact)
  const roundingPotThb = round2(guestPayableRoundedThb - guestPayableExact)
  const guestPayableThb = round2(guestPayableExact)

  const payCur = String(input.payment_currency || 'THB').toUpperCase()
  const baseCur = String(input.listing_base_currency || 'THB').toUpperCase()
  const rawMap = input.raw_fx_rate_map && typeof input.raw_fx_rate_map === 'object' ? input.raw_fx_rate_map : {}

  let fxRawRate = payCur === 'THB' ? 1 : Number(rawMap[payCur])
  let fxCustomerRate = fxRawRate
  let fxMarkupThb = 0

  if (payCur !== 'THB' && Number.isFinite(fxRawRate) && fxRawRate > 0) {
    const mult = 1 + (Number.isFinite(fxMarkupPct) ? fxMarkupPct : 0) / 100
    const safeMult = mult > 1 ? mult : 1
    if (payCur !== baseCur && safeMult > 1) {
      fxCustomerRate = fxRawRate / safeMult
    }
    const bruttoMid = guestPayableRoundedThb / fxRawRate
    const bruttoCustomer = guestPayableRoundedThb / fxCustomerRate
    if (Number.isFinite(bruttoMid) && Number.isFinite(bruttoCustomer)) {
      fxMarkupThb = round2(Math.max(0, bruttoCustomer - bruttoMid) * fxRawRate)
    }
  }

  const trace = Array.isArray(input.resolution_trace) ? [...input.resolution_trace] : []

  /** @type {import('./types').FinalBreakdown} */
  const breakdown = {
    pricing_profile_id: profile.id,
    resolution_trace: trace,
    subtotal_thb: subtotal,
    guest_service_fee_thb: guestServiceFeeThb,
    host_commission_thb: hostCommissionThb,
    tax_amount_thb: taxAmountThb,
    insurance_reserve_thb: insuranceReserveThb,
    platform_margin_pool_thb: platformMarginPoolThb,
    ru_fee_thb: ruFeeThb,
    kr_fee_thb: krFeeThb,
    fx_markup_thb: fxMarkupThb,
    total_guest_payable_thb: guestPayableThb,
    total_guest_payable_rounded_thb: guestPayableRoundedThb,
    rounding_pot_thb: roundingPotThb,
    /** @deprecated alias for ledger/bookings.rounding_diff_pot */
    rounding_diff_pot_thb: roundingPotThb,
    total_partner_netto_thb: partnerNettoThb,
    fx_markup_pct_applied: fxMarkupPct,
  }

  if (payCur !== 'THB') {
    if (!Number.isFinite(fxRawRate) || fxRawRate <= 0) {
      throw new Error(
        `[PricingEngine] missing FX rate for ${payCur} (set exchange_rates or FALLBACK_RATE_${payCur}_TO_THB)`,
      )
    }
  }

  if (payCur !== 'THB' && Number.isFinite(fxCustomerRate) && fxCustomerRate > 0) {
    breakdown.fx_raw_rate_to_thb = fxRawRate
    breakdown.fx_customer_rate_to_thb = fxCustomerRate
    breakdown.total_guest_brutto = {
      amount: round2(guestPayableRoundedThb / fxCustomerRate),
      currency: payCur,
    }
  } else if (payCur === 'THB') {
    breakdown.total_guest_brutto = {
      amount: guestPayableRoundedThb,
      currency: 'THB',
    }
  }

  return breakdown
}
