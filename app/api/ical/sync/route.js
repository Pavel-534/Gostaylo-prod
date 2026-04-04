import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { lastOccupiedNightIsoFromDtendDate } from '@/lib/ical-all-day-range';
import { getJwtSecret } from '@/lib/auth/jwt-secret';
import { isIcalSyncSourceEnabled } from '@/lib/ical-sync-source-enabled';

/**
 * @deprecated DEPRECATED: This endpoint will be replaced by /api/v2/calendar
 * Use the new unified calendar API for better performance and consistency.
 * 
 * GoStayLo - iCal Sync API Endpoint
 * 
 * Routes:
 * - POST /api/ical/sync - Sync a specific listing
 * - POST /api/ical/sync-all - Global sync (admin only)
 * - GET /api/ical/status - Get sync status
 * - POST /api/ical/parse - Parse iCal URL and return events
 */

// Use nodejs runtime for longer operations
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing Supabase config');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function verifyAuth() {
  let secret;
  try {
    secret = getJwtSecret();
  } catch {
    return { misconfigured: true };
  }
  const cookieStore = cookies();
  const session = cookieStore.get('gostaylo_session');
  if (!session?.value) return null;
  try {
    return jwt.verify(session.value, secret);
  } catch {
    return null;
  }
}

// iCal source detection
const ICAL_SOURCES = {
  AIRBNB: 'Airbnb',
  BOOKING: 'Booking.com',
  VRBO: 'VRBO',
  GOOGLE: 'Google Calendar',
  OTHER: 'Other'
};

function detectSource(url) {
  if (!url) return ICAL_SOURCES.OTHER;
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('airbnb')) return ICAL_SOURCES.AIRBNB;
  if (lowerUrl.includes('booking.com')) return ICAL_SOURCES.BOOKING;
  if (lowerUrl.includes('vrbo') || lowerUrl.includes('homeaway')) return ICAL_SOURCES.VRBO;
  if (lowerUrl.includes('google.com')) return ICAL_SOURCES.GOOGLE;
  return ICAL_SOURCES.OTHER;
}

// Parse iCal date
function parseICalDate(dateStr) {
  if (!dateStr) return null;
  dateStr = dateStr.replace('VALUE=DATE:', '').trim();
  
  if (dateStr.length === 8) {
    const year = parseInt(dateStr.slice(0, 4));
    const month = parseInt(dateStr.slice(4, 6)) - 1;
    const day = parseInt(dateStr.slice(6, 8));
    return new Date(Date.UTC(year, month, day, 0, 0, 0));
  }
  
  if (dateStr.includes('T')) {
    const datePart = dateStr.split('T')[0];
    const timePart = dateStr.split('T')[1]?.replace('Z', '') || '000000';
    const year = parseInt(datePart.slice(0, 4));
    const month = parseInt(datePart.slice(4, 6)) - 1;
    const day = parseInt(datePart.slice(6, 8));
    const hour = parseInt(timePart.slice(0, 2) || '0');
    const minute = parseInt(timePart.slice(2, 4) || '0');
    
    if (dateStr.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute, 0));
    } else {
      return new Date(Date.UTC(year, month, day, hour - 7, minute, 0));
    }
  }
  return new Date(dateStr);
}

// Parse iCal content
function parseICalContent(icsContent) {
  const events = [];
  const lines = icsContent.split(/\r?\n/);
  let currentEvent = null;
  let inEvent = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    while (i + 1 < lines.length && (lines[i + 1]?.startsWith(' ') || lines[i + 1]?.startsWith('\t'))) {
      line += lines[i + 1].substring(1);
      i++;
    }
    
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = { uid: null, summary: '', dtstart: null, dtend: null };
    } else if (line === 'END:VEVENT' && currentEvent) {
      inEvent = false;
      if (currentEvent.dtstart && currentEvent.dtend && currentEvent.dtend > currentEvent.dtstart) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (inEvent && currentEvent) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const keyPart = line.substring(0, colonIndex);
        const value = line.substring(colonIndex + 1);
        const key = keyPart.split(';')[0];
        
        switch (key) {
          case 'UID': currentEvent.uid = value; break;
          case 'SUMMARY': currentEvent.summary = value; break;
          case 'DTSTART': currentEvent.dtstart = parseICalDate(value); break;
          case 'DTEND': currentEvent.dtend = parseICalDate(value); break;
        }
      }
    }
  }
  return events;
}

