/**
 * Stage 106.1–106.2 — P0 hardening: production payment gates (no mock, fiscal, treasury).
 */

import { verifyTronTransaction } from '@/lib/services/tron.service.js'
import { getGuestPayableRoundedThb } from '@/lib/booking-guest-total.js'
import { resolveThbPerUsdt } from '@/lib/services/currency.service.js'
import { isFiscalSandboxEnabled } from '@/lib/pricing-engine/fiscal-config.js'
import { loadTreasuryOpsSettings } from '@/lib/treasury/treasury-ops-config.js'
import { isProductionPaymentEnvironment } from '@/lib/payment/production-env.js'

/** Intent paid only via server-side gateway paths (never client confirm). */
export const GATEWAY_CONFIRMED_SOURCES = new Set([
  'payment_acquiring_webhook',
  'crypto_webhook',
  'crypto_webhook_intent',
  'verify_tron_api',
])

export { isProductionPaymentEnvironment } from '@/lib/payment/production-env.js'

/** Mock acquiring sessions only outside production (or explicit override). */
export function allowMockAcquiringSessions() {
  if (isProductionPaymentEnvironment()) return false
  if (String(process.env.PAYMENT_ALLOW_MOCK_ACQUIRING || '').trim() === '1') return true
  return true
}

/** Any mock payment/fiscal/crypto path must be off on production. */
export function isProductionMockEnvBlocked() {
  if (!isProductionPaymentEnvironment()) return false
  if (String(process.env.PAYMENT_ALLOW_MOCK_ACQUIRING || '').trim() === '1') return true
  if (String(process.env.NEXT_PUBLIC_CHECKOUT_MOCK_ACQUIRING || '').trim() === '1') return true
  if (String(process.env.FISCAL_SANDBOX || '').trim() === '1') return true
  if (String(process.env.CRYPTO_PAYMENT_MOCK || '').trim() === '1') return true
  return false
}

export function normalizeCheckoutPaymentMethod(method) {
  const m = String(method || '').toUpperCase().trim()
  if (m === 'MIR' || m === 'CARD_RU') return 'MIR'
  if (m === 'CARD' || m === 'CARD_INTL') return 'CARD'
  if (m === 'CRYPTO' || m === 'USDT' || m === 'USDT_TRC20') return 'CRYPTO'
  return m || 'CARD'
}

export function isIntentGatewayConfirmed(intent) {
  if (!intent) return false
  if (String(intent.status || '').toUpperCase() !== 'PAID') return false
  const src = String(intent?.metadata?.paid_event?.source || '').trim()
  return GATEWAY_CONFIRMED_SOURCES.has(src)
}

function isMockIntent(intent) {
  const mode = String(intent?.metadata?.provider_payload?.mode || '').toLowerCase()
  return mode.includes('mock')
}

/**
 * Fiscal readiness for accepting real guest payments (Stage 106.2).
 */
export function getFiscalProductionGate() {
  if (!isProductionPaymentEnvironment()) {
    return { ok: true, skipped: true }
  }
  const url = String(process.env.FISCAL_PROVIDER_URL || '').trim()
  if (!url) {
    return {
      ok: false,
      code: 'FISCAL_NOT_CONFIGURED',
      message:
        'Приём платежей временно недоступен: не настроена онлайн-касса (54-ФЗ). Укажите FISCAL_PROVIDER_URL в настройках сервера и повторите.',
    }
  }
  if (isFiscalSandboxEnabled()) {
    return {
      ok: false,
      code: 'FISCAL_SANDBOX_BLOCKED',
      message:
        'Приём платежей заблокирован: на production нельзя использовать тестовую кассу (FISCAL_SANDBOX).',
    }
  }
  return { ok: true }
}

/**
 * Gate for initiate / confirm — owner-friendly messages (Stage 106.2).
 */
