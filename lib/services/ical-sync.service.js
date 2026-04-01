/**
 * GoStayLo - iCal Sync Service
 * 
 * Multi-source calendar synchronization engine
 * Supports: Airbnb, Booking.com, VRBO, Google Calendar
 * 
 * Features:
 * - Parse .ics files (VEVENT extraction)
 * - Create BLOCKED_BY_ICAL bookings
 * - Cleanup removed events
 * - Timezone handling (Asia/Bangkok UTC+7)
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// iCal source platforms
export const ICAL_SOURCES = {
  AIRBNB: 'Airbnb',
  BOOKING: 'Booking.com',
  VRBO: 'VRBO',
  GOOGLE: 'Google Calendar',
  OTHER: 'Other'
};

// Parse iCal date format (YYYYMMDD or YYYYMMDDTHHmmssZ)
function parseICalDate(dateStr) {
  if (!dateStr) return null;
  
  // Remove VALUE=DATE: prefix if present
  dateStr = dateStr.replace('VALUE=DATE:', '').replace('TZID=', '').trim();
  
  // Handle date-only format: YYYYMMDD
  if (dateStr.length === 8) {
    const year = parseInt(dateStr.slice(0, 4));
    const month = parseInt(dateStr.slice(4, 6)) - 1;
    const day = parseInt(dateStr.slice(6, 8));
    return new Date(Date.UTC(year, month, day, 0, 0, 0));
  }
  
  // Handle datetime format: YYYYMMDDTHHmmssZ
  if (dateStr.includes('T')) {
    const datePart = dateStr.split('T')[0];
    const timePart = dateStr.split('T')[1]?.replace('Z', '') || '000000';
    
    const year = parseInt(datePart.slice(0, 4));
    const month = parseInt(datePart.slice(4, 6)) - 1;
    const day = parseInt(datePart.slice(6, 8));
    const hour = parseInt(timePart.slice(0, 2) || '0');
    const minute = parseInt(timePart.slice(2, 4) || '0');
    const second = parseInt(timePart.slice(4, 6) || '0');
    
    // If 'Z' was present, it's UTC; otherwise assume local (Bangkok)
    if (dateStr.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    } else {
      // Asia/Bangkok is UTC+7, so subtract 7 hours to get UTC
      return new Date(Date.UTC(year, month, day, hour - 7, minute, second));
    }
  }
  
  return new Date(dateStr);
}

// Parse iCal content and extract events
export function parseICalContent(icsContent) {
  const events = [];
  const lines = icsContent.split(/\r?\n/);
  
  let currentEvent = null;
  let inEvent = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Handle line continuation (lines starting with space/tab)
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      line += lines[i + 1].substring(1);
      i++;
    }
    
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {
        uid: null,
        summary: '',
        dtstart: null,
        dtend: null,
        description: '',
        status: 'CONFIRMED'
      };
    } else if (line === 'END:VEVENT' && currentEvent) {
      inEvent = false;
      
      // Only add events with valid dates
      if (currentEvent.dtstart && currentEvent.dtend) {
        // Ensure end date is after start date
        if (currentEvent.dtend > currentEvent.dtstart) {
          events.push(currentEvent);
        }
      }
      currentEvent = null;
    } else if (inEvent && currentEvent) {
      // Parse event properties
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const keyPart = line.substring(0, colonIndex);
        const value = line.substring(colonIndex + 1);
        
        // Handle properties with parameters (e.g., DTSTART;VALUE=DATE:20240101)
        const key = keyPart.split(';')[0];
        
        switch (key) {
          case 'UID':
            currentEvent.uid = value;
            break;
          case 'SUMMARY':
            currentEvent.summary = value;
            break;
          case 'DESCRIPTION':
            currentEvent.description = value;
            break;
          case 'DTSTART':
            currentEvent.dtstart = parseICalDate(value);
            break;
          case 'DTEND':
            currentEvent.dtend = parseICalDate(value);
            break;
          case 'STATUS':
            currentEvent.status = value;
            break;
        }
      }
    }
  }
  
  return events;
}

// Detect iCal source from URL
export function detectICalSource(url) {
  if (!url) return ICAL_SOURCES.OTHER;
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('airbnb')) return ICAL_SOURCES.AIRBNB;
  if (lowerUrl.includes('booking.com') || lowerUrl.includes('admin.booking')) return ICAL_SOURCES.BOOKING;
  if (lowerUrl.includes('vrbo') || lowerUrl.includes('homeaway')) return ICAL_SOURCES.VRBO;
  if (lowerUrl.includes('google.com/calendar')) return ICAL_SOURCES.GOOGLE;
  
  return ICAL_SOURCES.OTHER;
}

// Fetch and parse iCal from URL
export async function fetchAndParseICal(url) {
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GoStayLo/2.1 Calendar Sync',
        'Accept': 'text/calendar, */*'
      }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const icsContent = await response.text();
    
    // Validate it's actually iCal content
    if (!icsContent.includes('BEGIN:VCALENDAR')) {
      throw new Error('Invalid iCal format: Missing VCALENDAR');
    }
    
    const events = parseICalContent(icsContent);
    
    return {
      success: true,
      events,
      rawContent: icsContent,
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      events: [],
      fetchedAt: new Date().toISOString()
    };
  }
}