// Fetch iCal
async function fetchICal(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'GoStayLo/2.1', 'Accept': 'text/calendar, */*' }
    });
    clearTimeout(timeout);
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const content = await res.text();
    if (!content.includes('BEGIN:VCALENDAR')) {
      throw new Error('Invalid iCal format');
    }
    return { success: true, content };
  } catch (error) {
    clearTimeout(timeout);
    return { success: false, error: error.message };
  }
}

// Format date to YYYY-MM-DD
function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

// Sync single source - writes to calendar_blocks (unified with Cron, Admin)
async function syncSource(listingId, sourceConfig) {
  const { url, source, id: sourceId } = sourceConfig;
  if (!url) return { success: false, error: 'No URL' };
  
  const fetchResult = await fetchICal(url);
  if (!fetchResult.success) {
    return { success: false, error: fetchResult.error, eventsCreated: 0, eventsRemoved: 0 };
  }
  
  const events = parseICalContent(fetchResult.content);
  const now = new Date();
  const futureEvents = events.filter(e => e.dtend > now);
  
  const supabase = getSupabase();
  
  // Delete existing iCal blocks for this source
  const { error: deleteError } = await supabase
    .from('calendar_blocks')
    .delete()
    .eq('listing_id', listingId)
    .eq('source', url);
  
  if (deleteError) {
    return { success: false, error: deleteError.message, eventsCreated: 0, eventsRemoved: 0 };
  }
  
  // Insert new blocks (same schema as cron/admin)
  let eventsCreated = 0;
  if (futureEvents.length > 0) {
    const platformName = source || sourceConfig.platform || 'External';
    const blocks = futureEvents.map(e => ({
      listing_id: listingId,
      start_date: formatDate(e.dtstart),
      end_date: lastOccupiedNightIsoFromDtendDate(e.dtend),
      reason: e.summary || `${platformName} booking`,
      source: url
    }));
    
    const { error: insertError } = await supabase.from('calendar_blocks').insert(blocks);
    if (insertError) {
      return { success: false, error: insertError.message, eventsCreated: 0, eventsRemoved: 0 };
    }
    eventsCreated = blocks.length;
  }
  
  return { success: true, eventsProcessed: futureEvents.length, eventsCreated, eventsRemoved: 0 };
}

