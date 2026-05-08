function num(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : NaN
}

function pickPercent(raw, fallback, max = 100) {
  return Number.isFinite(raw) && raw >= 0 && raw <= max ? raw : fallback
}

export function buildFinanceSettingsPatch(body, prev = {}) {
  const resolvedTaxRate = pickPercent(num(body?.taxRatePercent), num(prev?.taxRatePercent) || 0)
  const resolvedGuestFee = pickPercent(num(body?.guestServiceFeePercent), num(prev?.guestServiceFeePercent) || 5)
  const resolvedHostCommission = pickPercent(
    num(body?.hostCommissionPercent),
    num(prev?.hostCommissionPercent) || 0,
  )
  const resolvedInsurance = pickPercent(num(body?.insuranceFundPercent), num(prev?.insuranceFundPercent) || 0.5)

  const parsedDelayDays = parseInt(String(body?.settlementPayoutDelayDays ?? ''), 10)
  const parsedPayoutHour = parseInt(String(body?.settlementPayoutHourLocal ?? ''), 10)
  const resolvedPayoutDelayDays =
    Number.isFinite(parsedDelayDays) && parsedDelayDays >= 0 && parsedDelayDays <= 60
      ? parsedDelayDays
      : Number.isFinite(parseInt(String(prev?.settlementPayoutDelayDays ?? ''), 10))
        ? parseInt(String(prev?.settlementPayoutDelayDays ?? ''), 10)
        : 1
  const resolvedPayoutHourLocal =
    Number.isFinite(parsedPayoutHour) && parsedPayoutHour >= 0 && parsedPayoutHour <= 23
      ? parsedPayoutHour
      : Number.isFinite(parseInt(String(prev?.settlementPayoutHourLocal ?? ''), 10))
        ? parseInt(String(prev?.settlementPayoutHourLocal ?? ''), 10)
        : 18

  const parsedWalletMaxDiscountPercent = num(body?.walletMaxDiscountPercent ?? body?.wallet_max_discount_percent)
  const resolvedWalletMaxDiscountPercent = pickPercent(
    parsedWalletMaxDiscountPercent,
    num(prev?.wallet_max_discount_percent ?? prev?.walletMaxDiscountPercent) || 30,
  )

  return {
    taxRatePercent: resolvedTaxRate,
    guestServiceFeePercent: resolvedGuestFee,
    hostCommissionPercent: resolvedHostCommission,
    insuranceFundPercent: resolvedInsurance,
    settlementPayoutDelayDays: resolvedPayoutDelayDays,
    settlementPayoutHourLocal: resolvedPayoutHourLocal,
    walletMaxDiscountPercent: resolvedWalletMaxDiscountPercent,
    wallet_max_discount_percent: resolvedWalletMaxDiscountPercent,
    serviceFeePercent: resolvedGuestFee,
  }
}
