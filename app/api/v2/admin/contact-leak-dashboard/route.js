/**
 * GET /api/v2/admin/contact-leak-dashboard
 * Агрегаты CONTACT_LEAK_ATTEMPT + топ нарушителей + оценка «потери комиссии» (THB + конвертация через exchange_rates).
 * Только ADMIN (см. lib/admin-security-access.js).
 */

import { NextResponse } from 'next/server'
import { resolveAdminSecurityProfile } from '@/lib/admin-security-access'
import { getContactSafetyMode } from '@/lib/contact-safety-mode'
import {
  resolveDefaultCommissionPercent,
  getDisplayRateMap,
  convertAmountThbToCurrency,
} from '@/lib/services/currency.service'
import { getChatSafetySettings } from '@/lib/chat-safety-settings'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const hdr = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function countLeakEventsSince(sinceIso) {
  if (!SUPABASE_URL || !SERVICE_KEY) return 0
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/critical_signal_events?signal_key=eq.CONTACT_LEAK_ATTEMPT&created_at=gte.${encodeURIComponent(sinceIso)}&select=id`
  let res = await fetch(url, {
    method: 'HEAD',
    headers: { ...hdr, Prefer: 'count=exact' },
    cache: 'no-store',
  })
  let range = res.headers.get('content-range')
  if (!range || !String(range).includes('/')) {
    res = await fetch(url, {
      headers: { ...hdr, Prefer: 'count=exact', Range: '0-0' },
      cache: 'no-store',
    })
    range = res.headers.get('content-range')
  }
  const m = range && String(range).match(/\/(\d+)$/)
  return m ? parseInt(m[1], 10) : 0
}

async function fetchSystemCommissionPercent() {
  try {
    const settingsRes = await fetch(
      `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/system_settings?key=eq.general&select=value`,
      { headers: hdr, cache: 'no-store' },
    )
    const settingsData = await settingsRes.json()
    const raw = parseFloat(settingsData?.[0]?.value?.defaultCommissionRate)
    if (Number.isFinite(raw) && raw >= 0 && raw <= 100) return raw
  } catch {
    // fall through
  }
  return resolveDefaultCommissionPercent()
}

async function fetchTopViolators(sinceIso, limit = 20) {
  if (!SUPABASE_URL || !SERVICE_KEY) return []
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/admin_contact_leak_top_violators`, {
    method: 'POST',
    headers: hdr,
    body: JSON.stringify({ p_since: sinceIso, p_limit: limit }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    console.warn('[contact-leak-dashboard] top violators RPC', res.status, t.slice(0, 300))
    return []
  }
  const rows = await res.json()
  return Array.isArray(rows) ? rows : []
}

async function fetchProfilesForIds(ids) {
  if (!ids.length || !SUPABASE_URL || !SERVICE_KEY) return new Map()
  const clean = ids.filter(Boolean).map((id) => String(id))
  const inList = clean.map((id) => encodeURIComponent(id)).join(',')
  let res = await fetch(
    `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?id=in.(${inList})&select=id,first_name,last_name,email,contact_leak_strikes`,
    { headers: hdr, cache: 'no-store' },
  )
  if (!res.ok) {
    res = await fetch(
      `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?id=in.(${inList})&select=id,first_name,last_name,email`,
      { headers: hdr, cache: 'no-store' },
    )
  }
  if (!res.ok) return new Map()
  const rows = await res.json()
  const map = new Map()
  for (const r of Array.isArray(rows) ? rows : []) {
    map.set(r.id, r)
  }
  return map
}

function displayNameFromProfile(p) {
  if (!p) return ''
  const a = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  if (a) return a
  return p.email ? String(p.email).split('@')[0] : ''
}

function potentialCommissionThb(attempts, bookingThb, ratePct) {
  const a = Number(attempts) || 0
  const b = Number(bookingThb) || 0
  const r = Number(ratePct) || 0
  return Math.round(a * b * (r / 100) * 100) / 100
}

function buildDisplayLosses(lossThb, fxMap) {
  const codes = ['THB', 'USD', 'RUB']
  const out = {}
  for (const code of codes) {
    const v = convertAmountThbToCurrency(lossThb, code, fxMap)
    out[code] = v != null ? Math.round(v * 100) / 100 : null
  }
  return out
}

export async function GET() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
  }

  const gate = await resolveAdminSecurityProfile()
  if (gate.error) {
    return NextResponse.json({ success: false, error: gate.error.message }, { status: gate.error.status })
  }

  const now = Date.now()
  const dayStart = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const weekStart = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthStart = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  const topSince = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [chatSafety, commissionRatePctRaw, fxMap, day, week, month, topRaw] = await Promise.all([
    getChatSafetySettings(),
    fetchSystemCommissionPercent(),
    getDisplayRateMap({ applyRetailMarkup: false }),
    countLeakEventsSince(dayStart),
    countLeakEventsSince(weekStart),
    countLeakEventsSince(monthStart),
    fetchTopViolators(topSince, 25),
  ])

  const envEst = parseFloat(process.env.CONTACT_LEAK_ESTIMATED_BOOKING_THB || '')
  const estimatedBookingThb =
    Number.isFinite(envEst) && envEst > 0 ? envEst : chatSafety.estimatedBookingValueThb

  let commissionRatePct = parseFloat(process.env.CONTACT_LEAK_COMMISSION_RATE_PCT || '')
  if (!Number.isFinite(commissionRatePct) || commissionRatePct < 0) {
    commissionRatePct = commissionRatePctRaw
  }

  const senderIds = topRaw.map((r) => r.sender_id).filter(Boolean)
  const profiles = await fetchProfilesForIds(senderIds)

  const topViolators = topRaw.map((row) => {
    const p = profiles.get(row.sender_id)
    return {
      userId: row.sender_id,
      attemptCount: Number(row.attempt_count) || 0,
      lastEventAt: row.last_event_at,
      lastConversationId: row.last_conversation_id || null,
      strikes: p?.contact_leak_strikes != null ? Number(p.contact_leak_strikes) : null,
      displayName: displayNameFromProfile(p) || null,
      email: p?.email || null,
    }
  })

  const mode = getContactSafetyMode()

  const lossThbDay = potentialCommissionThb(day, estimatedBookingThb, commissionRatePct)
  const lossThbWeek = potentialCommissionThb(week, estimatedBookingThb, commissionRatePct)
  const lossThbMonth = potentialCommissionThb(month, estimatedBookingThb, commissionRatePct)

  return NextResponse.json({
    success: true,
    data: {
      contactSafetyMode: mode,
      chatSafetySettings: {
        autoShadowbanEnabled: chatSafety.autoShadowbanEnabled,
        strikeThreshold: chatSafety.strikeThreshold,
        estimatedBookingValueThb: chatSafety.estimatedBookingValueThb,
      },
      periods: {
        day: { since: dayStart, count: day },
        week: { since: weekStart, count: week },
        month: { since: monthStart, count: month },
      },
      estimation: {
        /** Канон расчёта: THB × курсы из exchange_rates (без розничной надбавки витрины) */
        baseCurrency: 'THB',
        estimatedBookingThb,
        commissionRatePct,
        formula: 'attempts * estimatedBookingThb * (commissionRatePct / 100); display via convertAmountThbToCurrency + getDisplayRateMap({ applyRetailMarkup: false })',
        potentialCommissionLossThb: {
          day: lossThbDay,
          week: lossThbWeek,
          month: lossThbMonth,
        },
        potentialCommissionLossDisplay: {
          day: buildDisplayLosses(lossThbDay, fxMap),
          week: buildDisplayLosses(lossThbWeek, fxMap),
          month: buildDisplayLosses(lossThbMonth, fxMap),
        },
        envOverrideBookingThb:
          Number.isFinite(parseFloat(process.env.CONTACT_LEAK_ESTIMATED_BOOKING_THB || '')) &&
          parseFloat(process.env.CONTACT_LEAK_ESTIMATED_BOOKING_THB) > 0
            ? parseFloat(process.env.CONTACT_LEAK_ESTIMATED_BOOKING_THB)
            : null,
        envOverrideCommissionPct:
          Number.isFinite(parseFloat(process.env.CONTACT_LEAK_COMMISSION_RATE_PCT || '')) &&
          parseFloat(process.env.CONTACT_LEAK_COMMISSION_RATE_PCT) >= 0
            ? parseFloat(process.env.CONTACT_LEAK_COMMISSION_RATE_PCT)
            : null,
      },
      topViolators,
      topViolatorsSince: topSince,
    },
  })
}
