/**
 * Stage 198 — guest pay errors + webhook terminal status helpers
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage198-guest-pay-guard.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('guest pay error messages', () => {
  it('maps fiscal / pause / generic initiate codes to friendly i18n keys', async () => {
    const { resolveGuestPayInitiateI18nKey, resolveGuestPayReturnFailureCopy, isWebhookTerminalNonPaidStatus } =
      await import('../lib/checkout/guest-pay-error-messages.js')

    assert.equal(resolveGuestPayInitiateI18nKey({ code: 'FISCAL_NOT_CONFIGURED' }), 'checkout_toast_payBlockedFiscal')
    assert.equal(resolveGuestPayInitiateI18nKey({ code: 'EMERGENCY_PAUSE' }), 'checkout_toast_payBlockedPause')
    assert.equal(
      resolveGuestPayInitiateI18nKey({ code: 'SOMETHING_UNKNOWN' }),
      'checkout_toast_paymentInitFailFriendly',
    )

    assert.equal(resolveGuestPayReturnFailureCopy('FAILED').reason, 'declined')
    assert.equal(resolveGuestPayReturnFailureCopy('CANCELLED').reason, 'canceled')
    assert.equal(resolveGuestPayReturnFailureCopy('', { timedOut: true }).reason, 'timeout')

    assert.equal(isWebhookTerminalNonPaidStatus('CANCELLED'), true)
    assert.equal(isWebhookTerminalNonPaidStatus('PAID'), false)
  })

  it('status-normalizer exposes terminal non-paid helper', async () => {
    const { isIntentTerminalNonPaidStatus, isIntentPaidStatus, normalizeProviderStatus } = await import(
      '../lib/services/payment-adapters/status-normalizer.js'
    )
    assert.equal(isIntentPaidStatus('PAID'), true)
    assert.equal(isIntentTerminalNonPaidStatus('CANCELLED'), true)
    assert.equal(
      normalizeProviderStatus({
        adapterKey: 'MIR_RU',
        payload: { event: 'payment.canceled', object: { status: 'canceled' } },
      }),
      'CANCELLED',
    )
    assert.equal(
      normalizeProviderStatus({
        adapterKey: 'MIR_RU',
        payload: { event: 'payment.succeeded', object: { status: 'succeeded' } },
      }),
      'PAID',
    )
  })
})
