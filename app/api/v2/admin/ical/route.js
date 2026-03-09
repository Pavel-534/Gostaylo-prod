/**
 * Gostaylo - iCal Sync Admin API
 * GET /api/v2/admin/ical - Get sync logs with optional error filter
 * POST /api/v2/admin/ical - Trigger manual sync for a listing or all listings
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function verifyAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get('gostaylo_session');
  if (!session?.value) return null;
  
  try {
    const decoded = jwt.verify(session.value, JWT_SECRET);
    if (decoded.role !== 'ADMIN') return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Send Telegram alert to admin
 */
async function sendTelegramAlert(message) {
  if (!TELEGRAM_BOT_TOKEN || !ADMIN_TELEGRAM_ID) {
    console.log('[ICAL] Telegram not configured, skipping alert');
    return;
  }
  
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_TELEGRAM_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (err) {
    console.error('[ICAL] Failed to send Telegram alert:', err);
  }
}

/**
 * Parse iCal data and extract events
 */
function parseICalEvents(icalData) {
  const events = [];
  
  try {
    const eventBlocks = icalData.split('BEGIN:VEVENT');
    
    for (let i = 1; i < eventBlocks.length; i++) {
      const block = eventBlocks[i].split('END:VEVENT')[0];
      
      const dtstart = block.match(/DTSTART[^:]*:(\d{8})/)?.[1];
      const dtend = block.match(/DTEND[^:]*:(\d{8})/)?.[1];
      const summary = block.match(/SUMMARY:(.+)/)?.[1]?.trim();
      
      if (dtstart && dtend) {
        const startDate = `${dtstart.slice(0,4)}-${dtstart.slice(4,6)}-${dtstart.slice(6,8)}`;
        const endDate = `${dtend.slice(0,4)}-${dtend.slice(4,6)}-${dtend.slice(6,8)}`;
        
        events.push({
          start_date: startDate,
          end_date: endDate,
          summary: summary || 'Blocked'
        });
      }
    }
  } catch (err) {
    console.error('[ICAL] Parse error:', err.message);
  }
  
  return events;
}

/**
 * Sync a single source
 */
async function syncSource(supabase, listingId, listingTitle, source) {
  const logEntry = {
    listing_id: listingId,
    listing_title: listingTitle,
    source_url: source.url,
    status: 'pending',
    events_count: 0,
    error_message: null,
    synced_at: new Date().toISOString()
  };
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Gostaylo-Calendar-Sync/1.0' }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const icalData = await response.text();
    const events = parseICalEvents(icalData);
    
    // Remove old iCal blocks for this source
    await supabase
      .from('calendar_blocks')
      .delete()
      .eq('listing_id', listingId)
      .eq('source', source.url);
    
    // Insert new blocks
    if (events.length > 0) {
      const blocks = events.map(e => ({
        listing_id: listingId,
        start_date: e.start_date,
        end_date: e.end_date,
        reason: e.summary || `${source.platform || 'External'} booking`,
        source: source.url
      }));
      
      await supabase.from('calendar_blocks').insert(blocks);
    }
    
    logEntry.status = 'success';
    logEntry.events_count = events.length;
    
  } catch (err) {
    logEntry.status = 'error';
    logEntry.error_message = err.name === 'AbortError' ? 'Timeout' : err.message;
  }
  
  // Save log entry
  await supabase.from('ical_sync_logs').insert(logEntry);
  
  return logEntry;
}

/**
 * GET - Get sync logs
 */