// Sync a single iCal source for a listing
export async function syncICalSource(listingId, sourceConfig) {
  const { url, source, id: sourceId } = sourceConfig;
  
  if (!url) {
    return { success: false, error: 'No URL provided' };
  }
  
  // Fetch and parse iCal
  const parseResult = await fetchAndParseICal(url);
  
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error,
      eventsProcessed: 0,
      eventsCreated: 0,
      eventsRemoved: 0
    };
  }
  
  const events = parseResult.events;
  const now = new Date();
  
  // Filter to future events only (or events ending in the future)
  const futureEvents = events.filter(e => e.dtend > now);
  
  // Get existing BLOCKED_BY_ICAL bookings for this listing and source
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?listing_id=eq.${listingId}&status=eq.BLOCKED_BY_ICAL&metadata->>ical_source_id=eq.${sourceId || source}`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const existingBlocks = await existingRes.json() || [];
  
  // Create a map of existing blocks by their ical_uid
  const existingByUid = new Map();
  for (const block of existingBlocks) {
    const uid = block.metadata?.ical_uid;
    if (uid) {
      existingByUid.set(uid, block);
    }
  }
  
  // Track UIDs from current sync
  const currentUids = new Set();
  
  let eventsCreated = 0;
  let eventsUpdated = 0;
  let eventsRemoved = 0;
  
  // Process each event
  for (const event of futureEvents) {
    const uid = event.uid || `${source}-${event.dtstart.toISOString()}-${event.dtend.toISOString()}`;
    currentUids.add(uid);
    
    const existing = existingByUid.get(uid);
    
    if (existing) {
      // Check if dates changed
      const existingStart = new Date(existing.check_in);
      const existingEnd = new Date(existing.check_out);
      
      if (existingStart.getTime() !== event.dtstart.getTime() || 
          existingEnd.getTime() !== event.dtend.getTime()) {
        // Update the booking
        await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${existing.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            check_in: event.dtstart.toISOString(),
            check_out: event.dtend.toISOString(),
            special_requests: event.summary || `Blocked by ${source}`,
            updated_at: now.toISOString()
          })
        });
        eventsUpdated++;
      }
    } else {
      // Create new blocked booking
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
          guest_name: `iCal Block - ${source}`,
          guest_phone: '',
          guest_email: '',
          special_requests: event.summary || `Blocked by ${source}`,
          metadata: {
            ical_source: source,
            ical_source_id: sourceId || source,
            ical_uid: uid,
            ical_url: url,
            ical_summary: event.summary,
            synced_at: now.toISOString()
          },
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        })
      });
      eventsCreated++;
    }
  }
  
  // Remove blocks that no longer exist in the iCal
  for (const [uid, block] of existingByUid) {
    if (!currentUids.has(uid)) {
      await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${block.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      eventsRemoved++;
    }
  }
  
  return {
    success: true,
    eventsProcessed: futureEvents.length,
    eventsCreated,
    eventsUpdated,
    eventsRemoved,
    lastSync: now.toISOString()
  };
}

// Sync all iCal sources for a listing
export async function syncAllICalSources(listingId) {
  // Get listing with sync settings
  const listingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=id,title,metadata,sync_settings`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const listings = await listingRes.json();
  const listing = listings?.[0];
  
  if (!listing) {
    return { success: false, error: 'Listing not found' };
  }
  
  // Get sync settings from listing
  const syncSettings = listing.sync_settings || [];
  
  // Also check legacy ical_url in metadata
  const legacyUrl = listing.metadata?.icalUrl;
  if (legacyUrl && !syncSettings.find(s => s.url === legacyUrl)) {
    syncSettings.push({
      id: 'legacy',
      url: legacyUrl,
      source: detectICalSource(legacyUrl),
      enabled: true
    });
  }
  
  const results = [];
  
  for (const source of syncSettings) {
    if (!source.enabled) continue;
    
    const result = await syncICalSource(listingId, source);
    results.push({
      sourceId: source.id,
      source: source.source,
      url: source.url,
      ...result
    });
  }
  
  // Update listing with last sync time
  await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      metadata: {
        ...listing.metadata,
        last_ical_sync: new Date().toISOString(),
        ical_sync_results: results
      }
    })
  });
  
  return {
    success: true,
    listingId,
    sourcesProcessed: results.length,
    results
  };
}

// Global sync: Sync all listings with iCal sources
export async function syncAllListings() {
  // Get all listings with sync_settings or legacy ical_url
  const listingsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/listings?select=id,metadata,sync_settings&status=eq.ACTIVE`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const listings = await listingsRes.json() || [];
  
  // Filter to listings with iCal configured
  const listingsWithICal = listings.filter(l => 
    (l.sync_settings && l.sync_settings.length > 0) || 
    (l.metadata?.icalUrl)
  );
  
  const results = [];
  
  for (const listing of listingsWithICal) {
    try {
      const result = await syncAllICalSources(listing.id);
      results.push({
        listingId: listing.id,
        ...result
      });
    } catch (error) {
      results.push({
        listingId: listing.id,
        success: false,
        error: error.message
      });
    }
  }
  
  // Update global sync status
  await fetch(`${SUPABASE_URL}/rest/v1/system_settings?key=eq.ical_sync_status`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      value: {
        last_sync: new Date().toISOString(),
        listings_synced: listingsWithICal.length,
        total_results: results.length,
        success_count: results.filter(r => r.success).length,
        error_count: results.filter(r => !r.success).length
      }
    })
  });
  
  return {
    success: true,
    listingsSynced: listingsWithICal.length,
    results
  };
}

export default {
  ICAL_SOURCES,
  parseICalContent,
  parseICalDate,
  detectICalSource,
  fetchAndParseICal,
  syncICalSource,
  syncAllICalSources,
  syncAllListings
};
