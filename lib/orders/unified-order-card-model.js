import { normalizeOrderType } from '@/lib/orders/order-timeline'

export function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase()
  if (value === 'partner' || value === 'admin') return value
  return 'renter'
}

export function toIsoOrNull(value) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function normalizeUnifiedOrder(booking, unifiedOrder) {
  const raw = unifiedOrder && typeof unifiedOrder === 'object' ? unifiedOrder : booking?.unified_order || {}
  return {
    id: String(raw?.id || booking?.id || ''),
    type: normalizeOrderType(raw?.type),
    status: String(raw?.status || booking?.status || '').toUpperCase(),
    total_price: Number(raw?.total_price),
    currency: String(raw?.currency || booking?.currency || 'THB').toUpperCase(),
    dates: {
      check_in: raw?.dates?.check_in || toIsoOrNull(booking?.checkIn || booking?.check_in),
      check_out: raw?.dates?.check_out || toIsoOrNull(booking?.checkOut || booking?.check_out),
    },
  }
}

export function getOrderTypeLabel(type, language) {
  const normalized = normalizeOrderType(type)
  const lang = String(language || 'ru').toLowerCase()
  if (lang === 'en') {
    if (normalized === 'transport') return 'Transport'
    if (normalized === 'activity') return 'Activity'
    return 'Accommodation'
  }
  if (lang === 'th') {
    if (normalized === 'transport') return 'การเดินทาง'
    if (normalized === 'activity') return 'กิจกรรม'
    return 'ที่พัก/บริการ'
  }
  if (lang === 'zh') {
    if (normalized === 'transport') return '交通'
    if (normalized === 'activity') return '活动'
    return '住宿/服务'
  }
  if (normalized === 'transport') return 'Транспорт'
  if (normalized === 'activity') return 'Активности'
  return 'Размещение'
}

export function canRenterCancel(status) {
  return ['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'].includes(status)
}

export function canPartnerConfirm(status) {
  return status === 'PENDING'
}

export function canPartnerComplete(status) {
  return ['PAID', 'THAWED', 'CHECKED_IN'].includes(status)
}

export function formatPayoutAfter(checkOut, language) {
  if (!checkOut) return '—'
  const d = new Date(checkOut)
  if (Number.isNaN(d.getTime())) return '—'
  const ts = d.getTime() + 24 * 60 * 60 * 1000
  const locale =
    language === 'en'
      ? 'en-US'
      : language === 'th'
        ? 'th-TH'
        : language === 'zh'
          ? 'zh-CN'
          : 'ru-RU'
  return new Date(ts).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Optional last message text for order card strip (populate from list API when available). */
export function resolveBookingConversationPreview(booking) {
  if (!booking || typeof booking !== 'object') return null
  const lm =
    booking.conversationLastMessage ||
    booking.conversation_last_message ||
    booking.lastMessagePreview ||
    booking.last_message_preview
  if (typeof lm === 'string') return lm.trim() || null
  if (lm && typeof lm === 'object') {
    const t = lm.content ?? lm.message_body ?? lm.message ?? lm.text
    if (typeof t === 'string' && t.trim()) return t.trim()
  }
  return null
}

/** Unread emphasis on order card chat strip (aligned with `enrichConversationRows` read receipts). */
export function resolveBookingConversationStripUnread(booking) {
  return Number(booking?.conversationUnreadCount ?? booking?.conversation_unread_count ?? 0) > 0
}
