/**
 * Stage 124.20 — shared helpers for in-process acquiring smoke (CARD / MIR).
 */
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  clearSmokeFinancialSessionUserId,
  setSmokeFinancialSessionUserId,
} from '@/lib/smoke/smoke-session-override.js'

/** Dev smoke only — never used on production webhook verify at rest. */
export const SMOKE_WEBHOOK_DEV_SECRET = 'gostaylo-smoke-webhook-dev-only'

export function resolveWebhookSecretForSmoke() {
  const fromEnv =
    String(process.env.YOOKASSA_WEBHOOK_SECRET || '').trim() ||
    String(process.env.PAYMENT_ACQUIRING_WEBHOOK_SECRET || '').trim()
  if (fromEnv) return { secret: fromEnv, source: 'env' }
  if (process.env.SMOKE_FINANCIAL_RUN === '1') {
    return { secret: SMOKE_WEBHOOK_DEV_SECRET, source: 'smoke_dev_fallback' }
  }
  return { secret: '', source: 'missing' }
}

export function signWebhookBody(rawBody, secret) {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

/**
 * Typical YooKassa `payment.succeeded` body for MIR_RU adapter.
 * @param {{ bookingId: string, intentId: string, amount: number, currency: 'RUB' | 'THB' }} p
 */
/**
 * Live test-shop: initiate must expose test mode; optional GET verify (Stage 130.4).
 * @param {object} initiateJson — body from POST payment/initiate
 */
export async function assertYookassaTestShopLiveInitiate(initiateJson) {
  const meta = initiateJson?.data?.metadata || {}
  if (meta.yookassa_test !== true) {
    return {
      ok: false,
      error: `YooKassa test shop: expected metadata.yookassa_test=true, got ${String(meta.yookassa_test)}`,
    }
  }

  const paymentId =
    meta.yookassa_payment_id ||
    (meta.provider_response && typeof meta.provider_response === 'object'
      ? meta.provider_response.id
      : null)

  if (!paymentId || String(paymentId).startsWith('smoke-yk-')) {
    return { ok: false, error: 'live initiate: missing real yookassa_payment_id' }
  }

  const { getPayment } = await import('@/lib/payments/yookassa.js')
  const verified = await getPayment(String(paymentId))
  if (!verified.ok) {
    return {
      ok: false,
      error: verified.code || 'YOOKASSA_GET_FAILED',
      detail: verified.provider,
    }
  }
  if (verified.test !== true) {
    return {
      ok: false,
      error: `GET /payments/${paymentId}: expected test=true (test shop), got test=${verified.test}`,
    }
  }

  return { ok: true, paymentId: String(paymentId), test: true, status: verified.status }
}

export function buildYookassaMirWebhookPayload({ bookingId, intentId, amount, currency }) {
  const value = Number(amount).toFixed(2)
  const cur = String(currency || 'RUB').toUpperCase()
  return {
    event: 'payment.succeeded',
    object: {
      id: `smoke-yk-${Date.now()}`,
      status: 'succeeded',
      paid: true,
      amount: { value, currency: cur },
      metadata: {
        booking_id: String(bookingId),
        payment_intent_id: String(intentId),
      },
    },
  }
}

function applyWebhookSecretEnv(secret, secretSource) {
  const prevYoo = process.env.YOOKASSA_WEBHOOK_SECRET
  const prevAcq = process.env.PAYMENT_ACQUIRING_WEBHOOK_SECRET
  if (secretSource === 'smoke_dev_fallback') {
    process.env.YOOKASSA_WEBHOOK_SECRET = secret
    process.env.PAYMENT_ACQUIRING_WEBHOOK_SECRET = secret
  }
  return { prevYoo, prevAcq, secretSource }
}

function restoreWebhookSecretEnv({ prevYoo, prevAcq, secretSource }) {
  if (secretSource !== 'smoke_dev_fallback') return
  if (prevYoo != null) process.env.YOOKASSA_WEBHOOK_SECRET = prevYoo
  else delete process.env.YOOKASSA_WEBHOOK_SECRET
  if (prevAcq != null) process.env.PAYMENT_ACQUIRING_WEBHOOK_SECRET = prevAcq
  else delete process.env.PAYMENT_ACQUIRING_WEBHOOK_SECRET
}

/**
 * @param {{
 *   bookingId: string,
 *   guestId: string,
 *   method: 'MIR' | 'CARD',
 *   buildWebhookPayload: (ctx: { bookingId: string, intentId: string }) => object,
 *   adapterHeader?: string,
 *   expectLiveCheckout?: boolean,
 * }} params
 */
export async function runAcquiringInitiateAndWebhook({
  bookingId,
  guestId,
  method,
  buildWebhookPayload,
  adapterHeader = 'MIR_RU',
  expectLiveCheckout = false,
}) {
  const id = String(bookingId || '').trim()
  const renterId = String(guestId || '').trim()
  if (!id || !renterId) return { ok: false, error: 'bookingId and guestId required' }

  const { secret, source: secretSource } = resolveWebhookSecretForSmoke()
  if (!secret) {
    return {
      ok: false,
      error:
        'Set YOOKASSA_WEBHOOK_SECRET or PAYMENT_ACQUIRING_WEBHOOK_SECRET in .env.local for acquiring smoke',
    }
  }

  if (process.env.SMOKE_FINANCIAL_RUN !== '1') {
    return { ok: false, error: 'SMOKE_FINANCIAL_RUN=1 required' }
  }

  const envRestore = applyWebhookSecretEnv(secret, secretSource)
  setSmokeFinancialSessionUserId(renterId)

  try {
    const { POST: postInitiate } = await import(
      '@/app/api/v2/bookings/[id]/payment/initiate/route.js'
    )

    const initiateReq = new NextRequest(`http://smoke.local/api/v2/bookings/${id}/payment/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method,
        acceptedLegalTerms: true,
      }),
    })

    const initiateRes = await postInitiate(initiateReq, { params: { id } })
    const initiateJson = await initiateRes.json().catch(() => ({}))

    if (!initiateRes.ok || !initiateJson?.success) {
      return {
        ok: false,
        error:
          initiateJson?.error ||
          initiateJson?.code ||
          `initiate HTTP ${initiateRes.status}`,
      }
    }

    const intentId = initiateJson?.data?.intentId || initiateJson?.data?.id
    if (!intentId) {
      return { ok: false, error: 'initiate: missing intentId in response' }
    }

    const checkoutUrl = String(initiateJson?.data?.checkoutUrl || '')
    const providerMeta = initiateJson?.data?.metadata || {}
    const providerMode = String(providerMeta?.mode || '').toLowerCase()

    if (expectLiveCheckout) {
      if (!checkoutUrl || checkoutUrl.includes('pay.mock.gostaylo')) {
        return {
          ok: false,
          error: `live initiate expected YooKassa checkoutUrl, got mode=${providerMode || 'unknown'} url=${checkoutUrl || '(empty)'}`,
        }
      }
      const testAssert = await assertYookassaTestShopLiveInitiate(initiateJson)
      if (!testAssert.ok) {
        return testAssert
      }
    } else if (checkoutUrl && !checkoutUrl.includes('pay.mock.gostaylo')) {
      // Mock-path smoke may still run against real keys in dev; allow non-mock URL.
    }

    const { data: afterInitiate, error: stErr } = await supabaseAdmin
      .from('bookings')
      .select('status')
      .eq('id', id)
      .maybeSingle()

    if (stErr) return { ok: false, error: stErr.message }
    if (String(afterInitiate?.status || '').toUpperCase() !== 'AWAITING_PAYMENT') {
      return {
        ok: false,
        error: `after initiate expected AWAITING_PAYMENT, got ${afterInitiate?.status}`,
      }
    }

    const webhookPayload = buildWebhookPayload({ bookingId: id, intentId: String(intentId) })
    const rawBody = JSON.stringify(webhookPayload)
    const signature = signWebhookBody(rawBody, secret)

    const { POST: postWebhook } = await import('@/app/api/webhooks/payments/confirm/route.js')
    const webhookReq = new NextRequest('http://smoke.local/api/webhooks/payments/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-yookassa-signature': signature,
        'x-payment-adapter': adapterHeader,
      },
      body: rawBody,
    })

    const webhookRes = await postWebhook(webhookReq)
    const webhookJson = await webhookRes.json().catch(() => ({}))

    if (!webhookRes.ok || webhookJson?.success === false) {
      return {
        ok: false,
        error:
          webhookJson?.error ||
          webhookJson?.code ||
          `webhook HTTP ${webhookRes.status}`,
      }
    }

    return {
      ok: true,
      intentId: String(intentId),
      checkoutUrl,
      providerMode,
      initiateJson,
      webhookJson,
    }
  } finally {
    restoreWebhookSecretEnv(envRestore)
    clearSmokeFinancialSessionUserId()
  }
}
