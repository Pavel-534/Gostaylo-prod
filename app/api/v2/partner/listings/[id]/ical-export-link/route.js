/**
 * GET /api/v2/partner/listings/[id]/ical-export-link
 *
 * Только для авторизованного владельца (кука gostaylo_session): отдаёт готовую ссылку
 * на ПУБЛИЧНЫЙ фид GET /api/v2/listings/[id]/ical?token=…
 * Внешние сервисы (Airbnb/Booking) подписываются на фид по токену в URL, без сессии.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateExportToken } from '@/lib/ical-export-token';
import { getPublicSiteUrl } from '@/lib/site-url.js';
import { requirePartnerSession } from '@/lib/services/session-service';

export const dynamic = 'force-dynamic';

function getPublicBaseUrl() {
  if (process.env.VERCEL_URL && !process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_BASE_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`.replace(/\/$/, '');
  }
  return getPublicSiteUrl();
}

export async function GET(request, context) {
  const params = await Promise.resolve(context.params);
  const listingId = params.id;

  const auth = await requirePartnerSession();
  if (auth.error) return auth.error;

  const userId = auth.userId;
  const userRole = auth.userRole;

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
