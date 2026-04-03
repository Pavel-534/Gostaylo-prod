/**
 * GoStayLo - Partner Application Status API
 * GET /api/v2/partner/application-status
 * 
 * Returns the status of the current user's partner application
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/auth/jwt-secret';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  let jwtSecret;
  try {
    jwtSecret = getJwtSecret();
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }

  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('gostaylo_session');

  if (!sessionCookie?.value) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let decoded;
  try {
    decoded = jwt.verify(sessionCookie.value, jwtSecret);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
  }
  
  const userId = decoded.userId;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // Get application status
  const { data: application, error } = await supabase
    .from('partner_applications')
    .select('id, status, rejection_reason, created_at, reviewed_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('[APP-STATUS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  
  if (!application) {
    return NextResponse.json({
      success: true,
      hasApplication: false,
      status: null
    });
  }
  
  return NextResponse.json({
    success: true,
    hasApplication: true,
    status: application.status,
    rejectionReason: application.rejection_reason,
    appliedAt: application.created_at,
    reviewedAt: application.reviewed_at
  });
}
