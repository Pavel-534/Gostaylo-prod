import CardIntlAdapter from '@/lib/services/payment-adapters/card-intl.adapter'
import MirRuAdapter from '@/lib/services/payment-adapters/mir-ru.adapter'

const ADAPTERS = {
  CARD_INTL: CardIntlAdapter,
  MIR_RU: MirRuAdapter,
}

export function resolveAdapterKeyByMethod(method) {
  const m = String(method || '').toUpperCase().trim()
  if (m === 'MIR') return 'MIR_RU'
  return 'CARD_INTL'
}

export async function createPaymentSession({ adapterKey, intent, bookingId }) {
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
  return Adapter.createSession({ intent, bookingId })
}

