/**
 * GoStayLo - iCal Sync Cron Job
 * GET/POST /api/cron/ical-sync
 *
 * Синхронизация внешних календарей → `calendar_blocks` через
 * `lib/services/ical-calendar-blocks-sync.js` (единый парсер с партнёрским /api/ical/sync и админкой).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isIcalSyncSourceEnabled } from '@/lib/ical-sync-source-enabled'
import {
  insertIcalSyncLog,
  syncIcalSourceToCalendarBlocks,
} from '@/lib/services/ical-calendar-blocks-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function syncSource(supabase, listingId, source) {
  const result = await syncIcalSourceToCalendarBlocks(supabase, listingId, source, {
    timeoutMs: 10000,
    onlyFutureEnding: true,
  })

  const logEntry = {
    listing_id: listingId,
    source_url: source.url,
    status: result.status,
    events_count: result.events_count,
    error_message: result.error_message,
    synced_at: new Date().toISOString(),
  }

  try {
    await insertIcalSyncLog(supabase, logEntry)
  } catch (e) {
    console.error('[ICAL-SYNC] ical_sync_logs insert failed:', e?.message || e)
  }

  return logEntry
}

async function runSync() {
  const supabase = getSupabase()
  const startTime = Date.now()
  const MAX_RUNTIME = 55000

  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, sync_settings')
    .not('sync_settings', 'is', null)
    .neq('status', 'DELETED')

  if (error) {
    console.error('[ICAL-SYNC] Failed to fetch listings:', error)
    return { success: false, error: error.message }
  }

  const toSync = (listings || []).filter((l) => {
    const settings = l.sync_settings
    if (!settings?.sources?.length) return false
    if (!settings.auto_sync) return false
    const interval = (settings.sync_interval_hours || 24) * 60 * 60 * 1000
    const lastSync = settings.last_sync ? new Date(settings.last_sync).getTime() : 0
    return Date.now() - lastSync >= interval
  })

  console.log(`[ICAL-SYNC] Found ${toSync.length} listings to sync`)

  const results = {
    total: toSync.length,
    synced: 0,
    errors: 0,
    skipped: 0,
  }

  for (const listing of toSync) {
    if (Date.now() - startTime > MAX_RUNTIME) {
      console.log('[ICAL-SYNC] Time limit reached, stopping')
      results.skipped = toSync.length - results.synced - results.errors
      break
    }

    const sources = listing.sync_settings?.sources || []

    for (const source of sources) {
      if (!isIcalSyncSourceEnabled(source)) continue

      const result = await syncSource(supabase, listing.id, source)

      if (result.status === 'success') {
        results.synced++
      } else {
        results.errors++
      }
    }

    await supabase
      .from('listings')
      .update({
        sync_settings: {
          ...listing.sync_settings,
          last_sync: new Date().toISOString(),
        },
      })
      .eq('id', listing.id)
  }

  const duration = Date.now() - startTime
  console.log(`[ICAL-SYNC] Completed in ${duration}ms:`, results)

  return {
    success: true,
    duration,
    ...results,
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runSync()
  return NextResponse.json(result)
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization')

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runSync()
  return NextResponse.json(result)
}
