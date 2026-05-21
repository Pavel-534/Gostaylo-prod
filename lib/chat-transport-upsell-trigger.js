/**
 * Системные сообщения чата, после которых показываем upsell «Транспорт» (рентер).
 * Триггер: подтверждение брони или оплата (CONFIRMED / PAID / PAID_ESCROW).
 */

import { CHAT_TRANSPORT_UPSELL_TRIGGER_STATUSES } from '@/lib/booking/status-sets.js'

export function isTransportUpsellAnchorMessage(message) {
  const meta = message?.metadata || {}
  const sk = meta.system_key
  const toStatus = String(meta.booking_status_event?.to_status || '').toUpperCase()

  if (sk === 'booking_confirmed') return true
  if (sk === 'booking_paid' || sk === 'paid') return true
  if (sk === 'booking_status_update' && CHAT_TRANSPORT_UPSELL_TRIGGER_STATUSES.includes(toStatus)) {
    return true
  }
  return false
}
