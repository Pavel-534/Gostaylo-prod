/**
 * Gostaylo - Auth Login API (v2)
 * POST /api/v2/auth/login
 * 
 * Security: bcrypt password verification
 * RBAC: Role-based redirect destinations
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// RBAC redirect destinations
const ROLE_REDIRECTS = {
  'ADMIN': '/admin/dashboard',
  'MODERATOR': '/admin/moderation',
  'PARTNER': '/partner/dashboard',
  'RENTER': '/',
  'USER': '/'
};

export async function POST(request) {
  const timestamp = new Date().toISOString();
  console.log(`[LOGIN] ====== START ${timestamp} ======`);
  
  // 1. Check env vars
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    return NextResponse.json({ 
      success: false, 
      error: 'Database not configured'
    }, { status: 500 });
  }
  
  // 2. Create Supabase client
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // 3. Parse body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  
  const { email, password } = body;
  
  // 4. Validation
  if (!email) {
    return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
  }
  
  if (!password) {
    return NextResponse.json({ success: false, error: 'Password is required' }, { status: 400 });
  }
  
  console.log('[LOGIN] Attempt for:', email);
  
  // 5. Find user by email (try exact match first, then lowercase)
  let user = null;
  let error = null;
  
  // Try exact email first
  const exactResult = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();
  
  if (exactResult.data) {
    user = exactResult.data;
  } else {
    // Try lowercase
    const lowerResult = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    
    user = lowerResult.data;
    error = lowerResult.error;
  }
  
  if (!user) {
    console.log('[LOGIN] User not found:', email);
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid email or password' 
    }, { status: 401 });
  }
  
  console.log('[LOGIN] User found:', user.id, user.role);
  
  // 6. Verify password with bcrypt
  let passwordValid = false;
  
  if (user.password_hash) {
    // Check if it's a bcrypt hash (starts with $2)
    if (user.password_hash.startsWith('$2')) {
      passwordValid = await bcrypt.compare(password, user.password_hash);
    } 
    // Legacy: plain text comparison (for migration)
    else if (user.password_hash === password || user.password_hash === `hashed_${password}`) {
      passwordValid = true;
      // Upgrade to bcrypt hash
      const newHash = await bcrypt.hash(password, 10);
      await supabase
        .from('profiles')
        .update({ password_hash: newHash })
        .eq('id', user.id);
      console.log('[LOGIN] Password upgraded to bcrypt');
    }
  }
  
  if (!passwordValid) {
    console.log('[LOGIN] Invalid password for:', email);
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid email or password' 
    }, { status: 401 });
  }
  
  // 7. Update last login
  await supabase
    .from('profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);
  
  // 8. Determine role (check for moderator flag in last_name)
  const isModerator = user.last_name?.includes('[MODERATOR]');
  const effectiveRole = isModerator ? 'MODERATOR' : user.role;
  const cleanLastName = user.last_name?.replace(' [MODERATOR]', '') || '';
  
  // 9. Get redirect destination based on role
  const redirectTo = ROLE_REDIRECTS[effectiveRole] || '/';
  
  console.log(`[LOGIN] Success: ${email} (${effectiveRole}) -> ${redirectTo}`);
  
  // 10. Return user data with redirect
  return NextResponse.json({ 
    success: true, 
    user: {
      id: user.id,
      email: user.email,
      role: effectiveRole,
      firstName: user.first_name,
      lastName: cleanLastName,
      name: `${user.first_name || ''} ${cleanLastName}`.trim(),
      referralCode: user.referral_code,
      isVerified: user.is_verified,
      verificationStatus: user.verification_status,
      preferredCurrency: user.preferred_currency,
      notificationPreferences: user.notification_preferences,
      isModerator
    },
    redirectTo
  });
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/login',
    method: 'POST',
    timestamp: new Date().toISOString()
  });
}
