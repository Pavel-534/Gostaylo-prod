/**
 * SSOT: production / hardened payment environment (Stage 106.2).
 */

export function isProductionPaymentEnvironment() {
  if (String(process.env.VERCEL_ENV || '').trim() === 'production') return true
  if (String(process.env.NODE_ENV || '').trim() === 'production') return true
  return String(process.env.PAYMENT_PRODUCTION_HARDENING || '').trim() === '1'
}
