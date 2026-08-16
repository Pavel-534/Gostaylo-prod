/**
 * GoStayLo - Forgot Password API
 * POST /api/v2/auth/forgot-password
 * 
 * Sends password reset email
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { rateLimitCheck } from '@/lib/rate-limit';
import { getJwtSecret } from '@/lib/auth/jwt-secret';
import { getSiteDisplayName, getPublicSiteUrl } from '@/lib/site-url';
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes';
import { hashPiiForLog } from '@/lib/logging/pii-scrub.js';
import { EmailService } from '@/lib/services/email.service.js';
import { buildSimplePremiumEmailTemplate } from '@/lib/email/simple-transactional-email.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const rl = await rateLimitCheck(request, 'auth');
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
  }

  let jwtSecret;
  try {
    jwtSecret = getJwtSecret();
  } catch (e) {
    return authErrorJson(AuthErrorCode.AUTH_JWT_NOT_CONFIGURED, 500);
  }

  console.log('[FORGOT-PASSWORD] ====== START ======');
  
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return authErrorJson(AuthErrorCode.AUTH_INVALID_JSON, 400);
  }
  
  const { email } = body;
  
  if (!email) {
    return authErrorJson(AuthErrorCode.AUTH_EMAIL_REQUIRED, 400);
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  
  // Get Supabase client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    return authErrorJson(AuthErrorCode.AUTH_DATABASE_NOT_CONFIGURED, 500);
  }
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // Find user
  const { data: user } = await supabase
    .from('profiles')
    .select('id, email, first_name')
    .eq('email', normalizedEmail)
    .single();
  
  // Always return success (security - don't reveal if email exists)
  if (!user) {
    console.log('[FORGOT-PASSWORD] User not found:', normalizedEmail);
    return NextResponse.json({ success: true });
  }
  
  // Токен: email в нижнем регистре — совпадение при сбросе без учёта регистра в БД
  const resetToken = jwt.sign(
    { userId: user.id, email: normalizedEmail, type: 'password_reset' },
    jwtSecret,
    { expiresIn: '1h', algorithm: 'HS256' },
  );
  
  const resetUrl = `${getPublicSiteUrl()}/reset-password?token=${resetToken}`;
  const siteName = getSiteDisplayName();
  const first = user.first_name ? String(user.first_name).trim() : '';
  const subject = `Сброс пароля - ${siteName}`;
  const template = buildSimplePremiumEmailTemplate({
    subject,
    preheader: 'Ссылка для сброса пароля действует 1 час',
    title: 'Сброс пароля',
    paragraphs: [
      `Привет${first ? `, ${first}` : ''}! Вы запросили сброс пароля. Нажмите кнопку ниже, чтобы создать новый пароль.`,
      'Ссылка действительна 1 час. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.',
    ],
    cta: { href: resetUrl, label: 'Сбросить пароль' },
  });

  // Stage 201.69 — premium chrome; Stage 200.72 — EmailService + transport guard
  const result = await EmailService.sendEmail(user.email, template);
  if (result?.error === 'API key not configured') {
    console.error('[FORGOT-PASSWORD] RESEND_API_KEY not configured');
    return authErrorJson(AuthErrorCode.AUTH_EMAIL_SERVICE_NOT_CONFIGURED, 500);
  }
  if (result?.success) {
    console.log('[FORGOT-PASSWORD] Reset email sent to:', hashPiiForLog(user.email));
  } else {
    console.error('[FORGOT-PASSWORD] Email error:', result?.error || 'unknown');
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/forgot-password',
    method: 'POST',
    timestamp: new Date().toISOString()
  });
}
