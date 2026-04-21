import { ADAPTER_KEYS } from '@/lib/services/payment-adapters/constants'

function toEnvReadiness(keys) {
  const missing = []
  const present = []
  for (const key of keys) {
    if (String(process.env[key] || '').trim()) present.push(key)
    else missing.push(key)
  }
  return { missing, present, ready: missing.length === 0 }
}

export function getPaymentAdaptersHealth() {
  const globalKeys = ['PAYMENT_ACQUIRING_WEBHOOK_SECRET']
  const cardIntlKeys = ['MANDARIN_CARD_INTL_ENDPOINT', 'MANDARIN_API_KEY', 'MANDARIN_WEBHOOK_SECRET']
  const mirRuKeys = ['YOOKASSA_SHOP_ID', 'YOOKASSA_SECRET_KEY', 'YOOKASSA_WEBHOOK_SECRET']

  const global = toEnvReadiness(globalKeys)
  const cardIntl = toEnvReadiness(cardIntlKeys)
  const mirRu = toEnvReadiness(mirRuKeys)

  return {
    generatedAt: new Date().toISOString(),
    global,
    adapters: {
      [ADAPTER_KEYS.CARD_INTL]: {
        key: ADAPTER_KEYS.CARD_INTL,
        mode: cardIntl.ready ? 'live-ready' : 'mock-fallback',
        ...cardIntl,
      },
      [ADAPTER_KEYS.MIR_RU]: {
        key: ADAPTER_KEYS.MIR_RU,
        mode: mirRu.ready ? 'live-ready' : 'mock-fallback',
        ...mirRu,
      },
    },
  }
}

