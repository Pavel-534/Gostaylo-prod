/**
 * Stage 125.1 — smoke: payments/confirm returns 2xx idempotent on past-escrow booking (THAWED / COMPLETED).
 */
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildYookassaMirWebhookPayload,
  resolveWebhookSecretForSmoke,
  signWebhookBody,
} from '@/lib/smoke/checkout-acquiring-smoke-shared.js'

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
import { isPaymentAcquiringWebhookIdempotentBookingStatus } from '@/lib/booking/status-sets.js'

/**
 * @param {{ bookingId: string, guestTotalThb: number, intentId?: string }} params
 */
async function postPaymentsConfirmWebhook({ bookingId, guestTotalThb, intentId }) {
  const { secret } = resolveWebhookSecretForSmoke()
  if (!secret) {
    return { ok: false, error: 'webhook secret missing for smoke' }
  }

  let pi = intentId
  if (!pi) {
    const { data: row, error } = await supabaseAdmin
      .from('payment_intents')
      .select('id')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    pi = row?.id
  }
  if (!pi) return { ok: false, error: 'no payment_intent for booking' }

  const webhookPayload = buildYookassaMirWebhookPayload({
    bookingId,
    intentId: String(pi),
    amount: guestTotalThb,
    currency: 'THB',
  })
  const rawBody = JSON.stringify(webhookPayload)
  const signature = signWebhookBody(rawBody, secret)

  const { POST: postWebhook } = await import('@/app/api/webhooks/payments/confirm/route.js')
  const webhookReq = new NextRequest('http://smoke.local/api/webhooks/payments/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-yookassa-signature': signature,
      'x-payment-adapter': 'MIR_RU',
    },
    body: rawBody,
  })

  const webhookRes = await postWebhook(webhookReq)
  const webhookJson = await webhookRes.json().catch(() => ({}))
  return { ok: true, status: webhookRes.status, webhookJson }
}

/**
 * @param {{ bookingId: string, guestTotalThb: number }} params
 */
export async function runPaymentsConfirmPastEscrowStep({ bookingId, guestTotalThb }) {
  const id = String(bookingId || '').trim()
  if (!id) return { ok: false, error: 'bookingId required' }
  if (process.env.SMOKE_FINANCIAL_RUN !== '1') {
    return { ok: false, error: 'SMOKE_FINANCIAL_RUN=1 required' }
  }

  const { secret, source: secretSource } = resolveWebhookSecretForSmoke()
  if (!secret) {
    return {
      ok: false,
      error: 'Set YOOKASSA_WEBHOOK_SECRET or PAYMENT_ACQUIRING_WEBHOOK_SECRET for smoke',
    }
  }
  const envRestore = applyWebhookSecretEnv(secret, secretSource)

  try {
  const { data: thawed, error: readErr } = await supabaseAdmin
    .from('bookings')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  if (readErr) return { ok: false, error: readErr.message }
  const st = String(thawed?.status || '').toUpperCase()
  if (st !== 'THAWED') {
    return { ok: false, error: `expected THAWED before past-escrow webhook test, got ${st}` }
  }

  const thawRetry = await postPaymentsConfirmWebhook({ bookingId: id, guestTotalThb })
  if (!thawRetry.ok) return thawRetry
  if (thawRetry.status !== 200 || !thawRetry.webhookJson?.success) {
    return {
      ok: false,
      error: `THAWED webhook: HTTP ${thawRetry.status} ${JSON.stringify(thawRetry.webhookJson)}`,
    }
  }
  if (!thawRetry.webhookJson?.idempotent || !thawRetry.webhookJson?.alreadyProcessed) {
    return {
      ok: false,
      error: `THAWED webhook: expected idempotent+alreadyProcessed, got ${JSON.stringify(thawRetry.webhookJson)}`,
    }
  }

  const completedAt = new Date().toISOString()
  const { error: upErr } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'COMPLETED',
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq('id', id)

  if (upErr) return { ok: false, error: upErr.message }

  const completedRetry = await postPaymentsConfirmWebhook({ bookingId: id, guestTotalThb })
  if (!completedRetry.ok) return completedRetry
  if (completedRetry.status !== 200 || !completedRetry.webhookJson?.success) {
    return {
      ok: false,
      error: `COMPLETED webhook: HTTP ${completedRetry.status} ${JSON.stringify(completedRetry.webhookJson)}`,
    }
  }
  if (!completedRetry.webhookJson?.idempotent || !completedRetry.webhookJson?.alreadyProcessed) {
    return {
      ok: false,
      error: `COMPLETED webhook: expected idempotent flags, got ${JSON.stringify(completedRetry.webhookJson)}`,
    }
  }

  if (!isPaymentAcquiringWebhookIdempotentBookingStatus('COMPLETED')) {
    return { ok: false, error: 'status-sets: COMPLETED must be idempotent for acquiring webhook' }
  }

  return {
    ok: true,
    detail: 'payments/confirm 2xx on THAWED + COMPLETED (no markPaid/moveToEscrow)',
  }
  } finally {
    restoreWebhookSecretEnv(envRestore)
  }
}
