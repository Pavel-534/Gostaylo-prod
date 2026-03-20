/**
 * Gostaylo - Auth Login API (v2)
 * POST /api/v2/auth/login
 * 
 * Security: bcrypt + JWT HttpOnly Cookie (30 days)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimitCheck } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';

const ROLE_REDIRECTS = {
  'ADMIN': '/admin/dashboard',
  'MODERATOR': '/admin/moderation',
  'PARTNER': '/partner/dashboard',
  'RENTER': '/',
  'USER': '/'
};

export async function POST(request) {
  const rl = rateLimitCheck(request, 'auth');
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
  }
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  
  const { email, password, redirectTo: requestedRedirect } = body;
  
  if (!email || !password) {
    return NextResponse.json({ success: false, error: 'Email and password required' }, { status: 400 });
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  
  // Find user (try exact then lowercase)
  let user = null;
  
  const { data: exactUser } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();
  
  if (exactUser) {
    user = exactUser;
  } else {
    const { data: lowerUser } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', normalizedEmail)
      .single();
    user = lowerUser;
  }
  
  if (!user) {
    return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
  }
  
  // Verify password
  let passwordValid = false;
  
  if (user.password_hash) {
    if (user.password_hash.startsWith('$2')) {
      passwordValid = await bcrypt.compare(password, user.password_hash);
    } else if (user.password_hash === password || user.password_hash === `hashed_${password}`) {
      passwordValid = true;
      // Upgrade to bcrypt
      const newHash = await bcrypt.hash(password, 10);
      await supabase.from('profiles').update({ password_hash: newHash }).eq('id', user.id);
    }
  }
  
  if (!passwordValid) {
    return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
  }
  
  // Check verification status
  if (!user.is_verified && user.role !== 'ADMIN') {
    return NextResponse.json({ 
      success: false, 
      error: 'Please verify your email first',
      requiresVerification: true,
      email: user.email
    }, { status: 403 });
  }
  
  // Update last login
  await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
  
  // Determine effective role (supports "[MODERATOR]" marker)
  const effectiveRole = user.last_name?.includes('[MODERATOR]') ? 'MODERATOR' : user.role;

  // Generate JWT token (30 days)
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: effectiveRole,
      firstName: user.first_name
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  
  // Determine redirect
  // Use requested redirect if provided, otherwise use role-based redirect
  const redirectTo = requestedRedirect || ROLE_REDIRECTS[effectiveRole] || '/';
  
  // Create response with HttpOnly cookie
  const response = NextResponse.json({ 
    success: true, 
    user: {
      id: user.id,
      email: user.email,
      role: effectiveRole,
      firstName: user.first_name,
      lastName: user.last_name?.replace(' [MODERATOR]', '') || '',
      name: `${user.first_name || ''} ${user.last_name?.replace(' [MODERATOR]', '') || ''}`.trim(),
      phone: user.phone || null,
      referralCode: user.referral_code,
      isVerified: user.is_verified,
      preferredCurrency: user.preferred_currency,
      telegram_id: user.telegram_id || null,
      telegram_username: user.telegram_username || null
    },
    redirectTo
  });
  
  // Set HttpOnly cookie (30 days)
  // SameSite=Lax allows the cookie to be sent with top-level navigations
  // This is important for links from Telegram opening in browser
  response.cookies.set('gostaylo_session', token, {
    httpOnly: true,
    secure: true, // Always secure for HTTPS
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
    // Don't set domain - let browser use the default (current domain)
  });
  
  return response;
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/login',
    timestamp: new Date().toISOString()
  });
}
