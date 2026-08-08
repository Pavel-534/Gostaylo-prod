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
import { escapeHtml } from '@/lib/email/premium-email-html';

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
  const safeBrand = escapeHtml(siteName);
  const safeFirst = user.first_name ? escapeHtml(String(user.first_name)) : '';
  const subject = `Сброс пароля - ${siteName}`;
  const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
                    <tr>
                      <td style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);padding:32px;text-align:center;">
                        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;">${safeBrand}</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:32px;">
                        <h2 style="margin:0 0 16px;color:#0f172a;font-size:24px;">
                          Сброс пароля
                        </h2>
                        <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                          Привет${safeFirst ? `, ${safeFirst}` : ''}! Вы запросили сброс пароля.
                          Нажмите кнопку ниже, чтобы создать новый пароль:
                        </p>
                        <a href="${resetUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
                          Сбросить пароль
                        </a>
                        <p style="margin:24px 0 0;color:#94a3b8;font-size:14px;">
                          Ссылка действительна 1 час. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

  // Stage 200.72 — EmailService + transport guard (never raw Resend)
  const result = await EmailService.sendEmail(user.email, { subject, html });
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
