/**
 * GoStayLo - Current User API
 * GET /api/v2/auth/me — session user from DB
 * PATCH /api/v2/auth/me — update allowed profile fields (name, phone, avatar, notification prefs, locale, instant booking)
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { tryGetJwtSecret } from '@/lib/auth/jwt-secret';
import { verifyAppSessionJwt } from '@/lib/auth/verify-app-session-jwt';
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes';
import { stripLegacyModeratorMarker } from '@/lib/auth/display-name';
import { buildCommonProfileUpdates } from '@/lib/validation/profile-schema';
import { normalizeNotificationPreferences } from '@/lib/privacy/notification-preferences';
import {
  clearGostayloSessionCookie,
  signJwtForProfile,
  attachGostayloSessionCookie,
} from '@/lib/auth/app-session-issue';
export const dynamic = 'force-dynamic';

function mapRowToClientUser(user, dbRole) {
  const displayLast = stripLegacyModeratorMarker(user.last_name);
  const rawAvatar = user.avatar && String(user.avatar).trim();
  const prefs = normalizeNotificationPreferences(
    user.notification_preferences && typeof user.notification_preferences === 'object'
      ? user.notification_preferences
      : null,
  );

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
    preferredPayoutCurrency: user.preferred_payout_currency || user.preferred_currency || 'THB',
    preferred_payout_currency: user.preferred_payout_currency || user.preferred_currency || 'THB',
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
    instant_booking: user.instant_booking === true,
    instantBooking: user.instant_booking === true,
    preferred_language: user.preferred_language ?? null,
    preferredLanguage: user.preferred_language ?? null,
    terms_accepted:
      user.terms_accepted === true || Boolean(user.terms_accepted_at || user.legal_terms_accepted_at),
    termsAccepted:
      user.terms_accepted === true || Boolean(user.terms_accepted_at || user.legal_terms_accepted_at),
    terms_accepted_at: user.terms_accepted_at ?? user.legal_terms_accepted_at ?? null,
    termsAcceptedAt: user.terms_accepted_at ?? user.legal_terms_accepted_at ?? null,
    legal_terms_accepted_at: user.legal_terms_accepted_at ?? null,
    legalTermsAcceptedAt: user.legal_terms_accepted_at ?? null,
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
  const jwtCheck = tryGetJwtSecret();
  if (!jwtCheck.ok) {
    return { error: authErrorJson(AuthErrorCode.AUTH_JWT_NOT_CONFIGURED, 500) };
  }

  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('gostaylo_session');

  if (!sessionCookie?.value) {
    return { error: authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401, { user: null }) };
  }

  const v = verifyAppSessionJwt(sessionCookie.value, jwtCheck.secret);
  if (!v.ok) {
    return { error: authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401, { user: null }) };
  }

  return { jwtSecret: jwtCheck.secret, decoded: v.payload };
}

export async function GET() {
  const session = verifySessionCookie();
  if (session.error) return session.error;

  const { jwtSecret, decoded } = session;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return authErrorJson(AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED, 500);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: user, error } = await supabase.from('profiles').select('*').eq('id', decoded.userId).single();

  if (error || !user) {
    return authErrorJson(AuthErrorCode.AUTH_PROFILE_NOT_FOUND, 401, { user: null });
  }

  if (user.is_banned === true) {
    const res = NextResponse.json(
      { success: false, user: null, error_code: AuthErrorCode.AUTH_ACCOUNT_SUSPENDED },
      { status: 403 },
    );
    clearGostayloSessionCookie(res);
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
    const token = signJwtForProfile(user, jwtSecret);
    attachGostayloSessionCookie(res, token);
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
    return authErrorJson(AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return authErrorJson(AuthErrorCode.AUTH_INVALID_JSON, 400);
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
    return authErrorJson(AuthErrorCode.AUTH_PROFILE_NOT_FOUND, 404);
  }

  const { updates, error: commonProfileValidationError } = buildCommonProfileUpdates(body, current);
  if (commonProfileValidationError) {
    return authErrorJson(AuthErrorCode.AUTH_PROFILE_VALIDATION_FAILED, 400, {
      detail: commonProfileValidationError,
    });
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
    return authErrorJson(AuthErrorCode.AUTH_DATABASE_ERROR, 400);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'instant_booking')) {
    const prevInstant = current.instant_booking === true;
    const nextInstant = updates.instant_booking === true;
    if (prevInstant !== nextInstant) {
      const { error: listingSyncError } = await supabase
        .from('listings')
        .update({
          instant_booking: nextInstant,
          updated_at: new Date().toISOString(),
        })
        .eq('owner_id', decoded.userId)
        .eq('instant_booking', prevInstant);
      if (listingSyncError) {
        console.warn('[AUTH/ME PATCH] listing instant booking sync failed:', listingSyncError.message);
      }
    }
  }

  const dbRole = String(updated.role || 'RENTER').toUpperCase();
  return NextResponse.json({ success: true, user: mapRowToClientUser(updated, dbRole) });
}
