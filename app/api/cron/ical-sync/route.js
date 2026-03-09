/**
 * Gostaylo - iCal Sync Cron Job
 * GET/POST /api/cron/ical-sync
 * 
 * Syncs external calendars (Airbnb, Booking.com, etc.)
 * Designed for 15-minute interval with timeout safety
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max for Vercel

const CRON_SECRET = process.env.CRON_SECRET;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Parse iCal data and extract events
 */
function parseICalEvents(icalData, sourceUrl) {
  const events = [];
  
  try {
    // Simple iCal parser for VEVENT blocks
    const eventBlocks = icalData.split('BEGIN:VEVENT');
    
    for (let i = 1; i < eventBlocks.length; i++) {
      const block = eventBlocks[i].split('END:VEVENT')[0];
      
      const dtstart = block.match(/DTSTART[^:]*:(\d{8})/)?.[1];
      const dtend = block.match(/DTEND[^:]*:(\d{8})/)?.[1];
      const summary = block.match(/SUMMARY:(.+)/)?.[1]?.trim();
      const uid = block.match(/UID:(.+)/)?.[1]?.trim();
      
      if (dtstart && dtend) {
        // Parse YYYYMMDD format
        const startDate = `${dtstart.slice(0,4)}-${dtstart.slice(4,6)}-${dtstart.slice(6,8)}`;
        const endDate = `${dtend.slice(0,4)}-${dtend.slice(4,6)}-${dtend.slice(6,8)}`;
        
        events.push({
          uid,
          start_date: startDate,
          end_date: endDate,
          summary: summary || 'Blocked',
          source: sourceUrl
        });
      }
    }
  } catch (err) {
    console.error('[ICAL-SYNC] Parse error:', err.message);
  }
  
  return events;
}

/**
 * Sync a single source
 */
async function syncSource(supabase, listingId, source, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  const logEntry = {
    listing_id: listingId,
    source_url: source.url,
    status: 'pending',
    events_count: 0,
    error_message: null,
    synced_at: new Date().toISOString()
  };
  
  try {
    console.log(`[ICAL-SYNC] Fetching: ${source.url.slice(0, 50)}...`);
    
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Gostaylo-Calendar-Sync/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const icalData = await response.text();
    const events = parseICalEvents(icalData, source.url);
    
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
    
    console.log(`[ICAL-SYNC] Success: ${events.length} events for listing ${listingId}`);
    
  } catch (err) {
    clearTimeout(timeoutId);
    logEntry.status = 'error';
    logEntry.error_message = err.name === 'AbortError' ? 'Timeout' : err.message;
    console.error(`[ICAL-SYNC] Error for ${listingId}:`, err.message);
  }
  
  // Log the sync attempt
  await supabase.from('ical_sync_logs').insert(logEntry);
  
  return logEntry;
}

/**
 * Main sync handler
 */
async function runSync() {
  const supabase = getSupabase();
  const startTime = Date.now();
  const MAX_RUNTIME = 55000; // 55 seconds safety margin
  
  // Get listings with sync enabled
  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, sync_settings')
    .not('sync_settings', 'is', null)
    .neq('status', 'DELETED');
  
  if (error) {
    console.error('[ICAL-SYNC] Failed to fetch listings:', error);
    return { success: false, error: error.message };
  }
  
  // Filter listings that need sync
  const toSync = (listings || []).filter(l => {
    const settings = l.sync_settings;
    if (!settings?.sources?.length) return false;
    if (!settings.auto_sync) return false;
    
    // Check if sync is due (based on interval)
    const interval = (settings.sync_interval_hours || 24) * 60 * 60 * 1000;
    const lastSync = settings.last_sync ? new Date(settings.last_sync).getTime() : 0;
    return Date.now() - lastSync >= interval;
  });
  
  console.log(`[ICAL-SYNC] Found ${toSync.length} listings to sync`);
  
  const results = {
    total: toSync.length,
    synced: 0,
    errors: 0,
    skipped: 0
  };
  
  // Process listings one by one with timeout checks
  for (const listing of toSync) {
    // Check if we're running out of time
    if (Date.now() - startTime > MAX_RUNTIME) {
      console.log('[ICAL-SYNC] Time limit reached, stopping');
      results.skipped = toSync.length - results.synced - results.errors;
      break;
    }
    
    const sources = listing.sync_settings?.sources || [];
    
    for (const source of sources) {
      if (!source.url || !source.active) continue;
      
      const result = await syncSource(supabase, listing.id, source);
      
      if (result.status === 'success') {
        results.synced++;
      } else {
        results.errors++;
      }
    }
    
    // Update last_sync timestamp
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
  
  const duration = Date.now() - startTime;
  console.log(`[ICAL-SYNC] Completed in ${duration}ms:`, results);
  
  return {
    success: true,
    duration,
    ...results
  };
}

export async function GET(request) {
  // Verify cron secret if configured
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const result = await runSync();
  return NextResponse.json(result);
}

export async function POST(request) {
  // Verify cron secret from header
  const authHeader = request.headers.get('authorization');
  
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const result = await runSync();
  return NextResponse.json(result);
}
