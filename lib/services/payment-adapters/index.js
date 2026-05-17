import CardIntlAdapter from '@/lib/services/payment-adapters/card-intl.adapter'
import MirRuAdapter from '@/lib/services/payment-adapters/mir-ru.adapter'
import { resolveAcquirerChargeAmount } from '@/lib/services/payment-adapters/acquirer-charge-amount.js'

export { resolveAcquirerChargeAmount, verifyWebhookPaidAmount } from '@/lib/services/payment-adapters/acquirer-charge-amount.js'

const ADAPTERS = {
  CARD_INTL: CardIntlAdapter,
  MIR_RU: MirRuAdapter,
}

export function resolveAdapterKeyByMethod(method) {
  const m = String(method || '').toUpperCase().trim()
  if (m === 'MIR') return 'MIR_RU'
  return 'CARD_INTL'
}

export async function createPaymentSession({ adapterKey, intent, bookingId, booking = null }) {
  const key = String(adapterKey || '').toUpperCase()
  const Adapter = ADAPTERS[key]
  if (!Adapter) {
    return {
      provider: key || 'UNKNOWN',
      checkoutUrl: null,
      externalRef: null,
      adapterPayload: {
        adapter_key: key || null,
        mode: 'unsupported',
      },
    }
  }

  let charge = null
  try {
    charge = resolveAcquirerChargeAmount({ booking, intent, adapterKey: key })
  } catch (e) {
    return {
      provider: key,
      checkoutUrl: null,
      externalRef: null,
      adapterPayload: {
        adapter_key: key,
        mode: 'error',
        error: e?.code || e?.message || 'charge_resolve_failed',
        booking_id: bookingId,
      },
    }
  }

  return Adapter.createSession({ intent, bookingId, charge })
}

