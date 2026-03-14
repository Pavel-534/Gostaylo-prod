/**
 * Gostaylo - Partner Applications API
 * POST /api/v2/partner/applications - Submit partner application
 * 
 * CRITICAL: Applications go through MANUAL MODERATION
 * - Saves to partner_applications table with status='PENDING'
 * - Sends Telegram notification to admin
 * - Does NOT change user role automatically
 */

import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_ADMIN_GROUP_ID = process.env.TELEGRAM_ADMIN_GROUP_ID
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.gostaylo.com'

// Send Telegram notification to admin
async function sendTelegramNotification(application, userEmail) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_GROUP_ID) {
    console.log('[TELEGRAM] Bot not configured, skipping notification')
    return false
  }
  
  try {
    const message = `
🆕 <b>New Partner Application</b>

<b>User:</b> ${userEmail}
<b>Phone:</b> ${application.phone}
<b>Experience:</b> ${application.experience}
<b>Social:</b> ${application.social_link || 'N/A'}
<b>Portfolio:</b> ${application.portfolio || 'N/A'}

<b>Review in Admin:</b>
${APP_URL}/admin/users

⏰ Please review within 24 hours
    `.trim()
    
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_ADMIN_GROUP_ID,
        text: message,
        parse_mode: 'HTML'
      })
    })
    
    return true
  } catch (error) {
    console.error('[TELEGRAM] Failed to send notification:', error)
    return false
  }
}

export async function POST(request) {
  try {
    const { userId, phone, experience, socialLink, portfolio } = await request.json()
    
    if (!userId || !phone || !experience) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId, phone, experience'
      }, { status: 400 })
    }
    
    // Check if user exists
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .single()
    
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }
    
    // Check if already a partner
    if (user.role === 'PARTNER') {
      return NextResponse.json({
        success: false,
        error: 'User is already a partner'
      }, { status: 400 })
    }
    
    // Check for existing pending application
    const { data: existingApp } = await supabaseAdmin
      .from('partner_applications')
      .select('id, status')
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .single()
    
    if (existingApp) {
      return NextResponse.json({
        success: false,
        error: 'You already have a pending application'
      }, { status: 400 })
    }
    
    // Create application with PENDING status
    const { data: application, error: createError } = await supabaseAdmin
      .from('partner_applications')
      .insert({
        user_id: userId,
        phone,
        experience,
        social_link: socialLink || null,
        portfolio: portfolio || null,
        status: 'PENDING',
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (createError) {
      console.error('[APPLICATION] Create error:', createError)
      return NextResponse.json({
        success: false,
        error: 'Failed to submit application'
      }, { status: 500 })
    }
    
    // Send Telegram notification to admin
    await sendTelegramNotification(application, user.email)
    
    console.log(`[APPLICATION] New partner application from ${user.email} (${userId})`)
    
    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully! We\'ll review it within 24 hours.',
      data: {
        id: application.id,
        status: application.status,
        created_at: application.created_at
      }
    })
    
  } catch (error) {
    console.error('[APPLICATION ERROR]', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