export async function GET(request) {
  const auth = verifyAdmin();
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  
  const { searchParams } = new URL(request.url);
  const errorsOnly = searchParams.get('errors_only') === 'true';
  const limit = parseInt(searchParams.get('limit') || '50');
  const listingId = searchParams.get('listing_id');
  
  const supabase = getSupabase();
  
  // Get logs with listing titles
  let query = supabase
    .from('ical_sync_logs')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(limit);
  
  if (errorsOnly) {
    query = query.eq('status', 'error');
  }
  
  if (listingId) {
    query = query.eq('listing_id', listingId);
  }
  
  const { data: logs, error } = await query;
  
  if (error) {
    console.error('[ICAL-ADMIN] Error fetching logs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  
  // Get summary stats for last 24 hours
  const { data: stats } = await supabase
    .from('ical_sync_logs')
    .select('status')
    .gte('synced_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const successCount = stats?.filter(s => s.status === 'success').length || 0;
  const errorCount = stats?.filter(s => s.status === 'error').length || 0;
  
  return NextResponse.json({
    success: true,
    logs: logs || [],
    stats: {
      total_24h: stats?.length || 0,
      success_24h: successCount,
      errors_24h: errorCount
    }
  });
}

/**
 * POST - Trigger manual sync
 */
export async function POST(request) {
  const auth = verifyAdmin();
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  
  const { action, listingId } = body;
  const supabase = getSupabase();
  
  // Get listings with sync enabled
  if (action === 'get_sync_enabled') {
    const { data: listings, error } = await supabase
      .from('listings')
      .select('id, title, owner_id, sync_settings')
      .not('sync_settings', 'is', null)
      .eq('status', 'ACTIVE');
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    const withSources = (listings || []).filter(l => {
      const settings = l.sync_settings;
      return settings?.sources?.length > 0;
    });
    
    return NextResponse.json({
      success: true,
      listings: withSources,
      count: withSources.length
    });
  }
  
  // Sync single listing
  if (action === 'sync' && listingId) {
    const { data: listing } = await supabase
      .from('listings')
      .select('id, title, sync_settings')
      .eq('id', listingId)
      .single();
    
    if (!listing || !listing.sync_settings?.sources?.length) {
      return NextResponse.json({ success: false, error: 'No sync sources configured' }, { status: 400 });
    }
    
    const results = [];
    for (const source of listing.sync_settings.sources) {
      if (!source.url || !source.active) continue;
      const result = await syncSource(supabase, listing.id, listing.title, source);
      results.push(result);
    }
    
    // Update last_sync
    await supabase
      .from('listings')
      .update({
        sync_settings: {
          ...listing.sync_settings,
          last_sync: new Date().toISOString()
        }
      })
      .eq('id', listingId);
    
    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      results
    });
  }
  
  // Sync all listings
  if (action === 'sync_all') {
    const startTime = Date.now();
    
    const { data: listings } = await supabase
      .from('listings')
      .select('id, title, sync_settings')
      .not('sync_settings', 'is', null)
      .eq('status', 'ACTIVE');
    
    const toSync = (listings || []).filter(l => l.sync_settings?.sources?.length > 0);
    
    const results = {
      total: toSync.length,
      synced: 0,
      errors: 0,
      skipped: 0
    };
    
    const errorListings = [];
    
    for (const listing of toSync) {
      for (const source of listing.sync_settings.sources) {
        if (!source.url || !source.active) {
          results.skipped++;
          continue;
        }
        
        const result = await syncSource(supabase, listing.id, listing.title, source);
        
        if (result.status === 'success') {
          results.synced++;
        } else {
          results.errors++;
          errorListings.push({
            title: listing.title,
            error: result.error_message
          });
        }
      }
      
      // Update last_sync
      await supabase
        .from('listings')
        .update({
          sync_settings: {
            ...listing.sync_settings,
            last_sync: new Date().toISOString()
          }
        })
        .eq('id', listing.id);
    }
    
    results.duration = Date.now() - startTime;
    
    // Send Telegram alert if more than 5 errors
    if (results.errors >= 5) {
      const errorList = errorListings.slice(0, 5).map(e => `• ${e.title}: ${e.error}`).join('\n');
      await sendTelegramAlert(
        `⚠️ <b>iCal Sync Alert</b>\n\n` +
        `Синхронизация завершилась с ${results.errors} ошибками из ${results.total} источников.\n\n` +
        `<b>Последние ошибки:</b>\n${errorList}\n\n` +
        `Время: ${new Date().toLocaleString('ru-RU')}`
      );
    }
    
    return NextResponse.json({
      success: true,
      ...results
    });
  }
  
  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
}
