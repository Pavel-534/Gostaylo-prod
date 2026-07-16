/**
 * Supabase OAuth (PKCE) callback — merges auth.users ↔ profiles, выдаёт gostaylo_session JWT.
 *
 * PKCE: `exchangeCodeForSession(code)` (supabase-js v2) бьётся в GoTrue `/token?grant_type=pkce` с
 * `code_verifier` из кук сессии. Явного `redirect_uri` в API нет; критично, чтобы
 * - в Dashboard был разрешён **тот же** URL, что `redirectTo` в `signInWithOAuth` (см. `contexts/auth-context.jsx` — `${origin}/auth/callback/`);
 * - старт OAuth и этот callback были **одного host** (без путаницы www / apex).
 *
 * `AUTH_CALLBACK_DEBUG=1` — детальные console.log (и на production).
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { tryGetJwtSecret } from '@/lib/auth/jwt-secret';
import { verifyAppSessionJwt } from '@/lib/auth/verify-app-session-jwt';
import {
  attachGostayloSessionCookie,
  signJwtForProfile,
} from '@/lib/auth/app-session-issue';
import { supabaseAdmin, getSupabaseServerUrl } from '@/lib/supabase';
import { upsertOAuthProfile } from '@/lib/services/auth/oauth-profile-sync.service';
import { safeInternalPath } from '@/lib/security/safe-internal-path';
import { isRussia } from '@/lib/geo';

export const dynamic = 'force-dynamic';

/** Должен совпадать с `new URL(\`${origin}/auth/callback/\`)` на клиенте. */
const OAUTH_CALLBACK_PATH = '/auth/callback/';

function authCallbackDebugEnabled() {
  return process.env.AUTH_CALLBACK_DEBUG === '1' || process.env.NODE_ENV !== 'production';
}

function logDebugStep(step, detail) {
  if (!authCallbackDebugEnabled()) return;
  if (detail !== undefined) {
    console.log(`[AUTH CALLBACK] ${step}`, detail);
  } else {
    console.log(`[AUTH CALLBACK] ${step}`);
  }
}

function redirectToOAuthError(origin, reason) {
  return NextResponse.redirect(
    `${origin}/auth/oauth-error/?reason=${encodeURIComponent(String(reason))}`,
  );
}

function redirectToLinkConflict(origin, token, provider) {
  const url = new URL('/auth/link-conflict', origin);
  if (token) url.searchParams.set('token', String(token));
  if (provider) url.searchParams.set('provider', String(provider));
  return NextResponse.redirect(url.href, 302);
}

/** Канонический origin за reverse-proxy (VPS / Cloudflare → Vercel). */
function getRequestOrigin(request) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost?.split(',')[0]?.trim() || request.headers.get('host');
  const proto = (request.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim();
  if (host) {
    return `${proto}://${host}`.replace(/\/$/, '');
  }
  return new URL(request.url).origin;
}

