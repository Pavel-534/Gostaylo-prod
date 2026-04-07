/**
 * Подписанная ссылка на .ics: TTL + опциональная проверка брони в БД.
 */

import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

let warnedMissingSecret = false

function getSecret() {
  const explicit = String(process.env.CALENDAR_STAY_LINK_SECRET || '').trim()
  if (explicit) return explicit

  if (process.env.NODE_ENV === 'production') {
    throw new Error('CALENDAR_STAY_LINK_SECRET is required in production')
  }
  if (!warnedMissingSecret) {
    warnedMissingSecret = true
    console.warn('[calendar-stay-token] CALENDAR_STAY_LINK_SECRET is missing; using dev fallback secret')
  }
  return 'gostaylo-calendar-dev-only'
}

const DEFAULT_TTL_SEC = 14 * 24 * 3600

/**
 * @param {{ bookingId: string, startYmd: string, endYmd: string, ttlSec?: number }} p
 */
export function signCalendarStayToken(p) {
  const exp = Math.floor(Date.now() / 1000) + (p.ttlSec ?? DEFAULT_TTL_SEC)
  const payload = `${p.bookingId}|${p.startYmd}|${p.endYmd}|${exp}`
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}|${sig}`, 'utf8').toString('base64url')
}

/**
 * @returns {{ bookingId: string, startYmd: string, endYmd: string } | null}
 */
export function verifyCalendarStayToken(token) {
  if (!token || typeof token !== 'string') return null
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    const lastPipe = raw.lastIndexOf('|')
    if (lastPipe <= 0) return null
    const payload = raw.slice(0, lastPipe)
    const sig = raw.slice(lastPipe + 1)
    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null
    }
    const parts = payload.split('|')
    if (parts.length !== 4) return null
    const [bookingId, startYmd, endYmd, expStr] = parts
    const exp = parseInt(expStr, 10)
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) return null
    return { bookingId, startYmd, endYmd }
  } catch {
    return null
  }
}

/**
 * Загрузка брони и проверка, что даты в токене совпадают с БД (и бронь не отменена).
 * @returns {Promise<{ startYmd: string, endYmd: string, title: string, location: string, bookingId: string } | null>}
 */
export async function resolveBookingCalendarStay(verified) {
  if (!supabaseAdmin || !verified?.bookingId) return null
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('check_in, check_out, status, listings (title, district)')
    .eq('id', verified.bookingId)
    .maybeSingle()
  if (error || !data) return null
  const st = String(data.status || '').toUpperCase()
  if (st === 'CANCELLED' || st === 'REFUNDED') return null
  const cin = String(data.check_in || '').slice(0, 10)
  const cout = String(data.check_out || '').slice(0, 10)
  if (cin !== verified.startYmd || cout !== verified.endYmd) return null
  const lt = data.listings?.title
  return {
    startYmd: cin,
    endYmd: cout,
    bookingId: verified.bookingId,
    title: lt ? `GoStayLo: ${lt}` : 'GoStayLo stay',
    location: data.listings?.district || '',
  }
}
