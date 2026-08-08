/**
 * GoStayLo - Admin Partners Management API
 * GET /api/v2/admin/partners - List pending partner applications
 * POST /api/v2/admin/partners - Approve or reject applications
 * 
 * Uses partner_applications table
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url.js';
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { recordSystemAutoVerification } from '@/lib/services/audit/system-auto-verification';
import { NotificationService } from '@/lib/services/notification.service.js';
import { escapeTelegramHtmlText } from '@/lib/services/notifications/formatting.js';

export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = getPublicSiteUrl();

/** Stage 90.1 — staff может одобрять заявки (тот же контур, что **`/api/admin/**`**). */
async function verifyPartnerAdmin(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return { error: access.error };
  return { userId: String(access.profile?.id || ''), profile: access.profile };
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
  const auth = await verifyPartnerAdmin(request);
  if (auth.error) {
    return auth.error;
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
  const auth = await verifyPartnerAdmin(request);
  if (auth.error) {
    return auth.error;
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
    
    // Update profiles table - change role to PARTNER + platform VERIFIED (Stage 90.1)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        role: 'PARTNER',
        is_verified: true,
        verification_status: 'VERIFIED',
        updated_at: now
      })
      .eq('id', userId);
    
    if (profileError) {
      console.error('[ADMIN-PARTNERS] Profile update error:', profileError);
      return NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
    }

    await recordSystemAutoVerification({
      userId,
      applicationId: application.id,
      actorId: auth.userId,
      source: 'partner_application_approved',
      extra: { reviewedByRole: auth.profile?.role ?? null },
    });

    // Stage 200.74 — registry email (PARTNER_VERIFIED); Telegram stays in-route
    void NotificationService.dispatch('PARTNER_VERIFIED', {
      partner: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        name: user.first_name,
        language: user.language || user.preferred_language || 'ru',
        telegram_id: user.telegram_id,
      },
    }).catch((err) => console.warn('[ADMIN-PARTNERS] PARTNER_VERIFIED:', err?.message || err));
    
    if (user.telegram_id) {
      const brandSafe = escapeTelegramHtmlText(getSiteDisplayName());
      await sendTelegramToUser(user.telegram_id, 
        `🎉 <b>Поздравляем!</b>\n\nВаша заявка на партнёрство в ${brandSafe} одобрена!\n\n` +
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
    
    // Stage 200.74 — registry rejection email
    void NotificationService.dispatch('PARTNER_REJECTED', {
      partner: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        language: user.language || user.preferred_language || 'ru',
      },
      reason: rejectionReason,
    }).catch((err) => console.warn('[ADMIN-PARTNERS] PARTNER_REJECTED:', err?.message || err));
    
    if (user.telegram_id) {
      await sendTelegramToUser(user.telegram_id, 
        `📋 <b>Заявка на партнёрство</b>\n\n` +
        `К сожалению, ваша заявка не была одобрена.\n\n` +
        `<b>Причина:</b> ${escapeTelegramHtmlText(rejectionReason)}\n\n` +
        `Вы можете подать новую заявку позже.`
      );
    }
    
    console.log(`[ADMIN-PARTNERS] Rejected: ${user.email}`);
    
    return NextResponse.json({ success: true, message: 'Partner rejected' });
  }
  
  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
}
