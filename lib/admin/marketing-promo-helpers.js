/** Stage 110.7 — хелперы админ-страницы маркетинга (промокоды). */

export function promoExpiryEndMs(promo) {
  if (promo?.validUntilIso) return new Date(promo.validUntilIso).getTime()
  if (promo?.expiryDate) return new Date(`${promo.expiryDate}T23:59:59.999Z`).getTime()
  return NaN
}

export function isPlatformPromoCritical(promo) {
  if (String(promo.createdByType || '').toUpperCase() !== 'PLATFORM') return false
  const limit = promo.usageLimit
  if (limit == null || limit <= 0) return false
  if (!promo.isActive) return false
  const end = promoExpiryEndMs(promo)
  if (Number.isFinite(end) && end < Date.now()) return false
  const used = Number(promo.usedCount) || 0
  return used / limit >= 0.9
}
