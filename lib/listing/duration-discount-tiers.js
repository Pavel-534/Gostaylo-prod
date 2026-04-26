/**
 * Duration ladder discount parsing (listing metadata.discounts).
 * Client-safe: no DB, no Node-only deps — safe to import from `'use client'` modules.
 */

/**
 * @param {Record<string, unknown>} [discounts]
 * @returns {{ minNights: number, percent: number, sourceKey: string }[]}
 */
export function parseDurationDiscountTiers(discounts) {
  if (!discounts || typeof discounts !== 'object' || Array.isArray(discounts)) return []
  const rest = { ...discounts }
  const tiers = []

  if (rest.weekly != null) {
    const pct = parseFloat(rest.weekly)
    if (Number.isFinite(pct) && pct > 0) {
      tiers.push({ minNights: 7, percent: Math.min(100, pct), sourceKey: 'weekly' })
    }
    delete rest.weekly
  }
  if (rest.monthly != null) {
    const pct = parseFloat(rest.monthly)
    if (Number.isFinite(pct) && pct > 0) {
      tiers.push({ minNights: 30, percent: Math.min(100, pct), sourceKey: 'monthly' })
    }
    delete rest.monthly
  }

  for (const [key, raw] of Object.entries(rest)) {
    const pct = parseFloat(raw)
    if (!Number.isFinite(pct) || pct <= 0) continue
    const k = String(key)
    let minNights = null
    const mUnderscore = k.match(/^(\d+)_days?$/i)
    const mPlain = k.match(/^(\d+)$/)
    if (mUnderscore) minNights = parseInt(mUnderscore[1], 10)
    else if (mPlain) minNights = parseInt(mPlain[1], 10)
    if (!minNights || minNights < 1) continue
    tiers.push({ minNights, percent: Math.min(100, pct), sourceKey: k })
  }
  tiers.sort((a, b) => a.minNights - b.minNights)
  return tiers
}

/**
 * Highest percent among tiers where nights >= minNights.
 */
export function computeBestDurationDiscountPercent(nights, tiers) {
  if (!tiers?.length || nights < 1) return 0
  let best = 0
  for (const t of tiers) {
    if (nights >= t.minNights) best = Math.max(best, t.percent)
  }
  return best
}

/**
 * Уровень скидки за длительность, фактически применённый при расчёте (макс. % среди подходящих).
 */
export function getAppliedDurationDiscountTier(nights, tiers, appliedPercent) {
  if (!tiers?.length || !appliedPercent || nights < 1) return null
  const qualifying = tiers.filter((t) => nights >= t.minNights && t.percent === appliedPercent)
  if (!qualifying.length) return null
  return qualifying.reduce((a, b) => (a.minNights >= b.minNights ? a : b))
}

export function applyDurationDiscountToSubtotal(subtotalThb, nights, metadata) {
  const tiers = parseDurationDiscountTiers(metadata?.discounts)
  const pct = computeBestDurationDiscountPercent(nights, tiers)
  const originalPrice = Math.round(subtotalThb)
  const discountAmount = Math.round((originalPrice * pct) / 100)
  const discountedPrice = Math.max(0, originalPrice - discountAmount)
  const appliedTier = getAppliedDurationDiscountTier(nights, tiers, pct)
  return {
    originalPrice,
    discountedPrice,
    durationDiscountPercent: pct,
    durationDiscountAmount: discountAmount,
    durationDiscountTiers: tiers,
    durationDiscountMinNights: appliedTier?.minNights ?? null,
    durationDiscountSourceKey: appliedTier?.sourceKey ?? null,
  }
}
