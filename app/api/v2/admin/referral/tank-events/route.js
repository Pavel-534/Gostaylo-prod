import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionPayload } from '@/lib/services/session-service';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const session = await getSessionPayload();
  if (!session?.userId) return { error: 'Unauthorized', status: 401 };
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', session.userId)
    .maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (String(data?.role || '').toUpperCase() !== 'ADMIN') {
    return { error: 'Admin access required', status: 403 };
  }
  return { ok: true };
}

function applyTypeFilter(query, type) {
  const t = String(type || '').toLowerCase();
  if (!t || t === 'all') return query;
  if (t === 'topup') {
    return query.in('entry_type', ['organic_topup', 'manual_topup']);
  }
  if (t === 'debit') {
    return query.in('entry_type', ['referral_boost_debit', 'manual_debit']);
  }
  if (t === 'manual') {
    return query.in('entry_type', ['manual_topup', 'manual_debit']);
  }
  return query.eq('entry_type', t);
}

export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  const dateFrom = String(searchParams.get('dateFrom') || '').trim();
  const dateTo = String(searchParams.get('dateTo') || '').trim();
  const bookingId = String(searchParams.get('bookingId') || '').trim();
  const limitRaw = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, Math.floor(limitRaw))) : 300;

  try {
    let q = supabaseAdmin
      .from('marketing_promo_tank_ledger')
      .select('id,booking_id,entry_type,amount_thb,metadata,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    q = applyTypeFilter(q, type);
    if (dateFrom) {
      q = q.gte('created_at', `${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      q = q.lte('created_at', `${dateTo}T23:59:59.999Z`);
    }
    if (bookingId) {
      q = q.ilike('booking_id', `%${bookingId}%`);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message || 'TANK_EVENTS_READ_FAILED' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      filters: { type, dateFrom, dateTo, bookingId, limit },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'TANK_EVENTS_FAILED' },
      { status: 500 },
    );
  }
}

