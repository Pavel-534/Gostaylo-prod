import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth/jwt-secret'
import { isIcalSyncSourceEnabled } from '@/lib/ical-sync-source-enabled'
import {
  fetchIcalDocument,
  insertIcalSyncLog,
  parseIcalToOccupancyRanges,
  syncIcalSourceToCalendarBlocks,
  filterOccupancyRangesByEndDate,
} from '@/lib/services/ical-calendar-blocks-sync'

/**
 * GoStayLo - iCal Sync API Endpoint
 *
 * Routes:
 * - POST action=parse — разбор URL без записи в БД
 * - POST action=sync — синк одного листинга (владелец или ADMIN)
 * - POST action=sync-all — глобальный синк (ADMIN)
 * - GET — статус из system_settings
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing Supabase config')
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function verifyAuth() {
  let secret
  try {
    secret = getJwtSecret()
  } catch {
    return { misconfigured: true }
  }
  const cookieStore = cookies()
  const session = cookieStore.get('gostaylo_session')
  if (!session?.value) return null
  try {
    return jwt.verify(session.value, secret)
  } catch {
    return null
  }
}

const ICAL_SOURCES = {
  AIRBNB: 'Airbnb',
  BOOKING: 'Booking.com',
  VRBO: 'VRBO',
  GOOGLE: 'Google Calendar',
  OTHER: 'Other',
}

function detectSource(url) {
  if (!url) return ICAL_SOURCES.OTHER
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('airbnb')) return ICAL_SOURCES.AIRBNB
  if (lowerUrl.includes('booking.com')) return ICAL_SOURCES.BOOKING
  if (lowerUrl.includes('vrbo') || lowerUrl.includes('homeaway')) return ICAL_SOURCES.VRBO
  if (lowerUrl.includes('google.com')) return ICAL_SOURCES.GOOGLE
  return ICAL_SOURCES.OTHER
}

async function syncSourceWithLog(listingId, sourceConfig) {
  const supabase = getSupabase()
  const result = await syncIcalSourceToCalendarBlocks(supabase, listingId, sourceConfig, {
    onlyFutureEnding: true,
    timeoutMs: 15000,
  })
  try {
    await insertIcalSyncLog(supabase, {
      listing_id: listingId,
      source_url: sourceConfig?.url ?? null,
      status: result.status,
      events_count: result.events_count,
      error_message: result.error_message,
    })
  } catch (e) {
    console.error('[ICAL /api/ical/sync] ical_sync_logs insert failed:', e?.message || e)
  }
  return {
    success: result.status === 'success',
    error: result.error_message,
    eventsProcessed: result.events_count,
    eventsCreated: result.events_count,
    eventsRemoved: 0,
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, listingId, url, sources } = body

    if (action === 'parse') {
      if (!url) return NextResponse.json({ success: false, error: 'URL required' })

      const fetchResult = await fetchIcalDocument(url, { timeoutMs: 15000 })
      if (!fetchResult.ok) {
        return NextResponse.json({ success: false, error: fetchResult.error })
      }

      const allRanges = parseIcalToOccupancyRanges(fetchResult.text)
      const futureRanges = filterOccupancyRangesByEndDate(allRanges, true)

      return NextResponse.json({
        success: true,
        source: detectSource(url),
        totalEvents: allRanges.length,
        futureEvents: futureRanges.length,
        events: futureRanges.slice(0, 20).map((r) => ({
          summary: r.summary,
          start: `${r.start_date}T00:00:00.000Z`,
          end: `${r.end_date}T23:59:59.999Z`,
        })),
      })
    }

    if (action === 'sync' && listingId) {
      const auth = verifyAuth()
      if (auth?.misconfigured) {
        return NextResponse.json(
          { success: false, error: 'Server misconfigured: JWT_SECRET is missing' },
          { status: 500 },
        )
      }
      if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      const supabase = getSupabase()
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('id, owner_id, sync_settings, metadata')
        .eq('id', listingId)
        .single()

      if (listingError || !listing) {
        return NextResponse.json({ success: false, error: 'Listing not found' })
      }

      if (listing.owner_id !== auth.userId && auth.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
      }

      let syncSources = sources || listing.sync_settings?.sources || listing.metadata?.sync_settings || []
      const legacyUrl = listing.metadata?.icalUrl
      if (legacyUrl && !syncSources.find((s) => s.url === legacyUrl)) {
        syncSources.push({ id: 'legacy', url: legacyUrl, source: detectSource(legacyUrl), enabled: true })
      }

      const results = []
      let totalEventsProcessed = 0

      for (const source of syncSources) {
        if (isIcalSyncSourceEnabled(source)) {
          const result = await syncSourceWithLog(listingId, source)
          results.push({ sourceId: source.id, source: source.source || source.platform, ...result })
          if (result.eventsProcessed) totalEventsProcessed += result.eventsProcessed
        }
      }

      const currentSyncSettings = listing.sync_settings || { sources: syncSources }
      currentSyncSettings.last_sync = new Date().toISOString()

      await supabase
        .from('listings')
        .update({
          sync_settings: currentSyncSettings,
          metadata: { ...listing.metadata, last_ical_sync: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq('id', listingId)

      return NextResponse.json({ success: true, listingId, results, eventsProcessed: totalEventsProcessed })
    }

    if (action === 'sync-all') {
      const auth = verifyAuth()
      if (auth?.misconfigured) {
        return NextResponse.json(
          { success: false, error: 'Server misconfigured: JWT_SECRET is missing' },
          { status: 500 },
        )
      }
      if (!auth || auth.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
      }

      const supabase = getSupabase()
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('id, sync_settings, metadata')
        .eq('status', 'ACTIVE')

      if (listingsError) {
        return NextResponse.json({ success: false, error: listingsError.message })
      }

      const listingsData = listings || []
      const listingsWithICal = listingsData.filter(
        (l) =>
          (l.sync_settings?.sources?.length > 0) ||
          l.sync_settings?.auto_sync ||
          (l.metadata?.sync_settings?.length > 0) ||
          l.metadata?.icalUrl,
      )

      let successCount = 0
      let errorCount = 0
      let totalEvents = 0

      for (const listing of listingsWithICal) {
        try {
          let syncSources = listing.sync_settings?.sources || listing.metadata?.sync_settings || []
          const legacyUrl = listing.metadata?.icalUrl
          if (legacyUrl && !syncSources.find((s) => s.url === legacyUrl)) {
            syncSources.push({ id: 'legacy', url: legacyUrl, source: detectSource(legacyUrl), enabled: true })
          }

          for (const source of syncSources) {
            if (isIcalSyncSourceEnabled(source)) {
              const result = await syncSourceWithLog(listing.id, source)
              if (result.eventsProcessed) totalEvents += result.eventsProcessed
            }
          }

          const currentSyncSettings = listing.sync_settings || { sources: syncSources }
          currentSyncSettings.last_sync = new Date().toISOString()

          await supabase
            .from('listings')
            .update({ sync_settings: currentSyncSettings, updated_at: new Date().toISOString() })
            .eq('id', listing.id)

          successCount++
        } catch {
          errorCount++
        }
      }

      const statusUpdate = {
        value: {
          last_sync: new Date().toISOString(),
          listings_synced: listingsWithICal.length,
          success_count: successCount,
          error_count: errorCount,
          events_processed: totalEvents,
        },
      }

      const { error: updateErr } = await supabase
        .from('system_settings')
        .update(statusUpdate)
        .eq('key', 'ical_sync_status')

      if (updateErr) {
        await supabase.from('system_settings').insert({ key: 'ical_sync_status', ...statusUpdate })
      }

      return NextResponse.json({
        success: true,
        listingsSynced: listingsWithICal.length,
        successCount,
        errorCount,
        eventsProcessed: totalEvents,
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message })
  }
}

export async function GET() {
  try {
    const statusRes = await fetch(
      `${SUPABASE_URL}/rest/v1/system_settings?key=eq.ical_sync_status&select=value`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    )
    const statusData = await statusRes.json()
    const status = statusData?.[0]?.value || {}

    const settingsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/system_settings?key=eq.ical_sync_settings&select=value`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    )
    const settingsData = await settingsRes.json()
    const settings = settingsData?.[0]?.value || { frequency: '1h', enabled: true }

    return NextResponse.json({
      ok: true,
      service: 'GoStayLo iCal Sync',
      status,
      settings,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message })
  }
}
