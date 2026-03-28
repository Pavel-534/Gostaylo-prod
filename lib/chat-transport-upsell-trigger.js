/**
 * Системные сообщения чата, после которых показываем upsell «Транспорт» (рентер).
 * Триггер: подтверждение брони или оплата (CONFIRMED / PAID / PAID_ESCROW).
 */

export function isTransportUpsellAnchorMessage(message) {
  const meta = message?.metadata || {}
  const sk = meta.system_key
  const toStatus = String(meta.booking_status_event?.to_status || '').toUpperCase()

  if (sk === 'booking_confirmed') return true
  if (sk === 'booking_paid' || sk === 'paid') return true
  if (sk === 'booking_status_update' && ['CONFIRMED', 'PAID', 'PAID_ESCROW'].includes(toStatus)) {
    return true
  }
  return false
}
