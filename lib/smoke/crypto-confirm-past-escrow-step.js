/**
 * Stage 125.4 — smoke: crypto/confirm returns 2xx idempotent on post-escrow booking (COMPLETED).
 */
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isPaymentAcquiringWebhookIdempotentBookingStatus } from '@/lib/booking/status-sets.js'

/** Dev smoke only — never used on production webhook verify at rest. */
export const SMOKE_CRYPTO_WEBHOOK_DEV_SECRET = 'gostaylo-smoke-crypto-webhook-dev-only'

const FAKE_TXID = 'b'.repeat(64)

export function resolveCryptoWebhookSecretForSmoke() {
  const fromEnv = String(process.env.CRYPTO_WEBHOOK_SHARED_SECRET || '').trim()
  if (fromEnv) return { secret: fromEnv, source: 'env' }
  if (process.env.SMOKE_FINANCIAL_RUN === '1') {
    return { secret: SMOKE_CRYPTO_WEBHOOK_DEV_SECRET, source: 'smoke_dev_fallback' }
  }
  return { secret: '', source: 'missing' }
}

function applyCryptoWebhookSecretEnv(secret, secretSource) {
  const prev = process.env.CRYPTO_WEBHOOK_SHARED_SECRET
  if (secretSource === 'smoke_dev_fallback') {
    process.env.CRYPTO_WEBHOOK_SHARED_SECRET = secret
  }
  return { prev, secretSource }
}

function restoreCryptoWebhookSecretEnv({ prev, secretSource }) {
  if (secretSource !== 'smoke_dev_fallback') return
  if (prev != null) process.env.CRYPTO_WEBHOOK_SHARED_SECRET = prev
  else delete process.env.CRYPTO_WEBHOOK_SHARED_SECRET
}

/**
 * @param {{ bookingId: string, webhookSecret: string }} params
 */
async function postCryptoConfirmWebhook({ bookingId, webhookSecret }) {
  const { POST: postWebhook } = await import('@/app/api/webhooks/crypto/confirm/route.js')
  const body = {
    txid: FAKE_TXID,
    bookingId: String(bookingId),
    webhookSecret,
  }
  const req = new NextRequest('http://smoke.local/api/webhooks/crypto/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-crypto-webhook-secret': webhookSecret },
    body: JSON.stringify(body),
  })
  const res = await postWebhook(req)
  const json = await res.json().catch(() => ({}))
  return { ok: true, status: res.status, json }
}

/**
 * Run after step 7b when booking is briefly COMPLETED (before restore to THAWED).
 *
 * @param {{ bookingId: string }} params
 */
export async function runCryptoConfirmPastEscrowStep({ bookingId }) {
  const id = String(bookingId || '').trim()
  if (!id) return { ok: false, error: 'bookingId required' }
  if (process.env.SMOKE_FINANCIAL_RUN !== '1') {
    return { ok: false, error: 'SMOKE_FINANCIAL_RUN=1 required' }
  }

  const { secret, source: secretSource } = resolveCryptoWebhookSecretForSmoke()
  if (!secret) {
    return { ok: false, error: 'Set CRYPTO_WEBHOOK_SHARED_SECRET or SMOKE_FINANCIAL_RUN=1' }
  }
  const envRestore = applyCryptoWebhookSecretEnv(secret, secretSource)

  try {
    const { data: row, error: readErr } = await supabaseAdmin
      .from('bookings')
      .select('status')
      .eq('id', id)
      .maybeSingle()

    if (readErr) return { ok: false, error: readErr.message }
    const st = String(row?.status || '').toUpperCase()
    if (st !== 'COMPLETED') {
      return { ok: false, error: `expected COMPLETED for crypto idempotent test, got ${st}` }
    }
    if (!isPaymentAcquiringWebhookIdempotentBookingStatus(st)) {
      return { ok: false, error: 'status-sets: COMPLETED must be idempotent for crypto webhook' }
    }

    const retry = await postCryptoConfirmWebhook({ bookingId: id, webhookSecret: secret })
    if (retry.status !== 200 || !retry.json?.success) {
      return {
        ok: false,
        error: `crypto/confirm COMPLETED: HTTP ${retry.status} ${JSON.stringify(retry.json)}`,
      }
    }
    if (!retry.json?.idempotent || !retry.json?.alreadyProcessed) {
      return {
        ok: false,
        error: `crypto/confirm: expected idempotent+alreadyProcessed, got ${JSON.stringify(retry.json)}`,
      }
    }

    return {
      ok: true,
      detail: 'crypto/confirm 2xx on COMPLETED (no verifyTron / moveToEscrow)',
    }
  } finally {
    restoreCryptoWebhookSecretEnv(envRestore)
  }
}
