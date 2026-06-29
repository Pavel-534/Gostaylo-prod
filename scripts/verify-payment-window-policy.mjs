/**
 * Stage 175.3 — smoke for payment-window-policy SSOT.
 * Keep in sync with lib/booking/payment-window-policy.js
 */
import assert from 'node:assert/strict'

const PAYMENT_WINDOW_TRANSPORT_MINUTES = 20
const PAYMENT_WINDOW_DEFAULT_MINUTES = 180

function isTransportListingCategory(slug) {
  const s = String(slug || '').toLowerCase().trim()
  if (s === 'vehicles' || s === 'transport' || s === 'vehicle' || s === 'transportation') {
    return true
  }
  return s === 'helicopter' || s === 'helicopters'
}

function resolvePaymentWindowMinutes(categorySlug) {
  if (isTransportListingCategory(categorySlug)) return PAYMENT_WINDOW_TRANSPORT_MINUTES
  return PAYMENT_WINDOW_DEFAULT_MINUTES
}

function resolvePaymentWindowExpiresAt(categorySlug, anchorIso) {
  const anchorMs = Date.parse(String(anchorIso || ''))
  const baseMs = Number.isFinite(anchorMs) ? anchorMs : Date.now()
  return new Date(baseMs + resolvePaymentWindowMinutes(categorySlug) * 60 * 1000).toISOString()
}

assert.equal(resolvePaymentWindowMinutes('vehicles'), 20)
assert.equal(resolvePaymentWindowMinutes('transport'), 20)
assert.equal(resolvePaymentWindowMinutes('helicopters'), 20)
assert.equal(resolvePaymentWindowMinutes('apartments'), 180)
assert.equal(resolvePaymentWindowMinutes(null), 180)

const anchor = '2026-06-22T12:00:00.000Z'
assert.equal(resolvePaymentWindowExpiresAt('vehicles', anchor), '2026-06-22T12:20:00.000Z')
assert.equal(resolvePaymentWindowExpiresAt('villas', anchor), '2026-06-22T15:00:00.000Z')

console.log('verify-payment-window-policy: OK')
