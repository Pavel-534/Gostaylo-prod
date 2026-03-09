/**
 * Gostaylo - Partner Application API
 * POST /api/v2/partner/apply
 * 
 * Handles partner application submission
 * Sets verification_status to 'PENDING_PARTNER'
 * Sends Telegram notification to admin
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

export async function POST(request) {
  console.log('[PARTNER-APPLY] ====== START ======');
  
  // Verify JWT from cookie
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('gostaylo_session');
  
  if (!sessionCookie?.value) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  let decoded;
  try {
    decoded = jwt.verify(sessionCookie.value, JWT_SECRET);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
  }
  
  const userId = decoded.userId;
  console.log('[PARTNER-APPLY] User:', userId);
  
  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  
  const { phone, socialLink, experience, portfolio } = body;
  
  // Validate required fields
  if (!phone || !experience) {
    return NextResponse.json({ 
      success: false, 
      error: 'Телефон и опыт обязательны' 
    }, { status: 400 });
  }
  
  // Normalize portfolio URL
  let normalizedPortfolio = portfolio?.trim() || '';
  if (normalizedPortfolio && !normalizedPortfolio.startsWith('http://') && !normalizedPortfolio.startsWith('https://')) {
    normalizedPortfolio = 'https://' + normalizedPortfolio;
  }
  
  // Get Supabase client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
  }
  
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // Get current user data
  const { data: currentUser, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (fetchError || !currentUser) {
    console.error('[PARTNER-APPLY] User not found:', fetchError);
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }
  
  // Check if already applied or is partner
  if (currentUser.role === 'PARTNER') {
    return NextResponse.json({ success: false, error: 'Вы уже партнёр' }, { status: 400 });
  }
  
  if (currentUser.verification_status === 'PENDING_PARTNER') {
    return NextResponse.json({ success: false, error: 'Заявка уже подана' }, { status: 400 });
  }
  
  // Update profile with partner application data
  // Store application data in rejection_reason as JSON with type identifier
  const applicationData = JSON.stringify({
    type: 'PARTNER_APPLICATION',
    social_link: socialLink || '',
    experience: experience,
    portfolio: normalizedPortfolio,
    applied_at: new Date().toISOString()
  });
  
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({
      phone: phone,
      verification_status: 'PENDING', // Using standard PENDING value
      rejection_reason: applicationData, // Store app data with type marker
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single();
  
  if (updateError) {
    console.error('[PARTNER-APPLY] Update error:', updateError);
    return NextResponse.json({ success: false, error: 'Failed to submit application' }, { status: 500 });
  }
  
  console.log('[PARTNER-APPLY] Profile updated, sending Telegram notification...');
  
  // Send Telegram notification to admin
  if (BOT_TOKEN && ADMIN_GROUP_ID) {
    try {
      const experienceText = experience.length > 500 
        ? experience.substring(0, 500) + '...' 
        : experience;
      
      const message = `🤝 <b>НОВАЯ ЗАЯВКА НА ПАРТНЁРСТВО</b>\n\n` +
        `👤 <b>ID:</b> <code>${userId}</code>\n` +
        `📧 <b>Email:</b> ${currentUser.email}\n` +
        `👤 <b>Имя:</b> ${currentUser.first_name || 'Не указано'}\n` +
        `📞 <b>Телефон:</b> ${phone}\n` +
        `💬 <b>Соцсети:</b> ${socialLink || 'Не указано'}\n` +
        `🔗 <b>Портфолио:</b> ${normalizedPortfolio || 'Не указано'}\n\n` +
        `📝 <b>Опыт:</b>\n<i>${experienceText}</i>\n\n` +
        `⏳ <i>Ожидает модерации</i>\n\n` +
        `<a href="${APP_URL}/admin/partners">Открыть заявки</a>`;
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_GROUP_ID,
          message_thread_id: 17, // NEW_PARTNERS topic
          text: message,
          parse_mode: 'HTML'
        })
      });
      
      console.log('[PARTNER-APPLY] Telegram notification sent');
    } catch (telegramError) {
      console.error('[PARTNER-APPLY] Telegram error (non-blocking):', telegramError.message);
    }
  }
  
  console.log('[PARTNER-APPLY] ====== SUCCESS ======');
  
  return NextResponse.json({
    success: true,
    message: 'Заявка отправлена',
    redirectTo: '/partner-application-success',
    user: {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      verification_status: updated.verification_status
    }
  });
}
