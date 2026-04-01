/**
 * GoStayLo - Admin Partners Management API
 * GET /api/v2/admin/partners - List pending partner applications
 * POST /api/v2/admin/partners - Approve or reject applications
 * 
 * Uses partner_applications table
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { getPublicSiteUrl } from '@/lib/site-url.js';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = getPublicSiteUrl();
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Verify admin access
function verifyAdmin(request) {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('gostaylo_session');
  
  if (!sessionCookie?.value) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  try {
    const decoded = jwt.verify(sessionCookie.value, JWT_SECRET);
    if (decoded.role !== 'ADMIN') {
      return { error: 'Admin access required', status: 403 };
    }
    return { userId: decoded.userId, role: decoded.role };
  } catch (e) {
    return { error: 'Invalid session', status: 401 };
  }
}

// Send email via Resend
async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.log('[EMAIL] Resend not configured');
    return false;
  }
  
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'GoStayLo <noreply@gostaylo.com>',
        to: [to],
        subject,
        html
      })
    });
    
    const result = await res.json();
    console.log('[EMAIL] Sent to:', to, result);
    return res.ok;
  } catch (e) {
    console.error('[EMAIL] Error:', e.message);
    return false;
  }
}

// Send Telegram message to user
async function sendTelegramToUser(telegramId, message) {
  if (!BOT_TOKEN || !telegramId) return false;
  
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    return true;
  } catch (e) {
    console.error('[TELEGRAM] Error:', e.message);
    return false;
  }
}

/**
 * GET - List pending partner applications from partner_applications table
 */
export async function GET(request) {
  const auth = verifyAdmin(request);
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // Fetch pending applications with user profile data
  const { data: applications, error } = await supabase
    .from('partner_applications')
    .select(`
      *,
      profiles:user_id (
        id,
        email,
        first_name,
        last_name,
        telegram_id,
        avatar,
        created_at
      )
    `)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[ADMIN-PARTNERS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  
  // Transform data for frontend
  const processedApps = (applications || []).map(app => ({
    id: app.profiles?.id || app.user_id,
    application_id: app.id,
    email: app.profiles?.email,
    first_name: app.profiles?.first_name,
    last_name: app.profiles?.last_name,
    telegram_id: app.profiles?.telegram_id,
    avatar: app.profiles?.avatar,
    phone: app.phone,
    user_created_at: app.profiles?.created_at,
    verification_doc_url: app.verification_doc_url,
    metadata: {
      social_link: app.social_link || '',
      experience: app.experience || '',
      portfolio: app.portfolio || '',
      partner_applied_at: app.created_at
    },
    created_at: app.created_at,
    updated_at: app.updated_at
  }));
  
  return NextResponse.json({
    success: true,
    applications: processedApps,
    count: processedApps.length
  });
}

/**
 * POST - Approve or reject partner application
 * Updates both partner_applications and profiles tables
 */
export async function POST(request) {
  const auth = verifyAdmin(request);
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  
  const { action, userId, reason } = body;
  
  if (!action || !userId) {
    return NextResponse.json({ success: false, error: 'Missing action or userId' }, { status: 400 });
  }
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // Get user profile
  const { data: user, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (fetchError || !user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }
  
  // Get application
  const { data: application } = await supabase
    .from('partner_applications')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'PENDING')
    .single();
  
  if (!application) {
    return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
  }
  
  const now = new Date().toISOString();
  
  if (action === 'approve') {
    // Update partner_applications table
    const { error: appError } = await supabase
      .from('partner_applications')
      .update({
        status: 'APPROVED',
        reviewed_by: auth.userId,
        reviewed_at: now,
        updated_at: now
      })
      .eq('id', application.id);
    
    if (appError) {
      console.error('[ADMIN-PARTNERS] App update error:', appError);
      return NextResponse.json({ success: false, error: appError.message }, { status: 500 });
    }
    
    // Update profiles table - change role to PARTNER
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        role: 'PARTNER',
        verification_status: 'VERIFIED',
        updated_at: now
      })
      .eq('id', userId);
    
    if (profileError) {
      console.error('[ADMIN-PARTNERS] Profile update error:', profileError);
      return NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
    }
    
    // Send approval notifications
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0d9488;">🎉 Добро пожаловать в GoStayLo!</h1>
        <p>Ваша заявка на партнёрство одобрена!</p>
        <p>Теперь вы можете:</p>
        <ul>
          <li>Добавлять объекты недвижимости</li>
          <li>Управлять бронированиями</li>
          <li>Получать выплаты</li>
        </ul>
        <p>
          <a href="${APP_URL}/partner/dashboard" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            Перейти в панель партнёра
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">С уважением,<br>Команда GoStayLo</p>
      </div>
    `;
    
    await sendEmail(user.email, '🎉 Ваша заявка на партнёрство одобрена!', emailHtml);
    
    if (user.telegram_id) {
      await sendTelegramToUser(user.telegram_id, 
        `🎉 <b>Поздравляем!</b>\n\nВаша заявка на партнёрство в GoStayLo одобрена!\n\n` +
        `Теперь вы можете добавлять объекты и принимать бронирования.\n\n` +
        `<a href="${APP_URL}/partner/dashboard">Перейти в панель партнёра</a>`
      );
    }
    
    console.log(`[ADMIN-PARTNERS] Approved: ${user.email}`);
    
    return NextResponse.json({ success: true, message: 'Partner approved' });
  }
  
  if (action === 'reject') {
    const rejectionReason = reason || 'Заявка не соответствует требованиям';
    
    // Update partner_applications table
    const { error: appError } = await supabase
      .from('partner_applications')
      .update({
        status: 'REJECTED',
        rejection_reason: rejectionReason,
        reviewed_by: auth.userId,
        reviewed_at: now,
        updated_at: now
      })
      .eq('id', application.id);
    
    if (appError) {
      console.error('[ADMIN-PARTNERS] App update error:', appError);
      return NextResponse.json({ success: false, error: appError.message }, { status: 500 });
    }
    
    // Note: Don't modify verification_status on rejection - it's an enum
    // The partner_applications table already tracks the rejection
    
    // Send rejection notifications
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #64748b;">Заявка на партнёрство</h1>
        <p>К сожалению, ваша заявка на партнёрство не была одобрена.</p>
        <p><strong>Причина:</strong> ${rejectionReason}</p>
        <p>Вы можете подать новую заявку позже, учтя указанные замечания.</p>
        <p style="color: #666; font-size: 14px;">С уважением,<br>Команда GoStayLo</p>
      </div>
    `;
    
    await sendEmail(user.email, 'Заявка на партнёрство - решение', emailHtml);
    
    if (user.telegram_id) {
      await sendTelegramToUser(user.telegram_id, 
        `📋 <b>Заявка на партнёрство</b>\n\n` +
        `К сожалению, ваша заявка не была одобрена.\n\n` +
        `<b>Причина:</b> ${rejectionReason}\n\n` +
        `Вы можете подать новую заявку позже.`
      );
    }
    
    console.log(`[ADMIN-PARTNERS] Rejected: ${user.email}`);
    
    return NextResponse.json({ success: true, message: 'Partner rejected' });
  }
  
  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
}
