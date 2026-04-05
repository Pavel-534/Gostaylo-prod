/**
 * Канон отображения суммы в карточках чата (запрос брони и т.п.):
 * - Туры: итог = цена за единицу (за человека/билет) × размер группы (guests / group_size).
 * - Жильё / транспорт: итог = сумма по ночам/суткам из metadata (basePrice как субтотал периода)
 *   либо дневная ставка × число дней/ночей.
 *
 * Комиссия платформы — отдельная строка (процент из resolveDefaultCommissionPercent / снимка),
 * без скрытых множителей вроде старой наценки 3.5%.
 */

/**
 * @param {string} slug
 * @returns {boolean}
 */
export function isTourCategorySlug(slug) {
  const s = String(slug || '').toLowerCase()
  return s === 'tours' || s.includes('tour')
}

/**
 * @param {object} input
 * @param {Record<string, unknown>} [input.metadata]
 * @param {string} [input.listingCategorySlug]
 * @returns {{ mode: 'tour' | 'stay', unitPriceThb: number, quantity: number, quantityLabelRu: string, quantityLabelEn: string, subtotalThb: number }}
 */
export function resolveChatBookingBreakdown({ metadata = {}, listingCategorySlug = '' }) {
  const meta = metadata && typeof metadata === 'object' ? metadata : {}
  const days = Math.max(1, Number(meta.days) || 1)
  const rawBase = Number(meta.basePrice)
  const rawTotal = Number(meta.totalPrice)
  const groupSize = Math.max(
    1,
    Number(meta.group_size ?? meta.guests_count ?? meta.guestsCount) || 1,
  )

  const tour = isTourCategorySlug(listingCategorySlug)

  if (tour) {
    const subtotal = Number.isFinite(rawTotal) && rawTotal > 0 ? Math.round(rawTotal) : null
    const unitFromMeta = Number.isFinite(rawBase) && rawBase > 0 ? Math.round(rawBase) : null
    let unitPriceThb
    let subtotalThb
    if (subtotal != null && groupSize >= 1) {
      subtotalThb = subtotal
      unitPriceThb =
        unitFromMeta != null
          ? Math.round(unitFromMeta)
          : Math.round(subtotal / groupSize)
    } else if (unitFromMeta != null) {
      unitPriceThb = unitFromMeta
      subtotalThb = Math.round(unitPriceThb * groupSize)
    } else {
      unitPriceThb = 0
      subtotalThb = 0
    }
    return {
      mode: 'tour',
      unitPriceThb,
      quantity: groupSize,
      quantityLabelRu: 'гостей',
      quantityLabelEn: 'guests',
      subtotalThb,
    }
  }

  const subtotal =
    Number.isFinite(rawTotal) && rawTotal > 0
      ? Math.round(rawTotal)
      : Number.isFinite(rawBase) && rawBase > 0
        ? Math.round(rawBase)
        : 0
  const unitPriceThb = days > 0 && subtotal > 0 ? Math.round(subtotal / days) : Math.round(subtotal)

  return {
    mode: 'stay',
    unitPriceThb,
    quantity: days,
    quantityLabelRu: 'дн.',
    quantityLabelEn: 'days',
    subtotalThb: subtotal,
  }
}
