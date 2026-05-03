/**
 * SSOT: `error_code` для `POST /api/v2/promo-codes/validate` и {@link PricingService.validatePromoCode}.
 * Тексты UI — `lib/translations/slices/promo-errors.js`; клиент: `getAuthErrorMessage(code, lang, extras?)`.
 */
import { NextResponse } from 'next/server';

export const PromoErrorCode = Object.freeze({
  PROMO_CODE_REQUIRED: 'PROMO_CODE_REQUIRED',
  PROMO_NOT_FOUND: 'PROMO_NOT_FOUND',
  PROMO_EXPIRED: 'PROMO_EXPIRED',
  PROMO_USAGE_LIMIT_REACHED: 'PROMO_USAGE_LIMIT_REACHED',
  PROMO_LISTING_REQUIRED_FOR_ALLOWLIST: 'PROMO_LISTING_REQUIRED_FOR_ALLOWLIST',
  PROMO_LISTING_OWNER_REQUIRED: 'PROMO_LISTING_OWNER_REQUIRED',
  PROMO_NOT_VALID_FOR_LISTING: 'PROMO_NOT_VALID_FOR_LISTING',
  PROMO_MIN_AMOUNT_NOT_MET: 'PROMO_MIN_AMOUNT_NOT_MET',
  PROMO_INVALID: 'PROMO_INVALID',
  PROMO_RATE_LIMITED: 'PROMO_RATE_LIMITED',
  PROMO_INTERNAL: 'PROMO_INTERNAL',
});

/** @param {string} error_code @param {number} [status] @param {Record<string, unknown>} [extra] */
export function promoErrorJson(error_code, status = 400, extra = {}) {
  return NextResponse.json({ success: false, valid: false, error_code, ...extra }, { status });
}
