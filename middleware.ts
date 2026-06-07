/**
 * GoStayLo — Next.js Edge Middleware
 * Защищает приватные зоны: /admin, /partner, /renter (JWT `gostaylo_session`, jose на Edge).
 *
 * Принципы:
 * - Fail-closed где возможно (конфиг, проверка бана, сбой Supabase).
 * - Минимум запросов к БД на Edge (один REST-вызов на `is_banned` после валидного JWT).
 * - Defense in depth: middleware — периметр UI; **API остаётся SSOT** через `requireAccess` / route guards.
 *
 * Не трогает публичные страницы вне matcher; `/api/*` — только `x-correlation-id` (Stage 56.0).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_SERVER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROTECTED_ROUTES = {
  '/admin': ['ADMIN', 'MODERATOR'],
  '/partner': ['PARTNER', 'ADMIN', 'MODERATOR'],
  '/renter': ['RENTER', 'ADMIN', 'PARTNER', 'MODERATOR'],
} as const;

/**
 * Бан и целостность профиля: fail-closed (ошибка сети, 4xx/5xx, пустой ответ → «как забанен»).
 * Критичные операции всё равно перепроверяются на Node в API.
 */
async function isUserBanned(userId: string): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !userId) {
    console.error('[Middleware] Ban check skipped: missing SUPABASE_URL, SERVICE_ROLE_KEY, or userId');
    return true;
  }

  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=is_banned`;
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(`[Middleware] Ban check HTTP ${res.status} for user ${userId}`);
      return true;
    }

    const rows = (await res.json()) as { is_banned?: boolean }[];
    if (!Array.isArray(rows) || rows.length === 0) {
      console.error(`[Middleware] Ban check: empty profile row for user ${userId}`);
      return true;
    }

    return rows[0]?.is_banned === true;
  } catch (e) {
    console.error('[Middleware] Ban check error:', e);
    return true;
  }
}

async function verifyToken(token: string): Promise<{ userId: string; role: string; email: string } | null> {
  try {
    if (!JWT_SECRET) return null;
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });

    return {
      userId: payload.userId as string,
      role: payload.role as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

/**
 * 301 с legacy URL кабинетов на единый инбокс (Этап 4).
 * Должно выполняться до проверки JWT — закладки без сессии всё равно попадут на /messages/.
 */
function legacyMessagesRedirect(request: NextRequest): NextResponse | null {
  const raw = request.nextUrl.pathname;
  const p = raw.replace(/\/$/, '') || '/';

  if (p === '/partner/messages/archived' || p === '/renter/messages/archived') {
    return NextResponse.redirect(new URL('/messages/', request.url), 301);
  }
  if (p === '/partner/messages' || p === '/renter/messages') {
    return NextResponse.redirect(new URL('/messages/', request.url), 301);
  }
  const m = p.match(/^\/(partner|renter)\/messages\/(.+)$/);
  if (m && m[2] && m[2] !== 'archived') {
    const id = m[2];
    return NextResponse.redirect(new URL(`/messages/${encodeURIComponent(id)}/`, request.url), 301);
  }
  return null;
}

/** Нет сессии / битая сессия / бан → единая точка входа (см. TECHNICAL_MANIFESTO). */
function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
  const dest = pathname + request.nextUrl.search;
  const url = new URL('/login', request.url);
  url.searchParams.set('redirect', dest);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /** Stage 56.0 — propagate correlation id into API route handlers (Node ALS picks it up at boundary). */
  if (pathname.startsWith('/api/')) {
    const existing = request.headers.get('x-correlation-id');
    const id =
      existing && String(existing).trim().length > 0
        ? String(existing).trim()
        : globalThis.crypto.randomUUID();
    const reqHeaders = new Headers(request.headers);
    reqHeaders.set('x-correlation-id', id);
    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set('x-correlation-id', id);
    return res;
  }

  const legacy = legacyMessagesRedirect(request);
  if (legacy) return legacy;

  const matchedRoute = Object.keys(PROTECTED_ROUTES).find((route) => pathname.startsWith(route));

  if (!matchedRoute) {
    return NextResponse.next();
  }

  if (!JWT_SECRET) {
    return redirectToLogin(request, pathname);
  }

  const token = request.cookies.get('gostaylo_session')?.value;

  if (!token) {
    return redirectToLogin(request, pathname);
  }

  const decoded = await verifyToken(token);

  if (!decoded) {
    const response = redirectToLogin(request, pathname);
    response.cookies.delete('gostaylo_session');
    return response;
  }

  if (await isUserBanned(decoded.userId)) {
    const response = redirectToLogin(request, pathname);
    response.cookies.delete('gostaylo_session');
    return response;
  }

  const allowedRoles = PROTECTED_ROUTES[matchedRoute as keyof typeof PROTECTED_ROUTES];
  // `as const` tuples union makes `.includes` expect only roles present in *every* zone; widen for runtime check.
  const roleOk = (allowedRoles as readonly string[]).includes(decoded.role);

  if (!roleOk) {
    // Сессия есть, но роль не подходит для зоны — на главную (не путать с «нет сессии»)
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (decoded.role === 'MODERATOR') {
    const restrictedPaths = [
      '/admin/finances',
      '/admin/users',
      '/admin/marketing',
      '/admin/security',
      '/admin/settings',
    ];
    if (restrictedPaths.some((path) => pathname.startsWith(path))) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/admin/:path*',
    '/partner/:path*',
    '/renter/:path*',
    // /messages — не в matcher: здесь не ставим guard; редиректы только с /partner|/renter (см. legacyMessagesRedirect).
  ],
};