export async function GET(request) {
  if (isRussia(request)) {
    const origin = getRequestOrigin(request);
    return redirectToOAuthError(origin, 'region_restricted');
  }

  const urlObj = new URL(request.url);
  const origin = getRequestOrigin(request);
  const code = urlObj.searchParams.get('code');
  const rawNext = urlObj.searchParams.get('next');
  const canonicalCallbackUrl = new URL(OAUTH_CALLBACK_PATH, origin).href;

  logDebugStep('[Received Code]', {
    hasCode: Boolean(code),
    codeLength: code?.length ?? 0,
    next: rawNext,
    canonicalCallbackUrl,
    host: request.headers.get('x-forwarded-host') || request.headers.get('host') || '(missing)',
    forwardedProto: request.headers.get('x-forwarded-proto') || '(missing)',
  });

  const supabaseUrl = getSupabaseServerUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return redirectToOAuthError(origin, 'config');
  }
  if (!supabaseAdmin) {
    return redirectToOAuthError(origin, 'config');
  }

  if (!code) {
    return redirectToOAuthError(origin, 'no_code');
  }

  const oauthLegalAccepted = request.cookies.get('gostaylo_oauth_legal')?.value === '1';

  const defaultPath = `${origin}${safeInternalPath(rawNext || '/profile/')}`;
  /** Один ответ: сюда пишутся куки Supabase (PKCE) и `gostaylo_session`. */
  let response = NextResponse.redirect(defaultPath, 302);

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exchErr) {
      console.error('[AUTH CALLBACK] exchangeCodeForSession failed:', exchErr.message);
      return redirectToOAuthError(origin, 'exchange');
    }
  } catch (e) {
    console.error('[AUTH CALLBACK] exchangeCodeForSession exception:', e);
    return redirectToOAuthError(origin, 'exchange');
  }

  logDebugStep('[Exchange Success]');

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const authUser = session?.user;
  if (!authUser) {
    console.error('[AUTH CALLBACK] getSession returned no user after exchange');
    return redirectToOAuthError(origin, 'no_session');
  }

  let jwtSecret;
  const jwtCheck = tryGetJwtSecret();
  if (!jwtCheck.ok) {
    console.error('[AUTH CALLBACK] JWT_SECRET missing:', jwtCheck.error?.message || 'missing');
    return redirectToOAuthError(origin, 'jwt');
  }
  jwtSecret = jwtCheck.secret;

  let challengerProfileId = null;
  const priorSession = request.cookies.get('gostaylo_session')?.value;
  if (priorSession && jwtSecret) {
    const prior = verifyAppSessionJwt(priorSession, jwtSecret);
    if (prior.ok && prior.payload?.userId) {
      challengerProfileId = String(prior.payload.userId);
    }
  }

  let sync;
  try {
    sync = await upsertOAuthProfile({
      supabaseAdmin,
      authUser,
      legalAcceptedFromRegisterFlow: oauthLegalAccepted,
      request,
      challengerProfileId,
    });
  } catch (e) {
    console.error('[AUTH CALLBACK SYNC ERROR]', e);
    return redirectToOAuthError(origin, 'sync_exception');
  }

  if (!sync.ok || !sync.profile) {
    console.error('[AUTH CALLBACK SYNC ERROR]', {
      error: sync.error,
      ok: sync.ok,
      hasProfile: Boolean(sync.profile),
    });
    if (sync.error === 'AUTH_PROFILE_AUTH_CONFLICT' && sync.conflictToken) {
      return redirectToLinkConflict(origin, sync.conflictToken, sync.conflictProvider);
    }
    const reason = sync.error === 'ACCOUNT_SUSPENDED' ? 'suspended' : sync.error === 'AUTH_PROFILE_AUTH_CONFLICT' ? 'account_link' : 'sync';
    return redirectToOAuthError(origin, reason);
  }

  const destination =
    sync.needsLegalCompletion
      ? `${origin}/auth/complete-legal/?next=${encodeURIComponent(safeInternalPath(rawNext || '/profile/'))}`
      : `${origin}${safeInternalPath(rawNext || '/profile/')}`;

  response.headers.set('Location', destination);

  const token = signJwtForProfile(sync.profile, jwtSecret);
  logDebugStep('[JWT Generated]', { length: token?.length ?? 0 });

  attachGostayloSessionCookie(response, token);

  const secureForLog =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.FORCE_SECURE_COOKIES === 'true';
  logDebugStep('[Cookie Attached]', {
    name: 'gostaylo_session',
    path: '/',
    httpOnly: true,
    secure: secureForLog,
    sameSite: 'lax',
  });

  response.cookies.set('gostaylo_pending_ref', '', { path: '/', maxAge: 0, sameSite: 'lax' });
  response.cookies.set('gostaylo_oauth_legal', '', { path: '/', maxAge: 0, sameSite: 'lax' });

  const attached = response.cookies.get('gostaylo_session');
  logDebugStep('[Redirect]', {
    destination,
    gostayloSessionCookieSet: Boolean(attached?.value),
  });

  return response;
}
