/**
 * Supabase OAuth (PKCE) callback — merges auth.users ↔ profiles, выдаёт gostaylo_session JWT.
 *
 * Redirect URLs в Supabase Dashboard: `${SITE}/auth/callback` (см. TECHNICAL_MANIFESTO Stage 79.0).
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.redirect(`${origin}/auth/oauth-error/?reason=config`);
  }
  if (!supabaseAdmin) {
    return NextResponse.redirect(`${origin}/auth/oauth-error/?reason=config`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/oauth-error/?reason=no_code`);
  }

  const oauthLegalAccepted = request.cookies.get('gostaylo_oauth_legal')?.value === '1';

  const defaultPath = `${origin}${safeInternalPath(rawNext || '/profile/')}`;
  let response = NextResponse.redirect(defaultPath);

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

  const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchErr) {
    console.error('[AUTH CALLBACK]', exchErr.message);
    return NextResponse.redirect(`${origin}/auth/oauth-error/?reason=exchange`);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const authUser = session?.user;
  if (!authUser) {
    return NextResponse.redirect(`${origin}/auth/oauth-error/?reason=no_session`);
  }

  let jwtSecret;
  try {
    jwtSecret = getJwtSecret();
  } catch {
    return NextResponse.redirect(`${origin}/auth/oauth-error/?reason=jwt`);
  }

  const sync = await upsertOAuthProfile({
    supabaseAdmin,
    authUser,
    legalAcceptedFromRegisterFlow: oauthLegalAccepted,
    request,
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

  return response;
}
