/**
 * Gostaylo - iCal Sync Admin API
 * GET /api/v2/admin/ical - Get sync logs with optional error filter
 * POST /api/v2/admin/ical - Trigger manual sync for a listing
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';

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
 * GET - Get sync logs
 * Query params: ?errors_only=true&limit=50&listing_id=xxx
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
  
  // Get summary stats
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
 * POST - Trigger manual sync or get listings with sync enabled
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
  
  if (action === 'get_sync_enabled') {
    // Get all listings with sync enabled
    const supabase = getSupabase();
    
    const { data: listings, error } = await supabase
      .from('listings')
      .select('id, title, owner_id, sync_settings')
      .not('sync_settings', 'is', null)
      .neq('status', 'DELETED');
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Filter only those with actual sources
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
  
  if (action === 'sync' && listingId) {
    // Trigger sync for specific listing
    // This would call the actual iCal sync logic
    // For now, just log the attempt
    const supabase = getSupabase();
    
    await supabase.from('ical_sync_logs').insert({
      listing_id: listingId,
      source_url: 'manual_trigger',
      status: 'pending',
      events_count: 0,
      synced_at: new Date().toISOString()
    });
    
    return NextResponse.json({
      success: true,
      message: 'Sync triggered'
    });
  }
  
  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
}
