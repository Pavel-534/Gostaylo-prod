/**
 * Stage 188.2 — ambassador hub display amounts (ledger THB hidden from non-THB users).
 * Mid-market rateMap (same as `useFxRatesQuery({ retail: false })`).
 */

import { convertAmountThbWithMap } from '@/lib/finance/currency-converter-shared'
import { convertDisplayAmountToThb } from '@/lib/pricing/fx-display-client'
import { formatNativeAmountInCurrency } from '@/lib/currency'

/** RUB → nearest 100; USD/USDT → whole units; THB → whole baht. */
export function roundAmbassadorDisplayAmount(amount, currencyCode) {
  const code = String(currencyCode || 'THB').toUpperCase()
  const n = Number(amount)
  if (!Number.isFinite(n)) return 0
  if (code === 'RUB') return Math.round(n / 100) * 100
  if (code === 'USD' || code === 'USDT') return Math.round(n)
  return Math.round(n)
}

export function convertThbToAmbassadorDisplayRounded(thb, currencyCode, rateMap) {
  const code = String(currencyCode || 'THB').toUpperCase()
  const thbN = Number(thb)
  if (!Number.isFinite(thbN)) return 0
  if (code === 'THB') return roundAmbassadorDisplayAmount(thbN, 'THB')
  const rates = rateMap && typeof rateMap === 'object' ? { THB: 1, ...rateMap } : { THB: 1 }
  const raw = convertAmountThbWithMap(thbN, code, rates)
  if (!Number.isFinite(raw)) return 0
  return roundAmbassadorDisplayAmount(raw, code)
}

export function convertAmbassadorDisplayToThb(displayAmount, currencyCode, rateMap) {
  const code = String(currencyCode || 'THB').toUpperCase()
  const a = Number(displayAmount)
  if (!Number.isFinite(a) || a <= 0) return 0
  if (code === 'THB') return Math.round(a)
  const rates = rateMap && typeof rateMap === 'object' ? { THB: 1, ...rateMap } : { THB: 1 }
  return convertDisplayAmountToThb(a, code, rates)
}

/** Default tolerance: snap to min when converted THB is within 2% below floor. */
export const AMBASSADOR_MIN_PAYOUT_SNAP_TOLERANCE = 0.02

/**
 * Display → THB with min-payout guard (Stage 188.3).
 * Exact match to rounded min display → snap to minThb; within tolerance below min → ceil to minThb.
 */
export function convertAmbassadorDisplayToThbGuarded(
  displayAmount,
  currencyCode,
  rateMap,
  minPayoutThb,
  tolerance = AMBASSADOR_MIN_PAYOUT_SNAP_TOLERANCE,
) {
  const minThb = Number(minPayoutThb)
  const rawThb = convertAmbassadorDisplayToThb(displayAmount, currencyCode, rateMap)
  if (!Number.isFinite(minThb) || minThb <= 0) return rawThb

  const minDisplay = convertThbToAmbassadorDisplayRounded(minThb, currencyCode, rateMap)
  const displayNum = Number(displayAmount)
  if (Number.isFinite(displayNum) && Number.isFinite(minDisplay) && displayNum === minDisplay) {
    return minThb
  }

  if (Number.isFinite(rawThb) && rawThb > 0 && rawThb < minThb) {
    const gapRatio = (minThb - rawThb) / minThb
    if (gapRatio <= tolerance) return minThb
  }

  return rawThb
}

/** THB ledger → formatted string in header currency only (no THB leak, no ≈). */
export function formatAmbassadorAmountFromThb(thb, currencyCode, rateMap, language = 'en') {
  const code = String(currencyCode || 'THB').toUpperCase()
  const display = convertThbToAmbassadorDisplayRounded(thb, code, rateMap)
  return formatNativeAmountInCurrency(display, code, language)
}

/** Alias — ledger lines use the same single-currency format (Stage 188.2). */
export function formatAmbassadorAmountLineFromThb(thb, currencyCode, rateMap, language = 'en') {
  return formatAmbassadorAmountFromThb(thb, currencyCode, rateMap, language)
}
