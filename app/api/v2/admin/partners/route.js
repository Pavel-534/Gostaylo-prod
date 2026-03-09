/**
 * Gostaylo - Admin Partners Management API
 * GET /api/v2/admin/partners - List pending partner applications
 * POST /api/v2/admin/partners - Approve or reject applications
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_GROUP_ID = process.env.TELEGRAM_ADMIN_GROUP_ID;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.gostaylo.com';
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
        from: 'Gostaylo <noreply@gostaylo.com>',
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
 * GET - List pending partner applications
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
  
  const { data: applications, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('verification_status', 'PENDING_PARTNER')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[ADMIN-PARTNERS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    applications: applications || [],
    count: applications?.length || 0
  });
}

/**
 * POST - Approve or reject partner application
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
  
  // Get user data first
  const { data: user, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (fetchError || !user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }
  
  if (action === 'approve') {
    // Update to PARTNER role
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: 'PARTNER',
        verification_status: 'VERIFIED',
        metadata: {
          ...(user.metadata || {}),
          partner_status: 'APPROVED',
          partner_approved_at: new Date().toISOString(),
          approved_by: auth.userId
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (updateError) {
      console.error('[ADMIN-PARTNERS] Approve error:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }
    
    // Send approval notifications
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0d9488;">🎉 Добро пожаловать в Gostaylo!</h1>
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
        <p style="color: #666; font-size: 14px;">С уважением,<br>Команда Gostaylo</p>
      </div>
    `;
    
    await sendEmail(user.email, '🎉 Ваша заявка на партнёрство одобрена!', emailHtml);
    
    if (user.telegram_id) {
      await sendTelegramToUser(user.telegram_id, 
        `🎉 <b>Поздравляем!</b>\n\nВаша заявка на партнёрство в Gostaylo одобрена!\n\n` +
        `Теперь вы можете добавлять объекты и принимать бронирования.\n\n` +
        `<a href="${APP_URL}/partner/dashboard">Перейти в панель партнёра</a>`
      );
    }
    
    console.log(`[ADMIN-PARTNERS] Approved: ${user.email}`);
    
    return NextResponse.json({ success: true, message: 'Partner approved' });
  }
  
  if (action === 'reject') {
    // Update status back to RENTER
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        verification_status: 'REJECTED',
        metadata: {
          ...(user.metadata || {}),
          partner_status: 'REJECTED',
          partner_rejected_at: new Date().toISOString(),
          rejection_reason: reason || 'Заявка не соответствует требованиям',
          rejected_by: auth.userId
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (updateError) {
      console.error('[ADMIN-PARTNERS] Reject error:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }
    
    // Send rejection notifications
    const rejectionReason = reason || 'Заявка не соответствует требованиям';
    
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #64748b;">Заявка на партнёрство</h1>
        <p>К сожалению, ваша заявка на партнёрство не была одобрена.</p>
        <p><strong>Причина:</strong> ${rejectionReason}</p>
        <p>Вы можете подать новую заявку позже, учтя указанные замечания.</p>
        <p style="color: #666; font-size: 14px;">С уважением,<br>Команда Gostaylo</p>
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
