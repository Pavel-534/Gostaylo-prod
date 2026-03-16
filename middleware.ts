/**
 * Gostaylo - Next.js Middleware
 * Protects /admin, /partner, and /renter routes from unauthorized access
 * 
 * Security Features:
 * - JWT verification on protected routes
 * - Role-based access control
 * - Immediate redirect for unauthorized users
 * - Does NOT interfere with public routes (/listings, /[id])
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';

// Route protection configuration
const PROTECTED_ROUTES = {
  '/admin': ['ADMIN', 'MODERATOR'],
  '/partner': ['PARTNER', 'ADMIN'],
  '/renter': ['RENTER', 'ADMIN']
};

/**
 * Verify JWT token
 */
function verifyToken(token: string): { userId: string; role: string; email: string } | null {
  try {
    // Import jwt dynamically to avoid build issues
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded as { userId: string; role: string; email: string };
  } catch (error) {
    console.error('[MIDDLEWARE] JWT verification failed:', error);
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if route is protected
  const matchedRoute = Object.keys(PROTECTED_ROUTES).find(route => 
    pathname.startsWith(route)
  );
  
  if (!matchedRoute) {
    // Public route - allow access
    return NextResponse.next();
  }
  
  // Protected route - verify authentication
  const token = request.cookies.get('gostaylo_session')?.value;
  
  if (!token) {
    // No token - redirect to home
    console.log(`[MIDDLEWARE] Blocked access to ${pathname} - No token`);
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // Verify token
  const decoded = verifyToken(token);
  
  if (!decoded) {
    // Invalid token - redirect to home
    console.log(`[MIDDLEWARE] Blocked access to ${pathname} - Invalid token`);
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // Check role authorization
  const allowedRoles = PROTECTED_ROUTES[matchedRoute as keyof typeof PROTECTED_ROUTES];
  
  if (!allowedRoles.includes(decoded.role)) {
    // Unauthorized role - redirect to home
    console.log(`[MIDDLEWARE] Blocked access to ${pathname} - Role ${decoded.role} not allowed`);
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // MODERATOR restrictions
  if (decoded.role === 'MODERATOR') {
    const restrictedPaths = ['/admin/finances', '/admin/users', '/admin/marketing', '/admin/security', '/admin/settings'];
    if (restrictedPaths.some(path => pathname.startsWith(path))) {
      console.log(`[MIDDLEWARE] Blocked MODERATOR access to ${pathname}`);
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }
  
  // Authorized - allow access
  console.log(`[MIDDLEWARE] Allowed access to ${pathname} - Role: ${decoded.role}`);
  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    '/admin/:path*',
    '/partner/:path*',
    '/renter/:path*'
  ]
};