export async function assertGuestPaymentOperationsAllowed() {
  const ops = await loadTreasuryOpsSettings()

  if (ops.emergencyPause?.active) {
    return {
      allowed: false,
      code: 'EMERGENCY_PAUSE',
      message:
        ops.emergencyPause.reason ||
        'Платформа на паузе: новые оплаты временно недоступны. Снимите Emergency Pause в финансовом пульте, когда будете готовы.',
    }
  }

  if (isProductionMockEnvBlocked()) {
    return {
      allowed: false,
      code: 'MOCK_ENV_ON_PRODUCTION',
      message:
        'На production включён тестовый режим оплаты (mock). Отключите PAYMENT_ALLOW_MOCK_ACQUIRING, NEXT_PUBLIC_CHECKOUT_MOCK_ACQUIRING и FISCAL_SANDBOX.',
    }
  }

  if (isProductionPaymentEnvironment()) {
    const fiscal = getFiscalProductionGate()
    if (!fiscal.ok) {
      return { allowed: false, code: fiscal.code, message: fiscal.message }
    }

    if (ops.treasuryManualMode === false) {
      return {
        allowed: false,
        code: 'TREASURY_MANUAL_MODE_REQUIRED',
        message:
          'Приём платежей заблокирован: включите ручной режим казначейства (TREASURY_MANUAL_MODE=1). Так вы контролируете выплаты партнёрам вручную — без автоматических пулов.',
      }
    }
  }

  return { allowed: true, ops }
}

async function expectedUsdtForBooking(booking) {
  const totalThb = getGuestPayableRoundedThb(booking)
  if (!Number.isFinite(totalThb) || totalThb <= 0) return null
  const rate = await resolveThbPerUsdt()
  if (!Number.isFinite(rate) || rate <= 0) return null
  return Math.round((totalThb / rate) * 100) / 100
}

export async function assertClientPaymentConfirmAllowed({
  intent = null,
  paymentMethod = null,
  txId = null,
  booking = null,
}) {
  const opsGate = await assertGuestPaymentOperationsAllowed()
  if (!opsGate.allowed) {
    return { allowed: false, code: opsGate.code, message: opsGate.message }
  }

  const method = normalizeCheckoutPaymentMethod(
    paymentMethod || intent?.metadata?.selected_method || intent?.preferredMethod,
  )

  if (!isProductionPaymentEnvironment()) {
    if (intent && isMockIntent(intent)) {
      return { allowed: true, mode: 'dev_mock' }
    }
    return { allowed: true, mode: 'non_production' }
  }

  if (String(process.env.PAYMENT_ALLOW_CLIENT_CONFIRM || '').trim() === '1') {
    return { allowed: true, mode: 'env_override' }
  }

  if (intent && isMockIntent(intent)) {
    return {
      allowed: false,
      code: 'MOCK_PAYMENT_BLOCKED',
      message: 'Payment not confirmed by gateway',
    }
  }

  if (isIntentGatewayConfirmed(intent)) {
    return { allowed: true, mode: 'gateway_paid', skipClientMarkPaid: true }
  }

  if (method === 'CRYPTO' && txId) {
    const expectedUsdt = await expectedUsdtForBooking(booking)
    if (expectedUsdt == null) {
      return {
        allowed: false,
        code: 'CRYPTO_AMOUNT_UNAVAILABLE',
        message: 'Payment not confirmed by gateway',
      }
    }
    const verification = await verifyTronTransaction(String(txId), expectedUsdt)
    if (verification.success) {
      return {
        allowed: true,
        mode: 'crypto_tx_verified',
        tron: verification.data,
        skipClientMarkPaid: false,
      }
    }
    return {
      allowed: false,
      code: 'CRYPTO_NOT_VERIFIED',
      message: 'Payment not confirmed by gateway',
      detail: verification.error || verification.status,
    }
  }

  if (method === 'CARD' || method === 'MIR') {
    return {
      allowed: false,
      code: 'PAYMENT_NOT_CONFIRMED_BY_GATEWAY',
      message: 'Payment not confirmed by gateway',
    }
  }

  return {
    allowed: false,
    code: 'PAYMENT_NOT_CONFIRMED_BY_GATEWAY',
    message: 'Payment not confirmed by gateway',
  }
}
