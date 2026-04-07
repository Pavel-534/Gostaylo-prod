/**
 * GoStayLo - Next.js Edge Middleware
 * Protects /admin, /partner, and /renter routes from unauthorized access
 * 
 * ✅ Edge Runtime Compatible (using jose instead of jsonwebtoken)
 * 
 * Security Features:
 * - JWT verification using Edge-compatible jose library
 * - Role-based access control
 * - Immediate redirect for unauthorized users
 * - Does NOT interfere with public routes
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;

// Route protection configuration
const PROTECTED_ROUTES = {
  '/admin': ['ADMIN', 'MODERATOR'],
  '/partner': ['PARTNER', 'ADMIN', 'MODERATOR'],
  '/renter': ['RENTER', 'ADMIN', 'PARTNER', 'MODERATOR'],
} as const;

/**
 * Verify JWT token using jose (Edge Runtime compatible)
 */
async function fetchProfileIsBanned(userId: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !userId) return false;
  try {
    const res = await fetch(
      `${url.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=is_banned`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        cache: 'no-store',
      }
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as { is_banned?: boolean }[];
    return rows?.[0]?.is_banned === true;
  } catch {
    return false;
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
      email: payload.email as string
    };
  } catch (error) {
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // В matcher сейчас нет /api — оставляем явный bypass на случай расширения matcher (i18n и т.д.).
  // Вебхуки и прочие API не должны проходить через редиректы авторизации.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const legacy = legacyMessagesRedirect(request);
  if (legacy) return legacy;

  // Check if route is protected
  const matchedRoute = Object.keys(PROTECTED_ROUTES).find(route => 
    pathname.startsWith(route)
  );
  
  if (!matchedRoute) {
    // Public route - allow access
    return NextResponse.next();
  }

  /** Нет сессии / битая сессия → единая точка входа (см. TECHNICAL_MANIFESTO). */
  function redirectToLogin(): NextResponse {
    const dest = pathname + request.nextUrl.search;
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', dest);
    return NextResponse.redirect(url);
  }

  // Fail closed if server is misconfigured (браузерным маршрутам — на /login)
  if (!JWT_SECRET) {
    return redirectToLogin();
  }
  
  // Protected route - verify authentication
  const token = request.cookies.get('gostaylo_session')?.value;
  
  if (!token) {
    return redirectToLogin();
  }
  
  // Verify token
  const decoded = await verifyToken(token);
  
  if (!decoded) {
    const response = redirectToLogin();
    response.cookies.delete('gostaylo_session');
    return response;
  }

  const banned = await fetchProfileIsBanned(decoded.userId);
  if (banned) {
    const response = redirectToLogin();
    response.cookies.delete('gostaylo_session');
    return response;
  }
  
  // Check role authorization
  const allowedRoles = PROTECTED_ROUTES[matchedRoute as keyof typeof PROTECTED_ROUTES];
  
  if (!allowedRoles.includes(decoded.role as any)) {
    // Сессия есть, но роль не подходит для зоны — на главную (не путать с «нет сессии»)
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // MODERATOR restrictions
  if (decoded.role === 'MODERATOR') {
    const restrictedPaths = ['/admin/finances', '/admin/users', '/admin/marketing', '/admin/security', '/admin/settings'];
    if (restrictedPaths.some(path => pathname.startsWith(path))) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }
  
  // Authorized - allow access
  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    '/admin/:path*',
    '/partner/:path*',
    '/renter/:path*',
    '/messages/:path*',
  ]
};
