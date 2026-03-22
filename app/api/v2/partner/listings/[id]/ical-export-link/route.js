/**
 * GET /api/v2/partner/listings/[id]/ical-export-link
 * Returns the public iCal export URL (with token) for the authenticated listing owner.
 * Used in partner UI to paste into Airbnb / Booking.com calendar import.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { generateExportToken } from '@/lib/ical-export-token';
import { getPublicSiteUrl } from '@/lib/site-url.js';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';

function getPublicBaseUrl() {
  if (process.env.VERCEL_URL && !process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_BASE_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`.replace(/\/$/, '');
  }
  return getPublicSiteUrl();
}

export async function GET(request, context) {
  const params = await Promise.resolve(context.params);
  const listingId = params.id;

  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('gostaylo_session');
  if (!sessionCookie?.value) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let decoded;
  try {
    decoded = jwt.verify(sessionCookie.value, JWT_SECRET);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
  }

  const userId = decoded.userId;
  const userRole = decoded.role;
  if (!['PARTNER', 'ADMIN', 'MODERATOR'].includes(userRole)) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listing, error } = await supabase
    .from('listings')
    .select('id, owner_id, title')
    .eq('id', listingId)
    .single();

  if (error || !listing) {
    return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  }

  if (userRole !== 'ADMIN' && listing.owner_id !== userId) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }

  const token = generateExportToken(listingId);
  const base = getPublicBaseUrl();
  const exportUrl = `${base}/api/v2/listings/${listingId}/ical?token=${encodeURIComponent(token)}`;

  return NextResponse.json({
    success: true,
    data: {
      exportUrl,
      listingTitle: listing.title || '',
      /** Human hint for Vercel env */
      baseUrlUsed: base,
    },
  });
}
