/**
 * GoStayLo - iCal Sync Admin API
 * GET /api/v2/admin/ical - Get sync logs with optional error filter
 * POST /api/v2/admin/ical - Trigger manual sync for a listing or all listings
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isIcalSyncSourceEnabled } from '@/lib/ical-sync-source-enabled'
import {
  insertIcalSyncLog,
  syncIcalSourceToCalendarBlocks,
} from '@/lib/services/ical-calendar-blocks-sync'
import { requireAccess } from '@/lib/security/access-guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function verifyAdmin() {
  const access = await requireAccess({ roles: ['ADMIN'] })
  if (access.error) return { err: access.error }
  return { profile: access.profile }
}

async function sendTelegramAlert(message) {
  if (!TELEGRAM_BOT_TOKEN || !ADMIN_TELEGRAM_ID) {
    console.log('[ICAL] Telegram not configured, skipping alert')
    return
  }

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_TELEGRAM_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    })
  } catch (err) {
    console.error('[ICAL] Failed to send Telegram alert:', err)
  }
}

async function syncSource(supabase, listingId, listingTitle, source) {
  const result = await syncIcalSourceToCalendarBlocks(supabase, listingId, source, {
    timeoutMs: 10000,
    onlyFutureEnding: true,
  })

  const logEntry = {
    listing_id: listingId,
    listing_title: listingTitle,
    source_url: source.url,
    status: result.status,
    events_count: result.events_count,
    error_message: result.error_message,
    synced_at: new Date().toISOString(),
  }

  try {
    await insertIcalSyncLog(supabase, logEntry)
  } catch (e) {
    console.error('[ICAL-ADMIN] ical_sync_logs insert failed:', e?.message || e)
  }

  return logEntry
}

export async function GET(request) {
  const v = await verifyAdmin()
  if (v.err) return v.err

  const { searchParams } = new URL(request.url)
  const errorsOnly = searchParams.get('errors_only') === 'true'
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const listingId = searchParams.get('listing_id')

  const supabase = getSupabase()

  let query = supabase
    .from('ical_sync_logs')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(limit)

  if (errorsOnly) {
    query = query.eq('status', 'error')
  }

  if (listingId) {
    query = query.eq('listing_id', listingId)
  }

  const { data: logs, error } = await query

  if (error) {
    console.error('[ICAL-ADMIN] Error fetching logs:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const { data: stats } = await supabase
    .from('ical_sync_logs')
    .select('status')
    .gte('synced_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const successCount = stats?.filter((s) => s.status === 'success').length || 0
  const errorCount = stats?.filter((s) => s.status === 'error').length || 0

  return NextResponse.json({
    success: true,
    logs: logs || [],
    stats: {
      total_24h: stats?.length || 0,
      success_24h: successCount,
      errors_24h: errorCount,
    },
  })
}

export async function POST(request) {
  const v = await verifyAdmin()
  if (v.err) return v.err

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { action, listingId } = body
  const supabase = getSupabase()

  if (action === 'get_sync_enabled') {
    const { data: listings, error } = await supabase
      .from('listings')
      .select('id, title, owner_id, sync_settings')
      .not('sync_settings', 'is', null)
      .eq('status', 'ACTIVE')

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const withSources = (listings || []).filter((l) => {
      const settings = l.sync_settings
      return settings?.sources?.length > 0
    })

    return NextResponse.json({
      success: true,
      listings: withSources,
      count: withSources.length,
    })
  }

  if (action === 'sync' && listingId) {
    const { data: listing } = await supabase
      .from('listings')
      .select('id, title, sync_settings')
      .eq('id', listingId)
      .single()

    if (!listing || !listing.sync_settings?.sources?.length) {
      return NextResponse.json({ success: false, error: 'No sync sources configured' }, { status: 400 })
    }

    const results = []
    for (const source of listing.sync_settings.sources) {
      if (!isIcalSyncSourceEnabled(source)) continue
      const result = await syncSource(supabase, listing.id, listing.title, source)
      results.push(result)
    }

    await supabase
      .from('listings')
      .update({
        sync_settings: {
          ...listing.sync_settings,
          last_sync: new Date().toISOString(),
        },
      })
      .eq('id', listingId)

    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      results,
    })
  }

  if (action === 'sync_all') {
    const startTime = Date.now()

    const { data: listings } = await supabase
      .from('listings')
      .select('id, title, sync_settings')
      .not('sync_settings', 'is', null)
      .eq('status', 'ACTIVE')

    const toSync = (listings || []).filter((l) => l.sync_settings?.sources?.length > 0)

    const results = {
      total: toSync.length,
      synced: 0,
      errors: 0,
      skipped: 0,
    }

    const errorListings = []

    for (const listing of toSync) {
      for (const source of listing.sync_settings.sources) {
        if (!isIcalSyncSourceEnabled(source)) {
          results.skipped++
          continue
        }

        const result = await syncSource(supabase, listing.id, listing.title, source)

        if (result.status === 'success') {
          results.synced++
        } else {
          results.errors++
          errorListings.push({
            title: listing.title,
            error: result.error_message,
          })
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

    results.duration = Date.now() - startTime

    if (results.errors >= 5) {
      const errorList = errorListings.slice(0, 5).map((e) => `• ${e.title}: ${e.error}`).join('\n')
      await sendTelegramAlert(
        `⚠️ <b>iCal Sync Alert</b>\n\n` +
          `Синхронизация завершилась с ${results.errors} ошибками из ${results.total} источников.\n\n` +
          `<b>Последние ошибки:</b>\n${errorList}\n\n` +
          `Время: ${new Date().toLocaleString('ru-RU')}`,
      )
    }

    return NextResponse.json({
      success: true,
      ...results,
    })
  }

  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
}
