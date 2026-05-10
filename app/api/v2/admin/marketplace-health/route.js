/**
 * GET /api/v2/admin/marketplace-health
 * Агрегаты таблицы **catalog_verified_snapshots**: средняя доля Verified в выдаче по «городу» (**where_hint**), окно последних N дней.
 * Pulse 7d: число новых строк снимков (046) + опционально число **SYSTEM_AUTO_VERIFICATION** за 7 дней.
 * Доступ: **ADMIN** и **MODERATOR** (Stage 90.1).
 */

import { NextResponse } from 'next/server'
import { requireAccess } from '@/lib/security/access-guard'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const WINDOW_DAYS = 30
const PULSE_DAYS = 7
const MAX_ROWS = 8000
const AUTO_VERIFICATION_KEY = 'SYSTEM_AUTO_VERIFICATION'

function emptyHintLabel() {
  return '(no location hint)'
}

export async function GET() {
  const access = await requireAccess({ roles: ['ADMIN', 'MODERATOR'] })
  if (access.error) return access.error

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - WINDOW_DAYS)

  const since7d = new Date()
  since7d.setUTCDate(since7d.getUTCDate() - PULSE_DAYS)

  const [
    { data: rows, error },
    snap7,
    auto7,
  ] = await Promise.all([
    supabaseAdmin
      .from('catalog_verified_snapshots')
      .select('where_hint, verified_share_approx, recorded_at')
      .gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: false })
      .limit(MAX_ROWS),
    supabaseAdmin
      .from('catalog_verified_snapshots')
      .select('*', { count: 'exact', head: true })
      .gte('recorded_at', since7d.toISOString()),
    supabaseAdmin
      .from('critical_signal_events')
      .select('*', { count: 'exact', head: true })
      .eq('signal_key', AUTO_VERIFICATION_KEY)
      .gte('created_at', since7d.toISOString()),
  ])

  if (error) {
    console.warn('[marketplace-health]', error.message)
    return NextResponse.json(
      { success: false, error: error.message, windowDays: WINDOW_DAYS, cities: [], truncated: false },
      { status: 500 },
    )
  }

  const byKey = new Map()
  for (const row of rows || []) {
    const raw = row.where_hint
    const key =
      raw != null && String(raw).trim() !== '' ? String(raw).trim() : emptyHintLabel()
    let agg = byKey.get(key)
    if (!agg) {
      agg = { sum: 0, count: 0, lastRecordedAt: null }
      byKey.set(key, agg)
    }
    const v = Number(row.verified_share_approx)
    if (Number.isFinite(v)) {
      agg.sum += v
      agg.count += 1
    }
    const ra = row.recorded_at
    if (ra && (!agg.lastRecordedAt || new Date(ra) > new Date(agg.lastRecordedAt))) {
      agg.lastRecordedAt = ra
    }
  }

  const cities = Array.from(byKey.entries()).map(([whereHint, agg]) => {
    const avg = agg.count ? agg.sum / agg.count : 0
    return {
      whereHint,
      avgVerifiedShareApprox: avg,
      avgVerifiedPercent: Math.round(avg * 1000) / 10,
      snapshotCount: agg.count,
      lastRecordedAt: agg.lastRecordedAt,
    }
  })

  cities.sort((a, b) => {
    const d = a.avgVerifiedShareApprox - b.avgVerifiedShareApprox
    if (d !== 0) return d
    return String(a.whereHint).localeCompare(String(b.whereHint))
  })

  const listLen = Array.isArray(rows) ? rows.length : 0

  let snapshotRowsLast7Days = typeof snap7.count === 'number' ? snap7.count : null
  if (snap7.error) {
    console.warn('[marketplace-health] snapshot 7d count:', snap7.error.message)
    snapshotRowsLast7Days = null
  }

  let autoVerificationsLast7Days = typeof auto7.count === 'number' ? auto7.count : null
  if (auto7.error) {
    const msg = String(auto7.error.message || '')
    if (!msg.includes("Could not find the table 'public.critical_signal_events'")) {
      console.warn('[marketplace-health] auto verification count:', msg)
    }
    autoVerificationsLast7Days = null
  }

  return NextResponse.json({
    success: true,
    windowDays: WINDOW_DAYS,
    pulseWindowDays: PULSE_DAYS,
    maxRows: MAX_ROWS,
    truncated: listLen >= MAX_ROWS,
    snapshotRowCount: listLen,
    snapshotRowsLast7Days,
    autoVerificationsLast7Days,
    cities,
    source: 'catalog_verified_snapshots',
    auditSignalKey: AUTO_VERIFICATION_KEY,
  })
}
