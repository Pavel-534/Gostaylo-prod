import { supabaseAdmin } from '@/lib/supabase'
import { checkApplicabilityCached, calculatePromoDiscountAmount } from '@/lib/promo/promo-engine'
import { PromoErrorCode } from '@/lib/promo/promo-error-codes'

export async function validatePromoCode(code, bookingAmount, ctx = {}) {
  const normalizedCode = String(code || '').trim().toUpperCase()
  const { data: promo, error } = await supabaseAdmin
    .from('promo_codes')
    .select('*')
    .eq('code', normalizedCode)
    .eq('is_active', true)
    .single()

  if (error || !promo) {
    return { valid: false, error_code: PromoErrorCode.PROMO_NOT_FOUND }
  }

  const applicability = checkApplicabilityCached(promo, {
    mode: 'booking',
    listingId: ctx.listingId ?? null,
    listingOwnerId: ctx.listingOwnerId ?? null,
  })
  if (!applicability.ok) {
    switch (applicability.reason) {
      case 'LISTING_REQUIRED_FOR_ALLOWLIST':
        return { valid: false, error_code: PromoErrorCode.PROMO_LISTING_REQUIRED_FOR_ALLOWLIST }
      case 'LISTING_OWNER_REQUIRED':
        return { valid: false, error_code: PromoErrorCode.PROMO_LISTING_OWNER_REQUIRED }
      case 'EXPIRED':
        return { valid: false, error_code: PromoErrorCode.PROMO_EXPIRED }
      case 'USAGE_LIMIT_REACHED':
        return { valid: false, error_code: PromoErrorCode.PROMO_USAGE_LIMIT_REACHED }
      case 'LISTING_NOT_ALLOWED':
      case 'LISTING_OWNER_MISMATCH':
        return { valid: false, error_code: PromoErrorCode.PROMO_NOT_VALID_FOR_LISTING }
      default:
        return { valid: false, error_code: PromoErrorCode.PROMO_INVALID }
    }
  }

  if (promo.min_amount && bookingAmount < parseFloat(promo.min_amount)) {
    const minThb = parseFloat(promo.min_amount)
    return {
      valid: false,
      error_code: PromoErrorCode.PROMO_MIN_AMOUNT_NOT_MET,
      min_amount_thb: Number.isFinite(minThb) ? minThb : promo.min_amount,
    }
  }

  const discountAmount = calculatePromoDiscountAmount(promo, bookingAmount)
  const flashSale = promo.is_flash_sale === true
  let promoEndsAt = null
  let secondsRemaining = null
  if (flashSale && promo.valid_until) {
    const endMs = new Date(promo.valid_until).getTime()
    if (Number.isFinite(endMs)) {
      promoEndsAt = new Date(promo.valid_until).toISOString()
      secondsRemaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000))
    }
  }

  return {
    valid: true,
    code: promo.code,
    type: promo.promo_type,
    value: parseFloat(promo.value),
    discountAmount,
    newTotal: bookingAmount - discountAmount,
    flashSale,
    promoEndsAt: flashSale ? promoEndsAt : null,
    secondsRemaining: flashSale ? secondsRemaining : null,
  }
}
