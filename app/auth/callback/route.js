/**
 * Supabase OAuth (PKCE) callback — merges auth.users ↔ profiles, выдаёт gostaylo_session JWT.
 *
 * Redirect URLs в Supabase Dashboard: `${SITE}/auth/callback` (см. TECHNICAL_MANIFESTO Stage 79.0).
 *
 * Диагностика: в development логируется этап (code / exchange / sync / cookie).
 * На production задайте `AUTH_CALLBACK_DEBUG=1`, чтобы включить те же console.log.
 *
 * Важно: Supabase записывает свои куки в объект `response` через `exchangeCodeForSession`;
 * `gostaylo_session` добавляется в тот же экземпляр до `return` — браузер получает один 302 со всеми Set-Cookie.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { getJwtSecret } from '@/lib/auth/jwt-secret';
import {
  attachGostayloSessionCookie,
  signJwtForProfile,
} from '@/lib/auth/app-session-issue';
import { supabaseAdmin } from '@/lib/supabase';
import { upsertOAuthProfile } from '@/lib/services/auth/oauth-profile-sync.service';

export const dynamic = 'force-dynamic';

function authCallbackDebugEnabled() {
  return process.env.AUTH_CALLBACK_DEBUG === '1' || process.env.NODE_ENV !== 'production';
}

/** @param {unknown[]} args */
function dbg(...args) {
  if (!authCallbackDebugEnabled()) return;
  console.log('[AUTH CALLBACK]', ...args);
}

function safeInternalPath(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s.startsWith('/') || s.startsWith('//')) return '/profile/';
  return s.endsWith('/') ? s : `${s}/`;
}

export async function GET(request) {
  const urlObj = new URL(request.url);
  const origin = urlObj.origin;
  const code = urlObj.searchParams.get('code');
  const rawNext = urlObj.searchParams.get('next');

  dbg('request', {
    origin,
    hasCode: Boolean(code),
    codeLength: code?.length ?? 0,
    next: rawNext,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    dbg('abort: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return NextResponse.redirect(`${origin}/auth/oauth-error/?reason=config`);
  }
  if (!supabaseAdmin) {
    dbg('abort: supabaseAdmin not configured');
    return NextResponse.redirect(`${origin}/auth/oauth-error/?reason=config`);
  }

  if (!code) {
    dbg('abort: no ?code= from provider (check redirect URL / flow)');
    return NextResponse.redirect(`${origin}/auth/oauth-error/?reason=no_code`);
  }

  const oauthLegalAccepted = request.cookies.get('gostaylo_oauth_legal')?.value === '1';

  const defaultPath = `${origin}${safeInternalPath(rawNext || '/profile/')}`;
  /** Один объект ответа на весь успешный путь: сюда же пишутся куки Supabase и `gostaylo_session`. */
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

  dbg('calling exchangeCodeForSession');
  const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchErr) {
    console.error('[AUTH CALLBACK] exchangeCodeForSession failed:', exchErr.message);
    dbg('abort: exchange failed (PKCE verifier missing/wrong host is a common cause)');
    /** Новый ответ — намеренно без частичных кук от `response` выше. */
    return NextResponse.redirect(`${origin}/auth/oauth-error/?reason=exchange`);
  }
  dbg('exchangeCodeForSession OK');

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const authUser = session?.user;
  if (!authUser) {
    console.error('[AUTH CALLBACK] getSession returned no user after exchange');
    dbg('abort: no_session');
    return NextResponse.redirect(`${origin}/auth/oauth-error/?reason=no_session`);
  }
  dbg('supabase session user', { id: authUser.id, hasEmail: Boolean(authUser?.email) });

  let jwtSecret;
  try {
    jwtSecret = getJwtSecret();
  } catch (e) {
    console.error('[AUTH CALLBACK] JWT_SECRET missing:', e?.message || e);
    dbg('abort: jwt');
    return NextResponse.redirect(`${origin}/auth/oauth-error/?reason=jwt`);
  }

  let sync;
  try {
    dbg('upsertOAuthProfile start');
    sync = await upsertOAuthProfile({
      supabaseAdmin,
      authUser,
      legalAcceptedFromRegisterFlow: oauthLegalAccepted,
      request,
    });
  } catch (e) {
    console.error('[AUTH CALLBACK] upsertOAuthProfile threw:', e);
    dbg('abort: sync exception');
    return NextResponse.redirect(`${origin}/auth/oauth-error/?reason=sync_exception`);
  }

  dbg('upsertOAuthProfile result', {
    ok: sync.ok,
    error: sync.error || null,
    needsLegalCompletion: Boolean(sync.needsLegalCompletion),
    hasProfile: Boolean(sync.profile),
  });

  if (!sync.ok || !sync.profile) {
    return NextResponse.redirect(
      `${origin}/auth/oauth-error/?reason=${encodeURIComponent(sync.error || 'sync_failed')}`,
    );
  }

  const destination =
    sync.needsLegalCompletion
      ? `${origin}/auth/complete-legal/`
      : `${origin}${safeInternalPath(rawNext || '/profile/')}`;

  response.headers.set('Location', destination);

  const token = signJwtForProfile(sync.profile, jwtSecret);
  attachGostayloSessionCookie(response, token);

  response.cookies.set('gostaylo_pending_ref', '', { path: '/', maxAge: 0, sameSite: 'lax' });
  response.cookies.set('gostaylo_oauth_legal', '', { path: '/', maxAge: 0, sameSite: 'lax' });

  const attached = response.cookies.get('gostaylo_session');
  dbg('success redirect', {
    destination,
    gostayloSessionCookieSet: Boolean(attached?.value),
    tokenLength: token?.length ?? 0,
  });

  return response;
}
