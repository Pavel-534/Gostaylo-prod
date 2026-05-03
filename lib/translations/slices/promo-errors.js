/**
 * Ключи = `error_code` из `POST /api/v2/promo-codes/validate` и {@link PricingService.validatePromoCode}.
 * Текст через `getAuthErrorMessage(code, lang, { minAmountThb })` для `PROMO_MIN_AMOUNT_NOT_MET` (плейсхолдер `{minAmount}`).
 */

export const promoErrorsUi = {
  ru: {
    PROMO_INVALID: 'Промокод недействителен.',
    PROMO_CODE_REQUIRED: 'Укажите промокод.',
    PROMO_NOT_FOUND: 'Промокод не найден.',
    PROMO_EXPIRED: 'Срок действия промокода истёк.',
    PROMO_USAGE_LIMIT_REACHED: 'Лимит использований промокода исчерпан.',
    PROMO_LISTING_REQUIRED_FOR_ALLOWLIST:
      'Этот промо для выбранных объявлений — откройте оплату со страницы объявления.',
    PROMO_LISTING_OWNER_REQUIRED:
      'Этот промо для конкретного объявления — откройте оплату со страницы объявления.',
    PROMO_NOT_VALID_FOR_LISTING: 'Промокод не подходит к этому объявлению.',
    PROMO_MIN_AMOUNT_NOT_MET: 'Минимальная сумма брони для этого промокода: {minAmount} THB.',
    PROMO_RATE_LIMITED: 'Слишком много проверок промокода. Подождите и попробуйте снова.',
    PROMO_INTERNAL: 'Не удалось проверить промокод.',
  },
  en: {
    PROMO_INVALID: 'This promo code is not valid.',
    PROMO_CODE_REQUIRED: 'Enter a promo code.',
    PROMO_NOT_FOUND: 'Promo code not found.',
    PROMO_EXPIRED: 'This promo code has expired.',
    PROMO_USAGE_LIMIT_REACHED: 'This promo code has reached its usage limit.',
    PROMO_LISTING_REQUIRED_FOR_ALLOWLIST:
      'This promo applies to selected listings — open checkout from the listing page.',
    PROMO_LISTING_OWNER_REQUIRED:
      'This promo applies to a specific listing — open checkout from the listing page.',
    PROMO_NOT_VALID_FOR_LISTING: 'This promo code is not valid for this listing.',
    PROMO_MIN_AMOUNT_NOT_MET: 'Minimum booking amount for this promo: {minAmount} THB.',
    PROMO_RATE_LIMITED: 'Too many promo checks. Please wait and try again.',
    PROMO_INTERNAL: 'Could not validate the promo code.',
  },
  zh: {
    PROMO_INVALID: '优惠码无效。',
    PROMO_CODE_REQUIRED: '请输入优惠码。',
    PROMO_NOT_FOUND: '未找到该优惠码。',
    PROMO_EXPIRED: '优惠码已过期。',
    PROMO_USAGE_LIMIT_REACHED: '优惠码使用次数已达上限。',
    PROMO_LISTING_REQUIRED_FOR_ALLOWLIST: '此优惠仅适用于部分房源 — 请从房源页进入结账。',
    PROMO_LISTING_OWNER_REQUIRED: '此优惠仅适用于指定房源 — 请从房源页进入结账。',
    PROMO_NOT_VALID_FOR_LISTING: '此优惠码不适用于该房源。',
    PROMO_MIN_AMOUNT_NOT_MET: '使用此优惠的最低预订金额：{minAmount} THB。',
    PROMO_RATE_LIMITED: '验证次数过多，请稍后再试。',
    PROMO_INTERNAL: '无法验证优惠码。',
  },
  th: {
    PROMO_INVALID: 'รหัสโปรโมชันไม่ถูกต้อง',
    PROMO_CODE_REQUIRED: 'กรุณากรอกรหัสโปรโมชัน',
    PROMO_NOT_FOUND: 'ไม่พบรหัสโปรโมชัน',
    PROMO_EXPIRED: 'รหัสโปรโมชันหมดอายุแล้ว',
    PROMO_USAGE_LIMIT_REACHED: 'รหัสโปรโมชันถึงขีดจำกัดการใช้งานแล้ว',
    PROMO_LISTING_REQUIRED_FOR_ALLOWLIST:
      'โปรนี้ใช้กับบางประกาศ — เปิดชำระเงินจากหน้าประกาศ',
    PROMO_LISTING_OWNER_REQUIRED: 'โปรนี้ใช้กับประกาศเฉพาะ — เปิดชำระเงินจากหน้าประกาศ',
    PROMO_NOT_VALID_FOR_LISTING: 'รหัสโปรโมชันนี้ใช้กับประกาศนี้ไม่ได้',
    PROMO_MIN_AMOUNT_NOT_MET: 'ยอดจองขั้นต่ำสำหรับโปรนี้: {minAmount} THB',
    PROMO_RATE_LIMITED: 'ตรวจสอบรหัสบ่อยเกินไป โปรดรอแล้วลองใหม่',
    PROMO_INTERNAL: 'ตรวจสอบรหัสโปรโมชันไม่สำเร็จ',
  },
};