/** Persist audit row for partner/admin manual sync (same table as cron). */
async function syncSourceWithLog(listingId, sourceConfig) {
  const result = await syncSource(listingId, sourceConfig);
  try {
    const supabase = getSupabase();
    const eventsCount =
      typeof result.eventsProcessed === 'number'
        ? result.eventsProcessed
        : typeof result.eventsCreated === 'number'
          ? result.eventsCreated
          : 0;
    await supabase.from('ical_sync_logs').insert({
      listing_id: listingId,
      source_url: sourceConfig?.url ?? null,
      status: result.success ? 'success' : 'error',
      events_count: eventsCount,
      error_message: result.success ? null : result.error ?? null,
      synced_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[ICAL /api/ical/sync] ical_sync_logs insert failed:', e?.message || e);
  }
  return result;
}

// POST handler
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, listingId, url, sources } = body;
    
    // Parse action
    if (action === 'parse') {
      if (!url) return NextResponse.json({ success: false, error: 'URL required' });
      
      const fetchResult = await fetchICal(url);
      if (!fetchResult.success) {
        return NextResponse.json({ success: false, error: fetchResult.error });
      }
      
      const events = parseICalContent(fetchResult.content);
      const now = new Date();
      const futureEvents = events.filter(e => e.dtend > now);
      
      return NextResponse.json({
        success: true,
        source: detectSource(url),
        totalEvents: events.length,
        futureEvents: futureEvents.length,
        events: futureEvents.slice(0, 20).map(e => ({
          summary: e.summary,
          start: e.dtstart?.toISOString(),
          end: e.dtend?.toISOString()
        }))
      });
    }
    
    // Sync single listing
    if (action === 'sync' && listingId) {
      const auth = verifyAuth();
      if (auth?.misconfigured) {
        return NextResponse.json({ success: false, error: 'Server misconfigured: JWT_SECRET is missing' }, { status: 500 });
      }
      if (!auth) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      const supabase = getSupabase();
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('id, owner_id, sync_settings, metadata')
        .eq('id', listingId)
        .single();

      if (listingError || !listing) {
        return NextResponse.json({ success: false, error: 'Listing not found' });
      }

      if (listing.owner_id !== auth.userId && auth.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
      
      // Prefer sync_settings column, fallback to provided sources or metadata.sync_settings
      let syncSources = sources || listing.sync_settings?.sources || listing.metadata?.sync_settings || [];
      
      // Add legacy icalUrl if present
      const legacyUrl = listing.metadata?.icalUrl;
      if (legacyUrl && !syncSources.find(s => s.url === legacyUrl)) {
        syncSources.push({ id: 'legacy', url: legacyUrl, source: detectSource(legacyUrl), enabled: true });
      }
      
      const results = [];
      let totalEventsProcessed = 0;
      
      for (const source of syncSources) {
        if (isIcalSyncSourceEnabled(source)) {
          const result = await syncSourceWithLog(listingId, source);
          results.push({ sourceId: source.id, source: source.source || source.platform, ...result });
          if (result.eventsProcessed) totalEventsProcessed += result.eventsProcessed;
        }
      }
      
      // Update listing sync_settings and metadata
      const currentSyncSettings = listing.sync_settings || { sources: syncSources };
      currentSyncSettings.last_sync = new Date().toISOString();
      
      await supabase
        .from('listings')
        .update({
          sync_settings: currentSyncSettings,
          metadata: { ...listing.metadata, last_ical_sync: new Date().toISOString() },
          updated_at: new Date().toISOString()
        })
        .eq('id', listingId);
      
      return NextResponse.json({ success: true, listingId, results, eventsProcessed: totalEventsProcessed });
    }
    
    // Sync all listings (admin only)
    if (action === 'sync-all') {
      const auth = verifyAuth();
      if (auth?.misconfigured) {
        return NextResponse.json({ success: false, error: 'Server misconfigured: JWT_SECRET is missing' }, { status: 500 });
      }
      if (!auth || auth.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
      }

      const supabase = getSupabase();
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('id, sync_settings, metadata')
        .eq('status', 'ACTIVE');

      if (listingsError) {
        return NextResponse.json({ success: false, error: listingsError.message });
      }

      const listingsData = listings || [];
      
      // Filter listings that have iCal sources (in sync_settings column or metadata)
      const listingsWithICal = listingsData.filter(l => 
        (l.sync_settings?.sources?.length > 0) ||
        (l.sync_settings?.auto_sync) ||
        (l.metadata?.sync_settings?.length > 0) || 
        l.metadata?.icalUrl
      );
      
      let successCount = 0, errorCount = 0, totalEvents = 0;
      
      for (const listing of listingsWithICal) {
        try {
          // Prefer sync_settings column
          let syncSources = listing.sync_settings?.sources || listing.metadata?.sync_settings || [];
          const legacyUrl = listing.metadata?.icalUrl;
          if (legacyUrl && !syncSources.find(s => s.url === legacyUrl)) {
            syncSources.push({ id: 'legacy', url: legacyUrl, source: detectSource(legacyUrl), enabled: true });
          }
          
          for (const source of syncSources) {
            if (isIcalSyncSourceEnabled(source)) {
              const result = await syncSourceWithLog(listing.id, source);
              if (result.eventsProcessed) totalEvents += result.eventsProcessed;
            }
          }
          
          // Update listing last_sync
          const currentSyncSettings = listing.sync_settings || { sources: syncSources };
          currentSyncSettings.last_sync = new Date().toISOString();
          
          await supabase
            .from('listings')
            .update({ sync_settings: currentSyncSettings, updated_at: new Date().toISOString() })
            .eq('id', listing.id);
          
          successCount++;
        } catch {
          errorCount++;
        }
      }
      
      // Update global status
      const statusUpdate = {
        value: {
          last_sync: new Date().toISOString(),
          listings_synced: listingsWithICal.length,
          success_count: successCount,
          error_count: errorCount,
          events_processed: totalEvents
        }
      };
      
      // Try to update, if not exists - create
      const { error: updateErr } = await supabase
        .from('system_settings')
        .update(statusUpdate)
        .eq('key', 'ical_sync_status');

      if (updateErr) {
        await supabase.from('system_settings').insert({ key: 'ical_sync_status', ...statusUpdate });
      }
      
      return NextResponse.json({
        success: true,
        listingsSynced: listingsWithICal.length,
        successCount,
        errorCount,
        eventsProcessed: totalEvents
      });
    }
    
    return NextResponse.json({ success: false, error: 'Invalid action' });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message });
  }
}

// GET handler - status
export async function GET() {
  try {
    const statusRes = await fetch(
      `${SUPABASE_URL}/rest/v1/system_settings?key=eq.ical_sync_status&select=value`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const statusData = await statusRes.json();
    const status = statusData?.[0]?.value || {};
    
    // Get global settings
    const settingsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/system_settings?key=eq.ical_sync_settings&select=value`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const settingsData = await settingsRes.json();
    const settings = settingsData?.[0]?.value || { frequency: '1h', enabled: true };
    
    return NextResponse.json({
      ok: true,
      service: 'GoStayLo iCal Sync',
      status,
      settings
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
