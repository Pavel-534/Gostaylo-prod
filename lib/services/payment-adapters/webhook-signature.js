import { createHmac, timingSafeEqual } from 'crypto'
import { ADAPTER_KEYS } from '@/lib/services/payment-adapters/constants'

function safeEqual(a, b) {
  try {
    const aa = Buffer.from(String(a || ''), 'utf8')
    const bb = Buffer.from(String(b || ''), 'utf8')
    if (aa.length !== bb.length) return false
    return timingSafeEqual(aa, bb)
  } catch {
    return false
  }
}

function verifyHmacSha256Hex(rawBody, signatureHeader, secret) {
  const sig = String(signatureHeader || '').trim()
  const sec = String(secret || '').trim()
  if (!sig || !sec) return false
  const expectedHex = createHmac('sha256', sec).update(rawBody, 'utf8').digest('hex')
  return safeEqual(expectedHex, sig)
}

export function resolveAdapterFromWebhook({ request, payload }) {
  const hint = String(request.headers.get('x-payment-adapter') || request.headers.get('x-provider') || '')
    .trim()
    .toUpperCase()
  if (hint === ADAPTER_KEYS.MIR_RU || hint === ADAPTER_KEYS.CARD_INTL) return hint

  if (request.headers.get('x-yookassa-signature') || payload?.object?.amount) return ADAPTER_KEYS.MIR_RU
  if (request.headers.get('x-mandarin-signature')) return ADAPTER_KEYS.CARD_INTL
  return ADAPTER_KEYS.CARD_INTL
}

export function verifyWebhookSignatureByAdapter({ adapterKey, request, rawBody }) {
  const provider = String(adapterKey || '').toUpperCase()
  const fallbackSecret = String(process.env.PAYMENT_ACQUIRING_WEBHOOK_SECRET || '').trim()

  if (provider === ADAPTER_KEYS.MIR_RU) {
    const secret = String(process.env.YOOKASSA_WEBHOOK_SECRET || '').trim() || fallbackSecret
    if (!secret) {
      return { ok: false, error: 'YOOKASSA_WEBHOOK_SECRET is not configured', adapter: provider }
    }
    const sig = request.headers.get('x-yookassa-signature') || request.headers.get('x-webhook-signature')
    if (!verifyHmacSha256Hex(rawBody, sig, secret)) {
      return { ok: false, error: 'invalid_signature', adapter: provider }
    }
    return { ok: true, adapter: provider }
  }

  const secret = String(process.env.MANDARIN_WEBHOOK_SECRET || '').trim() || fallbackSecret
  if (!secret) {
    return { ok: false, error: 'MANDARIN_WEBHOOK_SECRET is not configured', adapter: ADAPTER_KEYS.CARD_INTL }
  }
  const sig =
    request.headers.get('x-mandarin-signature') ||
    request.headers.get('x-webhook-signature') ||
    request.headers.get('x-payment-signature')
  if (!verifyHmacSha256Hex(rawBody, sig, secret)) {
    return { ok: false, error: 'invalid_signature', adapter: ADAPTER_KEYS.CARD_INTL }
  }
  return { ok: true, adapter: ADAPTER_KEYS.CARD_INTL }
}

