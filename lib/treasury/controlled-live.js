/**
 * Stage 126.0 — Controlled Live Payments: activation state + first-payment detection.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { isFintechTestBookingRow } from '@/lib/admin/fintech-test-data-markers.js'
import { getGuestPayableRoundedThb } from '@/lib/booking-guest-total.js'
import {
  loadTreasuryOpsSettings,
  setTreasuryManualMode,
} from '@/lib/treasury/treasury-ops-config.js'
import {
  recordTreasuryOpsAlert,
  TREASURY_ALERT_TYPES,
} from '@/lib/treasury/treasury-monitoring-alerts.js'
import { escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { getPublicSiteUrl } from '@/lib/site-url.js'
import { readGuestBruttoFromBooking } from '@/lib/services/payment-adapters/acquirer-charge-amount.js'

const GENERAL_KEY = 'general'
const POST_ESCROW = ['PAID_ESCROW', 'CHECKED_IN', 'THAWED', 'READY_FOR_PAYOUT', 'COMPLETED']
const BANGKOK_TZ = 'Asia/Bangkok'

/** @returns {number} 0 = unlimited */
export function getControlledLiveMaxThbPerDay() {
  const raw = String(process.env.CONTROLLED_LIVE_MAX_THB_PER_DAY || '0').trim()
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function bangkokDayStartIso(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const y = parts.find((p) => p.type === 'year')?.value || '1970'
  const m = parts.find((p) => p.type === 'month')?.value || '01'
  const d = parts.find((p) => p.type === 'day')?.value || '01'
  return `${y}-${m}-${d}T00:00:00+07:00`
}

async function sumTodayRealPaymentsThb() {
  const dayStart = bangkokDayStartIso()
  const empty = { dayStart, sumThb: 0, count: 0 }
  if (!supabaseAdmin?.from) return empty

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, status, updated_at, price_thb, commission_thb, price_paid, pricing_snapshot, metadata, listing_id, renter_id, partner_id, guest_email',
    )
    .in('status', POST_ESCROW)
    .gte('updated_at', dayStart)
    .limit(300)

  if (error) {
    console.warn('[controlled-live] sumTodayRealPaymentsThb:', error.message)
    return { ...empty, error: error.message }
  }

  let sumThb = 0
  let count = 0
  for (const row of data || []) {
    if (isFintechTestBookingRow(row)) continue
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    const paidAt = String(meta.escrow_started || row.updated_at || '')
    if (paidAt < dayStart) continue
    const thb = getGuestPayableRoundedThb(row)
    if (!Number.isFinite(thb) || thb <= 0) continue
    sumThb += thb
    count += 1
  }

  return { dayStart, sumThb: Math.round(sumThb * 100) / 100, count }
}

function paymentMethodLabel(payload = {}) {
  const raw = String(
    payload.payment?.payment_method || payload.payment?.method || payload.payment?.source || '',
  ).toUpperCase()
  if (raw.includes('MIR') || raw.includes('CARD_RU')) return 'MIR (ЮKassa RUB)'
  if (raw.includes('CARD')) return 'CARD'
  if (raw.includes('CRYPTO') || raw.includes('USDT')) return 'CRYPTO'
  return raw || '—'
}

function isMirPayment(payload = {}) {
  const label = paymentMethodLabel(payload)
  return label.includes('MIR')
}

function fiscalStatusLabel(booking) {
  const meta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  const fiscal = meta.fiscal && typeof meta.fiscal === 'object' ? meta.fiscal : null
  return fiscal?.status ? String(fiscal.status) : '—'
}

