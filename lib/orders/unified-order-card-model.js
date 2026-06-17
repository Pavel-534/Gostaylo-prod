import { normalizeOrderType } from '@/lib/orders/order-timeline'
import { getUIText } from '@/lib/translations'
import {
  ORDER_PARTNER_COMPLETE_STATUSES,
  ORDER_RENTER_CANCEL_ELIGIBLE_STATUSES,
} from '@/lib/booking/status-sets.js'import {
  getPayoutReleaseConfig,
  getPayoutReleaseDisplayText,
} from '@/lib/booking/payout-release-config.js'

function payoutDateLocale(language) {
  if (language === 'en') return 'en-US'
  if (language === 'th') return 'th-TH'
  if (language === 'zh') return 'zh-CN'
  return 'ru-RU'
}

/**
 * SSOT: дата разморозки эскроu для партнёра (не check-out + 24h).
 * @param {object|null|undefined} booking
 * @param {string} language
 */
export function formatPartnerPayoutThawDate(booking, language = 'ru') {
  if (!booking || typeof booking !== 'object') return '—'
  const config = getPayoutReleaseConfig(booking)
  const thawAt = config?.thawAt
  if (!thawAt || Number.isNaN(thawAt.getTime())) return '—'
  return thawAt.toLocaleString(payoutDateLocale(language), {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** @deprecated — используйте formatPartnerPayoutThawDate(booking, language) */
export function formatPayoutAfter(checkOut, language, booking = null) {
  if (booking && typeof booking === 'object') {
    return formatPartnerPayoutThawDate(booking, language)
  }
  return formatPartnerPayoutThawDate({ check_out: checkOut, check_in: checkOut }, language)
}

/**
 * Partner escrow callout по фазе брони (SSOT payout-release-config).
 * @param {object|null} booking
 * @param {string} status
 * @param {string} language
 * @returns {{ message: string, tone: 'blue'|'sky'|'indigo'|'emerald' } | null}
 */
export function resolvePartnerEscrowCallout(booking, status, language = 'ru') {
  const st = String(status || '').toUpperCase()
  if (!booking) return null
  const lang = ['en', 'zh', 'th'].includes(String(language)) ? language : 'ru'
  const config = getPayoutReleaseConfig(booking)

  if (st === 'PAID_ESCROW' || st === 'CHECKED_IN') {
    return {
      tone: 'blue',
      message: getUIText('orderEscrow_partnerInEscrow', language).replace(
        '{date}',
        formatPartnerPayoutThawDate(booking, language),
      ),
    }
  }
  if (st === 'THAWED' || st === 'THAW_HOLD') {
    return {
      tone: 'sky',
      message: getPayoutReleaseDisplayText(config, lang, 'thawHoldLong'),
    }
  }
  if (st === 'READY_FOR_PAYOUT') {
    return {
      tone: 'indigo',
      message: getPayoutReleaseDisplayText(config, lang, 'ready'),
    }
  }
  if (st === 'COMPLETED' || st === 'FINISHED') {
    return {
      tone: 'emerald',
      message: getUIText('orderEscrow_partnerReleased', language),
    }
  }
  return null
}

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
  return ORDER_RENTER_CANCEL_ELIGIBLE_STATUSES.has(String(status || '').toUpperCase())
}

export function canPartnerConfirm(status) {
  return status === 'PENDING'
}

export function canPartnerComplete(status) {
  return ORDER_PARTNER_COMPLETE_STATUSES.has(String(status || '').toUpperCase())
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
