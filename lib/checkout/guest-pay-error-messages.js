/**
 * Stage 198 — Guest-facing payment error copy (checkout initiate + return).
 * Maps API / intent codes to i18n keys; UI resolves via getUIText.
 */

/** @typedef {'generic'|'declined'|'canceled'|'timeout'|'insufficient'|'blocked'|'retry'} GuestPayFailReason */

/**
 * @param {{ code?: string|null, error?: string|null, error_code?: string|null }} data
 * @returns {string} i18n key under checkout_*
 */
export function resolveGuestPayInitiateI18nKey(data = {}) {
  const code = String(data?.code || data?.error_code || data?.error || '')
    .trim()
    .toUpperCase()

  if (code === 'BOOKING_NOT_PAYABLE') return 'checkout_error_notPayable'
  if (code === 'LEGAL_CONSENT_REQUIRED' || code === 'LEGAL_CONSENT_REQUIRED_FOR_PAYMENT') {
    return 'checkout_legalConsentRequiredToast'
  }
  if (code === 'FISCAL_NOT_CONFIGURED' || code === 'FISCAL_SANDBOX_BLOCKED') {
    return 'checkout_toast_payBlockedFiscal'
  }
  if (code === 'EMERGENCY_PAUSE') return 'checkout_toast_payBlockedPause'
  if (
    code === 'MOCK_ENV_ON_PRODUCTION' ||
    code === 'MOCK_PAYMENT_BLOCKED' ||
    code === 'TREASURY_MANUAL_MODE_REQUIRED'
  ) {
    return 'checkout_toast_payBlockedOps'
  }
  if (code === 'HOST_PAYOUT_NOT_READY' || code === 'PARTNER_PAYOUT_GATE') {
    return 'checkout_toast_payBlockedPartner'
  }
  if (code.startsWith('PROMO_') || code.includes('PROMO')) {
    return 'checkout_toast_promoInvalid'
  }
  if (code === 'YOOKASSA_NOT_CONFIGURED' || code === 'ACQUIRER_NOT_CONFIGURED') {
    return 'checkout_toast_acquiringNotConfigured'
  }
  if (
    code === 'CHECKOUT_HOLD_EXPIRED' ||
    code === 'INVOICE_PAYMENT_WINDOW_EXPIRED'
  ) {
    return 'checkout_toast_holdExpired'
  }
  return 'checkout_toast_paymentInitFailFriendly'
}

/**
 * @param {'FAILED'|'CANCELLED'|'EXPIRED'|string} intentStatus
 * @param {{ timedOut?: boolean }} [opts]
 * @returns {{ reason: GuestPayFailReason, titleKey: string, bodyKey: string }}
 */
export function resolveGuestPayReturnFailureCopy(intentStatus, opts = {}) {
  if (opts.timedOut) {
    return {
      reason: 'timeout',
      titleKey: 'checkout_failedTitleTimeout',
      bodyKey: 'checkout_failedBodyTimeout',
    }
  }
  const st = String(intentStatus || '').trim().toUpperCase()
  if (st === 'CANCELLED') {
    return {
      reason: 'canceled',
      titleKey: 'checkout_failedTitleCanceled',
      bodyKey: 'checkout_failedBodyCanceled',
    }
  }
  if (st === 'EXPIRED') {
    return {
      reason: 'timeout',
      titleKey: 'checkout_failedTitleTimeout',
      bodyKey: 'checkout_failedBodyTimeout',
    }
  }
  if (st === 'FAILED') {
    return {
      reason: 'declined',
      titleKey: 'checkout_failedTitleDeclined',
      bodyKey: 'checkout_failedBodyDeclined',
    }
  }
  return {
    reason: 'generic',
    titleKey: 'checkout_failedTitle',
    bodyKey: 'checkout_failedBody',
  }
}

/**
 * @param {unknown} normalizedStatus
 */
export function isWebhookTerminalNonPaidStatus(normalizedStatus) {
  const st = String(normalizedStatus || '').trim().toUpperCase()
  return st === 'FAILED' || st === 'CANCELLED' || st === 'EXPIRED'
}
