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
import { getTransactionalFromAddress } from '@/lib/email-env';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.gostaylo.com';

export async function POST(request) {
  const rl = rateLimitCheck(request, 'auth');
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
  }

  console.log('[FORGOT-PASSWORD] ====== START ======');
  
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  
  const { email } = body;
  
  if (!email) {
    return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  
  // Get Supabase client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
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
    return NextResponse.json({ 
      success: true, 
      message: 'If an account exists, a reset link has been sent' 
    });
  }
  
  // Токен: email в нижнем регистре — совпадение при сбросе без учёта регистра в БД
  const resetToken = jwt.sign(
    { userId: user.id, email: normalizedEmail, type: 'password_reset' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  const resetUrl = `${BASE_URL}/reset-password?token=${resetToken}`;
  
  // Send email via Resend
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM = getTransactionalFromAddress();
  
  if (!RESEND_API_KEY) {
    console.error('[FORGOT-PASSWORD] RESEND_API_KEY not configured');
    return NextResponse.json({ success: false, error: 'Email service not configured' }, { status: 500 });
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: user.email,
        subject: 'Сброс пароля - GoStayLo',
        html: `
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
                        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;">GoStayLo</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:32px;">
                        <h2 style="margin:0 0 16px;color:#0f172a;font-size:24px;">
                          Сброс пароля
                        </h2>
                        <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                          Привет${user.first_name ? `, ${user.first_name}` : ''}! Вы запросили сброс пароля.
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
        `
      })
    });
    
    if (response.ok) {
      console.log('[FORGOT-PASSWORD] Reset email sent to:', user.email);
    } else {
      const error = await response.text();
      console.error('[FORGOT-PASSWORD] Resend error:', error);
    }
  } catch (error) {
    console.error('[FORGOT-PASSWORD] Email error:', error.message);
  }
  
  return NextResponse.json({ 
    success: true, 
    message: 'If an account exists, a reset link has been sent' 
  });
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/forgot-password',
    method: 'POST',
    timestamp: new Date().toISOString()
  });
}
