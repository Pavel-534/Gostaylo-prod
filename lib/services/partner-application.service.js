/**
 * Partner application submission — single source of truth (Phase 1.8).
 * Used by POST /api/v2/partner/applications (canonical) and POST /api/v2/partner/apply (legacy alias).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { getPublicSiteUrl } from '@/lib/site-url.js'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_ADMIN_GROUP_ID = process.env.TELEGRAM_ADMIN_GROUP_ID
const APP_URL = getPublicSiteUrl()
const TOPIC_NEW_PARTNERS = 17

function isAllowedVerificationDocUrl(url) {
  const u = String(url || '').trim()
  if (u.length < 8) return false
  if (u.startsWith('/_storage/')) return true
  if (u.startsWith('https://') || u.startsWith('http://')) return true
  return false
}

function telegramSafeDocHref(docUrl) {
  if (!docUrl || typeof docUrl !== 'string') return ''
  const u = docUrl.trim()
  if (!u) return ''
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  try {
    return new URL(u, APP_URL).href
  } catch {
    const base = APP_URL.replace(/\/$/, '')
    return u.startsWith('/') ? `${base}${u}` : `${base}/${u}`
  }
}

export async function sendPartnerApplicationTelegram({ application, userEmail }) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_GROUP_ID) {
    console.log('[TELEGRAM] Bot not configured, skipping partner application notification')
    return false
  }

  const docHref = telegramSafeDocHref(application?.verification_doc_url)
  const docLine = docHref
    ? `\n📎 <b>Документ:</b> <a href="${docHref.replace(/&/g, '&amp;')}">открыть</a>`
    : ''

  try {
    const message = [
      '🤝 <b>НОВАЯ ЗАЯВКА НА ПАРТНЁРСТВО</b>',
      '',
      `📧 <b>Email:</b> ${userEmail}`,
      `📞 <b>Телефон:</b> ${application.phone || '—'}`,
      `📝 <b>Опыт:</b> ${(application.experience || '—').substring(0, 200)}`,
      application.social_link ? `🔗 <b>Соцсети:</b> ${application.social_link}` : '',
      application.portfolio ? `📂 <b>Портфолио:</b> ${application.portfolio}` : '',
      docLine,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      `🔗 <a href="${APP_URL}/admin/partners">Заявки партнёров →</a>`,
      ` · <a href="${APP_URL}/admin/users">Пользователи →</a>`,
      '',
      '⏰ Рассмотреть в течение 24 часов',
    ]
      .filter(Boolean)
      .join('\n')

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_ADMIN_GROUP_ID,
        message_thread_id: TOPIC_NEW_PARTNERS,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    return true
  } catch (error) {
    console.error('[TELEGRAM] Failed to send partner application notification:', error)
    return false
  }
}

/**
 * Persist partner application + sync profile phone. No Telegram.
 * @returns {Promise<{ ok: true, application: object, user: object } | { ok: false, status: number, body: object }>}
 */
export async function submitPartnerApplicationCore({
  userId,
  phone,
  experience,
  socialLink,
  portfolio,
  verificationDocUrl,
}) {
  const docRaw = typeof verificationDocUrl === 'string' ? verificationDocUrl.trim() : ''
  if (!docRaw || !isAllowedVerificationDocUrl(docRaw)) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        error:
          'Загрузите документ удостоверения личности (паспорт или ID). После загрузки отправьте заявку снова.',
      },
    }
  }

  if (!phone || !experience) {
    return {
      ok: false,
      status: 400,
      body: { success: false, error: 'Missing required fields: phone, experience' },
    }
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role')
    .eq('id', userId)
    .single()

  if (userError || !user) {
    return { ok: false, status: 404, body: { success: false, error: 'User not found' } }
  }

  if (user.role === 'PARTNER') {
    return { ok: false, status: 400, body: { success: false, error: 'User is already a partner' } }
  }

  let normalizedPortfolio = typeof portfolio === 'string' ? portfolio.trim() : ''
  normalizedPortfolio = normalizedPortfolio || null
  if (
    normalizedPortfolio &&
    !normalizedPortfolio.startsWith('http://') &&
    !normalizedPortfolio.startsWith('https://')
  ) {
    normalizedPortfolio = `https://${normalizedPortfolio}`
  }
  const social = typeof socialLink === 'string' ? socialLink.trim() : ''
  const socialNorm = social || null

  const { data: existingApp } = await supabaseAdmin
    .from('partner_applications')
    .select('id, status')
    .eq('user_id', userId)
    .maybeSingle()

  let application = null

  if (existingApp) {
    if (existingApp.status === 'PENDING') {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: 'You already have a pending application' },
      }
    }
    if (existingApp.status === 'APPROVED') {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error:
            'Заявка уже была одобрена. Если кабинет партнёра не открылся — напишите в поддержку.',
        },
      }
    }
    if (existingApp.status === 'REJECTED') {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('partner_applications')
        .update({
          phone,
          experience,
          social_link: socialNorm,
          portfolio: normalizedPortfolio,
          verification_doc_url: docRaw,
          status: 'PENDING',
          rejection_reason: null,
          reviewed_by: null,
          reviewed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingApp.id)
        .select()
        .single()

      if (updateError || !updated) {
        console.error('[PARTNER-APPLICATION] Resubmit update error:', updateError)
        return {
          ok: false,
          status: 500,
          body: { success: false, error: 'Failed to submit application' },
        }
      }
      application = updated
    } else {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: 'Invalid application state' },
      }
    }
  }

  if (!application) {
    const { data: inserted, error: createError } = await supabaseAdmin
      .from('partner_applications')
      .insert({
        user_id: userId,
        phone,
        experience,
        social_link: socialNorm,
        portfolio: normalizedPortfolio,
        verification_doc_url: docRaw,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (createError || !inserted) {
      console.error('[PARTNER-APPLICATION] Create error:', createError)
      return {
        ok: false,
        status: 500,
        body: { success: false, error: 'Failed to submit application' },
      }
    }
    application = inserted
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      phone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (profileError) {
    console.error('[PARTNER-APPLICATION] Profile phone update error:', profileError)
  }

  return { ok: true, application, user }
}

/**
 * Unified POST handler for partner application routes.
 */
export async function handlePartnerApplicationPost(request) {
  const sessionUserId = await getUserIdFromSession()
  if (!sessionUserId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { phone, experience, socialLink, portfolio, verificationDocUrl, userId: bodyUserId } =
    body || {}

  if (bodyUserId && bodyUserId !== sessionUserId) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
  }

  const result = await submitPartnerApplicationCore({
    userId: sessionUserId,
    phone,
    experience,
    socialLink,
    portfolio,
    verificationDocUrl,
  })

  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status })
  }

  const { application, user } = result

  await sendPartnerApplicationTelegram({ application, userEmail: user.email })

  console.log(`[PARTNER-APPLICATION] Submitted from ${user.email} (${sessionUserId})`)

  return NextResponse.json({
    success: true,
    message: "Application submitted successfully! We'll review it within 24 hours.",
    data: {
      id: application.id,
      status: application.status,
      created_at: application.created_at,
    },
    redirectTo: '/partner-application-success',
  })
}
