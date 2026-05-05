/**
 * GoStayLo - Logout API
 * POST /api/v2/auth/logout
 * 
 * Clears session cookie
 */

import { NextResponse } from 'next/server';
import { clearGostayloSessionCookie } from '@/lib/auth/app-session-issue';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearGostayloSessionCookie(response);
  
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
