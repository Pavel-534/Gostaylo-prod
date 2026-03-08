/**
 * Gostaylo - Logout API
 * POST /api/v2/auth/logout
 * 
 * Clears session cookie
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // Clear the session cookie
  response.cookies.set('gostaylo_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  });
  
  return response;
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/logout',
    method: 'POST',
    timestamp: new Date().toISOString()
  });
}
