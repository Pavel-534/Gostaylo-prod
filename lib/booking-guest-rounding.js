/**
 * SSOT guest payable rounding (Stage 97.0.5).
 * - `integer`: Math.round to 1 THB (PricingEngine v2)
 * - `pot10`: legacy ceil to 10 THB (pre-v2)
 */

export const ROUNDING_MODE_INTEGER = 'integer'
export const ROUNDING_MODE_POT10 = 'pot10'

/**
 * @param {number} guestPayableThb
 * @returns {{ roundedGuestTotalThb: number, roundingPotThb: number } | null}
 */
export function roundGuestPayableIntegerThb(guestPayableThb) {
  const raw = Number(guestPayableThb)
  if (!Number.isFinite(raw) || raw < 0) return null
  const roundedGuestTotalThb = Math.round(raw)
  const roundingPotThb = Math.round((roundedGuestTotalThb - raw) * 100) / 100
  return { roundedGuestTotalThb, roundingPotThb }
}

/**
 * @param {number} guestPayableThb
 * @returns {{ roundedGuestTotalThb: number, roundingPotThb: number } | null}
 */
export function roundGuestPayablePot10Thb(guestPayableThb) {
  const total = Math.round(Number(guestPayableThb))
  if (!Number.isFinite(total) || total < 0) return null
  const roundedGuestTotalThb = Math.ceil(total / 10) * 10
  const roundingPotThb = Math.max(0, roundedGuestTotalThb - total)
  return { roundedGuestTotalThb, roundingPotThb }
}

/**
 * @param {number} guestPayableThb
 * @param {'integer' | 'pot10' | string} [mode]
 */
export function computeRoundedGuestTotal(guestPayableThb, mode = ROUNDING_MODE_POT10) {
  if (mode === ROUNDING_MODE_INTEGER) {
    return roundGuestPayableIntegerThb(guestPayableThb)
  }
  return roundGuestPayablePot10Thb(guestPayableThb)
}

/**
 * Server-side rounding mode (booking API, partner manual booking).
 * @returns {Promise<'integer' | 'pot10'>}
 */
export async function getServerGuestRoundingMode() {
  try {
    const { isPricingEngineV2Enabled } = await import('@/lib/pricing-engine/feature-flag.js')
    if (await isPricingEngineV2Enabled()) return ROUNDING_MODE_INTEGER
  } catch {
    /* fallback pot10 */
  }
  return ROUNDING_MODE_POT10
}
