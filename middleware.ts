/**
 * Gostaylo - Next.js Edge Middleware
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
  '/partner': ['PARTNER', 'ADMIN'],
  '/renter': ['RENTER', 'ADMIN', 'PARTNER']  // PARTNER can also be a renter
} as const;

/**
 * Verify JWT token using jose (Edge Runtime compatible)
 */
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Единый тред /messages/[id] обслуживается приложением без редиректа в legacy-кабинеты (Этап 3).

  // Check if route is protected
  const matchedRoute = Object.keys(PROTECTED_ROUTES).find(route => 
    pathname.startsWith(route)
  );
  
  if (!matchedRoute) {
    // Public route - allow access
    return NextResponse.next();
  }

  // Fail closed if server is misconfigured
  if (!JWT_SECRET) {
    return NextResponse.json({ success: false, error: 'Server misconfigured: JWT_SECRET is missing' }, { status: 500 });
  }
  
  // Protected route - verify authentication
  const token = request.cookies.get('gostaylo_session')?.value;
  
  if (!token) {
    // No token - redirect to home
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // Verify token
  const decoded = await verifyToken(token);
  
  if (!decoded) {
    // Invalid token - redirect to home
    const response = NextResponse.redirect(new URL('/', request.url));
    // Clear invalid cookie
    response.cookies.delete('gostaylo_session');
    return response;
  }
  
  // Check role authorization
  const allowedRoles = PROTECTED_ROUTES[matchedRoute as keyof typeof PROTECTED_ROUTES];
  
  if (!allowedRoles.includes(decoded.role as any)) {
    // Unauthorized role - redirect to home
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
