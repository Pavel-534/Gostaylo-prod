/**
 * Gostaylo - Auth Register API (v2)
 * POST /api/v2/auth/register
 * 
 * Security: bcrypt + JWT + Email verification
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimitCheck } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.gostaylo.com';

// Generate verification token
function generateVerificationToken(userId, email) {
  return jwt.sign(
    { userId, email, type: 'email_verification' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Send verification email via Resend
async function sendVerificationEmail(user, token) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM = process.env.EMAIL_FROM || 'Gostaylo <booking@gostaylo.com>';
  
  if (!RESEND_API_KEY) {
    console.error('[EMAIL] RESEND_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }
  
  const verifyUrl = `${BASE_URL}/api/v2/auth/verify?token=${token}`;
  
  try {
    console.log('[EMAIL] Sending verification to:', user.email);
    console.log('[EMAIL] From:', EMAIL_FROM);
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: user.email,
        subject: 'Подтвердите ваш email - Gostaylo',
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
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:32px;">
                        <h2 style="margin:0 0 16px;color:#0f172a;font-size:24px;">
                          Подтвердите ваш email
                        </h2>
                        <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                          Привет${user.first_name ? `, ${user.first_name}` : ''}! Для завершения регистрации нажмите кнопку ниже:
                        </p>
                        <a href="${verifyUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
                          Подтвердить email
                        </a>
                        <p style="margin:24px 0 0;color:#94a3b8;font-size:14px;">
                          Ссылка действительна 24 часа. Если вы не регистрировались на Gostaylo, просто проигнорируйте это письмо.
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
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('[EMAIL] Verification email sent:', result.id);
      return { success: true };
    } else {
      console.error('[EMAIL] Resend error:', JSON.stringify(result));
      return { success: false, error: result.message || 'Email send failed' };
    }
  } catch (error) {
    console.error('[EMAIL] Exception:', error.message);
    return { success: false, error: error.message };
  }
}

// Send Telegram notification
async function sendTelegramNotification(user) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_ADMIN_GROUP_ID;
  
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log('[TELEGRAM] Not configured, skipping');
    return false;
  }
  
  try {
    const message = `🆕 *Новая регистрация*\n\n👤 ${user.first_name || 'Аноним'}\n📧 ${user.email}\n🎫 \`${user.referral_code}\``;
    
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    console.log('[TELEGRAM] Notification sent');
    return true;
  } catch (error) {
    console.error('[TELEGRAM] Error:', error.message);
    return false;
  }
}

export async function POST(request) {
  const rl = rateLimitCheck(request, 'auth');
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
  }

  console.log('[REGISTER] ====== START ======');

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
  
  const { email, password, firstName, lastName, phone, referredBy } = body;
  
  if (!email) {
    return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
  }
  
  if (!password || password.length < 6) {
    return NextResponse.json({ success: false, error: 'Password must be at least 6 characters' }, { status: 400 });
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check existing
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();
  
  if (existing) {
    return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 400 });
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  
  // Generate IDs
  const profileId = `user-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
  const refCode = `GS${Math.floor(10000 + Math.random() * 90000)}`;
  
  // Insert user (NOT verified yet)
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
      is_verified: false,
      verification_status: 'PENDING',
      preferred_currency: 'THB',
      language: 'ru'
    })
    .select('id, email, role, first_name, last_name, referral_code')
    .single();
  
  if (error) {
    console.error('[REGISTER] DB Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  
  console.log('[REGISTER] User created:', user.id);
  
  // Generate verification token
  const verificationToken = generateVerificationToken(user.id, user.email);
  
  // Send verification email
  const emailResult = await sendVerificationEmail(user, verificationToken);
  
  // Send Telegram notification (non-blocking)
  sendTelegramNotification(user).catch(() => {});
  
  // Handle referral
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
      }
    } catch (e) {}
  }
  
  return NextResponse.json({ 
    success: true,
    requiresVerification: true,
    emailSent: emailResult.success,
    emailError: emailResult.error || null,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      isVerified: false,
      verificationStatus: 'PENDING'
    }
  });
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/api/v2/auth/register',
    timestamp: new Date().toISOString()
  });
}
