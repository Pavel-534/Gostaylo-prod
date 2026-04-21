import { randomUUID } from 'crypto'

/**
 * MIR_RU adapter scaffold (YooKassa-ready).
 * - Live mode when YOOKASSA credentials exist.
 * - Mock fallback otherwise.
 */
export class MirRuAdapter {
  static key = 'MIR_RU'

  static async createSession({ intent, bookingId }) {
    const shopId = String(process.env.YOOKASSA_SHOP_ID || '').trim()
    const secret = String(process.env.YOOKASSA_SECRET_KEY || '').trim()
    const endpoint = String(process.env.YOOKASSA_API_URL || 'https://api.yookassa.ru/v3/payments').trim()
    const amountThb = Number(intent?.amountThb || 0)

    if (!shopId || !secret) {
      return {
        provider: 'MIR_RU',
        checkoutUrl: `https://pay.mock.gostaylo/ru/${encodeURIComponent(intent.id)}`,
        externalRef: `mock-mir-${intent.id}`,
        adapterPayload: {
          adapter_key: 'MIR_RU',
          mode: 'mock',
          amount_thb: amountThb,
          booking_id: bookingId,
        },
      }
    }

    const idemKey = `pi-${intent.id}-${randomUUID()}`
    const basic = Buffer.from(`${shopId}:${secret}`).toString('base64')
    const body = {
      amount: {
        value: Number(amountThb || 0).toFixed(2),
        currency: 'THB',
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: process.env.PAYMENT_RETURN_URL || 'https://gostaylo.com/checkout/success',
      },
      description: `GoStayLo booking ${bookingId}`,
      metadata: {
        booking_id: bookingId,
        payment_intent_id: intent.id,
      },
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basic}`,
        'Idempotence-Key': idemKey,
      },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        provider: 'MIR_RU',
        checkoutUrl: `https://pay.mock.gostaylo/ru/${encodeURIComponent(intent.id)}`,
        externalRef: `fallback-mir-${intent.id}`,
        adapterPayload: {
          adapter_key: 'MIR_RU',
          mode: 'fallback_mock',
          provider_error: json?.description || json?.error || res.statusText,
          amount_thb: amountThb,
          booking_id: bookingId,
        },
      }
    }

    return {
      provider: 'MIR_RU',
      checkoutUrl: json?.confirmation?.confirmation_url || null,
      externalRef: json?.id || null,
      adapterPayload: {
        adapter_key: 'MIR_RU',
        mode: 'live',
        provider_response: json,
      },
    }
  }
}

export default MirRuAdapter

