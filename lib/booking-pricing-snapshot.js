/**
 * Замороженный снимок цены в момент бронирования (для БД и metadata сообщений).
 */

/**
 * @param {object} priceCalc — результат PricingService.calculateBookingPrice
 * @param {number} listingBasePriceThb
 * @param {{ promoCodeUsed?: string | null, promoExtraDiscountThb?: number, promoFlashSale?: boolean, taxRate?: number, taxAmountThb?: number }} [extra]
 */
export function buildBookingPricingSnapshot(priceCalc, listingBasePriceThb, extra = {}) {
  if (!priceCalc || priceCalc.error) return {}

  const nights = priceCalc.nights ?? 0
  const orig = priceCalc.originalPrice ?? 0
  const durAmt = priceCalc.durationDiscountAmount ?? 0
  const durPct = priceCalc.durationDiscountPercent ?? 0
  const minN = priceCalc.durationDiscountMinNights ?? null
  const src = priceCalc.durationDiscountSourceKey ?? null

  const captionRu = formatDurationDiscountCaptionRu(minN, durPct, durAmt)
  const captionEn = formatDurationDiscountCaptionEn(minN, durPct, durAmt)

  const snapshot = {
    v: 1,
    computed_at: new Date().toISOString(),
    nights,
    listing_base_price_thb: Number(listingBasePriceThb) || 0,
    subtotal_before_duration_discount_thb: orig,
    accommodation_total_after_duration_thb: priceCalc.totalPrice ?? orig - durAmt,
    duration_discount: durAmt
      ? {
          percent: durPct,
          amount_thb: durAmt,
          min_nights_threshold: minN,
          source_key: src,
          caption_ru: captionRu,
          caption_en: captionEn,
        }
      : null,
  }

  if (extra.promoCodeUsed) {
    snapshot.promo = {
      code: extra.promoCodeUsed,
      extra_discount_thb: Math.max(0, Number(extra.promoExtraDiscountThb) || 0),
      ...(extra.promoFlashSale === true ? { is_flash_sale: true } : {}),
    }
  }

  const tr = Number(extra.taxRate)
  const ta = Number(extra.taxAmountThb)
  snapshot.tax = {
    rate_percent: Number.isFinite(tr) && tr >= 0 ? tr : 0,
    amount_thb: Number.isFinite(ta) && ta >= 0 ? Math.round(ta) : 0,
  }

  return snapshot
}

function formatDurationDiscountCaptionRu(minNights, percent, amountThb) {
  const amt = Math.round(Number(amountThb) || 0)
  if (!percent || !amt) return null
  if (minNights) {
    return `Скидка за ${minNights}+ ночей (${percent}%): −฿${amt.toLocaleString('ru-RU')}`
  }
  return `Скидка за длительность (${percent}%): −฿${amt.toLocaleString('ru-RU')}`
}

function formatDurationDiscountCaptionEn(minNights, percent, amountThb) {
  const amt = Math.round(Number(amountThb) || 0)
  if (!percent || !amt) return null
  if (minNights) {
    return `${minNights}+ nights discount (${percent}%): −฿${amt.toLocaleString('en-US')}`
  }
  return `Length-of-stay discount (${percent}%): −฿${amt.toLocaleString('en-US')}`
}
