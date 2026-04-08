/**
 * GoStayLo - Current User API
 * GET /api/v2/auth/me — session user from DB
 * PATCH /api/v2/auth/me — update allowed profile fields (name, phone, avatar, notification prefs)
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/auth/jwt-secret';
import { stripLegacyModeratorMarker } from '@/lib/auth/display-name';
export const dynamic = 'force-dynamic';

function mapRowToClientUser(user, dbRole) {
  const displayLast = stripLegacyModeratorMarker(user.last_name);
  const rawAvatar = user.avatar && String(user.avatar).trim();
  const prefs = user.notification_preferences && typeof user.notification_preferences === 'object'
    ? user.notification_preferences
    : { email: true, telegram: false, telegramChatId: null };

  return {
    id: user.id,
    email: user.email,
    role: dbRole,
    firstName: user.first_name,
    lastName: displayLast,
    first_name: user.first_name,
    last_name: displayLast,
    name: `${user.first_name || ''} ${displayLast}`.trim(),
    phone: user.phone,
    avatar: rawAvatar || null,
    referralCode: user.referral_code,
    referral_code: user.referral_code,
    isVerified: user.is_verified,
    is_verified: user.is_verified,
    verification_status: user.verification_status,
    rejection_reason: user.rejection_reason,
    preferredCurrency: user.preferred_currency,
    preferred_currency: user.preferred_currency,
    telegram_id: user.telegram_id,
    telegram_username: user.telegram_username ?? null,
    telegram_linked: user.telegram_linked ?? false,
    email_verified_at: user.email_verified_at,
    created_at: user.created_at,
    isModerator: dbRole === 'MODERATOR',
    notification_preferences: prefs,
    notificationPreferences: prefs,
    quiet_hour_start: user.quiet_hour_start || '22:00:00',
    quiet_hour_end: user.quiet_hour_end || '08:00:00',
    quiet_mode_enabled: user.quiet_mode_enabled === true,
  };
}

function normalizeQuietHour(rawValue, fallback) {
  const src = String(rawValue ?? '').trim();
  if (!src) return fallback;
  const m = src.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return fallback;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return fallback;
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}

function verifySessionCookie() {
  let jwtSecret;
  try {
    jwtSecret = getJwtSecret();
  } catch (e) {
    return { error: NextResponse.json({ success: false, error: e.message, user: null }, { status: 500 }) };
  }

  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('gostaylo_session');

  if (!sessionCookie?.value) {
    return { error: NextResponse.json({ success: false, user: null }, { status: 401 }) };
  }

  let decoded;
  try {
    decoded = jwt.verify(sessionCookie.value, jwtSecret);
  } catch {
    return { error: NextResponse.json({ success: false, user: null, error: 'Invalid session' }, { status: 401 }) };
  }

  return { jwtSecret, decoded };
}

export async function GET() {
  const session = verifySessionCookie();
  if (session.error) return session.error;

  const { jwtSecret, decoded } = session;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: user, error } = await supabase.from('profiles').select('*').eq('id', decoded.userId).single();

  if (error || !user) {
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }

  if (user.is_banned === true) {
    const res = NextResponse.json(
      { success: false, user: null, error: 'Account suspended' },
      { status: 403 },
    );
    res.cookies.delete('gostaylo_session');
    return res;
  }

  const dbRole = String(user.role || 'RENTER').toUpperCase();
  const jwtRole = String(decoded.role || '').toUpperCase();
  const needsJwtRefresh = jwtRole !== dbRole;

  const payload = {
    success: true,
    user: mapRowToClientUser(user, dbRole),
  };

  const res = NextResponse.json(payload);

  if (needsJwtRefresh) {
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: dbRole,
        firstName: user.first_name,
      },
      jwtSecret,
      { expiresIn: '30d' }
    );
    const secureCookie =
      process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIES === 'true';
    res.cookies.set('gostaylo_session', token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
  }

  return res;
}

export async function PATCH(request) {
  const session = verifySessionCookie();
  if (session.error) return session.error;

  const { decoded } = session;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: current, error: loadErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', decoded.userId)
    .single();

  if (loadErr || !current) {
    return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
  }

  const updates = {};

  if (body.first_name !== undefined) {
    updates.first_name = String(body.first_name || '').trim().slice(0, 100) || null;
  }
  if (body.firstName !== undefined && body.first_name === undefined) {
    updates.first_name = String(body.firstName || '').trim().slice(0, 100) || null;
  }

  if (body.last_name !== undefined) {
    updates.last_name = String(body.last_name || '').trim().slice(0, 100) || null;
  }
  if (body.lastName !== undefined && body.last_name === undefined) {
    updates.last_name = String(body.lastName || '').trim().slice(0, 100) || null;
  }

  if (body.phone !== undefined) {
    const p = body.phone == null ? null : String(body.phone).trim().slice(0, 50);
    updates.phone = p || null;
  }

  if (body.avatar !== undefined) {
    if (body.avatar === null || body.avatar === '') {
      updates.avatar = null;
    } else {
      const a = String(body.avatar).trim().slice(0, 2048);
      updates.avatar = a || null;
    }
  }

  const incomingPrefs = body.notification_preferences ?? body.notificationPreferences;
  if (incomingPrefs !== undefined && incomingPrefs !== null && typeof incomingPrefs === 'object') {
    const base =
      current.notification_preferences && typeof current.notification_preferences === 'object'
        ? { ...current.notification_preferences }
        : { email: true, telegram: false, telegramChatId: null };
    updates.notification_preferences = { ...base, ...incomingPrefs };
  }

  if (body.quiet_mode_enabled !== undefined) {
    updates.quiet_mode_enabled = body.quiet_mode_enabled === true;
  }
  if (body.quiet_hour_start !== undefined) {
    updates.quiet_hour_start = normalizeQuietHour(body.quiet_hour_start, '22:00:00');
  }
  if (body.quiet_hour_end !== undefined) {
    updates.quiet_hour_end = normalizeQuietHour(body.quiet_hour_end, '08:00:00');
  }

  if (Object.keys(updates).length === 0) {
    const dbRole = String(current.role || 'RENTER').toUpperCase();
    return NextResponse.json({ success: true, user: mapRowToClientUser(current, dbRole) });
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error: upErr } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', decoded.userId)
    .select('*')
    .single();

  if (upErr || !updated) {
    console.error('[AUTH/ME PATCH]', upErr);
    return NextResponse.json(
      { success: false, error: upErr?.message || 'Update failed' },
      { status: 400 }
    );
  }

  const dbRole = String(updated.role || 'RENTER').toUpperCase();
  return NextResponse.json({ success: true, user: mapRowToClientUser(updated, dbRole) });
}
