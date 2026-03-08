/**
 * Gostaylo - Auth Register API (v2)
 * POST /api/v2/auth/register
 * 
 * Security: bcrypt password hashing
 * Notifications: Welcome email (Resend) + Telegram admin alert
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// Send welcome email via Resend (non-blocking)
async function sendWelcomeEmail(user) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM = process.env.EMAIL_FROM || 'Gostaylo <booking@gostaylo.com>';
  
  if (!RESEND_API_KEY) {
    console.log('[EMAIL] RESEND_API_KEY not configured, skipping welcome email');
    return false;
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
        subject: 'Добро пожаловать в Gostaylo! 🏠',
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
                        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;">Gostaylo</h1>
                        <p style="margin:16px 0 0;color:#ccfbf1;font-size:14px;">Premium Rentals Worldwide</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:32px;">
                        <h2 style="margin:0 0 16px;color:#0f172a;font-size:24px;">
                          Привет${user.first_name ? `, ${user.first_name}` : ''}! 👋
                        </h2>
                        <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                          Добро пожаловать в Gostaylo — вашу платформу для аренды премиальной недвижимости по всему миру.
                        </p>
                        <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                          Ваш реферальный код: <strong style="color:#0d9488;">${user.referral_code}</strong><br>
                          Приглашайте друзей и получайте бонусы!
                        </p>
                        <a href="https://www.gostaylo.com" style="display:inline-block;background:#0d9488;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
                          Начать поиск
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style="background:#f8fafc;padding:24px 32px;text-align:center;">
                        <p style="margin:0;color:#64748b;font-size:14px;">
                          © ${new Date().getFullYear()} Gostaylo. Все права защищены.
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
      console.log('[EMAIL] Welcome email sent to:', user.email);
      return true;
    } else {
      const error = await response.text();
      console.error('[EMAIL] Resend error:', error);
      return false;
    }
  } catch (error) {
    console.error('[EMAIL] Failed to send welcome email:', error.message);
    return false;
  }
}

// Send Telegram notification to admin (non-blocking)
async function sendTelegramNotification(user) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
  
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log('[TELEGRAM] Bot token or chat ID not configured, skipping notification');
    return false;
  }
  
  try {
    const message = `🆕 *Новая регистрация на Gostaylo*

👤 *Имя:* ${user.first_name || 'Не указано'}
📧 *Email:* ${user.email}
🎫 *Реферальный код:* \`${user.referral_code}\`
🕐 *Время:* ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`;

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    
    if (response.ok) {
      console.log('[TELEGRAM] Admin notification sent');
      return true;
    } else {
      const error = await response.text();
      console.error('[TELEGRAM] Error:', error);
      return false;
    }
  } catch (error) {
    console.error('[TELEGRAM] Failed to send notification:', error.message);
    return false;
  }
}

export async function POST(request) {
  const timestamp = new Date().toISOString();
  console.log(`[REGISTER] ====== START ${timestamp} ======`);
  
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
  
  const { email, password, firstName, lastName, phone, referredBy } = body;
  
  // 4. Validation
  if (!email) {
    return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
  }
  
  if (!password || password.length < 6) {
    return NextResponse.json({ success: false, error: 'Password must be at least 6 characters' }, { status: 400 });
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  
  // 5. Check existing user
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();
  
  if (existing) {
    return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 400 });
  }
  
  // 6. Hash password with bcrypt (10 rounds)
  const passwordHash = await bcrypt.hash(password, 10);
  
  // 7. Generate IDs
  const profileId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
  const refCode = `GS${Math.floor(10000 + Math.random() * 90000)}`;
  
  // 8. Insert user
  const { data: user, error } = await supabase
    .from('profiles')
    .insert({
      id: profileId,
      email: normalizedEmail,
      password_hash: passwordHash,
      role: 'RENTER',
      first_name: firstName?.trim() || null,
      last_name: lastName?.trim() || null,
      phone: phone?.trim() || null,
      referral_code: refCode,
      referred_by: referredBy || null,
      is_verified: true,
      verification_status: 'VERIFIED',
      preferred_currency: 'THB',
      language: 'ru'
    })
    .select('id, email, role, first_name, last_name, referral_code')
    .single();
  
  if (error) {
    console.error('[REGISTER] DB Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      code: error.code
    }, { status: 500 });
  }
  
  console.log('[REGISTER] User created:', user.id);
  
  // 9. Handle referral (non-blocking)
  if (referredBy) {
    try {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', referredBy)
        .single();
      
      if (referrer) {
        await supabase.from('referrals').insert({
          referrer_id: referrer.id,
          referred_id: user.id
        });
        console.log('[REGISTER] Referral recorded');
      }
    } catch (refErr) {
      console.error('[REGISTER] Referral error:', refErr.message);
    }
  }
  
  // 10. Send notifications (NON-BLOCKING - registration succeeds even if these fail)
  // Fire and forget - don't await
  Promise.all([
    sendWelcomeEmail(user),
    sendTelegramNotification(user)
  ]).catch(err => {
    console.error('[REGISTER] Notification error:', err.message);
  });
  
  // 11. Return success
  return NextResponse.json({ 
    success: true, 
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      referralCode: user.referral_code,
      isVerified: true
    },
    redirectTo: '/'
  });
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/register',
    method: 'POST',
    timestamp: new Date().toISOString()
  });
}