async function mergeGeneral(patch) {
  if (!supabaseAdmin) return { success: false, error: 'no_db' }
  const { data: row } = await supabaseAdmin
    .from('system_settings')
    .select('id, value')
    .eq('key', GENERAL_KEY)
    .maybeSingle()
  const prev = row?.value && typeof row.value === 'object' ? row.value : {}
  const next = { ...prev, ...patch }
  if (row?.id) {
    const { error } = await supabaseAdmin
      .from('system_settings')
      .update({ value: next, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabaseAdmin.from('system_settings').insert({ key: GENERAL_KEY, value: next })
    if (error) return { success: false, error: error.message }
  }
  return { success: true, value: next }
}

/**
 * @returns {Promise<{ active: boolean, startedAt?: string, startedBy?: string, reason?: string, firstPaymentAt?: string, firstPaymentBookingId?: string }>}
 */
export async function loadControlledLiveState() {
  const ops = await loadTreasuryOpsSettings()
  const cl = ops.controlledLive
  if (!cl || typeof cl !== 'object') return { active: false }
  return {
    active: Boolean(cl.active),
    startedAt: cl.startedAt || null,
    startedBy: cl.startedBy || null,
    reason: cl.reason || '',
    firstPaymentAt: cl.firstPaymentAt || null,
    firstPaymentBookingId: cl.firstPaymentBookingId || null,
  }
}

/**
 * Включить Controlled Live: Concierge (manual mode ON), без Emergency Pause, журнал + TG.
 *
 * @param {{ startedBy?: string, reason?: string }} input
 */
export async function activateControlledLive(input = {}) {
  const ops = await loadTreasuryOpsSettings()
  if (ops.emergencyPause?.active) {
    return {
      success: false,
      error: 'emergency_pause_active',
      message: 'Сначала выключите Emergency Pause на FinTech-пульте.',
    }
  }
  if (ops.controlledLive?.active) {
    return { success: true, alreadyActive: true, controlledLive: ops.controlledLive }
  }

  const manualRes = await setTreasuryManualMode(true)
  if (!manualRes.success) {
    return { success: false, error: manualRes.error || 'manual_mode_failed' }
  }

  const controlledLive = {
    active: true,
    startedAt: new Date().toISOString(),
    startedBy: input.startedBy || null,
    reason: String(input.reason || 'Controlled Live — первые реальные платежи (Concierge)').slice(0, 500),
  }

  const mergeRes = await mergeGeneral({ controlled_live: controlledLive })
  if (!mergeRes.success) {
    return { success: false, error: mergeRes.error || 'settings_merge_failed' }
  }

  const html =
    `🚀 <b>Controlled Live активирован</b>\n\n` +
    `Режим: <b>Concierge</b> (ручные выплаты, TREASURY_MANUAL_MODE=1)\n` +
    `${controlledLive.reason ? `Причина: ${escapeSystemAlertHtml(controlledLive.reason)}\n` : ''}` +
    `<a href="${getPublicSiteUrl()}/admin/settings/finances">FinTech-пульт</a>\n` +
    `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`

  await recordTreasuryOpsAlert({
    type: TREASURY_ALERT_TYPES.CONTROLLED_LIVE_ACTIVATED,
    severity: 'info',
    title: 'Controlled Live активирован',
    detail: controlledLive.reason,
    meta: { startedBy: controlledLive.startedBy },
    telegramHtml: html,
  })

  return { success: true, controlledLive }
}

/**
 * Однократный алерт при первой не-smoke оплате после активации Controlled Live.
 *
 * @param {{ booking?: object, payment?: object }} payload
 */
export async function maybeAlertFirstRealPayment(payload = {}) {
  const booking = payload.booking
  if (!booking?.id || isFintechTestBookingRow(booking)) return { skipped: true, reason: 'test_or_missing' }

  const state = await loadControlledLiveState()
  if (!state.active) return { skipped: true, reason: 'controlled_live_inactive' }
  if (state.firstPaymentBookingId) return { skipped: true, reason: 'already_recorded' }

  const amountThb =
    getGuestPayableRoundedThb(booking) ||
    Number(payload.payment?.amount) ||
    Number(booking.price_thb) + Number(booking.commission_thb || 0) ||
    0

  const brutto = readGuestBruttoFromBooking(booking)
  const rubLine =
    brutto?.currency === 'RUB' && Number(brutto.amount) > 0
      ? `\n💳 RUB (snapshot): <b>${Number(brutto.amount).toLocaleString('ru-RU')} ₽</b>`
      : ''
  const mir = isMirPayment(payload)
  const method = paymentMethodLabel(payload)
  const fiscal = fiscalStatusLabel(booking)
  const plUrl = `${getPublicSiteUrl()}/admin/finance/intelligence/bookings/${encodeURIComponent(String(booking.id))}`

  const firstPaymentAt = new Date().toISOString()
  const mergeRes = await mergeGeneral({
    controlled_live: {
      active: true,
      startedAt: state.startedAt,
      startedBy: state.startedBy,
      reason: state.reason,
      firstPaymentAt,
      firstPaymentBookingId: String(booking.id),
    },
  })
  if (!mergeRes.success) {
    console.warn('[controlled-live] first payment marker failed', mergeRes.error)
  }

  const html =
    `${mir ? '🏦' : '🎉'} <b>${mir ? 'ПЕРВАЯ РЕАЛЬНАЯ MIR-ОПЛАТА' : 'ПЕРВАЯ РЕАЛЬНАЯ ОПЛАТА'}</b>\n\n` +
    `📝 Бронь: <code>${escapeSystemAlertHtml(booking.id)}</code>\n` +
    `💵 THB (guest): <b>฿${amountThb.toLocaleString('ru-RU')}</b>${rubLine}\n` +
    `🔗 Метод: <b>${escapeSystemAlertHtml(method)}</b>\n` +
    `🧾 Fiscal: <code>${escapeSystemAlertHtml(fiscal)}</code>\n` +
    `${mir ? '✅ Сверьте: ЮKassa ↔ snapshot RUB ↔ escrow THB ↔ ledger\n' : ''}` +
    `<a href="${plUrl}">P&amp;L в Financial Intelligence</a> · ` +
    `<a href="${getPublicSiteUrl()}/admin/settings/finances">FinTech</a>\n` +
    `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: BANGKOK_TZ })}`

  await recordTreasuryOpsAlert({
    type: TREASURY_ALERT_TYPES.FIRST_REAL_PAYMENT_DETECTED,
    severity: 'critical',
    title: mir ? 'Первая MIR-оплата (Controlled Live)' : 'Первая реальная оплата (Controlled Live)',
    detail: booking.id,
    meta: { bookingId: booking.id, amountThb, method, mir, fiscalStatus: fiscal },
    telegramHtml: html,
  })

  return { alerted: true, bookingId: booking.id }
}

/**
 * Stage 126.2 — soft pilot limit: TG FINANCE warn only (checkout не блокируется).
 * CONTROLLED_LIVE_MAX_THB_PER_DAY=0 → выключено.
 *
 * @param {{ booking?: object }} payload
 */
export async function maybeAlertDailyPilotLimitSoft(payload = {}) {
  const maxThb = getControlledLiveMaxThbPerDay()
  if (!maxThb) return { skipped: true, reason: 'no_limit' }

  const state = await loadControlledLiveState()
  if (!state.active) return { skipped: true, reason: 'controlled_live_inactive' }

  if (payload.booking && isFintechTestBookingRow(payload.booking)) {
    return { skipped: true, reason: 'test_booking' }
  }

  const { sumThb, count } = await sumTodayRealPaymentsThb()
  if (sumThb < maxThb) {
    return { skipped: true, reason: 'under_limit', sumThb, maxThb, remainingThb: maxThb - sumThb }
  }

  const html =
    `⚠️ <b>Пилотный лимит Controlled Live</b>\n\n` +
    `Сегодня (Bangkok): <b>฿${sumThb.toLocaleString('ru-RU')}</b> из лимита ฿${maxThb.toLocaleString('ru-RU')} (${count} оплат).\n` +
    `Checkout <b>не блокируется</b> — решение за вами.\n` +
    `При необходимости: Emergency Pause или поднять <code>CONTROLLED_LIVE_MAX_THB_PER_DAY</code>.\n` +
    `<a href="${getPublicSiteUrl()}/admin/finance/intelligence">Financial Intelligence</a>`

  await recordTreasuryOpsAlert({
    type: TREASURY_ALERT_TYPES.CONTROLLED_LIVE_DAILY_LIMIT,
    severity: 'warn',
    title: `Пилотный лимит ฿${maxThb.toLocaleString('ru-RU')} достигнут`,
    detail: `sumThb=${sumThb}; count=${count}`,
    meta: { sumThb, maxThb, count },
    telegramHtml: html,
  })

  return { alerted: true, sumThb, maxThb, count }
}

export default {
  loadControlledLiveState,
  activateControlledLive,
  maybeAlertFirstRealPayment,
  maybeAlertDailyPilotLimitSoft,
  getControlledLiveMaxThbPerDay,
}
