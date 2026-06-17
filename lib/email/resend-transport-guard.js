/**
 * Stage 155.5 — SSOT: когда НЕ вызывать Resend API (smoke / E2E / тестовые адреса).
 * Smoke 32/32 по-прежнему прогоняет notification handlers; только transport мокается.
 */
import { normalizeCleanupEmail } from '@/lib/e2e/test-user-markers.js'

const TEST_EMAIL_SUFFIXES = ['@smoke.invalid', '@test.gostaylo.invalid']

/**
 * @param {string | string[] | null | undefined} to
 */
export function isResendTestRecipient(to) {
  const list = (Array.isArray(to) ? to : [to]).map((v) => normalizeCleanupEmail(v)).filter(Boolean)
  if (!list.length) return false
  return list.every((email) => {
    if (TEST_EMAIL_SUFFIXES.some((suffix) => email.endsWith(suffix))) return true
    if (email.includes('user-smoke') || email.includes('smoke-guest') || email.includes('smoke-partner')) {
      return true
    }
    return false
  })
}

/**
 * @param {string | string[] | null | undefined} to
 * @param {{ force?: boolean }} [opts]
 */
export function shouldMockResendDelivery(to, opts = {}) {
  if (opts.force === true) return false
  if (process.env.RESEND_FORCE_SEND === '1') return false
  if (process.env.RESEND_MOCK === '1' || process.env.NOTIFICATIONS_EMAIL_MOCK === '1') return true
  if (process.env.SMOKE_FINANCIAL_RUN === '1' || process.env.E2E_TEST_RUN === '1') return true
  return isResendTestRecipient(to)
}

/**
 * @param {string | string[] | null | undefined} to
 * @param {string} subject
 * @param {string} [reason]
 */
export function mockResendDeliveryResult(to, subject, reason = 'guard') {
  const toHint = Array.isArray(to) ? to.join(', ') : String(to || '')
  console.log(`[EMAIL MOCK] skipped Resend (${reason}) To: ${toHint}, Subject: ${String(subject || '').slice(0, 120)}`)
  return { success: true, mock: true, skipped: true, reason }
}
