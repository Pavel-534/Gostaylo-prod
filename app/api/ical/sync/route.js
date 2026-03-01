import { NextResponse } from 'next/server';

/**
 * FunnyRent 2.1 - iCal Sync API Endpoint
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

const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I';

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
      headers: { 'User-Agent': 'FunnyRent/2.1', 'Accept': 'text/calendar, */*' }
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

// Sync single source
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
  
  // Get existing blocks
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?listing_id=eq.${listingId}&status=eq.BLOCKED_BY_ICAL&select=id,metadata`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const existingBlocks = await existingRes.json() || [];
  const existingByUid = new Map(existingBlocks.filter(b => b.metadata?.ical_source_id === (sourceId || source)).map(b => [b.metadata?.ical_uid, b]));
  
  const currentUids = new Set();
  let eventsCreated = 0, eventsRemoved = 0;
  
  for (const event of futureEvents) {
    const uid = event.uid || `${source}-${event.dtstart.toISOString()}`;
    currentUids.add(uid);
    
    if (!existingByUid.has(uid)) {
      const bookingId = `blk-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
      await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: bookingId,
          listing_id: listingId,
          renter_id: 'system-ical-sync',
          status: 'BLOCKED_BY_ICAL',
          check_in: event.dtstart.toISOString(),
          check_out: event.dtend.toISOString(),
          price_thb: 0,
          currency: 'THB',
          price_paid: 0,
          exchange_rate: 1,
          commission_thb: 0,
          guest_name: `iCal - ${source}`,
          guest_phone: '',
          guest_email: '',
          special_requests: event.summary || `Blocked by ${source}`,
          metadata: {
            ical_source: source,
            ical_source_id: sourceId || source,
            ical_uid: uid,
            ical_url: url
          }
        })
      });
      eventsCreated++;
    }
  }
  
  // Remove old blocks
  for (const [uid, block] of existingByUid) {
    if (!currentUids.has(uid)) {
      await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${block.id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      eventsRemoved++;
    }
  }
  
  return { success: true, eventsProcessed: futureEvents.length, eventsCreated, eventsRemoved };
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
      // Get listing sync settings from both sync_settings column and metadata (for migration)
      const listingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=id,sync_settings,metadata`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const listings = await listingRes.json();
      const listing = listings?.[0];
      
      if (!listing) {
        return NextResponse.json({ success: false, error: 'Listing not found' });
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
        if (source.enabled !== false) {
          const result = await syncSource(listingId, source);
          results.push({ sourceId: source.id, source: source.source || source.platform, ...result });
          if (result.eventsProcessed) totalEventsProcessed += result.eventsProcessed;
        }
      }
      
      // Update listing sync_settings and metadata
      const currentSyncSettings = listing.sync_settings || { sources: syncSources };
      currentSyncSettings.last_sync = new Date().toISOString();
      
      await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sync_settings: currentSyncSettings,
          metadata: { ...listing.metadata, last_ical_sync: new Date().toISOString() }
        })
      });
      
      return NextResponse.json({ success: true, listingId, results, eventsProcessed: totalEventsProcessed });
    }
    
    // Sync all listings (admin)
    if (action === 'sync-all') {
      const listingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?select=id,sync_settings,metadata&status=eq.ACTIVE`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const listings = await listingsRes.json() || [];
      
      // Filter listings that have iCal sources (in sync_settings column or metadata)
      const listingsWithICal = listings.filter(l => 
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
            if (source.enabled !== false) {
              const result = await syncSource(listing.id, source);
              if (result.eventsProcessed) totalEvents += result.eventsProcessed;
            }
          }
          
          // Update listing last_sync
          const currentSyncSettings = listing.sync_settings || { sources: syncSources };
          currentSyncSettings.last_sync = new Date().toISOString();
          
          await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listing.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sync_settings: currentSyncSettings })
          });
          
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
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/system_settings?key=eq.ical_sync_status`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(statusUpdate)
      });
      
      if (!updateRes.ok) {
        // Create if not exists
        await fetch(`${SUPABASE_URL}/rest/v1/system_settings`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ key: 'ical_sync_status', ...statusUpdate })
        });
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
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const statusData = await statusRes.json();
    const status = statusData?.[0]?.value || {};
    
    // Get global settings
    const settingsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/system_settings?key=eq.ical_sync_settings&select=value`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const settingsData = await settingsRes.json();
    const settings = settingsData?.[0]?.value || { frequency: '1h', enabled: true };
    
    return NextResponse.json({
      ok: true,
      service: 'FunnyRent iCal Sync',
      status,
      settings
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
