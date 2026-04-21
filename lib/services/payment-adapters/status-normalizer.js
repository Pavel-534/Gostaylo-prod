import { ADAPTER_KEYS, INTERNAL_INTENT_STATUSES } from '@/lib/services/payment-adapters/constants'

const MANDARIN_STATUS_MAP = {
  created: INTERNAL_INTENT_STATUSES.CREATED,
  pending: INTERNAL_INTENT_STATUSES.INITIATED,
  processing: INTERNAL_INTENT_STATUSES.INITIATED,
  authorized: INTERNAL_INTENT_STATUSES.INITIATED,
  captured: INTERNAL_INTENT_STATUSES.PAID,
  succeeded: INTERNAL_INTENT_STATUSES.PAID,
  paid: INTERNAL_INTENT_STATUSES.PAID,
  failed: INTERNAL_INTENT_STATUSES.FAILED,
  canceled: INTERNAL_INTENT_STATUSES.CANCELLED,
  cancelled: INTERNAL_INTENT_STATUSES.CANCELLED,
  expired: INTERNAL_INTENT_STATUSES.EXPIRED,
}

const YOOKASSA_STATUS_MAP = {
  pending: INTERNAL_INTENT_STATUSES.INITIATED,
  waiting_for_capture: INTERNAL_INTENT_STATUSES.INITIATED,
  succeeded: INTERNAL_INTENT_STATUSES.PAID,
  canceled: INTERNAL_INTENT_STATUSES.CANCELLED,
  cancelled: INTERNAL_INTENT_STATUSES.CANCELLED,
  failed: INTERNAL_INTENT_STATUSES.FAILED,
}

function normalizeKey(input) {
  return String(input || '').trim().toLowerCase()
}

function mapFromKnownTable(status, table) {
  const key = normalizeKey(status)
  if (!key) return INTERNAL_INTENT_STATUSES.INITIATED
  return table[key] || INTERNAL_INTENT_STATUSES.INITIATED
}

export function normalizeProviderStatus({ adapterKey, payload }) {
  const provider = String(adapterKey || '').toUpperCase()
  if (payload?.paid === true || payload?.success === true) {
    return INTERNAL_INTENT_STATUSES.PAID
  }

  if (provider === ADAPTER_KEYS.MIR_RU) {
    const eventName = normalizeKey(payload?.event)
    const objectStatus = normalizeKey(payload?.object?.status || payload?.status)
    if (eventName === 'payment.succeeded' || eventName === 'payment.captured') {
      return INTERNAL_INTENT_STATUSES.PAID
    }
    if (eventName === 'payment.canceled' || eventName === 'payment.cancelled') {
      return INTERNAL_INTENT_STATUSES.CANCELLED
    }
    return mapFromKnownTable(objectStatus, YOOKASSA_STATUS_MAP)
  }

  if (provider === ADAPTER_KEYS.CARD_INTL) {
    const status = payload?.status || payload?.paymentStatus || payload?.result?.status
    return mapFromKnownTable(status, MANDARIN_STATUS_MAP)
  }

  const genericStatus = payload?.status || payload?.state
  return mapFromKnownTable(genericStatus, MANDARIN_STATUS_MAP)
}

export function isIntentPaidStatus(status) {
  return String(status || '').toUpperCase() === INTERNAL_INTENT_STATUSES.PAID
}

